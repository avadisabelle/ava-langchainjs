/**
 * ava-langchain-relational-intelligence
 *
 * Relational Intelligence components for the Narrative Intelligence Stack.
 * Grounded in Indigenous relational paradigms: Medicine Wheel ontology,
 * Research Is Ceremony gating, epistemic iteration tracking, and
 * Fire Keeper coordination.
 *
 * These components are designed to be consumed by ava-langgraphjs
 * (the LangGraph Narrative Intelligence Toolkit) and integrated
 * with ava-langchain-narrative-tracing for observability.
 *
 * Core Components:
 * - MedicineWheelFilter: Ontological filter using four quadrants
 *   (Physical, Emotional, Mental, Spiritual)
 * - ImportanceUnit & ImportanceStore: Relational importance with
 *   accountability scoring and Relational Strings (Land/Dream/Code/Vision)
 * - SpiralTracker: Epistemic iteration that recognizes circling as
 *   ceremony, not redundancy
 * - ValueGate: Research Is Ceremony and relational check-back gating
 * - FireKeeper: Coordinating agent protocol for vision alignment
 * - LiminalBuffer: High-context buffer for dream-state inputs
 *
 * @example
 * ```typescript
 * import {
 *   FireKeeper,
 *   MedicineWheelFilter,
 *   ValueGate,
 *   LiminalBuffer,
 *   SpiralTracker,
 * } from "ava-langchain-relational-intelligence";
 *
 * // Create the Fire Keeper (coordinating agent)
 * const keeper = new FireKeeper("Build a relational intelligence system...");
 *
 * // Assess an input through the Medicine Wheel
 * const wheel = keeper.getWheelFilter();
 * const assessment = wheel.assess("input_1", "Design the ontology schema");
 *
 * // Capture liminal insight
 * const buffer = new LiminalBuffer();
 * buffer.capture("The graph should breathe...", LiminalMode.HYPNAGOGIC, "session_1");
 *
 * // Track epistemic iteration
 * const tracker = keeper.getSpiralTracker();
 * tracker.recordCircle("ontology", "Ontology Design", "First thoughts...", "session_1");
 * tracker.recordCircle("ontology", "Ontology Design", "Deeper: use wheel...", "session_2");
 *
 * // Gate an action through value constraints
 * const verdict = keeper.gateAction({
 *   action: "Deploy ontology to production",
 *   actionDescription: "Pushes schema live",
 *   agentId: "agent_1",
 *   sessionId: "session_1",
 *   metadata: { researchIsCeremonyGathered: true },
 * });
 * ```
 */

export const VERSION = "0.1.0";

// =============================================================================
// Medicine Wheel Ontological Filter
// =============================================================================

export {
  MedicineWheelQuadrant,
  ALL_QUADRANTS,
  QuadrantPresence,
  createQuadrantPresence,
  WheelAssessment,
  QUADRANT_KEYWORDS,
  MedicineWheelFilterOptions,
  MedicineWheelFilter,
} from "./medicine_wheel.js";

// =============================================================================
// Importance Unit Schema
// =============================================================================

export {
  RelationalSource,
  ALL_SOURCES,
  RelationalString,
  createRelationalString,
  ImportanceContext,
  CONTEXT_WEIGHTS,
  ImportanceUnit,
  createImportanceUnit,
  deepenUnit,
  decayAccountability,
  connectToSource,
  calculateRelationalCompleteness,
  hasValueConflict,
  ImportanceStore,
} from "./importance_unit.js";

// =============================================================================
// Epistemic Iteration Tracker
// =============================================================================

export {
  EpistemicCircle,
  createEpistemicCircle,
  Spiral,
  createSpiral,
  SpiralShiftAnalysis,
  SpiralShiftType,
  SpiralTracker,
} from "./epistemic_iteration.js";

// =============================================================================
// Value Gate
// =============================================================================

export {
  ValueConstraint,
  ConstraintSeverity,
  GateContext,
  GateResult,
  GateVerdict,
  createResearchIsCeremonyConstraint,
  createRelationalCheckBackConstraint,
  createMedicineWheelBalanceConstraint,
  createImplicitOverExplicitConstraint,
  ValueGate,
} from "./value_gate.js";

// =============================================================================
// Fire Keeper Coordinating Agent Protocol
// =============================================================================

export {
  AgentReport,
  createAgentReport,
  RelationalMilestone,
  EngagementMode,
  HumanEngagementRequest,
  FireKeeperState,
  FireKeeper,
} from "./fire_keeper.js";

// =============================================================================
// Liminal Data Buffer
// =============================================================================

export {
  LiminalMode,
  LIMINAL_MODE_WEIGHTS,
  LiminalInput,
  createLiminalInput,
  LiminalBuffer,
} from "./liminal_buffer.js";

// =============================================================================
// Prompt Decomposition Re-exports (consumed by FireKeeper)
// =============================================================================

export {
  Direction,
  DirectionalAnalysis,
  DirectionalInsight,
  DirectionalDecomposer,
  IntentExtractor,
  IntentExtractionResult,
  SecondaryIntent,
  PrimaryIntent,
  Urgency,
} from "../../prompt-decomposition/src/index.js";
