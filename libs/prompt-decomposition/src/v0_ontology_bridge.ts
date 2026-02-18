/**
 * V0 Ontology Bridge
 *
 * Maps PDE (Prompt Decomposition Engine) concepts to the
 * V0 Medicine Wheel Developer Suite ontology vision.
 *
 * V0.md envisions these packages:
 *   @medicine-wheel/ontology-core  → RDF + relational data model
 *   @medicine-wheel/graph-viz      → Force-directed + wheel overlays
 *   @medicine-wheel/narrative-engine → Beat sequencing across directions
 *   @medicine-wheel/relational-query → Context-aware traversal
 *   @medicine-wheel/ui-components  → Direction cards, timelines
 *
 * This bridge shows how PDE primitives and existing ava-langchain
 * packages map to each of those envisioned packages.
 */

import type { Direction } from "./directional_decomposer.js";
import type { WheelQuadrant } from "./wheel_bridge.js";

// =============================================================================
// Ontology Core Mapping
// =============================================================================

/**
 * Maps to @medicine-wheel/ontology-core
 *
 * The PDE DirectionalDecomposer + MedicineWheelBridge provide:
 * - Direction/Act/Ceremony type system (Direction enum, WheelQuadrant)
 * - Temporal beats tracking (ActionItem with dependency ordering)
 * - RDF-compatible triples could be generated from DecompositionResult
 */
export interface OntologyCoreConcept {
  /** Direction in Medicine Wheel */
  direction: Direction;
  /** Corresponding quadrant */
  quadrant: WheelQuadrant;
  /** Anishinaabe name */
  indigenousName: string;
  /** Act in narrative structure */
  act: number;
  /** Season symbolism */
  season: string;
  /** Element */
  element: string;
}

export const ONTOLOGY_CORE_MAP: Record<Direction, OntologyCoreConcept> = {
  east: {
    direction: "east" as Direction,
    quadrant: "spiritual" as WheelQuadrant,
    indigenousName: "Waabinong",
    act: 1,
    season: "spring",
    element: "air",
  },
  south: {
    direction: "south" as Direction,
    quadrant: "mental" as WheelQuadrant,
    indigenousName: "Zhaawanong",
    act: 2,
    season: "summer",
    element: "fire",
  },
  west: {
    direction: "west" as Direction,
    quadrant: "emotional" as WheelQuadrant,
    indigenousName: "Epangishmok",
    act: 3,
    season: "autumn",
    element: "water",
  },
  north: {
    direction: "north" as Direction,
    quadrant: "physical" as WheelQuadrant,
    indigenousName: "Kiiwedinong",
    act: 4,
    season: "winter",
    element: "earth",
  },
};

// =============================================================================
// Narrative Engine Mapping
// =============================================================================

/**
 * Maps to @medicine-wheel/narrative-engine
 *
 * PDE ActionStack items are narrative beats:
 * - Each action = a beat with direction, dependency, confidence
 * - The execution order = beat sequencing across four directions
 * - The DecompositionGraph = ceremonial cadence pattern
 *
 * Existing packages that feed this:
 * - ava-langgraph-narrative-intelligence: ThreeUniverseProcessor, CoherenceEngine
 * - ava-langchain-narrative-tracing: Story beat observability
 */
export interface NarrativeBeatMapping {
  /** PDE action ID */
  actionId: string;
  /** Direction this beat belongs to */
  direction: Direction;
  /** Act number (1-4 based on direction) */
  act: number;
  /** The action text becomes the beat description */
  description: string;
  /** Whether this beat was explicitly stated or inferred */
  implicit: boolean;
  /** Confidence in this beat */
  confidence: number;
}

/**
 * Convert a PDE action to a narrative beat.
 */
export function actionToNarrativeBeat(
  action: { id: string; text: string; direction: Direction; confidence: number; implicit: boolean }
): NarrativeBeatMapping {
  const concept = ONTOLOGY_CORE_MAP[action.direction];
  return {
    actionId: action.id,
    direction: action.direction,
    act: concept?.act ?? 4,
    description: action.text,
    implicit: action.implicit,
    confidence: action.confidence,
  };
}

// =============================================================================
// Relational Query Mapping
// =============================================================================

/**
 * Maps to @medicine-wheel/relational-query
 *
 * PDE's DependencyMapper produces a graph of task dependencies.
 * This maps to relational-query's context-aware relationship traversal:
 * - DependencyNode = graph node with typed relationships
 * - Dependencies = "depends_on" relationships
 * - Direction = relationship context (which quadrant)
 *
 * Existing packages:
 * - ava-langchain-relational-intelligence: ImportanceStore, SpiralTracker
 *   provide the accountability tracking layer
 */
export interface RelationalQueryNode {
  id: string;
  type: "task" | "ceremony" | "vision" | "research";
  direction: Direction;
  relationships: Array<{
    targetId: string;
    type: "depends_on" | "validates" | "informs" | "ceremonies";
    confidence: number;
  }>;
}

// =============================================================================
// Package Mapping Summary
// =============================================================================

/**
 * How existing ava-* packages map to V0's envisioned @medicine-wheel/* suite.
 * This serves as a roadmap for convergence.
 */
export const PACKAGE_MAPPING = {
  "@medicine-wheel/ontology-core": {
    existingPackages: [
      "ava-langchain-prompt-decomposition (Direction, WheelQuadrant types)",
      "ava-langchain-relational-intelligence (MedicineWheelFilter, ImportanceUnit)",
    ],
    providedBy: "Direction enum, WheelBridge, ONTOLOGY_CORE_MAP",
    missing: "RDF triple store, OWL vocabulary, SPARQL queries",
  },
  "@medicine-wheel/graph-viz": {
    existingPackages: [
      "ava-langchain-prompt-decomposition (DependencyGraph visualization)",
    ],
    providedBy: "DependencyMapper produces graph structure",
    missing: "D3 force-directed layout, Medicine Wheel overlay renderer",
  },
  "@medicine-wheel/narrative-engine": {
    existingPackages: [
      "ava-langgraph-narrative-intelligence (ThreeUniverseProcessor, CoherenceEngine)",
      "ava-langchain-narrative-tracing (NarrativeTracingHandler)",
      "ava-langgraph-prompt-decomposition-engine (DecompositionGraph)",
    ],
    providedBy: "ActionStack → beats, DecompositionGraph → ceremonial cadence",
    missing: "Timeline/categorical view React components",
  },
  "@medicine-wheel/relational-query": {
    existingPackages: [
      "ava-langchain-relational-intelligence (ImportanceStore, SpiralTracker, ValueGate)",
      "ava-langchain-prompt-decomposition (DependencyMapper)",
    ],
    providedBy: "DependencyGraph + ImportanceStore",
    missing: "SPARQL-like query builder, OCAP-aware access control",
  },
  "@medicine-wheel/ui-components": {
    existingPackages: [
      "ava-Flowise (PromptDecomposition node, MedicineWheelGate node)",
    ],
    providedBy: "AgentFlow nodes for Flowise",
    missing: "Standalone React components, direction cards, beat timelines",
  },
} as const;
