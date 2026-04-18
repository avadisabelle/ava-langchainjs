/**
 * ava-langchain-inquiry-routing
 *
 * Inquiry Routing primitives for the Narrative Intelligence Stack.
 * Transforms PDE decomposition output into structured Inquiries,
 * each routed to the appropriate knowledge channel:
 *
 * - QMD Local: Semantic search against workspace knowledge (lex/vec/hyde)
 * - Deep Search Academic: Research-grade queries for scholarly sources
 * - Workspace Scan: File system exploration and dependency discovery
 *
 * Every inquiry is enriched with Wilson's (2008) relational ontology
 * and Two-Eyed Seeing (Etuaptmumk) epistemological markers, ensuring
 * that questions carry their relational obligations through the system.
 *
 * Medicine Wheel Directionality (canonical mapping):
 * - EAST (Waabinong/Vision): What questions want to be asked?
 * - SOUTH (Zhaawanong/Action): Where does each question find its answer?
 * - WEST (Epangishmok/Synthesis): Does each inquiry honor its relations?
 * - NORTH (Kiiwedinong/Structure): How do we format for execution?
 *
 * NOTE: mcp-pde uses a variant mapping (WEST=Validation, NORTH=Action).
 * This package follows the canonical mapping from medicine-wheel-pi/agents/inquiry-router.md.
 *
 * Core Components:
 * - InquiryGenerator: Extracts inquiries from PDE decomposition output
 * - InquiryRouter: Classifies and routes inquiries to channels
 * - RelationalEnricher: Adds Wilson's relational fields and Two-Eyed Seeing markers
 * - InquiryFormatter: Formats inquiries for QMD, deep-search, markdown, JSON
 *
 * @example
 * ```typescript
 * import {
 *   generateInquiries,
 * } from "ava-langchain-inquiry-routing";
 * import { decompose } from "ava-langchain-prompt-decomposition";
 *
 * // Decompose a prompt, then generate routed inquiries
 * const pde = await decompose("Build a knowledge graph...");
 * const result = generateInquiries(pde.decomposition);
 *
 * console.log(`Generated ${result.batch.total} inquiries`);
 * console.log(result.markdown);
 * ```
 *
 * @example
 * ```typescript
 * import {
 *   InquiryGenerator,
 *   InquiryRouter,
 *   RelationalEnricher,
 *   InquiryFormatter,
 * } from "ava-langchain-inquiry-routing";
 *
 * // Step-by-step pipeline
 * const generator = new InquiryGenerator();
 * const router = new InquiryRouter();
 * const enricher = new RelationalEnricher();
 * const formatter = new InquiryFormatter();
 *
 * const batch = generator.generate(decomposition);
 * const enriched = enricher.enrichBatch(batch);
 * const routed = router.routeAll(enriched);
 * const markdown = formatter.toMarkdown(routed);
 * ```
 */

export const VERSION = "0.1.0";

// =============================================================================
// Types
// =============================================================================

export {
  InquirySource,
  InquiryStatus,
  type Inquiry,
  type InquiryBatch,
  type InquiryRoutingConfig,
  type RoutingDecision,
  type RoutedInquiryBatch,
  type InquiryGeneratorOptions,
  type RelationalEnricherOptions,
  type QmdQuery,
  type DeepSearchQuery,
} from "./types.js";

// =============================================================================
// Inquiry Generator
// =============================================================================

export { InquiryGenerator } from "./inquiry_generator.js";

// =============================================================================
// Inquiry Router
// =============================================================================

export { InquiryRouter } from "./inquiry_router.js";

// =============================================================================
// Relational Enricher
// =============================================================================

export { RelationalEnricher } from "./relational_enricher.js";

// =============================================================================
// Inquiry Formatter
// =============================================================================

export { InquiryFormatter } from "./inquiry_formatter.js";

// =============================================================================
// Convenience: Full Pipeline
// =============================================================================

import type { DecompositionResult } from "ava-langchain-prompt-decomposition";
import { InquiryGenerator } from "./inquiry_generator.js";
import { InquiryRouter } from "./inquiry_router.js";
import { RelationalEnricher } from "./relational_enricher.js";
import { InquiryFormatter } from "./inquiry_formatter.js";
import type {
  InquiryGeneratorOptions,
  RelationalEnricherOptions,
  InquiryRoutingConfig,
  RoutedInquiryBatch,
} from "./types.js";

export interface GenerateInquiriesOptions {
  generator?: InquiryGeneratorOptions;
  enricher?: RelationalEnricherOptions;
  routing?: InquiryRoutingConfig;
}

export interface GenerateInquiriesResult {
  batch: RoutedInquiryBatch;
  markdown: string;
  json: string;
}

/**
 * Run the full inquiry routing pipeline on a PDE decomposition result.
 * Generates → Enriches → Routes → Formats
 *
 * @param decomposition - The PDE decomposition result
 * @param options - Optional configuration for each pipeline stage
 * @returns Routed inquiry batch with markdown and JSON representations
 */
export function generateInquiries(
  decomposition: DecompositionResult,
  options?: GenerateInquiriesOptions,
): GenerateInquiriesResult {
  const generator = new InquiryGenerator(options?.generator);
  const enricher = new RelationalEnricher(options?.enricher);
  const router = new InquiryRouter(options?.routing);
  const formatter = new InquiryFormatter();

  const batch = generator.generate(decomposition);
  const enriched = enricher.enrichBatch(batch);
  const routed = router.routeAll(enriched);

  return {
    batch: routed,
    markdown: formatter.toMarkdown(routed),
    json: formatter.toJSON(routed),
  };
}
