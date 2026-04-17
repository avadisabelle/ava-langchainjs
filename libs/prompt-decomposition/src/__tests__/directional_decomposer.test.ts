import { describe, it, expect } from "vitest";
import {
  DirectionalDecomposer,
  Direction,
  ALL_DIRECTIONS,
  DIRECTION_NAMES,
  DIRECTION_QUESTIONS,
} from "../directional_decomposer.js";

describe("DirectionalDecomposer", () => {
  const decomposer = new DirectionalDecomposer();

  describe("decompose", () => {
    it("should produce a valid DirectionalAnalysis", () => {
      const result = decomposer.decompose(
        "Research the existing patterns. Build the implementation. Test the results."
      );
      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.prompt).toContain("Research");
      expect(result.directions).toBeDefined();
      for (const dir of ALL_DIRECTIONS) {
        expect(result.directions[dir]).toBeDefined();
      }
    });

    it("should classify research keywords to SOUTH", () => {
      const result = decomposer.decompose(
        "Research the existing codebase and analyze the patterns used."
      );
      expect(result.directions[Direction.SOUTH].length).toBeGreaterThan(0);
    });

    it("should classify build/create keywords to NORTH", () => {
      const result = decomposer.decompose(
        "Build the new package and implement the core modules."
      );
      expect(result.directions[Direction.NORTH].length).toBeGreaterThan(0);
    });

    it("should classify test/validate keywords to WEST", () => {
      const result = decomposer.decompose(
        "Test the results and verify the integration works correctly."
      );
      expect(result.directions[Direction.WEST].length).toBeGreaterThan(0);
    });

    it("should classify vision/purpose keywords to EAST", () => {
      const result = decomposer.decompose(
        "Our vision is to create a system that aspires to embody relational knowing."
      );
      expect(result.directions[Direction.EAST].length).toBeGreaterThan(0);
    });

    it("should detect neglected directions", () => {
      const result = decomposer.decompose(
        "Build it. Deploy it. Ship it now. Execute the plan immediately."
      );
      // Heavily NORTH, should neglect others
      expect(result.leadDirection).toBe(Direction.NORTH);
      expect(result.neglectedDirections.length).toBeGreaterThan(0);
    });

    it("should calculate balance", () => {
      const result = decomposer.decompose(
        "Research the context. Build the implementation. Test the results. Envision the purpose."
      );
      expect(result.balance).toBeGreaterThanOrEqual(0);
      expect(result.balance).toBeLessThanOrEqual(1);
    });
  });

  describe("isBalanced", () => {
    it("should return false for unbalanced prompts", () => {
      const result = decomposer.decompose("Build build build deploy code.");
      expect(decomposer.isBalanced(result)).toBe(false);
    });
  });

  describe("getGuidance", () => {
    it("should provide guidance for neglected directions", () => {
      const result = decomposer.decompose("Build deploy implement code now.");
      const guidance = decomposer.getGuidance(result);
      expect(guidance.length).toBeGreaterThan(0);
    });
  });

  describe("constants", () => {
    it("should have names for all directions", () => {
      for (const dir of ALL_DIRECTIONS) {
        expect(DIRECTION_NAMES[dir]).toBeDefined();
        expect(DIRECTION_QUESTIONS[dir]).toBeDefined();
      }
    });
  });
});
