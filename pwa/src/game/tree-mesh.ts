// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREE BUILDER'S BENCH — the primitives every procedural tree is made of
// (`tree-shapes.ts`): a tapering tube, a two-sided fin of twigs, and the
// mesh they are pushed into, in the unit frame the forest instances every
// tree in (x and z a crown radius, y the height).
//
// TWO THINGS ARE DECIDED HERE FOR EVERY TREE.
//
// THE TRUNK IS SIZED BY THE TREE'S AGE, NOT ITS CROWN. The forest scales a
// tree by its crown across and its height up, so a trunk built into the
// mesh would be as thick as the crown is wide — every spruce on the
// mountain the same pencil. Instead every trunk vertex carries a STEM tag
// (`stem`: the axis it is a ring round, in plan, and how much of it is
// trunk, 0..1) and the forest hands each tree its GIRTH (`girth`: the
// engine's trunk radius, `TreeDef.radius`, over the radius built here,
// `TRUNK_REF`, per axis of the instance's stretch); the vertex shader
// (`GIRTH_GLSL`) pushes the ring out from its axis by that much. So the
// trunk drawn IS the trunk the skier meets, and a three-hundred-year-old
// giant and a sapling of the same height stand side by side.
//
// THE LOOK IS FACETED. A soft "volume" normal out of the crown lights a tree
// as a mass, and the face's own normal lights it as the low-poly thing it
// is; every part blends the two by its own share (`facet`), so a wood reads
// as chunky, flat-lit planes of needle and snow — the arcade winters of the
// late 90s — while a crown still turns from sun to shade as one body.

import * as THREE from "three";

export type V3 = [number, number, number];

/** The trunk's radius at breast height as BUILT, in crown radii: the
 * forest's girth scales it to the engine's own. */
export const TRUNK_REF = 0.04;

/** Breast height as a share of the tree's height — where `TreeDef.radius`
 * is measured — and the flare at the foot over it. */
export const BREAST = 0.09;
export const FLARE = 1.45;

/** The trunk's radius at a share `y` of the height, as a share of
 * `TRUNK_REF`: flared at the foot, 1 at breast height, tapering to `tip`
 * at `top`. */
export function trunkProfile(y: number, top: number, tip: number): number {
  if (y <= BREAST) return FLARE + (1 - FLARE) * (y / BREAST);
  const u = Math.min(1, (y - BREAST) / Math.max(1e-6, top - BREAST));
  return 1 + (tip - 1) * Math.pow(u, 0.9);
}

/** THE GIRTH, in the vertex shader: a vertex tagged as trunk is pushed out
 * from its axis by the instance's girth. For `hazeMaterial`'s graft and the
 * casters' depth material alike. */
export const GIRTH_VERTEX_PARS = "attribute vec3 stem;\nattribute vec2 girth;";
export const GIRTH_VERTEX = `
  transformed.xz = stem.xy + (transformed.xz - stem.xy) * mix(vec2(1.0), girth, stem.z);`;

/** Graft the girth into a material's vertex shader. */
export function graftGirth(shader: { vertexShader: string }): void {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${GIRTH_VERTEX_PARS}`)
    .replace("#include <begin_vertex>", `#include <begin_vertex>\n${GIRTH_VERTEX}`);
}

/** A small deterministic hash for a shape's own irregularity. */
export function jitter(i: number): number {
  const s = Math.sin(i * 91.345 + 17.13) * 43758.5453;
  return s - Math.floor(s);
}

export const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A mesh under construction: positions, colours, normals and stem tags,
 * with the variant's LEAN applied to every point (x pushed over by the
 * height — a unit of x is a crown radius and a unit of y a height, about
 * four times as long, hence the factor) and to every axis alike. */
export class Shape {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  readonly nrm: number[] = [];
  readonly stem: number[] = [];
  readonly facets: number[] = [];
  private readonly lean: number;
  /** The facet share the next pushes take. */
  facet = 0.55;
  constructor(lean: number) {
    this.lean = lean;
  }
  push(p: V3, c: THREE.Color, n: V3, axis: V3 | null = null, w = 0): void {
    const shove = p[1] * this.lean * 4;
    this.pos.push(p[0] + shove, p[1], p[2]);
    this.col.push(c.r, c.g, c.b);
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    this.nrm.push(n[0] / l, n[1] / l, n[2] / l);
    if (axis && w > 0) this.stem.push(axis[0] + shove, axis[2], w);
    else this.stem.push(p[0] + shove, p[2], 0);
    this.facets.push(this.facet);
  }
  /** A tapering tube of `sides` from `a` to `b`, radii `ra` and `rb`, its
   * colour `ca` at the foot going to `cb` at the head; `girth` is how much
   * of it the tree's girth widens (1 a trunk, 0 a twig). */
  tube(
    a: V3,
    b: V3,
    ra: number,
    rb: number,
    sides: number,
    ca: THREE.Color,
    cb = ca,
    girth = 0,
    turn = 0,
  ): void {
    const ax = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(ax[0], ax[1], ax[2]) || 1;
    const w = [ax[0] / len, ax[1] / len, ax[2] / len];
    const u0 = Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = [
      w[1] * u0[2] - w[2] * u0[1],
      w[2] * u0[0] - w[0] * u0[2],
      w[0] * u0[1] - w[1] * u0[0],
    ];
    const ul = Math.hypot(u[0], u[1], u[2]);
    u[0] /= ul;
    u[1] /= ul;
    u[2] /= ul;
    const v = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]];
    // A stem leaning off plumb is widened the less, the further it leans:
    // the girth pushes rings out in plan only.
    const gw = girth * Math.pow(Math.abs(w[1]), 2);
    const dir = (k: number): V3 => {
      const t = (k / sides) * Math.PI * 2 + turn;
      return [
        u[0] * Math.cos(t) + v[0] * Math.sin(t),
        u[1] * Math.cos(t) + v[1] * Math.sin(t),
        u[2] * Math.cos(t) + v[2] * Math.sin(t),
      ];
    };
    const ring = (c: V3, r: number, k: number): V3 => {
      const d = dir(k);
      return [c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r];
    };
    const out = (k: number): V3 => {
      const d = dir(k);
      return [d[0], d[1] + 0.1, d[2]];
    };
    for (let k = 0; k < sides; k++) {
      this.push(ring(a, ra, k), ca, out(k), a, gw);
      this.push(ring(b, rb, k + 1), cb, out(k + 1), b, gw);
      this.push(ring(a, ra, k + 1), ca, out(k + 1), a, gw);
      this.push(ring(a, ra, k), ca, out(k), a, gw);
      this.push(ring(b, rb, k), cb, out(k), b, gw);
      this.push(ring(b, rb, k + 1), cb, out(k + 1), b, gw);
    }
  }
  /** A stem up a list of joints, each its radius and colour: one tube a
   * span, every ring tagged as trunk. */
  stemUp(joints: readonly { at: V3; r: number; c: THREE.Color }[], sides: number, girth = 1): void {
    for (let i = 0; i + 1 < joints.length; i++) {
      const a = joints[i];
      const b = joints[i + 1];
      this.tube(a.at, b.at, a.r, b.r, sides, a.c, b.c, girth, i * 0.5);
    }
  }
  /** A thin FIN from `root` to `tip`, `w` wide at the root and `fan` of
   * that at the tip (under one a blade, over one a spray of twigs fanning
   * out), pushed with both windings so it reads from either side; the tip
   * end takes `tipC`, its upper face `topC`. */
  fin(
    root: V3,
    tip: V3,
    w: number,
    rootC: THREE.Color,
    tipC: THREE.Color,
    topC: THREE.Color,
    fan = 0.3,
    roll = 0,
  ): void {
    const dx = tip[0] - root[0];
    const dz = tip[2] - root[2];
    const l = Math.hypot(dx, dz) || 1;
    // The blade's width lies across the spray, flat — or ROLLED about it
    // toward the vertical, so a crown of sprays is not all edge-on to a lens
    // level with it. A unit of y is some four of x, hence the quarter.
    const sx = (-dz / l) * w * Math.cos(roll);
    const sz = (dx / l) * w * Math.cos(roll);
    const sy = (w * Math.sin(roll)) / 4;
    const tipL: V3 = [tip[0] + sx * fan, tip[1] + sy * fan, tip[2] + sz * fan];
    const tipR: V3 = [tip[0] - sx * fan, tip[1] - sy * fan - 0.004, tip[2] - sz * fan];
    const rootL: V3 = [root[0] + sx, root[1] + sy, root[2] + sz];
    const rootR: V3 = [root[0] - sx, root[1] - sy, root[2] - sz];
    const nUp: V3 = [(dx / l) * 0.5, 0.85, (dz / l) * 0.5];
    const nDown: V3 = [(dx / l) * 0.5, -0.2, (dz / l) * 0.5];
    this.push(rootL, rootC, nUp);
    this.push(tipL, topC, nUp);
    this.push(tipR, tipC, nUp);
    this.push(rootL, rootC, nUp);
    this.push(tipR, tipC, nUp);
    this.push(rootR, rootC, nUp);
    this.push(rootL, rootC, nDown);
    this.push(tipR, tipC, nDown);
    this.push(tipL, tipC, nDown);
    this.push(rootL, rootC, nDown);
    this.push(rootR, rootC, nDown);
    this.push(tipR, tipC, nDown);
  }
  /** The mesh: every triangle's normals blended toward its own face's by
   * the share it was pushed with. */
  geometry(): THREE.BufferGeometry {
    const p = this.pos;
    const n = this.nrm;
    for (let t = 0; t + 8 < p.length; t += 9) {
      const f = this.facets[t / 3];
      if (f <= 0) continue;
      const ex = p[t + 3] - p[t];
      const ey = p[t + 4] - p[t + 1];
      const ez = p[t + 5] - p[t + 2];
      const gx = p[t + 6] - p[t];
      const gy = p[t + 7] - p[t + 1];
      const gz = p[t + 8] - p[t + 2];
      // The face's normal in the unit frame: the instance's stretch back to
      // a tree turns it (three takes a normal through the matrix's inverse
      // transpose), as it does the volume normals.
      let fx = ey * gz - ez * gy;
      let fy = ez * gx - ex * gz;
      let fz = ex * gy - ey * gx;
      const fl = Math.hypot(fx, fy, fz);
      if (fl < 1e-12) continue;
      fx /= fl;
      fy /= fl;
      fz /= fl;
      // Facing the way the part was pushed facing.
      const dot = fx * n[t] + fy * n[t + 1] + fz * n[t + 2];
      const s = dot < 0 ? -1 : 1;
      for (let k = 0; k < 9; k += 3) {
        const x = n[t + k] * (1 - f) + fx * s * f;
        const y = n[t + k + 1] * (1 - f) + fy * s * f;
        const z = n[t + k + 2] * (1 - f) + fz * s * f;
        const l = Math.hypot(x, y, z) || 1;
        n[t + k] = x / l;
        n[t + k + 1] = y / l;
        n[t + k + 2] = z / l;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3));
    g.setAttribute("stem", new THREE.Float32BufferAttribute(this.stem, 3));
    g.computeBoundingSphere();
    return g;
  }
}
