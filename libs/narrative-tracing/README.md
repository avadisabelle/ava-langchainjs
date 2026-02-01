# Narrative Tracing for LangChain.js

A Langfuse-based tracing integration for the Narrative Intelligence Stack.

## Overview

This package provides narrative-aware observability across:
- LangGraph (three-universe processing)
- Flowise (agent coordination)
- Langflow (routing)
- Storytelling system (beat generation)

## Installation

```bash
npm install @langchain/narrative-tracing
```

## Quick Start

```typescript
import {
  NarrativeTracingHandler,
  NarrativeTraceOrchestrator,
  NarrativeTraceFormatter,
  NarrativeEventType,
} from '@langchain/narrative-tracing';

// Create handler for simple tracing
const handler = new NarrativeTracingHandler({
  storyId: 'story_123',
  sessionId: 'session_456',
});

// Start story generation
const traceId = handler.startStoryGeneration();

// Log beat creation
handler.logBeatCreation(
  'beat_001',
  'The story begins with a mysterious event...',
  1,
  'inciting_incident',
  { emotionalTone: 'intrigue' }
);

// Log three-universe analysis
handler.logThreeUniverseAnalysis({
  eventId: 'evt_123',
  engineerIntent: 'feature_implementation',
  engineerConfidence: 0.8,
  ceremonyIntent: 'co_creation',
  ceremonyConfidence: 0.7,
  storyEngineIntent: 'rising_action',
  storyEngineConfidence: 0.85,
  leadUniverse: 'story_engine',
  coherenceScore: 0.82,
});

// End generation
handler.endStoryGeneration(totalMs);
```

## Components

### NarrativeTracingHandler

Direct handler for logging narrative events to Langfuse.

```typescript
const handler = new NarrativeTracingHandler({
  storyId: 'story_123',
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
});
```

### NarrativeTraceOrchestrator

For cross-system trace correlation.

```typescript
const orchestrator = new NarrativeTraceOrchestrator();

// Create root trace
const root = orchestrator.createStoryGenerationRoot('story_123', 'session_456');

// Create child spans
const beatSpanId = orchestrator.createBeatSpan(
  'beat_001',
  'Content...',
  1,
  'rising_action',
  root
);

// Inject headers for outgoing HTTP calls
const headers = orchestrator.injectCorrelationHeader({}, root.traceId);

// Finalize trace
const completed = await orchestrator.finalizeStoryTrace(
  root.traceId,
  finalStory,
  metrics
);
```

### NarrativeTraceFormatter

Format traces for human understanding.

```typescript
const formatter = new NarrativeTraceFormatter();

// Display format
console.log(formatter.formatForDisplay(completedTrace));

// Timeline format
console.log(formatter.formatAsTimeline(completedTrace));

// Markdown export
const markdown = formatter.exportAsMarkdown(completedTrace);

// Get improvement suggestions
const suggestions = formatter.generateImprovementSuggestions(metrics);
```

## Adapters

### LangGraph Bridge

Wire ThreeUniverseProcessor to narrative tracing.

```typescript
import { LangGraphBridge } from '@langchain/narrative-tracing/adapters';

const bridge = new LangGraphBridge(handler);

// Create callback for manual use
const callback = bridge.createThreeUniverseCallback();
callback({
  eventId: 'evt_123',
  engineerResult: { intent: 'feature_request', confidence: 0.8 },
  ceremonyResult: { intent: 'co_creation', confidence: 0.7 },
  storyEngineResult: { intent: 'rising_action', confidence: 0.85 },
  leadUniverse: 'story_engine',
  coherenceScore: 0.82,
});

// Or wrap processor function
const traced = bridge.traceProcessor(processor.process.bind(processor));
const result = await traced(event);
```

### Miadi Integration

HTTP header-based trace correlation.

```typescript
import { MiadiIntegration } from '@langchain/narrative-tracing/adapters';

const miadi = new MiadiIntegration(handler);

// Inject headers for outgoing requests
const headers = miadi.injectCorrelationHeaders({});
// { 'X-Narrative-Trace-Id': '...', 'X-Story-Id': '...', ... }

// Extract correlation from incoming request
const context = miadi.extractCorrelation(request.headers);

// Continue trace from headers
miadi.continueTraceFromHeaders(request.headers);

// Log webhook events
miadi.logWebhookReceived(eventId, eventType, source);
```

### Storytelling Hooks

Beat lifecycle tracing for the storytelling system.

```typescript
import { StorytellingHooks } from '@langchain/narrative-tracing/adapters';

const hooks = new StorytellingHooks(handler);

// Create beat tracer
const tracer = hooks.createBeatTracer('beat_001');
tracer.logContent('The story begins...', {
  narrativeFunction: 'inciting_incident',
  emotionalTone: 'wonder',
});
tracer.logAnalysis('wonder', 0.9);
tracer.logEnrichment('dialogue', ['dialogue_enhancer'], 0.7, 0.85);
hooks.finishBeatTracer(tracer);

// Or direct logging
hooks.logBeatCreation('beat_002', 'Content...', {
  narrativeFunction: 'rising_action',
});

// Character arc updates
hooks.logCharacterArcUpdate({
  characterId: 'char_001',
  characterName: 'The Builder',
  arcPositionBefore: 0.2,
  arcPositionAfter: 0.35,
  growthDescription: 'Gained confidence in integration',
});
```

## Event Types

The package defines semantic event types for narrative operations:

- **Beat Events**: `BEAT_CREATED`, `BEAT_ANALYZED`, `BEAT_ENRICHED`
- **Story Events**: `STORY_GENERATION_START`, `STORY_GENERATION_END`, `STORY_QUALITY_METRICS`
- **Three-Universe Events**: `THREE_UNIVERSE_ANALYSIS`, `UNIVERSE_PERSPECTIVE_SHIFT`
- **Character Events**: `CHARACTER_ARC_UPDATED`, `CHARACTER_RELATIONSHIP_CHANGED`
- **Theme Events**: `THEME_INTRODUCED`, `THEME_REINFORCED`, `THEME_RESOLVED`
- **Routing Events**: `ROUTING_DECISION`, `FLOW_EXECUTED`
- **Gap Events**: `GAP_IDENTIFIED`, `GAP_REMEDIATED`
- **Checkpoint Events**: `NARRATIVE_CHECKPOINT`, `EPISODE_BOUNDARY`

Each event type has an associated emoji glyph for human-readable display.

## Environment Variables

- `LANGFUSE_PUBLIC_KEY`: Langfuse public API key
- `LANGFUSE_SECRET_KEY`: Langfuse secret API key
- `LANGFUSE_HOST`: Langfuse host URL (optional)
- `NARRATIVE_STORY_ID`: Default story ID
- `COAIAPY_SESSION_ID`: Session ID for grouping
- `COAIAPY_TRACE_ID`: Root trace ID

## License

MIT
