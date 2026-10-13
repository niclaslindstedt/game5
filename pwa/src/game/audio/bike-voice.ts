// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A DOWNHILL BIKE ROLLING, AS SEVEN LAYERS THAT NEVER STOP — the summer
// free ride's bike (`bike.ts`). It has no engine: everything it says is the
// tyres on the ground, the hub, the chain and the brakes.
//
//   ROLL     the TYRES' ROAR — noise in a band set by WHAT IS UNDER THEM:
//            a low hum on tarmac and a street, a soft brush on grass, the
//            dirt's mid rumble, the gravel and the scree's crunch, rock and
//            roots rattling, louder the faster he rolls
//   KNOBS    the tread's knobs slapping the hard ground — a buzz at the rear
//            wheel's knob rate, heard on a hard surface, lost on grass
//   GRIT     the stones the knobs throw and crush — white noise high up,
//            loud on gravel, scree and the rock gardens
//   HUB      THE FREEHUB coasting — the pawls ticking over the ratchet at
//            its points a turn of the wheel, a click train whose rate is the
//            rear wheel's spin; silent while he pedals (the hub is driving)
//   CHAIN    the chain slapping the stay — a rattle as hard as the rear
//            wheel is worked up and down by the ground
//   SKID     a tyre LOCKED or sliding past its grip — the dirt torn, a hiss
//            that comes and goes with the slide
//   SQUEAL   the brakes biting — the rotors' thin whine, heard under a hard
//            pull at a moderate speed
//
// A pure function of the state: `bikeTargets` says where every layer
// should be, and the scheduler (`bike-bed.ts`) steers the real ones there.

import type { SummerKind } from "@engine";
import type { LayerSpec, LayerTarget } from "@niclaslindstedt/oss-game-framework/audio/voice";

/** THE FREEHUB'S ENGAGEMENT, points a turn of the wheel: a ratchet of the
 * fine kind a downhill hub carries, 36–54 across measured hubs; 54 picked. */
export const HUB_POINTS = 54;

/** THE TREAD'S KNOBS round the tyre's centre row. */
export const KNOBS = 28;

/** How a ground sounds under a knobby tyre: the roar's band centre, Hz, how
 * loud it rolls, how much the knobs buzz on it, how much grit it throws and
 * how much it shakes the chain, each 0..1. */
type Ground = { band: number; roll: number; knobs: number; grit: number; rough: number };

const SOFT: Ground = { band: 380, roll: 0.55, knobs: 0.1, grit: 0.05, rough: 0.3 };
const DIRT: Ground = { band: 520, roll: 0.8, knobs: 0.45, grit: 0.25, rough: 0.5 };

/** WHAT EACH SUMMER GROUND SOUNDS LIKE under the tyres. */
export const GROUND_SOUND: Record<SummerKind, Ground> = {
  meadow: SOFT,
  pasture: SOFT,
  piste: SOFT,
  heath: SOFT,
  turf: SOFT,
  scrub: { band: 420, roll: 0.65, knobs: 0.15, grit: 0.12, rough: 0.5 },
  forest: { band: 440, roll: 0.6, knobs: 0.25, grit: 0.08, rough: 0.55 },
  bog: { band: 260, roll: 0.5, knobs: 0, grit: 0, rough: 0.2 },
  dirt: DIRT,
  trail: DIRT,
  flow: { band: 900, roll: 1, knobs: 0.5, grit: 0.7, rough: 0.35 },
  scree: { band: 1200, roll: 1, knobs: 0.4, grit: 1, rough: 0.9 },
  rocks: { band: 700, roll: 0.95, knobs: 0.85, grit: 0.5, rough: 1 },
  roots: { band: 560, roll: 0.8, knobs: 0.7, grit: 0.2, rough: 0.9 },
  rock: { band: 760, roll: 0.9, knobs: 0.9, grit: 0.35, rough: 0.8 },
  road: { band: 300, roll: 0.75, knobs: 1, grit: 0.05, rough: 0.1 },
  street: { band: 300, roll: 0.75, knobs: 1, grit: 0.05, rough: 0.1 },
  snow: { band: 340, roll: 0.5, knobs: 0, grit: 0.15, rough: 0.2 },
  water: { band: 900, roll: 0.7, knobs: 0, grit: 0.6, rough: 0.4 },
};

/** The speed at which the roar is as loud as it gets, m/s. */
const ROLL_FULL = 16;
/** The compression rate that rattles the chain hardest, m/s. */
const SLAP_FULL = 1.2;
/** HOW LOUD THE BIKE IS against the rest of the game: under the rider, a
 * bike is quiet beside a machine; this sits it with the wind he rides in. */
const LOUD = 1.4;

/** One bike at one instant — everything the layers need. */
export type BikeVoice = {
  /** Its speed, m/s. */
  speed: number;
  /** The rear wheel's spin, rad/s. */
  rearSpin: number;
  /** Whether the pedals drive the hub (no ticking). */
  pedalling: boolean;
  /** The ground under the wheels, and how many are on it, 0..1. */
  ground: SummerKind;
  touching: number;
  /** The wheels' travel being worked, m/s — the bigger of the two. */
  rough: number;
  /** How far past their grip the tyres slide, 0..1, and a wheel locked. */
  slide: number;
  locked: boolean;
  /** The brake levers, 0..1, the harder of the two. */
  brake: number;
};

/** What the ear makes of it: the bike's gain (the seat and the distance)
 * and how bright, 0..1. */
export type BikeMix = { bike: number; tone: number };

export type BikeLayer = "roll" | "knobs" | "grit" | "hub" | "chain" | "skid" | "squeal";

/** What each layer is BUILT from — decided once. */
export const BIKE_LAYERS: Record<BikeLayer, LayerSpec> = {
  roll: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.8 } },
  knobs: {
    kind: "tone",
    type: "square",
    detuneCents: 18,
    drive: 1,
    filter: { type: "bandpass", q: 1.6 },
  },
  grit: { kind: "noise", color: "white", filter: { type: "bandpass", q: 1.1 } },
  // A square wave's edges through a highpass are a train of clicks, two a
  // cycle: the ratchet's pawls.
  hub: { kind: "tone", type: "square", detuneCents: 0, filter: { type: "highpass", q: 2 } },
  chain: { kind: "noise", color: "white", filter: { type: "bandpass", q: 2.2 } },
  skid: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 1.4 } },
  squeal: {
    kind: "tone",
    type: "triangle",
    detuneCents: 9,
    filter: { type: "bandpass", q: 6 },
  },
};

/** How fast each layer follows, s. */
export const BIKE_GLIDE: Record<BikeLayer, number> = {
  roll: 0.08,
  knobs: 0.05,
  grit: 0.07,
  hub: 0.04,
  chain: 0.03,
  skid: 0.04,
  squeal: 0.08,
};

/** The freehub's click rate at this rear-wheel spin, Hz. */
export function hubHz(rearSpin: number): number {
  return (Math.abs(rearSpin) / (2 * Math.PI)) * HUB_POINTS;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Where every layer of the bike should be for `voice`, heard by `mix`. */
export function bikeTargets(voice: BikeVoice, heard: BikeMix): Record<BikeLayer, LayerTarget> {
  const gain = heard.bike * LOUD;
  const g = GROUND_SOUND[voice.ground] ?? DIRT;
  const on = clamp01(voice.touching);
  const pace = clamp01(voice.speed / ROLL_FULL);
  const turn = Math.abs(voice.rearSpin) / (2 * Math.PI);
  const shake = clamp01(voice.rough / SLAP_FULL);
  const slide = clamp01(voice.slide) * on;
  const skid = Math.max(slide, voice.locked ? 1 : 0) * on * clamp01(voice.speed / 3);
  // The hub clicks as the wheel turns over the pawls, the slower the louder
  // to the ear (a fast hub is a buzz under the roll).
  const coast = voice.pedalling ? 0 : clamp01(turn / 0.3);
  const hub = hubHz(voice.rearSpin);
  // The rotors whine under a hard pull at a crawl to a trot, not flat out.
  const bite =
    clamp01((voice.brake - 0.35) / 0.5) *
    clamp01(voice.speed / 2) *
    clamp01((14 - voice.speed) / 8);
  const bright = 0.55 + 0.45 * heard.tone;
  return {
    roll: {
      level: on * g.roll * (0.004 + 0.03 * pace) * gain,
      cutoff: g.band * (0.7 + 0.6 * pace) * bright,
    },
    knobs: {
      level: on * g.knobs * pace * 0.012 * gain,
      hz: Math.max(20, turn * KNOBS),
      cutoff: Math.max(120, turn * KNOBS * 3) * bright,
      grit: 0.4,
    },
    grit: {
      level: on * g.grit * pace * (0.012 + 0.012 * shake) * gain,
      cutoff: 2600 * bright,
    },
    hub: {
      level: coast * (0.006 + 0.004 * (1 - pace)) * gain,
      hz: Math.max(2, hub / 2),
      cutoff: 3200 * bright,
    },
    chain: {
      level: shake * (0.004 + g.rough * 0.016) * (pace > 0.05 ? 1 : 0) * gain,
      cutoff: 1900 * bright,
    },
    skid: {
      level: skid * (0.008 + 0.026 * pace) * (0.5 + 0.5 * g.roll) * gain,
      cutoff: (g.band * 1.6 + 400) * bright,
    },
    squeal: {
      level: bite * 0.006 * gain,
      hz: 1720 + 90 * pace,
      cutoff: 1800 * bright,
    },
  };
}

/** A bike out in the world as heard from `distance` m: it is quiet, and gone
 * past a few tens of metres. */
export function bikeHeard(distance: number): { gain: number; bright: number } {
  const d = Math.max(0, distance);
  const fade = 1 - clamp01((d - 25) / 35);
  return { gain: (2 / Math.max(2, d)) * fade, bright: 1 / (1 + d / 60) };
}
