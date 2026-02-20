# Prompt Decomposition Engine: LangChain.js Primitives Specification

**Specification Type:** Library Specification
**Document ID:** `rispecs/prompt-decomposition/prompt-decomposition.spec.md`
**Framework:** RISE (Reverse-engineer → Intent-extract → Specify → Export)
**Package:** `ava-langchain-prompt-decomposition`
**Version:** 0.1.2

---

## Desired Outcome Definition

### What Users Want to Create

The **ava-langchain-prompt-decomposition** package enables developers to create **structured understanding from unstructured prompts** through:

1. **Four Directions Analysis** — Every prompt is decomposed through the Medicine Wheel:
   - EAST (Waabinong/Vision): What is being asked? Requirements clarity
   - SOUTH (Zhaawanong/Analysis): What needs to be learned? Dependencies and research
   - WEST (Epangishmok/Validation): What needs reflection? Testing and verification
   - NORTH (Kiiwedinong/Action): What executes? Implementation steps

2. **Intent Extraction** — Primary and secondary intents with urgency, confidence scores, and dependency inference

3. **Dependency-Ordered Action Stacks** — Topologically sorted execution plans that respect task dependencies

4. **Relational Balance Assessment** — Medicine Wheel bridge that measures directional balance and flags ceremony requirements

5. **LangChain Composability** — `RunnableDecomposer`, `RunnableDirectionalAnalyzer`, and `RunnableWheelGate` integrate with LCEL chains

### Success Indicators

- ✅ A developer can call `decompose("complex prompt...")` and receive structured JSON/Markdown output
- ✅ Action stacks respect dependency order (investigate → build → test → deploy)
- ✅ Neglected directions are flagged with relational guidance
- ✅ Ceremony-sensitive prompts trigger appropriate hold recommendations
- ✅ Runnables compose naturally in LangChain expression chains

---

## Structural Tension Analysis

### Current Structural Reality

The library provides these core components:

| Component | Role | Direction |
|-----------|------|-----------|
| `DirectionalDecomposer` | Classifies prompt segments by keyword scoring into Four Directions | EAST |
| `IntentExtractor` | Extracts primary/secondary intents with action verbs, urgency, confidence | EAST |
| `DependencyMapper` | Builds dependency graphs, detects cycles, computes execution order | SOUTH |
| `ActionStackBuilder` | Produces ordered action items with direction tags and JSON/Markdown export | NORTH |
| `MedicineWheelBridge` | Maps directions to quadrants, computes relational coverage, ceremony gating | WEST |
| `RunnableDecomposer` | LangChain Runnable wrapping the full pipeline | Integration |
| `RunnableDirectionalAnalyzer` | Runnable for directional classification only | Integration |
| `RunnableWheelGate` | Runnable for balance checking and ceremony requirements | Integration |

### Natural Progression

The pipeline flows as a natural spiral: **Prompt → Directional Analysis → Intent Extraction → Dependency Mapping → Action Stack → Wheel Enrichment → Output**.

Each stage enriches the previous, creating structural tension between the raw prompt (current reality) and the fully decomposed action plan (desired outcome).

---

## Functional Specification

### Pipeline Function

```typescript
async function decompose(prompt: string, options?: PipelineOptions): Promise<PipelineResult>
```

**Input:** Any natural language prompt
**Output:**
- `decomposition`: Full `DecompositionResult` with action stack, directions, intents
- `wheelEnriched`: `WheelEnrichedAnalysis` with ceremony requirements
- `json`: Serialized PDE JSON format
- `markdown`: Human-readable Markdown output

### Key Data Structures

**DecompositionResult** contains:
- `primary`: `{ action, target, urgency, confidence }`
- `secondary`: Array of `SecondaryIntent` with dependency chains
- `directions`: Map of Direction → DirectionalInsight[]
- `actionStack`: Ordered `ActionItem[]` with direction tags
- `balance`: 0-1 coverage score
- `leadDirection`: Dominant direction
- `neglectedDirections`: Directions with insufficient coverage
- `ambiguities`: Detected ambiguity warnings

### Keyword Classification

Directions are scored by keyword presence in prompt segments:
- **EAST keywords**: vision, goal, purpose, want, need, create, design...
- **SOUTH keywords**: learn, research, investigate, analyze, dependency...
- **WEST keywords**: test, verify, validate, ceremony, ethical, consent...
- **NORTH keywords**: implement, execute, deploy, build, code, ship...

### Dependency Inference Rules

1. Investigation tasks come before creation tasks (when topics overlap)
2. Creation tasks come before test/validation tasks
3. Test tasks come before deployment tasks
4. Cycles are detected and flagged

---

## Integration Points

### Upstream (consumed by)
- `ava-langgraph-prompt-decomposition-engine` — Graph orchestration layer
- `ava-Flowise` — PromptDecomposition AgentFlow node
- `ava-langflow` — PromptDecompositionComponent (via Python parity lib)

### Downstream (depends on)
- `@langchain/core` (optional peer) — For Runnable base class
- `ava-langchain-relational-intelligence` (optional peer) — For deeper relational analysis

### Python Parity
- `langchain-prompt-decomposition` (Python) — Identical API surface in `ava-langchain/libs/prompt-decomposition/`
- Both share the same conceptual model: DirectionalDecomposer, IntentExtractor, DependencyMapper, ActionStackBuilder, MedicineWheelBridge

---

## Testing Strategy

Tests validate:
1. **DirectionalDecomposer**: Keyword scoring, segment classification, balance calculation
2. **IntentExtractor**: Action verb detection, urgency inference, implicit intent discovery
3. **DependencyMapper**: Graph construction, cycle detection, execution order
4. **Pipeline**: End-to-end decompose() produces valid structured output
5. **Runnables**: LangChain Runnable invoke/batch interface compliance
