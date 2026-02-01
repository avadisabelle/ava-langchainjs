import { describe, it, expect, beforeEach, vi } from "vitest";
import { NarrativeTraceFormatter } from "../formatter.js";
import {
  NarrativeEventType,
  NarrativeSpan,
  NarrativeMetrics,
  createNarrativeMetrics,
  createTraceCorrelation,
} from "../event_types.js";
import { CompletedTrace } from "../orchestrator.js";

describe("NarrativeTraceFormatter", () => {
  let formatter: NarrativeTraceFormatter;

  beforeEach(() => {
    formatter = new NarrativeTraceFormatter();
  });

  function createMockCompletedTrace(
    overrides: Partial<CompletedTrace> = {}
  ): CompletedTrace {
    return {
      traceId: "trace_123",
      storyId: "story_456",
      sessionId: "session_789",
      spans: [],
      startTime: "2025-01-01T00:00:00.000Z",
      endTime: "2025-01-01T00:01:00.000Z",
      durationMs: 60000,
      metrics: undefined,
      storyContent: undefined,
      beatCount: 0,
      correlation: undefined,
      ...overrides,
    };
  }

  function createMockSpan(
    overrides: Partial<NarrativeSpan> = {}
  ): NarrativeSpan {
    return {
      spanId: "span_123",
      traceId: "trace_123",
      eventType: NarrativeEventType.BEAT_CREATED,
      storyId: "story_456",
      sessionId: "session_789",
      characterIds: [],
      startTime: "2025-01-01T00:00:00.000Z",
      success: true,
      ...overrides,
    };
  }

  describe("formatForDisplay", () => {
    it("should format empty trace", () => {
      const trace = createMockCompletedTrace();
      const output = formatter.formatForDisplay(trace);

      expect(output).toContain("📖 Story Generation: story_456");
      expect(output).toContain("Session: session_789");
      expect(output).toContain("Duration: 60000ms");
    });

    it("should format trace with beats", () => {
      const trace = createMockCompletedTrace({
        spans: [
          createMockSpan({
            beatId: "beat_001",
            eventType: NarrativeEventType.BEAT_CREATED,
            emotionalTone: "wonder",
          }),
          createMockSpan({
            beatId: "beat_001",
            eventType: NarrativeEventType.BEAT_ANALYZED,
            outputData: { confidence: 0.85 },
          }),
        ],
      });

      const output = formatter.formatForDisplay(trace);

      expect(output).toContain("beat_001");
      expect(output).toContain("wonder");
    });

    it("should format trace with metrics", () => {
      const metrics = createNarrativeMetrics();
      metrics.coherenceScore = 0.87;
      metrics.emotionalArcStrength = 0.92;
      metrics.themeClarity = 0.75;
      metrics.beatsGenerated = 5;

      const trace = createMockCompletedTrace({ metrics });
      const output = formatter.formatForDisplay(trace);

      expect(output).toContain("Final Metrics");
      expect(output).toContain("coherence: 0.87");
      expect(output).toContain("emotional_arc: 0.92");
      expect(output).toContain("theme_clarity: 0.75");
      expect(output).toContain("beats_generated: 5");
    });
  });

  describe("formatAsTimeline", () => {
    it("should format timeline with timestamps", () => {
      const trace = createMockCompletedTrace({
        spans: [
          createMockSpan({
            startTime: "2025-01-01T12:00:00.000Z",
            eventType: NarrativeEventType.BEAT_CREATED,
          }),
          createMockSpan({
            startTime: "2025-01-01T12:00:05.000Z",
            eventType: NarrativeEventType.BEAT_ANALYZED,
          }),
        ],
      });

      const output = formatter.formatAsTimeline(trace);

      expect(output).toContain("📅 Timeline: story_456");
      expect(output).toContain("12:00:00");
      expect(output).toContain("12:00:05");
    });

    it("should include beat context in timeline", () => {
      const trace = createMockCompletedTrace({
        spans: [
          createMockSpan({
            beatId: "beat_001",
            emotionalTone: "tension",
            leadUniverse: "story_engine",
          }),
        ],
      });

      const output = formatter.formatAsTimeline(trace);

      expect(output).toContain("beat: beat_001");
      expect(output).toContain("emotion: tension");
      expect(output).toContain("universe: story_engine");
    });
  });

  describe("exportAsMarkdown", () => {
    it("should generate valid markdown", () => {
      const trace = createMockCompletedTrace({
        storyContent: "Once upon a time...",
      });

      const output = formatter.exportAsMarkdown(trace);

      expect(output).toContain("# Story Generation Trace: story_456");
      expect(output).toContain("## Metadata");
      expect(output).toContain("- **Story ID**: story_456");
      expect(output).toContain("```");
      expect(output).toContain("Once upon a time...");
    });

    it("should include metrics table", () => {
      const metrics = createNarrativeMetrics();
      metrics.coherenceScore = 0.8;

      const trace = createMockCompletedTrace({ metrics });
      const output = formatter.exportAsMarkdown(trace);

      expect(output).toContain("## Quality Metrics");
      expect(output).toContain("| Metric | Value |");
      expect(output).toContain("| Coherence | 0.80 |");
    });

    it("should include correlation path", () => {
      const correlation = createTraceCorrelation(
        "trace_123",
        "story_456",
        "session_789"
      );
      correlation.correlationPath = ["langchain", "flowise", "langflow"];

      const trace = createMockCompletedTrace({ correlation });
      const output = formatter.exportAsMarkdown(trace);

      expect(output).toContain("## System Correlation");
      expect(output).toContain("Path: langchain → flowise → langflow");
    });
  });

  describe("extractStoryMetrics", () => {
    it("should extract metrics from trace spans", () => {
      const trace = createMockCompletedTrace({
        durationMs: 10000,
        spans: [
          createMockSpan({ eventType: NarrativeEventType.BEAT_CREATED }),
          createMockSpan({ eventType: NarrativeEventType.BEAT_CREATED }),
          createMockSpan({ eventType: NarrativeEventType.BEAT_ENRICHED }),
          createMockSpan({ eventType: NarrativeEventType.GAP_REMEDIATED }),
          createMockSpan({ eventType: NarrativeEventType.ROUTING_DECISION }),
          createMockSpan({ eventType: NarrativeEventType.ROUTING_DECISION }),
        ],
      });

      const metrics = formatter.extractStoryMetrics(trace);

      expect(metrics.beatsGenerated).toBe(2);
      expect(metrics.enrichmentsApplied).toBe(1);
      expect(metrics.gapsRemediated).toBe(1);
      expect(metrics.routingDecisions).toBe(2);
      expect(metrics.totalGenerationTimeMs).toBe(10000);
      expect(metrics.averageBeatTimeMs).toBe(5000);
    });

    it("should return existing metrics if present", () => {
      const existingMetrics = createNarrativeMetrics();
      existingMetrics.coherenceScore = 0.99;

      const trace = createMockCompletedTrace({ metrics: existingMetrics });
      const metrics = formatter.extractStoryMetrics(trace);

      expect(metrics).toBe(existingMetrics);
      expect(metrics.coherenceScore).toBe(0.99);
    });
  });

  describe("generateImprovementSuggestions", () => {
    it("should suggest coherence improvements when low", () => {
      const metrics = createNarrativeMetrics();
      metrics.coherenceScore = 0.4;

      const suggestions = formatter.generateImprovementSuggestions(metrics);

      expect(suggestions.some((s) => s.includes("coherence"))).toBe(true);
    });

    it("should suggest emotional arc improvements when weak", () => {
      const metrics = createNarrativeMetrics();
      metrics.emotionalArcStrength = 0.3;

      const suggestions = formatter.generateImprovementSuggestions(metrics);

      expect(suggestions.some((s) => s.includes("Emotional arc"))).toBe(true);
    });

    it("should suggest three-universe improvements when misaligned", () => {
      const metrics = createNarrativeMetrics();
      metrics.crossUniverseCoherence = 0.3;

      const suggestions = formatter.generateImprovementSuggestions(metrics);

      expect(suggestions.some((s) => s.includes("Three-universe"))).toBe(true);
    });

    it("should suggest enrichment when few beats enriched", () => {
      const metrics = createNarrativeMetrics();
      metrics.beatsGenerated = 10;
      metrics.enrichmentsApplied = 1;

      const suggestions = formatter.generateImprovementSuggestions(metrics);

      expect(suggestions.some((s) => s.includes("enriched"))).toBe(true);
    });

    it("should identify incomplete character arcs", () => {
      const metrics = createNarrativeMetrics();
      metrics.characterArcCompletion = {
        char_1: 0.3,
        char_2: 0.9,
      };

      const suggestions = formatter.generateImprovementSuggestions(metrics);

      expect(suggestions.some((s) => s.includes("char_1"))).toBe(true);
      expect(suggestions.some((s) => s.includes("char_2"))).toBe(false);
    });

    it("should suggest performance improvements when slow", () => {
      const metrics = createNarrativeMetrics();
      metrics.averageBeatTimeMs = 10000;

      const suggestions = formatter.generateImprovementSuggestions(metrics);

      expect(suggestions.some((s) => s.includes("slow"))).toBe(true);
    });

    it("should return positive message when all metrics healthy", () => {
      const metrics = createNarrativeMetrics();
      metrics.coherenceScore = 0.9;
      metrics.emotionalArcStrength = 0.8;
      metrics.themeClarity = 0.85;
      metrics.crossUniverseCoherence = 0.9;
      metrics.beatsGenerated = 10;
      metrics.enrichmentsApplied = 5;
      metrics.averageBeatTimeMs = 2000;

      const suggestions = formatter.generateImprovementSuggestions(metrics);

      expect(suggestions.some((s) => s.includes("✅"))).toBe(true);
    });
  });
});
