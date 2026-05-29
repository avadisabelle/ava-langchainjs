# Strategy Spec Review

## Summary

The `strategy_spec.ts` is a well-structured, thoughtfully designed strategy layer for the PDE. The architecture is sound: it wraps the existing pipeline without modifying it, provides a clean `DecompositionStrategy` interface, and ties strategy selection back to Medicine Wheel principles (directional spread drives complexity, WEST presence biases toward accuracy). The code is production-quality in terms of documentation and separation of concerns.

## What's Good

- **Clean interface design**: `DecompositionStrategy` with `canHandle`/`estimateLatency`/`decompose` is a textbook strategy pattern that enables extensibility
- **Backward compatibility**: KeywordStrategy wraps the existing pipeline 1:1, so existing behavior is preserved
- **Confidence calibration**: Per-strategy bias correction, complexity adjustment, and cross-strategy agreement analysis are well-thought-out
- **Medicine Wheel alignment**: Directional spread as a complexity signal, balance as a confidence input, and ceremony-gate passthrough are faithful to the epistemology
- **Disagreement surfacing**: Treating strategy disagreement as a relational signal rather than just picking one winner is epistemologically consistent
- **Thorough documentation**: Every class, method, and design decision is documented with rationale

## Issues Found

### Severity: HIGH

#### 1. `MultiPassResult.best` can be `undefined`
**File**: `strategy_spec.ts`, lines ~1369-1372 and ~1444-1449

When all strategies fail in `decomposeParallel` or `decomposeCascading`, `successfulResults` / `allResults` is empty, and `sorted[0]` is `undefined`. The `MultiPassResult.best` field is typed as `StrategyResult` (non-optional), so this is a runtime crash waiting to happen.

**Fix**: Either make `best` optional (`best?: StrategyResult`) or throw a descriptive error when no strategies succeed.

#### 2. `Direction` enum vs string literal mismatch in `ComplexityAnalyzer`
**File**: `strategy_spec.ts`, lines ~899-904

`ComplexityAnalyzer` defines its own `directionKeywords` object with string keys `"east"`, `"south"`, etc. — these happen to match the `Direction` enum values, but the keywords are a **subset** of the real `DIRECTION_KEYWORDS` from `directional_decomposer.ts`. This means the complexity analyzer's `directionalSpread` signal will diverge from the actual `DirectionalDecomposer` classification.

**Fix**: Import and use `DIRECTION_KEYWORDS` from `./directional_decomposer.js` instead of duplicating a subset.

#### 3. Duplicated `computeDirectionConfidence` method
**File**: `strategy_spec.ts`, lines ~288-301 and ~471-484

`KeywordStrategy` and `SemanticStrategy` have identical `computeDirectionConfidence` methods. This violates DRY and risks divergence during maintenance.

**Fix**: Extract to a shared utility function (e.g., `computeDirectionConfidenceFromAnalysis`).

### Severity: MEDIUM

#### 4. `HybridStrategy` creates new strategy instances per call
**File**: `strategy_spec.ts`, lines ~574-575

Each `decompose()` call creates new `KeywordStrategy` and `SemanticStrategy` instances. While strategies are stateless, this adds unnecessary GC pressure and prevents any future caching.

**Fix**: Accept keyword/semantic strategies as constructor params or create them once in the constructor.

#### 5. Dynamic imports add latency on every call
**File**: `strategy_spec.ts`, lines ~240-244, ~410-414, ~597-599

Each strategy `decompose()` uses dynamic `await import(...)` for pipeline components. While the comment says "dynamic to avoid circular deps at module level," there are no circular dependencies — `strategy_spec.ts` only imports *types* from these modules at the top level. Dynamic imports add ~1-5ms per call and defeat tree-shaking.

**Fix**: Use static imports for the pipeline classes (not just types). If circular deps are a concern, verify with `lint:dpdm` first.

#### 6. `mergeIntents` spreads `...semantic` then overrides `primary` and `secondary`
**File**: `strategy_spec.ts`, lines ~751-775

The spread `...semantic` copies `semantic.id`, `semantic.timestamp`, `semantic.prompt` — but these are from the semantic strategy's run, not from the original prompt processing. If the keyword result had different metadata (e.g., different timestamp), the merge silently drops it. This is likely fine but should be explicit.

**Fix**: Document that merged result inherits semantic strategy's metadata, or construct a fresh `IntentExtractionResult` with explicit fields.

#### 7. No `StrategyPreferences` validation
**File**: `strategy_spec.ts`, lines ~102-113

`minConfidence` could be negative or > 1, `maxPasses` could be 0 or negative, `forceStrategy` could reference a non-existent strategy (handled but silently falls through to auto-select). No validation or clamping.

**Fix**: Add validation in `StrategicDecomposer` constructor or `StrategySelector.select()`.

#### 8. `StrategySelector.select()` silently ignores invalid `forceStrategy`
**File**: `strategy_spec.ts`, lines ~1044-1053

If `forceStrategy` is set to a non-registered strategy ID, the code silently falls through to auto-selection. This could mask configuration errors.

**Fix**: Throw an error or add a diagnostic warning when a forced strategy is not found.

### Severity: LOW

#### 9. `HybridStrategy` balance recomputation could produce NaN
**File**: `strategy_spec.ts`, lines ~709-716

If all directions have 0 insights, `total` is `0 || 1 = 1`, which is handled. But the `deviation` calculation divides by 4 and assumes proportions sum to 1 — this is correct but fragile. Consider a comment or assertion.

#### 10. `ComplexityAnalyzer.actionVerbs` duplicates `ACTION_VERBS` from `intent_extractor.ts`
**File**: `strategy_spec.ts`, lines ~884-895

The action verb list is a subset of `ACTION_VERBS` from `intent_extractor.ts`. These will drift apart over time.

**Fix**: Import from `intent_extractor.ts` or extract to a shared constant.

#### 11. Missing export from `index.ts`
**File**: `index.ts`

The strategy spec types and classes are not exported from the package's `index.ts`. Consumers can't access `StrategicDecomposer`, `StrategySelector`, etc.

**Fix**: Add a strategy exports section to `index.ts`.

#### 12. `ConfidenceCalibrator.strategyBias` is hardcoded
**File**: `strategy_spec.ts`, lines ~1162-1166

The bias values are hardcoded with a comment "should be tuned empirically." There's no way to override them via constructor options.

**Fix**: Accept optional bias overrides in the constructor.

## Recommendations for Implementation Agent

1. **Priority 1**: Fix the `MultiPassResult.best` undefined case — this is a runtime crash. Either make it optional or throw when all strategies fail.

2. **Priority 2**: Replace duplicated constants (`directionKeywords`, `actionVerbs`) with imports from existing modules. This prevents drift.

3. **Priority 3**: Extract shared `computeDirectionConfidence` into a utility function.

4. **Priority 4**: Switch from dynamic imports to static imports in strategy classes (verify no circular deps first with `pnpm --filter ava-langchain-prompt-decomposition lint:dpdm`).

5. **Priority 5**: Add strategy exports to `index.ts`.

6. **Deferred**: Preference validation, configurable calibrator biases, and strategy instance reuse can be addressed later.

## Suggested Test Scenarios

### Unit Tests (`strategy_spec.test.ts`)

| # | Test | What it validates |
|---|------|------------------|
| 1 | `ComplexityAnalyzer` classifies "Build a REST API" as `simple` | Basic complexity classification |
| 2 | `ComplexityAnalyzer` classifies a 200-word multi-conditional prompt as `complex` | Complex prompt detection |
| 3 | `ComplexityAnalyzer` classifies a prompt with 3+ hedging words as `ambiguous` | Ambiguity detection |
| 4 | `StrategySelector` picks `keyword` for simple prompts without LLM | Default strategy selection |
| 5 | `StrategySelector` picks `hybrid` for complex prompts with LLM available | LLM-aware selection |
| 6 | `StrategySelector` respects `forceStrategy` | Preference override |
| 7 | `StrategySelector` excludes strategies exceeding `maxLatencyMs` | Latency budget enforcement |
| 8 | `KeywordStrategy.decompose` returns valid `StrategyResult` | Baseline strategy works |
| 9 | `HybridStrategy.mergeDirectionalAnalyses` deduplicates shared insights | Merge correctness |
| 10 | `HybridStrategy.mergeIntents` deduplicates by target similarity | Intent merge correctness |
| 11 | `HybridStrategy.targetSimilarity` returns 1.0 for identical strings | Similarity edge case |
| 12 | `HybridStrategy.targetSimilarity` returns 0 for completely different strings | Similarity edge case |
| 13 | `ConfidenceCalibrator` applies strategy-specific bias | Calibration correctness |
| 14 | `ConfidenceCalibrator` clamps confidence to [0, 1] | Bounds checking |
| 15 | `MultiPassDecomposer.decomposeParallel` handles all-strategy-failure gracefully | Error handling |
| 16 | `MultiPassDecomposer.decomposeCascading` stops early when confidence threshold met | Early termination |
| 17 | `StrategicDecomposer` with no options behaves like existing `decompose()` | Backward compatibility |
| 18 | `StrategicDecomposer` triggers multi-pass for ambiguous prompts with LLM | Auto multi-pass |
| 19 | `detectDisagreements` finds lead direction disagreement | Disagreement detection |
| 20 | Empty prompt produces `simple` complexity and valid result | Edge case |

### Integration Tests (`strategy_spec.int.test.ts`)

| # | Test | What it validates |
|---|------|------------------|
| 1 | `SemanticStrategy` with real LLM produces valid `StrategyResult` | LLM integration |
| 2 | `HybridStrategy` with real LLM merges keyword+semantic results | End-to-end merge |
| 3 | `StrategicDecomposer` result plugs into `ExecutionPlanner` | Pipeline integration |
| 4 | Multi-pass parallel with real LLM produces calibrated results | Full pipeline |

### Medicine Wheel Tests

| # | Test | What it validates |
|---|------|------------------|
| 1 | WEST-heavy prompt → strategy selector biases toward accuracy | Directional influence |
| 2 | All 4 directions present → classified as complex | Directional spread |
| 3 | `ceremonyRequired` flag propagated through strategy results | Ceremony passthrough |
| 4 | Low balance → confidence penalty in calibration | Balance as quality signal |
