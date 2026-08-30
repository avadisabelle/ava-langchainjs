#!/usr/bin/env node
/**
 * Release guard: fail if any publishable package would ship ZERO type
 * declarations.
 *
 * The 0.1.3 regression shipped JS-only tarballs — tsup silently skips its dts
 * step when `typescript` is unresolvable (a partial install), still exits 0,
 * and the missing `.d.ts` only surfaces in a strict consumer's build (TS7016).
 * This guard inspects exactly what `npm publish` would upload (via
 * `npm pack --dry-run`) and refuses a package whose tarball declares `types`
 * but carries no declarations.
 *
 * Usage:
 *   node scripts/check-dts.mjs            # scan every non-private libs/* package
 *   node scripts/check-dts.mjs <dir>...   # check specific package dirs
 *
 * Exit code 1 on any offender. Wire into `prepublishOnly` and CI.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readJSON(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Discover publishable package directories under libs/. */
function discoverPackages() {
  const libsDir = join(repoRoot, "libs");
  if (!existsSync(libsDir)) return [];
  const dirs = [];
  for (const name of readdirSync(libsDir)) {
    const dir = join(libsDir, name);
    const pkgPath = join(dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = readJSON(pkgPath);
    if (pkg.private) continue;
    dirs.push(dir);
  }
  return dirs;
}

/** File list of the tarball `npm publish` would upload, without building it. */
function packedFiles(dir) {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: dir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return JSON.parse(out)[0].files.map((f) => f.path);
}

const targets =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2).map((p) => resolve(p))
    : discoverPackages();

if (targets.length === 0) {
  console.error("check-dts: no packages found to check");
  process.exit(1);
}

let failed = false;
for (const dir of targets) {
  const pkg = readJSON(join(dir, "package.json"));
  const files = packedFiles(dir);
  const declarations = files.filter(
    (f) => f.endsWith(".d.ts") || f.endsWith(".d.cts") || f.endsWith(".d.mts")
  );

  // A package that advertises types MUST ship them.
  const advertisesTypes = Boolean(pkg.types || pkg.typings || pkg.exports);
  const typesTargetPresent =
    !pkg.types || files.some((f) => f === pkg.types.replace(/^\.\//, ""));

  if (advertisesTypes && declarations.length === 0) {
    console.error(
      `✗ ${pkg.name}@${pkg.version}: tarball ships 0 declaration files (advertises types)`
    );
    failed = true;
  } else if (advertisesTypes && !typesTargetPresent) {
    console.error(
      `✗ ${pkg.name}@${pkg.version}: "types" points at ${pkg.types} but it is not in the tarball`
    );
    failed = true;
  } else {
    console.log(
      `✓ ${pkg.name}@${pkg.version}: ${declarations.length} declaration files`
    );
  }
}

if (failed) {
  console.error(
    "\ncheck-dts: type declarations missing — refusing release. Rebuild with `typescript` installed so tsup emits dts."
  );
  process.exit(1);
}
console.log("\ncheck-dts: all packages ship declarations.");
