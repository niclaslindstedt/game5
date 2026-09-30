// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIND ON A SKIER, AS FOUR LAYERS THAT NEVER STOP.
//
// There is no engine. What a skier hears of his own speed is the AIR: the
// rush past the helmet that climbs with every metre a second, the roar it
// becomes folded into a tuck with the chin on the knees, the whistle over
// the goggles' strap and the poles, and the suit flapping. Nothing here is
// scheduled or tiled: a handful of noise sources built once for the race
// and STEERED — level and cutoff moved every frame on the audio thread
// (`Synth.layer`). A frame that arrives late leaves the wind holding its
// last note rather than leaving a hole.
//
// WHAT THE WIND IS MADE OF, in the order the ear finds them:
//
//   RUSH     the broad pink rush past the helmet — the sound of speed on
//            skis, climbing with the square of the airspeed, and the one
//            layer that plays as loud in the air as on the snow
//   ROAR     the low brown roar the tuck makes of it: the head down behind
//            the hands, the wind breaking over the back — what a schuss
//            sounds like from inside a helmet, and the layer that says
//            TUCK before the speedo does
//   WHISTLE  a thin band whistle that comes in past forty and climbs with
//            the speed — the air over the goggles' strap, the poles under
//            the arms, the edge of the helmet
//   FLUTTER  the suit and the jacket flapping: a mid band that is loudest
//            stood up in the wind and goes quiet in a tuck, where the suit
//            is pulled tight
//
// THE TUCK IS WHY THIS SOUNDS LIKE SKIING. Folding down does two things at
// once: the drag drops and the skier gathers speed (the physics), and the
// ear moves down out of the clean air into the roar behind the hands (this
// module). A wind that only followed the speed would tell the player
// nothing about his own body.
//
// This is a pure function of the state: `windTargets` says where every
// layer should be, and the scheduler (`ride-bed.ts`) steers the real ones
// there. Being a pure function is what makes it testable and what lets the
// audition page drive it from sliders.

import type { LayerSpec, LayerTarget } from "@niclaslindstedt/oss-game-framework/audio/voice";

/** The apparent wind at which the rush is as loud as it gets, m/s: a
 * downhill ski flat out in a tuck, a little past the catalog's fastest. */
export const WIND_FULL = 40;

/** The airspeed the whistle starts at, m/s, and where it is fully up. */
const WHISTLE_FROM = 11;
const WHISTLE_FULL = 32;

/** One skier's wind at one instant — everything the layers need. */
export type WindVoice = {
  /** The apparent wind at the skier's head, m/s. */
  wind: number;
  /** How far into the tuck the body is, 0..1 (`SkierState.crouch`). */
  crouch: number;
  /** Off the snow: the rush comes up, there being nothing else to hear. */
  airborne: boolean;
};

/** What the seat does to the wind — two of the listener's numbers. */
export type WindMix = {
  wind: number;
  /** 0..1, how bright: the rush's cutoff is scaled by it. */
  tone: number;
};

export type WindLayer = "rush" | "roar" | "whistle" | "flutter";

/** What each layer is BUILT from — decided once. */
export const WIND_LAYERS: Record<WindLayer, LayerSpec> = {
  rush: { kind: "noise", color: "pink", filter: { type: "lowpass", q: 0.5 } },
  roar: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.9 } },
  whistle: { kind: "noise", color: "white", filter: { type: "bandpass", q: 6 } },
  flutter: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 1.6 } },
};

/** How fast each layer follows, s. The rush on a slow glide (a gust is not
 * a switch), the roar a little slower still — a tuck is folded into, not
 * snapped into. */
export const WIND_GLIDE: Record<WindLayer, number> = {
  rush: 0.15,
  roar: 0.2,
  whistle: 0.12,
  flutter: 0.1,
};

/** Take a value from `lo`..`hi` to 0..1. */
function ramp(value: number, lo: number, hi: number): number {
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

/** Where every layer of the wind should be for `voice`, heard from `mix`. */
export function windTargets(voice: WindVoice, mix: WindMix): Record<WindLayer, LayerTarget> {
  const gust = ramp(voice.wind, 0, WIND_FULL);
  const crouch = Math.min(1, Math.max(0, voice.crouch));
  const whistle = ramp(voice.wind, WHISTLE_FROM, WHISTLE_FULL);
  const bright = 0.5 + 0.5 * mix.tone;
  return {
    // THE RUSH climbs with the square of the airspeed — the pressure does —
    // and comes up in the air, with the snow gone from under it.
    rush: {
      level: gust * gust * (voice.airborne ? 0.034 : 0.022) * (1 - 0.35 * crouch) * mix.wind,
      cutoff: (400 + 2200 * gust) * bright,
    },
    // THE ROAR is the tuck's: nothing stood up, most of the wind folded
    // down, and darker the faster.
    roar: {
      level: gust * (0.004 + 0.03 * crouch) * mix.wind,
      cutoff: 120 + 260 * gust,
    },
    whistle: {
      level: whistle * whistle * 0.005 * mix.wind,
      cutoff: (1800 + 2600 * whistle) * bright,
    },
    // THE FLUTTER is the suit in the wind: loud stood up at speed, pulled
    // tight and quiet in a tuck.
    flutter: {
      level: gust * (0.008 * (1 - crouch) + 0.001) * mix.wind,
      cutoff: 700 + 900 * gust,
    },
  };
}
