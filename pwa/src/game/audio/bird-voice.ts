// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE BIRDS SAY — the roster's voices as data, and the arithmetic that
// turns a flock into cries: which sound each species makes, how often a bird
// of it calls in the air and at rest, how far off it can be heard, and the
// one deterministic draw that decides whether a flock cried in a given
// quarter second.
//
// DOM-free and plan-free. Nothing here knows where a flock is or reads a
// state; `bird-bed.ts` asks this module the questions and does the reading,
// and the audition page and the tests hold the whole table without a map.
// The bank ids named here are `bird-bank.ts`'s, and `tests/birds_test.ts`
// holds every one of them to `RUN_BANK`.
//
// THE CRIES ARE A HASH, NOT A DIE. Whether a flock cries in a slot is
// `hash2` of the slot's index and the flock's own scatter, so a seed cries
// the same cries on every ride, a replay cries them again, and nothing here
// touches `state.rng`, which the engine keeps for the engine.

import { hash2 } from "@engine";

import type { BirdId } from "../bird-defs.ts";
import { SCREEN_TO_ENGINE } from "../input-model.ts";

/** One species' voice. */
export type BirdCall = {
  /** The bank id of its cry. */
  readonly sound: string;
  /** Calls per bird per minute in the air, and at rest. */
  readonly airborne: number;
  readonly perched: number;
  /** The distance the cry is heard at its authored level inside, m, and
   * the distance past which it is not heard at all. A raven's croak rolls
   * across a valley; a crossbill's chip is a thing heard under the tree. */
  readonly ref: number;
  readonly reach: number;
  /** What the flock sounds like getting up, if it makes a sound of its own
   * doing it — a grouse's whirr of wings, the one sound a skier CAUSES. */
  readonly flush?: string;
};

/** The roster's voices, or null for a bird that keeps quiet: the golden
 * eagle, whose silence over the ridge is the character of it. The rates
 * are a winter wood's, not a spring morning's: the raven is the voice of
 * the place, the crossbills a chatter in the tops, the grouse mute until
 * they go, and the skeins calling to hold their line. */
export const BIRD_CALLS: Readonly<Record<BirdId, BirdCall | null>> = {
  raven: { sound: "raven_croak", airborne: 3, perched: 1, ref: 45, reach: 420 },
  ptarmigan: {
    sound: "ptarmigan_rattle",
    airborne: 5,
    perched: 0.1,
    ref: 24,
    reach: 200,
    flush: "grouse_whirr",
  },
  capercaillie: {
    sound: "capercaillie_knock",
    airborne: 0.5,
    perched: 0.3,
    ref: 20,
    reach: 150,
    flush: "grouse_whirr",
  },
  // The smaller forest grouse: near silent in winter, the whirr as it goes.
  blackgrouse: {
    sound: "capercaillie_knock",
    airborne: 0.4,
    perched: 0.1,
    ref: 18,
    reach: 130,
    flush: "grouse_whirr",
  },
  crossbill: { sound: "crossbill_chip", airborne: 10, perched: 5, ref: 14, reach: 110 },
  // The chough's ringing whistle, the one cry every skier knows; the
  // nutcracker's harsh rasp from the stone pines; the jay near silent.
  chough: { sound: "chough_whistle", airborne: 8, perched: 2, ref: 40, reach: 380 },
  nutcracker: { sound: "raven_croak", airborne: 2, perched: 1.5, ref: 20, reach: 160 },
  jay: { sound: "crossbill_chip", airborne: 1, perched: 0.5, ref: 14, reach: 90 },
  // A twittering whirl over the snow.
  bunting: { sound: "crossbill_chip", airborne: 12, perched: 2, ref: 14, reach: 100 },
  // The woodpecker's drum and the owl's hoot are spring's; a winter wood
  // hears neither.
  woodpecker: null,
  owl: null,
  eagle: null,
  swan: { sound: "swan_whoop", airborne: 4, perched: 1, ref: 70, reach: 650 },
  goose: { sound: "goose_honk", airborne: 8, perched: 1, ref: 60, reach: 560 },
};

/** The slot the draw is made per, s. A flock cries at most once a slot. */
export const CRY_SLOT = 0.25;

/** The most a slot may be asked to cry, as the chance it does. */
const MOST_PER_SLOT = 0.6;

/** How many cries a flush lets off, over how long, s, and how much louder
 * than an ordinary cry each is: birds going up shout. */
export const FLUSH_CRIES = { count: 3, spread: 1.4, gain: 1.4 };

/** How much a resting flock quietens in the dark. */
const NIGHT_FLOOR = 0.15;

/** One cry the draw dealt: its second, and a 0..1 for the voice to vary its
 * pitch and its level by. */
export type Cry = { at: number; vary: number };

/**
 * The cries a flock of `count` birds, each calling `rate` times a minute,
 * lets off between `t0` and `t1` (engine seconds, `t0` exclusive), to
 * `visit`. A pure function of the slots and the flock's `scatter`. Returns
 * how many.
 */
export function criesIn(
  scatter: number,
  count: number,
  rate: number,
  t0: number,
  t1: number,
  visit: (cry: Cry) => void,
): number {
  if (!(t1 > t0) || rate <= 0 || count <= 0) return 0;
  const lambda = (count * rate * CRY_SLOT) / 60;
  const p = Math.min(MOST_PER_SLOT, 1 - Math.exp(-lambda));
  const from = Math.floor(t0 / CRY_SLOT) + 1;
  const to = Math.floor(t1 / CRY_SLOT);
  let n = 0;
  for (let k = from; k <= to; k++) {
    if (hash2(k, 1, scatter) >= p) continue;
    n++;
    visit({ at: k * CRY_SLOT, vary: hash2(k, 2, scatter) });
  }
  return n;
}

/** The rate a flock calls at when `air` of it is flying and the day is
 * `activity` bright. */
export function callRate(call: BirdCall, air: number, activity: number): number {
  const roost = call.perched * (NIGHT_FLOOR + (1 - NIGHT_FLOOR) * activity);
  return roost + (call.airborne - roost) * air;
}

/**
 * How loud a cry `distance` metres off is, 0..1: at its authored level
 * inside `ref`, falling on the inverse square past it, and faded to nothing
 * over the last third of `reach`.
 */
export function heardAt(distance: number, call: Pick<BirdCall, "ref" | "reach">): number {
  if (distance >= call.reach) return 0;
  const square = distance <= call.ref ? 1 : (call.ref / distance) ** 2;
  const edge = (call.reach - distance) / (call.reach / 3);
  const fade = edge >= 1 ? 1 : edge * edge * (3 - 2 * edge);
  return square * fade;
}

/** Where a cry sits between the ears, -1..1, for a source at `bearing`
 * heard by a skier on `heading` — through the one screen flip the input
 * model owns. */
export function cryPan(bearing: number, heading: number): number {
  return Math.sin(bearing - heading) * SCREEN_TO_ENGINE;
}

/** The pitch a cry with `vary` is played at: many throats, not one. */
export function cryPitch(vary: number): number {
  return 0.93 + vary * 0.14;
}
