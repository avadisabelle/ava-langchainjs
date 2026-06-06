/**
 * PDE Storage — .pde/ dot folder persistence
 *
 * Ported from mcp-pde/src/storage.ts (IAIP lineage).
 * Stores decompositions as JSON files in .pde/ directory,
 * with Markdown exports for human-in-the-loop editing via git diff.
 *
 * Storage layout:
 *   .pde/
 *     <id>.json   — StoredDecomposition (full JSON)
 *     <id>.md     — Markdown export (human-editable, git-diffable)
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import type { DecompositionResult } from "./action_stack.js";
import {
  extractStrategyMetadata,
  type StrategicDecompositionResult,
} from "./strategy_spec.js";
import {
  PDE_DIR,
  appendChildEntry,
  buildPdeTreeMetadata,
  ensureDirectory,
  extractPdeUuidFromPath,
  findPdeFolder,
  getPdeRoot,
  mergeAddDirs,
  readPdeTreeMetadata,
  writePdeTreeMetadata,
  type ChildKind,
  type PdeFallbackMetadata,
  type PdeRuntimeEngine,
  type PdeSessionIdSource,
} from "./pde_metadata.js";

// =============================================================================
// Types
// =============================================================================

export interface StoredDecomposition {
  id: string;
  timestamp: string;
  prompt: string;
  result: DecompositionResult;
  engine?: PdeRuntimeEngine;
  model?: string;
  parent_pde_id?: string;
  child_kind?: ChildKind;
  fallback?: PdeFallbackMetadata;
  provenance?: Record<string, unknown>;
  folder_name?: string;
  pde_dir?: string;
  markdownPath?: string;
}

export type PdeStorageLayout = "flat" | "tree";

export interface SaveDecompositionOptions {
  /** Legacy flat storage is the default for backward compatibility. */
  layout?: PdeStorageLayout;
  engine?: PdeRuntimeEngine;
  model?: string;
  sessionId?: string;
  sessionIdSource?: PdeSessionIdSource;
  parentPdeId?: string;
  parentPdeFolder?: string;
  childKind?: ChildKind;
  provenance?: Record<string, unknown>;
  addDirs?: string[];
  pvaProvider?: string;
  pvaThinking?: string;
  hermesProvider?: string;
  fallback?: PdeFallbackMetadata;
}

// =============================================================================
// Storage Functions
// =============================================================================

function ensureDir(workdir: string): string {
  const dir = getPdeRoot(workdir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function generateTimestamp(): string {
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yy}${mm}${dd}${hh}${min}`;
}

function collectStoredDecompositionFiles(root: string): string[] {
  const results: string[] = [];
  if (!existsSync(root)) return results;

  function visit(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        visit(fullPath);
        continue;
      }

      const isTreeRecord = entry.startsWith("pde-") && entry.endsWith(".json");
      const isLegacyRootRecord =
        dir === root && entry.endsWith(".json") && entry !== "meta.json";
      if (stat.isFile() && (isTreeRecord || isLegacyRootRecord)) {
        results.push(fullPath);
      }
    }
  }

  visit(root);
  return results;
}

function withProvenanceKind(
  provenance: Record<string, unknown> | undefined,
  childKind: ChildKind | undefined
): Record<string, unknown> | undefined {
  if (!childKind) return provenance;
  if (provenance && Object.prototype.hasOwnProperty.call(provenance, "kind")) {
    return provenance;
  }
  return { ...(provenance ?? {}), kind: childKind };
}

/**
 * Save a decomposition to .pde/ as JSON + Markdown.
 */
export function saveDecomposition(
  workdir: string,
  result: DecompositionResult,
  options: SaveDecompositionOptions = {}
): StoredDecomposition {
  if (options.layout === "tree") {
    return saveDecompositionTree(workdir, result, options);
  }

  const dir = ensureDir(workdir);
  const stored: StoredDecomposition = {
    id: result.id,
    timestamp: result.timestamp,
    prompt: result.prompt,
    result,
    provenance: options.provenance,
  };

  // Save JSON
  const jsonPath = join(dir, `${result.id}.json`);
  writeFileSync(jsonPath, JSON.stringify(stored, null, 2), "utf-8");

  // Save Markdown
  const mdPath = join(dir, `${result.id}.md`);
  const md = decompositionToMarkdown(result);
  writeFileSync(mdPath, md, "utf-8");
  stored.markdownPath = mdPath;

  return stored;
}

/**
 * Save a decomposition using miaco-style folder-backed PDE tree storage.
 *
 * Layout:
 *   .pde/<timestamp>--<uuid>/pde-<uuid>.json
 *   .pde/<timestamp>--<uuid>/pde-<uuid>.md
 *   .pde/<timestamp>--<uuid>/meta.json
 *
 * Children are nested under their parent folder and recorded in the parent's
 * metadata children[] reverse edge.
 */
export function saveDecompositionTree(
  workdir: string,
  result: DecompositionResult,
  options: Omit<SaveDecompositionOptions, "layout"> = {}
): StoredDecomposition {
  const pdeRoot = ensureDir(workdir);
  const folderName = `${generateTimestamp()}--${result.id}`;

  let parentFolder: string | null = options.parentPdeFolder ?? null;
  if (options.parentPdeId && !parentFolder) {
    parentFolder = findPdeFolder(workdir, options.parentPdeId);
  }
  if (options.parentPdeId && !parentFolder) {
    throw new Error(`Parent PDE not found: ${options.parentPdeId}`);
  }

  const inheritedMeta = parentFolder ? readPdeTreeMetadata(parentFolder) : null;
  const targetDir = parentFolder ? join(parentFolder, folderName) : join(pdeRoot, folderName);
  ensureDirectory(targetDir);

  const sessionId = options.sessionId ?? inheritedMeta?.session_id;
  const sessionIdSource: PdeSessionIdSource | undefined = options.sessionId
    ? options.sessionIdSource ?? "manual"
    : inheritedMeta?.session_id
      ? "inherited"
      : undefined;
  const addDirs = mergeAddDirs(inheritedMeta?.add_dirs, options.addDirs);
  const parentPdeId =
    options.parentPdeId ?? (parentFolder ? extractPdeUuidFromPath(parentFolder) ?? undefined : undefined);
  const provenance = withProvenanceKind(options.provenance, options.childKind);

  const stored: StoredDecomposition = {
    id: result.id,
    timestamp: result.timestamp,
    prompt: result.prompt,
    result,
    engine: options.engine ?? inheritedMeta?.engine ?? "heuristic",
    model: options.model ?? inheritedMeta?.model,
    parent_pde_id: parentPdeId,
    child_kind: options.childKind,
    fallback: options.fallback,
    provenance,
    folder_name: folderName,
    pde_dir: targetDir,
  };

  const jsonPath = join(targetDir, `pde-${result.id}.json`);
  writeFileSync(jsonPath, JSON.stringify(stored, null, 2), "utf-8");

  const mdPath = join(targetDir, `pde-${result.id}.md`);
  const md = decompositionToMarkdown(result, {
    engine: stored.engine,
    model: stored.model,
    parentPdeId,
  });
  writeFileSync(mdPath, md, "utf-8");
  stored.markdownPath = mdPath;

  const metadata = buildPdeTreeMetadata({
    rootPdeId: inheritedMeta?.root_pde_id ?? result.id,
    parentPdeId,
    parentPdeDir: parentFolder ?? undefined,
    childKind: options.childKind,
    provenance,
    engine: stored.engine,
    model: stored.model,
    pvaProvider: options.pvaProvider ?? inheritedMeta?.pva_provider,
    pvaThinking: options.pvaThinking ?? inheritedMeta?.pva_thinking,
    hermesProvider: options.hermesProvider ?? inheritedMeta?.hermes_provider,
    addDirs,
    fallback: options.fallback,
    sessionId,
    sessionIdSource,
  });
  writePdeTreeMetadata(targetDir, metadata);

  if (parentFolder) {
    appendChildEntry(parentFolder, {
      uuid: result.id,
      kind: options.childKind ?? "sibling",
      created_at: stored.timestamp,
    });
  }

  return stored;
}

/**
 * Persist a strategy-aware result while retaining the stable
 * DecompositionResult record shape and adding strategy provenance.
 */
export function saveStrategicDecomposition(
  workdir: string,
  result: StrategicDecompositionResult,
  options: SaveDecompositionOptions = {}
): StoredDecomposition {
  return saveDecomposition(workdir, result.result.decomposition, {
    ...options,
    provenance: {
      ...(options.provenance ?? {}),
      strategy: extractStrategyMetadata(result),
    },
  });
}

/**
 * Load a stored decomposition by ID.
 */
export function loadDecomposition(workdir: string, id: string): StoredDecomposition | null {
  const folder = findPdeFolder(workdir, id);
  if (folder) {
    const uuid = extractPdeUuidFromPath(folder) ?? id;
    const treePath = join(folder, `pde-${uuid}.json`);
    if (existsSync(treePath)) {
      const raw = readFileSync(treePath, "utf-8");
      return JSON.parse(raw) as StoredDecomposition;
    }
  }

  const legacyPath = join(workdir, PDE_DIR, `${id}.json`);
  if (!existsSync(legacyPath)) return null;
  const raw = readFileSync(legacyPath, "utf-8");
  return JSON.parse(raw) as StoredDecomposition;
}

/**
 * List stored decompositions, newest first.
 */
export function listDecompositions(workdir: string, limit?: number): StoredDecomposition[] {
  const dir = join(workdir, PDE_DIR);
  if (!existsSync(dir)) return [];

  const files = collectStoredDecompositionFiles(dir);
  const items: StoredDecomposition[] = [];
  for (const file of files) {
    try {
      const raw = readFileSync(file, "utf-8");
      const parsed = JSON.parse(raw) as Partial<StoredDecomposition>;
      if (parsed.id && parsed.result) items.push(parsed as StoredDecomposition);
    } catch {
      // Ignore malformed or non-storage JSON.
    }
  }

  items.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return limit ? items.slice(0, limit) : items;
}

/**
 * Convert a DecompositionResult to git-diffable Markdown.
 * Includes Four Directions header and structured ambiguity flags.
 */
export interface DecompositionMarkdownOptions {
  engine?: PdeRuntimeEngine;
  model?: string;
  parentPdeId?: string;
}

export function decompositionToMarkdown(
  result: DecompositionResult,
  options: DecompositionMarkdownOptions = {}
): string {
  const lines: string[] = [];

  lines.push("# Prompt Decomposition");
  if (options.engine) {
    lines.push("");
    lines.push(`> Engine: **${options.engine}**${options.model ? ` (${options.model})` : ""}`);
  }
  if (options.parentPdeId) {
    lines.push("");
    lines.push(`> Parent PDE: ${options.parentPdeId}`);
  }
  lines.push("");

  // Four Directions legend
  lines.push("## Directions");
  lines.push("");
  lines.push("- 🌅 **EAST** — VISION: What is being asked?");
  lines.push("- 🔥 **SOUTH** — ANALYSIS: What needs to be learned?");
  lines.push("- 🌊 **WEST** — VALIDATION: What needs reflection?");
  lines.push("- ❄️ **NORTH** — ACTION: What executes the cycle?");
  lines.push("");

  // Original prompt
  lines.push("## Original Prompt");
  lines.push("");
  lines.push(`> ${result.prompt.replace(/\n/g, "\n> ")}`);
  lines.push("");

  // Primary Intent
  lines.push("## Primary Intent");
  lines.push("");
  lines.push(`**Action:** ${result.primary.action}`);
  lines.push(`**Target:** ${result.primary.target}`);
  lines.push(`**Urgency:** ${result.primary.urgency}`);
  lines.push(`**Confidence:** ${Math.round(result.primary.confidence * 100)}%`);
  lines.push("");

  // Secondary Intents
  if (result.secondary.length > 0) {
    lines.push("## Secondary Intents");
    lines.push("");
    for (let i = 0; i < result.secondary.length; i++) {
      const s = result.secondary[i];
      lines.push(`${i + 1}. **${s.action}** — ${s.target} _(${s.implicit ? "implicit" : "explicit"})_`);
      if (s.dependency) lines.push(`   - depends on: ${s.dependency}`);
    }
    lines.push("");
  }

  // Context
  const ctx = result.context;
  if (ctx.filesNeeded.length || ctx.toolsRequired.length || ctx.assumptions.length) {
    lines.push("## Context Requirements");
    lines.push("");
    if (ctx.filesNeeded.length) {
      lines.push("### Files Needed");
      ctx.filesNeeded.forEach((f) => lines.push(`- ${f}`));
      lines.push("");
    }
    if (ctx.toolsRequired.length) {
      lines.push("### Tools Required");
      ctx.toolsRequired.forEach((t) => lines.push(`- ${t}`));
      lines.push("");
    }
    if (ctx.assumptions.length) {
      lines.push("### Assumptions");
      ctx.assumptions.forEach((a) => lines.push(`- ${a}`));
      lines.push("");
    }
  }

  // Four Directions detail
  const dirEmoji: Record<string, string> = { east: "🌅", south: "🔥", west: "🌊", north: "❄️" };
  const dirName: Record<string, string> = { east: "VISION", south: "ANALYSIS", west: "VALIDATION", north: "ACTION" };

  lines.push("## Four Directions Analysis");
  lines.push("");
  for (const dir of ["east", "south", "west", "north"]) {
    const items = result.directions[dir as keyof typeof result.directions];
    if (!items || items.length === 0) continue;
    lines.push(`### ${dirEmoji[dir]} ${dir.toUpperCase()} — ${dirName[dir]}`);
    lines.push("");
    for (const item of items) {
      const tag = item.implicit ? " _(implicit)_" : "";
      lines.push(`- ${item.text} [${Math.round(item.confidence * 100)}%]${tag}`);
    }
    lines.push("");
  }

  // Action Stack
  if (result.actionStack.length > 0) {
    lines.push("## Action Stack");
    lines.push("");
    for (const action of result.actionStack) {
      const check = action.completed ? "x" : " ";
      const dep = action.dependency ? ` (depends on: ${action.dependency})` : "";
      lines.push(`- [${check}] ${action.text}${dep}`);
    }
    lines.push("");
  }

  // Ambiguity Flags (structured)
  if (result.ambiguities.length > 0) {
    lines.push("## Ambiguity Flags");
    lines.push("");
    for (const a of result.ambiguities) {
      lines.push(`- **"${a.text}"**`);
      lines.push(`  - Suggestion: ${a.suggestion}`);
    }
    lines.push("");
  }

  // Expected Outputs
  const out = result.outputs;
  if (out.artifacts.length || out.updates.length || out.communications.length) {
    lines.push("## Expected Outputs");
    lines.push("");
    if (out.artifacts.length) {
      lines.push("### Artifacts");
      out.artifacts.forEach((a) => lines.push(`- ${a}`));
      lines.push("");
    }
    if (out.updates.length) {
      lines.push("### Updates");
      out.updates.forEach((u) => lines.push(`- ${u}`));
      lines.push("");
    }
    if (out.communications.length) {
      lines.push("### Communications");
      out.communications.forEach((c) => lines.push(`- ${c}`));
      lines.push("");
    }
  }

  return lines.join("\n");
}
