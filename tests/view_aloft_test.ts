// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VIEW ALOFT (`pwa/src/game/view-aloft.ts`) and the ground's levels it
// picks (`terrain.ts`'s `baseLevel`, `lastLevel`): on the snow every
// DISTANCE stop is its own to the metre — the same mist, woods and ground
// levels it had before a lens could climb — and aloft the view opens with
// the height until the whole ground is drawn, on no more of the ground's
// levels than the snow draws and a ring.

import { describe, expect, it } from "vitest";

import {
  DISTANCE_LEVELS,
  DISTANCE_LOOK,
  TERRAIN_REACH,
  TIERS,
  mistFor,
  terrainLook,
  terrainReach,
} from "../pwa/src/game/settings-video.ts";
import { ALOFT_VIEW, aloftLook } from "../pwa/src/game/view-aloft.ts";
import { baseLevel, lastLevel } from "../pwa/src/game/terrain.ts";

/** The levels a TERRAIN stop's whole clipmap draws for a view and a height. */
function drawn(tier: (typeof TIERS)[number], reach: number, over: number) {
  const look = terrainLook(tier);
  const reachOf = (l: number) => (look.n / 2) * look.spacing * 2 ** l;
  const last = lastLevel(reach, look.levels, reachOf);
  return { base: baseLevel(over, last, reachOf), last, reachOf };
}

describe("the view aloft (view-aloft.ts)", () => {
  it("is every DISTANCE stop's own on the snow", () => {
    for (const d of DISTANCE_LEVELS) {
      for (const over of [0, 2, 8, ALOFT_VIEW.from]) {
        const a = aloftLook(d, over);
        expect(a.mist).toBe(mistFor(d));
        expect(a.trees).toBe(DISTANCE_LOOK[d].trees);
        expect(a.view).toBe(DISTANCE_LOOK[d].view);
        expect(a.lift).toBe(0);
      }
    }
  });

  it("opens with the height until the whole ground is drawn", () => {
    for (const d of DISTANCE_LEVELS) {
      let last = aloftLook(d, 0);
      for (let over = 10; over <= 2000; over += 10) {
        const a = aloftLook(d, over);
        expect(a.reach).toBeGreaterThanOrEqual(last.reach);
        expect(a.trees).toBeGreaterThanOrEqual(last.trees);
        if (a.mist > 0) expect(a.mist).toBeGreaterThanOrEqual(a.reach);
        last = a;
      }
      // A pilot a few hundred metres up sees the whole map on every stop.
      expect(aloftLook(d, 300).reach).toBe(TERRAIN_REACH);
      expect(aloftLook(d, 2000).trees).toBeLessThanOrEqual(ALOFT_VIEW.treeMost);
    }
  });

  it("eases the mist across the ground in, whole high up", () => {
    expect(aloftLook("low", 0).aloft).toBe(0);
    expect(aloftLook("low", ALOFT_VIEW.across.from).aloft).toBe(0);
    expect(aloftLook("low", ALOFT_VIEW.across.to).aloft).toBe(1);
  });
});

describe("the ground's levels aloft (terrain.ts)", () => {
  it("draws on the snow exactly the levels the stop's own clipmap held", () => {
    for (const t of TIERS) {
      for (const d of DISTANCE_LEVELS) {
        const own = terrainLook(t, DISTANCE_LOOK[d].view);
        const { base, last } = drawn(t, DISTANCE_LOOK[d].view, aloftLook(d, 2).lift);
        expect(base).toBe(0);
        expect(last + 1).toBe(own.levels);
      }
    }
  });

  it("reaches the view aloft on a ring more than the snow draws at the most", () => {
    for (const t of TIERS) {
      expect(terrainReach(terrainLook(t))).toBeGreaterThanOrEqual(TERRAIN_REACH);
      const onSnow = drawn(t, DISTANCE_LOOK.low.view, 2);
      for (const over of [100, 300, 600, 1500, 3000]) {
        const a = aloftLook("low", over);
        const { base, last, reachOf } = drawn(t, a.reach, a.lift);
        expect(reachOf(last)).toBeGreaterThanOrEqual(a.reach);
        // A ring more at the most: the reach's whole price on the ground.
        expect(last - base).toBeLessThanOrEqual(onSnow.last - onSnow.base + 1);
        // The levels left out are all finer than a lens that high can tell.
        if (base > 0) expect(reachOf(base - 1)).toBeLessThan(over);
      }
    }
  });
});
