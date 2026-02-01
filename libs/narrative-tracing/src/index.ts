/**
 * Narrative Tracing for LangChain.js
 *
 * A Langfuse-based tracing integration for the Narrative Intelligence Stack.
 * Provides narrative-aware observability across LangGraph, Flowise, Langflow,
 * and the Storytelling system.
 *
 * Key Components:
 * - NarrativeTracingHandler: Langfuse callback handler with narrative events
 * - NarrativeTraceOrchestrator: Cross-system trace correlation
 * - NarrativeTraceFormatter: Human-readable trace formatting
 * - Event Types: Semantic event types for narrative operations
 *
 * @example
 * ```typescript
 * import {
 *   NarrativeTracingHandler,
 *   NarrativeTraceOrchestrator,
 *   NarrativeTraceFormatter,
 *   NarrativeEventType,
 * } from '@langchain/narrative-tracing';
 *
 * // Simple handler usage
 * const handler = new NarrativeTracingHandler({ storyId: 'story_123' });
 *
 * handler.startStoryGeneration();
 * handler.logBeatCreation(beatId, content, sequence, 'rising_action');
 * handler.logThreeUniverseAnalysis({...});
 * handler.logRoutingDecision({...});
 * handler.endStoryGeneration(totalMs);
 *
 * // Orchestrator for cross-system correlation
 * const orchestrator = new NarrativeTraceOrchestrator();
 * const root = orchestrator.createStoryGenerationRoot('story_123', 'session_456');
 *
 * // Inject headers for outgoing calls to Flowise/Langflow
 * const headers = orchestrator.injectCorrelationHeader({}, root.traceId);
 *
 * // Format completed traces
 * const formatter = new NarrativeTraceFormatter();
 * console.log(formatter.formatForDisplay(completedTrace));
 * ```
 */

export const VERSION = "0.1.0";

// Event Types
export {
  NarrativeEventType,
  EVENT_GLYPHS,
  NarrativeSpan,
  TraceCorrelation,
  NarrativeMetrics,
  createNarrativeSpan,
  createTraceCorrelation,
  addChildTrace,
  serializeTraceCorrelation,
  createNarrativeMetrics,
  calculateOverallQuality,
} from "./event_types.js";

// Handler
export {
  NarrativeTracingHandler,
  NarrativeTracingHandlerOptions,
} from "./handler.js";

// Orchestrator
export {
  NarrativeTraceOrchestrator,
  NarrativeTraceOrchestratorOptions,
  RootTrace,
  CompletedTrace,
} from "./orchestrator.js";

// Formatter
export {
  NarrativeTraceFormatter,
  FormattedSpan,
  StoryArcVisualization,
  formattedSpanToString,
  arcToAsciiChart,
} from "./formatter.js";
