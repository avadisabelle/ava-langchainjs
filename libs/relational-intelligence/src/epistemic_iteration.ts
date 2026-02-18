/**
 * Epistemic Iteration Tracker
 *
 * Tracks the depth of the spiral when topics are revisited.
 * In Western systems, redundancy is "noise" or "inefficiency."
 * In Indigenous epistemology, repetition is ceremony. Each time
 * you circle back, you deepen the relationship.
 *
 * The system must stop trying to "de-duplicate" thoughts.
 * It needs to measure the depth of the spiral.
 */

import { v4 as uuidv4 } from "uuid";
import { BaseChatModel, BaseLLM } from "@langchain/core/language_models/base";
import { z } from "zod";

/**
 * A single pass through a topic during epistemic circling.
 * Each circle captures what was present at that moment.
 */
export interface EpistemicCircle {
  id: string;
  /** The topic or concept being circled. */
  topicKey: string;
  /** The iteration number (1st circle, 2nd circle, etc.). */
  iteration: number;
  /** The content/insight at this point in the spiral. */
  content: string;
  /** What was added or refined compared to the previous circle. */
  delta: string;
  /** Session in which this circling occurred. */
  sessionId: string;
  /** Source input that triggered this return. */
  sourceInputId?: string;
  /** Timestamp of this circle. */
  timestamp: string;
}

/**
 * Create an EpistemicCircle with defaults.
 */
export function createEpistemicCircle(
  topicKey: string,
  iteration: number,
  content: string,
  sessionId: string,
  options: Partial<EpistemicCircle> = {}
): EpistemicCircle {
  return {
    id: options.id ?? uuidv4(),
    topicKey,
    iteration,
    content,
    delta: options.delta ?? "",
    sessionId,
    sourceInputId: options.sourceInputId,
    timestamp: options.timestamp ?? new Date().toISOString(),
  };
}

/**
 * A spiral represents the full history of circling around a topic.
 * The important lines are often found in the subtle shifts between
 * the third and fourth time a topic is discussed.
 */
export interface Spiral {
  topicKey: string;
  /** Human-readable name for the topic being circled. */
  topicName: string;
  /** All circles in chronological order. */
  circles: EpistemicCircle[];
  /** The depth of the spiral (number of circles). */
  depth: number;
  /** Whether the spiral is still active (being returned to). */
  active: boolean;
  /** The accumulated understanding across all circles. */
  accumulatedInsight: string;
  /** When the spiral was first opened. */
  openedAt: string;
  /** When the spiral was last visited. */
  lastVisitedAt: string;
}

/**
 * Create a new Spiral.
 */
export function createSpiral(
  topicKey: string,
  topicName: string,
  initialContent: string,
  sessionId: string
): Spiral {
  const firstCircle = createEpistemicCircle(
    topicKey,
    1,
    initialContent,
    sessionId
  );

  return {
    topicKey,
    topicName,
    circles: [firstCircle],
    depth: 1,
    active: true,
    accumulatedInsight: initialContent,
    openedAt: new Date().toISOString(),
    lastVisitedAt: new Date().toISOString(),
  };
}

/**
 * Analysis of what changed between circles.
 */
export interface SpiralShiftAnalysis {
  /** The circle being analyzed. */
  circleId: string;
  /** Which iteration this is. */
  iteration: number;
  /** Concepts that appeared for the first time. */
  newConcepts: string[];
  /** Concepts that were refined or deepened. */
  refinedConcepts: string[];
  /** The nature of the shift (deepening, expanding, converging). */
  shiftType: SpiralShiftType;
  /** A score (0-1) indicating how significant the shift was. */
  significance: number;
}

/**
 * Types of shift that can occur between circles.
 */
export enum SpiralShiftType {
  /** The spiral is going deeper into existing territory. */
  DEEPENING = "deepening",
  /** The spiral is expanding to include new territory. */
  EXPANDING = "expanding",
  /** The spiral is converging toward a synthesis. */
  CONVERGING = "converging",
  /** The spiral is returning to a previous position with new eyes. */
  RETURNING = "returning",
  /** The first time a topic is introduced. */
  OPENING = "opening",
}

// Zod schema for LLM concept extraction output
const ConceptsSchema = z.array(z.string()).describe("A list of key concepts extracted from the content.");

export interface SpiralTrackerOptions {
  llm?: BaseChatModel | BaseLLM;
}

/**
 * The Spiral Tracker manages epistemic iteration across sessions.
 * It recognizes circling as a meaningful epistemic structure,
 * not noise or redundancy.
 *
 * @example
 * ```typescript
 * const tracker = new SpiralTracker();
 *
 * // First mention of knowledge graph
 * tracker.recordCircle("knowledge_graph", "Knowledge Graph Design",
 *   "We need a knowledge graph that respects relational ontology", "session_1");
 *
 * // Second return to topic
 * tracker.recordCircle("knowledge_graph", "Knowledge Graph Design",
 *   "The graph should use Medicine Wheel as ontological filter", "session_1");
 *
 * // Check spiral depth
 * const spiral = tracker.getSpiral("knowledge_graph");
 * console.log(spiral.depth); // 2
 *
 * // Get shift analysis
 * const shifts = tracker.analyzeShifts("knowledge_graph");
 * // shifts[1].shiftType might be EXPANDING
 * ```
 */
export class SpiralTracker {
  private spirals: Map<string, Spiral> = new Map();
  private llm?: BaseChatModel | BaseLLM;

  constructor(options?: SpiralTrackerOptions) {
    this.llm = options?.llm;
  }

  /**
   * Record a new circle for a topic. If the topic is new, opens a spiral.
   * If returning, adds a new circle and analyzes the shift.
   */
  async recordCircle(
    topicKey: string,
    topicName: string,
    content: string,
    sessionId: string,
    sourceInputId?: string
  ): Promise<EpistemicCircle> {
    const existing = this.spirals.get(topicKey);

    if (!existing) {
      // New spiral
      const spiral = createSpiral(topicKey, topicName, content, sessionId);
      spiral.circles[0].sourceInputId = sourceInputId;
      this.spirals.set(topicKey, spiral);
      return spiral.circles[0];
    }

    // Returning to existing topic -- add a new circle
    const iteration = existing.depth + 1;
    const previousContent =
      existing.circles[existing.circles.length - 1].content;
    const delta = this.computeDelta(previousContent, content);

    const circle = createEpistemicCircle(
      topicKey,
      iteration,
      content,
      sessionId,
      { delta, sourceInputId }
    );

    existing.circles.push(circle);
    existing.depth = iteration;
    existing.active = true;
    existing.lastVisitedAt = new Date().toISOString();
    existing.accumulatedInsight = this.accumulateInsight(existing);

    return circle;
  }

  /**
   * Get a spiral by topic key.
   */
  getSpiral(topicKey: string): Spiral | undefined {
    return this.spirals.get(topicKey);
  }

  /**
   * Get all active spirals.
   */
  getActiveSpirals(): Spiral[] {
    return Array.from(this.spirals.values()).filter((s) => s.active);
  }

  /**
   * Get spirals sorted by depth (deepest first).
   * The deepest spirals are the most important --
   * they have been returned to the most.
   */
  getByDepth(limit: number = 10): Spiral[] {
    return Array.from(this.spirals.values())
      .sort((a, b) => b.depth - a.depth)
      .slice(0, limit);
  }

  /**
   * Analyze the shifts between circles in a spiral.
   * This is where the "important lines" live --
   * in the subtle shifts between iterations.
   */
  async analyzeShifts(topicKey: string): Promise<SpiralShiftAnalysis[]> {
    const spiral = this.spirals.get(topicKey);
    if (!spiral) return [];

    const shifts: SpiralShiftAnalysis[] = [];
    for (let index = 0; index < spiral.circles.length; index++) {
      const circle = spiral.circles[index];
      if (index === 0) {
        shifts.push({
          circleId: circle.id,
          iteration: circle.iteration,
          newConcepts: await this.extractConcepts(circle.content),
          refinedConcepts: [],
          shiftType: SpiralShiftType.OPENING,
          significance: 1.0,
        });
        continue;
      }

      const previousCircle = spiral.circles[index - 1];
      const prevConcepts = new Set(
        await this.extractConcepts(previousCircle.content)
      );
      const currentConcepts = await this.extractConcepts(circle.content);

      const newConcepts = currentConcepts.filter(
        (c) => !prevConcepts.has(c)
      );
      const refinedConcepts = currentConcepts.filter((c) =>
        prevConcepts.has(c)
      );

      const shiftType = this.classifyShift(
        newConcepts.length,
        refinedConcepts.length,
        currentConcepts.length
      );

      // Significance increases with depth -- the 4th circle
      // is more significant than the 2nd
      const depthBonus = Math.min(1.0, index * 0.15);
      const changeRatio =
        currentConcepts.length > 0
          ? (newConcepts.length + refinedConcepts.length * 0.5) /
            currentConcepts.length
          : 0;
      const significance = Math.min(1.0, changeRatio + depthBonus);

      shifts.push({
        circleId: circle.id,
        iteration: circle.iteration,
        newConcepts,
        refinedConcepts,
        shiftType,
        significance,
      });
    }
    return shifts;
  }

  /**
   * Mark a spiral as no longer active (converged or paused).
   */
  closeSpiral(topicKey: string): void {
    const spiral = this.spirals.get(topicKey);
    if (spiral) {
      spiral.active = false;
    }
  }

  /**
   * Get total spiral count.
   */
  get size(): number {
    return this.spirals.size;
  }

  /**
   * Serialize all spirals to JSON.
   */
  serialize(): string {
    return JSON.stringify(
      Array.from(this.spirals.entries()).map(([key, spiral]) => ({
        key,
        ...spiral,
      }))
    );
  }

  /**
   * Load spirals from JSON.
   */
  load(json: string): void {
    const entries: Array<{ key: string } & Spiral> = JSON.parse(json);
    for (const entry of entries) {
      const { key, ...spiral } = entry;
      this.spirals.set(key, spiral);
    }
  }

  /**
   * Compute what changed between two pieces of content.
   */
  private computeDelta(previous: string, current: string): string {
    const prevWords = new Set(previous.toLowerCase().split(/\s+/));
    const currentWords = current.toLowerCase().split(/\s+/);
    const newWords = currentWords.filter((w) => !prevWords.has(w));

    if (newWords.length === 0) {
      return "[Returned with no new language -- deepening through presence]";
    }

    return `New elements: ${newWords.slice(0, 20).join(", ")}`;
  }

  /**
   * Extract key concepts from content (simplified).
   * In production, this would use NLP or an LLM.
   */
  private async extractConcepts(content: string): Promise<string[]> {
    if (this.llm) {
      try {
        return await this._extractConceptsWithLLM(content);
      } catch (e) {
        console.warn("LLM concept extraction failed, falling back to heuristics:", e);
      }
    }

    const words = content.toLowerCase().split(/\s+/);
    // Filter to significant words (>4 chars, not common stop words)
    const stopWords = new Set([
      "the", "and", "that", "this", "with", "from", "have",
      "been", "will", "would", "could", "should", "about",
      "into", "they", "their", "there", "which", "when", "what",
      "also", "more", "some", "than", "just", "very", "being",
    ]);

    return [...new Set(
      words.filter(
        (w) => w.length > 4 && !stopWords.has(w) && /^[a-z]+$/.test(w)
      )
    )];
  }

  private async _extractConceptsWithLLM(content: string): Promise<string[]> {
    if (!this.llm) {
      throw new Error("LLM not provided for LLM-based concept extraction.");
    }

    const systemPrompt = `You are an expert at extracting key concepts from text.
Your task is to analyze the provided content and identify the most important and distinct concepts discussed.
Return these concepts as a JSON array of strings. Each string should be a concise representation of a concept.

Output your assessment as a JSON object matching the following Zod schema:

${ConceptsSchema._getCssInJs().join("\n")}

Ensure the JSON is perfectly valid and can be directly parsed. Do not include any additional text outside the JSON object.
`;

    const response = await this.llm.invoke([
      ["system", systemPrompt],
      ["human", `Content to extract concepts from: "${content}"`],
    ]);

    const resContent = typeof response === "string" ? response : response.content;

    let parsedResult;
    try {
      parsedResult = JSON.parse(resContent);
    } catch (e) {
      console.error("Failed to parse LLM response as JSON for SpiralTracker concept extraction:", e);
      console.error("LLM response content:", resContent);
      throw new Error("LLM output was not valid JSON for ConceptsSchema.");
    }

    const validationResult = ConceptsSchema.safeParse(parsedResult);
    if (!validationResult.success) {
      console.error("LLM output did not match schema for SpiralTracker concept extraction:", validationResult.error);
      throw new Error("LLM output did not match expected schema for ConceptsSchema.");
    }

    return validationResult.data;
  }

  /**
   * Classify the type of shift between circles.
   */
  private classifyShift(
    newCount: number,
    refinedCount: number,
    totalCount: number
  ): SpiralShiftType {
    if (totalCount === 0) return SpiralShiftType.RETURNING;

    const newRatio = newCount / totalCount;
    const refinedRatio = refinedCount / totalCount;

    if (newRatio > 0.5) return SpiralShiftType.EXPANDING;
    if (refinedRatio > 0.6) return SpiralShiftType.DEEPENING;
    if (newRatio < 0.2 && refinedRatio > 0.3) return SpiralShiftType.CONVERGING;
    return SpiralShiftType.RETURNING;
  }

  /**
   * Build accumulated insight from all circles.
   */
  private accumulateInsight(spiral: Spiral): string {
    return spiral.circles
      .map(
        (c) =>
          `[Circle ${c.iteration} - ${c.timestamp}]: ${c.content}`
      )
      .join("\n\n");
  }
}
