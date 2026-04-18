/**
 * Inquiry Router
 *
 * Routes structured inquiries to their designated channels:
 * - QMD Local: Semantic search against workspace knowledge (lex/vec/hyde)
 * - Deep Search Academic: Research-grade queries for scholarly sources
 * - Workspace Scan: File system exploration and dependency discovery
 *
 * The router applies classification logic combining keyword analysis,
 * directional affinity, and content structure to produce RoutingDecisions
 * that downstream engines (LangGraph) consume.
 *
 * This is the SOUTH (Action) function of inquiry routing —
 * discerning where each question finds its best answer.
 *
 * Canonical direction mapping: East=Vision, South=Action, West=Synthesis, North=Structure
 * (mcp-pde variant: WEST=Validation, NORTH=Action — see inquiry-router.md for canonical source)
 */

import { v4 as uuid } from "uuid";

import {
  InquirySource,
  InquiryStatus,
  type Inquiry,
  type InquiryBatch,
  type InquiryRoutingConfig,
  type RoutingDecision,
  type RoutedInquiryBatch,
} from "./types.js";

// =============================================================================
// Constants
// =============================================================================

/** Classification keywords by source channel */
const CLASSIFICATION_KEYWORDS: Record<InquirySource, string[]> = {
  [InquirySource.QMD_LOCAL]: [
    "existing", "current", "local", "codebase", "workspace", "project",
    "module", "pattern", "convention", "config", "setting", "internal",
    "our", "this", "here", "already", "implemented", "defined",
  ],
  [InquirySource.DEEP_SEARCH_ACADEMIC]: [
    "research", "academic", "theory", "framework", "literature", "study",
    "paper", "methodology", "epistemology", "ontology", "paradigm",
    "scholarly", "published", "citation", "peer-reviewed", "indigenous",
    "relational", "decolonial", "Wilson", "ceremony", "protocol",
    "best practice", "state of the art",
  ],
  [InquirySource.WORKSPACE_SCAN]: [
    "find", "locate", "discover", "scan", "search files", "directory",
    "path", "structure", "import", "dependency", "package", "tree",
    "glob", "grep", "where is", "which file",
  ],
};

/** Direction affinity — which source each direction gravitates toward */
const DIRECTION_AFFINITY: Record<string, InquirySource> = {
  east: InquirySource.QMD_LOCAL,
  south: InquirySource.DEEP_SEARCH_ACADEMIC,
  west: InquirySource.QMD_LOCAL,
  north: InquirySource.WORKSPACE_SCAN,
};

/** Confidence boost when direction affinity matches keyword classification */
const AFFINITY_BOOST = 0.15;

// =============================================================================
// InquiryRouter
// =============================================================================

/**
 * Routes inquiries to appropriate knowledge channels based on
 * content analysis, keyword classification, and directional affinity.
 *
 * @example
 * ```typescript
 * import { InquiryRouter } from "ava-langchain-inquiry-routing";
 *
 * const router = new InquiryRouter();
 *
 * // Route a single inquiry
 * const decision = router.classify(inquiry);
 *
 * // Route an entire batch
 * const routedBatch = router.routeAll(batch);
 * ```
 */
export class InquiryRouter {
  private readonly config: InquiryRoutingConfig;
  private readonly confidenceThreshold: number;

  constructor(config?: InquiryRoutingConfig) {
    this.config = config ?? {};
    this.confidenceThreshold = config?.confidenceThreshold ?? 0.4;
  }

  /**
   * Classify a single inquiry and produce a routing decision.
   */
  classify(inquiry: Inquiry): RoutingDecision {
    const lowerQuery = inquiry.query.toLowerCase();
    const scores: Record<InquirySource, { score: number; keywords: string[] }> = {
      [InquirySource.QMD_LOCAL]: { score: 0, keywords: [] },
      [InquirySource.DEEP_SEARCH_ACADEMIC]: { score: 0, keywords: [] },
      [InquirySource.WORKSPACE_SCAN]: { score: 0, keywords: [] },
    };

    // Score against classification keywords
    for (const [source, keywords] of Object.entries(CLASSIFICATION_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerQuery.includes(keyword.toLowerCase())) {
          scores[source as InquirySource].score += 1;
          scores[source as InquirySource].keywords.push(keyword);
        }
      }
    }

    // Score against user-configured keywords
    if (this.config.qmdKeywords) {
      for (const kw of this.config.qmdKeywords) {
        if (lowerQuery.includes(kw.toLowerCase())) {
          scores[InquirySource.QMD_LOCAL].score += 1;
          scores[InquirySource.QMD_LOCAL].keywords.push(kw);
        }
      }
    }
    if (this.config.deepSearchKeywords) {
      for (const kw of this.config.deepSearchKeywords) {
        if (lowerQuery.includes(kw.toLowerCase())) {
          scores[InquirySource.DEEP_SEARCH_ACADEMIC].score += 1;
          scores[InquirySource.DEEP_SEARCH_ACADEMIC].keywords.push(kw);
        }
      }
    }
    if (this.config.workspaceScanKeywords) {
      for (const kw of this.config.workspaceScanKeywords) {
        if (lowerQuery.includes(kw.toLowerCase())) {
          scores[InquirySource.WORKSPACE_SCAN].score += 1;
          scores[InquirySource.WORKSPACE_SCAN].keywords.push(kw);
        }
      }
    }

    // Apply direction affinity boost
    const affinitySource = DIRECTION_AFFINITY[inquiry.direction];
    if (affinitySource) {
      scores[affinitySource].score += AFFINITY_BOOST;
    }

    // Determine winning source
    const entries = Object.entries(scores) as [InquirySource, { score: number; keywords: string[] }][];
    entries.sort((a, b) => b[1].score - a[1].score);

    const [topSource, topData] = entries[0];
    const totalKeywordHits = entries.reduce((sum, [, d]) => sum + d.keywords.length, 0);
    const confidence = totalKeywordHits > 0
      ? Math.min(1.0, topData.score / Math.max(totalKeywordHits, 1))
      : 0.5; // Neutral confidence when no keywords match

    const effectiveSource = topData.score > 0
      ? topSource
      : (this.config.defaultSource ?? affinitySource ?? InquirySource.QMD_LOCAL);

    return {
      inquiry_id: inquiry.id,
      source: effectiveSource,
      confidence,
      reasoning: this.buildReasoning(effectiveSource, topData.keywords, inquiry.direction),
      matched_keywords: topData.keywords,
    };
  }

  /**
   * Format an inquiry for QMD semantic search.
   */
  routeToQmd(inquiry: Inquiry): Inquiry {
    return {
      ...inquiry,
      source: InquirySource.QMD_LOCAL,
      status: InquiryStatus.ROUTED,
    };
  }

  /**
   * Format an inquiry for academic deep-search.
   */
  routeToDeepSearch(inquiry: Inquiry): Inquiry {
    return {
      ...inquiry,
      source: InquirySource.DEEP_SEARCH_ACADEMIC,
      status: InquiryStatus.ROUTED,
    };
  }

  /**
   * Format an inquiry for workspace file scanning.
   */
  routeToWorkspaceScan(inquiry: Inquiry): Inquiry {
    return {
      ...inquiry,
      source: InquirySource.WORKSPACE_SCAN,
      status: InquiryStatus.ROUTED,
    };
  }

  /**
   * Route an entire batch of inquiries, applying classification to each
   * and returning a RoutedInquiryBatch with all decisions attached.
   */
  routeAll(batch: InquiryBatch): RoutedInquiryBatch {
    const decisions: RoutingDecision[] = [];
    const allInquiries = [
      ...batch.east,
      ...batch.south,
      ...batch.west,
      ...batch.north,
    ];

    const routedEast: Inquiry[] = [];
    const routedSouth: Inquiry[] = [];
    const routedWest: Inquiry[] = [];
    const routedNorth: Inquiry[] = [];

    for (const inquiry of allInquiries) {
      const decision = this.classify(inquiry);
      decisions.push(decision);

      const routed = this.applyDecision(inquiry, decision);

      switch (routed.direction) {
        case "east": routedEast.push(routed); break;
        case "south": routedSouth.push(routed); break;
        case "west": routedWest.push(routed); break;
        case "north": routedNorth.push(routed); break;
      }
    }

    return {
      ...batch,
      east: routedEast,
      south: routedSouth,
      west: routedWest,
      north: routedNorth,
      decisions,
      routing_timestamp: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private applyDecision(inquiry: Inquiry, decision: RoutingDecision): Inquiry {
    const routeMap: Record<InquirySource, (i: Inquiry) => Inquiry> = {
      [InquirySource.QMD_LOCAL]: (i) => this.routeToQmd(i),
      [InquirySource.DEEP_SEARCH_ACADEMIC]: (i) => this.routeToDeepSearch(i),
      [InquirySource.WORKSPACE_SCAN]: (i) => this.routeToWorkspaceScan(i),
    };

    return routeMap[decision.source](inquiry);
  }

  private buildReasoning(
    source: InquirySource,
    keywords: string[],
    direction: string,
  ): string {
    if (keywords.length === 0) {
      return `Routed to ${source} based on ${direction} direction affinity (no keyword matches).`;
    }

    return `Routed to ${source}: matched keywords [${keywords.join(", ")}] with ${direction} direction affinity.`;
  }
}
