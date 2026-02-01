/**
 * Miadi Integration Adapter
 *
 * Enables narrative-tracing to inject trace correlation headers into HTTP calls
 * to Miadi, so traces flow across system boundaries.
 */

import { v4 as uuidv4 } from "uuid";
import { NarrativeTracingHandler } from "../handler.js";
import { NarrativeEventType } from "../event_types.js";

// Standard correlation headers
export const HEADER_TRACE_ID = "X-Narrative-Trace-Id";
export const HEADER_STORY_ID = "X-Story-Id";
export const HEADER_SESSION_ID = "X-Session-Id";
export const HEADER_PARENT_SPAN_ID = "X-Parent-Span-Id";
export const HEADER_BEAT_ID = "X-Beat-Id";
export const HEADER_EPISODE_ID = "X-Episode-Id";

export const ALL_CORRELATION_HEADERS = [
  HEADER_TRACE_ID,
  HEADER_STORY_ID,
  HEADER_SESSION_ID,
  HEADER_PARENT_SPAN_ID,
  HEADER_BEAT_ID,
  HEADER_EPISODE_ID,
];

/**
 * Extracted correlation context from headers
 */
export interface CorrelationContext {
  traceId?: string;
  storyId?: string;
  sessionId?: string;
  parentSpanId?: string;
  beatId?: string;
  episodeId?: string;
}

/**
 * Check if correlation context is valid
 */
export function isValidCorrelation(ctx: CorrelationContext): boolean {
  return ctx.traceId !== undefined;
}

/**
 * Create CorrelationContext from HTTP headers
 */
export function extractCorrelationFromHeaders(
  headers: Record<string, string>
): CorrelationContext {
  return {
    traceId: headers[HEADER_TRACE_ID],
    storyId: headers[HEADER_STORY_ID],
    sessionId: headers[HEADER_SESSION_ID],
    parentSpanId: headers[HEADER_PARENT_SPAN_ID],
    beatId: headers[HEADER_BEAT_ID],
    episodeId: headers[HEADER_EPISODE_ID],
  };
}

/**
 * Represents a webhook event for tracing
 */
export interface WebhookEvent {
  eventId: string;
  eventType: string;
  source: string;
  payloadPreview?: string;
  timestamp: string;
  repository?: string;
  sender?: string;
}

/**
 * Create a WebhookEvent with defaults
 */
export function createWebhookEvent(
  eventId: string,
  eventType: string,
  source: string,
  options: Partial<WebhookEvent> = {}
): WebhookEvent {
  return {
    eventId,
    eventType,
    source,
    timestamp: new Date().toISOString(),
    ...options,
  };
}

export interface MiadiIntegrationOptions {
  autoGenerateTraceId?: boolean;
}

/**
 * Integration adapter for Miadi webhook consumer and episode generator.
 *
 * Provides HTTP header-based trace correlation so that traces flow
 * seamlessly from GitHub webhooks through LangGraph and into episodes.
 *
 * @example
 * ```typescript
 * const handler = new NarrativeTracingHandler({ storyId: 'story_123' });
 * const miadi = new MiadiIntegration(handler);
 *
 * // When making HTTP call to Miadi
 * const headers = miadi.injectCorrelationHeaders({});
 * // headers now contains X-Narrative-Trace-Id, X-Story-Id, etc.
 *
 * // In Miadi, extract correlation
 * const context = miadi.extractCorrelation(request.headers);
 * if (isValidCorrelation(context)) {
 *   // Continue the trace
 * }
 * ```
 */
export class MiadiIntegration {
  private handler: NarrativeTracingHandler;
  private autoGenerateTraceId: boolean;
  private _webhookCount: number = 0;
  private _episodeCount: number = 0;

  constructor(
    handler: NarrativeTracingHandler,
    options: MiadiIntegrationOptions = {}
  ) {
    this.handler = handler;
    this.autoGenerateTraceId = options.autoGenerateTraceId ?? true;
  }

  // ===========================================================================
  // HEADER INJECTION (Outgoing Requests)
  // ===========================================================================

  /**
   * Inject trace correlation headers for outgoing HTTP requests
   */
  injectCorrelationHeaders(
    headers?: Record<string, string>,
    options: {
      parentSpanId?: string;
      beatId?: string;
      episodeId?: string;
    } = {}
  ): Record<string, string> {
    const result = headers || {};

    // Get or generate trace ID
    let traceId = this.handler.rootTraceId;
    if (!traceId && this.autoGenerateTraceId) {
      traceId = uuidv4();
    }

    // Inject standard headers
    if (traceId) {
      result[HEADER_TRACE_ID] = traceId;
    }

    if (this.handler.storyId && this.handler.storyId !== "unknown") {
      result[HEADER_STORY_ID] = this.handler.storyId;
    }

    if (this.handler.sessionId) {
      result[HEADER_SESSION_ID] = this.handler.sessionId;
    }

    // Inject optional context
    if (options.parentSpanId) {
      result[HEADER_PARENT_SPAN_ID] = options.parentSpanId;
    }

    if (options.beatId) {
      result[HEADER_BEAT_ID] = options.beatId;
    }

    if (options.episodeId) {
      result[HEADER_EPISODE_ID] = options.episodeId;
    }

    return result;
  }

  // ===========================================================================
  // HEADER EXTRACTION (Incoming Requests)
  // ===========================================================================

  /**
   * Extract trace correlation from incoming HTTP request headers
   */
  extractCorrelation(headers: Record<string, string>): CorrelationContext {
    return extractCorrelationFromHeaders(headers);
  }

  /**
   * Continue an existing trace from incoming headers
   */
  continueTraceFromHeaders(headers: Record<string, string>): string | undefined {
    const context = this.extractCorrelation(headers);

    if (isValidCorrelation(context)) {
      if (context.traceId) {
        this.handler.rootTraceId = context.traceId;
      }
      if (context.storyId) {
        this.handler.storyId = context.storyId;
      }
      if (context.sessionId) {
        this.handler.sessionId = context.sessionId;
      }
      return context.traceId;
    }

    return undefined;
  }

  // ===========================================================================
  // WEBHOOK EVENT TRACING
  // ===========================================================================

  /**
   * Log receipt of a webhook event
   */
  logWebhookReceived(
    eventId: string,
    eventType: string,
    source: string,
    options: {
      repository?: string;
      sender?: string;
      payloadPreview?: string;
      parentSpanId?: string;
    } = {}
  ): string {
    this._webhookCount += 1;

    return this.handler.logEvent({
      eventType: NarrativeEventType.BEAT_CREATED, // Using closest event type
      inputData: {
        event_id: eventId,
        event_type: eventType,
        source,
        repository: options.repository,
        sender: options.sender,
        operation: "webhook_received",
      },
      outputData: {
        payload_preview: options.payloadPreview?.substring(0, 200),
      },
      metadata: {
        webhook_count: this._webhookCount,
      },
      parentSpanId: options.parentSpanId,
    });
  }

  /**
   * Log transformation of webhook event to internal format
   */
  logWebhookTransformed(
    eventId: string,
    outputFormat: string,
    options: {
      fieldsExtracted?: string[];
      parentSpanId?: string;
    } = {}
  ): string {
    return this.handler.logEvent({
      eventType: NarrativeEventType.BEAT_ANALYZED,
      inputData: {
        event_id: eventId,
        operation: "webhook_transformed",
      },
      outputData: {
        output_format: outputFormat,
        fields_extracted: options.fieldsExtracted || [],
      },
      parentSpanId: options.parentSpanId,
    });
  }

  /**
   * Log routing decision for a webhook event
   */
  logWebhookRouted(
    eventId: string,
    destination: string,
    routingReason: string,
    parentSpanId?: string
  ): string {
    return this.handler.logRoutingDecision({
      decisionId: eventId,
      backend: destination,
      flow: "webhook_routing",
      score: 1.0,
      method: "webhook",
      parentSpanId,
    });
  }

  // ===========================================================================
  // EPISODE TRACKING
  // ===========================================================================

  /**
   * Log an episode boundary (transition to new episode)
   */
  logEpisodeBoundary(
    episodeId: string,
    beatCount: number,
    options: {
      reason?: string;
      previousEpisodeId?: string;
      parentSpanId?: string;
    } = {}
  ): string {
    this._episodeCount += 1;

    return this.handler.logEpisodeBoundary(
      episodeId,
      beatCount,
      options.reason || "beat_threshold",
      options.parentSpanId
    );
  }

  // ===========================================================================
  // REDIS QUEUE CORRELATION
  // ===========================================================================

  /**
   * Create metadata for Redis queue events with trace correlation
   */
  createRedisEventMetadata(
    eventId: string,
    queueName: string = "narrative_events"
  ): Record<string, unknown> {
    return {
      trace_id: this.handler.rootTraceId,
      story_id: this.handler.storyId,
      session_id: this.handler.sessionId,
      event_id: eventId,
      queue_name: queueName,
      enqueued_at: new Date().toISOString(),
    };
  }

  /**
   * Restore trace context from Redis event metadata
   */
  restoreFromRedisMetadata(
    metadata: Record<string, unknown>
  ): string | undefined {
    if (!metadata) {
      return undefined;
    }

    const traceId = metadata.trace_id as string | undefined;
    if (traceId) {
      this.handler.rootTraceId = traceId;
    }

    const storyId = metadata.story_id as string | undefined;
    if (storyId) {
      this.handler.storyId = storyId;
    }

    const sessionId = metadata.session_id as string | undefined;
    if (sessionId) {
      this.handler.sessionId = sessionId;
    }

    return traceId;
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  get webhookCount(): number {
    return this._webhookCount;
  }

  get episodeCount(): number {
    return this._episodeCount;
  }

  resetCounts(): void {
    this._webhookCount = 0;
    this._episodeCount = 0;
  }
}
