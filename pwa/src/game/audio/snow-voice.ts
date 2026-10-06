// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIS ON THE SNOW, as eight layers — the ski game's answer to the
// sibling snowmobile game's engine voice. A skier has no motor; what he
// hears of his own machine is the bases and the steel on whatever lies
// under them, so THIS is the bed every run is made of under the wind.
//
//   HISS     the bases running on the GROOMER: a bright pink sheet that
//            climbs with the speed — the corduroy at pace
//   POWDER   the skis PLOUGHING loose snow: a dark hush with body in it,
//            loudest at the low speeds where the skier is still sunk in
//            and shoving snow aside, thinning as he planes up on top — and
//            darker and quieter still in NEW snow, which swallows sound
//   EDGE     the steel biting in a carve on firm snow — a white-band tear
//            that comes with the edge and the speed together
//   CHATTER  the edge on FIRM snow at speed: the ski skipping in a fast
//            buzz, a narrow mid band — louder on a soft ski, which cannot
//            damp it, and pitched up on a stiff one
//   SKID     the skis pivoted across the way scraping the snow off ahead of
//            their edges — a broad rasp that comes with the brake and goes
//            with the speed, brighter the firmer the snow
//   CRUNCH   the WIND CRUST breaking under the skis in plates — a gritty
//            mid band with a hollow under it, the one sound that tells a
//            skier the snow will not hold an edge the way it looks
//   SLUSH    WET spring snow — a low, heavy, sticky swash that is loudest
//            slow, where the skis are dragging through it
//   SCRAPE   ICE under the steel — a thin, high, narrow screech with the
//            edge and the skid, the sound of nothing to bite into
//
// WHAT LIES UNDER THE SKIS IS SIX KINDS OF SNOW, as a MIX — `snowpack.ts`'s
// groomed, hard, soft, new, wet and ice, the same blend the spray, the
// cloud and the grooves are read off — so skiing off the piste is heard as
// the hiss giving way to the hush before anything else changes, a crest
// scoured to crust crunches, and an afternoon in the sun goes to slush. The
// wind is not here: it is the skier's own (`wind-voice.ts`).
//
// AND WHAT IS ON HIS FEET COLOURS IT (`SkiVoice`): a stiff race ski rings
// higher and holds its chatter down; a soft park ski buzzes; a fat powder
// ski throws a bigger, darker hush; a long downhill ski drones lower on the
// groomer. Read off the pair's own spec, never a table of names.
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

/** The weight of each kind of snow under the skis, summing to 1 — the
 * shape of `snowpack.ts`'s `SnowMix`, restated so the audition page, which
 * has no map, can hand one in from its sliders. */
export type SnowUnder = {
  groomed: number;
  hard: number;
  soft: number;
  new: number;
  wet: number;
  ice: number;
};

/** THE PAIR AS HEARD, off its spec (`skiVoiceOf`). */
export type SkiVoice = {
  /** How stiff the ski is, 0 (park) … 1 (downhill) — `SkiSpec.flex`. */
  flex: number;
  /** How fat it is under the foot, 0 (a 66 mm race waist) … 1 (a 116 mm
   * powder waist). */
  width: number;
  /** How long it is, 0 (a 1.55 m slalom ski) … 1 (a 2.18 m downhill ski). */
  length: number;
};

/** The pair a lab hears when it names none: the all-mountain's middle. */
export const NEUTRAL_SKI: SkiVoice = { flex: 0.5, width: 0.44, length: 0.37 };

/** A pair's spec as the bed hears it. */
export function skiVoiceOf(spec: { flex: number; waist: number; length: number }): SkiVoice {
  return {
    flex: clamp01(spec.flex),
    width: clamp01((spec.waist - 0.066) / 0.05),
    length: clamp01((spec.length - 1.55) / 0.63),
  };
}

/** One moment on the snow — everything the layers need. */
export type SnowVoice = {
  /** How fast the skier is going, m/s, and as a share of his top speed. */
  speed: number;
  pace: number;
  /** What lies under the skis. */
  under: SnowUnder;
  /** The pair on his feet. */
  ski: SkiVoice;
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

export type SnowLayer =
  "hiss" | "powder" | "edge" | "chatter" | "skid" | "crunch" | "slush" | "scrape";

/** What each layer is BUILT from — decided once. */
export const SNOW_LAYERS: Record<SnowLayer, LayerSpec> = {
  hiss: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.6 } },
  powder: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.8 } },
  edge: { kind: "noise", color: "white", filter: { type: "bandpass", q: 1.4 } },
  chatter: { kind: "noise", color: "white", filter: { type: "bandpass", q: 4 } },
  skid: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.9 } },
  crunch: { kind: "noise", color: "white", filter: { type: "bandpass", q: 2.2 } },
  slush: { kind: "noise", color: "brown", filter: { type: "bandpass", q: 1.1 } },
  scrape: { kind: "noise", color: "white", filter: { type: "bandpass", q: 6 } },
};

/** How fast each layer follows, s. The ground layers on a tenth — leaving
 * the snow is a cross-fade, not a switch — the edge, the skid and the ice
 * quicker, since an edge set is a moment. */
export const SNOW_GLIDE: Record<SnowLayer, number> = {
  hiss: 0.08,
  powder: 0.1,
  edge: 0.05,
  chatter: 0.04,
  skid: 0.06,
  crunch: 0.07,
  slush: 0.1,
  scrape: 0.04,
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Take a value from `lo`..`hi` to 0..1. */
function ramp(value: number, lo: number, hi: number): number {
  return clamp01((value - lo) / (hi - lo));
}

/** How FIRM the snow is under the steel, 0..1: what the edge tears on and
 * the chatter comes off. A groomer firms up with the speed the edge is
 * driven into it at; the crust is firm at any speed; the ice is boilerplate. */
export function firmness(under: SnowUnder, pace: number): number {
  return clamp01(
    under.ice + 0.8 * under.hard + under.groomed * (0.3 + 0.7 * clamp01(pace)) + 0.15 * under.wet,
  );
}

/** Where every layer of the snow should be for `voice`, heard from `mix`. */
export function snowTargets(voice: SnowVoice, mix: SnowMix): Record<SnowLayer, LayerTarget> {
  const u = voice.under;
  const ski = voice.ski;
  const pace = clamp01(voice.pace);
  const on = voice.airborne ? 0 : clamp01(voice.grounded);
  const moving = ramp(voice.speed, 0, 3);
  const plough = 1 - 0.6 * ramp(voice.speed, 3, PLANE_SPEED);
  const edge = clamp01(voice.edge);
  const skid = clamp01(voice.skid);
  const chatter = ramp(voice.speed, CHATTER_FROM, CHATTER_FULL);
  const firm = firmness(u, pace);
  const groomed = clamp01(u.groomed);
  const hard = clamp01(u.hard);
  const loose = clamp01(u.soft + u.new);
  const fresh = loose > 0 ? clamp01(u.new) / loose : 0;
  const wet = clamp01(u.wet);
  const ice = clamp01(u.ice);
  // What the steel can bite on — everything but the loose snow.
  const bite = clamp01(groomed + hard + ice + 0.5 * wet);
  const level = on * mix.snow;
  return {
    // THE HISS is the groomer's: a long ski's base drones lower on it.
    hiss: {
      level: level * groomed * moving * (0.004 + 0.02 * Math.pow(pace, 1.2)),
      cutoff: (1800 + 3600 * pace) * (1.12 - 0.24 * ski.length),
    },
    // THE HUSH of loose snow — a fat ski throws a broader, darker one, and
    // new snow swallows a third of it.
    powder: {
      level:
        level *
        loose *
        moving *
        plough *
        (0.012 + 0.02 * pace) *
        (0.85 + 0.35 * ski.width) *
        (1 - 0.35 * fresh),
      cutoff: (260 + 700 * pace) * (1.1 - 0.25 * ski.width) * (1 - 0.3 * fresh),
    },
    // THE EDGE bites on what will hold it: the harder the edge and the
    // faster, the more it tears — and a skidded ski is not carving. On ice
    // the tear gives way to the scrape.
    edge: {
      level:
        level *
        (groomed + hard + 0.4 * wet) *
        edge *
        (1 - 0.7 * skid) *
        ramp(voice.speed, 3, 25) *
        0.014,
      cutoff: (2600 + 2400 * pace) * (0.9 + 0.2 * ski.flex),
    },
    // THE CHATTER is the edge skipping on firm snow at speed: nothing on
    // soft snow, nothing slow. A soft ski cannot damp it; a stiff one rings
    // at a higher mode.
    chatter: {
      level: level * bite * firm * edge * chatter * chatter * 0.012 * (1.3 - 0.6 * ski.flex),
      cutoff: (900 + 1400 * chatter) * (0.8 + 0.45 * ski.flex),
    },
    // THE SKID scrapes: with the brake, with the speed the skis are being
    // dragged across the snow at — a firm surface rasps, a loose one sprays.
    skid: {
      level: level * skid * ramp(voice.speed, 1, 20) * (0.006 + 0.016 * bite),
      cutoff: 500 + 1200 * pace + 600 * skid + 500 * firm,
    },
    // THE CRUST breaking under the skis, louder driven into it on an edge
    // or thrown across it in a skid.
    crunch: {
      level: level * hard * moving * (0.014 + 0.018 * pace) * (0.7 + 0.3 * edge + 0.5 * skid),
      cutoff: 1100 + 900 * pace + 400 * skid,
    },
    // THE SLUSH drags: loudest slow, where the skis are wading in it, and
    // heavier across the way.
    slush: {
      level: level * wet * moving * (0.012 + 0.006 * pace) * (1 - 0.4 * pace) * (1 + 0.6 * skid),
      cutoff: 420 + 520 * pace,
    },
    // THE ICE screeches under the steel — with the edge set or the skis
    // thrown across it, and not at all on a flat base running straight.
    scrape: {
      level:
        level *
        ice *
        ramp(voice.speed, 2, 22) *
        Math.max(edge * (1 - 0.5 * skid), skid) *
        0.018 *
        (0.8 + 0.4 * ski.flex),
      cutoff: 3000 + 1500 * pace + 400 * ski.flex,
    },
  };
}
