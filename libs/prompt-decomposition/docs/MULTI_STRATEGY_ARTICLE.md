# Multi-Strategy Prompt Decomposition: A Medicine Wheel Approach

## Introduction

The Prompt Decomposition Engine (PDE) decomposes complex user prompts through a Four Directions analysis grounded in Medicine Wheel epistemology — classifying prompt segments into EAST (Vision), SOUTH (Analysis), WEST (Validation), and NORTH (Action). This article describes the evolution from a single keyword-based pipeline to a multi-strategy architecture that adapts its approach based on prompt complexity.

## The Problem with One Way of Seeing

The original PDE uses keyword matching to classify prompt segments. When a user writes *"Research the codebase patterns. Build the new module. Test the integration."*, keyword matching works well — "research" maps to SOUTH, "build" maps to NORTH, "test" maps to WEST.

But consider: *"We should probably look into whether our data pipeline can handle the increased load, and if not, somehow figure out a scaling approach that respects our team's capacity."*

This prompt contains no direct action verbs matching NORTH keywords, uses hedging language ("probably", "somehow"), has conditional logic ("if not"), and implies multiple nested intents. Keyword matching assigns it low confidence and may misclassify segments.

This is not a defect — it's a limitation of a single perspective. Just as the Medicine Wheel teaches that seeing from only one direction gives an incomplete picture, relying on one decomposition strategy limits what the engine can perceive.

## Three Strategies, Four Directions

### KeywordStrategy — The North (Action)

The KeywordStrategy wraps the existing pipeline. It is fast (~1-5ms), deterministic, and requires no external dependencies. It excels at clear, imperative prompts and serves as the universal fallback.

**Strengths:** Speed, determinism, zero dependencies  
**Limitations:** Misses nuance, hedging, implicit intents

### SemanticStrategy — The South (Analysis)

The SemanticStrategy uses an LLM for deeper understanding. It can detect implied requirements, understand context and metaphor, and produce higher-confidence classifications for ambiguous prompts.

**Strengths:** Nuance, implicit intent detection, contextual understanding  
**Limitations:** Requires LLM, non-deterministic, 500ms+ latency

### HybridStrategy — The East (Vision)

The HybridStrategy runs both keyword and semantic approaches concurrently, then merges the results with weighted scoring (keyword=0.35, semantic=0.65). When both strategies agree, confidence is boosted. When they disagree, the disagreement itself becomes a signal — surfaced as an ambiguity flag.

**Strengths:** Highest accuracy, agreement-as-signal, comprehensive  
**Limitations:** Highest latency (~2x semantic), requires LLM

### Where is the West?

The West direction — Validation and Ceremony — is not a strategy but a *gate*. The MedicineWheelBridge checks whether spiritual and emotional dimensions are represented. The ConfidenceCalibrator rewards balanced decompositions and penalizes those that neglect directions. Strategy disagreements are surfaced rather than silently resolved.

The West's role is to ask: *"Did we see clearly? Is anything being rushed or overlooked?"*

## Adaptive Selection

The StrategySelector uses a ComplexityAnalyzer to characterize the prompt before decomposition begins. It measures:

- **Word count and clause structure** — Simple vs. complex
- **Hedging language** — "maybe", "probably", "somehow" signal ambiguity
- **Action verb density** — More verbs = more intents to untangle
- **Directional spread** — How many of the four directions are touched
- **Technical references** — File paths, code symbols, package names

Based on these signals, the selector scores each available strategy:

| Complexity | Without LLM | With LLM |
|---|---|---|
| Simple | KeywordStrategy | KeywordStrategy |
| Moderate | KeywordStrategy | SemanticStrategy |
| Complex | KeywordStrategy | HybridStrategy |
| Ambiguous | KeywordStrategy | MultiPass (all strategies) |

## Multi-Pass Decomposition

For the most complex or high-stakes prompts, the MultiPassDecomposer runs multiple strategies and reconciles results:

**Parallel mode** runs all feasible strategies concurrently. Results are calibrated for cross-strategy comparability, and the highest-confidence result is selected — enriched by insights from other strategies.

**Cascading mode** starts with the auto-selected strategy. If its confidence falls below a threshold, it runs the next-best strategy, stopping as soon as confidence is satisfactory. This optimizes for speed while maintaining a quality floor.

Both modes detect *disagreements* between strategies — differences in lead direction, primary action, or intent count. These disagreements are not failures; they are signals that the prompt itself may be genuinely ambiguous.

## Confidence Calibration

Different strategies have different confidence distributions. KeywordStrategy reports moderate confidence (0.5-0.8) consistently. SemanticStrategy may report high confidence (0.7-0.95) with more variance. The ConfidenceCalibrator normalizes scores through:

1. **Strategy-specific bias correction** — LLMs tend to be slightly overconfident
2. **Complexity-based adjustment** — Complex prompts get a confidence penalty (they're harder)
3. **Balance bonus** — Well-balanced decompositions (touching all 4 directions) get a boost
4. **Agreement bonus** — When multiple strategies agree, confidence increases

## Usage

```typescript
import { StrategicDecomposer } from "ava-langchain-prompt-decomposition";

// Simple — identical to existing decompose()
const decomposer = new StrategicDecomposer();
const { result } = await decomposer.decompose("Build a knowledge graph.");

// With LLM — auto-selects best strategy
const decomposer = new StrategicDecomposer({
  resources: { llm: myChatModel },
});
const { result, selectionReason } = await decomposer.decompose(complexPrompt);
console.log(selectionReason); // "Selected hybrid (score: 1.20) for complex prompt..."

// Multi-pass for highest quality
const decomposer = new StrategicDecomposer({
  resources: { llm: myChatModel, preferAccuracy: true },
  preferences: { alwaysMultiPass: true },
});
const { result, multiPass } = await decomposer.decompose(ambiguousPrompt);
console.log(multiPass.disagreements); // Where strategies saw differently
```

## Conclusion

The multi-strategy approach embodies a core Medicine Wheel teaching: no single direction holds the complete truth. By allowing the engine to see from multiple perspectives — fast keyword matching, deep semantic analysis, and their combination — we create decompositions that are more robust, more honest about their limitations, and more respectful of the complexity inherent in human communication.

The strategy pattern is purely additive. The existing pipeline continues to work unchanged. The new capabilities layer on top, available when needed, invisible when not.
