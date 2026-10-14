// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VOLUMETRIC CLOUDS' PURE HALF (`cloud-volume-noise.ts`,
// `cloud-volume-plan.ts`): the Perlin-Worley noise tiles and spans its
// range, the march's block order visits every pixel, the kept and fresh
// pictures' sizes, what counts as a cut, and each genus's carve.

import { describe, expect, it } from "vitest";

import {
  cloudDetailNoise,
  cloudShapeNoise,
  DETAIL_SIZE,
  SHAPE_SIZE,
  shapeOf,
  texelOf,
} from "../pwa/src/game/cloud-volume-noise.ts";
import {
  bayerOrder,
  carveOf,
  carveOffsets,
  CUT,
  isCut,
  volumeSizes,
  type VolumeView,
} from "../pwa/src/game/cloud-volume-plan.ts";

describe("the noise", () => {
  const shape = cloudShapeNoise();
  const detail = cloudDetailNoise();
  it("is the sizes it says", () => {
    expect(shape.length).toBe(SHAPE_SIZE ** 3 * 4);
    expect(detail.length).toBe(DETAIL_SIZE ** 3 * 4);
  });
  it("spans its range in every channel", () => {
    for (let c = 0; c < 4; c++) {
      let lo = 255;
      let hi = 0;
      for (let i = c; i < shape.length; i += 4) {
        lo = Math.min(lo, shape[i]);
        hi = Math.max(hi, shape[i]);
      }
      expect(hi - lo).toBeGreaterThan(150);
    }
  });
  it("tiles: the faces across the wrap are as close as neighbours inside", () => {
    const N = SHAPE_SIZE;
    for (let c = 0; c < 4; c++) {
      let seam = 0;
      let inside = 0;
      for (let z = 0; z < N; z++)
        for (let y = 0; y < N; y++) {
          seam += Math.abs(texelOf(shape, N, N - 1, y, z, c) - texelOf(shape, N, 0, y, z, c));
          inside += Math.abs(
            texelOf(shape, N, N / 2 - 1, y, z, c) - texelOf(shape, N, N / 2, y, z, c),
          );
        }
      expect(seam).toBeLessThan(inside * 1.6 + 1);
    }
  });
  it("carves puffs: the shape spreads wide enough for the cover's cut to bite", () => {
    const all: number[] = [];
    for (let i = 0; i < shape.length; i += 4) {
      const s = shapeOf(shape[i] / 255, shape[i + 1] / 255, shape[i + 2] / 255, shape[i + 3] / 255);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
      all.push(s);
    }
    all.sort((a, b) => a - b);
    const q = (p: number): number => all[Math.floor(p * (all.length - 1))];
    expect(q(0.95) - q(0.05)).toBeGreaterThan(0.2);
  });
});

describe("the plan", () => {
  it("visits every pixel of a block once", () => {
    for (const b of [2, 4] as const) {
      const o = bayerOrder(b);
      expect(o).toHaveLength(b * b);
      expect(new Set(o.map(([x, y]) => y * b + x)).size).toBe(b * b);
    }
  });
  it("keeps half the buffer and marches a block's share of it", () => {
    const s = volumeSizes(1280, 720, 4);
    expect(s.keep).toEqual([640, 360]);
    expect(s.fresh).toEqual([160, 90]);
  });
  it("tells a cut", () => {
    const v: VolumeView = { eye: [0, 0, 0], ahead: [0, 0, 1], t: 1, sun: [0, 1, 0], key: "a" };
    expect(isCut(null, v)).toBe(true);
    expect(isCut(v, { ...v, t: 1 + 1 / 60, eye: [0.5, 0, 0.5] })).toBe(false);
    expect(isCut(v, { ...v, key: "b" })).toBe(true);
    expect(isCut(v, { ...v, eye: [CUT.eye + 1, 0, 0] })).toBe(true);
    expect(isCut(v, { ...v, ahead: [1, 0, 0] })).toBe(true);
    expect(isCut(v, { ...v, t: 5 })).toBe(true);
  });
  it("marches every genus but the thin ice, its offsets in the tile", () => {
    expect(carveOf({ kind: "cirrus", size: 2000 }).marched).toBe(false);
    expect(carveOf({ kind: "veil", size: 2000 }).marched).toBe(false);
    for (const kind of ["cumulus", "congestus", "strato", "nimbo", "fractus"] as const) {
      const c = carveOf({ kind, size: 1000 });
      expect(c.marched).toBe(true);
      expect(c.shapeTile).toBeGreaterThanOrEqual(500);
      expect(c.shapeTile).toBeLessThanOrEqual(2400);
      for (const t of [0, 3600, 86400]) {
        const o = carveOffsets({ speed: 20, heading: 1 }, c, t);
        for (const v of [...o.shape, ...o.detail]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThan(1);
        }
      }
    }
  });
});
