import { describe, expect, it } from "vitest";
import {
  RELIEF,
  ROCKS,
  ROCK_MASK,
  createGame,
  rockMask,
  rockShare,
  withRock,
  type Level,
} from "@engine";
import { readFileSync } from "node:fs";

import { drawnRockAt, type ClipView } from "../pwa/src/game/rock-drawn.ts";
import { levelFor } from "./support/levels.ts";

// THE ROCK DRAWN IS THE ROCK RIDDEN: the ground's clipmap lifted by the
// rock's relief (`rock-relief-glsl.ts`, worked out again on the processor
// by `rock-drawn.ts`) against the surface a body meets (`withRock`).

const base = levelFor(38);
const rocky = withRock(base);

/** The clipmap of the finest picture round a lens at (x, z). */
function viewAt(x: number, z: number): ClipView {
  const spacing = 0.25;
  const centres = Array.from({ length: 8 }, (_, l) => {
    const snap = spacing * 2 ** (l + 1);
    return { x: Math.round(x / snap) * snap, z: Math.round(z / snap) * snap };
  });
  return { n: 192, spacing, reliefHalf: 96, centres, base: 0, last: 7, eye: { x, z } };
}

/** Rock spots well inside the map. */
function rockSpots(level: Level): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (let z = 300; z < level.size - 300; z += 47) {
    for (let x = 300; x < level.size - 300; x += 47) {
      if (rockShare(level, x, z) > 0.9) out.push({ x, z });
    }
  }
  return out;
}

/** The drawn rock against the ridden over `reach` m round each spot's lens. */
function gapRound(
  level: Level,
  ridden: Level,
  spots: { x: number; z: number }[],
  from: number,
  reach: number,
) {
  const errs: number[] = [];
  for (const at of spots) {
    const view = viewAt(at.x, at.z);
    for (let k = 0; k < 300; k++) {
      const a = k * 2.399963;
      const d = from + (reach - from) * Math.sqrt((k + 0.5) / 300);
      const x = at.x + Math.cos(a) * d;
      const z = at.z + Math.sin(a) * d;
      if (rockMask(level, x, z) <= 0) continue;
      const y = drawnRockAt(level, view, x, z);
      if (y === null) continue;
      errs.push(Math.abs(y - ridden.groundAt(x, z)));
    }
  }
  errs.sort((p, q) => p - q);
  return {
    n: errs.length,
    mean: errs.reduce((p, q) => p + q, 0) / errs.length,
    p95: errs[Math.floor(errs.length * 0.95)],
  };
}

describe("the rock drawn", () => {
  const spots = rockSpots(base).slice(0, 10);

  it("is the rock ridden near the lens, to the centimetre", () => {
    expect(spots.length).toBeGreaterThan(5);
    const g = gapRound(base, rocky, spots, 0, 16);
    console.log(`drawn rock within 16 m: mean ${g.mean.toFixed(4)} p95 ${g.p95.toFixed(4)} m`);
    expect(g.n).toBeGreaterThan(500);
    expect(g.mean).toBeLessThan(0.01);
    expect(g.p95).toBeLessThan(0.03);
  });

  it("stays within a third of a metre of it where the coarser levels draw it", () => {
    // Past the finest level (17 m on the finest picture) a vertex every
    // half metre and then every metre: the facet between two lies off the
    // rock by its bend. Nothing a body touches is that far from the lens.
    const g = gapRound(base, rocky, spots, 16, 40);
    console.log(`drawn rock 16–40 m off: mean ${g.mean.toFixed(3)} p95 ${g.p95.toFixed(3)} m`);
    expect(g.p95).toBeLessThan(0.35);
  });

  it("is the rock ridden on a summer bike park's map too", () => {
    const s = createGame({
      seed: 38,
      mode: "free",
      summer: true,
      bike: true,
      crowd: 0,
      quiet: true,
    });
    const ridden = s.level;
    const bare = ridden.bedrock ?? ridden;
    const g = gapRound(bare, ridden, rockSpots(bare).slice(0, 6), 0, 16);
    expect(g.p95).toBeLessThan(0.03);
  }, 120_000);

  it("is drawn by the shader off the engine's own numbers", () => {
    const glsl = readFileSync(
      new URL("../pwa/src/game/rock-relief-glsl.ts", import.meta.url),
      "utf8",
    );
    // The hash's constants, the integer offset, the salt's steps.
    for (const k of [
      "0x7feb352du",
      "0x846ca68bu",
      "65536",
      "s + 3u",
      "s + 5u",
      "s + 7u",
      "s + 9u",
      "s + 11u",
    ]) {
      expect(glsl).toContain(k);
    }
    // Every number of the shape is read off `RELIEF`, never restated.
    expect(glsl).toContain("RELIEF.jointWarp");
    expect(glsl).toContain("RELIEF.ribRelief");
    expect(RELIEF.lift).toBeGreaterThan(0);
    expect(ROCK_MASK[0]).toBe(ROCKS.skin.from);
  });
});
