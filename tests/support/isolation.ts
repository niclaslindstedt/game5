// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Which test files may share a worker's module cache, and which must each
// get a fresh one.
//
// Vitest isolates every file by default: each one re-imports the engine and
// starts with an empty `tests/support/levels.ts`, so a hundred files that
// read the same corpus build the same mountains a hundred times over — a map
// is most of half a minute on a CI runner, and that rebuilding, plus the
// import, was most of what the suite cost. A file run with `isolate: false`
// keeps the worker's modules from the file before it, so the corpus is built
// once a worker and handed out from then on.
//
// The price is that anything one file leaves in a module is there for the
// next, so only a file that CANNOT leave anything is let in: one that
// imports nothing but the engine (`@engine`, or one of its modules by
// path), the framework's engine-safe
// half, `vitest`, `node:` and support modules that pass the same test
// themselves, and that touches no global (`globalThis`, `process.env`, a
// stub, a mock, a module reset). The engine's one registration a host makes
// (`setDrawnSolids`) is only ever made by the app's modules, so a file that
// imports none of them cannot make it, and the engine keeps no other state
// between runs but caches keyed by the map, which the corpus's read-only
// rule already covers. Every other file — anything reaching into `pwa/`,
// whose modules register and hold state on import — stays isolated, as it
// always was.
//
// The verdict is read off the source on every run, so a new file is sorted
// the day it lands and a file that grows a `pwa/` import moves itself over.
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

/** Packages a shared file, or a module it reaches, may import: the
 * runner, Node's own modules, the framework's engine-safe half and the
 * renderer's maths. */
function safePackage(spec: string): boolean {
  return (
    spec === "vitest" ||
    spec === "three" ||
    spec.startsWith("node:") ||
    /^@niclaslindstedt\/oss-game-framework\/(core|racing)\//.test(spec)
  );
}

/** Anything that reaches past the module graph into the process's globals:
 * in a test, a stub or a browser global stood in; in a module, a global
 * written. (A module that only READS a browser global does so behind a
 * guard or a try, since Node has none, and leaves nothing behind.) */
const TEST_TOUCH =
  /\bvi\.(mock|doMock|unmock|stubGlobal|stubEnv|resetModules|spyOn|useFakeTimers)\b|\bglobalThis\b|\bprocess\.env\b|\b(window|document|localStorage|indexedDB|navigator)\b/;
const MODULE_TOUCH = /\bglobalThis\b|\bprocess\.env\b/;

/** A module that keeps something between calls a later file would meet: a
 * top-level `let`, a statement run at import (a registration), a top-level
 * assignment, or an exported setter. A cache keyed by its arguments is none
 * of these, and is the pure kind this lets through; a module whose state is
 * only that (a memo of the last call, storage read inside a try) says so with
 * an `isolation:stateless: <reason>` comment, which this takes at its word. */
const KEEPS_STATE =
  /^(?:export\s+)?(?:let|var)\s|^(?:await\s+)?[\w$.]+(?:\[[^\]]*\])*\s*\(|^[\w$.]+(?:\[[^\]]*\])*\s*(?:=|\+=|-=)[^=>]|^export\s+function\s+(?:set|register|install)[A-Z]/m;

const VOUCHED = /isolation:stateless:\s*\S/;

/** The source with its comments taken out, so a word in prose is not read
 * as code. A `//` after a colon or a quote (a URL in a string) is kept. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const STATIC_IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?\bfrom\s+"([^"]+)"/g;
const BARE_IMPORT = /(?:^|\n)\s*import\s+"([^"]+)"/g;
const DYNAMIC_IMPORT = /\bimport\(\s*["'`]([^"'`]+)["'`]/g;

/** Whether the file at `path` (absolute) may run in a shared worker.
 * `root` is the repository; `memo` carries the verdicts across calls. */
export function canShareWorker(
  path: string,
  root: string,
  memo = new Map<string, boolean>(),
): boolean {
  const known = memo.get(path);
  if (known !== undefined) return known;
  // A cycle is judged on the rest of its edges.
  memo.set(path, true);
  const raw = readFileSync(path, "utf8");
  const source = code(raw);
  const where = relative(root, path).replaceAll("\\", "/");
  // A test file is run once, so its own top-level state dies with it; what
  // it imports is what a later file would share.
  const isTest = /^tests\/[^/]+_test\.ts$/.test(where);
  let ok = isTest
    ? !TEST_TOUCH.test(source)
    : VOUCHED.test(raw) || (!MODULE_TOUCH.test(source) && !KEEPS_STATE.test(source));
  const specs = [
    ...[...source.matchAll(STATIC_IMPORT)].map((m) => m[1]),
    ...[...source.matchAll(BARE_IMPORT)].map((m) => m[1]),
    ...[...source.matchAll(DYNAMIC_IMPORT)].map((m) => m[1]),
  ];
  for (const spec of specs) {
    if (!ok) break;
    if (spec === "@engine") continue;
    if (!spec.startsWith(".")) {
      ok = safePackage(spec);
      continue;
    }
    const bare = resolve(dirname(path), spec);
    const target = existsSync(bare) ? bare : `${bare}.ts`;
    const to = relative(root, target).replaceAll("\\", "/");
    // The engine is held to keeping nothing between runs but caches keyed by
    // the map (its one host registration, `setDrawnSolids`, is made only by
    // the app), and it imports nothing of the app's (`imports_test`).
    if (to.startsWith("engine/")) continue;
    ok = existsSync(target) && canShareWorker(target, root, memo);
  }
  memo.set(path, ok);
  return ok;
}
