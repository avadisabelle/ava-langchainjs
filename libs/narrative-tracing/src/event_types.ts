/**
 * Narrative Event Types
 *
 * Semantic event types for narrative-aware tracing in the Narrative Intelligence Stack.
 * These types enable human-readable traces that tell the story of how a story was made.
 */

/**
 * Types of narrative events that can be traced
 */
export enum NarrativeEventType {
  // Beat lifecycle events
  BEAT_CREATED = "narrative.beat.created",
  BEAT_ANALYZED = "narrative.beat.analyzed",
  BEAT_ENRICHED = "narrative.beat.enriched",

  // Story lifecycle events
  STORY_GENERATION_START = "narrative.story.generation_start",
  STORY_GENERATION_END = "narrative.story.generation_end",
  STORY_QUALITY_METRICS = "narrative.story.quality_metrics",

  // Three-universe analysis
  THREE_UNIVERSE_ANALYSIS = "narrative.three_universe.analysis",
  UNIVERSE_PERSPECTIVE_SHIFT = "narrative.three_universe.perspective_shift",

  // Character arc events
  CHARACTER_ARC_UPDATED = "narrative.character.arc_updated",
  CHARACTER_RELATIONSHIP_CHANGED = "narrative.character.relationship_changed",

  // Theme events
  THEME_INTRODUCED = "narrative.theme.introduced",
  THEME_REINFORCED = "narrative.theme.reinforced",
  THEME_RESOLVED = "narrative.theme.resolved",

  // Routing events
  ROUTING_DECISION = "narrative.routing.decision",
  FLOW_EXECUTED = "narrative.routing.flow_executed",

  // Gap analysis events
  GAP_IDENTIFIED = "narrative.gap.identified",
  GAP_REMEDIATED = "narrative.gap.remediated",

  // Checkpoint events
  NARRATIVE_CHECKPOINT = "narrative.checkpoint",
  EPISODE_BOUNDARY = "narrative.episode.boundary",
}

/**
 * Glyphs for human-readable event display
 */
export const EVENT_GLYPHS: Record<NarrativeEventType, string> = {
  [NarrativeEventType.BEAT_CREATED]: "📝",
  [NarrativeEventType.BEAT_ANALYZED]: "🔍",
  [NarrativeEventType.BEAT_ENRICHED]: "✨",
  [NarrativeEventType.STORY_GENERATION_START]: "📖",
  [NarrativeEventType.STORY_GENERATION_END]: "📕",
  [NarrativeEventType.STORY_QUALITY_METRICS]: "📊",
  [NarrativeEventType.THREE_UNIVERSE_ANALYSIS]: "🌌",
  [NarrativeEventType.UNIVERSE_PERSPECTIVE_SHIFT]: "🔄",
  [NarrativeEventType.CHARACTER_ARC_UPDATED]: "🎭",
  [NarrativeEventType.CHARACTER_RELATIONSHIP_CHANGED]: "💫",
  [NarrativeEventType.THEME_INTRODUCED]: "🎨",
  [NarrativeEventType.THEME_REINFORCED]: "🔗",
  [NarrativeEventType.THEME_RESOLVED]: "🎯",
  [NarrativeEventType.ROUTING_DECISION]: "🚀",
  [NarrativeEventType.FLOW_EXECUTED]: "⚡",
  [NarrativeEventType.GAP_IDENTIFIED]: "🕳️",
  [NarrativeEventType.GAP_REMEDIATED]: "🔧",
  [NarrativeEventType.NARRATIVE_CHECKPOINT]: "💾",
  [NarrativeEventType.EPISODE_BOUNDARY]: "📍",
};

/**
 * A single narrative span in a trace
 */
export interface NarrativeSpan {
  spanId: string;
  traceId: string;
  eventType: NarrativeEventType;
  storyId: string;
  sessionId: string;

  // Narrative context
  beatId?: string;
  characterIds: string[];
  emotionalTone?: string;
  leadUniverse?: string;

  // Timing
  startTime: string;
  endTime?: string;
  durationMs?: number;

  // Data
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;

  // Status
  success: boolean;
  error?: string;
}

/**
 * Create a NarrativeSpan with defaults
 */
export function createNarrativeSpan(
  partial: Partial<NarrativeSpan> & {
    spanId: string;
    traceId: string;
    eventType: NarrativeEventType;
    storyId: string;
    sessionId: string;
  }
): NarrativeSpan {
  return {
    characterIds: [],
    startTime: new Date().toISOString(),
    success: true,
    ...partial,
  };
}

/**
 * Trace correlation for cross-system tracking
 */
export interface TraceCorrelation {
  rootTraceId: string;
  storyId: string;
  sessionId: string;
  correlationPath: string[];
  childTraceIds: Map<string, string>;
}

/**
 * Create a TraceCorrelation with defaults
 */
export function createTraceCorrelation(
  rootTraceId: string,
  storyId: string,
  sessionId: string
): TraceCorrelation {
  return {
    rootTraceId,
    storyId,
    sessionId,
    correlationPath: ["langchain"],
    childTraceIds: new Map(),
  };
}

/**
 * Add child trace to correlation
 */
export function addChildTrace(
  correlation: TraceCorrelation,
  childTraceId: string,
  system: string
): void {
  correlation.childTraceIds.set(childTraceId, system);
  if (!correlation.correlationPath.includes(system)) {
    correlation.correlationPath.push(system);
  }
}

/**
 * Serialize TraceCorrelation to plain object
 */
export function serializeTraceCorrelation(
  correlation: TraceCorrelation
): Record<string, unknown> {
  return {
    rootTraceId: correlation.rootTraceId,
    storyId: correlation.storyId,
    sessionId: correlation.sessionId,
    correlationPath: correlation.correlationPath,
    childTraceIds: Object.fromEntries(correlation.childTraceIds),
  };
}

/**
 * Narrative quality metrics
 */
export interface NarrativeMetrics {
  // Counts
  beatsGenerated: number;
  enrichmentsApplied: number;
  gapsRemediated: number;
  routingDecisions: number;

  // Quality scores (0-1)
  coherenceScore: number;
  emotionalArcStrength: number;
  themeClarity: number;
  characterArcCompletion: Record<string, number>;

  // Three-universe alignment (0-1)
  engineerAlignment: number;
  ceremonyAlignment: number;
  storyEngineAlignment: number;
  crossUniverseCoherence: number;

  // Timing
  totalGenerationTimeMs: number;
  averageBeatTimeMs: number;
}

/**
 * Create empty NarrativeMetrics
 */
export function createNarrativeMetrics(): NarrativeMetrics {
  return {
    beatsGenerated: 0,
    enrichmentsApplied: 0,
    gapsRemediated: 0,
    routingDecisions: 0,
    coherenceScore: 0.5,
    emotionalArcStrength: 0.5,
    themeClarity: 0.5,
    characterArcCompletion: {},
    engineerAlignment: 0.5,
    ceremonyAlignment: 0.5,
    storyEngineAlignment: 0.5,
    crossUniverseCoherence: 0.5,
    totalGenerationTimeMs: 0,
    averageBeatTimeMs: 0,
  };
}

/**
 * Calculate overall quality score from metrics
 */
export function calculateOverallQuality(metrics: NarrativeMetrics): number {
  const weights = {
    coherence: 0.25,
    emotionalArc: 0.2,
    themeClarity: 0.15,
    crossUniverse: 0.2,
    characterArc: 0.2,
  };

  // Calculate average character arc completion
  const arcValues = Object.values(metrics.characterArcCompletion);
  const avgCharacterArc =
    arcValues.length > 0
      ? arcValues.reduce((a, b) => a + b, 0) / arcValues.length
      : 0.5;

  return (
    metrics.coherenceScore * weights.coherence +
    metrics.emotionalArcStrength * weights.emotionalArc +
    metrics.themeClarity * weights.themeClarity +
    metrics.crossUniverseCoherence * weights.crossUniverse +
    avgCharacterArc * weights.characterArc
  );
}
