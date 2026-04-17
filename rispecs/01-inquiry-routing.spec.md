# 01 — Inquiry Routing Primitives

> Package: `ava-langchain-inquiry-routing` v0.1.0
> Path: `libs/inquiry-routing/`
> Peer dependency: `ava-langchain-prompt-decomposition >=0.1.0`

## Desired Outcome

A set of chain-level primitives that transform PDE `DecompositionResult` into structured `Inquiry` objects — each classified by Medicine Wheel direction, routed to a knowledge channel (QMD local, deep-search academic, workspace-scan), and enriched with Wilson's relational ontology markers and Two-Eyed Seeing (Etuaptmumk) epistemological fields. The pipeline runs synchronously: **Generate → Enrich → Route → Format**.

Downstream consumers (LangGraph engine, mia-code, ava-Flowise) receive dispatch-ready queries without needing to understand routing internals.

## Current Reality

- PDE decompositions exist (`ava-langchain-prompt-decomposition`) but produce `DecompositionResult` — a structural artifact, not a set of actionable inquiries.
- No mechanism converts directional insights, ambiguity flags, or context assumptions into routable questions.
- Relational grounding (accountability, ceremonial_intent, Two-Eyed Seeing lenses) is absent from PDE output.
- Routing decisions are ad-hoc: agents decide per-turn where to search, with no keyword-based classification or directional affinity.

## Structural Tension

PDE produces *structure*; downstream channels need *questions*. The tension between decomposition-as-analysis and inquiry-as-action resolves through four chain primitives that transform one into the other while preserving relational accountability at every step.

## Architecture / Components

### InquiryGenerator (`src/inquiry_generator.ts`)

EAST function — "What questions want to be asked?"

- Accepts `DecompositionResult` from `ava-langchain-prompt-decomposition`
- Extracts inquiries from three sources:
  1. **Directional insights** (Four Directions items → one inquiry per insight)
  2. **Ambiguity flags** (each ambiguity → verification inquiry, routed to WEST)
  3. **Context assumptions** (each assumption → verification inquiry, routed to SOUTH)
- Pre-classifies each inquiry to a source channel via keyword scoring + directional defaults
- Returns `InquiryBatch` grouped by direction

### InquiryRouter (`src/inquiry_router.ts`)

SOUTH function — "Where does each question find its answer?"

- Classifies inquiries using keyword matching against three channel vocabularies
- Applies directional affinity boost (`AFFINITY_BOOST = 0.15`)
- Produces `RoutingDecision` per inquiry with confidence, reasoning, matched keywords
- `routeAll()` returns `RoutedInquiryBatch` with all decisions attached

### RelationalEnricher (`src/relational_enricher.ts`)

WEST function — "Does each inquiry honor its relations?"

- Populates `relational_context` and `accountability` from Wilson's axiology templates
- Adds `ceremonial_intent` markers (stronger for WEST-direction inquiries)
- Adds Two-Eyed Seeing markers: `indigenous_lens` + `western_lens` per direction
- Both lenses always present — strength varies by direction, neither absent

### InquiryFormatter (`src/inquiry_formatter.ts`)

NORTH function — "How do we format for execution?"

- `toQmdQuery()` → `QmdQuery` with mode selection (lex/vec/hyde based on query structure)
- `toDeepSearchQuery()` → `DeepSearchQuery` with extracted search terms + academic context
- `toMarkdown()` → structured Markdown report with directional sections, routing table
- `toJSON()` → serialized `InquiryBatch`/`RoutedInquiryBatch`

### Convenience Pipeline (`src/index.ts`)

- `generateInquiries(decomposition, options?)` → runs full pipeline → returns `{ batch, markdown, json }`

## Data (TypeScript interfaces)

```typescript
// Core entity
interface Inquiry {
  id: string;
  timestamp: string;
  direction: "east" | "south" | "west" | "north";
  source: "qmd-local" | "deep-search-academic" | "workspace-scan";
  query: string;
  response?: string;
  status: "pending" | "routed" | "completed" | "failed";
  relational_context: string;
  accountability: string;
  ceremonial_intent?: string;
  indigenous_lens?: string;
  western_lens?: string;
  pde_id: string;
  action_index?: number;
  confidence: number;
}

// Batch grouped by direction
interface InquiryBatch {
  id: string; timestamp: string; pde_id: string;
  east: Inquiry[]; south: Inquiry[]; west: Inquiry[]; north: Inquiry[];
  total: number;
}

// Routing output
interface RoutingDecision {
  inquiry_id: string; source: InquirySource;
  confidence: number; reasoning: string; matched_keywords: string[];
}
interface RoutedInquiryBatch extends InquiryBatch {
  decisions: RoutingDecision[]; routing_timestamp: string;
}

// Channel-specific query formats
interface QmdQuery { mode: "lex" | "vec" | "hyde"; query: string; direction: string; context?: string; }
interface DeepSearchQuery { query: string; academic_context: string; direction: string; search_terms: string[]; }

// Enums
enum InquirySource { QMD_LOCAL = "qmd-local", DEEP_SEARCH_ACADEMIC = "deep-search-academic", WORKSPACE_SCAN = "workspace-scan" }
enum InquiryStatus { PENDING = "pending", ROUTED = "routed", COMPLETED = "completed", FAILED = "failed" }
```

## Implementation Notes

- **No LLM dependency** — all routing is keyword-based + directional affinity. LLM-based classification deferred to engine layer.
- **Peer dependency model** — depends on `ava-langchain-prompt-decomposition` for `DecompositionResult`, `Direction`, `AmbiguityFlag` types.
- **Build toolchain**: tsup + TypeScript 5.3, ESM primary with CJS fallback.
- **Testing**: vitest. Tests in `src/__tests__/`.
- **Source channel keywords** are hardcoded with config overrides via `InquiryRoutingConfig`.
- **Direction → default source mapping**: east→QMD, south→deep-search, west→QMD, north→workspace-scan.
- Directional labels use Anishinaabe terms: Waabinong, Zhaawanong, Epangishmok, Kiiwedinong.

## RISE Compliance

| Phase | Status | Notes |
|-------|--------|-------|
| **R**everse-engineer | ✅ Done | Architecture extracted from medicine-wheel-pi conceptual prototype and PDE decomposition patterns |
| **I**ntent-extract | ✅ Done | Intent: transform PDE structure into routable, relationally-grounded questions |
| **S**pecify | ✅ This document | Four components, typed interfaces, pipeline convenience function |
| **E**xport | ✅ Published | `ava-langchain-inquiry-routing@0.1.0`, ESM+CJS, barrel export from `src/index.ts` |
