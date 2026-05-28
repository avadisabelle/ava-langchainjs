/**
 * ava-langchain-prompt-decomposition
 *
 * Prompt Decomposition Engine (PDE) primitives for the Narrative Intelligence Stack.
 * Decomposes complex prompts through the Four Directions (Medicine Wheel):
 *
 * - EAST (Waabinong/Vision): What is being asked?
 * - SOUTH (Zhaawanong/Analysis): What needs to be learned?
 * - WEST (Epangishmok/Validation): What needs reflection?
 * - NORTH (Kiiwedinong/Action): What executes?
 *
 * Core Components:
 * - DirectionalDecomposer: Classifies prompt segments by direction
 * - IntentExtractor: Extracts primary + secondary intents with confidence
 * - DependencyMapper: Maps task dependencies and execution order
 * - ActionStackBuilder: Produces the final ordered execution plan
 * - MedicineWheelBridge: Maps directions to quadrants from relational-intelligence
 *
 * @example
 * ```typescript
 * import {
 *   DirectionalDecomposer,
 *   IntentExtractor,
 *   DependencyMapper,
 *   ActionStackBuilder,
 *   MedicineWheelBridge,
 * } from "ava-langchain-prompt-decomposition";
 *
 * const decomposer = new DirectionalDecomposer();
 * const extractor = new IntentExtractor();
 * const mapper = new DependencyMapper();
 * const builder = new ActionStackBuilder();
 * const bridge = new MedicineWheelBridge();
 *
 * // Decompose a complex prompt
 * const directions = decomposer.decompose("Build a knowledge graph...");
 * const intents = extractor.extract("Build a knowledge graph...");
 * const graph = mapper.buildGraph(intents.secondary);
 * const order = mapper.computeExecutionOrder(graph);
 * const result = builder.build(directions, intents, order);
 *
 * // Check relational balance
 * const enriched = bridge.enrich(directions);
 * if (enriched.ceremonyRequired) {
 *   console.log("Pause: ceremony needed before proceeding");
 * }
 *
 * // Output as JSON or Markdown
 * console.log(builder.toJSON(result));
 * console.log(builder.toMarkdown(result));
 * ```
 */

export const VERSION = "0.1.0";

// =============================================================================
// Directional Decomposer
// =============================================================================

export {
  Direction,
  ALL_DIRECTIONS,
  DIRECTION_NAMES,
  DIRECTION_QUESTIONS,
  DIRECTION_KEYWORDS,
  DirectionalInsight,
  DirectionalAnalysis,
  DecomposerOptions,
  DirectionalDecomposer,
} from "./directional_decomposer.js";

// =============================================================================
// Intent Extractor
// =============================================================================

export {
  Urgency,
  PrimaryIntent,
  SecondaryIntent,
  IntentExtractionResult,
  ExtractionContext,
  ExtractorOptions,
  IntentExtractor,
} from "./intent_extractor.js";

// =============================================================================
// Dependency Mapper
// =============================================================================

export {
  DependencyNode,
  DependencyGraph,
  ExecutionOrder,
  DependencyMapper,
} from "./dependency_mapper.js";

// =============================================================================
// Action Stack
// =============================================================================

export {
  ActionItem,
  AmbiguityFlag,
  ExpectedOutputs,
  DecompositionResult,
  ActionStackOptions,
  ActionStackBuilder,
} from "./action_stack.js";

// =============================================================================
// Medicine Wheel Bridge
// =============================================================================

export {
  WheelQuadrant,
  DIRECTION_TO_QUADRANT,
  QUADRANT_TO_DIRECTION,
  WheelEnrichedAnalysis,
  WheelBridgeOptions,
  MedicineWheelBridge,
} from "./wheel_bridge.js";

// =============================================================================
// V0 Ontology Bridge
// =============================================================================

export {
  OntologyCoreConcept,
  ONTOLOGY_CORE_MAP,
  NarrativeBeatMapping,
  actionToNarrativeBeat,
  RelationalQueryNode,
  PACKAGE_MAPPING,
} from "./v0_ontology_bridge.js";

// =============================================================================
// Storage (.pde/ persistence — mcp-pde lineage)
// =============================================================================

export {
  StoredDecomposition,
  PdeStorageLayout,
  SaveDecompositionOptions,
  DecompositionMarkdownOptions,
  saveDecomposition,
  saveDecompositionTree,
  loadDecomposition,
  listDecompositions,
  decompositionToMarkdown,
} from "./storage.js";

export {
  PDE_DIR,
  PDE_META_FILENAME,
  PDE_METADATA_SCHEMA_VERSION,
  CHILD_KINDS,
  ChildKind,
  PdeSessionIdSource,
  PdeRuntimeEngine,
  ChildEntry,
  EngineFallbackAttempt,
  PdeFallbackMetadata,
  PdeTreeMetadata,
  PdeResolvedContext,
  normalizeAddDirs,
  mergeAddDirs,
  ensureDirectory,
  getPdeRoot,
  extractPdeUuidFromFolderName,
  extractPdeUuidFromPath,
  resolvePdeFolderPath,
  findPdeFolder,
  readPdeTreeMetadata,
  writePdeTreeMetadata,
  resolvePdeContext,
  resolvePdeContextByPath,
  buildPdeTreeMetadata,
  appendChildEntry,
  updatePdeTreeMetadata,
} from "./pde_metadata.js";

// =============================================================================
// LangChain Runnable Wrappers (Chain Composability)
// =============================================================================

export {
  RunnableDecomposer,
  RunnableDirectionalAnalyzer,
  RunnableWheelGate,
  ChainDecomposer,
  RunnableDecomposerOptions,
  RunnableDecomposerResult,
} from "./runnable.js";

// =============================================================================
// Agent Harness Adapter (for ava-code, mia-code, etc.)
// =============================================================================

export {
  AgentPDE,
  AgentPDEOptions,
  AgentDecompositionResult,
  ExecutionProgress,
} from "./agent_harness.js";

// =============================================================================
// Execution Planner
// =============================================================================

export {
  ExecutionStage,
  Checkpoint,
  FallbackStrategy,
  ExecutionPlan,
  ExecutionPlannerOptions,
  ExecutionPlanner,
} from "./execution_planner.js";

// =============================================================================
// Convenience: Full Pipeline
// =============================================================================

import { DirectionalDecomposer, type DecomposerOptions } from "./directional_decomposer.js";
import { IntentExtractor, type ExtractorOptions } from "./intent_extractor.js";
import { DependencyMapper } from "./dependency_mapper.js";
import { ActionStackBuilder, type ActionStackOptions, type DecompositionResult } from "./action_stack.js";
import { MedicineWheelBridge, type WheelBridgeOptions, type WheelEnrichedAnalysis } from "./wheel_bridge.js";

export interface PipelineOptions {
  decomposer?: DecomposerOptions;
  extractor?: ExtractorOptions;
  actionStack?: ActionStackOptions;
  wheelBridge?: WheelBridgeOptions;
}

export interface PipelineResult {
  decomposition: DecompositionResult;
  wheelEnriched: WheelEnrichedAnalysis;
  json: string;
  markdown: string;
}

/**
 * Run the full PDE pipeline on a prompt.
 * Decomposes → Extracts → Maps → Builds → Enriches
 */
export async function decompose(prompt: string, options?: PipelineOptions): Promise<PipelineResult> {
  const decomposer = new DirectionalDecomposer(options?.decomposer);
  const extractor = new IntentExtractor(options?.extractor);
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
  };
}
