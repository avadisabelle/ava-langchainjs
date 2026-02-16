/**
 * Importance Unit Schema
 *
 * Defines the "unit" of importance in a relational system.
 * Importance here is not salience (Western) but accountability (Indigenous).
 *
 * Each unit connects data back to its relational source through
 * Relational Strings: The Land, The Dream, The Code, The Vision.
 * These are not flat tags -- they are living connections that must
 * be maintained and deepened over time.
 */

import { v4 as uuidv4 } from "uuid";
import {
  MedicineWheelQuadrant,
  QuadrantPresence,
  createQuadrantPresence,
} from "./medicine_wheel.js";

/**
 * The four relational sources that every piece of data
 * must be connected back to. These are not categories
 * but living relationships.
 */
export enum RelationalSource {
  /** The Land - grounded, embodied, place-based knowledge. */
  LAND = "land",
  /** The Dream - liminal, intuitive, spirit-adjacent knowing. */
  DREAM = "dream",
  /** The Code - technical artifacts, systems, implementations. */
  CODE = "code",
  /** The Vision - the deeper purpose and directional intent. */
  VISION = "vision",
}

/**
 * All relational sources for iteration.
 */
export const ALL_SOURCES: RelationalSource[] = [
  RelationalSource.LAND,
  RelationalSource.DREAM,
  RelationalSource.CODE,
  RelationalSource.VISION,
];

/**
 * A Relational String connects a piece of data back to one
 * of the four sources. It carries the strength and nature
 * of that connection.
 */
export interface RelationalString {
  source: RelationalSource;
  /** Strength of the connection (0-1). */
  strength: number;
  /** How this data relates to the source. */
  nature: string;
  /** When the connection was last affirmed or deepened. */
  lastAffirmed: string;
}

/**
 * Create a RelationalString with defaults.
 */
export function createRelationalString(
  source: RelationalSource,
  strength: number,
  nature: string
): RelationalString {
  return {
    source,
    strength: Math.max(0, Math.min(1, strength)),
    nature,
    lastAffirmed: new Date().toISOString(),
  };
}

/**
 * The context from which an importance unit emerged.
 * Captures the epistemic conditions of its creation.
 */
export enum ImportanceContext {
  /** Emerged during liminal/dream state. High-context, less filtered. */
  LIMINAL = "liminal",
  /** Emerged during ceremony or relational practice. */
  CEREMONIAL = "ceremonial",
  /** Emerged during analytical/technical work. */
  ANALYTICAL = "analytical",
  /** Emerged during collaborative dialogue. */
  DIALOGICAL = "dialogical",
  /** Emerged during land-based exploration or circling. */
  EXPLORATORY = "exploratory",
  /** Extracted by automated processing. Requires validation. */
  EXTRACTED = "extracted",
}

/**
 * Context weight multipliers. Liminal and ceremonial contexts
 * receive higher weight because they are less filtered by
 * the rational mind's pruning.
 */
export const CONTEXT_WEIGHTS: Record<ImportanceContext, number> = {
  [ImportanceContext.LIMINAL]: 1.5,
  [ImportanceContext.CEREMONIAL]: 1.4,
  [ImportanceContext.DIALOGICAL]: 1.2,
  [ImportanceContext.EXPLORATORY]: 1.3,
  [ImportanceContext.ANALYTICAL]: 1.0,
  [ImportanceContext.EXTRACTED]: 0.7,
};

/**
 * The core schema for a unit of importance.
 *
 * This is not a "task" or "note" -- it is a relational object
 * that carries accountability back to its sources and tracks
 * how it deepens through epistemic iteration.
 */
export interface ImportanceUnit {
  id: string;

  /** The content or insight itself. */
  content: string;

  /** Where in the system this unit originated. */
  sourceSessionId: string;
  sourceInputId?: string;

  /** Relational strings connecting to the four sources. */
  relationalStrings: RelationalString[];

  /** The epistemic context of emergence. */
  context: ImportanceContext;

  /** Medicine Wheel quadrant presence at time of capture. */
  wheelPresence: QuadrantPresence;

  /**
   * Accountability score: how well this unit maintains
   * connection to its relational sources. Decays if not
   * reaffirmed through epistemic iteration.
   */
  accountabilityScore: number;

  /**
   * Value alignment score: how well this unit aligns with
   * the core values (Research Is Ceremony, relationality, etc.).
   */
  valueAlignmentScore: number;

  /** Number of times this unit has been revisited/deepened. */
  iterationCount: number;

  /** Whether this unit has been validated by a human. */
  humanValidated: boolean;

  /** Tags from explicit and implicit asks. */
  explicitAsks: string[];
  implicitAsks: string[];

  /** Timestamps. */
  createdAt: string;
  updatedAt: string;
  lastRevisitedAt?: string;
}

/**
 * Create an ImportanceUnit with defaults.
 */
export function createImportanceUnit(
  content: string,
  sourceSessionId: string,
  context: ImportanceContext,
  options: Partial<ImportanceUnit> = {}
): ImportanceUnit {
  const contextWeight = CONTEXT_WEIGHTS[context];

  return {
    id: options.id ?? uuidv4(),
    content,
    sourceSessionId,
    sourceInputId: options.sourceInputId,
    relationalStrings: options.relationalStrings ?? [],
    context,
    wheelPresence: options.wheelPresence ?? createQuadrantPresence(),
    accountabilityScore: (options.accountabilityScore ?? 0.5) * contextWeight,
    valueAlignmentScore: options.valueAlignmentScore ?? 0.5,
    iterationCount: options.iterationCount ?? 0,
    humanValidated: options.humanValidated ?? false,
    explicitAsks: options.explicitAsks ?? [],
    implicitAsks: options.implicitAsks ?? [],
    createdAt: options.createdAt ?? new Date().toISOString(),
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    lastRevisitedAt: options.lastRevisitedAt,
  };
}

/**
 * Deepen an importance unit through revisitation.
 * Each revisit strengthens accountability and records
 * what was added or refined.
 */
export function deepenUnit(
  unit: ImportanceUnit,
  refinement: string,
  newContext?: ImportanceContext
): void {
  unit.iterationCount += 1;
  unit.lastRevisitedAt = new Date().toISOString();
  unit.updatedAt = new Date().toISOString();

  // Strengthen accountability on revisit
  const contextBoost = newContext
    ? CONTEXT_WEIGHTS[newContext] * 0.1
    : 0.05;
  unit.accountabilityScore = Math.min(
    1.0,
    unit.accountabilityScore + contextBoost
  );

  // Append refinement to content (circling deepens, not replaces)
  if (refinement.trim()) {
    unit.content = `${unit.content}\n---\n[Iteration ${unit.iterationCount}]: ${refinement}`;
  }
}

/**
 * Decay accountability over time if not revisited.
 * Called periodically to ensure units that lose relational
 * connection are surfaced for attention.
 */
export function decayAccountability(
  unit: ImportanceUnit,
  decayFactor: number = 0.95
): void {
  unit.accountabilityScore = Math.max(
    0.1,
    unit.accountabilityScore * decayFactor
  );
  unit.updatedAt = new Date().toISOString();
}

/**
 * Connect a unit to a relational source.
 */
export function connectToSource(
  unit: ImportanceUnit,
  source: RelationalSource,
  strength: number,
  nature: string
): void {
  const existing = unit.relationalStrings.find(
    (rs) => rs.source === source
  );

  if (existing) {
    // Deepen existing connection
    existing.strength = Math.min(1.0, existing.strength + strength * 0.5);
    existing.nature = `${existing.nature}; ${nature}`;
    existing.lastAffirmed = new Date().toISOString();
  } else {
    unit.relationalStrings.push(
      createRelationalString(source, strength, nature)
    );
  }

  unit.updatedAt = new Date().toISOString();
}

/**
 * Calculate how well-connected a unit is to its relational sources.
 * A fully connected unit has strong strings to all four sources.
 */
export function calculateRelationalCompleteness(
  unit: ImportanceUnit
): number {
  const connected = new Set(unit.relationalStrings.map((rs) => rs.source));
  const sourceCount = ALL_SOURCES.length;

  // Base score: fraction of sources connected
  const connectionFraction = connected.size / sourceCount;

  // Strength score: average strength of existing connections
  const avgStrength =
    unit.relationalStrings.length > 0
      ? unit.relationalStrings.reduce((sum, rs) => sum + rs.strength, 0) /
        unit.relationalStrings.length
      : 0;

  return connectionFraction * 0.6 + avgStrength * 0.4;
}

/**
 * Determine whether implicit asks should override explicit asks.
 * Implicit asks (values you live by) always overrule explicit asks
 * (the code you want written) when there is a value conflict.
 */
export function hasValueConflict(unit: ImportanceUnit): boolean {
  // If value alignment is low but the unit has high accountability,
  // there may be a conflict between what is being asked and what is valued.
  return (
    unit.valueAlignmentScore < 0.4 && unit.accountabilityScore > 0.6
  );
}

/**
 * Importance Store: manages a collection of importance units
 * with update, retrieval, and decay operations.
 */
export class ImportanceStore {
  private units: Map<string, ImportanceUnit> = new Map();

  /**
   * Add a new importance unit.
   */
  add(unit: ImportanceUnit): void {
    this.units.set(unit.id, unit);
  }

  /**
   * Get a unit by ID.
   */
  get(id: string): ImportanceUnit | undefined {
    return this.units.get(id);
  }

  /**
   * Get all units, optionally filtered.
   */
  getAll(filter?: {
    context?: ImportanceContext;
    source?: RelationalSource;
    minAccountability?: number;
    humanValidatedOnly?: boolean;
  }): ImportanceUnit[] {
    let results = Array.from(this.units.values());

    if (filter) {
      if (filter.context !== undefined) {
        results = results.filter((u) => u.context === filter.context);
      }
      if (filter.source !== undefined) {
        results = results.filter((u) =>
          u.relationalStrings.some((rs) => rs.source === filter.source)
        );
      }
      if (filter.minAccountability !== undefined) {
        results = results.filter(
          (u) => u.accountabilityScore >= filter.minAccountability!
        );
      }
      if (filter.humanValidatedOnly) {
        results = results.filter((u) => u.humanValidated);
      }
    }

    return results;
  }

  /**
   * Get units sorted by accountability score (highest first).
   */
  getByAccountability(limit: number = 10): ImportanceUnit[] {
    return Array.from(this.units.values())
      .sort((a, b) => b.accountabilityScore - a.accountabilityScore)
      .slice(0, limit);
  }

  /**
   * Get units that need attention (low accountability, high iteration).
   */
  getNeedingAttention(limit: number = 10): ImportanceUnit[] {
    return Array.from(this.units.values())
      .filter(
        (u) => u.accountabilityScore < 0.4 || hasValueConflict(u)
      )
      .sort((a, b) => a.accountabilityScore - b.accountabilityScore)
      .slice(0, limit);
  }

  /**
   * Apply decay to all units that haven't been revisited recently.
   */
  applyDecay(decayFactor: number = 0.95): void {
    for (const unit of this.units.values()) {
      decayAccountability(unit, decayFactor);
    }
  }

  /**
   * Remove a unit.
   */
  remove(id: string): boolean {
    return this.units.delete(id);
  }

  /**
   * Get total count.
   */
  get size(): number {
    return this.units.size;
  }

  /**
   * Serialize all units to JSON.
   */
  serialize(): string {
    return JSON.stringify(Array.from(this.units.values()));
  }

  /**
   * Load units from JSON.
   */
  load(json: string): void {
    const units: ImportanceUnit[] = JSON.parse(json);
    for (const unit of units) {
      this.units.set(unit.id, unit);
    }
  }
}
