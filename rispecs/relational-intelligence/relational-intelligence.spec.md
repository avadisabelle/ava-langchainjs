# Relational Intelligence: Indigenous Relational Paradigm Framework

**Specification Type:** Library Specification
**Document ID:** `rispecs/relational-intelligence/relational-intelligence.spec.md`
**Framework:** RISE (Reverse-engineer → Intent-extract → Specify → Export)
**Package:** `ava-langchain-relational-intelligence`
**Version:** 0.1.2

---

## Desired Outcome Definition

### What Users Want to Create

The **ava-langchain-relational-intelligence** package enables developers to create **relationally accountable AI systems** grounded in Indigenous epistemology through:

1. **Medicine Wheel Ontological Filtering** — Every input is assessed through four quadrants (Physical, Emotional, Mental, Spiritual), ensuring agents engage the full spectrum of relational reality rather than operating from a single analytical dimension

2. **Relational Importance with Accountability Decay** — Importance Units carry Relational Strings (Land/Dream/Code/Vision) that connect insights back to their sources, with accountability scores that decay when relationships are not reaffirmed through epistemic iteration

3. **Epistemic Spiral Tracking** — Returning to a topic is recognized as ceremony, not redundancy. The SpiralTracker measures the depth of the spiral and analyzes shifts between circles (deepening, expanding, converging, returning)

4. **Value Gating with Research Is Ceremony** — Hard constraints prevent autonomous action on Indigenous knowledge domains without proper ceremonial context, and soft constraints flag relational imbalances before they propagate

5. **Fire Keeper Coordination** — A coordinating agent protocol that holds the Medicine Wheel, reviews sub-agent reports against the project vision, triggers human engagement when relational accountability requires it, and prunes by Relational Milestones instead of time intervals

### Success Indicators

- ✅ An agent can call `wheel.assess(inputId, content)` and receive a `WheelAssessment` showing quadrant presence, lead quadrant, neglected quadrants, and relational coverage
- ✅ Importance units accumulate relational depth through `deepenUnit()` and surface for attention when accountability decays below threshold
- ✅ The SpiralTracker records circling across sessions and `analyzeShifts()` reveals the nature of epistemic movement (DEEPENING, EXPANDING, CONVERGING, RETURNING)
- ✅ The ValueGate blocks autonomous action on Indigenous knowledge domains when Research Is Ceremony context has not been gathered
- ✅ The FireKeeper receives `AgentReport` from sub-agents, assesses them through the Medicine Wheel, and produces `HumanEngagementRequest` when ceremony requires human presence

---

## Structural Tension Analysis

### Current Structural Reality

| Component | Role | Direction |
|-----------|------|-----------|
| `MedicineWheelFilter` | Ontological filter: classifies inputs across Physical/Emotional/Mental/Spiritual quadrants via keyword scoring or optional LLM refinement | WEST |
| `ImportanceUnit` / `ImportanceStore` | Relational importance schema with Relational Strings (Land/Dream/Code/Vision), accountability decay, and context-weighted scoring | SOUTH |
| `SpiralTracker` | Epistemic iteration tracker recognizing circling as ceremony, with shift analysis between circles | SOUTH |
| `ValueGate` | Research Is Ceremony gating with four default constraints: research-is-ceremony, relational-check-back, medicine-wheel-balance, implicit-over-explicit | WEST |
| `FireKeeper` | Coordinating agent protocol for vision alignment, sub-agent report review, human engagement, and relational milestone tracking | NORTH |
| `LiminalBuffer` | High-context buffer for dream-state inputs (hypnagogic, dream recall, contemplative, ceremonial, land walk, spontaneous) | EAST |

### Desired Outcome

A system where relational intelligence is not an add-on but the foundational layer — where every agent action is assessed through the Medicine Wheel, every insight carries accountability back to its relational sources, and epistemic iteration is honored as ceremony that deepens understanding.

### The Tension

The current reality provides the complete component set for relational intelligence. The creative tension lives in advancing toward deeper integration where the `StructuralTensionChain` connects current reality to desired outcome through tension vectors that route signal across the entire AvaLangStack, and where LLM-enhanced classification elevates beyond keyword heuristics while maintaining the relational accountability that keyword scoring ensures.

---

## Component Specification

### MedicineWheelFilter
**Direction:** WEST (Validation / Reflection)
**Type:** Class
**Purpose:** Classifies inputs across all four quadrants of the Medicine Wheel and identifies when dimensions of reality are being neglected.

```typescript
enum MedicineWheelQuadrant {
  PHYSICAL = "physical",
  EMOTIONAL = "emotional",
  MENTAL = "mental",
  SPIRITUAL = "spiritual",
}

interface WheelAssessment {
  id: string;
  inputId: string;
  presence: QuadrantPresence;
  leadQuadrant: MedicineWheelQuadrant;
  neglectedQuadrants: MedicineWheelQuadrant[];
  relationalCoverage: number;
  balanced: boolean;
  timestamp: string;
}

interface MedicineWheelFilterOptions {
  neglectThreshold?: number;   // Default: 0.15
  balanceThreshold?: number;   // Default: 0.5
  llm?: BaseChatModel | BaseLLM;
}

class MedicineWheelFilter {
  async assess(inputId: string, content: string): Promise<WheelAssessment>;
  async assessWithGuidance(inputId: string, content: string): Promise<WheelAssessment & { guidance: string[] }>;
  canProceedAutonomously(assessment: WheelAssessment): boolean;
}
```

### ImportanceUnit / ImportanceStore
**Direction:** SOUTH (Analysis / Learning)
**Type:** Interface + Class
**Purpose:** Manages relational importance units that carry accountability back to their sources (Land/Dream/Code/Vision) and track epistemic depth through iteration.

```typescript
enum RelationalSource {
  LAND = "land",
  DREAM = "dream",
  CODE = "code",
  VISION = "vision",
}

interface RelationalString {
  source: RelationalSource;
  strength: number;
  nature: string;
  lastAffirmed: string;
}

interface ImportanceUnit {
  id: string;
  content: string;
  sourceSessionId: string;
  relationalStrings: RelationalString[];
  context: ImportanceContext;
  wheelPresence: QuadrantPresence;
  accountabilityScore: number;
  valueAlignmentScore: number;
  iterationCount: number;
  humanValidated: boolean;
  explicitAsks: string[];
  implicitAsks: string[];
}

class ImportanceStore {
  add(unit: ImportanceUnit): void;
  get(id: string): ImportanceUnit | undefined;
  getAll(filter?: { context?; source?; minAccountability?; humanValidatedOnly? }): ImportanceUnit[];
  getByAccountability(limit?: number): ImportanceUnit[];
  getNeedingAttention(limit?: number): ImportanceUnit[];
  applyDecay(decayFactor?: number): void;
}
```

### SpiralTracker
**Direction:** SOUTH (Analysis / Learning)
**Type:** Class
**Purpose:** Tracks epistemic iteration across sessions, recognizing circling as a meaningful epistemic structure rather than noise or redundancy.

```typescript
interface EpistemicCircle {
  id: string;
  topicKey: string;
  iteration: number;
  content: string;
  delta: string;
  sessionId: string;
  timestamp: string;
}

interface Spiral {
  topicKey: string;
  topicName: string;
  circles: EpistemicCircle[];
  depth: number;
  active: boolean;
  accumulatedInsight: string;
}

enum SpiralShiftType {
  DEEPENING = "deepening",
  EXPANDING = "expanding",
  CONVERGING = "converging",
  RETURNING = "returning",
  OPENING = "opening",
}

class SpiralTracker {
  async recordCircle(topicKey: string, topicName: string, content: string, sessionId: string): Promise<EpistemicCircle>;
  getSpiral(topicKey: string): Spiral | undefined;
  getActiveSpirals(): Spiral[];
  getByDepth(limit?: number): Spiral[];
  async analyzeShifts(topicKey: string): Promise<SpiralShiftAnalysis[]>;
  closeSpiral(topicKey: string): void;
}
```

### ValueGate
**Direction:** WEST (Validation / Reflection)
**Type:** Class
**Purpose:** Evaluates proposed actions against relational value constraints before allowing autonomous execution.

```typescript
interface ValueConstraint {
  id: string;
  name: string;
  description: string;
  severity: ConstraintSeverity;
  check: (context: GateContext) => GateResult;
  active: boolean;
}

enum ConstraintSeverity {
  HARD_STOP = "hard_stop",
  WARNING = "warning",
  ADVISORY = "advisory",
}

interface GateVerdict {
  id: string;
  canProceed: boolean;
  requiresHuman: boolean;
  results: Array<{ constraintId; constraintName; severity; result: GateResult }>;
  failureSummary: string[];
}

class ValueGate {
  registerConstraint(constraint: ValueConstraint): void;
  async evaluate(context: GateContext): Promise<GateVerdict>;
  async canProceed(action: string, description: string, agentId: string, sessionId: string): Promise<boolean>;
}
```

### FireKeeper
**Direction:** NORTH (Action / Coordination)
**Type:** Class
**Purpose:** Coordinating agent protocol that holds the Medicine Wheel, reviews sub-agent reports against the project vision, and ensures the ceremony stays on track.

```typescript
interface FireKeeperState {
  pendingReports: AgentReport[];
  milestones: RelationalMilestone[];
  engagementRequests: HumanEngagementRequest[];
  visionStatement: string;
  relationalHealth: number;
  ceremonyOnTrack: boolean;
}

class FireKeeper {
  constructor(visionStatement: string, options?: FireKeeperOptions);
  async processPrompt(prompt: string, agentId: string, sessionId: string): Promise<{ requiresHumanEngagement; engagementRequest?; directionalAnalysisId?; intentExtractionId? }>;
  async reviewReport(report: AgentReport): Promise<{ accepted; feedback: string[]; requiresHumanEngagement; engagementRequest? }>;
  async gateAction(context: GateContext): Promise<GateVerdict>;
  getWheelFilter(): MedicineWheelFilter;
  getSpiralTracker(): SpiralTracker;
  getState(): FireKeeperState;
}
```

### LiminalBuffer
**Direction:** EAST (Vision / Dream)
**Type:** Class
**Purpose:** Stores high-context inputs from dream-adjacent states and serves as root context for the entire system — technical tasks are pruned relative to this root, not the other way around.

```typescript
enum LiminalMode {
  HYPNAGOGIC = "hypnagogic",
  DREAM_RECALL = "dream_recall",
  CONTEMPLATIVE = "contemplative",
  CEREMONIAL = "ceremonial",
  LAND_WALK = "land_walk",
  SPONTANEOUS = "spontaneous",
}

interface LiminalInput {
  id: string;
  content: string;
  mode: LiminalMode;
  weight: number;
  sessionId: string;
  wheelAssessment?: WheelAssessment;
  importanceUnits: ImportanceUnit[];
  integrated: boolean;
  influenceCount: number;
}

class LiminalBuffer {
  async capture(content: string, mode: LiminalMode, sessionId: string): Promise<LiminalInput>;
  getRootContext(limit?: number): LiminalInput[];
  async checkAlignment(proposedAction: string): Promise<{ aligned; conflicts: string[]; supportingInputs: string[] }>;
  markIntegrated(id: string): void;
  recordInfluence(id: string): void;
}
```

---

## Integration Architecture

### Consumer Pattern

This library is the **foundational relational layer** consumed by all other AvaLangStack packages through optional peer dependencies:

- `ava-langchain-prompt-decomposition` — Uses `MedicineWheelBridge` (which wraps `MedicineWheelFilter`) for directional balance assessment
- `ava-langchain-narrative-tracing` — Provides adapter bridges (`RelationalIntelligenceBridge`) that emit tracing events for every wheel assessment, importance unit lifecycle, spiral circle, and value gate verdict
- `ava-langchain-state-machine-spec` — Conceptually aligned through relational accountability patterns
- `ava-langgraph-prompt-decomposition-engine` — Graph layer consumes relational intelligence through the FireKeeper's processPrompt and gateAction flows
- `ava-langgraph-narrative-intelligence` — Three-Universe Processor aligns with MedicineWheelFilter's multi-perspective assessment pattern

### Dependency Graph

```
                    ava-langchain-relational-intelligence
                    (MedicineWheelFilter, ImportanceStore,
                     SpiralTracker, ValueGate, FireKeeper,
                     LiminalBuffer)
                           │
              ┌────────────┼────────────────┐
              │            │                │
              ▼            ▼                ▼
    prompt-decomposition  narrative-tracing  state-machine-spec
    (optional peer)       (optional peer)    (optional peer)
              │            │
              ▼            ▼
    prompt-decomposition-engine    ← langgraphjs orchestration
    inquiry-routing-engine
    narrative-intelligence         ← conceptual alignment
```

---

## Kinship Mapping

| This Package | Related Package | Kinship Type | Shared Pattern |
|---|---|---|---|
| `MedicineWheelFilter` | `jgwill/medicine-wheel` → `medicine-wheel.spec.md` | Direct Ancestor | Four-quadrant ontological filtering (Physical/Emotional/Mental/Spiritual) |
| `FireKeeper` | `jgwill/medicine-wheel` → `fire-keeper.spec.md` | Direct Ancestor | Coordinating agent protocol with vision alignment and relational milestones |
| `ImportanceUnit` | `jgwill/medicine-wheel` → `importance-unit.spec.md` | Direct Ancestor | Relational importance with accountability decay and four relational sources |
| `ValueGate` | `jgwill/medicine-wheel` → `consent-lifecycle.spec.md` | Direct Ancestor | Consent and ceremony gating with constraint severity levels |
| `MedicineWheelFilter` | `jgwill/Miadi` → `rispecs/miadi-code/SPEC.md` | Kin (Three-Universe Processor) | Three-Universe Processor uses MedicineWheelFilter for multi-perspective assessment |
| `FireKeeper` | `ava-langchain-prompt-decomposition` → `rispecs/prompt-decomposition/prompt-decomposition.spec.md` | Sibling (Consumes PDE) | FireKeeper.processPrompt() uses DirectionalDecomposer and IntentExtractor |
| `ValueGate` | `ava-langchain-narrative-tracing` → `rispecs/narrative-tracing/narrative-tracing.spec.md` | Sibling (Observed by Tracing) | Every gate verdict is traced through RelationalIntelligenceBridge |

---

## Advancement Path

### Next Implementation Steps

1. **StructuralTensionChain** — Create a new component that takes `current_reality` + `desired_outcome` and produces a tension vector for routing signal across the AvaLangStack. This chain would integrate MedicineWheelFilter assessment with SpiralTracker depth to generate directional tension that informs which graph nodes activate next.

2. **LLM-Enhanced Quadrant Classification** — Advance the MedicineWheelFilter's `classifyPresence()` beyond keyword heuristics through structured output from LLMs with Zod schema validation (infrastructure already in place, advancing toward production-ready LLM integration).

3. **LLM-Enhanced Concept Extraction for SpiralTracker** — Advance `analyzeShifts()` concept extraction beyond word-frequency heuristics to semantic concept recognition (Zod schema and LLM path already scaffolded).

4. **Cross-Session Spiral Persistence** — Advance ImportanceStore and SpiralTracker serialization toward persistent storage (Redis or filesystem), enabling spirals that span sessions and projects.

5. **Relational Milestone Automation** — Advance FireKeeper milestone tracking from manual recording toward automated detection of relational circle completion based on spiral convergence patterns and accountability score thresholds.

6. **Python Parity** — Advance toward full Python implementation in `ava-langchain/libs/relational-intelligence/` for Langflow and broader Python ecosystem consumption.
