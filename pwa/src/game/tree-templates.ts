// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TEMPLATES — the only tree meshes the shader-shaped forest holds: one
// generic mesh a FAMILY a CUT, instanced for every tree of the family in
// that band and shaped into each tree by the vertex shader (`tree-glsl.ts`)
// off the tree's own row of the tables (`tree-table.ts`). A template's
// vertices carry no position at all, only WHAT THEY ARE (`tv`): which tier,
// pad, whorl, limb or spray, which corner of it, which face, and the part's
// role — the shader reads the tree's variant and its own hash and puts the
// corner where that tree has it. A tree with fewer tiers than its template
// folds the rest to a point (zero-area triangles the rasterizer drops).
//
// Every template is INDEXED, a corner shared by the triangles that share
// its role and face, so the card shapes each corner once per tree.
//
// The windings copy the code-built shapes' (`tree-shapes.ts`) — the
// material draws front faces only.

import * as THREE from "three";

import type { Family } from "./tree-table.ts";

/** A template's size, read by the shader as `#define`s. */
export type Template = {
  readonly family: Family;
  readonly geometry: THREE.BufferGeometry;
  readonly defines: Readonly<Record<string, number>>;
};

/** A cut: 0 the lens's, 1 the middle distance's, 2 the casters' sketch. */
export type Cut = 0 | 1 | 2;

/** Roles a corner plays, per family (the shader's `ROLE_*`). */
export const ROLE = {
  trunk: 0,
  // conifer
  apex: 1,
  midCap: 2,
  midBough: 3,
  rimBough: 4,
  under: 5,
  rimUnder: 6,
  spire: 7,
  // pine
  crown: 1,
  innerCap: 2,
  innerEdge: 3,
  rimEdge: 4,
  belly: 5,
  rimDark: 6,
  branch: 7,
  // larch and broadleaf
  finRoot: 1,
  finTip: 2,
  limb: 3,
  leaf: 4,
} as const;

/** Builds an indexed template, one corner per distinct `tv`. */
class Bench {
  private readonly tv: number[] = [];
  private readonly index: number[] = [];
  private readonly seen = new Map<string, number>();
  corner(a: number, b: number, c: number, role: number): number {
    const key = `${a},${b},${c},${role}`;
    let i = this.seen.get(key);
    if (i === undefined) {
      i = this.tv.length / 4;
      this.tv.push(a, b, c, role);
      this.seen.set(key, i);
    }
    return i;
  }
  tri(a: number, b: number, c: number): void {
    this.index.push(a, b, c);
  }
  /** A stem's rings: `joints` rings of `sides` round stem `stem`, wound as
   * `Shape.stemUp` winds them. */
  stem(stem: number, joints: number, sides: number, banded = false): void {
    for (let j = 0; j + 1 < joints; j++) {
      // A banded stem's spans each their own corners (`stem + 4 × span`),
      // so a span can be painted flat — a birch's dark marks.
      const z = banded ? stem + 4 * j : stem;
      for (let k = 0; k < sides; k++) {
        const k1 = (k + 1) % sides;
        const a = this.corner(j, k, z, ROLE.trunk);
        const b = this.corner(j, k1, z, ROLE.trunk);
        const c = this.corner(j + 1, k1, z, ROLE.trunk);
        const d = this.corner(j + 1, k, z, ROLE.trunk);
        this.tri(a, b, c);
        this.tri(a, c, d);
      }
    }
  }
  /** A tube of `sides` between its two ends, piece `piece`, role `role`. */
  tube(piece: number, sides: number, role: number): void {
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      const a = this.corner(piece, k, 0, role);
      const b = this.corner(piece, k1, 0, role);
      const c = this.corner(piece, k1, 1, role);
      const d = this.corner(piece, k, 1, role);
      this.tri(a, b, c);
      this.tri(a, c, d);
    }
  }
  /** A two-sided fin, piece `piece`: corners 0 root-left, 1 root-right, 2
   * tip-left, 3 tip-right, each face its own (side 0 up, 1 down). */
  fin(piece: number, kind: number): void {
    const up = (k: number) => this.corner(piece, k, kind, k < 2 ? ROLE.finRoot : ROLE.finTip);
    const dn = (k: number) => this.corner(piece, k + 4, kind, k < 2 ? ROLE.finRoot : ROLE.finTip);
    // As `Shape.fin`: rootL tipL tipR, rootL tipR rootR — and the back.
    this.tri(up(0), up(2), up(3));
    this.tri(up(0), up(3), up(1));
    this.tri(dn(0), dn(3), dn(2));
    this.tri(dn(0), dn(1), dn(3));
  }
  /** A loft of `rings` rings of `sides`, capped at both ends: a summer
   * crown in leaf. */
  crown(rings: number, sides: number): void {
    for (let k = 0; k + 1 < rings; k++) {
      for (let s = 0; s < sides; s++) {
        const s1 = (s + 1) % sides;
        const a = this.corner(k, s, s, ROLE.leaf);
        const b = this.corner(k, s1, s, ROLE.leaf);
        const c = this.corner(k + 1, s1, s, ROLE.leaf);
        const d = this.corner(k + 1, s, s, ROLE.leaf);
        this.tri(a, b, c);
        this.tri(a, c, d);
      }
    }
    for (let s = 0; s < sides; s++) {
      const s1 = (s + 1) % sides;
      // The top, wound to face up; the bottom, down.
      this.tri(
        this.corner(rings - 1, s1, 100 + s, ROLE.leaf),
        this.corner(rings - 1, s, 100 + s, ROLE.leaf),
        this.corner(rings, 0, 100 + s, ROLE.leaf),
      );
      this.tri(
        this.corner(0, s, 200 + s, ROLE.leaf),
        this.corner(0, s1, 200 + s, ROLE.leaf),
        this.corner(-1, 0, 200 + s, ROLE.leaf),
      );
    }
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.InstancedBufferGeometry();
    const n = this.tv.length / 4;
    // Three wants a position to count corners by; the shader never reads it.
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("tv", new THREE.BufferAttribute(new Float32Array(this.tv), 4));
    g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(this.index, 1) : this.index);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
    return g;
  }
}

/** A conifer: a trunk under `tiers` skirts of `sides` boughs. */
function conifer(cut: Cut, quality: number): Template {
  const tiers = cut === 0 ? [6, 7, 8][quality] : cut === 1 ? 4 : 2;
  const sides = cut === 0 ? [5, 6, 7][quality] : cut === 1 ? 5 : 4;
  const joints = cut === 0 ? 4 : cut === 1 ? 3 : 2;
  const tsides = cut === 0 ? 5 : cut === 1 ? 4 : 3;
  const b = new Bench();
  b.stem(0, joints, tsides);
  for (let t = 0; t < tiers; t++) {
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      // The cap, then the bough's two triangles, then the underside — as
      // `tree-shapes.ts` pushes them.
      b.tri(
        b.corner(t, 0, i, ROLE.apex),
        b.corner(t, j, i, ROLE.midCap),
        b.corner(t, i, i, ROLE.midCap),
      );
      const mi = b.corner(t, i, i, ROLE.midBough);
      const mj = b.corner(t, j, i, ROLE.midBough);
      const rj = b.corner(t, j, i, ROLE.rimBough);
      const ri = b.corner(t, i, i, ROLE.rimBough);
      b.tri(mi, mj, rj);
      b.tri(mi, rj, ri);
      if (cut < 2) {
        b.tri(
          b.corner(t, 0, i, ROLE.under),
          b.corner(t, i, i, ROLE.rimUnder),
          b.corner(t, j, i, ROLE.rimUnder),
        );
      }
    }
  }
  if (cut === 0) b.tube(0, 4, ROLE.spire);
  return {
    family: "conifer",
    geometry: b.geometry(),
    defines: {
      TPL_TIERS: tiers,
      TPL_SIDES: sides,
      TPL_JOINTS: joints,
      TPL_TSIDES: tsides,
      TPL_SHARE: cut === 0 ? 0.6 : cut === 1 ? 0.35 : 0.2,
      TPL_TIER_MIN: Math.min(tiers, cut === 0 ? 4 : cut === 1 ? 3 : 2),
      TPL_FULL: cut === 0 ? 1 : 0,
      TPL_SKETCH: cut === 2 ? 1 : 0,
    },
  };
}

/** A pine: stems under pads of needles. */
function pine(cut: Cut, quality: number): Template {
  const pads = cut === 0 ? [7, 8, 10][quality] : cut === 1 ? 6 : 3;
  const sides = cut === 0 ? [5, 6, 6][quality] : cut === 1 ? 5 : 4;
  const stems = cut === 0 ? 4 : cut === 1 ? 3 : 2;
  const joints = cut === 0 ? 5 : cut === 1 ? 4 : 3;
  const tsides = cut === 0 ? 5 : cut === 1 ? 4 : 3;
  const b = new Bench();
  for (let st = 0; st < stems; st++) b.stem(st, joints, tsides);
  for (let p = 0; p < pads; p++) {
    for (let j = 0; j < sides; j++) {
      const q = (j + 1) % sides;
      if (cut === 2) {
        b.tri(
          b.corner(p, 0, j, ROLE.crown),
          b.corner(p, q, j, ROLE.rimEdge),
          b.corner(p, j, j, ROLE.rimEdge),
        );
      } else {
        b.tri(
          b.corner(p, 0, j, ROLE.crown),
          b.corner(p, q, j, ROLE.innerCap),
          b.corner(p, j, j, ROLE.innerCap),
        );
        const ij = b.corner(p, j, j, ROLE.innerEdge);
        const iq = b.corner(p, q, j, ROLE.innerEdge);
        const rq = b.corner(p, q, j, ROLE.rimEdge);
        const rj = b.corner(p, j, j, ROLE.rimEdge);
        b.tri(ij, iq, rq);
        b.tri(ij, rq, rj);
      }
      b.tri(
        b.corner(p, 0, j, ROLE.belly),
        b.corner(p, j, j, ROLE.rimDark),
        b.corner(p, q, j, ROLE.rimDark),
      );
    }
    // The branch out to the pad, the lens's cut only.
    if (cut === 0) b.tube(p, 3, ROLE.branch);
  }
  return {
    family: "pine",
    geometry: b.geometry(),
    defines: {
      TPL_PADS: pads,
      TPL_SIDES: sides,
      TPL_STEMS: stems,
      TPL_JOINTS: joints,
      TPL_TSIDES: tsides,
      TPL_SHARE: cut === 0 ? 0.7 : cut === 1 ? 0.45 : 0.25,
      TPL_FULL: cut === 0 ? 1 : 0,
      TPL_SKETCH: cut === 2 ? 1 : 0,
    },
  };
}

/** A larch in winter, or a snag: a trunk and whorls of bare arms — or, in
 * summer, a larch's crown in leaf over them. */
function larch(cut: Cut, quality: number, leaf: boolean): Template {
  const whorls = cut === 0 ? [6, 7, 8][quality] : cut === 1 ? 4 : 2;
  const arms = cut === 2 ? 3 : 5;
  const joints = cut === 0 ? 4 : cut === 1 ? 3 : 2;
  const tsides = cut === 0 ? 5 : cut === 1 ? 4 : 3;
  const b = new Bench();
  b.stem(0, joints, tsides);
  for (let f = 0; f < whorls * arms; f++) {
    b.fin(f, 0);
    // The hanging spray off the arm, the lens's cut only.
    if (cut === 0) b.fin(f, 1);
  }
  const rings = [7, 5, 3][cut];
  if (leaf) b.crown(rings, [9, 7, 5][cut]);
  return {
    family: "larch",
    geometry: b.geometry(),
    defines: {
      TPL_WHORLS: whorls,
      TPL_ARMS: arms,
      TPL_JOINTS: joints,
      TPL_TSIDES: tsides,
      TPL_SHARE: cut === 0 ? 0.75 : cut === 1 ? 0.45 : 0.25,
      TPL_FULL: cut === 0 ? 1 : 0,
      TPL_SKETCH: cut === 2 ? 1 : 0,
      TPL_LEAF: leaf ? 1 : 0,
      TPL_RINGS: rings,
      TPL_RSIDES: [9, 7, 5][cut],
    },
  };
}

/** A broadleaf in winter: stems, limbs off them, sprays of twigs off the
 * limbs and what the kind carries on their tips — or, in summer, a crown in
 * leaf over them. */
function broad(cut: Cut, quality: number, leaf: boolean): Template {
  const stems = cut === 0 ? 3 : 2;
  const spans = cut === 0 ? 4 : cut === 1 ? 2 : 1;
  const tsides = cut === 0 ? 5 : cut === 1 ? 4 : 3;
  const limbs = cut === 0 ? 8 : cut === 1 ? 6 : 2;
  const segs = cut === 0 ? 3 : 1;
  const sprays = cut === 0 ? [20, 26, 32][quality] : cut === 1 ? 14 : 5;
  const b = new Bench();
  for (let st = 0; st < stems; st++) b.stem(st, spans + 1, tsides, true);
  for (let l = 0; l < limbs * segs; l++) {
    if (cut === 2) b.fin(l, 2);
    else b.tube(l, 3, ROLE.limb);
  }
  for (let f = 0; f < sprays; f++) {
    b.fin(f, 0);
    // A berry cluster or the leaves the kind keeps, the lens's cut only.
    if (cut === 0) b.fin(f, 1);
  }
  const rings = [7, 5, 3][cut];
  if (leaf) b.crown(rings, [9, 7, 5][cut]);
  return {
    family: "broad",
    geometry: b.geometry(),
    defines: {
      TPL_STEMS: stems,
      TPL_SPANS: spans,
      TPL_TSIDES: tsides,
      TPL_LIMBS: limbs,
      TPL_SEGS: segs,
      TPL_SPRAYS: sprays,
      TPL_SHARE: cut === 0 ? 0.5 : cut === 1 ? 0.22 : 0.1,
      TPL_FULL: cut === 0 ? 1 : 0,
      TPL_SKETCH: cut === 2 ? 1 : 0,
      TPL_LEAF: leaf ? 1 : 0,
      TPL_RINGS: rings,
      TPL_RSIDES: [9, 7, 5][cut],
    },
  };
}

/** The template for `family` at `cut`; `quality` 0..2 (the FOREST row)
 * thins the lens's cut, and `leaf` gives a broadleaf and a larch their
 * summer crowns. */
export function buildTemplate(family: Family, cut: Cut, quality: number, leaf: boolean): Template {
  const q = Math.max(0, Math.min(2, quality));
  switch (family) {
    case "conifer":
      return conifer(cut, q);
    case "pine":
      return pine(cut, q);
    case "larch":
      return larch(cut, q, leaf);
    case "broad":
      return broad(cut, q, leaf);
  }
}

/** THE FAR BAND'S QUAD: every far tree, whatever its family, one quad the
 * shader stands up round it and ray-casts its silhouette inside. */
export function farQuad(): THREE.BufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
  g.setAttribute(
    "tv",
    new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0]),
      4,
    ),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  return g;
}
