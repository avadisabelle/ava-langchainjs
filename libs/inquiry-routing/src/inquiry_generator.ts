/**
 * Inquiry Generator
 *
 * Takes a DecompositionResult from prompt-decomposition and generates
 * structured Inquiries — one for each directional insight, ambiguity,
 * and verifiable assumption. Each inquiry is pre-classified to a
 * source channel (QMD local, deep-search academic, workspace scan)
 * based on content analysis and directional affinity.
 *
 * This is the EAST (Vision) function of inquiry routing —
 * seeing what questions want to be asked.
 *
 * Canonical direction mapping: East=Vision, South=Action, West=Synthesis, North=Structure
 * (mcp-pde variant: WEST=Validation, NORTH=Action — see inquiry-router.md for canonical source)
 */

import { v4 as uuid } from "uuid";
import type {
  DecompositionResult,
  Direction,
  AmbiguityFlag,
} from "ava-langchain-prompt-decomposition";

import {
  InquirySource,
  InquiryStatus,
  type Inquiry,
  type InquiryBatch,
  type InquiryGeneratorOptions,
  type InquiryRoutingConfig,
} from "./types.js";

// =============================================================================
// Constants
// =============================================================================

/** Default source routing by direction */
const DIRECTION_DEFAULT_SOURCE: Record<string, InquirySource> = {
  east: InquirySource.QMD_LOCAL,
  south: InquirySource.DEEP_SEARCH_ACADEMIC,
  west: InquirySource.QMD_LOCAL,
  north: InquirySource.WORKSPACE_SCAN,
};

/** Keywords that signal specific source channels */
const SOURCE_KEYWORDS: Record<InquirySource, string[]> = {
  [InquirySource.QMD_LOCAL]: [
    "existing", "local", "codebase", "workspace", "file", "module",
    "pattern", "convention", "internal", "current", "here", "our",
    "project", "repository", "config", "setting",
  ],
  [InquirySource.DEEP_SEARCH_ACADEMIC]: [
    "research", "academic", "theory", "framework", "literature",
    "study", "paper", "methodology", "epistemology", "ontology",
    "paradigm", "scholarly", "peer-reviewed", "citation", "published",
    "indigenous", "relational", "decolonial",
  ],
  [InquirySource.WORKSPACE_SCAN]: [
    "scan", "find", "locate", "search", "discover", "explore",
    "directory", "path", "structure", "dependency", "import",
    "file", "folder", "tree", "glob",
  ],
};

/** Relational context templates by direction */
const DIRECTION_RELATIONAL_CONTEXT: Record<string, string> = {
  east: "This inquiry seeks clarity of vision — understanding what is being asked and why it matters relationally.",
  south: "This inquiry seeks learning and growth — understanding what knowledge must be gathered to proceed with care.",
  west: "This inquiry seeks reflection and validation — ensuring what has been created honors its relational obligations.",
  north: "This inquiry seeks actionable knowledge — understanding what must execute and how it serves the whole.",
};

/** Accountability templates by direction */
const DIRECTION_ACCOUNTABILITY: Record<string, string> = {
  east: "Accountable to the original intent and the relations it serves.",
  south: "Accountable to truthful learning and the sources from which knowledge flows.",
  west: "Accountable to honest reflection and the integrity of what has been built.",
  north: "Accountable to responsible action and the communities affected by execution.",
};

// =============================================================================
// InquiryGenerator
// =============================================================================

/**
 * Generates structured inquiries from PDE decomposition output.
 *
 * @example
 * ```typescript
 * import { InquiryGenerator } from "ava-langchain-inquiry-routing";
 * import { decompose } from "ava-langchain-prompt-decomposition";
 *
 * const result = await decompose("Build a knowledge graph...");
 * const generator = new InquiryGenerator();
 * const batch = generator.generate(result.decomposition);
 *
 * console.log(`Generated ${batch.total} inquiries`);
 * ```
 */
export class InquiryGenerator {
  private readonly includeAmbiguities: boolean;
  private readonly includeAssumptions: boolean;
  private readonly minConfidence: number;
  private readonly routingConfig: InquiryRoutingConfig;

  constructor(options?: InquiryGeneratorOptions) {
    this.includeAmbiguities = options?.includeAmbiguities ?? true;
    this.includeAssumptions = options?.includeAssumptions ?? true;
    this.minConfidence = options?.minConfidence ?? 0.3;
    this.routingConfig = options?.routing ?? {};
  }

  /**
   * Generate an InquiryBatch from a PDE DecompositionResult.
   *
   * Extracts inquiries from three sources:
   * 1. Directional insights (Four Directions items)
   * 2. Ambiguity flags (each ambiguity becomes a verification inquiry)
   * 3. Context assumptions (each assumption can be verified)
   *
   * @param decomposition - The PDE decomposition result
   * @returns A batch of inquiries grouped by direction
   */
  generate(decomposition: DecompositionResult): InquiryBatch {
    const timestamp = new Date().toISOString();
    const batchId = uuid();

    const east: Inquiry[] = [];
    const south: Inquiry[] = [];
    const west: Inquiry[] = [];
    const north: Inquiry[] = [];

    const directionBuckets: Record<string, Inquiry[]> = { east, south, west, north };

    // 1. Extract inquiries from directional insights
    for (const [direction, insights] of Object.entries(decomposition.directions)) {
      const dir = direction as "east" | "south" | "west" | "north";
      for (const insight of insights) {
        if (insight.confidence < this.minConfidence) continue;

        const inquiry = this.createInquiry({
          direction: dir,
          query: this.insightToQuery(insight.text, dir),
          confidence: insight.confidence,
          pdeId: decomposition.id,
          timestamp,
        });
        directionBuckets[dir].push(inquiry);
      }
    }

    // 2. Extract inquiries from ambiguities
    if (this.includeAmbiguities && decomposition.ambiguities?.length) {
      for (const ambiguity of decomposition.ambiguities) {
        const inquiry = this.createAmbiguityInquiry(ambiguity, decomposition, timestamp);
        // Ambiguities route to WEST (reflection/validation)
        west.push(inquiry);
      }
    }

    // 3. Extract inquiries from context assumptions
    if (this.includeAssumptions && decomposition.context?.assumptions?.length) {
      for (let i = 0; i < decomposition.context.assumptions.length; i++) {
        const assumption = decomposition.context.assumptions[i];
        const inquiry = this.createAssumptionInquiry(assumption, decomposition, timestamp, i);
        // Assumptions route to SOUTH (learning/verification)
        south.push(inquiry);
      }
    }

    return {
      id: batchId,
      timestamp,
      pde_id: decomposition.id,
      east,
      south,
      west,
      north,
      total: east.length + south.length + west.length + north.length,
    };
  }

  /**
   * Get all inquiries from a batch as a flat array.
   */
  flatten(batch: InquiryBatch): Inquiry[] {
    return [...batch.east, ...batch.south, ...batch.west, ...batch.north];
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private createInquiry(params: {
    direction: Inquiry["direction"];
    query: string;
    confidence: number;
    pdeId: string;
    timestamp: string;
    actionIndex?: number;
  }): Inquiry {
    const source = this.classifySource(params.query, params.direction);

    return {
      id: uuid(),
      timestamp: params.timestamp,
      direction: params.direction,
      source,
      query: params.query,
      status: InquiryStatus.PENDING,
      relational_context: DIRECTION_RELATIONAL_CONTEXT[params.direction],
      accountability: DIRECTION_ACCOUNTABILITY[params.direction],
      pde_id: params.pdeId,
      action_index: params.actionIndex,
      confidence: params.confidence,
    };
  }

  private createAmbiguityInquiry(
    ambiguity: AmbiguityFlag,
    decomposition: DecompositionResult,
    timestamp: string,
  ): Inquiry {
    const query = `Clarify: ${ambiguity.text}${ambiguity.suggestion ? ` (suggestion: ${ambiguity.suggestion})` : ""}`;

    return this.createInquiry({
      direction: "west",
      query,
      confidence: 0.7,
      pdeId: decomposition.id,
      timestamp,
    });
  }

  private createAssumptionInquiry(
    assumption: string,
    decomposition: DecompositionResult,
    timestamp: string,
    index: number,
  ): Inquiry {
    const query = `Verify assumption: ${assumption}`;

    return this.createInquiry({
      direction: "south",
      query,
      confidence: 0.6,
      pdeId: decomposition.id,
      timestamp,
      actionIndex: index,
    });
  }

  /**
   * Convert a directional insight text into a well-formed query.
   */
  private insightToQuery(text: string, direction: Inquiry["direction"]): string {
    // If the text is already a question, use it directly
    if (text.trim().endsWith("?")) {
      return text.trim();
    }

    // Frame as a question appropriate to the direction
    const prefixes: Record<string, string> = {
      east: "What does this vision require:",
      south: "What do we need to learn about:",
      west: "How do we validate:",
      north: "What is needed to execute:",
    };

    return `${prefixes[direction]} ${text.trim()}?`;
  }

  /**
   * Classify which source channel an inquiry should route to.
   * Uses keyword matching with directional defaults as fallback.
   */
  private classifySource(query: string, direction: Inquiry["direction"]): InquirySource {
    const lowerQuery = query.toLowerCase();
    const scores: Record<InquirySource, number> = {
      [InquirySource.QMD_LOCAL]: 0,
      [InquirySource.DEEP_SEARCH_ACADEMIC]: 0,
      [InquirySource.WORKSPACE_SCAN]: 0,
    };

    // Score against keyword lists (merge user config with defaults)
    const mergedKeywords = this.mergeKeywords();
    for (const [source, keywords] of Object.entries(mergedKeywords)) {
      for (const keyword of keywords) {
        if (lowerQuery.includes(keyword)) {
          scores[source as InquirySource] += 1;
        }
      }
    }

    // Find highest scoring source
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0) {
      const topSource = (Object.entries(scores) as [InquirySource, number][])
        .filter(([, score]) => score === maxScore)
        .map(([source]) => source)[0];
      return topSource;
    }

    // Fall back to direction default or config default
    return this.routingConfig.defaultSource ?? DIRECTION_DEFAULT_SOURCE[direction];
  }

  private mergeKeywords(): Record<InquirySource, string[]> {
    return {
      [InquirySource.QMD_LOCAL]: [
        ...SOURCE_KEYWORDS[InquirySource.QMD_LOCAL],
        ...(this.routingConfig.qmdKeywords ?? []),
      ],
      [InquirySource.DEEP_SEARCH_ACADEMIC]: [
        ...SOURCE_KEYWORDS[InquirySource.DEEP_SEARCH_ACADEMIC],
        ...(this.routingConfig.deepSearchKeywords ?? []),
      ],
      [InquirySource.WORKSPACE_SCAN]: [
        ...SOURCE_KEYWORDS[InquirySource.WORKSPACE_SCAN],
        ...(this.routingConfig.workspaceScanKeywords ?? []),
      ],
    };
  }
}
