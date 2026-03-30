# ava-langchain-inquiry-routing

Inquiry Routing primitives for the Narrative Intelligence Stack — transforms PDE decomposition output into structured **Inquiries** routed to knowledge channels, enriched with Wilson's relational ontology and Two-Eyed Seeing epistemology.

## What It Does

After PDE decomposes a complex prompt into Four Directions, this package generates structured questions (Inquiries) from that decomposition and routes each to the appropriate knowledge channel:

| Channel | Code | Purpose |
|---------|------|---------|
| **QMD Local** | `qmd-local` | Semantic search against workspace knowledge (lex/vec/hyde) |
| **Deep Search Academic** | `deep-search-academic` | Research-grade queries for scholarly sources |
| **Workspace Scan** | `workspace-scan` | File system exploration and dependency discovery |

Every inquiry carries relational grounding (Wilson 2008), accountability markers, and optional Two-Eyed Seeing (Etuaptmumk) epistemological annotations.

## Installation

```bash
pnpm add ava-langchain-inquiry-routing ava-langchain-prompt-decomposition
```

## Quick Start

```typescript
import { generateInquiries } from "ava-langchain-inquiry-routing";
import { decompose } from "ava-langchain-prompt-decomposition";

const pde = await decompose("Build a knowledge graph grounded in indigenous epistemology...");
const result = generateInquiries(pde.decomposition);

console.log(`Generated ${result.batch.total} inquiries`);
console.log(result.markdown);
```

## Core Modules

| Module | Direction | Purpose |
|--------|-----------|---------|
| `InquiryGenerator` | 🌅 EAST | Extracts inquiries from PDE decomposition output |
| `InquiryRouter` | 🌿 SOUTH | Classifies and routes inquiries to channels |
| `RelationalEnricher` | 🌊 WEST | Adds Wilson's relational fields and Two-Eyed Seeing markers |
| `InquiryFormatter` | ⚡ NORTH | Formats inquiries for QMD, deep-search, markdown, JSON |

## API

### `generateInquiries(decomposition, options?)`

Convenience function that runs the full pipeline: Generate → Enrich → Route → Format.

```typescript
import { generateInquiries } from "ava-langchain-inquiry-routing";

const result = generateInquiries(decomposition, {
  generator: { includeAmbiguities: true, minConfidence: 0.3 },
  enricher: { addTwoEyedSeeing: true },
  routing: { confidenceThreshold: 0.4 },
});

// result.batch: RoutedInquiryBatch
// result.markdown: string
// result.json: string
```

### `InquiryGenerator`

Extracts inquiries from PDE decomposition output — directional insights become questions, ambiguities become verification inquiries, assumptions become verifiable claims.

```typescript
import { InquiryGenerator } from "ava-langchain-inquiry-routing";

const generator = new InquiryGenerator({
  includeAmbiguities: true,
  includeAssumptions: true,
  minConfidence: 0.3,
});

const batch = generator.generate(decomposition);
const flat = generator.flatten(batch);
```

### `InquiryRouter`

Routes inquiries to channels based on keyword classification and directional affinity.

```typescript
import { InquiryRouter } from "ava-langchain-inquiry-routing";

const router = new InquiryRouter({
  confidenceThreshold: 0.4,
  qmdKeywords: ["schema", "model"],
  deepSearchKeywords: ["Wilson", "ceremony"],
});

const decision = router.classify(inquiry);
const routedBatch = router.routeAll(batch);
```

### `RelationalEnricher`

Enriches inquiries with Wilson's relational accountability and Two-Eyed Seeing markers.

```typescript
import { RelationalEnricher } from "ava-langchain-inquiry-routing";

const enricher = new RelationalEnricher({
  addTwoEyedSeeing: true,
  addCeremonialIntent: true,
});

const enriched = enricher.enrich(inquiry, "Additional relational context");
const enrichedBatch = enricher.enrichBatch(batch);
```

### `InquiryFormatter`

Formats inquiries for different output channels.

```typescript
import { InquiryFormatter } from "ava-langchain-inquiry-routing";

const formatter = new InquiryFormatter();

const qmd = formatter.toQmdQuery(inquiry);       // { mode: "vec", query, direction }
const ds = formatter.toDeepSearchQuery(inquiry);  // { query, academic_context, search_terms }
const md = formatter.toMarkdown(batch);           // Structured markdown report
const json = formatter.toJSON(batch);             // JSON serialization
```

## Inquiry Structure

```typescript
interface Inquiry {
  id: string;
  timestamp: string;
  direction: 'east' | 'south' | 'west' | 'north';
  source: 'qmd-local' | 'deep-search-academic' | 'workspace-scan';
  query: string;
  response?: string;
  status: 'pending' | 'routed' | 'completed' | 'failed';

  // Relational grounding (Wilson's axiology)
  relational_context: string;
  accountability: string;
  ceremonial_intent?: string;

  // Two-Eyed Seeing markers
  indigenous_lens?: string;
  western_lens?: string;

  // Traceability
  pde_id: string;
  action_index?: number;
  confidence: number;
}
```

## Direction → Channel Affinity

| Direction | Default Channel | Rationale |
|-----------|----------------|-----------|
| 🌅 EAST (Vision) | QMD Local | Vision questions seek clarity from existing context |
| 🌿 SOUTH (Analysis) | Deep Search Academic | Learning questions seek external knowledge |
| 🌊 WEST (Validation) | QMD Local | Reflection questions test against existing work |
| ⚡ NORTH (Action) | Workspace Scan | Execution questions need file/dependency awareness |

## Related Packages

- [`ava-langchain-prompt-decomposition`](../prompt-decomposition/) — PDE primitives (upstream)
- `ava-langgraph-inquiry-routing-engine` — LangGraph orchestration engine (downstream, forthcoming)

## References

- Wilson, S. (2008). *Research is Ceremony: Indigenous Research Methods*
- Bartlett, C., Marshall, M., & Marshall, A. (2012). Two-Eyed Seeing (Etuaptmumk)
