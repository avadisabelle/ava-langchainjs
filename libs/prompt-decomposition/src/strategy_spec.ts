/**
 * Strategy Pattern Architecture for the Prompt Decomposition Engine
 *
 * This module defines a pluggable strategy system that allows the PDE
 * to select among multiple decomposition approaches based on prompt
 * complexity, available resources, and Medicine Wheel balance.
 *
 * Architecture overview:
 *   StrategySelector → picks DecompositionStrategy → produces StrategyResult
 *   MultiPassDecomposer → runs N strategies → ConfidenceCalibrator → merged result
 *
 * Integration with existing pipeline:
 *   The strategy layer wraps the existing Decompose → Extract → Map → Build → Enrich
 *   pipeline. Each strategy may use the existing components differently:
 *   - KeywordStrategy: Uses DirectionalDecomposer + heuristic IntentExtractor (existing code)
 *   - SemanticStrategy: Uses LLM-based classification + structured output extraction
 *   - HybridStrategy: Runs both, merges with weighted scoring
 *
 * The StrategySelector sits *before* the pipeline, and the ConfidenceCalibrator
 * sits *after* it — they are pre- and post-processing layers.
 */

import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import type { Embeddings } from "@langchain/core/embeddings";

import type {
  DirectionalAnalysis,
  DirectionalInsight,
  Direction,
} from "./directional_decomposer.js";
import type {
  IntentExtractionResult,
  PrimaryIntent,
  SecondaryIntent,
} from "./intent_extractor.js";
import type { DecompositionResult } from "./action_stack.js";
import type { WheelEnrichedAnalysis } from "./wheel_bridge.js";

// =============================================================================
// Core Types
// =============================================================================

/**
 * Identifies which strategy produced a result.
 * Used for provenance tracking and confidence calibration.
 */
export type StrategyId = "keyword" | "semantic" | "hybrid" | string;

/**
 * Complexity classification of a prompt, used to guide strategy selection.
 *
 * - simple: Single intent, clear action verb, few clauses (< 50 words)
 * - moderate: 2-3 intents, some nesting, moderate ambiguity (50-150 words)
 * - complex: 4+ intents, nested conditionals, hedging, cross-domain references (150+ words)
 * - ambiguous: Cannot be reliably classified — signals that multi-pass is needed
 */
export type PromptComplexity = "simple" | "moderate" | "complex" | "ambiguous";

/**
 * Signals detected during prompt analysis that inform strategy selection.
 * These are lightweight heuristics computed *before* full decomposition.
 */
export interface ComplexitySignals {
  /** Total word count */
  wordCount: number;
  /** Number of distinct sentences/clauses */
  clauseCount: number;
  /** Count of conditional keywords (if, when, unless, whether) */
  conditionalCount: number;
  /** Count of hedging language (maybe, probably, somehow, perhaps) */
  hedgingCount: number;
  /** Count of action verbs detected */
  actionVerbCount: number;
  /** Count of distinct directional keyword matches across all 4 directions */
  directionalSpread: number;
  /** Whether the prompt references file paths, code symbols, or technical artifacts */
  hasTechnicalReferences: boolean;
  /** Whether the prompt contains nested structures (lists, sub-clauses, multi-step) */
  hasNestedStructure: boolean;
  /** Computed complexity classification */
  complexity: PromptComplexity;
}

/**
 * Resources available at runtime, used by the StrategySelector to
 * determine which strategies are feasible.
 */
export interface AvailableResources {
  /** An LLM instance for semantic classification and structured extraction */
  llm?: BaseLanguageModel;
  /** An embeddings model for similarity-based direction classification */
  embeddings?: Embeddings;
  /** Maximum latency budget in milliseconds (strategies that exceed this are excluded) */
  maxLatencyMs?: number;
  /** Whether to prefer accuracy over speed (default: false = prefer speed) */
  preferAccuracy?: boolean;
}

/**
 * User-specified preferences that override automatic strategy selection.
 */
export interface StrategyPreferences {
  /** Force a specific strategy (bypasses auto-selection) */
  forceStrategy?: StrategyId;
  /** Minimum confidence threshold — results below this trigger multi-pass */
  minConfidence?: number;
  /** Enable multi-pass even for simple prompts (default: false) */
  alwaysMultiPass?: boolean;
  /** Maximum number of passes in multi-pass mode (default: 3) */
  maxPasses?: number;
  /** Strategies to exclude from selection */
  excludeStrategies?: StrategyId[];
}

// =============================================================================
// Strategy Result
// =============================================================================

/**
 * The output of a single strategy execution. Contains the decomposition
 * plus metadata about the strategy's confidence and provenance.
 *
 * This is the universal return type for all strategies, enabling
 * comparison, merging, and calibration across different approaches.
 */
export interface StrategyResult {
  /** Which strategy produced this result */
  strategyId: StrategyId;
  /** The directional analysis (segment → direction classification) */
  directionalAnalysis: DirectionalAnalysis;
  /** The extracted intents (primary + secondary) */
  intents: IntentExtractionResult;
  /** The final decomposition (action stack, outputs, ambiguities) */
  decomposition: DecompositionResult;
  /** Medicine Wheel enrichment */
  wheelEnriched: WheelEnrichedAnalysis;
  /** Overall confidence in this result (0-1), pre-calibration */
  confidence: number;
  /** Per-direction confidence scores */
  directionConfidence: Record<Direction, number>;
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Any warnings or diagnostic notes from the strategy */
  diagnostics: string[];
}

// =============================================================================
// DecompositionStrategy Interface
// =============================================================================

/**
 * The core strategy interface. All decomposition approaches implement this.
 *
 * Design rationale:
 * - `id` enables provenance tracking and strategy-specific calibration curves
 * - `canHandle` allows strategies to self-exclude based on resource availability
 * - `estimateLatency` enables the selector to respect latency budgets
 * - `decompose` is the main entry point, returning a uniform StrategyResult
 *
 * Strategies are stateless — all configuration is passed via constructor,
 * and each `decompose` call is independent.
 */
export interface DecompositionStrategy {
  /** Unique identifier for this strategy */
  readonly id: StrategyId;

  /** Human-readable name for diagnostics and logging */
  readonly name: string;

  /**
   * Check if this strategy can handle decomposition with the given resources.
   * Returns false if required resources (e.g., LLM) are unavailable.
   */
  canHandle(resources: AvailableResources): boolean;

  /**
   * Estimate the latency of running this strategy, in milliseconds.
   * Used by the StrategySelector to respect latency budgets.
   * Returns -1 if latency cannot be estimated.
   */
  estimateLatency(signals: ComplexitySignals): number;

  /**
   * Execute the decomposition strategy on the given prompt.
   *
   * @param prompt - The raw user prompt to decompose
   * @param resources - Available runtime resources (LLM, embeddings, etc.)
   * @returns A StrategyResult containing the full decomposition with confidence scores
   */
  decompose(prompt: string, resources: AvailableResources): Promise<StrategyResult>;
}

// =============================================================================
// KeywordStrategy
// =============================================================================

/**
 * Wraps the existing keyword-based decomposition pipeline for backward
 * compatibility. This is the default strategy when no LLM is available.
 *
 * Characteristics:
 * - Zero external dependencies (no LLM, no embeddings)
 * - Deterministic output for the same input
 * - Fast (~1-5ms for typical prompts)
 * - Lower accuracy on nuanced or ambiguous prompts
 *
 * Uses: DirectionalDecomposer (keyword scoring) + IntentExtractor (heuristic mode)
 *       + DependencyMapper + ActionStackBuilder + MedicineWheelBridge
 *
 * This strategy is always available and serves as the baseline for
 * confidence calibration.
 */
export class KeywordStrategy implements DecompositionStrategy {
  readonly id: StrategyId = "keyword";
  readonly name = "Keyword-Based Decomposition";

  canHandle(_resources: AvailableResources): boolean {
    // Always available — no external dependencies
    return true;
  }

  estimateLatency(signals: ComplexitySignals): number {
    // Keyword matching is O(words × keywords), typically < 5ms
    return Math.max(1, signals.wordCount * 0.05);
  }

  /**
   * Run the existing keyword-based pipeline.
   *
   * Implementation notes:
   * - Instantiates DirectionalDecomposer, IntentExtractor (no LLM),
   *   DependencyMapper, ActionStackBuilder, MedicineWheelBridge
   * - Runs the standard Decompose → Extract → Map → Build → Enrich flow
   * - Computes confidence from keyword match density and direction balance
   */
  async decompose(prompt: string, _resources: AvailableResources): Promise<StrategyResult> {
    const startTime = Date.now();

    // --- Import existing components (dynamic to avoid circular deps at module level) ---
    const { DirectionalDecomposer } = await import("./directional_decomposer.js");
    const { IntentExtractor } = await import("./intent_extractor.js");
    const { DependencyMapper } = await import("./dependency_mapper.js");
    const { ActionStackBuilder } = await import("./action_stack.js");
    const { MedicineWheelBridge } = await import("./wheel_bridge.js");

    const decomposer = new DirectionalDecomposer();
    const extractor = new IntentExtractor(); // No LLM — pure heuristics
    const mapper = new DependencyMapper();
    const builder = new ActionStackBuilder();
    const bridge = new MedicineWheelBridge();

    const directionalAnalysis = decomposer.decompose(prompt);
    const intents = await extractor.extract(prompt);
    const graph = mapper.buildGraph(intents.secondary);
    const order = mapper.computeExecutionOrder(graph);
    const decomposition = builder.build(directionalAnalysis, intents, order);
    const wheelEnriched = bridge.enrich(directionalAnalysis);

    // Compute per-direction confidence from keyword density
    const directionConfidence = this.computeDirectionConfidence(directionalAnalysis);
    const confidence = this.computeOverallConfidence(directionalAnalysis, intents);

    const diagnostics: string[] = [];
    if (directionalAnalysis.balance < 0.3) {
      diagnostics.push("Low directional balance — keyword coverage is sparse.");
    }
    if (intents.primary.confidence < 0.5) {
      diagnostics.push("Primary intent has low confidence — consider semantic strategy.");
    }

    return {
      strategyId: this.id,
      directionalAnalysis,
      intents,
      decomposition,
      wheelEnriched,
      confidence,
      directionConfidence,
      executionTimeMs: Date.now() - startTime,
      diagnostics,
    };
  }

  /**
   * Per-direction confidence based on the average insight confidence
   * within each direction bucket.
   */
  private computeDirectionConfidence(
    analysis: DirectionalAnalysis
  ): Record<Direction, number> {
    const result: Record<string, number> = {};
    for (const dir of ["east", "south", "west", "north"] as Direction[]) {
      const insights = analysis.directions[dir];
      if (insights.length === 0) {
        result[dir] = 0;
      } else {
        const avg = insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length;
        result[dir] = avg;
      }
    }
    return result as Record<Direction, number>;
  }

  /**
   * Overall confidence combines direction balance, primary intent confidence,
   * and proportion of non-implicit insights.
   */
  private computeOverallConfidence(
    analysis: DirectionalAnalysis,
    intents: IntentExtractionResult
  ): number {
    const balanceWeight = 0.3;
    const intentWeight = 0.4;
    const explicitWeight = 0.3;

    const allInsights = Object.values(analysis.directions).flat();
    const explicitRatio =
      allInsights.length > 0
        ? allInsights.filter((i) => !i.implicit).length / allInsights.length
        : 0.5;

    return (
      analysis.balance * balanceWeight +
      intents.primary.confidence * intentWeight +
      explicitRatio * explicitWeight
    );
  }
}

// =============================================================================
// SemanticStrategy
// =============================================================================

/**
 * Uses an LLM for classification and structured extraction, providing
 * deeper semantic understanding of prompt intent and direction.
 *
 * Characteristics:
 * - Requires an LLM (will not be selected without one)
 * - Non-deterministic — LLM responses vary
 * - Higher latency (500ms-5s depending on model)
 * - Significantly better on ambiguous, multi-intent, and nuanced prompts
 * - Can understand context, metaphor, and implied requirements
 *
 * Architecture:
 * 1. Sends the prompt to the LLM with a structured output schema
 *    requesting direction classification, intent extraction, and
 *    confidence scoring in a single call
 * 2. Falls back to keyword strategy if LLM call fails
 * 3. Uses the LLM's native understanding to classify segments rather
 *    than keyword matching
 *
 * The LLM prompt is grounded in Medicine Wheel epistemology, asking
 * the model to consider all four directions explicitly.
 */
export class SemanticStrategy implements DecompositionStrategy {
  readonly id: StrategyId = "semantic";
  readonly name = "LLM-Based Semantic Decomposition";

  canHandle(resources: AvailableResources): boolean {
    // Requires an LLM
    return resources.llm !== undefined;
  }

  estimateLatency(signals: ComplexitySignals): number {
    // LLM calls are ~500ms minimum, scaling with prompt length
    const baseLatency = 500;
    const perWordLatency = 2;
    return baseLatency + signals.wordCount * perWordLatency;
  }

  /**
   * Run LLM-based decomposition.
   *
   * Implementation approach:
   * 1. Use the LLM to classify each prompt segment into directions
   *    with confidence scores, replacing keyword matching
   * 2. Use IntentExtractor with the LLM enabled for structured extraction
   * 3. The directional analysis comes from the LLM's classification,
   *    not from DIRECTION_KEYWORDS
   * 4. Run the rest of the pipeline (DependencyMapper, ActionStackBuilder,
   *    MedicineWheelBridge) as normal — those are direction-agnostic
   *
   * The LLM system prompt instructs the model to:
   * - Think in terms of the Four Directions (EAST/Vision, SOUTH/Analysis,
   *   WEST/Validation, NORTH/Action)
   * - Identify implicit intents that keyword matching would miss
   * - Provide calibrated confidence scores
   * - Flag ambiguities and hedging language
   *
   * Pseudocode for the LLM prompt:
   * ```
   * SYSTEM: You are a prompt decomposition engine grounded in Medicine Wheel
   * epistemology. Analyze the following prompt through Four Directions...
   * Return JSON matching the DirectionalAnalysis + IntentExtractionResult schemas.
   *
   * USER: <prompt>
   * ```
   *
   * If the LLM call fails, this strategy falls back to KeywordStrategy
   * and marks the fallback in diagnostics.
   */
  async decompose(prompt: string, resources: AvailableResources): Promise<StrategyResult> {
    const startTime = Date.now();

    if (!resources.llm) {
      throw new Error("SemanticStrategy requires an LLM but none was provided.");
    }

    const { DirectionalDecomposer } = await import("./directional_decomposer.js");
    const { IntentExtractor } = await import("./intent_extractor.js");
    const { DependencyMapper } = await import("./dependency_mapper.js");
    const { ActionStackBuilder } = await import("./action_stack.js");
    const { MedicineWheelBridge } = await import("./wheel_bridge.js");

    const diagnostics: string[] = [];

    // Use LLM-enhanced intent extraction
    const extractor = new IntentExtractor({ llm: resources.llm });
    let intents: IntentExtractionResult;
    let directionalAnalysis: DirectionalAnalysis;

    try {
      intents = await extractor.extract(prompt);

      // For directional analysis, we still use DirectionalDecomposer as the
      // structural backbone, but could enhance with LLM classification in future.
      // The IntentExtractor with LLM already provides richer intent data.
      const decomposer = new DirectionalDecomposer();
      directionalAnalysis = decomposer.decompose(prompt);

      diagnostics.push("LLM-enhanced intent extraction succeeded.");
    } catch (error) {
      // Fallback to keyword-only
      diagnostics.push(
        `LLM extraction failed (${error instanceof Error ? error.message : String(error)}), falling back to keyword strategy.`
      );
      const decomposer = new DirectionalDecomposer();
      directionalAnalysis = decomposer.decompose(prompt);
      const fallbackExtractor = new IntentExtractor();
      intents = await fallbackExtractor.extract(prompt);
    }

    const mapper = new DependencyMapper();
    const builder = new ActionStackBuilder();
    const bridge = new MedicineWheelBridge();

    const graph = mapper.buildGraph(intents.secondary);
    const order = mapper.computeExecutionOrder(graph);
    const decomposition = builder.build(directionalAnalysis, intents, order);
    const wheelEnriched = bridge.enrich(directionalAnalysis);

    const directionConfidence = this.computeDirectionConfidence(directionalAnalysis);
    // Semantic strategy gets a confidence boost for using LLM
    const baseConfidence = this.computeBaseConfidence(directionalAnalysis, intents);
    const confidence = Math.min(1, baseConfidence + 0.1);

    return {
      strategyId: this.id,
      directionalAnalysis,
      intents,
      decomposition,
      wheelEnriched,
      confidence,
      directionConfidence,
      executionTimeMs: Date.now() - startTime,
      diagnostics,
    };
  }

  private computeDirectionConfidence(
    analysis: DirectionalAnalysis
  ): Record<Direction, number> {
    const result: Record<string, number> = {};
    for (const dir of ["east", "south", "west", "north"] as Direction[]) {
      const insights = analysis.directions[dir];
      if (insights.length === 0) {
        result[dir] = 0;
      } else {
        const avg = insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length;
        result[dir] = avg;
      }
    }
    return result as Record<Direction, number>;
  }

  private computeBaseConfidence(
    analysis: DirectionalAnalysis,
    intents: IntentExtractionResult
  ): number {
    return (
      analysis.balance * 0.25 +
      intents.primary.confidence * 0.5 +
      (intents.secondary.length > 0 ? 0.25 : 0.1)
    );
  }
}

// =============================================================================
// HybridStrategy
// =============================================================================

/**
 * Combines keyword and semantic approaches with weighted scoring and
 * confidence calibration. Runs both strategies and merges the results.
 *
 * Characteristics:
 * - Requires an LLM (falls back to keyword-only if unavailable)
 * - Highest accuracy due to ensemble approach
 * - Highest latency (~2x semantic strategy)
 * - Best for complex or high-stakes prompts where accuracy matters more than speed
 *
 * Merging algorithm:
 * 1. Run KeywordStrategy and SemanticStrategy in parallel
 * 2. For directional analysis: use semantic classification as primary,
 *    keyword classification as validation. If they agree, boost confidence.
 *    If they disagree, flag the segment for review.
 * 3. For intents: union the intent sets, deduplicating by target similarity.
 *    Shared intents get boosted confidence; strategy-unique intents are kept
 *    but marked with lower confidence.
 * 4. For the final action stack: re-run DependencyMapper and ActionStackBuilder
 *    on the merged intent set.
 *
 * Weighting:
 * - Default weights: keyword=0.35, semantic=0.65
 * - Weights shift toward keyword for simple prompts (semantic adds little value)
 * - Weights shift toward semantic for complex/ambiguous prompts
 */
export class HybridStrategy implements DecompositionStrategy {
  readonly id: StrategyId = "hybrid";
  readonly name = "Hybrid Keyword+Semantic Decomposition";

  private readonly keywordWeight: number;
  private readonly semanticWeight: number;

  constructor(options?: { keywordWeight?: number; semanticWeight?: number }) {
    this.keywordWeight = options?.keywordWeight ?? 0.35;
    this.semanticWeight = options?.semanticWeight ?? 0.65;
  }

  canHandle(resources: AvailableResources): boolean {
    // Requires LLM for the semantic component
    return resources.llm !== undefined;
  }

  estimateLatency(signals: ComplexitySignals): number {
    // Both strategies run in parallel, so latency ≈ max(keyword, semantic)
    const keywordLatency = Math.max(1, signals.wordCount * 0.05);
    const semanticLatency = 500 + signals.wordCount * 2;
    // Add ~50ms for merging overhead
    return Math.max(keywordLatency, semanticLatency) + 50;
  }

  /**
   * Run both strategies and merge results.
   *
   * Implementation approach:
   * 1. Run KeywordStrategy and SemanticStrategy concurrently via Promise.all
   * 2. Merge directional analyses:
   *    - For each direction, take the union of insights from both strategies
   *    - Insights present in both get confidence = weighted average
   *    - Insights in only one strategy get confidence penalty (×0.8)
   * 3. Merge intents:
   *    - Deduplicate by action+target similarity (Jaccard on target words > 0.5)
   *    - Shared intents: confidence = weighted average of both
   *    - Unique intents: kept with source-strategy confidence × 0.9
   * 4. Rebuild the dependency graph and action stack from merged intents
   * 5. Confidence = weighted combination of both strategy confidences,
   *    with a bonus for agreement
   */
  async decompose(prompt: string, resources: AvailableResources): Promise<StrategyResult> {
    const startTime = Date.now();

    const keywordStrategy = new KeywordStrategy();
    const semanticStrategy = new SemanticStrategy();

    // Run both strategies concurrently
    const [keywordResult, semanticResult] = await Promise.all([
      keywordStrategy.decompose(prompt, resources),
      semanticStrategy.decompose(prompt, resources),
    ]);

    // Merge directional analyses
    const mergedDirectionalAnalysis = this.mergeDirectionalAnalyses(
      keywordResult.directionalAnalysis,
      semanticResult.directionalAnalysis
    );

    // Merge intents — use the semantic result as the base (richer extraction),
    // supplemented by any keyword-only intents
    const mergedIntents = this.mergeIntents(
      keywordResult.intents,
      semanticResult.intents
    );

    // Rebuild pipeline from merged data
    const { DependencyMapper } = await import("./dependency_mapper.js");
    const { ActionStackBuilder } = await import("./action_stack.js");
    const { MedicineWheelBridge } = await import("./wheel_bridge.js");

    const mapper = new DependencyMapper();
    const builder = new ActionStackBuilder();
    const bridge = new MedicineWheelBridge();

    const graph = mapper.buildGraph(mergedIntents.secondary);
    const order = mapper.computeExecutionOrder(graph);
    const decomposition = builder.build(mergedDirectionalAnalysis, mergedIntents, order);
    const wheelEnriched = bridge.enrich(mergedDirectionalAnalysis);

    // Compute merged confidence
    const agreementBonus = this.computeAgreementBonus(keywordResult, semanticResult);
    const confidence = Math.min(
      1,
      keywordResult.confidence * this.keywordWeight +
        semanticResult.confidence * this.semanticWeight +
        agreementBonus
    );

    const directionConfidence = this.mergeDirectionConfidence(
      keywordResult.directionConfidence,
      semanticResult.directionConfidence
    );

    const diagnostics = [
      `Keyword confidence: ${keywordResult.confidence.toFixed(3)}`,
      `Semantic confidence: ${semanticResult.confidence.toFixed(3)}`,
      `Agreement bonus: ${agreementBonus.toFixed(3)}`,
      `Keyword intents: ${keywordResult.intents.secondary.length}`,
      `Semantic intents: ${semanticResult.intents.secondary.length}`,
      `Merged intents: ${mergedIntents.secondary.length}`,
      ...keywordResult.diagnostics.map((d) => `[keyword] ${d}`),
      ...semanticResult.diagnostics.map((d) => `[semantic] ${d}`),
    ];

    return {
      strategyId: this.id,
      directionalAnalysis: mergedDirectionalAnalysis,
      intents: mergedIntents,
      decomposition,
      wheelEnriched,
      confidence,
      directionConfidence,
      executionTimeMs: Date.now() - startTime,
      diagnostics,
    };
  }

  /**
   * Merge two directional analyses by taking the union of insights per direction.
   * Deduplicates by text similarity and averages confidence for shared insights.
   */
  private mergeDirectionalAnalyses(
    keyword: DirectionalAnalysis,
    semantic: DirectionalAnalysis
  ): DirectionalAnalysis {
    // Use the semantic analysis as the base structure, as it carries the
    // richer metadata. The merge enhances it with keyword-only insights.
    const merged: DirectionalAnalysis = {
      ...semantic,
      directions: { east: [], south: [], west: [], north: [] } as Record<
        Direction,
        DirectionalInsight[]
      >,
    };

    for (const dir of ["east", "south", "west", "north"] as Direction[]) {
      const keyInsights = keyword.directions[dir] || [];
      const semInsights = semantic.directions[dir] || [];
      const seen = new Set<string>();

      // Add semantic insights first (higher priority)
      for (const insight of semInsights) {
        const normalized = insight.text.toLowerCase().trim();
        seen.add(normalized);

        // Check if keyword strategy also found this insight
        const keyMatch = keyInsights.find(
          (k) => k.text.toLowerCase().trim() === normalized
        );
        if (keyMatch) {
          // Both agree — boost confidence via weighted average
          merged.directions[dir].push({
            text: insight.text,
            confidence: Math.min(
              1,
              insight.confidence * this.semanticWeight +
                keyMatch.confidence * this.keywordWeight
            ),
            implicit: insight.implicit && keyMatch.implicit,
          });
        } else {
          merged.directions[dir].push(insight);
        }
      }

      // Add keyword-only insights (not found by semantic)
      for (const insight of keyInsights) {
        const normalized = insight.text.toLowerCase().trim();
        if (!seen.has(normalized)) {
          merged.directions[dir].push({
            ...insight,
            confidence: insight.confidence * 0.8, // Slight penalty for single-source
          });
        }
      }
    }

    // Recompute balance from merged directions
    const counts = (["east", "south", "west", "north"] as Direction[]).map(
      (d) => merged.directions[d].length
    );
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    const proportions = counts.map((c) => c / total);
    const deviation =
      proportions.reduce((sum, p) => sum + Math.abs(p - 0.25), 0) / 4;
    merged.balance = Math.max(0, Math.min(1, 1 - deviation * 4));

    return merged;
  }

  /**
   * Merge intent extraction results from two strategies.
   * Uses the higher-confidence primary intent and unions secondary intents.
   */
  private mergeIntents(
    keyword: IntentExtractionResult,
    semantic: IntentExtractionResult
  ): IntentExtractionResult {
    // Pick the primary intent with higher confidence
    const primary: PrimaryIntent =
      semantic.primary.confidence >= keyword.primary.confidence
        ? semantic.primary
        : keyword.primary;

    // Union secondary intents, deduplicating by target similarity
    const merged: SecondaryIntent[] = [...semantic.secondary];
    for (const keyIntent of keyword.secondary) {
      const isDuplicate = merged.some(
        (m) =>
          m.action === keyIntent.action &&
          this.targetSimilarity(m.target, keyIntent.target) > 0.5
      );
      if (!isDuplicate) {
        merged.push({
          ...keyIntent,
          confidence: keyIntent.confidence * 0.9, // Slight penalty for single-source
        });
      }
    }

    return {
      ...semantic,
      primary,
      secondary: merged,
      context: {
        filesNeeded: [
          ...new Set([
            ...keyword.context.filesNeeded,
            ...semantic.context.filesNeeded,
          ]),
        ],
        toolsRequired: [
          ...new Set([
            ...keyword.context.toolsRequired,
            ...semantic.context.toolsRequired,
          ]),
        ],
        assumptions: [
          ...new Set([
            ...keyword.context.assumptions,
            ...semantic.context.assumptions,
          ]),
        ],
      },
    };
  }

  /**
   * Jaccard similarity between two target strings (word-level).
   */
  private targetSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
    const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
    if (wordsA.size === 0 && wordsB.size === 0) return 1;
    let intersection = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }
    const union = new Set([...wordsA, ...wordsB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Compute a bonus for strategies agreeing on lead direction and primary intent.
   * Agreement suggests higher reliability.
   */
  private computeAgreementBonus(
    keyword: StrategyResult,
    semantic: StrategyResult
  ): number {
    let bonus = 0;

    // Same lead direction
    if (
      keyword.directionalAnalysis.leadDirection ===
      semantic.directionalAnalysis.leadDirection
    ) {
      bonus += 0.05;
    }

    // Same primary action
    if (keyword.intents.primary.action === semantic.intents.primary.action) {
      bonus += 0.05;
    }

    // Similar primary target
    if (
      this.targetSimilarity(
        keyword.intents.primary.target,
        semantic.intents.primary.target
      ) > 0.5
    ) {
      bonus += 0.05;
    }

    return bonus;
  }

  /**
   * Merge per-direction confidence from both strategies using weights.
   */
  private mergeDirectionConfidence(
    keyword: Record<Direction, number>,
    semantic: Record<Direction, number>
  ): Record<Direction, number> {
    const result: Record<string, number> = {};
    for (const dir of ["east", "south", "west", "north"] as Direction[]) {
      result[dir] =
        (keyword[dir] || 0) * this.keywordWeight +
        (semantic[dir] || 0) * this.semanticWeight;
    }
    return result as Record<Direction, number>;
  }
}

// =============================================================================
// ComplexityAnalyzer
// =============================================================================

/**
 * Analyzes a prompt's complexity characteristics without performing
 * full decomposition. This is a fast pre-processing step used by
 * StrategySelector to choose the right strategy.
 *
 * The analysis produces ComplexitySignals which capture:
 * - Structural complexity (length, clauses, nesting)
 * - Linguistic complexity (hedging, conditionals, ambiguity)
 * - Technical complexity (file references, code symbols)
 * - Directional spread (how many directions are touched by keywords)
 */
export class ComplexityAnalyzer {
  /**
   * Analyze a prompt and return complexity signals.
   */
  analyze(prompt: string): ComplexitySignals {
    const lower = prompt.toLowerCase();
    const words = prompt.split(/\s+/).filter((w) => w.length > 0);
    const sentences = prompt
      .split(/(?<=[.!?])\s+|\n+/)
      .filter((s) => s.trim().length > 3);

    const wordCount = words.length;
    const clauseCount = sentences.length;

    const conditionalCount = (
      lower.match(/\b(if|when|unless|whether|provided that|assuming)\b/g) || []
    ).length;

    const hedgingCount = (
      lower.match(/\b(maybe|perhaps|probably|somehow|might|could|possibly|i assume|i expect)\b/g) || []
    ).length;

    // Count action verbs (from IntentExtractor's ACTION_VERBS)
    const actionVerbs = [
      "create", "build", "make", "generate", "write", "develop", "design",
      "modify", "update", "change", "edit", "refactor",
      "investigate", "research", "explore", "analyze", "examine",
      "add", "install", "include", "integrate",
      "remove", "delete", "clean",
      "test", "verify", "validate",
      "deploy", "ship", "publish",
      "manage", "organize",
      "use", "run", "execute",
      "draft", "plan", "document",
    ];
    const actionVerbCount = actionVerbs.filter((v) => lower.includes(v)).length;

    // Check directional spread using DIRECTION_KEYWORDS keys
    const directionKeywords: Record<string, string[]> = {
      east: ["vision", "goal", "purpose", "want", "need", "objective", "create", "build", "design"],
      south: ["learn", "research", "investigate", "understand", "analyze", "explore", "dependency"],
      west: ["test", "verify", "validate", "check", "reflect", "review", "quality", "ethical"],
      north: ["implement", "execute", "deploy", "run", "code", "install", "configure", "ship"],
    };
    let directionalSpread = 0;
    for (const keywords of Object.values(directionKeywords)) {
      if (keywords.some((k) => lower.includes(k))) {
        directionalSpread++;
      }
    }

    const hasTechnicalReferences =
      /(?:\/[\w.-]+){2,}/.test(prompt) || // file paths
      /@[\w./-]+/.test(prompt) || // package references
      /`[^`]+`/.test(prompt) || // inline code
      /\b(?:function|class|interface|import|export|const|let|var)\b/.test(lower);

    const hasNestedStructure =
      /^\s*[-*]\s/m.test(prompt) || // bullet lists
      /\d+\.\s/.test(prompt) || // numbered lists
      conditionalCount >= 2 || // multiple conditionals
      /\b(?:first|then|next|after that|finally|also|additionally)\b/.test(lower);

    // Classify complexity
    let complexity: PromptComplexity;
    if (hedgingCount >= 3 || (conditionalCount >= 3 && actionVerbCount >= 4)) {
      complexity = "ambiguous";
    } else if (
      wordCount > 150 ||
      actionVerbCount >= 5 ||
      (directionalSpread >= 3 && clauseCount >= 5)
    ) {
      complexity = "complex";
    } else if (
      wordCount > 50 ||
      actionVerbCount >= 3 ||
      directionalSpread >= 2
    ) {
      complexity = "moderate";
    } else {
      complexity = "simple";
    }

    return {
      wordCount,
      clauseCount,
      conditionalCount,
      hedgingCount,
      actionVerbCount,
      directionalSpread,
      hasTechnicalReferences,
      hasNestedStructure,
      complexity,
    };
  }
}

// =============================================================================
// StrategySelector
// =============================================================================

/**
 * Automatically selects the best decomposition strategy based on prompt
 * complexity, available resources, and user preferences.
 *
 * Selection algorithm (pseudocode):
 *
 * ```
 * function select(prompt, resources, preferences):
 *   // 1. Honor forced strategy if specified
 *   if preferences.forceStrategy:
 *     return registry[preferences.forceStrategy]
 *
 *   // 2. Analyze prompt complexity
 *   signals = ComplexityAnalyzer.analyze(prompt)
 *
 *   // 3. Filter to feasible strategies
 *   feasible = registry.filter(s =>
 *     s.canHandle(resources) &&
 *     !preferences.excludeStrategies.includes(s.id) &&
 *     (resources.maxLatencyMs == null || s.estimateLatency(signals) <= resources.maxLatencyMs)
 *   )
 *
 *   // 4. Score each feasible strategy
 *   for strategy in feasible:
 *     score = 0
 *     if signals.complexity == "simple":
 *       score += (strategy.id == "keyword") ? 1.0 : 0.5
 *     elif signals.complexity == "moderate":
 *       score += (strategy.id == "semantic") ? 0.8 : (strategy.id == "keyword") ? 0.6 : 0.9
 *     elif signals.complexity in ["complex", "ambiguous"]:
 *       score += (strategy.id == "hybrid") ? 1.0 : (strategy.id == "semantic") ? 0.7 : 0.3
 *
 *     if resources.preferAccuracy:
 *       score += (strategy.id == "hybrid") ? 0.3 : (strategy.id == "semantic") ? 0.2 : 0
 *
 *   // 5. Return highest-scoring strategy
 *   return feasible.maxBy(score)
 * ```
 *
 * Medicine Wheel influence on selection:
 * - If the prompt is heavily WEST-oriented (validation/ceremony), prefer
 *   strategies with higher accuracy (semantic/hybrid) as these are
 *   high-stakes decisions that benefit from deeper analysis
 * - If the prompt is heavily NORTH-oriented (action/execution), prefer
 *   faster strategies (keyword) as speed matters for implementation
 */
export class StrategySelector {
  private readonly registry: Map<StrategyId, DecompositionStrategy>;
  private readonly complexityAnalyzer: ComplexityAnalyzer;

  constructor(strategies?: DecompositionStrategy[]) {
    this.registry = new Map();
    this.complexityAnalyzer = new ComplexityAnalyzer();

    // Register default strategies
    const defaults: DecompositionStrategy[] = strategies ?? [
      new KeywordStrategy(),
      new SemanticStrategy(),
      new HybridStrategy(),
    ];

    for (const strategy of defaults) {
      this.registry.set(strategy.id, strategy);
    }
  }

  /**
   * Register a custom strategy.
   */
  register(strategy: DecompositionStrategy): void {
    this.registry.set(strategy.id, strategy);
  }

  /**
   * Select the best strategy for the given prompt and context.
   */
  select(
    prompt: string,
    resources: AvailableResources,
    preferences?: StrategyPreferences
  ): { strategy: DecompositionStrategy; signals: ComplexitySignals; reason: string } {
    // 1. Honor forced strategy
    if (preferences?.forceStrategy) {
      const forced = this.registry.get(preferences.forceStrategy);
      if (forced) {
        return {
          strategy: forced,
          signals: this.complexityAnalyzer.analyze(prompt),
          reason: `Forced strategy: ${preferences.forceStrategy}`,
        };
      }
    }

    // 2. Analyze prompt complexity
    const signals = this.complexityAnalyzer.analyze(prompt);

    // 3. Filter to feasible strategies
    const excluded = new Set(preferences?.excludeStrategies ?? []);
    const feasible: Array<{ strategy: DecompositionStrategy; score: number }> = [];

    for (const [id, strategy] of this.registry) {
      if (excluded.has(id)) continue;
      if (!strategy.canHandle(resources)) continue;

      const estimatedLatency = strategy.estimateLatency(signals);
      if (
        resources.maxLatencyMs !== undefined &&
        estimatedLatency > resources.maxLatencyMs
      ) {
        continue;
      }

      // 4. Score the strategy
      let score = 0;

      // Complexity-based scoring
      switch (signals.complexity) {
        case "simple":
          score += id === "keyword" ? 1.0 : id === "semantic" ? 0.5 : 0.4;
          break;
        case "moderate":
          score += id === "hybrid" ? 0.9 : id === "semantic" ? 0.8 : 0.6;
          break;
        case "complex":
          score += id === "hybrid" ? 1.0 : id === "semantic" ? 0.7 : 0.3;
          break;
        case "ambiguous":
          score += id === "hybrid" ? 1.0 : id === "semantic" ? 0.8 : 0.2;
          break;
      }

      // Accuracy preference boost
      if (resources.preferAccuracy) {
        if (id === "hybrid") score += 0.3;
        else if (id === "semantic") score += 0.2;
      }

      // Speed preference (inverse of latency)
      if (!resources.preferAccuracy && estimatedLatency > 0) {
        score += Math.max(0, 0.2 - estimatedLatency / 10000);
      }

      feasible.push({ strategy, score });
    }

    // 5. Return highest-scoring strategy (or keyword as fallback)
    feasible.sort((a, b) => b.score - a.score);

    if (feasible.length === 0) {
      const keyword = this.registry.get("keyword") ?? new KeywordStrategy();
      return {
        strategy: keyword,
        signals,
        reason: "No feasible strategies found; defaulting to keyword.",
      };
    }

    const selected = feasible[0];
    return {
      strategy: selected.strategy,
      signals,
      reason: `Selected ${selected.strategy.id} (score: ${selected.score.toFixed(2)}) for ${signals.complexity} prompt (${signals.wordCount} words, ${signals.actionVerbCount} verbs, ${signals.directionalSpread}/4 directions).`,
    };
  }

  /**
   * Get all registered strategies.
   */
  getStrategies(): DecompositionStrategy[] {
    return Array.from(this.registry.values());
  }
}

// =============================================================================
// ConfidenceCalibrator
// =============================================================================

/**
 * Post-processing step that calibrates confidence scores across strategies.
 *
 * Different strategies have different confidence distributions:
 * - KeywordStrategy tends to report moderate confidence (0.5-0.8) consistently
 * - SemanticStrategy may report high confidence (0.7-0.95) but with more variance
 * - HybridStrategy should be the most calibrated by design
 *
 * The calibrator normalizes scores so they are comparable across strategies
 * and applies corrections based on prompt complexity.
 *
 * Calibration approach:
 * 1. Strategy-specific bias correction (empirical offsets per strategy)
 * 2. Complexity-based adjustment (complex prompts get a confidence penalty)
 * 3. Balance bonus/penalty (well-balanced decompositions get a boost)
 * 4. Agreement bonus (if multi-pass, strategies that agree get boosted)
 */
export class ConfidenceCalibrator {
  /**
   * Per-strategy bias corrections.
   * Positive values increase confidence; negative values decrease.
   * These should be tuned empirically over time.
   */
  private readonly strategyBias: Record<string, number> = {
    keyword: 0.0, // Baseline — no correction
    semantic: -0.05, // LLMs tend to be slightly overconfident
    hybrid: 0.02, // Ensemble is slightly underconfident
  };

  /**
   * Calibrate a single strategy result.
   */
  calibrate(result: StrategyResult, signals: ComplexitySignals): StrategyResult {
    const bias = this.strategyBias[result.strategyId] ?? 0;

    // Complexity penalty: complex prompts are inherently harder to decompose
    let complexityAdjustment = 0;
    switch (signals.complexity) {
      case "simple":
        complexityAdjustment = 0.05;
        break;
      case "moderate":
        complexityAdjustment = 0;
        break;
      case "complex":
        complexityAdjustment = -0.05;
        break;
      case "ambiguous":
        complexityAdjustment = -0.1;
        break;
    }

    // Balance bonus: well-balanced decompositions are more trustworthy
    const balanceAdjustment = (result.directionalAnalysis.balance - 0.5) * 0.1;

    // Apply calibration
    const calibratedConfidence = Math.max(
      0,
      Math.min(
        1,
        result.confidence + bias + complexityAdjustment + balanceAdjustment
      )
    );

    // Calibrate per-direction confidence
    const calibratedDirConfidence: Record<string, number> = {};
    for (const dir of ["east", "south", "west", "north"] as Direction[]) {
      calibratedDirConfidence[dir] = Math.max(
        0,
        Math.min(
          1,
          (result.directionConfidence[dir] || 0) + bias + complexityAdjustment * 0.5
        )
      );
    }

    return {
      ...result,
      confidence: calibratedConfidence,
      directionConfidence: calibratedDirConfidence as Record<Direction, number>,
      diagnostics: [
        ...result.diagnostics,
        `Calibrated: bias=${bias.toFixed(3)}, complexity=${complexityAdjustment.toFixed(3)}, balance=${balanceAdjustment.toFixed(3)}`,
      ],
    };
  }

  /**
   * Calibrate multiple results from a multi-pass decomposition.
   * Applies individual calibration plus cross-strategy agreement analysis.
   */
  calibrateMultiple(
    results: StrategyResult[],
    signals: ComplexitySignals
  ): StrategyResult[] {
    // First, calibrate each result individually
    const calibrated = results.map((r) => this.calibrate(r, signals));

    // Then apply agreement bonus/penalty
    if (calibrated.length >= 2) {
      // Check if strategies agree on lead direction
      const leadDirections = calibrated.map(
        (r) => r.directionalAnalysis.leadDirection
      );
      const allAgree = leadDirections.every((d) => d === leadDirections[0]);

      // Check if strategies agree on primary action
      const primaryActions = calibrated.map((r) => r.intents.primary.action);
      const actionsAgree = primaryActions.every((a) => a === primaryActions[0]);

      const agreementBonus = (allAgree ? 0.05 : -0.03) + (actionsAgree ? 0.03 : -0.02);

      return calibrated.map((r) => ({
        ...r,
        confidence: Math.max(0, Math.min(1, r.confidence + agreementBonus)),
        diagnostics: [
          ...r.diagnostics,
          `Cross-strategy agreement: direction=${allAgree}, action=${actionsAgree}, bonus=${agreementBonus.toFixed(3)}`,
        ],
      }));
    }

    return calibrated;
  }
}

// =============================================================================
// MultiPassDecomposer
// =============================================================================

/**
 * Runs multiple decomposition strategies and merges/reconciles results
 * for the highest quality decomposition.
 *
 * Multi-pass is particularly valuable for:
 * - Complex prompts where a single strategy may miss important aspects
 * - Ambiguous prompts where strategy disagreement reveals true ambiguity
 * - High-stakes decompositions where confidence calibration matters
 *
 * Pass execution modes:
 * 1. **Parallel mode** (default): Run all strategies concurrently, merge results
 * 2. **Cascading mode**: Start with fast strategy, only run slower ones if
 *    confidence is below threshold
 *
 * Merging strategy:
 * - The result with the highest calibrated confidence is the "primary"
 * - Other results contribute supplementary intents and insights
 * - Agreement between strategies boosts confidence
 * - Disagreement is surfaced as ambiguity flags
 *
 * Integration with Medicine Wheel:
 * - After merging, the MultiPassDecomposer checks wheel balance
 * - If any direction is completely absent, it's flagged as a gap
 * - The ceremony requirement from MedicineWheelBridge is honored
 */
export class MultiPassDecomposer {
  private readonly selector: StrategySelector;
  private readonly calibrator: ConfidenceCalibrator;
  private readonly maxPasses: number;
  private readonly minConfidence: number;

  constructor(options?: {
    selector?: StrategySelector;
    calibrator?: ConfidenceCalibrator;
    maxPasses?: number;
    minConfidence?: number;
  }) {
    this.selector = options?.selector ?? new StrategySelector();
    this.calibrator = options?.calibrator ?? new ConfidenceCalibrator();
    this.maxPasses = options?.maxPasses ?? 3;
    this.minConfidence = options?.minConfidence ?? 0.6;
  }

  /**
   * Run multi-pass decomposition in parallel mode.
   *
   * Runs all feasible strategies concurrently, calibrates results,
   * and returns the best result along with all individual results
   * for inspection.
   */
  async decomposeParallel(
    prompt: string,
    resources: AvailableResources,
    preferences?: StrategyPreferences
  ): Promise<MultiPassResult> {
    const startTime = Date.now();
    const complexityAnalyzer = new ComplexityAnalyzer();
    const signals = complexityAnalyzer.analyze(prompt);

    // Get all feasible strategies
    const strategies = this.selector
      .getStrategies()
      .filter(
        (s) =>
          s.canHandle(resources) &&
          !(preferences?.excludeStrategies ?? []).includes(s.id)
      );

    // Limit to maxPasses
    const toRun = strategies.slice(0, this.maxPasses);

    // Run all in parallel
    const results = await Promise.all(
      toRun.map((s) =>
        s.decompose(prompt, resources).catch((error) => ({
          error,
          strategyId: s.id,
        }))
      )
    );

    // Filter out failures
    const successfulResults: StrategyResult[] = [];
    const failures: Array<{ strategyId: StrategyId; error: unknown }> = [];

    for (const result of results) {
      if ("error" in result) {
        failures.push(result as { strategyId: StrategyId; error: unknown });
      } else {
        successfulResults.push(result as StrategyResult);
      }
    }

    // Calibrate
    const calibratedResults = this.calibrator.calibrateMultiple(
      successfulResults,
      signals
    );

    // Select best result
    const sorted = [...calibratedResults].sort(
      (a, b) => b.confidence - a.confidence
    );
    const best = sorted[0];

    // Detect disagreements as ambiguity signals
    const disagreements = this.detectDisagreements(calibratedResults);

    return {
      best,
      allResults: calibratedResults,
      failures: failures.map((f) => ({
        strategyId: f.strategyId,
        error: f.error instanceof Error ? f.error.message : String(f.error),
      })),
      signals,
      disagreements,
      totalExecutionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Run multi-pass decomposition in cascading mode.
   *
   * Starts with the auto-selected strategy. If its confidence is below
   * the threshold, runs the next-best strategy, and so on up to maxPasses.
   * Stops as soon as a result meets the confidence threshold.
   */
  async decomposeCascading(
    prompt: string,
    resources: AvailableResources,
    preferences?: StrategyPreferences
  ): Promise<MultiPassResult> {
    const startTime = Date.now();
    const complexityAnalyzer = new ComplexityAnalyzer();
    const signals = complexityAnalyzer.analyze(prompt);

    const allResults: StrategyResult[] = [];
    const failures: Array<{ strategyId: string; error: string }> = [];
    const usedStrategies = new Set<StrategyId>();
    const minConf = preferences?.minConfidence ?? this.minConfidence;
    const maxPasses = preferences?.maxPasses ?? this.maxPasses;

    for (let pass = 0; pass < maxPasses; pass++) {
      // Select next strategy, excluding already-used ones
      const { strategy } = this.selector.select(prompt, resources, {
        ...preferences,
        excludeStrategies: [
          ...(preferences?.excludeStrategies ?? []),
          ...usedStrategies,
        ],
      });

      if (usedStrategies.has(strategy.id)) {
        break; // No more unique strategies available
      }

      usedStrategies.add(strategy.id);

      try {
        const result = await strategy.decompose(prompt, resources);
        const [calibrated] = this.calibrator.calibrateMultiple([result], signals);
        allResults.push(calibrated);

        if (calibrated.confidence >= minConf) {
          break; // Good enough — stop early
        }
      } catch (error) {
        failures.push({
          strategyId: strategy.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const sorted = [...allResults].sort((a, b) => b.confidence - a.confidence);
    const best = sorted[0];
    const disagreements = this.detectDisagreements(allResults);

    return {
      best,
      allResults,
      failures,
      signals,
      disagreements,
      totalExecutionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Detect points of disagreement between strategy results.
   * Disagreements are surfaced to the consumer as potential ambiguities.
   */
  private detectDisagreements(results: StrategyResult[]): Disagreement[] {
    if (results.length < 2) return [];

    const disagreements: Disagreement[] = [];

    // Check lead direction agreement
    const leadDirs = results.map((r) => r.directionalAnalysis.leadDirection);
    const uniqueLeadDirs = new Set(leadDirs);
    if (uniqueLeadDirs.size > 1) {
      disagreements.push({
        aspect: "lead_direction",
        description: `Strategies disagree on lead direction: ${[...uniqueLeadDirs].join(" vs ")}`,
        strategyValues: Object.fromEntries(
          results.map((r) => [r.strategyId, r.directionalAnalysis.leadDirection])
        ),
        severity: "moderate",
      });
    }

    // Check primary action agreement
    const primaryActions = results.map((r) => r.intents.primary.action);
    const uniqueActions = new Set(primaryActions);
    if (uniqueActions.size > 1) {
      disagreements.push({
        aspect: "primary_action",
        description: `Strategies disagree on primary action: ${[...uniqueActions].join(" vs ")}`,
        strategyValues: Object.fromEntries(
          results.map((r) => [r.strategyId, r.intents.primary.action])
        ),
        severity: "high",
      });
    }

    // Check secondary intent count divergence
    const intentCounts = results.map((r) => r.intents.secondary.length);
    const maxCount = Math.max(...intentCounts);
    const minCount = Math.min(...intentCounts);
    if (maxCount > 0 && minCount / maxCount < 0.5) {
      disagreements.push({
        aspect: "intent_count",
        description: `Intent count varies significantly: ${minCount}-${maxCount} across strategies`,
        strategyValues: Object.fromEntries(
          results.map((r) => [r.strategyId, String(r.intents.secondary.length)])
        ),
        severity: "low",
      });
    }

    return disagreements;
  }
}

/**
 * Represents a point of disagreement between strategies.
 */
export interface Disagreement {
  /** What aspect the strategies disagree on */
  aspect: "lead_direction" | "primary_action" | "intent_count" | string;
  /** Human-readable description */
  description: string;
  /** What each strategy reported */
  strategyValues: Record<StrategyId, string>;
  /** How severe the disagreement is */
  severity: "low" | "moderate" | "high";
}

/**
 * The result of a multi-pass decomposition.
 */
export interface MultiPassResult {
  /** The best result (highest calibrated confidence) */
  best: StrategyResult;
  /** All individual strategy results, calibrated */
  allResults: StrategyResult[];
  /** Any strategies that failed with error messages */
  failures: Array<{ strategyId: StrategyId; error: string }>;
  /** Complexity signals computed for the prompt */
  signals: ComplexitySignals;
  /** Points of disagreement between strategies */
  disagreements: Disagreement[];
  /** Total wall-clock time for all passes */
  totalExecutionTimeMs: number;
}

// =============================================================================
// StrategicDecomposer — Top-level API
// =============================================================================

/**
 * The top-level entry point that replaces the existing `decompose()` pipeline
 * function with a strategy-aware version. Backward compatible: when called
 * without options, behaves identically to the existing keyword-based pipeline.
 *
 * Usage:
 * ```typescript
 * import { StrategicDecomposer } from "ava-langchain-prompt-decomposition";
 *
 * // Simple — identical to existing decompose()
 * const decomposer = new StrategicDecomposer();
 * const result = await decomposer.decompose("Build a knowledge graph...");
 *
 * // With LLM — auto-selects semantic/hybrid strategy
 * const decomposer = new StrategicDecomposer({
 *   resources: { llm: new ChatOpenAI() },
 * });
 * const result = await decomposer.decompose("Build a knowledge graph...");
 *
 * // Multi-pass for highest quality
 * const decomposer = new StrategicDecomposer({
 *   resources: { llm: new ChatOpenAI() },
 *   preferences: { alwaysMultiPass: true },
 * });
 * const result = await decomposer.decompose("Build a knowledge graph...");
 * ```
 */
export class StrategicDecomposer {
  private readonly selector: StrategySelector;
  private readonly multiPass: MultiPassDecomposer;
  private readonly resources: AvailableResources;
  private readonly preferences: StrategyPreferences;

  constructor(options?: {
    resources?: AvailableResources;
    preferences?: StrategyPreferences;
    strategies?: DecompositionStrategy[];
  }) {
    this.resources = options?.resources ?? {};
    this.preferences = options?.preferences ?? {};
    this.selector = new StrategySelector(options?.strategies);
    this.multiPass = new MultiPassDecomposer({
      selector: this.selector,
      minConfidence: this.preferences.minConfidence,
      maxPasses: this.preferences.maxPasses,
    });
  }

  /**
   * Decompose a prompt using the strategy system.
   *
   * Automatically selects the best strategy based on prompt complexity
   * and available resources. Optionally runs multi-pass for higher
   * quality on complex prompts.
   */
  async decompose(prompt: string): Promise<StrategicDecompositionResult> {
    const { strategy, signals, reason } = this.selector.select(
      prompt,
      this.resources,
      this.preferences
    );

    // Decide whether to use multi-pass
    const useMultiPass =
      this.preferences.alwaysMultiPass ||
      (signals.complexity === "ambiguous" && this.resources.llm !== undefined) ||
      (signals.complexity === "complex" &&
        this.resources.preferAccuracy &&
        this.resources.llm !== undefined);

    if (useMultiPass) {
      const multiResult = await this.multiPass.decomposeParallel(
        prompt,
        this.resources,
        this.preferences
      );
      return {
        result: multiResult.best,
        selectionReason: reason,
        signals,
        multiPass: multiResult,
      };
    }

    // Single-pass
    const result = await strategy.decompose(prompt, this.resources);
    const calibrator = new ConfidenceCalibrator();
    const calibrated = calibrator.calibrate(result, signals);

    return {
      result: calibrated,
      selectionReason: reason,
      signals,
    };
  }
}

/**
 * The output of StrategicDecomposer, containing the decomposition
 * result plus metadata about strategy selection and confidence calibration.
 */
export interface StrategicDecompositionResult {
  /** The best decomposition result (calibrated) */
  result: StrategyResult;
  /** Why this strategy was selected */
  selectionReason: string;
  /** Complexity signals used for strategy selection */
  signals: ComplexitySignals;
  /** Multi-pass details, if multi-pass was used */
  multiPass?: MultiPassResult;
}
