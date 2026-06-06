/**
 * PDE tree metadata helpers.
 *
 * This is the portable part of miaco's folder-backed PDE lineage model:
 * nested .pde folders, parent/child edges, runtime provenance, add-dir
 * inheritance, fallback metadata, and session identifiers. It intentionally
 * does not execute any external engine.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "fs";
import { basename, dirname, isAbsolute, join, resolve } from "path";

export const PDE_DIR = ".pde";
export const PDE_META_FILENAME = "meta.json";
export const PDE_METADATA_SCHEMA_VERSION = 4;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PDE_FOLDER_PATTERN =
  /^(?:\d{10}--)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export type ChildKind =
  | "milestone"
  | "issue"
  | "sub-task"
  | "follow-up"
  | "refinement"
  | "sibling";

export const CHILD_KINDS: readonly ChildKind[] = [
  "milestone",
  "issue",
  "sub-task",
  "follow-up",
  "refinement",
  "sibling",
] as const;

export type PdeSessionIdSource = "engine" | "manual" | "inherited" | "unknown";

export type PdeRuntimeEngine =
  | "heuristic"
  | "gemini"
  | "claude"
  | "copilot"
  | "codex"
  | "pva"
  | "hermes"
  | (string & {});

export interface ChildEntry {
  uuid: string;
  kind: ChildKind;
  created_at: string;
}

export interface EngineFallbackAttempt {
  engine: PdeRuntimeEngine;
  model?: string;
  ok: boolean;
  error?: string;
}

export interface PdeFallbackMetadata {
  reason: string;
  from_engine: PdeRuntimeEngine;
  to_engine: PdeRuntimeEngine;
  attempts: EngineFallbackAttempt[];
  triggered_at: string;
}

export interface PdeTreeMetadata {
  schema_version: number;
  root_pde_id: string;
  parent_pde_id?: string;
  parent_pde_dir?: string;
  child_kind?: ChildKind;
  children?: ChildEntry[];
  provenance?: Record<string, unknown>;
  engine: PdeRuntimeEngine;
  model?: string;
  pva_provider?: string;
  pva_thinking?: string;
  hermes_provider?: string;
  add_dirs?: string[];
  fallback?: PdeFallbackMetadata;
  session_id?: string;
  session_id_source?: PdeSessionIdSource;
  created_at: string;
  updated_at: string;
}

export interface PdeResolvedContext {
  folder: string;
  metadata?: PdeTreeMetadata;
}

export function normalizeAddDirs(values?: readonly string[]): string[] {
  if (!values) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of values) {
    for (const part of raw.split(",")) {
      const value = part.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      normalized.push(value);
    }
  }

  return normalized;
}

export function mergeAddDirs(
  ...sources: Array<readonly string[] | undefined>
): string[] | undefined {
  const merged = normalizeAddDirs(
    sources.flatMap((source) => (source ? [...source] : []))
  );
  return merged.length > 0 ? merged : undefined;
}

export function ensureDirectory(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

export function getPdeRoot(workdir: string): string {
  return join(workdir, PDE_DIR);
}

export function extractPdeUuidFromFolderName(folderName: string): string | null {
  return folderName.match(PDE_FOLDER_PATTERN)?.[1] ?? null;
}

export function extractPdeUuidFromPath(path: string): string | null {
  return extractPdeUuidFromFolderName(basename(path));
}

export function resolvePdeFolderPath(
  workdir: string,
  folderPath: string
): string | null {
  const resolved = isAbsolute(folderPath) ? folderPath : resolve(workdir, folderPath);
  try {
    if (!existsSync(resolved) || !statSync(resolved).isDirectory()) return null;
  } catch {
    return null;
  }
  return resolved;
}

export function findPdeFolder(workdir: string, uuidOrFolderName: string): string | null {
  const pdeRoot = getPdeRoot(workdir);
  if (!existsSync(pdeRoot)) return null;
  const uuid = extractPdeUuidFromFolderName(uuidOrFolderName) ?? uuidOrFolderName;
  const suffix = UUID_PATTERN.test(uuid) ? `--${uuid}` : null;

  function search(dir: string): string | null {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return null;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        if (!statSync(fullPath).isDirectory()) continue;
      } catch {
        continue;
      }
      if (entry === uuidOrFolderName || (suffix && entry.endsWith(suffix))) {
        return fullPath;
      }
      const found = search(fullPath);
      if (found) return found;
    }

    return null;
  }

  return search(pdeRoot);
}

export function readPdeTreeMetadata(folder: string): PdeTreeMetadata | null {
  const metaPath = join(folder, PDE_META_FILENAME);
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, "utf-8")) as PdeTreeMetadata;
  } catch {
    return null;
  }
}

export function writePdeTreeMetadata(
  folder: string,
  meta: PdeTreeMetadata
): string {
  ensureDirectory(folder);
  const path = join(folder, PDE_META_FILENAME);
  writeFileSync(path, JSON.stringify(meta, null, 2), "utf-8");
  return path;
}

export function resolvePdeContext(
  workdir: string,
  uuid: string
): PdeResolvedContext | null {
  const folder = findPdeFolder(workdir, uuid);
  if (!folder) return null;

  let current = folder;
  const pdeRoot = getPdeRoot(workdir);
  while (current.startsWith(pdeRoot)) {
    const metadata = readPdeTreeMetadata(current);
    if (metadata) return { folder, metadata };
    const parent = dirname(current);
    if (parent === current || parent.length < pdeRoot.length) break;
    current = parent;
  }

  return { folder };
}

export function resolvePdeContextByPath(
  workdir: string,
  folderPath: string
): PdeResolvedContext | null {
  const folder = resolvePdeFolderPath(workdir, folderPath);
  if (!folder) return null;
  const metadata = readPdeTreeMetadata(folder);
  return metadata ? { folder, metadata } : { folder };
}

export function buildPdeTreeMetadata(input: {
  rootPdeId: string;
  parentPdeId?: string;
  parentPdeDir?: string;
  childKind?: ChildKind;
  provenance?: Record<string, unknown>;
  engine?: PdeRuntimeEngine;
  model?: string;
  pvaProvider?: string;
  pvaThinking?: string;
  hermesProvider?: string;
  addDirs?: string[];
  fallback?: PdeFallbackMetadata;
  sessionId?: string;
  sessionIdSource?: PdeSessionIdSource;
  existing?: PdeTreeMetadata | null;
}): PdeTreeMetadata {
  const now = new Date().toISOString();
  const addDirs =
    input.addDirs !== undefined
      ? mergeAddDirs(input.existing?.add_dirs, input.addDirs)
      : input.existing?.add_dirs;

  return {
    schema_version: PDE_METADATA_SCHEMA_VERSION,
    root_pde_id: input.rootPdeId,
    parent_pde_id: input.parentPdeId ?? input.existing?.parent_pde_id,
    parent_pde_dir: input.parentPdeDir ?? input.existing?.parent_pde_dir,
    child_kind: input.childKind ?? input.existing?.child_kind,
    children: input.existing?.children,
    provenance: input.provenance ?? input.existing?.provenance,
    engine: input.engine ?? input.existing?.engine ?? "heuristic",
    model: input.model ?? input.existing?.model,
    pva_provider: input.pvaProvider ?? input.existing?.pva_provider,
    pva_thinking: input.pvaThinking ?? input.existing?.pva_thinking,
    hermes_provider: input.hermesProvider ?? input.existing?.hermes_provider,
    add_dirs: addDirs,
    fallback: input.fallback ?? input.existing?.fallback,
    session_id: input.sessionId ?? input.existing?.session_id,
    session_id_source: input.sessionId
      ? input.sessionIdSource ?? "manual"
      : input.existing?.session_id_source,
    created_at: input.existing?.created_at ?? now,
    updated_at: now,
  };
}

export function appendChildEntry(parentFolder: string, entry: ChildEntry): void {
  const meta = readPdeTreeMetadata(parentFolder);
  if (!meta) return;
  const children = meta.children ?? [];
  if (children.some((child) => child.uuid === entry.uuid)) return;
  meta.children = [...children, entry];
  meta.updated_at = new Date().toISOString();
  writePdeTreeMetadata(parentFolder, meta);
}

export function updatePdeTreeMetadata(
  folder: string,
  patch: {
    engine?: PdeRuntimeEngine;
    model?: string;
    pvaProvider?: string;
    pvaThinking?: string;
    hermesProvider?: string;
    addDirs?: string[];
    sessionId?: string;
    sessionIdSource?: PdeSessionIdSource;
    fallback?: PdeFallbackMetadata;
  }
): PdeTreeMetadata | null {
  const existing = readPdeTreeMetadata(folder);
  if (!existing) return null;
  const next = buildPdeTreeMetadata({
    rootPdeId: existing.root_pde_id,
    parentPdeId: existing.parent_pde_id,
    parentPdeDir: existing.parent_pde_dir,
    childKind: existing.child_kind,
    provenance: existing.provenance,
    engine: patch.engine ?? existing.engine,
    model: patch.model ?? existing.model,
    pvaProvider: patch.pvaProvider ?? existing.pva_provider,
    pvaThinking: patch.pvaThinking ?? existing.pva_thinking,
    hermesProvider: patch.hermesProvider ?? existing.hermes_provider,
    addDirs: patch.addDirs,
    fallback: patch.fallback ?? existing.fallback,
    sessionId: patch.sessionId ?? existing.session_id,
    sessionIdSource: patch.sessionId
      ? patch.sessionIdSource ?? existing.session_id_source
      : existing.session_id_source,
    existing,
  });
  writePdeTreeMetadata(folder, next);
  return next;
}
