// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW CLOUD a skier raises, as arithmetic (`pwa/src/game/
// snow-cloud-plan.ts`): which snow throws how much, how high, how long it
// hangs, and how a puff flies, swells and thins.

import { describe, expect, it } from "vitest";

import {
  emptyRecipe,
  flyPuff,
  landingPuffs,
  puffOpacity,
  puffRadius,
  skidCloud,
  skiCloud,
  type CloudDrive,
} from "../pwa/src/game/snow-cloud-plan.ts";
import { SNOW, blend, emptyMix, type SnowKind } from "../pwa/src/game/snowpack.ts";

const FULL: CloudDrive = { speed: 15, skid: 1, edge: 0, grounded: true };

const roost = (k: SnowKind, drive = FULL) => skidCloud(drive, SNOW[k], emptyRecipe());

describe("the skid's wall", () => {
  it("is thrown hardest out of new snow and not at all off the ice", () => {
    expect(roost("new").rate).toBeGreaterThan(roost("soft").rate);
    expect(roost("soft").rate).toBeGreaterThan(roost("hard").rate);
    expect(roost("hard").rate).toBeGreaterThan(roost("wet").rate);
    expect(roost("soft").rate).toBeGreaterThan(roost("groomed").rate);
    expect(roost("ice").rate).toBe(0);
  });

  it("needs the skis on the snow and a skid pushing it", () => {
    expect(roost("soft", { ...FULL, grounded: false }).rate).toBe(0);
    expect(roost("soft", { ...FULL, speed: 0, skid: 0 }).rate).toBe(0);
    // A fast skier sweeps a mist off even with the skis running straight.
    expect(roost("soft", { ...FULL, skid: 0 }).rate).toBeGreaterThan(0);
    expect(roost("soft", { ...FULL, skid: 1 }).rate).toBeGreaterThan(
      roost("soft", { ...FULL, skid: 0.3 }).rate,
    );
  });

  it("goes higher and thicker the deeper the loose snow", () => {
    const deep = skidCloud(FULL, blend({ ...emptyMix(), soft: 1 }, 2), emptyRecipe());
    const thin = skidCloud(FULL, blend({ ...emptyMix(), soft: 1 }, 0.5), emptyRecipe());
    expect(deep.rate).toBeGreaterThan(thin.rate);
    expect(deep.lift).toBeGreaterThan(thin.lift);
  });

  it("hangs longest and settles slowest out of the finest snow", () => {
    expect(roost("new").hang).toBeGreaterThan(roost("soft").hang);
    expect(roost("soft").hang).toBeGreaterThan(roost("wet").hang);
    expect(roost("new").settle).toBeLessThan(roost("wet").settle);
    expect(roost("new").grow).toBeGreaterThan(roost("wet").grow);
  });
});

describe("the skis and the landing", () => {
  it("throw more the harder the carve and the deeper the ski", () => {
    const at = (carve: number, sink: number) =>
      skiCloud(carve, sink, SNOW.soft, emptyRecipe()).rate;
    expect(at(10, 0)).toBeGreaterThan(at(2, 0));
    expect(at(0, 0.2)).toBeGreaterThan(at(0, 0.02));
    expect(skiCloud(10, 0.1, SNOW.ice, emptyRecipe()).rate).toBe(0);
  });

  it("raise a wall out of new snow and a puff off the groomer", () => {
    expect(landingPuffs(8, SNOW.new)).toBeGreaterThan(landingPuffs(8, SNOW.soft));
    expect(landingPuffs(8, SNOW.soft)).toBeGreaterThan(landingPuffs(8, SNOW.groomed));
    expect(landingPuffs(8, SNOW.ice)).toBe(0);
    expect(landingPuffs(1000, SNOW.new)).toBeLessThanOrEqual(120);
  });
});

describe("a puff", () => {
  it("swells as it ages, fastest at first", () => {
    const r = (a: number) => puffRadius(0.5, 2, a);
    expect(r(0)).toBeCloseTo(0.5, 6);
    expect(r(1)).toBeGreaterThan(r(0.5));
    expect(r(0.1) - r(0)).toBeGreaterThan(r(1) - r(0.9));
  });

  it("fades in, thins as it spreads, and is gone at the end", () => {
    const o = (a: number) => puffOpacity(0.6, 0.5, 2, a);
    expect(o(0)).toBe(0);
    expect(o(1)).toBeCloseTo(0, 6);
    expect(o(0.05)).toBeGreaterThan(o(0.5));
    expect(o(0.5)).toBeGreaterThan(o(0.9));
    expect(o(0.05)).toBeLessThanOrEqual(0.6);
  });

  it("slows to the wind and settles at its own speed", () => {
    const v = new Float32Array([10, 5, -3]);
    for (let i = 0; i < 600; i++) flyPuff(v, 0, 2, 0, 1, 0.4, 0.3, 1 / 60);
    expect(v[0]).toBeCloseTo(2, 3);
    expect(v[1]).toBeCloseTo(-0.3, 3);
    expect(v[2]).toBeCloseTo(1, 3);
  });
});
