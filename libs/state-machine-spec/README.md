# State Machine Spec for LangGraph

Declarative state machine specifications with formal validation, relational accountability, and Mermaid visualization. A framework-agnostic specification layer that LangGraph (or any executor) can consume.

## Overview

LangGraph models workflows as graphs of action nodes. This package adds **states as first-class entities** — named conditions that represent where the system IS, not what it DOES. A JSON specification serves as the single source of truth for workflow logic.

- **Spec Types** — TypeScript interfaces for states, transitions, and metadata
- **Parser** — JSON parsing with snake_case/camelCase conversion (Python/TypeScript interop)
- **Validator** — Formal verification: reachability, deadlock detection, terminal state consistency
- **Visualizer** — Mermaid state diagrams, flowcharts, text summaries, adjacency matrices
- **Relational Accountability** — Maps who holds responsibility at each state, detects accountability gaps

## Installation

```bash
npm install ava-langchain-state-machine-spec
```

## Quick Start

### Define a Spec

```typescript
import {
  createStateMachineSpec,
  createStateSpec,
  createTransitionSpec,
} from "ava-langchain-state-machine-spec";

const spec = createStateMachineSpec(
  "pr_review",
  "Pull Request Review Workflow",
  "initialized",
  {
    finalStates: ["merged", "closed"],
    states: [
      createStateSpec("initialized", "PR created and ready for review", {
        allowedTransitions: ["to_under_review"],
      }),
      createStateSpec("under_review", "Being reviewed by maintainers", {
        entryConditions: ["At least one reviewer assigned"],
        allowedTransitions: ["to_approved", "to_changes_requested"],
      }),
      createStateSpec("approved", "Approved by required reviewers", {
        allowedTransitions: ["to_merged"],
      }),
      createStateSpec("merged", "Merged into target branch", {
        isTerminal: true,
      }),
      createStateSpec("closed", "Closed without merging", {
        isTerminal: true,
      }),
    ],
    transitions: [
      createTransitionSpec("to_under_review", "initialized", "under_review", {
        triggerEvents: ["reviewer_assigned"],
        preconditions: ["PR is not draft"],
      }),
      createTransitionSpec("to_approved", "under_review", "approved", {
        preconditions: ["All required reviewers approved"],
      }),
      createTransitionSpec("to_merged", "approved", "merged", {
        preconditions: ["CI passes", "No merge conflicts"],
        actions: ["merge_pr", "notify_team"],
      }),
    ],
    metadata: {
      version: "1.0.0",
      author: "ava",
      langgraphCompatible: true,
      relationalContext: {
        entities: ["author", "reviewer", "maintainer"],
        responsibilities: "Author creates PR. Reviewer evaluates. Maintainer merges.",
        stateResponsibilities: {
          initialized: ["author"],
          under_review: ["reviewer"],
          approved: ["maintainer"],
        },
      },
    },
  }
);
```

### Validate

```typescript
import { validateSpec, canAllStatesTerminate } from "ava-langchain-state-machine-spec";

const result = validateSpec(spec);
console.log(result.valid); // true
console.log(result.properties.reachableStates);
console.log(result.properties.deadlockedStates);

const { canTerminate, stuckStates } = canAllStatesTerminate(spec);
```

### Visualize

```typescript
import {
  generateMermaid,
  generateTextSummary,
} from "ava-langchain-state-machine-spec";

// Mermaid state diagram
const diagram = generateMermaid(spec, {
  showConditions: true,
  showActions: true,
});

// Plain text summary
const summary = generateTextSummary(spec);
```

### Parse from JSON (Python interop)

```typescript
import { parseSpec, serializeSpecSnakeCase } from "ava-langchain-state-machine-spec";

// Parse snake_case JSON from Python
const spec = parseSpec(jsonString);

// Serialize back to snake_case for Python consumption
const snakeCaseJson = serializeSpecSnakeCase(spec);
```

### Relational Accountability

```typescript
import {
  inferAccountabilityFromSpec,
  findAccountabilityGaps,
  generateAccountabilityNarrative,
} from "ava-langchain-state-machine-spec";

// Build accountability map from spec's relational context
const map = inferAccountabilityFromSpec(spec);

// Find states where no entity holds responsibility
const gaps = findAccountabilityGaps(map);

// Generate human-readable narrative of who is responsible where
const narrative = generateAccountabilityNarrative(spec, map);
```

## Validation Checks

The validator performs formal verification:

| Check | Severity | Description |
|-------|----------|-------------|
| `MISSING_NAME` | ERROR | Spec must have a name |
| `MISSING_INITIAL_STATE` | ERROR | Must define an initial state |
| `INITIAL_STATE_NOT_FOUND` | ERROR | Initial state must exist in states list |
| `FINAL_STATE_NOT_FOUND` | ERROR | Final states must exist in states list |
| `DUPLICATE_STATE` | ERROR | State names must be unique |
| `DUPLICATE_TRANSITION` | ERROR | Transition names must be unique |
| `TRANSITION_FROM_UNKNOWN_STATE` | ERROR | Transition references valid from-state |
| `TRANSITION_TO_UNKNOWN_STATE` | ERROR | Transition references valid to-state |
| `TRANSITION_FROM_TERMINAL` | ERROR | Terminal states cannot have outgoing transitions |
| `TERMINAL_HAS_OUTGOING` | ERROR | Terminal states should have no outgoing transitions |
| `UNREACHABLE_STATE` | ERROR | All states reachable from initial |
| `DEADLOCKED_STATE` | ERROR | Non-terminal states must have outgoing transitions |
| `NO_FINAL_STATES` | WARNING | Workflows should eventually terminate |
| `FINAL_STATE_NOT_TERMINAL` | WARNING | Final states should be marked isTerminal |
| `TERMINAL_NOT_IN_FINAL` | WARNING | Terminal states should be in finalStates list |

## Spec Format

The JSON specification format:

```json
{
  "name": "workflow_name",
  "description": "What this workflow models",
  "initial_state": "starting_state",
  "final_states": ["end_state_a", "end_state_b"],
  "states": [
    {
      "name": "state_name",
      "description": "What this condition represents",
      "entry_conditions": ["condition that must hold to enter"],
      "exit_conditions": ["condition that must hold to leave"],
      "allowed_transitions": ["transition_name"],
      "is_terminal": false
    }
  ],
  "transitions": [
    {
      "name": "transition_name",
      "from_state": "source_state",
      "to_state": "target_state",
      "trigger_events": ["event_name"],
      "preconditions": ["must be true to fire"],
      "actions": ["execute_during_transition"],
      "postconditions": ["must be true after"]
    }
  ],
  "metadata": {
    "version": "1.0.0",
    "author": "ava",
    "langgraph_compatible": true,
    "relational_context": {
      "entities": ["author", "reviewer"],
      "responsibilities": "Who does what",
      "state_responsibilities": {
        "state_name": ["responsible_entity"]
      }
    }
  }
}
```

Both `snake_case` and `camelCase` field names are accepted by the parser.

## Integration with Relational Intelligence

This package optionally integrates with `ava-langchain-relational-intelligence` for Medicine Wheel assessment, value gating, and Fire Keeper coordination of state machine workflows.

## Complete Workflow Example

The `accountability-routing` example shows a FireKeeper coordinating a LangGraph-style state machine — every state transition is gated through relational accountability checks before the graph advances.

```typescript
// See examples/src/accountability-routing/agent_session_router.ts
import { parseStateMachineSpec, validateStateMachineSpec } from "ava-langchain-state-machine-spec";
import { FireKeeper } from "ava-langchain-relational-intelligence";
import spec from "./accountability_spec.json" assert { type: "json" };

// 1. Load and validate the spec
const machine = parseStateMachineSpec(spec);
const validation = validateStateMachineSpec(machine);
if (!validation.valid) throw new Error(validation.errors.join(", "));

// 2. FireKeeper gates every prompt before the graph advances
const keeper = new FireKeeper("Build with relational care.");
const review = keeper.processPrompt("Retrieve papers from knowledge graph");
if (!review.accepted) throw new Error(`Blocked: ${review.feedback}`);

// 3. Advance the state machine
const next = machine.states[machine.initialState].allowedTransitions[0];
console.log(`State: ${machine.initialState} → ${next}`);
```

See [`examples/src/accountability-routing/`](../../examples/src/accountability-routing/) for the full runnable example.

## License

MIT
