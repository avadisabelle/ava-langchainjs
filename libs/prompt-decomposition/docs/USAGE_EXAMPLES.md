# Usage Examples — ava-langchain-prompt-decomposition

Three patterns for using the strategy-aware decomposition API.

---

## Example 1: Basic Keyword Decomposition (no LLM required)

Use `StrategicDecomposer` with no options for backward-compatible, deterministic decomposition using only keyword matching. No API keys or external services required.

```typescript
import { StrategicDecomposer } from "ava-langchain-prompt-decomposition";

const decomposer = new StrategicDecomposer();

const result = await decomposer.decompose(
  "Build a REST API with authentication and write tests for each endpoint."
);

// result.result.strategyId === "keyword"
// result.result.decomposition — the standard DecompositionResult
// result.result.confidence     — calibrated confidence (0–1)
// result.selectionReason       — why keyword was chosen
// result.signals               — complexity signals (wordCount, clauseCount, …)

console.log(result.result.strategyId);      // "keyword"
console.log(result.selectionReason);        // "Selected keyword (score: 1.00) for …"
console.log(result.result.decomposition.actions.length); // ordered action items
```

**What's happening:** `ComplexityAnalyzer` classifies the prompt (e.g. `"moderate"`), `StrategySelector` scores each registered strategy and picks `keyword` as the only feasible option (no LLM available), and `ConfidenceCalibrator` applies bias corrections. The returned `DecompositionResult` is identical in shape to the legacy `decompose()` function output.

**Output shape:**
```
result.result.decomposition   → DecompositionResult (actions, executionOrder, ambiguities, …)
result.result.confidence      → number (0–1)
result.selectionReason        → string
result.signals.complexity     → "simple" | "moderate" | "complex" | "ambiguous"
```

---

## Example 2: LLM-Enhanced Strategic Decomposition

Provide an LLM to unlock `SemanticStrategy` (LLM-enhanced intent extraction) for nuanced prompts. The strategy is auto-selected based on prompt complexity. Use `extractStrategyMetadata()` to capture provenance for downstream consumers.

```typescript
import { StrategicDecomposer, extractStrategyMetadata } from "ava-langchain-prompt-decomposition";
import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({ model: "gpt-4o-mini" });

const decomposer = new StrategicDecomposer({
  resources: { llm },
});

const strategic = await decomposer.decompose(
  "Maybe we should investigate whether the data pipeline can handle increased load, " +
  "and if not, design a scaling approach that respects our team's capacity."
);

// For complex/ambiguous prompts the selector will prefer semantic or hybrid
console.log(strategic.result.strategyId);   // "semantic" or "hybrid"
console.log(strategic.selectionReason);     // explains why

// Extract portable metadata for persistence or downstream routing
const metadata = extractStrategyMetadata(strategic);

console.log(metadata.strategyId);           // "semantic"
console.log(metadata.schemaVersion);        // 1
console.log(metadata.complexity.level);     // "ambiguous"
console.log(metadata.complexity.hedgingCount); // 2 (maybe, perhaps)
console.log(metadata.confidence.overall);   // calibrated overall score
console.log(metadata.confidence.perDirection); // { east: 0.4, south: 0.7, … }
console.log(metadata.diagnostics);          // calibration trace strings
console.log(metadata.timestamp);            // stable decomposition timestamp
```

**What's happening:** `ComplexityAnalyzer` detects hedging language and classifies the prompt as `"ambiguous"`. `StrategySelector` scores `semantic` or `hybrid` highest because an LLM is available and accuracy matters more for ambiguous prompts. `SemanticStrategy` uses `IntentExtractor` with the LLM for richer intent extraction (directional analysis is still keyword-based). `ConfidenceCalibrator` normalizes the score.

**Output shape:**
```
metadata.strategyId              → StrategyId
metadata.selectionReason         → string
metadata.complexity              → { level, wordCount, clauseCount, … }
metadata.confidence              → { overall: number, perDirection: Record<string, number> }
metadata.diagnostics             → string[]
metadata.executionTimeMs         → number
metadata.timestamp               → ISO 8601 string
```

---

## Example 3: Multi-Pass with Provenance for Downstream Engines

Run multi-pass decomposition (all strategies in parallel) and convert the result into a `DecompositionWithProvenance` that pairs the core `DecompositionResult` with durable metadata, ready for downstream engine handoff (e.g. `ava-langgraph-prompt-decomposition-engine`).

```typescript
import {
  StrategicDecomposer,
  strategicResultToProvenance,
} from "ava-langchain-prompt-decomposition";
import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({ model: "gpt-4o-mini" });

const decomposer = new StrategicDecomposer({
  resources: { llm },
  preferences: { alwaysMultiPass: true },
});

const strategic = await decomposer.decompose(
  "Design a distributed event-sourcing system. " +
  "Research available frameworks. " +
  "Validate the approach with the team. " +
  "Build an MVP and deploy to staging."
);

// Convert to a provenance-paired artifact
const withProvenance = strategicResultToProvenance(strategic);

// withProvenance.decomposition — unchanged DecompositionResult for existing consumers
// withProvenance.metadata      — StrategyMetadata with full provenance
// withProvenance.wheelEnriched — Medicine Wheel enrichment (if applicable)

// Hand off to a downstream engine
async function sendToDownstreamEngine(data: typeof withProvenance) {
  // decomposition is the stable core contract — downstream engines that already
  // consume DecompositionResult need no changes
  const { decomposition, metadata, wheelEnriched } = data;

  console.log("Strategy used:", metadata.strategyId);
  console.log("Complexity:", metadata.complexity.level);
  console.log("Overall confidence:", metadata.confidence.overall);

  // Multi-pass details are available when present
  if (metadata.multiPass) {
    console.log("Passes run:", metadata.multiPass.totalPasses);
    console.log("Disagreements:", metadata.multiPass.disagreements.length);
    // Surface any disagreements as ambiguity flags upstream
    for (const d of metadata.multiPass.disagreements) {
      console.log(`  [${d.severity}] ${d.aspect}: ${d.description}`);
    }
  }

  // Persist decomposition and metadata as separate serializable artifacts
  await persistDecomposition(decomposition);
  await persistMetadata(metadata);
}

await sendToDownstreamEngine(withProvenance);
```

**What's happening:** `alwaysMultiPass: true` triggers `MultiPassDecomposer.decomposeParallel()`, running all feasible strategies concurrently. `ConfidenceCalibrator.calibrateMultiple()` applies cross-strategy agreement bonuses. `strategicResultToProvenance()` wraps the best result with `StrategyMetadata` (including `multiPass` details) into a `DecompositionWithProvenance`. The core `DecompositionResult` is unchanged — existing downstream consumers require no migration.

**Output shape:**
```
withProvenance.decomposition           → DecompositionResult (unchanged core contract)
withProvenance.metadata                → StrategyMetadata
  .strategyId                          → StrategyId
  .schemaVersion                       → 1
  .selectionReason                     → string
  .complexity                          → { level, wordCount, … }
  .confidence                          → { overall, perDirection }
  .diagnostics                         → string[]
  .executionTimeMs                     → number
  .multiPass                           → { totalPasses, totalExecutionTimeMs,
                                           disagreements[], failures[] }
  .timestamp                           → ISO 8601 string
withProvenance.wheelEnriched           → WheelEnrichedAnalysis | undefined
```
