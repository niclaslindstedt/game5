// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE 1000-LINE CAP (OSS_GAME_SPEC §20.5): no non-test source file may run
// past a thousand physical lines — `wc -l`'s count, nothing cleverer,
// because the rule is a size smell and a smell has to be trivial to
// measure. Test files are exempt (their size is the subject's), and a file
// may declare itself exempt with the §20.5.1 marker in its first twenty
// lines, `game-spec:allow-large-file: <reason>`, where the reason is
// non-empty or the marker is nothing.
//
// Two things this holds beyond the cap itself: a marker with no reason is
// refused, and a marker on a file that is UNDER the cap is refused too — a
// file that was split and kept its badge is a file the next contributor
// will grow back into it without a review ever asking why.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const CAP = 1000;
const MARKER = /game-spec:allow-large-file:(.*)$/;

/** The stem shape §20.2 gives a test file. */
const TEST_STEM = /_?[Tt]ests?$/;

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !name.endsWith(".d.ts")) out.push(path);
  }
}

/** Every source file the cap applies to. */
function sources(): string[] {
  const out: string[] = [];
  for (const dir of ["engine", "pwa", "scripts", "tests"]) walk(join(ROOT, dir), out);
  for (const name of readdirSync(ROOT)) {
    if (/\.(ts|mjs|js)$/.test(name)) out.push(join(ROOT, name));
  }
  return out.filter((path) => {
    const stem = path.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
    return !TEST_STEM.test(stem);
  });
}

/** Physical lines, the way `wc -l` counts them: newline characters. */
function physicalLines(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n += 1;
  return n;
}

/** The marker's reason, `null` when there is no marker in the first 20
 * lines, and "" when there is one with nothing after it. */
function exemption(text: string): string | null {
  for (const line of text.split("\n").slice(0, 20)) {
    const m = MARKER.exec(line);
    if (m) return m[1].replace(/\*\/\s*$/, "").trim();
  }
  return null;
}

describe("the 1000-line cap (§20.5)", () => {
  const files = sources();

  it("has sources to measure", () => {
    expect(files.length).toBeGreaterThan(0);
    // ...and does not count the suite among them.
    expect(files.some((f) => f.endsWith("_test.ts"))).toBe(false);
  });

  for (const file of files) {
    const rel = relative(ROOT, file).split(sep).join("/");
    it(`${rel} is under ${CAP} lines, or says why not`, () => {
      const text = readFileSync(file, "utf8");
      const lines = physicalLines(text);
      const reason = exemption(text);
      if (reason === null) {
        expect(lines, `${rel} is ${lines} lines`).toBeLessThanOrEqual(CAP);
        return;
      }
      expect(reason, `${rel} carries an allow-large-file marker with no reason`).not.toBe("");
      expect(lines, `${rel} is marked exempt but is only ${lines} lines`).toBeGreaterThan(CAP);
    });
  }
});
