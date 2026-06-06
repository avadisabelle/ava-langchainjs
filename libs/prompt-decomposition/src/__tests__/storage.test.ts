import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { Direction } from "../directional_decomposer.js";
import type { DecompositionResult } from "../action_stack.js";
import {
  loadDecomposition,
  saveDecomposition,
  saveDecompositionTree,
  saveStrategicDecomposition,
  listDecompositions,
} from "../storage.js";
import { readPdeTreeMetadata } from "../pde_metadata.js";
import { StrategicDecomposer } from "../strategy_spec.js";

function createDecomposition(id: string, prompt = "Research. Build. Test."): DecompositionResult {
  return {
    id,
    timestamp: new Date().toISOString(),
    prompt,
    primary: {
      action: "create",
      target: "module",
      urgency: "session",
      confidence: 0.9,
    },
    secondary: [],
    context: {
      filesNeeded: [],
      toolsRequired: [],
      assumptions: [],
    },
    outputs: {
      artifacts: ["module"],
      updates: [],
      communications: [],
    },
    directions: {
      [Direction.EAST]: [{ text: "Research.", confidence: 0.8, implicit: false }],
      [Direction.SOUTH]: [],
      [Direction.WEST]: [{ text: "Test.", confidence: 0.8, implicit: false }],
      [Direction.NORTH]: [{ text: "Build.", confidence: 0.8, implicit: false }],
    },
    actionStack: [
      {
        id: "action-1",
        text: "Build module",
        direction: Direction.NORTH,
        dependency: null,
        completed: false,
        confidence: 0.9,
        implicit: false,
      },
    ],
    balance: 0.75,
    leadDirection: Direction.NORTH,
    neglectedDirections: [],
    ambiguities: [],
  };
}

function withTempWorkdir<T>(fn: (workdir: string) => T): T {
  const workdir = mkdtempSync(join(tmpdir(), "ava-pde-storage-"));
  try {
    return fn(workdir);
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

async function withTempWorkdirAsync<T>(
  fn: (workdir: string) => Promise<T>
): Promise<T> {
  const workdir = mkdtempSync(join(tmpdir(), "ava-pde-storage-"));
  try {
    return await fn(workdir);
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

describe("PDE storage", () => {
  it("keeps flat storage as the default layout", () => {
    withTempWorkdir((workdir) => {
      const result = createDecomposition("11111111-1111-4111-8111-111111111111");
      const stored = saveDecomposition(workdir, result, {
        provenance: { source: "test" },
      });

      expect(stored.pde_dir).toBeUndefined();
      expect(stored.provenance).toEqual({ source: "test" });
      expect(stored.markdownPath).toBe(join(workdir, ".pde", `${result.id}.md`));
      expect(loadDecomposition(workdir, result.id)?.provenance).toEqual({
        source: "test",
      });
    });
  });

  it("can save and load miaco-style tree storage with metadata", () => {
    withTempWorkdir((workdir) => {
      const result = createDecomposition("22222222-2222-4222-8222-222222222222");
      const stored = saveDecomposition(workdir, result, {
        layout: "tree",
        engine: "codex",
        model: "gpt-5.4-mini",
        sessionId: "session-1",
        sessionIdSource: "engine",
        addDirs: ["../shared", "../docs,../shared"],
      });

      expect(stored.pde_dir).toContain(result.id);
      expect(stored.markdownPath).toBe(join(stored.pde_dir!, `pde-${result.id}.md`));
      expect(loadDecomposition(workdir, result.id)?.id).toBe(result.id);

      const metadata = readPdeTreeMetadata(stored.pde_dir!);
      expect(metadata?.engine).toBe("codex");
      expect(metadata?.model).toBe("gpt-5.4-mini");
      expect(metadata?.session_id).toBe("session-1");
      expect(metadata?.session_id_source).toBe("engine");
      expect(metadata?.add_dirs).toEqual(["../shared", "../docs"]);
    });
  });

  it("nests child PDEs under parents and records reverse child edges", () => {
    withTempWorkdir((workdir) => {
      const parent = createDecomposition("33333333-3333-4333-8333-333333333333");
      const child = createDecomposition("44444444-4444-4444-8444-444444444444");

      const storedParent = saveDecompositionTree(workdir, parent, {
        engine: "pva",
        sessionId: "session-parent",
        addDirs: ["../one"],
      });
      const storedChild = saveDecompositionTree(workdir, child, {
        parentPdeId: parent.id,
        childKind: "issue",
        addDirs: ["../two"],
      });

      expect(storedChild.pde_dir).toContain(storedParent.pde_dir!);
      expect(loadDecomposition(workdir, child.id)?.parent_pde_id).toBe(parent.id);

      const parentMeta = readPdeTreeMetadata(storedParent.pde_dir!);
      const childMeta = readPdeTreeMetadata(storedChild.pde_dir!);
      expect(parentMeta?.children).toEqual([
        expect.objectContaining({ uuid: child.id, kind: "issue" }),
      ]);
      expect(childMeta?.root_pde_id).toBe(parent.id);
      expect(childMeta?.session_id).toBe("session-parent");
      expect(childMeta?.session_id_source).toBe("inherited");
      expect(childMeta?.add_dirs).toEqual(["../one", "../two"]);
    });
  });

  it("lists flat and tree decompositions newest first", () => {
    withTempWorkdir((workdir) => {
      const older = createDecomposition("55555555-5555-4555-8555-555555555555");
      older.timestamp = "2026-01-01T00:00:00.000Z";
      const newer = createDecomposition("66666666-6666-4666-8666-666666666666");
      newer.timestamp = "2026-01-02T00:00:00.000Z";

      saveDecomposition(workdir, older);
      saveDecompositionTree(workdir, newer);

      expect(listDecompositions(workdir).map((item) => item.id)).toEqual([
        newer.id,
        older.id,
      ]);
    });
  });

  it("persists strategic metadata in tree records and metadata", async () => {
    await withTempWorkdirAsync(async (workdir) => {
      const strategic = await new StrategicDecomposer().decompose(
        "Research the options, build a module, and validate it."
      );
      const stored = saveStrategicDecomposition(workdir, strategic, {
        layout: "tree",
        engine: "codex",
        provenance: { source: "langgraph" },
      });

      expect(stored.provenance?.source).toBe("langgraph");
      expect(stored.provenance?.strategy).toEqual(
        expect.objectContaining({
          schemaVersion: 1,
          strategyId: strategic.result.strategyId,
          timestamp: strategic.result.decomposition.timestamp,
        })
      );

      const metadata = readPdeTreeMetadata(stored.pde_dir!);
      expect(metadata?.provenance).toEqual(stored.provenance);
      expect(loadDecomposition(workdir, stored.id)?.provenance).toEqual(
        stored.provenance
      );
    });
  });
});
