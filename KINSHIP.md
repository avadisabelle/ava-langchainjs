# KINSHIP

## 1. Identity and Purpose
- **Name:** Ava LangChain.js Extensions
- **Local role in this system:** Chain primitives for narrative intelligence — the building blocks that higher-level graph engines and agent surfaces consume
- **What this place tends / protects:** The integrity of individual chain operations: prompt decomposition, inquiry routing, narrative tracing, ontology bridging. Each chain is a single, composable unit of relational computation.
- **What this place offers (its gifts):** prompt-decomposition, inquiry-routing, narrative-tracing, v0-ontology-bridge

## 2. Lineage and Relations
- **Ancestors (paths or systems this place comes from):**
  - LangChain.js (upstream framework — `@langchain/core`)
  - medicine-wheel-pi (conceptual prototype for directional decomposition and inquiry routing)
  - mcp-pde (canonical PDE types and `.pde/` storage, from IAIP)
- **Descendants (children / submodules / subdirectories):**
  - `libs/prompt-decomposition/` — `ava-langchain-prompt-decomposition` (Four Directions PDE)
  - `libs/inquiry-routing/` — `ava-langchain-inquiry-routing` (inquiry generation, routing, enrichment, formatting)
- **Siblings (peer projects or services it walks with):**
  - `/workspace/repos/avadisabelle/ava-langgraphjs` — graph-level orchestration that consumes these chain primitives as peer dependencies
- **Related hubs (other roots it is in strong relation with):**
  - `/a/src/mia-code` — primary consumer of the full LangStack
  - `/workspace/repos/avadisabelle/ava-Flowise` — Flowise node integration
  - `/workspace/repos/avadisabelle/ava-claw` — agentic presence layer
  - coaia-narrative — JSONL output format for STC charts

## 3. Human and More‑than‑Human Accountabilities
- **People / roles this place is accountable to:** Guillaume D. Isabelle (steward, architect); Ava (agentic presence); Mia (orchestration agent)
- **Communities / nations / organizations connected here:** IAIP (Indigenous AI Protocols) community; the Relational Development Ecology participants
- **More‑than‑human relations:** The Medicine Wheel as epistemological framework — East/South/West/North are not metaphors here but structural orientations that guide decomposition and routing. Wilson's (2008) relational ontology shapes how inquiries carry accountability.
- **Existing covenants / consents that apply:** Two-Eyed Seeing (Etuaptmumk) — every inquiry carries both `indigenous_lens` and `western_lens`, neither absent. OCAP principles respected in data handling.

## 4. Responsibilities and Boundaries
- **Responsibilities:** Maintain composable, single-purpose chain primitives. Never bundle graph-level orchestration into this repo — that belongs to ava-langgraphjs.
- **Reciprocity:** Upstream LangChain.js patterns are respected and extended, not replaced. Contributions upstream where applicable.
- **Boundaries and NOs:**
  - No LLM runtime coupling — chain primitives use keyword-based classification, not model inference
  - No graph-level state machines — those belong in the sibling ava-langgraphjs
  - No direct CLI or UI surfaces — this is a library consumed by higher layers
- **Special protocols:** Relational fields (`relational_context`, `accountability`, `ceremonial_intent`) are structurally required, not optional decorations

## 5. Accountability and Change Log
- **Steward(s) of this place:** Guillaume D. Isabelle, with Mia as technical steward
- **How and when this kinship description should be reviewed:** On every new library addition to `libs/`, and quarterly for relational accuracy
- **Relational change log:**
  - [2025-06-00] [PDE sessions] — prompt-decomposition library established as first child, porting Four Directions from medicine-wheel-pi
  - [2025-06-00] [Mia] — inquiry-routing library born as second child, transforming PDE output into routable, relationally-grounded inquiries
  - [2025-06-30] [Mia] — KINSHIP.md created, naming lineage and establishing relational boundaries
