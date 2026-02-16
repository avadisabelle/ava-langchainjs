/**
 * Liminal Data Buffer
 *
 * A specific high-context buffer for dream-state and liminal recordings.
 * These are not "low-quality" inputs; they are "high-context" inputs.
 * The agent should give higher weight to values expressed in liminal
 * states, as they are less filtered by the rational mind's pruning.
 *
 * The Liminal Buffer serves as the "Root Context" that informs how
 * all other "Lower-Context" (technical) tasks are pruned.
 */

import { v4 as uuidv4 } from "uuid";
import {
  ImportanceUnit,
  ImportanceContext,
  createImportanceUnit,
  RelationalSource,
  connectToSource,
} from "./importance_unit.js";
import {
  MedicineWheelFilter,
  MedicineWheelQuadrant,
  WheelAssessment,
} from "./medicine_wheel.js";

/**
 * The mode of consciousness from which a liminal input arose.
 */
export enum LiminalMode {
  /** Half-awake, between sleep and waking. Spirit-adjacent. */
  HYPNAGOGIC = "hypnagogic",
  /** Dream recall upon waking. */
  DREAM_RECALL = "dream_recall",
  /** Deep contemplation or meditation. */
  CONTEMPLATIVE = "contemplative",
  /** Ceremony or ritual context. */
  CEREMONIAL = "ceremonial",
  /** Land-based walking/exploration. */
  LAND_WALK = "land_walk",
  /** Spontaneous insight during other activity. */
  SPONTANEOUS = "spontaneous",
}

/**
 * Weight multipliers for liminal modes.
 * More liminal = higher weight, as these inputs
 * are less filtered by rational pruning.
 */
export const LIMINAL_MODE_WEIGHTS: Record<LiminalMode, number> = {
  [LiminalMode.HYPNAGOGIC]: 1.5,
  [LiminalMode.DREAM_RECALL]: 1.4,
  [LiminalMode.CEREMONIAL]: 1.5,
  [LiminalMode.CONTEMPLATIVE]: 1.3,
  [LiminalMode.LAND_WALK]: 1.3,
  [LiminalMode.SPONTANEOUS]: 1.2,
};

/**
 * A liminal input captured from a dream-adjacent or
 * high-context state.
 */
export interface LiminalInput {
  id: string;
  /** The raw content of the liminal input. */
  content: string;
  /** The mode of consciousness. */
  mode: LiminalMode;
  /** Weight multiplier based on mode. */
  weight: number;
  /** Session in which this was captured. */
  sessionId: string;
  /** Source recording or file, if applicable. */
  sourceFile?: string;
  /** Medicine Wheel assessment. */
  wheelAssessment?: WheelAssessment;
  /** Extracted importance units. */
  importanceUnits: ImportanceUnit[];
  /** Whether this input has been integrated into the main context. */
  integrated: boolean;
  /** How many times this input has influenced other decisions. */
  influenceCount: number;
  /** Timestamp of capture. */
  capturedAt: string;
  /** Timestamp of integration. */
  integratedAt?: string;
}

/**
 * Create a LiminalInput.
 */
export function createLiminalInput(
  content: string,
  mode: LiminalMode,
  sessionId: string,
  options: Partial<LiminalInput> = {}
): LiminalInput {
  return {
    id: options.id ?? uuidv4(),
    content,
    mode,
    weight: LIMINAL_MODE_WEIGHTS[mode],
    sessionId,
    sourceFile: options.sourceFile,
    wheelAssessment: options.wheelAssessment,
    importanceUnits: options.importanceUnits ?? [],
    integrated: options.integrated ?? false,
    influenceCount: options.influenceCount ?? 0,
    capturedAt: options.capturedAt ?? new Date().toISOString(),
    integratedAt: options.integratedAt,
  };
}

/**
 * The Liminal Buffer stores high-context inputs and serves as
 * root context for the entire system. Technical tasks are pruned
 * relative to this root, not the other way around.
 *
 * @example
 * ```typescript
 * const buffer = new LiminalBuffer();
 *
 * // Capture a half-awake recording
 * const input = buffer.capture(
 *   "The system needs to breathe... the knowledge graph should be alive, not flat...",
 *   LiminalMode.HYPNAGOGIC,
 *   "session_123",
 *   { sourceFile: "recording_2am.m4a" }
 * );
 *
 * // The input gets higher weight than technical inputs
 * console.log(input.weight); // 1.5
 *
 * // Check if technical work aligns with liminal context
 * const aligned = buffer.checkAlignment("Add flat JSON schema for knowledge graph");
 * console.log(aligned.conflicts); // ["Liminal context suggests living, not flat structure"]
 * ```
 */
export class LiminalBuffer {
  private inputs: Map<string, LiminalInput> = new Map();
  private wheelFilter: MedicineWheelFilter;

  constructor() {
    this.wheelFilter = new MedicineWheelFilter();
  }

  /**
   * Capture a liminal input into the buffer.
   * Automatically assesses through the Medicine Wheel
   * and creates initial importance units.
   */
  capture(
    content: string,
    mode: LiminalMode,
    sessionId: string,
    options: { sourceFile?: string } = {}
  ): LiminalInput {
    const input = createLiminalInput(content, mode, sessionId, {
      sourceFile: options.sourceFile,
    });

    // Assess through Medicine Wheel
    input.wheelAssessment = this.wheelFilter.assess(input.id, content);

    // Create an importance unit from this liminal input
    const unit = createImportanceUnit(
      content,
      sessionId,
      mode === LiminalMode.CEREMONIAL
        ? ImportanceContext.CEREMONIAL
        : ImportanceContext.LIMINAL,
      {
        sourceInputId: input.id,
        wheelPresence: input.wheelAssessment.presence,
      }
    );

    // Connect to Dream and Vision sources (liminal inputs primarily relate to these)
    connectToSource(
      unit,
      RelationalSource.DREAM,
      0.9,
      `Captured during ${mode} state`
    );
    connectToSource(
      unit,
      RelationalSource.VISION,
      0.7,
      "Liminal insight informing project direction"
    );

    input.importanceUnits.push(unit);
    this.inputs.set(input.id, input);

    return input;
  }

  /**
   * Get a liminal input by ID.
   */
  get(id: string): LiminalInput | undefined {
    return this.inputs.get(id);
  }

  /**
   * Get all liminal inputs, optionally filtered.
   */
  getAll(filter?: {
    mode?: LiminalMode;
    integrated?: boolean;
    minWeight?: number;
  }): LiminalInput[] {
    let results = Array.from(this.inputs.values());

    if (filter) {
      if (filter.mode !== undefined) {
        results = results.filter((i) => i.mode === filter.mode);
      }
      if (filter.integrated !== undefined) {
        results = results.filter((i) => i.integrated === filter.integrated);
      }
      if (filter.minWeight !== undefined) {
        results = results.filter((i) => i.weight >= filter.minWeight!);
      }
    }

    return results;
  }

  /**
   * Get unintegrated inputs sorted by weight (highest first).
   * These are the root context that should inform all other work.
   */
  getRootContext(limit: number = 10): LiminalInput[] {
    return Array.from(this.inputs.values())
      .filter((i) => !i.integrated)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);
  }

  /**
   * Check whether proposed technical work aligns with
   * the liminal root context.
   */
  checkAlignment(proposedAction: string): {
    aligned: boolean;
    conflicts: string[];
    supportingInputs: string[];
  } {
    const actionAssessment = this.wheelFilter.assess(
      "action-check",
      proposedAction
    );
    const conflicts: string[] = [];
    const supportingInputs: string[] = [];

    // Compare against all unintegrated liminal inputs
    for (const input of this.getRootContext()) {
      if (!input.wheelAssessment) continue;

      // Check if the action neglects quadrants the liminal input emphasized
      for (const quadrant of [
        MedicineWheelQuadrant.SPIRITUAL,
        MedicineWheelQuadrant.EMOTIONAL,
      ]) {
        const liminalPresence = input.wheelAssessment.presence[quadrant];
        const actionPresence = actionAssessment.presence[quadrant];

        if (liminalPresence > 0.3 && actionPresence < 0.1) {
          conflicts.push(
            `Liminal context emphasizes ${quadrant} (${(liminalPresence * 100).toFixed(0)}%) ` +
            `but proposed action neglects it (${(actionPresence * 100).toFixed(0)}%). ` +
            `Source: "${input.content.substring(0, 80)}..."`
          );
        }
      }

      // Check for conceptual support
      const inputWords = new Set(input.content.toLowerCase().split(/\s+/));
      const actionWords = proposedAction.toLowerCase().split(/\s+/);
      const overlap = actionWords.filter((w) => inputWords.has(w) && w.length > 4);

      if (overlap.length > 2) {
        supportingInputs.push(input.id);
      }
    }

    return {
      aligned: conflicts.length === 0,
      conflicts,
      supportingInputs,
    };
  }

  /**
   * Mark a liminal input as integrated into the main context.
   */
  markIntegrated(id: string): void {
    const input = this.inputs.get(id);
    if (input) {
      input.integrated = true;
      input.integratedAt = new Date().toISOString();
    }
  }

  /**
   * Record that a liminal input influenced a decision.
   */
  recordInfluence(id: string): void {
    const input = this.inputs.get(id);
    if (input) {
      input.influenceCount += 1;
    }
  }

  /**
   * Get the most influential liminal inputs.
   */
  getMostInfluential(limit: number = 5): LiminalInput[] {
    return Array.from(this.inputs.values())
      .sort((a, b) => b.influenceCount - a.influenceCount)
      .slice(0, limit);
  }

  /**
   * Get total count of liminal inputs.
   */
  get size(): number {
    return this.inputs.size;
  }

  /**
   * Serialize the buffer to JSON.
   */
  serialize(): string {
    return JSON.stringify(Array.from(this.inputs.values()));
  }

  /**
   * Load inputs from JSON.
   */
  load(json: string): void {
    const inputs: LiminalInput[] = JSON.parse(json);
    for (const input of inputs) {
      this.inputs.set(input.id, input);
    }
  }
}
