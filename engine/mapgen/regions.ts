// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R21 — THE REGIONS: which KIND OF SNOW COUNTRY a mountain stands in, as
// data.
//
// A region is everything about a map that is not the run: how tall the
// mountain stands and how hard its face is folded, how high the woods climb
// and what grows in them, how many lips stand off the piste to be found,
// how far north the mountain lies and when in the winter it is skied, and
// what the wind has done to the snow — a crust scoured over the powder. The
// difference between the regions is stated here, once, as rows the rest of
// the generator reads through `regionOf`. Nothing else in `mapgen/` names a
// region: the terrain asks the row how tall to stand, the forest how high
// to climb, the sun which latitudes to deal from, the surface whether to
// lay a crust.
//
// A REGION IS A KIND OF COUNTRY AND NEVER A PLACE. The rows are written
// from real winter mountains — the tree line of a high range, the rounded
// relief of a northern fell, the wet snow of a coast — but nothing here, or
// anywhere the rows are read, names a range, a country or a valley that
// exists (`tests/region_test.ts` sweeps the tree for it).
//
// EVERY NUMBER IS A MULTIPLE OF THE RULE BOOK'S OWN, so the ALPINE row —
// the country every rule in `rules.ts` was written against, and what a map
// nobody asked a region of is built in — is all ones and lays nothing. A
// multiple of one is exact in floating point and a band scaled by one is
// the same band, so the alpine path through the generator draws the same
// numbers off the same stream in the same order as it would with no region
// table at all; `levelDigest` and the campaign's pinned maps hold it to
// that.

import { LEVEL_RULES as R, type Band } from "./rules.ts";

/** The regions, in the order a card offers them. */
export type RegionId = "alpine" | "fell" | "continental" | "maritime";

/** What a tree is (R14, R21): the drawn shape and nothing the physics reads —
 * a trunk is a trunk to the skier whatever grows on it. The trees of the
 * high and the northern snow countries in winter, twenty of them:
 *
 *   THE CONIFERS — the SPRUCE every wood is mostly made of; the FIR, narrower
 *   and heavier-laden; the PINE, a bare trunk under a flat crown; the LARCH,
 *   a conifer that drops its needles (a grey skeleton in winter); the BLACK
 *   SPRUCE of the bogs and the tundra's edge, a thin spire with a club of
 *   boughs at its top; the STONE PINE of the timberline, a dense rounded
 *   crown down to the snow; the WHITE PINE, its boughs in flat layers; the
 *   LODGEPOLE, a tall straight pole with a small crown; the HEMLOCK, whose
 *   leader nods over; the JUNIPER, a dark column; the DWARF PINE (mountain
 *   pine), sprawling on several stems; and the SNAG, a conifer long dead.
 *   THE BROADLEAVES, bare in winter — the BIRCH, pale and banded; the ASPEN,
 *   tall and grey-green; the ROWAN, its red berries still on it; the ALDER,
 *   dark, along the wet ground; the WILLOW, a thicket of orange twigs; the
 *   BEECH, which keeps its dead copper leaves through the winter; the MAPLE,
 *   a broad dome; and the ASH, grey and sparse-twigged with its keys. */
export type TreeKind =
  | "spruce"
  | "fir"
  | "pine"
  | "larch"
  | "blackspruce"
  | "stonepine"
  | "whitepine"
  | "lodgepole"
  | "hemlock"
  | "juniper"
  | "dwarfpine"
  | "snag"
  | "birch"
  | "aspen"
  | "rowan"
  | "alder"
  | "willow"
  | "beech"
  | "maple"
  | "ash";

/** Every kind, in the order a sheet shows them. */
export const TREE_KINDS: readonly TreeKind[] = [
  "spruce",
  "fir",
  "pine",
  "larch",
  "blackspruce",
  "stonepine",
  "whitepine",
  "lodgepole",
  "hemlock",
  "juniper",
  "dwarfpine",
  "snag",
  "birch",
  "aspen",
  "rowan",
  "alder",
  "willow",
  "beech",
  "maple",
  "ash",
];

export type Region = {
  readonly id: RegionId;
  /** R2, R3 — multipliers on the mountain's own bands: the vertical, the
   * side ridges' height and the summit's crests, the hills, the spurs and
   * gullies, the rollers, the bowls (how many, how wide, how deep) and the
   * headwalls (how many, how much they drop). */
  readonly relief: {
    readonly vertical: number;
    readonly flank: number;
    readonly crests: number;
    readonly hills: number;
    readonly ridges: number;
    readonly rollers: number;
    readonly bowls: { readonly count: number; readonly radius: number; readonly depth: number };
    readonly headwalls: { readonly count: number; readonly drop: number };
  };
  /** R14 — the woods. `density` and `meadow` multiply the rule's (the
   * glade share is held under one); `height` is how much of the rule's
   * height band the tallest trees reach (1 the whole of it, under one a
   * stunted wood — never out of the band). `roster` is what grows, each kind
   * with its share of the trees — DRAWN ONLY, dealt off a hash of where
   * each trunk stands (`treeKindAt`), so a roster moves no trunk and no
   * digest. */
  readonly forest: {
    readonly density: number;
    readonly meadow: number;
    readonly height: number;
    readonly roster: readonly { readonly kind: TreeKind; readonly share: number }[];
  };
  /** R14, R21 — the ALTITUDES, m above the sea: the band the valley floor
   * (the base at the finish) is dealt from, and the band the TREE LINE is
   * dealt from — the research's tree lines by kind of country. */
  readonly altitude: { readonly base: Band; readonly treeLine: Band };
  /** R4 — a multiplier on the count of kickers off the piste (and R22's
   * cliffs). */
  readonly kickers: number;
  /** R15 — the latitudes and the days of the year a map is dealt from. */
  readonly sun: { readonly latitude: Band; readonly dayOfYear: Band };
  /** WIND CRUST (R21): a packed share the wind has pressed into the powder,
   * laid over `cover` of the country in patches `scale` metres across and
   * over every exposed crest besides (`exposed`, 0..1 of the crust a crest
   * a few metres proud of its surroundings carries). `packed` is how much
   * the crust holds a skier up, as a share of the groomer. Null: the powder
   * is untouched. */
  readonly crust: {
    readonly cover: number;
    readonly packed: number;
    readonly scale: number;
    readonly exposed: number;
  } | null;
  /** Frozen water (R21): none on a mountain. Every row is null; the slot
   * is where a frozen tarn in a bowl would be stated if a region ever laid
   * one. */
  readonly river: null;
};

/** Every region's row. */
export const REGIONS: Readonly<Record<RegionId, Region>> = {
  // THE ALPINE: the rules as written. A high range's mountain — the full
  // vertical, spruce and fir low down, larch and stone pine at the
  // timberline and mountain pine mats above them, the tree line a little
  // over half-way up. All ones, nothing laid.
  alpine: {
    id: "alpine",
    relief: {
      vertical: 1,
      flank: 1,
      crests: 1,
      hills: 1,
      ridges: 1,
      rollers: 1,
      bowls: { count: 1, radius: 1, depth: 1 },
      headwalls: { count: 1, drop: 1 },
    },
    forest: {
      density: 1,
      meadow: 1,
      height: 1,
      roster: [
        { kind: "spruce", share: 0.3 },
        { kind: "fir", share: 0.2 },
        { kind: "larch", share: 0.14 },
        { kind: "stonepine", share: 0.12 },
        { kind: "dwarfpine", share: 0.08 },
        { kind: "beech", share: 0.04 },
        { kind: "pine", share: 0.04 },
        { kind: "rowan", share: 0.03 },
        { kind: "maple", share: 0.02 },
        { kind: "snag", share: 0.03 },
      ],
    },
    kickers: 1,
    altitude: { base: { min: 1300, max: 1600 }, treeLine: { min: 1800, max: 2200 } },
    sun: { latitude: R.sun.latitude, dayOfYear: R.sun.dayOfYear },
    crust: null,
    river: null,
  },
  // THE FELL: a northern mountain, low and rounded — half the vertical,
  // softer flanks and gentler spurs, the bowls shallow — with mountain
  // birch at a low tree line and a wind crust scoured over the open tops.
  // Far north, so skied in the late winter when the sun is back.
  fell: {
    id: "fell",
    relief: {
      vertical: 0.55,
      flank: 0.55,
      crests: 0.5,
      hills: 0.8,
      ridges: 0.55,
      rollers: 0.8,
      bowls: { count: 0.8, radius: 1.2, depth: 0.5 },
      headwalls: { count: 0.6, drop: 0.6 },
    },
    forest: {
      density: 0.6,
      meadow: 2,
      height: 0.6,
      roster: [
        { kind: "birch", share: 0.58 },
        { kind: "spruce", share: 0.12 },
        { kind: "pine", share: 0.1 },
        { kind: "willow", share: 0.06 },
        { kind: "rowan", share: 0.04 },
        { kind: "juniper", share: 0.04 },
        { kind: "aspen", share: 0.03 },
        { kind: "snag", share: 0.03 },
      ],
    },
    kickers: 0.8,
    altitude: { base: { min: 350, max: 500 }, treeLine: { min: 600, max: 1000 } },
    sun: { latitude: { min: 60, max: 69 }, dayOfYear: { min: 40, max: 90 } },
    crust: { cover: 0.45, packed: 0.55, scale: 140, exposed: 1 },
    river: null,
  },
  // THE CONTINENTAL: a high, cold, dry range — the biggest vertical, tall
  // flanks, deep bowls and headwalls — where the woods climb three quarters
  // of the way up: lodgepole and aspen low down, spruce and fir to the
  // timberline, white pine above. Light dry snow, a thin crust on the
  // exposed crests only.
  continental: {
    id: "continental",
    relief: {
      vertical: 1.2,
      flank: 1.15,
      crests: 1.2,
      hills: 1.1,
      ridges: 1.3,
      rollers: 1,
      bowls: { count: 1.2, radius: 1.1, depth: 1.4 },
      headwalls: { count: 1.3, drop: 1.2 },
    },
    forest: {
      density: 0.85,
      meadow: 1.2,
      height: 1,
      roster: [
        { kind: "lodgepole", share: 0.22 },
        { kind: "spruce", share: 0.2 },
        { kind: "fir", share: 0.18 },
        { kind: "whitepine", share: 0.12 },
        { kind: "aspen", share: 0.14 },
        { kind: "pine", share: 0.05 },
        { kind: "juniper", share: 0.04 },
        { kind: "snag", share: 0.05 },
      ],
    },
    kickers: 1.2,
    altitude: { base: { min: 2300, max: 2700 }, treeLine: { min: 3000, max: 3500 } },
    sun: { latitude: { min: 39, max: 52 }, dayOfYear: { min: 1, max: 80 } },
    crust: { cover: 0.12, packed: 0.5, scale: 110, exposed: 0.7 },
    river: null,
  },
  // THE MARITIME: a mountain by the sea under deep, heavy snow — a modest
  // vertical, the face rounded under the load, fir and birch rimed to the
  // crown, a tree line a little under the alpine's. No crust: the snow is
  // too wet and too deep to scour.
  maritime: {
    id: "maritime",
    relief: {
      vertical: 0.9,
      flank: 0.9,
      crests: 0.8,
      hills: 1.2,
      ridges: 0.8,
      rollers: 1.1,
      bowls: { count: 1, radius: 1.1, depth: 0.9 },
      headwalls: { count: 0.8, drop: 0.9 },
    },
    forest: {
      density: 1.05,
      meadow: 0.8,
      height: 0.9,
      roster: [
        { kind: "fir", share: 0.38 },
        { kind: "birch", share: 0.26 },
        { kind: "beech", share: 0.1 },
        { kind: "hemlock", share: 0.08 },
        { kind: "spruce", share: 0.06 },
        { kind: "maple", share: 0.04 },
        { kind: "alder", share: 0.04 },
        { kind: "snag", share: 0.04 },
      ],
    },
    kickers: 1,
    altitude: { base: { min: 300, max: 600 }, treeLine: { min: 1400, max: 1600 } },
    sun: { latitude: { min: 36, max: 44 }, dayOfYear: { min: 10, max: 80 } },
    crust: null,
    river: null,
  },
};

/** The regions in the order a card offers them. */
export const REGION_IDS: readonly RegionId[] = ["alpine", "fell", "continental", "maritime"];

/** The region a map nobody asked a region of is built in. */
export const DEFAULT_REGION: RegionId = "alpine";

export function isRegionId(value: unknown): value is RegionId {
  return typeof value === "string" && (REGION_IDS as readonly string[]).includes(value);
}

/** The row for a region id; the alpine's for anything else. */
export function regionRow(id: RegionId | undefined): Region {
  return (id !== undefined && REGIONS[id]) || REGIONS[DEFAULT_REGION];
}

/** The region a map was built in — the alpine for a hand-built map without
 * one. Ask this, never `Level.region`. */
export function regionOf(level: { region?: RegionId }): Region {
  return regionRow(level.region);
}

/** A band scaled by `k`, the SAME object when `k` is one. */
export function scaleBand(band: Band, k: number): Band {
  return k === 1 ? band : { min: band.min * k, max: band.max * k };
}

/** A whole-number band scaled by `k` and rounded, the same object at one. */
export function scaleCount(band: Band, k: number): Band {
  return k === 1
    ? band
    : { min: Math.max(0, Math.round(band.min * k)), max: Math.max(0, Math.round(band.max * k)) };
}

/** WHICH TREE STANDS HERE, off a hash of where it stands — no draw off any
 * stream, so the roster moves nothing the forest draws. */
export function treeKindAt(region: Region, x: number, z: number): TreeKind {
  const roster = region.forest.roster;
  if (roster.length === 1) return roster[0].kind;
  let h = (Math.round(x * 8) * 374761393 + Math.round(z * 8) * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  const u = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  let acc = 0;
  for (const row of roster) {
    acc += row.share;
    if (u < acc) return row.kind;
  }
  return roster[roster.length - 1].kind;
}
