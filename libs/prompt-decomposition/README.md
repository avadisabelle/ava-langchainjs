# ava-langchain-prompt-decomposition

Prompt Decomposition Engine (PDE) primitives for the Narrative Intelligence Stack.

Decomposes complex prompts through **Four Directions** analysis (Medicine Wheel epistemology):
- **EAST (Vision/Spiritual)**: What is being asked? → Intent extraction
- **SOUTH (Analysis/Mental)**: What needs to be learned? → Dependency mapping
- **WEST (Validation/Emotional)**: What needs reflection? → Ceremony checks
- **NORTH (Action/Physical)**: What executes? → Ordered action stack

## Installation

```bash
pnpm add ava-langchain-prompt-decomposition
```

## Quick Start

```typescript
import { decompose } from 'ava-langchain-prompt-decomposition';

const result = decompose(
  'Research the existing patterns. Build the new module. Test the integration.'
);

console.log(result.json);     // Full PDE JSON
console.log(result.markdown); // Human-readable breakdown
```

## Core Modules

| Module | Description |
|--------|-------------|
| `DirectionalDecomposer` | Classifies prompt segments into EAST/SOUTH/WEST/NORTH |
| `IntentExtractor` | Extracts primary + secondary intents with confidence and urgency |
| `DependencyMapper` | Builds dependency graphs with cycle detection and execution ordering |
| `ActionStackBuilder` | Produces final PDE output (JSON/Markdown) |
| `MedicineWheelBridge` | Direction↔Quadrant mapping, ceremony detection |
| `V0OntologyBridge` | Maps to @medicine-wheel/* V0 package vision |

## API

### `decompose(prompt, options?)`

Convenience pipeline that runs all modules in sequence.

```typescript
const result = decompose('Build a knowledge graph with ceremony.', {
  extractImplicit: true,
  maxItems: 20,
  ceremonyThreshold: 0.3,
});

result.decomposition  // DecompositionResult
result.wheelEnriched  // WheelEnrichedAnalysis
result.json           // JSON string
result.markdown       // Markdown string
```

### `DirectionalDecomposer`

```typescript
const decomposer = new DirectionalDecomposer();
const analysis = decomposer.decompose('Research and build.');

analysis.directions      // { east: [...], south: [...], west: [...], north: [...] }
analysis.leadDirection   // Direction.NORTH
analysis.balance         // 0.0 - 1.0
decomposer.isBalanced(analysis)       // boolean
decomposer.getGuidance(analysis)      // string[]
```

### `IntentExtractor`

```typescript
const extractor = new IntentExtractor({ extractImplicit: true });
const result = extractor.extract('Create a module and test it.');

result.primary     // { action: 'create', confidence: 0.9, urgency: 'session' }
result.secondary   // ActionIntent[]
result.context     // { filesNeeded: [...] }
```

## Related Packages

- `ava-langchain-relational-intelligence` — MedicineWheelFilter, ValueGate, SpiralTracker
- `ava-langgraph-prompt-decomposition-engine` — Graph-level orchestration (depends on this package)
- `ava-langchain-narrative-tracing` — Narrative tracing handlers
