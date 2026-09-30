// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ANIMALS IN THE SNOW, AS DATA — one row per animal that lives on the
// ground of the mountain: its size, how it moves, how many go together, where
// it lives, how close an engine can come before it goes, and what its feet
// leave in the snow. The birds' split, on the ground: this says what an
// animal is, `beast-plan.ts` places every group and says where each animal
// is at a moment, `beast-tracks.ts` lays its prints, `beast-shapes.ts`
// builds it and `beasts.ts` draws it.
//
// Presentation only. Nothing here is a solid — a skier that runs through a
// hare has run through nothing, which is why no animal is ever placed on
// the loop — and nothing here draws from the engine's stream.
//
// WHY THESE, and why in this order: it is the rarity ladder
// (`rarity.ts`) read top to bottom. The MOUNTAIN HARE, white for the winter,
// sat in its form under a wood's edge and loping across a meadow — the one
// animal every map has. The RED FOX, trotting a meadow in the dead-straight
// single line of prints a fox leaves, stopping to listen and pounce. The
// REINDEER, a herd at the wood's edge digging for lichen, heads down, that
// lifts and trots off in a body when an engine comes up the valley. The
// MOOSE, a black shape standing in the birch scrub at the wood's edge,
// browsing, that walks off unhurried; winter bulls have shed, so none
// carries antlers. And the LYNX, which most skiers will never see: a grey
// cat crossing a meadow on big soft feet, gone at the first sound.
//
// And the rest of a northern winter, each where it really is: the RED
// SQUIRREL, down out of the spruce to cross a clearing in bounds, its tail
// up over its back; ROE DEER, a few together at a wood's edge, grey-brown
// in their winter coats with the white rump that flashes as they go; a
// WOLF PACK in single file across a meadow, stepping in each other's
// prints, the rarest thing on a alpine map; the WOLVERINE, dark and low,
// loping its heavy lope over the high snow; the ARCTIC FOX, white on white
// on the fell and the alpine; MUSK OXEN, a dark shaggy knot on the open
// plateau that stands its ground longer than anything; and CHAMOIS on the
// alpine's steep faces, dark in winter, gone up the slope at a bound.
//
// EVERY ROW NAMES ITS REGIONS (R21, `regions`), and the placer lays only the
// rows of the map's own. The hare and the fox are everywhere; the reindeer
// is the open country's and the maritime range's, not the high alpine's; the
// moose keeps to the woods and the lynx to the deep alpine forest. Where
// there is no wood for an EDGE, an edge animal lives out in the open.
//
// The look (the coat, the ears, the antlers) belongs to `beast-shapes.ts`.

import type { RegionId } from "@engine";

import type { Band } from "./bird-defs.ts";
import { rarityOf, type Rarity } from "./rarity.ts";

export type BeastId =
  | "hare"
  | "squirrel"
  | "fox"
  | "arcticfox"
  | "roedeer"
  | "reindeer"
  | "chamois"
  | "moose"
  | "wolverine"
  | "lynx"
  | "wolf"
  | "ibex"
  | "elk"
  | "coyote"
  | "sika";

/** How the legs go. A BOUND is the hare's: both hind feet together, both
 * fore feet together. A TROT puts diagonal pairs down together — the fox's.
 * A WALK is the four-beat of anything with hooves, or a cat in no hurry. */
export type Gait = "bound" | "trot" | "walk";

/** Where a group lives. The MEADOW is open powder, well clear of any trunk;
 * the EDGE is a wood's margin, trees close by on one side and open snow on
 * the other — where every browser and grazer in a snowy country is found,
 * because the wood is shelter and the open is where the food is dug for. */
export type BeastHome = "meadow" | "edge";

/** What one footfall leaves: a PRINT this wide (m), this deep in virgin
 * powder (m), set this far either side of the line of travel (m), and in
 * which pattern — a fox's single LINE, a hoofed animal's PAIRS, a hare's
 * BOUND (two long hind prints side by side ahead of the two small fore). */
export type Prints = {
  readonly size: number;
  readonly depth: number;
  readonly gauge: number;
  readonly pattern: "line" | "pairs" | "bound";
};

export type BeastSpec = {
  readonly id: BeastId;
  readonly name: string;
  /** The kinds of snow country it lives in (R21). */
  readonly regions: readonly RegionId[];
  /** Nose to tail root, m, and the height at the shoulder, m. */
  readonly length: number;
  readonly height: number;
  readonly gait: Gait;
  /** How far one whole gait cycle carries it, m. */
  readonly stride: number;
  /** Its unhurried pace along its round, m/s, and its pace in flight. */
  readonly speed: number;
  readonly fleeSpeed: number;
  /** How many go together, and how far apart the members stand, m. */
  readonly herd: Band;
  readonly spread: number;
  readonly home: BeastHome;
  /** The round it walks: the loop's long semi-axis, m. */
  readonly round: Band;
  /** One cycle of standing and moving, s, and the share of it moving. */
  readonly cycle: Band;
  readonly moveShare: number;
  /** Stood still, the head goes DOWN — digging for lichen, browsing, a fox
   * listening for a vole under the snow. */
  readonly grazes: boolean;
  /** How close an ENGINE may come before the group goes, m, and how far
   * it runs, m. A reindeer hears a skier across a valley; a hare sits tight
   * until the last moment. */
  readonly wary: number;
  readonly flee: number;
  /** How far the feet go into the powder, m — the hare floats on its
   * snowshoes, the moose goes in to the knee. */
  readonly sink: number;
  readonly prints: Prints;
  /** GROUPS PER KILOMETRE of loop — how common it is (`rarityOf`). */
  readonly perKm: number;
};

export const BEASTS: readonly BeastSpec[] = [
  {
    id: "hare",
    name: "Mountain hare",
    regions: ["alpine", "fell", "continental", "maritime"],
    length: 0.55,
    height: 0.3,
    gait: "bound",
    stride: 1.3,
    speed: 3,
    fleeSpeed: 11,
    herd: { min: 1, max: 1 },
    spread: 0,
    home: "edge",
    round: { min: 25, max: 60 },
    cycle: { min: 50, max: 120 },
    moveShare: 0.3,
    grazes: false,
    wary: 26,
    flee: 45,
    sink: 0.02,
    prints: { size: 0.08, depth: 0.06, gauge: 0.1, pattern: "bound" },
    perKm: 1.3,
  },
  {
    id: "squirrel",
    name: "Red squirrel",
    regions: ["alpine", "continental", "maritime"],
    length: 0.22,
    height: 0.12,
    gait: "bound",
    stride: 0.5,
    speed: 1.6,
    fleeSpeed: 5,
    herd: { min: 1, max: 1 },
    spread: 0,
    home: "edge",
    round: { min: 10, max: 25 },
    cycle: { min: 30, max: 70 },
    moveShare: 0.45,
    grazes: true,
    wary: 18,
    flee: 20,
    sink: 0.01,
    prints: { size: 0.035, depth: 0.03, gauge: 0.04, pattern: "bound" },
    perKm: 0.9,
  },
  {
    id: "fox",
    name: "Red fox",
    regions: ["alpine", "fell", "continental", "maritime"],
    length: 0.7,
    height: 0.38,
    gait: "trot",
    stride: 0.8,
    speed: 1.8,
    fleeSpeed: 9,
    herd: { min: 1, max: 1 },
    spread: 0,
    home: "meadow",
    round: { min: 50, max: 110 },
    cycle: { min: 50, max: 110 },
    moveShare: 0.75,
    grazes: true,
    wary: 45,
    flee: 60,
    sink: 0.05,
    prints: { size: 0.06, depth: 0.08, gauge: 0.02, pattern: "line" },
    perKm: 0.55,
  },
  {
    id: "arcticfox",
    name: "Arctic fox",
    regions: ["fell"],
    length: 0.6,
    height: 0.3,
    gait: "trot",
    stride: 0.7,
    speed: 1.6,
    fleeSpeed: 8,
    herd: { min: 1, max: 2 },
    spread: 4,
    home: "meadow",
    round: { min: 40, max: 90 },
    cycle: { min: 50, max: 110 },
    moveShare: 0.7,
    grazes: true,
    wary: 40,
    flee: 55,
    sink: 0.04,
    prints: { size: 0.05, depth: 0.06, gauge: 0.02, pattern: "line" },
    perKm: 0.6,
  },
  {
    id: "roedeer",
    name: "Roe deer",
    regions: ["alpine", "maritime"],
    length: 1.1,
    height: 0.72,
    gait: "walk",
    stride: 1.1,
    speed: 0.8,
    fleeSpeed: 9,
    herd: { min: 2, max: 5 },
    spread: 3,
    home: "edge",
    round: { min: 12, max: 30 },
    cycle: { min: 60, max: 120 },
    moveShare: 0.3,
    grazes: true,
    wary: 75,
    flee: 80,
    sink: 0.15,
    prints: { size: 0.05, depth: 0.14, gauge: 0.09, pattern: "pairs" },
    perKm: 0.35,
  },
  {
    id: "reindeer",
    name: "Reindeer",
    regions: ["fell"],
    length: 1.7,
    height: 1.05,
    gait: "walk",
    stride: 1.5,
    speed: 0.7,
    fleeSpeed: 7,
    herd: { min: 4, max: 10 },
    spread: 3.5,
    home: "edge",
    round: { min: 12, max: 30 },
    cycle: { min: 60, max: 120 },
    moveShare: 0.35,
    grazes: true,
    wary: 90,
    flee: 90,
    sink: 0.12,
    prints: { size: 0.11, depth: 0.16, gauge: 0.12, pattern: "pairs" },
    perKm: 0.28,
  },
  {
    id: "chamois",
    name: "Chamois",
    regions: ["alpine"],
    length: 1.1,
    height: 0.78,
    gait: "walk",
    stride: 1,
    speed: 0.7,
    fleeSpeed: 8,
    herd: { min: 3, max: 8 },
    spread: 3,
    home: "edge",
    round: { min: 12, max: 28 },
    cycle: { min: 60, max: 120 },
    moveShare: 0.3,
    grazes: true,
    wary: 90,
    flee: 70,
    sink: 0.1,
    prints: { size: 0.06, depth: 0.1, gauge: 0.09, pattern: "pairs" },
    perKm: 0.4,
  },
  {
    id: "ibex",
    name: "Ibex",
    regions: ["alpine"],
    length: 1.5,
    height: 0.9,
    gait: "walk",
    stride: 1,
    speed: 0.7,
    fleeSpeed: 8,
    herd: { min: 3, max: 8 },
    spread: 3,
    home: "edge",
    round: { min: 12, max: 28 },
    cycle: { min: 60, max: 120 },
    moveShare: 0.3,
    grazes: true,
    wary: 90,
    flee: 70,
    sink: 0.1,
    prints: { size: 0.06, depth: 0.1, gauge: 0.09, pattern: "pairs" },
    perKm: 0.3,
  },
  {
    id: "elk",
    name: "Elk",
    regions: ["continental"],
    length: 2.4,
    height: 1.5,
    gait: "walk",
    stride: 1.5,
    speed: 0.7,
    fleeSpeed: 7,
    herd: { min: 4, max: 12 },
    spread: 3.5,
    home: "edge",
    round: { min: 12, max: 30 },
    cycle: { min: 60, max: 120 },
    moveShare: 0.35,
    grazes: true,
    wary: 90,
    flee: 90,
    sink: 0.12,
    prints: { size: 0.11, depth: 0.16, gauge: 0.12, pattern: "pairs" },
    perKm: 0.35,
  },
  {
    id: "coyote",
    name: "Coyote",
    regions: ["continental"],
    length: 1.0,
    height: 0.58,
    gait: "trot",
    stride: 0.8,
    speed: 1.8,
    fleeSpeed: 9,
    herd: { min: 1, max: 1 },
    spread: 0,
    home: "meadow",
    round: { min: 50, max: 110 },
    cycle: { min: 50, max: 110 },
    moveShare: 0.75,
    grazes: true,
    wary: 45,
    flee: 60,
    sink: 0.05,
    prints: { size: 0.06, depth: 0.08, gauge: 0.02, pattern: "line" },
    perKm: 0.4,
  },
  {
    id: "sika",
    name: "Sika deer",
    regions: ["maritime"],
    length: 1.4,
    height: 0.85,
    gait: "walk",
    stride: 1.1,
    speed: 0.8,
    fleeSpeed: 9,
    herd: { min: 3, max: 9 },
    spread: 3,
    home: "edge",
    round: { min: 12, max: 30 },
    cycle: { min: 60, max: 120 },
    moveShare: 0.3,
    grazes: true,
    wary: 75,
    flee: 80,
    sink: 0.15,
    prints: { size: 0.05, depth: 0.14, gauge: 0.09, pattern: "pairs" },
    perKm: 0.35,
  },
  {
    id: "moose",
    name: "Moose",
    regions: ["fell", "continental"],
    length: 2.6,
    height: 1.85,
    gait: "walk",
    stride: 2.2,
    speed: 0.6,
    fleeSpeed: 5,
    herd: { min: 1, max: 2 },
    spread: 5,
    home: "edge",
    round: { min: 8, max: 20 },
    cycle: { min: 100, max: 200 },
    moveShare: 0.25,
    grazes: true,
    wary: 60,
    flee: 50,
    sink: 0.25,
    prints: { size: 0.14, depth: 0.25, gauge: 0.18, pattern: "pairs" },
    perKm: 0.1,
  },
  {
    id: "lynx",
    name: "Eurasian lynx",
    regions: ["alpine", "fell"],
    length: 1,
    height: 0.6,
    gait: "walk",
    stride: 1,
    speed: 1.1,
    fleeSpeed: 8,
    herd: { min: 1, max: 1 },
    spread: 0,
    home: "edge",
    round: { min: 40, max: 90 },
    cycle: { min: 120, max: 240 },
    moveShare: 0.5,
    grazes: false,
    wary: 70,
    flee: 80,
    sink: 0.05,
    prints: { size: 0.09, depth: 0.07, gauge: 0.03, pattern: "line" },
    perKm: 0.05,
  },
  {
    id: "wolverine",
    name: "Wolverine",
    regions: ["fell", "continental"],
    length: 0.85,
    height: 0.42,
    gait: "bound",
    stride: 1.2,
    speed: 1.6,
    fleeSpeed: 7,
    herd: { min: 1, max: 1 },
    spread: 0,
    home: "meadow",
    round: { min: 60, max: 130 },
    cycle: { min: 90, max: 200 },
    moveShare: 0.7,
    grazes: false,
    wary: 55,
    flee: 70,
    sink: 0.04,
    prints: { size: 0.1, depth: 0.06, gauge: 0.12, pattern: "bound" },
    perKm: 0.04,
  },
  {
    id: "wolf",
    name: "Grey wolf",
    regions: ["continental"],
    length: 1.2,
    height: 0.8,
    gait: "trot",
    stride: 1.4,
    speed: 1.7,
    fleeSpeed: 10,
    herd: { min: 3, max: 6 },
    // Single file: the pack steps in the leader's prints.
    spread: 2,
    home: "meadow",
    round: { min: 60, max: 140 },
    cycle: { min: 120, max: 240 },
    moveShare: 0.7,
    grazes: false,
    wary: 110,
    flee: 110,
    sink: 0.08,
    prints: { size: 0.11, depth: 0.1, gauge: 0.03, pattern: "line" },
    perKm: 0.03,
  },
];

export const BEAST_IDS: readonly BeastId[] = BEASTS.map((b) => b.id);

const BY_ID = new Map<BeastId, BeastSpec>(BEASTS.map((b) => [b.id, b]));

export function beastById(id: BeastId): BeastSpec {
  const spec = BY_ID.get(id);
  if (!spec) throw new Error(`no animal row for "${id}"`);
  return spec;
}

/** How often an animal is met, as a word. */
export function beastRarity(spec: BeastSpec): Rarity {
  return rarityOf(spec.perKm);
}
