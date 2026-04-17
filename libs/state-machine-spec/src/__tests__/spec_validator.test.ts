import { describe, it, expect } from "vitest";
import {
  validateSpec,
  ValidationSeverity,
  computeReachability,
  findDeadlockedStates,
  canAllStatesTerminate,
} from "../spec_validator.js";
import {
  createPRReviewSpec,
  createMinimalSpec,
  createBrokenSpec,
} from "./fixtures.js";

describe("validateSpec", () => {
  describe("valid specs", () => {
    it("validates a well-formed PR review spec", () => {
      const result = validateSpec(createPRReviewSpec());
      expect(result.valid).toBe(true);
      const errors = result.issues.filter(
        (i) => i.severity === ValidationSeverity.ERROR
      );
      expect(errors).toEqual([]);
    });

    it("validates a minimal spec", () => {
      const result = validateSpec(createMinimalSpec());
      expect(result.valid).toBe(true);
    });

    it("reports correct structural properties", () => {
      const result = validateSpec(createPRReviewSpec());
      expect(result.properties.stateCount).toBe(6);
      expect(result.properties.transitionCount).toBe(6);
      expect(result.properties.terminalStateCount).toBe(2);
      expect(result.properties.unreachableStates).toEqual([]);
      expect(result.properties.deadlockedStates).toEqual([]);
    });

    it("lists all reachable states", () => {
      const result = validateSpec(createPRReviewSpec());
      expect(result.properties.reachableStates).toContain("initialized");
      expect(result.properties.reachableStates).toContain("merged");
      expect(result.properties.reachableStates).toContain("closed");
    });
  });

  describe("broken specs", () => {
    it("detects missing initial state in state list", () => {
      const result = validateSpec(createBrokenSpec());
      expect(result.valid).toBe(false);
      const codes = result.issues.map((i) => i.code);
      expect(codes).toContain("INITIAL_STATE_NOT_FOUND");
    });

    it("detects missing final state in state list", () => {
      const result = validateSpec(createBrokenSpec());
      const codes = result.issues.map((i) => i.code);
      expect(codes).toContain("FINAL_STATE_NOT_FOUND");
    });

    it("detects unreachable states", () => {
      const result = validateSpec(createBrokenSpec());
      expect(result.properties.unreachableStates.length).toBeGreaterThan(0);
    });

    it("detects deadlocked states", () => {
      const result = validateSpec(createBrokenSpec());
      expect(result.properties.deadlockedStates).toContain("deadlock");
    });

    it("detects transitions from terminal states", () => {
      const result = validateSpec(createBrokenSpec());
      const codes = result.issues.map((i) => i.code);
      expect(codes).toContain("TRANSITION_FROM_TERMINAL");
    });

    it("detects terminal state with outgoing transitions", () => {
      const result = validateSpec(createBrokenSpec());
      const codes = result.issues.map((i) => i.code);
      expect(codes).toContain("TERMINAL_HAS_OUTGOING");
    });
  });

  describe("warnings", () => {
    it("warns about allowed_transition referencing nonexistent transition", () => {
      const result = validateSpec(createBrokenSpec());
      const warnings = result.issues.filter(
        (i) => i.severity === ValidationSeverity.WARNING
      );
      const codes = warnings.map((i) => i.code);
      expect(codes).toContain("ALLOWED_TRANSITION_NOT_FOUND");
    });
  });
});

describe("computeReachability", () => {
  it("finds all reachable states from initial", () => {
    const spec = createPRReviewSpec();
    const reachable = computeReachability(spec);
    expect(reachable.has("initialized")).toBe(true);
    expect(reachable.has("under_review")).toBe(true);
    expect(reachable.has("changes_requested")).toBe(true);
    expect(reachable.has("approved")).toBe(true);
    expect(reachable.has("merged")).toBe(true);
    expect(reachable.has("closed")).toBe(true);
    expect(reachable.size).toBe(6);
  });

  it("handles minimal specs", () => {
    const reachable = computeReachability(createMinimalSpec());
    expect(reachable.size).toBe(2);
    expect(reachable.has("start")).toBe(true);
    expect(reachable.has("done")).toBe(true);
  });

  it("does not reach orphaned states", () => {
    const reachable = computeReachability(createBrokenSpec());
    expect(reachable.has("orphan")).toBe(false);
    expect(reachable.has("deadlock")).toBe(false);
  });
});

describe("findDeadlockedStates", () => {
  it("returns empty for well-formed spec", () => {
    expect(findDeadlockedStates(createPRReviewSpec())).toEqual([]);
  });

  it("finds non-terminal states with no outgoing transitions", () => {
    const deadlocked = findDeadlockedStates(createBrokenSpec());
    expect(deadlocked).toContain("deadlock");
    expect(deadlocked).toContain("orphan");
  });
});

describe("canAllStatesTerminate", () => {
  it("returns true for spec where all states reach a terminal", () => {
    const result = canAllStatesTerminate(createPRReviewSpec());
    expect(result.canTerminate).toBe(true);
    expect(result.stuckStates).toEqual([]);
  });

  it("detects states that cannot reach any terminal", () => {
    const result = canAllStatesTerminate(createBrokenSpec());
    expect(result.canTerminate).toBe(false);
    expect(result.stuckStates.length).toBeGreaterThan(0);
  });

  it("returns true for minimal spec", () => {
    const result = canAllStatesTerminate(createMinimalSpec());
    expect(result.canTerminate).toBe(true);
  });
});
