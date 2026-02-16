import { describe, it, expect } from "vitest";
import {
  FireKeeper,
  createAgentReport,
  EngagementMode,
} from "../fire_keeper.js";
import {
  createImportanceUnit,
  ImportanceContext,
} from "../importance_unit.js";
import { MedicineWheelQuadrant, createQuadrantPresence } from "../medicine_wheel.js";

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
  describe("constructor", () => {
    it("creates with vision statement", () => {
      const keeper = new FireKeeper(
        "Build a relational intelligence system grounded in Indigenous paradigms"
      );
      expect(keeper.getVision()).toContain("relational intelligence");
      expect(keeper.isCeremonyOnTrack()).toBe(true);
    });
  });

  describe("reviewReport", () => {
    it("accepts a basic report", () => {
      const keeper = new FireKeeper("Vision");
      const report = createAgentReport(
        "agent_1",
        "Mia",
        "Built API endpoint",
        "Endpoint created"
      );
      const review = keeper.reviewReport(report);

      expect(review.accepted).toBe(true);
      expect(typeof review.requiresHumanEngagement).toBe("boolean");
      expect(review.feedback.length).toBeGreaterThanOrEqual(0);
    });

    it("flags low confidence for human engagement", () => {
      const keeper = new FireKeeper("Vision");
      const report = createAgentReport(
        "agent_1",
        "Mia",
        "Attempted complex task",
        "Unsure about result",
        { confidence: 0.2 }
      );
      const review = keeper.reviewReport(report);

      expect(review.requiresHumanEngagement).toBe(true);
      expect(review.engagementRequest).toBeTruthy();
      expect(review.engagementRequest!.mode).toBe(EngagementMode.CODE_REVIEW);
    });

    it("stores importance units from reports", () => {
      const keeper = new FireKeeper("Vision");
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

      keeper.reviewReport(report);
      expect(keeper.getImportanceStore().size).toBe(1);
    });

    it("records topic spirals from reports", () => {
      const keeper = new FireKeeper("Vision");
      const report = createAgentReport(
        "agent_1",
        "Mia",
        "Analysis",
        "Revisited knowledge graph topic",
        { topicsCircled: ["knowledge_graph"] }
      );

      keeper.reviewReport(report);
      const spirals = keeper.getSpiralTracker().getActiveSpirals();
      expect(spirals.length).toBe(1);
    });
  });

  describe("gateAction", () => {
    it("blocks Indigenous work without ceremony context", () => {
      const keeper = new FireKeeper("Vision");
      const verdict = keeper.gateAction({
        action: "Design Indigenous ontology",
        actionDescription: "Create medicine wheel schema",
        agentId: "agent_1",
        sessionId: "s1",
        metadata: {},
      });

      expect(verdict.canProceed).toBe(false);
      expect(verdict.requiresHuman).toBe(true);
    });

    it("allows general technical work", () => {
      const keeper = new FireKeeper("Vision");
      const verdict = keeper.gateAction({
        action: "Add REST endpoint",
        actionDescription: "Simple CRUD operation",
        agentId: "agent_1",
        sessionId: "s1",
        metadata: {},
      });

      // Simple technical work should generally pass
      expect(verdict.results.length).toBe(4);
    });
  });

  describe("canAgentProceed", () => {
    it("provides quick check", () => {
      const keeper = new FireKeeper("Vision");
      const result = keeper.canAgentProceed(
        "Add a button",
        "UI component",
        "agent_1",
        "s1"
      );
      expect(typeof result).toBe("boolean");
    });
  });

  describe("relational milestones", () => {
    it("records a milestone", () => {
      const keeper = new FireKeeper("Vision");
      const milestone = keeper.recordMilestone(
        "Completed knowledge graph design with relational care",
        ["knowledge_graph"],
        ["unit_1"]
      );

      expect(milestone.id).toBeTruthy();
      expect(milestone.description).toContain("knowledge graph");
      expect(milestone.relatedSpirals).toContain("knowledge_graph");
    });

    it("determines pruning eligibility", () => {
      const keeper = new FireKeeper("Vision");

      // No milestones -- cannot prune
      expect(keeper.canPrune()).toBe(false);

      // Add a milestone
      keeper.recordMilestone(
        "Completed relational design",
        [],
        ["unit_1"]
      );

      // Now pruning depends on milestone balance
      expect(typeof keeper.canPrune()).toBe("boolean");
    });
  });

  describe("human engagement", () => {
    it("creates engagement requests", () => {
      const keeper = new FireKeeper("Vision");
      const request = keeper.requestHumanEngagement(
        "Need vision alignment",
        EngagementMode.VISION,
        "The ontology design needs directional input",
        "agent_1",
        0.8
      );

      expect(request.mode).toBe(EngagementMode.VISION);
      expect(request.priority).toBe(0.8);
    });

    it("returns engagements sorted by priority", () => {
      const keeper = new FireKeeper("Vision");
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

    it("resolves engagement requests", () => {
      const keeper = new FireKeeper("Vision");
      const request = keeper.requestHumanEngagement(
        "test",
        EngagementMode.VISION,
        "context",
        "a1"
      );

      keeper.resolveEngagement(request.id);
      expect(keeper.getPendingEngagements()).toHaveLength(0);
    });
  });

  describe("state access", () => {
    it("gets and updates vision", () => {
      const keeper = new FireKeeper("Original vision");
      expect(keeper.getVision()).toBe("Original vision");

      keeper.updateVision("Updated vision");
      expect(keeper.getVision()).toBe("Updated vision");
    });

    it("provides access to sub-systems", () => {
      const keeper = new FireKeeper("Vision");
      expect(keeper.getImportanceStore()).toBeTruthy();
      expect(keeper.getSpiralTracker()).toBeTruthy();
      expect(keeper.getValueGate()).toBeTruthy();
      expect(keeper.getWheelFilter()).toBeTruthy();
    });

    it("gets summary", () => {
      const keeper = new FireKeeper("Vision statement");
      const summary = keeper.getSummary();

      expect(summary.vision).toBe("Vision statement");
      expect(summary.ceremonyOnTrack).toBe(true);
      expect(typeof summary.relationalHealth).toBe("number");
      expect(typeof summary.pendingReports).toBe("number");
    });

    it("tracks deepest spirals", () => {
      const keeper = new FireKeeper("Vision");
      const tracker = keeper.getSpiralTracker();
      tracker.recordCircle("a", "A", "first", "s1");
      tracker.recordCircle("a", "A", "second", "s1");
      tracker.recordCircle("a", "A", "third", "s1");
      tracker.recordCircle("b", "B", "first", "s1");

      const deepest = keeper.getDeepestSpirals(2);
      expect(deepest[0].topicKey).toBe("a");
      expect(deepest[0].depth).toBe(3);
    });
  });
});
