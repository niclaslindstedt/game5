// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREES AS TABLES — what the shader-shaped forest (`forest.ts`,
// `tree-glsl.ts`) reads instead of a mesh a variant: every VARIANT of every
// kind as a row of numbers (its silhouette, its form's knobs and its kind's
// paint), and every TREE on the map as four texels (its matrix — turned,
// leant and stretched to its own height and crown — its girth, its
// variant's row and how exposed it stands). Both go to the card ONCE a map;
// a frame then sends nothing but which trees each band draws.
//
// Three-free, so the suite reads the layout the shader reads.

import type { KindPaint } from "./tree-shapes.ts";
import { TREE_VARIANTS, VARIANTS, type TreeVariant } from "./tree-variants.ts";
import type { TreeKind } from "@engine";

/** Texels a variant's row is (RGBA each). */
export const VARIANT_TEXELS = 16;

/** Texels a tree is, and how many trees a row of the tree texture holds. */
export const TREE_TEXELS = 4;
export const TREE_TEX_W = 2048;
export const TREES_PER_ROW = TREE_TEX_W / TREE_TEXELS;

/** A form's number in the table (the shader branches on it). */
export const FORM_ID = { conifer: 0, pine: 1, larch: 2, birch: 3 } as const;

/** The shader family a form is drawn by: the skirts, the pads, the bare
 * whorls (a larch and a snag) and the branched broadleaf — one template
 * each a cut. */
export type Family = "conifer" | "pine" | "larch" | "broad";
export const FAMILIES: readonly Family[] = ["conifer", "pine", "larch", "broad"];

export function familyOf(v: TreeVariant): Family {
  const f = v.shape.form;
  return f === "conifer" ? "conifer" : f === "pine" ? "pine" : f === "larch" ? "larch" : "broad";
}

/** Every kind in a fixed order: a variant's row is `kindIndex * VARIANTS +
 * its index`. */
export const KIND_ORDER = Object.keys(TREE_VARIANTS) as TreeKind[];

export function variantRow(v: TreeVariant): number {
  return KIND_ORDER.indexOf(v.kind) * VARIANTS + v.index;
}

/** The missing tiers as a bit mask (bit k: tier k of the row's own count). */
function missingMask(missing: readonly number[]): number {
  let m = 0;
  for (const k of missing) if (k >= 0 && k < 20) m += 2 ** k;
  return m;
}

/** Every variant's row: `KIND_ORDER.length * VARIANTS` rows of
 * `VARIANT_TEXELS` texels, painted by `paintOf(kind)`. */
export function variantTable(paintOf: (kind: TreeKind) => KindPaint): Float32Array {
  const rows = KIND_ORDER.length * VARIANTS;
  const out = new Float32Array(rows * VARIANT_TEXELS * 4);
  for (const kind of KIND_ORDER) {
    const p = paintOf(kind);
    for (const v of TREE_VARIANTS[kind]) {
      const o = variantRow(v) * VARIANT_TEXELS * 4;
      const put = (texel: number, a: number, b = 0, c = 0, d = 0): void => {
        out.set([a, b, c, d], o + texel * 4);
      };
      put(0, v.base, v.top, v.width, v.taper);
      put(1, FORM_ID[v.shape.form], v.lean, v.opacity, v.index);
      const s = v.shape;
      switch (s.form) {
        case "conifer":
          put(2, s.tiers, s.sides, s.taper, s.snow);
          put(3, s.droop, s.flag, s.flat, s.skirt);
          put(4, s.nod, s.club, s.rough, s.spire);
          put(5, s.twin ? 1 : 0, missingMask(s.missing));
          break;
        case "pine":
          put(2, s.pads, s.spread, s.thick, s.snow);
          put(3, s.kink, s.kinkBy, s.young, s.stems);
          put(4, s.splay, s.layers);
          break;
        case "larch":
          put(2, s.whorls, s.arms, s.droop, s.snow);
          put(3, s.dead ? 1 : 0);
          break;
        case "birch":
          put(2, s.stems, s.splay, s.fins, s.snow);
          put(3, s.weep, s.marks, s.berries, s.leaves);
          put(4, s.dome, s.stiff);
          break;
      }
      put(6, p.needle.r, p.needle.g, p.needle.b, p.load);
      put(7, p.dark.r, p.dark.g, p.dark.b);
      put(8, p.bark.r, p.bark.g, p.bark.b);
      put(9, p.upper.r, p.upper.g, p.upper.b);
      put(10, p.twigs.r, p.twigs.g, p.twigs.b);
      put(11, p.accent.r, p.accent.g, p.accent.b, p.leaf ? 1 : 0);
      if (p.leaf) put(12, p.leaf.r, p.leaf.g, p.leaf.b);
    }
  }
  return out;
}

/** One tree as the table holds it: the three rows of its 3×4 world matrix
 * (rotation × stretch, then its foot), its girth on the stretched axes,
 * its variant's row, and how EXPOSED it stands (0 deep in a wood … 1 at
 * the tree line), which flags its boughs to the lee and strips its snow. */
export function packTree(
  out: Float32Array,
  i: number,
  m: ArrayLike<number>,
  girthX: number,
  girthZ: number,
  row: number,
  exposure: number,
): void {
  const o = i * TREE_TEXELS * 4;
  // `m` is column-major (three's `Matrix4.elements`).
  out[o] = m[0];
  out[o + 1] = m[4];
  out[o + 2] = m[8];
  out[o + 3] = m[12];
  out[o + 4] = m[1];
  out[o + 5] = m[5];
  out[o + 6] = m[9];
  out[o + 7] = m[13];
  out[o + 8] = m[2];
  out[o + 9] = m[6];
  out[o + 10] = m[10];
  out[o + 11] = m[14];
  out[o + 12] = girthX;
  out[o + 13] = girthZ;
  out[o + 14] = row;
  out[o + 15] = exposure;
}

/** The rows the tree texture needs for `count` trees. */
export function treeRows(count: number): number {
  return Math.max(1, Math.ceil(count / TREES_PER_ROW));
}
