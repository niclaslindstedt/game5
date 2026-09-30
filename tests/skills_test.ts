// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKILLS, held to the contract they are written to (OSS_GAME_SPEC §21)
// and to the router that points at them (§7, §21.8). Three things drift
// here and each has drifted somewhere already: a skill renamed on disk and
// not in its front matter, so the tool that discovers it by name finds
// nothing; a maintenance skill without its `.last-updated`, so the sweep
// has no baseline and re-reads the whole history; and AGENTS.md naming a
// skill that does not exist — or a skill nobody routed to, which is a
// playbook no session will ever load.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SKILLS = join(ROOT, ".agents", "skills");

const dirs = readdirSync(SKILLS).filter((n) => statSync(join(SKILLS, n)).isDirectory());

type Front = Record<string, string>;

/** The YAML front matter as flat key → value (quotes stripped). */
function frontMatter(text: string): Front | null {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return null;
  const out: Front = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, "$1");
  }
  return out;
}

/** Maintenance skills are the `update-*` family, the umbrella and the
 * spec walk — the ones §21.4 gives a tracking file. */
function isMaintenance(name: string): boolean {
  return name.startsWith("update-") || name === "maintenance" || name === "sync-game-spec";
}

const agents = readFileSync(join(ROOT, "AGENTS.md"), "utf8");

/** One `## …` section of AGENTS.md, by the start of its heading. */
function section(heading: string): string {
  const start = agents.indexOf(`\n## ${heading}`);
  expect(start, `AGENTS.md has no "## ${heading}" section`).toBeGreaterThan(-1);
  const rest = agents.slice(start + 1);
  const end = rest.indexOf("\n## ", 1);
  return end < 0 ? rest : rest.slice(0, end);
}

/** Backticked tokens shaped like a skill name, in the last column of every
 * table row of a section. */
function lastColumnSkills(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    const last = cells[cells.length - 2] ?? "";
    for (const m of last.matchAll(/`([a-z]+(?:-[a-z]+)*)`/g)) out.push(m[1]);
  }
  return out;
}

describe("every skill (§21.3)", () => {
  it("there are skills", () => {
    expect(dirs.length).toBeGreaterThan(10);
  });

  for (const name of dirs) {
    it(`${name} has a SKILL.md whose front matter names it`, () => {
      const path = join(SKILLS, name, "SKILL.md");
      expect(existsSync(path), `${name}/SKILL.md is missing`).toBe(true);
      const text = readFileSync(path, "utf8");
      const front = frontMatter(text);
      expect(front, `${name}/SKILL.md has no front matter`).not.toBeNull();
      expect(front!.name).toBe(name);
      expect(front!.description?.length ?? 0, `${name} has no description`).toBeGreaterThan(20);
      expect(name).toMatch(/^[a-z]+(-[a-z]+)*$/);
      // ...and an H1 naming its purpose.
      expect(text, `${name}/SKILL.md has no H1`).toMatch(/\n# \S/);
    });
  }
});

describe("the maintenance skills (§21.4–§21.6)", () => {
  const maintenance = dirs.filter(isMaintenance);

  it("exist: the required set", () => {
    for (const name of ["maintenance", "update-docs", "update-readme", "update-website"]) {
      expect(maintenance, `${name} is required by §21.5`).toContain(name);
    }
    expect(maintenance, "sync-game-spec is required of a repo claiming conformance").toContain(
      "sync-game-spec",
    );
  });

  for (const name of maintenance) {
    it(`${name} carries a .last-updated baseline and the §21.3 sections`, () => {
      expect(existsSync(join(SKILLS, name, ".last-updated")), `${name}/.last-updated`).toBe(true);
      const text = readFileSync(join(SKILLS, name, "SKILL.md"), "utf8");
      for (const heading of [
        "Tracking mechanism",
        "Discovery process",
        "Verification",
        "Skill self-improvement",
      ]) {
        expect(text, `${name} lacks a "${heading}" section`).toMatch(
          new RegExp(`\\n#{2,3} ${heading}`),
        );
      }
    });
  }

  it("the umbrella's registry lists every update-* skill exactly once, and nothing else", () => {
    const text = readFileSync(join(SKILLS, "maintenance", "SKILL.md"), "utf8");
    const registry = text.split(/\n## Registry\n/)[1]?.split(/\n## /)[0] ?? "";
    expect(registry.length, "maintenance has no Registry section").toBeGreaterThan(0);
    const listed = [...registry.matchAll(/^\| `([a-z-]+)`/gm)].map((m) => m[1]);
    const updates = dirs.filter((n) => n.startsWith("update-")).sort();
    expect([...listed].sort()).toEqual(updates);
    expect(new Set(listed).size).toBe(listed.length);
  });
});

describe("the router (§7, §21.8)", () => {
  it("AGENTS.md's Skills section names every skill on disk, and only those", () => {
    const named = [...section("Skills").matchAll(/\*\*`([a-z]+(?:-[a-z]+)*)`\*\*/g)].map(
      (m) => m[1],
    );
    expect(new Set(named).size, "a skill is listed twice").toBe(named.length);
    expect([...named].sort()).toEqual([...dirs].sort());
  });

  it("every skill the labs table and the routing table hand a change to exists", () => {
    const owners = [
      ...lastColumnSkills(section("The labs")),
      ...lastColumnSkills(section("Where new code goes")),
    ];
    expect(owners.length).toBeGreaterThan(10);
    for (const owner of owners) {
      expect(dirs, `AGENTS.md routes to "${owner}", which is not a skill`).toContain(owner);
    }
  });
});
