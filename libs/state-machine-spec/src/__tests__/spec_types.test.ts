import { describe, it, expect } from "vitest";
import {
  createStateSpec,
  createTransitionSpec,
  createStateMachineSpec,
  getState,
  getTransition,
  getTransitionsFrom,
  getTransitionsTo,
  getNonTerminalStates,
  getTerminalStates,
} from "../spec_types.js";
import { createPRReviewSpec, createMinimalSpec } from "./fixtures.js";

describe("createStateSpec", () => {
  it("creates a state with defaults", () => {
    const state = createStateSpec("idle", "Waiting for input");
    expect(state.name).toBe("idle");
    expect(state.description).toBe("Waiting for input");
    expect(state.entryConditions).toEqual([]);
    expect(state.exitConditions).toEqual([]);
    expect(state.allowedTransitions).toEqual([]);
    expect(state.isTerminal).toBe(false);
  });

  it("creates a terminal state", () => {
    const state = createStateSpec("done", "Finished", { isTerminal: true });
    expect(state.isTerminal).toBe(true);
  });

  it("creates a state with conditions", () => {
    const state = createStateSpec("reviewing", "Under review", {
      entryConditions: ["reviewer assigned"],
      exitConditions: ["decision made"],
      allowedTransitions: ["approve", "reject"],
    });
    expect(state.entryConditions).toEqual(["reviewer assigned"]);
    expect(state.exitConditions).toEqual(["decision made"]);
    expect(state.allowedTransitions).toEqual(["approve", "reject"]);
  });
});

describe("createTransitionSpec", () => {
  it("creates a transition with defaults", () => {
    const t = createTransitionSpec("go", "a", "b");
    expect(t.name).toBe("go");
    expect(t.fromState).toBe("a");
    expect(t.toState).toBe("b");
    expect(t.triggerEvents).toEqual([]);
    expect(t.preconditions).toEqual([]);
    expect(t.actions).toEqual([]);
    expect(t.postconditions).toEqual([]);
  });

  it("creates a transition with full options", () => {
    const t = createTransitionSpec("merge", "approved", "merged", {
      triggerEvents: ["click_merge"],
      preconditions: ["CI passes"],
      actions: ["merge_branch"],
      postconditions: ["branch merged"],
    });
    expect(t.triggerEvents).toEqual(["click_merge"]);
    expect(t.preconditions).toEqual(["CI passes"]);
    expect(t.actions).toEqual(["merge_branch"]);
    expect(t.postconditions).toEqual(["branch merged"]);
  });
});

describe("createStateMachineSpec", () => {
  it("creates a spec with defaults", () => {
    const spec = createStateMachineSpec("test", "A test", "start");
    expect(spec.name).toBe("test");
    expect(spec.description).toBe("A test");
    expect(spec.initialState).toBe("start");
    expect(spec.finalStates).toEqual([]);
    expect(spec.states).toEqual([]);
    expect(spec.transitions).toEqual([]);
    expect(spec.metadata.version).toBe("1.0.0");
    expect(spec.metadata.langgraphCompatible).toBe(true);
  });
});

describe("lookup helpers", () => {
  const spec = createPRReviewSpec();

  describe("getState", () => {
    it("finds an existing state", () => {
      const state = getState(spec, "under_review");
      expect(state).toBeDefined();
      expect(state!.name).toBe("under_review");
    });

    it("returns undefined for missing state", () => {
      expect(getState(spec, "nonexistent")).toBeUndefined();
    });
  });

  describe("getTransition", () => {
    it("finds an existing transition", () => {
      const t = getTransition(spec, "to_merged");
      expect(t).toBeDefined();
      expect(t!.fromState).toBe("approved");
      expect(t!.toState).toBe("merged");
    });

    it("returns undefined for missing transition", () => {
      expect(getTransition(spec, "nonexistent")).toBeUndefined();
    });
  });

  describe("getTransitionsFrom", () => {
    it("returns outgoing transitions", () => {
      const from = getTransitionsFrom(spec, "under_review");
      expect(from.length).toBe(2);
      const names = from.map((t) => t.name);
      expect(names).toContain("to_changes_requested");
      expect(names).toContain("to_approved");
    });

    it("returns empty for terminal state", () => {
      const from = getTransitionsFrom(spec, "merged");
      expect(from).toEqual([]);
    });
  });

  describe("getTransitionsTo", () => {
    it("returns incoming transitions", () => {
      const to = getTransitionsTo(spec, "under_review");
      expect(to.length).toBe(2);
    });

    it("returns empty for initial state with no incoming", () => {
      const to = getTransitionsTo(spec, "initialized");
      expect(to).toEqual([]);
    });
  });

  describe("getNonTerminalStates", () => {
    it("excludes terminal states", () => {
      const nonTerminal = getNonTerminalStates(spec);
      expect(nonTerminal.every((s) => !s.isTerminal)).toBe(true);
      expect(nonTerminal.length).toBe(4);
    });
  });

  describe("getTerminalStates", () => {
    it("returns only terminal states", () => {
      const terminal = getTerminalStates(spec);
      expect(terminal.every((s) => s.isTerminal)).toBe(true);
      expect(terminal.length).toBe(2);
      const names = terminal.map((s) => s.name);
      expect(names).toContain("merged");
      expect(names).toContain("closed");
    });
  });
});
