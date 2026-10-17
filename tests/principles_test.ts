// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PRINCIPLES (`docs/principles/`): one file a rule, indexed at the top of
// AGENTS.md, cited in code by a versioned token (`PDD-NN@vN`). This holds the
// three together: every file has its token, version and five sections in
// order; the index names every principle at its current version and nothing
// else; and every citation anywhere in the tree names a principle that
// exists AT ITS CURRENT VERSION — so a principle whose meaning moved lists,
// here, every place that has to be checked against it again.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const DIR = join(ROOT, "docs", "principles");
const SECTIONS = ["Rule", "Why", "Prevents", "Exceptions", "History"];
const FILE = /^(PDD-\d\d)-[a-z0-9-]+\.md$/;
const CITE = /\bPDD-(\d\d)@v(\d+)\b/g;

interface Principle {
  token: string;
  version: number;
  title: string;
  file: string;
  text: string;
}

function principles(): Principle[] {
  return readdirSync(DIR)
    .filter((name) => FILE.test(name))
    .sort()
    .map((name) => {
      const text = readFileSync(join(DIR, name), "utf8");
      const field = (key: string): string =>
        new RegExp(`^${key}: (.+)$`, "m").exec(text)?.[1].trim() ?? "";
      return {
        token: field("token"),
        version: Number(field("version")),
        title: field("title"),
        file: name,
        text,
      };
    });
}

/** Every text file a citation could sit in. */
function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "dist", "previews", ".git", ".lessons-archive"].includes(name)) continue;
    const path = join(dir, name);
    if (statSync(path, { throwIfNoEntry: false })?.isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|mjs|js|md|py|glsl)$/.test(name)) out.push(path);
  }
}

const ALL = principles();
const CURRENT = new Map(ALL.map((p) => [p.token, p.version]));

describe("the principles", () => {
  it("every file carries its token, a version and a title", () => {
    expect(ALL.length).toBeGreaterThan(0);
    for (const p of ALL) {
      expect(
        p.file.startsWith(`${p.token}-`),
        `${p.file}: token ${p.token} does not match its name`,
      ).toBe(true);
      expect(Number.isInteger(p.version) && p.version >= 1, `${p.file}: version`).toBe(true);
      expect(p.title, `${p.file}: title`).not.toBe("");
    }
  });

  it("tokens are numbered without gaps or repeats", () => {
    ALL.forEach((p, i) => expect(p.token).toBe(`PDD-${String(i + 1).padStart(2, "0")}`));
  });

  it("every file has its five sections, in order, and a History line for its version", () => {
    for (const p of ALL) {
      const found = [...p.text.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
      expect(found, p.file).toEqual(SECTIONS);
      const history = p.text.slice(p.text.indexOf("## History"));
      expect(history, `${p.file}: no History line for v${p.version}`).toMatch(
        new RegExp(`\\bv${p.version}\\b`),
      );
    }
  });

  it("AGENTS.md indexes every principle at its current version, and only those", () => {
    const agents = readFileSync(join(ROOT, "AGENTS.md"), "utf8");
    const start = agents.indexOf("\n## Principles\n");
    expect(start, 'AGENTS.md has no "## Principles" section').toBeGreaterThan(-1);
    const end = agents.indexOf("\n## ", start + 1);
    const index = agents.slice(start, end);
    const rows = [
      ...index.matchAll(/^\| \[`(PDD-\d\d)@v(\d+)`\]\(docs\/principles\/([^)]+)\) \| (.+) \|$/gm),
    ];
    expect(rows.map((r) => r[1])).toEqual(ALL.map((p) => p.token));
    for (const [, token, version, file, title] of rows) {
      const p = ALL.find((q) => q.token === token)!;
      expect(Number(version), `${token}: the index pins an old version`).toBe(p.version);
      expect(file).toBe(p.file);
      expect(title).toBe(p.title);
    }
  });

  it("every citation in the tree names a principle at its current version", () => {
    const files: string[] = [];
    for (const dir of ["engine", "pwa", "scripts", "tests", "docs", ".agents"])
      walk(join(ROOT, dir), files);
    const stale: string[] = [];
    for (const path of files) {
      const text = readFileSync(path, "utf8");
      for (const m of text.matchAll(CITE)) {
        const token = `PDD-${m[1]}`;
        const at = CURRENT.get(token);
        if (at !== Number(m[2]))
          stale.push(
            `${relative(ROOT, path)}: ${m[0]} (${at ? `now v${at}` : "no such principle"})`,
          );
      }
    }
    // This file's own examples are the format, not citations.
    expect(stale.filter((s) => !s.startsWith("docs/principles/README.md"))).toEqual([]);
  });
});
