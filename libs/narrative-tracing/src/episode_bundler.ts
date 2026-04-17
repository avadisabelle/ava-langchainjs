/**
 * Episode Bundler
 *
 * Takes session artifacts (spans, traces, metadata) and produces
 * structured EpisodeBundles with kinship-aware metadata for
 * cross-session continuity.
 *
 * An episode is a bounded narrative unit — a chunk of work that
 * has a beginning, a middle, and an end, with relational context
 * (who was involved, what roles they held, what consent was given).
 *
 * No LLM dependency — uses keyword extraction and span analysis
 * for summarization and tagging.
 */

import { v4 as uuid } from "uuid";
import type { NarrativeSpan, TraceCorrelation } from "./event_types.js";
import { NarrativeEventType, EVENT_GLYPHS } from "./event_types.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Kinship memory for an episode — tracks who participated,
 * their roles, and relational links.
 */
export interface KinshipMemoryRecord {
  /** The episode this kinship record belongs to */
  episodeId: string;
  /** Names/identifiers of speakers or participants */
  speakers: string[];
  /** Roles held by participants (e.g., "facilitator", "developer") */
  roles: string[];
  /** Relational connections described in the episode */
  relationships: string[];
  /** Consent status for data use */
  consent: "granted" | "pending" | "revoked";
  /** Link to related PDE decomposition */
  pdeLink?: string;
  /** Link to session record */
  sessionLink?: string;
  /** Link to STC (Structural Tension Chain) record */
  stcLink?: string;
}

/**
 * A bundled episode — a coherent unit of narrative work
 * with full relational context.
 */
export interface EpisodeBundle {
  /** Unique identifier */
  id: string;
  /** Human-readable title */
  title: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** Session that produced this episode */
  sessionId: string;
  /** The narrative spans comprising this episode */
  spans: NarrativeSpan[];
  /** Cross-system trace correlation */
  traceCorrelation?: TraceCorrelation;
  /** Kinship and relational metadata */
  kinship: KinshipMemoryRecord;
  /** Auto-generated summary */
  summary: string;
  /** Tags extracted from span content */
  tags: string[];
  /** Parent episode ID for fork/continuation chains */
  parentEpisodeId?: string;
}

/**
 * Configuration options for EpisodeBundler.
 */
export interface EpisodeBundlerOptions {
  /** Maximum spans per bundle (default 50) */
  maxSpansPerBundle?: number;
  /** Whether to auto-generate summaries (default true) */
  autoSummarize?: boolean;
}

// =============================================================================
// Keyword sets for summarization
// =============================================================================

/** High-signal words for summary extraction */
const SUMMARY_SIGNAL_WORDS: string[] = [
  "created", "built", "deployed", "resolved", "discovered", "designed",
  "implemented", "fixed", "refactored", "analyzed", "generated",
  "completed", "started", "ceremony", "vision", "decision",
];

/** Tag extraction patterns — map event types to semantic tags */
const EVENT_TYPE_TAGS: Partial<Record<NarrativeEventType, string>> = {
  [NarrativeEventType.BEAT_CREATED]: "beat",
  [NarrativeEventType.STORY_GENERATION_START]: "story-generation",
  [NarrativeEventType.STORY_GENERATION_END]: "story-complete",
  [NarrativeEventType.THREE_UNIVERSE_ANALYSIS]: "three-universes",
  [NarrativeEventType.CHARACTER_ARC_UPDATED]: "character-arc",
  [NarrativeEventType.THEME_INTRODUCED]: "theme",
  [NarrativeEventType.ROUTING_DECISION]: "routing",
  [NarrativeEventType.GAP_IDENTIFIED]: "gap-analysis",
  [NarrativeEventType.NARRATIVE_CHECKPOINT]: "checkpoint",
  [NarrativeEventType.EPISODE_BOUNDARY]: "episode-boundary",
  [NarrativeEventType.PROMPT_DECOMPOSITION_STARTED]: "pde",
  [NarrativeEventType.MEDICINE_WHEEL_ASSESSMENT]: "medicine-wheel",
  [NarrativeEventType.WHEEL_ASSESSMENT_PERFORMED]: "wheel-assessment",
  [NarrativeEventType.VALUE_GATE_VERDICT_ISSUED]: "value-gate",
  [NarrativeEventType.HUMAN_ENGAGEMENT_REQUESTED]: "human-review",
  [NarrativeEventType.LIMINAL_INPUT_CAPTURED]: "liminal",
};

// =============================================================================
// EpisodeBundler
// =============================================================================

/**
 * EpisodeBundler takes session artifacts and produces structured
 * EpisodeBundles with kinship-aware metadata.
 *
 * @example
 * ```typescript
 * const bundler = new EpisodeBundler();
 *
 * const episode = bundler.bundle("session_123", spans, {
 *   speakers: ["Mia", "Miette"],
 *   roles: ["architect", "narrator"],
 *   consent: "granted",
 * });
 *
 * console.log(episode.summary);
 * console.log(episode.tags);
 * ```
 */
export class EpisodeBundler {
  private readonly maxSpansPerBundle: number;
  private readonly autoSummarize: boolean;

  constructor(options?: EpisodeBundlerOptions) {
    this.maxSpansPerBundle = options?.maxSpansPerBundle ?? 50;
    this.autoSummarize = options?.autoSummarize ?? true;
  }

  /**
   * Create a new episode bundle from spans.
   * Trims to maxSpansPerBundle, generates summary and tags.
   */
  bundle(
    sessionId: string,
    spans: NarrativeSpan[],
    metadata?: Partial<KinshipMemoryRecord>
  ): EpisodeBundle {
    const id = uuid();

    // Trim spans to max
    const trimmedSpans =
      spans.length > this.maxSpansPerBundle
        ? spans.slice(0, this.maxSpansPerBundle)
        : [...spans];

    const summary = this.autoSummarize
      ? this.summarize(trimmedSpans)
      : "";

    const tags = this.extractTags(trimmedSpans);
    const title = this.generateTitle(trimmedSpans);

    // Build trace correlation from spans if they share a traceId
    let traceCorrelation: TraceCorrelation | undefined;
    if (trimmedSpans.length > 0) {
      const rootTraceId = trimmedSpans[0].traceId;
      const storyId = trimmedSpans[0].storyId;
      const traceIds = new Set(trimmedSpans.map((s) => s.traceId));

      if (traceIds.size > 1) {
        const childTraceIds = new Map<string, string>();
        for (const tid of traceIds) {
          if (tid !== rootTraceId) {
            childTraceIds.set(tid, "langchain");
          }
        }
        traceCorrelation = {
          rootTraceId,
          storyId,
          sessionId,
          correlationPath: ["langchain"],
          childTraceIds,
        };
      }
    }

    const kinship: KinshipMemoryRecord = {
      episodeId: id,
      speakers: metadata?.speakers ?? [],
      roles: metadata?.roles ?? [],
      relationships: metadata?.relationships ?? [],
      consent: metadata?.consent ?? "pending",
      pdeLink: metadata?.pdeLink,
      sessionLink: metadata?.sessionLink,
      stcLink: metadata?.stcLink,
    };

    return {
      id,
      title,
      createdAt: new Date().toISOString(),
      sessionId,
      spans: trimmedSpans,
      traceCorrelation,
      kinship,
      summary,
      tags,
    };
  }

  /**
   * Generate a summary from spans using keyword extraction.
   * No LLM — builds a summary from event types and significant data.
   */
  summarize(spans: NarrativeSpan[]): string {
    if (spans.length === 0) return "Empty episode — no spans recorded.";

    const parts: string[] = [];

    // Count event types
    const eventCounts = new Map<NarrativeEventType, number>();
    for (const span of spans) {
      eventCounts.set(
        span.eventType,
        (eventCounts.get(span.eventType) ?? 0) + 1
      );
    }

    // Describe dominant events
    const sorted = [...eventCounts.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 3);
    for (const [eventType, count] of top) {
      const glyph = EVENT_GLYPHS[eventType] ?? "•";
      const name = eventType.split(".").pop()?.replace(/_/g, " ") ?? eventType;
      parts.push(`${glyph} ${name} (×${count})`);
    }

    // Extract signal words from span data
    const signalHits = new Set<string>();
    for (const span of spans) {
      const data = JSON.stringify(span.inputData ?? {}) +
        " " +
        JSON.stringify(span.outputData ?? {});
      const lower = data.toLowerCase();
      for (const word of SUMMARY_SIGNAL_WORDS) {
        if (lower.includes(word)) {
          signalHits.add(word);
        }
      }
    }

    if (signalHits.size > 0) {
      parts.push(`Key activities: ${[...signalHits].join(", ")}`);
    }

    // Time range
    const startTimes = spans
      .map((s) => s.startTime)
      .filter(Boolean)
      .sort();
    if (startTimes.length > 1) {
      parts.push(
        `Timespan: ${startTimes[0]} → ${startTimes[startTimes.length - 1]}`
      );
    }

    // Success rate
    const successCount = spans.filter((s) => s.success).length;
    const successRate = Math.round((successCount / spans.length) * 100);
    parts.push(`${spans.length} spans, ${successRate}% success`);

    return parts.join(". ");
  }

  /**
   * Extract tags from spans based on event types and glyphs.
   * Returns deduplicated, sorted tag list.
   */
  extractTags(spans: NarrativeSpan[]): string[] {
    const tags = new Set<string>();

    for (const span of spans) {
      // Map event type to tag
      const tag = EVENT_TYPE_TAGS[span.eventType];
      if (tag) {
        tags.add(tag);
      }

      // Add emotional tone if present
      if (span.emotionalTone) {
        tags.add(`tone:${span.emotionalTone}`);
      }

      // Add lead universe if present
      if (span.leadUniverse) {
        tags.add(`universe:${span.leadUniverse}`);
      }

      // Add error tag if failed
      if (!span.success) {
        tags.add("error");
      }
    }

    return [...tags].sort();
  }

  /**
   * Link an episode to a parent (fork/continuation).
   * Returns a new EpisodeBundle with the parentEpisodeId set.
   */
  linkToParent(bundle: EpisodeBundle, parentId: string): EpisodeBundle {
    return {
      ...bundle,
      parentEpisodeId: parentId,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Generate a title from the dominant event types in the spans.
   */
  private generateTitle(spans: NarrativeSpan[]): string {
    if (spans.length === 0) return "Empty Episode";

    // Find the most common event type
    const eventCounts = new Map<NarrativeEventType, number>();
    for (const span of spans) {
      eventCounts.set(
        span.eventType,
        (eventCounts.get(span.eventType) ?? 0) + 1
      );
    }

    const sorted = [...eventCounts.entries()].sort((a, b) => b[1] - a[1]);
    const leadEvent = sorted[0][0];

    // Derive a title from the lead event
    const eventLabel = leadEvent
      .split(".")
      .slice(1)
      .join(" ")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const storyId = spans[0].storyId;
    return storyId
      ? `${eventLabel} — ${storyId}`
      : `${eventLabel} Episode`;
  }
}
