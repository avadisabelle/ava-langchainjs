/**
 * ava-langchain-state-machine-spec
 *
 * State Machine Specification layer for LangGraph.
 * Declarative workflow specs with formal validation,
 * relational accountability, and Mermaid visualization.
 */

// Core types
export {
  StateSpec,
  TransitionSpec,
  RelationalContext,
  SpecMetadata,
  StateMachineSpec,
  createStateSpec,
  createTransitionSpec,
  createStateMachineSpec,
  getState,
  getTransition,
  getTransitionsFrom,
  getTransitionsTo,
  getNonTerminalStates,
  getTerminalStates,
} from "./spec_types.js";

// Parser / serializer
export {
  parseSpec,
  normalizeSpec,
  serializeSpec,
  serializeSpecSnakeCase,
} from "./spec_parser.js";

// Validator
export {
  ValidationSeverity,
  ValidationIssue,
  ValidationResult,
  validateSpec,
  computeReachability,
  findDeadlockedStates,
  canAllStatesTerminate,
} from "./spec_validator.js";

// Visualizer
export {
  MermaidOptions,
  FlowchartOptions,
  generateMermaid,
  generateMermaidFlowchart,
  generateTextSummary,
  generateAdjacencyMatrix,
} from "./spec_visualizer.js";

// Relational accountability
export {
  AccountableEntity,
  StateResponsibility,
  TransitionAccountability,
  AccountabilityMap,
  createAccountabilityMap,
  inferAccountabilityFromSpec,
  findAccountabilityGaps,
  getResponsibleAt,
  getTransitionAccountability,
  generateAccountabilityNarrative,
} from "./relational_accountability.js";
