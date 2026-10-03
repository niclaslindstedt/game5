// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FOREST'S HAND-OVER (`tree-bands.ts`): no tree swaps its cut in a
// frame. A tree crossing a band's edge dissolves into its next cut over
// `HAND_OVER_MS` — its two cuts' shares of its pixels complementary and
// moving smoothly — a lens at rest leaves every tree whole, a lens bobbing
// at an edge does not set a tree flickering, and a tree the lens had not
// seen takes its cut at once.

import { describe, expect, it } from "vitest";

import {
  DISTANCE_LEVELS,
  DISTANCE_LOOK,
  FOREST_LOOK,
  TIERS,
} from "../pwa/src/game/settings-video.ts";
import {
  HAND_OVER_MS,
  HYSTERESIS,
  bandAt,
  createHandOver,
  handOver,
  type BandEdges,
  type TreeDraw,
} from "../pwa/src/game/tree-bands.ts";

const E: BandEdges = { full: 110, mid: 320, far: 1100 };
const fresh = (): TreeDraw => ({ from: -1, band: -1, split: 0 });

/** Each cut's share of the tree's pixels: FULL, MID, FAR. */
function shares(t: TreeDraw): number[] {
  const s = [0, 0, 0];
  if (t.from >= 0) s[t.from] += t.split;
  if (t.band >= 0) s[t.band] += 1 - t.split;
  return s;
}

/** A lens at `speed` m/s riding at one tree from `from` m to `to` m, a fill
 * every 1/60 s; every fill's shares. */
function ride(e: BandEdges, inFar: boolean, from: number, to: number, speed: number): number[][] {
  const h = createHandOver(1);
  const out: number[][] = [];
  const dt = 1000 / 60;
  const step = (speed * dt) / 1000;
  const sign = Math.sign(to - from);
  let tick = 1;
  for (let d = from, now = 0; sign * (to - d) >= 0; d += sign * step, now += dt) {
    const t = fresh();
    handOver(h, 0, d, e, inFar, now, ++tick, t);
    out.push(shares(t));
  }
  return out;
}

const pairings = TIERS.flatMap((f) =>
  DISTANCE_LEVELS.map((d) => ({
    name: `forest ${f}, distance ${d}`,
    edges: { full: FOREST_LOOK[f].full, mid: FOREST_LOOK[f].mid, far: DISTANCE_LOOK[d].trees },
  })),
);

describe("the forest's hand-over between its cuts", () => {
  it("puts a tree in the cut its distance asks for", () => {
    expect(bandAt(10, E, true)).toBe(0);
    expect(bandAt(200, E, true)).toBe(1);
    expect(bandAt(500, E, true)).toBe(2);
    expect(bandAt(500, E, false)).toBe(-1);
    expect(bandAt(1200, E, true)).toBe(-1);
  });

  it("draws a tree first seen whole in its own cut, discarding nothing", () => {
    const h = createHandOver(1);
    const t = fresh();
    expect(handOver(h, 0, 200, E, true, 5000, 7, t)).toBe(false);
    expect(t).toEqual({ from: -1, band: 1, split: 0 });
  });

  it("dissolves a tree crossing an edge over HAND_OVER_MS, then leaves it whole", () => {
    const h = createHandOver(1);
    const t = fresh();
    handOver(h, 0, 100, E, true, 0, 2, t);
    // Past the edge and the hysteresis: the dissolve begins.
    expect(handOver(h, 0, 110 + HYSTERESIS + 0.1, E, true, 100, 3, t)).toBe(true);
    expect(t).toEqual({ from: 0, band: 1, split: 1 });
    handOver(h, 0, 115, E, true, 100 + HAND_OVER_MS / 2, 4, t);
    expect(shares(t)[0]).toBeCloseTo(0.5, 6);
    expect(shares(t)[1]).toBeCloseTo(0.5, 6);
    expect(handOver(h, 0, 116, E, true, 100 + HAND_OVER_MS, 5, t)).toBe(false);
    expect(shares(t)).toEqual([0, 1, 0]);
  });

  it("holds a tree's cut while the lens bobs at the edge", () => {
    const h = createHandOver(1);
    const t = fresh();
    handOver(h, 0, 108, E, true, 0, 2, t);
    for (let k = 0; k < 120; k++) {
      const d = 110 + (HYSTERESIS - 0.5) * Math.sin(k * 0.7);
      expect(handOver(h, 0, d, E, true, k * 16, k + 3, t)).toBe(false);
      expect(t.band).toBe(0);
    }
  });

  it("runs a dissolve backwards when the tree turns back mid-way", () => {
    const h = createHandOver(1);
    const t = fresh();
    handOver(h, 0, 100, E, true, 0, 2, t);
    handOver(h, 0, 120, E, true, 0, 3, t);
    handOver(h, 0, 120, E, true, HAND_OVER_MS * 0.3, 4, t);
    const before = shares(t);
    handOver(h, 0, 100, E, true, HAND_OVER_MS * 0.3, 5, t);
    const after = shares(t);
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
  });

  it("gives a tree the lens did not see on the last fill its cut at once", () => {
    const h = createHandOver(1);
    const t = fresh();
    handOver(h, 0, 100, E, true, 0, 2, t);
    // Out of sight for a while (a head turned), back at 400 m.
    expect(handOver(h, 0, 400, E, true, 900, 9, t)).toBe(false);
    expect(shares(t)).toEqual([0, 0, 1]);
  });

  for (const { name, edges } of pairings) {
    it(`never swaps a cut in a frame, riding in or out at 40 m/s (${name})`, () => {
      for (const inFar of [true, false]) {
        for (const [a, b] of [
          [edges.far + 20, 0],
          [0, edges.far + 20],
        ]) {
          const run = ride(edges, inFar, a, b, 40);
          let jump = 0;
          let most = 0;
          for (let k = 1; k < run.length; k++) {
            most = Math.max(most, run[k][0] + run[k][1] + run[k][2]);
            for (let c = 0; c < 3; c++) jump = Math.max(jump, Math.abs(run[k][c] - run[k - 1][c]));
          }
          // Two windows of one 0..1 threshold: never more than a whole tree,
          // and no cut's share moves more than a frame of the dissolve.
          expect(most).toBeLessThanOrEqual(1 + 1e-9);
          expect(jump).toBeLessThan(1000 / 60 / HAND_OVER_MS + 1e-9);
        }
      }
    });
  }
});
