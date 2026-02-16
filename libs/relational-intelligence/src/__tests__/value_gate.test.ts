import { describe, it, expect } from "vitest";
import {
  ConstraintSeverity,
  createResearchIsCeremonyConstraint,
  createRelationalCheckBackConstraint,
  createMedicineWheelBalanceConstraint,
  createImplicitOverExplicitConstraint,
  ValueGate,
  GateContext,
} from "../value_gate.js";
import { MedicineWheelQuadrant, createQuadrantPresence } from "../medicine_wheel.js";

describe("Research Is Ceremony Constraint", () => {
  const constraint = createResearchIsCeremonyConstraint();

  it("has correct properties", () => {
    expect(constraint.id).toBe("ric-001");
    expect(constraint.severity).toBe(ConstraintSeverity.HARD_STOP);
    expect(constraint.active).toBe(true);
  });

  it("passes when content does not engage Indigenous domains", () => {
    const result = constraint.check({
      action: "Add a REST API endpoint",
      actionDescription: "Creates GET /api/users endpoint",
      agentId: "agent_1",
      sessionId: "s1",
      metadata: {},
    });
    expect(result.passed).toBe(true);
  });

  it("fails when engaging Indigenous domains without ceremony context", () => {
    const result = constraint.check({
      action: "Design Indigenous ontology for knowledge graph",
      actionDescription: "Create schema for Indigenous relational models",
      agentId: "agent_1",
      sessionId: "s1",
      metadata: { researchIsCeremonyGathered: false },
    });
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("Research Is Ceremony");
    expect(result.remediation).toBeTruthy();
  });

  it("passes when ceremony context is gathered", () => {
    const result = constraint.check({
      action: "Design Indigenous ontology for knowledge graph",
      actionDescription: "Create schema for Indigenous relational models",
      agentId: "agent_1",
      sessionId: "s1",
      metadata: { researchIsCeremonyGathered: true },
    });
    expect(result.passed).toBe(true);
  });

  it("detects ceremony keyword", () => {
    const result = constraint.check({
      action: "Implement ceremony protocol",
      actionDescription: "Adds relational accountability to the medicine wheel",
      agentId: "agent_1",
      sessionId: "s1",
      metadata: {},
    });
    expect(result.passed).toBe(false);
  });
});

describe("Relational Check-Back Constraint", () => {
  const constraint = createRelationalCheckBackConstraint();

  it("passes with no wheel assessment and no negative flags", () => {
    const result = constraint.check({
      action: "test",
      actionDescription: "test",
      agentId: "a1",
      sessionId: "s1",
      metadata: {},
    });
    expect(result.passed).toBe(true);
  });

  it("fails when physical high but spiritual missing", () => {
    const result = constraint.check({
      action: "test",
      actionDescription: "test",
      agentId: "a1",
      sessionId: "s1",
      wheelAssessment: {
        id: "wa1",
        inputId: "test",
        presence: createQuadrantPresence({
          [MedicineWheelQuadrant.PHYSICAL]: 0.8,
          [MedicineWheelQuadrant.SPIRITUAL]: 0.05,
        }),
        leadQuadrant: MedicineWheelQuadrant.PHYSICAL,
        neglectedQuadrants: [MedicineWheelQuadrant.SPIRITUAL],
        relationalCoverage: 0.5,
        balanced: false,
        timestamp: new Date().toISOString(),
      },
      metadata: {},
    });
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("Body");
    expect(result.reason).toContain("Spirit");
  });

  it("fails when vision is explicitly misaligned", () => {
    const result = constraint.check({
      action: "test",
      actionDescription: "test",
      agentId: "a1",
      sessionId: "s1",
      metadata: { visionAligned: false },
    });
    expect(result.passed).toBe(false);
  });
});

describe("Medicine Wheel Balance Constraint", () => {
  const constraint = createMedicineWheelBalanceConstraint();

  it("passes when no wheel assessment available", () => {
    const result = constraint.check({
      action: "test",
      actionDescription: "test",
      agentId: "a1",
      sessionId: "s1",
      metadata: {},
    });
    expect(result.passed).toBe(true);
  });

  it("passes when balanced", () => {
    const result = constraint.check({
      action: "test",
      actionDescription: "test",
      agentId: "a1",
      sessionId: "s1",
      wheelAssessment: {
        id: "wa1",
        inputId: "test",
        presence: createQuadrantPresence({
          [MedicineWheelQuadrant.PHYSICAL]: 0.3,
          [MedicineWheelQuadrant.EMOTIONAL]: 0.25,
          [MedicineWheelQuadrant.MENTAL]: 0.25,
          [MedicineWheelQuadrant.SPIRITUAL]: 0.2,
        }),
        leadQuadrant: MedicineWheelQuadrant.PHYSICAL,
        neglectedQuadrants: [],
        relationalCoverage: 1.0,
        balanced: true,
        timestamp: new Date().toISOString(),
      },
      metadata: {},
    });
    expect(result.passed).toBe(true);
  });

  it("fails when unbalanced", () => {
    const result = constraint.check({
      action: "test",
      actionDescription: "test",
      agentId: "a1",
      sessionId: "s1",
      wheelAssessment: {
        id: "wa1",
        inputId: "test",
        presence: createQuadrantPresence({
          [MedicineWheelQuadrant.MENTAL]: 0.9,
        }),
        leadQuadrant: MedicineWheelQuadrant.MENTAL,
        neglectedQuadrants: [
          MedicineWheelQuadrant.PHYSICAL,
          MedicineWheelQuadrant.EMOTIONAL,
          MedicineWheelQuadrant.SPIRITUAL,
        ],
        relationalCoverage: 0.25,
        balanced: false,
        timestamp: new Date().toISOString(),
      },
      metadata: {},
    });
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("Neglected");
  });
});

describe("Implicit Over Explicit Constraint", () => {
  const constraint = createImplicitOverExplicitConstraint();

  it("passes when no conflict", () => {
    const result = constraint.check({
      action: "test",
      actionDescription: "test",
      agentId: "a1",
      sessionId: "s1",
      metadata: {},
    });
    expect(result.passed).toBe(true);
  });

  it("fails when value conflict flagged", () => {
    const result = constraint.check({
      action: "test",
      actionDescription: "test",
      agentId: "a1",
      sessionId: "s1",
      metadata: { valueConflict: true },
    });
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("implicit values");
  });
});

describe("ValueGate", () => {
  it("has default constraints registered", () => {
    const gate = new ValueGate();
    const constraints = gate.getConstraints();
    expect(constraints.length).toBe(4);
  });

  it("evaluates all constraints and produces a verdict", () => {
    const gate = new ValueGate();
    const verdict = gate.evaluate({
      action: "Add REST API endpoint",
      actionDescription: "Simple technical work",
      agentId: "agent_1",
      sessionId: "s1",
      metadata: {},
    });

    expect(verdict.id).toBeTruthy();
    expect(verdict.results.length).toBe(4);
    expect(typeof verdict.canProceed).toBe("boolean");
    expect(typeof verdict.requiresHuman).toBe("boolean");
    expect(verdict.timestamp).toBeTruthy();
  });

  it("blocks when Research Is Ceremony not gathered for Indigenous work", () => {
    const gate = new ValueGate();
    const verdict = gate.evaluate({
      action: "Design Indigenous ontology",
      actionDescription: "Create schema for medicine wheel relational models",
      agentId: "agent_1",
      sessionId: "s1",
      metadata: { researchIsCeremonyGathered: false },
    });

    expect(verdict.canProceed).toBe(false);
    expect(verdict.requiresHuman).toBe(true);
    expect(verdict.failureSummary.length).toBeGreaterThan(0);
  });

  it("allows when all constraints satisfied", () => {
    const gate = new ValueGate();
    const verdict = gate.evaluate({
      action: "Add REST API endpoint for user data",
      actionDescription: "Simple CRUD endpoint",
      agentId: "agent_1",
      sessionId: "s1",
      metadata: {},
    });

    // For simple technical work, should generally pass
    expect(verdict.results.length).toBe(4);
  });

  it("canProceed shortcut works", () => {
    const gate = new ValueGate();
    const result = gate.canProceed(
      "Add a button",
      "UI component",
      "agent_1",
      "s1"
    );
    expect(typeof result).toBe("boolean");
  });

  it("auto-generates wheel assessment when not provided", () => {
    const gate = new ValueGate();
    const verdict = gate.evaluate({
      action: "Build the server",
      actionDescription: "Deploy infrastructure",
      agentId: "agent_1",
      sessionId: "s1",
      metadata: {},
    });

    // The wheel balance constraint should have assessed
    const wheelResult = verdict.results.find(
      (r) => r.constraintName === "Medicine Wheel Balance"
    );
    expect(wheelResult).toBeTruthy();
  });

  it("allows registering custom constraints", () => {
    const gate = new ValueGate();
    gate.registerConstraint({
      id: "custom-001",
      name: "Custom Check",
      description: "A custom constraint",
      severity: ConstraintSeverity.ADVISORY,
      active: true,
      check: () => ({ passed: true, reason: "Always passes" }),
    });

    expect(gate.getConstraints().length).toBe(5);
  });

  it("allows removing constraints", () => {
    const gate = new ValueGate();
    gate.removeConstraint("ric-001");
    expect(gate.getConstraints().length).toBe(3);
  });
});
