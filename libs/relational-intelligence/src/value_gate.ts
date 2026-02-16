/**
 * Value Gate
 *
 * Implements gating conditions based on Research Is Ceremony and
 * the Medicine Wheel. Before an agent autonomously advances work,
 * it must pass through value gates that check whether the action
 * strengthens the relationship between the Spirit of the project
 * (the vision) and the Body of the project (the code).
 *
 * Importance is not "salience" (Western); importance is
 * "Accountability" (Indigenous).
 */

import { v4 as uuidv4 } from "uuid";
import {
  MedicineWheelQuadrant,
  WheelAssessment,
  MedicineWheelFilter,
} from "./medicine_wheel.js";

/**
 * A hard constraint that cannot be overridden by agents.
 * If a generative trajectory moves away from core values,
 * the system triggers a stop-work order.
 */
export interface ValueConstraint {
  id: string;
  /** Human-readable name of the constraint. */
  name: string;
  /** Description of what this constraint protects. */
  description: string;
  /** Whether this is a hard stop (blocks action) or soft warning. */
  severity: ConstraintSeverity;
  /** The check function returns true if the constraint is satisfied. */
  check: (context: GateContext) => GateResult;
  /** Whether this constraint is currently active. */
  active: boolean;
}

export enum ConstraintSeverity {
  /** Blocks autonomous action entirely. Requires human loop-in. */
  HARD_STOP = "hard_stop",
  /** Warns but allows action with acknowledgment. */
  WARNING = "warning",
  /** Informational -- logged but does not block. */
  ADVISORY = "advisory",
}

/**
 * Context passed to value gate checks.
 */
export interface GateContext {
  /** The proposed action or content. */
  action: string;
  /** Description of what the action does. */
  actionDescription: string;
  /** Which agent is proposing this action. */
  agentId: string;
  /** The current session context. */
  sessionId: string;
  /** Medicine Wheel assessment of the action (if available). */
  wheelAssessment?: WheelAssessment;
  /** Additional metadata. */
  metadata: Record<string, unknown>;
}

/**
 * Result of a gate check.
 */
export interface GateResult {
  /** Whether the constraint is satisfied. */
  passed: boolean;
  /** Explanation of why it passed or failed. */
  reason: string;
  /** Suggested remediation if it failed. */
  remediation?: string;
}

/**
 * The overall verdict from all gate checks.
 */
export interface GateVerdict {
  id: string;
  /** Whether the action can proceed. */
  canProceed: boolean;
  /** Whether human involvement is required. */
  requiresHuman: boolean;
  /** Individual results from each constraint. */
  results: Array<{
    constraintId: string;
    constraintName: string;
    severity: ConstraintSeverity;
    result: GateResult;
  }>;
  /** Summary of what failed. */
  failureSummary: string[];
  /** Timestamp. */
  timestamp: string;
}

/**
 * Create the Research Is Ceremony constraint.
 * Research Is Ceremony is a required context, not optional.
 * The agent must "gather" that context before proceeding on
 * Indigenous knowledge / ontology / methodology questions.
 */
export function createResearchIsCeremonyConstraint(): ValueConstraint {
  const ceremonialKeywords = [
    "indigenous", "ceremony", "medicine wheel", "relational",
    "ontology", "epistemology", "axiology", "methodology",
    "research is ceremony", "sean wilson", "land-based",
    "elder", "ancestor", "protocol", "treaty", "sovereignty",
    "k'é", "kinship",
  ];

  return {
    id: "ric-001",
    name: "Research Is Ceremony",
    description:
      "Ensures that Research Is Ceremony context has been gathered " +
      "before the system proceeds on Indigenous knowledge, ontology, " +
      "or methodology questions. This is a required context, not optional.",
    severity: ConstraintSeverity.HARD_STOP,
    active: true,
    check: (context: GateContext): GateResult => {
      const lower = context.action.toLowerCase() +
        " " +
        context.actionDescription.toLowerCase();

      const touchesIndigenous = ceremonialKeywords.some((kw) =>
        lower.includes(kw)
      );

      if (!touchesIndigenous) {
        return {
          passed: true,
          reason: "Action does not engage Indigenous knowledge domains.",
        };
      }

      // Check if ceremony context has been gathered
      const hasCeremonyContext =
        context.metadata.researchIsCeremonyGathered === true ||
        context.metadata.ceremonyContextPresent === true;

      if (hasCeremonyContext) {
        return {
          passed: true,
          reason:
            "Research Is Ceremony context has been gathered. " +
            "Proceeding with relational accountability.",
        };
      }

      return {
        passed: false,
        reason:
          "This action engages Indigenous knowledge domains but " +
          "Research Is Ceremony context has not been gathered. " +
          "The system must pause and gather this context first.",
        remediation:
          "Gather Research Is Ceremony (Wilson, 2008) as foundational " +
          "context before proceeding. This includes understanding " +
          "relational accountability, Indigenous epistemology, " +
          "axiology, ontology, and methodology.",
      };
    },
  };
}

/**
 * Create the Relational Check-Back constraint.
 * Before an agent autonomously advances a task, it must ask:
 * "Does this action strengthen the relationship between the
 * Spirit of the project (vision) and the Body of the project (code)?"
 */
export function createRelationalCheckBackConstraint(): ValueConstraint {
  return {
    id: "rcb-001",
    name: "Relational Check-Back",
    description:
      "Verifies that autonomous actions strengthen the relationship " +
      "between the project's vision (Spirit) and implementation (Body). " +
      "Actions that drift from the vision require human check-back.",
    severity: ConstraintSeverity.HARD_STOP,
    active: true,
    check: (context: GateContext): GateResult => {
      // If wheel assessment is available, use it
      if (context.wheelAssessment) {
        const spiritual =
          context.wheelAssessment.presence[MedicineWheelQuadrant.SPIRITUAL];
        const physical =
          context.wheelAssessment.presence[MedicineWheelQuadrant.PHYSICAL];

        // Both Spirit and Body must be engaged
        if (spiritual < 0.1 && physical > 0.3) {
          return {
            passed: false,
            reason:
              "Action engages the Body (code/physical) without the Spirit (vision). " +
              "This risks building in a direction that looks fine locally but " +
              "does not match the deeper vision.",
            remediation:
              "Check back with the human to confirm this action aligns with " +
              "the project vision before proceeding autonomously.",
          };
        }
      }

      // Check metadata for explicit vision alignment
      const visionAligned = context.metadata.visionAligned;
      if (visionAligned === false) {
        return {
          passed: false,
          reason: "Action has been flagged as misaligned with the project vision.",
          remediation:
            "Review the action against the stated project vision and " +
            "bring the human into the loop before proceeding.",
        };
      }

      return {
        passed: true,
        reason: "Action appears aligned with project vision and embodiment.",
      };
    },
  };
}

/**
 * Create the Medicine Wheel Balance constraint.
 * Ensures actions don't neglect critical quadrants.
 */
export function createMedicineWheelBalanceConstraint(): ValueConstraint {
  return {
    id: "mwb-001",
    name: "Medicine Wheel Balance",
    description:
      "Ensures that actions engage enough of the Medicine Wheel " +
      "to maintain relational balance. If an agent only sees the " +
      "Mental quadrant, it is missing 75% of reality.",
    severity: ConstraintSeverity.WARNING,
    active: true,
    check: (context: GateContext): GateResult => {
      if (!context.wheelAssessment) {
        return {
          passed: true,
          reason:
            "No wheel assessment available. Consider running one " +
            "for more complete relational awareness.",
        };
      }

      if (context.wheelAssessment.balanced) {
        return {
          passed: true,
          reason: `Relational coverage at ${(context.wheelAssessment.relationalCoverage * 100).toFixed(0)}%. ` +
            `Sufficient quadrants engaged.`,
        };
      }

      const neglected = context.wheelAssessment.neglectedQuadrants
        .map((q) => q.charAt(0).toUpperCase() + q.slice(1))
        .join(", ");

      return {
        passed: false,
        reason:
          `Relational coverage at ${(context.wheelAssessment.relationalCoverage * 100).toFixed(0)}%. ` +
          `Neglected quadrants: ${neglected}.`,
        remediation:
          `Consider how this action engages the ${neglected} dimension(s) ` +
          `before proceeding.`,
      };
    },
  };
}

/**
 * Create the Implicit Over Explicit constraint.
 * Implicit asks (values you live by) always overrule
 * explicit asks (code you want written).
 */
export function createImplicitOverExplicitConstraint(): ValueConstraint {
  return {
    id: "ioe-001",
    name: "Implicit Over Explicit",
    description:
      "Ensures implicit values (relational accountability, ceremony, " +
      "land-based knowing) take precedence over explicit technical asks " +
      "when there is a conflict.",
    severity: ConstraintSeverity.WARNING,
    active: true,
    check: (context: GateContext): GateResult => {
      const hasValueConflict = context.metadata.valueConflict === true;

      if (!hasValueConflict) {
        return {
          passed: true,
          reason: "No value conflict detected between implicit and explicit asks.",
        };
      }

      return {
        passed: false,
        reason:
          "A conflict has been detected between the explicit ask and " +
          "implicit values. The implicit values (relational accountability) " +
          "take precedence.",
        remediation:
          "Flag this as a Value Conflict to the Coordinating Agent. " +
          "The explicit ask should be re-examined through the lens of " +
          "the Medicine Wheel before proceeding.",
      };
    },
  };
}

/**
 * The Value Gate evaluates proposed actions against all registered
 * constraints and produces a verdict.
 *
 * @example
 * ```typescript
 * const gate = new ValueGate();
 *
 * // Propose an action
 * const verdict = gate.evaluate({
 *   action: "Generate database schema for ontology system",
 *   actionDescription: "Creates tables for Indigenous knowledge graph",
 *   agentId: "agent_001",
 *   sessionId: "session_123",
 *   metadata: { researchIsCeremonyGathered: false },
 * });
 *
 * if (!verdict.canProceed) {
 *   console.log("Blocked:", verdict.failureSummary);
 *   // ["Research Is Ceremony context has not been gathered"]
 * }
 * ```
 */
export class ValueGate {
  private constraints: Map<string, ValueConstraint> = new Map();
  private wheelFilter: MedicineWheelFilter;

  constructor() {
    this.wheelFilter = new MedicineWheelFilter();

    // Register default constraints
    this.registerConstraint(createResearchIsCeremonyConstraint());
    this.registerConstraint(createRelationalCheckBackConstraint());
    this.registerConstraint(createMedicineWheelBalanceConstraint());
    this.registerConstraint(createImplicitOverExplicitConstraint());
  }

  /**
   * Register a value constraint.
   */
  registerConstraint(constraint: ValueConstraint): void {
    this.constraints.set(constraint.id, constraint);
  }

  /**
   * Remove a constraint.
   */
  removeConstraint(id: string): boolean {
    return this.constraints.delete(id);
  }

  /**
   * Evaluate a proposed action against all active constraints.
   */
  evaluate(context: GateContext): GateVerdict {
    // If no wheel assessment provided, generate one
    if (!context.wheelAssessment) {
      context.wheelAssessment = this.wheelFilter.assess(
        context.agentId,
        context.action + " " + context.actionDescription
      );
    }

    const results: GateVerdict["results"] = [];
    const failureSummary: string[] = [];
    let canProceed = true;
    let requiresHuman = false;

    for (const constraint of this.constraints.values()) {
      if (!constraint.active) continue;

      const result = constraint.check(context);

      results.push({
        constraintId: constraint.id,
        constraintName: constraint.name,
        severity: constraint.severity,
        result,
      });

      if (!result.passed) {
        failureSummary.push(
          `[${constraint.name}]: ${result.reason}`
        );

        if (constraint.severity === ConstraintSeverity.HARD_STOP) {
          canProceed = false;
          requiresHuman = true;
        }
      }
    }

    return {
      id: uuidv4(),
      canProceed,
      requiresHuman,
      results,
      failureSummary,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Quick check: can this action proceed without human involvement?
   */
  canProceed(action: string, description: string, agentId: string, sessionId: string, metadata: Record<string, unknown> = {}): boolean {
    const verdict = this.evaluate({
      action,
      actionDescription: description,
      agentId,
      sessionId,
      metadata,
    });
    return verdict.canProceed;
  }

  /**
   * Get all registered constraints.
   */
  getConstraints(): ValueConstraint[] {
    return Array.from(this.constraints.values());
  }
}
