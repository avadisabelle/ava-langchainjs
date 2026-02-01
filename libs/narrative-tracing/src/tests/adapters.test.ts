import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  LangGraphBridge,
  ThreeUniverseAnalysisLike,
} from "../adapters/langgraph_bridge.js";
import { NarrativeTracingHandler } from "../handler.js";

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
