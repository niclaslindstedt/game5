// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVE, HEARD — the jump out of the plane's door (`chute.ts`) as
// ten layers, a pure function of how fast the air is going through him or
// his canopy, how his body lies in it, and what is over him.
//
// What a skydive sounds like, in our own words:
//
//   * OUT OF THE DOOR the plane's noise falls away in a second (its own
//     bed's distance and Doppler — the plane flies on) and the propeller's
//     blast and the slipstream BUFFET him while the air turns from along
//     his way to up at him.
//   * IN FREEFALL the air is everything: a ROAR climbing with the speed to
//     terminal (some 55 m/s on the belly, near 90 head down — the loudest
//     thing in the game, as it is the loudest thing a body can ride), a
//     brown RUMBLE under it that is the body as a bluff plate, a WHISTLE
//     off the helmet and goggles, and the jumpsuit and the container's
//     flaps FLAPPING. Its colour is the body's position: flat on the belly
//     a broad, dark, deep roar with the suit flogging; head down the body
//     knifes through — brighter, tighter, the whistle up and the suit
//     pulled flat; in a track the air streams over him, brighter with the
//     suit flapping hard.
//   * THE OPENING: the pilot chute's flap, the bag dragged off his back,
//     the lines' SNAP at line stretch (a one-shot), then the canopy
//     FLOGGING as it snivels and spreads — a ripping flutter of cloth — the
//     WHUMP of full inflation (a one-shot), and the roar falling away to
//     near silence in a couple of seconds.
//   * UNDER THE CANOPY it is QUIET: the fabric's soft RUSTLE and the lines'
//     thin HUM in the breeze of his own glide (a line a millimetre and a
//     half thick sheds vortices at about a fifth of the airspeed over its
//     diameter — a kilohertz and a half at a canopy's 12 m/s), the cloth
//     luffing louder deep in the brakes and stalling.
//   * CUT AWAY, the canopy FLAPS AWAY above him, a flogging rag going off
//     up the sky as he falls clear (its distance off `heliHeard`).
//
// The skier's own wind (`wind-voice.ts`) is the air of the ride bed; in
// the door, the exit and the freefall THIS bed owns the air and the ride
// bed's wind stands down (`chute-bed.ts`'s `rideAirShare`), so the roar is
// never heard twice. Every level is through the listener's `wind` column —
// it is the skier's own air — and the cut-away canopy's through `machine`.

import type { LayerSpec, LayerTarget } from "@niclaslindstedt/oss-game-framework/audio/voice";

import { heliHeard } from "./heli-voice.ts";

/** One jumper's air at one instant — everything the layers need. */
export type ChuteVoice = {
  /** How far he is ON HIS BODY in the air (the exit, the freefall, the
   * deployment's first stages), 0..1. */
  body: number;
  /** The exit's buffet — the plane's blast, the air turning — 0..1. */
  exit: number;
  /** The air through him (or the canopy), m/s. */
  airspeed: number;
  /** His attitude in the air, rad: 0 upright, π/2 belly to earth, π head
   * down (`ChuteState.attitude`). */
  attitude: number;
  /** How hard he tracks, 0..1. */
  track: number;
  /** The canopy flogging as it comes out and spreads, 0..1. */
  flog: number;
  /** How far a canopy is open and flying over him, 0..1. */
  open: number;
  /** Both toggles down, 0..1 (the flare's luff). */
  brake: number;
  /** One toggle more than the other, 0..1. */
  turn: number;
  /** The canopy stalled. */
  stalled: boolean;
  /** The canopy cut away and falling, how fast, m/s (0 none or down), and
   * how far off, m. */
  piece: number;
  pieceDistance: number;
  /** The engine's clock, s — the cloth flutters on it. */
  t: number;
};

/** What the seat does to it: the skier's own air and a machine away. */
export type ChuteMix = { wind: number; machine: number };

export type ChuteLayer =
  "roar" | "rumble" | "whistle" | "flap" | "buffet" | "flog" | "rustle" | "hum" | "luff" | "piece";

/** What each layer is BUILT from — decided once. */
export const CHUTE_LAYERS: Record<ChuteLayer, LayerSpec> = {
  roar: { kind: "noise", color: "pink", filter: { type: "lowpass", q: 0.5 } },
  rumble: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.9 } },
  whistle: { kind: "noise", color: "white", filter: { type: "bandpass", q: 6 } },
  flap: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 1.4 } },
  buffet: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 1.4 } },
  flog: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 1.1 } },
  rustle: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.9 } },
  hum: { kind: "tone", type: "triangle", detuneCents: 9, filter: { type: "bandpass", q: 4 } },
  luff: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 1.3 } },
  piece: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 1.2 } },
};

/** How fast each layer follows, s: the roar on a slow glide (a body turns
 * in the air, it does not switch), the cloth quick — it flutters. */
export const CHUTE_GLIDE: Record<ChuteLayer, number> = {
  roar: 0.2,
  rumble: 0.25,
  whistle: 0.15,
  flap: 0.06,
  buffet: 0.2,
  flog: 0.05,
  rustle: 0.12,
  hum: 0.2,
  luff: 0.08,
  piece: 0.06,
};

/** The airspeed the roar is full at, m/s — head down; past it nothing gets
 * louder. */
const AIR_TOP = 90;
/** The line's diameter, m, and the Strouhal number its vortices shed at. */
const LINE = 0.0016;
const STROUHAL = 0.2;
/** The highest a pitched layer is asked for, Hz. */
const PITCH_CEILING = 7000;

/** Take a value from `lo`..`hi` to 0..1. */
function ramp(value: number, lo: number, hi: number): number {
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}
const unit = (v: number): number => Math.min(1, Math.max(0, v));

/** HOW HIS BODY LIES, as three shares that sum to one: on his belly (and
 * the exit's upright, which is as broad), head down, and the track. */
export function postureOf(
  attitude: number,
  track: number,
): {
  belly: number;
  head: number;
  track: number;
} {
  const tr = unit(track);
  const head = ramp(attitude, Math.PI / 2 + 0.35, Math.PI - 0.2) * (1 - tr);
  return { belly: 1 - head - tr, head, track: tr };
}

/** THE LINES' HUM, Hz: the vortex shedding off a suspension line. */
export function humOf(airspeed: number): number {
  return Math.min(PITCH_CEILING, (STROUHAL * Math.max(0, airspeed)) / LINE);
}

/** Where every layer should be for `voice`, through the seat. */
export function chuteTargets(voice: ChuteVoice, mix: ChuteMix): Record<ChuteLayer, LayerTarget> {
  const v = Math.max(0, voice.airspeed);
  const s = ramp(v, 0, AIR_TOP);
  const loud = s * s;
  const body = unit(voice.body);
  const w = mix.wind;
  const pose = postureOf(voice.attitude, voice.track);
  const flutter = 0.55 + 0.3 * Math.sin(voice.t * 19) + 0.15 * Math.sin(voice.t * 47 + 1.3);
  const flogBeat = 0.5 + 0.35 * Math.sin(voice.t * 31) + 0.15 * Math.sin(voice.t * 73 + 0.4);
  const open = unit(voice.open);
  const canopy = ramp(v, 0, 16);
  const brake = unit(voice.brake);
  const luff = open * unit(0.6 * ramp(brake, 0.55, 1) + (voice.stalled ? 0.8 : 0));
  const piece = ramp(voice.piece, 0, 20);
  const away = heliHeard(voice.pieceDistance);
  return {
    // THE ROAR on the square of the airspeed, brightest head down.
    roar: {
      level: body * loud * 0.16 * (1 - 0.25 * pose.head) * w,
      cutoff: (500 + 2600 * s) * (1 + 0.35 * pose.head + 0.2 * pose.track),
    },
    rumble: {
      level: body * loud * 0.06 * (0.4 + 0.6 * pose.belly) * w,
      cutoff: 90 + 220 * s,
    },
    whistle: {
      level: body * ramp(v, 15, 80) ** 2 * 0.006 * (1 + 1.5 * pose.head + 0.6 * pose.track) * w,
      cutoff: 2000 + 2400 * s,
    },
    // THE SUIT flogging: broad on the belly, hardest in a track, pulled flat
    // head down.
    flap: {
      level:
        body * s * 0.02 * (0.7 * pose.belly + 1.3 * pose.track + 0.15 * pose.head) * flutter * w,
      cutoff: 500 + 900 * s,
    },
    buffet: {
      level: unit(voice.exit) * (0.02 + 0.05 * loud) * w,
      cutoff: 80 + 200 * s,
    },
    // THE CANOPY OUT OF ITS BAG, flogging until it is spread.
    flog: {
      level: unit(voice.flog) * (0.015 + 0.05 * loud) * flogBeat * w,
      cutoff: 400 + 1400 * flogBeat,
    },
    // UNDER IT: the fabric's rustle, the lines' hum, the luff in the brakes.
    rustle: {
      level: open * canopy * canopy * (0.004 + 0.003 * unit(voice.turn)) * w,
      cutoff: 900 + 1500 * canopy,
    },
    hum: {
      level: open * canopy * canopy * 0.0025 * w,
      hz: humOf(v),
      cutoff: humOf(v),
    },
    luff: {
      level: luff * 0.012 * (0.6 + 0.4 * flutter) * w,
      cutoff: 500 + 600 * flutter,
    },
    // CUT AWAY: the canopy flapping away up the sky.
    piece: {
      level: piece * 0.03 * away.gain * flogBeat * mix.machine,
      cutoff: (500 + 1200 * flogBeat) * away.bright,
    },
  };
}
