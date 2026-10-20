// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE SNOW MEETS THE ROCK (`pwa/src/game/rock-lip.ts`): a band of
// bare rock down a face is drawn with the snow's lip built out over its
// top and the stone in its shade under it, the snow banked up its foot,
// and its middle left bare.

import { describe, expect, it } from "vitest";

import {
  CORE,
  FOOT,
  LIP,
  LIP_VARY,
  noise,
  rockLip,
  ROCK_LIP_GLSL,
} from "../pwa/src/game/rock-lip.ts";

/** A band of rock 30 m down the fall line: the face rises toward +x, the
 * band's foot at x = 0 and its top at x = 30, snow above and below. */
const TOP = 30;
const at = (x: number): number => (x >= 0 && x < TOP ? 1 : 0);
const GRAD = [1.5, 0] as const;
const here = (x: number, z = 4) => rockLip(x, z, at(x), GRAD, (px) => at(px));

describe("the snow's edge over the rock", () => {
  it("builds the lip out over the band's top", () => {
    const least = LIP * LIP_VARY[0];
    for (let z = 0; z < 40; z += 0.5) {
      const o = rockLip(TOP - least * 0.9, z, 1, GRAD, (px) => at(px));
      expect(o.bare).toBe(0);
      expect(o.lip).toBeGreaterThan(0.9);
    }
  });

  it("reaches over it by more in some places than in others", () => {
    // The lip's own edge, found down the face at each step along it.
    const ends: number[] = [];
    for (let z = 0; z < 60; z += 1) {
      let x = TOP;
      while (
        x > TOP - LIP * LIP_VARY[1] - 1 &&
        rockLip(x, z, at(x), GRAD, (px) => at(px)).bare < 0.1
      )
        x -= 0.05;
      ends.push(TOP - x);
    }
    expect(Math.min(...ends)).toBeGreaterThanOrEqual(LIP * LIP_VARY[0] - 0.1);
    expect(Math.max(...ends)).toBeLessThanOrEqual(LIP * LIP_VARY[1] + 0.6);
    expect(Math.max(...ends) - Math.min(...ends)).toBeGreaterThan(0.8);
  });

  it("shades the stone under the lip and not the band's middle", () => {
    let shaded = 0;
    for (let z = 0; z < 20; z += 1) {
      for (let x = TOP - LIP * LIP_VARY[1] - CORE; x < TOP; x += 0.1) {
        const o = rockLip(x, z, at(x), GRAD, (px) => at(px));
        if (o.under > 0.4 && o.bare > 0.5) {
          shaded++;
          break;
        }
      }
    }
    expect(shaded).toBeGreaterThan(15);
    expect(here(TOP / 2).under).toBe(0);
  });

  it("banks the snow up its foot and leaves its middle bare", () => {
    expect(here(FOOT * 0.45).bare).toBe(0);
    expect(here(FOOT * 0.45).lip).toBe(0);
    let bare = 0;
    for (let z = 0; z < 50; z += 0.5) bare += rockLip(TOP / 2, z, 1, GRAD, (px) => at(px)).bare;
    expect(bare / 100).toBeGreaterThan(0.6);
  });

  it("is nothing off the rock, every share 0..1", () => {
    expect(here(-5)).toEqual({ bare: 0, lip: 0, under: 0 });
    expect(here(TOP + 5)).toEqual({ bare: 0, lip: 0, under: 0 });
    for (let x = -2; x < TOP + 2; x += 0.37) {
      const o = here(x, x * 0.7);
      for (const v of [o.bare, o.lip, o.under]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("draws the same noise as the shader, 0..1, at the world's own coordinates", () => {
    for (let k = 0; k < 200; k++) {
      const v = noise(1000 + k * 13.7, 2000 - k * 7.3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(ROCK_LIP_GLSL).toContain("float rockLip(vec2 p, float r, vec2 gr, float foot)");
    expect(ROCK_LIP_GLSL).toContain("snowNoise(");
  });
});
