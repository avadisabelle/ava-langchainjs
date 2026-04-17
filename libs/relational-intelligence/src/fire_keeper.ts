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
import { DirectionalDecomposer, IntentExtractor } from "../../prompt-decomposition/src/index.js"; // From PDE
import {
  PromptDecompositionBridge,
  RelationalIntelligenceBridge,
} from "../../narrative-tracing/src/adapters/index.js"; // From Narrative Tracing

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
  /** Prompt refinement due to ambiguity or imbalance. */
  PROMPT_REFINEMENT = "prompt_refinement",
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

export interface FireKeeperOptions {
  wheelFilter?: MedicineWheelFilter;
  importanceStore?: ImportanceStore;
  spiralTracker?: SpiralTracker;
  valueGate?: ValueGate;
  promptDecomposer?: DirectionalDecomposer; // Optional PDE integration
  intentExtractor?: IntentExtractor; // Optional PDE integration
  promptDecompositionBridge?: PromptDecompositionBridge; // Optional tracing
  relationalIntelligenceBridge?: RelationalIntelligenceBridge; // Optional tracing
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
 * const review = await keeper.reviewReport(report); // Note: now async
 *
 * if (review.requiresHumanEngagement) {
 *   console.log("Calling human:", review.engagementRequest);
 * }
 *
 * // Process a raw prompt through the Fire Keeper
 * const promptGuidance = await keeper.processPrompt(
 *   "Develop a module that integrates with the database and ensures data integrity."
 * );
 *
 * // Check if an action can proceed
 * const verdict = await keeper.gateAction({ // Note: now async
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
  private promptDecomposer?: DirectionalDecomposer;
  private intentExtractor?: IntentExtractor;
  private promptDecompositionBridge?: PromptDecompositionBridge;
  private relationalIntelligenceBridge?: RelationalIntelligenceBridge;

  private state: FireKeeperState;

  constructor(visionStatement: string, options: FireKeeperOptions = {}) {
    this.wheelFilter = options.wheelFilter ?? new MedicineWheelFilter();
    this.importanceStore = options.importanceStore ?? new ImportanceStore();
    this.spiralTracker = options.spiralTracker ?? new SpiralTracker();
    this.valueGate = options.valueGate ?? new ValueGate();
    this.promptDecomposer = options.promptDecomposer;
    this.intentExtractor = options.intentExtractor;
    this.promptDecompositionBridge = options.promptDecompositionBridge;
    this.relationalIntelligenceBridge = options.relationalIntelligenceBridge;

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
  // PROMPT PROCESSING AND REFINEMENT
  // ===========================================================================

  /**
   * Processes a raw prompt through PDE components and assesses its relational balance.
   * Can trigger human engagement for prompt refinement if ambiguities or imbalances are found.
   */
  async processPrompt(
    prompt: string,
    agentId: string,
    sessionId: string,
    parentSpanId?: string
  ): Promise<{
    requiresHumanEngagement: boolean;
    engagementRequest?: HumanEngagementRequest;
    directionalAnalysisId?: string;
    intentExtractionId?: string;
  }> {
    let requiresHumanEngagement = false;
    let engagementRequest: HumanEngagementRequest | undefined;
    let directionalAnalysisId: string | undefined;
    let intentExtractionId: string | undefined;

    this.promptDecompositionBridge?.logDecompositionStart(prompt, parentSpanId);

    if (this.promptDecomposer) {
      const directionalAnalysis = this.promptDecomposer.decompose(prompt);
      directionalAnalysisId = this.promptDecompositionBridge?.logDirectionalAnalysis(
        directionalAnalysis,
        parentSpanId
      );

      if (!this.promptDecomposer.isBalanced(directionalAnalysis)) {
        requiresHumanEngagement = true;
        const guidance = this.promptDecomposer.getGuidance(directionalAnalysis);
        engagementRequest = this.requestHumanEngagement(
          "Prompt lacks relational balance or neglects key directions.",
          EngagementMode.PROMPT_REFINEMENT,
          `Original Prompt: "${prompt}"\n\nGuidance:\n${guidance.join("\n")}`,
          agentId,
          0.8, // High priority for prompt refinement
          parentSpanId
        );
      }
    }

    if (this.intentExtractor) {
      const intentResult = await this.intentExtractor.extract(prompt);
      intentExtractionId = this.promptDecompositionBridge?.logIntentExtraction(
        intentResult,
        parentSpanId
      );

      const lowConfidenceIntents = intentResult.secondary.filter(
        (s) => s.confidence < 0.5
      );
      if (lowConfidenceIntents.length > 0) {
        requiresHumanEngagement = true;
        const ambiguities = lowConfidenceIntents.map(
          (s) => `${s.action} on ${s.target} (confidence: ${(s.confidence * 100).toFixed(0)}%)`
        );
        const context = `Original Prompt: "${prompt}"\n\nLow-confidence intents:\n- ${ambiguities.join("\n- ")}`;
        if (!engagementRequest) {
          engagementRequest = this.requestHumanEngagement(
            "Prompt contains low-confidence intents requiring clarification.",
            EngagementMode.PROMPT_REFINEMENT,
            context,
            agentId,
            0.7, // Medium-high priority
            parentSpanId
          );
        } else {
          // Append to existing request context if present
          engagementRequest.context += `\n\nLow-confidence intents:\n- ${ambiguities.join("\n- ")}`;
          engagementRequest.priority = Math.max(engagementRequest.priority, 0.7);
        }
        this.promptDecompositionBridge?.logAmbiguityDetected(ambiguities, parentSpanId);
      }
    }

    return { requiresHumanEngagement, engagementRequest, directionalAnalysisId, intentExtractionId };
  }

  // ===========================================================================
  // AGENT REPORT REVIEW
  // ===========================================================================

  /**
   * Review a sub-agent's report. The Fire Keeper checks the work
   * against the Medicine Wheel and the project vision.
   */
  async reviewReport(report: AgentReport, parentSpanId?: string): Promise<{
    accepted: boolean;
    feedback: string[];
    requiresHumanEngagement: boolean;
    engagementRequest?: HumanEngagementRequest;
  }> {
    const feedback: string[] = [];
    let accepted = true;
    let requiresHumanEngagement = false;
    let engagementRequest: HumanEngagementRequest | undefined;

    // Assess the work through the Medicine Wheel
    const assessment = report.wheelAssessment ??
      (await this.wheelFilter.assess(report.id, report.action + " " + report.outcome));
    this.relationalIntelligenceBridge?.logWheelAssessmentPerformed(assessment, parentSpanId);

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
      engagementRequest = this.requestHumanEngagement(
        "Sub-agent work lacks spiritual/vision alignment.",
        EngagementMode.VISION,
        `Agent ${report.agentName} completed: ${report.action}. ` +
        `Outcome: ${report.outcome}. Vision alignment unclear.`,
        report.agentId,
        0.7,
        parentSpanId
      );
    }

    // Store importance units from the report
    for (const unit of report.importanceUnits) {
      this.importanceStore.add(unit);
      this.relationalIntelligenceBridge?.logImportanceUnitCreated(unit, parentSpanId);
    }

    // Record topic spirals
    for (const topic of report.topicsCircled) {
      const circle = await this.spiralTracker.recordCircle( // Now async
        topic,
        topic,
        `[Via ${report.agentName}]: ${report.outcome}`,
        report.id
      );
      this.relationalIntelligenceBridge?.logSpiralCircleRecorded(circle, parentSpanId);
    }

    // Low confidence triggers human check
    if (report.confidence < 0.4) {
      feedback.push(
        `Agent confidence is ${(report.confidence * 100).toFixed(0)}%. ` +
        "Consider bringing the human into the loop."
      );
      if (!requiresHumanEngagement) {
        requiresHumanEngagement = true;
        engagementRequest = this.requestHumanEngagement(
          "Low agent confidence in work output.",
          EngagementMode.CODE_REVIEW,
          `Agent ${report.agentName} (confidence: ${(report.confidence * 100).toFixed(0)}%) ` +
          `completed: ${report.action}.`,
          report.agentId,
          0.5,
          parentSpanId
        );
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
  async gateAction(context: GateContext, parentSpanId?: string): Promise<GateVerdict> {
    const verdict = await this.valueGate.evaluate(context); // Now async
    this.relationalIntelligenceBridge?.logValueGateVerdictIssued(verdict, parentSpanId);
    return verdict;
  }

  /**
   * Quick check: can an agent proceed with this action?
   */
  async canAgentProceed( // Now async
    action: string,
    description: string,
    agentId: string,
    sessionId: string,
    metadata: Record<string, unknown> = {}
  ): Promise<boolean> {
    const verdict = await this.valueGate.canProceed( // Now async
      action,
      description,
      agentId,
      sessionId,
      metadata
    );
    // Logging is handled within valueGate.evaluate, which canProceed calls
    return verdict;
  }

  // ===========================================================================
  // RELATIONAL MILESTONES
  // ===========================================================================

  /**
   * Record a relational milestone. Milestones are based on
   * relational completion, not time elapsed.
   */
  async recordMilestone( // Now async
    description: string,
    relatedSpirals: string[],
    resolvedUnitIds: string[],
    parentSpanId?: string
  ): Promise<RelationalMilestone> {
    const assessment = await this.wheelFilter.assess( // Now async
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
    this.relationalIntelligenceBridge?.logRelationalMilestoneRecorded(milestone, parentSpanId);

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
    priority: number = 0.5,
    parentSpanId?: string
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
    this.relationalIntelligenceBridge?.logHumanEngagementRequested(request, parentSpanId);
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
  resolveEngagement(requestId: string, parentSpanId?: string): void {
    this.state.engagementRequests = this.state.engagementRequests.filter(
      (r) => r.id !== requestId
    );
    this.relationalIntelligenceBridge?.logHumanEngagementResolved(requestId, parentSpanId);
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
