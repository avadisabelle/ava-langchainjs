/**
 * Execution Planner
 *
 * Takes an ActionStack and produces an ExecutionPlan with stages,
 * checkpoints, fallbacks, and success criteria. This completes the
 * 5-layer parity with Miadi-code's PDE pipeline (Layer 5).
 *
 * Layers 1-4 (DirectionalDecomposer → IntentExtractor → DependencyMapper
 * → ActionStackBuilder) decompose; this layer plans execution.
 *
 * No LLM dependency — uses deterministic grouping, checkpoint generation,
 * and heuristic-based fallback strategies.
 */

import { v4 as uuid } from "uuid";
import type {
  ActionItem,
  DecompositionResult,
  AmbiguityFlag,
} from "./action_stack.js";
import type { Direction } from "./directional_decomposer.js";

// =============================================================================
// Types
// =============================================================================

/**
 * A stage in the execution plan — a group of actions that
 * share a direction and can be executed together.
 */
export interface ExecutionStage {
  /** Unique stage identifier */
  id: string;
  /** Human-readable stage title */
  title: string;
  /** Actions belonging to this stage */
  actions: ActionItem[];
  /** The Medicine Wheel direction this stage serves */
  direction: "east" | "south" | "west" | "north";
  /** IDs of stages that must complete before this one */
  dependencies: string[];
  /** Estimated complexity based on action count and dependencies */
  estimatedComplexity: "simple" | "moderate" | "complex";
}

/**
 * A checkpoint inserted between stages for verification.
 */
export interface Checkpoint {
  /** The stage ID after which this checkpoint occurs */
  afterStageId: string;
  /** What should be verified at this checkpoint */
  description: string;
  /** Specific criteria to validate */
  validationCriteria: string[];
  /** Whether a human must review before proceeding */
  requiresHumanReview: boolean;
}

/**
 * A fallback strategy for when a stage fails or encounters ambiguity.
 */
export interface FallbackStrategy {
  /** The stage this fallback applies to */
  forStageId: string;
  /** Type of fallback strategy */
  strategy: "retry" | "skip" | "alternative" | "escalate";
  /** Human-readable description of what to do */
  description: string;
}

/**
 * A complete execution plan — the final output of the PDE pipeline
 * (Layer 5) that describes how to execute a decomposition.
 */
export interface ExecutionPlan {
  /** Unique plan identifier */
  id: string;
  /** ID of the source decomposition */
  decompositionId?: string;
  /** Ordered execution stages */
  stages: ExecutionStage[];
  /** Verification checkpoints */
  checkpoints: Checkpoint[];
  /** Fallback strategies for failure handling */
  fallbacks: FallbackStrategy[];
  /** Overall success criteria */
  successCriteria: string[];
  /** Overall estimated complexity */
  estimatedComplexity: "simple" | "moderate" | "complex";
  /** ISO timestamp */
  createdAt: string;
}

/**
 * Configuration options for ExecutionPlanner.
 */
export interface ExecutionPlannerOptions {
  /** Add checkpoints between direction changes (default true) */
  autoCheckpoints?: boolean;
  /** Generate fallback strategies automatically (default true) */
  autoFallbacks?: boolean;
}

// =============================================================================
// Direction metadata for stage generation
// =============================================================================

const DIRECTION_LABELS: Record<Direction, string> = {
  east: "Vision & Requirements",
  south: "Research & Analysis",
  west: "Validation & Ceremony",
  north: "Implementation & Action",
};

const DIRECTION_CHECKPOINT_CRITERIA: Record<Direction, string[]> = {
  east: [
    "Requirements are clearly defined",
    "Vision alignment has been confirmed",
    "Scope boundaries are established",
  ],
  south: [
    "Research dependencies have been gathered",
    "Analysis is documented",
    "Context is sufficient to proceed",
  ],
  west: [
    "Validation criteria are met",
    "Ceremony or ethical review completed",
    "Quality checks passed",
  ],
  north: [
    "Implementation matches specification",
    "All actions executed successfully",
    "Outputs are verified",
  ],
};

/**
 * Directions that require human review at checkpoints.
 * WEST (ceremony/ethics) and transitions to NORTH (action) are high-stakes.
 */
const HUMAN_REVIEW_DIRECTIONS: Set<Direction> = new Set(["west" as Direction]);

// =============================================================================
// ExecutionPlanner
// =============================================================================

/**
 * ExecutionPlanner takes a DecompositionResult and produces an ExecutionPlan
 * with stages, checkpoints, fallbacks, and success criteria.
 *
 * This is Layer 5 of the PDE pipeline — the bridge between decomposition
 * and actual execution.
 *
 * @example
 * ```typescript
 * const planner = new ExecutionPlanner();
 * const plan = planner.plan(decompositionResult);
 *
 * for (const stage of plan.stages) {
 *   console.log(`Stage: ${stage.title} (${stage.direction})`);
 *   for (const action of stage.actions) {
 *     console.log(`  - ${action.text}`);
 *   }
 * }
 *
 * for (const checkpoint of plan.checkpoints) {
 *   console.log(`Checkpoint after ${checkpoint.afterStageId}:`);
 *   console.log(`  ${checkpoint.description}`);
 * }
 * ```
 */
export class ExecutionPlanner {
  private readonly autoCheckpoints: boolean;
  private readonly autoFallbacks: boolean;

  constructor(options?: ExecutionPlannerOptions) {
    this.autoCheckpoints = options?.autoCheckpoints ?? true;
    this.autoFallbacks = options?.autoFallbacks ?? true;
  }

  /**
   * Create an execution plan from a decomposition result.
   * Groups actions into stages, generates checkpoints and fallbacks,
   * and derives overall success criteria.
   */
  plan(decomposition: DecompositionResult): ExecutionPlan {
    const stages = this.groupIntoStages(decomposition.actionStack);

    // Wire up stage dependencies based on direction ordering
    this.wireInterStageDependencies(stages);

    const checkpoints = this.autoCheckpoints
      ? this.generateCheckpoints(stages)
      : [];

    const fallbacks = this.autoFallbacks
      ? this.generateFallbacks(stages, decomposition.ambiguities)
      : [];

    const successCriteria = this.deriveSuccessCriteria(decomposition);
    const estimatedComplexity = this.estimateOverallComplexity(stages);

    return {
      id: uuid(),
      decompositionId: decomposition.id,
      stages,
      checkpoints,
      fallbacks,
      successCriteria,
      estimatedComplexity,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Group actions into stages by direction and dependency.
   * Actions with the same direction and no cross-direction dependencies
   * are grouped together.
   */
  groupIntoStages(actions: ActionItem[]): ExecutionStage[] {
    if (actions.length === 0) return [];

    // Group by direction, preserving order
    const directionGroups = new Map<Direction, ActionItem[]>();
    const directionOrder: Direction[] = [];

    for (const action of actions) {
      const dir = action.direction;
      if (!directionGroups.has(dir)) {
        directionGroups.set(dir, []);
        directionOrder.push(dir);
      }
      directionGroups.get(dir)!.push(action);
    }

    // Create stages from groups
    const stages: ExecutionStage[] = [];

    for (const dir of directionOrder) {
      const groupActions = directionGroups.get(dir)!;

      // Split large groups into sub-stages if needed
      const chunks = this.chunkActions(groupActions, 5);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const suffix = chunks.length > 1 ? ` (Part ${i + 1})` : "";
        const stageId = uuid();

        stages.push({
          id: stageId,
          title: `${DIRECTION_LABELS[dir] ?? dir}${suffix}`,
          actions: chunk,
          direction: dir,
          dependencies: [],
          estimatedComplexity: this.estimateStageComplexity(chunk),
        });
      }
    }

    return stages;
  }

  /**
   * Generate checkpoints between stages, especially at direction boundaries.
   */
  generateCheckpoints(stages: ExecutionStage[]): Checkpoint[] {
    const checkpoints: Checkpoint[] = [];

    for (let i = 0; i < stages.length - 1; i++) {
      const currentStage = stages[i];
      const nextStage = stages[i + 1];

      // Always add checkpoint at direction changes
      const directionChanges = currentStage.direction !== nextStage.direction;
      const isHighStakes = HUMAN_REVIEW_DIRECTIONS.has(
        currentStage.direction as Direction
      );

      if (directionChanges || isHighStakes) {
        const criteria =
          DIRECTION_CHECKPOINT_CRITERIA[
            currentStage.direction as Direction
          ] ?? [`Stage "${currentStage.title}" outputs verified`];

        checkpoints.push({
          afterStageId: currentStage.id,
          description: directionChanges
            ? `Direction shift: ${currentStage.direction} → ${nextStage.direction}. ` +
              `Verify ${currentStage.title} is complete before proceeding to ${nextStage.title}.`
            : `Checkpoint after ${currentStage.title}. Verify outputs before continuing.`,
          validationCriteria: criteria,
          requiresHumanReview: isHighStakes,
        });
      }
    }

    // Always add a final checkpoint after the last stage
    if (stages.length > 0) {
      const lastStage = stages[stages.length - 1];
      checkpoints.push({
        afterStageId: lastStage.id,
        description: `Final checkpoint: verify all outputs from "${lastStage.title}" are complete and correct.`,
        validationCriteria: [
          "All actions in the plan have been executed",
          "No unresolved errors or ambiguities",
          "Outputs match expected deliverables",
        ],
        requiresHumanReview: true,
      });
    }

    return checkpoints;
  }

  /**
   * Generate fallback strategies based on stage characteristics and ambiguities.
   */
  generateFallbacks(
    stages: ExecutionStage[],
    ambiguities: AmbiguityFlag[]
  ): FallbackStrategy[] {
    const fallbacks: FallbackStrategy[] = [];

    // Map ambiguity keywords to stages for targeted fallbacks
    const ambiguityTexts = ambiguities.map((a) => a.text.toLowerCase());

    for (const stage of stages) {
      // Determine fallback strategy based on direction and complexity
      if (stage.estimatedComplexity === "complex") {
        fallbacks.push({
          forStageId: stage.id,
          strategy: "escalate",
          description:
            `Stage "${stage.title}" is complex. ` +
            `If execution fails, escalate to human review with full context.`,
        });
      } else if (stage.direction === ("west" as Direction)) {
        // Ceremony/validation stages should not be skipped
        fallbacks.push({
          forStageId: stage.id,
          strategy: "retry",
          description:
            `Stage "${stage.title}" involves validation/ceremony. ` +
            `If checks fail, retry with adjusted parameters rather than skipping.`,
        });
      } else if (stage.direction === ("east" as Direction)) {
        // Vision stages can be iterated
        fallbacks.push({
          forStageId: stage.id,
          strategy: "alternative",
          description:
            `Stage "${stage.title}" clarifies vision. ` +
            `If clarity cannot be achieved, try rephrasing requirements or narrowing scope.`,
        });
      } else {
        // Default: retry for simple, skip for moderate
        const strategy =
          stage.estimatedComplexity === "simple" ? "retry" : "skip";
        fallbacks.push({
          forStageId: stage.id,
          strategy,
          description:
            strategy === "retry"
              ? `Stage "${stage.title}" is simple enough to retry on failure.`
              : `Stage "${stage.title}" can be skipped if non-critical, with degraded output.`,
        });
      }

      // Add ambiguity-specific fallbacks
      const stageActionTexts = stage.actions
        .map((a) => a.text.toLowerCase())
        .join(" ");
      for (const ambiguity of ambiguities) {
        const ambLower = ambiguity.text.toLowerCase();
        if (stageActionTexts.includes(ambLower.split(" ")[0])) {
          fallbacks.push({
            forStageId: stage.id,
            strategy: "escalate",
            description:
              `Ambiguity detected: "${ambiguity.text}". ` +
              `Suggestion: ${ambiguity.suggestion}`,
          });
        }
      }
    }

    return fallbacks;
  }

  /**
   * Derive success criteria from the decomposition outputs and primary intent.
   */
  deriveSuccessCriteria(decomposition: DecompositionResult): string[] {
    const criteria: string[] = [];

    // Primary intent completion
    criteria.push(
      `Primary intent fulfilled: ${decomposition.primary.action} ${decomposition.primary.target}`
    );

    // Expected outputs as success criteria
    if (decomposition.outputs.artifacts.length > 0) {
      criteria.push(
        `Artifacts produced: ${decomposition.outputs.artifacts.join(", ")}`
      );
    }
    if (decomposition.outputs.updates.length > 0) {
      criteria.push(
        `Updates applied: ${decomposition.outputs.updates.join(", ")}`
      );
    }
    if (decomposition.outputs.communications.length > 0) {
      criteria.push(
        `Communications delivered: ${decomposition.outputs.communications.join(", ")}`
      );
    }

    // Balance criterion
    if (decomposition.balance < 0.5) {
      criteria.push(
        `Address neglected directions: ${decomposition.neglectedDirections.join(", ")}`
      );
    }

    // All actions completed
    const actionCount = decomposition.actionStack.length;
    criteria.push(
      `All ${actionCount} actions in the action stack executed successfully`
    );

    // No unresolved ambiguities
    if (decomposition.ambiguities.length > 0) {
      criteria.push(
        `All ${decomposition.ambiguities.length} ambiguities resolved or acknowledged`
      );
    }

    return criteria;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Wire dependencies between stages based on the canonical direction order:
   * EAST → SOUTH → WEST → NORTH
   */
  private wireInterStageDependencies(stages: ExecutionStage[]): void {
    const directionOrder: Direction[] = ["east", "south", "west", "north"] as Direction[];
    const stagesByDirection = new Map<string, ExecutionStage[]>();

    for (const stage of stages) {
      const dir = stage.direction;
      if (!stagesByDirection.has(dir)) {
        stagesByDirection.set(dir, []);
      }
      stagesByDirection.get(dir)!.push(stage);
    }

    // Each direction's stages depend on the last stage of the previous direction
    for (let i = 1; i < directionOrder.length; i++) {
      const prevDir = directionOrder[i - 1];
      const currDir = directionOrder[i];
      const prevStages = stagesByDirection.get(prevDir);
      const currStages = stagesByDirection.get(currDir);

      if (prevStages && prevStages.length > 0 && currStages && currStages.length > 0) {
        const lastPrevStage = prevStages[prevStages.length - 1];
        currStages[0].dependencies.push(lastPrevStage.id);
      }
    }

    // Within same direction, chain sub-stages
    for (const dirStages of stagesByDirection.values()) {
      for (let i = 1; i < dirStages.length; i++) {
        dirStages[i].dependencies.push(dirStages[i - 1].id);
      }
    }
  }

  /**
   * Estimate complexity for a single stage based on action count
   * and presence of dependencies.
   */
  private estimateStageComplexity(
    actions: ActionItem[]
  ): "simple" | "moderate" | "complex" {
    const hasDependencies = actions.some((a) => a.dependency !== null);
    const hasLowConfidence = actions.some((a) => a.confidence < 0.5);
    const count = actions.length;

    if (count <= 2 && !hasDependencies && !hasLowConfidence) {
      return "simple";
    } else if (count > 4 || (hasDependencies && hasLowConfidence)) {
      return "complex";
    } else {
      return "moderate";
    }
  }

  /**
   * Estimate overall plan complexity from stage complexities.
   */
  private estimateOverallComplexity(
    stages: ExecutionStage[]
  ): "simple" | "moderate" | "complex" {
    if (stages.length === 0) return "simple";

    const hasComplex = stages.some((s) => s.estimatedComplexity === "complex");
    const hasModerate = stages.some(
      (s) => s.estimatedComplexity === "moderate"
    );

    if (hasComplex || stages.length > 5) {
      return "complex";
    } else if (hasModerate || stages.length > 2) {
      return "moderate";
    } else {
      return "simple";
    }
  }

  /**
   * Chunk actions into groups of at most `maxSize`.
   */
  private chunkActions(
    actions: ActionItem[],
    maxSize: number
  ): ActionItem[][] {
    const chunks: ActionItem[][] = [];
    for (let i = 0; i < actions.length; i += maxSize) {
      chunks.push(actions.slice(i, i + maxSize));
    }
    return chunks;
  }
}
