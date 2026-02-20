/**
 * State Machine Spec Validator
 *
 * Validates state machine specifications for structural correctness.
 * Implements formal verification checks:
 * - Reachability: all states reachable from initial
 * - Deadlock detection: non-terminal states have outgoing transitions
 * - Terminal verification: terminal states have no outgoing transitions
 * - Consistency: transitions reference valid states
 * - Completeness: initial state and final states exist
 */

import {
  StateMachineSpec,
  getTransitionsFrom,
} from "./spec_types.js";

/**
 * Severity of a validation issue.
 */
export enum ValidationSeverity {
  ERROR = "error",
  WARNING = "warning",
  INFO = "info",
}

/**
 * A single validation issue found in the spec.
 */
export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  /** The entity (state or transition name) this issue relates to. */
  entity?: string;
}

/**
 * The result of validating a spec.
 */
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  /** Structural properties discovered during validation. */
  properties: {
    stateCount: number;
    transitionCount: number;
    terminalStateCount: number;
    reachableStates: string[];
    unreachableStates: string[];
    deadlockedStates: string[];
  };
}

/**
 * Validate a state machine specification.
 * Returns a ValidationResult with all issues found.
 */
export function validateSpec(spec: StateMachineSpec): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Run all checks
  checkBasicStructure(spec, issues);
  checkStateConsistency(spec, issues);
  checkTransitionConsistency(spec, issues);
  checkTerminalStates(spec, issues);

  const reachable = computeReachability(spec);
  const allStateNames = new Set(spec.states.map((s) => s.name));
  const unreachable = [...allStateNames].filter(
    (s) => !reachable.has(s)
  );
  const deadlocked = findDeadlockedStates(spec);

  checkReachability(unreachable, issues);
  checkDeadlocks(deadlocked, issues);

  const hasErrors = issues.some(
    (i) => i.severity === ValidationSeverity.ERROR
  );

  return {
    valid: !hasErrors,
    issues,
    properties: {
      stateCount: spec.states.length,
      transitionCount: spec.transitions.length,
      terminalStateCount: spec.states.filter((s) => s.isTerminal).length,
      reachableStates: [...reachable],
      unreachableStates: unreachable,
      deadlockedStates: deadlocked,
    },
  };
}

// =============================================================================
// Basic Structure Checks
// =============================================================================

function checkBasicStructure(
  spec: StateMachineSpec,
  issues: ValidationIssue[]
): void {
  if (!spec.name) {
    issues.push({
      severity: ValidationSeverity.ERROR,
      code: "MISSING_NAME",
      message: "State machine spec must have a name.",
    });
  }

  if (!spec.initialState) {
    issues.push({
      severity: ValidationSeverity.ERROR,
      code: "MISSING_INITIAL_STATE",
      message: "State machine spec must define an initial state.",
    });
  }

  if (spec.states.length === 0) {
    issues.push({
      severity: ValidationSeverity.ERROR,
      code: "NO_STATES",
      message: "State machine spec must have at least one state.",
    });
  }

  if (spec.finalStates.length === 0) {
    issues.push({
      severity: ValidationSeverity.WARNING,
      code: "NO_FINAL_STATES",
      message:
        "State machine has no declared final states. " +
        "Workflows should eventually terminate.",
    });
  }
}

// =============================================================================
// State Consistency Checks
// =============================================================================

function checkStateConsistency(
  spec: StateMachineSpec,
  issues: ValidationIssue[]
): void {
  const stateNames = new Set(spec.states.map((s) => s.name));

  // Initial state must exist
  if (spec.initialState && !stateNames.has(spec.initialState)) {
    issues.push({
      severity: ValidationSeverity.ERROR,
      code: "INITIAL_STATE_NOT_FOUND",
      message: `Initial state "${spec.initialState}" does not exist in states list.`,
      entity: spec.initialState,
    });
  }

  // Final states must exist
  for (const finalState of spec.finalStates) {
    if (!stateNames.has(finalState)) {
      issues.push({
        severity: ValidationSeverity.ERROR,
        code: "FINAL_STATE_NOT_FOUND",
        message: `Final state "${finalState}" does not exist in states list.`,
        entity: finalState,
      });
    }
  }

  // Check for duplicate state names
  const seen = new Set<string>();
  for (const state of spec.states) {
    if (seen.has(state.name)) {
      issues.push({
        severity: ValidationSeverity.ERROR,
        code: "DUPLICATE_STATE",
        message: `Duplicate state name: "${state.name}".`,
        entity: state.name,
      });
    }
    seen.add(state.name);
  }

  // Final states should be marked isTerminal
  for (const state of spec.states) {
    if (
      spec.finalStates.includes(state.name) &&
      !state.isTerminal
    ) {
      issues.push({
        severity: ValidationSeverity.WARNING,
        code: "FINAL_STATE_NOT_TERMINAL",
        message: `State "${state.name}" is listed as final but not marked isTerminal.`,
        entity: state.name,
      });
    }
    if (
      state.isTerminal &&
      !spec.finalStates.includes(state.name)
    ) {
      issues.push({
        severity: ValidationSeverity.WARNING,
        code: "TERMINAL_NOT_IN_FINAL",
        message: `State "${state.name}" is marked isTerminal but not in finalStates list.`,
        entity: state.name,
      });
    }
  }
}

// =============================================================================
// Transition Consistency Checks
// =============================================================================

function checkTransitionConsistency(
  spec: StateMachineSpec,
  issues: ValidationIssue[]
): void {
  const stateNames = new Set(spec.states.map((s) => s.name));

  for (const transition of spec.transitions) {
    // From-state must exist
    if (!stateNames.has(transition.fromState)) {
      issues.push({
        severity: ValidationSeverity.ERROR,
        code: "TRANSITION_FROM_UNKNOWN_STATE",
        message: `Transition "${transition.name}" references unknown from-state "${transition.fromState}".`,
        entity: transition.name,
      });
    }

    // To-state must exist
    if (!stateNames.has(transition.toState)) {
      issues.push({
        severity: ValidationSeverity.ERROR,
        code: "TRANSITION_TO_UNKNOWN_STATE",
        message: `Transition "${transition.name}" references unknown to-state "${transition.toState}".`,
        entity: transition.name,
      });
    }

    // Transition name should be unique
    const dupes = spec.transitions.filter(
      (t) => t.name === transition.name
    );
    if (dupes.length > 1) {
      issues.push({
        severity: ValidationSeverity.ERROR,
        code: "DUPLICATE_TRANSITION",
        message: `Duplicate transition name: "${transition.name}".`,
        entity: transition.name,
      });
    }

    // Transitions from terminal states are suspect
    const fromState = spec.states.find(
      (s) => s.name === transition.fromState
    );
    if (fromState?.isTerminal) {
      issues.push({
        severity: ValidationSeverity.ERROR,
        code: "TRANSITION_FROM_TERMINAL",
        message: `Transition "${transition.name}" departs from terminal state "${transition.fromState}".`,
        entity: transition.name,
      });
    }
  }

  // Check allowed_transitions references
  for (const state of spec.states) {
    for (const transName of state.allowedTransitions) {
      const trans = spec.transitions.find((t) => t.name === transName);
      if (!trans) {
        issues.push({
          severity: ValidationSeverity.WARNING,
          code: "ALLOWED_TRANSITION_NOT_FOUND",
          message: `State "${state.name}" references transition "${transName}" which does not exist.`,
          entity: state.name,
        });
      } else if (trans.fromState !== state.name) {
        issues.push({
          severity: ValidationSeverity.WARNING,
          code: "ALLOWED_TRANSITION_MISMATCH",
          message: `State "${state.name}" lists transition "${transName}" but that transition departs from "${trans.fromState}".`,
          entity: state.name,
        });
      }
    }
  }
}

// =============================================================================
// Terminal State Checks
// =============================================================================

function checkTerminalStates(
  spec: StateMachineSpec,
  issues: ValidationIssue[]
): void {
  for (const state of spec.states) {
    if (state.isTerminal) {
      const outgoing = getTransitionsFrom(spec, state.name);
      if (outgoing.length > 0) {
        issues.push({
          severity: ValidationSeverity.ERROR,
          code: "TERMINAL_HAS_OUTGOING",
          message: `Terminal state "${state.name}" has ${outgoing.length} outgoing transition(s). Terminal states should have none.`,
          entity: state.name,
        });
      }
    }
  }
}

// =============================================================================
// Reachability Analysis
// =============================================================================

/**
 * Compute the set of states reachable from the initial state
 * via BFS through transitions.
 */
export function computeReachability(
  spec: StateMachineSpec
): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [spec.initialState];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);

    const outgoing = getTransitionsFrom(spec, current);
    for (const t of outgoing) {
      if (!reachable.has(t.toState)) {
        queue.push(t.toState);
      }
    }
  }

  return reachable;
}

function checkReachability(
  unreachable: string[],
  issues: ValidationIssue[]
): void {
  for (const stateName of unreachable) {
    issues.push({
      severity: ValidationSeverity.ERROR,
      code: "UNREACHABLE_STATE",
      message: `State "${stateName}" is not reachable from the initial state.`,
      entity: stateName,
    });
  }
}

// =============================================================================
// Deadlock Detection
// =============================================================================

/**
 * Find non-terminal states with no outgoing transitions.
 * These are deadlocked: the system can enter but never leave.
 */
export function findDeadlockedStates(
  spec: StateMachineSpec
): string[] {
  return spec.states
    .filter((s) => !s.isTerminal)
    .filter((s) => getTransitionsFrom(spec, s.name).length === 0)
    .map((s) => s.name);
}

function checkDeadlocks(
  deadlocked: string[],
  issues: ValidationIssue[]
): void {
  for (const stateName of deadlocked) {
    issues.push({
      severity: ValidationSeverity.ERROR,
      code: "DEADLOCKED_STATE",
      message: `Non-terminal state "${stateName}" has no outgoing transitions (deadlock).`,
      entity: stateName,
    });
  }
}

// =============================================================================
// Path Analysis
// =============================================================================

/**
 * Check whether every non-terminal state can reach at least one
 * terminal state. This proves that the workflow always terminates.
 */
export function canAllStatesTerminate(
  spec: StateMachineSpec
): { canTerminate: boolean; stuckStates: string[] } {
  const terminalNames = new Set(
    spec.states.filter((s) => s.isTerminal).map((s) => s.name)
  );

  const stuckStates: string[] = [];

  for (const state of spec.states) {
    if (state.isTerminal) continue;

    // BFS from this state to see if it can reach any terminal
    const visited = new Set<string>();
    const queue = [state.name];
    let reachesTerminal = false;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      if (terminalNames.has(current)) {
        reachesTerminal = true;
        break;
      }

      const outgoing = getTransitionsFrom(spec, current);
      for (const t of outgoing) {
        if (!visited.has(t.toState)) {
          queue.push(t.toState);
        }
      }
    }

    if (!reachesTerminal) {
      stuckStates.push(state.name);
    }
  }

  return {
    canTerminate: stuckStates.length === 0,
    stuckStates,
  };
}
