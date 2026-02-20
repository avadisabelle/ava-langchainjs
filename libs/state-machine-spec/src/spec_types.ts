/**
 * State Machine Specification Types
 *
 * TypeScript interfaces for the JSON state machine specification format.
 * These types define WHAT a state machine is, independent of any
 * runtime framework. LangGraph (or any other executor) consumes
 * these specs to build executable graphs.
 *
 * Key distinction from LangGraph's current model:
 * - LangGraph nodes are ACTIONS (functions that transform state)
 * - State machine states are CONDITIONS (named discrete situations)
 * - This spec layer adds states as first-class entities alongside actions
 */

/**
 * A named condition in the state machine.
 * States are places, not actions. A state represents where the
 * system IS, not what it DOES.
 */
export interface StateSpec {
  /** Unique name for this state. */
  name: string;
  /** Human-readable description of this condition. */
  description: string;
  /** Conditions that must be true to enter this state. */
  entryConditions: string[];
  /** Conditions that must be true to leave this state. */
  exitConditions: string[];
  /** Names of transitions that can fire from this state. */
  allowedTransitions: string[];
  /** Whether this is a terminal (final) state. */
  isTerminal: boolean;
}

/**
 * A transition between two states.
 * Transitions carry preconditions, actions, and postconditions.
 */
export interface TransitionSpec {
  /** Unique name for this transition. */
  name: string;
  /** State this transition departs from. */
  fromState: string;
  /** State this transition arrives at. */
  toState: string;
  /** Events that trigger this transition. */
  triggerEvents: string[];
  /** Conditions that must hold for this transition to fire. */
  preconditions: string[];
  /** Actions to execute during this transition. */
  actions: string[];
  /** Conditions that must hold after this transition completes. */
  postconditions: string[];
}

/**
 * Relational context: who holds responsibility at each state,
 * what entities are involved, and how accountability flows.
 */
export interface RelationalContext {
  /** Named entities involved in the workflow. */
  entities: string[];
  /** Description of how responsibility is distributed across states. */
  responsibilities: string;
  /** Optional: per-state responsibility mapping. */
  stateResponsibilities?: Record<string, string[]>;
}

/**
 * Metadata for the state machine specification.
 */
export interface SpecMetadata {
  /** Spec version. */
  version: string;
  /** Author or authoring system. */
  author: string;
  /** Whether this spec is designed for LangGraph compatibility. */
  langgraphCompatible: boolean;
  /** Relational accountability context. */
  relationalContext?: RelationalContext;
  /** Arbitrary additional metadata. */
  [key: string]: unknown;
}

/**
 * The complete state machine specification.
 * This is the JSON document that serves as single source of truth
 * for workflow logic, independent of implementation.
 */
export interface StateMachineSpec {
  /** Name of the state machine. */
  name: string;
  /** Description of what this state machine models. */
  description: string;
  /** Name of the initial state. */
  initialState: string;
  /** Names of all terminal (final) states. */
  finalStates: string[];
  /** All states in the machine. */
  states: StateSpec[];
  /** All transitions between states. */
  transitions: TransitionSpec[];
  /** Metadata. */
  metadata: SpecMetadata;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a StateSpec with defaults.
 */
export function createStateSpec(
  name: string,
  description: string,
  options: Partial<StateSpec> = {}
): StateSpec {
  return {
    name,
    description,
    entryConditions: options.entryConditions ?? [],
    exitConditions: options.exitConditions ?? [],
    allowedTransitions: options.allowedTransitions ?? [],
    isTerminal: options.isTerminal ?? false,
  };
}

/**
 * Create a TransitionSpec with defaults.
 */
export function createTransitionSpec(
  name: string,
  fromState: string,
  toState: string,
  options: Partial<TransitionSpec> = {}
): TransitionSpec {
  return {
    name,
    fromState,
    toState,
    triggerEvents: options.triggerEvents ?? [],
    preconditions: options.preconditions ?? [],
    actions: options.actions ?? [],
    postconditions: options.postconditions ?? [],
  };
}

/**
 * Create a StateMachineSpec with defaults.
 */
export function createStateMachineSpec(
  name: string,
  description: string,
  initialState: string,
  options: Partial<StateMachineSpec> = {}
): StateMachineSpec {
  return {
    name,
    description,
    initialState,
    finalStates: options.finalStates ?? [],
    states: options.states ?? [],
    transitions: options.transitions ?? [],
    metadata: options.metadata ?? {
      version: "1.0.0",
      author: "",
      langgraphCompatible: true,
    },
  };
}

// =============================================================================
// Lookup Helpers
// =============================================================================

/**
 * Get a state by name from a spec.
 */
export function getState(
  spec: StateMachineSpec,
  name: string
): StateSpec | undefined {
  return spec.states.find((s) => s.name === name);
}

/**
 * Get a transition by name from a spec.
 */
export function getTransition(
  spec: StateMachineSpec,
  name: string
): TransitionSpec | undefined {
  return spec.transitions.find((t) => t.name === name);
}

/**
 * Get all transitions from a given state.
 */
export function getTransitionsFrom(
  spec: StateMachineSpec,
  stateName: string
): TransitionSpec[] {
  return spec.transitions.filter((t) => t.fromState === stateName);
}

/**
 * Get all transitions to a given state.
 */
export function getTransitionsTo(
  spec: StateMachineSpec,
  stateName: string
): TransitionSpec[] {
  return spec.transitions.filter((t) => t.toState === stateName);
}

/**
 * Get all non-terminal states.
 */
export function getNonTerminalStates(
  spec: StateMachineSpec
): StateSpec[] {
  return spec.states.filter((s) => !s.isTerminal);
}

/**
 * Get all terminal states.
 */
export function getTerminalStates(
  spec: StateMachineSpec
): StateSpec[] {
  return spec.states.filter((s) => s.isTerminal);
}
