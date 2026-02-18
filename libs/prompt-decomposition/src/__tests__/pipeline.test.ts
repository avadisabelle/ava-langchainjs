import { describe, it, expect } from "vitest";
import {
  ActionStackBuilder,
  decompose,
  MedicineWheelBridge,
  Direction,
} from "../index.js";
import { DirectionalDecomposer } from "../directional_decomposer.js";
import { IntentExtractor } from "../intent_extractor.js";
import { DependencyMapper } from "../dependency_mapper.js";

describe("ActionStackBuilder", () => {
  const builder = new ActionStackBuilder();
  const decomposer = new DirectionalDecomposer();
  const extractor = new IntentExtractor();
  const mapper = new DependencyMapper();

  it("should build a complete DecompositionResult", () => {
    const prompt = "Research the existing patterns. Build the new module. Test the integration.";
    const directions = decomposer.decompose(prompt);
    const intents = extractor.extract(prompt);
    const graph = mapper.buildGraph(intents.secondary);
    const order = mapper.computeExecutionOrder(graph);
    const result = builder.build(directions, intents, order);

    expect(result.id).toBeDefined();
    expect(result.primary.action).toBeDefined();
    expect(result.actionStack.length).toBeGreaterThan(0);
    expect(result.directions).toBeDefined();
  });

  it("should produce valid JSON output", () => {
    const prompt = "Create a package and deploy it.";
    const directions = decomposer.decompose(prompt);
    const intents = extractor.extract(prompt);
    const result = builder.build(directions, intents);

    const json = builder.toJSON(result);
    const parsed = JSON.parse(json);
    expect(parsed.id).toBe(result.id);
    expect(parsed.result.primary.action).toBe(result.primary.action);
  });

  it("should produce valid Markdown output", () => {
    const prompt = "Research. Build. Test. Vision.";
    const directions = decomposer.decompose(prompt);
    const intents = extractor.extract(prompt);
    const result = builder.build(directions, intents);

    const md = builder.toMarkdown(result);
    expect(md).toContain("Prompt Decomposition");
    expect(md).toContain("Action Stack");
  });

  it("should detect ambiguities for low confidence", () => {
    const prompt = "Maybe possibly do something.";
    const directions = decomposer.decompose(prompt);
    const intents = extractor.extract(prompt);
    const result = builder.build(directions, intents);

    // May have ambiguities about low confidence or neglected directions
    expect(result.ambiguities).toBeDefined();
  });

  it("should respect maxItems option", () => {
    const builder = new ActionStackBuilder({ maxItems: 2 });
    const prompt = "Create A. Build B. Test C. Deploy D. Research E.";
    const directions = decomposer.decompose(prompt);
    const intents = extractor.extract(prompt);
    const result = builder.build(directions, intents);

    expect(result.actionStack.length).toBeLessThanOrEqual(2);
  });
});

describe("MedicineWheelBridge", () => {
  const bridge = new MedicineWheelBridge();
  const decomposer = new DirectionalDecomposer();

  it("should enrich analysis with quadrant presence", () => {
    const analysis = decomposer.decompose(
      "Research the context. Build the code. Test it. Envision the purpose."
    );
    const enriched = bridge.enrich(analysis);

    expect(enriched.quadrantPresence).toBeDefined();
    expect(enriched.relationalCoverage).toBeGreaterThanOrEqual(0);
    expect(enriched.relationalCoverage).toBeLessThanOrEqual(1);
  });

  it("should flag ceremony required when spiritual/emotional lacking", () => {
    const analysis = decomposer.decompose(
      "Build code. Deploy code. Execute script. Ship it now."
    );
    const enriched = bridge.enrich(analysis);
    // Heavily physical, should flag ceremony
    expect(enriched.ceremonyRequired).toBe(true);
  });

  it("should provide relational guidance", () => {
    const analysis = decomposer.decompose("Build deploy ship execute.");
    const guidance = bridge.getRelationalGuidance(analysis);
    expect(guidance.length).toBeGreaterThan(0);
    expect(guidance.some((g) => g.includes("Ceremony Required"))).toBe(true);
  });
});

describe("decompose (full pipeline)", () => {
  it("should run the complete pipeline", () => {
    const result = decompose(
      "Investigate the existing codebase patterns. Design a new relational intelligence module. Build and test the implementation. Ensure ceremonial protocols are respected."
    );

    expect(result.decomposition).toBeDefined();
    expect(result.wheelEnriched).toBeDefined();
    expect(result.json).toBeDefined();
    expect(result.markdown).toBeDefined();
    expect(result.decomposition.actionStack.length).toBeGreaterThan(0);
  });

  it("should produce parseable JSON", () => {
    const result = decompose("Create a knowledge graph with ceremony.");
    const parsed = JSON.parse(result.json);
    expect(parsed.id).toBeDefined();
    expect(parsed.result).toBeDefined();
  });
});
