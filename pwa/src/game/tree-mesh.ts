// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BUILDER'S BENCH — the primitives every procedural tree is made of
// (`tree-shapes.ts`): a tapering tube, a two-sided fin of twigs, and the
// mesh they are pushed into, in the unit frame the forest instances every
// tree in (x and z a crown radius, y the height). The wildlife
// (`bird-shapes.ts`, `beast-shapes.ts`) and the course's marks
// (`mark-shapes.ts`) are built on the same bench, in metres and with no
// lean, so the whole mountain is faceted one way: a loft of keyed rings,
// a cap, a flat-coloured face, and a MARK on every vertex (a wing's flag, a
// leg's phase, an antler's root) for the vertex shader that moves it.
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

/** A triangle's own normal, unnormalised. */
export function faceNormal(a: V3, b: V3, c: V3): V3 {
  const e = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const f = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return [e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]];
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

/** What a shape carries past a tree's: its MARKS (name → floats a
 * vertex), whether it has a trunk's `stem`, and whether its triangles are
 * rewound to their pushed normals. */
export type ShapeOptions = {
  readonly marks?: Readonly<Record<string, number>>;
  readonly stems?: boolean;
  readonly wind?: boolean;
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
  /** Every MARK's values, one a vertex (`size` floats each): named when the
   * shape is made, set in `mark` before the pushes they tag. */
  readonly marks = new Map<string, { size: number; values: number[]; now: number[] }>();
  private readonly lean: number;
  /** Whether the geometry carries the trunk's `stem` attribute. */
  private readonly stems: boolean;
  /** Whether every triangle is rewound to face the way it was pushed
   * facing, so a culled or two-sided material lights it from its front. */
  private readonly wind: boolean;
  /** The facet share the next pushes take. */
  facet = 0.55;
  constructor(lean: number, opts: ShapeOptions = {}) {
    this.lean = lean;
    this.stems = opts.stems ?? true;
    this.wind = opts.wind ?? false;
    for (const [name, size] of Object.entries(opts.marks ?? {})) {
      this.marks.set(name, { size, values: [], now: Array<number>(size).fill(0) });
    }
  }
  /** Tag every vertex pushed from here on with `value` under `name`. */
  mark(name: string, ...value: number[]): void {
    const m = this.marks.get(name);
    if (!m) throw new Error(`no mark ${name}`);
    for (let k = 0; k < m.size; k++) m.now[k] = value[k] ?? 0;
  }
  /** How many vertices have been pushed. */
  get count(): number {
    return this.pos.length / 3;
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
    for (const m of this.marks.values()) m.values.push(...m.now);
  }
  /** One triangle in one flat colour, its volume normal `n` (the face's own
   * when left out). */
  tri(a: V3, b: V3, c: V3, col: THREE.Color, n?: V3): void {
    const nn = n ?? faceNormal(a, b, c);
    this.push(a, col, nn);
    this.push(b, col, nn);
    this.push(c, col, nn);
  }
  /** A quad `a b c d` (wound the same way) as two triangles of one colour. */
  quad(a: V3, b: V3, c: V3, d: V3, col: THREE.Color, n?: V3): void {
    this.tri(a, b, c, col, n);
    this.tri(a, c, d, col, n);
  }
  /** A LOFT through rings of equal size, each round its `centre`: every
   * quad between two rings one flat colour (`paint(ring, side)`), its
   * corners' volume normals out from their own ring's centre — so the body
   * turns from sun to shade as a mass and the facets still read. Wound
   * outward for rings that go counter-clockwise seen from the last one. */
  loft(
    rings: readonly V3[][],
    centres: readonly V3[],
    paint: (k: number, s: number) => THREE.Color,
  ): void {
    const out = (p: V3, c: V3): V3 => [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
    for (let k = 0; k + 1 < rings.length; k++) {
      const a = rings[k];
      const b = rings[k + 1];
      for (let s = 0; s < a.length; s++) {
        const s1 = (s + 1) % a.length;
        const col = paint(k, s);
        this.push(a[s], col, out(a[s], centres[k]));
        this.push(a[s1], col, out(a[s1], centres[k]));
        this.push(b[s1], col, out(b[s1], centres[k + 1]));
        this.push(a[s], col, out(a[s], centres[k]));
        this.push(b[s1], col, out(b[s1], centres[k + 1]));
        this.push(b[s], col, out(b[s], centres[k + 1]));
      }
    }
  }
  /** A ring closed to a point `tip` (or flat to its centre), one colour,
   * facing `n` — the loft's end. `flip` turns its winding. */
  cap(ring: readonly V3[], tip: V3, col: THREE.Color, n: V3, flip = false): void {
    for (let s = 0; s < ring.length; s++) {
      const s1 = (s + 1) % ring.length;
      if (flip) this.tri(ring[s1], ring[s], tip, col, n);
      else this.tri(ring[s], ring[s1], tip, col, n);
    }
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
    // The rings turn counter-clockwise about the axis, so a quad wound foot,
    // next foot, next head faces OUT: the trees' material draws front faces
    // only, and a tube wound the other way is a shell the far wall's inside
    // shows through.
    for (let k = 0; k < sides; k++) {
      this.push(ring(a, ra, k), ca, out(k), a, gw);
      this.push(ring(a, ra, k + 1), ca, out(k + 1), a, gw);
      this.push(ring(b, rb, k + 1), cb, out(k + 1), b, gw);
      this.push(ring(a, ra, k), ca, out(k), a, gw);
      this.push(ring(b, rb, k + 1), cb, out(k + 1), b, gw);
      this.push(ring(b, rb, k), cb, out(k), b, gw);
    }
  }
  /** A stem up a list of joints, each its radius and colour, as ONE
   * SOLID: a ring at every joint, level in plan and turned the same way,
   * SHARED by the span under it and the span over it — the same corners and
   * the same girth weight — so the trunk is unbroken from the foot to the
   * crown however the tree's girth widens it. (A tube a span, each ring
   * square to its own span's axis and turned its own way, leaves notches at
   * every joint the inside shows through.) Every span is coloured from its
   * foot joint's colour to its head's, or flat in `band(span)` when given. */
  stemUp(
    joints: readonly { at: V3; r: number; c: THREE.Color }[],
    sides: number,
    girth = 1,
    band?: (span: number) => THREE.Color,
  ): void {
    const n = joints.length;
    if (n < 2) return;
    // How plumb the stem runs at each joint (the spans either side of it,
    // averaged): a leaning stem is widened the less, as `tube` has it.
    const plumb = joints.map((_, j) => {
      const a = joints[Math.max(0, j - 1)].at;
      const b = joints[Math.min(n - 1, j + 1)].at;
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      return Math.abs(d[1]) / (Math.hypot(d[0], d[1], d[2]) || 1);
    });
    // Right-handed about the vertical, so a quad wound foot, next foot,
    // next head faces out.
    const dir = (k: number): V3 => {
      const t = (k / sides) * Math.PI * 2;
      return [Math.cos(t), 0, -Math.sin(t)];
    };
    const corner = (j: number, k: number): V3 => {
      const d = dir(k);
      const { at, r } = joints[j];
      return [at[0] + d[0] * r, at[1], at[2] + d[2] * r];
    };
    const out = (k: number): V3 => {
      const d = dir(k);
      return [d[0], 0.1, d[2]];
    };
    for (let i = 0; i + 1 < n; i++) {
      const a = joints[i];
      const b = joints[i + 1];
      const ca = band ? band(i) : a.c;
      const cb = band ? band(i) : b.c;
      const ga = girth * plumb[i] * plumb[i];
      const gb = girth * plumb[i + 1] * plumb[i + 1];
      for (let k = 0; k < sides; k++) {
        this.push(corner(i, k), ca, out(k), a.at, ga);
        this.push(corner(i, k + 1), ca, out(k + 1), a.at, ga);
        this.push(corner(i + 1, k + 1), cb, out(k + 1), b.at, gb);
        this.push(corner(i, k), ca, out(k), a.at, ga);
        this.push(corner(i + 1, k + 1), cb, out(k + 1), b.at, gb);
        this.push(corner(i + 1, k), cb, out(k), b.at, gb);
      }
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
  /** Swap two vertices, every attribute of them. */
  private swap(i: number, j: number): void {
    const sw = (arr: number[], size: number): void => {
      for (let k = 0; k < size; k++) {
        const v = arr[i * size + k];
        arr[i * size + k] = arr[j * size + k];
        arr[j * size + k] = v;
      }
    };
    sw(this.pos, 3);
    sw(this.col, 3);
    sw(this.nrm, 3);
    sw(this.stem, 3);
    for (const m of this.marks.values()) sw(m.values, m.size);
  }
  /** The mesh: every triangle's normals blended toward its own face's by
   * the share it was pushed with. */
  geometry(): THREE.BufferGeometry {
    const p = this.pos;
    const n = this.nrm;
    for (let t = 0; t + 8 < p.length; t += 9) {
      const f = this.facets[t / 3];
      if (f <= 0 && !this.wind) continue;
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
      if (this.wind && dot < 0) this.swap(t / 3 + 1, t / 3 + 2);
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
    if (this.stems) g.setAttribute("stem", new THREE.Float32BufferAttribute(this.stem, 3));
    for (const [name, m] of this.marks) {
      g.setAttribute(name, new THREE.Float32BufferAttribute(m.values, m.size));
    }
    g.computeBoundingSphere();
    return g;
  }
}
