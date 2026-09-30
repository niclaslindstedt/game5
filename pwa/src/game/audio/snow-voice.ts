// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIS ON THE SNOW, as five layers.
//
//   HISS     the bases running on PACKED snow: a bright pink sheet that
//            climbs with the speed — the sound of a groomed piste at pace
//   POWDER   the skis PLOUGHING virgin snow: a dark hush with body in it,
//            loudest at the low speeds where the skier is still sunk in and
//            shoving snow aside, thinning as he planes up on top
//   EDGE     the steel biting in a carve on the hardpack — a white-band
//            hiss that comes with the edge and the speed together, the
//            crisp tearing of a railed turn
//   CHATTER  the edge on HARD snow at speed: the ski skipping on the ice
//            in a fast buzz, a pulsed mid band that is the sound of a
//            slalom ski held on its edge past where it wants to be
//   SKID     the skis pivoted across the way scraping the snow off ahead
//            of their edges — a broad rasp that comes with the brake and
//            goes with the speed, the hockey stop's sound
//
// PACKED OR POWDER IS THE WHOLE STORY here, and it is one number: the share
// of the skis' load on packed snow this step (`SkierState.packed`). The
// hiss and the hush crossfade on it, so skiing off the piste into the deep
// stuff is heard as the hiss giving way to the hush before anything else
// changes. The wind is not here: it is the skier's own (`wind-voice.ts`).
//
// A pure function of the state, like the wind: `snowTargets` says where
// every layer should be, the scheduler (`ride-bed.ts`) steers them there.

import type { LayerSpec, LayerTarget } from "@niclaslindstedt/oss-game-framework/audio/voice";

/** The speed at which a skier in powder is up on top of it rather than
 * ploughing — past this the hush thins. Written against the engine's own
 * planing analogy (`snow.ts`), by ear rather than restated from it. */
const PLANE_SPEED = 12;

/** The speed the chatter starts at, m/s, and where it is fully up. */
const CHATTER_FROM = 12;
const CHATTER_FULL = 30;

/** One moment on the snow — everything the layers need. */
export type SnowVoice = {
  /** How fast the skier is going, m/s, and as a share of his top speed. */
  speed: number;
  pace: number;
  /** Share of the skis' load on packed snow, 0..1. */
  packed: number;
  /** How hard the packed snow is, 0..1 — a spring groomer at 0, boilerplate
   * at 1: what the chatter comes off. */
  hard: number;
  /** Share of the probes touching the snow, 0..1 — 0 in the air. */
  grounded: number;
  /** The edge the skis stand on, 0..1 of the most (the sign is not heard). */
  edge: number;
  /** The skid, 0..1 — how far across the way the skis are pivoted. */
  skid: number;
  airborne: boolean;
};

/** What the seat does to the snow — one of the listener's numbers. */
export type SnowMix = {
  snow: number;
};

export type SnowLayer = "hiss" | "powder" | "edge" | "chatter" | "skid";

/** What each layer is BUILT from — decided once. */
export const SNOW_LAYERS: Record<SnowLayer, LayerSpec> = {
  hiss: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.6 } },
  powder: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.8 } },
  edge: { kind: "noise", color: "white", filter: { type: "bandpass", q: 1.4 } },
  chatter: { kind: "noise", color: "white", filter: { type: "bandpass", q: 4 } },
  skid: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.9 } },
};

/** How fast each layer follows, s. The ground layers on a tenth — leaving
 * the snow is a cross-fade, not a switch — the edge and the skid quicker,
 * since an edge set is a moment. */
export const SNOW_GLIDE: Record<SnowLayer, number> = {
  hiss: 0.08,
  powder: 0.1,
  edge: 0.05,
  chatter: 0.04,
  skid: 0.06,
};

/** Take a value from `lo`..`hi` to 0..1. */
function ramp(value: number, lo: number, hi: number): number {
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

/** Where every layer of the snow should be for `voice`, heard from `mix`. */
export function snowTargets(voice: SnowVoice, mix: SnowMix): Record<SnowLayer, LayerTarget> {
  const pace = Math.min(1, Math.max(0, voice.pace));
  const packed = Math.min(1, Math.max(0, voice.packed));
  const hard = Math.min(1, Math.max(0, voice.hard));
  const on = voice.airborne ? 0 : Math.min(1, Math.max(0, voice.grounded));
  const moving = ramp(voice.speed, 0, 3);
  const plough = 1 - 0.6 * ramp(voice.speed, 3, PLANE_SPEED);
  const edge = Math.min(1, Math.max(0, voice.edge));
  const skid = Math.min(1, Math.max(0, voice.skid));
  const chatter = ramp(voice.speed, CHATTER_FROM, CHATTER_FULL);
  return {
    hiss: {
      level: on * packed * moving * (0.004 + 0.02 * Math.pow(pace, 1.2)) * mix.snow,
      cutoff: 1800 + 3600 * pace,
    },
    powder: {
      level: on * (1 - packed) * moving * plough * (0.012 + 0.02 * pace) * mix.snow,
      cutoff: 260 + 700 * pace,
    },
    // THE EDGE bites on packed snow: the harder the edge and the faster,
    // the more it tears — and a skidded ski is not carving.
    edge: {
      level: on * packed * edge * (1 - 0.7 * skid) * ramp(voice.speed, 3, 25) * 0.014 * mix.snow,
      cutoff: 2600 + 2400 * pace,
    },
    // THE CHATTER is the edge on ice at speed: nothing on soft snow,
    // nothing slow, a buzz that climbs with the speed.
    chatter: {
      level: on * packed * hard * edge * chatter * chatter * 0.012 * mix.snow,
      cutoff: 900 + 1400 * chatter,
    },
    // THE SKID scrapes: with the brake, and with the speed the skis are
    // being dragged across the snow at.
    skid: {
      level: on * skid * ramp(voice.speed, 1, 20) * (0.006 + 0.016 * packed) * mix.snow,
      cutoff: 500 + 1200 * pace + 600 * skid,
    },
  };
}
