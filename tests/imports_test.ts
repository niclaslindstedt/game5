// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEPENDENCY DIRECTION, walked — OSS_GAME_SPEC §23.7's "enforce
// direction with a test, not with discipline". The arrows AGENTS.md states
// are read off the REAL import graph here: every `import`/`export … from`
// in engine/, pwa/src/, scripts/ and tests/, resolved to the role it lands
// in, and held to the four rules:
//
//   1. the core (engine/) imports nothing from any shell or any tool — and
//      nothing from any package but the shared framework's ENGINE-SAFE
//      half (`@niclaslindstedt/oss-game-framework/core/*` and `/racing/*`,
//      THE ENGINE LINE): it is framework-free, so a `three` or a `preact`
//      or a `node:` under it — or the framework's audio, shots or DOM
//      plumbing — is the browser bundle or the headless sim losing a host;
//   2. a shell (pwa/) imports the core through its ONE entry surface,
//      `@engine`, never a deep path, and never another shell or a tool;
//   3. tooling (scripts/) may import anything; nothing imports it;
//   4. the suite reaches the engine the way a host does — `@engine` — so a
//      test cannot pin an internal a host could never see.
//
// Beside the graph, the §25 hygiene the same walk can check for free: no
// wall clock, no global random source, no `Math.hypot` (whose last bit is
// each browser's own) and no console in the engine's code
// (the analyzer's report timer is the one recorded exception — dev-time,
// never stepping a run — and it is named here rather than waved through;
// the engine prints only through the framework's `core/output` sink). The
// same hygiene is held over the framework's `core/` and `racing/` source the
// engine line lets in, because a draw or a clock read there is one in the
// engine; its `core/clock.ts` is the wall clock itself, and the engine may
// not import it.
// `tests/determinism_test.ts` proves a run replays; this file is why it
// keeps doing so after the next merge.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

type Role = "engine" | "pwa" | "scripts" | "tests" | "shell" | "other";

/** Which role a repo-relative path belongs to. */
function roleOf(rel: string): Role {
  const top = rel.split("/")[0];
  if (top === "engine") return "engine";
  if (top === "pwa") return "pwa";
  if (top === "scripts") return "scripts";
  if (top === "tests") return "tests";
  if (top === "tauri" || top === "native") return "shell";
  return "other";
}

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !name.endsWith(".d.ts")) out.push(path);
  }
}

/** Source with the comments stripped, so prose may name what code may not. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

/** Every module specifier a file names: static imports and re-exports,
 * side-effect imports, and dynamic imports of a literal string.
 *
 * A specifier never contains a NEWLINE, and saying so is what keeps this
 * from reading prose as an import: an `export function` whose body holds a
 * string ending in the word "from" otherwise opens a match that runs to
 * whatever quote comes next, and the file is reported as importing a
 * package made of the two statements in between. */
function specifiers(text: string): string[] {
  const src = code(text);
  const out: string[] = [];
  const spec = `["']([^"'\\n]+)["']`;
  for (const m of src.matchAll(
    new RegExp(`(?:^|\\n)\\s*(?:import|export)\\s[^;]*?\\sfrom\\s*${spec}`, "g"),
  )) {
    out.push(m[1]);
  }
  for (const m of src.matchAll(new RegExp(`(?:^|\\n)\\s*import\\s*${spec}`, "g"))) out.push(m[1]);
  for (const m of src.matchAll(new RegExp(`import\\(\\s*${spec}\\s*\\)`, "g"))) out.push(m[1]);
  return out;
}

/** Whether `spec` is imported for its types only, and so erased at build. */
function typeOnly(text: string, spec: string): boolean {
  const quoted = spec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`import\\s+type\\s[^;]*?from\\s*["']${quoted}["']`).test(code(text));
}

type Edge = { from: string; spec: string; to: string | null; bare: boolean };

/** Where a specifier lands: a repo-relative path for a relative import or
 * the `@engine` alias, `null` (and `bare`) for a package. */
function edgesOf(file: string): Edge[] {
  const from = relative(ROOT, file).split(sep).join("/");
  return specifiers(readFileSync(file, "utf8")).map((spec) => {
    if (spec === "@engine") return { from, spec, to: "engine/index.ts", bare: false };
    if (spec.startsWith(".") || spec.startsWith("/")) {
      const abs = spec.startsWith("/") ? spec : resolve(dirname(file), spec);
      return { from, spec, to: relative(ROOT, abs).split(sep).join("/"), bare: false };
    }
    return { from, spec, to: null, bare: true };
  });
}

function filesUnder(...dirs: string[]): string[] {
  const out: string[] = [];
  for (const dir of dirs) walk(join(ROOT, dir), out);
  return out;
}

const ENGINE = filesUnder("engine");
const PWA = filesUnder("pwa/src");
const TESTS = filesUnder("tests");
const SCRIPTS = filesUnder("scripts");

/** The shared framework's package name. */
const FRAMEWORK = "@niclaslindstedt/oss-game-framework";

/** THE ENGINE LINE: the framework's engine-safe modules, as a file subpath
 * (`/core/prng`) or the module itself (`/racing`) — and nothing else of it. */
const ENGINE_LINE = /^@niclaslindstedt\/oss-game-framework\/(core|racing)(\/[\w-]+)?$/;

/** The one engine-line module the engine may still not import: the wall
 * clock (`wallClock`, `preciseClock`). */
const WALL_CLOCK = `${FRAMEWORK}/core/clock`;

/** The framework's shipped source for the engine line, read as the engine's
 * own for the hygiene below (the package ships `src/` beside `dist/`). */
const FRAMEWORK_SRC = join(ROOT, "node_modules", ...FRAMEWORK.split("/"), "src");
const ENGINE_LINE_SRC = [join(FRAMEWORK_SRC, "core"), join(FRAMEWORK_SRC, "racing")].flatMap(
  (dir) => {
    const out: string[] = [];
    walk(dir, out);
    return out;
  },
);

/**
 * THE SEAM THE SUITE IS ALLOWED TO HOLD — the only files in a shell a root
 * test may import, and the exception to "nothing reaches into a shell".
 *
 * A shell states things the page also states and cannot import: the word on
 * the shell global, the name of a DOM event, the shape of a message. Those
 * pairs are load-bearing and silent when they drift — a renamed event is a
 * phone that simply stops buzzing — so the suite holds them from both ends.
 *
 * The store app's import-free seam modules — the injected script, the
 * navigation rule, the pulse parser, the cloud ask — and the case below proves each of them
 * still IMPORTS NOTHING AT ALL: the root suite never installs `native/`'s
 * dependency tree, and a seam module that grew a native import would take
 * the whole suite down with it rather than fail one case. The desktop app's
 * half is Rust and is read as TEXT (`tests/tauri_test.ts`), never imported.
 */
const SHELL_SEAM = new Set<string>([
  "native/src/cloud-ask.ts",
  "native/src/injected.ts",
  "native/src/navigation.ts",
  "native/src/rumble.ts",
]);

describe("the dependency direction (§23.7)", () => {
  it("has a graph to walk", () => {
    // Floors, not counts: the engine and the app grow under this file, and
    // what it must never do is pass because a walk found nothing to read.
    expect(ENGINE.length).toBeGreaterThan(0);
    expect(PWA.length).toBeGreaterThan(0);
    expect(TESTS.length).toBeGreaterThan(0);
    expect(SCRIPTS.length).toBeGreaterThan(0);
  });

  it("the core imports nothing from a shell, a tool, the suite, or any package but the engine line", () => {
    for (const file of ENGINE) {
      for (const e of edgesOf(file)) {
        if (e.bare) {
          expect(
            ENGINE_LINE.test(e.spec),
            `${e.from} imports the package "${e.spec}" — the engine may import only ${FRAMEWORK}/core/* and /racing/*`,
          ).toBe(true);
          expect(e.spec, `${e.from} imports the wall clock`).not.toBe(WALL_CLOCK);
          continue;
        }
        const role = roleOf(e.to ?? "");
        expect(role, `${e.from} imports ${e.spec}, which is ${role}`).toBe("engine");
      }
    }
  });

  it("the shell reaches the core only through @engine, and never a tool or another shell", () => {
    for (const file of PWA) {
      for (const e of edgesOf(file)) {
        if (e.bare) {
          expect(
            e.spec,
            `${e.from} imports "${e.spec}" — a browser bundle has no Node`,
          ).not.toMatch(/^node:|^(fs|path|url|os|child_process)$/);
          continue;
        }
        const role = roleOf(e.to ?? "");
        expect(role, `${e.from} imports ${e.spec}, which is ${role}`).not.toBe("scripts");
        expect(role, `${e.from} imports ${e.spec}, which is ${role}`).not.toBe("tests");
        expect(role, `${e.from} imports ${e.spec}, which is a shell`).not.toBe("shell");
        if (role === "engine") {
          expect(e.spec, `${e.from} reaches into the engine at ${e.spec}; use @engine`).toBe(
            "@engine",
          );
        }
      }
    }
  });

  it("nothing imports tooling", () => {
    for (const file of [...ENGINE, ...PWA, ...TESTS]) {
      for (const e of edgesOf(file)) {
        expect(roleOf(e.to ?? ""), `${e.from} imports ${e.spec} from scripts/`).not.toBe("scripts");
      }
    }
  });

  it("the suite reaches the engine the way a host does — through @engine", () => {
    for (const file of TESTS) {
      for (const e of edgesOf(file)) {
        if (roleOf(e.to ?? "") === "engine") {
          expect(e.spec, `${e.from} reaches into the engine at ${e.spec}; use @engine`).toBe(
            "@engine",
          );
        }
        if (roleOf(e.to ?? "") === "shell") {
          expect(
            SHELL_SEAM.has(e.to ?? ""),
            `${e.from} imports ${e.spec} — a shell module the suite may not hold; see SHELL_SEAM`,
          ).toBe(true);
        }
      }
    }
  });

  it("every shell module the suite may hold pulls in nothing at runtime", () => {
    for (const rel of SHELL_SEAM) {
      const file = join(ROOT, ...rel.split("/"));
      // A `import type` is erased before anything runs, so it cannot drag a
      // shell's dependency tree into the suite — which is the whole point of
      // this case. What it can still do is tie one seam module to another, so
      // the target has to be in the seam too.
      const carried = edgesOf(file).filter((e) => {
        if (!typeOnly(readFileSync(file, "utf8"), e.spec)) return true;
        return !SHELL_SEAM.has(e.to ?? "");
      });
      expect(
        carried.map((e) => e.spec),
        `${rel} is in SHELL_SEAM, so the root suite imports it without installing that tree`,
      ).toEqual([]);
    }
  });

  it("engine/index.ts is the one surface, and it re-exports only its own modules and the engine line", () => {
    const index = join(ROOT, "engine", "index.ts");
    // The surface is written with the engine; before it exists there is
    // nothing a host could reach, so there is nothing to hold.
    if (!existsSync(index)) return;
    const edges = edgesOf(index);
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) {
      if (e.bare) expect(ENGINE_LINE.test(e.spec), e.spec).toBe(true);
      else expect(e.to, e.spec).toMatch(/^engine\//);
    }
  });
});

describe("the engine's hygiene (§25)", () => {
  /** The one wall-clock read the engine is allowed: the analyzer stamps its
   * report with how long it took. Dev-time only — `analyzeLevel` never
   * steps a run and the timing never feeds a decision. Anything else is a
   * §25.1 violation and lands here by name. */
  const CLOCK_ALLOWED = new Set(["engine/analysis/index.ts", "framework/core/clock.ts"]);

  it("has the framework's engine line to read", () => {
    expect(ENGINE_LINE_SRC.length).toBeGreaterThan(0);
  });

  for (const file of [...ENGINE, ...ENGINE_LINE_SRC]) {
    const rel = file.startsWith(FRAMEWORK_SRC)
      ? `framework/${relative(FRAMEWORK_SRC, file).split(sep).join("/")}`
      : relative(ROOT, file).split(sep).join("/");
    const src = code(readFileSync(file, "utf8"));
    it(`${rel} draws no global randomness, reads no clock, prints nothing`, () => {
      expect(src, "Math.random").not.toMatch(/Math\.random/);
      if (!CLOCK_ALLOWED.has(rel)) {
        expect(src, "a wall clock").not.toMatch(/Date\.now|new Date\(|performance\.now/);
      }
      expect(src, "console").not.toMatch(/\bconsole\./);
      // The builtin's algorithm is each browser's own and it is dear on a
      // hot path; the framework's `core/math` `hypot` is V8's recipe in plain IEEE
      // arithmetic, the same bits everywhere (`determinism_test.ts`).
      expect(src, "Math.hypot").not.toMatch(/Math\.hypot/);
      // Member access on the DOM's globals, not the bare words: `window` is
      // a perfectly good name for a search window in the shore's code.
      expect(src, "a DOM global").not.toMatch(
        /\b(window|document|navigator|localStorage)\.|\brequestAnimationFrame\(/,
      );
    });
  }
});
