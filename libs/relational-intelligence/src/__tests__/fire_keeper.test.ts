import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  FireKeeper,
  createAgentReport,
  EngagementMode,
  HumanEngagementRequest,
} from "../fire_keeper.js";
import {
  createImportanceUnit,
  ImportanceContext,
  ImportanceStore,
} from "../importance_unit.js";
import { MedicineWheelQuadrant, createQuadrantPresence, MedicineWheelFilter, WheelAssessment } from "../medicine_wheel.js";
import { SpiralTracker, EpistemicCircle } from "../epistemic_iteration.js";
import { ValueGate, GateVerdict, ConstraintSeverity } from "../value_gate.js";
import { DirectionalDecomposer, IntentExtractor, DirectionalAnalysis, IntentExtractionResult } from "../../prompt-decomposition/src/index.js";
import { PromptDecompositionBridge, RelationalIntelligenceBridge } from "../../narrative-tracing/src/adapters/index.js";
import { NarrativeEventType } from "../../narrative-tracing/src/event_types.js";


// Mock external dependencies
const mockWheelFilter = {
  assess: vi.fn(async (id, content) => ({
    id,
    inputId: id,
    presence: createQuadrantPresence({ physical: 0.5, mental: 0.5 }),
    leadQuadrant: MedicineWheelQuadrant.PHYSICAL,
    neglectedQuadrants: [],
    relationalCoverage: 1.0,
    balanced: true,
    timestamp: new Date().toISOString(),
  })),
} as unknown as MedicineWheelFilter;

const mockImportanceStore = {
  add: vi.fn(),
  getAll: vi.fn().mockReturnValue([]),
  getByAccountability: vi.fn().mockReturnValue([]),
  getNeedingAttention: vi.fn().mockReturnValue([]),
  applyDecay: vi.fn(),
  remove: vi.fn(),
  size: 0,
} as unknown as ImportanceStore;

const mockSpiralTracker = {
  recordCircle: vi.fn(async (topicKey, topicName, content, sessionId) => ({
    id: "ec-mock",
    topicKey,
    iteration: 1,
    content,
    delta: "",
    sessionId,
    timestamp: new Date().toISOString(),
  }) as EpistemicCircle),
  getActiveSpirals: vi.fn().mockReturnValue([]),
  getByDepth: vi.fn().mockResolvedValue([]), // Changed to mockResolvedValue
  closeSpiral: vi.fn(),
  analyzeShifts: vi.fn().mockResolvedValue([]),
  size: 0,
} as unknown as SpiralTracker;

const mockValueGate = {
  evaluate: vi.fn(async (context) => ({
    id: "gv-mock",
    canProceed: true,
    requiresHuman: false,
    results: [],
    failureSummary: [],
    timestamp: new Date().toISOString(),
  }) as GateVerdict),
  canProceed: vi.fn(async () => true),
} as unknown as ValueGate;

const mockPromptDecomposer = {
  decompose: vi.fn(async (prompt) => ({
    id: "da-mock",
    timestamp: new Date().toISOString(),
    prompt,
    directions: {
      east: [], south: [], west: [], north: [{ text: "mock", confidence: 1, implicit: false }],
    },
    leadDirection: "north",
    neglectedDirections: [],
    balance: 1.0,
  }) as DirectionalAnalysis),
  isBalanced: vi.fn().mockReturnValue(true),
  getGuidance: vi.fn().mockReturnValue([]),
} as unknown as DirectionalDecomposer;

const mockIntentExtractor = {
  extract: vi.fn(async (prompt) => ({
    id: "ie-mock",
    timestamp: new Date().toISOString(),
    prompt,
    primary: { action: "mock", target: "prompt", urgency: "session", confidence: 1.0 },
    secondary: [],
    context: { filesNeeded: [], toolsRequired: [], assumptions: [] },
  }) as IntentExtractionResult),
} as unknown as IntentExtractor;

const mockPromptDecompositionBridge = {
  logDecompositionStart: vi.fn().mockReturnValue("pde_span_start"),
  logDirectionalAnalysis: vi.fn().mockReturnValue("pde_span_da"),
  logIntentExtraction: vi.fn().mockReturnValue("pde_span_ie"),
  logDependencyGraph: vi.fn().mockReturnValue("pde_span_dg"),
  logActionStackBuilt: vi.fn().mockReturnValue("pde_span_as"),
  logAmbiguityDetected: vi.fn().mockReturnValue("pde_span_amb"),
  logMedicineWheelAssessment: vi.fn().mockReturnValue("pde_span_mwa"),
} as unknown as PromptDecompositionBridge;

const mockRelationalIntelligenceBridge = {
  logWheelAssessmentPerformed: vi.fn().mockReturnValue("ri_span_wa"),
  logImportanceUnitCreated: vi.fn().mockReturnValue("ri_span_iuc"),
  logImportanceUnitDeepened: vi.fn().mockReturnValue("ri_span_iud"),
  logImportanceUnitDecayed: vi.fn().mockReturnValue("ri_span_iude"),
  logValueConflictDetected: vi.fn().mockReturnValue("ri_span_vcd"),
  logSpiralCircleRecorded: vi.fn().mockReturnValue("ri_span_scr"),
  logSpiralShiftAnalyzed: vi.fn().mockReturnValue("ri_span_ssa"),
  logValueGateVerdictIssued: vi.fn().mockReturnValue("ri_span_vgvi"),
  logHumanEngagementRequested: vi.fn().mockReturnValue("ri_span_her"),
  logHumanEngagementResolved: vi.fn().mockReturnValue("ri_span_her_res"),
  logRelationalMilestoneRecorded: vi.fn().mockReturnValue("ri_span_rmr"),
  logLiminalInputCaptured: vi.fn().mockReturnValue("ri_span_lic"),
  logLiminalInputAlignmentChecked: vi.fn().mockReturnValue("ri_span_liac"),
} as unknown as RelationalIntelligenceBridge;

describe("createAgentReport", () => {
  it("creates a report with defaults", () => {
    const report = createAgentReport(
      "agent_1",
      "Mia",
      "Built database schema",
      "Schema created successfully"
    );
    expect(report.agentId).toBe("agent_1");
    expect(report.agentName).toBe("Mia");
    expect(report.complete).toBe(false);
    expect(report.confidence).toBe(0.5);
    expect(report.importanceUnits).toHaveLength(0);
  });
});

describe("FireKeeper", () => {
  let keeper: FireKeeper;

  beforeEach(() => {
    vi.clearAllMocks();
    keeper = new FireKeeper("Initial Vision", {
      wheelFilter: mockWheelFilter,
      importanceStore: mockImportanceStore,
      spiralTracker: mockSpiralTracker,
      valueGate: mockValueGate,
      promptDecomposer: mockPromptDecomposer,
      intentExtractor: mockIntentExtractor,
      promptDecompositionBridge: mockPromptDecompositionBridge,
      relationalIntelligenceBridge: mockRelationalIntelligenceBridge,
    });
  });

  describe("constructor", () => {
    it("creates with vision statement", () => {
      const newKeeper = new FireKeeper(
        "Build a relational intelligence system grounded in Indigenous paradigms"
      );
      expect(newKeeper.getVision()).toContain("relational intelligence");
      expect(newKeeper.isCeremonyOnTrack()).toBe(true);
    });
  });

  describe("processPrompt", () => {
    it("should decompose prompt and log events", async () => {
      const prompt = "Analyze the patterns and build a new module.";
      const agentId = "agent-proc";
      const sessionId = "session-proc";

      const result = await keeper.processPrompt(prompt, agentId, sessionId);

      expect(mockPromptDecompositionBridge.logDecompositionStart).toHaveBeenCalledWith(prompt, undefined);
      expect(mockPromptDecomposer.decompose).toHaveBeenCalledWith(prompt);
      expect(mockPromptDecompositionBridge.logDirectionalAnalysis).toHaveBeenCalled();
      expect(mockIntentExtractor.extract).toHaveBeenCalledWith(prompt);
      expect(mockPromptDecompositionBridge.logIntentExtraction).toHaveBeenCalled();
      expect(result.requiresHumanEngagement).toBe(false);
    });

    it("should request human engagement if prompt is unbalanced", async () => {
      mockPromptDecomposer.isBalanced.mockReturnValueOnce(false);
      mockPromptDecomposer.getGuidance.mockReturnValueOnce(["Guidance 1"]);

      const prompt = "Just build it!";
      const agentId = "agent-proc";
      const sessionId = "session-proc";

      const result = await keeper.processPrompt(prompt, agentId, sessionId);

      expect(mockPromptDecomposer.isBalanced).toHaveBeenCalled();
      expect(result.requiresHumanEngagement).toBe(true);
      expect(result.engagementRequest?.mode).toBe(EngagementMode.PROMPT_REFINEMENT);
      expect(result.engagementRequest?.context).toContain("Guidance 1");
      expect(mockRelationalIntelligenceBridge.logHumanEngagementRequested).toHaveBeenCalled();
    });

    it("should request human engagement if prompt has ambiguities", async () => {
      mockIntentExtractor.extract.mockResolvedValueOnce({
        id: "ie-mock",
        timestamp: new Date().toISOString(),
        prompt: "Ambiguous prompt.",
        primary: { action: "mock", target: "prompt", urgency: "session", confidence: 1.0 },
        secondary: [],
        context: { filesNeeded: [], toolsRequired: [], assumptions: [] },
        ambiguities: ["Ambiguity 1"],
      } as IntentExtractionResult & { ambiguities: string[] }); // Temporarily add ambiguities for mock

      const prompt = "This is ambiguous.";
      const agentId = "agent-proc";
      const sessionId = "session-proc";

      const result = await keeper.processPrompt(prompt, agentId, sessionId);

      expect(mockIntentExtractor.extract).toHaveBeenCalled();
      expect(result.requiresHumanEngagement).toBe(true);
      expect(result.engagementRequest?.mode).toBe(EngagementMode.PROMPT_REFINEMENT);
      expect(result.engagementRequest?.context).toContain("Ambiguity 1");
      expect(mockPromptDecompositionBridge.logAmbiguityDetected).toHaveBeenCalledWith(["Ambiguity 1"], undefined);
      expect(mockRelationalIntelligenceBridge.logHumanEngagementRequested).toHaveBeenCalled();
    });
  });

  describe("reviewReport", () => {
    it("accepts a basic report and logs events", async () => {
      const report = createAgentReport(
        "agent_1",
        "Mia",
        "Built API endpoint",
        "Endpoint created"
      );
      const review = await keeper.reviewReport(report); // Await here

      expect(review.accepted).toBe(true);
      expect(review.requiresHumanEngagement).toBe(false);
      expect(mockWheelFilter.assess).toHaveBeenCalled();
      expect(mockRelationalIntelligenceBridge.logWheelAssessmentPerformed).toHaveBeenCalled();
      expect(mockImportanceStore.add).toHaveBeenCalledWith(expect.any(Object));
      expect(mockRelationalIntelligenceBridge.logImportanceUnitCreated).toHaveBeenCalled();
      expect(mockSpiralTracker.recordCircle).toHaveBeenCalled();
      expect(mockRelationalIntelligenceBridge.logSpiralCircleRecorded).toHaveBeenCalled();
    });

    it("flags low confidence for human engagement and logs event", async () => {
      const report = createAgentReport(
        "agent_1",
        "Mia",
        "Attempted complex task",
        "Unsure about result",
        { confidence: 0.2 }
      );
      const review = await keeper.reviewReport(report); // Await here

      expect(review.requiresHumanEngagement).toBe(true);
      expect(review.engagementRequest).toBeTruthy();
      expect(review.engagementRequest!.mode).toBe(EngagementMode.CODE_REVIEW);
      expect(mockRelationalIntelligenceBridge.logHumanEngagementRequested).toHaveBeenCalled();
    });

    it("stores importance units from reports and logs event", async () => {
      const unit = createImportanceUnit(
        "Important insight",
        "s1",
        ImportanceContext.ANALYTICAL
      );
      const report = createAgentReport(
        "agent_1",
        "Mia",
        "Analysis",
        "Found insight",
        { importanceUnits: [unit] }
      );

      await keeper.reviewReport(report); // Await here
      expect(mockImportanceStore.add).toHaveBeenCalledWith(unit);
      expect(mockRelationalIntelligenceBridge.logImportanceUnitCreated).toHaveBeenCalledWith(unit, undefined);
    });

    it("records topic spirals from reports and logs event", async () => {
      const report = createAgentReport(
        "agent_1",
        "Mia",
        "Analysis",
        "Revisited knowledge graph topic",
        { topicsCircled: ["knowledge_graph"] }
      );

      await keeper.reviewReport(report); // Await here
      expect(mockSpiralTracker.recordCircle).toHaveBeenCalledWith(
        "knowledge_graph",
        "knowledge_graph",
        "[Via Mia]: Revisited knowledge graph topic",
        report.id
      );
      expect(mockRelationalIntelligenceBridge.logSpiralCircleRecorded).toHaveBeenCalled();
    });
  });

  describe("gateAction", () => {
    it("blocks Indigenous work without ceremony context and logs event", async () => {
      mockValueGate.evaluate.mockResolvedValueOnce({
        id: "gv-mock",
        canProceed: false,
        requiresHuman: true,
        results: [{
          constraintId: "ric-001",
          constraintName: "Research Is Ceremony",
          severity: ConstraintSeverity.HARD_STOP,
          result: { passed: false, reason: "No ceremony context" },
        }],
        failureSummary: ["No ceremony context"],
        timestamp: new Date().toISOString(),
      });

      const context = {
        action: "Design Indigenous ontology",
        actionDescription: "Create medicine wheel schema",
        agentId: "agent_1",
        sessionId: "s1",
        metadata: {},
      };
      const verdict = await keeper.gateAction(context); // Await here

      expect(verdict.canProceed).toBe(false);
      expect(verdict.requiresHuman).toBe(true);
      expect(mockValueGate.evaluate).toHaveBeenCalledWith(context);
      expect(mockRelationalIntelligenceBridge.logValueGateVerdictIssued).toHaveBeenCalledWith(verdict, undefined);
    });

    it("allows general technical work and logs event", async () => {
      const context = {
        action: "Add REST endpoint",
        actionDescription: "Simple CRUD operation",
        agentId: "agent_1",
        sessionId: "s1",
        metadata: {},
      };
      const verdict = await keeper.gateAction(context); // Await here

      expect(verdict.canProceed).toBe(true);
      expect(verdict.requiresHuman).toBe(false);
      expect(mockValueGate.evaluate).toHaveBeenCalledWith(context);
      expect(mockRelationalIntelligenceBridge.logValueGateVerdictIssued).toHaveBeenCalledWith(verdict, undefined);
    });
  });

  describe("canAgentProceed", () => {
    it("provides quick check", async () => {
      const result = await keeper.canAgentProceed( // Await here
        "Add a button",
        "UI component",
        "agent_1",
        "s1"
      );
      expect(typeof result).toBe("boolean");
      expect(mockValueGate.canProceed).toHaveBeenCalled();
    });
  });

  describe("relational milestones", () => {
    it("records a milestone and logs event", async () => {
      const milestone = await keeper.recordMilestone( // Await here
        "Completed knowledge graph design with relational care",
        ["knowledge_graph"],
        ["unit_1"]
      );

      expect(milestone.id).toBeTruthy();
      expect(milestone.description).toContain("knowledge graph");
      expect(milestone.relatedSpirals).toContain("knowledge_graph");
      expect(mockRelationalIntelligenceBridge.logRelationalMilestoneRecorded).toHaveBeenCalledWith(milestone, undefined);
    });

    it("determines pruning eligibility", async () => {
      const newKeeper = new FireKeeper("Vision", { wheelFilter: mockWheelFilter });
      // No milestones -- cannot prune
      expect(newKeeper.canPrune()).toBe(false);

      // Add a milestone
      await newKeeper.recordMilestone( // Await here
        "Completed relational design",
        [],
        ["unit_1"]
      );

      // Now pruning depends on milestone balance
      expect(typeof newKeeper.canPrune()).toBe("boolean");
    });
  });

  describe("human engagement", () => {
    it("creates engagement requests and logs event", () => {
      const request = keeper.requestHumanEngagement(
        "Need vision alignment",
        EngagementMode.VISION,
        "The ontology design needs directional input",
        "agent_1",
        0.8
      );

      expect(request.mode).toBe(EngagementMode.VISION);
      expect(request.priority).toBe(0.8);
      expect(mockRelationalIntelligenceBridge.logHumanEngagementRequested).toHaveBeenCalledWith(request, undefined);
    });

    it("returns engagements sorted by priority", () => {
      keeper.requestHumanEngagement(
        "Low priority",
        EngagementMode.CODE_REVIEW,
        "context",
        "a1",
        0.3
      );
      keeper.requestHumanEngagement(
        "High priority",
        EngagementMode.CEREMONY,
        "context",
        "a2",
        0.9
      );

      const pending = keeper.getPendingEngagements();
      expect(pending[0].priority).toBe(0.9);
      expect(pending[1].priority).toBe(0.3);
    });

    it("resolves engagement requests and logs event", () => {
      const request = keeper.requestHumanEngagement(
        "test",
        EngagementMode.VISION,
        "context",
        "a1"
      );

      keeper.resolveEngagement(request.id);
      expect(keeper.getPendingEngagements()).toHaveLength(0);
      expect(mockRelationalIntelligenceBridge.logHumanEngagementResolved).toHaveBeenCalledWith(request.id, undefined);
    });
  });

  describe("state access", () => {
    it("gets and updates vision", () => {
      const newKeeper = new FireKeeper("Original vision");
      expect(newKeeper.getVision()).toBe("Original vision");

      newKeeper.updateVision("Updated vision");
      expect(newKeeper.getVision()).toBe("Updated vision");
    });

    it("provides access to sub-systems", () => {
      expect(keeper.getImportanceStore()).toBe(mockImportanceStore);
      expect(keeper.getSpiralTracker()).toBe(mockSpiralTracker);
      expect(keeper.getValueGate()).toBe(mockValueGate);
      expect(keeper.getWheelFilter()).toBe(mockWheelFilter);
    });

    it("gets summary", async () => { // Make async because of spiralTracker.getByDepth
      const summary = await keeper.getSummary();

      expect(summary.vision).toBe("Initial Vision");
      expect(summary.ceremonyOnTrack).toBe(true);
      expect(typeof summary.relationalHealth).toBe("number");
      expect(typeof summary.pendingReports).toBe("number");
    });

    it("tracks deepest spirals", async () => { // Make async due to spiralTracker.getByDepth
      mockSpiralTracker.getByDepth.mockResolvedValueOnce([
        { topicKey: "a", depth: 3 },
        { topicKey: "b", depth: 2 },
      ]);
      const deepest = await keeper.getDeepestSpirals(2);
      expect(deepest[0].topicKey).toBe("a");
      expect(deepest[0].depth).toBe(3);
    });
  });
});
