// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREES, BUILT — every tree in the game is made here, procedurally, off
// its variant's row (`tree-variants.ts`): one mesh a variant at each of
// three LEVELS OF DETAIL, unit height (y 0..1) and unit crown radius,
// vertex-coloured, for `forest.ts` to instance and scale to each tree's own
// height and crown — and its trunk to the tree's own girth, which is its
// AGE (`TreeDef.radius`; `tree-mesh.ts` says how).
//
// CHUNKY AND FACETED, on purpose. A few broad tiers, pads and sprays a tree
// rather than many fine ones, lit half by the face and half by the crown's
// mass (`Shape.facet`): a wood that reads as solid, hand-cut low-poly
// shapes, and costs a fraction of the triangles a fine one would.
//
// A LOADED CONIFER is its banding: a stack of drooping skirts, each white on
// its upper face where the snow has settled and dark green under the lip
// where it has not — tier over tier, built into the vertex colours — over a
// trunk that runs up into the crown. A PINE is the opposite read: a bare
// trunk (or several) under separate pads of needles, each with its own cap
// of snow. A LARCH in winter and a SNAG are a trunk and whorls of bare arms.
// Every BROADLEAF is BRANCHED: stems, limbs off them, sprays of twigs fanned
// off the limbs (three orders, after the parametric trees of the
// literature), drawn from both faces so they read from either side — a
// lattice the wood behind shows through — with a rowan's berries, a
// beech's kept leaves, an alder's cones in their own colour on the tips.
// What colour the needles are and how much snow the boughs carry is the
// region's (`region-look.ts`); each KIND shades it its own way here
// (`KIND_TONES`).
//
// THE THREE LEVELS (`TreeLod`) are the same tree cut lighter, so a tree
// handed from one band to the next keeps its silhouette: FULL at the lens,
// MID in the middle distance, FAR a sketch of a few cones or fins.

import * as THREE from "three";

import type { TreeKind } from "@engine";

import type { RegionLook } from "./region-look.ts";
import { BREAST, Shape, TRUNK_REF, jitter, smooth, trunkProfile, type V3 } from "./tree-mesh.ts";
import type { BirchForm, ConiferForm, LarchForm, PineForm, TreeVariant } from "./tree-variants.ts";

/** The snow on the boughs, lit and in shade. */
export const SNOW = new THREE.Color(0xeef4fb);
export const SNOW_SHADE = new THREE.Color(0xc4d6ea);

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

/** A tree's LEVEL OF DETAIL: the whole tree (FULL, at the lens), a lighter
 * cut of the same tree for the middle distance (MID — the same silhouette at
 * a third to a half of the triangles, so the hand-over does not pop) and a
 * SKETCH for the far band (a few cones or fins, the trunk still its own
 * girth). */
export type TreeLod = 0 | 1 | 2;
export const LOD_NAMES = ["full", "mid", "far"] as const;

/** The trunk's sides at each level. */
const TRUNK_SIDES = [5, 4, 3] as const;

/** A trunk up `heights` (shares of the tree's height), tagged so the
 * tree's girth sizes it: `share` of the reference radius (a stem of
 * several), tapering to `tip` at the last joint, each joint coloured. */
function trunk(
  s: Shape,
  heights: readonly number[],
  share: number,
  tip: number,
  lod: TreeLod,
  at: (y: number) => [number, number],
  colour: (y: number) => THREE.Color,
): void {
  const top = heights[heights.length - 1];
  s.facet = 0.25;
  s.stemUp(
    heights.map((y) => {
      const [x, z] = at(y);
      return {
        at: [x, y, z] as V3,
        r: TRUNK_REF * share * trunkProfile(y, top, tip),
        c: colour(y),
      };
    }),
    TRUNK_SIDES[lod],
  );
}

/** The joints a trunk to `top` is built of at each level: the flare at the
 * foot always, breast height, and the rest of the way. */
function joints(top: number, lod: TreeLod): number[] {
  if (lod === 2) return [0, top];
  if (lod === 1) return [0, BREAST, top];
  return [0, BREAST, BREAST + (top - BREAST) * 0.45, top];
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

/** A conifer: a stack of drooping skirts over a trunk. */
function conifer(v: TreeVariant, form: ConiferForm, p: KindPaint, lod: TreeLod, seed: number) {
  const s = new Shape(v.lean);
  const needle = p.needle;
  const dark = p.dark;
  const snow = form.snow * p.load;
  const c = new THREE.Color();
  // The leader NODDING over: every tier pushed sideways by the cube of how
  // far up the crown it stands.
  const nodAt = (y: number): number =>
    form.nod * Math.pow(Math.max(0, (y - v.base) / Math.max(1e-6, v.top - v.base)), 3);
  // The trunk, up into the crown — the whole of what a skier sees under a
  // stand tree's lifted crown, and the wood a gap-toothed one shows.
  const trunkTop = lod === 2 ? Math.max(0.25, v.base + 0.15) : Math.min(0.8, v.base + 0.45);
  trunk(
    s,
    joints(trunkTop, lod),
    1,
    0.35,
    lod,
    (y) => [nodAt(y), 0],
    (y) =>
      c
        .copy(p.bark)
        .multiplyScalar(0.75 + 0.35 * Math.min(1, y * 3))
        .clone(),
  );
  s.facet = 0.75;
  // CHUNKY: fewer, bigger tiers than the row's own count — a few broad
  // skirts read as a loaded spruce at a glance, and every one left out is
  // triangles saved on every tree of the wood.
  const count =
    lod === 0
      ? Math.max(4, Math.round(form.tiers * 0.6))
      : lod === 1
        ? Math.max(3, Math.round(form.tiers * 0.35))
        : 2;
  const tiers = tiersOf(count, v.base, v.top, lod === 2 ? form.taper : v.taper).map((t, i) => {
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
  const sides = lod === 0 ? Math.min(7, form.sides) : lod === 1 ? 5 : 4;
  tiers.forEach((t, ti) => {
    if (lod === 0 && form.missing.includes(Math.round((ti * form.tiers) / count))) return;
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
      snowy.push(jitter(k + 11) < snow * 0.8);
    }
    const apex: V3 = [nodAt(t.top), t.top, 0];
    const under: V3 = [ox, t.bottom + (t.top - t.bottom) * 0.15, 0];
    const vol = (q: V3, up: number): V3 => {
      const r = Math.hypot(q[0] - ox, q[2]) || 1;
      return [((q[0] - ox) / r) * 0.65, up, (q[2] / r) * 0.65];
    };
    // FLAT COLOUR, a face at a time — no gradient smeared from white to
    // green across a bough, which reads as grey mush at any distance: the
    // snow lies on a tier's crown and along the tops of some boughs as
    // clean white planes, the rest of a bough is needle green (every other
    // one a shade darker, so the facets read), and the skirt's underside
    // is the dark inside of the tree.
    const capped = jitter(seed * 7 + ti * 3) < 0.35 + snow;
    const cap = capped ? SNOW : needle;
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const bough = snowy[i]
        ? c
            .copy(SNOW)
            .lerp(SNOW_SHADE, jitter(i + ti * 5) * 0.5)
            .clone()
        : i % 2 === 0
          ? needle
          : dark.clone().lerp(needle, 0.55);
      s.push(apex, cap, vol(apex, 1));
      s.push(mid[j], cap, vol(mid[j], 0.9));
      s.push(mid[i], cap, vol(mid[i], 0.9));
      s.push(mid[i], bough, vol(mid[i], 0.6));
      s.push(mid[j], bough, vol(mid[j], 0.6));
      s.push(rim[j], bough, vol(rim[j], 0.25));
      s.push(mid[i], bough, vol(mid[i], 0.6));
      s.push(rim[j], bough, vol(rim[j], 0.25));
      s.push(rim[i], bough, vol(rim[i], 0.25));
      // The underside, in its own shade — too small to see on a sketch.
      if (lod === 2) continue;
      s.push(under, dark, vol(under, -0.3));
      s.push(rim[i], dark, vol(rim[i], -0.1));
      s.push(rim[j], dark, vol(rim[j], -0.1));
    }
  });
  if (lod < 2 && form.twin) {
    // A second leader off the top whorl, a little lower and to one side.
    const from = v.base + (v.top - v.base) * 0.72;
    for (const t of tiersOf(lod === 0 ? 3 : 2, from, v.top * 0.95, 1.2)) {
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
  if (lod < 2 && form.spire > 0) {
    // The dead spire a broken top leaves: bare wood over the last whorl.
    s.facet = 0.25;
    s.tube([0, v.top - 0.04, 0], [0.01, v.top + form.spire, 0], 0.018, 0.004, 4, p.bark, p.upper);
  }
  return s.geometry();
}

/** A pine: bare stems under pads of needles. */
function pine(v: TreeVariant, form: PineForm, p: KindPaint, lod: TreeLod, seed: number) {
  const s = new Shape(v.lean);
  const snow = form.snow * p.load;
  const kinkX = (y: number): number =>
    form.kink > 0 && y > form.kink ? Math.min(1, (y - form.kink) / 0.12) * form.kinkBy : 0;
  const stems = lod === 2 ? Math.min(2, form.stems) : form.stems;
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
  // A stem of several shares the girth: each about as thick as a tree of
  // its own share of the wood.
  const share = stems === 1 ? 1 : stems > 3 ? 0.6 : 0.75;
  for (let st = 0; st < stems; st++) {
    const reach = st === 0 ? 0.95 : 0.8 + 0.1 * jitter(seed + st);
    // The stem's joints, low to high — a kink at a joint's own height is one
    // joint, not a stem of no length.
    // A stem of a clump is a lighter thing to build than a lone trunk.
    const ys =
      lod === 0 && stems < 3
        ? [0, BREAST, 0.3, 0.55, form.kink || 0.75, reach]
        : lod === 1
          ? [0, BREAST, form.kink || 0.55, reach]
          : [0, 0.5, reach];
    const stops = [...new Set(ys.filter((y) => y <= reach))].sort((a, b) => a - b);
    trunk(s, stops, share, 0.3, lod, (y) => stemX(st, y), barkAt);
  }
  s.facet = 0.75;
  // The pads, from the crown's base to its top: spread out off the stem on
  // an old pine, a cone of whorls on a young one, flat layers round it on
  // a white pine; shared out among the stems.
  const pads =
    lod === 0
      ? Math.min(10, Math.max(3, Math.ceil(form.pads * 0.7)))
      : lod === 1
        ? Math.min(6, Math.max(3, Math.ceil(form.pads * 0.45)))
        : Math.min(2 + stems, form.pads);
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
      (stems > 1 ? 0.8 : 1) *
      // A lighter cut stands fewer pads, each a little broader.
      Math.sqrt(form.pads / pads) *
      0.9;
    // A branch from the stem to the pad — thicker on an older tree.
    if (!topPad && lod === 0) {
      s.facet = 0.25;
      s.tube([sx, y - form.thick * 0.6, sz], [cx, y, cz], 0.02, 0.01, 3, p.bark, p.upper, 0.5);
      s.facet = 0.75;
    }
    const sides = lod === 0 ? 6 : lod === 1 ? 5 : 4;
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
    // Flat colour a face, as the conifer's: a cap of snow (or of needles
    // where none lies) over a rim of green, every other face a shade
    // darker; a sketch's pad is the cap straight to the rim.
    const cap = snowy ? SNOW : p.needle.clone().lerp(SNOW, 0.25);
    for (let j = 0; j < sides; j++) {
      const q = (j + 1) % sides;
      const out = (w: V3, up: number): V3 => [w[0] - cx, up, w[2] - cz];
      const edge = j % 2 ? p.needle : p.dark.clone().lerp(p.needle, 0.5);
      if (lod === 2) {
        s.push(crown, cap, [0, 1, 0]);
        s.push(rim[q], cap, out(rim[q], 0.6));
        s.push(rim[j], cap, out(rim[j], 0.6));
      } else {
        s.push(crown, cap, [0, 1, 0]);
        s.push(inner[q], cap, out(inner[q], 1.2));
        s.push(inner[j], cap, out(inner[j], 1.2));
        s.push(inner[j], edge, out(inner[j], 0.8));
        s.push(inner[q], edge, out(inner[q], 0.8));
        s.push(rim[q], edge, out(rim[q], 0.2));
        s.push(inner[j], edge, out(inner[j], 0.8));
        s.push(rim[q], edge, out(rim[q], 0.2));
        s.push(rim[j], edge, out(rim[j], 0.2));
      }
      // The dark underside.
      s.push(belly, p.dark, [0, -1, 0]);
      s.push(rim[j], p.dark, out(rim[j], -0.4));
      s.push(rim[q], p.dark, out(rim[q], -0.4));
    }
  }
  return s.geometry();
}

/** A larch in winter — or a snag: a skeleton of whorls. */
function larch(v: TreeVariant, form: LarchForm, p: KindPaint, lod: TreeLod, seed: number) {
  const s = new Shape(v.lean);
  const snowTint = SNOW.clone().lerp(p.twigs, 0.3);
  // The trunk is the whole of a larch in winter, and of a snag: a snag's
  // stout and blunt where it broke, a larch's running to a whip.
  trunk(
    s,
    joints(v.top, lod),
    form.dead ? 1.1 : 1,
    form.dead ? 0.4 : 0.06,
    lod,
    () => [0, 0],
    (y) => p.bark.clone().lerp(p.twigs, Math.min(1, y * 1.2)),
  );
  s.facet = 0.4;
  const whorls =
    lod === 0
      ? Math.max(4, Math.round(form.whorls * 0.75))
      : lod === 1
        ? Math.max(3, Math.round(form.whorls * 0.45))
        : 2;
  const arms = lod === 2 ? 3 : Math.min(5, form.arms);
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
      // A lighter cut's fewer whorls are each a little fuller.
      const full = lod === 0 ? 1.2 : 1.5;
      s.fin(
        root,
        tip,
        (0.07 + 0.06 * (1 - u)) * (form.dead ? 1.3 : 1) * full,
        p.bark,
        p.twigs,
        top,
      );
      if (lod === 0 && !form.dead) {
        // Hanging sprays off the arm, the larch's weeping twigs — a haze
        // of them, which is what a larch in winter is from any distance.
        for (const at of [0.65]) {
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

/** A broadleaf in winter, BRANCHED: a stem (or several) under a few
 * LIMBS — real wood, thick at the fork and thinning to the tip, reaching up
 * on a birch, out on a beech's dome, drooping on a weeping one — each
 * carrying SPRAYS of twigs fanned off it, and whatever the kind still
 * carries on their tips. Three orders of branching, as the parametric trees
 * of the literature have it, held to what a winter's lattice needs. */
function broadleaf(v: TreeVariant, form: BirchForm, p: KindPaint, lod: TreeLod, seed: number) {
  const s = new Shape(v.lean);
  const snow = SNOW.clone().lerp(p.twigs, 0.35);
  const stems = lod === 2 ? Math.min(2, form.stems) : form.stems;
  const share = stems === 1 ? 1 : stems > 3 ? 0.6 : 0.75;
  const fins =
    lod === 0 ? Math.round(form.fins * 0.5) : lod === 1 ? Math.round(form.fins * 0.22) : 5;
  const allLimbs = Math.max(3, Math.min(8, Math.round(form.fins / 8)));
  for (let st = 0; st < stems; st++) {
    // Each stem splays off the root; the first stands straightest.
    const sa = st * 2.4 + seed;
    const tilt = stems === 1 ? 0 : form.splay * (st === 0 ? 0.4 : 1);
    const dx = Math.sin(tilt) * Math.cos(sa) * 4;
    const dz = Math.sin(tilt) * Math.sin(sa) * 4;
    const along = (y: number): V3 => [dx * y * 0.25, y, dz * y * 0.25];
    const height = (st === 0 ? 1 : 0.8 + 0.15 * jitter(seed + st)) * v.top;
    // The stem, in bands — broken by dark marks on a birch or an aspen.
    const bands = lod === 0 ? (stems > 2 ? 2 : 4) : lod === 1 ? 2 : 1;
    const crownTop = 0.82 * height;
    s.facet = 0.25;
    for (let b = 0; b < bands; b++) {
      const y0 = b === 0 ? 0 : b === 1 && bands > 2 ? BREAST : (b / bands) * crownTop;
      const y1 = b === 0 && bands > 2 ? BREAST : ((b + 1) / bands) * crownTop;
      const tone = jitter(seed * 13 + b * 7 + st) < form.marks ? p.marks : p.bark;
      const at0 = along(y0);
      const at1 = along(y1);
      const r0 = TRUNK_REF * share * trunkProfile(y0, crownTop, 0.3);
      const r1 = TRUNK_REF * share * trunkProfile(y1, crownTop, 0.3);
      s.tube(at0, at1, r0, r1, TRUNK_SIDES[lod], tone, tone, 1, b * 0.5);
    }
    // THE LIMBS: forking off the stem up the crown, the lowest reaching
    // furthest, each a crooked tube of two spans with a second branch off
    // its elbow — the wood a winter crown is.
    const limbs = lod === 2 ? 2 : Math.max(stems > 3 ? 1 : 2, Math.round(allLimbs / stems));
    /** Every span a spray may grow off: its ends, its heading, how high up
     * the crown it stands and how far its limb reaches. */
    const spans: { from: V3; to: V3; a: number; u: number; reach: number }[] = [];
    for (let i = 0; i < limbs; i++) {
      const u = (i + 0.5) / limbs;
      const k = seed + i * 3 + st * 101;
      const a = i * 2.39996 + seed + st;
      const y = (v.base + (0.78 - v.base) * u) * height;
      const outline = Math.pow(
        Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.05)),
        1 - 0.7 * form.dome,
      );
      const reach =
        (0.5 + 0.6 * outline) * (0.85 + 0.3 * jitter(k)) * v.width * (stems > 1 ? 0.75 : 1);
      // A unit of height is some four crown radii: a limb out a crown
      // radius and up a tenth of the height climbs at about 45°.
      const rise =
        (0.06 + 0.16 * u) * (1 - form.weep) * (1 - 0.4 * form.dome) - form.weep * 0.05 * (1 - u);
      const root = along(y);
      const out = reach * 0.72;
      const bend = 0.25 * (jitter(k + 1) - 0.5);
      const elbow: V3 = [
        root[0] + Math.cos(a) * out * 0.5,
        y + rise * 0.6,
        root[2] + Math.sin(a) * out * 0.5,
      ];
      const tip: V3 = [
        root[0] + Math.cos(a + bend) * out,
        y + rise * (0.9 - 0.5 * form.weep),
        root[2] + Math.sin(a + bend) * out,
      ];
      // The second branch, off the elbow and out to one side, climbing.
      const side = a + (jitter(k + 2) < 0.5 ? -0.9 : 0.9);
      const twig: V3 = [
        elbow[0] + Math.cos(side) * out * 0.45,
        elbow[1] + rise * 0.5 + 0.04 * (1 - form.weep),
        elbow[2] + Math.sin(side) * out * 0.45,
      ];
      spans.push({ from: root, to: elbow, a, u, reach });
      spans.push({ from: elbow, to: tip, a: a + bend, u, reach });
      if (lod === 0) spans.push({ from: elbow, to: twig, a: side, u, reach: reach * 0.7 });
      const r = TRUNK_REF * share * (0.55 - 0.25 * u) * Math.max(0.7, form.stiff * 0.8);
      if (lod === 2) {
        s.facet = 0.4;
        s.fin(root, tip, r * 3, p.bark, p.twigs, p.twigs, 2.5, 0.8);
        continue;
      }
      s.facet = 0.3;
      if (lod === 1) {
        s.tube(root, tip, r, r * 0.3, 3, p.bark, p.twigs, 0.5, a);
        continue;
      }
      s.tube(root, elbow, r, r * 0.65, 3, p.bark, p.bark, 0.6, a);
      s.tube(elbow, tip, r * 0.65, r * 0.25, 3, p.bark, p.twigs, 0.3, a);
      s.tube(elbow, twig, r * 0.45, r * 0.15, 3, p.bark, p.twigs, 0, a);
    }
    // THE SPRAYS: broad fans of twigs off the limbs' outer spans and the
    // leader's top, rolled every way — the grey-brown haze a bare crown is
    // at any distance, a lattice the wood behind shows through.
    s.facet = 0.4;
    const own = Math.round(fins / stems);
    for (let i = 0; i < own; i++) {
      const k = seed + i * 3 + st * 101 + 7;
      const leader = i % 7 === 6 || spans.length === 0;
      const span = spans[(i * 5 + 1) % Math.max(1, spans.length)];
      const t = 0.3 + 0.7 * jitter(k + 2);
      const root: V3 = leader
        ? along(crownTop * (0.9 + 0.1 * jitter(k)))
        : lerp3(span.from, span.to, t);
      const u = leader ? 1 : span.u;
      const a = (leader ? i * 2.39996 : span.a) + (jitter(k + 3) - 0.5) * (leader ? 6 : 1.8);
      const len = (leader ? 0.4 * v.width : span.reach * 0.5) * (0.7 + 0.5 * jitter(k + 4));
      const rise =
        (0.05 + 0.09 * u) * (1 - form.weep) * (1 - 0.4 * form.dome) -
        form.weep * 0.07 * (1 - u * 0.5);
      const tip: V3 = [root[0] + Math.cos(a) * len, root[1] + rise, root[2] + Math.sin(a) * len];
      const top = u < 0.6 && jitter(k) < form.snow * p.load ? snow : p.twigs;
      // Fewer sprays than the row's own count, each the broader for it.
      const w = (0.022 + 0.014 * (1 - u)) * form.stiff * [1.4, 1.9, 3][lod];
      const roll = (jitter(k + 6) - 0.5) * 2.4;
      s.fin(root, tip, w, p.twigs, p.twigs, top, 4.5 / Math.max(0.6, form.stiff), roll);
      if (lod > 0) continue;
      // What the kind carries: a berry cluster on the tip, or leaves, cones
      // or keys along the spray — a small fan of its own colour.
      if (jitter(k + 5) < form.berries) {
        const end: V3 = [
          tip[0] + (tip[0] - root[0]) * 0.12,
          tip[1] - 0.025,
          tip[2] + (tip[2] - root[2]) * 0.12,
        ];
        s.fin(tip, end, 0.09, p.accent, p.accent, p.accent, 1.4);
      }
      if (jitter(k + 7) < form.leaves) {
        const mid = lerp3(root, tip, 0.55 + 0.35 * jitter(k + 8));
        const hang: V3 = [
          mid[0] + (tip[0] - root[0]) * 0.15,
          mid[1] - 0.03,
          mid[2] + (tip[2] - root[2]) * 0.15,
        ];
        s.fin(mid, hang, 0.07, p.accent, p.accent, p.accent, 1.8);
      }
    }
  }
  return s.geometry();
}

function lerp3(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** One variant's mesh at a level of detail. */
export function buildTree(
  v: TreeVariant,
  paint: TreePaint,
  lod: TreeLod = 0,
): THREE.BufferGeometry {
  const seed = v.index * 3 + 1;
  const p = kindPaint(paint, v.kind);
  switch (v.shape.form) {
    case "conifer":
      return conifer(v, v.shape, p, lod, seed);
    case "pine":
      return pine(v, v.shape, p, lod, seed);
    case "larch":
      return larch(v, v.shape, p, lod, seed);
    case "birch":
      return broadleaf(v, v.shape, p, lod, seed);
  }
}
