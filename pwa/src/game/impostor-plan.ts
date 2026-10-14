// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE IMPOSTORS' PLAN (three-free): what the forest bakes and how a quad
// reads it back. Past the near band every tree is ONE QUAD that samples a
// picture of its variant taken from the nearest of 8 × 8 directions over
// the upper hemisphere — a HEMI-OCTAHEDRAL atlas: the hemisphere folded onto
// a diamond and the diamond turned into the square, so the frames are spread
// evenly from the horizon to straight down and a tree seen from a chair, a
// helicopter or a ridge is a tree seen from there, never a card turned to
// face the lens.
//
// Every frame is an orthographic picture of the variant's full cut in the
// IMPOSTOR SPACE — the unit tree (x and z a crown radius, y the height)
// stretched across to the trees' own proportions (`aspect`), so a tree
// standing in the woods is that picture scaled nearly evenly — of its
// colour (with its own snow) and coverage, and of its normal and depth.
// The quad lights the normal under the sky's own sun every frame, so a far
// tree turns from sun to shade as its geometry does and is the same tree at
// noon and at dusk. The same functions, in GLSL, are `tree-impostors.ts`'s;
// `tests/impostor_test.ts` holds the two to each other.

import type { TreeKind } from "@engine";

import type { ImpostorLook } from "./settings-video.ts";
import {
  VARIANTS,
  crownAt,
  treeVariant,
  variantAt,
  type TreeVariant,
} from "./tree-variants.ts";

export type V3 = [number, number, number];

/** The frames across the atlas and down it. */
export const FRAMES = 8;

/** How far round the tree's bounding sphere a frame reaches, as a share of
 * its radius — the margin a mip's blur and a leaning tip have before they
 * spill into the next frame. */
export const FRAME_MARGIN = 1.06;

export type { ImpostorLook };

/** A direction in the upper hemisphere (y up, y ≥ 0) to its place on the
 * atlas's square, 0..1 each way. */
export function hemiOctEncode(x: number, y: number, z: number): [number, number] {
  const yy = Math.max(0, y);
  const s = Math.abs(x) + yy + Math.abs(z) || 1;
  const px = x / s;
  const pz = z / s;
  return [(px + pz + 1) / 2, (px - pz + 1) / 2];
}

/** A place on the atlas's square, 0..1 each way, to its direction. */
export function hemiOctDecode(u: number, v: number): V3 {
  const a = u * 2 - 1;
  const b = v * 2 - 1;
  const x = (a + b) / 2;
  const z = (a - b) / 2;
  const y = 1 - Math.abs(x) - Math.abs(z);
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, Math.max(0, y) / l, z / l];
}

/** Frame (i, j)'s direction from the tree toward the lens that pictured it. */
export function frameDir(i: number, j: number): V3 {
  return hemiOctDecode(i / (FRAMES - 1), j / (FRAMES - 1));
}

/** A frame's picture plane: across (`right`) and up (`up`), for its
 * direction `d` — the camera's own basis, so the bake and the quad agree. */
export function frameAxes(d: V3): { right: V3; up: V3 } {
  const hint: V3 = Math.abs(d[1]) > 0.999 ? [0, 0, -1] : [0, 1, 0];
  // right = hint × d, up = d × right
  let r: V3 = [
    hint[1] * d[2] - hint[2] * d[1],
    hint[2] * d[0] - hint[0] * d[2],
    hint[0] * d[1] - hint[1] * d[0],
  ];
  const l = Math.hypot(r[0], r[1], r[2]) || 1;
  r = [r[0] / l, r[1] / l, r[2] / l];
  const u: V3 = [d[1] * r[2] - d[2] * r[1], d[2] * r[0] - d[0] * r[2], d[0] * r[1] - d[1] * r[0]];
  return { right: r, up: u };
}

/** A tree's outline sampled up its height, for telling variants apart. */
function outline(v: TreeVariant): number[] {
  const out: number[] = [];
  for (let k = 0; k <= 20; k++) out.push(crownAt(v, k / 20));
  return out;
}

/** The pictured variant whose outline is nearest `v`'s (itself when it is
 * pictured) — a far tree keeps its own silhouette as nearly as the atlas
 * allows, so the hand-over from its geometry is a dissolve, not a swap. */
export function nearestPictured(v: TreeVariant, pictured: readonly TreeVariant[]): TreeVariant {
  if (pictured.includes(v)) return v;
  const a = outline(v);
  let best = pictured[0];
  let bestD = Infinity;
  for (const p of pictured) {
    const b = outline(p);
    let d = 0;
    for (let k = 0; k < a.length; k++) d += (a[k] - b[k]) ** 2;
    d += (p.lean - v.lean) ** 2 * 10 + (p.opacity - v.opacity) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** The variants of `kind` an atlas pictures under `look`. */
export function picturedOf(kind: TreeKind, look: ImpostorLook): TreeVariant[] {
  // The first `n` of the kind's most-telling-first order: walk trunks until
  // every pick a FOREST row drawing `n` of the kind makes has turned up.
  const n = Math.max(1, Math.min(VARIANTS, Math.round(look.variants)));
  const out: (TreeVariant | undefined)[] = new Array(n);
  let found = 0;
  for (let k = 0; found < n && k < 4096; k++) {
    const pick = Math.floor(variantAt(k, 0) * n);
    if (out[pick]) continue;
    out[pick] = treeVariant(kind, k, 0, n);
    found++;
  }
  return out.filter((v): v is TreeVariant => v !== undefined);
}

/** The bytes an atlas of `layers` variants holds on the GPU: two RGBA8
 * pictures (colour and coverage; normal and depth) and their mips. */
export function atlasBytes(look: ImpostorLook, layers: number): number {
  const side = look.frame * FRAMES;
  return Math.round(side * side * 4 * 2 * layers * (4 / 3));
}
