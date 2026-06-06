# Strategy Architecture for the Prompt Decomposition Engine

## Why Multiple Strategies Matter

The existing PDE pipeline uses a single fixed approach: keyword matching for directional classification and heuristic-based intent extraction. This works well for straightforward, action-oriented prompts ("Build a REST API with authentication") but struggles with:

- **Nuanced prompts** — "We should probably look into whether our data pipeline can handle the increased load, and if not, somehow figure out a scaling approach that respects our team's capacity" contains hedging, conditionals, and implied requirements that keyword matching misses.
- **Multi-domain prompts** — Prompts that span all four directions simultaneously need deeper understanding to classify correctly.
- **Ambiguous intents** — When the primary intent isn't expressed with a clear action verb, keyword matching defaults to low-confidence guesses.

A strategy pattern allows the engine to adapt its approach to the prompt at hand, using simple keyword matching for simple prompts (fast, deterministic) and richer semantic analysis for complex ones (accurate, resource-intensive).

This follows the Medicine Wheel principle of **balance** — just as a well-formed prompt should touch all four directions, a well-formed engine should have multiple ways of seeing.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    StrategicDecomposer                    │
│  (Top-level API — drop-in replacement for decompose())   │
└──────────────┬──────────────────────────┬────────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────┐   ┌──────────────────────────────┐
│   StrategySelector   │   │     MultiPassDecomposer      │
│                      │   │  (parallel or cascading mode) │
│  ComplexityAnalyzer  │   └──────────┬───────────────────┘
│  Resource check      │              │
│  Preference check    │              ▼
└──────────┬───────────┘   ┌──────────────────────────────┐
           │               │   ConfidenceCalibrator        │
           │               │  (post-processing)            │
           ▼               └──────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│              DecompositionStrategy (interface)            │
├──────────────────┬────────────────┬──────────────────────┤
│  KeywordStrategy │ SemanticStrategy│   HybridStrategy    │
│  (existing code) │  (LLM-based)   │ (keyword+semantic)   │
└──────────────────┴────────────────┴──────────────────────┘
           │                │                │
           ▼                ▼                ▼
┌──────────────────────────────────────────────────────────┐
│          Existing Pipeline Components                     │
│  DirectionalDecomposer → IntentExtractor →               │
│  DependencyMapper → ActionStackBuilder →                 │
│  MedicineWheelBridge                                      │
└──────────────────────────────────────────────────────────┘
```

## The DecompositionStrategy Interface

Every strategy implements:

```typescript
interface DecompositionStrategy {
  readonly id: StrategyId;
  readonly name: string;
  canHandle(resources: AvailableResources): boolean;
  estimateLatency(signals: ComplexitySignals): number;
  decompose(prompt: string, resources: AvailableResources): Promise<StrategyResult>;
}
```

- **`canHandle`** — Self-exclusion based on resource availability (e.g., SemanticStrategy returns `false` without an LLM).
- **`estimateLatency`** — Enables the selector to respect latency budgets.
- **`decompose`** — The main entry point, returning a `StrategyResult` with the full decomposition plus confidence metadata.

## How Each Strategy Works

### KeywordStrategy

Wraps the existing pipeline with zero changes. This is the **baseline** strategy.

| Aspect | Detail |
|--------|--------|
| **Dependencies** | None (always available) |
| **Latency** | ~1-5ms |
| **Accuracy** | Good for simple/moderate prompts, poor for ambiguous |
| **Determinism** | Fully deterministic |
| **Components** | DirectionalDecomposer + IntentExtractor (heuristic) + DependencyMapper + ActionStackBuilder + MedicineWheelBridge |

How it works:
1. Splits prompt into sentences
2. Scores each sentence against `DIRECTION_KEYWORDS` for all four directions
3. Classifies each sentence into its highest-scoring direction
4. Extracts intents via action verb matching
5. Maps dependencies and builds action stack

### SemanticStrategy

Provides LLM-enhanced intent extraction with keyword-based directional analysis. Requires `resources.llm`.

| Aspect | Detail |
|--------|--------|
| **Dependencies** | LLM instance |
| **Latency** | 500ms-5s |
| **Accuracy** | Significantly better intent extraction on nuanced/ambiguous prompts |
| **Determinism** | Non-deterministic (LLM variance on intent extraction) |
| **Components** | IntentExtractor (LLM mode) + DirectionalDecomposer (keyword) + DependencyMapper + ActionStackBuilder + MedicineWheelBridge |

How it works:
1. Uses `IntentExtractor` with the LLM enabled — the LLM identifies implicit intents, understands context and metaphor, and provides better-calibrated confidence scores
2. Directional analysis still uses the keyword-based `DirectionalDecomposer` (the same algorithm as `KeywordStrategy`)
3. Falls back to heuristic intent extraction if the LLM call fails
4. Rest of pipeline (dependency mapping, action stack) runs as normal

> **Note:** True LLM directional classification (i.e., having the LLM classify prompt segments into directions rather than using keyword matching) is a future enhancement. A future `EmbeddingStrategy` or upgraded `SemanticStrategy` would provide this capability.

### HybridStrategy

Runs both keyword and semantic strategies, then merges results with weighted scoring.

| Aspect | Detail |
|--------|--------|
| **Dependencies** | LLM instance |
| **Latency** | ~same as semantic (parallel execution) |
| **Accuracy** | Highest — ensemble approach, primarily via intent extraction diversity |
| **Determinism** | Non-deterministic |
| **Components** | KeywordStrategy + SemanticStrategy + merge logic |

> **Note:** Because both `KeywordStrategy` and `SemanticStrategy` currently use the same keyword-based `DirectionalDecomposer` for directional analysis, the ensemble value is primarily in **intent extraction** (LLM-enhanced vs. heuristic). The directional agreement bonus is reduced accordingly (0.02 rather than the intent-based 0.05). True divergence in directional analysis — and thus fuller ensemble benefit — will come with a future LLM-based directional classifier.

Merging algorithm:
1. **Run both strategies concurrently** via `Promise.all`
2. **Merge directional analyses:**
   - Union of insights per direction
   - Shared insights get confidence = weighted average (keyword×0.35 + semantic×0.65)
   - Single-source insights get a small confidence penalty (×0.8)
3. **Merge intents:**
   - Primary: use whichever has higher confidence
   - Secondary: union, deduplicating by Jaccard similarity on target words
   - Shared intents get boosted confidence; unique ones get slight penalty
4. **Agreement bonus:** When both strategies agree on lead direction and primary action, the overall confidence gets a 0.15 bonus
5. **Rebuild pipeline** from merged data

## The Selection Algorithm

The `StrategySelector` uses a scoring system:

### Step 1: Complexity Analysis

Before any strategy runs, the `ComplexityAnalyzer` computes lightweight signals:

| Signal | What it measures |
|--------|-----------------|
| `wordCount` | Prompt length |
| `clauseCount` | Sentence/clause count |
| `conditionalCount` | "if", "when", "unless", "whether" occurrences |
| `hedgingCount` | "maybe", "probably", "somehow" occurrences |
| `actionVerbCount` | Distinct action verbs detected |
| `directionalSpread` | How many of the 4 directions have keyword matches (0-4) |
| `hasTechnicalReferences` | File paths, code symbols, package references |
| `hasNestedStructure` | Bullet lists, numbered steps, multiple conditionals |

These signals produce a `PromptComplexity` classification:

| Complexity | Criteria |
|-----------|---------|
| **simple** | < 50 words, ≤ 2 action verbs, ≤ 1 direction |
| **moderate** | 50-150 words, 3-4 verbs, 2 directions |
| **complex** | 150+ words, 5+ verbs, 3+ directions |
| **ambiguous** | 3+ hedging instances, or 3+ conditionals with 4+ verbs |

### Step 2: Strategy Scoring

Each feasible strategy is scored:

```
Score = complexity_score + accuracy_bonus + speed_bonus
```

| Complexity | keyword score | semantic score | hybrid score |
|-----------|--------------|---------------|-------------|
| simple    | 1.0          | 0.5           | 0.4         |
| moderate  | 0.6          | 0.8           | 0.9         |
| complex   | 0.3          | 0.7           | 1.0         |
| ambiguous | 0.2          | 0.8           | 1.0         |

- `preferAccuracy` adds +0.3 for hybrid, +0.2 for semantic
- Speed-sensitive mode adds a bonus inversely proportional to estimated latency
- Strategies exceeding `maxLatencyMs` are excluded entirely

### Step 3: Multi-Pass Decision

Multi-pass is triggered when:
- `preferences.alwaysMultiPass` is true
- Complexity is "ambiguous" and an LLM is available
- Complexity is "complex", `preferAccuracy` is true, and an LLM is available

## How Strategies Compose with the Existing Pipeline

The strategy layer is an **outer wrapper** around the existing five-layer pipeline. It does not replace any existing components:

```
                    BEFORE                              AFTER
                    ======                              =====

    decompose(prompt)                    StrategicDecomposer.decompose(prompt)
         │                                         │
         ▼                                         ▼
  DirectionalDecomposer              StrategySelector → picks strategy
         │                                         │
         ▼                                         ▼
    IntentExtractor                  Strategy.decompose(prompt)
         │                                    │
         ▼                                    ▼
   DependencyMapper              ┌─ DirectionalDecomposer ─┐
         │                       │   IntentExtractor         │
         ▼                       │   DependencyMapper        │  (same pipeline,
  ActionStackBuilder             │   ActionStackBuilder      │   used internally
         │                       │   MedicineWheelBridge     │   by each strategy)
         ▼                       └──────────────────────────┘
  MedicineWheelBridge                      │
                                           ▼
                                  ConfidenceCalibrator
                                           │
                                           ▼
                                    StrategyResult
```

### Backward Compatibility

The existing `decompose()` function in `index.ts` remains unchanged. `StrategicDecomposer` is additive — it provides a new, richer API alongside the existing one:

```typescript
// Old API — still works exactly the same
import { decompose } from "ava-langchain-prompt-decomposition";
const result = await decompose("Build a knowledge graph...");

// New API — strategy-aware
import { StrategicDecomposer } from "ava-langchain-prompt-decomposition";
const decomposer = new StrategicDecomposer();
const result = await decomposer.decompose("Build a knowledge graph...");
// result.result.decomposition is the same DecompositionResult type
```

### Integration with ExecutionPlanner

The `StrategyResult.decomposition` field is a standard `DecompositionResult`, which means it plugs directly into `ExecutionPlanner`:

```typescript
const planner = new ExecutionPlanner();
const plan = planner.plan(strategicResult.result.decomposition);
```

### Integration with LangChain Runnables

A `RunnableStrategicDecomposer` can be created following the same pattern as `RunnableDecomposer`, wrapping `StrategicDecomposer` in a `RunnableLambda`:

```typescript
const runnable = new RunnableLambda({
  func: async (prompt: string) => {
    const decomposer = new StrategicDecomposer({ resources: { llm } });
    return decomposer.decompose(prompt);
  },
});
```

## How the Medicine Wheel Epistemology Guides Strategy Selection

The Medicine Wheel is not just a classification framework — it's a worldview that emphasizes **balance**, **relational awareness**, and **ceremony before action**. The strategy system honors this in several ways:

### 1. Balance as a Quality Signal

A well-decomposed prompt should have representation across all four directions. The `ConfidenceCalibrator` uses directional balance as a calibration input: decompositions with extreme imbalance receive a confidence penalty.

This reflects the Medicine Wheel teaching that neglecting any direction leads to incomplete understanding.

### 2. Directional Spread Drives Complexity

The `ComplexityAnalyzer` measures `directionalSpread` — how many of the four directions a prompt touches. A prompt that touches all four directions is inherently more complex and benefits from richer analysis:

- 1 direction → simple prompt → KeywordStrategy is sufficient
- 2-3 directions → moderate → SemanticStrategy provides value
- 4 directions → complex → HybridStrategy captures the full picture

### 3. WEST Direction Demands Accuracy

The WEST direction (Epangishmok/Validation/Ceremony) represents reflection, ethical review, and accountability. When the selector detects strong WEST-direction presence, it biases toward more accurate strategies (semantic/hybrid) because validation decisions are high-stakes.

This mirrors the Medicine Wheel teaching that ceremony should not be rushed.

### 4. Ceremony Gates in Multi-Pass

After multi-pass decomposition, the `MedicineWheelBridge` checks whether ceremony is required (spiritual + emotional quadrants underrepresented). If ceremony is required, it's surfaced in the result — the strategy system does not bypass this check regardless of strategy choice.

### 5. Disagreement as Relational Signal

When strategies disagree (MultiPassDecomposer detects disagreements), this is treated as a **relational signal** — an indication that the prompt needs more dialogue, not just more computation. Disagreements are surfaced to the consumer, encouraging the kind of iterative, relational process the Medicine Wheel teaches.

## Confidence Calibration

Different strategies have different confidence distributions:

| Strategy | Typical range | Tendency |
|----------|--------------|----------|
| Keyword  | 0.4-0.8      | Moderate, stable |
| Semantic | 0.6-0.95     | High, variable |
| Hybrid   | 0.5-0.9      | Well-calibrated |

The `ConfidenceCalibrator` normalizes these through:

1. **Strategy-specific bias correction** — Empirical offsets (e.g., semantic gets -0.05 because LLMs tend toward overconfidence)
2. **Complexity adjustment** — Simple prompts get +0.05, ambiguous get -0.10
3. **Balance adjustment** — Well-balanced decompositions get a boost
4. **Cross-strategy agreement** — In multi-pass mode, agreement on lead direction and primary action yields a +0.08 bonus

These corrections should be tuned empirically as usage data accumulates.

## Future Extensions

### Embedding-Based Strategy

A future `EmbeddingStrategy` could use vector similarity to classify prompt segments against direction prototypes, providing a middle ground between keyword matching and full LLM classification:

```typescript
class EmbeddingStrategy implements DecompositionStrategy {
  // Embed direction descriptions as reference vectors
  // Embed each prompt segment
  // Classify by cosine similarity to direction vectors
}
```

### Custom Strategy Registration

The `StrategySelector.register()` method allows consumers to add domain-specific strategies:

```typescript
selector.register(new DomainSpecificStrategy());
```

### Adaptive Weight Learning

The HybridStrategy's keyword/semantic weights (currently 0.35/0.65) could be learned from feedback:

```typescript
// Future: track which strategy's result was actually used
// and adjust weights via exponential moving average
```

### Strategy Performance Tracking

A `StrategyTracker` could record strategy selection, execution time, and outcome quality to improve the selection algorithm over time.

## Strategy Metadata Contract for Downstream Consumers

The `StrategyMetadata` interface and associated helpers provide a durable, serializable provenance contract for downstream engines (e.g. `ava-langgraph-prompt-decomposition-engine`, `inquiry-routing-engine`).

### StrategyMetadata

```typescript
interface StrategyMetadata {
  schemaVersion: 1;                  // portable metadata contract version
  strategyId: StrategyId;            // which strategy produced this
  selectionReason: string;           // why it was selected
  complexity: {                      // pre-decomposition analysis
    level: PromptComplexity;
    wordCount: number;
    clauseCount: number;
    conditionalCount: number;
    hedgingCount: number;
    actionVerbCount: number;
    directionalSpread: number;
    hasTechnicalReferences: boolean;
    hasNestedStructure: boolean;
  };
  confidence: {
    overall: number;                 // calibrated overall confidence
    perDirection: Record<string, number>;
  };
  diagnostics: string[];             // full calibration trace
  executionTimeMs: number;
  multiPass?: { ... };               // present only if multi-pass was used
  timestamp: string;                 // ISO 8601
}
```

### DecompositionWithProvenance

Pairs the core `DecompositionResult` (unchanged shape) with `StrategyMetadata` for storage:

```typescript
interface DecompositionWithProvenance {
  decomposition: DecompositionResult;  // standard result — unchanged
  metadata: StrategyMetadata;          // provenance for downstream
  wheelEnriched?: WheelEnrichedAnalysis;
}
```

### Utility Functions

Two functions extract provenance from a `StrategicDecompositionResult`:

```typescript
// Extract just the metadata (e.g., to persist alongside a stored artifact)
const metadata = extractStrategyMetadata(strategicResult);

// Wrap decomposition + metadata together for downstream handoff
const withProvenance = strategicResultToProvenance(strategicResult);

// Persist the core result and strategy metadata together
const stored = saveStrategicDecomposition(workdir, strategicResult, {
  layout: "tree",
});
```

These are designed so that `DecompositionResult` remains the stable core contract and metadata is additive. The metadata timestamp is the decomposition timestamp, so repeated extraction and persistence remain stable.
