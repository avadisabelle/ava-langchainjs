/**
 * State Machine Spec Visualizer
 *
 * Generates Mermaid diagrams and other visual representations
 * from state machine specifications.
 */

import {
  StateMachineSpec,
  StateSpec,
  TransitionSpec,
  getTransitionsFrom,
} from "./spec_types.js";

/**
 * Generate a Mermaid state diagram from a spec.
 *
 * @example
 * ```typescript
 * const mermaid = generateMermaid(spec);
 * console.log(mermaid);
 * // stateDiagram-v2
 * //   [*] --> initialized
 * //   initialized --> under_review: to_under_review
 * //   under_review --> changes_requested: to_changes_requested
 * //   ...
 * //   merged --> [*]
 * ```
 */
export function generateMermaid(
  spec: StateMachineSpec,
  options: MermaidOptions = {}
): string {
  const lines: string[] = [];
  const showConditions = options.showConditions ?? false;
  const showActions = options.showActions ?? false;
  const showNotes = options.showNotes ?? true;

  lines.push("stateDiagram-v2");

  // Initial state transition
  lines.push(`  [*] --> ${escapeName(spec.initialState)}`);

  // State descriptions as notes
  if (showNotes) {
    for (const state of spec.states) {
      if (state.description) {
        lines.push(
          `  note right of ${escapeName(state.name)}: ${truncate(state.description, 60)}`
        );
      }
    }
  }

  // Transitions
  for (const transition of spec.transitions) {
    let label = transition.name;

    if (showConditions && transition.preconditions.length > 0) {
      label += `\\n[${transition.preconditions[0]}]`;
    }

    if (showActions && transition.actions.length > 0) {
      label += `\\n/ ${transition.actions[0]}`;
    }

    lines.push(
      `  ${escapeName(transition.fromState)} --> ${escapeName(transition.toState)}: ${label}`
    );
  }

  // Terminal states to end
  for (const state of spec.states) {
    if (state.isTerminal) {
      lines.push(`  ${escapeName(state.name)} --> [*]`);
    }
  }

  return lines.join("\n");
}

export interface MermaidOptions {
  /** Show preconditions on transition labels. */
  showConditions?: boolean;
  /** Show actions on transition labels. */
  showActions?: boolean;
  /** Show state description notes. */
  showNotes?: boolean;
}

/**
 * Generate a Mermaid flowchart (more detailed than state diagram).
 * Includes action nodes between state nodes.
 */
export function generateMermaidFlowchart(
  spec: StateMachineSpec,
  options: FlowchartOptions = {}
): string {
  const lines: string[] = [];
  const direction = options.direction ?? "TD";

  lines.push(`flowchart ${direction}`);

  // State nodes (rounded boxes)
  for (const state of spec.states) {
    const shape = state.isTerminal
      ? `([${state.name}])`
      : `(${state.name})`;
    lines.push(`  ${escapeName(state.name)}${shape}`);
  }

  // Transitions as edges
  for (const transition of spec.transitions) {
    const label = transition.name;
    lines.push(
      `  ${escapeName(transition.fromState)} -->|${label}| ${escapeName(transition.toState)}`
    );
  }

  // Style terminal states
  const terminalNames = spec.states
    .filter((s) => s.isTerminal)
    .map((s) => escapeName(s.name));
  if (terminalNames.length > 0) {
    lines.push(
      `  style ${terminalNames.join(",")} fill:#d4edda,stroke:#28a745`
    );
  }

  // Style initial state
  lines.push(
    `  style ${escapeName(spec.initialState)} fill:#cce5ff,stroke:#004085`
  );

  return lines.join("\n");
}

export interface FlowchartOptions {
  /** Flowchart direction: TD (top-down), LR (left-right), etc. */
  direction?: "TD" | "LR" | "BT" | "RL";
}

/**
 * Generate a plain-text summary of the state machine.
 */
export function generateTextSummary(spec: StateMachineSpec): string {
  const lines: string[] = [];

  lines.push(`State Machine: ${spec.name}`);
  lines.push(`Description: ${spec.description}`);
  lines.push(`Initial State: ${spec.initialState}`);
  lines.push(`Final States: ${spec.finalStates.join(", ")}`);
  lines.push("");

  lines.push(`States (${spec.states.length}):`);
  for (const state of spec.states) {
    const terminal = state.isTerminal ? " [TERMINAL]" : "";
    lines.push(`  - ${state.name}${terminal}: ${state.description}`);
    if (state.entryConditions.length > 0) {
      lines.push(
        `    Entry: ${state.entryConditions.join("; ")}`
      );
    }
    if (state.exitConditions.length > 0) {
      lines.push(
        `    Exit: ${state.exitConditions.join("; ")}`
      );
    }
  }
  lines.push("");

  lines.push(`Transitions (${spec.transitions.length}):`);
  for (const t of spec.transitions) {
    lines.push(`  - ${t.name}: ${t.fromState} --> ${t.toState}`);
    if (t.triggerEvents.length > 0) {
      lines.push(`    Triggers: ${t.triggerEvents.join(", ")}`);
    }
    if (t.preconditions.length > 0) {
      lines.push(`    Pre: ${t.preconditions.join("; ")}`);
    }
    if (t.actions.length > 0) {
      lines.push(`    Actions: ${t.actions.join(", ")}`);
    }
    if (t.postconditions.length > 0) {
      lines.push(`    Post: ${t.postconditions.join("; ")}`);
    }
  }

  if (spec.metadata.relationalContext) {
    lines.push("");
    lines.push("Relational Accountability:");
    lines.push(
      `  Entities: ${spec.metadata.relationalContext.entities.join(", ")}`
    );
    lines.push(
      `  Responsibilities: ${spec.metadata.relationalContext.responsibilities}`
    );
  }

  return lines.join("\n");
}

/**
 * Generate an adjacency matrix representation.
 * Useful for formal analysis.
 */
export function generateAdjacencyMatrix(
  spec: StateMachineSpec
): { states: string[]; matrix: boolean[][] } {
  const states = spec.states.map((s) => s.name);
  const stateIndex = new Map(states.map((s, i) => [s, i]));
  const n = states.length;

  const matrix: boolean[][] = Array.from({ length: n }, () =>
    Array(n).fill(false)
  );

  for (const t of spec.transitions) {
    const from = stateIndex.get(t.fromState);
    const to = stateIndex.get(t.toState);
    if (from !== undefined && to !== undefined) {
      matrix[from][to] = true;
    }
  }

  return { states, matrix };
}

// =============================================================================
// Helpers
// =============================================================================

function escapeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}
