import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  LangGraphBridge,
  ThreeUniverseAnalysisLike,
} from "../adapters/langgraph_bridge.js";
import {
  PromptDecompositionBridge,
} from "../adapters/prompt_decomposition_bridge.js";
import {
  RelationalIntelligenceBridge,
} from "../adapters/relational_intelligence_bridge.js";
import { NarrativeTracingHandler } from "../handler.js";
import { NarrativeEventType } from "../event_types.js";
import { DirectionalAnalysis, IntentExtractionResult, DependencyGraph, ActionItem, WheelEnrichedAnalysis } from "../../../prompt-decomposition/src/index.js";
import {
  WheelAssessment,
  ImportanceUnit,
  ImportanceContext,
  RelationalSource,
  createQuadrantPresence,
  GateVerdict,
  ConstraintSeverity,
  HumanEngagementRequest,
  EngagementMode,
  RelationalMilestone,
  EpistemicCircle,
  SpiralShiftAnalysis,
  LiminalInput,
  LiminalMode,
} from "../../../relational-intelligence/src/index.js";

// Mock Langfuse
vi.mock("langfuse", () => ({
  Langfuse: vi.fn().mockImplementation(() => ({
    trace: vi.fn().mockReturnValue({
      span: vi.fn().mockReturnValue({}),
      update: vi.fn(),
    }),
    flush: vi.fn(),
  })),
}));

describe("LangGraphBridge", () => {
  let mockHandler: NarrativeTracingHandler;
  let bridge: LangGraphBridge;

  beforeEach(() => {
    // Create a mock handler with necessary methods
    mockHandler = {
      logThreeUniverseAnalysis: vi.fn().mockReturnValue("span_123"),
      logBeatCreation: vi.fn().mockReturnValue("span_456"),
      logEvent: vi.fn().mockReturnValue("generic_span_id"),
      flush: vi.fn(),
    } as unknown as NarrativeTracingHandler;

    bridge = new LangGraphBridge(mockHandler);
  });

  describe("createThreeUniverseCallback", () => {
    it("should create a callback that logs analysis", () => {
      const callback = bridge.createThreeUniverseCallback();

      const spanId = callback({
        eventId: "evt_123",
        eventContent: "Test event",
        engineerResult: { intent: "feature_implementation", confidence: 0.8 },
        ceremonyResult: { intent: "co_creation", confidence: 0.7 },
        storyEngineResult: { intent: "rising_action", confidence: 0.85 },
        leadUniverse: "story_engine",
        coherenceScore: 0.82,
      });

      expect(spanId).toBe("span_123");
      expect(mockHandler.logThreeUniverseAnalysis).toHaveBeenCalledWith({
        eventId: "evt_123",
        engineerIntent: "feature_implementation",
        engineerConfidence: 0.8,
        ceremonyIntent: "co_creation",
        ceremonyConfidence: 0.7,
        storyEngineIntent: "rising_action",
        storyEngineConfidence: 0.85,
        leadUniverse: "story_engine",
        coherenceScore: 0.82,
        parentSpanId: undefined,
      });
    });

    it("should validate coherence score range", () => {
      const callback = bridge.createThreeUniverseCallback();

      expect(() =>
        callback({
          eventId: "evt_123",
          eventContent: "Test",
          engineerResult: { intent: "test", confidence: 0.5 },
          ceremonyResult: { intent: "test", confidence: 0.5 },
          storyEngineResult: { intent: "test", confidence: 0.5 },
          leadUniverse: "engineer",
          coherenceScore: 1.5, // Invalid
        })
      ).toThrow("coherence_score must be between 0.0 and 1.0");

      expect(() =>
        callback({
          eventId: "evt_123",
          eventContent: "Test",
          engineerResult: { intent: "test", confidence: 0.5 },
          ceremonyResult: { intent: "test", confidence: 0.5 },
          storyEngineResult: { intent: "test", confidence: 0.5 },
          leadUniverse: "engineer",
          coherenceScore: -0.1, // Invalid
        })
      ).toThrow("coherence_score must be between 0.0 and 1.0");
    });

    it("should validate lead universe", () => {
      const callback = bridge.createThreeUniverseCallback();

      expect(() =>
        callback({
          eventId: "evt_123",
          eventContent: "Test",
          engineerResult: { intent: "test", confidence: 0.5 },
          ceremonyResult: { intent: "test", confidence: 0.5 },
          storyEngineResult: { intent: "test", confidence: 0.5 },
          leadUniverse: "invalid_universe", // Invalid
          coherenceScore: 0.8,
        })
      ).toThrow("lead_universe must be one of");
    });

    it("should increment analysis count", () => {
      const callback = bridge.createThreeUniverseCallback();

      expect(bridge.analysisCount).toBe(0);

      callback({
        eventId: "evt_1",
        eventContent: "Test",
        engineerResult: { intent: "test", confidence: 0.5 },
        ceremonyResult: { intent: "test", confidence: 0.5 },
        storyEngineResult: { intent: "test", confidence: 0.5 },
        leadUniverse: "engineer",
        coherenceScore: 0.8,
      });

      expect(bridge.analysisCount).toBe(1);

      callback({
        eventId: "evt_2",
        eventContent: "Test",
        engineerResult: { intent: "test", confidence: 0.5 },
        ceremonyResult: { intent: "test", confidence: 0.5 },
        storyEngineResult: { intent: "test", confidence: 0.5 },
        leadUniverse: "ceremony",
        coherenceScore: 0.7,
      });

      expect(bridge.analysisCount).toBe(2);
    });
  });

  describe("logAnalysis", () => {
    it("should log analysis object directly", () => {
      const analysis: ThreeUniverseAnalysisLike = {
        engineer: { intent: "feature_request", confidence: 0.9 },
        ceremony: { intent: "ritual", confidence: 0.6 },
        storyEngine: { intent: "inciting_incident", confidence: 0.95 },
        leadUniverse: "story_engine",
        coherenceScore: 0.88,
      };

      const spanId = bridge.logAnalysis("evt_123", analysis);

      expect(spanId).toBe("span_123");
      expect(mockHandler.logThreeUniverseAnalysis).toHaveBeenCalledWith({
        eventId: "evt_123",
        engineerIntent: "feature_request",
        engineerConfidence: 0.9,
        ceremonyIntent: "ritual",
        ceremonyConfidence: 0.6,
        storyEngineIntent: "inciting_incident",
        storyEngineConfidence: 0.95,
        leadUniverse: "story_engine",
        coherenceScore: 0.88,
        parentSpanId: undefined,
      });
    });

    it("should handle enum-style leadUniverse", () => {
      const analysis: ThreeUniverseAnalysisLike = {
        engineer: { intent: "test", confidence: 0.5 },
        ceremony: { intent: "test", confidence: 0.5 },
        storyEngine: { intent: "test", confidence: 0.5 },
        leadUniverse: { value: "ceremony" },
        coherenceScore: 0.75,
      };

      bridge.logAnalysis("evt_123", analysis);

      expect(mockHandler.logThreeUniverseAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          leadUniverse: "ceremony",
        })
      );
    });
  });

  describe("logBeatCreation", () => {
    it("should log beat creation", () => {
      const spanId = bridge.logBeatCreation(
        "beat_001",
        "The story begins...",
        1,
        "inciting_incident"
      );

      expect(spanId).toBe("span_456");
      expect(mockHandler.logBeatCreation).toHaveBeenCalledWith(
        "beat_001",
        "The story begins...",
        1,
        "inciting_incident",
        {
          source: "three_universe_processor",
          emotionalTone: undefined,
          parentSpanId: undefined,
        }
      );
    });

    it("should use lead universe as source when analysis provided", () => {
      const analysis: ThreeUniverseAnalysisLike = {
        engineer: { intent: "test", confidence: 0.5 },
        ceremony: { intent: "test", confidence: 0.5 },
        storyEngine: { intent: "test", confidence: 0.5 },
        leadUniverse: "engineer",
        coherenceScore: 0.8,
      };

      bridge.logBeatCreation("beat_001", "Content", 1, "rising_action", {
        analysis,
      });

      expect(mockHandler.logBeatCreation).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          source: "engineer_led",
        })
      );
    });
  });

  describe("traceProcessor", () => {
    it("should wrap async function and trace result", async () => {
      const mockProcessor = vi.fn().mockResolvedValue({
        engineer: { intent: "test", confidence: 0.5 },
        ceremony: { intent: "test", confidence: 0.5 },
        storyEngine: { intent: "test", confidence: 0.5 },
        leadUniverse: "engineer",
        coherenceScore: 0.8,
      });

      const wrapped = bridge.traceProcessor(mockProcessor);
      const event = { eventId: "evt_123", content: "Test event" };
      const result = await wrapped(event);

      expect(mockProcessor).toHaveBeenCalledWith(event);
      expect(mockHandler.logThreeUniverseAnalysis).toHaveBeenCalled();
      expect(result.leadUniverse).toBe("engineer");
    });

    it("should use custom event ID extractor", async () => {
      const mockProcessor = vi.fn().mockResolvedValue({
        engineer: { intent: "test", confidence: 0.5 },
        ceremony: { intent: "test", confidence: 0.5 },
        storyEngine: { intent: "test", confidence: 0.5 },
        leadUniverse: "ceremony",
        coherenceScore: 0.9,
      });

      const wrapped = bridge.traceProcessor(
        mockProcessor,
        (event) => `custom_${event.id}`
      );

      await wrapped({ id: "42" });

      expect(mockHandler.logThreeUniverseAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: "custom_42",
        })
      );
    });
  });

  describe("resetCount", () => {
    it("should reset analysis count", () => {
      const callback = bridge.createThreeUniverseCallback();

      callback({
        eventId: "evt_1",
        eventContent: "Test",
        engineerResult: { intent: "test", confidence: 0.5 },
        ceremonyResult: { intent: "test", confidence: 0.5 },
        storyEngineResult: { intent: "test", confidence: 0.5 },
        leadUniverse: "engineer",
        coherenceScore: 0.8,
      });

      expect(bridge.analysisCount).toBe(1);

      bridge.resetCount();

      expect(bridge.analysisCount).toBe(0);
    });
  });
});

describe("PromptDecompositionBridge", () => {
  let mockHandler: NarrativeTracingHandler;
  let pdeBridge: PromptDecompositionBridge;

  beforeEach(() => {
    mockHandler = {
      logEvent: vi.fn().mockReturnValue("pde_span_id"),
      flush: vi.fn(),
    } as unknown as NarrativeTracingHandler;
    pdeBridge = new PromptDecompositionBridge(mockHandler);
  });

  it("should log decomposition start", () => {
    const prompt = "Analyze the code.";
    const spanId = pdeBridge.logDecompositionStart(prompt);
    expect(spanId).toBe("pde_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.PROMPT_DECOMPOSITION_STARTED,
        inputData: { prompt_preview: prompt },
      })
    );
  });

  it("should log directional analysis", () => {
    const mockAnalysis: DirectionalAnalysis = {
      id: "da-1",
      timestamp: new Date().toISOString(),
      prompt: "Test prompt for analysis",
      directions: {
        east: [], south: [], west: [], north: [{ text: "act", confidence: 1, implicit: false }],
      },
      leadDirection: "north",
      neglectedDirections: ["east", "south", "west"],
      balance: 0.25,
    };
    const spanId = pdeBridge.logDirectionalAnalysis(mockAnalysis);
    expect(spanId).toBe("pde_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.DIRECTIONAL_ANALYSIS_PERFORMED,
        outputData: {
          lead_direction: mockAnalysis.leadDirection,
          balance: mockAnalysis.balance,
          neglected_directions: mockAnalysis.neglectedDirections,
          insights_count: 1,
        },
        metadata: {
          lead_direction: mockAnalysis.leadDirection,
          balance: mockAnalysis.balance,
        },
      })
    );
  });

  it("should log intent extraction", () => {
    const mockIntentResult: IntentExtractionResult = {
      id: "ie-1",
      timestamp: new Date().toISOString(),
      prompt: "Extract intents from this.",
      primary: { action: "extract", target: "intents", urgency: "session", confidence: 0.9 },
      secondary: [{ id: "si-1", action: "identify", target: "keywords", implicit: false, dependency: null, confidence: 0.8 }],
      context: { filesNeeded: [], toolsRequired: ["llm"], assumptions: [] },
    };
    const spanId = pdeBridge.logIntentExtraction(mockIntentResult);
    expect(spanId).toBe("pde_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.INTENT_EXTRACTION_PERFORMED,
        inputData: { prompt_preview: mockIntentResult.prompt },
        outputData: {
          primary_action: mockIntentResult.primary.action,
          primary_target: mockIntentResult.primary.target,
          primary_confidence: mockIntentResult.primary.confidence,
          secondary_intents_count: mockIntentResult.secondary.length,
          extracted_files: mockIntentResult.context.filesNeeded,
          extracted_tools: mockIntentResult.context.toolsRequired,
        },
        metadata: {
          primary_action: mockIntentResult.primary.action,
          primary_confidence: mockIntentResult.primary.confidence,
        },
      })
    );
  });

  it("should log dependency graph built", () => {
    const mockDependencyGraph: DependencyGraph = {
      id: "dg-1",
      nodes: new Map(),
      roots: ["node-1"],
      leaves: ["node-2"],
      maxDepth: 1,
      hasCycle: false,
    };
    mockDependencyGraph.nodes.set("node-1", { id: "node-1", intentId: "i-1", action: "start", target: "task", direction: "north", dependencies: [], dependents: ["node-2"], depth: 0, completed: false });
    mockDependencyGraph.nodes.set("node-2", { id: "node-2", intentId: "i-2", action: "end", target: "task", direction: "north", dependencies: ["node-1"], dependents: [], depth: 1, completed: false });

    const spanId = pdeBridge.logDependencyGraph(mockDependencyGraph);
    expect(spanId).toBe("pde_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.DEPENDENCY_GRAPH_BUILT,
        outputData: {
          nodes_count: mockDependencyGraph.nodes.size,
          roots_count: mockDependencyGraph.roots.length,
          leaves_count: mockDependencyGraph.leaves.length,
          max_depth: mockDependencyGraph.maxDepth,
          has_cycle: mockDependencyGraph.hasCycle,
        },
        metadata: {
          has_cycle: mockDependencyGraph.hasCycle,
          max_depth: mockDependencyGraph.maxDepth,
        },
      })
    );
  });

  it("should log action stack built", () => {
    const mockActionStack: ActionItem[] = [
      { id: "a-1", text: "Action 1", direction: "north", dependency: null, completed: false, confidence: 0.9, implicit: false },
      { id: "a-2", text: "Action 2", direction: "north", dependency: "a-1", completed: false, confidence: 0.8, implicit: false },
    ];
    const spanId = pdeBridge.logActionStackBuilt(mockActionStack);
    expect(spanId).toBe("pde_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.ACTION_STACK_BUILT,
        outputData: {
          action_items_count: mockActionStack.length,
          first_action: mockActionStack[0].text,
          last_action: mockActionStack[1].text,
        },
        metadata: {
          action_items_count: mockActionStack.length,
        },
      })
    );
  });

  it("should log ambiguity detected", () => {
    const mockAmbiguities = ["Low confidence primary intent.", "Neglected east direction."];
    const spanId = pdeBridge.logAmbiguityDetected(mockAmbiguities);
    expect(spanId).toBe("pde_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.AMBIGUITY_DETECTED,
        outputData: {
          ambiguities_count: mockAmbiguities.length,
          ambiguity_previews: mockAmbiguities,
        },
        metadata: {
          ambiguities_count: mockAmbiguities.length,
        },
      })
    );
  });

  it("should log medicine wheel assessment from PDE", () => {
    const mockWheelEnrichedAnalysis: WheelEnrichedAnalysis = {
      id: "wea-1",
      timestamp: new Date().toISOString(),
      prompt: "Assess this prompt.",
      directions: {
        east: [], south: [], west: [], north: [{ text: "assess", confidence: 1, implicit: false }],
      },
      leadDirection: "north",
      neglectedDirections: ["east", "south", "west"],
      balance: 0.25,
      wheelMapping: {
        east: MedicineWheelQuadrant.SPIRITUAL,
        south: MedicineWheelQuadrant.MENTAL,
        west: MedicineWheelQuadrant.EMOTIONAL,
        north: MedicineWheelQuadrant.PHYSICAL,
      },
      quadrantPresence: {
        physical: 0.8, emotional: 0.1, mental: 0.1, spiritual: 0.0,
      },
      relationalCoverage: 0.25,
      ceremonyRequired: true,
    };
    const spanId = pdeBridge.logMedicineWheelAssessment(mockWheelEnrichedAnalysis);
    expect(spanId).toBe("pde_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.MEDICINE_WHEEL_ASSESSMENT,
        outputData: {
          lead_quadrant: mockWheelEnrichedAnalysis.leadDirection,
          relational_coverage: mockWheelEnrichedAnalysis.relationalCoverage,
          ceremony_required: mockWheelEnrichedAnalysis.ceremonyRequired,
          quadrant_presence: mockWheelEnrichedAnalysis.quadrantPresence,
        },
        metadata: {
          ceremony_required: mockWheelEnrichedAnalysis.ceremonyRequired,
          relational_coverage: mockWheelEnrichedAnalysis.relationalCoverage,
        },
      })
    );
  });
});

describe("RelationalIntelligenceBridge", () => {
  let mockHandler: NarrativeTracingHandler;
  let riBridge: RelationalIntelligenceBridge;

  beforeEach(() => {
    mockHandler = {
      logEvent: vi.fn().mockReturnValue("ri_span_id"),
      flush: vi.fn(),
    } as unknown as NarrativeTracingHandler;
    riBridge = new RelationalIntelligenceBridge(mockHandler);
  });

  it("should log wheel assessment performed", () => {
    const mockAssessment: WheelAssessment = {
      id: "wa-1",
      inputId: "input-1",
      presence: createQuadrantPresence({ physical: 0.5, mental: 0.5 }),
      leadQuadrant: MedicineWheelQuadrant.PHYSICAL,
      neglectedQuadrants: [MedicineWheelQuadrant.EMOTIONAL, MedicineWheelQuadrant.SPIRITUAL],
      relationalCoverage: 0.5,
      balanced: false,
      timestamp: new Date().toISOString(),
    };
    const spanId = riBridge.logWheelAssessmentPerformed(mockAssessment);
    expect(spanId).toBe("ri_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.WHEEL_ASSESSMENT_PERFORMED,
        outputData: {
          lead_quadrant: mockAssessment.leadQuadrant,
          relational_coverage: mockAssessment.relationalCoverage,
          balanced: mockAssessment.balanced,
          neglected_quadrants: mockAssessment.neglectedQuadrants,
          presence: mockAssessment.presence,
        },
        metadata: {
          lead_quadrant: mockAssessment.leadQuadrant,
          balanced: mockAssessment.balanced,
        },
      })
    );
  });

  it("should log importance unit created", () => {
    const mockUnit: ImportanceUnit = {
      id: "iu-1",
      content: "Important insight",
      sourceSessionId: "s-1",
      context: ImportanceContext.ANALYTICAL,
      wheelPresence: createQuadrantPresence(),
      accountabilityScore: 0.7,
      valueAlignmentScore: 0.8,
      iterationCount: 0,
      humanValidated: false,
      explicitAsks: [],
      implicitAsks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      relationalStrings: [],
    };
    const spanId = riBridge.logImportanceUnitCreated(mockUnit);
    expect(spanId).toBe("ri_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.IMPORTANCE_UNIT_CREATED,
        outputData: {
          unit_id: mockUnit.id,
          context: mockUnit.context,
          accountability_score: mockUnit.accountabilityScore,
        },
        metadata: {
          unit_id: mockUnit.id,
          context: mockUnit.context,
        },
      })
    );
  });

  it("should log importance unit deepened", () => {
    const mockUnit: ImportanceUnit = {
      id: "iu-1",
      content: "Important insight",
      sourceSessionId: "s-1",
      context: ImportanceContext.ANALYTICAL,
      wheelPresence: createQuadrantPresence(),
      accountabilityScore: 0.7,
      valueAlignmentScore: 0.8,
      iterationCount: 1,
      humanValidated: false,
      explicitAsks: [],
      implicitAsks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      relationalStrings: [],
    };
    const refinement = "Added more details";
    const spanId = riBridge.logImportanceUnitDeepened(mockUnit, refinement);
    expect(spanId).toBe("ri_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.IMPORTANCE_UNIT_DEEPENED,
        inputData: { unit_id: mockUnit.id, refinement_preview: refinement },
        outputData: {
          new_iteration_count: mockUnit.iterationCount,
          new_accountability_score: mockUnit.accountabilityScore,
        },
        metadata: {
          unit_id: mockUnit.id,
          iteration_count: mockUnit.iterationCount,
        },
      })
    );
  });

  it("should log importance unit decayed", () => {
    const mockUnit: ImportanceUnit = {
      id: "iu-1",
      content: "Important insight",
      sourceSessionId: "s-1",
      context: ImportanceContext.ANALYTICAL,
      wheelPresence: createQuadrantPresence(),
      accountabilityScore: 0.6,
      valueAlignmentScore: 0.8,
      iterationCount: 0,
      humanValidated: false,
      explicitAsks: [],
      implicitAsks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      relationalStrings: [],
    };
    const spanId = riBridge.logImportanceUnitDecayed(mockUnit);
    expect(spanId).toBe("ri_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.IMPORTANCE_UNIT_DECAYED,
        outputData: {
          new_accountability_score: mockUnit.accountabilityScore,
        },
        metadata: {
          unit_id: mockUnit.id,
        },
      })
    );
  });

  it("should log value conflict detected", () => {
    const mockUnit: ImportanceUnit = {
      id: "iu-1",
      content: "Conflicting values",
      sourceSessionId: "s-1",
      context: ImportanceContext.ANALYTICAL,
      wheelPresence: createQuadrantPresence(),
      accountabilityScore: 0.8,
      valueAlignmentScore: 0.2,
      iterationCount: 0,
      humanValidated: false,
      explicitAsks: [],
      implicitAsks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      relationalStrings: [],
    };
    const spanId = riBridge.logValueConflictDetected(mockUnit);
    expect(spanId).toBe("ri_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.VALUE_CONFLICT_DETECTED,
        inputData: { unit_id: mockUnit.id, content_preview: mockUnit.content },
        metadata: {
          unit_id: mockUnit.id,
        },
      })
    );
  });

  it("should log spiral circle recorded", () => {
    const mockCircle: EpistemicCircle = {
      id: "ec-1",
      topicKey: "ontology",
      iteration: 1,
      content: "Initial thoughts",
      delta: "",
      sessionId: "s-1",
      timestamp: new Date().toISOString(),
    };
    const spanId = riBridge.logSpiralCircleRecorded(mockCircle);
    expect(spanId).toBe("ri_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.SPIRAL_CIRCLE_RECORDED,
        inputData: { topic_key: mockCircle.topicKey, content_preview: mockCircle.content },
        outputData: {
          iteration: mockCircle.iteration,
          delta_preview: mockCircle.delta,
        },
        metadata: {
          topic_key: mockCircle.topicKey,
          iteration: mockCircle.iteration,
        },
      })
    );
  });

  it("should log spiral shift analyzed", () => {
    const mockShift: SpiralShiftAnalysis = {
      circleId: "ec-1",
      iteration: 1,
      newConcepts: ["concept1"],
      refinedConcepts: [],
      shiftType: SpiralShiftType.OPENING,
      significance: 1.0,
    };
    const spanId = riBridge.logSpiralShiftAnalyzed(mockShift);
    expect(spanId).toBe("ri_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.SPIRAL_SHIFT_ANALYZED,
        inputData: { circle_id: mockShift.circleId },
        outputData: {
          shift_type: mockShift.shiftType,
          significance: mockShift.significance,
          new_concepts: mockShift.newConcepts.join(", "),
          refined_concepts: mockShift.refinedConcepts.join(", "),
        },
        metadata: {
          shift_type: mockShift.shiftType,
          significance: mockShift.significance,
        },
      })
    );
  });

  it("should log value gate verdict issued", () => {
    const mockVerdict: GateVerdict = {
      id: "gv-1",
      canProceed: false,
      requiresHuman: true,
      results: [{
        constraintId: "c-1", constraintName: "Test Constraint", severity: ConstraintSeverity.HARD_STOP, result: { passed: false, reason: "Failed" },
      }],
      failureSummary: ["Failed constraint"],
      timestamp: new Date().toISOString(),
    };
    const spanId = riBridge.logValueGateVerdictIssued(mockVerdict);
    expect(spanId).toBe("ri_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.VALUE_GATE_VERDICT_ISSUED,
        outputData: {
          can_proceed: mockVerdict.canProceed,
          requires_human: mockVerdict.requiresHuman,
          failure_summary: mockVerdict.failureSummary.join(" | "),
        },
        metadata: {
          can_proceed: mockVerdict.canProceed,
          requires_human: mockVerdict.requiresHuman,
        },
      })
    );
  });

  it("should log human engagement requested", () => {
    const mockRequest: HumanEngagementRequest = {
      id: "her-1",
      reason: "Need vision alignment",
      mode: EngagementMode.VISION,
      context: "Context details",
      priority: 0.9,
      requestingAgentId: "a-1",
      timestamp: new Date().toISOString(),
    };
    const spanId = riBridge.logHumanEngagementRequested(mockRequest);
    expect(spanId).toBe("ri_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.HUMAN_ENGAGEMENT_REQUESTED,
        outputData: {
          request_id: mockRequest.id,
          mode: mockRequest.mode,
          priority: mockRequest.priority,
        },
        metadata: {
          request_id: mockRequest.id,
          mode: mockRequest.mode,
        },
      })
    );
  });

  it("should log human engagement resolved", () => {
    const requestId = "her-1";
    const spanId = riBridge.logHumanEngagementResolved(requestId);
    expect(spanId).toBe("ri_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.HUMAN_ENGAGEMENT_RESOLVED,
        inputData: { request_id: requestId },
        metadata: {
          request_id: requestId,
        },
      })
    );
  });

  it("should log relational milestone recorded", () => {
    const mockMilestone: RelationalMilestone = {
      id: "rm-1",
      description: "Completed phase 1",
      relatedSpirals: ["s-1"],
      wheelAssessment: {
        id: "wa-1",
        inputId: "input-1",
        presence: createQuadrantPresence(),
        leadQuadrant: MedicineWheelQuadrant.PHYSICAL,
        neglectedQuadrants: [],
        relationalCoverage: 1,
        balanced: true,
        timestamp: new Date().toISOString(),
      },
      resolvedUnits: ["iu-1"],
      allowsPruning: true,
      timestamp: new Date().toISOString(),
    };
    const spanId = riBridge.logRelationalMilestoneRecorded(mockMilestone);
    expect(spanId).toBe("ri_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.RELATIONAL_MILESTONE_RECORDED,
        outputData: {
          milestone_id: mockMilestone.id,
          allows_pruning: mockMilestone.allowsPruning,
        },
        metadata: {
          milestone_id: mockMilestone.id,
          allows_pruning: mockMilestone.allowsPruning,
        },
      })
    );
  });

  it("should log liminal input captured", () => {
    const mockLiminalInput: LiminalInput = {
      id: "li-1",
      content: "A dream insight",
      mode: LiminalMode.DREAM_RECALL,
      weight: 1.4,
      sessionId: "s-1",
      importanceUnits: [],
      integrated: false,
      influenceCount: 0,
      capturedAt: new Date().toISOString(),
    };
    const spanId = riBridge.logLiminalInputCaptured(mockLiminalInput);
    expect(spanId).toBe("ri_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.LIMINAL_INPUT_CAPTURED,
        outputData: {
          input_id: mockLiminalInput.id,
          mode: mockLiminalInput.mode,
          weight: mockLiminalInput.weight,
        },
        metadata: {
          input_id: mockLiminalInput.id,
          mode: mockLiminalInput.mode,
        },
      })
    );
  });

  it("should log liminal input alignment checked", () => {
    const mockCheckResult = {
      aligned: false,
      conflicts: ["Conflict 1", "Conflict 2"],
      supportingInputs: [],
    };
    const spanId = riBridge.logLiminalInputAlignmentChecked(mockCheckResult);
    expect(spanId).toBe("ri_span_id");
    expect(mockHandler.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NarrativeEventType.LIMINAL_INPUT_ALIGNMENT_CHECKED,
        outputData: {
          aligned: mockCheckResult.aligned,
          conflicts_count: mockCheckResult.conflicts.length,
          conflicts_preview: mockCheckResult.conflicts.join(" | "),
        },
        metadata: {
          aligned: mockCheckResult.aligned,
        },
      })
    );
  });
});

