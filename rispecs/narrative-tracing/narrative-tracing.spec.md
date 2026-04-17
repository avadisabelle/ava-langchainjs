# Narrative Tracing: Langfuse-Based Narrative-Aware Observability

**Specification Type:** Library Specification
**Document ID:** `rispecs/narrative-tracing/narrative-tracing.spec.md`
**Framework:** RISE (Reverse-engineer → Intent-extract → Specify → Export)
**Package:** `ava-langchain-narrative-tracing`
**Version:** 0.1.1

---

## Desired Outcome Definition

### What Users Want to Create

The **ava-langchain-narrative-tracing** package enables developers to create **narrative-aware observability** across the Narrative Intelligence Stack through:

1. **Semantic Narrative Event Tracing** — Every operation is traced not as a generic span but as a narrative event (beat creation, three-universe analysis, routing decision, story generation lifecycle) with semantic glyphs (📝, 🔍, ✨, 📖) that make traces human-readable

2. **Cross-System Trace Correlation** — A single story generation spans LangGraph, Flowise, Langflow, and the Storytelling system. The orchestrator correlates traces across boundaries using `X-Narrative-Trace-Id`, `X-Session-Id`, and `X-Story-Id` headers

3. **Human-Readable Trace Formatting** — Completed traces render as narrative-aware displays with ASCII story arc visualization, character arc progression, and formatted span trees that tell the story of how a story was made

4. **Adapter Bridges for Stack Integration** — Purpose-built adapters for prompt-decomposition, relational-intelligence, LangGraph, Miadi integration, and storytelling hooks that emit typed tracing events without coupling the traced components to Langfuse

5. **Narrative Quality Metrics** — Accumulated metrics across a story generation session (beat count, coherence scores, gap counts, routing decisions) that quantify the narrative health of the output

### Success Indicators

- ✅ A developer can create a `NarrativeTracingHandler({ storyId })` and call `startStoryGeneration()`, `logBeatCreation()`, `logThreeUniverseAnalysis()`, `logRoutingDecision()`, and `endStoryGeneration()` to trace an entire story generation lifecycle
- ✅ The `NarrativeTraceOrchestrator` correlates traces across system boundaries via `injectCorrelationHeader()` and `extractCorrelationHeader()`
- ✅ `NarrativeTraceFormatter.formatForDisplay()` produces human-readable trace output with `arcToAsciiChart()` story arc visualization
- ✅ Adapter bridges (PromptDecompositionBridge, RelationalIntelligenceBridge, LangGraphBridge) emit typed events without requiring traced components to import Langfuse
- ✅ Narrative metrics accumulate across a session and `calculateOverallQuality()` produces a composite quality score

---

## Structural Tension Analysis

### Current Structural Reality

| Component | Role | Direction |
|-----------|------|-----------|
| `NarrativeTracingHandler` | Langfuse callback handler with semantic span naming, narrative event logging, and story lifecycle tracking | SOUTH |
| `NarrativeTraceOrchestrator` | Cross-system trace correlation with root trace management, child span creation, and header injection/extraction | SOUTH |
| `NarrativeTraceFormatter` | Human-readable trace formatting with `FormattedSpan` tree rendering and ASCII story arc visualization | WEST |
| `NarrativeEventType` | 35+ semantic event types spanning beat lifecycle, story lifecycle, three-universe analysis, character/theme events, routing, gap analysis, PDE events, and RI events | EAST |
| `EVENT_GLYPHS` | Glyph mapping for human-readable event display | EAST |
| `NarrativeSpan` / `TraceCorrelation` / `NarrativeMetrics` | Core data structures for narrative-aware spans, cross-system correlation, and quality metrics | SOUTH |
| Adapter Bridges | `PromptDecompositionBridge`, `RelationalIntelligenceBridge`, `LangGraphBridge`, `MiadiIntegration`, `StorytellingHooks` | Integration |

### Desired Outcome

A system where every operation across the Narrative Intelligence Stack produces a narrative trace that is both machine-queryable and human-readable — where traces tell the story of how a story was made, enabling retrospective analysis, debugging, and narrative quality improvement.

### The Tension

The current reality provides the core tracing infrastructure, event types, and adapter bridges. The creative tension lives in advancing toward **episode bundling** — where session artifacts are gathered into structured `EpisodeBundle` objects with kinship metadata that connect sessions into a larger narrative — and toward **polyphonic parsing** that transforms talking-circle markdown into individually attributed voice segments for richer multi-perspective tracing.

---

## Component Specification

### NarrativeTracingHandler
**Direction:** SOUTH (Analysis / Observability)
**Type:** Class
**Purpose:** Langfuse callback handler with narrative awareness that provides semantic span naming and narrative-specific event logging.

```typescript
interface NarrativeTracingHandlerOptions {
  storyId?: string;
  sessionId?: string;
  traceId?: string;
  enableSemanticNaming?: boolean;
  correlationHeader?: string;
  publicKey?: string;
  secretKey?: string;
  host?: string;
}

class NarrativeTracingHandler {
  storyId: string;
  sessionId: string | undefined;
  rootTraceId: string | undefined;
  correlation: TraceCorrelation | undefined;

  startStoryGeneration(): void;
  logBeatCreation(beatId: string, content: string, sequence: number, phase: string): void;
  logThreeUniverseAnalysis(analysis: Record<string, unknown>): void;
  logRoutingDecision(decision: Record<string, unknown>): void;
  endStoryGeneration(totalMs: number): void;
}
```

### NarrativeTraceOrchestrator
**Direction:** SOUTH (Analysis / Correlation)
**Type:** Class
**Purpose:** Correlates traces across system boundaries in the Narrative Intelligence Stack (LangGraph → Flowise → Langflow → LangChain).

```typescript
interface RootTrace {
  traceId: string;
  storyId: string;
  sessionId: string;
  traceObject: any;
  childSpanIds: string[];
  createdAt: string;
  correlation: TraceCorrelation | undefined;
}

interface CompletedTrace {
  traceId: string;
  storyId: string;
  sessionId: string;
  spans: NarrativeSpan[];
  startTime: string;
  endTime: string;
  durationMs: number;
  metrics: NarrativeMetrics | undefined;
  beatCount: number;
  correlation: TraceCorrelation | undefined;
}

class NarrativeTraceOrchestrator {
  createStoryGenerationRoot(storyId: string, sessionId: string): RootTrace;
  createBeatSpan(beat: unknown, root: RootTrace): string;
  injectCorrelationHeader(headers: Record<string, string>, traceId: string): Record<string, string>;
  extractCorrelationHeader(headers: Record<string, string>): string | undefined;
  completeTrace(traceId: string): CompletedTrace | undefined;
}
```

### NarrativeTraceFormatter
**Direction:** WEST (Validation / Human Review)
**Type:** Class
**Purpose:** Formats narrative traces for human understanding with tree-structured span display and ASCII story arc visualization.

```typescript
interface FormattedSpan {
  displayName: string;
  details: string[];
  children: FormattedSpan[];
  indentLevel: number;
}

interface StoryArcVisualization {
  characterArcs: Record<string, number[]>;
  emotionalBeats: string[];
  themeMentions: Record<string, number>;
}

class NarrativeTraceFormatter {
  formatForDisplay(trace: CompletedTrace): string;
  formatSpan(span: NarrativeSpan): FormattedSpan;
  visualizeStoryArc(trace: CompletedTrace): StoryArcVisualization;
}

function formattedSpanToString(span: FormattedSpan, indent?: number): string;
function arcToAsciiChart(arc: StoryArcVisualization): string;
```

### NarrativeEventType
**Direction:** EAST (Vision / Definition)
**Type:** Enum
**Purpose:** Defines 35+ semantic event types that categorize every traceable operation in the Narrative Intelligence Stack.

```typescript
enum NarrativeEventType {
  // Beat lifecycle
  BEAT_CREATED = "narrative.beat.created",
  BEAT_ANALYZED = "narrative.beat.analyzed",
  BEAT_ENRICHED = "narrative.beat.enriched",

  // Story lifecycle
  STORY_GENERATION_START = "narrative.story.generation_start",
  STORY_GENERATION_END = "narrative.story.generation_end",

  // Three-universe analysis
  THREE_UNIVERSE_ANALYSIS = "narrative.three_universe.analysis",

  // PDE events
  PROMPT_DECOMPOSITION_STARTED = "pde.decomposition.started",
  DIRECTIONAL_ANALYSIS_PERFORMED = "pde.directional.analysis",

  // RI events
  WHEEL_ASSESSMENT_PERFORMED = "ri.wheel.assessment_performed",
  VALUE_GATE_VERDICT_ISSUED = "ri.value.gate_verdict_issued",
  SPIRAL_CIRCLE_RECORDED = "ri.epistemic.spiral_circle_recorded",
  LIMINAL_INPUT_CAPTURED = "ri.liminal.input_captured",
  // ... 20+ additional event types
}
```

### NarrativeSpan / TraceCorrelation / NarrativeMetrics
**Direction:** SOUTH (Analysis / Data Structures)
**Type:** Interfaces
**Purpose:** Core data structures for narrative-aware spans, cross-system correlation trees, and accumulated quality metrics.

```typescript
interface NarrativeSpan {
  id: string;
  eventType: NarrativeEventType;
  name: string;
  metadata: Record<string, unknown>;
  startTime: string;
  endTime?: string;
  parentId?: string;
  children: string[];
}

interface TraceCorrelation {
  rootTraceId: string;
  childTraceIds: string[];
  systemOrigin: string;
  correlationHeaders: Record<string, string>;
}

interface NarrativeMetrics {
  beatCount: number;
  coherenceScore: number;
  gapCount: number;
  routingDecisions: number;
  qualityScore: number;
}
```

---

## Integration Architecture

### Consumer Pattern

This library serves as the **observability layer** consumed across the entire Narrative Intelligence Stack. Components interact with tracing through purpose-built adapter bridges that decouple the traced code from Langfuse:

- `./adapters/prompt_decomposition_bridge` — Traces PDE events (decomposition start, directional analysis, intent extraction, ambiguity detection)
- `./adapters/relational_intelligence_bridge` — Traces RI events (wheel assessments, importance unit lifecycle, spiral circles, value gate verdicts, human engagement)
- `./adapters/langgraph_bridge` — Traces LangGraph node executions and state transitions
- `./adapters/miadi_integration` — Traces Miadi event-driven platform operations
- `./adapters/storytelling_hooks` — Traces story generation lifecycle in the Storytelling system

### Dependency Graph

```
                 ava-langchain-narrative-tracing
                 (Handler, Orchestrator, Formatter,
                  EventTypes, Adapters)
                        │
         ┌──────────────┼──────────────────┐
         │              │                  │
         ▼              ▼                  ▼
  prompt-decomposition  relational-intelligence  (Langfuse API)
  (traced via bridge)   (traced via bridge)
         │              │
         ▼              ▼
  prompt-decomposition-engine    langgraph workflows
  (graph-level tracing)          (LangGraphBridge)
                                        │
                     ┌──────────────────┼───────────┐
                     ▼                  ▼           ▼
               ava-Flowise        ava-langflow   Storytelling
               (correlation)      (correlation)  (hooks)
```

---

## Kinship Mapping

| This Package | Related Package | Kinship Type | Shared Pattern |
|---|---|---|---|
| `NarrativeTracingHandler` | `jgwill/medicine-wheel` → `narrative-engine.spec.md` | Kin (Narrative Processing Pipeline) | Both process narrative events through typed pipelines; tracing observes what narrative-engine produces |
| `NarrativeEventType` (PDE events) | `ava-langchain-prompt-decomposition` → `rispecs/prompt-decomposition/prompt-decomposition.spec.md` | Sibling (Adapter Bridge) | PromptDecompositionBridge traces every PDE pipeline stage as typed narrative events |
| `NarrativeEventType` (RI events) | `ava-langchain-relational-intelligence` → `rispecs/relational-intelligence/relational-intelligence.spec.md` | Sibling (Adapter Bridge) | RelationalIntelligenceBridge traces wheel assessments, spiral circles, value gate verdicts |
| Cross-system correlation | `jgwill/Miadi` → `rispecs/miadi-code/SPEC.md` | Kin (miaco `trace` command — Pattern 9) | Both correlate traces across system boundaries; Miadi uses event-driven patterns that tracing observes |
| `NarrativeTraceFormatter` | `ava-langgraph-narrative-intelligence` → `rispecs/narrative-intelligence/narrative-intelligence.spec.md` | Complementary (Observability ↔ Analysis) | Tracing provides observability; narrative-intelligence provides analysis. Both use Three-Universe model independently |
| `StorytellingHooks` adapter | `jgwill/storytelling` | Kin (Story Generation) | Traces the story generation lifecycle in The Keeper's Chronicles and RAG-powered storytelling |

---

## Advancement Path

### Next Implementation Steps

1. **EpisodeBundler** — Create a new component that takes session artifacts (traces, importance units, spiral snapshots) and produces a structured `EpisodeBundle` with kinship metadata. Each bundle captures what happened, who was involved, what was learned, and how it connects to previous episodes — advancing toward a narrative memory that spans sessions.

2. **PolyphonicParser** — Create a parser that transforms talking-circle markdown into individually attributed voice segments with speaker identification. This enables richer multi-perspective tracing where each voice (Mia, Miette, Ava8, Tushell) produces distinct trace spans within a single session.

3. **Real-Time Trace Streaming** — Advance the Handler beyond batch completion toward real-time span streaming, enabling live narrative dashboards that show story generation as it unfolds.

4. **Langfuse v3 Structured Output Integration** — Advance trace metadata from flat key-value pairs toward Langfuse v3 structured observations with typed schemas for each NarrativeEventType.

5. **Cross-Project Trace Federation** — Advance the Orchestrator's correlation beyond single-project boundaries toward federated traces that span medicine-wheel, Miadi, and Storytelling projects through shared correlation headers.

6. **Narrative Health Dashboard** — Advance NarrativeMetrics from per-session accumulation toward aggregated dashboards that show narrative health trends across story generation runs, identifying patterns in coherence, gap frequency, and routing efficiency.
