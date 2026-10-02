// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREES, AGED AND BUILT: every tree's AGE and the girth of its trunk
// (R14, `engine/mapgen/forest.ts` — what a skier meets), and every variant
// built procedurally at its three cuts (`tree-shapes.ts`) — chunky, each cut
// lighter than the one before, and its trunk tagged so the forest can draw
// it at that girth (`tree-mesh.ts`).

import { describe, expect, it } from "vitest";
import { LEVEL_RULES, TREE_KINDS, treeAge, trunkRadius } from "@engine";

import { regionLookOf } from "../pwa/src/game/region-look.ts";
import { TRUNK_REF } from "../pwa/src/game/tree-mesh.ts";
import { buildTree, treePaint, type TreeLod } from "../pwa/src/game/tree-shapes.ts";
import { TREE_VARIANTS, VARIANTS, treeVariant } from "../pwa/src/game/tree-variants.ts";
import { FOREST_LOOK, TIERS } from "../pwa/src/game/settings-video.ts";
import { levelFor } from "./support/levels.ts";

const paint = treePaint(regionLookOf("alpine"));
const tris = (lod: TreeLod, kind = TREE_KINDS[0], i = 0): number =>
  buildTree(TREE_VARIANTS[kind][i], paint, lod).getAttribute("position").count / 3;

describe("a tree's age and its trunk (R14)", () => {
  it("grows a trunk with its age, from a sapling's wrist to a veteran's metre", () => {
    const A = LEVEL_RULES.forest.age;
    expect(trunkRadius(10)).toBeLessThan(0.1);
    expect(trunkRadius(A.max)).toBeGreaterThan(0.5);
    for (let a = 0; a < A.max; a += 10) expect(trunkRadius(a + 10)).toBeGreaterThan(trunkRadius(a));
  });

  it("is older the taller it grew, spread by where it stands, never past the oldest", () => {
    const A = LEVEL_RULES.forest.age;
    // The same place, two heights: the taller is the older.
    expect(treeAge(18, 100, 200, 7)).toBeGreaterThan(treeAge(6, 100, 200, 7));
    // A pure function of the place: asked twice, the same answer.
    expect(treeAge(12, 310.5, 47.25, 9)).toBe(treeAge(12, 310.5, 47.25, 9));
    for (let i = 0; i < 400; i++)
      expect(treeAge(19, i * 13.7, i * 7.3, 3)).toBeLessThanOrEqual(A.max);
  });

  it("deals a wood GREATLY varied trunks, and every tree's is its age's", () => {
    const level = levelFor(38);
    const radii = level.trees.map((t) => t.radius).sort((a, b) => a - b);
    const at = (p: number): number => radii[Math.floor(p * (radii.length - 1))];
    // The thickest trunks a wood holds are several times its thinnest.
    expect(at(0.95) / at(0.05)).toBeGreaterThan(3);
    for (const t of level.trees.slice(0, 500)) {
      expect(t.age).toBeGreaterThan(0);
      expect(t.radius).toBeCloseTo(trunkRadius(t.age!), 9);
    }
  });
});

describe("the trees, built", () => {
  it("cuts every variant lighter at each level, and keeps the whole tree chunky", () => {
    for (const kind of TREE_KINDS) {
      for (const v of TREE_VARIANTS[kind]) {
        const [full, mid, far] = ([0, 1, 2] as TreeLod[]).map(
          (lod) => buildTree(v, paint, lod).getAttribute("position").count / 3,
        );
        expect(mid, `${kind} ${v.name}`).toBeLessThan(full);
        expect(far, `${kind} ${v.name}`).toBeLessThan(mid);
        // The budgets the forest is priced on: a few hundred triangles at
        // the lens, a sketch of tens in the far band.
        expect(full, `${kind} ${v.name}`).toBeLessThan(560);
        expect(far, `${kind} ${v.name}`).toBeLessThan(140);
      }
    }
    expect(tris(0)).toBeGreaterThan(tris(2));
  });

  it("tags every cut's trunk, so the forest draws it at the tree's girth", () => {
    for (const kind of TREE_KINDS) {
      for (const lod of [0, 1, 2] as TreeLod[]) {
        const g = buildTree(TREE_VARIANTS[kind][0], paint, lod);
        const stem = g.getAttribute("stem");
        expect(stem.count).toBe(g.getAttribute("position").count);
        let tagged = 0;
        for (let i = 0; i < stem.count; i++) if (stem.getZ(i) > 0.5) tagged++;
        expect(tagged, `${kind} ${lod}`).toBeGreaterThan(0);
      }
    }
    // The radius built is the one the forest divides out.
    expect(TRUNK_REF).toBeGreaterThan(0);
  });

  it("draws fewer variants of every kind down the FOREST row, never fewer kinds", () => {
    for (const t of TIERS) {
      const n = FOREST_LOOK[t].variants;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(VARIANTS);
      for (const kind of TREE_KINDS) {
        const seen = new Set<number>();
        for (let i = 0; i < 2000; i++) seen.add(treeVariant(kind, i * 3.7, i * 1.9, n).index);
        // Every kind still drawn, in exactly as many shapes as the row says.
        expect(seen.size, `${t} ${kind}`).toBe(n);
      }
    }
  });
});
