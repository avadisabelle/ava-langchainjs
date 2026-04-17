import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "adapters/index": "src/adapters/index.ts",
    "adapters/prompt_decomposition_bridge": "src/adapters/prompt_decomposition_bridge.ts",
    "adapters/relational_intelligence_bridge": "src/adapters/relational_intelligence_bridge.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
});
