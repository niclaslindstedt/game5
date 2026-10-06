// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREES, AGED AND BUILT: every tree's AGE and the girth of its trunk
// (R14, `engine/mapgen/forest.ts` — what a skier meets), and every variant
// built procedurally at its three cuts (`tree-shapes.ts`) — chunky, each cut
// lighter than the one before, and its trunk tagged so the forest can draw
// it at that girth (`tree-mesh.ts`).

import { describe, expect, it } from "vitest";
import { LEVEL_RULES, TREE_KINDS, treeAge, trunkRadius, type Vec3 } from "@engine";

import { regionLookOf } from "../pwa/src/game/region-look.ts";
import { TRUNK_REF } from "../pwa/src/game/tree-mesh.ts";
import { buildTree, treePaint, type TreeLod } from "../pwa/src/game/tree-shapes.ts";
import { TILT, treeTilt } from "../pwa/src/game/tree-tilt.ts";
import {
  TREE_VARIANTS,
  VARIANTS,
  leadVariant,
  treeVariant,
} from "../pwa/src/game/tree-variants.ts";
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

  it("builds every trunk SOLID: each of its faces turned out from its axis", () => {
    // The material draws front faces only, so a stem wound inward is a hole
    // the far wall's inside shows through — a trunk that reads as a shell.
    for (const kind of TREE_KINDS) {
      for (const lod of [0, 1, 2] as TreeLod[]) {
        const g = buildTree(TREE_VARIANTS[kind][0], paint, lod);
        const pos = g.getAttribute("position");
        const stem = g.getAttribute("stem");
        let faces = 0;
        let inward = 0;
        for (let t = 0; t < pos.count; t += 3) {
          if (stem.getZ(t) < 0.5) continue;
          const [ax, ay, az] = [pos.getX(t), pos.getY(t), pos.getZ(t)];
          const e = [pos.getX(t + 1) - ax, pos.getY(t + 1) - ay, pos.getZ(t + 1) - az];
          const f = [pos.getX(t + 2) - ax, pos.getY(t + 2) - ay, pos.getZ(t + 2) - az];
          const nx = e[1] * f[2] - e[2] * f[1];
          const nz = e[0] * f[1] - e[1] * f[0];
          // Out from the axis, in plan: the centroid less its ring's centre.
          let ox = 0;
          let oz = 0;
          for (let k = 0; k < 3; k++) {
            ox += pos.getX(t + k) - stem.getX(t + k);
            oz += pos.getZ(t + k) - stem.getY(t + k);
          }
          faces++;
          if (nx * ox + nz * oz <= 0) inward++;
        }
        expect(faces, `${kind} ${lod}`).toBeGreaterThan(0);
        expect(inward, `${kind} ${lod}`).toBe(0);
      }
    }
  });

  it("builds every trunk UNBROKEN: one ring at each joint, shared by the spans either side", () => {
    // A span turned off the one under it, or ringed square to its own axis,
    // meets it in a notch the inside shows through; and two spans weighting
    // one joint's corners differently are torn apart there by the girth.
    for (const kind of TREE_KINDS) {
      for (const lod of [0, 1, 2] as TreeLod[]) {
        const g = buildTree(TREE_VARIANTS[kind][0], paint, lod);
        const pos = g.getAttribute("position");
        const stem = g.getAttribute("stem");
        const key = (v: number): string => v.toFixed(5);
        const joints = new Map<string, Map<string, number>>();
        for (let i = 0; i < pos.count; i++) {
          if (stem.getZ(i) < 0.9) continue;
          const at = [stem.getX(i), pos.getY(i), stem.getY(i)].map(key).join(",");
          const corners = joints.get(at) ?? new Map<string, number>();
          const corner = [pos.getX(i), pos.getZ(i)].map(key).join(",");
          const weight = corners.get(corner);
          // At the root, several stems of one tree may start from one point,
          // each splayed (and weighted) its own way.
          if (weight !== undefined && pos.getY(i) > 1e-6) {
            expect(stem.getZ(i), `${kind} ${lod}`).toBeCloseTo(weight, 9);
          }
          corners.set(corner, stem.getZ(i));
          joints.set(at, corners);
        }
        expect(joints.size, `${kind} ${lod}`).toBeGreaterThan(0);
        for (const corners of joints.values()) {
          expect(corners.size, `${kind} ${lod}`).toBeLessThanOrEqual(5);
        }
      }
    }
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

describe("the trees, leaning", () => {
  const level = levelFor(38);
  const ground: Vec3 = { x: 0, y: 1, z: 0 };
  const leans = level.trees.map((t) => {
    level.normalAt(t.x, t.z, ground);
    const tilt = treeTilt(t.x, t.z, leadVariant(t.kind ?? "spruce").shape.form, ground.x, ground.z);
    return { deg: (tilt.angle * 180) / Math.PI, tilt, nx: ground.x, nz: ground.z };
  });
  const share = (over: number): number => leans.filter((l) => l.deg > over).length / leans.length;

  it("stands most trees near plumb, a few leaning hard, none fallen", () => {
    const sorted = leans.map((l) => l.deg).sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    expect(median).toBeGreaterThan(1.5);
    expect(median).toBeLessThan(4);
    // A pronounced lean (past fifteen degrees) is a tree or two in a hundred.
    expect(share(15)).toBeGreaterThan(0.005);
    expect(share(15)).toBeLessThan(0.04);
    // Past twenty-five, a rarity — but the steep tail is there.
    expect(share(25)).toBeGreaterThan(0);
    expect(share(25)).toBeLessThan(0.006);
    expect(sorted[sorted.length - 1]).toBeLessThanOrEqual(TILT.most);
  });

  it("leans nearly every tree on a slope DOWN it", () => {
    const steep = leans.filter((l) => Math.hypot(l.nx, l.nz) > 0.3 && l.deg > 2);
    expect(steep.length).toBeGreaterThan(1000);
    const down = steep.filter((l) => l.tilt.dx * l.nx + l.tilt.dz * l.nz > 0).length;
    expect(down / steep.length).toBeGreaterThan(0.85);
  });

  it("is a pure function of where the tree stands", () => {
    const a = treeTilt(812.25, 433.5, "conifer", 0.2, -0.3);
    expect(treeTilt(812.25, 433.5, "conifer", 0.2, -0.3)).toEqual(a);
  });
});
