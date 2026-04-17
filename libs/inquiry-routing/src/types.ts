/**
 * Core types for the Inquiry Routing primitives.
 *
 * Inquiries are structured questions generated from PDE decomposition output,
 * routed to appropriate knowledge channels (QMD local semantic search,
 * deep-search academic, or workspace scanning) and enriched with
 * Wilson's relational ontology markers and Two-Eyed Seeing epistemology.
 *
 * @module types
 */

// =============================================================================
// Enums
// =============================================================================

/** Source channel for inquiry routing */
export enum InquirySource {
  QMD_LOCAL = "qmd-local",
  DEEP_SEARCH_ACADEMIC = "deep-search-academic",
  WORKSPACE_SCAN = "workspace-scan",
}

/** Lifecycle status of an inquiry */
export enum InquiryStatus {
  PENDING = "pending",
  ROUTED = "routed",
  COMPLETED = "completed",
  FAILED = "failed",
}

// =============================================================================
// Core Interfaces
// =============================================================================

/**
 * A structured inquiry generated from PDE decomposition output.
 *
 * Each inquiry carries its directional origin, routing destination,
 * relational context grounded in Wilson's axiology, and optional
 * Two-Eyed Seeing markers for epistemological bridging.
 */
export interface Inquiry {
  id: string;
  timestamp: string;
  direction: "east" | "south" | "west" | "north";
  source: InquirySource;
  query: string;
  response?: string;
  status: InquiryStatus;

  /** Relational grounding (Wilson's axiology) */
  relational_context: string;
  accountability: string;
  ceremonial_intent?: string;

  /** Two-Eyed Seeing markers */
  indigenous_lens?: string;
  western_lens?: string;

  /** Traceability — links back to source PDE decomposition */
  pde_id: string;
  action_index?: number;
  confidence: number;
}

/**
 * A batch of inquiries grouped by Medicine Wheel direction.
 */
export interface InquiryBatch {
  id: string;
  timestamp: string;
  pde_id: string;
  east: Inquiry[];
  south: Inquiry[];
  west: Inquiry[];
  north: Inquiry[];
  total: number;
}

/**
 * Configuration for inquiry routing decisions.
 */
export interface InquiryRoutingConfig {
  /** Keywords that trigger QMD local search routing */
  qmdKeywords?: string[];
  /** Keywords that trigger deep-search academic routing */
  deepSearchKeywords?: string[];
  /** Keywords that trigger workspace scan routing */
  workspaceScanKeywords?: string[];
  /** Default source when no keywords match */
  defaultSource?: InquirySource;
  /** Minimum confidence threshold for routing (0-1) */
  confidenceThreshold?: number;
}

/**
 * Result of routing analysis for a single inquiry.
 */
export interface RoutingDecision {
  inquiry_id: string;
  source: InquirySource;
  confidence: number;
  reasoning: string;
  matched_keywords: string[];
}

/**
 * A batch of inquiries after routing decisions have been applied.
 */
export interface RoutedInquiryBatch extends InquiryBatch {
  decisions: RoutingDecision[];
  routing_timestamp: string;
}

// =============================================================================
// Option Interfaces
// =============================================================================

/**
 * Options for the InquiryGenerator.
 */
export interface InquiryGeneratorOptions {
  /** Include inquiries generated from ambiguity flags (default true) */
  includeAmbiguities?: boolean;
  /** Include inquiries generated from context assumptions (default true) */
  includeAssumptions?: boolean;
  /** Minimum confidence for generated inquiries, 0-1 (default 0.3) */
  minConfidence?: number;
  /** Routing configuration overrides */
  routing?: InquiryRoutingConfig;
}

/**
 * Options for the RelationalEnricher.
 */
export interface RelationalEnricherOptions {
  /** Add Two-Eyed Seeing markers automatically (default true) */
  addTwoEyedSeeing?: boolean;
  /** Add ceremonial intent markers automatically (default true) */
  addCeremonialIntent?: boolean;
}

// =============================================================================
// Formatted Query Types
// =============================================================================

/**
 * Formatted query for QMD semantic search.
 */
export interface QmdQuery {
  mode: "lex" | "vec" | "hyde";
  query: string;
  direction: string;
  context?: string;
}

/**
 * Formatted query for academic deep-search.
 */
export interface DeepSearchQuery {
  query: string;
  academic_context: string;
  direction: string;
  search_terms: string[];
}
