// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CARD TREES — every tree of the woods clothed in NEEDLE CARDS: a
// skeleton built off its variant's row (`tree-variants.ts`) the way the
// parametric trees of the literature are — a stem, whorls of boughs off it
// at the row's tiers, each bough drooping and turning up again at its tip —
// and on every bough a CARD: two triangles carrying a spray of needles out
// of the atlas painted at load (`tree-atlas.ts`), its edge ragged, its
// needles lit through by a low sun, its snow the material's to lay
// (`tree-card-material.ts`). Inside every crown an OPAQUE DARK CORE, so a
// lens never sees through a spruce to the sky behind it and the cards in
// front of it are drawn over a surface the depth test already holds.
//
// THE SAME UNIT FRAME AS EVERY TREE: y 0..1 the height, x and z a crown
// radius, a trunk tagged with its `stem` for the girth (`tree-mesh.ts`), so
// the forest instances these exactly as it did the faceted ones, and the
// trunk drawn is still the trunk a skier hits.
//
// THREE CUTS, the same tree lighter, each handed to the next by the
// forest's dither:
//   FULL — the bough cards, the core, the trunk, the leader;
//   MID  — a BILLBOARD CLOUD: three cards standing through the tree carrying
//          its whole silhouette from the side, a card laid across each of a
//          few tiers carrying the tier seen from above, the core and the
//          trunk — a few tens of triangles that read from the side AND from
//          a chair overhead;
//   FAR  — the three standing cards and one laid across, and the trunk.
//
// Every vertex carries a `uv` into the atlas and a `card` pair: how much
// snow the part can carry (0 for the wood and the core) and whether its
// back face is its UNDERSIDE (a bough's, darkened and bare of snow seen
// from below) or just its other side (a standing card's).

import * as THREE from "three";

import { atTile, type AtlasTile } from "./tree-atlas.ts";
import { Shape, smooth, jitter, type V3 } from "./tree-mesh.ts";
import {
  buildTree,
  joints,
  kindPaint,
  tiersOf,
  trunk,
  type KindPaint,
  type TreeLod,
  type TreePaint,
} from "./tree-shapes.ts";
import {
  crownAt,
  type BirchForm,
  type ConiferForm,
  type LarchForm,
  type PineForm,
  type TreeVariant,
} from "./tree-variants.ts";

/** The marks every card tree's vertices carry. */
const MARKS = { uv: 2, card: 2 } as const;

/** A shape for a card tree, its marks set to the solid tile and no snow. */
/** The most snow a bare crown's twigs take: under the material's laden
 * mark, so a larch or a birch keeps its snow on the twigs' pillows and is
 * never crusted whole, which would read as solid plates of snow. */
const BARE_SNOW = 0.78;

function cardShape(v: TreeVariant): Shape {
  const s = new Shape(v.lean, { marks: MARKS });
  solid(s);
  return s;
}

/** What is pushed from here on is solid wood or core: the atlas's whole
 * tile, no snow of its own. */
function solid(s: Shape): void {
  s.mark("uv", ...atTile("solid", 0.5, 0.5));
  s.mark("card", 0, 0);
  s.facet = 0.25;
}

/** One CARD: the quad `a b c d` carrying `tile`, `a` its root's left
 * corner, `b` the tip's left, `c` the tip's right, `d` the root's right —
 * so the tile's root (its left edge) lies along `a d`. Its vertices' colours
 * from `root` to `tip`, its normal `n` (the crown's mass and the sky), its
 * snow `snowy`, its back an underside when `under`. Wound so its front faces
 * `n`. */
function card(
  s: Shape,
  a: V3,
  b: V3,
  c: V3,
  d: V3,
  tile: AtlasTile,
  root: THREE.Color,
  tip: THREE.Color,
  n: V3,
  snowy: number,
  under: boolean,
  u0 = 0,
  u1 = 1,
): void {
  s.facet = 0;
  s.mark("card", snowy, under ? 1 : 0);
  // Which way the quad faces as built: flip it to face `n`.
  const e = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const f = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  const fx = e[1] * f[2] - e[2] * f[1];
  const fy = e[2] * f[0] - e[0] * f[2];
  const fz = e[0] * f[1] - e[1] * f[0];
  const flip = fx * n[0] + fy * n[1] * 16 + fz * n[2] < 0;
  const put = (p: V3, u: number, v: number, col: THREE.Color): void => {
    s.mark("uv", ...atTile(tile, u, v));
    s.push(p, col, n);
  };
  const A = (): void => put(a, u0, 0, root);
  const B = (): void => put(b, u1, 0, tip);
  const C = (): void => put(c, u1, 1, tip);
  const D = (): void => put(d, u0, 1, root);
  if (flip) {
    A();
    B();
    C();
    A();
    C();
    D();
  } else {
    A();
    C();
    B();
    A();
    D();
    C();
  }
  solid(s);
}

/** A bough laid as two cards: from `root` out along `a` (rad in plan) to
 * `reach` crown radii, dropping `drop` (units of height) at its middle and
 * `tipDrop` at its tip, `wide` crown radii across at its broadest, rolled
 * `roll` about its axis. */
function bough(
  s: Shape,
  root: V3,
  a: number,
  reach: number,
  drop: number,
  tipDrop: number,
  wide: number,
  roll: number,
  tile: AtlasTile,
  inner: THREE.Color,
  outer: THREE.Color,
  snowy: number,
): void {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const at = (t: number, dy: number): V3 => [
    root[0] + ca * reach * t,
    root[1] - dy,
    root[2] + sa * reach * t,
  ];
  const r0 = at(0, 0);
  const r1 = at(0.5, drop);
  const r2 = at(1, tipDrop);
  // Across the bough, rolled toward the vertical; a unit of height is some
  // four crown radii, hence the quarter.
  const across = (w: number): V3 => [
    -sa * w * Math.cos(roll),
    (w * Math.sin(roll)) / 4,
    ca * w * Math.cos(roll),
  ];
  const w0 = across(wide * 0.55);
  const w1 = across(wide);
  const w2 = across(wide * 0.75);
  const n: V3 = [ca * 0.35, 0.8, sa * 0.35];
  const mid = inner.clone().lerp(outer, 0.5);
  const off = (p: V3, w: V3, k: number): V3 => [p[0] + w[0] * k, p[1] + w[1] * k, p[2] + w[2] * k];
  card(
    s,
    off(r0, w0, -1),
    off(r1, w1, -1),
    off(r1, w1, 1),
    off(r0, w0, 1),
    tile,
    inner,
    mid,
    n,
    snowy,
    true,
    0,
    0.5,
  );
  card(
    s,
    off(r1, w1, -1),
    off(r2, w2, -1),
    off(r2, w2, 1),
    off(r1, w1, 1),
    tile,
    mid,
    outer,
    n,
    snowy,
    true,
    0.5,
    1,
  );
}

/** The DARK CORE inside a crown: a closed body of `sides` round the stem
 * through the rings `ys` (shares of the height), each its `radius` (crown
 * radii), drawn in the deep interior's own dark — and, on a tree laden
 * past `snowy` 0.7, crusted where it faces the sky as its boughs are. */
function core(
  s: Shape,
  ys: readonly number[],
  radius: (y: number) => number,
  sides: number,
  col: THREE.Color,
  x: (y: number) => number = () => 0,
  snowy = 0,
): void {
  solid(s);
  s.mark("card", snowy, 0);
  const rings = ys.map((y, k) =>
    Array.from({ length: sides }, (_, i): V3 => {
      const a = (i / sides) * Math.PI * 2 + k * 0.6;
      const r = Math.max(0.01, radius(y));
      return [x(y) + Math.cos(a) * r, y, -Math.sin(a) * r];
    }),
  );
  const centres = ys.map((y): V3 => [x(y), y, 0]);
  s.loft(rings, centres, () => col);
  s.cap(
    rings[rings.length - 1],
    [x(ys[ys.length - 1]), ys[ys.length - 1] + 0.02, 0],
    col,
    [0, 1, 0],
    true,
  );
  s.cap(rings[0], [x(ys[0]), ys[0] - 0.01, 0], col, [0, -1, 0]);
}

/** THE STANDING CARDS of a mid or far cut: `n` cards through the stem at
 * even turns, `wide` crown radii either side, from `y0` to `y1`, carrying
 * the tree's silhouette from the side. */
function standing(
  s: Shape,
  n: number,
  y0: number,
  y1: number,
  wide: number,
  tile: AtlasTile,
  low: THREE.Color,
  high: THREE.Color,
  snowy: number,
  seed: number,
): void {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI + seed;
    const ca = Math.cos(a) * wide;
    const sa = Math.sin(a) * wide;
    // The card's normal: square to it, leaning to the sky a little so the
    // snow on its shelves takes the light.
    const nrm: V3 = [-Math.sin(a) * 0.7, 0.7, Math.cos(a) * 0.7];
    // The tile's root is its left edge; a standing card's root is its foot,
    // so its corners go foot-left, head-left, head-right, foot-right.
    s.facet = 0;
    s.mark("card", snowy, 0);
    const put = (p: V3, u: number, v: number, col: THREE.Color): void => {
      // The silhouette tile is drawn upright: its u across, its v up.
      s.mark("uv", ...atTile(tile, u, v));
      s.push(p, col, nrm);
    };
    const fl: V3 = [-ca, y0, -sa];
    const fr: V3 = [ca, y0, sa];
    const hl: V3 = [-ca, y1, -sa];
    const hr: V3 = [ca, y1, sa];
    put(fl, 0, 0, low);
    put(fr, 1, 0, low);
    put(hr, 1, 1, high);
    put(fl, 0, 0, low);
    put(hr, 1, 1, high);
    put(hl, 0, 1, high);
  }
  solid(s);
}

/** A tier seen from above, laid across the crown at `y`: an umbrella of four
 * triangles off a middle raised `rise`, `r` crown radii out. */
function umbrella(
  s: Shape,
  y: number,
  r: number,
  rise: number,
  tile: AtlasTile,
  col: THREE.Color,
  rim: THREE.Color,
  snowy: number,
  turn: number,
  x = 0,
  z = 0,
): void {
  s.facet = 0;
  s.mark("card", snowy, 1);
  const top: V3 = [x, y + rise, z];
  const corners: V3[] = [0, 1, 2, 3].map((k) => {
    const a = turn + (k * Math.PI) / 2;
    return [x + Math.cos(a) * r * Math.SQRT2, y, z + Math.sin(a) * r * Math.SQRT2];
  });
  const uvs: [number, number][] = [
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
    [0.5, 0],
  ];
  // The corners of the tile are its corners; the umbrella's four ribs run
  // to the middles of its edges, so the disc painted inside the tile is
  // whole.
  const uvAt = (k: number): [number, number] => {
    const a = uvs[k];
    const b = uvs[(k + 1) % 4];
    return [a[0] + b[0] - 0.5, a[1] + b[1] - 0.5];
  };
  for (let k = 0; k < 4; k++) {
    const p = corners[k];
    const q = corners[(k + 1) % 4];
    const nrm: V3 = [0, 1, 0];
    s.mark("uv", ...atTile(tile, 0.5, 0.5));
    s.push(top, col, nrm);
    s.mark("uv", ...atTile(tile, ...uvAt((k + 3) % 4)));
    s.push(q, rim, nrm);
    s.mark("uv", ...atTile(tile, ...uvAt((k + 2) % 4)));
    s.push(p, rim, nrm);
  }
  solid(s);
}

/** The core's colour: the crown's deep interior, its darkest green. */
const deep = (p: KindPaint): THREE.Color => p.dark.clone();

/** A CONIFER: whorls of drooping bough cards over a dark core. */
function conifer(v: TreeVariant, form: ConiferForm, p: KindPaint, lod: TreeLod, seed: number) {
  const s = cardShape(v);
  const snowy = Math.min(1.4, form.snow * p.load * 1.6);
  const nodAt = (y: number): number =>
    form.nod * Math.pow(Math.max(0, (y - v.base) / Math.max(1e-6, v.top - v.base)), 3);
  const radiusAt = (y: number): number => {
    const u = (y - v.base) / Math.max(1e-6, v.top - v.base);
    let r = crownAt(v, Math.min(v.top, Math.max(v.base, y)));
    if (u < 0.1) r *= 1 + form.skirt;
    if (form.flat > 0 && u > 0.55) r = Math.max(r, form.flat * 0.55 * v.width);
    return r * (1 + form.club * 1.4 * smooth(0.62, 0.9, u));
  };
  const side: AtlasTile = v.taper > 1.3 || v.width < 0.7 ? "spireSide" : "spruceSide";
  const spray: AtlasTile = form.droop > 1.2 || v.taper > 1.3 ? "fir" : "spruce";
  const sprayB: AtlasTile = spray === "fir" ? "firB" : "spruceB";
  // The trunk into the crown.
  const trunkTop = lod === 2 ? Math.max(0.3, v.base + 0.2) : Math.min(0.85, v.base + 0.5);
  trunk(
    s,
    joints(trunkTop, lod),
    1,
    0.35,
    lod,
    (y) => [nodAt(y), 0],
    (y) => p.bark.clone().multiplyScalar(0.75 + 0.35 * Math.min(1, y * 3)),
  );
  const dark = deep(p);
  const span = v.top - v.base;
  if (lod > 0) {
    // THE BILLBOARD CLOUD.
    // Its opaque core at both cuts: at the far one it is most of what makes
    // a distant spruce a dark cone rather than a wisp of needles.
    const rings =
      lod === 1
        ? [v.base, v.base + span * 0.1, v.base + span * 0.45, v.top - span * 0.08]
        : [v.base, v.base + span * 0.12, v.top - span * 0.12];
    core(
      s,
      rings,
      (y) => radiusAt(y) * (y > v.base ? 0.5 : 0.15),
      lod === 1 ? 4 : 3,
      dark,
      nodAt,
      snowy,
    );
    standing(
      s,
      3,
      v.base - span * 0.04,
      v.top + 0.01,
      v.width * 1.05,
      side,
      p.needle.clone().lerp(p.dark, 0.5),
      p.needle,
      snowy,
      seed,
    );
    const discs = lod === 1 ? 3 : 1;
    for (let k = 0; k < discs; k++) {
      const u = discs === 1 ? 0.25 : 0.12 + (0.6 * k) / (discs - 1);
      const y = v.base + span * u;
      umbrella(s, y, radiusAt(y) * 0.95, span * 0.04, "disc", p.dark, p.needle, snowy, seed + k);
    }
    return s.geometry();
  }
  core(
    s,
    // Its foot drawn in to the stem, so from under the crown it is a point
    // and not a lid.
    [v.base, v.base + span * 0.1, v.base + span * 0.3, v.base + span * 0.65, v.top - span * 0.04],
    (y) => radiusAt(y) * (y > v.base ? 0.32 : 0.08),
    5,
    dark,
    nodAt,
    snowy,
  );
  // THE SILHOUETTE, standing through the crown a little inside the boughs'
  // tips: the ragged outline and the snow shelves a crown shows from the
  // side, which the boughs alone — seen near edge-on from a skier's head —
  // cannot.
  standing(
    s,
    3,
    v.base - span * 0.02,
    v.top,
    v.width * 0.92,
    side,
    p.needle.clone().lerp(p.dark, 0.5),
    p.needle,
    snowy,
    seed,
  );
  // THE WHORLS: one a tier, the boughs round it at a golden turn, each
  // bough drooping to its tip (and, on a spruce, turning up again at it).
  const count = Math.max(5, Math.round(form.tiers * 0.75));
  const tiers = tiersOf(count, v.base, v.top, v.taper);
  const per = Math.min(7, Math.max(5, form.sides - 2));
  tiers.forEach((t, ti) => {
    if (form.missing.includes(Math.round((ti * form.tiers) / count))) return;
    const u = ti / count;
    const y = t.bottom + (t.top - t.bottom) * 0.55;
    const r = radiusAt(t.bottom);
    const ox = nodAt(y);
    const n = Math.max(3, Math.round(per * (1 - 0.45 * u)));
    for (let i = 0; i < n; i++) {
      const k = seed * 31 + ti * 17 + i;
      const a = ((i + (jitter(k) - 0.5) * 0.6) / n) * Math.PI * 2 + ti * 2.39996 + seed;
      // A flagged tree's boughs grow on its lee (+x) side; a rough one's
      // come and go.
      const lee = 1 + form.flag * Math.cos(a) * 0.9 - form.flag * 0.25;
      const ragged = 1 + form.rough * (jitter(k + 13) - 0.5) * 0.9;
      const reach = r * (0.85 + 0.3 * jitter(k + 5)) * Math.max(0.15, lee) * ragged;
      if (reach < 0.06) continue;
      const fall = (t.top - t.bottom) * (0.4 + 0.3 * jitter(k + 7)) * Math.min(1.3, form.droop);
      // A spruce's J: down to its middle, up a little at its tip; a fir's
      // plate stays flat.
      const tipFall = spray === "fir" ? fall * 1.1 : fall * 0.75;
      const wide = Math.min(0.6, reach * (0.5 + 0.15 * jitter(k + 9)));
      const roll = (jitter(k + 11) - 0.5) * 0.9;
      const tone = 0.8 + 0.35 * jitter(k + 3);
      const outer = p.needle.clone().multiplyScalar(1.15 * tone);
      const inner = p.needle
        .clone()
        .lerp(p.dark, 0.5)
        .multiplyScalar(0.8 * tone);
      bough(
        s,
        [ox + Math.cos(a) * 0.03, y, Math.sin(a) * 0.03],
        a,
        reach,
        fall,
        tipFall,
        wide,
        roll,
        jitter(k + 15) < 0.5 ? spray : sprayB,
        inner,
        outer,
        snowy * (0.75 + 0.25 * (1 - u)),
      );
    }
  });
  // THE LEADER: two small crossed cards on the top.
  const lead = span * 0.12;
  const top: V3 = [nodAt(v.top), v.top, 0];
  for (let k = 0; k < 2; k++) {
    const a = (k * Math.PI) / 2 + seed;
    const w = 0.1 * v.width;
    const dx = Math.cos(a) * w;
    const dz = Math.sin(a) * w;
    card(
      s,
      [top[0] - dx, top[1] - lead, top[2] - dz],
      [top[0] - dx * 0.2, top[1] + 0.01, top[2] - dz * 0.2],
      [top[0] + dx * 0.2, top[1] + 0.01, top[2] + dz * 0.2],
      [top[0] + dx, top[1] - lead, top[2] + dz],
      spray,
      p.dark,
      p.needle,
      [-Math.sin(a), 0.3, Math.cos(a)],
      snowy * 0.5,
      false,
    );
  }
  if (form.twin) {
    // A second leader off the top whorl, a little lower and to one side.
    const from = v.base + span * 0.72;
    const off = 0.22 * Math.max(0.5, v.width);
    core(
      s,
      [from, v.top * 0.95],
      (y) => (y < v.top * 0.9 ? 0.12 * v.width : 0.02),
      4,
      dark,
      () => off,
    );
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + seed;
      bough(
        s,
        [off, from + (v.top * 0.95 - from) * 0.5, 0],
        a,
        0.22 * v.width,
        0.02,
        0.025,
        0.12,
        0,
        spray,
        p.dark,
        p.needle,
        snowy,
      );
    }
  }
  if (form.spire > 0) {
    solid(s);
    s.tube([0, v.top - 0.04, 0], [0.01, v.top + form.spire, 0], 0.018, 0.004, 4, p.bark, p.upper);
  }
  return s.geometry();
}

/** A PINE: bare stems under pads, each pad a dark core under an umbrella of
 * tufts and tufts reaching out round it. */
function pine(v: TreeVariant, form: PineForm, p: KindPaint, lod: TreeLod, seed: number) {
  const s = cardShape(v);
  // Barely past the laden mark: a pine's flat tufts crusted whole read as
  // grey plates, so its snow stays in the brushes.
  const snowy = Math.min(0.95, form.snow * p.load * 1.5);
  const kinkX = (y: number): number =>
    form.kink > 0 && y > form.kink ? Math.min(1, (y - form.kink) / 0.12) * form.kinkBy : 0;
  const stems = lod === 2 ? Math.min(2, form.stems) : form.stems;
  const stemX = (st: number, y: number): [number, number] => {
    if (stems === 1) return [kinkX(y), 0];
    const a = st * 2.4 + seed;
    const tilt = form.splay * (st === 0 ? 0.3 : 1) * 1.6 * y;
    return [kinkX(y) + Math.cos(a) * tilt, Math.sin(a) * tilt];
  };
  const barkAt = (y: number): THREE.Color =>
    p.bark.clone().lerp(p.upper, Math.min(1, Math.max(0, (y - 0.35) / 0.3)));
  const share = stems === 1 ? 1 : stems > 3 ? 0.6 : 0.75;
  for (let st = 0; st < stems; st++) {
    const reach = st === 0 ? 0.95 : 0.8 + 0.1 * jitter(seed + st);
    const ys =
      lod === 0 && stems < 3
        ? [0, 0.09, 0.3, 0.55, form.kink || 0.75, reach]
        : lod === 1
          ? [0, 0.09, form.kink || 0.55, reach]
          : [0, 0.5, reach];
    const stops = [...new Set(ys.filter((y) => y <= reach))].sort((a, b) => a - b);
    trunk(s, stops, share, 0.3, lod, (y) => stemX(st, y), barkAt);
  }
  const dark = deep(p);
  if (lod === 2) {
    const y0 = v.base;
    standing(
      s,
      3,
      y0,
      v.top + 0.02,
      v.width * form.spread * 1.15,
      "pineSide",
      p.dark,
      p.needle,
      snowy,
      seed,
    );
    return s.geometry();
  }
  const pads =
    lod === 0
      ? Math.min(9, Math.max(3, Math.ceil(form.pads * 0.7)))
      : Math.min(5, Math.max(3, Math.ceil(form.pads * 0.45)));
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
      Math.sqrt(form.pads / pads) *
      0.95;
    if (!topPad && lod === 0) {
      solid(s);
      s.tube([sx, y - form.thick * 0.6, sz], [cx, y, cz], 0.02, 0.01, 3, p.bark, p.upper, 0.5);
    }
    // The pad's dark body.
    core(
      s,
      [y - form.thick * 0.15, y + form.thick * 0.35],
      (yy) => (yy < y ? pr * 0.28 : pr * 0.16),
      4,
      dark.clone().multiplyScalar(0.6),
      () => cx,
    );
    // Its umbrella of tufts, snow on top, and (at the full cut) tufts
    // reaching out round it.
    umbrella(
      s,
      y + form.thick * 0.35,
      pr * 0.9,
      form.thick * 0.5,
      "pineDisc",
      p.dark,
      p.needle,
      snowy,
      a,
      cx,
      cz,
    );
    if (lod === 0) {
      for (let j = 0; j < 6; j++) {
        const b = a + (j / 6) * Math.PI * 2 + jitter(k + j) * 0.8;
        bough(
          s,
          [cx, y + form.thick * 0.3, cz],
          b,
          pr * 1.1,
          form.thick * 0.15,
          form.thick * 0.45,
          pr * 0.6,
          0.5,
          "tuft",
          p.dark,
          p.needle,
          snowy * 0.8,
        );
      }
    }
  }
  return s.geometry();
}

/** A LARCH in winter: a trunk under whorls of bare arms, each a card of
 * weeping twigs. A snag is the faceted builder's own, bare bones. */
function larch(
  v: TreeVariant,
  form: LarchForm,
  p: KindPaint,
  lod: TreeLod,
  seed: number,
  paint: TreePaint,
) {
  if (form.dead || p.leaf) return asCards(buildTree(v, paint, lod));
  const s = cardShape(v);
  const snowy = Math.min(BARE_SNOW, form.snow * p.load);
  trunk(
    s,
    joints(v.top, lod),
    1,
    0.06,
    lod,
    () => [0, 0],
    (y) => p.bark.clone().lerp(p.twigs, Math.min(1, y * 1.2)),
  );
  if (lod > 0) {
    standing(s, 3, v.base, v.top + 0.02, v.width * 1.05, "bareSide", p.bark, p.twigs, snowy, seed);
    if (lod === 1)
      umbrella(
        s,
        v.base + (v.top - v.base) * 0.3,
        v.width * 0.8,
        0.03,
        "twigDisc",
        p.bark,
        p.twigs,
        snowy,
        seed,
      );
    return s.geometry();
  }
  standing(s, 2, v.base, v.top + 0.02, v.width * 0.95, "bareSide", p.bark, p.twigs, snowy, seed);
  const whorls = Math.max(5, Math.round(form.whorls * 0.75));
  const arms = Math.min(5, form.arms);
  for (let w = 0; w < whorls; w++) {
    const u = (w + 0.5) / whorls;
    const y = v.base + (v.top - v.base) * u * 0.95;
    const r = v.width * Math.pow(Math.max(0.05, 1 - u * 0.95), v.taper);
    for (let a = 0; a < arms; a++) {
      const k = seed * 17 + w * 11 + a;
      const t = (a / arms) * Math.PI * 2 + w * 1.3 + jitter(k) * 0.5 + seed;
      const reach = r * (0.85 + 0.3 * jitter(k + 1));
      const tile: AtlasTile = jitter(k + 4) < 0.6 ? "larch" : "twigB";
      bough(
        s,
        [Math.cos(t) * 0.02, y, Math.sin(t) * 0.02],
        t,
        reach,
        form.droop * 0.03,
        form.droop * 0.05,
        reach * 0.45,
        (jitter(k + 2) - 0.5) * 2.2,
        tile,
        p.bark,
        p.twigs,
        snowy * (u < 0.7 ? 1 : 0.3),
      );
    }
  }
  return s.geometry();
}

/** A BROADLEAF in winter: its stems and limbs solid wood, every spray of
 * twigs a card grown by space colonisation. In leaf, the faceted builder's
 * own crown. */
function broadleaf(
  v: TreeVariant,
  form: BirchForm,
  p: KindPaint,
  lod: TreeLod,
  seed: number,
  paint: TreePaint,
) {
  if (p.leaf) return asCards(buildTree(v, paint, lod));
  if (lod === 0) {
    // The faceted builder's stems and limbs, its sprays re-clothed: every
    // fin it lays becomes a twig card.
    return twigCards(v, form, p, seed);
  }
  const s = cardShape(v);
  const snowy = Math.min(BARE_SNOW, form.snow * p.load);
  const stems = Math.min(2, form.stems);
  for (let st = 0; st < stems; st++) {
    const sa = st * 2.4 + seed;
    const tilt = stems === 1 ? 0 : form.splay * (st === 0 ? 0.4 : 1);
    const dx = Math.sin(tilt) * Math.cos(sa);
    const dz = Math.sin(tilt) * Math.sin(sa);
    trunk(
      s,
      joints(0.82 * v.top, lod),
      stems === 1 ? 1 : 0.75,
      0.3,
      lod,
      (y) => [dx * y, dz * y],
      () => p.bark.clone(),
    );
  }
  standing(
    s,
    3,
    v.base * 0.9,
    v.top + 0.02,
    v.width * 1.1,
    "bareSide",
    p.bark,
    p.twigs,
    snowy,
    seed,
  );
  if (lod === 1)
    umbrella(
      s,
      v.base + (v.top - v.base) * 0.45,
      v.width * 0.85,
      0.04,
      "twigDisc",
      p.bark,
      p.twigs,
      snowy,
      seed,
    );
  return s.geometry();
}

/** The faceted builder's winter broadleaf at its full cut with every twig
 * fin swapped for a twig card: the same limbs, the same sprays' roots and
 * tips, a card where the fin was. */
function twigCards(
  v: TreeVariant,
  form: BirchForm,
  p: KindPaint,
  seed: number,
): THREE.BufferGeometry {
  // The limbs and stems as the faceted builder lays them, but with no
  // sprays: built with no fins at all, then the sprays laid as cards here.
  const bare = { ...v, shape: { ...form, fins: 0, berries: 0, leaves: 0 } };
  const wood = asCards(buildTree(bare, { ...paintOf(p), load: p.load }, 0));
  const s = cardShape(v);
  const snowy = Math.min(BARE_SNOW, form.snow * p.load);
  const sprays = Math.round(form.fins * 0.7);
  const stems = form.stems;
  for (let i = 0; i < sprays; i++) {
    const k = seed + i * 3 + 7;
    const st = i % stems;
    const sa = st * 2.4 + seed;
    const tilt = stems === 1 ? 0 : form.splay * (st === 0 ? 0.4 : 1);
    const along = (y: number): V3 => [
      Math.sin(tilt) * Math.cos(sa) * y,
      y,
      Math.sin(tilt) * Math.sin(sa) * y,
    ];
    const u = (i + 0.5) / sprays;
    const y = (v.base + (0.95 - v.base) * u) * v.top;
    const out = crownAt(v, Math.min(v.top, Math.max(v.base, y))) * (0.3 + 0.3 * jitter(k));
    const a = i * 2.39996 + seed + (jitter(k + 1) - 0.5);
    const root = along(y);
    root[0] += Math.cos(a) * out;
    root[2] += Math.sin(a) * out;
    const len =
      crownAt(v, Math.min(v.top, Math.max(v.base, y))) * (0.55 + 0.35 * jitter(k + 2)) + 0.12;
    const rise = (0.05 + 0.07 * u) * (1 - form.weep) - form.weep * 0.06;
    bough(
      s,
      root,
      a,
      len,
      -rise * 0.5,
      -rise,
      len * 0.42,
      (jitter(k + 6) - 0.5) * 2.4,
      jitter(k + 3) < 0.5 ? "twig" : "twigB",
      p.twigs.clone().multiplyScalar(1.2),
      p.twigs,
      snowy * (u < 0.65 ? 1 : 0.2),
    );
  }
  return merge(wood, s.geometry());
}

/** The region's paint back out of a kind's (for the faceted builder). */
function paintOf(p: KindPaint): TreePaint {
  return {
    needle: p.needle,
    needleDark: p.dark,
    birchBark: p.bark,
    birchTwigs: p.twigs,
    load: p.load,
  };
}

/** A faceted tree as a card tree: every vertex on the atlas's solid tile,
 * carrying no snow of its own. */
function asCards(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.getAttribute("position").count;
  const [u, v] = atTile("solid", 0.5, 0.5);
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("card", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}

/** Two non-indexed geometries with the same attributes as one. */
function merge(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const name of Object.keys(b.attributes)) {
    const x = a.getAttribute(name);
    const y = b.getAttribute(name);
    const out = new Float32Array(x.array.length + y.array.length);
    out.set(x.array as Float32Array, 0);
    out.set(y.array as Float32Array, x.array.length);
    g.setAttribute(name, new THREE.Float32BufferAttribute(out, y.itemSize));
  }
  a.dispose();
  b.dispose();
  g.computeBoundingSphere();
  return g;
}

/** One variant's card tree at a level of detail. */
export function buildCardTree(
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
      return larch(v, v.shape, p, lod, seed, paint);
    case "birch":
      return broadleaf(v, v.shape, p, lod, seed, paint);
  }
}
