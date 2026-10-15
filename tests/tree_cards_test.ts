// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CARD TREES: the needle atlas painted in code (`tree-atlas.ts`) and every
// variant built of cards over it (`tree-cards.ts`) — three cuts, each lighter
// than the one before, every vertex carrying the atlas's UV and its card mark, and the
// atlas's mips keeping the coverage the cut is made at.

import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { TREE_KINDS } from "@engine";

import { regionLookOf } from "../pwa/src/game/region-look.ts";
import {
  ALPHA_CUT,
  ATLAS_SIZE,
  TILES,
  atTile,
  paintAtlas,
  type AtlasTile,
} from "../pwa/src/game/tree-atlas.ts";
import { CARD_LODS, buildCardTree, type CardLod } from "../pwa/src/game/tree-cards.ts";
import { FOREST_LOOK } from "../pwa/src/game/settings-video.ts";
import { treePaint } from "../pwa/src/game/tree-shapes.ts";
import { TREE_VARIANTS } from "../pwa/src/game/tree-variants.ts";

const paint = treePaint(regionLookOf("alpine"));
const levels = paintAtlas();

/** The share of a tile's pixels at mip `k` the material keeps. */
function coverage(tile: AtlasTile, k: number): number {
  const size = ATLAS_SIZE >> k;
  const [x, y, w, h] = TILES[tile].map((n) => n >> k);
  const data = levels[k];
  let kept = 0;
  for (let py = y; py < y + h; py++)
    for (let px = x; px < x + w; px++)
      if (data[(py * size + px) * 4 + 3] >= ALPHA_CUT * 255) kept++;
  return kept / (w * h);
}

describe("the needle atlas", () => {
  it("is painted with every mip down to one pixel", () => {
    expect(levels[0].length).toBe(ATLAS_SIZE * ATLAS_SIZE * 4);
    expect(levels.length).toBe(Math.log2(ATLAS_SIZE) + 1);
  });

  it("keeps a card's coverage down its mips, so a far tree does not thin away", () => {
    for (const tile of ["spruceSide", "spireSide", "spruce", "larch"] as const) {
      const top = coverage(tile, 0);
      expect(top).toBeGreaterThan(0.1);
      for (const k of [2, 3, 4]) expect(Math.abs(coverage(tile, k) - top)).toBeLessThan(0.12);
    }
  });
});

/** The area a shape covers, in the tree's unit frame: a card's two sides
 * once (only one of them is ever drawn), the solid wood and core whole. */
function area(g: THREE.BufferGeometry): number {
  const p = g.getAttribute("position").array as ArrayLike<number>;
  const uv = g.getAttribute("uv").array as ArrayLike<number>;
  const [su, sv] = atTile("solid", 0.5, 0.5);
  let sum = 0;
  for (let i = 0, t = 0; i + 8 < p.length; i += 9, t += 6) {
    const ux = p[i + 3] - p[i];
    const uy = p[i + 4] - p[i + 1];
    const uz = p[i + 5] - p[i + 2];
    const vx = p[i + 6] - p[i];
    const vy = p[i + 7] - p[i + 1];
    const vz = p[i + 8] - p[i + 2];
    const solid = Math.abs(uv[t] - su) < 1e-6 && Math.abs(uv[t + 1] - sv) < 1e-6;
    const a = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    sum += solid ? a : a / 2;
  }
  return sum;
}

describe("the card trees", () => {
  it("builds every kind at every cut with its atlas UV and card mark", () => {
    for (const kind of TREE_KINDS)
      for (let lod = 0; lod < CARD_LODS; lod++) {
        const g = buildCardTree(TREE_VARIANTS[kind][0], paint, lod as CardLod);
        const n = g.getAttribute("position").count;
        expect(n).toBeGreaterThan(0);
        expect(g.getAttribute("uv").count).toBe(n);
        expect(g.getAttribute("card").count).toBe(n);
        expect(g.getAttribute("color").count).toBe(n);
      }
  });

  it("is lighter at each cut than the one before", () => {
    for (const kind of TREE_KINDS) {
      for (const v of TREE_VARIANTS[kind]) {
        const tris = (lod: CardLod) =>
          buildCardTree(v, paint, lod).getAttribute("position").count / 3;
        expect(tris(1)).toBeLessThan(tris(0));
        expect(tris(2)).toBeLessThanOrEqual(tris(1));
        // A card's cost is its fill: the light cut lays less than the full
        // one, and the cloud — two silhouettes standing through the crown,
        // drawn only far off — never much more (a sapling's full cut is a
        // few twigs).
        const full = area(buildCardTree(v, paint, 0));
        expect(area(buildCardTree(v, paint, 1))).toBeLessThan(full);
        expect(area(buildCardTree(v, paint, 2))).toBeLessThan(full * 1.25);
      }
    }
  });

  it("is drawn on MEDIUM and HIGH at every distance, the faceted trees only on LOW", () => {
    expect(FOREST_LOOK.low.style).toBe("faceted");
    expect(FOREST_LOOK.medium.style).toBe("cards");
    expect(FOREST_LOOK.high.style).toBe("cards");
    // The full card cut is HIGH's alone; MEDIUM's nearest is the light cut.
    expect(FOREST_LOOK.medium.cards).toBe(0);
    expect(FOREST_LOOK.high.cards).toBeGreaterThan(0);
    expect(FOREST_LOOK.high.cards).toBeLessThan(FOREST_LOOK.high.full);
  });
});
