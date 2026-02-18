/**
 * Medicine Wheel Bridge
 *
 * Bridges PDE's Four Directions with the MedicineWheelFilter
 * from ava-langchain-relational-intelligence. This maps:
 *   EAST → SPIRITUAL (vision, purpose)
 *   SOUTH → MENTAL (analysis, learning)
 *   WEST → EMOTIONAL (reflection, ceremony)
 *   NORTH → PHYSICAL (action, execution)
 *
 * When relational-intelligence is available, it enriches PDE
 * decompositions with wheel assessments and value gate checks.
 */

import { Direction, type DirectionalAnalysis } from "./directional_decomposer.js";

// =============================================================================
// Direction ↔ Quadrant Mapping
// =============================================================================

/** Medicine Wheel quadrants from relational-intelligence */
export enum WheelQuadrant {
  PHYSICAL = "physical",
  EMOTIONAL = "emotional",
  MENTAL = "mental",
  SPIRITUAL = "spiritual",
}

/** How PDE directions map to Medicine Wheel quadrants */
export const DIRECTION_TO_QUADRANT: Record<Direction, WheelQuadrant> = {
  [Direction.EAST]: WheelQuadrant.SPIRITUAL,
  [Direction.SOUTH]: WheelQuadrant.MENTAL,
  [Direction.WEST]: WheelQuadrant.EMOTIONAL,
  [Direction.NORTH]: WheelQuadrant.PHYSICAL,
};

export const QUADRANT_TO_DIRECTION: Record<WheelQuadrant, Direction> = {
  [WheelQuadrant.SPIRITUAL]: Direction.EAST,
  [WheelQuadrant.MENTAL]: Direction.SOUTH,
  [WheelQuadrant.EMOTIONAL]: Direction.WEST,
  [WheelQuadrant.PHYSICAL]: Direction.NORTH,
};

// =============================================================================
// Bridge Types
// =============================================================================

export interface WheelEnrichedAnalysis extends DirectionalAnalysis {
  wheelMapping: Record<Direction, WheelQuadrant>;
  quadrantPresence: Record<WheelQuadrant, number>;
  relationalCoverage: number;
  ceremonyRequired: boolean;
}

export interface WheelBridgeOptions {
  ceremonyThreshold?: number; // Minimum spiritual+emotional coverage to not require ceremony (default 0.3)
}

// =============================================================================
// MedicineWheelBridge
// =============================================================================

export class MedicineWheelBridge {
  private readonly ceremonyThreshold: number;

  constructor(options?: WheelBridgeOptions) {
    this.ceremonyThreshold = options?.ceremonyThreshold ?? 0.3;
  }

  /**
   * Enrich a directional analysis with Medicine Wheel assessment.
   * Maps direction coverage to quadrant presence and determines
   * whether ceremony is needed.
   */
  enrich(analysis: DirectionalAnalysis): WheelEnrichedAnalysis {
    // Calculate quadrant presence from direction coverage
    const totalInsights = Object.values(analysis.directions)
      .reduce((sum, insights) => sum + insights.length, 0) || 1;

    const quadrantPresence: Record<WheelQuadrant, number> = {
      [WheelQuadrant.SPIRITUAL]: analysis.directions[Direction.EAST].length / totalInsights,
      [WheelQuadrant.MENTAL]: analysis.directions[Direction.SOUTH].length / totalInsights,
      [WheelQuadrant.EMOTIONAL]: analysis.directions[Direction.WEST].length / totalInsights,
      [WheelQuadrant.PHYSICAL]: analysis.directions[Direction.NORTH].length / totalInsights,
    };

    // Relational coverage: how many quadrants are represented
    const representedQuadrants = Object.values(quadrantPresence).filter(
      (v) => v > 0.05
    ).length;
    const relationalCoverage = representedQuadrants / 4;

    // Ceremony required if spiritual + emotional are too low
    const ceremonialPresence =
      quadrantPresence[WheelQuadrant.SPIRITUAL] +
      quadrantPresence[WheelQuadrant.EMOTIONAL];
    const ceremonyRequired = ceremonialPresence < this.ceremonyThreshold;

    return {
      ...analysis,
      wheelMapping: { ...DIRECTION_TO_QUADRANT },
      quadrantPresence,
      relationalCoverage,
      ceremonyRequired,
    };
  }

  /**
   * Check if a decomposition can proceed without ceremony.
   * Returns false if spiritual/emotional directions are neglected.
   */
  canProceedWithoutCeremony(analysis: DirectionalAnalysis): boolean {
    const enriched = this.enrich(analysis);
    return !enriched.ceremonyRequired;
  }

  /**
   * Generate guidance for bringing a decomposition into relational balance.
   */
  getRelationalGuidance(analysis: DirectionalAnalysis): string[] {
    const enriched = this.enrich(analysis);
    const guidance: string[] = [];

    if (enriched.quadrantPresence[WheelQuadrant.SPIRITUAL] < 0.1) {
      guidance.push(
        "EAST/Spiritual: The vision is unclear. What is the deeper purpose? Who does this serve?"
      );
    }

    if (enriched.quadrantPresence[WheelQuadrant.EMOTIONAL] < 0.1) {
      guidance.push(
        "WEST/Emotional: Reflection is missing. What ceremonies or protocols should be honored? Who needs to be consulted?"
      );
    }

    if (enriched.quadrantPresence[WheelQuadrant.MENTAL] < 0.1) {
      guidance.push(
        "SOUTH/Mental: Analysis is thin. What needs to be researched or understood before proceeding?"
      );
    }

    if (enriched.quadrantPresence[WheelQuadrant.PHYSICAL] < 0.1) {
      guidance.push(
        "NORTH/Physical: No actionable steps found. What concrete actions will manifest this work?"
      );
    }

    if (enriched.ceremonyRequired) {
      guidance.push(
        "⚠️ Ceremony Required: Spiritual and emotional dimensions are underrepresented. Pause for relational check-in before proceeding."
      );
    }

    return guidance;
  }
}
