// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE, HEARD — the free ride's single turboprop (`plane.ts`) as
// sixteen layers, every one a pure function of what the engine and the
// propeller are doing, how fast the air is going past the open door, and
// where the machine is against the ear.
//
// What a single-turboprop utility plane sounds like, in our own words:
//
//   * THE PROPELLER is most of it. Each blade throws a pressure pulse as it
//     passes, so the propeller is a set of tones at the BLADE-PASSAGE rate
//     (blades × rpm, 110 Hz at full rpm on three blades) and its multiples,
//     the fundamental strongest and the harmonics falling off by order,
//     over a broadband swish. Heard from the cabin, those low tones are a
//     BOOM in the chest — the fuselage drummed by the blades' pressure — and
//     dominate the spectrum; heard from outside, the higher harmonics are a
//     BUZZ that thickens as the blades bite (the power and the pitch).
//   * AT FULL POWER ON THE TAKE-OFF the blade tips run close to the speed of
//     sound — the tip's speed and the plane's together — and the buzz turns
//     into a hard RASP, a crackle at the blade rate: the loudest a
//     turboprop ever is. The governor holds the rpm in the air; on the
//     ground at idle the propeller turns slower and the buzz falls to a
//     loping thrum.
//   * THE TURBINE is a WHINE a few kHz up — the compressor's blades — with a
//     second partial over it and a broadband HOWL from the intake. It lights
//     and runs up AHEAD of the propeller on the start (the gas generator
//     spools first), so a start is a rising whine under a slow thrum that
//     comes up into the buzz; it climbs a little with the power.
//   * THE EXHAUST is a low roar out of the stacks beside the cowling.
//   * WITH THE JUMP DOOR OPEN the cabin is full of the SLIPSTREAM — a
//     pink roar climbing on the square of the airspeed, a brown buffet
//     under it — louder than the engine in the door.
//   * ON THE SNOW the wheel-skis RUMBLE over the packed strip and HISS, both
//     with the ground speed; the touch-down's thump is a one-shot.
//   * THE STALL WARNING is a reedy HORN in the cabin as the wing nears its
//     stall; the FLAPS' motor whines while they run.
//   * A WRECK burns: the helicopter's fire, heaving and fluttering.
//
// INSIDE OR OUT (`PlaneVoice.cabin`, the listener's `cabin` column, read
// only with the skier aboard): from the cockpit and the door the ear is in
// the cabin — the boom up, the turbine and the exhaust behind the firewall,
// the door's slipstream all round, the horn and the flap motor heard; from
// the booms it is the machine's outside — the buzz, the rasp, the whine,
// the exhaust. And once he has jumped, the plane flies home AWAY from him:
// `heliHeard`'s distance and air, and its Doppler shift, as the helicopter
// is heard. Every level here is at the ear's reference distance.
//
// The bed is a pure function of a `PlaneVoice`, so the suite reads it and
// the audition page drives it from sliders; the reading of a `GameState`
// into one is `plane-bed.ts`. The only values imported are the
// helicopter's distance and Doppler laws, which the audition page links
// before this file.

import type { LayerSpec, LayerTarget } from "@niclaslindstedt/oss-game-framework/audio/voice";

import { heliHeard } from "./heli-voice.ts";

/** The blade-passage rate, Hz, at the full rpm, and the propeller's tip
 * speed there, m/s. */
export type PlaneProp = { blade: number; tip: number };

/** The rate and the tip speed off the machine's own numbers — blades × rpm
 * / 60, π × diameter × rpm / 60 — so a retuned propeller needs no audio
 * row. */
export function propOf(plane: {
  prop: { blades: number; rpm: number; diameter: number };
}): PlaneProp {
  return {
    blade: (plane.prop.blades * plane.prop.rpm) / 60,
    tip: (Math.PI * plane.prop.diameter * plane.prop.rpm) / 60,
  };
}

/** One plane against the ear at one instant — everything the layers need. */
export type PlaneVoice = {
  /** The propeller's rpm as a share of its full, 0..1 (the governor's hold
   * in the air, the slower idle on the ground, the spool on the start). */
  rpm: number;
  /** The gas generator's speed as a share of its full, 0..1 — the whine's
   * pitch; it leads the propeller on the start. */
  ng: number;
  /** How hard the turbine is running up, 0..1: the start's whine. */
  rise: number;
  /** The engine's power share, 0..1. */
  power: number;
  /** How hard the blades bite, 0..1: the thrust's share of the static (and
   * the reverse's, on the snow). */
  load: number;
  /** The airspeed, m/s. */
  airspeed: number;
  /** How far the jump door is open, 0..1. */
  door: number;
  /** How far the ear is IN THE CABIN, 0..1 (the listener's `cabin`, with
   * the skier aboard). */
  cabin: number;
  /** The speed over the snow with a ski on it, m/s (0 in the air). */
  roll: number;
  /** How rough the snow under the skis is, 0..1 (the legs working). */
  rough: number;
  /** The stall warning, 0..1 (`stallWarnOf`). */
  warn: number;
  /** The flaps' motor running, 0..1. */
  flapRun: number;
  /** From the ear to the propeller's hub, m. */
  distance: number;
  /** The Doppler factor on every pitch, 1 standing (`dopplerOf`). */
  doppler: number;
  /** Where it is, -1 (the left ear) … 1 (the right), SCREEN space. */
  pan: number;
  /** The wreck burning, 0..1. */
  fire: number;
  /** The engine's clock, s — the fire heaves and the horn wavers on it. */
  t: number;
};

/** What the seat does to the machine — the listener's `machine` column. */
export type PlaneMix = { machine: number };

export type PlaneLayer =
  | "boom"
  | "thrum"
  | "buzz"
  | "rasp"
  | "swish"
  | "whine"
  | "whine2"
  | "howl"
  | "exhaust"
  | "door"
  | "doorBody"
  | "rumble"
  | "hiss"
  | "horn"
  | "flaps"
  | "fire";

/** What each layer is BUILT from — decided once. */
export const PLANE_LAYERS: Record<PlaneLayer, LayerSpec> = {
  // The fundamental and its first partials: the cabin's boom.
  boom: { kind: "tone", type: "triangle", drive: 0.3, filter: { type: "lowpass", q: 0.8 } },
  // The blade train's low harmonics: the thrum.
  thrum: { kind: "tone", type: "sawtooth", drive: 0.4, filter: { type: "lowpass", q: 1 } },
  // The higher harmonics as the blades bite: the buzz.
  buzz: { kind: "tone", type: "sawtooth", drive: 0.6, filter: { type: "bandpass", q: 1.6 } },
  // The tips near sonic: a hard crackle at the blade rate.
  rasp: { kind: "tone", type: "sawtooth", drive: 0.9, filter: { type: "highpass", q: 0.7 } },
  swish: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.8 } },
  whine: { kind: "tone", type: "sine" },
  whine2: { kind: "tone", type: "sine" },
  howl: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 2.2 } },
  exhaust: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.8 } },
  door: { kind: "noise", color: "pink", filter: { type: "lowpass", q: 0.6 } },
  doorBody: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 1.2 } },
  rumble: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 1.1 } },
  hiss: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.9 } },
  // A reed horn: a buzzy sawtooth through a narrow band.
  horn: { kind: "tone", type: "sawtooth", drive: 0.3, filter: { type: "bandpass", q: 6 } },
  // A small DC motor and its gear train.
  flaps: {
    kind: "tone",
    type: "sawtooth",
    detuneCents: 12,
    drive: 0.2,
    filter: { type: "lowpass", q: 2 },
  },
  fire: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.8 } },
};

/** How fast each layer follows, s: the propeller's and the turbine's pitch
 * on a short glide (their rpm cannot jump), the slipstream and the rumble a
 * little slower, the horn quick — it is a switch. */
export const PLANE_GLIDE: Record<PlaneLayer, number> = {
  boom: 0.12,
  thrum: 0.12,
  buzz: 0.1,
  rasp: 0.1,
  swish: 0.15,
  whine: 0.15,
  whine2: 0.15,
  howl: 0.2,
  exhaust: 0.2,
  door: 0.2,
  doorBody: 0.25,
  rumble: 0.12,
  hiss: 0.15,
  horn: 0.04,
  flaps: 0.08,
  fire: 0.25,
};

/** THE COMPRESSOR'S WHINE at the full gas-generator speed, Hz. */
const WHINE_HZ = 4200;
/** The highest a pitched layer is asked for, Hz — under the 7.2 kHz a
 * 16 kHz headset session can represent, Doppler and all. */
const PITCH_CEILING = 7000;
/** The stall horn's reed, Hz, and the flap motor's whine, Hz. */
const HORN_HZ = 1650;
const FLAP_HZ = 310;
/** The speed of sound in cold air, m/s — the tips' Mach. */
const SOUND = 331;

/** Take a value from `lo`..`hi` to 0..1. */
function ramp(value: number, lo: number, hi: number): number {
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}
const unit = (v: number): number => Math.min(1, Math.max(0, v));

/** THE TIPS' HELICAL MACH: the blade tip's speed round the disc and the
 * plane's along its way, over the speed of sound. */
export function tipMachOf(prop: PlaneProp, rpm: number, airspeed: number): number {
  return Math.hypot(prop.tip * rpm, airspeed) / SOUND;
}

/** THE STALL WARNING, 0..1: the reed sounds as the wing's angle of attack
 * comes within a few degrees of its stall (`aoa` against `stall`, rad) and
 * is full by it, or with any of the wing let go — in the air only. */
export function stallWarnOf(o: {
  aoa: number;
  stall: number;
  stalled: number;
  grounded: boolean;
}): number {
  if (o.grounded) return 0;
  return unit(Math.max(ramp(o.aoa, o.stall * 0.72, o.stall * 0.9), o.stalled * 3));
}

/** Where every layer should be for `voice`, through the seat's machine. */
export function planeTargets(
  voice: PlaneVoice,
  prop: PlaneProp,
  mix: PlaneMix,
): Record<PlaneLayer, LayerTarget> {
  const air = heliHeard(voice.distance);
  const g = air.gain * mix.machine;
  const rpm = unit(voice.rpm);
  const turning = rpm * rpm;
  const power = unit(voice.power);
  const load = unit(voice.load);
  const cabin = unit(voice.cabin);
  const out = 1 - cabin;
  const door = unit(voice.door);
  const fire = unit(voice.fire);
  const dop = voice.doppler;
  const pan = Math.min(1, Math.max(-1, voice.pan));
  const blade = Math.max(0.5, prop.blade * rpm * dop);
  const mach = tipMachOf(prop, rpm, voice.airspeed);
  const rasp = ramp(mach, 0.82, 0.95) * ramp(power, 0.55, 1);
  // The firewall and the cabin's lining: the high end of the machine goes
  // dull inside, the boom comes up.
  const dull = 1 - 0.45 * cabin;
  const ng = unit(voice.ng);
  const whineHz = Math.min(PITCH_CEILING, WHINE_HZ * (0.15 + 0.85 * ng) * dop);
  const whine =
    g * air.high * ng * (0.0025 + 0.0015 * power + 0.004 * unit(voice.rise)) * (1 - 0.6 * cabin);
  // THE SLIPSTREAM through the door: the square of the airspeed to 70 m/s,
  // heard all round from inside, only a breath off the airframe outside.
  const stream = ramp(voice.airspeed, 0, 70);
  const slip = stream * stream * door * (cabin + 0.12 * out);
  const roll = ramp(voice.roll, 0, 35);
  const rough = unit(voice.rough);
  const warn = unit(voice.warn);
  const heave = 0.5 + 0.3 * Math.sin(voice.t * 1.7) + 0.2 * Math.sin(voice.t * 4.3 + 0.9);
  // The reed wavers with the air through it.
  const waver = 1 + 0.015 * Math.sin(voice.t * 23);
  return {
    boom: {
      level: g * turning * (0.03 + 0.03 * load) * (1 + 0.6 * cabin),
      hz: blade,
      cutoff: 160 + 140 * load,
      grit: 0.35,
      pan: pan * 0.5,
    },
    thrum: {
      level: g * turning * (0.02 + 0.025 * load) * (0.8 + 0.4 * cabin),
      hz: blade,
      cutoff: (380 + 420 * load) * air.bright * dull * dop,
      grit: 0.4 + 0.3 * load,
      pan,
    },
    buzz: {
      level: g * air.mid * turning * load * 0.035 * (0.45 + 0.55 * out),
      hz: blade,
      cutoff: (blade * 6 + 700 * load) * air.bright * dull,
      grit: 0.5 + 0.4 * load,
      pan,
    },
    rasp: {
      level: g * air.mid * rasp * 0.03 * (0.35 + 0.65 * out),
      hz: blade,
      cutoff: (1600 + 900 * rasp) * Math.max(0.5, air.bright) * dull * dop,
      grit: 0.6 + 0.4 * rasp,
      pan,
    },
    swish: {
      level: g * turning * (0.006 + 0.01 * load) * dull,
      cutoff: (700 + 900 * load) * air.bright * dop,
      pan,
    },
    whine: { level: whine, hz: whineHz, pan },
    whine2: { level: whine * 0.3, hz: Math.min(PITCH_CEILING, whineHz * 1.5), pan },
    howl: {
      level: g * air.mid * ng * (0.004 + 0.008 * power) * (1 - 0.5 * cabin),
      cutoff: (1100 + 1300 * ng) * air.bright * dop,
      pan,
    },
    exhaust: {
      level: g * (0.008 + 0.04 * power) * ng * (1 - 0.4 * cabin),
      cutoff: 180 + 420 * power,
      grit: 0.3,
      pan: pan * 0.6,
    },
    door: {
      level: g * slip * 0.07,
      cutoff: (600 + 2400 * stream) * (0.7 + 0.3 * air.bright),
      pan: pan * 0.4,
    },
    doorBody: {
      level: g * slip * 0.05,
      cutoff: 90 + 160 * stream,
    },
    rumble: {
      level: g * roll * (0.012 + 0.03 * rough) * (1 + 0.6 * cabin),
      cutoff: 70 + 160 * roll,
      pan: pan * 0.5,
    },
    hiss: {
      level: g * air.mid * roll * 0.018 * (1 - 0.4 * cabin),
      cutoff: (900 + 1800 * roll) * air.bright,
      pan,
    },
    horn: {
      level: g * warn * 0.02 * cabin,
      hz: HORN_HZ * waver,
      cutoff: HORN_HZ * 1.1,
      grit: 0.4,
    },
    flaps: {
      level: g * unit(voice.flapRun) * 0.006 * (0.25 + 0.75 * cabin),
      hz: FLAP_HZ,
      cutoff: 900,
      grit: 0.2,
    },
    fire: {
      level: g * fire * (0.045 + 0.025 * heave),
      cutoff: 220 + 220 * heave,
      pan: pan * 0.5,
    },
  };
}
