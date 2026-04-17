/**
 * Structural Tension Chain
 *
 * Takes current_reality + desired_outcome → produces a TensionVector
 * used as a routing signal. This is miaco's most distinctive pattern:
 * structural tension as a first-class routing signal, not confidence
 * scores or keyword heuristics.
 *
 * The chain evaluates the gap between current reality and desired outcome
 * across configurable dimensions, producing a magnitude and direction
 * that can be mapped to Medicine Wheel directions for routing.
 *
 * No LLM dependency — uses keyword-based scoring consistent with
 * MedicineWheelFilter and DirectionalDecomposer.
 */

import { v4 as uuid } from "uuid";

// =============================================================================
// Types
// =============================================================================

/**
 * A single dimension of structural tension — the gap between
 * current state and desired state along one axis.
 */
export interface TensionComponent {
  /** The dimension being measured (e.g., "technical", "relational") */
  dimension: string;
  /** Description of where things stand now */
  currentState: string;
  /** Description of where things should be */
  desiredState: string;
  /** Gap magnitude 0-1 (0 = aligned, 1 = maximum divergence) */
  gap: number;
  /** Keywords detected in this dimension */
  keywords: string[];
}

/**
 * The full structural tension vector — a multi-dimensional measurement
 * of the distance between current reality and desired outcome.
 */
export interface TensionVector {
  /** Unique identifier */
  id: string;
  /** The current reality description */
  currentReality: string;
  /** The desired outcome description */
  desiredOutcome: string;
  /** Overall magnitude 0-1 (weighted average of component gaps) */
  magnitude: number;
  /** Movement classification based on magnitude thresholds */
  direction: "advancing" | "oscillating" | "stagnant";
  /** Per-dimension tension breakdown */
  components: TensionComponent[];
  /** ISO timestamp */
  createdAt: string;
}

/**
 * Measurement of progression between two TensionVectors over time.
 */
export interface ProgressionMeasurement {
  /** Change in magnitude (positive = tension increasing, negative = resolving) */
  deltaMagnitude: number;
  /** Overall direction of movement */
  direction: "advancing" | "oscillating" | "stagnant";
  /** Dimensions whose gap decreased to near-zero */
  resolvedComponents: string[];
  /** Dimensions that appeared in current but not in previous */
  newComponents: string[];
}

/**
 * A routing signal derived from structural tension — maps tension
 * components to Medicine Wheel directions for workflow routing.
 */
export interface RoutingSignal {
  /** Which direction work should proceed */
  recommendedDirection: "east" | "south" | "west" | "north";
  /** How confident the recommendation is (0-1) */
  confidence: number;
  /** Human-readable explanation */
  rationale: string;
}

/**
 * Configuration options for StructuralTensionChain.
 */
export interface StructuralTensionChainOptions {
  /** Dimensions to evaluate (default: technical, relational, ceremonial, narrative) */
  dimensions?: string[];
  /** Thresholds for classifying movement direction */
  thresholds?: {
    /** Below this magnitude = advancing (default 0.3) */
    advancing: number;
    /** Above this magnitude = oscillating; between advancing and this = stagnant (default 0.7) */
    oscillating: number;
  };
}

// =============================================================================
// Dimension Keywords
// =============================================================================

/** Keywords that signal engagement with each tension dimension */
const DIMENSION_KEYWORDS: Record<string, string[]> = {
  technical: [
    "build", "deploy", "code", "infrastructure", "server", "database",
    "api", "schema", "module", "test", "performance", "architecture",
    "compile", "execute", "debug", "refactor", "implement", "configure",
    "install", "pipeline", "ci", "cd", "repository", "branch",
  ],
  relational: [
    "team", "community", "trust", "care", "collaborate", "share",
    "relationship", "bond", "connect", "support", "accountability",
    "consent", "kinship", "reciprocity", "dialogue", "listen",
    "respect", "together", "empathy", "feedback", "mentor",
  ],
  ceremonial: [
    "ceremony", "protocol", "sacred", "intention", "ritual", "prayer",
    "offering", "witness", "circle", "gather", "honor", "land",
    "ancestor", "spirit", "medicine", "tobacco", "smudge", "fire",
    "drum", "song", "return", "gratitude", "blessing",
  ],
  narrative: [
    "story", "chapter", "arc", "character", "theme", "plot",
    "scene", "dialogue", "voice", "narrative", "chronicle", "tale",
    "episode", "beat", "tension", "resolution", "climax", "journey",
    "myth", "legend", "saga", "memoir", "perspective", "telling",
  ],
};

// =============================================================================
// StructuralTensionChain
// =============================================================================

/**
 * StructuralTensionChain evaluates the gap between current reality and
 * desired outcome across multiple dimensions, producing routing signals
 * for workflow orchestration.
 *
 * This is miaco's signature pattern: structural tension as first-class
 * routing signal — not confidence scores or keyword heuristics, but the
 * measured distance between where things are and where they need to be.
 *
 * @example
 * ```typescript
 * const chain = new StructuralTensionChain();
 *
 * const vector = chain.evaluate(
 *   "We have a monolith with no tests and the team doesn't talk",
 *   "Microservices architecture with full test coverage and daily standups"
 * );
 *
 * const signal = chain.toRoutingSignal(vector);
 * // signal.recommendedDirection === "east" (high technical gap)
 * ```
 */
export class StructuralTensionChain {
  private readonly dimensions: string[];
  private readonly advancingThreshold: number;
  private readonly oscillatingThreshold: number;

  constructor(options?: StructuralTensionChainOptions) {
    this.dimensions = options?.dimensions ?? [
      "technical",
      "relational",
      "ceremonial",
      "narrative",
    ];
    this.advancingThreshold = options?.thresholds?.advancing ?? 0.3;
    this.oscillatingThreshold = options?.thresholds?.oscillating ?? 0.7;
  }

  /**
   * Evaluate the structural tension between current reality and desired outcome.
   * Uses keyword scoring across configurable dimensions.
   */
  evaluate(currentReality: string, desiredOutcome: string): TensionVector {
    const components: TensionComponent[] = [];

    for (const dimension of this.dimensions) {
      const component = this.evaluateDimension(
        dimension,
        currentReality,
        desiredOutcome
      );
      components.push(component);
    }

    const magnitude = this.calculateMagnitude(components);
    const direction = this.classifyDirection(magnitude);

    return {
      id: uuid(),
      currentReality,
      desiredOutcome,
      magnitude,
      direction,
      components,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Track progression over time — compare two TensionVectors to measure
   * whether tension is resolving, building, or oscillating.
   */
  measureProgression(
    previous: TensionVector,
    current: TensionVector
  ): ProgressionMeasurement {
    const deltaMagnitude = current.magnitude - previous.magnitude;

    const previousDimensions = new Set(
      previous.components.map((c) => c.dimension)
    );
    const currentDimensions = new Set(
      current.components.map((c) => c.dimension)
    );

    // Resolved = dimensions that had significant gap before but now near zero
    const resolvedComponents: string[] = [];
    for (const prev of previous.components) {
      const curr = current.components.find(
        (c) => c.dimension === prev.dimension
      );
      if (prev.gap > 0.2 && (!curr || curr.gap < 0.1)) {
        resolvedComponents.push(prev.dimension);
      }
    }

    // New = dimensions that appear in current but not in previous
    const newComponents: string[] = [];
    for (const dim of currentDimensions) {
      if (!previousDimensions.has(dim)) {
        newComponents.push(dim);
      }
    }

    // Determine overall direction
    let direction: "advancing" | "oscillating" | "stagnant";
    if (deltaMagnitude < -0.05) {
      direction = "advancing"; // tension resolving = making progress
    } else if (deltaMagnitude > 0.1) {
      direction = "oscillating"; // tension increasing = possible backsliding
    } else {
      direction = "stagnant"; // no meaningful change
    }

    return {
      deltaMagnitude,
      direction,
      resolvedComponents,
      newComponents,
    };
  }

  /**
   * Create a routing signal from a TensionVector — maps the highest-gap
   * dimension to a Medicine Wheel direction for workflow routing.
   *
   * Mapping:
   * - technical → EAST (Vision/Build)
   * - relational → SOUTH (Analysis/Relationships)
   * - ceremonial → WEST (Validation/Ceremony)
   * - narrative → NORTH (Action/Story)
   */
  toRoutingSignal(vector: TensionVector): RoutingSignal {
    if (vector.components.length === 0) {
      return {
        recommendedDirection: "east",
        confidence: 0.25,
        rationale: "No tension components to evaluate — defaulting to EAST (Vision).",
      };
    }

    // Find the dimension with highest gap
    const sorted = [...vector.components].sort((a, b) => b.gap - a.gap);
    const lead = sorted[0];

    const directionMap: Record<string, "east" | "south" | "west" | "north"> = {
      technical: "east",
      relational: "south",
      ceremonial: "west",
      narrative: "north",
    };

    const recommendedDirection =
      directionMap[lead.dimension] ?? this.inferDirection(lead.dimension);

    // Confidence based on how dominant the leading dimension is
    const totalGap = vector.components.reduce((sum, c) => sum + c.gap, 0) || 1;
    const confidence = Math.min(lead.gap / totalGap + 0.2, 1);

    const directionNames: Record<string, string> = {
      east: "EAST (Vision/Build)",
      south: "SOUTH (Relationships/Analysis)",
      west: "WEST (Ceremony/Validation)",
      north: "NORTH (Action/Story)",
    };

    const rationale =
      `Highest gap in "${lead.dimension}" dimension (${(lead.gap * 100).toFixed(0)}%). ` +
      `Routing to ${directionNames[recommendedDirection] ?? recommendedDirection} ` +
      `to address this tension. Overall magnitude: ${(vector.magnitude * 100).toFixed(0)}%.`;

    return {
      recommendedDirection,
      confidence,
      rationale,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Evaluate a single dimension of tension by comparing keyword presence
   * in current reality vs desired outcome.
   */
  private evaluateDimension(
    dimension: string,
    currentReality: string,
    desiredOutcome: string
  ): TensionComponent {
    const keywords = DIMENSION_KEYWORDS[dimension] ?? [];
    const currentLower = currentReality.toLowerCase();
    const desiredLower = desiredOutcome.toLowerCase();
    const currentWords = currentLower.split(/\s+/);
    const desiredWords = desiredLower.split(/\s+/);

    // Count keyword hits in current and desired
    let currentHits = 0;
    let desiredHits = 0;
    const matchedKeywords: string[] = [];

    for (const kw of keywords) {
      const inCurrent = currentWords.some((w) => w.includes(kw));
      const inDesired = desiredWords.some((w) => w.includes(kw));

      if (inCurrent || inDesired) {
        matchedKeywords.push(kw);
      }
      if (inCurrent) currentHits++;
      if (inDesired) desiredHits++;
    }

    // Gap calculation: higher when desired mentions the dimension
    // but current does not — indicating work needed in this area
    const totalMentions = currentHits + desiredHits || 1;
    let gap: number;

    if (desiredHits === 0 && currentHits === 0) {
      // Dimension not relevant to either state
      gap = 0;
    } else if (desiredHits > 0 && currentHits === 0) {
      // Desired mentions it, current doesn't — high gap
      gap = Math.min(desiredHits / keywords.length + 0.3, 1);
    } else if (currentHits > 0 && desiredHits === 0) {
      // Current mentions it but desired doesn't — minimal gap
      gap = 0.1;
    } else {
      // Both mention it — gap based on ratio difference
      const ratio = Math.abs(desiredHits - currentHits) / totalMentions;
      gap = Math.min(ratio + 0.1, 1);
    }

    // Extract representative state descriptions
    const currentState = this.extractStateDescription(
      currentReality,
      matchedKeywords,
      dimension
    );
    const desiredState = this.extractStateDescription(
      desiredOutcome,
      matchedKeywords,
      dimension
    );

    return {
      dimension,
      currentState: currentState || `Current ${dimension} state`,
      desiredState: desiredState || `Desired ${dimension} state`,
      gap: Math.round(gap * 100) / 100,
      keywords: matchedKeywords.slice(0, 10),
    };
  }

  /**
   * Extract a state description by finding sentences containing
   * dimension keywords.
   */
  private extractStateDescription(
    text: string,
    keywords: string[],
    dimension: string
  ): string {
    const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    const lower = text.toLowerCase();

    // Find the most relevant sentence
    let bestSentence = "";
    let bestScore = 0;

    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (sentenceLower.includes(kw)) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestSentence = sentence;
      }
    }

    return bestSentence || `${dimension} aspect of: ${text.slice(0, 80)}`;
  }

  /**
   * Calculate overall magnitude as weighted average of component gaps,
   * with higher weight given to components that have any keywords.
   */
  private calculateMagnitude(components: TensionComponent[]): number {
    if (components.length === 0) return 0;

    let totalWeight = 0;
    let weightedSum = 0;

    for (const component of components) {
      const weight = component.keywords.length > 0 ? 1.5 : 0.5;
      weightedSum += component.gap * weight;
      totalWeight += weight;
    }

    const magnitude = totalWeight > 0 ? weightedSum / totalWeight : 0;
    return Math.round(magnitude * 100) / 100;
  }

  /**
   * Classify the direction of movement based on magnitude thresholds.
   */
  private classifyDirection(
    magnitude: number
  ): "advancing" | "oscillating" | "stagnant" {
    if (magnitude < this.advancingThreshold) {
      return "advancing";
    } else if (magnitude > this.oscillatingThreshold) {
      return "oscillating";
    } else {
      return "stagnant";
    }
  }

  /**
   * Infer a routing direction for custom dimensions not in the default mapping.
   * Falls back to a hash-based assignment.
   */
  private inferDirection(
    dimension: string
  ): "east" | "south" | "west" | "north" {
    const directions: Array<"east" | "south" | "west" | "north"> = [
      "east",
      "south",
      "west",
      "north",
    ];
    let hash = 0;
    for (let i = 0; i < dimension.length; i++) {
      hash = (hash + dimension.charCodeAt(i)) % directions.length;
    }
    return directions[hash];
  }
}
