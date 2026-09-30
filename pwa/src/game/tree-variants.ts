// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREES, AS DATA — ten VARIANTS of each of the twenty kinds that grow
// (`TreeKind`, R14/R21), each a row of numbers the builder
// (`tree-shapes.ts`) turns into a mesh, and the SILHOUETTE every one of them
// has (`crownAt`), which the lens-clear and the forest lab
// (`scripts/forest-lab.mjs`) read to say how far a skier sees into a wood.
// Three-free, so the suite and the labs read every row.
//
// WHY TEN OF EACH. A wood drawn with one tree copied reads as one tree
// copied, however it is turned and tinted — the eye finds the repeat in a
// second. What makes a real northern wood read as grown is the SPREAD
// inside a kind, and each kind's ten are the shapes it actually takes in a
// snow country: the dense spire and the self-pruned stand tree a skier sees
// UNDER, the snow ghost bowed under its rime, the flagged tree on a wood's
// windward edge, the storm-broken top, the leaning one on a slope, the
// twin-stemmed, the young and the old — and each kind's own (the black
// spruce's club top, the hemlock's nodding leader, the white pine's flat
// layers, the lodgepole's bare pole, the dwarf pine's sprawl of stems, the
// snag's grey bones, the rowan's berries, the beech's copper leaves kept
// all winter, the willow's thicket of orange wands).
//
// FOUR FORMS carry the twenty kinds: a CONIFER is a stack of drooping
// skirts; a PINE a trunk (or several) under pads of needles; a LARCH a
// skeleton of whorls (and a snag the same, dead); a BIRCH-form tree bare
// stems under fans of twigs, which every broadleaf in winter is. What colour
// each kind is painted is `tree-shapes.ts`'s, off the region's look.
//
// Which variant stands where is a hash of the trunk's place (`variantAt`),
// a different one from the hash that turns and tints it, so a variant is
// never tied to a heading.

import type { TreeKind } from "@engine";

/** How many variants every kind has. */
export const VARIANTS = 10;

/** THE TREE A MODEL IS MADE AT, m: the Blender builder (`make blender
 * KIND=tree`) states every variant in metres at this height and crown
 * radius (the generator's crown share of it, `forest.crown`), and
 * `tree-models.ts` divides them back out into the unit frame the forest
 * scales every tree from. */
export const TREE_REFERENCE = { height: 12, crown: 2.88 } as const;

/** A conifer as a stack of drooping skirts. */
export type ConiferForm = {
  readonly form: "conifer";
  /** How many tiers of boughs, and how many boughs a tier. */
  readonly tiers: number;
  readonly sides: number;
  /** How the tiers narrow up the tree (1 a straight cone, over 1 a spire). */
  readonly taper: number;
  /** How much of a bough carries snow, 0..1, and how far the tiers droop
   * under it (1 the builder's own). */
  readonly snow: number;
  readonly droop: number;
  /** The boughs pushed to one side, 0 round … 1 all on the lee — a flagged
   * tree at a wood's edge. */
  readonly flag: number;
  /** Tiers left out (indices from the bottom) — whorls lost. */
  readonly missing: readonly number[];
  /** The top tiers FLATTENED, 0 a spire … 1 a flat top (the old fir's
   * stork's nest). */
  readonly flat: number;
  /** A second, smaller spire off the top (a twin-topped tree). */
  readonly twin: boolean;
  /** A dead spire above the top tier, as a share of the height (0: none). */
  readonly spire: number;
  /** The lowest tier's extra spread across the snow (a krummholz skirt). */
  readonly skirt: number;
  /** The leader NODDING over: how far the top swings off plumb, in crown
   * radii (the hemlock's). */
  readonly nod: number;
  /** A CLUB of boughs at the top, 0 none … 1 the black spruce's. */
  readonly club: number;
  /** How ragged the boughs are, 0 even … 1 a juniper's rough column. */
  readonly rough: number;
};

/** A pine: a bare trunk (or several) under pads of needles. */
export type PineForm = {
  readonly form: "pine";
  /** How many pads the crown is, and how far off the trunk they reach
   * (share of the crown radius). */
  readonly pads: number;
  readonly spread: number;
  /** A pad's thickness as a share of the height. */
  readonly thick: number;
  /** How much of a pad's top carries snow, 0..1. */
  readonly snow: number;
  /** A kink in the trunk at this share of the height, sideways by `kinkBy`
   * of the crown radius (0: straight). */
  readonly kink: number;
  readonly kinkBy: number;
  /** A young pine is still a cone of whorls; 0 old and flat … 1 young. */
  readonly young: number;
  /** How many stems off one root, and how far they splay, rad — the dwarf
   * pine's sprawl. */
  readonly stems: number;
  readonly splay: number;
  /** The pads set in this many flat LAYERS round the stem (the white
   * pine's); 0 scattered. */
  readonly layers: number;
};

/** A larch in winter — or a snag: a skeleton of whorls. */
export type LarchForm = {
  readonly form: "larch";
  readonly whorls: number;
  /** Branches a whorl, and how far they droop at the tip, 0..1. */
  readonly arms: number;
  readonly droop: number;
  readonly snow: number;
  /** Long dead: short stubs of branches and no twigs hanging off them. */
  readonly dead: boolean;
};

/** A broadleaf in winter: bare stems under fans of twigs. */
export type BirchForm = {
  readonly form: "birch";
  /** How many stems off one root, and how far they splay, rad. */
  readonly stems: number;
  readonly splay: number;
  /** Twig sprays the crown is made of, and how far their tips hang (0
   * reaching up … 1 weeping). */
  readonly fins: number;
  readonly weep: number;
  readonly snow: number;
  /** Dark marks on the bark, share of its bands — the birch's, the aspen's. */
  readonly marks: number;
  /** Share of the sprays carrying a berry cluster at the tip (the rowan's). */
  readonly berries: number;
  /** Share of the sprays still carrying LEAVES, cones or keys (the beech's
   * dead copper leaves, the alder's cones, the ash's keys). */
  readonly leaves: number;
  /** The crown's outline, 0 a teardrop … 1 a broad dome. */
  readonly dome: number;
  /** How stout a spray is, 1 the birch's: an ash's twigs are thick. */
  readonly stiff: number;
};

export type TreeForm = ConiferForm | PineForm | LarchForm | BirchForm;

export type TreeVariant = {
  readonly kind: TreeKind;
  readonly index: number;
  /** What the sheet calls it. */
  readonly name: string;
  /** Where the foliage (or the bare crown) starts and ends, shares of the
   * height: under `base` a skier sees the trunk and nothing else. */
  readonly base: number;
  readonly top: number;
  /** The crown's widest, as a share of the tree's crown radius. */
  readonly width: number;
  /** How the crown's radius goes from `base` to `top`: 1 a cone, over 1 a
   * spire (the conifers); a pine's and a broadleaf's are their own. */
  readonly taper: number;
  /** How much of what is behind the crown it hides, 0..1 — a spruce is a
   * wall of needles, a larch in winter a lattice. */
  readonly opacity: number;
  /** The whole tree leaned off plumb, rad. */
  readonly lean: number;
  readonly shape: TreeForm;
};

const cf = (o: Partial<ConiferForm> = {}): ConiferForm => ({
  form: "conifer",
  tiers: 8,
  sides: 9,
  taper: 1.1,
  snow: 0.45,
  droop: 1,
  flag: 0,
  missing: [],
  flat: 0,
  twin: false,
  spire: 0,
  skirt: 0,
  nod: 0,
  club: 0,
  rough: 0,
  ...o,
});

const pn = (o: Partial<PineForm> = {}): PineForm => ({
  form: "pine",
  pads: 5,
  spread: 0.8,
  thick: 0.1,
  snow: 0.6,
  kink: 0,
  kinkBy: 0,
  young: 0,
  stems: 1,
  splay: 0,
  layers: 0,
  ...o,
});

const lf = (o: Partial<LarchForm> = {}): LarchForm => ({
  form: "larch",
  whorls: 9,
  arms: 5,
  droop: 0.5,
  snow: 0.35,
  dead: false,
  ...o,
});

const bh = (o: Partial<BirchForm> = {}): BirchForm => ({
  form: "birch",
  stems: 1,
  splay: 0,
  fins: 52,
  weep: 0.2,
  snow: 0.6,
  marks: 0,
  berries: 0,
  leaves: 0,
  dome: 0,
  stiff: 1,
  ...o,
});

/** A birch's own: the dark marks on its white bark. */
const br = (o: Partial<BirchForm> = {}): BirchForm => bh({ marks: 0.28, ...o });

/** One row: its name, then base, top, width, taper, opacity, lean, form. */
type Row = readonly [string, number, number, number, number, number, number, TreeForm];

// prettier-ignore
const ROWS: Readonly<Record<TreeKind, readonly Row[]>> = {
  spruce: [
    ["dense spire", 0.08, 1, 1, 1.1, 1, 0, cf({ tiers: 9 })],
    ["pencil", 0.1, 1, 0.62, 1.35, 1, 0, cf({ tiers: 12, sides: 8, taper: 1.35, snow: 0.3 })],
    ["snow ghost", 0.06, 1, 1, 1, 1, 0, cf({ tiers: 7, snow: 0.95, droop: 1.8, taper: 1 })],
    ["stand tree", 0.3, 1, 0.85, 1.15, 1, 0, cf({ tiers: 7, taper: 1.15 })],
    ["flagged", 0.12, 1, 0.95, 1.1, 0.9, 0.02, cf({ tiers: 9, flag: 0.7, snow: 0.35 })],
    ["storm-broken", 0.1, 0.86, 0.95, 0.9, 1, 0, cf({ tiers: 7, taper: 0.9, spire: 0.14 })],
    ["young broad", 0.03, 1, 1, 0.85, 1, 0, cf({ tiers: 6, sides: 8, taper: 0.85, snow: 0.6 })],
    ["gap-toothed", 0.14, 1, 0.9, 1.1, 0.8, 0, cf({ tiers: 10, missing: [2, 5, 6] })],
    ["leaning", 0.12, 1, 0.9, 1.2, 1, 0.07, cf({ tiers: 9, taper: 1.2 })],
    ["twin-topped", 0.2, 1, 0.9, 1, 1, 0, cf({ tiers: 8, taper: 1, twin: true, snow: 0.55 })],
  ],
  fir: [
    ["candle", 0.06, 1, 0.55, 1.6, 1, 0, cf({ tiers: 11, sides: 8, taper: 1.6, snow: 0.7 })],
    ["laden candle", 0.05, 1, 0.6, 1.5, 1, 0, cf({ tiers: 9, sides: 8, taper: 1.5, snow: 0.95, droop: 1.5 })],
    ["silver fir", 0.15, 1, 1, 1, 1, 0, cf({ tiers: 7, taper: 1, snow: 0.75 })],
    ["stork's nest", 0.32, 0.97, 0.9, 0.55, 1, 0, cf({ tiers: 6, taper: 0.55, flat: 0.8, snow: 0.85 })],
    ["stand fir", 0.28, 1, 0.7, 1.3, 1, 0, cf({ tiers: 8, sides: 8, taper: 1.3, snow: 0.7 })],
    ["young fir", 0.02, 1, 0.85, 1, 1, 0, cf({ tiers: 6, sides: 8, taper: 1, snow: 0.8 })],
    ["wind-leaned", 0.08, 1, 0.65, 1.4, 1, 0.06, cf({ tiers: 9, sides: 8, taper: 1.4, flag: 0.45, snow: 0.6 })],
    ["flagged fir", 0.1, 1, 0.7, 1.3, 0.85, 0, cf({ tiers: 9, sides: 8, taper: 1.3, flag: 0.85, snow: 0.5 })],
    ["needle", 0.08, 1, 0.42, 1.9, 1, 0, cf({ tiers: 13, sides: 7, taper: 1.9, snow: 0.65 })],
    ["krummholz skirt", 0, 1, 0.75, 1.5, 1, 0, cf({ tiers: 8, taper: 1.5, skirt: 0.45, snow: 0.8 })],
  ],
  pine: [
    ["old pine", 0.62, 1, 1, 1, 0.8, 0, pn({ pads: 6 })],
    ["umbrella", 0.72, 1, 1, 1, 0.8, 0, pn({ pads: 5, spread: 0.95, thick: 0.06 })],
    ["tall stand pine", 0.7, 1, 0.7, 1, 0.75, 0, pn({ pads: 4, spread: 0.6 })],
    ["young pine", 0.2, 1, 0.8, 1, 0.85, 0, pn({ pads: 7, spread: 0.7, young: 1, snow: 0.6 })],
    ["half-grown", 0.42, 1, 0.85, 1, 0.8, 0, pn({ pads: 6, spread: 0.75, young: 0.5 })],
    ["kinked", 0.6, 1, 0.9, 1, 0.8, 0, pn({ pads: 5, kink: 0.45, kinkBy: 0.35 })],
    ["windswept", 0.55, 0.98, 1, 1, 0.75, 0.08, pn({ pads: 4, spread: 1, thick: 0.05 })],
    ["laden pine", 0.58, 1, 0.95, 1, 0.85, 0, pn({ pads: 7, thick: 0.09, snow: 1 })],
    ["sparse pine", 0.66, 1, 0.85, 1, 0.6, 0.02, pn({ pads: 3, spread: 0.85, snow: 0.5 })],
    ["twin-crowned", 0.55, 1, 1, 1, 0.8, 0, pn({ pads: 8, spread: 0.9, kink: 0.62, kinkBy: 0.15 })],
  ],
  larch: [
    ["larch", 0.12, 1, 0.9, 1.1, 0.35, 0, lf()],
    ["weeping larch", 0.1, 1, 0.95, 1, 0.4, 0, lf({ droop: 0.9, arms: 6 })],
    ["slender larch", 0.2, 1, 0.6, 1.3, 0.3, 0, lf({ whorls: 11, arms: 4 })],
    ["old larch", 0.35, 1, 1, 0.8, 0.35, 0, lf({ whorls: 7, arms: 6, droop: 0.7 })],
    ["young larch", 0.05, 1, 0.75, 1, 0.3, 0, lf({ whorls: 8, arms: 4, droop: 0.2 })],
    ["rimed larch", 0.12, 1, 0.85, 1.1, 0.45, 0, lf({ snow: 0.85 })],
    ["leaning larch", 0.15, 1, 0.85, 1.1, 0.35, 0.07, lf({ whorls: 9, arms: 5 })],
    ["sparse larch", 0.25, 1, 0.9, 1, 0.25, 0, lf({ whorls: 6, arms: 4, droop: 0.6 })],
    ["dense larch", 0.08, 1, 0.85, 1.2, 0.5, 0, lf({ whorls: 12, arms: 6, droop: 0.4 })],
    ["stag-headed", 0.2, 0.9, 0.9, 0.9, 0.35, 0.02, lf({ whorls: 8, arms: 5, droop: 0.3, snow: 0.2 })],
  ],
  blackspruce: [
    ["club-topped", 0.06, 1, 0.45, 1.2, 0.9, 0, cf({ tiers: 13, sides: 7, taper: 1.2, club: 0.9, snow: 0.4 })],
    ["bog spire", 0.1, 1, 0.38, 1, 0.85, 0, cf({ tiers: 14, sides: 7, taper: 1, club: 0.5, rough: 0.3 })],
    ["layered skirt", 0, 1, 0.55, 1.4, 0.9, 0, cf({ tiers: 12, sides: 7, taper: 1.4, skirt: 1.2, club: 0.6 })],
    ["rime-laden", 0.06, 1, 0.5, 1.2, 0.95, 0, cf({ tiers: 11, sides: 7, club: 0.7, snow: 0.95, droop: 1.6 })],
    ["bare-stemmed", 0.35, 1, 0.4, 1.1, 0.8, 0, cf({ tiers: 9, sides: 7, club: 1 })],
    ["ragged", 0.08, 1, 0.5, 1.1, 0.75, 0, cf({ tiers: 12, sides: 7, missing: [3, 4, 7], rough: 0.6, club: 0.6 })],
    ["leaning bog spruce", 0.08, 1, 0.45, 1.1, 0.85, 0.09, cf({ tiers: 12, sides: 7, club: 0.7 })],
    ["burnt top", 0.1, 0.9, 0.45, 1.1, 0.85, 0, cf({ tiers: 11, sides: 7, club: 0.4, spire: 0.1 })],
    ["wind-flagged", 0.1, 1, 0.45, 1.1, 0.8, 0, cf({ tiers: 12, sides: 7, flag: 0.8, club: 0.6 })],
    ["twin club", 0.1, 1, 0.5, 1.1, 0.9, 0, cf({ tiers: 12, sides: 7, club: 0.8, twin: true })],
  ],
  stonepine: [
    ["dense stone pine", 0.12, 1, 0.95, 1, 0.9, 0, pn({ pads: 12, spread: 0.55, young: 0.6, thick: 0.12 })],
    ["round crown", 0.25, 1, 1, 1, 0.9, 0, pn({ pads: 11, spread: 0.6, young: 0.3, thick: 0.12 })],
    ["candelabra", 0.35, 1, 1, 1, 0.85, 0, pn({ pads: 9, spread: 0.9, stems: 2, splay: 0.12 })],
    ["timberline", 0.05, 1, 0.9, 1, 0.9, 0.05, pn({ pads: 13, spread: 0.5, young: 0.8 })],
    ["storm-split", 0.3, 1, 0.95, 1, 0.8, 0, pn({ pads: 8, spread: 0.8, kink: 0.55, kinkBy: 0.3 })],
    ["laden stone pine", 0.15, 1, 0.95, 1, 0.95, 0, pn({ pads: 12, spread: 0.6, young: 0.5, snow: 1, thick: 0.14 })],
    ["tall stone pine", 0.4, 1, 0.8, 1, 0.85, 0, pn({ pads: 10, spread: 0.6, young: 0.3 })],
    ["twin-stemmed", 0.2, 1, 1, 1, 0.9, 0, pn({ pads: 12, spread: 0.6, young: 0.5, stems: 2, splay: 0.18 })],
    ["wind-shorn", 0.25, 1, 1, 1, 0.75, 0.06, pn({ pads: 8, spread: 1, thick: 0.08 })],
    ["old giant", 0.3, 0.97, 1, 1, 0.9, 0, pn({ pads: 14, spread: 0.8, thick: 0.12 })],
  ],
  whitepine: [
    ["layered", 0.35, 1, 1, 1, 0.7, 0, pn({ pads: 12, layers: 4, spread: 0.95, thick: 0.06 })],
    ["tall layered", 0.5, 1, 0.85, 1, 0.65, 0, pn({ pads: 9, layers: 3, spread: 0.9, thick: 0.06 })],
    ["young white pine", 0.1, 1, 0.8, 1, 0.75, 0, pn({ pads: 15, layers: 5, spread: 0.7, young: 0.7, thick: 0.06 })],
    ["flag-topped", 0.45, 1, 1, 1, 0.65, 0.03, pn({ pads: 9, layers: 3, spread: 1, thick: 0.06 })],
    ["broad white pine", 0.3, 1, 1, 1, 0.75, 0, pn({ pads: 15, layers: 5, spread: 1, thick: 0.07 })],
    ["sparse layers", 0.5, 1, 0.9, 1, 0.5, 0, pn({ pads: 6, layers: 2, spread: 0.9, thick: 0.05 })],
    ["laden layers", 0.35, 1, 1, 1, 0.75, 0, pn({ pads: 12, layers: 4, spread: 0.9, thick: 0.08, snow: 1 })],
    ["kinked", 0.4, 1, 0.95, 1, 0.7, 0, pn({ pads: 9, layers: 3, spread: 0.9, kink: 0.5, kinkBy: 0.25, thick: 0.06 })],
    ["twin leader", 0.35, 1, 1, 1, 0.7, 0, pn({ pads: 12, layers: 4, spread: 0.9, stems: 2, splay: 0.1, thick: 0.06 })],
    ["leaning", 0.4, 1, 0.95, 1, 0.7, 0.07, pn({ pads: 9, layers: 3, spread: 0.9, thick: 0.06 })],
  ],
  lodgepole: [
    ["pole", 0.72, 1, 0.45, 1, 0.6, 0, pn({ pads: 5, spread: 0.35, thick: 0.08 })],
    ["dense pole", 0.65, 1, 0.5, 1, 0.65, 0, pn({ pads: 7, spread: 0.35, young: 0.4 })],
    ["thin pole", 0.8, 1, 0.35, 1, 0.5, 0, pn({ pads: 4, spread: 0.3 })],
    ["young lodgepole", 0.3, 1, 0.55, 1, 0.7, 0, pn({ pads: 9, spread: 0.4, young: 1 })],
    ["doghair", 0.78, 1, 0.3, 1, 0.45, 0, pn({ pads: 3, spread: 0.25, thick: 0.07 })],
    ["leaning pole", 0.72, 1, 0.45, 1, 0.6, 0.06, pn({ pads: 5, spread: 0.35 })],
    ["laden pole", 0.68, 1, 0.5, 1, 0.7, 0, pn({ pads: 6, spread: 0.4, snow: 1, thick: 0.1 })],
    ["crooked", 0.7, 1, 0.45, 1, 0.6, 0, pn({ pads: 5, spread: 0.4, kink: 0.4, kinkBy: 0.2 })],
    ["tufted", 0.75, 1, 0.5, 1, 0.6, 0, pn({ pads: 6, spread: 0.45, thick: 0.09 })],
    ["half-grown", 0.5, 1, 0.5, 1, 0.65, 0, pn({ pads: 7, spread: 0.4, young: 0.6 })],
  ],
  hemlock: [
    ["nodding leader", 0.05, 1, 0.9, 1, 1, 0, cf({ tiers: 10, taper: 1, droop: 1.6, nod: 0.35 })],
    ["broad hemlock", 0.04, 1, 1, 0.9, 1, 0, cf({ tiers: 9, taper: 0.9, droop: 1.8, nod: 0.3, snow: 0.6 })],
    ["stand hemlock", 0.3, 1, 0.8, 1.1, 1, 0, cf({ tiers: 8, droop: 1.5, nod: 0.3 })],
    ["laden hemlock", 0.05, 1, 0.95, 1, 1, 0, cf({ tiers: 9, taper: 1, droop: 2.2, snow: 0.95, nod: 0.4 })],
    ["slender hemlock", 0.08, 1, 0.7, 1.2, 1, 0, cf({ tiers: 11, taper: 1.2, droop: 1.5, nod: 0.25 })],
    ["leaning hemlock", 0.1, 1, 0.85, 1.1, 1, 0.06, cf({ tiers: 10, droop: 1.6, nod: 0.4 })],
    ["flagged hemlock", 0.1, 1, 0.85, 1.1, 0.85, 0, cf({ tiers: 10, flag: 0.6, droop: 1.5, nod: 0.3 })],
    ["old hemlock", 0.2, 0.97, 1, 0.8, 1, 0, cf({ tiers: 8, taper: 0.8, flat: 0.4, droop: 1.6, nod: 0.15 })],
    ["young hemlock", 0.02, 1, 0.85, 1, 1, 0, cf({ tiers: 7, taper: 1, droop: 1.4, nod: 0.5, snow: 0.7 })],
    ["gapped hemlock", 0.12, 1, 0.9, 1.1, 0.8, 0, cf({ tiers: 10, missing: [2, 5], droop: 1.6, nod: 0.3 })],
  ],
  juniper: [
    ["column", 0.02, 1, 0.42, 0.45, 1, 0, cf({ tiers: 14, sides: 7, taper: 0.45, flat: 0.55, rough: 0.8, droop: 0.2, snow: 0.25 })],
    ["flame", 0.02, 1, 0.5, 0.9, 1, 0, cf({ tiers: 13, sides: 7, taper: 0.9, rough: 0.8, droop: 0.2, snow: 0.2 })],
    ["broad juniper", 0, 1, 0.75, 0.6, 1, 0, cf({ tiers: 10, sides: 8, taper: 0.6, flat: 0.5, rough: 0.9, droop: 0.3, skirt: 0.3, snow: 0.3 })],
    ["multi-spire", 0.02, 1, 0.55, 0.6, 1, 0, cf({ tiers: 12, sides: 7, taper: 0.6, rough: 0.8, twin: true, droop: 0.2, snow: 0.25 })],
    ["snow-capped", 0.02, 1, 0.45, 0.5, 1, 0, cf({ tiers: 12, sides: 7, taper: 0.5, flat: 0.6, rough: 0.7, snow: 0.8, droop: 0.4 })],
    ["leaning column", 0.02, 1, 0.42, 0.45, 1, 0.08, cf({ tiers: 14, sides: 7, taper: 0.45, flat: 0.5, rough: 0.8, droop: 0.2, snow: 0.25 })],
    ["ragged juniper", 0.04, 1, 0.5, 0.7, 0.8, 0, cf({ tiers: 12, sides: 7, taper: 0.7, rough: 1, missing: [3, 7], droop: 0.2, snow: 0.2 })],
    ["slim juniper", 0.02, 1, 0.3, 0.35, 1, 0, cf({ tiers: 16, sides: 6, taper: 0.35, flat: 0.7, rough: 0.6, droop: 0.15, snow: 0.2 })],
    ["wind-cut", 0.04, 1, 0.5, 0.8, 0.85, 0, cf({ tiers: 12, sides: 7, taper: 0.8, flag: 0.7, rough: 0.8, droop: 0.2, snow: 0.25 })],
    ["old juniper", 0.15, 0.95, 0.55, 0.5, 1, 0, cf({ tiers: 11, sides: 7, taper: 0.5, rough: 1, flat: 0.8, droop: 0.2, snow: 0.3 })],
  ],
  dwarfpine: [
    ["sprawl", 0.03, 1, 1, 1, 0.9, 0, pn({ pads: 16, stems: 4, splay: 0.5, spread: 0.3, young: 1, thick: 0.16 })],
    ["upright clump", 0.06, 1, 0.8, 1, 0.9, 0, pn({ pads: 15, stems: 3, splay: 0.25, spread: 0.3, young: 1, thick: 0.15 })],
    ["knee pine", 0.02, 1, 1, 1, 0.95, 0, pn({ pads: 18, stems: 5, splay: 0.6, spread: 0.28, young: 1, thick: 0.18 })],
    ["leaning clump", 0.05, 1, 0.9, 1, 0.9, 0.08, pn({ pads: 14, stems: 3, splay: 0.35, spread: 0.32, young: 1, thick: 0.15 })],
    ["snow-buried", 0.02, 1, 1, 1, 0.95, 0, pn({ pads: 16, stems: 4, splay: 0.5, spread: 0.3, young: 1, snow: 1, thick: 0.17 })],
    ["tall mountain pine", 0.1, 1, 0.8, 1, 0.85, 0, pn({ pads: 13, stems: 2, splay: 0.2, spread: 0.35, young: 0.8, thick: 0.13 })],
    ["sparse clump", 0.08, 1, 0.9, 1, 0.6, 0, pn({ pads: 9, stems: 3, splay: 0.4, spread: 0.4, young: 0.8, thick: 0.13 })],
    ["dense cushion", 0.02, 1, 1, 1, 1, 0, pn({ pads: 20, stems: 4, splay: 0.45, spread: 0.25, young: 1, thick: 0.2 })],
    ["fan", 0.04, 1, 1, 1, 0.85, 0, pn({ pads: 16, stems: 5, splay: 0.7, spread: 0.3, young: 1, thick: 0.15 })],
    ["single stem", 0.05, 1, 0.8, 1, 0.9, 0, pn({ pads: 12, young: 1, spread: 0.35, thick: 0.15 })],
  ],
  snag: [
    ["grey snag", 0.15, 0.85, 0.6, 1.1, 0.2, 0, lf({ whorls: 8, arms: 4, droop: 0.1, dead: true, snow: 0.2 })],
    ["broken snag", 0.15, 0.6, 0.55, 1, 0.2, 0, lf({ whorls: 6, arms: 4, droop: 0.1, dead: true })],
    ["spike", 0.4, 0.95, 0.35, 1, 0.1, 0, lf({ whorls: 5, arms: 3, droop: 0, dead: true })],
    ["leaning snag", 0.15, 0.8, 0.6, 1.1, 0.2, 0.12, lf({ whorls: 7, arms: 4, droop: 0.2, dead: true })],
    ["stump-topped", 0.2, 0.4, 0.5, 1, 0.15, 0, lf({ whorls: 4, arms: 3, dead: true })],
    ["silver ghost", 0.1, 0.9, 0.7, 1.1, 0.25, 0, lf({ whorls: 10, arms: 5, droop: 0.3, dead: true, snow: 0.5 })],
    ["fork-topped", 0.15, 0.85, 0.5, 1, 0.2, 0.03, lf({ whorls: 7, arms: 4, dead: true })],
    ["bare pole", 0.7, 0.9, 0.3, 1, 0.05, 0, lf({ whorls: 3, arms: 3, dead: true, droop: 0 })],
    ["drooping snag", 0.15, 0.85, 0.6, 1.1, 0.2, 0, lf({ whorls: 8, arms: 5, droop: 0.9, dead: true })],
    ["rimed snag", 0.15, 0.8, 0.6, 1.1, 0.3, 0, lf({ whorls: 8, arms: 5, droop: 0.2, dead: true, snow: 0.9 })],
  ],
  birch: [
    ["downy birch", 0.35, 1, 1, 1, 0.3, 0, br()],
    ["weeping birch", 0.3, 1, 0.95, 1, 0.35, 0, br({ weep: 0.85, fins: 60 })],
    ["twin-stemmed", 0.35, 1, 1, 1, 0.3, 0, br({ stems: 2, splay: 0.14, fins: 56 })],
    ["mountain birch", 0.22, 1, 1, 1, 0.35, 0, br({ stems: 3, splay: 0.28, fins: 60, weep: 0.35 })],
    ["slender birch", 0.45, 1, 0.6, 1, 0.25, 0, br({ fins: 40 })],
    ["broad birch", 0.3, 1, 1, 1, 0.35, 0, br({ fins: 64, weep: 0.45, dome: 0.4 })],
    ["leaning birch", 0.35, 1, 0.9, 1, 0.3, 0.09, br({ fins: 48 })],
    ["rimed birch", 0.35, 1, 0.95, 1, 0.4, 0, br({ fins: 56, snow: 1 })],
    ["young birch", 0.2, 1, 0.7, 1, 0.25, 0, br({ fins: 34, weep: 0.1 })],
    ["splayed clump", 0.25, 1, 1, 1, 0.35, 0, br({ stems: 3, splay: 0.4, fins: 58, weep: 0.6 })],
  ],
  aspen: [
    ["aspen", 0.5, 1, 0.6, 1, 0.25, 0, bh({ fins: 40, marks: 0.15, weep: 0.05 })],
    ["tall aspen", 0.6, 1, 0.5, 1, 0.22, 0, bh({ fins: 36, marks: 0.15 })],
    ["clone pair", 0.45, 1, 0.55, 1, 0.25, 0, bh({ fins: 40, marks: 0.15, stems: 2, splay: 0.08 })],
    ["broad aspen", 0.45, 1, 0.8, 1, 0.3, 0, bh({ fins: 50, marks: 0.15, dome: 0.5 })],
    ["young aspen", 0.3, 1, 0.45, 1, 0.2, 0, bh({ fins: 28, marks: 0.1 })],
    ["leaning aspen", 0.5, 1, 0.6, 1, 0.25, 0.07, bh({ fins: 40, marks: 0.15 })],
    ["old aspen", 0.55, 0.95, 0.75, 1, 0.3, 0, bh({ fins: 44, marks: 0.25, dome: 0.6, stiff: 1.3 })],
    ["rimed aspen", 0.5, 1, 0.6, 1, 0.35, 0, bh({ fins: 40, marks: 0.15, snow: 1 })],
    ["slim aspen", 0.65, 1, 0.4, 1, 0.2, 0, bh({ fins: 30, marks: 0.12 })],
    ["grove aspen", 0.55, 1, 0.55, 1, 0.25, 0, bh({ fins: 40, marks: 0.15, stems: 3, splay: 0.05 })],
  ],
  rowan: [
    ["berried rowan", 0.3, 1, 0.8, 1, 0.3, 0, bh({ fins: 40, berries: 0.6, dome: 0.4, stems: 2, splay: 0.15 })],
    ["single rowan", 0.35, 1, 0.75, 1, 0.3, 0, bh({ fins: 40, berries: 0.5, dome: 0.3 })],
    ["laden rowan", 0.3, 1, 0.85, 1, 0.35, 0, bh({ fins: 44, berries: 0.9, dome: 0.5, stems: 2, splay: 0.2 })],
    ["stripped rowan", 0.3, 1, 0.8, 1, 0.3, 0, bh({ fins: 40, berries: 0.15, dome: 0.4 })],
    ["clump rowan", 0.2, 1, 0.9, 1, 0.35, 0, bh({ fins: 48, stems: 3, splay: 0.3, berries: 0.5, dome: 0.4 })],
    ["leaning rowan", 0.3, 1, 0.8, 1, 0.3, 0.08, bh({ fins: 40, berries: 0.6, dome: 0.3 })],
    ["tall rowan", 0.45, 1, 0.65, 1, 0.3, 0, bh({ fins: 40, berries: 0.4 })],
    ["rimed rowan", 0.3, 1, 0.8, 1, 0.35, 0, bh({ fins: 40, berries: 0.6, snow: 1, dome: 0.4 })],
    ["young rowan", 0.25, 1, 0.6, 1, 0.25, 0, bh({ fins: 28, berries: 0.4 })],
    ["spreading rowan", 0.25, 1, 1, 1, 0.35, 0, bh({ fins: 50, berries: 0.6, dome: 0.8, weep: 0.3 })],
  ],
  alder: [
    ["grey alder", 0.3, 1, 0.75, 1, 0.35, 0, bh({ dome: -0.6, fins: 56, leaves: 0.3, stiff: 0.9 })],
    ["alder clump", 0.2, 1, 0.9, 1, 0.4, 0, bh({ dome: -0.6, fins: 60, stems: 3, splay: 0.2, leaves: 0.3 })],
    ["tall alder", 0.4, 1, 0.65, 1, 0.3, 0, bh({ dome: -0.6, fins: 50, leaves: 0.25 })],
    ["streamside", 0.25, 1, 0.8, 1, 0.35, 0.07, bh({ dome: -0.6, fins: 56, stems: 2, splay: 0.25, leaves: 0.3 })],
    ["coned alder", 0.3, 1, 0.8, 1, 0.4, 0, bh({ dome: -0.6, fins: 56, leaves: 0.6 })],
    ["dome alder", 0.3, 1, 0.9, 1, 0.4, 0, bh({ dome: 0.2, fins: 60, leaves: 0.3 })],
    ["young alder", 0.2, 1, 0.6, 1, 0.3, 0, bh({ dome: -0.6, fins: 36, leaves: 0.2 })],
    ["rimed alder", 0.3, 1, 0.75, 1, 0.4, 0, bh({ dome: -0.6, fins: 56, leaves: 0.3, snow: 1 })],
    ["leaning clump", 0.2, 1, 0.85, 1, 0.35, 0.1, bh({ dome: -0.6, fins: 56, stems: 3, splay: 0.3, leaves: 0.3 })],
    ["old alder", 0.35, 0.95, 0.85, 1, 0.4, 0, bh({ dome: -0.6, fins: 52, leaves: 0.35, stiff: 1.3 })],
  ],
  willow: [
    ["osier thicket", 0.05, 1, 0.8, 1, 0.4, 0, bh({ fins: 70, stems: 5, splay: 0.35, weep: 0, stiff: 0.7 })],
    ["wand willow", 0.1, 1, 0.6, 1, 0.35, 0, bh({ fins: 60, stems: 4, splay: 0.2, weep: 0, stiff: 0.6 })],
    ["tree willow", 0.35, 1, 0.9, 1, 0.35, 0, bh({ fins: 56, dome: 0.6, weep: 0.5 })],
    ["weeping willow", 0.3, 1, 1, 1, 0.4, 0, bh({ fins: 64, weep: 1, dome: 0.5 })],
    ["snowed thicket", 0.05, 1, 0.85, 1, 0.45, 0, bh({ fins: 70, stems: 5, splay: 0.4, snow: 1, stiff: 0.7 })],
    ["leaning willow", 0.2, 1, 0.85, 1, 0.35, 0.1, bh({ fins: 56, stems: 3, splay: 0.3, weep: 0.3 })],
    ["catkin willow", 0.1, 1, 0.75, 1, 0.4, 0, bh({ fins: 60, stems: 4, splay: 0.3, leaves: 0.4, stiff: 0.7 })],
    ["sprawling willow", 0.02, 1, 1, 1, 0.4, 0, bh({ fins: 70, stems: 6, splay: 0.6, stiff: 0.7 })],
    ["young willow", 0.1, 1, 0.5, 1, 0.3, 0, bh({ fins: 40, stems: 3, splay: 0.2, stiff: 0.6 })],
    ["pollard", 0.45, 0.9, 0.8, 1, 0.35, 0, bh({ fins: 60, dome: 1, weep: 0, stiff: 0.6 })],
  ],
  beech: [
    ["copper beech", 0.3, 1, 0.9, 1, 0.45, 0, bh({ fins: 56, leaves: 0.7, dome: 0.6 })],
    ["young beech", 0.15, 1, 0.7, 1, 0.5, 0, bh({ fins: 44, leaves: 0.9, dome: 0.3 })],
    ["tall beech", 0.45, 1, 0.8, 1, 0.4, 0, bh({ fins: 52, leaves: 0.5, dome: 0.5 })],
    ["spreading beech", 0.3, 1, 1, 1, 0.45, 0, bh({ fins: 64, leaves: 0.6, dome: 0.9 })],
    ["bare beech", 0.35, 1, 0.9, 1, 0.3, 0, bh({ fins: 56, leaves: 0.1, dome: 0.7 })],
    ["leaning beech", 0.3, 1, 0.85, 1, 0.4, 0.06, bh({ fins: 52, leaves: 0.6, dome: 0.5 })],
    ["twin beech", 0.3, 1, 0.95, 1, 0.45, 0, bh({ fins: 60, stems: 2, splay: 0.15, leaves: 0.6, dome: 0.6 })],
    ["rimed beech", 0.3, 1, 0.9, 1, 0.45, 0, bh({ fins: 56, leaves: 0.5, snow: 1, dome: 0.6 })],
    ["hedge beech", 0.05, 1, 0.8, 1, 0.55, 0, bh({ fins: 50, leaves: 1, dome: 0.4, stems: 3, splay: 0.2 })],
    ["old beech", 0.4, 0.96, 1, 1, 0.4, 0, bh({ fins: 60, leaves: 0.3, dome: 1, stiff: 1.3 })],
  ],
  maple: [
    ["field maple", 0.3, 1, 0.95, 1, 0.35, 0, bh({ fins: 56, dome: 0.8 })],
    ["tall maple", 0.45, 1, 0.8, 1, 0.3, 0, bh({ fins: 52, dome: 0.6 })],
    ["twin maple", 0.3, 1, 1, 1, 0.35, 0, bh({ fins: 60, stems: 2, splay: 0.2, dome: 0.8 })],
    ["round maple", 0.25, 1, 1, 1, 0.4, 0, bh({ fins: 64, dome: 1 })],
    ["young maple", 0.2, 1, 0.6, 1, 0.25, 0, bh({ fins: 36, dome: 0.4 })],
    ["leaning maple", 0.3, 1, 0.9, 1, 0.35, 0.07, bh({ fins: 52, dome: 0.7 })],
    ["keyed maple", 0.3, 1, 0.9, 1, 0.35, 0, bh({ fins: 56, dome: 0.7, leaves: 0.35 })],
    ["rimed maple", 0.3, 1, 0.95, 1, 0.4, 0, bh({ fins: 56, dome: 0.8, snow: 1 })],
    ["multi-stem maple", 0.15, 1, 1, 1, 0.4, 0, bh({ fins: 60, stems: 3, splay: 0.3, dome: 0.7 })],
    ["old maple", 0.4, 0.95, 1, 1, 0.35, 0, bh({ fins: 60, dome: 1, stiff: 1.4 })],
  ],
  ash: [
    ["ash", 0.4, 1, 0.85, 1, 0.25, 0, bh({ weep: -0.5, fins: 36, stiff: 1.8, leaves: 0.3, dome: 0.5 })],
    ["tall ash", 0.55, 1, 0.7, 1, 0.22, 0, bh({ weep: -0.5, fins: 32, stiff: 1.8, leaves: 0.25 })],
    ["keyed ash", 0.4, 1, 0.85, 1, 0.3, 0, bh({ weep: -0.5, fins: 36, stiff: 1.8, leaves: 0.7, dome: 0.5 })],
    ["broad ash", 0.35, 1, 1, 1, 0.3, 0, bh({ weep: -0.5, fins: 44, stiff: 1.6, leaves: 0.3, dome: 0.9 })],
    ["young ash", 0.25, 1, 0.55, 1, 0.2, 0, bh({ weep: -0.5, fins: 24, stiff: 1.6, leaves: 0.1 })],
    ["leaning ash", 0.4, 1, 0.8, 1, 0.25, 0.07, bh({ weep: -0.5, fins: 36, stiff: 1.8, leaves: 0.3 })],
    ["twin ash", 0.35, 1, 0.9, 1, 0.3, 0, bh({ weep: -0.5, fins: 40, stems: 2, splay: 0.15, stiff: 1.8, leaves: 0.3 })],
    ["rimed ash", 0.4, 1, 0.85, 1, 0.35, 0, bh({ weep: -0.5, fins: 36, stiff: 1.8, snow: 1, leaves: 0.3 })],
    ["stag-headed ash", 0.45, 0.88, 0.75, 1, 0.2, 0, bh({ weep: -0.5, fins: 28, stiff: 2 })],
    ["old ash", 0.45, 0.96, 1, 1, 0.3, 0, bh({ weep: -0.5, fins: 44, stiff: 2, leaves: 0.3, dome: 0.8 })],
  ],
};

/** Every kind's ten. */
export const TREE_VARIANTS: Readonly<Record<TreeKind, readonly TreeVariant[]>> = (() => {
  const out = {} as Record<TreeKind, readonly TreeVariant[]>;
  for (const kind of Object.keys(ROWS) as TreeKind[]) {
    out[kind] = ROWS[kind].map(
      ([name, base, top, width, taper, opacity, lean, shape], index): TreeVariant => ({
        kind,
        index,
        name,
        base,
        top,
        width,
        taper,
        opacity,
        lean,
        shape,
      }),
    );
  }
  return out;
})();

/** WHICH VARIANTS SURVIVE A CHEAPER PICTURE: a kind's ten, the most telling
 * first — the forest draws the first so many its share of the FOREST row's
 * budget buys (`FOREST_LOOK`). An unlisted kind's rows are written most-
 * telling-first already. */
const VARIANT_ORDER: Partial<Record<TreeKind, readonly number[]>> = {
  spruce: [0, 3, 2, 1, 6, 8, 4, 9, 5, 7],
  fir: [0, 2, 4, 3, 1, 5, 9, 6, 7, 8],
  pine: [0, 2, 3, 1, 4, 7, 5, 6, 8, 9],
  larch: [0, 1, 3, 2, 4, 5, 6, 7, 8, 9],
  birch: [0, 3, 1, 2, 5, 4, 6, 7, 8, 9],
};

/** The variant a kind draws first: its far-band sketch and its caster. */
export function leadVariant(kind: TreeKind): TreeVariant {
  return TREE_VARIANTS[kind][VARIANT_ORDER[kind]?.[0] ?? 0];
}

/** A hash of the trunk's place, 0..1 — a different one from the hash that
 * turns and tints the tree. */
export function variantAt(x: number, z: number): number {
  let h = (Math.round(x * 16) * 2654435761 + Math.round(z * 16) * 40503) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The variant a tree of `kind` (a spruce when unsaid) at (x, z) is, when
 * `variants` of its kind are drawn. */
export function treeVariant(
  kind: TreeKind | undefined,
  x: number,
  z: number,
  variants = VARIANTS,
): TreeVariant {
  const k = kind ?? "spruce";
  const n = Math.max(1, Math.min(VARIANTS, Math.round(variants)));
  const pick = Math.floor(variantAt(x, z) * n);
  return TREE_VARIANTS[k][VARIANT_ORDER[k]?.[pick] ?? pick];
}

/**
 * THE SILHOUETTE: how wide the crown is at a share `f` of the tree's
 * height, as a share of its crown radius — 0 under the lowest bough (where
 * a skier sees nothing but the trunk) and over the top. What the builder
 * builds, stated once for the lab to ride its eye through.
 */
export function crownAt(v: TreeVariant, f: number): number {
  if (f < v.base || f > v.top) return 0;
  const u = (f - v.base) / Math.max(1e-6, v.top - v.base);
  switch (v.shape.form) {
    case "pine": {
      // A flat crown: widest a third of the way up it, rounded off above
      // and below — or a cone, the younger the pine.
      const flat = Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.85 + 0.12)), 0.6);
      const cone = 1 - u * 0.95;
      const y = v.shape.young;
      return v.width * (flat * (1 - y) + cone * y);
    }
    case "birch":
      // A teardrop, or a dome the rounder the crown.
      return (
        v.width * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)), 0.8 - 0.5 * v.shape.dome)
      );
    default:
      return v.width * Math.pow(Math.max(0, 1 - u * 0.95), v.taper);
  }
}
