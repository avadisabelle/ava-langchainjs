/**
 * Medicine Wheel Ontological Filter
 *
 * Uses the Medicine Wheel as an ontological structure, not a graphic.
 * Each quadrant (Physical, Emotional, Mental, Spiritual) represents a
 * different "flavor" of relationship. If an agent only sees one quadrant,
 * it is missing the rest of reality.
 *
 * The wheel is used as a filter for classifying inputs and ensuring
 * that all four dimensions are considered in relational analysis.
 */

import { v4 as uuidv4 } from "uuid";
import { BaseChatModel, BaseLLM } from "@langchain/core/language_models/base";
import { z } from "zod";

/**
 * The four quadrants of the Medicine Wheel.
 * Each represents a distinct relational dimension.
 */
export enum MedicineWheelQuadrant {
  /** The material, embodied, land-based dimension. Code, infrastructure, artifacts. */
  PHYSICAL = "physical",
  /** The felt, relational, heart-centered dimension. Bonds, care, harm, healing. */
  EMOTIONAL = "emotional",
  /** The analytical, logical, pattern-recognition dimension. Design, architecture, analysis. */
  MENTAL = "mental",
  /** The intuitive, visionary, dream-adjacent dimension. Liminal insight, ceremony, vision. */
  SPIRITUAL = "spiritual",
}

/**
 * All quadrants for iteration.
 */
export const ALL_QUADRANTS: MedicineWheelQuadrant[] = [
  MedicineWheelQuadrant.PHYSICAL,
  MedicineWheelQuadrant.EMOTIONAL,
  MedicineWheelQuadrant.MENTAL,
  MedicineWheelQuadrant.SPIRITUAL,
];

/**
 * A score (0-1) for each quadrant indicating how strongly
 * a piece of data or action engages that dimension.
 */
export interface QuadrantPresence {
  [MedicineWheelQuadrant.PHYSICAL]: number;
  [MedicineWheelQuadrant.EMOTIONAL]: number;
  [MedicineWheelQuadrant.MENTAL]: number;
  [MedicineWheelQuadrant.SPIRITUAL]: number;
}

/**
 * Create a QuadrantPresence with defaults (0 for all).
 */
export function createQuadrantPresence(
  partial: Partial<QuadrantPresence> = {}
): QuadrantPresence {
  return {
    [MedicineWheelQuadrant.PHYSICAL]: partial[MedicineWheelQuadrant.PHYSICAL] ?? 0,
    [MedicineWheelQuadrant.EMOTIONAL]: partial[MedicineWheelQuadrant.EMOTIONAL] ?? 0,
    [MedicineWheelQuadrant.MENTAL]: partial[MedicineWheelQuadrant.MENTAL] ?? 0,
    [MedicineWheelQuadrant.SPIRITUAL]: partial[MedicineWheelQuadrant.SPIRITUAL] ?? 0,
  };
}

/**
 * A relational assessment produced by the Medicine Wheel filter.
 * Tags data not by topic but by the strength and type of relationship
 * it holds to each quadrant.
 */
export interface WheelAssessment {
  id: string;
  inputId: string;
  presence: QuadrantPresence;
  leadQuadrant: MedicineWheelQuadrant;
  /** Quadrants with presence below the neglect threshold. */
  neglectedQuadrants: MedicineWheelQuadrant[];
  /** Fraction of total reality being engaged (0-1). */
  relationalCoverage: number;
  /** Whether sufficient quadrants are engaged for balanced action. */
  balanced: boolean;
  timestamp: string;
}

/**
 * Keywords that suggest engagement with each quadrant.
 * Used for rule-based classification before LLM refinement.
 */
export const QUADRANT_KEYWORDS: Record<MedicineWheelQuadrant, string[]> = {
  [MedicineWheelQuadrant.PHYSICAL]: [
    "build", "deploy", "code", "infrastructure", "server", "database",
    "artifact", "land", "body", "material", "hardware", "install",
    "compile", "run", "execute", "test", "performance", "latency",
    "physical", "touch", "ground", "earth", "place", "space",
  ],
  [MedicineWheelQuadrant.EMOTIONAL]: [
    "feel", "care", "harm", "heal", "trust", "safe", "afraid",
    "joy", "grief", "anger", "love", "hurt", "compassion", "empathy",
    "relationship", "bond", "connect", "lonely", "together", "heart",
    "thank", "appreciate", "grateful", "sorry", "forgive", "welcome",
  ],
  [MedicineWheelQuadrant.MENTAL]: [
    "think", "analyze", "design", "architecture", "pattern", "logic",
    "reason", "plan", "strategy", "model", "schema", "ontology",
    "classify", "structure", "abstract", "concept", "theory", "framework",
    "algorithm", "protocol", "specification", "define", "organize",
  ],
  [MedicineWheelQuadrant.SPIRITUAL]: [
    "dream", "vision", "ceremony", "spirit", "intuition", "liminal",
    "sacred", "ancestor", "prayer", "medicine", "creator", "mystery",
    "awake", "sleep", "insight", "revelation", "purpose", "meaning",
    "calling", "gift", "offering", "witness", "presence", "stillness",
    "circle", "return", "land-based", "relational",
  ],
};

// Zod schema for LLM output validation
const QuadrantPresenceSchema = z.object({
  physical: z.number().min(0).max(1).describe("The degree to which the content engages the Physical (embodied, material) quadrant (0-1)."),
  emotional: z.number().min(0).max(1).describe("The degree to which the content engages the Emotional (felt, relational) quadrant (0-1)."),
  mental: z.number().min(0).max(1).describe("The degree to which the content engages the Mental (analytical, logical) quadrant (0-1)."),
  spiritual: z.number().min(0).max(1).describe("The degree to which the content engages the Spiritual (intuitive, visionary) quadrant (0-1)."),
}).transform((data) => ({
  [MedicineWheelQuadrant.PHYSICAL]: data.physical,
  [MedicineWheelQuadrant.EMOTIONAL]: data.emotional,
  [MedicineWheelQuadrant.MENTAL]: data.mental,
  [MedicineWheelQuadrant.SPIRITUAL]: data.spiritual,
}));

export interface MedicineWheelFilterOptions {
  /** Threshold below which a quadrant is considered neglected. Default: 0.15 */
  neglectThreshold?: number;
  /** Minimum relational coverage for balanced assessment. Default: 0.5 */
  balanceThreshold?: number;
  /** Optional LLM for enhanced quadrant classification. */
  llm?: BaseChatModel | BaseLLM;
}

/**
 * The Medicine Wheel Filter classifies inputs across all four quadrants
 * and identifies when dimensions of reality are being neglected.
 *
 * Instead of asking "What is this about?" (Classification), the wheel asks
 * "To what is this accountable?" (Relationality).
 *
 * @example
 * ```typescript
 * const wheel = new MedicineWheelFilter();
 *
 * const assessment = wheel.assess("input_1", "Add database schema for user auth");
 * // assessment.leadQuadrant === MedicineWheelQuadrant.MENTAL
 * // assessment.neglectedQuadrants includes EMOTIONAL, SPIRITUAL
 * // assessment.balanced === false
 *
 * const dreamAssessment = wheel.assess("input_2", "In the dream I saw the system breathing");
 * // dreamAssessment.leadQuadrant === MedicineWheelQuadrant.SPIRITUAL
 * ```
 */
export class MedicineWheelFilter {
  private neglectThreshold: number;
  private balanceThreshold: number;
  private llm?: BaseChatModel | BaseLLM;

  constructor(options: MedicineWheelFilterOptions = {}) {
    this.neglectThreshold = options.neglectThreshold ?? 0.15;
    this.balanceThreshold = options.balanceThreshold ?? 0.5;
    this.llm = options.llm;
  }

  /**
   * Assess an input across all four quadrants of the Medicine Wheel.
   * Returns a WheelAssessment indicating relational engagement.
   */
  async assess(inputId: string, content: string): Promise<WheelAssessment> {
    const presence = await this.classifyPresence(content);
    const leadQuadrant = this.determineLeadQuadrant(presence);
    const neglectedQuadrants = this.findNeglectedQuadrants(presence);
    const relationalCoverage = this.calculateCoverage(presence);
    const balanced = relationalCoverage >= this.balanceThreshold;

    return {
      id: uuidv4(),
      inputId,
      presence,
      leadQuadrant,
      neglectedQuadrants,
      relationalCoverage,
      balanced,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Assess and return guidance about what is missing.
   * The wheel does not just classify -- it reveals gaps.
   */
  async assessWithGuidance(
    inputId: string,
    content: string
  ): Promise<WheelAssessment & { guidance: string[] }> {
    const assessment = await this.assess(inputId, content);
    const guidance: string[] = [];

    if (assessment.neglectedQuadrants.length > 0) {
      for (const q of assessment.neglectedQuadrants) {
        guidance.push(this.guidanceForQuadrant(q, assessment.leadQuadrant));
      }
    }

    if (!assessment.balanced) {
      guidance.push(
        `Relational coverage is ${(assessment.relationalCoverage * 100).toFixed(0)}%. ` +
        `The Medicine Wheel asks: what relationships are being missed?`
      );
    }

    return { ...assessment, guidance };
  }

  /**
   * Check whether an action engages enough of the wheel
   * to proceed without human consultation.
   */
  canProceedAutonomously(assessment: WheelAssessment): boolean {
    // If spiritual quadrant is neglected, the action may lack
    // alignment with the deeper vision. Require check-back.
    if (assessment.neglectedQuadrants.includes(MedicineWheelQuadrant.SPIRITUAL)) {
      return false;
    }
    // If emotional quadrant is neglected, relational accountability
    // may be at risk.
    if (assessment.neglectedQuadrants.includes(MedicineWheelQuadrant.EMOTIONAL)) {
      return false;
    }
    return assessment.balanced;
  }

  /**
   * Classify content presence across quadrants using keyword matching.
   */
  private async classifyPresence(content: string): Promise<QuadrantPresence> {
    if (this.llm) {
      try {
        return await this._classifyPresenceWithLLM(content);
      } catch (e) {
        console.warn("LLM quadrant classification failed, falling back to heuristics:", e);
        // Fallback to heuristic-based classification on LLM failure
      }
    }

    const lower = content.toLowerCase();
    const words = lower.split(/\s+/);

    const scores: Record<string, number> = {};
    let totalHits = 0;

    for (const quadrant of ALL_QUADRANTS) {
      const keywords = QUADRANT_KEYWORDS[quadrant];
      let hits = 0;
      for (const word of words) {
        for (const kw of keywords) {
          if (word.includes(kw)) {
            hits++;
            break;
          }
        }
      }
      scores[quadrant] = hits;
      totalHits += hits;
    }

    // Normalize to 0-1, ensuring minimum floor for spiritual
    // (liminal/dream inputs are often underrepresented by keywords)
    const presence = createQuadrantPresence();
    if (totalHits === 0) {
      // No keyword matches -- distribute evenly with slight spiritual lean
      presence[MedicineWheelQuadrant.PHYSICAL] = 0.2;
      presence[MedicineWheelQuadrant.EMOTIONAL] = 0.2;
      presence[MedicineWheelQuadrant.MENTAL] = 0.25;
      presence[MedicineWheelQuadrant.SPIRITUAL] = 0.35;
    } else {
      for (const quadrant of ALL_QUADRANTS) {
        presence[quadrant] = scores[quadrant] / totalHits;
      }
    }

    return presence;
  }

  private async _classifyPresenceWithLLM(content: string): Promise<QuadrantPresence> {
    if (!this.llm) {
      throw new Error("LLM not provided for LLM-based classification.");
    }

    const systemPrompt = `You are an expert in Indigenous Medicine Wheel epistemology and relational intelligence.
Your task is to analyze the provided content and determine its engagement with each of the four Medicine Wheel quadrants: Physical, Emotional, Mental, and Spiritual.
Assign a score from 0 (no engagement) to 1 (strong engagement) for each quadrant.

Medicine Wheel Quadrants:
- PHYSICAL: Material, embodied, land-based. Code, infrastructure, artifacts, tangible actions, physical sensations.
- EMOTIONAL: Felt, relational, heart-centered. Bonds, care, harm, healing, trust, feelings, community, empathy.
- MENTAL: Analytical, logical, pattern-recognition. Design, architecture, analysis, strategy, ontology, abstract concepts.
- SPIRITUAL: Intuitive, visionary, dream-adjacent. Liminal insight, ceremony, vision, purpose, meaning, connection to ancestors/spirit.

Output your assessment as a JSON object matching the following Zod schema:

${JSON.stringify({ physical: "number (0-1)", emotional: "number (0-1)", mental: "number (0-1)", spiritual: "number (0-1)" }, null, 2)}

Ensure the JSON is perfectly valid and can be directly parsed. Do not include any additional text outside the JSON object.
`;

    const response = await this.llm.invoke([
      ["system", systemPrompt],
      ["human", `Content to assess: "${content}"`],
    ]);

    const resContent = typeof response === "string" ? response : response.content;

    let parsedResult;
    try {
      parsedResult = JSON.parse(resContent);
    } catch (e) {
      console.error("Failed to parse LLM response as JSON for MedicineWheelFilter:", e);
      console.error("LLM response content:", resContent);
      throw new Error("LLM output was not valid JSON for QuadrantPresence.");
    }

    const validationResult = QuadrantPresenceSchema.safeParse(parsedResult);
    if (!validationResult.success) {
      console.error("LLM output did not match schema for MedicineWheelFilter:", validationResult.error);
      throw new Error("LLM output did not match expected schema for QuadrantPresence.");
    }

    return validationResult.data;
  }

  /**
   * Determine which quadrant leads the relational engagement.
   */
  private determineLeadQuadrant(
    presence: QuadrantPresence
  ): MedicineWheelQuadrant {
    let lead = MedicineWheelQuadrant.MENTAL;
    let max = -1;

    for (const quadrant of ALL_QUADRANTS) {
      if (presence[quadrant] > max) {
        max = presence[quadrant];
        lead = quadrant;
      }
    }

    return lead;
  }

  /**
   * Find quadrants below the neglect threshold.
   */
  private findNeglectedQuadrants(
    presence: QuadrantPresence
  ): MedicineWheelQuadrant[] {
    return ALL_QUADRANTS.filter(
      (q) => presence[q] < this.neglectThreshold
    );
  }

  /**
   * Calculate overall relational coverage.
   * Coverage = fraction of quadrants meaningfully engaged.
   */
  private calculateCoverage(presence: QuadrantPresence): number {
    const engaged = ALL_QUADRANTS.filter(
      (q) => presence[q] >= this.neglectThreshold
    ).length;
    return engaged / ALL_QUADRANTS.length;
  }

  /**
   * Generate guidance for a neglected quadrant.
   */
  private guidanceForQuadrant(
    neglected: MedicineWheelQuadrant,
    lead: MedicineWheelQuadrant
  ): string {
    const guidance: Record<MedicineWheelQuadrant, string> = {
      [MedicineWheelQuadrant.PHYSICAL]:
        "The Physical quadrant is neglected. Consider: how does this manifest on the land? " +
        "What material form does it take? What body will hold this?",
      [MedicineWheelQuadrant.EMOTIONAL]:
        "The Emotional quadrant is neglected. Consider: who is affected by this? " +
        "What relationships are strengthened or strained? Where is the care?",
      [MedicineWheelQuadrant.MENTAL]:
        "The Mental quadrant is neglected. Consider: what is the structural logic? " +
        "How does this connect to the larger pattern? What is the design?",
      [MedicineWheelQuadrant.SPIRITUAL]:
        "The Spiritual quadrant is neglected. Consider: does this align with the deeper vision? " +
        "What does the dream say? Has ceremony been observed?",
    };

    return guidance[neglected];
  }
}
