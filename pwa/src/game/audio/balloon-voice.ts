// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOT AIR BALLOON, AS SIX LAYERS THAT NEVER STOP — the free ride's
// balloon (`balloon.ts`) heard from the skier in its basket or, once he has
// jumped, from wherever he is as it flies on.
//
// A balloon in the air is the quietest flying thing there is: it drifts
// WITH the wind, so no air rushes past the basket, and the pilot hears dogs
// and voices from hundreds of metres below — until the burner fires. Then
// it is the loudest: a jet of vaporised propane burning a couple of metres
// over his head, a broadband ROAR with a deep rumble in it, loud enough to
// stop a conversation in the basket. In the order the ear finds them:
//
//   ROAR     the flame — pink noise in a wide band a few hundred hertz up,
//            opening with the flame as it comes on, the jet's body;
//   RUMBLE   the combustion's low end — brown noise under 200 Hz, heaving a
//            little as the flame tears into tongues;
//   JET      the gas leaving the coil's jets at speed — a white hiss high
//            up, the first thing on and the last thing off (the tail of a
//            burn hisses as the coil empties);
//   PILOT    the pilot light: a small, steady hiss between burns, the one
//            sound a balloon in the air always makes;
//   VENT     the parachute valve pulled: the hot air spilling out of the
//            crown twenty metres up, a soft rushing breath;
//   FIRE     the envelope alight: a deep, heaving roar of burning cloth over
//            a flicker, the crackle (`crackleAt`) raised over it as cues.
//
// The BLAST VALVE opening is a one-shot (`balloon_valve`: the lever's clack
// and the WHOOMP of the gas lighting), closing another (`balloon_shut`);
// the bed raises them off the valve's own edges (`balloon-bed.ts`).
//
// DISTANCE: every level here is the level in the basket, the burner 2.4 m
// over his boots; out of the basket the ear falls off with the helicopter's
// law (`heliHeard`), the air taking the top off first. A pure function of
// a `BalloonVoice`, so the audition page drives it from sliders.

import type { LayerSpec, LayerTarget } from "@niclaslindstedt/oss-game-framework/audio/voice";

import { heliHeard } from "./heli-voice.ts";

/** One balloon against the ear at one instant. */
export type BalloonVoice = {
  /** The flame, 0 out … 1 full blast (the engine's `flame`, after its lag). */
  flame: number;
  /** The pilot light lit, 0..1. */
  pilot: number;
  /** The parachute valve's opening, 0..1, and how much hotter the envelope
   * is than the air it spills into, 0..1 of a hot envelope's 100 K. */
  vent: number;
  heat: number;
  /** The envelope ablaze, 0..1. */
  fire: number;
  /** From the ear to the burner, m. */
  distance: number;
  /** The engine's clock, s — the flame and the fire heave on beats of it. */
  t: number;
};

/** What the seat does to it — the listener's `machine` column. */
export type BalloonMix = { machine: number };

export type BalloonLayer = "roar" | "rumble" | "jet" | "pilot" | "vent" | "fire";

/** What each layer is BUILT from — decided once. */
export const BALLOON_LAYERS: Record<BalloonLayer, LayerSpec> = {
  roar: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.55 } },
  rumble: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.8 } },
  jet: { kind: "noise", color: "white", filter: { type: "highpass", q: 0.7 } },
  pilot: { kind: "noise", color: "white", filter: { type: "bandpass", q: 1.6 } },
  vent: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.7 } },
  fire: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.8 } },
};

/** How fast each layer follows, s: the flame's on the engine's own lag (a
 * quarter of a second) and quicker, so a burn's onset and tail are heard
 * as the flame does them; the vent and the fire on long ones. */
export const BALLOON_GLIDE: Record<BalloonLayer, number> = {
  roar: 0.05,
  rumble: 0.07,
  jet: 0.03,
  pilot: 0.2,
  vent: 0.35,
  fire: 0.25,
};

/** The ear in the basket against the burner, m — the reference every
 * level is set at; nothing is louder nearer. */
export const BALLOON_REF = 2.4;

/** Where every layer should be for `voice`, through the seat's machine. */
export function balloonTargets(
  voice: BalloonVoice,
  mix: BalloonMix,
): Record<BalloonLayer, LayerTarget> {
  const air = heliHeard(Math.max(0, voice.distance - BALLOON_REF) * 2.5);
  const g = air.gain * mix.machine;
  const flame = Math.min(1, Math.max(0, voice.flame));
  const fire = Math.min(1, Math.max(0, voice.fire));
  const vent = Math.min(1, Math.max(0, voice.vent)) * Math.min(1, Math.max(0, voice.heat));
  // The flame's two beats, a little apart, so the roar never pulses.
  const tear = 0.5 + 0.3 * Math.sin(voice.t * 9.3) + 0.2 * Math.sin(voice.t * 15.7 + 1.1);
  const heave = 0.5 + 0.3 * Math.sin(voice.t * 1.9) + 0.2 * Math.sin(voice.t * 4.1 + 0.7);
  // The jet hisses ahead of the flame and after it: the square root.
  const gas = Math.sqrt(flame);
  return {
    roar: {
      level: g * flame * (0.072 + 0.012 * tear),
      cutoff: (380 + 520 * flame + 120 * tear) * air.bright,
    },
    rumble: {
      level: g * flame * (0.112 + 0.028 * tear),
      cutoff: 120 + 70 * flame,
    },
    jet: {
      level: g * air.high * gas * 0.018,
      cutoff: 3600 * Math.max(0.4, air.bright),
    },
    pilot: {
      level: g * air.high * Math.min(1, Math.max(0, voice.pilot)) * (1 - flame) * 0.014,
      cutoff: 4800 * Math.max(0.5, air.bright),
    },
    vent: {
      level: g * vent * 0.03,
      cutoff: (900 + 500 * vent) * air.bright,
    },
    fire: {
      level: g * fire * (0.042 + 0.02 * heave),
      cutoff: 240 + 260 * heave + 300 * fire,
    },
  };
}
