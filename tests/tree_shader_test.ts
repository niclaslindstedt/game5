// The shader-shaped forest's tables and templates: the layout the vertex
// shader reads (`tree-table.ts`), and the templates it shapes
// (`tree-templates.ts`) — every family at every cut.
import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  FAMILIES,
  KIND_ORDER,
  TREE_TEXELS,
  TREES_PER_ROW,
  VARIANT_TEXELS,
  familyOf,
  packTree,
  treeRows,
  variantRow,
  variantTable,
} from "../pwa/src/game/tree-table.ts";
import { buildTemplate, farQuad } from "../pwa/src/game/tree-templates.ts";
import { TREE_VARIANTS, VARIANTS } from "../pwa/src/game/tree-variants.ts";
import { kindPaint, treePaint } from "../pwa/src/game/tree-shapes.ts";
import { regionLookOf } from "../pwa/src/game/region-look.ts";
import { shaperOf } from "../pwa/src/game/tree-glsl.ts";

describe("the tree tables", () => {
  it("gives every variant of every kind its own row", () => {
    const seen = new Set<number>();
    for (const kind of KIND_ORDER) {
      for (const v of TREE_VARIANTS[kind]) {
        const row = variantRow(v);
        expect(row).toBeGreaterThanOrEqual(0);
        expect(row).toBeLessThan(KIND_ORDER.length * VARIANTS);
        expect(seen.has(row)).toBe(false);
        seen.add(row);
      }
    }
  });

  it("writes each variant's silhouette and paint where the shader reads them", () => {
    const paint = treePaint(regionLookOf("alpine"));
    const table = variantTable((k) => kindPaint(paint, k));
    expect(table.length).toBe(KIND_ORDER.length * VARIANTS * VARIANT_TEXELS * 4);
    const v = TREE_VARIANTS.spruce[3];
    const o = variantRow(v) * VARIANT_TEXELS * 4;
    expect([table[o], table[o + 1], table[o + 2], table[o + 3]]).toEqual(
      [v.base, v.top, v.width, v.taper].map((x) => Math.fround(x)),
    );
    // The needles' colour, and the kind's snow load beside it.
    const p = kindPaint(paint, "spruce");
    expect(table[o + 24]).toBeCloseTo(p.needle.r, 5);
    expect(table[o + 27]).toBeCloseTo(p.load, 5);
  });

  it("packs a tree's matrix in rows, its girth, row and exposure after", () => {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(10, 20, 30),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.7),
      new THREE.Vector3(2, 9, 3),
    );
    const out = new Float32Array(TREE_TEXELS * 4 * 2);
    packTree(out, 1, m.elements, 1.5, 2.5, 42, 0.25);
    const e = m.elements;
    const o = TREE_TEXELS * 4;
    expect(out[o + 3]).toBe(10);
    expect(out[o + 7]).toBe(20);
    expect(out[o + 11]).toBe(30);
    expect(out[o]).toBeCloseTo(e[0], 6);
    expect(out[o + 1]).toBeCloseTo(e[4], 6);
    expect(out[o + 4]).toBeCloseTo(e[1], 6);
    expect(Array.from(out.slice(o + 12, o + 16))).toEqual([1.5, 2.5, 42, 0.25]);
    expect(treeRows(TREES_PER_ROW + 1)).toBe(2);
  });

  it("draws every form by one of the four families", () => {
    for (const kind of KIND_ORDER) {
      for (const v of TREE_VARIANTS[kind]) expect(FAMILIES).toContain(familyOf(v));
    }
  });
});

describe("the tree templates", () => {
  it("carries no position — only what each corner is — and thins with distance", () => {
    for (const family of FAMILIES) {
      for (const leaf of [false, true]) {
        const tris = ([0, 1, 2] as const).map((cut) => {
          const t = buildTemplate(family, cut, 2, leaf);
          const pos = t.geometry.getAttribute("position");
          expect(Array.from(pos.array as Float32Array).every((x) => x === 0)).toBe(true);
          expect(t.geometry.getAttribute("tv").itemSize).toBe(4);
          expect(t.defines.TPL_SKETCH).toBe(cut === 2 ? 1 : 0);
          return t.geometry.getIndex()!.count / 3;
        });
        expect(tris[0]).toBeGreaterThan(tris[1]);
        expect(tris[1]).toBeGreaterThan(tris[2]);
      }
    }
  });

  it("cuts the lens's template finer with the FOREST row", () => {
    const n = (q: number) => buildTemplate("conifer", 0, q, false).geometry.getIndex()!.count;
    expect(n(0)).toBeLessThan(n(1));
    expect(n(1)).toBeLessThan(n(2));
  });

  it("stands every far tree up on one quad", () => {
    expect(farQuad().getIndex()!.count).toBe(6);
  });

  it("has a shaper for every family", () => {
    for (const f of FAMILIES) expect(shaperOf(f)).toContain("void shapeTree(");
  });
});
