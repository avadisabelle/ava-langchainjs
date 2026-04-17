/**
 * State Machine Spec Parser
 *
 * Parses JSON state machine specifications into typed objects.
 * Handles both camelCase (TypeScript) and snake_case (Python/JSON) formats.
 */

import {
  StateMachineSpec,
  StateSpec,
  TransitionSpec,
  SpecMetadata,
  RelationalContext,
} from "./spec_types.js";

/**
 * Parse a JSON string into a StateMachineSpec.
 * Handles snake_case to camelCase conversion for Python compatibility.
 */
export function parseSpec(json: string): StateMachineSpec {
  const raw = JSON.parse(json);
  return normalizeSpec(raw);
}

/**
 * Normalize a raw object (from JSON) into a typed StateMachineSpec.
 * Handles both camelCase and snake_case field names.
 */
export function normalizeSpec(raw: Record<string, unknown>): StateMachineSpec {
  return {
    name: raw.name as string,
    description: raw.description as string,
    initialState: (raw.initial_state ?? raw.initialState) as string,
    finalStates: (raw.final_states ?? raw.finalStates ?? []) as string[],
    states: normalizeStates(raw.states as Record<string, unknown>[]),
    transitions: normalizeTransitions(
      raw.transitions as Record<string, unknown>[]
    ),
    metadata: normalizeMetadata(
      (raw.metadata ?? {}) as Record<string, unknown>
    ),
  };
}

/**
 * Normalize an array of raw state objects.
 */
function normalizeStates(
  rawStates: Record<string, unknown>[]
): StateSpec[] {
  if (!rawStates) return [];

  return rawStates.map((s) => ({
    name: s.name as string,
    description: s.description as string,
    entryConditions: (s.entry_conditions ?? s.entryConditions ?? []) as string[],
    exitConditions: (s.exit_conditions ?? s.exitConditions ?? []) as string[],
    allowedTransitions: (s.allowed_transitions ??
      s.allowedTransitions ??
      []) as string[],
    isTerminal: (s.is_terminal ?? s.isTerminal ?? false) as boolean,
  }));
}

/**
 * Normalize an array of raw transition objects.
 */
function normalizeTransitions(
  rawTransitions: Record<string, unknown>[]
): TransitionSpec[] {
  if (!rawTransitions) return [];

  return rawTransitions.map((t) => ({
    name: t.name as string,
    fromState: (t.from_state ?? t.fromState) as string,
    toState: (t.to_state ?? t.toState) as string,
    triggerEvents: (t.trigger_events ?? t.triggerEvents ?? []) as string[],
    preconditions: (t.preconditions ?? []) as string[],
    actions: (t.actions ?? []) as string[],
    postconditions: (t.postconditions ?? []) as string[],
  }));
}

/**
 * Normalize metadata.
 */
function normalizeMetadata(
  raw: Record<string, unknown>
): SpecMetadata {
  const relCtx = (raw.relational_context ?? raw.relationalContext) as
    | Record<string, unknown>
    | undefined;

  const metadata: SpecMetadata = {
    version: (raw.version as string) ?? "1.0.0",
    author: (raw.author as string) ?? "",
    langgraphCompatible: (raw.langgraph_compatible ??
      raw.langgraphCompatible ??
      true) as boolean,
  };

  if (relCtx) {
    metadata.relationalContext = normalizeRelationalContext(relCtx);
  }

  // Preserve any extra fields
  for (const [key, value] of Object.entries(raw)) {
    if (
      ![
        "version",
        "author",
        "langgraph_compatible",
        "langgraphCompatible",
        "relational_context",
        "relationalContext",
      ].includes(key)
    ) {
      metadata[key] = value;
    }
  }

  return metadata;
}

/**
 * Normalize relational context.
 */
function normalizeRelationalContext(
  raw: Record<string, unknown>
): RelationalContext {
  return {
    entities: (raw.entities ?? []) as string[],
    responsibilities: (raw.responsibilities ?? "") as string,
    stateResponsibilities: (raw.state_responsibilities ??
      raw.stateResponsibilities) as
      | Record<string, string[]>
      | undefined,
  };
}

/**
 * Serialize a StateMachineSpec to JSON.
 * Outputs camelCase by default.
 */
export function serializeSpec(spec: StateMachineSpec): string {
  return JSON.stringify(spec, null, 2);
}

/**
 * Serialize a StateMachineSpec to snake_case JSON (Python-compatible).
 */
export function serializeSpecSnakeCase(spec: StateMachineSpec): string {
  const snaked = {
    name: spec.name,
    description: spec.description,
    initial_state: spec.initialState,
    final_states: spec.finalStates,
    states: spec.states.map((s) => ({
      name: s.name,
      description: s.description,
      entry_conditions: s.entryConditions,
      exit_conditions: s.exitConditions,
      allowed_transitions: s.allowedTransitions,
      is_terminal: s.isTerminal,
    })),
    transitions: spec.transitions.map((t) => ({
      name: t.name,
      from_state: t.fromState,
      to_state: t.toState,
      trigger_events: t.triggerEvents,
      preconditions: t.preconditions,
      actions: t.actions,
      postconditions: t.postconditions,
    })),
    metadata: {
      version: spec.metadata.version,
      author: spec.metadata.author,
      langgraph_compatible: spec.metadata.langgraphCompatible,
      ...(spec.metadata.relationalContext
        ? {
            relational_context: {
              entities: spec.metadata.relationalContext.entities,
              responsibilities:
                spec.metadata.relationalContext.responsibilities,
              ...(spec.metadata.relationalContext.stateResponsibilities
                ? {
                    state_responsibilities:
                      spec.metadata.relationalContext.stateResponsibilities,
                  }
                : {}),
            },
          }
        : {}),
    },
  };

  return JSON.stringify(snaked, null, 2);
}
