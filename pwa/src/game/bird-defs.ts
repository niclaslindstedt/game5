// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIRDS OF THE SNOW COUNTRY, AS DATA — one row per bird that lives in
// the mountain or crosses it: what it is, how it flies, where it sits, how many
// travel together and how often a loop carries a flock of them. This says
// what a bird is; `bird-roost.ts` places every flock, `bird-plan.ts` says
// where each bird is at a moment, `bird-shapes.ts` builds it and `birds.ts`
// draws it. The ground's animals are the same split next door
// (`beast-defs.ts`).
//
// Renderer-side, and nothing here is a solid. A skier rides under a raven
// and through a covey of ptarmigan that bursts off the snow ahead of it, and
// nothing in the engine has heard of either. Every flock is laid off the
// map's seed on the renderer's OWN generator and posed off the engine's OWN
// clock, so a seed flies the same birds every time without costing the run
// a single draw from its stream.
//
// WHY THESE SEVEN. A winter wood is a quiet place, and what is in it is
// what can live through a winter. The RAVEN is the voice of it — a pair
// over every wood, croaking, rolling on the wind, in the crown of the
// tallest spruce between flights. The WILLOW PTARMIGAN is the snow's own
// bird, white on white and invisible until the skier is on it, when the
// covey bursts up in a whirr and a rattle and planes off low on bowed
// wings: the one bird here the skier CAUSES. The CAPERCAILLIE is the wood's
// big black grouse, sat in a pine crown feeding on needles, and it crashes
// out of it the same way — rare, and the biggest thing that flushes. The
// CROSSBILL is the spruce tops' — a chattering party working the cones,
// bounding from one crown to the next. The GOLDEN EAGLE is one bird, high
// over the ridge on a shallow V, and it hardly ever beats. And two things
// CROSS, because the winter this game dealt runs into March: the WHOOPER
// SWAN in lines and the BEAN GOOSE in vees, going north over the mountain from
// the start of the thaw — the one thing in this sky that says which way
// the year is going.
//
// Four more make the wood less empty. The BLACK GROUSE, the capercaillie's
// smaller cousin with the lyre tail, sits in the birch tops at a wood's edge
// and bursts off the snow in a whirr like the rest of the grouse. The GREAT
// GREY OWL hunts the edge of a meadow in daylight, low and slow on its
// huge round wings from one perch to the next. The BLACK WOODPECKER, crow-
// sized and black with a red cap, bounds between the pines. And SNOW
// BUNTINGS, a whirl of white and black over the open snow, put up by a
// skier in a flock that flickers off and settles again further on.
//
// EVERY ROW NAMES ITS REGIONS (R21, `regions`), and the placer lays only the
// rows of the map's own (`regionOf`). The alpine forest carries the whole
// roster; the treeless high country keeps the raven, the ptarmigan and the
// eagle and loses what lives in the spruce; the fell plateau keeps the
// raven and the ptarmigan; the maritime range is the alpine wood without the
// crossbill, whose cones are the spruce's.
//
// The look (the paint, the wingtips, the bill) belongs to `bird-shapes.ts`.

import type { RegionId } from "@engine";

import type { Rarity } from "./rarity.ts";
import { rarityOf } from "./rarity.ts";

/** Every bird in the roster. */
export type BirdId =
  | "raven"
  | "ptarmigan"
  | "blackgrouse"
  | "capercaillie"
  | "crossbill"
  | "bunting"
  | "woodpecker"
  | "owl"
  | "eagle"
  | "swan"
  | "goose"
  | "chough"
  | "nutcracker"
  | "jay";

export type Band = { readonly min: number; readonly max: number };

/** Where a flock lives between flights. `tree` is the crown of one of the
 * wood's tall spruce; `snow` is a burrow in a meadow's powder, where a
 * covey sits out the cold; `crag` is the bare rock high on the ridge. */
export type Home = "tree" | "snow" | "crag";

/** How a flock stands in the air. `loose` is a crowd — a covey, a party of
 * finches; `line` is a trailing echelon; `vee` is the migrating skein. */
export type Formation = "loose" | "line" | "vee";

/** How a bird crosses the sky when it is CROSSING rather than living here:
 * the height band it holds over the ground, how many make one passage and
 * the shapes they take, its weight among the crossers, and the DAYS of the
 * year it is on the move — the thaw's, by the day of the year the map is
 * ridden on. */
export type Passage = {
  readonly height: Band;
  readonly birds: Band;
  readonly shapes: readonly Formation[];
  readonly share: number;
  readonly days: Band;
};

export type BirdSpec = {
  readonly id: BirdId;
  /** The name a sheet or a plan shows. */
  readonly name: string;
  /** The kinds of snow country it lives in or crosses (R21). */
  readonly regions: readonly RegionId[];
  /** Wingtip to wingtip, m, and bill to tail, m — the real ones. */
  readonly span: number;
  readonly length: number;
  /** How far ahead of the SHOULDERS the bill reaches, as a share of the
   * length: a swan's neck is as long as its back, a grouse's a third. */
  readonly neck: number;
  /** The wing: its chord at the root as a share of the span, how much of
   * that is left at the tip, how far back the tip is swept as a share of
   * the half-span, and where the WRIST is along the half-span. A grouse's
   * wing is short, broad and round; an eagle's a long plank. */
  readonly wing: {
    readonly chord: number;
    readonly taper: number;
    readonly sweep: number;
    readonly wrist: number;
  };
  /** The beat: strokes a second, and how far a stroke swings the wing off
   * level, rad. */
  readonly beatHz: number;
  readonly stroke: number;
  /** How much of a flight is spent on HELD wings, 0..1. */
  readonly glide: number;
  /** The dihedral held in a glide, rad — an eagle soars on a V; a grouse
   * planes on BOWED wings, which is a negative one. */
  readonly dihedral: number;
  /** Cruising airspeed, m/s. */
  readonly speed: number;
  /** How many travel in one flock. */
  readonly flock: Band;
  readonly formation: Formation;
  /** How high a flight holds over the highest ground under its loop, m. */
  readonly altitude: Band;
  /** The loop a flight wheels round: its long semi-axis, m. */
  readonly beat: Band;
  /** Where the flock lives, and how far round that point it spreads, m.
   * Absent for a bird that only ever crosses. */
  readonly home?: Home;
  readonly roost: number;
  /** ONE CYCLE of rest and flight, s, and how much of it is flight at the
   * height of the day. */
  readonly cycle: Band;
  readonly airShare: number;
  /** Gets up when a skier comes close (`flushAt`): the grouse, which sit
   * tight until the last moment and then go all at once. */
  readonly flushes: boolean;
  /** FLOCKS PER KILOMETRE of loop — how common the bird is (`rarityOf`).
   * 0 for a bird that only passes over. */
  readonly perKm: number;
  /** …and the days it CROSSES, with how. */
  readonly passage?: Passage;
};

export const BIRDS: readonly BirdSpec[] = [
  {
    id: "raven",
    name: "Common raven",
    regions: ["alpine", "fell", "continental", "maritime"],
    span: 1.3,
    length: 0.64,
    // The heavy bill and the wedge tail: from below a raven is a cross
    // with a diamond on the end of it.
    neck: 0.34,
    wing: { chord: 0.17, taper: 0.45, sweep: 0.12, wrist: 0.45 },
    beatHz: 3,
    stroke: 0.7,
    glide: 0.45,
    dihedral: 0.06,
    speed: 11,
    flock: { min: 1, max: 3 },
    formation: "loose",
    altitude: { min: 18, max: 60 },
    beat: { min: 60, max: 160 },
    home: "tree",
    roost: 3,
    cycle: { min: 90, max: 200 },
    airShare: 0.5,
    flushes: false,
    // A pair over every wood, and one is usually up.
    perKm: 0.9,
  },
  {
    id: "ptarmigan",
    name: "Ptarmigan",
    regions: ["alpine", "fell", "continental"],
    span: 0.62,
    length: 0.39,
    neck: 0.3,
    // Short, broad and round: a wing built to get up NOW.
    wing: { chord: 0.21, taper: 0.62, sweep: 0.06, wrist: 0.5 },
    beatHz: 11,
    stroke: 0.9,
    glide: 0.35,
    dihedral: -0.06,
    speed: 13,
    flock: { min: 4, max: 12 },
    formation: "loose",
    // A covey that flies does so low, over the snow it came off.
    altitude: { min: 2, max: 8 },
    beat: { min: 40, max: 90 },
    home: "snow",
    roost: 5,
    cycle: { min: 240, max: 420 },
    // A thing on the snow that occasionally isn't — until a skier comes.
    airShare: 0.05,
    flushes: true,
    perKm: 1.4,
  },
  {
    id: "blackgrouse",
    name: "Grouse",
    regions: ["fell", "continental"],
    span: 0.8,
    length: 0.55,
    neck: 0.3,
    wing: { chord: 0.21, taper: 0.6, sweep: 0.06, wrist: 0.5 },
    beatHz: 8,
    stroke: 0.85,
    glide: 0.4,
    dihedral: -0.05,
    speed: 14,
    flock: { min: 2, max: 6 },
    formation: "loose",
    altitude: { min: 3, max: 12 },
    beat: { min: 50, max: 100 },
    home: "tree",
    roost: 4,
    cycle: { min: 240, max: 480 },
    airShare: 0.05,
    flushes: true,
    perKm: 0.45,
  },
  {
    id: "capercaillie",
    name: "Capercaillie",
    regions: ["fell"],
    span: 1.2,
    length: 0.86,
    neck: 0.3,
    wing: { chord: 0.22, taper: 0.62, sweep: 0.05, wrist: 0.5 },
    beatHz: 6,
    stroke: 0.8,
    glide: 0.35,
    dihedral: -0.04,
    speed: 14,
    flock: { min: 1, max: 2 },
    formation: "loose",
    altitude: { min: 4, max: 14 },
    beat: { min: 50, max: 110 },
    home: "tree",
    roost: 1.5,
    cycle: { min: 300, max: 600 },
    airShare: 0.04,
    flushes: true,
    // The wood's big grouse, and a bird most rides never see.
    perKm: 0.12,
  },
  {
    id: "crossbill",
    name: "Crossbill",
    regions: ["alpine", "continental"],
    span: 0.29,
    length: 0.165,
    neck: 0.3,
    wing: { chord: 0.17, taper: 0.45, sweep: 0.2, wrist: 0.42 },
    beatHz: 14,
    stroke: 1,
    glide: 0.15,
    dihedral: 0.02,
    speed: 9,
    flock: { min: 6, max: 16 },
    formation: "loose",
    // Bounding along just over the spruce tops.
    altitude: { min: 22, max: 34 },
    beat: { min: 30, max: 70 },
    home: "tree",
    roost: 3,
    cycle: { min: 40, max: 90 },
    airShare: 0.3,
    flushes: false,
    perKm: 1.6,
  },
  {
    id: "chough",
    name: "Alpine chough",
    regions: ["alpine"],
    span: 0.8,
    length: 0.38,
    // The one bird every skier sees: a flock wheeling and tumbling round
    // the crags and the huts, a square tail and broad fingered wings.
    neck: 0.34,
    wing: { chord: 0.17, taper: 0.45, sweep: 0.12, wrist: 0.45 },
    beatHz: 4.5,
    stroke: 0.7,
    glide: 0.55,
    dihedral: 0.06,
    speed: 12,
    flock: { min: 6, max: 20 },
    formation: "loose",
    altitude: { min: 25, max: 90 },
    beat: { min: 60, max: 160 },
    home: "crag",
    roost: 3,
    cycle: { min: 90, max: 200 },
    airShare: 0.5,
    flushes: false,
    // A flock over every crag, and it is usually up.
    perKm: 1.2,
  },
  {
    id: "nutcracker",
    name: "Nutcracker",
    regions: ["alpine", "continental"],
    span: 0.55,
    length: 0.33,
    neck: 0.3,
    wing: { chord: 0.17, taper: 0.45, sweep: 0.2, wrist: 0.42 },
    beatHz: 6,
    stroke: 1,
    glide: 0.15,
    dihedral: 0.02,
    speed: 10,
    flock: { min: 1, max: 3 },
    formation: "loose",
    // A crow of the stone pines, flapping heavily from crown to crown.
    altitude: { min: 22, max: 34 },
    beat: { min: 30, max: 70 },
    home: "tree",
    roost: 3,
    cycle: { min: 40, max: 90 },
    airShare: 0.3,
    flushes: false,
    perKm: 0.7,
  },
  {
    id: "jay",
    name: "Grey jay",
    regions: ["continental", "maritime"],
    span: 0.45,
    length: 0.29,
    neck: 0.3,
    wing: { chord: 0.17, taper: 0.45, sweep: 0.2, wrist: 0.42 },
    beatHz: 5,
    stroke: 1,
    glide: 0.4,
    dihedral: 0.02,
    speed: 8,
    flock: { min: 2, max: 4 },
    formation: "loose",
    // Gliding on set wings from one fir to the next, tame round any hut.
    altitude: { min: 22, max: 34 },
    beat: { min: 30, max: 70 },
    home: "tree",
    roost: 3,
    cycle: { min: 40, max: 90 },
    airShare: 0.3,
    flushes: false,
    perKm: 0.9,
  },
  {
    id: "bunting",
    name: "Snow bunting",
    regions: ["fell", "alpine"],
    span: 0.33,
    length: 0.17,
    neck: 0.3,
    wing: { chord: 0.17, taper: 0.45, sweep: 0.18, wrist: 0.42 },
    beatHz: 15,
    stroke: 1,
    glide: 0.2,
    dihedral: 0.02,
    speed: 10,
    flock: { min: 12, max: 30 },
    formation: "loose",
    // A whirl low over the open snow.
    altitude: { min: 1.5, max: 6 },
    beat: { min: 30, max: 70 },
    home: "snow",
    roost: 6,
    cycle: { min: 60, max: 150 },
    airShare: 0.2,
    flushes: true,
    perKm: 0.7,
  },
  {
    id: "woodpecker",
    name: "Black woodpecker",
    regions: ["alpine", "maritime"],
    span: 0.7,
    length: 0.46,
    neck: 0.32,
    wing: { chord: 0.2, taper: 0.55, sweep: 0.08, wrist: 0.46 },
    beatHz: 6,
    stroke: 0.9,
    // The bounding flight: a burst of beats, wings shut, a burst.
    glide: 0.45,
    dihedral: 0,
    speed: 11,
    flock: { min: 1, max: 1 },
    formation: "loose",
    altitude: { min: 8, max: 20 },
    beat: { min: 40, max: 110 },
    home: "tree",
    roost: 1,
    cycle: { min: 90, max: 200 },
    airShare: 0.25,
    flushes: false,
    perKm: 0.3,
  },
  {
    id: "owl",
    name: "Great grey owl",
    regions: ["continental", "fell"],
    span: 1.45,
    length: 0.68,
    // A big round head and next to no neck.
    neck: 0.18,
    wing: { chord: 0.25, taper: 0.72, sweep: 0.03, wrist: 0.5 },
    beatHz: 2.4,
    stroke: 0.6,
    glide: 0.55,
    dihedral: 0.03,
    speed: 7,
    flock: { min: 1, max: 1 },
    formation: "loose",
    // Low over a meadow's edge, perch to perch.
    altitude: { min: 3, max: 9 },
    beat: { min: 30, max: 70 },
    home: "tree",
    roost: 1,
    cycle: { min: 200, max: 400 },
    airShare: 0.2,
    flushes: false,
    perKm: 0.08,
  },
  {
    id: "eagle",
    name: "Golden eagle",
    regions: ["alpine", "fell", "continental", "maritime"],
    span: 2.1,
    length: 0.9,
    neck: 0.28,
    // A long broad plank with the fingers spread at the tip.
    wing: { chord: 0.2, taper: 0.58, sweep: 0.06, wrist: 0.48 },
    beatHz: 2.2,
    stroke: 0.5,
    glide: 0.92,
    dihedral: 0.12,
    speed: 13,
    flock: { min: 1, max: 1 },
    formation: "loose",
    altitude: { min: 60, max: 140 },
    beat: { min: 160, max: 320 },
    home: "crag",
    roost: 1,
    cycle: { min: 300, max: 600 },
    airShare: 0.75,
    flushes: false,
    // One over the ridge on a map in three or so.
    perKm: 0.25,
  },
  {
    id: "swan",
    name: "Whooper swan",
    regions: ["maritime", "fell"],
    span: 2.4,
    length: 1.5,
    // The neck as long as the back: the whole silhouette.
    neck: 0.62,
    wing: { chord: 0.16, taper: 0.45, sweep: 0.12, wrist: 0.46 },
    beatHz: 2.1,
    stroke: 0.7,
    glide: 0.08,
    dihedral: 0.05,
    speed: 16,
    flock: { min: 4, max: 9 },
    formation: "line",
    altitude: { min: 80, max: 140 },
    beat: { min: 100, max: 200 },
    roost: 0,
    cycle: { min: 200, max: 400 },
    airShare: 0,
    flushes: false,
    perKm: 0,
    passage: {
      height: { min: 70, max: 130 },
      birds: { min: 4, max: 9 },
      shapes: ["line"],
      share: 1,
      // From the first days of March, north with the thaw.
      days: { min: 60, max: 120 },
    },
  },
  {
    id: "goose",
    name: "Bean goose",
    regions: ["fell", "continental"],
    span: 1.6,
    length: 0.8,
    neck: 0.45,
    wing: { chord: 0.17, taper: 0.45, sweep: 0.14, wrist: 0.44 },
    beatHz: 3,
    stroke: 0.65,
    glide: 0.1,
    dihedral: 0.04,
    speed: 17,
    flock: { min: 8, max: 15 },
    formation: "vee",
    altitude: { min: 100, max: 180 },
    beat: { min: 100, max: 200 },
    roost: 0,
    cycle: { min: 200, max: 400 },
    airShare: 0,
    flushes: false,
    perKm: 0,
    passage: {
      height: { min: 90, max: 170 },
      birds: { min: 8, max: 15 },
      shapes: ["vee", "line"],
      share: 2,
      days: { min: 68, max: 120 },
    },
  },
];

export const BIRD_IDS: readonly BirdId[] = BIRDS.map((b) => b.id);

const BY_ID = new Map<BirdId, BirdSpec>(BIRDS.map((b) => [b.id, b]));

export function birdById(id: BirdId): BirdSpec {
  const spec = BY_ID.get(id);
  if (!spec) throw new Error(`no bird row for "${id}"`);
  return spec;
}

export function isBirdId(id: string): id is BirdId {
  return BY_ID.has(id as BirdId);
}

/** How often a resident bird is met, as a word; null for one that only
 * crosses. */
export function birdRarity(spec: BirdSpec): Rarity | null {
  return spec.home ? rarityOf(spec.perKm) : null;
}
