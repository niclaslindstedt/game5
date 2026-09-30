// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ONE SOURCE OF TRUTH FOR AGENT GUIDANCE (OSS_GAME_SPEC §7.1, §21.2): every
// tool-specific guidance file is a SYMLINK onto AGENTS.md, and every
// tool-specific skills directory a symlink onto .agents/skills. A checkout
// on a platform without symlink support, or an editor that "helpfully"
// dereferences one, turns the single source into a copy that drifts — and
// nothing else in the suite would notice, because the copy reads fine.
// CI's `symlinks` job checks the same list in shell; this is the same
// check where `make test` is the gate, so it fails before the push.
import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/** Link path → the exact target the link must carry (relative, as `ln -s`
 * wrote it, so a link that resolves right but reads differently — an
 * absolute path from somebody's home directory — still fails). */
const GUIDANCE: Record<string, string> = {
  "CLAUDE.md": "AGENTS.md",
  "GEMINI.md": "AGENTS.md",
  ".cursorrules": "AGENTS.md",
  ".windsurfrules": "AGENTS.md",
  ".github/copilot-instructions.md": "../AGENTS.md",
};

const SKILLS: Record<string, string> = {
  ".claude/skills": "../.agents/skills",
  ".gemini/skills": "../.agents/skills",
};

function holds(links: Record<string, string>, canonical: string): void {
  const truth = realpathSync(join(ROOT, canonical));
  for (const [link, target] of Object.entries(links)) {
    it(`${link} -> ${target}`, () => {
      const path = join(ROOT, link);
      expect(existsSync(path), `${link} is missing`).toBe(true);
      expect(lstatSync(path).isSymbolicLink(), `${link} is a regular file, not a symlink`).toBe(
        true,
      );
      expect(readlinkSync(path), `${link} points elsewhere`).toBe(target);
      expect(realpathSync(path), `${link} does not resolve to ${canonical}`).toBe(truth);
    });
  }
}

describe("the guidance symlinks (§7.1)", () => {
  it("AGENTS.md is the real file", () => {
    const stat = lstatSync(join(ROOT, "AGENTS.md"));
    expect(stat.isSymbolicLink()).toBe(false);
    expect(stat.isFile()).toBe(true);
    // Not a size floor: the router is written after the tree it routes
    // through, and a stub is still the one real file every alias reads.
    expect(stat.size).toBeGreaterThan(0);
  });

  holds(GUIDANCE, "AGENTS.md");

  it("Prettier is told about every alias, since it resolves a symlink before matching", () => {
    // AGENTS.md is prettier-ignored (its wide tables re-pad on every edit),
    // and an ignore list that names the file but not its aliases formats it
    // anyway through whichever alias the glob reaches first.
    const ignore = readFileSync(join(ROOT, ".prettierignore"), "utf8").split("\n");
    for (const path of ["AGENTS.md", ...Object.keys(GUIDANCE)]) {
      expect(ignore, `${path} is not in .prettierignore`).toContain(path);
    }
  });
});

// The skills arrive after the tree they are written against; until
// `.agents/skills` exists there is nothing for an alias to point at, and the
// day it does, the aliases are held exactly as the guidance files are. (A
// plain `if` rather than `describe.skipIf`: a skipped suite's body is still
// COLLECTED, and `holds` resolves the canonical path while it is.)
if (existsSync(join(ROOT, ".agents", "skills"))) {
  describe("the skills symlinks (§21.2)", () => {
    it(".agents/skills is the real directory", () => {
      const stat = lstatSync(join(ROOT, ".agents", "skills"));
      expect(stat.isSymbolicLink()).toBe(false);
      expect(stat.isDirectory()).toBe(true);
    });

    holds(SKILLS, ".agents/skills");
  });
} else {
  describe.skip("the skills symlinks (§21.2) — .agents/skills not written yet", () => {
    it("holds the skills aliases", () => {});
  });
}
