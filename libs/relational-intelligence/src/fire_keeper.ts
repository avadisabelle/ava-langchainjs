/**
 * Fire Keeper Protocol
 *
 * The Coordinating Agent's contract. If research is ceremony,
 * then the Coordinating Agent is the Fire Keeper -- someone who
 * ensures the ceremony stays on track and relationships are honored.
 *
 * The Fire Keeper's primary job is not "Task Management" but
 * "Vision Alignment." It holds the Medicine Wheel and checks
 * every sub-agent's work against it.
 *
 * Pruning uses Relational Milestones, not Time Milestones.
 * Don't prune after 24 hours; prune after a "Relational Circle"
 * is complete.
 */

import { v4 as uuidv4 } from "uuid";
import {
  MedicineWheelFilter,
  WheelAssessment,
  MedicineWheelQuadrant,
} from "./medicine_wheel.js";
import {
  ImportanceUnit,
  ImportanceStore,
  calculateRelationalCompleteness,
} from "./importance_unit.js";
import { SpiralTracker, Spiral } from "./epistemic_iteration.js";
import { ValueGate, GateVerdict, GateContext } from "./value_gate.js";

/**
 * A report from a sub-agent to the Fire Keeper.
 */
export interface AgentReport {
  id: string;
  agentId: string;
  agentName: string;
  /** What the agent did. */
  action: string;
  /** The outcome. */
  outcome: string;
  /** Whether the agent considers its work complete. */
  complete: boolean;
  /** Medicine Wheel assessment of the work. */
  wheelAssessment?: WheelAssessment;
  /** Importance units surfaced during this work. */
  importanceUnits: ImportanceUnit[];
  /** Topics that were circled back to. */
  topicsCircled: string[];
  /** The agent's confidence in its output. */
  confidence: number;
  /** Timestamp. */
  timestamp: string;
}

/**
 * Create an AgentReport.
 */
export function createAgentReport(
  agentId: string,
  agentName: string,
  action: string,
  outcome: string,
  options: Partial<AgentReport> = {}
): AgentReport {
  return {
    id: options.id ?? uuidv4(),
    agentId,
    agentName,
    action,
    outcome,
    complete: options.complete ?? false,
    wheelAssessment: options.wheelAssessment,
    importanceUnits: options.importanceUnits ?? [],
    topicsCircled: options.topicsCircled ?? [],
    confidence: options.confidence ?? 0.5,
    timestamp: options.timestamp ?? new Date().toISOString(),
  };
}

/**
 * A Relational Milestone marks completion of a relational circle,
 * not a time interval. Used for determining when to prune.
 */
export interface RelationalMilestone {
  id: string;
  /** What was completed. */
  description: string;
  /** Which spiral(s) this milestone relates to. */
  relatedSpirals: string[];
  /** The wheel assessment at milestone completion. */
  wheelAssessment: WheelAssessment;
  /** Importance units that were resolved or deepened. */
  resolvedUnits: string[];
  /** Whether this milestone allows pruning. */
  allowsPruning: boolean;
  /** Timestamp. */
  timestamp: string;
}

/**
 * Human engagement mode: what type of work the human
 * should be called back for, based on their skills.
 */
export enum EngagementMode {
  /** UI design, visual, creative work. */
  DESIGN = "design",
  /** Database schema, data modeling. */
  DATA_MODELING = "data_modeling",
  /** Protocol design, API contracts. */
  PROTOCOL = "protocol",
  /** Ceremony context, relational decisions. */
  CEREMONY = "ceremony",
  /** Code review, technical verification. */
  CODE_REVIEW = "code_review",
  /** Vision alignment, directional decisions. */
  VISION = "vision",
}

/**
 * A request for human engagement from the Fire Keeper.
 */
export interface HumanEngagementRequest {
  id: string;
  /** Why the human is needed. */
  reason: string;
  /** What type of engagement is needed. */
  mode: EngagementMode;
  /** The context for the engagement. */
  context: string;
  /** Priority (higher = more urgent). */
  priority: number;
  /** Which agent is requesting. */
  requestingAgentId: string;
  /** Gate verdict that triggered this (if applicable). */
  gateVerdict?: GateVerdict;
  /** Timestamp. */
  timestamp: string;
}

/**
 * The Fire Keeper's current state.
 */
export interface FireKeeperState {
  /** Active agent reports awaiting review. */
  pendingReports: AgentReport[];
  /** Completed relational milestones. */
  milestones: RelationalMilestone[];
  /** Pending human engagement requests. */
  engagementRequests: HumanEngagementRequest[];
  /** Current vision statement. */
  visionStatement: string;
  /** Overall relational health score. */
  relationalHealth: number;
  /** Whether the ceremony is on track. */
  ceremonyOnTrack: boolean;
}

/**
 * The Fire Keeper coordinates sub-agents, holds the Medicine Wheel,
 * and ensures the ceremony stays on track.
 *
 * @example
 * ```typescript
 * const keeper = new FireKeeper("Build a relational intelligence system...");
 *
 * // Receive a report from a sub-agent
 * const report = createAgentReport("agent_1", "Mia", "Built schema", "Schema complete");
 * const review = keeper.reviewReport(report);
 *
 * if (review.requiresHumanEngagement) {
 *   console.log("Calling human:", review.engagementRequest);
 * }
 *
 * // Check if an action can proceed
 * const verdict = keeper.gateAction({
 *   action: "Deploy ontology to production",
 *   actionDescription: "Pushes Indigenous ontology schema live",
 *   agentId: "agent_2",
 *   sessionId: "session_1",
 *   metadata: { researchIsCeremonyGathered: true },
 * });
 * ```
 */
export class FireKeeper {
  private wheelFilter: MedicineWheelFilter;
  private importanceStore: ImportanceStore;
  private spiralTracker: SpiralTracker;
  private valueGate: ValueGate;
  private state: FireKeeperState;

  constructor(visionStatement: string) {
    this.wheelFilter = new MedicineWheelFilter();
    this.importanceStore = new ImportanceStore();
    this.spiralTracker = new SpiralTracker();
    this.valueGate = new ValueGate();

    this.state = {
      pendingReports: [],
      milestones: [],
      engagementRequests: [],
      visionStatement,
      relationalHealth: 0.5,
      ceremonyOnTrack: true,
    };
  }

  // ===========================================================================
  // AGENT REPORT REVIEW
  // ===========================================================================

  /**
   * Review a sub-agent's report. The Fire Keeper checks the work
   * against the Medicine Wheel and the project vision.
   */
  reviewReport(report: AgentReport): {
    accepted: boolean;
    feedback: string[];
    requiresHumanEngagement: boolean;
    engagementRequest?: HumanEngagementRequest;
  } {
    const feedback: string[] = [];
    let accepted = true;
    let requiresHumanEngagement = false;
    let engagementRequest: HumanEngagementRequest | undefined;

    // Assess the work through the Medicine Wheel
    const assessment = report.wheelAssessment ??
      this.wheelFilter.assess(report.id, report.action + " " + report.outcome);

    // Check relational coverage
    if (!assessment.balanced) {
      feedback.push(
        `Work engages ${(assessment.relationalCoverage * 100).toFixed(0)}% of the wheel. ` +
        `Neglected: ${assessment.neglectedQuadrants.join(", ")}.`
      );
    }

    // Check if spiritual alignment is present
    if (assessment.neglectedQuadrants.includes(MedicineWheelQuadrant.SPIRITUAL)) {
      feedback.push(
        "The Spiritual quadrant is neglected. Does this work align with the deeper vision?"
      );
      requiresHumanEngagement = true;
      engagementRequest = {
        id: uuidv4(),
        reason: "Sub-agent work lacks spiritual/vision alignment.",
        mode: EngagementMode.VISION,
        context: `Agent ${report.agentName} completed: ${report.action}. ` +
          `Outcome: ${report.outcome}. Vision alignment unclear.`,
        priority: 0.7,
        requestingAgentId: report.agentId,
        timestamp: new Date().toISOString(),
      };
    }

    // Store importance units from the report
    for (const unit of report.importanceUnits) {
      this.importanceStore.add(unit);
    }

    // Record topic spirals
    for (const topic of report.topicsCircled) {
      this.spiralTracker.recordCircle(
        topic,
        topic,
        `[Via ${report.agentName}]: ${report.outcome}`,
        report.id
      );
    }

    // Low confidence triggers human check
    if (report.confidence < 0.4) {
      feedback.push(
        `Agent confidence is ${(report.confidence * 100).toFixed(0)}%. ` +
        "Consider bringing the human into the loop."
      );
      if (!requiresHumanEngagement) {
        requiresHumanEngagement = true;
        engagementRequest = {
          id: uuidv4(),
          reason: "Low agent confidence in work output.",
          mode: EngagementMode.CODE_REVIEW,
          context: `Agent ${report.agentName} (confidence: ${(report.confidence * 100).toFixed(0)}%) ` +
            `completed: ${report.action}.`,
          priority: 0.5,
          requestingAgentId: report.agentId,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Track the report
    this.state.pendingReports.push(report);

    if (engagementRequest) {
      this.state.engagementRequests.push(engagementRequest);
    }

    return { accepted, feedback, requiresHumanEngagement, engagementRequest };
  }

  // ===========================================================================
  // VALUE GATING
  // ===========================================================================

  /**
   * Gate an action through the value constraints.
   */
  gateAction(context: GateContext): GateVerdict {
    return this.valueGate.evaluate(context);
  }

  /**
   * Quick check: can an agent proceed with this action?
   */
  canAgentProceed(
    action: string,
    description: string,
    agentId: string,
    sessionId: string,
    metadata: Record<string, unknown> = {}
  ): boolean {
    return this.valueGate.canProceed(
      action,
      description,
      agentId,
      sessionId,
      metadata
    );
  }

  // ===========================================================================
  // RELATIONAL MILESTONES
  // ===========================================================================

  /**
   * Record a relational milestone. Milestones are based on
   * relational completion, not time elapsed.
   */
  recordMilestone(
    description: string,
    relatedSpirals: string[],
    resolvedUnitIds: string[]
  ): RelationalMilestone {
    const assessment = this.wheelFilter.assess(
      uuidv4(),
      description
    );

    const milestone: RelationalMilestone = {
      id: uuidv4(),
      description,
      relatedSpirals,
      wheelAssessment: assessment,
      resolvedUnits: resolvedUnitIds,
      allowsPruning: assessment.balanced && resolvedUnitIds.length > 0,
      timestamp: new Date().toISOString(),
    };

    this.state.milestones.push(milestone);
    this.updateRelationalHealth();

    return milestone;
  }

  /**
   * Check whether pruning is allowed based on relational milestones,
   * not time intervals.
   */
  canPrune(): boolean {
    if (this.state.milestones.length === 0) return false;

    const lastMilestone =
      this.state.milestones[this.state.milestones.length - 1];
    return lastMilestone.allowsPruning;
  }

  // ===========================================================================
  // HUMAN ENGAGEMENT
  // ===========================================================================

  /**
   * Determine how to engage the human based on the type of work needed.
   */
  requestHumanEngagement(
    reason: string,
    mode: EngagementMode,
    context: string,
    requestingAgentId: string,
    priority: number = 0.5
  ): HumanEngagementRequest {
    const request: HumanEngagementRequest = {
      id: uuidv4(),
      reason,
      mode,
      context,
      priority: Math.max(0, Math.min(1, priority)),
      requestingAgentId,
      timestamp: new Date().toISOString(),
    };

    this.state.engagementRequests.push(request);
    return request;
  }

  /**
   * Get pending human engagement requests sorted by priority.
   */
  getPendingEngagements(): HumanEngagementRequest[] {
    return [...this.state.engagementRequests].sort(
      (a, b) => b.priority - a.priority
    );
  }

  /**
   * Resolve a human engagement request.
   */
  resolveEngagement(requestId: string): void {
    this.state.engagementRequests = this.state.engagementRequests.filter(
      (r) => r.id !== requestId
    );
  }

  // ===========================================================================
  // STATE ACCESS
  // ===========================================================================

  /**
   * Get the current vision statement.
   */
  getVision(): string {
    return this.state.visionStatement;
  }

  /**
   * Update the vision statement.
   */
  updateVision(newVision: string): void {
    this.state.visionStatement = newVision;
  }

  /**
   * Get the current relational health score.
   */
  getRelationalHealth(): number {
    return this.state.relationalHealth;
  }

  /**
   * Is the ceremony still on track?
   */
  isCeremonyOnTrack(): boolean {
    return this.state.ceremonyOnTrack;
  }

  /**
   * Get the importance store for direct access.
   */
  getImportanceStore(): ImportanceStore {
    return this.importanceStore;
  }

  /**
   * Get the spiral tracker for direct access.
   */
  getSpiralTracker(): SpiralTracker {
    return this.spiralTracker;
  }

  /**
   * Get the value gate for direct access.
   */
  getValueGate(): ValueGate {
    return this.valueGate;
  }

  /**
   * Get the wheel filter for direct access.
   */
  getWheelFilter(): MedicineWheelFilter {
    return this.wheelFilter;
  }

  /**
   * Get the deepest spirals -- these are the most important topics.
   */
  getDeepestSpirals(limit: number = 5): Spiral[] {
    return this.spiralTracker.getByDepth(limit);
  }

  /**
   * Get the most accountable importance units.
   */
  getMostAccountable(limit: number = 10): ImportanceUnit[] {
    return this.importanceStore.getByAccountability(limit);
  }

  /**
   * Get a summary of the Fire Keeper's state.
   */
  getSummary(): Record<string, unknown> {
    return {
      vision: this.state.visionStatement,
      relationalHealth: this.state.relationalHealth,
      ceremonyOnTrack: this.state.ceremonyOnTrack,
      pendingReports: this.state.pendingReports.length,
      milestones: this.state.milestones.length,
      pendingEngagements: this.state.engagementRequests.length,
      importanceUnits: this.importanceStore.size,
      activeSpirals: this.spiralTracker.getActiveSpirals().length,
      deepestSpirals: this.spiralTracker
        .getByDepth(3)
        .map((s) => ({ topic: s.topicName, depth: s.depth })),
    };
  }

  // ===========================================================================
  // INTERNAL
  // ===========================================================================

  /**
   * Update relational health based on current state.
   */
  private updateRelationalHealth(): void {
    const factors: number[] = [];

    // Factor 1: Importance unit relational completeness
    const units = this.importanceStore.getAll();
    if (units.length > 0) {
      const avgCompleteness =
        units.reduce(
          (sum, u) => sum + calculateRelationalCompleteness(u),
          0
        ) / units.length;
      factors.push(avgCompleteness);
    }

    // Factor 2: Spiral activity
    const activeSpirals = this.spiralTracker.getActiveSpirals();
    if (activeSpirals.length > 0) {
      const avgDepth =
        activeSpirals.reduce((sum, s) => sum + Math.min(s.depth / 5, 1), 0) /
        activeSpirals.length;
      factors.push(avgDepth);
    }

    // Factor 3: Milestone health
    if (this.state.milestones.length > 0) {
      const recentMilestones = this.state.milestones.slice(-5);
      const balancedRatio =
        recentMilestones.filter((m) => m.wheelAssessment.balanced).length /
        recentMilestones.length;
      factors.push(balancedRatio);
    }

    if (factors.length > 0) {
      this.state.relationalHealth =
        factors.reduce((sum, f) => sum + f, 0) / factors.length;
    }

    // Ceremony is off track if health drops too low
    this.state.ceremonyOnTrack = this.state.relationalHealth >= 0.3;
  }
}
