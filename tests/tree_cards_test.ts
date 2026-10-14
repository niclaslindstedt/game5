// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CARD TREES: the needle atlas painted in code (`tree-atlas.ts`) and every
// variant built of cards over it (`tree-cards.ts`) — each cut lighter than the
// one before, every vertex carrying the atlas's UV and its card mark, and the
// atlas's mips keeping the coverage the cut is made at.

import { describe, expect, it } from "vitest";
import { TREE_KINDS } from "@engine";

import { regionLookOf } from "../pwa/src/game/region-look.ts";
import {
  ALPHA_CUT,
  ATLAS_SIZE,
  TILES,
  paintAtlas,
  type AtlasTile,
} from "../pwa/src/game/tree-atlas.ts";
import { buildCardTree } from "../pwa/src/game/tree-cards.ts";
import { treePaint, type TreeLod } from "../pwa/src/game/tree-shapes.ts";
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

describe("the card trees", () => {
  it("builds every kind at every cut with its atlas UV and card mark", () => {
    for (const kind of TREE_KINDS)
      for (const lod of [0, 1, 2] as TreeLod[]) {
        const g = buildCardTree(TREE_VARIANTS[kind][0], paint, lod);
        const n = g.getAttribute("position").count;
        expect(n).toBeGreaterThan(0);
        expect(g.getAttribute("uv").count).toBe(n);
        expect(g.getAttribute("card").count).toBe(n);
        expect(g.getAttribute("color").count).toBe(n);
      }
  });

  it("is lighter at each cut than the one before", () => {
    for (const kind of TREE_KINDS) {
      const tris = (lod: TreeLod) =>
        buildCardTree(TREE_VARIANTS[kind][0], paint, lod).getAttribute("position").count / 3;
      expect(tris(1)).toBeLessThan(tris(0));
      expect(tris(2)).toBeLessThanOrEqual(tris(1));
    }
  });
});
