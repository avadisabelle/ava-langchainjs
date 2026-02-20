/**
 * Relational Accountability for State Machines
 *
 * Each state carries responsibility. The state machine makes visible
 * who is responsible at each stage. When transitions fail (preconditions
 * not met), it becomes clear where accountability broke down.
 *
 * This module integrates the state machine spec with the Medicine Wheel
 * and relational intelligence components to ensure state machines
 * embody relational accountability.
 */

import { v4 as uuidv4 } from "uuid";
import {
  StateMachineSpec,
  StateSpec,
  TransitionSpec,
  getTransitionsFrom,
} from "./spec_types.js";

/**
 * An entity that holds responsibility in the workflow.
 */
export interface AccountableEntity {
  id: string;
  name: string;
  /** Role in the workflow (e.g., "reviewer", "author", "maintainer"). */
  role: string;
  /** States where this entity holds primary responsibility. */
  responsibleStates: string[];
}

/**
 * Responsibility assignment for a single state.
 */
export interface StateResponsibility {
  stateName: string;
  /** Entities holding primary responsibility in this state. */
  primaryHolders: string[];
  /** Entities who wait respectfully during this state. */
  waitingEntities: string[];
  /** What the responsible entities must do. */
  obligation: string;
  /** What happens if responsibility is not met. */
  failureConsequence: string;
}

/**
 * A transition accountability record.
 * When a transition fails, this record identifies where accountability broke.
 */
export interface TransitionAccountability {
  transitionName: string;
  fromState: string;
  toState: string;
  /** Who is accountable for meeting preconditions. */
  preconditionOwners: string[];
  /** Who is accountable for executing actions. */
  actionExecutors: string[];
  /** Who verifies postconditions are met. */
  postconditionVerifiers: string[];
}

/**
 * The complete accountability map for a state machine.
 */
export interface AccountabilityMap {
  id: string;
  specName: string;
  entities: AccountableEntity[];
  stateResponsibilities: StateResponsibility[];
  transitionAccountability: TransitionAccountability[];
  /** Timestamp of generation. */
  timestamp: string;
}

/**
 * Create an AccountabilityMap from a spec and entity definitions.
 */
export function createAccountabilityMap(
  spec: StateMachineSpec,
  entities: AccountableEntity[],
  stateResponsibilities: StateResponsibility[],
  transitionAccountability: TransitionAccountability[]
): AccountabilityMap {
  return {
    id: uuidv4(),
    specName: spec.name,
    entities,
    stateResponsibilities,
    transitionAccountability,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Infer a basic accountability map from the spec's relational context.
 * Uses the metadata.relationalContext to build initial assignments.
 */
export function inferAccountabilityFromSpec(
  spec: StateMachineSpec
): AccountabilityMap {
  const entities: AccountableEntity[] = [];
  const stateResps: StateResponsibility[] = [];
  const transAcct: TransitionAccountability[] = [];

  // Create entities from relational context
  if (spec.metadata.relationalContext) {
    const ctx = spec.metadata.relationalContext;
    for (const entityName of ctx.entities) {
      entities.push({
        id: uuidv4(),
        name: entityName,
        role: entityName,
        responsibleStates: [],
      });
    }

    // If per-state responsibilities exist, use them
    if (ctx.stateResponsibilities) {
      for (const [stateName, holders] of Object.entries(
        ctx.stateResponsibilities
      )) {
        stateResps.push({
          stateName,
          primaryHolders: holders,
          waitingEntities: ctx.entities.filter(
            (e) => !holders.includes(e)
          ),
          obligation: `Responsible during "${stateName}" state`,
          failureConsequence: `Accountability gap in "${stateName}" state`,
        });

        // Update entity responsible states
        for (const holder of holders) {
          const entity = entities.find((e) => e.name === holder);
          if (entity) {
            entity.responsibleStates.push(stateName);
          }
        }
      }
    }
  }

  // Create default state responsibilities for states without explicit ones
  for (const state of spec.states) {
    if (!stateResps.find((r) => r.stateName === state.name)) {
      stateResps.push({
        stateName: state.name,
        primaryHolders: [],
        waitingEntities: [],
        obligation: state.isTerminal
          ? "Hold collective memory of outcome"
          : "Advance workflow toward completion",
        failureConsequence: state.isTerminal
          ? "History is lost"
          : `Workflow stalls in "${state.name}" state`,
      });
    }
  }

  // Create default transition accountability
  for (const transition of spec.transitions) {
    transAcct.push({
      transitionName: transition.name,
      fromState: transition.fromState,
      toState: transition.toState,
      preconditionOwners: stateResps.find(
        (r) => r.stateName === transition.fromState
      )?.primaryHolders ?? [],
      actionExecutors: [],
      postconditionVerifiers: stateResps.find(
        (r) => r.stateName === transition.toState
      )?.primaryHolders ?? [],
    });
  }

  return createAccountabilityMap(spec, entities, stateResps, transAcct);
}

/**
 * Check for accountability gaps in the map.
 * Returns states where no entity holds responsibility.
 */
export function findAccountabilityGaps(
  map: AccountabilityMap
): string[] {
  return map.stateResponsibilities
    .filter((r) => r.primaryHolders.length === 0)
    .map((r) => r.stateName);
}

/**
 * Get who is responsible at a given state.
 */
export function getResponsibleAt(
  map: AccountabilityMap,
  stateName: string
): StateResponsibility | undefined {
  return map.stateResponsibilities.find(
    (r) => r.stateName === stateName
  );
}

/**
 * Get accountability for a transition.
 */
export function getTransitionAccountability(
  map: AccountabilityMap,
  transitionName: string
): TransitionAccountability | undefined {
  return map.transitionAccountability.find(
    (t) => t.transitionName === transitionName
  );
}

/**
 * Generate a human-readable accountability narrative.
 * Walks through the state machine telling the story of who
 * is responsible at each stage.
 */
export function generateAccountabilityNarrative(
  spec: StateMachineSpec,
  map: AccountabilityMap
): string {
  const lines: string[] = [];

  lines.push(`Accountability Narrative: ${spec.name}`);
  lines.push("=".repeat(40));
  lines.push("");

  // Walk from initial state through transitions
  const visited = new Set<string>();
  const queue: string[] = [spec.initialState];

  while (queue.length > 0) {
    const stateName = queue.shift()!;
    if (visited.has(stateName)) continue;
    visited.add(stateName);

    const state = spec.states.find((s) => s.name === stateName);
    const resp = getResponsibleAt(map, stateName);

    if (state) {
      lines.push(`State: ${state.name}`);
      lines.push(`  ${state.description}`);

      if (resp && resp.primaryHolders.length > 0) {
        lines.push(
          `  Responsible: ${resp.primaryHolders.join(", ")}`
        );
        lines.push(`  Obligation: ${resp.obligation}`);
        if (resp.waitingEntities.length > 0) {
          lines.push(
            `  Waiting respectfully: ${resp.waitingEntities.join(", ")}`
          );
        }
      } else {
        lines.push(
          "  [No explicit accountability assigned - gap identified]"
        );
      }

      if (state.isTerminal) {
        lines.push("  This is a resting place. The fire is banked.");
      }

      lines.push("");

      // Show outgoing transitions
      const outgoing = getTransitionsFrom(spec, stateName);
      for (const t of outgoing) {
        lines.push(`  --> ${t.name} --> ${t.toState}`);
        if (t.preconditions.length > 0) {
          lines.push(
            `      Requires: ${t.preconditions.join("; ")}`
          );
        }
        queue.push(t.toState);
      }

      lines.push("");
    }
  }

  // Check for gaps
  const gaps = findAccountabilityGaps(map);
  if (gaps.length > 0) {
    lines.push("Accountability Gaps:");
    for (const gap of gaps) {
      lines.push(
        `  - "${gap}": No entity holds explicit responsibility.`
      );
    }
  }

  return lines.join("\n");
}
