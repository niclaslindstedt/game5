// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREES, BUILT — one mesh a variant (`tree-variants.ts`), unit height
// (y 0..1) and unit crown radius, vertex-coloured, for `forest.ts` to
// instance and scale to each tree's own height and crown.
//
// A LOADED CONIFER is its banding: a stack of drooping skirts, each white on
// its upper face where the snow has settled and dark green under the lip
// where it has not — tier over tier, built into the vertex colours. The
// normals are a soft "volume" normal out of the crown and up, so foliage is
// lit as a mass rather than as a pile of plates. A PINE is the opposite
// read: a bare trunk (or several) under separate pads of needles, each with
// its own cap of snow. A LARCH in winter, a SNAG and every BROADLEAF are
// bare: fins of twigs drawn from both faces, so they read from either side
// — a lattice the wood behind shows through — with a rowan's berries, a
// beech's kept leaves, an alder's cones in their own colour on the tips.
// What colour the needles are and how much snow the boughs carry is the
// region's (`region-look.ts`); each KIND shades it its own way here
// (`KIND_TONES`).
//
// Each shape has a SKETCH beside it for the far band: the same tree at a
// fraction of the triangles.

import * as THREE from "three";

import type { TreeKind } from "@engine";

import type { RegionLook } from "./region-look.ts";
import type { BirchForm, ConiferForm, LarchForm, PineForm, TreeVariant } from "./tree-variants.ts";

/** The snow on the boughs, lit and in shade — the modelled trees' too
 * (`tree-models.ts`). */
export const SNOW = new THREE.Color(0xeef4fb);
export const SNOW_SHADE = new THREE.Color(0xc4d6ea);
const BARK = new THREE.Color(0x3a2c22);

/** What a region paints its trees with: the needles lit and in shade, a
 * birch's bark and its bare twigs, and how much snow the boughs carry. */
export type TreePaint = {
  readonly needle: THREE.Color;
  readonly needleDark: THREE.Color;
  readonly birchBark: THREE.Color;
  readonly birchTwigs: THREE.Color;
  readonly load: number;
};

export function treePaint(look: RegionLook): TreePaint {
  return {
    needle: new THREE.Color(look.needle),
    needleDark: new THREE.Color(look.needleDark),
    birchBark: new THREE.Color(look.bark),
    birchTwigs: new THREE.Color(look.twigs),
    load: look.load,
  };
}

/** How a kind shades the region's paint: its needles pulled toward a
 * colour of its own (and how far), its bark low on the stem and high up,
 * its bare twigs, and the colour of whatever it carries on them (berries,
 * kept leaves, cones, keys). Null keeps the region's own. */
type KindTone = {
  readonly needle?: readonly [number, number];
  readonly bark: number | null;
  readonly upper?: number;
  readonly twigs?: number | null;
  readonly accent?: number;
};

const KIND_TONES: Readonly<Record<TreeKind, KindTone>> = {
  spruce: { bark: 0x3a2c22 },
  fir: { needle: [0x173532, 0.4], bark: 0x4a4240 },
  pine: { needle: [0x5b7246, 0.45], bark: 0x5a4838, upper: 0x9a5a38 },
  larch: { bark: 0x5c4a3e, twigs: 0x857462 },
  // Darker and duller than a spruce, the bog's own.
  blackspruce: { needle: [0x1a2a22, 0.45], bark: 0x2e2620 },
  // Dense and dark, grey-barked.
  stonepine: { needle: [0x2f4a32, 0.35], bark: 0x5a524a, upper: 0x6a5a4a },
  // Soft blue-grey needles, smooth grey bark.
  whitepine: { needle: [0x5d7a70, 0.5], bark: 0x5e5850, upper: 0x6e665c },
  // A plain brown pole.
  lodgepole: { needle: [0x4f6a40, 0.4], bark: 0x5a4636, upper: 0x6e5238 },
  // Softer, brighter green.
  hemlock: { needle: [0x2f5a3e, 0.3], bark: 0x4a3428 },
  // Near-black blue-green.
  juniper: { needle: [0x223a34, 0.5], bark: 0x5a4032 },
  dwarfpine: { needle: [0x243a28, 0.45], bark: 0x3e3228, upper: 0x4a3a2e },
  // Weathered silver-grey wood.
  snag: { bark: 0x6a655e, twigs: 0x7c766e },
  birch: { bark: null, twigs: null },
  aspen: { bark: 0xb4bcac, twigs: 0x6b5f58 },
  rowan: { bark: 0x6d6259, twigs: 0x5b4a44, accent: 0xc0282a },
  alder: { bark: 0x4a4540, twigs: 0x3e342f, accent: 0x2a211c },
  willow: { bark: 0x7a5a3c, twigs: 0xb8742e, accent: 0xd8d4c8 },
  beech: { bark: 0x9aa0a2, twigs: 0x5a4a40, accent: 0xb0662c },
  maple: { bark: 0x6f6a62, twigs: 0x5e4c42, accent: 0x8a6a42 },
  ash: { bark: 0x8c8a80, twigs: 0x6a6258, accent: 0x7a5a36 },
};

/** The colours one kind is built in, off the region's paint. */
export type KindPaint = {
  readonly needle: THREE.Color;
  readonly dark: THREE.Color;
  readonly bark: THREE.Color;
  readonly upper: THREE.Color;
  readonly twigs: THREE.Color;
  readonly accent: THREE.Color;
  /** Dark marks on the bark. */
  readonly marks: THREE.Color;
  readonly load: number;
};

export function kindPaint(paint: TreePaint, kind: TreeKind): KindPaint {
  const t = KIND_TONES[kind];
  const needle = paint.needle.clone();
  const dark = paint.needleDark.clone();
  if (t.needle) {
    needle.lerp(new THREE.Color(t.needle[0]), t.needle[1]);
    dark.lerp(new THREE.Color(t.needle[0]).multiplyScalar(0.55), t.needle[1]);
  }
  const bark = t.bark === null ? paint.birchBark.clone() : new THREE.Color(t.bark);
  return {
    needle,
    dark,
    bark,
    upper: t.upper === undefined ? bark : new THREE.Color(t.upper),
    twigs:
      t.twigs === null || t.twigs === undefined
        ? paint.birchTwigs.clone()
        : new THREE.Color(t.twigs),
    accent: new THREE.Color(t.accent ?? 0x6a4a36),
    marks: bark.clone().multiplyScalar(0.25),
    load: paint.load,
  };
}

type V3 = [number, number, number];

/** A small deterministic hash for a shape's own irregularity. */
function jitter(i: number): number {
  const s = Math.sin(i * 91.345 + 17.13) * 43758.5453;
  return s - Math.floor(s);
}

/** A mesh under construction: positions, colours, normals, with the
 * variant's LEAN applied to every point (x pushed over by the height — a
 * unit of x is a crown radius and a unit of y a height, about four times
 * as long, hence the factor). */
class Shape {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  readonly nrm: number[] = [];
  private readonly lean: number;
  constructor(lean: number) {
    this.lean = lean;
  }
  push(p: V3, c: THREE.Color, n: V3): void {
    this.pos.push(p[0] + p[1] * this.lean * 4, p[1], p[2]);
    this.col.push(c.r, c.g, c.b);
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    this.nrm.push(n[0] / l, n[1] / l, n[2] / l);
  }
  /** A tapering tube of `sides` from `a` to `b`, radii `ra` and `rb`, its
   * colour `ca` at the foot going to `cb` at the head. */
  tube(a: V3, b: V3, ra: number, rb: number, sides: number, ca: THREE.Color, cb = ca): void {
    const ax = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(ax[0], ax[1], ax[2]) || 1;
    const w = [ax[0] / len, ax[1] / len, ax[2] / len];
    // Any vector across the axis, then the second by the cross product.
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
    const ring = (c: V3, r: number, k: number): V3 => {
      const t = (k / sides) * Math.PI * 2;
      const cs = Math.cos(t);
      const sn = Math.sin(t);
      return [
        c[0] + (u[0] * cs + v[0] * sn) * r,
        c[1] + (u[1] * cs + v[1] * sn) * r,
        c[2] + (u[2] * cs + v[2] * sn) * r,
      ];
    };
    const out = (k: number): V3 => {
      const t = (k / sides) * Math.PI * 2;
      return [
        u[0] * Math.cos(t) + v[0] * Math.sin(t),
        u[1] * Math.cos(t) + v[1] * Math.sin(t) + 0.1,
        u[2] * Math.cos(t) + v[2] * Math.sin(t),
      ];
    };
    for (let k = 0; k < sides; k++) {
      const p0 = ring(a, ra, k);
      const p1 = ring(a, ra, k + 1);
      const q0 = ring(b, rb, k);
      const q1 = ring(b, rb, k + 1);
      this.push(p0, ca, out(k));
      this.push(q1, cb, out(k + 1));
      this.push(p1, ca, out(k + 1));
      this.push(p0, ca, out(k));
      this.push(q0, cb, out(k));
      this.push(q1, cb, out(k + 1));
    }
  }
  /** A thin FIN from `root` to `tip`, `w` wide at the root and `fan` of
   * that at the tip (under one a blade, over one a spray of twigs fanning
   * out), pushed with both windings so it reads from either side; the tip
   * end takes `tipC`. */
  fin(
    root: V3,
    tip: V3,
    w: number,
    rootC: THREE.Color,
    tipC: THREE.Color,
    topC: THREE.Color,
    fan = 0.3,
  ): void {
    const dx = tip[0] - root[0];
    const dz = tip[2] - root[2];
    const l = Math.hypot(dx, dz) || 1;
    const sx = (-dz / l) * w;
    const sz = (dx / l) * w;
    const tipL: V3 = [tip[0] + sx * fan, tip[1], tip[2] + sz * fan];
    const tipR: V3 = [tip[0] - sx * fan, tip[1] - 0.004, tip[2] - sz * fan];
    const rootL: V3 = [root[0] + sx, root[1], root[2] + sz];
    const rootR: V3 = [root[0] - sx, root[1], root[2] - sz];
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
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nrm, 3));
    g.computeBoundingSphere();
    return g;
  }
}

type Tier = { bottom: number; top: number; radius: number };

/** The tiers from `base` to `top`, narrowing by `taper`. */
function tiersOf(count: number, base: number, top: number, taper: number): Tier[] {
  const out: Tier[] = [];
  const span = top - base;
  for (let i = 0; i < count; i++) {
    const u = i / count;
    const bottom = base + span * u * 0.92;
    out.push({
      bottom,
      top: Math.min(top, bottom + span * (1.9 / count)),
      radius: Math.pow(1 - u * 0.95, taper) * (1 - 0.08 * u),
    });
  }
  return out;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A conifer: a stack of drooping skirts. */
function conifer(v: TreeVariant, form: ConiferForm, p: KindPaint, sketch: boolean, seed: number) {
  const s = new Shape(v.lean);
  const needle = p.needle;
  const dark = p.dark;
  const snow = form.snow * p.load;
  const c = new THREE.Color();
  // The leader NODDING over: every tier pushed sideways by the cube of how
  // far up the crown it stands.
  const nodAt = (y: number): number =>
    form.nod * Math.pow(Math.max(0, (y - v.base) / Math.max(1e-6, v.top - v.base)), 3);
  // The trunk, up into the lowest skirt — longer under a stand tree's
  // lifted crown, where it is the whole of what a skier sees.
  const trunkTop = Math.max(0.25, v.base + 0.15);
  s.tube([0, 0, 0], [0, trunkTop, 0], 0.035, 0.022, sketch ? 3 : 5, p.bark);
  const count = sketch ? 3 : form.tiers;
  const tiers = tiersOf(count, v.base, v.top, sketch ? form.taper : v.taper).map((t, i) => {
    // The lowest skirt spread across the snow (a krummholz), a flat top
    // (the old fir's stork's nest), a club of boughs at the top (the black
    // spruce's) — all off the shape's own numbers.
    const u = i / count;
    let radius = t.radius * v.width;
    if (i === 0) radius *= 1 + form.skirt;
    if (form.flat > 0 && u > 0.55) radius = Math.max(radius, form.flat * 0.55 * v.width);
    radius *= 1 + form.club * 1.4 * smooth(0.62, 0.9, u);
    return { ...t, radius };
  });
  const sides = sketch ? 5 : form.sides;
  tiers.forEach((t, ti) => {
    if (!sketch && form.missing.includes(ti)) return;
    const twist = ti * 0.9 + seed;
    const ox = nodAt(t.bottom);
    const rim: V3[] = [];
    const mid: V3[] = [];
    const snowy: boolean[] = [];
    for (let i = 0; i < sides; i++) {
      const k = seed * 31 + ti * 17 + i;
      const a = ((i + (jitter(k) - 0.5) * 0.5) / sides) * Math.PI * 2 + twist;
      const jag = i % 2 === 0 ? 1 : 0.7 + jitter(k + 3) * 0.12;
      // A flagged tree's boughs grow on its lee (+x) side; a rough one's
      // come and go.
      const lee = 1 + form.flag * Math.cos(a) * 0.9 - form.flag * 0.25;
      const ragged = 1 + form.rough * (jitter(k + 13) - 0.5) * 0.9;
      const r = t.radius * jag * (0.9 + jitter(k + 5) * 0.2) * Math.max(0.15, lee) * ragged;
      const droop = (t.top - t.bottom) * (0.12 + 0.1 * jitter(k + 7)) * jag * form.droop;
      rim.push([ox + Math.cos(a) * r, t.bottom - droop, Math.sin(a) * r]);
      const mr = r * 0.55;
      mid.push([ox + Math.cos(a) * mr, t.bottom + (t.top - t.bottom) * 0.5, Math.sin(a) * mr]);
      snowy.push(jitter(k + 11) < snow);
    }
    const apex: V3 = [nodAt(t.top), t.top, 0];
    const under: V3 = [ox, t.bottom + (t.top - t.bottom) * 0.15, 0];
    const vol = (q: V3, up: number): V3 => {
      const r = Math.hypot(q[0] - ox, q[2]) || 1;
      return [((q[0] - ox) / r) * 0.65, up, (q[2] / r) * 0.65];
    };
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      // The cap of settled snow.
      const capTone = c
        .copy(SNOW)
        .lerp(SNOW_SHADE, jitter(i + ti * 5) * 0.35)
        .clone();
      s.push(apex, SNOW, vol(apex, 1));
      s.push(mid[j], capTone, vol(mid[j], 0.9));
      s.push(mid[i], capTone, vol(mid[i], 0.9));
      // The boughs: green, with snow lying along the tops of some of them.
      const boughI = snowy[i] ? c.copy(SNOW).lerp(needle, 0.25).clone() : needle;
      const boughJ = snowy[j] ? c.copy(SNOW).lerp(needle, 0.25).clone() : needle;
      const tipI = i % 2 === 0 ? needle : dark;
      const tipJ = j % 2 === 0 ? needle : dark;
      s.push(mid[i], boughI, vol(mid[i], 0.6));
      s.push(mid[j], boughJ, vol(mid[j], 0.6));
      s.push(rim[j], tipJ, vol(rim[j], 0.25));
      s.push(mid[i], boughI, vol(mid[i], 0.6));
      s.push(rim[j], tipJ, vol(rim[j], 0.25));
      s.push(rim[i], tipI, vol(rim[i], 0.25));
      // The underside, in its own shade.
      s.push(under, dark, vol(under, -0.3));
      s.push(rim[i], dark, vol(rim[i], -0.1));
      s.push(rim[j], dark, vol(rim[j], -0.1));
    }
  });
  if (!sketch && form.twin) {
    // A second leader off the top whorl, a little lower and to one side.
    const from = v.base + (v.top - v.base) * 0.72;
    for (const t of tiersOf(3, from, v.top * 0.95, 1.2)) {
      const off = 0.2 * Math.max(0.5, v.width);
      const r = t.radius * 0.35 * v.width;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + seed;
        const b = ((i + 1) / 6) * Math.PI * 2 + seed;
        const p0: V3 = [off + Math.cos(a) * r, t.bottom, Math.sin(a) * r];
        const p1: V3 = [off + Math.cos(b) * r, t.bottom, Math.sin(b) * r];
        const apex: V3 = [off, t.top, 0];
        s.push(apex, SNOW, [0, 1, 0]);
        s.push(p1, needle, [Math.cos(b), 0.4, Math.sin(b)]);
        s.push(p0, i % 2 ? dark : needle, [Math.cos(a), 0.4, Math.sin(a)]);
      }
    }
  }
  if (!sketch && form.spire > 0) {
    // The dead spire a broken top leaves: bare wood over the last whorl.
    s.tube([0, v.top - 0.04, 0], [0.01, v.top + form.spire, 0], 0.018, 0.004, 4, BARK, p.upper);
  }
  return s.geometry();
}

/** A pine: bare stems under pads of needles. */
function pine(v: TreeVariant, form: PineForm, p: KindPaint, sketch: boolean, seed: number) {
  const s = new Shape(v.lean);
  const snow = form.snow * p.load;
  const kinkX = (y: number): number =>
    form.kink > 0 && y > form.kink ? Math.min(1, (y - form.kink) / 0.12) * form.kinkBy : 0;
  const stems = sketch ? Math.min(2, form.stems) : form.stems;
  // Each stem's lean off the root: the first stands straightest; a unit of
  // height is some four crown radii, hence the factor on the splay.
  const stemX = (st: number, y: number): [number, number] => {
    if (stems === 1) return [kinkX(y), 0];
    const a = st * 2.4 + seed;
    const tilt = form.splay * (st === 0 ? 0.3 : 1) * 1.6 * y;
    return [kinkX(y) + Math.cos(a) * tilt, Math.sin(a) * tilt];
  };
  const barkAt = (y: number): THREE.Color =>
    p.bark.clone().lerp(p.upper, Math.min(1, Math.max(0, (y - 0.35) / 0.3)));
  for (let st = 0; st < stems; st++) {
    const reach = st === 0 ? 0.95 : 0.8 + 0.1 * jitter(seed + st);
    // The stem's joints, low to high — a kink at a joint's own height is one
    // joint, not a stem of no length.
    const joints = sketch ? [0, 0.5, reach] : [0, 0.3, 0.55, form.kink || 0.75, reach];
    const stops = [...new Set(joints.filter((y) => y <= reach))].sort((a, b) => a - b);
    const r0 = 0.07 * (stems > 1 ? 0.75 : 1);
    for (let i = 0; i + 1 < stops.length; i++) {
      const y0 = stops[i];
      const y1 = stops[i + 1];
      const [x0, z0] = stemX(st, y0);
      const [x1, z1] = stemX(st, y1);
      s.tube(
        [x0, y0, z0],
        [x1, y1, z1],
        r0 * (1 - y0 * 0.7),
        r0 * (1 - y1 * 0.7),
        sketch ? 3 : 6,
        barkAt(y0),
        barkAt(y1),
      );
    }
  }
  // The pads, from the crown's base to its top: spread out off the stem on
  // an old pine, a cone of whorls on a young one, flat layers round it on
  // a white pine; shared out among the stems.
  const pads = sketch ? Math.min(3 + stems, form.pads) : form.pads;
  for (let i = 0; i < pads; i++) {
    const st = i % stems;
    const u = pads === 1 ? 0.5 : i / (pads - 1);
    const k = seed * 13 + i * 7;
    let y = v.base + (v.top - v.base - form.thick) * (0.08 + 0.92 * u);
    let a = i * 2.39996 + seed;
    const topPad = i === pads - 1;
    let reach = topPad
      ? 0.05
      : form.spread * v.width * (0.35 + 0.65 * jitter(k)) * (1 - form.young * u * 0.8);
    if (form.layers > 0 && !topPad) {
      // LAYERS: the pads in flat whorls, each whorl's pads evenly round the
      // stem and reaching the further the lower the whorl.
      const per = Math.max(1, Math.ceil((pads - 1) / form.layers));
      const layer = Math.floor(i / per);
      const lu = form.layers === 1 ? 0.5 : layer / (form.layers - 1);
      y = v.base + (v.top - v.base - form.thick) * (0.05 + 0.8 * lu);
      a = ((i % per) / per) * Math.PI * 2 + layer * 1.1 + seed;
      reach = form.spread * v.width * (0.95 - 0.55 * lu) * (0.85 + 0.3 * jitter(k));
    }
    const [sx, sz] = stemX(st, y);
    const cx = sx + Math.cos(a) * reach;
    const cz = sz + Math.sin(a) * reach;
    const pr =
      (0.4 + 0.22 * jitter(k + 1)) *
      v.width *
      (1 - form.young * (u * 0.7 - 0.25)) *
      (stems > 1 ? 0.8 : 1);
    // A branch from the stem to the pad.
    if (!topPad && !sketch) {
      s.tube([sx, y - form.thick * 0.6, sz], [cx, y, cz], 0.016, 0.01, 3, p.bark, p.upper);
    }
    const sides = sketch ? 5 : 8;
    const rim: V3[] = [];
    const inner: V3[] = [];
    for (let j = 0; j < sides; j++) {
      const t = (j / sides) * Math.PI * 2 + jitter(k + j) * 0.4;
      const r = pr * (0.75 + 0.35 * jitter(k + j + 3));
      rim.push([
        cx + Math.cos(t) * r,
        y + form.thick * 0.25 * jitter(k + j + 5),
        cz + Math.sin(t) * r,
      ]);
      inner.push([cx + Math.cos(t) * r * 0.45, y + form.thick * 0.9, cz + Math.sin(t) * r * 0.45]);
    }
    const crown: V3 = [cx, y + form.thick, cz];
    const belly: V3 = [cx, y - form.thick * 0.35, cz];
    const snowy = jitter(k + 9) < snow;
    for (let j = 0; j < sides; j++) {
      const q = (j + 1) % sides;
      const out = (w: V3, up: number): V3 => [w[0] - cx, up, w[2] - cz];
      // The cap of snow on top, the green showing round its edge.
      const cap = snowy ? SNOW.clone().lerp(p.needle, 0.12) : SNOW.clone().lerp(p.needle, 0.6);
      s.push(crown, cap, [0, 1, 0]);
      s.push(inner[q], cap, out(inner[q], 1.2));
      s.push(inner[j], cap, out(inner[j], 1.2));
      const edge = j % 2 ? p.needle : p.dark;
      s.push(inner[j], cap, out(inner[j], 0.8));
      s.push(inner[q], cap, out(inner[q], 0.8));
      s.push(rim[q], edge, out(rim[q], 0.2));
      s.push(inner[j], cap, out(inner[j], 0.8));
      s.push(rim[q], edge, out(rim[q], 0.2));
      s.push(rim[j], edge, out(rim[j], 0.2));
      // The dark underside.
      s.push(belly, p.dark, [0, -1, 0]);
      s.push(rim[j], p.dark, out(rim[j], -0.4));
      s.push(rim[q], p.dark, out(rim[q], -0.4));
    }
  }
  return s.geometry();
}

/** A larch in winter — or a snag: a skeleton of whorls. */
function larch(v: TreeVariant, form: LarchForm, p: KindPaint, sketch: boolean, seed: number) {
  const s = new Shape(v.lean);
  const snowTint = SNOW.clone().lerp(p.twigs, 0.3);
  // A snag's trunk is the whole of it: stout, and blunt where it broke.
  s.tube(
    [0, 0, 0],
    [0, v.top, 0],
    form.dead ? 0.06 : 0.04,
    form.dead ? 0.02 : 0.004,
    sketch ? 3 : 5,
    p.bark,
    p.twigs,
  );
  const whorls = sketch ? 4 : form.whorls;
  const arms = sketch ? 4 : form.arms;
  for (let w = 0; w < whorls; w++) {
    const u = (w + 0.5) / whorls;
    const y = v.base + (v.top - v.base) * u * 0.95;
    const r = v.width * Math.pow(Math.max(0.05, 1 - u * 0.95), v.taper);
    for (let a = 0; a < arms; a++) {
      const k = seed * 17 + w * 11 + a;
      // A dead tree has lost arms, and what is left is a stub.
      if (form.dead && jitter(k + 9) < 0.3) continue;
      const t = (a / arms) * Math.PI * 2 + w * 1.3 + jitter(k) * 0.5 + seed;
      const reach = r * (0.8 + 0.3 * jitter(k + 1)) * (form.dead ? 0.75 : 1);
      const tipY = y - form.droop * 0.06 - reach * 0.02 + (1 - form.droop) * 0.03;
      const root: V3 = [Math.cos(t) * 0.02, y, Math.sin(t) * 0.02];
      const tip: V3 = [Math.cos(t) * reach, tipY, Math.sin(t) * reach];
      const top = u < 0.7 && jitter(k + 3) < form.snow * p.load ? snowTint : p.twigs;
      s.fin(root, tip, (0.07 + 0.06 * (1 - u)) * (form.dead ? 1.3 : 1), p.bark, p.twigs, top);
      if (!sketch && !form.dead) {
        // Hanging sprays off the arm, the larch's weeping twigs — a haze
        // of them, which is what a larch in winter is from any distance.
        for (const at of [0.45, 0.8]) {
          const mid: V3 = [tip[0] * at, y + (tipY - y) * at, tip[2] * at];
          const side = jitter(k + at * 10) - 0.5;
          const hang: V3 = [
            mid[0] - mid[2] * side * 0.8,
            mid[1] - 0.03 - form.droop * 0.05,
            mid[2] + mid[0] * side * 0.8,
          ];
          s.fin(mid, hang, 0.008, p.twigs, p.twigs, top, 3);
        }
      }
    }
  }
  return s.geometry();
}

/** A broadleaf in winter: bare stems under fans of twigs, and whatever the
 * kind still carries on their tips. */
function broadleaf(v: TreeVariant, form: BirchForm, p: KindPaint, sketch: boolean, seed: number) {
  const s = new Shape(v.lean);
  const snow = SNOW.clone().lerp(p.twigs, 0.35);
  const stems = sketch ? Math.min(2, form.stems) : form.stems;
  const fins = sketch ? 16 : form.fins;
  for (let st = 0; st < stems; st++) {
    // Each stem splays off the root; the first stands straightest.
    const sa = st * 2.4 + seed;
    const tilt = stems === 1 ? 0 : form.splay * (st === 0 ? 0.4 : 1);
    const dx = Math.sin(tilt) * Math.cos(sa) * 4;
    const dz = Math.sin(tilt) * Math.sin(sa) * 4;
    const along = (y: number): V3 => [dx * y * 0.25, y, dz * y * 0.25];
    const height = (st === 0 ? 1 : 0.8 + 0.15 * jitter(seed + st)) * v.top;
    // The trunk, in bands — broken by dark marks on a birch or an aspen.
    const bands = sketch ? 2 : 7;
    const r = 0.045 * (st === 0 ? 1 : 0.8) * (stems > 3 ? 0.7 : 1);
    for (let b = 0; b < bands; b++) {
      const y0 = (b / bands) * 0.82 * height;
      const y1 = ((b + 1) / bands) * 0.82 * height;
      const tone = jitter(seed * 13 + b * 7 + st) < form.marks ? p.marks : p.bark;
      s.tube(
        along(y0),
        along(y1),
        r * (1 - 0.5 * (b / bands)),
        r * (1 - 0.5 * ((b + 1) / bands)),
        sketch ? 3 : 6,
        tone,
      );
    }
    // The crown: sprays of twigs, lower ones wider and flatter, the top
    // ones steep — a teardrop against the sky, or a dome, or hanging on a
    // weeping one.
    const own = Math.round(fins / stems);
    for (let i = 0; i < own; i++) {
      const u = (i + 0.5) / own;
      const k = seed + i * 3 + st * 101;
      const a = i * 2.39996 + seed + st;
      const base = (v.base + (0.8 - v.base) * u + (jitter(seed * 5 + i) - 0.5) * 0.06) * height;
      const outline = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.1)), 1 - 0.7 * form.dome);
      const reach =
        (0.35 + 0.75 * outline) *
        (0.75 + 0.5 * jitter(i + seed + st * 3)) *
        v.width *
        (stems > 1 ? 0.75 : 1);
      // A unit of height is some four crown radii, so a spray reaching out
      // a crown radius and up a tenth of the height climbs at about 45°.
      const rise =
        (0.05 + 0.09 * u) * (1 - form.weep) * (1 - 0.4 * form.dome) - form.weep * 0.06 * (1 - u);
      const root = along(base);
      root[0] += Math.cos(a) * 0.03;
      root[2] += Math.sin(a) * 0.03;
      const tip: V3 = [root[0] + Math.cos(a) * reach, base + rise, root[2] + Math.sin(a) * reach];
      const top = u < 0.6 && jitter(k) < form.snow * p.load ? snow : p.twigs;
      const w = (0.018 + 0.012 * (1 - u)) * form.stiff;
      s.fin(root, tip, w, p.twigs, p.twigs, top, 3.5 / Math.max(0.6, form.stiff));
      if (sketch) continue;
      // What the kind carries: a berry cluster on the tip, or leaves, cones
      // or keys along the spray — a small fan of its own colour.
      if (jitter(k + 5) < form.berries) {
        const end: V3 = [tip[0] * 1.06, tip[1] - 0.025, tip[2] * 1.06];
        s.fin(tip, end, 0.09, p.accent, p.accent, p.accent, 1.4);
      }
      if (jitter(k + 7) < form.leaves) {
        const at = 0.55 + 0.35 * jitter(k + 8);
        const mid: V3 = [
          root[0] + (tip[0] - root[0]) * at,
          root[1] + (tip[1] - root[1]) * at,
          root[2] + (tip[2] - root[2]) * at,
        ];
        const hang: V3 = [mid[0] * 1.12, mid[1] - 0.03, mid[2] * 1.12];
        s.fin(mid, hang, 0.07, p.accent, p.accent, p.accent, 1.8);
      }
    }
  }
  return s.geometry();
}

/** One variant's mesh — its sketch for the far band when `sketch`. */
export function buildTree(v: TreeVariant, paint: TreePaint, sketch = false): THREE.BufferGeometry {
  const seed = v.index * 3 + 1;
  const p = kindPaint(paint, v.kind);
  switch (v.shape.form) {
    case "conifer":
      return conifer(v, v.shape, p, sketch, seed);
    case "pine":
      return pine(v, v.shape, p, sketch, seed);
    case "larch":
      return larch(v, v.shape, p, sketch, seed);
    case "birch":
      return broadleaf(v, v.shape, p, sketch, seed);
  }
}
