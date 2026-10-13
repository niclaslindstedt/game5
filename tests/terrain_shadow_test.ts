// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The mountain's own shadow (`pwa/src/game/terrain-shadow.ts`): the horizon
// baked along the key light's bearing, and the share of the key a point
// under it takes — on hand-built ground and on the synthetic slope, nothing
// the generator built.

import { describe, expect, it } from "vitest";

import { createHeightfield, type Heightfield } from "@engine";

import { sunDirection } from "../pwa/src/game/sky.ts";
import {
  bakedFor,
  bakeHorizon,
  createHorizonBlend,
  horizonAt,
  landBlend,
  steerBlend,
  turnBetween,
  keyBearing,
  keyElevation,
  sameBearing,
  sunlitShare,
  TERRAIN_SHADOW,
  TERRAIN_SHADOW_GLSL,
  terrainLitAt,
} from "../pwa/src/game/terrain-shadow.ts";
import { SLOPE, syntheticLevel } from "./support/synthetic.ts";

const DEG = Math.PI / 180;

/** A 1200 m square of ground at 2 m, the height `f(x, z)` m. */
function ground(f: (x: number, z: number) => number, size = 1200, cell = 2): Heightfield {
  const n = Math.round(size / cell) + 1;
  const field = createHeightfield(0, 0, cell, n, n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) field.data[r * n + c] = f(c * cell, r * cell);
  }
  return field;
}

/** A WALL 60 m high and 20 m thick running along z at x 600…620. */
const WALL = { from: 600, to: 620, height: 60 };
const walled = ground((x) => (x >= WALL.from && x <= WALL.to ? WALL.height : 0));

/** The key `elevation` rad up, standing off along +x (bearing 90°). */
const eastKey = (elevation: number) => sunDirection(Math.PI / 2, elevation);

describe("the mountain's shadow (terrain-shadow.ts)", () => {
  it("reads the key's bearing and elevation the way the sky states them", () => {
    for (const [az, el] of [
      [0.3, 0.2],
      [2.9, 0.05],
      [-2.2, 0.8],
    ]) {
      const key = sunDirection(az, el);
      expect(keyElevation(key)).toBeCloseTo(el, 9);
      expect(Math.cos(keyBearing(key) - az)).toBeCloseTo(1, 9);
    }
  });

  it("lights a flat plain everywhere, even under a low key", () => {
    const flat = ground(() => 120);
    const key = eastKey(4 * DEG);
    const map = bakeHorizon(flat, keyBearing(key));
    for (const [x, z] of [
      [10, 10],
      [600, 600],
      [1190, 300],
    ]) {
      expect(terrainLitAt(map, x, z, key)).toBe(1);
    }
  });

  it("shades the ground down-sun of a wall, as far as the key's height throws it", () => {
    const elevation = 10 * DEG;
    const key = eastKey(elevation);
    const map = bakeHorizon(walled, keyBearing(key));
    const reach = WALL.height / Math.tan(elevation); // ≈ 340 m
    // Down-sun (the key stands off along +x, so the shadow falls toward −x).
    expect(terrainLitAt(map, WALL.from - 20, 600, key)).toBe(0);
    expect(terrainLitAt(map, WALL.from - reach * 0.8, 600, key)).toBe(0);
    expect(terrainLitAt(map, WALL.from - reach * 1.2, 600, key)).toBe(1);
    // Up-sun of the wall, and on its crest, the key is whole.
    expect(terrainLitAt(map, WALL.to + 20, 600, key)).toBe(1);
    expect(terrainLitAt(map, 700, 600, key)).toBe(1);
    expect(terrainLitAt(map, WALL.to - 2, 600, key)).toBe(1);
    // A higher key throws the same wall's shadow shorter.
    const high = eastKey(40 * DEG);
    const noon = bakeHorizon(walled, keyBearing(high));
    expect(terrainLitAt(noon, WALL.from - reach * 0.8, 600, high)).toBe(1);
    expect(terrainLitAt(noon, WALL.from - 20, 600, high)).toBe(0);
  });

  it("puts nothing in the wall's shadow when the key stands along it", () => {
    // Bearing 0: the key stands off along +z, the wall runs along z.
    const key = sunDirection(0, 10 * DEG);
    const map = bakeHorizon(walled, keyBearing(key));
    expect(terrainLitAt(map, WALL.from - 20, 600, key)).toBe(1);
    expect(terrainLitAt(map, WALL.to + 20, 600, key)).toBe(1);
  });

  it("softens the edge into a penumbra as wide as its band", () => {
    const key = eastKey(10 * DEG);
    const map = bakeHorizon(walled, keyBearing(key));
    const reach = WALL.height / Math.tan(10 * DEG);
    // Walk out of the shadow along the ground: the share rises smoothly,
    // never backwards, from none to all.
    let last = 0;
    let between = 0;
    for (let d = reach * 0.9; d <= reach * 1.1; d += 2) {
      const lit = terrainLitAt(map, WALL.from - d, 600, key);
      expect(lit).toBeGreaterThanOrEqual(last - 1e-6);
      if (lit > 0.05 && lit < 0.95) between++;
      last = lit;
    }
    expect(last).toBe(1);
    expect(between).toBeGreaterThan(2);
    // The band itself, stated once.
    expect(sunlitShare(0.2, 0.2 + TERRAIN_SHADOW.band)).toBe(1);
    expect(sunlitShare(0.2, 0.2 - TERRAIN_SHADOW.band - 2 * TERRAIN_SHADOW.bias)).toBe(0);
  });

  it("shades a face turned from a key lower than its pitch, and lights it turned toward one", () => {
    // THE SLOPE falls along +z at 20°; the moon at 10° behind its top
    // (toward −z) leaves the face in the mountain's shade, and in front of
    // it (toward +z) lights it. Mid-face, off the piste.
    const level = syntheticLevel();
    const x = SLOPE.x + 200;
    const z = (SLOPE.top + SLOPE.bottom) / 2;
    const behind = sunDirection(Math.PI, 10 * DEG);
    const ahead = sunDirection(0, 10 * DEG);
    const turned = bakeHorizon(level.ground, keyBearing(behind));
    const facing = bakeHorizon(level.ground, keyBearing(ahead));
    expect(terrainLitAt(turned, x, z, behind)).toBe(0);
    expect(terrainLitAt(facing, x, z, ahead)).toBe(1);
    // The same face under a key higher than its pitch is lit from behind too.
    const over = sunDirection(Math.PI, 35 * DEG);
    expect(terrainLitAt(turned, x, z, over)).toBe(1);
    // The horizon behind is the face's own pitch, near enough.
    expect(horizonAt(turned, x, z)).toBeCloseTo(Math.atan(SLOPE.grade), 1);
  });

  it("bakes onto a grid that covers the ground and caps its texels", () => {
    const map = bakeHorizon(walled, 0.4, 256);
    expect(Math.max(map.cols, map.rows)).toBeLessThanOrEqual(256);
    expect(map.originX).toBe(walled.originX);
    expect(map.originZ).toBe(walled.originZ);
    expect(map.cell % walled.cell).toBe(0);
    expect((map.cols - 1) * map.cell).toBeLessThanOrEqual((walled.cols - 1) * walled.cell);
    expect((map.cols - 1) * map.cell).toBeGreaterThan((walled.cols - 1) * walled.cell - map.cell);
    expect(map.data.length).toBe(map.cols * map.rows);
    for (const v of map.data) expect(Number.isFinite(v)).toBe(true);
  });

  it("is baked again only when the key's bearing moves", () => {
    const key = sunDirection(1.1, 0.3);
    const map = bakeHorizon(walled, keyBearing(key), 128);
    expect(bakedFor(map, key)).toBe(true);
    // The elevation alone is the shader's to compare: no new bake.
    expect(bakedFor(map, sunDirection(1.1, 0.6))).toBe(true);
    expect(bakedFor(map, sunDirection(1.1 + 3 * TERRAIN_SHADOW.rebake, 0.3))).toBe(false);
    expect(bakedFor(null, key)).toBe(false);
    expect(sameBearing(Math.PI - 1e-4, -Math.PI + 1e-4)).toBe(true);
  });

  it("states the same band and bias to the shader", () => {
    expect(TERRAIN_SHADOW_GLSL).toContain(TERRAIN_SHADOW.band.toFixed(4));
    expect(TERRAIN_SHADOW_GLSL).toContain(TERRAIN_SHADOW.bias.toFixed(4));
    expect(TERRAIN_SHADOW_GLSL).toContain("float terrainLit(vec3 world)");
  });

  // A TURNING KEY: the sun on the sky's clock, a winter's few degrees of
  // azimuth a real minute, bakes landing a few frames after they are asked.
  // A winter sun at ×12, and a high summer one swinging through the south.
  it.each([0.0009, 0.004])("draws a key turning %f rad/s between two maps, never off", (rate) => {
    const blend = createHorizonBlend();
    const dt = 1 / 60;
    const late = 20; // frames a bake takes to come back
    const flight: { at: number; bearing: number }[] = [];
    let drawnWas: number | null = null;
    let worstJump = 0;
    let off = 0;
    let bakes = 0;
    for (let f = 0; f < 60 * 120; f++) {
      const t = f * dt;
      const bearing = 1 + rate * t;
      const ahead = 1 + rate * (t + TERRAIN_SHADOW.lead);
      for (const job of flight.filter((j) => j.at <= f)) {
        landBlend(blend, { ...bakeStub, bearing: job.bearing });
      }
      flight.splice(0, flight.length, ...flight.filter((j) => j.at > f));
      const ask = steerBlend(blend, bearing, ahead);
      if (ask !== null) {
        flight.push({ at: f + late, bearing: ask });
        bakes++;
      }
      if (!blend.on) {
        if (f > late) off++;
        continue;
      }
      // The bearing the drawn horizon stands for: the pair mixed by share.
      const drawn =
        blend.from!.bearing + blend.share * turnBetween(blend.from!.bearing, blend.to!.bearing);
      expect(Math.abs(turnBetween(drawn, bearing))).toBeLessThanOrEqual(TERRAIN_SHADOW.rebake);
      // (From the first pair on: the first map ahead lands over a lone map
      // a bake's latency of turn behind — under a tenth of `rebake`.)
      if (blend.from === blend.to) continue;
      if (drawnWas !== null) worstJump = Math.max(worstJump, Math.abs(drawn - drawnWas));
      drawnWas = drawn;
    }
    // Never off once the first bake is in, and every frame a glide of the
    // sun's own frame's turn, never a bake's step.
    expect(off).toBe(0);
    expect(worstJump).toBeLessThan(rate * dt * 4);
    // A bake every few seconds of run, not one a frame.
    expect(bakes).toBeLessThan(120 / 4);
    expect(bakes).toBeGreaterThan(3);
  });

  it("hands the sun's shadow to the moon's with no gap, and follows the moon on", () => {
    const blend = createHorizonBlend();
    const land = (b: number | null) => b !== null && landBlend(blend, { ...bakeStub, bearing: b });
    land(steerBlend(blend, 1, null));
    // The sun at 1 rad, sinking; the moon will be the key at -0.5, turning
    // the other way.
    land(steerBlend(blend, 1.0001, -0.5)); // the moon's bearing baked ahead
    expect(blend.to?.bearing).toBe(-0.5);
    steerBlend(blend, 1.0002, -0.5);
    expect(blend.on).toBe(true);
    // The key passes to the moon: the map ahead is already its own.
    steerBlend(blend, -0.5, -0.501);
    expect(blend.on).toBe(true);
    expect(blend.share).toBe(1);
    // The moon turns on, the other way: the next map goes its way.
    let off = 0;
    for (let i = 1; i <= 200; i++) {
      const b = -0.5 - i * 0.0005;
      land(steerBlend(blend, b, b - 0.009));
      if (!blend.on) off++;
    }
    expect(off).toBe(0);
  });

  it("cuts to a fresh bake when the key jumps", () => {
    const blend = createHorizonBlend();
    const first = steerBlend(blend, 0.5, null);
    expect(first).toBe(0.5);
    landBlend(blend, { ...bakeStub, bearing: 0.5 });
    expect(steerBlend(blend, 0.5, null)).toBeNull();
    expect(blend.on).toBe(true);
    // The moon taking over a quarter of the sky away.
    const ask = steerBlend(blend, 2.1, null);
    expect(ask).toBe(2.1);
    expect(blend.on).toBe(false);
    // A stale bake for the old bearing is dropped.
    landBlend(blend, { ...bakeStub, bearing: 0.5 });
    expect(blend.on).toBe(false);
    landBlend(blend, { ...bakeStub, bearing: 2.1 });
    steerBlend(blend, 2.1, null);
    expect(blend.on).toBe(true);
    expect(blend.from).toBe(blend.to);
  });
});

/** A baked map's shape with no horizon in it — the blend reads bearings. */
const bakeStub = {
  originX: 0,
  originZ: 0,
  cell: 4,
  cols: 1,
  rows: 1,
  bearing: 0,
  data: new Float32Array(1),
};
