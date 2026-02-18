import { describe, it, expect } from "vitest";
import { DependencyMapper } from "../dependency_mapper.js";
import { IntentExtractor } from "../intent_extractor.js";

describe("DependencyMapper", () => {
  const mapper = new DependencyMapper();
  const extractor = new IntentExtractor();

  describe("buildGraph", () => {
    it("should build a graph from intents", () => {
      const result = extractor.extract(
        "Research the patterns. Build the implementation. Test the results."
      );
      const graph = mapper.buildGraph(result.secondary);
      expect(graph.id).toBeDefined();
      expect(graph.nodes.size).toBeGreaterThan(0);
    });

    it("should identify root nodes (no dependencies)", () => {
      const result = extractor.extract(
        "Investigate the codebase. Create the module."
      );
      const graph = mapper.buildGraph(result.secondary);
      expect(graph.roots.length).toBeGreaterThan(0);
    });

    it("should detect no cycles in simple graphs", () => {
      const result = extractor.extract(
        "Research first. Build second. Test third."
      );
      const graph = mapper.buildGraph(result.secondary);
      expect(graph.hasCycle).toBe(false);
    });

    it("should calculate depths", () => {
      const result = extractor.extract(
        "Research the patterns. Build the implementation."
      );
      const graph = mapper.buildGraph(result.secondary);
      // Root nodes should have depth 0
      for (const rootId of graph.roots) {
        expect(graph.nodes.get(rootId)?.depth).toBe(0);
      }
    });
  });

  describe("computeExecutionOrder", () => {
    it("should produce execution layers", () => {
      const result = extractor.extract(
        "Investigate the code. Create the module. Test the module."
      );
      const graph = mapper.buildGraph(result.secondary);
      const order = mapper.computeExecutionOrder(graph);

      expect(order.layers.length).toBeGreaterThan(0);
      expect(order.totalSteps).toBeGreaterThan(0);
    });

    it("should place independent tasks in parallel layers", () => {
      const result = extractor.extract(
        "Research topic A. Research topic B. Research topic C."
      );
      const graph = mapper.buildGraph(result.secondary);
      const order = mapper.computeExecutionOrder(graph);

      // All research tasks should be in layer 0 (no dependencies)
      expect(order.layers[0].length).toBeGreaterThanOrEqual(2);
    });

    it("should compute critical path", () => {
      const result = extractor.extract(
        "Research the topic. Build the code. Test the code. Deploy the code."
      );
      const graph = mapper.buildGraph(result.secondary);
      const order = mapper.computeExecutionOrder(graph);
      expect(order.criticalPath.length).toBeGreaterThan(0);
    });
  });
});
