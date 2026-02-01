/**
 * Narrative Tracing Handler
 *
 * Langfuse callback handler with narrative awareness for the Narrative Intelligence Stack.
 * Provides semantic span naming and narrative-specific event logging.
 */

import { v4 as uuidv4 } from "uuid";
import {
  NarrativeEventType,
  EVENT_GLYPHS,
  NarrativeMetrics,
  createNarrativeMetrics,
  TraceCorrelation,
  createTraceCorrelation,
} from "./event_types.js";

// Optional Langfuse import
let Langfuse: any;
try {
  Langfuse = require("langfuse").Langfuse;
} catch {
  Langfuse = null;
}

export interface NarrativeTracingHandlerOptions {
  storyId?: string;
  sessionId?: string;
  traceId?: string;
  enableSemanticNaming?: boolean;
  correlationHeader?: string;
  publicKey?: string;
  secretKey?: string;
  host?: string;
}

/**
 * Langfuse callback handler with narrative awareness.
 *
 * This handler extends standard tracing with narrative-specific
 * event types, semantic naming, and three-universe perspective tracking.
 *
 * @example
 * ```typescript
 * import { NarrativeTracingHandler } from '@langchain/narrative-tracing';
 *
 * const handler = new NarrativeTracingHandler({
 *   storyId: 'story_123',
 *   sessionId: 'session_456',
 * });
 *
 * // Log narrative events
 * handler.logBeatCreation('beat_1', 'content', 1, 'rising_action');
 * handler.logThreeUniverseAnalysis({...});
 * ```
 */
export class NarrativeTracingHandler {
  // Story context
  storyId: string;
  sessionId: string | undefined;
  rootTraceId: string | undefined;

  // Configuration
  enableSemanticNaming: boolean;
  correlationHeader: string;

  // Langfuse client
  private langfuse: any;

  // Tracking maps
  private traceObjects: Map<string, any> = new Map();
  private spanObjects: Map<string, any> = new Map();
  private runToSpanId: Map<string, string> = new Map();

  // Correlation
  correlation: TraceCorrelation | undefined;

  // Metrics accumulator
  private _metrics: NarrativeMetrics;

  constructor(options: NarrativeTracingHandlerOptions = {}) {
    if (!Langfuse) {
      throw new Error(
        "Langfuse is not installed. Install it with: npm install langfuse"
      );
    }

    // Story context
    this.storyId =
      options.storyId || process.env.NARRATIVE_STORY_ID || "unknown";
    this.sessionId = options.sessionId || process.env.COAIAPY_SESSION_ID;
    this.rootTraceId = options.traceId || process.env.COAIAPY_TRACE_ID;

    // Configuration
    this.enableSemanticNaming = options.enableSemanticNaming ?? true;
    this.correlationHeader =
      options.correlationHeader || "X-Narrative-Trace-Id";

    // Initialize Langfuse client
    this.langfuse = new Langfuse({
      publicKey: options.publicKey || process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: options.secretKey || process.env.LANGFUSE_SECRET_KEY,
      baseUrl: options.host || process.env.LANGFUSE_HOST,
    });

    // Metrics accumulator
    this._metrics = createNarrativeMetrics();

    // Initialize root trace if story_id provided
    if (this.storyId && this.storyId !== "unknown") {
      this._ensureRootTrace();
    }
  }

  // ===========================================================================
  // ROOT TRACE MANAGEMENT
  // ===========================================================================

  private _ensureRootTrace(): string {
    if (this.rootTraceId && this.traceObjects.has(this.rootTraceId)) {
      return this.rootTraceId;
    }

    const traceId = this.rootTraceId || uuidv4();
    this.rootTraceId = traceId;

    if (!this.traceObjects.has(traceId)) {
      const trace = this.langfuse.trace({
        id: traceId,
        sessionId: this.sessionId,
        name: `📖 Story Generation: ${this.storyId}`,
        metadata: {
          story_id: this.storyId,
          session_id: this.sessionId,
          created_at: new Date().toISOString(),
        },
      });
      this.traceObjects.set(traceId, trace);

      // Initialize correlation
      this.correlation = createTraceCorrelation(
        traceId,
        this.storyId,
        this.sessionId || ""
      );
    }

    return traceId;
  }

  /**
   * Get headers for cross-system correlation
   */
  getCorrelationHeader(): Record<string, string> {
    return {
      [this.correlationHeader]: this._ensureRootTrace(),
      "X-Story-Id": this.storyId,
      "X-Session-Id": this.sessionId || "",
    };
  }

  /**
   * Receive correlation from incoming request
   */
  receiveCorrelationHeader(headers: Record<string, string>): void {
    if (this.correlationHeader in headers && this.correlation) {
      const incomingTraceId = headers[this.correlationHeader];
      this.correlation.childTraceIds.set(incomingTraceId, "external");
    }
  }

  // ===========================================================================
  // NARRATIVE EVENT LOGGING
  // ===========================================================================

  /**
   * Log a narrative event to Langfuse
   */
  logEvent(options: {
    eventType: NarrativeEventType;
    inputData?: Record<string, unknown>;
    outputData?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    parentSpanId?: string;
    beatId?: string;
    characterIds?: string[];
    emotionalTone?: string;
    leadUniverse?: string;
  }): string {
    const traceId = this._ensureRootTrace();
    const trace = this.traceObjects.get(traceId);

    const spanId = uuidv4();
    const glyph = EVENT_GLYPHS[options.eventType] || "⚙️";
    let name = `${glyph} ${options.eventType
      .split(".")
      .pop()
      ?.replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())}`;

    // Add context to name
    if (options.beatId) {
      name = `${name} (${options.beatId})`;
    } else if (options.leadUniverse) {
      name = `${name} (${options.leadUniverse})`;
    }

    // Create span
    const span = trace.span({
      id: spanId,
      name,
      input: options.inputData || {},
      output: options.outputData,
      metadata: {
        event_type: options.eventType,
        story_id: this.storyId,
        beat_id: options.beatId,
        character_ids: options.characterIds || [],
        emotional_tone: options.emotionalTone,
        lead_universe: options.leadUniverse,
        ...(options.metadata || {}),
      },
      parentObservationId: options.parentSpanId,
    });

    this.spanObjects.set(spanId, span);
    return spanId;
  }

  // ===========================================================================
  // BEAT EVENTS
  // ===========================================================================

  /**
   * Log creation of a new story beat
   */
  logBeatCreation(
    beatId: string,
    content: string,
    sequence: number,
    narrativeFunction: string,
    options: {
      source?: string;
      characterId?: string;
      emotionalTone?: string;
      parentSpanId?: string;
    } = {}
  ): string {
    this._metrics.beatsGenerated += 1;

    return this.logEvent({
      eventType: NarrativeEventType.BEAT_CREATED,
      inputData: {
        sequence,
        narrative_function: narrativeFunction,
        source: options.source || "generator",
      },
      outputData: {
        beat_id: beatId,
        content_preview:
          content.length > 200 ? content.substring(0, 200) + "..." : content,
      },
      beatId,
      characterIds: options.characterId ? [options.characterId] : undefined,
      emotionalTone: options.emotionalTone,
      parentSpanId: options.parentSpanId,
    });
  }

  /**
   * Log emotional/thematic analysis of a beat
   */
  logBeatAnalysis(
    beatId: string,
    analysisType: string,
    classification: string,
    confidence: number,
    options: {
      detectedEmotions?: string[];
      parentSpanId?: string;
    } = {}
  ): string {
    return this.logEvent({
      eventType: NarrativeEventType.BEAT_ANALYZED,
      inputData: {
        beat_id: beatId,
        analysis_type: analysisType,
      },
      outputData: {
        classification,
        confidence,
        detected_emotions: options.detectedEmotions || [],
      },
      beatId,
      emotionalTone: classification,
      parentSpanId: options.parentSpanId,
    });
  }

  /**
   * Log enrichment of a beat by agent flows
   */
  logBeatEnrichment(
    beatId: string,
    enrichmentType: string,
    flowsUsed: string[],
    qualityBefore: number,
    qualityAfter: number,
    parentSpanId?: string
  ): string {
    this._metrics.enrichmentsApplied += 1;

    return this.logEvent({
      eventType: NarrativeEventType.BEAT_ENRICHED,
      inputData: {
        beat_id: beatId,
        enrichment_type: enrichmentType,
        flows_used: flowsUsed,
        quality_before: qualityBefore,
      },
      outputData: {
        quality_after: qualityAfter,
        improvement: qualityAfter - qualityBefore,
      },
      beatId,
      parentSpanId,
    });
  }

  // ===========================================================================
  // THREE-UNIVERSE EVENTS
  // ===========================================================================

  /**
   * Log three-universe analysis of an event
   */
  logThreeUniverseAnalysis(options: {
    eventId: string;
    engineerIntent: string;
    engineerConfidence: number;
    ceremonyIntent: string;
    ceremonyConfidence: number;
    storyEngineIntent: string;
    storyEngineConfidence: number;
    leadUniverse: string;
    coherenceScore: number;
    parentSpanId?: string;
  }): string {
    // Update metrics
    this._metrics.engineerAlignment =
      this._metrics.engineerAlignment * 0.9 + options.engineerConfidence * 0.1;
    this._metrics.ceremonyAlignment =
      this._metrics.ceremonyAlignment * 0.9 + options.ceremonyConfidence * 0.1;
    this._metrics.storyEngineAlignment =
      this._metrics.storyEngineAlignment * 0.9 +
      options.storyEngineConfidence * 0.1;
    this._metrics.crossUniverseCoherence =
      this._metrics.crossUniverseCoherence * 0.9 + options.coherenceScore * 0.1;

    return this.logEvent({
      eventType: NarrativeEventType.THREE_UNIVERSE_ANALYSIS,
      inputData: {
        event_id: options.eventId,
      },
      outputData: {
        engineer: {
          intent: options.engineerIntent,
          confidence: options.engineerConfidence,
        },
        ceremony: {
          intent: options.ceremonyIntent,
          confidence: options.ceremonyConfidence,
        },
        story_engine: {
          intent: options.storyEngineIntent,
          confidence: options.storyEngineConfidence,
        },
        lead_universe: options.leadUniverse,
        coherence_score: options.coherenceScore,
      },
      leadUniverse: options.leadUniverse,
      metadata: { coherence_score: options.coherenceScore },
      parentSpanId: options.parentSpanId,
    });
  }

  // ===========================================================================
  // CHARACTER ARC EVENTS
  // ===========================================================================

  /**
   * Log character arc progression
   */
  logCharacterArcUpdate(
    characterId: string,
    characterName: string,
    arcPositionBefore: number,
    arcPositionAfter: number,
    growthDescription: string,
    options: {
      beatId?: string;
      parentSpanId?: string;
    } = {}
  ): string {
    this._metrics.characterArcCompletion[characterId] = arcPositionAfter;

    return this.logEvent({
      eventType: NarrativeEventType.CHARACTER_ARC_UPDATED,
      inputData: {
        character_id: characterId,
        character_name: characterName,
        arc_position_before: arcPositionBefore,
      },
      outputData: {
        arc_position_after: arcPositionAfter,
        growth: arcPositionAfter - arcPositionBefore,
        growth_description: growthDescription,
      },
      beatId: options.beatId,
      characterIds: [characterId],
      parentSpanId: options.parentSpanId,
    });
  }

  // ===========================================================================
  // ROUTING EVENTS
  // ===========================================================================

  /**
   * Log a routing decision to a backend/flow
   */
  logRoutingDecision(options: {
    decisionId: string;
    backend: string;
    flow: string;
    score: number;
    method?: string;
    leadUniverse?: string;
    narrativeAct?: number;
    narrativePhase?: string;
    success?: boolean;
    latencyMs?: number;
    parentSpanId?: string;
  }): string {
    this._metrics.routingDecisions += 1;

    return this.logEvent({
      eventType: NarrativeEventType.ROUTING_DECISION,
      inputData: {
        decision_id: options.decisionId,
        method: options.method || "narrative",
        lead_universe: options.leadUniverse,
        narrative_position: {
          act: options.narrativeAct,
          phase: options.narrativePhase,
        },
      },
      outputData: {
        backend: options.backend,
        flow: options.flow,
        score: options.score,
        success: options.success ?? true,
        latency_ms: options.latencyMs || 0,
      },
      leadUniverse: options.leadUniverse,
      metadata: {
        backend: options.backend,
        flow: options.flow,
      },
      parentSpanId: options.parentSpanId,
    });
  }

  // ===========================================================================
  // CHECKPOINT EVENTS
  // ===========================================================================

  /**
   * Log a narrative state checkpoint
   */
  logCheckpoint(
    checkpointId: string,
    storyId: string,
    beatCount: number,
    narrativeAct: number,
    narrativePhase: string,
    overallCoherence: number,
    parentSpanId?: string
  ): string {
    return this.logEvent({
      eventType: NarrativeEventType.NARRATIVE_CHECKPOINT,
      inputData: {
        story_id: storyId,
      },
      outputData: {
        checkpoint_id: checkpointId,
        beat_count: beatCount,
        narrative_position: {
          act: narrativeAct,
          phase: narrativePhase,
        },
        overall_coherence: overallCoherence,
      },
      metadata: {
        checkpoint_id: checkpointId,
      },
      parentSpanId,
    });
  }

  /**
   * Log an episode boundary (new episode starting)
   */
  logEpisodeBoundary(
    episodeId: string,
    beatCount: number,
    reason: string = "beat_threshold",
    parentSpanId?: string
  ): string {
    return this.logEvent({
      eventType: NarrativeEventType.EPISODE_BOUNDARY,
      inputData: {
        reason,
        beat_count: beatCount,
      },
      outputData: {
        episode_id: episodeId,
      },
      metadata: {
        episode_id: episodeId,
      },
      parentSpanId,
    });
  }

  // ===========================================================================
  // GAP EVENTS
  // ===========================================================================

  /**
   * Log identification of a narrative gap
   */
  logGapIdentified(
    gapType: string,
    description: string,
    severity: number,
    options: {
      beatId?: string;
      suggestedRemediation?: string;
      parentSpanId?: string;
    } = {}
  ): string {
    return this.logEvent({
      eventType: NarrativeEventType.GAP_IDENTIFIED,
      inputData: {
        beat_id: options.beatId,
      },
      outputData: {
        gap_type: gapType,
        description,
        severity,
        suggested_remediation: options.suggestedRemediation,
      },
      beatId: options.beatId,
      parentSpanId: options.parentSpanId,
    });
  }

  /**
   * Log remediation of a narrative gap
   */
  logGapRemediated(
    gapType: string,
    remediationMethod: string,
    flowsUsed: string[],
    options: {
      success?: boolean;
      beatId?: string;
      parentSpanId?: string;
    } = {}
  ): string {
    const success = options.success ?? true;
    if (success) {
      this._metrics.gapsRemediated += 1;
    }

    return this.logEvent({
      eventType: NarrativeEventType.GAP_REMEDIATED,
      inputData: {
        gap_type: gapType,
        remediation_method: remediationMethod,
      },
      outputData: {
        flows_used: flowsUsed,
        success,
      },
      beatId: options.beatId,
      parentSpanId: options.parentSpanId,
    });
  }

  // ===========================================================================
  // STORY LIFECYCLE
  // ===========================================================================

  /**
   * Start tracing story generation
   */
  startStoryGeneration(storyId?: string): string {
    if (storyId) {
      this.storyId = storyId;
    }

    const traceId = this._ensureRootTrace();

    this.logEvent({
      eventType: NarrativeEventType.STORY_GENERATION_START,
      inputData: { story_id: this.storyId },
    });

    return traceId;
  }

  /**
   * End tracing story generation with metrics
   */
  endStoryGeneration(totalMs: number): void {
    this._metrics.totalGenerationTimeMs = totalMs;
    if (this._metrics.beatsGenerated > 0) {
      this._metrics.averageBeatTimeMs =
        totalMs / this._metrics.beatsGenerated;
    }

    this.logEvent({
      eventType: NarrativeEventType.STORY_GENERATION_END,
      inputData: { story_id: this.storyId },
      outputData: {
        duration_ms: totalMs,
        beats_generated: this._metrics.beatsGenerated,
      },
    });

    this.logEvent({
      eventType: NarrativeEventType.STORY_QUALITY_METRICS,
      outputData: this._metrics as unknown as Record<string, unknown>,
    });
  }

  // ===========================================================================
  // METRICS ACCESS
  // ===========================================================================

  /**
   * Get accumulated narrative metrics
   */
  getMetrics(): NarrativeMetrics {
    return this._metrics;
  }

  /**
   * Reset metrics accumulator
   */
  resetMetrics(): void {
    this._metrics = createNarrativeMetrics();
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /**
   * Flush pending traces to Langfuse
   */
  async flush(): Promise<void> {
    if (this.langfuse) {
      await this.langfuse.flush();
    }
  }
}
