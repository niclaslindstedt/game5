// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A RUNNING SNOWMOBILE, AS EIGHT LAYERS THAT NEVER STOP — the free ride's
// mountain sled (`sled.ts`), the sibling sled game's engine voice carried
// over whole for its 850 two-stroke, with the paddles in the snow added.
//
// The engine is not made of events. It is a handful of oscillators and two
// noise sources built once and STEERED — pitch, level, cutoff and drive
// moved every frame on the audio thread (`Synth.layer`). A frame that
// arrives late leaves the engine holding its last note rather than leaving
// a hole.
//
// WHAT A SLED IS MADE OF, in the order the ear finds them:
//
//   MOTOR    the BLOCK, heard through the chassis — the machine's own hum,
//            under everything, at idle and at the limiter alike
//   HUM      the firing note — the one layer whose pitch says the revs, a
//            detuned triangle pair folded through the saturation curve,
//            harder the more work the engine is doing
//   OCTAVE   the same note an octave up, carrying it at idle where 50 Hz is
//            a thing a phone cannot reproduce, fading as the crank climbs
//   RASP     the EXPANSION CHAMBER — the two-stroke's own voice, a driven
//            sawtooth in a band that climbs with the revs: the ring-a-ding
//            everyone on a hill knows a sled by, and the layer that comes up
//            hardest when the engine is on the pipe
//   BASS     a sine an octave under the note: the mass of the machine
//   INTAKE   the airbox under the hood — pink noise in a mid band that opens
//            with the throttle; what a rider hears of their own engine
//   BELT     the DRIVE — the CVT belt and the track's lugs passing the
//            drivers, a thin driven whine whose pitch is the TRACK's speed,
//            not the crank's: the one layer that tells a sled holding its
//            revs while it gathers speed from one spinning in powder
//   CHURN    the PADDLES IN THE SNOW — brown noise in a low band, the belt
//            chewing loose snow and throwing it: loud as the track spins in
//            deep powder, a hush on the groomer
//
// A CVT IS WHY THIS SOUNDS LIKE A SLED AND NOT A CAR. The clutch holds the
// engine near its power peak while the belt walks up the sheaves, so under
// full throttle the NOTE barely moves while the sled runs from rest to
// ninety — and all the acceleration is in the belt's whine climbing under
// it. Off a crest the tread unloads and the crank runs free to the
// limiter: the note climbs, the belt spins up with nothing to push against.
//
// A pure function of the state: `sledTargets` says where every layer should
// be, and the scheduler (`sled-bed.ts`) steers the real ones there — which
// is what lets the audition page drive it from sliders.

import type { LayerSpec, LayerTarget } from "@niclaslindstedt/oss-game-framework/audio/voice";

/** FIRINGS PER REVOLUTION — a TWIN-CYLINDER TWO-STROKE fires every
 * cylinder every revolution: two a revolution, so the note is `rpm / 60 ×
 * 2` — idle (1500) a 50 Hz chug, the limiter (8300) 277 Hz of a small
 * engine screaming. */
export const FIRINGS_PER_REV = 2;

/** THE LUG PITCH the drive whines at, m: every lug of the 3-inch-pitch
 * belt passing the drive sprocket is a pulse. */
export const LUG_PITCH_M = 0.0762;

/** Which harmonic of the lug tone the belt's band sits on. */
const BELT_HARMONIC = 3;

/** The firing note these revs make, Hz. */
export function noteHz(rpm: number): number {
  return (rpm / 60) * FIRINGS_PER_REV;
}

/** The drive's lug tone at this track speed, Hz. */
export function beltHz(treadSpeed: number): number {
  return Math.abs(treadSpeed) / LUG_PITCH_M;
}

/** How far up the band the crank is, 0..1 (a shade over 1 on the limiter). */
export function revOf(rpm: number, idleRpm: number, maxRpm: number): number {
  return Math.min(1.06, Math.max(0, (rpm - idleRpm) / Math.max(1, maxRpm - idleRpm)));
}

/** How low the BASS may go, Hz. */
const BASS_FLOOR_HZ = 44;
/** The band the block hums in, Hz, and how far it opens by the limiter. */
const MOTOR_BAND_HZ = 220;
const MOTOR_BAND_OPENS_HZ = 200;
/** Above this share of the band the pipe starts to sing. */
const PIPE_FROM = 0.35;
/** The track speed at which the belt is as loud as it gets, m/s. */
const BELT_FULL = 30;
/** The slip over the snow at which the churn is as loud as it gets, m/s. */
const CHURN_FULL = 12;

/** HOW LOUD THE MACHINE IS against the rest of the game, a gain on every
 * layer: the sibling sled game's levels are an engine that IS the mix; here
 * it is one machine in a skier's world, and a pinned 850 under the rider's
 * boots has to sit with the helicopter on its skid rather than under the
 * skier's own wind (`make audition ARGS=--meter`). */
const LOUD = 1.6;

/** One snowmobile at one instant — everything the layers need. */
export type SledVoice = {
  rpm: number;
  /** How far up the band the crank is, 0..1. */
  rev: number;
  /** The thumb as the machine has it, 0..1. */
  throttle: number;
  /** How hard the engine is WORKING, 0..1: the throttle with snow under the
   * track to push against — none in the air, where it revs free and thin. */
  load: number;
  /** The track's surface speed, m/s — the belt's pitch. */
  treadSpeed: number;
  /** How much faster the track runs than the snow under it, m/s. */
  slip: number;
  /** How much loose snow the paddles are in, 0..1 (none on the groomer). */
  loose: number;
};

/** What the ear makes of it: the engine and the pipe's gains (the seat and
 * the distance), and how bright, 0..1. */
export type SledMix = { engine: number; exhaust: number; tone: number };

export type SledLayer = "motor" | "hum" | "octave" | "rasp" | "bass" | "intake" | "belt" | "churn";

/** What each layer is BUILT from — decided once. */
export const SLED_LAYERS: Record<SledLayer, LayerSpec> = {
  motor: {
    kind: "tone",
    type: "square",
    detuneCents: 7,
    drive: 1,
    filter: { type: "lowpass", q: 0.8 },
  },
  hum: {
    kind: "tone",
    type: "triangle",
    detuneCents: 12,
    drive: 1,
    filter: { type: "lowpass", q: 0.9 },
  },
  octave: { kind: "tone", type: "triangle", detuneCents: 8, drive: 1 },
  rasp: {
    kind: "tone",
    type: "sawtooth",
    detuneCents: 20,
    drive: 1,
    filter: { type: "bandpass", q: 1.3 },
  },
  bass: { kind: "tone", type: "sine", detuneCents: 5 },
  intake: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.9 } },
  belt: {
    kind: "tone",
    type: "sawtooth",
    detuneCents: 6,
    drive: 1,
    filter: { type: "bandpass", q: 3 },
  },
  churn: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.7 } },
};

/** How fast each layer follows, s. */
export const SLED_GLIDE: Record<SledLayer, number> = {
  motor: 0.05,
  hum: 0.03,
  octave: 0.03,
  rasp: 0.04,
  bass: 0.03,
  intake: 0.08,
  belt: 0.06,
  churn: 0.1,
};

/** Where every layer of the snowmobile should be for `voice`, heard by
 * `mix`. */
export function sledTargets(voice: SledVoice, heard: SledMix): Record<SledLayer, LayerTarget> {
  const mix = { engine: heard.engine * LOUD, exhaust: heard.exhaust * LOUD, tone: heard.tone };
  const rev = Math.min(1, Math.max(0, voice.rev));
  const throttle = Math.min(1, Math.max(0, voice.throttle));
  const load = Math.min(1, Math.max(0, voice.load));
  const hz = noteHz(voice.rpm);
  const pipe = Math.max(0, (rev - PIPE_FROM) / (1 - PIPE_FROM));
  const tread = Math.min(1, Math.abs(voice.treadSpeed) / BELT_FULL);
  const spin = Math.min(1, Math.max(0, voice.slip) / 8);
  const belt = beltHz(voice.treadSpeed);
  const loose = Math.min(1, Math.max(0, voice.loose));
  const churn =
    loose * Math.min(1, (Math.max(0, voice.slip) + 0.3 * Math.abs(voice.treadSpeed)) / CHURN_FULL);
  // An engine shut off says nothing: every level comes down with the crank.
  const alive = Math.min(1, voice.rpm / 600);
  return {
    motor: {
      level: (0.016 + 0.012 * load + 0.006 * rev) * mix.engine * alive,
      hz,
      cutoff: (MOTOR_BAND_HZ + MOTOR_BAND_OPENS_HZ * rev) * (0.7 + 0.3 * mix.tone),
      grit: 0.25 + 0.4 * load,
    },
    hum: {
      level: (0.02 + 0.028 * load + 0.008 * throttle) * mix.engine * alive,
      hz,
      cutoff: (700 + 3000 * rev) * (0.45 + 0.55 * mix.tone),
      grit: 0.3 + 0.5 * load + 0.15 * throttle,
    },
    octave: {
      level: (0.014 - 0.01 * rev) * mix.engine * alive,
      hz: hz * 2,
      grit: 0.3 + 0.2 * load,
    },
    rasp: {
      level: pipe * (0.006 + 0.022 * throttle) * mix.exhaust * alive,
      hz,
      cutoff: (1100 + 2600 * rev) * (0.6 + 0.4 * mix.tone),
      grit: 0.6 + 0.35 * throttle,
    },
    bass: {
      level: (0.018 + 0.016 * load) * mix.engine * alive,
      hz: Math.max(BASS_FLOOR_HZ, hz * 0.5),
    },
    intake: {
      level: (0.003 + 0.011 * throttle) * (0.6 + 0.4 * mix.tone) * mix.engine * alive,
      cutoff: 300 + 520 * rev,
    },
    belt: {
      level: tread * (0.003 + 0.006 * throttle + 0.005 * spin) * mix.exhaust,
      hz: Math.max(20, belt),
      cutoff: Math.max(60, belt * BELT_HARMONIC),
      grit: 0.2 + 0.3 * throttle,
    },
    churn: {
      level: churn * (0.012 + 0.02 * spin) * mix.exhaust,
      cutoff: 260 + 900 * churn,
    },
  };
}

/** A snowmobile out in the world as heard from `distance` m: the inverse of
 * the distance past a few metres, fading to nothing by a few hundred, the
 * air taking its top off. */
export function sledHeard(distance: number): { gain: number; bright: number } {
  const d = Math.max(0, distance);
  const fade = 1 - Math.min(1, Math.max(0, (d - 150) / 250));
  return { gain: (4 / Math.max(4, d)) * fade, bright: 1 / (1 + d / 250) };
}
