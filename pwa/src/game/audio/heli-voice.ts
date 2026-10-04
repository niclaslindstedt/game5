// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER, HEARD — the free ride's machine (`heli.ts`) as eleven
// layers, every one a pure function of where it is against the ear and
// what its rotor is doing:
//
//   WHOP    the main rotor's blades passing: a sawtooth at the BLADE-PASSAGE
//           rate (blades × rpm, some twenty a second at full speed) into a
//           resonant bandpass, so each blade is a short ringing thwop — the
//           rate rises and falls with the spool, a lone whup a second as it
//           winds up from the pad
//   THUMP   the same pulse train under a lowpass: the weight in the chest
//   SLAP    the same train through a highpass, driven: the crack of each
//           blade meeting the last one's tip vortex (BLADE-VORTEX
//           INTERACTION) — loud in a descent into its own wake, in a hard
//           turn and at full collective, silent in a level hover
//   SWISH   the broadband noise the blades make cutting the air
//   WHINE   the turbine: a sine a few kHz up, rising with the spool on the
//           square root of it (the gas generator lights and runs up ahead
//           of the rotor), louder while it is spooling up — the start
//   WHINE2  its second harmonic, held under the headset's ceiling
//   TAIL    the tail rotor's buzz: a detuned sawtooth at its own blade
//           passage (some seventy a second), harmonics through a lowpass
//   WASH    the snow blown off the surface under the disc: a pink roar that
//           brightens as the machine comes down, near the snow and pulling
//   WASHBODY its brown weight under it
//   FIRE    the wreck burning: a brown roar that heaves on two slow beats
//   FLAME   the flames' pink flutter over it
//
// And the crackle of the fire, which no layer can make: pops the bed
// raises as cues off the engine's clock (`heli-bed.ts`, `crackleAt`).
//
// DISTANCE IS THE WHOLE MIX. Riding on the skid the ear is three metres
// from the hub and the rotor is deafening; as the pilot flies home after
// the drop it falls off with the distance (`heliHeard`: the inverse law
// near it, a gentler one past sixty metres), the air taking the top off it
// first — the whine gone within a few hundred metres, the slap next, the
// thump carrying furthest — and its pitch is moved by the Doppler shift of
// its closing speed. Every number in here is
// at the ear's REFERENCE distance; `heliHeard` scales it.
//
// The bed is a pure function of a `HeliVoice`, so the suite reads it and
// the audition page drives it from sliders; the reading of a `GameState`
// into one is `heli-bed.ts`. Nothing here imports a value: the page links
// this file by concatenation and has no engine in it, so the rotors' rates
// are handed in (`HeliRotors`, `rotorsOf` off the engine's `HELI`).

import type { LayerSpec, LayerTarget } from "@niclaslindstedt/oss-game-framework/audio/voice";

/** The blade-passage rates, Hz, at the full rpm: the main rotor's and the
 * tail rotor's. */
export type HeliRotors = { main: number; tail: number };

/** The rates off the machine's own numbers — blades × rpm / 60 — so a
 * retuned rotor needs no audio row. */
export function rotorsOf(heli: {
  rotor: { blades: number; rpm: number };
  tail: { blades: number; rpm: number };
}): HeliRotors {
  return {
    main: (heli.rotor.blades * heli.rotor.rpm) / 60,
    tail: (heli.tail.blades * heli.tail.rpm) / 60,
  };
}

/** One helicopter against the ear at one instant — everything the layers
 * need. */
export type HeliVoice = {
  /** The rotor's share of its full rpm, 0..1 — the one the ear hears (the
   * engine's, or the bed's own wind-down once it has hit the snow). */
  spool: number;
  /** How hard the turbine is running up, 0..1: the start's whine. */
  rise: number;
  /** The collective, 0..1: the blades' bite. */
  collective: number;
  /** Blade-vortex interaction, 0..1 (`slapOf`). */
  slap: number;
  /** The snow blown up under the disc, 0..1 (`washOf`). */
  wash: number;
  /** From the ear to the hub, m. */
  distance: number;
  /** The Doppler factor on every pitch, 1 standing (`dopplerOf`). */
  doppler: number;
  /** Where it is, -1 (the left ear) … 1 (the right), SCREEN space. */
  pan: number;
  /** The wreck burning, 0..1. */
  fire: number;
  /** The engine's clock, s — the fire heaves on a beat of it. */
  t: number;
};

/** What the seat does to the machine — the listener's `machine` column. */
export type HeliMix = { machine: number };

export type HeliLayer =
  | "whop"
  | "thump"
  | "slap"
  | "swish"
  | "whine"
  | "whine2"
  | "tail"
  | "wash"
  | "washBody"
  | "fire"
  | "flame";

/** What each layer is BUILT from — decided once. */
export const HELI_LAYERS: Record<HeliLayer, LayerSpec> = {
  whop: { kind: "tone", type: "sawtooth", drive: 0.5, filter: { type: "bandpass", q: 2.4 } },
  thump: { kind: "tone", type: "sawtooth", drive: 0.4, filter: { type: "lowpass", q: 0.9 } },
  slap: { kind: "tone", type: "sawtooth", drive: 0.8, filter: { type: "highpass", q: 0.8 } },
  swish: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.8 } },
  whine: { kind: "tone", type: "sine" },
  whine2: { kind: "tone", type: "sine" },
  tail: {
    kind: "tone",
    type: "sawtooth",
    detuneCents: 7,
    drive: 0.35,
    filter: { type: "lowpass", q: 1.2 },
  },
  wash: { kind: "noise", color: "pink", filter: { type: "lowpass", q: 0.6 } },
  washBody: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.7 } },
  fire: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.8 } },
  flame: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.9 } },
};

/** How fast each layer follows, s: the rotor's pitch on a short glide (a
 * rotor's rpm cannot jump, and the frame's cadence must never be heard in
 * it), the wash on a long one — a cloud of snow builds and settles. */
export const HELI_GLIDE: Record<HeliLayer, number> = {
  whop: 0.12,
  thump: 0.12,
  slap: 0.1,
  swish: 0.15,
  whine: 0.12,
  whine2: 0.12,
  tail: 0.12,
  wash: 0.3,
  washBody: 0.4,
  fire: 0.25,
  flame: 0.2,
};

/** THE TURBINE'S WHINE at the full spool, Hz: a few kHz, as the gas
 * generator's compressor sings. */
const WHINE_HZ = 3100;
/** The highest a pitched layer is asked for, Hz — under the 7.2 kHz a
 * 16 kHz headset session can represent, Doppler and all. */
const PITCH_CEILING = 7000;

/** THE REFERENCE DISTANCE, m: the ear on the skid, three metres under the
 * hub — every level in `heliTargets` is the level here, and nothing gets
 * louder nearer. */
export const HEARD_REF = 6;
/** Where the fall-off eases, m, and how steeply it falls past there (the
 * exponent on the distance): a point source's inverse law near the
 * machine, and a gentler one past this — a game's choice rather than the
 * air's, so the machine flying home is heard down the valley under the
 * skier's own wind rather than lost in it at a few hundred metres. */
const EASE_AT = 60;
const EASE_LAW = 0.6;
/** How far off the machine is heard at all, m, and where it starts to fade
 * to nothing — past the ridges the wind has it. */
export const HEARD_FAR = 3000;
const FADE_FROM = 2000;

/** What the air does to it at `distance` m: the distance's gain, the
 * share of every cutoff left (the air takes the top off a far sound), and
 * the HIGH and MID shares — the whine's band loses some 0.03 dB a metre in
 * cold air, the slap's a third of that; the thump carries. */
export function heliHeard(distance: number): {
  gain: number;
  bright: number;
  high: number;
  mid: number;
} {
  const d = Math.max(0, distance);
  const fade = 1 - Math.min(1, Math.max(0, (d - FADE_FROM) / (HEARD_FAR - FADE_FROM)));
  return {
    gain:
      (d <= EASE_AT
        ? HEARD_REF / Math.max(HEARD_REF, d)
        : (HEARD_REF / EASE_AT) * (EASE_AT / d) ** EASE_LAW) * fade,
    bright: 1 / (1 + d / 350),
    high: Math.exp(-d / 290),
    mid: Math.exp(-d / 800),
  };
}

/** The speed of sound in cold air, m/s. */
const SOUND = 331;

/** THE DOPPLER FACTOR of a source closing on the ear at `closing` m/s
 * (negative going away): c / (c − v), held to a sane band. */
export function dopplerOf(closing: number): number {
  return Math.min(1.3, Math.max(0.75, SOUND / (SOUND - closing)));
}

/** Take a value from `lo`..`hi` to 0..1. */
function ramp(value: number, lo: number, hi: number): number {
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

/** BLADE-VORTEX INTERACTION, 0..1: the slap comes up as the disc descends
 * into its own wake (most with some way on, which lays the wake under the
 * advancing blades), in a hard turn at speed, and with the blades pulling
 * near all they have. A level hover is quiet. */
export function slapOf(o: {
  sink: number;
  speed: number;
  yawRate: number;
  collective: number;
}): number {
  const descent = ramp(o.sink, 1, 6) * (0.4 + 0.6 * ramp(o.speed, 3, 20));
  const turn = ramp(Math.abs(o.yawRate), 0.15, 0.8) * ramp(o.speed, 5, 25);
  const load = ramp(o.collective, 0.75, 1);
  return Math.min(1, descent + 0.7 * turn + 0.5 * load);
}

/** THE WASH, 0..1: how much snow the downwash lifts — near the snow (the
 * hub `agl` m over it, gone past `reach` rotor diameters of height) and
 * pulling (`push`, the thrust's share of the weight, with a little off an
 * idling rotor that is only spinning). */
export function washOf(o: {
  agl: number;
  radius: number;
  reach: number;
  push: number;
  spool: number;
}): number {
  const near = 1 - ramp(o.agl, o.radius * 0.6, o.reach * 2 * o.radius);
  const pull = 0.35 * o.spool * o.spool + 0.65 * Math.min(1, Math.max(0, o.push));
  return near * near * pull;
}

/** Where every layer should be for `voice`, through the seat's machine. */
export function heliTargets(
  voice: HeliVoice,
  rotors: HeliRotors,
  mix: HeliMix,
): Record<HeliLayer, LayerTarget> {
  const air = heliHeard(voice.distance);
  const g = air.gain * mix.machine;
  const spool = Math.min(1, Math.max(0, voice.spool));
  const rotor = spool * spool;
  const col = Math.min(1, Math.max(0, voice.collective));
  const slap = Math.min(1, Math.max(0, voice.slap));
  const wash = Math.min(1, Math.max(0, voice.wash));
  const fire = Math.min(1, Math.max(0, voice.fire));
  const dop = voice.doppler;
  const pan = Math.min(1, Math.max(-1, voice.pan));
  const blade = Math.max(0.5, rotors.main * spool * dop);
  // The gas generator runs ahead of the rotor: the square root of its rpm.
  const turbine = Math.sqrt(spool);
  const whineHz = Math.min(PITCH_CEILING, WHINE_HZ * (0.2 + 0.8 * turbine) * dop);
  const whine = g * air.high * turbine * (0.0035 + 0.005 * Math.min(1, Math.max(0, voice.rise)));
  // Two beats a little apart, so the fire never settles into a pulse.
  const heave = 0.5 + 0.3 * Math.sin(voice.t * 1.7) + 0.2 * Math.sin(voice.t * 4.3 + 0.9);
  const flicker = 0.5 + 0.3 * Math.sin(voice.t * 6.1 + 2) + 0.2 * Math.sin(voice.t * 11.3);
  return {
    whop: {
      level: g * rotor * (0.05 + 0.03 * col + 0.02 * slap),
      hz: blade,
      cutoff: (320 + 380 * col + 700 * slap) * air.bright * dop,
      grit: 0.4 + 0.5 * slap,
      pan,
    },
    thump: {
      level: g * rotor * (0.07 + 0.05 * col),
      hz: blade,
      cutoff: 90 + 80 * col,
      grit: 0.5,
      pan: pan * 0.5,
    },
    slap: {
      level: g * air.mid * rotor * slap * 0.03,
      hz: blade,
      cutoff: (1300 + 900 * slap) * Math.max(0.5, air.bright) * dop,
      grit: slap,
      pan,
    },
    swish: {
      level: g * rotor * (0.008 + 0.01 * col),
      cutoff: (650 + 700 * col) * air.bright * dop,
      pan,
    },
    whine: { level: whine, hz: whineHz, pan },
    whine2: { level: whine * 0.35, hz: Math.min(PITCH_CEILING, whineHz * 2), pan },
    tail: {
      level: g * rotor * (0.012 + 0.01 * col),
      hz: Math.max(1, rotors.tail * spool * dop),
      cutoff: (420 + 380 * col) * air.bright * dop,
      grit: 0.4,
      pan,
    },
    wash: {
      level: g * wash * 0.05,
      cutoff: (700 + 2200 * wash) * air.bright,
      pan,
    },
    washBody: {
      level: g * wash * 0.05,
      cutoff: 160 + 240 * wash,
      pan: pan * 0.5,
    },
    fire: {
      level: g * fire * (0.04 + 0.02 * heave),
      cutoff: 220 + 200 * heave,
      pan: pan * 0.5,
    },
    flame: {
      level: g * fire * (0.01 + 0.008 * flicker),
      cutoff: (800 + 900 * flicker) * air.bright,
      pan,
    },
  };
}

/** THE FIRE'S CRACKLE: the slots a second a pop may land in, and the share
 * of them that pop with the fire full up. */
export const CRACKLE_SLOTS = 40;
const CRACKLE_SHARE = 0.3;

/** A slot's own draw, 0..1 — a hash of its index, never a stream, so the
 * wreck crackles the same on every replay. */
function slotDraw(slot: number, salt: number): number {
  let h = Math.imul(slot ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** WHETHER THE FIRE POPS in slot `slot` (the engine's clock × the slots a
 * second) burning at `fire`, and if so how: its size 0..1 and its pitch. */
export function crackleAt(slot: number, fire: number): { size: number; pitch: number } | null {
  if (fire <= 0 || slotDraw(slot, 0) >= CRACKLE_SHARE * Math.min(1, fire)) return null;
  return { size: 0.3 + 0.7 * slotDraw(slot, 1) ** 2, pitch: 0.7 + 0.8 * slotDraw(slot, 2) };
}
