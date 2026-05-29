# Specification Parity — Strategy Pattern for PDE

This document establishes specification parity between the existing Prompt Decomposition Engine (PDE) pipeline and the new Strategy Pattern extension. It demonstrates that the new architecture is a **superset** of the existing behavior — all existing functionality is preserved, with new capabilities layered on top.

## Parity Matrix

| Capability | Existing Pipeline | Strategy Pattern | Notes |
|---|---|---|---|
| Keyword-based direction classification | ✅ `DirectionalDecomposer` | ✅ `KeywordStrategy` wraps it | Identical output |
| Heuristic intent extraction | ✅ `IntentExtractor` (no LLM) | ✅ `KeywordStrategy` uses it | Identical output |
| LLM-enhanced intent extraction | ✅ `IntentExtractor` (with LLM) | ✅ `SemanticStrategy` uses it | Same LLM path |
| Dependency graph building | ✅ `DependencyMapper` | ✅ All strategies use it | Shared component |
| Action stack building | ✅ `ActionStackBuilder` | ✅ All strategies use it | Shared component |
| Medicine Wheel enrichment | ✅ `MedicineWheelBridge` | ✅ All strategies produce `wheelEnriched` | Shared component |
| Execution planning (stages/checkpoints) | ✅ `ExecutionPlanner` | ✅ Compatible — accepts `DecompositionResult` | Unchanged |
| Agent harness adapter | ✅ `AgentPDE` | ✅ Compatible — accepts `DecompositionResult` | Unchanged |
| LangChain Runnable wrappers | ✅ `RunnableDecomposer` | ✅ Compatible — same result type | Unchanged |
| `.pde/` storage persistence | ✅ `saveDecomposition` | ✅ Compatible — accepts `DecompositionResult` | Unchanged |
| JSON/Markdown export | ✅ `ActionStackBuilder.toJSON/toMarkdown` | ✅ Accessible via `StrategyResult.decomposition` | Same formats |
| **NEW: Prompt complexity analysis** | ❌ | ✅ `ComplexityAnalyzer` | Pre-decomposition signal |
| **NEW: Automatic strategy selection** | ❌ | ✅ `StrategySelector` | Resource + complexity aware |
| **NEW: Multi-strategy decomposition** | ❌ | ✅ `HybridStrategy` | Ensemble merging |
| **NEW: Multi-pass with cascading** | ❌ | ✅ `MultiPassDecomposer` | Parallel + cascading modes |
| **NEW: Confidence calibration** | ❌ | ✅ `ConfidenceCalibrator` | Cross-strategy normalization |
| **NEW: Strategy disagreement detection** | ❌ | ✅ `Disagreement[]` in `MultiPassResult` | Ambiguity surfacing |
| **NEW: Per-direction confidence** | ❌ | ✅ `directionConfidence` in `StrategyResult` | Granular confidence |

## Backward Compatibility Guarantee

```typescript
// BEFORE (existing code — still works unchanged)
import { decompose } from "ava-langchain-prompt-decomposition";
const result = await decompose("Build and test a module.");

// AFTER (new strategic API — same result type)
import { StrategicDecomposer } from "ava-langchain-prompt-decomposition";
const decomposer = new StrategicDecomposer();
const { result } = await decomposer.decompose("Build and test a module.");
// result.decomposition is the same DecompositionResult type
```

The `decompose()` convenience function, `RunnableDecomposer`, `ChainDecomposer`, and `AgentPDE` classes are **not modified**. The strategy layer is purely additive.

## Test Parity

| Test Suite | Tests | Status |
|---|---|---|
| `directional_decomposer.test.ts` | 10 | ✅ Pass |
| `intent_extractor.test.ts` | 17 | ✅ Pass |
| `dependency_mapper.test.ts` | 7 | ✅ Pass |
| `runnable.test.ts` | 7 | ✅ Pass |
| `strategy.test.ts` (NEW) | 61 | ✅ Pass |
| `pipeline.test.ts` | — | ⚠️ Pre-existing failure (missing `pde_metadata.js`) |
| **Total** | **102** | **All pass** |

## Strategy Selection Decision Tree

```
                    ┌─ Is LLM available? ─┐
                    │                      │
                   NO                     YES
                    │                      │
            ┌───────┴───────┐     ┌────────┴────────┐
            │  KeywordStrategy  │     │  What complexity?  │
            │  (always works)   │     └────────┬────────┘
            └───────────────┘         │        │        │
                               simple    moderate   complex/ambiguous
                                 │          │            │
                           KeywordStrategy  Semantic   HybridStrategy
                                         Strategy   (or MultiPass)
```

## Architecture Invariants

1. **KeywordStrategy is always available** — It has no external dependencies and serves as the universal fallback.
2. **All strategies produce `StrategyResult`** — A uniform envelope that contains the standard `DecompositionResult` plus confidence and diagnostic metadata.
3. **Strategies are stateless** — Each `decompose()` call is independent. Configuration is constructor-time only.
4. **The existing pipeline is never bypassed** — All strategies use `DirectionalDecomposer`, `DependencyMapper`, `ActionStackBuilder`, and `MedicineWheelBridge` internally.
5. **Medicine Wheel balance flows through** — Every `StrategyResult` includes `wheelEnriched` with ceremony detection, and confidence calibration rewards balanced decompositions.
