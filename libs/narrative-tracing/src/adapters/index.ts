/**
 * Narrative Tracing Adapters
 *
 * Adapters for integrating narrative-tracing with various systems:
 * - LangGraph Bridge: Three-universe processing to tracing
 * - Miadi Integration: HTTP header-based correlation
 * - Storytelling Hooks: Beat lifecycle tracing
 */

export {
  LangGraphBridge,
  UniverseResult,
  ThreeUniverseAnalysisLike,
  AnalysisContext,
  LangGraphBridgeOptions,
} from "./langgraph_bridge.js";

export {
  MiadiIntegration,
  CorrelationContext,
  WebhookEvent,
  MiadiIntegrationOptions,
  HEADER_TRACE_ID,
  HEADER_STORY_ID,
  HEADER_SESSION_ID,
  HEADER_PARENT_SPAN_ID,
  HEADER_BEAT_ID,
  HEADER_EPISODE_ID,
  ALL_CORRELATION_HEADERS,
  isValidCorrelation,
  extractCorrelationFromHeaders,
  createWebhookEvent,
} from "./miadi_integration.js";

export {
  StorytellingHooks,
  BeatTracer,
  BeatInfo,
  CharacterUpdate,
  ThemeUpdate,
  StorytellingHooksOptions,
  createBeatInfo,
} from "./storytelling_hooks.js";
