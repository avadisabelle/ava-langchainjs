# State Machine Spec: Declarative Workflow Specification for LangGraph

**Specification Type:** Library Specification
**Document ID:** `rispecs/state-machine-spec/state-machine-spec.spec.md`
**Framework:** RISE (Reverse-engineer → Intent-extract → Specify → Export)
**Package:** `ava-langchain-state-machine-spec`
**Version:** 0.1.1

---

## Desired Outcome Definition

### What Users Want to Create

The **ava-langchain-state-machine-spec** package enables developers to create **declarative workflow specifications** that serve as the single source of truth for graph-based systems through:

1. **Declarative State Machine Type System** — States are first-class conditions (places the system IS), not actions (things the system DOES). Transitions carry preconditions, actions, and postconditions. The spec is independent of any runtime framework — LangGraph or any executor consumes it.

2. **Formal Graph Validation** — `validateSpec()` checks structural integrity, `computeReachability()` maps which states can reach which, `findDeadlockedStates()` identifies states with no exit path, and `canAllStatesTerminate()` verifies every state has a path to a terminal state.

3. **Mermaid and Text Visualization** — `generateMermaid()` and `generateMermaidFlowchart()` produce renderable Mermaid diagrams, `generateTextSummary()` creates human-readable workflow descriptions, and `generateAdjacencyMatrix()` outputs the state-transition matrix.

4. **Relational Accountability Mapping** — Every state carries responsibility. `AccountabilityMap` tracks who is responsible at each state, who executes transitions, and who verifies postconditions. `findAccountabilityGaps()` reveals where responsibility is unclear, and `generateAccountabilityNarrative()` produces human-readable accountability stories.

5. **Specification Serialization and Parsing** — `parseSpec()` and `serializeSpec()` enable JSON round-tripping with `serializeSpecSnakeCase()` for Python interop, creating a shared workflow contract across TypeScript and Python systems.

### Success Indicators

- ✅ A developer can call `createStateMachineSpec({ name, states, transitions, initialState, finalStates })` and receive a fully typed `StateMachineSpec` document
- ✅ `validateSpec()` returns `ValidationResult` with issues categorized by `ValidationSeverity` (ERROR, WARNING, INFO), catching unreachable states, missing transitions, and structural inconsistencies
- ✅ `generateMermaid()` produces a renderable state diagram and `generateMermaidFlowchart()` produces a flowchart variant for different visualization contexts
- ✅ `inferAccountabilityFromSpec()` automatically creates an `AccountabilityMap` from the spec's relational context, and `findAccountabilityGaps()` identifies states or transitions lacking clear responsibility
- ✅ `parseSpec(json)` and `serializeSpec(spec)` enable lossless JSON round-tripping for spec exchange between systems

---

## Structural Tension Analysis

### Current Structural Reality

| Component | Role | Direction |
|-----------|------|-----------|
| `StateMachineSpec` / `StateSpec` / `TransitionSpec` | Declarative type system: states as conditions, transitions with pre/postconditions, relational context | EAST |
| `createStateMachineSpec()` / `getState()` / `getTransition()` | Factory and query functions for building and navigating specs | EAST |
| `validateSpec()` / `computeReachability()` / `findDeadlockedStates()` / `canAllStatesTerminate()` | Formal graph validation: structural integrity, reachability analysis, deadlock detection, termination verification | SOUTH |
| `generateMermaid()` / `generateMermaidFlowchart()` / `generateTextSummary()` / `generateAdjacencyMatrix()` | Visualization: Mermaid state diagrams, flowcharts, text summaries, adjacency matrices | WEST |
| `AccountabilityMap` / `createAccountabilityMap()` / `inferAccountabilityFromSpec()` | Relational accountability: entity-state responsibility mapping, transition accountability | NORTH |
| `findAccountabilityGaps()` / `generateAccountabilityNarrative()` | Gap analysis and narrative generation for accountability | NORTH |
| `parseSpec()` / `normalizeSpec()` / `serializeSpec()` / `serializeSpecSnakeCase()` | Serialization: JSON parsing, normalization, serialization with Python-compatible snake_case variant | Integration |

### Desired Outcome

A system where workflow specifications are living documents that carry not only structural logic but relational accountability — where every state declares who holds responsibility, every transition makes visible how accountability transfers, and formal validation ensures no gap in the relational chain goes unnoticed.

### The Tension

The current reality provides complete spec authoring, validation, visualization, and accountability mapping. The creative tension lives in advancing toward runtime integration where `StateMachineSpec` documents are consumed by LangGraph executors that respect the formal validation and accountability constraints at execution time, and toward cross-spec composition where multiple `StateMachineSpec` documents compose into larger workflow hierarchies with accountability flowing across spec boundaries.

---

## Component Specification

### StateMachineSpec / StateSpec / TransitionSpec
**Direction:** EAST (Vision / Definition)
**Type:** Interfaces
**Purpose:** Declarative type system where states are conditions (not actions) and transitions carry pre/postconditions and trigger events.

```typescript
interface StateSpec {
  name: string;
  description: string;
  entryConditions: string[];
  exitConditions: string[];
  allowedTransitions: string[];
  isTerminal: boolean;
}

interface TransitionSpec {
  name: string;
  fromState: string;
  toState: string;
  triggerEvents: string[];
  preconditions: string[];
  actions: string[];
  postconditions: string[];
}

interface RelationalContext {
  entities: string[];
  responsibilities: string;
  stateResponsibilities?: Record<string, string[]>;
}

interface SpecMetadata {
  version: string;
  author: string;
  langgraphCompatible: boolean;
  relationalContext?: RelationalContext;
}

interface StateMachineSpec {
  name: string;
  description: string;
  initialState: string;
  finalStates: string[];
  states: StateSpec[];
  transitions: TransitionSpec[];
  metadata: SpecMetadata;
}
```

### Formal Validation
**Direction:** SOUTH (Analysis / Verification)
**Type:** Functions
**Purpose:** Formal graph analysis that ensures structural integrity, reachability, termination, and absence of deadlocks.

```typescript
enum ValidationSeverity {
  ERROR = "error",
  WARNING = "warning",
  INFO = "info",
}

interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
  context?: Record<string, unknown>;
}

interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

function validateSpec(spec: StateMachineSpec): ValidationResult;
function computeReachability(spec: StateMachineSpec): Map<string, Set<string>>;
function findDeadlockedStates(spec: StateMachineSpec): string[];
function canAllStatesTerminate(spec: StateMachineSpec): boolean;
```

### Visualization
**Direction:** WEST (Reflection / Display)
**Type:** Functions
**Purpose:** Multi-format visualization of state machine structure for human review and documentation.

```typescript
interface MermaidOptions {
  direction?: "LR" | "TB";
  includeConditions?: boolean;
}

interface FlowchartOptions {
  direction?: "LR" | "TB";
  includeActions?: boolean;
}

function generateMermaid(spec: StateMachineSpec, options?: MermaidOptions): string;
function generateMermaidFlowchart(spec: StateMachineSpec, options?: FlowchartOptions): string;
function generateTextSummary(spec: StateMachineSpec): string;
function generateAdjacencyMatrix(spec: StateMachineSpec): string[][];
```

### Relational Accountability
**Direction:** NORTH (Action / Accountability)
**Type:** Interfaces + Functions
**Purpose:** Maps accountability to every state and transition in the workflow, identifying gaps and generating human-readable narratives.

```typescript
interface AccountableEntity {
  id: string;
  name: string;
  role: string;
  responsibleStates: string[];
}

interface StateResponsibility {
  stateName: string;
  primaryHolders: string[];
  waitingEntities: string[];
  obligation: string;
  failureConsequence: string;
}

interface TransitionAccountability {
  transitionName: string;
  fromState: string;
  toState: string;
  preconditionOwners: string[];
  actionExecutors: string[];
  postconditionVerifiers: string[];
}

interface AccountabilityMap {
  id: string;
  specName: string;
  entities: AccountableEntity[];
  stateResponsibilities: StateResponsibility[];
  transitionAccountability: TransitionAccountability[];
  timestamp: string;
}

function createAccountabilityMap(spec: StateMachineSpec, entities: AccountableEntity[]): AccountabilityMap;
function inferAccountabilityFromSpec(spec: StateMachineSpec): AccountabilityMap;
function findAccountabilityGaps(map: AccountabilityMap): string[];
function getResponsibleAt(map: AccountabilityMap, stateName: string): string[];
function getTransitionAccountability(map: AccountabilityMap, transitionName: string): TransitionAccountability | undefined;
function generateAccountabilityNarrative(map: AccountabilityMap): string;
```

### Serialization
**Direction:** Integration
**Type:** Functions
**Purpose:** JSON parsing, normalization, and serialization with Python-compatible snake_case variant for cross-language spec exchange.

```typescript
function parseSpec(json: string): StateMachineSpec;
function normalizeSpec(raw: Record<string, unknown>): StateMachineSpec;
function serializeSpec(spec: StateMachineSpec): string;
function serializeSpecSnakeCase(spec: StateMachineSpec): string;
```

---

## Integration Architecture

### Consumer Pattern

This library provides the **specification layer** consumed by graph executors and workflow systems:

- **Examples** — The `accountability-routing` example demonstrates spec-driven workflows with relational accountability
- **LangGraph Executors** — Any LangGraph workflow can consume a `StateMachineSpec` as its formal definition, with runtime state validated against entry/exit conditions
- **Cross-Language Systems** — `serializeSpecSnakeCase()` enables Python consumers to work with the same spec documents

### Dependency Graph

```
          ava-langchain-state-machine-spec
          (StateMachineSpec, Validation,
           Visualization, Accountability)
                      │
         ┌────────────┼──────────────┐
         │            │              │
         ▼            ▼              ▼
   LangGraph      Examples      Python Systems
   Executors   (accountability  (snake_case
   (runtime)    -routing)       serialization)
```

---

## Kinship Mapping

| This Package | Related Package | Kinship Type | Shared Pattern |
|---|---|---|---|
| `StateMachineSpec` | `jgwill/Miadi` → `rispecs/miadi-code/stc/SPEC.md` (MultiChartContextManager) | Kin (Formal Verification ↔ Runtime Management) | state-machine-spec enables formal verification of workflow specs that Miadi's STC manages at runtime |
| `AccountabilityMap` | `ava-langchain-relational-intelligence` → `rispecs/relational-intelligence/relational-intelligence.spec.md` | Sibling (Relational Pattern) | Both map relational accountability — RI through Medicine Wheel quadrants, state-machine-spec through entity-state responsibility |
| `StateSpec` (states as conditions) | `ava-langgraph-prompt-decomposition-engine` → `rispecs/prompt-decomposition-engine/prompt-decomposition-engine.spec.md` | Sibling (State Pattern) | DecompositionGraph uses states (east_complete, south_complete, etc.) that align with StateSpec's "states as conditions" paradigm |
| `generateMermaid()` | `ava-langgraph-narrative-intelligence` → `rispecs/narrative-intelligence/narrative-intelligence.spec.md` | Complementary (Visualization ↔ Processing) | state-machine-spec visualizes workflow structure; narrative-intelligence processes events through that structure |
| `TransitionSpec` (pre/postconditions) | `jgwill/medicine-wheel` → `consent-lifecycle.spec.md` | Kin (Gating Pattern) | TransitionSpec preconditions align with ValueGate constraints — both gate transitions on conditions that must hold |

---

## Advancement Path

### Next Implementation Steps

1. **Runtime Spec Execution Bridge** — Create an adapter that translates `StateMachineSpec` into a LangGraph `StateGraph`, mapping `StateSpec` to nodes, `TransitionSpec` to edges with conditional routing based on preconditions, and terminal states to END nodes.

2. **Cross-Spec Composition** — Advance toward hierarchical spec composition where a `StateMachineSpec` can reference sub-specs (other `StateMachineSpec` documents) as composite states, with accountability flowing across spec boundaries.

3. **Accountability-Gated Transitions** — Integrate `AccountabilityMap` with `ValueGate` from relational-intelligence so that transitions require not only precondition satisfaction but also relational accountability verification.

4. **Spec Diffing and Version History** — Advance serialization toward spec versioning with semantic diffing that shows which states, transitions, or accountability mappings changed between versions.

5. **Interactive Mermaid Editor** — Advance visualization from read-only output toward an interactive editor where visual changes to the Mermaid diagram propagate back to the `StateMachineSpec` JSON.

6. **Formal Verification Extensions** — Advance validation toward model checking with temporal logic assertions (e.g., "state X is always reachable from state Y within N transitions"), enabling richer safety and liveness proofs.
