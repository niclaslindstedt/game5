// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GPU SKY (MEDIUM and HIGH, `sky-gpu.ts`), held where Node can hold it:
// the tiers it rides (the DISTANCE row), the march's steps against the
// 80-step march the LOW table was baked with (the GPU runs the same march
// on the same spacing, `sky-gpu-glsl.ts`), the aerial-perspective volume's
// slices, the haze's extinction per channel, the look's numbers the GPU
// exposes its table with, and the GLSL names every world material reads.

import { describe, expect, it } from "vitest";

import { createAtmosphere, skyRadiance, type Rgb } from "../pwa/src/game/atmosphere-model.ts";
import { HAZE_FRAGMENT, SKY_GLSL } from "../pwa/src/game/haze.ts";
import {
  AERIAL_GLSL,
  FROXEL_FRAGMENT,
  MS_FRAGMENT,
  TRANS_FRAGMENT,
  VIEW_FRAGMENT,
} from "../pwa/src/game/sky-gpu-glsl.ts";
import {
  FROXEL_ATLAS,
  FROXELS,
  froxelDepth,
  froxelSlice,
  hazeTint,
  SKY_TIER_LOOK,
} from "../pwa/src/game/sky-gpu-plan.ts";
import { DISTANCE_LEVELS, SKY_TIER } from "../pwa/src/game/settings-video.ts";
import { DOME, skyLookFor } from "../pwa/src/game/sky.ts";
import { CLEAR_WEATHER, type Weather } from "@engine";

const atmo = createAtmosphere();
const lum = (c: Rgb): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const rad = (d: number): number => (d * Math.PI) / 180;

describe("the sky's tiers", () => {
  it("ride the DISTANCE row: LOW the table, MEDIUM and HIGH (and MAX) the GPU's", () => {
    for (const d of DISTANCE_LEVELS) expect(SKY_TIER[d]).toBeDefined();
    expect(SKY_TIER.low).toBe("low");
    expect(SKY_TIER.medium).toBe("medium");
    expect(SKY_TIER.high).toBe("high");
    expect(SKY_TIER.max).toBe("high");
    expect(SKY_TIER_LOOK.low.lut).toBeNull();
    expect(SKY_TIER_LOOK.medium.lut).toEqual([96, 50]);
    expect(SKY_TIER_LOOK.high.lut).toEqual([192, 108]);
    expect(SKY_TIER_LOOK.high.froxels).toBe(true);
    expect(SKY_TIER_LOOK.medium.froxels).toBe(false);
  });

  it("march close enough to the baked sky: MEDIUM within 7 % (3.5 % pressed), HIGH within 1 %", () => {
    let worst = { medium: 0, high: 0 };
    for (const e of [-4, -1, 0, 3, 10, 30, 60])
      for (const [az, el] of [
        [0, 0.5],
        [0, 5],
        [30, 2],
        [90, 1],
        [180, 0.5],
        [180, 15],
        [0, 60],
      ]) {
        const sun = { x: 0, y: Math.sin(rad(e)), z: Math.cos(rad(e)) };
        const a = rad(az);
        const l = rad(el);
        const v = { x: Math.sin(a) * Math.cos(l), y: Math.sin(l), z: Math.cos(a) * Math.cos(l) };
        const ref = lum(skyRadiance(atmo, 1200, v, sun));
        for (const t of ["medium", "high"] as const) {
          const got = lum(skyRadiance(atmo, 1200, v, sun, [0, 0, 0], SKY_TIER_LOOK[t].steps));
          worst = { ...worst, [t]: Math.max(worst[t], Math.abs(got / ref - 1)) };
        }
      }
    expect(worst.medium).toBeLessThan(0.07);
    // The dome is pressed about its mean to the power `DOME.span`.
    expect(Math.pow(1 + worst.medium, DOME.span) - 1).toBeLessThan(0.035);
    expect(worst.high).toBeLessThan(0.01);
  });
});

describe("the aerial-perspective volume", () => {
  it("crowds its slices near the lens and reaches a hundred kilometres", () => {
    expect(froxelDepth(0)).toBeLessThan(5);
    expect(froxelDepth(9)).toBeGreaterThan(2500);
    expect(froxelDepth(9)).toBeLessThan(3500);
    expect(froxelDepth(FROXELS.slices - 1)).toBeCloseTo(FROXELS.depth, 3);
    for (const k of [0, 5, 17, 31]) expect(froxelSlice(froxelDepth(k))).toBeCloseTo(k, 6);
    expect(froxelSlice(0)).toBe(-1);
    expect(FROXEL_ATLAS.width).toBe(FROXELS.size * FROXELS.slices);
  });
});

describe("the haze's extinction per channel", () => {
  it("averages to the game's haze, takes the blue first on a clear day and is grey in a fog", () => {
    const clear = hazeTint(1 / 6000, 800);
    expect(0.2126 * clear[0] + 0.7152 * clear[1] + 0.0722 * clear[2]).toBeCloseTo(1, 6);
    expect(clear[2]).toBeGreaterThan(clear[1]);
    expect(clear[1]).toBeGreaterThan(clear[0]);
    expect(clear[2]).toBeLessThan(1.3);
    const fog = hazeTint(1 / 40, 800);
    for (const c of fog) expect(Math.abs(c - 1)).toBeLessThan(0.01);
    expect(hazeTint(0, 800)).toEqual([1, 1, 1]);
  });
});

describe("the look the GPU exposes its table by", () => {
  it("names the lens's altitude, the dome's mean and a veil's share", () => {
    const fair: Weather = { ...CLEAR_WEATHER, kind: "fair" };
    const clear = skyLookFor(0, rad(20), undefined, CLEAR_WEATHER, undefined, 1500);
    expect(clear.altitude).toBe(1500);
    expect(clear.domeMean).toBeGreaterThan(0);
    expect(clear.veil).toBe(0);
    expect(skyLookFor(0, rad(20), undefined, fair).veil).toBeGreaterThan(0);
    const lid: Weather = { ...CLEAR_WEATHER, kind: "overcast" };
    expect(skyLookFor(0, rad(20), undefined, lid).veil).toBe(0);
  });
});

describe("the GLSL every world material reads", () => {
  it("keeps the sky's names and reads the aerial perspective through the haze", () => {
    for (const name of [
      "vec3 skyColour(vec3 dir)",
      "vec3 hazeColour(vec3 dir)",
      "float hazeAmount(float dist, float rise)",
      "float mistBand(vec3 dir)",
      "uniform vec2 uSkyViewSize",
      "uniform vec3 uHazeTint",
    ])
      expect(SKY_GLSL).toContain(name);
    expect(AERIAL_GLSL).toContain("vec3 aerialShade(vec3 world)");
    expect(HAZE_FRAGMENT).toContain("aerialShade(vHazeWorld)");
    expect(HAZE_FRAGMENT).toContain("uHazeTint");
    for (const src of [TRANS_FRAGMENT, MS_FRAGMENT, VIEW_FRAGMENT, FROXEL_FRAGMENT]) {
      expect(src).toContain("void main()");
      // GLSL ES reserves these, and a variable named for a built-in shadows it.
      expect(src).not.toMatch(/\b(half|input|output|filter|sample|all)\s*=/);
    }
  });
});
