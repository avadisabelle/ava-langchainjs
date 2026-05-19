# QMD Inquiry Execution Primitives

> Status: Proposal
> Package: `ava-langchain-inquiry-routing`
> Proposed path: `libs/inquiry-routing/src/qmd_*`
> Related package: `ava-langchain-prompt-decomposition`
> Inspired by: `mia-code/miaco` QMD command surface and `@miadisabelle/qmd`

## Desired Outcome

The chain package shall provide typed, provider-neutral primitives that turn
routed inquiries into executable QMD query plans, then normalize QMD search
results back into inquiry enrichment artifacts.

The result should be enough for graph engines, CLIs, or agents to:

- formulate QMD-ready query documents from a PDE/inquiry batch
- preserve skipped ambiguities and human-decision boundaries
- execute through an injected provider adapter or dry-run without execution
- format results as JSON and miaco-compatible Markdown
- avoid a hard runtime dependency on local QMD when remote MCP is preferred

This is a proposal-only spec. It intentionally does not implement the slice.

## Current Reality

`ava-langchain-inquiry-routing` already generates, enriches, routes, and
formats inquiries. Its QMD output is currently a dispatch shape, not an
execution contract. Consumers still need to decide how to convert formatted
queries into QMD tool calls, how to represent provider metadata, and how to
store or synthesize search results.

`miaco` already models the missing workflow operationally:

- `miaco qmd` resolves a QMD provider and exposes `search` and `query`.
- `miaco qmd-inquiry-decompose formulate` writes `pde-qmd-queries.json`.
- `miaco qmd-inquiry-decompose run` executes the queries and writes
  `pde-inquiry-enrichment.md`.

This spec ports that shape into reusable chain primitives without binding the
chain package to the `miaco` CLI.

## Five-Point Proposal

### 1. Model QMD Providers As Read-Only Descriptors

Reference inspiration:

- `/src/mia-code/miaco/src/commands/qmd.ts`
  - `QmdProviderKind`
  - `QmdProviderInfo`
  - `resolveQmdProvider()`
  - `buildQmdProviderSummary()`
- `/src/mia-code/miaco/src/commands/skill.ts`
  - remote MCP recommendation using `MIACO_QMD_PROVIDER=mcp-remote`
  - `MIACO_QMD_MCP_CONFIG`
  - `MIACO_QMD_MCP_SERVER`

The chain package shall introduce provider metadata types, but should not read
process env directly in core primitives.

Proposed types:

```ts
export type QmdProviderKind = "container" | "host" | "mcp-local" | "mcp-remote" | "sdk" | "custom";

export interface QmdProviderDescriptor {
  schemaVersion: 1;
  provider: QmdProviderKind;
  endpoint?: string;
  collections: string[];
  provenance: string;
  capabilities: Array<"query" | "get" | "multi_get" | "status">;
  readOnly: true;
}
```

The default provider descriptor should be a read-only, remote-friendly shape:

```ts
{
  schemaVersion: 1,
  provider: "mcp-remote",
  collections: [],
  provenance: "configured-by-consumer",
  capabilities: ["query", "get", "multi_get", "status"],
  readOnly: true
}
```

Implementation note: environment resolution belongs in CLI/graph adapters, not
inside the chain primitives. This keeps tests deterministic and avoids hidden
host-local QMD execution.

### 2. Separate Query Formulation From Query Execution

Reference inspiration:

- `/src/mia-code/miaco/src/commands/qmd-inquiry-decompose.ts`
  - `buildQmdFormulationPrompt()`
  - `parseFormulatedQmdQueries()`
  - writes `pde-qmd-queries.json`
  - writes `pde-qmd-queries.md`
- `/src/mia-code/miaco/src/commands/continue.ts`
  - `formulate-qmd-queries`
  - `qmd-inquiry-decompose`

The chain package shall model formulation as data, not as an LLM call. A caller
may use an LLM, heuristics, or a human-edited artifact to build the plan.

Proposed types:

```ts
export type QmdSearchType = "lex" | "vec" | "hyde";

export interface QmdInquirySearch {
  id: string;
  inquiryId?: string;
  direction?: "east" | "south" | "west" | "north";
  type: QmdSearchType;
  query: string;
  intent?: string;
  collections?: string[];
  limit?: number;
  minScore?: number;
}

export interface QmdSkippedInquiry {
  inquiryId?: string;
  query: string;
  reason: string;
}

export interface QmdInquiryPlan {
  id: string;
  timestamp: string;
  pdeId: string;
  provider: QmdProviderDescriptor;
  searches: QmdInquirySearch[];
  skipped: QmdSkippedInquiry[];
  source: "generated" | "formulated" | "human-edited" | "imported";
}
```

Proposed primitive:

```ts
export class QmdInquiryPlanner {
  fromRoutedBatch(batch: RoutedInquiryBatch, options?: QmdInquiryPlannerOptions): QmdInquiryPlan;
}
```

The planner should map existing `qmd-local` inquiries into typed QMD searches
while preserving non-QMD inquiries in `skipped` or leaving them to their own
dispatch channel.

### 3. Use QMD's Native Typed Query Document Semantics

Reference inspiration:

- `/workspace/repos/miadisabelle/mia-qmd/src/mcp/server.ts`
  - MCP `query` tool input schema with `searches: [{ type, query }]`
  - supported types: `lex`, `vec`, `hyde`
  - `intent`, `collections`, `limit`, `minScore`
- `/workspace/repos/miadisabelle/mia-qmd/README.md`
  - query grammar: typed `lex:`, `vec:`, `hyde:` lines
  - SDK `store.search({ queries, collections, intent })`
- `/src/mia-code/miaco/src/commands/qmd.ts`
  - `buildQmdMcpQueryArguments()`

The chain package shall format query plans into QMD-native MCP arguments and
human-readable query documents.

Proposed primitive:

```ts
export interface QmdMcpQueryArguments {
  searches: Array<{ type: QmdSearchType; query: string }>;
  limit?: number;
  minScore?: number;
  collections?: string[];
  intent?: string;
}

export class QmdQueryDocumentFormatter {
  toMcpArguments(searches: QmdInquirySearch[]): QmdMcpQueryArguments;
  toQueryDocument(searches: QmdInquirySearch[]): string;
  toMiacoQueriesJson(plan: QmdInquiryPlan): string;
  toMiacoQueriesMarkdown(plan: QmdInquiryPlan): string;
}
```

Compatibility target: `toMiacoQueriesJson()` should be able to produce an
artifact equivalent in intent to `pde-qmd-queries.json`, with richer typing
allowed by this package.

### 4. Normalize QMD Results Without Owning Transport

Reference inspiration:

- `/src/mia-code/miaco/src/commands/qmd.ts`
  - `QmdResult`
  - `formatMcpToolResult()`
  - result summary based on `structuredContent.results`
- `/workspace/repos/miadisabelle/mia-qmd/src/mcp/server.ts`
  - `structuredContent: { results }`
  - result fields: `docid`, `file`, `title`, `score`, `context`, `snippet`
- `/workspace/repos/miadisabelle/mia-qmd/src/mcp-remote/proxy.ts`
  - remote proxy forwards tools verbatim and injects collections

The chain package shall define an adapter interface and result normalizer. It
shall not spawn processes, open SSH connections, or require a local QMD index.

Proposed types:

```ts
export interface QmdKnowledgeHit {
  docid?: string;
  file: string;
  title?: string;
  score: number;
  context?: string | null;
  snippet?: string;
}

export interface QmdInquirySearchResult {
  searchId: string;
  query: string;
  type: QmdSearchType;
  hits: QmdKnowledgeHit[];
  raw?: unknown;
  error?: string;
}

export interface QmdInquiryExecutionResult {
  planId: string;
  provider: QmdProviderDescriptor;
  timestamp: string;
  results: QmdInquirySearchResult[];
  skipped: QmdSkippedInquiry[];
}

export interface QmdProviderAdapter {
  readonly descriptor: QmdProviderDescriptor;
  query(args: QmdMcpQueryArguments): Promise<QmdKnowledgeHit[]>;
}
```

Optional `@miadisabelle/qmd` support should be implemented outside the base
chain contract or behind an optional peer path because `@miadisabelle/qmd@2.0.1`
requires Node `>=22.0.0`, while the current inquiry-routing package declares
Node `>=18`.

### 5. Produce Inquiry Enrichment Artifacts

Reference inspiration:

- `/src/mia-code/miaco/src/commands/qmd-inquiry-decompose.ts`
  - output: `pde-inquiry-enrichment.md`
  - sections grouped by query and mode
  - skipped ambiguities section
- `/src/mia-code/miaco/src/commands/pde-to-st.ts`
  - consumes enrichment when present

The chain package shall format QMD execution results into reusable enrichment
outputs.

Proposed primitive:

```ts
export class QmdInquiryEnrichmentFormatter {
  toMarkdown(result: QmdInquiryExecutionResult): string;
  toJson(result: QmdInquiryExecutionResult): string;
  applyResponses(batch: RoutedInquiryBatch, result: QmdInquiryExecutionResult): RoutedInquiryBatch;
}
```

`applyResponses()` should update matching inquiries with concise response
summaries while preserving the original result envelope for downstream graph
state.

## RISE Breakdown

### Reverse-Engineer

Reverse-engineer the operational contract from `miaco`:

- provider abstraction from `commands/qmd.ts`
- formulation/execution split from `commands/qmd-inquiry-decompose.ts`
- chained step names from `commands/continue.ts`
- remote MCP preference from `commands/skill.ts`
- typed search/result schema from `@miadisabelle/qmd` MCP server

### Intent-Extract

The intent is to move QMD inquiry enrichment from ad-hoc CLI behavior into
library-grade chain primitives. The primitives should make the questions and
their provenance explicit before any search is executed.

### Specify

Implementation should add:

- `src/qmd_types.ts`
- `src/qmd_inquiry_planner.ts`
- `src/qmd_query_formatter.ts`
- `src/qmd_result_normalizer.ts`
- `src/qmd_enrichment_formatter.ts`
- exports from `src/index.ts`
- focused tests under `src/__tests__/qmd_*.test.ts`

The implementation should not modify prompt decomposition storage or graph
packages directly.

### Export

The package shall export all QMD types and classes from the root export path.
No new package should be created for this slice unless implementation discovers
a stronger boundary.

## Acceptance Criteria

- A routed inquiry batch with QMD inquiries can be transformed into a
  `QmdInquiryPlan`.
- The plan can be formatted as MCP query arguments with typed `lex`, `vec`,
  and `hyde` searches.
- A raw MCP result with `structuredContent.results` can be normalized into
  `QmdKnowledgeHit[]`.
- A full execution result can be rendered as Markdown equivalent in purpose to
  `pde-inquiry-enrichment.md`.
- Tests cover provider descriptors, skipped inquiries, query document
  formatting, result normalization, and Markdown output.
- No test requires a live QMD index, SSH host, Docker container, or local MCP
  server.

## Non-Goals

- Do not implement SSH, stdio MCP, Docker, or process spawning in the chain
  package.
- Do not make `@miadisabelle/qmd` a required dependency of
  `ava-langchain-inquiry-routing`.
- Do not change existing `Inquiry`, `InquiryBatch`, or `RoutedInquiryBatch`
  fields incompatibly.
- Do not execute QMD during plan creation.
