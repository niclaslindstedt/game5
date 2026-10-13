// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLOUD FIELD (`pwa/src/game/cloud-field.ts`, lit by `cloud-light.ts`
// through `sky.ts`): the layers at their genera's heights, carried by a
// wind that grows and veers with height, evolving smoothly with the clock,
// covering the share they are dealt, and lit by the sun through the air to
// their own height — and the valley fog seen from over its top.

import { describe, expect, it } from "vitest";

import { createGame, weatherFor, withSky, type WeatherKind } from "@engine";
import {
  cloudFieldOf,
  cloudLayersFor,
  columnAt,
  columnOf,
  fieldNoise,
  meanPass,
  noiseAt,
  veerAloft,
  windAloft,
  type CloudKind,
} from "../pwa/src/game/cloud-field.ts";
import { skyLookAt, skyLookFor } from "../pwa/src/game/sky.ts";
import { syntheticLevel } from "./support/synthetic.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const KINDS: WeatherKind[] = [
  "clear",
  "fair",
  "flurries",
  "high",
  "overcast",
  "snow",
  "storm",
  "fog",
];
/** The heights each genus lives at over the ground, m (base to top). */
const BANDS: Partial<Record<CloudKind, [number, number]>> = {
  cumulus: [1500, 3000],
  congestus: [1500, 4000],
  strato: [1500, 3000],
  altocumulus: [3000, 5000],
  altostratus: [3000, 5500],
  cirrus: [7000, 9800],
  veil: [7000, 9000],
};
const lum = (c: number[]): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

describe("the cloud field", () => {
  it("stands each genus at its own heights", () => {
    for (const kind of KINDS)
      for (const seed of [1, 7, 38, 99]) {
        const layers = cloudLayersFor(kind, seed);
        expect(layers.length).toBeGreaterThan(0);
        expect(layers.length).toBeLessThanOrEqual(3);
        for (const l of layers) {
          const band = BANDS[l.kind];
          if (!band) continue;
          expect(l.base).toBeGreaterThanOrEqual(band[0]);
          expect(l.base + l.depth).toBeLessThanOrEqual(band[1]);
        }
      }
    const fair = cloudLayersFor("fair", 38);
    expect(fair[0].kind).toBe("cumulus");
    expect(fair[0].base).toBeGreaterThanOrEqual(1500);
    expect(fair[0].base).toBeLessThanOrEqual(2000);
  });

  it("is dealt off the map's seed, and nothing off the run's stream", () => {
    expect(cloudLayersFor("fair", 38)).toEqual(cloudLayersFor("fair", 38));
    expect(cloudLayersFor("fair", 38)[0].base).not.toBe(cloudLayersFor("fair", 39)[0].base);
    const game = createGame({ seed: LEVEL_SEEDS[0], quiet: true });
    const next = game.rng.next();
    const again = createGame({ seed: LEVEL_SEEDS[0], quiet: true });
    const field = cloudFieldOf(again.level);
    for (let t = 0; t < 10; t++) for (const l of field.layers) columnAt(l, 100, 200, t);
    skyLookAt(again.level, 5, 12);
    expect(again.rng.next()).toBe(next);
  });

  it("is carried by a wind that grows and veers with height", () => {
    expect(windAloft(5, 2000)).toBeGreaterThan(windAloft(5, 500));
    expect(windAloft(5, 8000)).toBeGreaterThan(windAloft(5, 2000));
    expect(windAloft(30, 9000)).toBeLessThanOrEqual(45);
    // Clockwise with height in the north, the other way in the south.
    expect(veerAloft(8000, 45)).toBeGreaterThan(veerAloft(1500, 45));
    expect(veerAloft(1500, 45)).toBeGreaterThan(0);
    expect(veerAloft(4000, -40)).toBeLessThan(0);
    const [cu, ci] = cloudLayersFor("fair", 38, 5, 1, 45);
    expect(ci.speed).toBeGreaterThan(cu.speed);
    expect(ci.heading).toBeGreaterThan(cu.heading);
    // It goes WITH the wind: toward where the wind blows to.
    expect(Math.abs(cu.heading - (1 + Math.PI))).toBeLessThan(0.6);
  });

  it("moves and evolves smoothly from one frame to the next", () => {
    const level = levelFor(LEVEL_SEEDS[0]);
    for (const kind of ["fair", "flurries", "high", "overcast"] as const) {
      const sky = withSky(level, { weather: kind });
      const field = cloudFieldOf(sky);
      // (A layer of a few wisps may leave every point read clear, and a
      // closed veil every point whole.)
      for (const l of field.layers.filter((f) => f.cover > 0.2 && f.cover < 0.9)) {
        let most = 0;
        let moved = 0;
        for (let k = 0; k < 64; k++) {
          const x = (k % 8) * 1531 - 6000;
          const z = Math.floor(k / 8) * 1609 - 6000;
          const a = columnAt(l, x, z, 600);
          most = Math.max(most, Math.abs(columnAt(l, x, z, 600 + 1 / 60) - a));
          moved += Math.abs(columnAt(l, x, z, 600 + 120) - a);
        }
        // Under a hundredth of the depth a frame, but changed in two minutes.
        expect(most).toBeLessThan(0.01);
        expect(moved / 64).toBeGreaterThan(0.005);
      }
    }
  });

  it("tiles, as the GPU's wrapped texture does", () => {
    for (const [u, v, w] of [
      [0.13, 0.71, 0.4],
      [0.9, 0.05, 0.66],
    ])
      expect(noiseAt(u + 1, v - 2, w + 3)).toBeCloseTo(noiseAt(u, v, w), 6);
  });

  it("covers the share of the sky it is dealt", () => {
    for (const kind of ["fair", "flurries", "overcast", "high"] as const)
      for (const l of cloudLayersFor(kind, 7)) {
        let covered = 0;
        const n = 4000;
        for (let i = 0; i < n; i++) {
          const g = (i * 0.61803398875) % 1;
          const [b, top] = columnOf(l, fieldNoise(g * 7.3, ((i * 0.7548776662) % 1) * 5.1, 0.37));
          if (top - b > 0.01) covered++;
        }
        expect(Math.abs(covered / n - l.cover)).toBeLessThan(0.08);
      }
  });

  it("lets the noon sun through as each sky should", () => {
    const at = (kind: WeatherKind, sinE: number): number =>
      meanPass(cloudLayersFor(kind, 38), sinE);
    expect(at("clear", 0.34)).toBeGreaterThan(0.95);
    expect(at("fair", 0.34)).toBeGreaterThan(0.6);
    expect(at("overcast", 0.34)).toBeGreaterThan(0.12);
    expect(at("overcast", 0.34)).toBeLessThan(0.3);
    expect(at("storm", 0.34)).toBeLessThan(at("snow", 0.34));
    expect(at("snow", 0.34)).toBeLessThan(at("overcast", 0.34));
    // A higher sun crosses less of a deck.
    expect(at("overcast", 0.6)).toBeGreaterThan(at("overcast", 0.2));
  });
});

describe("the light on the cloud", () => {
  const fair = weatherFor("fair");
  const high = weatherFor("high");
  const deg = Math.PI / 180;

  it("is white at noon and orange-red at sunset, along the actual light path", () => {
    const noon = skyLookFor(Math.PI, 30 * deg, undefined, fair).clouds.layers[0].sun;
    const low = skyLookFor(Math.PI, 1 * deg, undefined, fair).clouds.layers[0].sun;
    expect(noon[0] / noon[2]).toBeLessThan(1.5);
    expect(low[0] / low[2]).toBeGreaterThan(2);
  });

  it("keeps the sun on the high ice after it has left the heaps", () => {
    // Two degrees under: the heaps at 2 km have lost it, the cirrus at
    // 8 km still holds it — red.
    const look = skyLookFor(Math.PI, -2 * deg, undefined, high);
    const ice = look.clouds.layers.map((l) => lum(l.sun));
    expect(Math.max(...ice)).toBeGreaterThan(0.02);
    const cu = skyLookFor(Math.PI, -2 * deg, undefined, fair).clouds.layers[0].sun;
    expect(lum(cu)).toBeLessThan(Math.max(...ice) * 0.5);
    const red = look.clouds.layers[0].sun;
    expect(red[0]).toBeGreaterThan(red[2]);
  });

  it("dims the key by the cloud between, and rings the sun in a veil", () => {
    const clear = skyLookFor(Math.PI, 0.35);
    const over = skyLookFor(Math.PI, 0.35, undefined, weatherFor("overcast"));
    expect(over.keyPass).toBeGreaterThan(0.12);
    expect(over.keyPass).toBeLessThan(0.3);
    expect(over.keyIntensity).toBeLessThan(clear.keyIntensity * 0.35);
    expect(skyLookFor(Math.PI, 0.35, undefined, high).clouds.halo).toBeGreaterThan(0.5);
    expect(clear.clouds.halo).toBe(0);
  });
});

describe("a valley fog", () => {
  it("is a sea of cloud from over its top, and a lid inside it", () => {
    const level = withSky(syntheticLevel(), { weather: "fog", hour: 12 });
    const inside = skyLookAt(level, 0, 0, -1000);
    expect(inside.cloud.genus).toBe(3);
    expect(inside.sea.k).toBe(0);
    const over = skyLookAt(level, 0, 0, 1e5);
    expect(over.sea.k).toBeGreaterThan(0);
    expect(over.keyIntensity).toBeGreaterThan(inside.keyIntensity * 2);
    expect(over.flat).toBeLessThan(0.2);
  });
});
