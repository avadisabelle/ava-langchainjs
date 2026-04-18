# Getting Started with AvaLangStack

The AvaLangStack provides a powerful set of tools to build LLM applications grounded in narrative intelligence and indigenous relational paradigms. This guide will help you get started quickly.

## Installation

Our libraries are available as scoped npm packages. You can install individual packages using your preferred package manager:

```bash
# Using npm
npm install @avadisabelle/ava-langchain-prompt-decomposition
npm install @avadisabelle/ava-langchain-inquiry-routing
npm install @avadisabelle/ava-langchain-relational-intelligence
npm install @avadisabelle/ava-langchain-narrative-tracing
npm install @avadisabelle/ava-langchain-state-machine-spec

# Using pnpm
pnpm add @avadisabelle/ava-langchain-prompt-decomposition
pnpm add @avadisabelle/ava-langchain-inquiry-routing
pnpm add @avadisabelle/ava-langchain-relational-intelligence
pnpm add @avadisabelle/ava-langchain-narrative-tracing
pnpm add @avadisabelle/ava-langchain-state-machine-spec

# Using yarn
yarn add @avadisabelle/ava-langchain-prompt-decomposition
yarn add @avadisabelle/ava-langchain-inquiry-routing
yarn add @avadisabelle/ava-langchain-relational-intelligence
yarn add @avadisabelle/ava-langchain-narrative-tracing
yarn add @avadisabelle/ava-langchain-state-machine-spec
```

## Quick Example

Here's a quick example demonstrating how to use some of the AvaLangStack components. For more detailed examples, please see the [examples/src/avalangstack/](/examples/src/avalangstack/) directory in our repository.

```typescript
import { StructuralTensionChain } from "@avadisabelle/ava-langchain-relational-intelligence";
import { decompose } from "@avadisabelle/ava-langchain-prompt-decomposition";

async function runExample() {
  // Evaluate structural tension
  const chain = new StructuralTensionChain();
  const vector = chain.evaluate(
    "Monolith with no tests, team works in silos",
    "Microservices with full coverage, daily ceremonies"
  );
  console.log(`Tension magnitude: \${vector.magnitude}`);
  console.log(`Direction: \${vector.direction}`);

  // Decompose a complex prompt
  const result = await decompose("Build a knowledge graph with ceremony gating...");
  console.log(result.markdown);
}

runExample();
```

## Core Packages

Explore each of our core packages to understand their unique contributions to the AvaLangStack ecosystem.
