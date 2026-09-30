// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RULE BOOK'S MIRROR. The generator states every rule once, as prose in
// the header of `engine/mapgen/rules.ts`, and `docs/level-generator.md`
// carries the same prose VERBATIM so that a reader of the docs and a reader
// of the code are told the same thing. Two copies that cannot import each
// other are a drift bug waiting to happen, and this is the test that makes
// it a failing test instead: every R-rule in the code is in the doc, every
// R-rule in the doc is in the code, and the words are the same words.
//
// The ids are read off the code, never listed here — a new rule lands in
// the rule book and this file asks for its mirror without being edited.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const rules = readFileSync(join(ROOT, "engine", "mapgen", "rules.ts"), "utf8");
const doc = readFileSync(join(ROOT, "docs", "level-generator.md"), "utf8");

const squash = (s: string): string => s.replace(/\s+/g, " ").trim();

/** The rules as the code states them: `//   R<n>  PROSE…` with the prose
 * continuing on the indented `//` lines that follow. */
function rulesInCode(): Map<string, string> {
  const out = new Map<string, string>();
  let current: string | null = null;
  let buffer: string[] = [];
  const flush = (): void => {
    if (current) out.set(current, squash(buffer.join(" ")));
    current = null;
    buffer = [];
  };
  for (const line of rules.split("\n")) {
    const head = /^\/\/\s+(R\d+)\s+(.*)$/.exec(line);
    if (head) {
      flush();
      current = head[1];
      buffer.push(head[2]);
      continue;
    }
    const cont = /^\/\/\s{6,}(\S.*)$/.exec(line);
    if (current && cont) {
      buffer.push(cont[1]);
      continue;
    }
    flush();
  }
  flush();
  return out;
}

/** The rules as the doc states them: `- **R<n>** PROSE…` bullets, each on
 * one line (Prettier preserves prose wrapping, so a bullet is a line). */
function rulesInDoc(): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of doc.matchAll(/^- \*\*(R\d+)\*\*\s+(.*)$/gm)) out.set(m[1], squash(m[2]));
  return out;
}

describe("docs/level-generator.md mirrors the rule book", () => {
  const code = rulesInCode();
  const mirror = rulesInDoc();

  it("reads a rule book out of the code", () => {
    expect(code.size).toBeGreaterThanOrEqual(10);
    // Numbered from R1 with no gaps: a gap is a rule somebody deleted
    // without renumbering, and the analysis names rules by number.
    const ids = [...code.keys()].map((id) => Number(id.slice(1))).sort((a, b) => a - b);
    expect(ids[0]).toBe(1);
    expect(ids).toEqual(ids.map((_, i) => i + 1));
  });

  it("the doc carries every rule the code states, and no other", () => {
    expect([...mirror.keys()].sort()).toEqual([...code.keys()].sort());
  });

  for (const [id, prose] of code) {
    it(`${id} is word for word the same in the doc`, () => {
      expect(mirror.get(id), `${id} is not in the doc`).toBeDefined();
      expect(mirror.get(id)).toBe(prose);
    });
  }

  it("every rule the numbers cite is a rule the header states", () => {
    // The knob groups annotate themselves `/** R14 — …` and the analysis
    // names a finding's rule; a citation of a rule the header does not
    // state is a rule that exists only as a number.
    for (const m of rules.matchAll(/\/\*\*\s*((?:R\d+(?:,\s*|\s+and\s+|[–-])?)+)\s*[—-]/g)) {
      for (const id of m[1].match(/R\d+/g) ?? []) {
        expect(code.has(id), `${id} is cited in the numbers but not stated`).toBe(true);
      }
    }
  });
});
