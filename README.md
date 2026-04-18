# 🌿 AvaLangStack — Narrative Intelligence Ecosystem

![npm](https://img.shields.io/npm/dm/langchain) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Twitter](https://img.shields.io/twitter/url/https/twitter.com/langchain.svg?style=social&label=Follow%20%40LangChain)](https://x.com/langchain)

The AvaLangStack is a collection of custom libraries designed to infuse **Narrative Intelligence** and **Indigenous relational paradigms** into LLM-powered applications. It builds upon the robust foundation of LangChain.js to create systems that prioritize relational accountability, ceremonial context, and a deeper understanding of intent and causality.

## 📦 AvaLangStack — Custom Libraries

This repository contains the core custom libraries for the **AvaLangStack Narrative Intelligence ecosystem**:

| Package | Description |
|---------|-------------|
| `ava-langchain-prompt-decomposition` | Four Directions PDE primitives — decomposes prompts through Medicine Wheel directions |
| `ava-langchain-inquiry-routing` | Inquiry routing with directional classification and confidence scoring |
| `ava-langchain-relational-intelligence` | Indigenous relational paradigm — MedicineWheelFilter, StructuralTensionChain, FireKeeper |
| `ava-langchain-narrative-tracing` | Langfuse-based narrative observability with EpisodeBundler and PolyphonicParser |
| `ava-langchain-state-machine-spec` | Declarative workflow specs with accountability-as-routing |

### Key Design Principles

- **Zero LLM dependency** — all primitives use keyword-based analysis, not model calls
- **Four Directions as control flow** — EAST (vision) → SOUTH (planning) → WEST (action) → NORTH (reflection)
- **Structural tension as routing signal** — the gap between current reality and desired outcome drives workflow
- **Ceremony gating** — some operations require explicit consent or ceremony before proceeding

### Quick Example

```typescript
import { StructuralTensionChain } from "ava-langchain-relational-intelligence";
import { decompose } from "ava-langchain-prompt-decomposition";

// Evaluate structural tension
const chain = new StructuralTensionChain();
const vector = chain.evaluate(
  "Monolith with no tests, team works in silos",
  "Microservices with full coverage, daily ceremonies"
);
console.log(`Tension magnitude: ${vector.magnitude}`);
console.log(`Direction: ${vector.direction}`);

// Decompose a complex prompt
const result = await decompose("Build a knowledge graph with ceremony gating...");
console.log(result.markdown);
```

See [examples/src/avalangstack/](examples/src/avalangstack/) for complete demonstrations.

> **Consumer**: These chain primitives are consumed by [ava-langgraphjs](https://github.com/avadisabelle/ava-langgraphjs) which wraps them in StateGraph pipelines.

## ⚡️ Quick Install

To install any of the AvaLangStack packages, use your preferred package manager by their package name:

```bash
# Using npm
npm install ava-langchain-prompt-decomposition
npm install ava-langchain-inquiry-routing
# ... and so on for other packages

# Using pnpm
pnpm add ava-langchain-prompt-decomposition
pnpm add ava-langchain-inquiry-routing
# ... and so on for other packages

# Using yarn
yarn add ava-langchain-prompt-decomposition
yarn add ava-langchain-inquiry-routing
# ... and so on for other packages
```

## LangChain.js Foundation

The AvaLangStack is built upon the powerful LangChain.js framework. LangChain provides the foundational components for building LLM-powered applications, offering a standard interface for agents, models, embeddings, vector stores, and more.

For more information on the underlying LangChain.js framework, its core concepts, and its ecosystem, please refer to the following resources:

*   **Documentation**: [LangChain.js Docs](https://docs.langchain.com/oss/javascript/langchain/overview)
*   **Why use LangChain?**: LangChain helps developers build applications powered by LLMs through a standard interface for agents, models, embeddings, vector stores, and more. It enables real-time data augmentation, model interoperability, rapid prototyping, and production-ready features within a vibrant community and flexible abstraction layers.
*   **LangChain's ecosystem**: Explore [LangSmith](https://www.langchain.com/langsmith) for testing and monitoring, and [LangGraph](https://docs.langchain.com/oss/javascript/langgraph/overview) for agent orchestration.
*   **Supported Environments**: LangChain.js is written in TypeScript and supports Node.js, Cloudflare Workers, Vercel/Next.js, Supabase Edge Functions, Browser, Deno, and Bun environments.
*   **Additional Resources**:
    *   [Getting started](https://docs.langchain.com/oss/javascript/langchain/overview)
    *   [Learn](https://docs.langchain.com/oss/javascript/learn)
    *   [LangChain Forum](https://forum.langchain.com)
    *   [Chat LangChain](https://chat.langchain.com)

## 💁 Contributing to AvaLangStack

We welcome contributions to the AvaLangStack! Whether it's a new feature, an improved design principle, or better documentation that clarifies the narrative intelligence concepts, your contributions are valued.

For detailed information on how to contribute, please see our specific [`CONTRIBUTING.md`](./CONTRIBUTING.md).

Please report any security issues or concerns following our [security guidelines](https://github.com/avadisabelle/ava-langchainjs/blob/main/.github/SECURITY.md).