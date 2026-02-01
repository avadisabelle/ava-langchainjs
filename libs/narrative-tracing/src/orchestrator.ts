/**
 * Narrative Trace Orchestrator
 *
 * Correlates traces across system boundaries in the Narrative Intelligence Stack:
 * LangGraph → Flowise → Langflow → LangChain
 */

import { v4 as uuidv4 } from "uuid";
import {
  NarrativeEventType,
  NarrativeMetrics,
  NarrativeSpan,
  createNarrativeSpan,
  TraceCorrelation,
  createTraceCorrelation,
  addChildTrace,
  serializeTraceCorrelation,
} from "./event_types.js";

// Optional Langfuse import
let Langfuse: any;
try {
  Langfuse = require("langfuse").Langfuse;
} catch {
  Langfuse = null;
}

/**
 * Root trace for a story generation session
 */
export interface RootTrace {
  traceId: string;
  storyId: string;
  sessionId: string;
  traceObject: any;
  childSpanIds: string[];
  createdAt: string;
  correlation: TraceCorrelation | undefined;
}

/**
 * A completed trace with all spans and metrics
 */
export interface CompletedTrace {
  traceId: string;
  storyId: string;
  sessionId: string;
  spans: NarrativeSpan[];
  startTime: string;
  endTime: string;
  durationMs: number;
  metrics: NarrativeMetrics | undefined;
  storyContent: string | undefined;
  beatCount: number;
  correlation: TraceCorrelation | undefined;
}

export interface NarrativeTraceOrchestratorOptions {
  publicKey?: string;
  secretKey?: string;
  host?: string;
}

/**
 * Orchestrates traces across the Narrative Intelligence Stack.
 *
 * @example
 * ```typescript
 * const orchestrator = new NarrativeTraceOrchestrator();
 *
 * // Create root trace for story generation
 * const root = orchestrator.createStoryGenerationRoot('story_123', 'session_456');
 *
 * // Create child spans
 * const beatSpanId = orchestrator.createBeatSpan(beat, root);
 *
 * // Inject headers for outgoing calls
 * const headers = orchestrator.injectCorrelationHeader({}, root.traceId);
 * ```
 */
export class NarrativeTraceOrchestrator {
  // Header names for cross-system correlation
  static readonly TRACE_ID_HEADER = "X-Narrative-Trace-Id";
  static readonly STORY_ID_HEADER = "X-Story-Id";
  static readonly SESSION_ID_HEADER = "X-Session-Id";
  static readonly PARENT_SPAN_HEADER = "X-Parent-Span-Id";

  private langfuse: any;
  private activeTraces: Map<string, RootTrace> = new Map();
  private spans: Map<string, NarrativeSpan> = new Map();

  constructor(options: NarrativeTraceOrchestratorOptions = {}) {
    if (!Langfuse) {
      throw new Error(
        "Langfuse is required. Install with: npm install langfuse"
      );
    }

    this.langfuse = new Langfuse({
      publicKey: options.publicKey || process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: options.secretKey || process.env.LANGFUSE_SECRET_KEY,
      baseUrl: options.host || process.env.LANGFUSE_HOST,
    });
  }

  // ===========================================================================
  // ROOT TRACE CREATION
  // ===========================================================================

  /**
   * Create root span for entire story generation session
   */
  createStoryGenerationRoot(
    storyId: string,
    sessionId?: string,
    traceId?: string,
    metadata?: Record<string, unknown>
  ): RootTrace {
    const finalTraceId = traceId || uuidv4();
    const finalSessionId =
      sessionId || process.env.COAIAPY_SESSION_ID || uuidv4();

    // Create Langfuse trace
    const traceObject = this.langfuse.trace({
      id: finalTraceId,
      sessionId: finalSessionId,
      name: `📖 Story Generation: ${storyId}`,
      metadata: {
        story_id: storyId,
        session_id: finalSessionId,
        created_at: new Date().toISOString(),
        ...metadata,
      },
    });

    // Create correlation tracker
    const correlation = createTraceCorrelation(
      finalTraceId,
      storyId,
      finalSessionId
    );

    const root: RootTrace = {
      traceId: finalTraceId,
      storyId,
      sessionId: finalSessionId,
      traceObject,
      childSpanIds: [],
      createdAt: new Date().toISOString(),
      correlation,
    };

    this.activeTraces.set(finalTraceId, root);
    return root;
  }

  // ===========================================================================
  // CHILD SPAN CREATION
  // ===========================================================================

  /**
   * Create child span for a story beat
   */
  createBeatSpan(
    beatId: string,
    beatContent: string,
    beatSequence: number,
    narrativeFunction: string,
    rootTrace: RootTrace,
    options: {
      emotionalTone?: string;
      characterId?: string;
      parentSpanId?: string;
    } = {}
  ): string {
    const spanId = uuidv4();

    let name = `📝 Beat ${beatSequence}: ${beatId}`;
    if (options.emotionalTone) {
      name = `${name} (${options.emotionalTone})`;
    }

    // Create Langfuse span
    rootTrace.traceObject.span({
      id: spanId,
      name,
      input: {
        beat_id: beatId,
        sequence: beatSequence,
        narrative_function: narrativeFunction,
      },
      output: {
        content_preview:
          beatContent.length > 200
            ? beatContent.substring(0, 200) + "..."
            : beatContent,
      },
      metadata: {
        beat_id: beatId,
        emotional_tone: options.emotionalTone,
        character_id: options.characterId,
      },
      parentObservationId: options.parentSpanId,
    });

    // Track span
    const narrativeSpan = createNarrativeSpan({
      spanId,
      traceId: rootTrace.traceId,
      eventType: NarrativeEventType.BEAT_CREATED,
      storyId: rootTrace.storyId,
      sessionId: rootTrace.sessionId,
      beatId,
      emotionalTone: options.emotionalTone,
      characterIds: options.characterId ? [options.characterId] : [],
    });

    this.spans.set(spanId, narrativeSpan);
    rootTrace.childSpanIds.push(spanId);

    return spanId;
  }

  /**
   * Create span for NCP analysis work
   */
  createAnalysisSpan(
    analysisType: string,
    traceId: string,
    options: {
      beatId?: string;
      parentSpanId?: string;
      inputData?: Record<string, unknown>;
    } = {}
  ): string {
    const rootTrace = this.activeTraces.get(traceId);
    if (!rootTrace) {
      throw new Error(`Unknown trace ID: ${traceId}`);
    }

    const spanId = uuidv4();

    // Map analysis type to glyph
    const glyphMap: Record<string, string> = {
      emotional: "🔍",
      thematic: "🎨",
      character_arc: "🎭",
      three_universe: "🌌",
    };
    const glyph = glyphMap[analysisType] || "🔬";
    let name = `${glyph} ${analysisType
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())} Analysis`;

    if (options.beatId) {
      name = `${name} (${options.beatId})`;
    }

    // Create Langfuse span
    rootTrace.traceObject.span({
      id: spanId,
      name,
      input: options.inputData || {
        analysis_type: analysisType,
        beat_id: options.beatId,
      },
      metadata: {
        analysis_type: analysisType,
        beat_id: options.beatId,
      },
      parentObservationId: options.parentSpanId,
    });

    // Track span
    const narrativeSpan = createNarrativeSpan({
      spanId,
      traceId,
      eventType: NarrativeEventType.BEAT_ANALYZED,
      storyId: rootTrace.storyId,
      sessionId: rootTrace.sessionId,
      beatId: options.beatId,
    });

    this.spans.set(spanId, narrativeSpan);
    rootTrace.childSpanIds.push(spanId);

    return spanId;
  }

  /**
   * Create span for Flowise/Langflow flow execution
   */
  createAgentFlowSpan(
    flowId: string,
    backend: string,
    traceId: string,
    options: {
      intent?: string;
      parentSpanId?: string;
      inputData?: Record<string, unknown>;
    } = {}
  ): string {
    const rootTrace = this.activeTraces.get(traceId);
    if (!rootTrace) {
      throw new Error(`Unknown trace ID: ${traceId}`);
    }

    const spanId = uuidv4();

    let name = `🚀 ${
      backend.charAt(0).toUpperCase() + backend.slice(1)
    } Flow: ${flowId}`;
    if (options.intent) {
      name = `${name} (intent: ${options.intent})`;
    }

    // Create Langfuse span
    rootTrace.traceObject.span({
      id: spanId,
      name,
      input: options.inputData || { flow_id: flowId, backend },
      metadata: {
        flow_id: flowId,
        backend,
        intent: options.intent,
      },
      parentObservationId: options.parentSpanId,
    });

    // Track span
    const narrativeSpan = createNarrativeSpan({
      spanId,
      traceId,
      eventType: NarrativeEventType.FLOW_EXECUTED,
      storyId: rootTrace.storyId,
      sessionId: rootTrace.sessionId,
    });

    this.spans.set(spanId, narrativeSpan);
    rootTrace.childSpanIds.push(spanId);

    // Update correlation
    if (
      rootTrace.correlation &&
      !rootTrace.correlation.correlationPath.includes(backend)
    ) {
      rootTrace.correlation.correlationPath.push(backend);
    }

    return spanId;
  }

  /**
   * Create span for beat enrichment
   */
  createEnrichmentSpan(
    beatId: string,
    enrichmentType: string,
    traceId: string,
    flowsUsed: string[],
    parentSpanId?: string
  ): string {
    const rootTrace = this.activeTraces.get(traceId);
    if (!rootTrace) {
      throw new Error(`Unknown trace ID: ${traceId}`);
    }

    const spanId = uuidv4();
    const name = `✨ Enrichment: ${enrichmentType} (${beatId})`;

    // Create Langfuse span
    rootTrace.traceObject.span({
      id: spanId,
      name,
      input: {
        beat_id: beatId,
        enrichment_type: enrichmentType,
        flows_used: flowsUsed,
      },
      metadata: {
        beat_id: beatId,
        enrichment_type: enrichmentType,
      },
      parentObservationId: parentSpanId,
    });

    // Track span
    const narrativeSpan = createNarrativeSpan({
      spanId,
      traceId,
      eventType: NarrativeEventType.BEAT_ENRICHED,
      storyId: rootTrace.storyId,
      sessionId: rootTrace.sessionId,
      beatId,
    });

    this.spans.set(spanId, narrativeSpan);
    rootTrace.childSpanIds.push(spanId);

    return spanId;
  }

  // ===========================================================================
  // SPAN UPDATES
  // ===========================================================================

  /**
   * Update a span with output data
   */
  updateSpanOutput(spanId: string, outputData: Record<string, unknown>): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.outputData = outputData;
      span.endTime = new Date().toISOString();
    }
  }

  /**
   * Mark a span as errored
   */
  markSpanError(spanId: string, error: string): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.success = false;
      span.error = error;
      span.endTime = new Date().toISOString();
    }
  }

  // ===========================================================================
  // CROSS-SYSTEM CORRELATION
  // ===========================================================================

  /**
   * Inject correlation headers for outgoing HTTP calls
   */
  injectCorrelationHeader(
    headers: Record<string, string>,
    traceId?: string,
    parentSpanId?: string
  ): Record<string, string> {
    if (traceId && this.activeTraces.has(traceId)) {
      const root = this.activeTraces.get(traceId)!;
      headers[NarrativeTraceOrchestrator.TRACE_ID_HEADER] = traceId;
      headers[NarrativeTraceOrchestrator.STORY_ID_HEADER] = root.storyId;
      headers[NarrativeTraceOrchestrator.SESSION_ID_HEADER] = root.sessionId;
      if (parentSpanId) {
        headers[NarrativeTraceOrchestrator.PARENT_SPAN_HEADER] = parentSpanId;
      }
    }
    return headers;
  }

  /**
   * Extract correlation info from incoming request headers
   */
  extractCorrelationHeader(
    headers: Record<string, string>
  ): [
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined
  ] {
    return [
      headers[NarrativeTraceOrchestrator.TRACE_ID_HEADER],
      headers[NarrativeTraceOrchestrator.STORY_ID_HEADER],
      headers[NarrativeTraceOrchestrator.SESSION_ID_HEADER],
      headers[NarrativeTraceOrchestrator.PARENT_SPAN_HEADER],
    ];
  }

  /**
   * Link an external trace to our root trace
   */
  linkExternalTrace(
    traceId: string,
    externalTraceId: string,
    externalSystem: string
  ): void {
    const root = this.activeTraces.get(traceId);
    if (root?.correlation) {
      addChildTrace(root.correlation, externalTraceId, externalSystem);
    }
  }

  // ===========================================================================
  // TRACE FINALIZATION
  // ===========================================================================

  /**
   * Close root trace with final story and quality metrics
   */
  async finalizeStoryTrace(
    traceId: string,
    finalStory?: string,
    metrics?: NarrativeMetrics
  ): Promise<CompletedTrace> {
    const root = this.activeTraces.get(traceId);
    if (!root) {
      throw new Error(`Unknown trace ID: ${traceId}`);
    }

    const endTime = new Date().toISOString();

    // Calculate duration
    const startDt = new Date(root.createdAt);
    const endDt = new Date(endTime);
    const durationMs = endDt.getTime() - startDt.getTime();

    // Gather all spans
    const spans = root.childSpanIds
      .map((sid) => this.spans.get(sid))
      .filter((s): s is NarrativeSpan => s !== undefined);

    // Count beats
    const beatCount = spans.filter(
      (s) => s.eventType === NarrativeEventType.BEAT_CREATED
    ).length;

    // Create completed trace
    const completed: CompletedTrace = {
      traceId,
      storyId: root.storyId,
      sessionId: root.sessionId,
      spans,
      startTime: root.createdAt,
      endTime,
      durationMs,
      metrics,
      storyContent: finalStory,
      beatCount,
      correlation: root.correlation,
    };

    // Update Langfuse trace
    if (root.traceObject) {
      root.traceObject.update({
        output: {
          final_story_preview:
            finalStory && finalStory.length > 500
              ? finalStory.substring(0, 500) + "..."
              : finalStory,
          beat_count: beatCount,
          duration_ms: durationMs,
          metrics: metrics,
        },
      });
    }

    // Clean up
    this.activeTraces.delete(traceId);
    for (const sid of root.childSpanIds) {
      this.spans.delete(sid);
    }

    // Flush to Langfuse
    await this.langfuse.flush();

    return completed;
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /**
   * Flush pending traces to Langfuse
   */
  async flush(): Promise<void> {
    await this.langfuse.flush();
  }
}
