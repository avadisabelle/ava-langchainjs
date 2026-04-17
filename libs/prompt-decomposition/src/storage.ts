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

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import type { DecompositionResult, AmbiguityFlag } from "./action_stack.js";

const PDE_DIR = ".pde";

// =============================================================================
// Types
// =============================================================================

export interface StoredDecomposition {
  id: string;
  timestamp: string;
  prompt: string;
  result: DecompositionResult;
  markdownPath?: string;
}

// =============================================================================
// Storage Functions
// =============================================================================

function ensureDir(workdir: string): string {
  const dir = join(workdir, PDE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Save a decomposition to .pde/ as JSON + Markdown.
 */
export function saveDecomposition(
  workdir: string,
  result: DecompositionResult
): StoredDecomposition {
  const dir = ensureDir(workdir);
  const stored: StoredDecomposition = {
    id: result.id,
    timestamp: result.timestamp,
    prompt: result.prompt,
    result,
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
 * Load a stored decomposition by ID.
 */
export function loadDecomposition(workdir: string, id: string): StoredDecomposition | null {
  const jsonPath = join(workdir, PDE_DIR, `${id}.json`);
  if (!existsSync(jsonPath)) return null;
  const raw = readFileSync(jsonPath, "utf-8");
  return JSON.parse(raw) as StoredDecomposition;
}

/**
 * List stored decompositions, newest first.
 */
export function listDecompositions(workdir: string, limit?: number): StoredDecomposition[] {
  const dir = join(workdir, PDE_DIR);
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();

  const limited = limit ? files.slice(0, limit) : files;
  return limited.map((f) => {
    const raw = readFileSync(join(dir, f), "utf-8");
    return JSON.parse(raw) as StoredDecomposition;
  });
}

/**
 * Convert a DecompositionResult to git-diffable Markdown.
 * Includes Four Directions header and structured ambiguity flags.
 */
export function decompositionToMarkdown(result: DecompositionResult): string {
  const lines: string[] = [];

  lines.push("# Prompt Decomposition");
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
