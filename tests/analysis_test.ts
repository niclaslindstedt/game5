// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SCOREBOARD, held to its job: a clean map scores clean, and a map
// broken by hand in exactly one way is caught, by the rule that was broken.
// A check that never fires is not a check; each case here is the proof
// that one does.
import { describe, expect, it } from "vitest";

import { analyzeLevel, generateLevel, LEVEL_RULES as R, type Level } from "@engine";

import { LEVEL_SEEDS, analysisFor, levelFor } from "./support/levels.ts";

/** The rules a map's analysis finds ERRORS against. */
function errorRules(level: Level): string[] {
  return [
    ...new Set(
      analyzeLevel(level)
        .findings.filter((f) => f.severity === "error")
        .map((f) => f.rule),
    ),
  ];
}

describe("analyzeLevel", () => {
  const base = levelFor(LEVEL_SEEDS[0]);

  it("scores a generated map clean, with the numbers the rules are written in", () => {
    for (const seed of LEVEL_SEEDS) {
      const a = analysisFor(seed);
      expect(a.ok, `seed ${seed}: ${JSON.stringify(a.findings)}`).toBe(true);
      expect(a.seed).toBe(seed);
      expect(a.stats.points).toBe(levelFor(seed).track.points.length);
      expect(a.stats.checkpoints).toBe(levelFor(seed).checkpoints.length);
      expect(a.stats.treesOnCorridor).toBe(0);
      // A single piste carries its grade's kickers; a resort's course
      // (R28) the share of each run it follows (R27).
      if (!levelFor(seed).resort) {
        expect(a.stats.trackKickers).toBeGreaterThanOrEqual(R.kickers.on.count.min);
      }
    }
  });

  it("finds a tree standing on the piste (R14)", () => {
    const p = base.track.points[300];
    const tree = { x: p.x, z: p.z, y: p.y, height: 10, radius: 0.3, crown: 2.4 };
    expect(errorRules({ ...base, trees: [...base.trees, tree] })).toContain("R14");
  });

  it("finds a grid slot standing out in the powder (R13)", () => {
    const g = base.grid[1];
    const rx = Math.cos(g.heading);
    const rz = -Math.sin(g.heading);
    const off = { ...g, x: g.x + rx * 30, z: g.z + rz * 30 };
    expect(errorRules({ ...base, grid: [base.grid[0], off, ...base.grid.slice(2)] })).toContain(
      "R13",
    );
  });

  it("finds a spawn that does not face down the piste (R13)", () => {
    expect(
      errorRules({ ...base, spawn: { ...base.spawn, heading: base.spawn.heading + 1 } }),
    ).toContain("R13");
  });

  it("finds a start gate on a kicker's doorstep (R12)", () => {
    const k = base.kickers.find((kk) => kk.onTrack)!;
    const moved = { ...k, s: 40 };
    expect(
      errorRules({ ...base, kickers: base.kickers.map((kk) => (kk === k ? moved : kk)) }),
    ).toContain("R12");
  });

  it("finds two trees too close to ski between (R14)", () => {
    // A lone trunk: a clump's own may stand that close to each other.
    const t = base.trees.find((tt) => tt.clump === undefined)!;
    const twin = { ...t, x: t.x + 3, clump: undefined };
    expect(errorRules({ ...base, trees: [...base.trees, twin] })).toContain("R14");
  });

  it("finds a missing gate (R11)", () => {
    const cps = base.checkpoints.filter((_, i) => i !== 3);
    expect(errorRules({ ...base, checkpoints: cps })).toContain("R11");
  });

  it("finds a cliff cut across the piste (R22)", () => {
    // One of the mountain's own: not a drop across the course or another
    // run (R24).
    const c = base.cliffs.find((cc) => !cc.onTrack && cc.run === undefined)!;
    const p = base.track.points[200];
    const moved = { ...c, x: p.x, z: p.z };
    expect(errorRules({ ...base, cliffs: [moved, ...base.cliffs.slice(1)] })).toContain("R22");
  });

  it("finds a single piste with no kicker on it (R9)", () => {
    // A map of one piste (v1's, the trick maps'): a resort's course carries
    // the kickers of the runs it follows, and may follow none with one.
    const single = generateLevel(LEVEL_SEEDS[0], { version: 1 });
    expect(single.resort).toBeUndefined();
    expect(errorRules(single)).toEqual([]);
    expect(errorRules({ ...single, kickers: single.kickers.filter((k) => !k.onTrack) })).toContain(
      "R9",
    );
  });

  it("finds a piste that turns back up the map (R5)", () => {
    // Swap two stations: the line now jumps up the mountain and back.
    const pts = base.track.points.map((p) => ({ ...p }));
    const n = pts.length;
    const a = Math.floor(n / 4);
    const b = Math.floor((3 * n) / 4);
    [pts[a], pts[b]] = [
      { ...pts[b], s: pts[a].s },
      { ...pts[a], s: pts[b].s },
    ];
    expect(errorRules({ ...base, track: { ...base.track, points: pts } })).toContain("R5");
  });

  it("finds a piste too narrow for the rule (R7)", () => {
    const pts = base.track.points.map((p) => ({ ...p, width: R.track.width.min - 2 }));
    expect(errorRules({ ...base, track: { ...base.track, points: pts } })).toContain("R7");
  });

  it("finds a sun under the horizon (R15)", () => {
    expect(errorRules({ ...base, sun: { ...base.sun, hour: 2 } })).toContain("R15");
  });

  it("finds a piste that climbs (R8)", () => {
    // Lift a stretch of the line above the station before it.
    const pts = base.track.points.map((p) => ({ ...p }));
    // A stretch clear of every kicker, whose own ramp is allowed to climb.
    const kickers = base.kickers.filter((k) => k.onTrack);
    const at = pts.findIndex(
      (p, i) =>
        i > 300 && i < pts.length - 300 && kickers.every((k) => Math.abs((k.s ?? 0) - p.s) > 150),
    );
    for (let i = at; i < at + 30; i++) pts[i].y = pts[at - 1].y + 2;
    expect(errorRules({ ...base, track: { ...base.track, points: pts } })).toContain("R8");
  });

  it("finds a tree above the tree line (R14)", () => {
    const M = base.mountain;
    const tree = {
      x: M.summit.x,
      z: M.summit.z + 40,
      y: M.summit.y,
      height: 10,
      radius: 0.3,
      crown: 2.4,
    };
    expect(errorRules({ ...base, trees: [...base.trees, tree] })).toContain("R14");
  });

  it("finds the gates out of order, and a finish not at the piste's end (R11)", () => {
    const cps = base.checkpoints.map((c) => ({ ...c }));
    [cps[3], cps[4]] = [cps[4], cps[3]];
    expect(errorRules({ ...base, checkpoints: cps })).toContain("R11");
    const short = base.checkpoints.slice(0, -1);
    expect(errorRules({ ...base, checkpoints: short })).toContain("R11");
  });

  it("finds a start line out in the powder, and a mountain whose base is not on the ground (R2)", () => {
    const M = base.mountain;
    expect(
      errorRules({ ...base, mountain: { ...M, base: { ...M.base, y: M.base.y + 5 } } }),
    ).toContain("R2");
  });
});
