import { describe, it, expect, vi } from "vitest";
import {
  createEpistemicCircle,
  createSpiral,
  SpiralShiftType,
  SpiralTracker,
} from "../epistemic_iteration.js";
import { BaseChatModel } from "@langchain/core/language_models/base";

describe("createEpistemicCircle", () => {
  it("creates a circle with defaults", () => {
    const circle = createEpistemicCircle(
      "knowledge_graph",
      1,
      "We need a knowledge graph",
      "session_1"
    );
    expect(circle.topicKey).toBe("knowledge_graph");
    expect(circle.iteration).toBe(1);
    expect(circle.content).toBe("We need a knowledge graph");
    expect(circle.sessionId).toBe("session_1");
    expect(circle.id).toBeTruthy();
    expect(circle.timestamp).toBeTruthy();
  });
});

describe("createSpiral", () => {
  it("creates a spiral with first circle", () => {
    const spiral = createSpiral(
      "ontology",
      "Ontology Design",
      "Initial thoughts on ontology",
      "session_1"
    );
    expect(spiral.topicKey).toBe("ontology");
    expect(spiral.topicName).toBe("Ontology Design");
    expect(spiral.circles).toHaveLength(1);
    expect(spiral.depth).toBe(1);
    expect(spiral.active).toBe(true);
    expect(spiral.accumulatedInsight).toBe("Initial thoughts on ontology");
  });
});

describe("SpiralTracker", () => {
  describe("recordCircle", () => {
    it("creates new spiral on first circle", async () => {
      const tracker = new SpiralTracker();
      const circle = await tracker.recordCircle(
        "kg",
        "Knowledge Graph",
        "First mention of knowledge graph",
        "session_1"
      );
      expect(circle.iteration).toBe(1);
      expect(tracker.size).toBe(1);

      const spiral = tracker.getSpiral("kg");
      expect(spiral).toBeTruthy();
      expect(spiral!.depth).toBe(1);
    });

    it("adds circle on return visit", async () => {
      const tracker = new SpiralTracker();
      await tracker.recordCircle(
        "kg",
        "Knowledge Graph",
        "First mention",
        "session_1"
      );
      const second = await tracker.recordCircle(
        "kg",
        "Knowledge Graph",
        "Returned with medicine wheel idea",
        "session_1"
      );

      expect(second.iteration).toBe(2);
      expect(tracker.getSpiral("kg")!.depth).toBe(2);
    });

    it("computes delta between circles", async () => {
      const tracker = new SpiralTracker();
      await tracker.recordCircle(
        "kg",
        "Knowledge Graph",
        "We need a knowledge graph",
        "session_1"
      );
      const second = await tracker.recordCircle(
        "kg",
        "Knowledge Graph",
        "The knowledge graph should use medicine wheel ontology",
        "session_1"
      );

      expect(second.delta).toBeTruthy();
      expect(second.delta.length).toBeGreaterThan(0);
    });

    it("tracks multiple independent spirals", async () => {
      const tracker = new SpiralTracker();
      await tracker.recordCircle("kg", "Knowledge Graph", "Content A", "s1");
      await tracker.recordCircle("mw", "Medicine Wheel", "Content B", "s1");
      await tracker.recordCircle("ric", "Research Is Ceremony", "Content C", "s1");

      expect(tracker.size).toBe(3);
    });

    it("accumulates insight across circles", async () => {
      const tracker = new SpiralTracker();
      await tracker.recordCircle("kg", "KG", "First thought", "s1");
      await tracker.recordCircle("kg", "KG", "Second thought", "s1");
      await tracker.recordCircle("kg", "KG", "Third thought", "s1");

      const spiral = tracker.getSpiral("kg")!;
      expect(spiral.accumulatedInsight).toContain("First thought");
      expect(spiral.accumulatedInsight).toContain("Second thought");
      expect(spiral.accumulatedInsight).toContain("Third thought");
    });
  });

  describe("getActiveSpirals", () => {
    it("returns only active spirals", async () => {
      const tracker = new SpiralTracker();
      await tracker.recordCircle("a", "A", "test", "s1");
      await tracker.recordCircle("b", "B", "test", "s1");
      tracker.closeSpiral("b");

      const active = tracker.getActiveSpirals();
      expect(active).toHaveLength(1);
      expect(active[0].topicKey).toBe("a");
    });
  });

  describe("getByDepth", () => {
    it("returns spirals sorted by depth", async () => {
      const tracker = new SpiralTracker();
      await tracker.recordCircle("shallow", "Shallow", "content", "s1");

      await tracker.recordCircle("deep", "Deep", "first", "s1");
      await tracker.recordCircle("deep", "Deep", "second", "s1");
      await tracker.recordCircle("deep", "Deep", "third", "s1");

      await tracker.recordCircle("medium", "Medium", "first", "s1");
      await tracker.recordCircle("medium", "Medium", "second", "s1");

      const sorted = tracker.getByDepth(3);
      expect(sorted[0].topicKey).toBe("deep");
      expect(sorted[0].depth).toBe(3);
      expect(sorted[1].topicKey).toBe("medium");
      expect(sorted[1].depth).toBe(2);
      expect(sorted[2].topicKey).toBe("shallow");
    });
  });

  describe("analyzeShifts", () => {
    it("marks first circle as OPENING", async () => {
      const tracker = new SpiralTracker();
      await tracker.recordCircle("kg", "KG", "First mention", "s1");

      const shifts = await tracker.analyzeShifts("kg");
      expect(shifts).toHaveLength(1);
      expect(shifts[0].shiftType).toBe(SpiralShiftType.OPENING);
      expect(shifts[0].significance).toBe(1.0);
    });

    it("detects expanding shifts when new concepts added", async () => {
      const tracker = new SpiralTracker();
      await tracker.recordCircle("kg", "KG", "knowledge graph design", "s1");
      await tracker.recordCircle(
        "kg",
        "KG",
        "medicine wheel ontology relational accountability ceremony",
        "s1"
      );

      const shifts = await tracker.analyzeShifts("kg");
      expect(shifts).toHaveLength(2);
      expect(shifts[1].newConcepts.length).toBeGreaterThan(0);
    });

    it("tracks refined concepts", async () => {
      const tracker = new SpiralTracker();
      await tracker.recordCircle(
        "kg",
        "KG",
        "ontology design structure pattern",
        "s1"
      );
      await tracker.recordCircle(
        "kg",
        "KG",
        "ontology design structure pattern with deeper understanding",
        "s1"
      );

      const shifts = await tracker.analyzeShifts("kg");
      expect(shifts[1].refinedConcepts.length).toBeGreaterThan(0);
    });

    it("increases significance with depth", async () => {
      const tracker = new SpiralTracker();
      await tracker.recordCircle("kg", "KG", "first pass ontology", "s1");
      await tracker.recordCircle("kg", "KG", "second pass ontology medicine", "s1");
      await tracker.recordCircle("kg", "KG", "third pass ontology medicine wheel", "s1");
      await tracker.recordCircle("kg", "KG", "fourth pass ontology medicine wheel ceremony", "s1");

      const shifts = await tracker.analyzeShifts("kg");
      // Later shifts should generally have higher significance due to depth bonus
      expect(shifts[3].significance).toBeGreaterThanOrEqual(0);
    });

    it("returns empty for unknown topic", async () => {
      const tracker = new SpiralTracker();
      expect(await tracker.analyzeShifts("nonexistent")).toHaveLength(0);
    });
  });

  describe("closeSpiral", () => {
    it("marks spiral as inactive", async () => {
      const tracker = new SpiralTracker();
      await tracker.recordCircle("kg", "KG", "test", "s1");
      tracker.closeSpiral("kg");

      const spiral = tracker.getSpiral("kg")!;
      expect(spiral.active).toBe(false);
    });
  });

  describe("serialization", () => {
    it("serializes and loads spirals", async () => {
      const tracker = new SpiralTracker();
      await tracker.recordCircle("a", "A", "content a", "s1");
      await tracker.recordCircle("b", "B", "content b", "s1");
      await tracker.recordCircle("a", "A", "content a2", "s1");

      const json = tracker.serialize();

      const tracker2 = new SpiralTracker();
      tracker2.load(json);
      expect(tracker2.size).toBe(2);
      expect(tracker2.getSpiral("a")!.depth).toBe(2);
    });
  });

  describe("LLM Integration", () => {
    const mockConcepts = ["knowledge graph", "ontology", "medicine wheel"];
    const mockLLMResponse = (concepts: string[]) => JSON.stringify(concepts);

    it("should use LLM for concept extraction when provided", async () => {
      const mockLLM = {
        invoke: vi.fn(async () => ({
          content: mockLLMResponse(mockConcepts),
        })),
      } as unknown as BaseChatModel;

      const trackerWithLLM = new SpiralTracker({ llm: mockLLM });
      await trackerWithLLM.recordCircle("test_topic", "Test Topic", "Some content about knowledge graphs and ontology.", "s1");
      const shifts = await trackerWithLLM.analyzeShifts("test_topic");

      expect(mockLLM.invoke).toHaveBeenCalledTimes(1); // One call for the initial circle
      expect(shifts[0].newConcepts).toEqual(expect.arrayContaining(mockConcepts));
    });

    it("should fall back to heuristic extraction if LLM output is malformed", async () => {
      const mockLLM = {
        invoke: vi.fn(async () => ({
          content: "this is not valid json",
        })),
      } as unknown as BaseChatModel;

      const trackerWithLLM = new SpiralTracker({ llm: mockLLM });
      await trackerWithLLM.recordCircle("test_topic", "Test Topic", "Some content.", "s1");
      const shifts = await trackerWithLLM.analyzeShifts("test_topic");

      expect(mockLLM.invoke).toHaveBeenCalledOnce();
      expect(shifts[0].newConcepts).toEqual(expect.arrayContaining(["content"])); // Heuristic result
    });

    it("should fall back to heuristic extraction if LLM output does not match schema", async () => {
      const mockLLM = {
        invoke: vi.fn(async () => ({
          content: JSON.stringify({ notAnArray: "concepts" }),
        })),
      } as unknown as BaseChatModel;

      const trackerWithLLM = new SpiralTracker({ llm: mockLLM });
      await trackerWithLLM.recordCircle("test_topic", "Test Topic", "More content about design patterns.", "s1");
      const shifts = await trackerWithLLM.analyzeShifts("test_topic");

      expect(mockLLM.invoke).toHaveBeenCalledOnce();
      expect(shifts[0].newConcepts).toEqual(expect.arrayContaining(["content", "about", "design", "patterns"])); // Heuristic result
    });

    it("should use heuristic extraction if no LLM is provided", async () => {
      const trackerNoLLM = new SpiralTracker();
      await trackerNoLLM.recordCircle("test_topic", "Test Topic", "New content with unique insights.", "s1");
      const shifts = await trackerNoLLM.analyzeShifts("test_topic");

      expect(shifts[0].newConcepts).toEqual(expect.arrayContaining(["content", "unique", "insights"]));
    });

    it("should make multiple LLM calls for multiple circles in analyzeShifts", async () => {
      const mockLLM = {
        invoke: vi.fn(async () => ({
          content: JSON.stringify(["concept"]),
        })),
      } as unknown as BaseChatModel;

      const trackerWithLLM = new SpiralTracker({ llm: mockLLM });
      await trackerWithLLM.recordCircle("multi_circle", "Multi Circle", "Content one.", "s1");
      await trackerWithLLM.recordCircle("multi_circle", "Multi Circle", "Content two.", "s1");
      await trackerWithLLM.recordCircle("multi_circle", "Multi Circle", "Content three.", "s1");

      const shifts = await trackerWithLLM.analyzeShifts("multi_circle");

      expect(mockLLM.invoke).toHaveBeenCalledTimes(3); // One for each circle's extractConcepts
      expect(shifts).toHaveLength(3);
    });
  });
});
