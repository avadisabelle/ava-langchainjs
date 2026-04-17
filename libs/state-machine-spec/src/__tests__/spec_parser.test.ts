import { describe, it, expect } from "vitest";
import {
  parseSpec,
  normalizeSpec,
  serializeSpec,
  serializeSpecSnakeCase,
} from "../spec_parser.js";
import { createPRReviewSpec, SNAKE_CASE_JSON } from "./fixtures.js";

describe("parseSpec", () => {
  it("parses snake_case JSON into camelCase typed spec", () => {
    const spec = parseSpec(SNAKE_CASE_JSON);
    expect(spec.name).toBe("python_workflow");
    expect(spec.initialState).toBe("idle");
    expect(spec.finalStates).toEqual(["complete"]);
    expect(spec.states.length).toBe(3);
    expect(spec.transitions.length).toBe(2);
  });

  it("normalizes state fields from snake_case", () => {
    const spec = parseSpec(SNAKE_CASE_JSON);
    const working = spec.states.find((s) => s.name === "working");
    expect(working).toBeDefined();
    expect(working!.entryConditions).toEqual(["task assigned"]);
    expect(working!.exitConditions).toEqual(["task done"]);
    expect(working!.allowedTransitions).toEqual(["complete_work"]);
    expect(working!.isTerminal).toBe(false);
  });

  it("normalizes transition fields from snake_case", () => {
    const spec = parseSpec(SNAKE_CASE_JSON);
    const t = spec.transitions.find((t) => t.name === "start_work");
    expect(t).toBeDefined();
    expect(t!.fromState).toBe("idle");
    expect(t!.toState).toBe("working");
    expect(t!.triggerEvents).toEqual(["task_created"]);
    expect(t!.preconditions).toEqual(["resources available"]);
    expect(t!.actions).toEqual(["allocate_resources"]);
    expect(t!.postconditions).toEqual(["task in progress"]);
  });

  it("normalizes metadata and relational context", () => {
    const spec = parseSpec(SNAKE_CASE_JSON);
    expect(spec.metadata.version).toBe("1.0.0");
    expect(spec.metadata.author).toBe("python_dev");
    expect(spec.metadata.langgraphCompatible).toBe(true);
    expect(spec.metadata.relationalContext).toBeDefined();
    expect(spec.metadata.relationalContext!.entities).toEqual([
      "worker",
      "supervisor",
    ]);
    expect(spec.metadata.relationalContext!.stateResponsibilities).toBeDefined();
    expect(
      spec.metadata.relationalContext!.stateResponsibilities!["working"]
    ).toEqual(["worker"]);
  });
});

describe("normalizeSpec", () => {
  it("handles camelCase input (identity-like)", () => {
    const original = createPRReviewSpec();
    const raw = JSON.parse(JSON.stringify(original));
    const normalized = normalizeSpec(raw);
    expect(normalized.name).toBe(original.name);
    expect(normalized.initialState).toBe(original.initialState);
    expect(normalized.states.length).toBe(original.states.length);
    expect(normalized.transitions.length).toBe(original.transitions.length);
  });

  it("defaults missing arrays to empty", () => {
    const spec = normalizeSpec({
      name: "bare",
      description: "Bare minimum",
      initialState: "start",
      states: [{ name: "start", description: "Start" }],
      transitions: [],
    });
    expect(spec.finalStates).toEqual([]);
    expect(spec.states[0].entryConditions).toEqual([]);
    expect(spec.states[0].exitConditions).toEqual([]);
    expect(spec.states[0].allowedTransitions).toEqual([]);
    expect(spec.states[0].isTerminal).toBe(false);
  });

  it("defaults metadata when missing", () => {
    const spec = normalizeSpec({
      name: "no-meta",
      description: "No metadata",
      initialState: "s",
      states: [],
      transitions: [],
    });
    expect(spec.metadata.version).toBe("1.0.0");
    expect(spec.metadata.langgraphCompatible).toBe(true);
  });
});

describe("serializeSpec", () => {
  it("produces valid JSON", () => {
    const spec = createPRReviewSpec();
    const json = serializeSpec(spec);
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe("pr_review_workflow");
    expect(parsed.initialState).toBe("initialized");
  });

  it("round-trips through parse/serialize", () => {
    const original = createPRReviewSpec();
    const json = serializeSpec(original);
    const reparsed = normalizeSpec(JSON.parse(json));
    expect(reparsed.name).toBe(original.name);
    expect(reparsed.states.length).toBe(original.states.length);
    expect(reparsed.transitions.length).toBe(original.transitions.length);
  });
});

describe("serializeSpecSnakeCase", () => {
  it("produces snake_case keys", () => {
    const spec = createPRReviewSpec();
    const json = serializeSpecSnakeCase(spec);
    const parsed = JSON.parse(json);
    expect(parsed.initial_state).toBe("initialized");
    expect(parsed.final_states).toEqual(["merged", "closed"]);
    expect(parsed.states[0].entry_conditions).toBeDefined();
    expect(parsed.states[0].is_terminal).toBeDefined();
    expect(parsed.transitions[0].from_state).toBeDefined();
    expect(parsed.transitions[0].to_state).toBeDefined();
    expect(parsed.transitions[0].trigger_events).toBeDefined();
    expect(parsed.metadata.langgraph_compatible).toBe(true);
  });

  it("includes relational_context in snake_case", () => {
    const spec = createPRReviewSpec();
    const json = serializeSpecSnakeCase(spec);
    const parsed = JSON.parse(json);
    expect(parsed.metadata.relational_context).toBeDefined();
    expect(parsed.metadata.relational_context.entities).toEqual([
      "author",
      "reviewer",
      "maintainer",
    ]);
    expect(
      parsed.metadata.relational_context.state_responsibilities
    ).toBeDefined();
  });

  it("round-trips snake_case -> parse -> snake_case", () => {
    const spec = parseSpec(SNAKE_CASE_JSON);
    const resnaked = serializeSpecSnakeCase(spec);
    const reparsed = parseSpec(resnaked);
    expect(reparsed.name).toBe("python_workflow");
    expect(reparsed.states.length).toBe(3);
    expect(reparsed.metadata.relationalContext!.entities).toEqual([
      "worker",
      "supervisor",
    ]);
  });
});
