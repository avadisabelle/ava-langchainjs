/**
 * Relational Enricher
 *
 * Enriches inquiries with relational fields grounded in
 * Wilson's (2008) Research is Ceremony — specifically the axiology
 * of relational accountability and the epistemology of Two-Eyed Seeing
 * (Etuaptmumk, Bartlett et al. 2012).
 *
 * Each inquiry receives:
 * - relational_context: Why this question matters relationally
 * - accountability: Who/what the inquiry is accountable to
 * - ceremonial_intent: Ceremonial framing (stronger for WEST direction)
 * - indigenous_lens: How Indigenous knowledge systems frame this question
 * - western_lens: How Western knowledge systems frame this question
 *
 * This is the WEST (Synthesis) function of inquiry routing —
 * ensuring every question carries its relational obligations.
 *
 * Canonical direction mapping: East=Vision, South=Action, West=Synthesis, North=Structure
 * (mcp-pde variant: WEST=Validation, NORTH=Action — see inquiry-router.md for canonical source)
 */

import type { Inquiry, InquiryBatch, RelationalEnricherOptions } from "./types.js";

// =============================================================================
// Constants
// =============================================================================

/** Relational context by direction (Wilson's axiology) */
const RELATIONAL_CONTEXT: Record<string, string> = {
  east: "This inquiry emerges from the place of vision — seeking to understand what wants to be created and the relations it will serve.",
  south: "This inquiry emerges from the place of learning — seeking knowledge that honors both the sources it draws from and the communities it serves.",
  west: "This inquiry emerges from the place of reflection — seeking to validate that what has been created maintains integrity within its relational web.",
  north: "This inquiry emerges from the place of action — seeking to ensure execution serves the whole and not merely the task.",
};

/** Accountability by direction */
const ACCOUNTABILITY: Record<string, string> = {
  east: "Accountable to the original intent and the communities whose needs birthed this vision.",
  south: "Accountable to truthful learning — honoring sources, avoiding extractive knowledge practices.",
  west: "Accountable to honest reflection — testing against lived experience, not just logical consistency.",
  north: "Accountable to responsible action — ensuring execution does not create harm in pursuit of completion.",
};

/** Ceremonial intent templates (stronger for reflective/spiritual directions) */
const CEREMONIAL_INTENT: Record<string, string> = {
  east: "Opening ceremony: acknowledging the relations that bring this question into being.",
  south: "Learning ceremony: approaching knowledge with humility and reciprocity.",
  west: "Reflection ceremony: sitting with what has been created before moving forward, honoring the pause.",
  north: "Completion ceremony: marking the transition from knowing to doing with relational awareness.",
};

/** Indigenous lens templates */
const INDIGENOUS_LENS: Record<string, string> = {
  east: "In the Medicine Wheel, East holds the gift of vision. This question asks what wants to emerge — not what we want to extract.",
  south: "In the Medicine Wheel, South holds the gift of growth. This question seeks understanding that grows from relationship, not isolation.",
  west: "In the Medicine Wheel, West holds the gift of introspection. This question asks us to look inward before moving outward.",
  north: "In the Medicine Wheel, North holds the gift of wisdom through action. This question seeks knowledge that has been tested through doing.",
};

/** Western lens templates */
const WESTERN_LENS: Record<string, string> = {
  east: "Requirements analysis: identifying functional and non-functional specifications through systematic decomposition.",
  south: "Literature review and empirical research: gathering evidence-based knowledge from peer-reviewed sources.",
  west: "Verification and validation: ensuring correctness through testing, review, and quality assurance processes.",
  north: "Implementation and deployment: translating specifications into executable artifacts through engineering practices.",
};

// =============================================================================
// RelationalEnricher
// =============================================================================

/**
 * Enriches inquiries with Wilson's relational fields and
 * Two-Eyed Seeing epistemological markers.
 *
 * @example
 * ```typescript
 * import { RelationalEnricher } from "ava-langchain-inquiry-routing";
 *
 * const enricher = new RelationalEnricher();
 * const enriched = enricher.enrich(inquiry);
 *
 * console.log(enriched.relational_context);
 * console.log(enriched.indigenous_lens);
 * console.log(enriched.western_lens);
 * ```
 */
export class RelationalEnricher {
  private readonly addTwoEyedSeeing: boolean;
  private readonly addCeremonialIntent: boolean;

  constructor(options?: RelationalEnricherOptions) {
    this.addTwoEyedSeeing = options?.addTwoEyedSeeing ?? true;
    this.addCeremonialIntent = options?.addCeremonialIntent ?? true;
  }

  /**
   * Enrich a single inquiry with relational grounding fields.
   *
   * @param inquiry - The inquiry to enrich
   * @param context - Optional additional relational context
   * @returns A new inquiry with relational fields populated
   */
  enrich(inquiry: Inquiry, context?: string): Inquiry {
    const enriched: Inquiry = {
      ...inquiry,
      relational_context: context
        ? `${RELATIONAL_CONTEXT[inquiry.direction]} ${context}`
        : RELATIONAL_CONTEXT[inquiry.direction],
      accountability: ACCOUNTABILITY[inquiry.direction],
    };

    if (this.addCeremonialIntent) {
      enriched.ceremonial_intent = CEREMONIAL_INTENT[inquiry.direction];
    }

    if (this.addTwoEyedSeeing) {
      return this.addTwoEyedSeeingMarkers(enriched);
    }

    return enriched;
  }

  /**
   * Add Two-Eyed Seeing (Etuaptmumk) markers to an inquiry.
   *
   * Both lenses are always present — the strength of each varies
   * by direction. WEST and EAST inquiries carry stronger indigenous_lens;
   * SOUTH and NORTH carry stronger western_lens. But neither is ever absent.
   *
   * @param inquiry - The inquiry to add markers to
   * @returns A new inquiry with Two-Eyed Seeing markers
   */
  addTwoEyedSeeingMarkers(inquiry: Inquiry): Inquiry {
    return {
      ...inquiry,
      indigenous_lens: INDIGENOUS_LENS[inquiry.direction],
      western_lens: WESTERN_LENS[inquiry.direction],
    };
  }

  /**
   * Enrich an entire batch of inquiries.
   *
   * @param batch - The inquiry batch to enrich
   * @param context - Optional additional relational context
   * @returns A new batch with all inquiries enriched
   */
  enrichBatch(batch: InquiryBatch, context?: string): InquiryBatch {
    return {
      ...batch,
      east: batch.east.map((i) => this.enrich(i, context)),
      south: batch.south.map((i) => this.enrich(i, context)),
      west: batch.west.map((i) => this.enrich(i, context)),
      north: batch.north.map((i) => this.enrich(i, context)),
    };
  }
}
