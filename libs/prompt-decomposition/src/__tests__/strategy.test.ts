import { describe, it, expect, vi } from "vitest";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import {
  ComplexityAnalyzer,
  KeywordStrategy,
  SemanticStrategy,
  HybridStrategy,
  StrategySelector,
  MultiPassDecomposer,
  ConfidenceCalibrator,
  StrategicDecomposer,
} from "../strategy_spec.js";
import type {
  AvailableResources,
  StrategyResult,
  ComplexitySignals,
} from "../strategy_spec.js";
import { Direction } from "../directional_decomposer.js";
import type { PrimaryIntent, SecondaryIntent, ExtractionContext } from "../intent_extractor.js";
import { Urgency } from "../intent_extractor.js";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build a mock LLM that returns structured JSON the IntentExtractor expects.
 */
function createMockLLM(overrides?: {
  primary?: Partial<PrimaryIntent>;
  secondary?: SecondaryIntent[];
  context?: Partial<ExtractionContext>;
}): BaseLanguageModel {
  const primary: PrimaryIntent = {
    action: "create",
    target: "a new feature",
    urgency: Urgency.SESSION,
    confidence: 0.9,
    ...overrides?.primary,
  };
  const secondary: SecondaryIntent[] = overrides?.secondary ?? [
    { id: "sec-1", action: "investigate", target: "requirements", implicit: false, dependency: null, confidence: 0.8 },
    { id: "sec-2", action: "build", target: "feature module", implicit: false, dependency: "sec-1", confidence: 0.9 },
  ];
  const context: ExtractionContext = {
    filesNeeded: [],
    toolsRequired: [],
    assumptions: [],
    ...overrides?.context,
  };

  return {
    invoke: vi.fn(async () => ({
      content: JSON.stringify({ primary, secondary, context, prompt: "test" }),
    })),
  } as unknown as BaseLanguageModel;
}

/**
 * Build a mock LLM that throws on invoke.
 */
function createFailingLLM(): BaseLanguageModel {
  return {
    invoke: vi.fn(async () => {
      throw new Error("LLM unavailable");
    }),
  } as unknown as BaseLanguageModel;
}

// =============================================================================
// ComplexityAnalyzer
// =============================================================================

describe("ComplexityAnalyzer", () => {
  const analyzer = new ComplexityAnalyzer();

  it("should classify simple prompts as 'simple'", () => {
    const signals = analyzer.analyze("Say hello.");
    expect(signals.complexity).toBe("simple");
    expect(signals.wordCount).toBeLessThan(50);
  });

  it("should classify complex prompts as 'complex'", () => {
    const longPrompt = Array.from({ length: 40 }, (_, i) =>
      `Step ${i + 1}: create and build and test and deploy and design and analyze and verify and refactor the component.`
    ).join(" ");
    const signals = analyzer.analyze(longPrompt);
    expect(signals.complexity).toBe("complex");
    expect(signals.wordCount).toBeGreaterThan(150);
  });

  it("should classify ambiguous prompts as 'ambiguous'", () => {
    const ambiguous =
      "Maybe we could possibly do this if the conditions are right, " +
      "unless something changes, perhaps we should consider whether to " +
      "create or build or test or deploy it somehow, probably.";
    const signals = analyzer.analyze(ambiguous);
    expect(signals.complexity).toBe("ambiguous");
    expect(signals.hedgingCount).toBeGreaterThanOrEqual(3);
  });

  it("should detect technical references", () => {
    const signals = analyzer.analyze("Check /src/components/App.tsx and fix the `render` function.");
    expect(signals.hasTechnicalReferences).toBe(true);
  });

  it("should not detect technical references in plain text", () => {
    const signals = analyzer.analyze("Write a summary of the project.");
    expect(signals.hasTechnicalReferences).toBe(false);
  });

  it("should detect nested structure", () => {
    const signals = analyzer.analyze(
      "First, investigate the codebase. Then, build the module. Finally, test everything."
    );
    expect(signals.hasNestedStructure).toBe(true);
  });

  it("should detect nested structure from bullet lists", () => {
    const signals = analyzer.analyze("Tasks:\n- Create module\n- Test module\n- Deploy");
    expect(signals.hasNestedStructure).toBe(true);
  });

  it("should count action verbs", () => {
    const signals = analyzer.analyze("Create the component, test it, and deploy.");
    expect(signals.actionVerbCount).toBeGreaterThanOrEqual(3);
  });

  it("should measure directional spread", () => {
    // Touches east (create/build), south (research), west (test), north (deploy)
    const signals = analyzer.analyze(
      "Create a vision for the project. Research the dependencies. Test the results. Deploy the code."
    );
    expect(signals.directionalSpread).toBeGreaterThanOrEqual(3);
  });
});

// =============================================================================
// KeywordStrategy
// =============================================================================

describe("KeywordStrategy", () => {
  const strategy = new KeywordStrategy();

  it("should always report canHandle = true", () => {
    expect(strategy.canHandle({})).toBe(true);
    expect(strategy.canHandle({ llm: createMockLLM() })).toBe(true);
  });

  it("should have id 'keyword'", () => {
    expect(strategy.id).toBe("keyword");
  });

  it("should produce a valid StrategyResult", async () => {
    const result = await strategy.decompose("Build a new API endpoint.", {});
    expect(result.strategyId).toBe("keyword");
    expect(result.directionalAnalysis).toBeDefined();
    expect(result.intents).toBeDefined();
    expect(result.intents.primary).toBeDefined();
    expect(result.decomposition).toBeDefined();
    expect(result.wheelEnriched).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.diagnostics)).toBe(true);
  });

  it("should compute per-direction confidence", async () => {
    const result = await strategy.decompose(
      "Create a vision. Research the data. Validate assumptions. Execute the plan.",
      {}
    );
    expect(result.directionConfidence).toBeDefined();
    for (const dir of ["east", "south", "west", "north"]) {
      expect(typeof result.directionConfidence[dir as Direction]).toBe("number");
    }
  });

  it("should handle empty prompts without crashing", async () => {
    const result = await strategy.decompose("", {});
    expect(result.strategyId).toBe("keyword");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it("should handle minimal prompts", async () => {
    const result = await strategy.decompose("Hello", {});
    expect(result.strategyId).toBe("keyword");
    expect(result.decomposition).toBeDefined();
  });

  it("should estimate latency proportional to word count", () => {
    const signals: ComplexitySignals = {
      wordCount: 100,
      clauseCount: 5,
      conditionalCount: 0,
      hedgingCount: 0,
      actionVerbCount: 2,
      directionalSpread: 2,
      hasTechnicalReferences: false,
      hasNestedStructure: false,
      complexity: "moderate",
    };
    const latency = strategy.estimateLatency(signals);
    expect(latency).toBeGreaterThan(0);
    expect(latency).toBeLessThan(100); // keyword should be fast
  });
});

// =============================================================================
// SemanticStrategy
// =============================================================================

describe("SemanticStrategy", () => {
  const strategy = new SemanticStrategy();

  it("should report canHandle = false without LLM", () => {
    expect(strategy.canHandle({})).toBe(false);
  });

  it("should report canHandle = true with LLM", () => {
    expect(strategy.canHandle({ llm: createMockLLM() })).toBe(true);
  });

  it("should have id 'semantic'", () => {
    expect(strategy.id).toBe("semantic");
  });

  it("should throw when decomposing without LLM", async () => {
    await expect(strategy.decompose("Test prompt", {})).rejects.toThrow(
      "SemanticStrategy requires an LLM"
    );
  });

  it("should produce a valid StrategyResult with mock LLM", async () => {
    const mockLLM = createMockLLM();
    const result = await strategy.decompose("Build a new feature.", { llm: mockLLM });

    expect(result.strategyId).toBe("semantic");
    expect(result.directionalAnalysis).toBeDefined();
    expect(result.intents).toBeDefined();
    expect(result.intents.primary).toBeDefined();
    expect(result.decomposition).toBeDefined();
    expect(result.wheelEnriched).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.diagnostics.some((d) => d.includes("LLM-enhanced"))).toBe(true);
  });

  it("should fall back on LLM failure", async () => {
    const failingLLM = createFailingLLM();
    const result = await strategy.decompose("Build something.", { llm: failingLLM });

    expect(result.strategyId).toBe("semantic");
    // The IntentExtractor catches the LLM failure internally and falls back to heuristics,
    // so SemanticStrategy still reports success. Either way, we get a valid result.
    expect(result.decomposition).toBeDefined();
    expect(result.intents.primary).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("should estimate higher latency than keyword", () => {
    const signals: ComplexitySignals = {
      wordCount: 50,
      clauseCount: 3,
      conditionalCount: 0,
      hedgingCount: 0,
      actionVerbCount: 2,
      directionalSpread: 2,
      hasTechnicalReferences: false,
      hasNestedStructure: false,
      complexity: "moderate",
    };
    const semanticLatency = strategy.estimateLatency(signals);
    const keywordLatency = new KeywordStrategy().estimateLatency(signals);
    expect(semanticLatency).toBeGreaterThan(keywordLatency);
  });
});

// =============================================================================
// HybridStrategy
// =============================================================================

describe("HybridStrategy", () => {
  const strategy = new HybridStrategy();

  it("should require LLM", () => {
    expect(strategy.canHandle({})).toBe(false);
    expect(strategy.canHandle({ llm: createMockLLM() })).toBe(true);
  });

  it("should have id 'hybrid'", () => {
    expect(strategy.id).toBe("hybrid");
  });

  it("should merge directional analyses correctly", async () => {
    const mockLLM = createMockLLM();
    const result = await strategy.decompose(
      "Create a vision for the project. Research the dependencies. Test the results. Deploy the code.",
      { llm: mockLLM }
    );

    expect(result.strategyId).toBe("hybrid");
    expect(result.directionalAnalysis).toBeDefined();
    expect(result.directionalAnalysis.directions).toBeDefined();
    // The merged analysis should have directions
    for (const dir of ["east", "south", "west", "north"]) {
      expect(Array.isArray(result.directionalAnalysis.directions[dir as Direction])).toBe(true);
    }
  });

  it("should merge intents without duplicates", async () => {
    const mockLLM = createMockLLM({
      secondary: [
        { id: "sec-1", action: "investigate", target: "requirements", implicit: false, dependency: null, confidence: 0.8 },
      ],
    });
    const result = await strategy.decompose("Investigate the requirements.", { llm: mockLLM });

    // No duplicate intents with the same action and similar target
    const actions = result.intents.secondary.map((s) => `${s.action}:${s.target}`);
    const unique = new Set(actions);
    expect(unique.size).toBe(actions.length);
  });

  it("should include agreement bonus in diagnostics", async () => {
    const mockLLM = createMockLLM();
    const result = await strategy.decompose("Build a new module.", { llm: mockLLM });

    expect(result.diagnostics.some((d) => d.includes("Agreement bonus"))).toBe(true);
    expect(result.diagnostics.some((d) => d.includes("Keyword confidence"))).toBe(true);
    expect(result.diagnostics.some((d) => d.includes("Semantic confidence"))).toBe(true);
  });

  it("should produce confidence between 0 and 1", async () => {
    const mockLLM = createMockLLM();
    const result = await strategy.decompose("Create and deploy the feature.", { llm: mockLLM });
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should accept custom weights", async () => {
    const customStrategy = new HybridStrategy({ keywordWeight: 0.5, semanticWeight: 0.5 });
    const mockLLM = createMockLLM();
    const result = await customStrategy.decompose("Build a thing.", { llm: mockLLM });
    expect(result.strategyId).toBe("hybrid");
    expect(result.confidence).toBeGreaterThan(0);
  });
});

// =============================================================================
// StrategySelector
// =============================================================================

describe("StrategySelector", () => {
  it("should select keyword for simple prompts without LLM", () => {
    const selector = new StrategySelector();
    const { strategy } = selector.select("Create a file.", {});
    expect(strategy.id).toBe("keyword");
  });

  it("should still select keyword for complex prompts without LLM (only feasible option)", () => {
    const selector = new StrategySelector();
    const longPrompt = Array.from({ length: 40 }, (_, i) =>
      `Step ${i}: create and build and test and deploy and refactor the system.`
    ).join(" ");
    const { strategy } = selector.select(longPrompt, {});
    // Without LLM, keyword is the only feasible strategy
    expect(strategy.id).toBe("keyword");
  });

  it("should select semantic or hybrid for complex prompts with LLM", () => {
    const selector = new StrategySelector();
    const longPrompt = Array.from({ length: 40 }, (_, i) =>
      `Step ${i}: create and build and test and deploy and refactor the system.`
    ).join(" ");
    const { strategy } = selector.select(longPrompt, { llm: createMockLLM() });
    expect(["semantic", "hybrid"]).toContain(strategy.id);
  });

  it("should respect forceStrategy preference", () => {
    const selector = new StrategySelector();
    const { strategy } = selector.select("Simple prompt.", { llm: createMockLLM() }, {
      forceStrategy: "keyword",
    });
    expect(strategy.id).toBe("keyword");
  });

  it("should respect excludeStrategies", () => {
    const selector = new StrategySelector();
    const longPrompt = Array.from({ length: 40 }, (_, i) =>
      `Step ${i}: create and build and test and deploy and refactor the system.`
    ).join(" ");
    const { strategy } = selector.select(
      longPrompt,
      { llm: createMockLLM() },
      { excludeStrategies: ["hybrid", "semantic"] }
    );
    expect(strategy.id).toBe("keyword");
  });

  it("should respect maxLatencyMs constraint", () => {
    const selector = new StrategySelector();
    // With a very low latency budget, semantic/hybrid should be excluded
    const { strategy } = selector.select(
      "Build something complex with many steps.",
      { llm: createMockLLM(), maxLatencyMs: 10 }
    );
    expect(strategy.id).toBe("keyword");
  });

  it("should return all registered strategies", () => {
    const selector = new StrategySelector();
    const strategies = selector.getStrategies();
    expect(strategies.length).toBe(3);
    const ids = strategies.map((s) => s.id);
    expect(ids).toContain("keyword");
    expect(ids).toContain("semantic");
    expect(ids).toContain("hybrid");
  });

  it("should allow registering custom strategies", () => {
    const selector = new StrategySelector();
    const custom: any = {
      id: "custom",
      name: "Custom Strategy",
      canHandle: () => true,
      estimateLatency: () => 10,
      decompose: async () => ({}),
    };
    selector.register(custom);
    expect(selector.getStrategies().some((s) => s.id === "custom")).toBe(true);
  });

  it("should include reason in selection result", () => {
    const selector = new StrategySelector();
    const { reason } = selector.select("Create a file.", {});
    expect(typeof reason).toBe("string");
    expect(reason.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// MultiPassDecomposer
// =============================================================================

describe("MultiPassDecomposer", () => {
  it("should run multiple strategies in parallel mode", async () => {
    const multiPass = new MultiPassDecomposer();
    const result = await multiPass.decomposeParallel(
      "Build a new API. Test it. Deploy to production.",
      { llm: createMockLLM() }
    );

    expect(result.best).toBeDefined();
    expect(result.allResults.length).toBeGreaterThanOrEqual(1);
    expect(result.signals).toBeDefined();
    expect(result.totalExecutionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("should run cascading mode and stop when confidence met", async () => {
    const multiPass = new MultiPassDecomposer({ minConfidence: 0.01 });
    const result = await multiPass.decomposeCascading(
      "Create a simple file.",
      {}
    );

    // Should stop early since keyword usually meets low threshold
    expect(result.best).toBeDefined();
    expect(result.allResults.length).toBeGreaterThanOrEqual(1);
  });

  it("should run cascading mode with multiple passes if confidence not met", async () => {
    const multiPass = new MultiPassDecomposer({ minConfidence: 0.99 });
    const result = await multiPass.decomposeCascading(
      "Build and test the application.",
      { llm: createMockLLM() }
    );

    // With very high threshold, should try multiple strategies
    expect(result.allResults.length).toBeGreaterThanOrEqual(1);
    expect(result.best).toBeDefined();
  });

  it("should detect disagreements between strategies", async () => {
    // In parallel mode with multiple strategies, there may be disagreements
    const multiPass = new MultiPassDecomposer();
    const result = await multiPass.decomposeParallel(
      "Build and deploy the system. Test everything.",
      { llm: createMockLLM() }
    );

    // disagreements is always an array, even if empty
    expect(Array.isArray(result.disagreements)).toBe(true);
  });

  it("should handle strategy failures gracefully in parallel mode", async () => {
    // Create a selector with a strategy that always fails
    const failingStrategy: any = {
      id: "failing",
      name: "Failing Strategy",
      canHandle: () => true,
      estimateLatency: () => 1,
      decompose: async () => {
        throw new Error("Strategy exploded");
      },
    };
    const selector = new StrategySelector([new KeywordStrategy(), failingStrategy]);
    const multiPass = new MultiPassDecomposer({ selector });

    const result = await multiPass.decomposeParallel("Build something.", {});

    // Should still have a best result from keyword
    expect(result.best).toBeDefined();
    expect(result.best.strategyId).toBe("keyword");
    // Failing strategy should be recorded
    expect(result.failures.length).toBeGreaterThanOrEqual(1);
    expect(result.failures.some((f) => f.strategyId === "failing")).toBe(true);
  });

  it("should handle strategy failures gracefully in cascading mode", async () => {
    const failingStrategy: any = {
      id: "always-fail",
      name: "Always Fail",
      canHandle: () => true,
      estimateLatency: () => 1,
      decompose: async () => {
        throw new Error("boom");
      },
    };
    // Put failing strategy first so StrategySelector picks it first (highest score)
    const selector = new StrategySelector([failingStrategy, new KeywordStrategy()]);
    const multiPass = new MultiPassDecomposer({ selector, minConfidence: 0.99 });

    // Use high minConfidence so cascading tries multiple strategies
    const result = await multiPass.decomposeCascading("Build a file.", {});

    expect(result.best).toBeDefined();
    // The failing strategy should be recorded as a failure, and keyword should succeed
    expect(result.allResults.length).toBeGreaterThanOrEqual(1);
    expect(result.allResults.some((r) => r.strategyId === "keyword")).toBe(true);
  });

  it("should return signals in the result", async () => {
    const multiPass = new MultiPassDecomposer();
    const result = await multiPass.decomposeParallel("Create something.", {});
    expect(result.signals).toBeDefined();
    expect(result.signals.complexity).toBeDefined();
    expect(result.signals.wordCount).toBeDefined();
  });
});

// =============================================================================
// ConfidenceCalibrator
// =============================================================================

describe("ConfidenceCalibrator", () => {
  const calibrator = new ConfidenceCalibrator();

  function makeResult(overrides: Partial<StrategyResult>): StrategyResult {
    return {
      strategyId: "keyword",
      directionalAnalysis: {
        id: "test",
        timestamp: new Date().toISOString(),
        prompt: "test",
        directions: { east: [], south: [], west: [], north: [] },
        leadDirection: Direction.EAST,
        neglectedDirections: [],
        balance: 0.5,
      },
      intents: {
        primary: { action: "create", target: "test", urgency: Urgency.SESSION, confidence: 0.7 },
        secondary: [],
        context: { filesNeeded: [], toolsRequired: [], assumptions: [] },
        prompt: "test",
      },
      decomposition: {
        id: "test",
        timestamp: new Date().toISOString(),
        prompt: "test",
        actions: [],
        executionOrder: [],
        ambiguities: [],
        expectedOutputs: { files: [], behaviors: [], artifacts: [] },
        confidence: 0.7,
      },
      wheelEnriched: {
        quadrants: {} as any,
        balance: 0.5,
        ceremonyRequired: false,
        balanceAdvice: "",
        timestamp: new Date().toISOString(),
      },
      confidence: 0.7,
      directionConfidence: {
        [Direction.EAST]: 0.6,
        [Direction.SOUTH]: 0.5,
        [Direction.WEST]: 0.4,
        [Direction.NORTH]: 0.7,
      },
      executionTimeMs: 5,
      diagnostics: [],
      ...overrides,
    };
  }

  function makeSignals(overrides: Partial<ComplexitySignals> = {}): ComplexitySignals {
    return {
      wordCount: 20,
      clauseCount: 2,
      conditionalCount: 0,
      hedgingCount: 0,
      actionVerbCount: 1,
      directionalSpread: 1,
      hasTechnicalReferences: false,
      hasNestedStructure: false,
      complexity: "simple",
      ...overrides,
    };
  }

  it("should apply strategy-specific bias for keyword (no bias)", () => {
    const result = makeResult({ strategyId: "keyword", confidence: 0.7 });
    const signals = makeSignals({ complexity: "moderate" });
    const calibrated = calibrator.calibrate(result, signals);
    // keyword bias = 0.0, moderate complexityAdj = 0, balanceAdj = (0.5-0.5)*0.1 = 0
    expect(calibrated.confidence).toBeCloseTo(0.7, 1);
  });

  it("should apply negative bias for semantic strategy", () => {
    const result = makeResult({ strategyId: "semantic", confidence: 0.7 });
    const signals = makeSignals({ complexity: "moderate" });
    const calibrated = calibrator.calibrate(result, signals);
    // semantic bias = -0.05
    expect(calibrated.confidence).toBeLessThan(0.7);
  });

  it("should apply positive bias for hybrid strategy", () => {
    const result = makeResult({ strategyId: "hybrid", confidence: 0.7 });
    const signals = makeSignals({ complexity: "moderate" });
    const calibrated = calibrator.calibrate(result, signals);
    // hybrid bias = +0.02
    expect(calibrated.confidence).toBeGreaterThan(0.7);
  });

  it("should apply complexity adjustment — simple gets boost", () => {
    const result = makeResult({ confidence: 0.5 });
    const simpleSignals = makeSignals({ complexity: "simple" });
    const complexSignals = makeSignals({ complexity: "complex" });

    const simpleCalibrated = calibrator.calibrate(result, simpleSignals);
    const complexCalibrated = calibrator.calibrate(result, complexSignals);

    expect(simpleCalibrated.confidence).toBeGreaterThan(complexCalibrated.confidence);
  });

  it("should apply balance adjustment — higher balance boosts confidence", () => {
    const highBalance = makeResult({
      confidence: 0.5,
      directionalAnalysis: {
        id: "test",
        timestamp: new Date().toISOString(),
        prompt: "test",
        directions: { east: [], south: [], west: [], north: [] },
        leadDirection: Direction.EAST,
        neglectedDirections: [],
        balance: 0.9,
      },
    });
    const lowBalance = makeResult({
      confidence: 0.5,
      directionalAnalysis: {
        id: "test",
        timestamp: new Date().toISOString(),
        prompt: "test",
        directions: { east: [], south: [], west: [], north: [] },
        leadDirection: Direction.EAST,
        neglectedDirections: [],
        balance: 0.1,
      },
    });
    const signals = makeSignals({ complexity: "moderate" });

    const highCalibrated = calibrator.calibrate(highBalance, signals);
    const lowCalibrated = calibrator.calibrate(lowBalance, signals);

    expect(highCalibrated.confidence).toBeGreaterThan(lowCalibrated.confidence);
  });

  it("should clamp confidence between 0 and 1", () => {
    const highResult = makeResult({ confidence: 0.99, strategyId: "hybrid" });
    const lowResult = makeResult({
      confidence: 0.01,
      strategyId: "semantic",
      directionalAnalysis: {
        id: "test",
        timestamp: new Date().toISOString(),
        prompt: "test",
        directions: { east: [], south: [], west: [], north: [] },
        leadDirection: Direction.EAST,
        neglectedDirections: [],
        balance: 0.1,
      },
    });

    const highCalibrated = calibrator.calibrate(highResult, makeSignals({ complexity: "simple" }));
    const lowCalibrated = calibrator.calibrate(lowResult, makeSignals({ complexity: "ambiguous" }));

    expect(highCalibrated.confidence).toBeLessThanOrEqual(1);
    expect(lowCalibrated.confidence).toBeGreaterThanOrEqual(0);
  });

  it("should apply cross-strategy agreement bonus in calibrateMultiple", () => {
    // Two results that agree on lead direction and primary action
    const r1 = makeResult({
      strategyId: "keyword",
      confidence: 0.6,
      directionalAnalysis: {
        id: "t1",
        timestamp: new Date().toISOString(),
        prompt: "test",
        directions: { east: [], south: [], west: [], north: [] },
        leadDirection: Direction.EAST,
        neglectedDirections: [],
        balance: 0.5,
      },
      intents: {
        primary: { action: "create", target: "test", urgency: Urgency.SESSION, confidence: 0.7 },
        secondary: [],
        context: { filesNeeded: [], toolsRequired: [], assumptions: [] },
        prompt: "test",
      },
    });
    const r2 = makeResult({
      strategyId: "semantic",
      confidence: 0.6,
      directionalAnalysis: {
        id: "t2",
        timestamp: new Date().toISOString(),
        prompt: "test",
        directions: { east: [], south: [], west: [], north: [] },
        leadDirection: Direction.EAST,
        neglectedDirections: [],
        balance: 0.5,
      },
      intents: {
        primary: { action: "create", target: "test", urgency: Urgency.SESSION, confidence: 0.7 },
        secondary: [],
        context: { filesNeeded: [], toolsRequired: [], assumptions: [] },
        prompt: "test",
      },
    });

    const signals = makeSignals({ complexity: "moderate" });
    const calibrated = calibrator.calibrateMultiple([r1, r2], signals);

    // Agreement bonus should be applied
    expect(calibrated.length).toBe(2);
    expect(
      calibrated.some((r) =>
        r.diagnostics.some((d) => d.includes("Cross-strategy agreement"))
      )
    ).toBe(true);
  });

  it("should add calibration diagnostics", () => {
    const result = makeResult({});
    const signals = makeSignals();
    const calibrated = calibrator.calibrate(result, signals);
    expect(calibrated.diagnostics.some((d) => d.includes("Calibrated:"))).toBe(true);
  });
});

// =============================================================================
// StrategicDecomposer
// =============================================================================

describe("StrategicDecomposer", () => {
  it("should work without LLM (backward compatible)", async () => {
    const decomposer = new StrategicDecomposer();
    const result = await decomposer.decompose("Create a new file.");

    expect(result.result).toBeDefined();
    expect(result.result.strategyId).toBe("keyword");
    expect(result.result.decomposition).toBeDefined();
    expect(result.selectionReason).toBeDefined();
    expect(result.signals).toBeDefined();
  });

  it("should auto-select strategy based on complexity", async () => {
    const decomposer = new StrategicDecomposer({
      resources: { llm: createMockLLM() },
    });
    const result = await decomposer.decompose("Build something.");

    expect(result.result).toBeDefined();
    expect(result.selectionReason).toBeDefined();
    expect(result.signals).toBeDefined();
  });

  it("should use multi-pass for ambiguous prompts with LLM", async () => {
    const decomposer = new StrategicDecomposer({
      resources: { llm: createMockLLM() },
    });

    const ambiguous =
      "Maybe we could possibly do this if the conditions are right, " +
      "unless something changes, perhaps we should consider whether to " +
      "create or build or test or deploy it somehow, probably.";
    const result = await decomposer.decompose(ambiguous);

    // Ambiguous + LLM → multi-pass should be triggered
    expect(result.multiPass).toBeDefined();
    expect(result.multiPass!.allResults.length).toBeGreaterThanOrEqual(1);
  });

  it("should use multi-pass when alwaysMultiPass is set", async () => {
    const decomposer = new StrategicDecomposer({
      resources: { llm: createMockLLM() },
      preferences: { alwaysMultiPass: true },
    });

    const result = await decomposer.decompose("Create a simple file.");
    expect(result.multiPass).toBeDefined();
  });

  it("should not use multi-pass for simple prompts without preference", async () => {
    const decomposer = new StrategicDecomposer();
    const result = await decomposer.decompose("Create a file.");
    expect(result.multiPass).toBeUndefined();
  });

  it("should respect forced strategy", async () => {
    const decomposer = new StrategicDecomposer({
      resources: { llm: createMockLLM() },
      preferences: { forceStrategy: "keyword" },
    });
    const result = await decomposer.decompose(
      "Build a complex multi-step workflow with many stages."
    );
    expect(result.result.strategyId).toBe("keyword");
  });

  it("should return calibrated confidence", async () => {
    const decomposer = new StrategicDecomposer();
    const result = await decomposer.decompose("Create a file.");
    expect(result.result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.result.confidence).toBeLessThanOrEqual(1);
    // Should have calibration diagnostics
    expect(
      result.result.diagnostics.some((d) => d.includes("Calibrated:"))
    ).toBe(true);
  });
});
