/**
 * LangChain Runnable wrappers for the Prompt Decomposition Engine.
 *
 * Makes PDE components composable in LangChain chains via .pipe():
 *
 * @example
 * ```typescript
 * import { RunnableDecomposer } from "ava-langchain-prompt-decomposition";
 * import { ChatOpenAI } from "@langchain/openai";
 *
 * const decomposer = new RunnableDecomposer();
 *
 * // Use standalone
 * const result = await decomposer.invoke("Build a knowledge graph...");
 *
 * // Chain with other runnables
 * const chain = decomposer.pipe(somePostProcessor);
 * const result = await chain.invoke("Build a knowledge graph...");
 *
 * // Batch processing
 * const results = await decomposer.batch(["prompt1", "prompt2"]);
 *
 * // With LLM-enhanced extraction
 * const llmDecomposer = new RunnableDecomposer({ llm: new ChatOpenAI() });
 * ```
 */

import { RunnableLambda } from "@langchain/core/runnables";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import { DirectionalDecomposer, type DecomposerOptions } from "./directional_decomposer.js";
import { IntentExtractor, type ExtractorOptions } from "./intent_extractor.js";
import { DependencyMapper } from "./dependency_mapper.js";
import {
  ActionStackBuilder,
  type ActionStackOptions,
  type DecompositionResult,
} from "./action_stack.js";
import {
  MedicineWheelBridge,
  type WheelBridgeOptions,
  type WheelEnrichedAnalysis,
} from "./wheel_bridge.js";

// =============================================================================
// Types
// =============================================================================

export interface RunnableDecomposerOptions {
  decomposer?: DecomposerOptions;
  extractor?: ExtractorOptions;
  actionStack?: ActionStackOptions;
  wheelBridge?: WheelBridgeOptions;
  /** Optional LLM for enhanced intent extraction */
  llm?: BaseLanguageModel;
  /** Output format: full result object, JSON string, or markdown string */
  outputFormat?: "full" | "json" | "markdown";
}

export interface RunnableDecomposerResult {
  decomposition: DecompositionResult;
  wheelEnriched: WheelEnrichedAnalysis;
  json: string;
  markdown: string;
  /** Quick-access: is ceremony required before proceeding? */
  ceremonyRequired: boolean;
  /** Quick-access: what's the overall balance? */
  balance: number;
  /** Quick-access: primary action */
  primaryAction: string;
  /** Quick-access: number of actions in the stack */
  actionCount: number;
}

// =============================================================================
// RunnableDecomposer
// =============================================================================

/**
 * A LangChain Runnable that runs the full PDE pipeline.
 * Accepts a string prompt and returns a structured decomposition.
 *
 * Chainable with .pipe(), .batch(), .stream(), etc.
 */
export class RunnableDecomposer extends RunnableLambda<string, RunnableDecomposerResult> {
  static lc_name() {
    return "RunnableDecomposer";
  }

  constructor(options?: RunnableDecomposerOptions) {
    const extractorOpts: ExtractorOptions = {
      ...options?.extractor,
      ...(options?.llm ? { llm: options.llm } : {}),
    };

    super({
      func: async (prompt: string, _config?: RunnableConfig): Promise<RunnableDecomposerResult> => {
        const decomposer = new DirectionalDecomposer(options?.decomposer);
        const extractor = new IntentExtractor(extractorOpts);
        const mapper = new DependencyMapper();
        const builder = new ActionStackBuilder(options?.actionStack);
        const bridge = new MedicineWheelBridge(options?.wheelBridge);

        const directionalAnalysis = decomposer.decompose(prompt);
        const intentResult = await extractor.extract(prompt);
        const graph = mapper.buildGraph(intentResult.secondary);
        const order = mapper.computeExecutionOrder(graph);
        const decomposition = builder.build(directionalAnalysis, intentResult, order);
        const wheelEnriched = bridge.enrich(directionalAnalysis);

        return {
          decomposition,
          wheelEnriched,
          json: builder.toJSON(decomposition),
          markdown: builder.toMarkdown(decomposition),
          ceremonyRequired: wheelEnriched.ceremonyRequired,
          balance: decomposition.balance,
          primaryAction: decomposition.primary.action,
          actionCount: decomposition.actionStack.length,
        };
      },
    });
  }
}

/**
 * A Runnable that only runs directional analysis (EAST direction).
 * Lightweight — no dependency mapping or action stack building.
 */
export class RunnableDirectionalAnalyzer extends RunnableLambda<string, import("./directional_decomposer.js").DirectionalAnalysis> {
  static lc_name() {
    return "RunnableDirectionalAnalyzer";
  }

  constructor(options?: DecomposerOptions) {
    super({
      func: async (prompt: string) => {
        const decomposer = new DirectionalDecomposer(options);
        return decomposer.decompose(prompt);
      },
    });
  }
}

/**
 * A Runnable that checks if a prompt passes the Medicine Wheel gate.
 * Returns enriched analysis with ceremony requirement flags.
 */
export class RunnableWheelGate extends RunnableLambda<string, WheelEnrichedAnalysis & { guidance: string[] }> {
  static lc_name() {
    return "RunnableWheelGate";
  }

  constructor(options?: { decomposer?: DecomposerOptions; bridge?: WheelBridgeOptions }) {
    super({
      func: async (prompt: string) => {
        const decomposer = new DirectionalDecomposer(options?.decomposer);
        const bridge = new MedicineWheelBridge(options?.bridge);
        const analysis = decomposer.decompose(prompt);
        const enriched = bridge.enrich(analysis);
        const guidance = bridge.getRelationalGuidance(analysis);
        return { ...enriched, guidance };
      },
    });
  }
}
