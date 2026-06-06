# SPEC - miaco PDE Tree Lineage for Prompt Decomposition

> Package: `ava-langchain-prompt-decomposition`
> Reference lineage: `/workspace/repos/jgwill/mia-code`
> Status: implemented in package source

`mia-code` and AvaStack remain separate implementation lineages. This work
adopts portable storage concepts without coupling either repository or treating
one package family as the source of the other.

## Desired Outcome

Prompt decomposition consumers can preserve miaco-style PDE lineage without depending on the miaco CLI. A decomposition may be stored as a folder-backed tree with `meta.json`, parent-child edges, session identifiers, runtime provenance, fallback metadata, and inherited add-dir context.

## Current Reality

The package already decomposes prompts into Four Directions and stores legacy flat artifacts at `.pde/<id>.json` and `.pde/<id>.md`. That layout is useful for simple consumers but cannot represent nested PDE trees, child-kind taxonomy, inherited session IDs, add-dir replay, or engine fallback provenance.

## Reverse Engineering Notes

Recent miaco evolution added these portable concepts:

| miaco concept | JavaScript package representation |
| --- | --- |
| `.pde/<timestamp>--<uuid>/` folders | opt-in `layout: "tree"` storage |
| `meta.json` schema version 4 | `PdeTreeMetadata` |
| `children[]` reverse edges | `appendChildEntry()` |
| `--child-kind` taxonomy | `ChildKind` and `CHILD_KINDS` |
| inherited `add_dirs` | `normalizeAddDirs()` and `mergeAddDirs()` |
| provider/session metadata | `engine`, `model`, `session_id`, provider fields |
| fallback chain evidence | `PdeFallbackMetadata` |

## Specification

### Storage Compatibility

WHEN `saveDecomposition(workdir, result)` is called without storage options
THE SYSTEM SHALL keep the legacy flat `.pde/<id>.json` and `.pde/<id>.md` layout.

WHEN `saveDecomposition(workdir, result, { layout: "tree" })` or `saveDecompositionTree()` is called
THE SYSTEM SHALL create `.pde/<timestamp>--<uuid>/pde-<uuid>.json`, `.md`, and `meta.json`.

WHEN `loadDecomposition(workdir, id)` is called
THE SYSTEM SHALL resolve folder-backed tree records before falling back to legacy flat records.

WHEN `listDecompositions(workdir)` is called
THE SYSTEM SHALL list valid flat and tree decomposition records sorted newest first and ignore `meta.json`.

### Lineage Metadata

WHEN a root tree decomposition is stored
THE SYSTEM SHALL write `meta.json` with `root_pde_id`, `engine`, optional model/provider/session fields, optional add dirs, and timestamps.

WHEN a child tree decomposition is stored with `parentPdeId`
THE SYSTEM SHALL nest the child under the parent folder, inherit parent session/add-dir metadata, and append a reverse child entry to the parent metadata.

WHEN `childKind` is provided
THE SYSTEM SHALL store it in child metadata and preserve it in provenance unless provenance already defines `kind`.

WHEN a `StrategicDecompositionResult` is stored
THE SYSTEM SHALL persist versioned strategy metadata in both the decomposition record and tree metadata provenance.

## Acceptance

- Existing flat storage tests continue to pass.
- Tree storage tests verify metadata, add-dir deduplication, load/list behavior, child nesting, reverse edges, and inherited session IDs.
- No external engine execution is introduced in this package.

## Export

The public package exports storage helpers and metadata helpers from `src/index.ts`, including `saveDecompositionTree`, `saveStrategicDecomposition`, `PdeTreeMetadata`, `ChildKind`, `readPdeTreeMetadata`, `findPdeFolder`, and add-dir normalization helpers.
