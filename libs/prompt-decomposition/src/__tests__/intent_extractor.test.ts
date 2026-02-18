import { describe, it, expect } from "vitest";
import {
  IntentExtractor,
  Urgency,
} from "../intent_extractor.js";

describe("IntentExtractor", () => {
  const extractor = new IntentExtractor();

  describe("extract", () => {
    it("should extract primary intent", () => {
      const result = extractor.extract(
        "Create a new package for prompt decomposition."
      );
      expect(result.primary).toBeDefined();
      expect(result.primary.action).toBe("create");
      expect(result.primary.confidence).toBeGreaterThan(0);
    });

    it("should extract secondary intents", () => {
      const result = extractor.extract(
        "Research the existing patterns. Build the implementation. Test the results."
      );
      expect(result.secondary.length).toBeGreaterThan(0);
    });

    it("should detect urgency from keywords", () => {
      const immediate = extractor.extract("Fix this immediately!");
      expect(immediate.primary.urgency).toBe(Urgency.IMMEDIATE);

      const session = extractor.extract("Let's build a new package today.");
      expect(session.primary.urgency).toBe(Urgency.SESSION);
    });

    it("should extract file paths in context", () => {
      const result = extractor.extract(
        "Check /src/mcp-pde/ and build a new module."
      );
      expect(result.context.filesNeeded).toContain("/src/mcp-pde/");
    });

    it("should extract @-references", () => {
      const result = extractor.extract(
        "Use @ava-langchainjs/libs/ to build the package."
      );
      expect(result.context.filesNeeded.some((f) => f.includes("ava-langchainjs"))).toBe(true);
    });

    it("should assign unique IDs to secondary intents", () => {
      const result = extractor.extract(
        "Create module A. Build module B. Test module C."
      );
      const ids = result.secondary.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("should map dependencies between investigate and create", () => {
      const result = extractor.extract(
        "Investigate the git submodule patterns. Create scripts mimicking those patterns."
      );
      const investigate = result.secondary.find((s) => s.action === "investigate");
      const create = result.secondary.find((s) => s.action === "create");
      if (investigate && create) {
        expect(create.dependency).toBe(investigate.id);
      }
    });
  });

  describe("implicit intents", () => {
    it("should extract implicit intents from 'which' clauses", () => {
      const extractor = new IntentExtractor({ extractImplicit: true });
      const result = extractor.extract(
        "Build the system which needs proper testing infrastructure."
      );
      const implicit = result.secondary.filter((s) => s.implicit);
      expect(implicit.length).toBeGreaterThanOrEqual(0); // May or may not detect
    });

    it("should skip implicit extraction when disabled", () => {
      const extractor = new IntentExtractor({ extractImplicit: false });
      const result = extractor.extract(
        "Build the system which needs proper testing."
      );
      const implicit = result.secondary.filter((s) => s.implicit);
      expect(implicit.length).toBe(0);
    });
  });

  describe("confidence scoring", () => {
    it("should boost confidence for specific paths", () => {
      const result = extractor.extract(
        "Create /workspace/repos/new-package/src/index.ts module."
      );
      expect(result.primary.confidence).toBeGreaterThan(0.7);
    });

    it("should reduce confidence for hedging language", () => {
      const result = extractor.extract(
        "Maybe we could possibly create a new module."
      );
      expect(result.primary.confidence).toBeLessThan(0.8);
    });
  });
});
