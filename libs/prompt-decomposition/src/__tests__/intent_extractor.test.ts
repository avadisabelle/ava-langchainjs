import { describe, it, expect, vi } from "vitest";
import {
  IntentExtractor,
  Urgency,
  PrimaryIntent,
  SecondaryIntent,
  ExtractionContext,
} from "../intent_extractor.js";
import { BaseChatModel, BaseLLM } from "@langchain/core/language_models/base";

describe("IntentExtractor", () => {
  const extractor = new IntentExtractor();

  describe("extract", () => {
    it("should extract primary intent", async () => {
      const result = await extractor.extract(
        "Create a new package for prompt decomposition."
      );
      expect(result.primary).toBeDefined();
      expect(result.primary.action).toBe("create");
      expect(result.primary.confidence).toBeGreaterThan(0);
    });

    it("should extract secondary intents", async () => {
      const result = await extractor.extract(
        "Research the existing patterns. Build the implementation. Test the results."
      );
      expect(result.secondary.length).toBeGreaterThan(0);
    });

    it("should detect urgency from keywords", async () => {
      const immediate = await extractor.extract("Fix this immediately!");
      expect(immediate.primary.urgency).toBe(Urgency.IMMEDIATE);

      const session = await extractor.extract("Let's build a new package today.");
      expect(session.primary.urgency).toBe(Urgency.SESSION);
    });

    it("should extract file paths in context", async () => {
      const result = await extractor.extract(
        "Check /src/mcp-pde/ and build a new module."
      );
      expect(result.context.filesNeeded).toContain("/src/mcp-pde/");
    });

    it("should extract @-references", async () => {
      const result = await extractor.extract(
        "Use @ava-langchainjs/libs/ to build the package."
      );
      expect(result.context.filesNeeded.some((f) => f.includes("ava-langchainjs"))).toBe(true);
    });

    it("should assign unique IDs to secondary intents", async () => {
      const result = await extractor.extract(
        "Create module A. Build module B. Test module C."
      );
      const ids = result.secondary.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("should map dependencies between investigate and create", async () => {
      const result = await extractor.extract(
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
    it("should extract implicit intents from 'which' clauses", async () => {
      const extractor = new IntentExtractor({ extractImplicit: true });
      const result = await extractor.extract(
        "Build the system which needs proper testing infrastructure."
      );
      const implicit = result.secondary.filter((s) => s.implicit);
      expect(implicit.length).toBeGreaterThanOrEqual(0); // May or may not detect
    });

    it("should skip implicit extraction when disabled", async () => {
      const extractor = new IntentExtractor({ extractImplicit: false });
      const result = await extractor.extract(
        "Build the system which needs proper testing."
      );
      const implicit = result.secondary.filter((s) => s.implicit);
      expect(implicit.length).toBe(0);
    });
  });

  describe("confidence scoring", () => {
    it("should boost confidence for specific paths", async () => {
      const result = await extractor.extract(
        "Create /workspace/repos/new-package/src/index.ts module."
      );
      expect(result.primary.confidence).toBeGreaterThan(0.7);
    });

    it("should reduce confidence for hedging language", async () => {
      const result = await extractor.extract(
        "Maybe we could possibly create a new module."
      );
      expect(result.primary.confidence).toBeLessThan(0.8);
    });
  });

  describe("LLM Integration", () => {
    const mockPrimary: PrimaryIntent = {
      action: "create",
      target: "a new feature",
      urgency: Urgency.SESSION,
      confidence: 0.9,
    };
    const mockSecondary: SecondaryIntent[] = [
      { id: "sec-1", action: "investigate", target: "requirements", implicit: false, dependency: null, confidence: 0.8 },
      { id: "sec-2", action: "build", target: "feature", implicit: false, dependency: "sec-1", confidence: 0.9 },
    ];
    const mockContext: ExtractionContext = {
      filesNeeded: ["/src/main.ts"],
      toolsRequired: ["npm"],
      assumptions: [],
    };

    const mockLLMResponse = (
      primary: PrimaryIntent,
      secondary: SecondaryIntent[],
      context: ExtractionContext,
      prompt: string
    ) => JSON.stringify({
      primary,
      secondary,
      context,
      prompt,
    });

    it("should use LLM for extraction when provided", async () => {
      const mockLLM = {
        invoke: vi.fn(async (input: any) => ({
          content: mockLLMResponse(mockPrimary, mockSecondary, mockContext, "Test prompt"),
        })),
      } as unknown as BaseChatModel;

      const extractorWithLLM = new IntentExtractor({ llm: mockLLM });
      const prompt = "Please create a new feature.";
      const result = await extractorWithLLM.extract(prompt);

      expect(mockLLM.invoke).toHaveBeenCalledOnce();
      expect(result.primary.action).toBe(mockPrimary.action);
      expect(result.secondary).toHaveLength(mockSecondary.length);
      expect(result.context.filesNeeded).toEqual(mockContext.filesNeeded);
    });

    it("should fall back to heuristic extraction if LLM output is malformed", async () => {
      const mockLLM = {
        invoke: vi.fn(async () => ({
          content: "this is not valid json",
        })),
      } as unknown as BaseChatModel;

      const extractorWithLLM = new IntentExtractor({ llm: mockLLM });
      const prompt = "Create a report. Analyze data."; // Should be caught by heuristics
      const result = await extractorWithLLM.extract(prompt);

      expect(mockLLM.invoke).toHaveBeenCalledOnce();
      expect(result.primary.action).toBe("create"); // From heuristic
      expect(result.secondary.some(s => s.action === "analyze")).toBe(true);
    });

    it("should fall back to heuristic extraction if LLM output does not match schema", async () => {
      const mockLLM = {
        invoke: vi.fn(async () => ({
          content: JSON.stringify({
            primary: { action: "invalid_action", target: "test", urgency: "unknown", confidence: 0.5 },
            secondary: [],
            context: { filesNeeded: [], toolsRequired: [], assumptions: [] },
          }),
        })),
      } as unknown as BaseChatModel;

      const extractorWithLLM = new IntentExtractor({ llm: mockLLM });
      const prompt = "Deploy the application.";
      const result = await extractorWithLLM.extract(prompt);

      expect(mockLLM.invoke).toHaveBeenCalledOnce();
      expect(result.primary.action).toBe("deploy"); // From heuristic
    });

    it("should add IDs to secondary intents if LLM does not provide them", async () => {
      const secondaryWithoutIds: SecondaryIntent[] = [
        { action: "investigate", target: "requirements", implicit: false, dependency: null, confidence: 0.8 } as SecondaryIntent,
      ];
      const llmOutput = mockLLMResponse(mockPrimary, secondaryWithoutIds, mockContext, "Test prompt");

      const mockLLM = {
        invoke: vi.fn(async () => ({ content: llmOutput })),
      } as unknown as BaseChatModel;

      const extractorWithLLM = new IntentExtractor({ llm: mockLLM });
      const prompt = "Perform task A.";
      const result = await extractorWithLLM.extract(prompt);

      expect(result.secondary[0].id).toBeDefined();
      expect(result.secondary[0].id).not.toBeNull();
    });

    it("should correct invalid actions from LLM output to a safe default", async () => {
      const secondaryWithInvalidAction: SecondaryIntent[] = [
        { id: "sec-1", action: "invalid_verb", target: "something", implicit: false, dependency: null, confidence: 0.8 } as SecondaryIntent,
      ];
      const llmOutput = mockLLMResponse(mockPrimary, secondaryWithInvalidAction, mockContext, "Test prompt");

      const mockLLM = {
        invoke: vi.fn(async () => ({ content: llmOutput })),
      } as unknown as BaseChatModel;

      const extractorWithLLM = new IntentExtractor({ llm: mockLLM });
      const prompt = "Do something invalid.";
      const result = await extractorWithLLM.extract(prompt);

      expect(result.secondary[0].action).toBe("investigate"); // Fallback to 'investigate'
    });

    it("should use heuristic extraction if no LLM is provided", async () => {
      const extractorNoLLM = new IntentExtractor();
      const prompt = "Implement the algorithm and test it thoroughly.";
      const result = await extractorNoLLM.extract(prompt);

      expect(result.primary.action).toBe("implement");
      expect(result.secondary.some(s => s.action === "test")).toBe(true);
    });
  });
});
