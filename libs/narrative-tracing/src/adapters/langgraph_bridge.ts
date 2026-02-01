/**
 * LangGraph Bridge Adapter
 *
 * Wires the LangGraph ThreeUniverseProcessor to narrative-tracing,
 * so every three-universe analysis automatically logs to Langfuse.
 */

import { NarrativeTracingHandler } from "../handler.js";

/**
 * Simplified result from a single universe analysis
 */
export interface UniverseResult {
  intent: string;
  confidence: number;
  suggestedFlows: string[];
  context: Record<string, unknown>;
}

/**
 * Protocol matching LangGraph's ThreeUniverseAnalysis
 */
export interface ThreeUniverseAnalysisLike {
  engineer: { intent: string; confidence: number };
  ceremony: { intent: string; confidence: number };
  storyEngine: { intent: string; confidence: number };
  leadUniverse: string | { value: string };
  coherenceScore: number;
}

/**
 * Context object for trace_analysis context manager pattern
 */
export interface AnalysisContext {
  eventId: string;
  eventContent: string;
  engineerResult?: Record<string, unknown>;
  ceremonyResult?: Record<string, unknown>;
  storyEngineResult?: Record<string, unknown>;
  leadUniverse: string;
  coherenceScore: number;
  parentSpanId?: string;
}

export interface LangGraphBridgeOptions {
  autoFlush?: boolean;
}

const VALID_UNIVERSES = new Set(["engineer", "ceremony", "story_engine"]);

/**
 * Wire LangGraph three-universe processing to narrative tracing.
 *
 * @example
 * ```typescript
 * const handler = new NarrativeTracingHandler({ storyId: 'story_123' });
 * const bridge = new LangGraphBridge(handler);
 *
 * // Get callback for manual injection
 * const callback = bridge.createThreeUniverseCallback();
 *
 * // After processing an event
 * callback({
 *   eventId: 'evt_123',
 *   eventContent: 'feat: add three-universe processing',
 *   engineerResult: { intent: 'feature_implementation', confidence: 0.8 },
 *   ceremonyResult: { intent: 'co_creation', confidence: 0.7 },
 *   storyEngineResult: { intent: 'rising_action', confidence: 0.85 },
 *   leadUniverse: 'story_engine',
 *   coherenceScore: 0.82
 * });
 * ```
 */
export class LangGraphBridge {
  private handler: NarrativeTracingHandler;
  private autoFlush: boolean;
  private _analysisCount: number = 0;

  constructor(
    handler: NarrativeTracingHandler,
    options: LangGraphBridgeOptions = {}
  ) {
    this.handler = handler;
    this.autoFlush = options.autoFlush ?? false;
  }

  // ===========================================================================
  // CALLBACK APPROACH
  // ===========================================================================

  /**
   * Create callback function for logging three-universe analysis
   */
  createThreeUniverseCallback(parentSpanId?: string): (params: {
    eventId: string;
    eventContent: string;
    engineerResult: Record<string, unknown>;
    ceremonyResult: Record<string, unknown>;
    storyEngineResult: Record<string, unknown>;
    leadUniverse: string;
    coherenceScore: number;
  }) => string {
    return (params) => {
      this.validateCoherenceScore(params.coherenceScore);
      this.validateLeadUniverse(params.leadUniverse);

      const spanId = this.handler.logThreeUniverseAnalysis({
        eventId: params.eventId,
        engineerIntent: (params.engineerResult.intent as string) || "unknown",
        engineerConfidence:
          (params.engineerResult.confidence as number) || 0.0,
        ceremonyIntent: (params.ceremonyResult.intent as string) || "unknown",
        ceremonyConfidence:
          (params.ceremonyResult.confidence as number) || 0.0,
        storyEngineIntent:
          (params.storyEngineResult.intent as string) || "unknown",
        storyEngineConfidence:
          (params.storyEngineResult.confidence as number) || 0.0,
        leadUniverse: params.leadUniverse,
        coherenceScore: params.coherenceScore,
        parentSpanId,
      });

      this._analysisCount += 1;

      if (this.autoFlush) {
        this.handler.flush();
      }

      return spanId;
    };
  }

  // ===========================================================================
  // ANALYSIS OBJECT APPROACH
  // ===========================================================================

  /**
   * Log a ThreeUniverseAnalysis object directly
   */
  logAnalysis(
    eventId: string,
    analysis: ThreeUniverseAnalysisLike,
    options: {
      eventContent?: string;
      parentSpanId?: string;
    } = {}
  ): string {
    // Extract lead universe value (handle enum or string)
    let leadValue =
      typeof analysis.leadUniverse === "object"
        ? analysis.leadUniverse.value
        : analysis.leadUniverse;

    return this.handler.logThreeUniverseAnalysis({
      eventId,
      engineerIntent: analysis.engineer.intent,
      engineerConfidence: analysis.engineer.confidence,
      ceremonyIntent: analysis.ceremony.intent,
      ceremonyConfidence: analysis.ceremony.confidence,
      storyEngineIntent: analysis.storyEngine.intent,
      storyEngineConfidence: analysis.storyEngine.confidence,
      leadUniverse: leadValue,
      coherenceScore: analysis.coherenceScore,
      parentSpanId: options.parentSpanId,
    });
  }

  // ===========================================================================
  // DECORATOR/WRAPPER APPROACH
  // ===========================================================================

  /**
   * Wrap a function that takes an event and returns a ThreeUniverseAnalysis
   */
  traceProcessor<T extends ThreeUniverseAnalysisLike>(
    fn: (event: Record<string, unknown>) => T | Promise<T>,
    eventIdExtractor?: (event: Record<string, unknown>) => string
  ): (event: Record<string, unknown>) => Promise<T> {
    return async (event: Record<string, unknown>) => {
      const eventId = eventIdExtractor
        ? eventIdExtractor(event)
        : (event.eventId as string) || `evt_${this._analysisCount}`;

      const result = await fn(event);

      if (
        result &&
        "leadUniverse" in result &&
        "coherenceScore" in result
      ) {
        this.logAnalysis(eventId, result, {
          eventContent: event.content as string | undefined,
        });
      }

      return result;
    };
  }

  // ===========================================================================
  // BEAT CREATION TRACKING
  // ===========================================================================

  /**
   * Log creation of a story beat from three-universe analysis
   */
  logBeatCreation(
    beatId: string,
    content: string,
    sequence: number,
    narrativeFunction: string,
    options: {
      analysis?: ThreeUniverseAnalysisLike;
      emotionalTone?: string;
      parentSpanId?: string;
    } = {}
  ): string {
    let source = "three_universe_processor";
    if (options.analysis) {
      const lead =
        typeof options.analysis.leadUniverse === "object"
          ? options.analysis.leadUniverse.value
          : options.analysis.leadUniverse;
      source = `${lead}_led`;
    }

    return this.handler.logBeatCreation(beatId, content, sequence, narrativeFunction, {
      source,
      emotionalTone: options.emotionalTone,
      parentSpanId: options.parentSpanId,
    });
  }

  // ===========================================================================
  // VALIDATION HELPERS
  // ===========================================================================

  private validateCoherenceScore(score: number): void {
    if (score < 0.0 || score > 1.0) {
      throw new Error(
        `coherence_score must be between 0.0 and 1.0, got ${score}`
      );
    }
  }

  private validateLeadUniverse(universe: string): void {
    if (!VALID_UNIVERSES.has(universe)) {
      throw new Error(
        `lead_universe must be one of ${[...VALID_UNIVERSES].join(", ")}, got '${universe}'`
      );
    }
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  get analysisCount(): number {
    return this._analysisCount;
  }

  resetCount(): void {
    this._analysisCount = 0;
  }
}
