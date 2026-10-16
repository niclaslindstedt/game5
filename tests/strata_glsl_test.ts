import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROCKS, bedCoord, bedLevel, rockHash, rockShare, strataOf } from "@engine";

import { STRATA_GLSL, STRATA_HASH, STRATA_SALTS, TREAD_MEAN } from "../pwa/src/game/strata-glsl.ts";
import { rockShareNodes } from "../pwa/src/game/rock-share-nodes.ts";
import { levelFor } from "./support/levels.ts";

// THE BEDS IN GLSL (`pwa/src/game/strata-glsl.ts`) are the engine's
// (`strata.ts`): the same integer hash to the bit, the same levels and the
// same fold, so the rock's shader and the ground's paint the bands the skin
// is built in. The GLSL cannot run here; it is read as text, and its lines
// are stepped below in TypeScript the way a GPU's `uint` steps them (a
// multiply wraps, `>>` shifts in zeros).

const level = levelFor(38);
const st = strataOf(level);
const S = ROCKS.strata;

const mix = (h: number, v: number): number => {
  h = Math.imul((h ^ v) >>> 0, STRATA_HASH.m1) >>> 0;
  h = (h ^ (h >>> STRATA_HASH.s1)) >>> 0;
  h = Math.imul(h, STRATA_HASH.m2) >>> 0;
  return (h ^ (h >>> STRATA_HASH.s2)) >>> 0;
};
const glHash = (seed: number, salt: number, k: number): number =>
  mix(mix(mix(STRATA_HASH.basis, seed >>> 0), salt >>> 0), k >>> 0);
const glUnit = (h: number): number => mix(mix(STRATA_HASH.basis, h), 0) / 4294967296;
const glDraw = (salt: number, k: number): number => glUnit(glHash(st.seed, salt, k));
const glNoise = (seed: number, x: number, z: number): number => {
  const i = Math.floor(x);
  const j = Math.floor(z);
  let tx = x - i;
  let tz = z - j;
  tx = tx * tx * (3 - 2 * tx);
  tz = tz * tz * (3 - 2 * tz);
  const a = glUnit(glHash(seed, i, j));
  const b = glUnit(glHash(seed, i + 1, j));
  const c = glUnit(glHash(seed, i, j + 1));
  const d = glUnit(glHash(seed, i + 1, j + 1));
  return 2 * (a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz) - 1;
};
const glLevel = (k: number): number => {
  const t = k / S.packet;
  const ti = Math.floor(t);
  let fr = t - ti;
  fr = fr * fr * (3 - 2 * fr);
  const a = glDraw(STRATA_SALTS.swell, ti);
  const b = glDraw(STRATA_SALTS.swell, ti + 1);
  const swell = 2 * (a + (b - a) * fr) - 1;
  const vary = 2 * (glDraw(STRATA_SALTS.vary, k) - 0.5);
  return st.bed * (k + S.swell * swell + S.vary * vary);
};
const glCoord = (x: number, z: number, y: number): number => {
  const fo = S.foldOver;
  const fold =
    S.fold *
    (glNoise((st.seed ^ STRATA_SALTS.fold) >>> 0, x / fo, z / fo) +
      0.4 * glNoise((st.seed ^ STRATA_SALTS.fold2) >>> 0, x / (fo * 0.37), z / (fo * 0.37)));
  return y - st.dipX * x - st.dipZ * z - fold;
};

describe("the beds in GLSL", () => {
  it("mixes with the engine's constants", () => {
    const src = readFileSync(new URL("../engine/game/rocks.ts", import.meta.url), "utf8");
    expect(src).toContain(`const BASIS = 0x${STRATA_HASH.basis.toString(16)};`);
    expect(src).toContain(`0x${STRATA_HASH.m1.toString(16).padStart(8, "0")}`);
    expect(src).toContain(`0x${STRATA_HASH.m2.toString(16)}`);
    expect(src).toContain(`h >>> ${STRATA_HASH.s1}`);
    expect(src).toContain(`h >>> ${STRATA_HASH.s2}`);
    for (const k of Object.values(STRATA_HASH)) {
      if (k > 100) expect(STRATA_GLSL).toContain(`0x${k.toString(16)}u`);
    }
    expect(STRATA_GLSL).toContain(`h >> ${STRATA_HASH.s1}u`);
    expect(STRATA_GLSL).toContain(`h >> ${STRATA_HASH.s2}u`);
  });

  it("hashes as the engine does, to the bit", () => {
    for (const salt of Object.values(STRATA_SALTS)) {
      for (let k = -300; k <= 300; k += 7) {
        expect(glHash(st.seed, salt, k)).toBe(rockHash(st.seed, salt, k));
      }
    }
  });

  it("lays the engine's bed levels and coordinate", () => {
    for (let k = -200; k <= 400; k++) {
      expect(glLevel(k)).toBeCloseTo(bedLevel(st, k), 6);
    }
    for (let i = 0; i < 200; i++) {
      const x = 37 + i * 19.3;
      const z = 2900 - i * 13.7;
      const y = 600 + i * 3.1;
      expect(glCoord(x, z, y)).toBeCloseTo(bedCoord(st, x, z, y, 0), 6);
    }
  });

  it("lays the bands about the beds' mean", () => {
    let sum = 0;
    const n = 4000;
    for (let k = 0; k < n; k++) {
      const r = S.riser[0] + (S.riser[1] - S.riser[0]) * glDraw(STRATA_SALTS.riser, k);
      const held = Math.max(0, (glDraw(STRATA_SALTS.deal, k) - 0.3) / 0.7);
      sum += (1 - r) * held;
    }
    expect(sum / n).toBeCloseTo(TREAD_MEAN, 1);
  });
});

describe("the rock's share in the ground's texture", () => {
  it("is the engine's share at the nodes", () => {
    const share = rockShareNodes(level);
    expect(share).not.toBeNull();
    const f = level.ground;
    let rock = 0;
    for (let k = 0; k < f.cols * f.rows; k += 97) {
      const x = f.originX + (k % f.cols) * f.cell;
      const z = f.originZ + Math.floor(k / f.cols) * f.cell;
      // Under the skin's least share nothing is laid either way.
      const want = rockShare(level, x, z);
      if (want <= ROCKS.skin.from && share![k] <= ROCKS.skin.from) continue;
      expect(share![k]).toBeCloseTo(want, 5);
      rock++;
    }
    expect(rock).toBeGreaterThan(50);
  }, 120_000);
});
