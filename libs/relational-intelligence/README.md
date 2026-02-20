# Relational Intelligence for LangChain.js

Relational Intelligence components for the Narrative Intelligence Stack, grounded in Indigenous relational paradigms.

## Overview

This package provides foundational components that foreground relational accountability and Indigenous ways of knowing:

- **Medicine Wheel Filter** - Ontological filter using four quadrants (Physical, Emotional, Mental, Spiritual)
- **Importance Units** - Relational importance with accountability scoring and Relational Strings (Land, Dream, Code, Vision)
- **Epistemic Iteration** - Spiral tracker that recognizes circling as ceremony, not redundancy
- **Value Gate** - Research Is Ceremony and Medicine Wheel gating conditions for autonomous action
- **Fire Keeper** - Coordinating agent protocol for vision alignment, not task management
- **Liminal Buffer** - High-context buffer for dream-state and liminal inputs

## Installation

```bash
npm install ava-langchain-relational-intelligence
```

## Quick Start

### Medicine Wheel Filter

The wheel asks "To what is this accountable?" not "What is this about?"

```typescript
import { MedicineWheelFilter, MedicineWheelQuadrant } from "ava-langchain-relational-intelligence";

const wheel = new MedicineWheelFilter();

// Assess an input across all four quadrants
const assessment = wheel.assess("input_1", "Add database schema for user auth");
console.log(assessment.leadQuadrant); // "mental"
console.log(assessment.neglectedQuadrants); // ["emotional", "spiritual"]
console.log(assessment.relationalCoverage); // 0.5

// Get guidance for what's missing
const guided = wheel.assessWithGuidance("input_2", "Build the server infrastructure");
for (const g of guided.guidance) {
  console.log(g);
  // "The Spiritual quadrant is neglected. Consider: does this align with the deeper vision?"
}

// Check if agent can proceed autonomously
if (!wheel.canProceedAutonomously(assessment)) {
  console.log("Bring human into the loop - spiritual/emotional quadrants neglected");
}
```

### Importance Units with Relational Strings

Every piece of data is connected back to four relational sources: The Land, The Dream, The Code, The Vision.

```typescript
import {
  createImportanceUnit,
  ImportanceContext,
  connectToSource,
  RelationalSource,
  deepenUnit,
  ImportanceStore,
} from "ava-langchain-relational-intelligence";

// Create a unit from a liminal insight (1.5x accountability weight)
const unit = createImportanceUnit(
  "The knowledge graph should be alive, not flat",
  "session_123",
  ImportanceContext.LIMINAL
);

// Connect to relational sources
connectToSource(unit, RelationalSource.DREAM, 0.9, "Hypnagogic insight");
connectToSource(unit, RelationalSource.VISION, 0.8, "Core architectural direction");

// Deepen through revisitation (circling strengthens, not replaces)
deepenUnit(unit, "The wheel should be the ontological filter");
deepenUnit(unit, "Each quadrant is a flavor of relationship", ImportanceContext.CEREMONIAL);

// Store and query
const store = new ImportanceStore();
store.add(unit);

const mostAccountable = store.getByAccountability(10);
const needingAttention = store.getNeedingAttention(5);
```

### Epistemic Iteration (Spiral Tracker)

Repetition is ceremony. Each circle back deepens the relationship.

```typescript
import { SpiralTracker, SpiralShiftType } from "ava-langchain-relational-intelligence";

const tracker = new SpiralTracker();

// First mention of knowledge graph
tracker.recordCircle("kg", "Knowledge Graph", "We need a knowledge graph", "session_1");

// Second return - adding new territory
tracker.recordCircle("kg", "Knowledge Graph",
  "The graph should use Medicine Wheel as ontological filter", "session_1");

// Third return - deepening
tracker.recordCircle("kg", "Knowledge Graph",
  "Each quadrant represents a relational dimension, not a category", "session_2");

// Check depth
const spiral = tracker.getSpiral("kg");
console.log(spiral.depth); // 3

// Analyze shifts - the important lines live between iterations
const shifts = tracker.analyzeShifts("kg");
console.log(shifts[2].shiftType); // "expanding" or "deepening"
console.log(shifts[2].significance); // Higher with depth

// Get deepest spirals (most important topics)
const deepest = tracker.getByDepth(5);
```

### Value Gate

Research Is Ceremony is a required context, not an optional citation.

```typescript
import { ValueGate } from "ava-langchain-relational-intelligence";

const gate = new ValueGate();

// Technical work passes through
const techVerdict = gate.evaluate({
  action: "Add REST API endpoint",
  actionDescription: "Simple CRUD endpoint",
  agentId: "agent_1",
  sessionId: "s1",
  metadata: {},
});
console.log(techVerdict.canProceed); // true

// Indigenous knowledge work requires ceremony context
const indigenousVerdict = gate.evaluate({
  action: "Design Indigenous ontology",
  actionDescription: "Create schema for medicine wheel relational models",
  agentId: "agent_1",
  sessionId: "s1",
  metadata: { researchIsCeremonyGathered: false },
});
console.log(indigenousVerdict.canProceed); // false
console.log(indigenousVerdict.requiresHuman); // true
console.log(indigenousVerdict.failureSummary);
// ["[Research Is Ceremony]: context has not been gathered"]

// After gathering ceremony context
const afterVerdict = gate.evaluate({
  action: "Design Indigenous ontology",
  actionDescription: "Create schema for medicine wheel relational models",
  agentId: "agent_1",
  sessionId: "s1",
  metadata: { researchIsCeremonyGathered: true },
});
console.log(afterVerdict.canProceed); // true
```

### Fire Keeper (Coordinating Agent)

The Fire Keeper's primary job is Vision Alignment, not Task Management.

```typescript
import {
  FireKeeper,
  createAgentReport,
  EngagementMode,
} from "ava-langchain-relational-intelligence";

const keeper = new FireKeeper(
  "Build a relational intelligence system grounded in Indigenous paradigms"
);

// Receive a report from a sub-agent
const report = createAgentReport(
  "agent_1",
  "Mia",
  "Built database schema",
  "Schema created successfully",
  { confidence: 0.3 } // Low confidence
);

const review = keeper.reviewReport(report);
if (review.requiresHumanEngagement) {
  console.log(review.engagementRequest.mode); // "code_review"
  console.log(review.engagementRequest.reason); // "Low agent confidence"
}

// Gate actions through value constraints
const verdict = keeper.gateAction({
  action: "Deploy ontology to production",
  actionDescription: "Pushes Indigenous ontology schema live",
  agentId: "agent_2",
  sessionId: "session_1",
  metadata: { researchIsCeremonyGathered: true },
});

// Record relational milestones (not time-based)
keeper.recordMilestone(
  "Completed knowledge graph design with relational care",
  ["knowledge_graph"],
  ["unit_1", "unit_2"]
);

// Pruning is allowed after relational circles complete, not after time
if (keeper.canPrune()) {
  console.log("Relational circle complete - pruning allowed");
}

// Get system summary
console.log(keeper.getSummary());
```

### Liminal Buffer

Dream-state inputs are root context. Technical work is pruned relative to this, not the other way around.

```typescript
import { LiminalBuffer, LiminalMode } from "ava-langchain-relational-intelligence";

const buffer = new LiminalBuffer();

// Capture a half-awake recording (1.5x weight)
const input = buffer.capture(
  "The system needs to breathe... the knowledge graph should be alive, not flat...",
  LiminalMode.HYPNAGOGIC,
  "session_1",
  { sourceFile: "recording_2am.m4a" }
);

console.log(input.weight); // 1.5 (higher than analytical inputs)
console.log(input.importanceUnits.length); // 1 (auto-created)

// Check if technical work aligns with liminal context
const alignment = buffer.checkAlignment("Add flat JSON schema for knowledge graph");
if (!alignment.aligned) {
  for (const conflict of alignment.conflicts) {
    console.log(conflict);
    // "Liminal context emphasizes spiritual but proposed action neglects it"
  }
}

// Root context informs all other pruning
const rootContext = buffer.getRootContext();
```

## The Four Quadrants (Medicine Wheel)

| Quadrant | Dimension | Asks | Examples |
|----------|-----------|------|----------|
| **Physical** | Material, embodied, land-based | What body will hold this? | Code, infrastructure, artifacts |
| **Emotional** | Felt, relational, heart-centered | Who is affected? Where is the care? | Bonds, trust, harm, healing |
| **Mental** | Analytical, logical, pattern-recognition | What is the structural logic? | Design, architecture, analysis |
| **Spiritual** | Intuitive, visionary, dream-adjacent | Does this align with the deeper vision? | Ceremony, liminal insight, vision |

If an agent only sees one quadrant, it is missing the rest of reality.

## The Four Relational Sources

| Source | Connection | Weight Context |
|--------|------------|----------------|
| **Land** | Grounded, embodied, place-based knowledge | Where this lives materially |
| **Dream** | Liminal, intuitive, spirit-adjacent knowing | What the vision revealed |
| **Code** | Technical artifacts, systems, implementations | How this manifests technically |
| **Vision** | Deeper purpose and directional intent | Why this matters |

## Value Constraints

| Constraint | Severity | Purpose |
|------------|----------|---------|
| **Research Is Ceremony** | Hard Stop | Blocks Indigenous knowledge work without ceremony context |
| **Relational Check-Back** | Hard Stop | Verifies Spirit (vision) and Body (code) alignment |
| **Medicine Wheel Balance** | Warning | Warns when quadrants are neglected |
| **Implicit Over Explicit** | Warning | Flags when values are overridden by technical asks |

## Integration with ava-langgraphjs

These components are designed to be consumed by the LangGraph Narrative Intelligence Toolkit:

```typescript
import { FireKeeper, MedicineWheelFilter } from "ava-langchain-relational-intelligence";
import { ThreeUniverseProcessor } from "ava-langgraph-narrative-intelligence";

const keeper = new FireKeeper("Project vision...");
const processor = new ThreeUniverseProcessor();

// Gate three-universe analysis through the Medicine Wheel
const analysis = processor.process(event, "github.push");
const wheelAssessment = keeper.getWheelFilter().assess("event_1", event.content);

const verdict = keeper.gateAction({
  action: "Process event",
  actionDescription: "Three-universe analysis",
  agentId: "processor",
  sessionId: "s1",
  wheelAssessment,
  metadata: { researchIsCeremonyGathered: true },
});
```

## Epistemic Foundation

This package is grounded in:

- **Research Is Ceremony** (Wilson, 2008) - Relational accountability as the foundation of Indigenous research methodology
- **Medicine Wheel** - Not a graphic but an ontological structure for understanding relational dimensions
- **Epistemic Iteration** - Circling is ceremony; repetition deepens relationship, not redundancy
- **Relational Accountability** - Importance is accountability, not salience

## License

MIT
