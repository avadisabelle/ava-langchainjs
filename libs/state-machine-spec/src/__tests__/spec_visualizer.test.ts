import { describe, it, expect } from "vitest";
import {
  generateMermaid,
  generateMermaidFlowchart,
  generateTextSummary,
  generateAdjacencyMatrix,
} from "../spec_visualizer.js";
import { createPRReviewSpec, createMinimalSpec } from "./fixtures.js";

describe("generateMermaid", () => {
  it("produces a valid stateDiagram-v2 header", () => {
    const mermaid = generateMermaid(createPRReviewSpec());
    expect(mermaid).toMatch(/^stateDiagram-v2/);
  });

  it("includes initial state arrow", () => {
    const mermaid = generateMermaid(createPRReviewSpec());
    expect(mermaid).toContain("[*] --> initialized");
  });

  it("includes terminal state arrow to end", () => {
    const mermaid = generateMermaid(createPRReviewSpec());
    expect(mermaid).toContain("merged --> [*]");
    expect(mermaid).toContain("closed --> [*]");
  });

  it("includes all transitions", () => {
    const mermaid = generateMermaid(createPRReviewSpec());
    expect(mermaid).toContain("initialized --> under_review: to_under_review");
    expect(mermaid).toContain("approved --> merged: to_merged");
  });

  it("shows notes by default", () => {
    const mermaid = generateMermaid(createPRReviewSpec());
    expect(mermaid).toContain("note right of");
  });

  it("hides notes when showNotes is false", () => {
    const mermaid = generateMermaid(createPRReviewSpec(), { showNotes: false });
    expect(mermaid).not.toContain("note right of");
  });

  it("shows conditions when enabled", () => {
    const mermaid = generateMermaid(createPRReviewSpec(), {
      showConditions: true,
      showNotes: false,
    });
    expect(mermaid).toContain("PR is not draft");
  });

  it("shows actions when enabled", () => {
    const mermaid = generateMermaid(createPRReviewSpec(), {
      showActions: true,
      showNotes: false,
    });
    expect(mermaid).toContain("notify_reviewers");
  });

  it("works with minimal spec", () => {
    const mermaid = generateMermaid(createMinimalSpec());
    expect(mermaid).toContain("[*] --> start");
    expect(mermaid).toContain("start --> done: finish");
    expect(mermaid).toContain("done --> [*]");
  });
});

describe("generateMermaidFlowchart", () => {
  it("produces a flowchart header", () => {
    const chart = generateMermaidFlowchart(createPRReviewSpec());
    expect(chart).toMatch(/^flowchart TD/);
  });

  it("supports left-right direction", () => {
    const chart = generateMermaidFlowchart(createPRReviewSpec(), {
      direction: "LR",
    });
    expect(chart).toMatch(/^flowchart LR/);
  });

  it("uses rounded boxes for terminal states", () => {
    const chart = generateMermaidFlowchart(createPRReviewSpec());
    expect(chart).toContain("merged([merged])");
    expect(chart).toContain("closed([closed])");
  });

  it("uses parentheses for non-terminal states", () => {
    const chart = generateMermaidFlowchart(createPRReviewSpec());
    expect(chart).toContain("initialized(initialized)");
  });

  it("includes transition labels", () => {
    const chart = generateMermaidFlowchart(createPRReviewSpec());
    expect(chart).toContain("|to_merged|");
  });

  it("styles terminal states green", () => {
    const chart = generateMermaidFlowchart(createPRReviewSpec());
    expect(chart).toContain("style merged");
    expect(chart).toContain("fill:#d4edda");
  });

  it("styles initial state blue", () => {
    const chart = generateMermaidFlowchart(createPRReviewSpec());
    expect(chart).toContain("style initialized fill:#cce5ff");
  });
});

describe("generateTextSummary", () => {
  it("includes spec name and description", () => {
    const text = generateTextSummary(createPRReviewSpec());
    expect(text).toContain("State Machine: pr_review_workflow");
    expect(text).toContain("Pull Request Review Workflow");
  });

  it("includes initial and final states", () => {
    const text = generateTextSummary(createPRReviewSpec());
    expect(text).toContain("Initial State: initialized");
    expect(text).toContain("Final States: merged, closed");
  });

  it("lists all states with terminal markers", () => {
    const text = generateTextSummary(createPRReviewSpec());
    expect(text).toContain("merged [TERMINAL]");
    expect(text).toContain("closed [TERMINAL]");
    expect(text).not.toContain("initialized [TERMINAL]");
  });

  it("lists transitions with details", () => {
    const text = generateTextSummary(createPRReviewSpec());
    expect(text).toContain("to_merged: approved --> merged");
    expect(text).toContain("Triggers: merge_button_clicked");
    expect(text).toContain("Pre: CI passes; No merge conflicts");
    expect(text).toContain("Actions: merge_pr, delete_branch, notify_team");
  });

  it("includes relational context", () => {
    const text = generateTextSummary(createPRReviewSpec());
    expect(text).toContain("Relational Accountability:");
    expect(text).toContain("Entities: author, reviewer, maintainer");
  });

  it("shows state counts", () => {
    const text = generateTextSummary(createPRReviewSpec());
    expect(text).toContain("States (6):");
    expect(text).toContain("Transitions (6):");
  });
});

describe("generateAdjacencyMatrix", () => {
  it("produces correct dimensions", () => {
    const { states, matrix } = generateAdjacencyMatrix(createPRReviewSpec());
    expect(states.length).toBe(6);
    expect(matrix.length).toBe(6);
    matrix.forEach((row) => expect(row.length).toBe(6));
  });

  it("marks transitions as true", () => {
    const { states, matrix } = generateAdjacencyMatrix(createMinimalSpec());
    const startIdx = states.indexOf("start");
    const doneIdx = states.indexOf("done");
    expect(matrix[startIdx][doneIdx]).toBe(true);
  });

  it("non-transitions are false", () => {
    const { states, matrix } = generateAdjacencyMatrix(createMinimalSpec());
    const startIdx = states.indexOf("start");
    const doneIdx = states.indexOf("done");
    expect(matrix[doneIdx][startIdx]).toBe(false);
    expect(matrix[startIdx][startIdx]).toBe(false);
  });

  it("reflects all transitions in the PR review spec", () => {
    const spec = createPRReviewSpec();
    const { states, matrix } = generateAdjacencyMatrix(spec);
    // Count total true entries
    let trueCount = 0;
    for (const row of matrix) {
      for (const cell of row) {
        if (cell) trueCount++;
      }
    }
    expect(trueCount).toBe(spec.transitions.length);
  });
});
