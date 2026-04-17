/**
 * Directional Decomposer
 *
 * Decomposes a prompt through the Four Directions:
 * - EAST (Vision/Waabinong): What is being asked? Requirements clarity
 * - SOUTH (Analysis/Zhaawanong): What needs to be learned? Dependencies/research
 * - WEST (Validation/Epangishmok): What needs reflection? Testing/verification
 * - NORTH (Action/Kiiwedinong): What executes? Implementation steps
 *
 * Inspired by mcp-pde and grounded in Medicine Wheel epistemology.
 */

import { v4 as uuid } from "uuid";

// =============================================================================
// Types
// =============================================================================

export enum Direction {
  EAST = "east",
  SOUTH = "south",
  WEST = "west",
  NORTH = "north",
}

export const ALL_DIRECTIONS: Direction[] = [
  Direction.EAST,
  Direction.SOUTH,
  Direction.WEST,
  Direction.NORTH,
];

export const DIRECTION_NAMES: Record<Direction, string> = {
  [Direction.EAST]: "Waabinong (Vision)",
  [Direction.SOUTH]: "Zhaawanong (Analysis)",
  [Direction.WEST]: "Epangishmok (Validation)",
  [Direction.NORTH]: "Kiiwedinong (Action)",
};

export const DIRECTION_QUESTIONS: Record<Direction, string> = {
  [Direction.EAST]: "What is being asked?",
  [Direction.SOUTH]: "What needs to be learned?",
  [Direction.WEST]: "What needs reflection?",
  [Direction.NORTH]: "What executes?",
};

/** Keywords that signal directional intent */
export const DIRECTION_KEYWORDS: Record<Direction, string[]> = {
  [Direction.EAST]: [
    "vision", "goal", "purpose", "intention", "want", "need", "desire",
    "dream", "imagine", "envision", "aspire", "mission", "why", "objective",
    "outcome", "result", "achieve", "create", "build", "design",
  ],
  [Direction.SOUTH]: [
    "learn", "research", "investigate", "understand", "study", "analyze",
    "explore", "discover", "examine", "review", "compare", "assess",
    "dependency", "require", "prerequisite", "context", "background",
    "literature", "existing", "current", "pattern",
  ],
  [Direction.WEST]: [
    "test", "verify", "validate", "check", "ensure", "confirm",
    "reflect", "review", "audit", "quality", "feedback", "iterate",
    "ceremony", "accountable", "responsible", "ethical", "protocol",
    "appropriate", "respectful", "consent",
  ],
  [Direction.NORTH]: [
    "implement", "execute", "deploy", "run", "build", "code", "script",
    "install", "configure", "setup", "create", "write", "develop",
    "ship", "launch", "deliver", "produce", "output", "generate",
    "commit", "push", "merge",
  ],
};

/** A single directional observation */
export interface DirectionalInsight {
  text: string;
  confidence: number;
  implicit: boolean;
}

/** Complete directional analysis of a prompt */
export interface DirectionalAnalysis {
  id: string;
  timestamp: string;
  prompt: string;
  directions: Record<Direction, DirectionalInsight[]>;
  leadDirection: Direction;
  neglectedDirections: Direction[];
  balance: number; // 0-1, how evenly distributed across directions
}

// =============================================================================
// DirectionalDecomposer
// =============================================================================

export interface DecomposerOptions {
  neglectThreshold?: number; // Below this = neglected (default 0.1)
  balanceThreshold?: number; // Above this = balanced (default 0.5)
}

export class DirectionalDecomposer {
  private readonly neglectThreshold: number;
  private readonly balanceThreshold: number;

  constructor(options?: DecomposerOptions) {
    this.neglectThreshold = options?.neglectThreshold ?? 0.1;
    this.balanceThreshold = options?.balanceThreshold ?? 0.5;
  }

  /**
   * Decompose a prompt into Four Directions analysis.
   * Uses keyword-based classification to distribute prompt segments
   * across directional categories.
   */
  decompose(prompt: string): DirectionalAnalysis {
    const id = uuid();
    const sentences = this.splitIntoSegments(prompt);
    const directions: Record<Direction, DirectionalInsight[]> = {
      [Direction.EAST]: [],
      [Direction.SOUTH]: [],
      [Direction.WEST]: [],
      [Direction.NORTH]: [],
    };

    // Classify each segment
    for (const sentence of sentences) {
      const scores = this.scoreSegment(sentence);
      const topDirection = this.getTopDirection(scores);
      const isImplicit = scores[topDirection] < 0.3;

      directions[topDirection].push({
        text: sentence.trim(),
        confidence: Math.min(scores[topDirection] * 2, 1),
        implicit: isImplicit,
      });

      // If a segment has strong presence in multiple directions, add as implicit
      for (const dir of ALL_DIRECTIONS) {
        if (dir !== topDirection && scores[dir] > 0.2) {
          directions[dir].push({
            text: sentence.trim(),
            confidence: scores[dir],
            implicit: true,
          });
        }
      }
    }

    // Calculate balance
    const counts = ALL_DIRECTIONS.map((d) => directions[d].length);
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    const proportions = counts.map((c) => c / total);
    const idealProportion = 0.25;
    const deviation =
      proportions.reduce((sum, p) => sum + Math.abs(p - idealProportion), 0) /
      4;
    const balance = 1 - deviation * 4; // 1 = perfectly balanced

    // Find lead and neglected
    const maxCount = Math.max(...counts);
    const leadDirection =
      ALL_DIRECTIONS[counts.indexOf(maxCount)] || Direction.NORTH;
    const neglectedDirections = ALL_DIRECTIONS.filter(
      (d) => directions[d].length / total < this.neglectThreshold
    );

    return {
      id,
      timestamp: new Date().toISOString(),
      prompt,
      directions,
      leadDirection,
      neglectedDirections,
      balance: Math.max(0, Math.min(1, balance)),
    };
  }

  /** Check if a decomposition is balanced enough to proceed */
  isBalanced(analysis: DirectionalAnalysis): boolean {
    return analysis.balance >= this.balanceThreshold;
  }

  /** Generate guidance for neglected directions */
  getGuidance(analysis: DirectionalAnalysis): string[] {
    const guidance: string[] = [];
    for (const dir of analysis.neglectedDirections) {
      guidance.push(
        `${DIRECTION_NAMES[dir]}: ${DIRECTION_QUESTIONS[dir]} Consider what is missing from this perspective.`
      );
    }
    if (analysis.balance < this.balanceThreshold) {
      guidance.push(
        `Overall balance is ${(analysis.balance * 100).toFixed(0)}% — consider addressing all four directions before proceeding.`
      );
    }
    return guidance;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private splitIntoSegments(text: string): string[] {
    // Split on sentence boundaries, commas for lists, and newlines
    return text
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 3);
  }

  private scoreSegment(segment: string): Record<Direction, number> {
    const lower = segment.toLowerCase();
    const words = lower.split(/\s+/);
    const scores: Record<Direction, number> = {
      [Direction.EAST]: 0,
      [Direction.SOUTH]: 0,
      [Direction.WEST]: 0,
      [Direction.NORTH]: 0,
    };

    for (const dir of ALL_DIRECTIONS) {
      for (const keyword of DIRECTION_KEYWORDS[dir]) {
        for (const word of words) {
          if (word.includes(keyword)) {
            scores[dir] += 1;
          }
        }
      }
    }

    // Normalize
    const total =
      Object.values(scores).reduce((a, b) => a + b, 0) || 1;
    for (const dir of ALL_DIRECTIONS) {
      scores[dir] /= total;
    }

    return scores;
  }

  private getTopDirection(scores: Record<Direction, number>): Direction {
    let top = Direction.NORTH;
    let max = -1;
    for (const dir of ALL_DIRECTIONS) {
      if (scores[dir] > max) {
        max = scores[dir];
        top = dir;
      }
    }
    return top;
  }
}
