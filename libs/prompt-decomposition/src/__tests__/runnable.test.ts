import { describe, it, expect } from "vitest";
import {
  RunnableDecomposer,
  RunnableDirectionalAnalyzer,
  RunnableWheelGate,
} from "../runnable.js";

describe("RunnableDecomposer", () => {
  it("should invoke as a LangChain Runnable", async () => {
    const decomposer = new RunnableDecomposer();
    const result = await decomposer.invoke(
      "Research the codebase. Build the module. Test the integration."
    );

    expect(result.decomposition).toBeDefined();
    expect(result.wheelEnriched).toBeDefined();
    expect(result.json).toBeDefined();
    expect(result.markdown).toBeDefined();
    expect(result.ceremonyRequired).toBeDefined();
    expect(result.balance).toBeGreaterThanOrEqual(0);
    expect(result.primaryAction).toBeDefined();
    expect(result.actionCount).toBeGreaterThan(0);
  });

  it("should support batch processing", async () => {
    const decomposer = new RunnableDecomposer();
    const results = await decomposer.batch([
      "Build a module.",
      "Research the topic.",
    ]);

    expect(results.length).toBe(2);
    expect(results[0].primaryAction).toBeDefined();
    expect(results[1].primaryAction).toBeDefined();
  });

  it("should be chainable with pipe", async () => {
    const decomposer = new RunnableDecomposer();
    // Pipe to a function that extracts just the action count
    const chain = decomposer.pipe((result) => result.actionCount);
    const count = await chain.invoke("Build a module. Test it. Deploy it.");
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThan(0);
  });

  it("should accept custom options", async () => {
    const decomposer = new RunnableDecomposer({
      actionStack: { maxItems: 2 },
      wheelBridge: { ceremonyThreshold: 0.1 },
    });
    const result = await decomposer.invoke(
      "Create A. Build B. Test C. Deploy D. Research E."
    );
    expect(result.decomposition.actionStack.length).toBeLessThanOrEqual(2);
  });
});

describe("RunnableDirectionalAnalyzer", () => {
  it("should analyze directions as a Runnable", async () => {
    const analyzer = new RunnableDirectionalAnalyzer();
    const result = await analyzer.invoke(
      "Research the patterns and build the implementation."
    );

    expect(result.directions).toBeDefined();
    expect(result.leadDirection).toBeDefined();
    expect(result.balance).toBeGreaterThanOrEqual(0);
  });
});

describe("RunnableWheelGate", () => {
  it("should check balance as a Runnable", async () => {
    const gate = new RunnableWheelGate();
    const result = await gate.invoke("Build deploy ship execute now.");

    expect(result.ceremonyRequired).toBe(true);
    expect(result.guidance.length).toBeGreaterThan(0);
  });

  it("should pass balanced prompts", async () => {
    const gate = new RunnableWheelGate();
    const result = await gate.invoke(
      "Envision the purpose. Research the patterns. Verify the approach. Build the module."
    );

    expect(result.relationalCoverage).toBeGreaterThan(0);
  });
});
