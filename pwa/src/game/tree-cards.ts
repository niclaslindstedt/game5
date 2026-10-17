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
// THREE CUTS, the same tree in the same paint and the same cards, lighter
// each time, handed one to the next by the forest's dither (`CardLod`):
//   0 FULL — every whorl's boughs as two cards each, the core, the trunk,
//          the leader: the nearest trees on the richest FOREST row;
//   1 LIGHT — a third of the whorls, three single wider cards a whorl, a
//          lighter core and two standing cards: the nearest trees on the
//          middle row, the next ring on the richest — the same tree with
//          fewer, bigger sprays;
//   2 CLOUD — a BILLBOARD CLOUD: two cards standing through the tree
//          carrying its whole silhouette from the side, one laid across it
//          carrying it seen from above, the core and the trunk — a few tens
//          of triangles that read from the side AND from a chair overhead.
// Past the cloud a tree is a few pixels high and the forest draws its
// faceted sketch, which reads the same at that size for less fill.
//
// A card's cost is its FILL: every pixel of every card is cut by its
// coverage, layer behind layer, so each cut is held to a few times the
// area of its faceted counterpart (the full cut, seen only close, the
// most).
//
// Every vertex carries a `uv` into the atlas and a `card` pair: how much
// snow the part can carry (0 for the wood and the core) and whether its
// back face is its UNDERSIDE (a bough's, darkened and bare of snow seen
// from below) or just its other side (a standing card's).

import * as THREE from "three";

import { type AtlasTile } from "./tree-atlas.ts";
import {
  BARE_SNOW,
  asCards,
  bough,
  card,
  cardShape,
  core,
  deep,
  merge,
  paintOf,
  solid,
  standing,
  umbrella,
} from "./tree-card-parts.ts";
import { smooth, jitter, type V3 } from "./tree-mesh.ts";
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

/** A card tree's cut: 0 full, 1 light, 2 the billboard cloud. */
export type CardLod = 0 | 1 | 2;

/** How many cuts a card tree has. */
export const CARD_LODS = 3;

/** The faceted cut a card cut's wood (its trunk, its limbs, a tree drawn
 * solid) is built at. */
const woodLod = (lod: CardLod): TreeLod => (lod === 0 ? 0 : 1);

/** A CONIFER: whorls of drooping bough cards over a dark core. */
function conifer(v: TreeVariant, form: ConiferForm, p: KindPaint, lod: CardLod, seed: number) {
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
  // A crown that is a cone has its standing cards cut to the cone; a
  // flat-topped or clubbed one keeps the whole card.
  const cone = form.flat <= 0 && form.club <= 0;
  const spray: AtlasTile = form.droop > 1.2 || v.taper > 1.3 ? "fir" : "spruce";
  const sprayB: AtlasTile = spray === "fir" ? "firB" : "spruceB";
  // The trunk into the crown.
  const trunkTop = Math.min(0.85, v.base + 0.5);
  trunk(
    s,
    joints(trunkTop, woodLod(lod)),
    1,
    0.35,
    woodLod(lod),
    (y) => [nodAt(y), 0],
    (y) => p.bark.clone().multiplyScalar(0.75 + 0.35 * Math.min(1, y * 3)),
  );
  const dark = deep(p);
  const span = v.top - v.base;
  if (lod === 2) {
    // THE BILLBOARD CLOUD, over its opaque core: most of what makes a
    // distant spruce a dark cone rather than a wisp of needles.
    core(
      s,
      [v.base, v.base + span * 0.1, v.base + span * 0.45, v.top - span * 0.08],
      (y) => radiusAt(y) * (y > v.base ? 0.5 : 0.15),
      4,
      dark,
      nodAt,
      snowy,
    );
    standing(
      s,
      2,
      v.base - span * 0.04,
      v.top + 0.01,
      v.width * 0.85,
      side,
      p.needle.clone().lerp(p.dark, 0.5),
      p.needle,
      snowy,
      seed,
      cone,
    );
    const y = v.base + span * 0.25;
    umbrella(s, y, radiusAt(y) * 0.8, span * 0.04, "disc", p.dark, p.needle, snowy, seed);
    return s.geometry();
  }
  // The light cut: a third of the whorls, three boughs a whorl, each one
  // card and wider, so the crown reads full with a fifth of the cards.
  const light = lod === 1;
  core(
    s,
    // Its foot drawn in to the stem, so from under the crown it is a point
    // and not a lid.
    light
      ? [v.base, v.base + span * 0.1, v.base + span * 0.45, v.top - span * 0.05]
      : [
          v.base,
          v.base + span * 0.1,
          v.base + span * 0.3,
          v.base + span * 0.65,
          v.top - span * 0.04,
        ],
    (y) => radiusAt(y) * (y > v.base ? (light ? 0.38 : 0.32) : 0.08),
    light ? 4 : 5,
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
    light ? 2 : 3,
    v.base - span * 0.02,
    v.top,
    v.width * (light ? 0.7 : 0.82),
    side,
    p.needle.clone().lerp(p.dark, 0.7),
    p.needle.clone().lerp(p.dark, 0.3),
    snowy,
    seed,
    cone,
  );
  // THE WHORLS: one a tier, the boughs round it at a golden turn, each
  // bough drooping to its tip (and, on a spruce, turning up again at it).
  const count = light
    ? Math.max(4, Math.round(form.tiers * 0.35))
    : Math.max(5, Math.round(form.tiers * 0.65));
  const tiers = tiersOf(count, v.base, v.top, v.taper);
  const per = light ? 3 : Math.min(7, Math.max(5, form.sides - 2));
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
      const wide = Math.min(
        light ? 0.75 : 0.6,
        reach * (0.5 + 0.15 * jitter(k + 9)) * (light ? 1.3 : 1),
      );
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
        light,
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
    for (let k = 0; k < (light ? 2 : 4); k++) {
      const a = (k / (light ? 2 : 4)) * Math.PI * 2 + seed;
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
        light,
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
function pine(v: TreeVariant, form: PineForm, p: KindPaint, cardLod: CardLod, seed: number) {
  const s = cardShape(v);
  // The light cut is the full one with fewer pads and fewer tufts round
  // each; the cloud is the pads' umbrellas.
  const light = cardLod === 1;
  const lod: TreeLod = cardLod <= 1 ? 0 : 1;
  // Barely past the laden mark: a pine's flat tufts crusted whole read as
  // grey plates, so its snow stays in the brushes.
  const snowy = Math.min(0.95, form.snow * p.load * 1.5);
  const kinkX = (y: number): number =>
    form.kink > 0 && y > form.kink ? Math.min(1, (y - form.kink) / 0.12) * form.kinkBy : 0;
  const stems = form.stems;
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
  const pads =
    lod === 0
      ? Math.min(light ? 6 : 9, Math.max(3, Math.ceil(form.pads * (light ? 0.5 : 0.7))))
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
      const tufts = light ? 2 : 6;
      for (let j = 0; j < tufts; j++) {
        const b = a + (j / tufts) * Math.PI * 2 + jitter(k + j) * 0.8;
        bough(
          s,
          [cx, y + form.thick * 0.3, cz],
          b,
          pr * 1.1,
          form.thick * 0.15,
          form.thick * 0.45,
          pr * (light ? 0.8 : 0.6),
          0.5,
          "tuft",
          p.dark,
          p.needle,
          snowy * 0.8,
          light,
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
  cardLod: CardLod,
  seed: number,
  paint: TreePaint,
) {
  if (form.dead || p.leaf) return asCards(buildTree(v, paint, woodLod(cardLod)));
  // The light cut is the full one with half the whorls and fewer arms.
  const light = cardLod === 1;
  const lod: TreeLod = cardLod <= 1 ? 0 : 1;
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
    standing(s, 2, v.base, v.top + 0.02, v.width * 0.85, "bareSide", p.bark, p.twigs, snowy, seed);
    umbrella(
      s,
      v.base + (v.top - v.base) * 0.3,
      v.width * 0.6,
      0.03,
      "twigDisc",
      p.bark,
      p.twigs,
      snowy,
      seed,
    );
    return s.geometry();
  }
  standing(
    s,
    2,
    v.base,
    v.top + 0.02,
    v.width * (light ? 0.8 : 0.95),
    "bareSide",
    p.bark,
    p.twigs,
    snowy,
    seed,
  );
  const whorls = light
    ? Math.max(3, Math.round(form.whorls * 0.4))
    : Math.max(5, Math.round(form.whorls * 0.75));
  const arms = Math.min(light ? 3 : 5, form.arms);
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
        reach * (light ? 0.5 : 0.45),
        (jitter(k + 2) - 0.5) * 2.2,
        tile,
        p.bark,
        p.twigs,
        snowy * (u < 0.7 ? 1 : 0.3),
        light,
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
  cardLod: CardLod,
  seed: number,
  paint: TreePaint,
) {
  if (p.leaf) return asCards(buildTree(v, paint, woodLod(cardLod)));
  if (cardLod <= 1) {
    // The faceted builder's stems and limbs, its sprays re-clothed: every
    // fin it lays becomes a twig card (half as many, wider, on the light
    // cut, over its mid cut's wood).
    return twigCards(v, form, p, seed, cardLod === 1);
  }
  const lod: TreeLod = 1;
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
    2,
    v.base * 0.9,
    v.top + 0.02,
    v.width * 0.7,
    "bareSide",
    p.bark,
    p.twigs,
    snowy,
    seed,
  );
  umbrella(
    s,
    v.base + (v.top - v.base) * 0.45,
    v.width * 0.6,
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
  light: boolean,
): THREE.BufferGeometry {
  // The limbs and stems as the faceted builder lays them, but with no
  // sprays: built with no fins at all, then the sprays laid as cards here.
  const bare = { ...v, shape: { ...form, fins: 0, berries: 0, leaves: 0 } };
  const wood = asCards(buildTree(bare, { ...paintOf(p), load: p.load }, light ? 1 : 0));
  const s = cardShape(v);
  const snowy = Math.min(BARE_SNOW, form.snow * p.load);
  const sprays = Math.round(form.fins * (light ? 0.3 : 0.5));
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
      len * (light ? 0.55 : 0.42),
      (jitter(k + 6) - 0.5) * 2.4,
      jitter(k + 3) < 0.5 ? "twig" : "twigB",
      p.twigs.clone().multiplyScalar(1.2),
      p.twigs,
      snowy * (u < 0.65 ? 1 : 0.2),
      light,
    );
  }
  return merge(wood, s.geometry());
}

/** One variant's card tree at a level of detail. */
export function buildCardTree(
  v: TreeVariant,
  paint: TreePaint,
  lod: CardLod = 0,
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
