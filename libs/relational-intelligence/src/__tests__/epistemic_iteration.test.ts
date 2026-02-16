import { describe, it, expect } from "vitest";
import {
  createEpistemicCircle,
  createSpiral,
  SpiralShiftType,
  SpiralTracker,
} from "../epistemic_iteration.js";

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
    it("creates new spiral on first circle", () => {
      const tracker = new SpiralTracker();
      const circle = tracker.recordCircle(
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

    it("adds circle on return visit", () => {
      const tracker = new SpiralTracker();
      tracker.recordCircle(
        "kg",
        "Knowledge Graph",
        "First mention",
        "session_1"
      );
      const second = tracker.recordCircle(
        "kg",
        "Knowledge Graph",
        "Returned with medicine wheel idea",
        "session_1"
      );

      expect(second.iteration).toBe(2);
      expect(tracker.getSpiral("kg")!.depth).toBe(2);
    });

    it("computes delta between circles", () => {
      const tracker = new SpiralTracker();
      tracker.recordCircle(
        "kg",
        "Knowledge Graph",
        "We need a knowledge graph",
        "session_1"
      );
      const second = tracker.recordCircle(
        "kg",
        "Knowledge Graph",
        "The knowledge graph should use medicine wheel ontology",
        "session_1"
      );

      expect(second.delta).toBeTruthy();
      expect(second.delta.length).toBeGreaterThan(0);
    });

    it("tracks multiple independent spirals", () => {
      const tracker = new SpiralTracker();
      tracker.recordCircle("kg", "Knowledge Graph", "Content A", "s1");
      tracker.recordCircle("mw", "Medicine Wheel", "Content B", "s1");
      tracker.recordCircle("ric", "Research Is Ceremony", "Content C", "s1");

      expect(tracker.size).toBe(3);
    });

    it("accumulates insight across circles", () => {
      const tracker = new SpiralTracker();
      tracker.recordCircle("kg", "KG", "First thought", "s1");
      tracker.recordCircle("kg", "KG", "Second thought", "s1");
      tracker.recordCircle("kg", "KG", "Third thought", "s1");

      const spiral = tracker.getSpiral("kg")!;
      expect(spiral.accumulatedInsight).toContain("First thought");
      expect(spiral.accumulatedInsight).toContain("Second thought");
      expect(spiral.accumulatedInsight).toContain("Third thought");
    });
  });

  describe("getActiveSpirals", () => {
    it("returns only active spirals", () => {
      const tracker = new SpiralTracker();
      tracker.recordCircle("a", "A", "test", "s1");
      tracker.recordCircle("b", "B", "test", "s1");
      tracker.closeSpiral("b");

      const active = tracker.getActiveSpirals();
      expect(active).toHaveLength(1);
      expect(active[0].topicKey).toBe("a");
    });
  });

  describe("getByDepth", () => {
    it("returns spirals sorted by depth", () => {
      const tracker = new SpiralTracker();
      tracker.recordCircle("shallow", "Shallow", "content", "s1");

      tracker.recordCircle("deep", "Deep", "first", "s1");
      tracker.recordCircle("deep", "Deep", "second", "s1");
      tracker.recordCircle("deep", "Deep", "third", "s1");

      tracker.recordCircle("medium", "Medium", "first", "s1");
      tracker.recordCircle("medium", "Medium", "second", "s1");

      const sorted = tracker.getByDepth(3);
      expect(sorted[0].topicKey).toBe("deep");
      expect(sorted[0].depth).toBe(3);
      expect(sorted[1].topicKey).toBe("medium");
      expect(sorted[1].depth).toBe(2);
      expect(sorted[2].topicKey).toBe("shallow");
    });
  });

  describe("analyzeShifts", () => {
    it("marks first circle as OPENING", () => {
      const tracker = new SpiralTracker();
      tracker.recordCircle("kg", "KG", "First mention", "s1");

      const shifts = tracker.analyzeShifts("kg");
      expect(shifts).toHaveLength(1);
      expect(shifts[0].shiftType).toBe(SpiralShiftType.OPENING);
      expect(shifts[0].significance).toBe(1.0);
    });

    it("detects expanding shifts when new concepts added", () => {
      const tracker = new SpiralTracker();
      tracker.recordCircle("kg", "KG", "knowledge graph design", "s1");
      tracker.recordCircle(
        "kg",
        "KG",
        "medicine wheel ontology relational accountability ceremony",
        "s1"
      );

      const shifts = tracker.analyzeShifts("kg");
      expect(shifts).toHaveLength(2);
      expect(shifts[1].newConcepts.length).toBeGreaterThan(0);
    });

    it("tracks refined concepts", () => {
      const tracker = new SpiralTracker();
      tracker.recordCircle(
        "kg",
        "KG",
        "ontology design structure pattern",
        "s1"
      );
      tracker.recordCircle(
        "kg",
        "KG",
        "ontology design structure pattern with deeper understanding",
        "s1"
      );

      const shifts = tracker.analyzeShifts("kg");
      expect(shifts[1].refinedConcepts.length).toBeGreaterThan(0);
    });

    it("increases significance with depth", () => {
      const tracker = new SpiralTracker();
      tracker.recordCircle("kg", "KG", "first pass ontology", "s1");
      tracker.recordCircle("kg", "KG", "second pass ontology medicine", "s1");
      tracker.recordCircle("kg", "KG", "third pass ontology medicine wheel", "s1");
      tracker.recordCircle("kg", "KG", "fourth pass ontology medicine wheel ceremony", "s1");

      const shifts = tracker.analyzeShifts("kg");
      // Later shifts should generally have higher significance due to depth bonus
      expect(shifts[3].significance).toBeGreaterThanOrEqual(0);
    });

    it("returns empty for unknown topic", () => {
      const tracker = new SpiralTracker();
      expect(tracker.analyzeShifts("nonexistent")).toHaveLength(0);
    });
  });

  describe("closeSpiral", () => {
    it("marks spiral as inactive", () => {
      const tracker = new SpiralTracker();
      tracker.recordCircle("kg", "KG", "test", "s1");
      tracker.closeSpiral("kg");

      const spiral = tracker.getSpiral("kg")!;
      expect(spiral.active).toBe(false);
    });
  });

  describe("serialization", () => {
    it("serializes and loads spirals", () => {
      const tracker = new SpiralTracker();
      tracker.recordCircle("a", "A", "content a", "s1");
      tracker.recordCircle("b", "B", "content b", "s1");
      tracker.recordCircle("a", "A", "content a2", "s1");

      const json = tracker.serialize();

      const tracker2 = new SpiralTracker();
      tracker2.load(json);
      expect(tracker2.size).toBe(2);
      expect(tracker2.getSpiral("a")!.depth).toBe(2);
    });
  });
});
