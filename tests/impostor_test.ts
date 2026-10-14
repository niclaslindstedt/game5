// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The far woods' impostors (`impostor-plan.ts`): the hemi-octahedral fold
// and its frames, the pictured variants and the FOREST row's ladder.

import { describe, expect, it } from "vitest";

import {
  FRAMES,
  atlasBytes,
  frameAxes,
  frameDir,
  hemiOctDecode,
  hemiOctEncode,
  nearestPictured,
  picturedOf,
} from "../pwa/src/game/impostor-plan.ts";
import { FOREST_LOOK, TIERS } from "../pwa/src/game/settings-video.ts";
import { TREE_VARIANTS } from "../pwa/src/game/tree-variants.ts";

describe("the hemi-octahedral fold", () => {
  it("folds every upper direction onto the square and back", () => {
    for (let k = 0; k < 200; k++) {
      const a = (k * 2.399) % (Math.PI * 2);
      const e = ((k * 0.618) % 1) * (Math.PI / 2);
      const d = [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
      const [u, v] = hemiOctEncode(d[0], d[1], d[2]);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      const back = hemiOctDecode(u, v);
      for (let c = 0; c < 3; c++) expect(back[c]).toBeCloseTo(d[c], 6);
    }
  });

  it("lays its frames from the horizon to nearly straight down, none below", () => {
    let top = 0;
    for (let i = 0; i < FRAMES; i++)
      for (let j = 0; j < FRAMES; j++) {
        const d = frameDir(i, j);
        expect(d[1]).toBeGreaterThanOrEqual(0);
        expect(Math.hypot(...d)).toBeCloseTo(1, 6);
        top = Math.max(top, d[1]);
      }
    expect(top).toBeGreaterThan(0.85);
    expect(frameDir(0, 0)[1]).toBeCloseTo(0, 6);
  });

  it("gives every frame an upright, square picture plane", () => {
    for (let i = 0; i < FRAMES; i++)
      for (let j = 0; j < FRAMES; j++) {
        const d = frameDir(i, j);
        const { right, up } = frameAxes(d);
        const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        expect(dot(right, d)).toBeCloseTo(0, 6);
        expect(dot(up, d)).toBeCloseTo(0, 6);
        expect(dot(right, up)).toBeCloseTo(0, 6);
        expect(Math.hypot(...right)).toBeCloseTo(1, 6);
        // The picture's up is the tree's up wherever the frame is not
        // looking straight down.
        if (d[1] < 0.95) expect(up[1]).toBeGreaterThan(0);
      }
  });
});

describe("the pictured variants", () => {
  it("draws a pictured variant as itself and the rest as one of its kind", () => {
    for (const tier of TIERS) {
      const look = FOREST_LOOK[tier].impostor;
      for (const rows of Object.values(TREE_VARIANTS)) {
        const pictured = picturedOf(rows[0].kind, look);
        expect(pictured.length).toBe(Math.min(rows.length, look.variants));
        for (const v of rows) {
          const p = nearestPictured(v, pictured);
          expect(p.kind).toBe(v.kind);
          if (pictured.includes(v)) expect(p).toBe(v);
        }
      }
    }
  });

  it("climbs the FOREST row: sharper pictures and more of them", () => {
    const [low, medium, high] = TIERS.map((t) => FOREST_LOOK[t].impostor);
    expect(low.frame).toBeLessThan(medium.frame);
    expect(medium.frame).toBeLessThan(high.frame);
    expect(low.variants).toBeLessThanOrEqual(medium.variants);
    expect(medium.variants).toBeLessThanOrEqual(high.variants);
    // The richest atlas a map can grow (every kind of the alpine roster)
    // stays inside a phone's budget.
    expect(atlasBytes(high, 10 * high.variants)).toBeLessThan(96 * 2 ** 20);
  });
});
