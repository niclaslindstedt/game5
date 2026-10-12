// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI JUMP, HEARD (R43) — the jump's own beds as layers and the stadium's
// crowd round the out-run, a pure function of where the jumper is in his
// jump (`SkiJumpState`), so the suite reads it and the audition page drives
// it from sliders. The scheduler is `jump-bed.ts`; the one-shots (the start
// signal, off the bar, the take-off, the landing's slap and the telemark)
// are `jump-bank.ts`'s.
//
// WHAT A JUMP SOUNDS LIKE, from the stands and from the hill's own lenses:
//
//   * ON THE TRACKS the skis run in two grooves cut in ice (or in a cooled
//     track), and it is not a skier's hiss on a piste: the bases are held
//     in the groove, so the sound is a narrow, steady HISS climbing in
//     pitch as he gathers speed toward 90 km/h, a low RUMBLE of the tracks
//     under it, and a thin WHIR — the steel edges ringing in the ice — that
//     climbs with it. Nothing else changes: the in-run is the same all the
//     way down, the speed is all that moves.
//   * IN THE AIR the snow is gone and it is the WIND: a broad rush round
//     the body laid out over the skis, swelling with the square of the
//     speed and opening as the skis spread into the V (the V is a wing,
//     the air torn off its trailing edges), a low FLUTTER of the skis'
//     tails shaking in it, and a thin WHISTLE off the V's edges.
//   * THE CROWD in the stadium below is a MURMUR while the jumper is up on
//     the hill, rising as he flies past the middle of the landing hill and
//     breaking into a ROAR when he lands — a short jump a polite cheer, a
//     jump to K a roar, one past HS the stadium on its feet; a fall a
//     groan. It is heard from where the jumper is: faint from the bar two
//     hundred metres up, all round him in the out-run.
//
// The out-run itself is the ride bed's: the skis on the snow (`snow-voice.ts`)
// under the crowd, as on any run — the jump's beds hand it back once he is
// down (`chute-bed.ts`'s `rideShares`).

import type { LayerSpec, LayerTarget } from "@niclaslindstedt/oss-game-framework/audio/voice";

/** The speeds the beds are scaled to, m/s: the in-run's top on a large
 * hill (about 26 m/s at the edge) and the flight's at the knoll's foot. */
export const JUMP_TRACK_FULL = 27;
export const JUMP_FLIGHT_FULL = 30;

/** The jump against the ear at one instant. */
export type JumpVoice = {
  /** Where he is: on the tracks, in the air, or neither (0 both). */
  tracks: number;
  air: number;
  /** His speed, m/s — along the tracks, or through the air. */
  speed: number;
  /** How far the V is open, 0..1, and how far he has laid out over the
   * skis, 0..1 (`SkiJumpState.vee`, `.lay`). */
  vee: number;
  lay: number;
  /** The engine's clock, s — the flutter's shake is a beat on it. */
  t: number;
  /** THE CROWD, as `crowdOf` reads it: how near the stadium the ear is,
   * 0..1, how hard it is roaring, 0..1, and whether that is a groan. */
  near: number;
  roar: number;
  groan: number;
};

export type JumpLayer =
  "groove" | "rumble" | "whir" | "rush" | "flutter" | "whistle" | "murmur" | "roar" | "body";

/** What each layer is BUILT from — decided once. */
export const JUMP_LAYERS: Record<JumpLayer, LayerSpec> = {
  groove: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 1.6 } },
  rumble: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.9 } },
  whir: {
    kind: "tone",
    type: "triangle",
    detuneCents: 9,
    drive: 0.25,
    filter: { type: "bandpass", q: 3 },
  },
  rush: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.6 } },
  flutter: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 1.4 } },
  whistle: { kind: "noise", color: "white", filter: { type: "bandpass", q: 7 } },
  murmur: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 1.1 }, echo: 0.15 },
  roar: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.7 }, echo: 0.25 },
  body: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.7 } },
};

/** How fast each layer follows, s: the tracks follow the speed close, the
 * wind opens over the take-off, and the crowd swells and dies as a crowd
 * does — never a switch. */
export const JUMP_GLIDE: Record<JumpLayer, number> = {
  groove: 0.06,
  rumble: 0.08,
  whir: 0.06,
  rush: 0.18,
  flutter: 0.1,
  whistle: 0.2,
  murmur: 0.8,
  roar: 0.35,
  body: 0.45,
};

const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));

/** Where every layer should be for `voice`: through the seat's wind (the
 * air), its snow (the tracks) and its events (the crowd, a sound out in
 * the world as the one-shots are). */
export function jumpTargets(
  voice: JumpVoice,
  mix: { wind: number; snow: number; events: number },
): Record<JumpLayer, LayerTarget> {
  const track = clamp(voice.speed / JUMP_TRACK_FULL, 0, 1.15) * clamp(voice.tracks);
  const fly = clamp(voice.speed / JUMP_FLIGHT_FULL, 0, 1.2) * clamp(voice.air);
  const vee = clamp(voice.vee);
  const lay = clamp(voice.lay);
  // The flutter shakes on two beats, so it never settles into a pulse.
  const shake = 0.55 + 0.3 * Math.sin(voice.t * 19) + 0.15 * Math.sin(voice.t * 31 + 0.7);
  const near = clamp(voice.near);
  const roar = clamp(voice.roar);
  const groan = clamp(voice.groan);
  return {
    groove: {
      level: track ** 1.5 * 0.034 * mix.snow,
      cutoff: 900 + 1900 * track,
    },
    rumble: {
      level: track * 0.03 * mix.snow,
      cutoff: 90 + 160 * track,
    },
    whir: {
      level: track * track * 0.006 * mix.snow,
      hz: 260 + 520 * track,
      cutoff: 300 + 1100 * track,
      grit: track,
    },
    rush: {
      level: fly * fly * (0.03 + 0.016 * vee) * mix.wind,
      cutoff: 520 + 900 * fly + 700 * vee,
    },
    flutter: {
      level: fly * (0.004 + 0.012 * vee * lay) * shake * mix.wind,
      cutoff: 110 + 120 * fly,
    },
    whistle: {
      level: fly * fly * vee * 0.004 * mix.wind,
      cutoff: 2200 + 1400 * fly,
    },
    murmur: {
      level: near * 0.012 * (1 - 0.6 * roar) * mix.events,
      cutoff: 700 + 200 * near,
    },
    roar: {
      level: near * roar * (0.05 - 0.02 * groan) * mix.events,
      cutoff: 900 + 1200 * roar * (1 - 0.6 * groan),
    },
    body: {
      level: near * roar * 0.03 * mix.events,
      cutoff: 180 + 160 * roar,
    },
  };
}

/** THE CROWD'S NUMBERS: how far from the stadium's middle it is heard full,
 * m, and the least it is heard from the bar; the jump's EXCITEMENT at a
 * share of K and at HS; the roar's swell, hold and fall after the touch, s;
 * and how much of it a fall is. */
export const JUMP_CROWD = {
  ref: 70,
  least: 0.08,
  under: { at: 0.8, roar: 0.3 },
  k: 0.65,
  hs: 1,
  swell: 0.4,
  hold: 1.6,
  fall: 3.2,
  /** In the air the crowd rises with him from P toward HS, to this share. */
  rising: 0.45,
  fell: 0.55,
} as const;

/** How hard a jump to `distance` m makes the stadium roar, 0..1, on a hill
 * of K point `k` and size `hs` m: a polite cheer short of K, a roar at K,
 * the stadium on its feet at HS and past it. */
export function jumpExcitement(distance: number, k: number, hs: number): number {
  const C = JUMP_CROWD;
  const short = C.under.at * k;
  if (distance <= short) return C.under.roar * clamp(distance / short);
  if (distance <= k)
    return C.under.roar + ((C.k - C.under.roar) * (distance - short)) / (k - short);
  if (distance <= hs) return C.k + ((C.hs - C.k) * (distance - k)) / Math.max(1, hs - k);
  return C.hs;
}

/** THE CROWD at a moment, 0..1: rising while he is still in the air past P
 * (`flown` m of the landing hill's distance, null not in the air), then the
 * roar of the landing `since` s after the touch (null not landed) at the
 * jump's `distance`, a groan when he `fell`. */
export function crowdRoar(
  hill: { p: number; k: number; hs: number },
  flown: number | null,
  landed: { distance: number; since: number; fell: boolean } | null,
): { roar: number; groan: number } {
  const C = JUMP_CROWD;
  if (landed && landed.since >= 0) {
    const s = landed.since;
    const peak = jumpExcitement(landed.distance, hill.k, hill.hs) * (landed.fell ? C.fell : 1);
    const env =
      s < C.swell
        ? s / C.swell
        : s < C.swell + C.hold
          ? 1
          : Math.exp(-(s - C.swell - C.hold) / C.fall);
    // The rise in the air carries into the landing's swell, never a dip.
    const carried = C.rising * clamp((landed.distance - hill.p) / Math.max(1, hill.hs - hill.p));
    return { roar: Math.max(peak * env, s < C.swell ? carried : 0), groan: landed.fell ? 1 : 0 };
  }
  if (flown !== null) {
    const past = clamp((flown - hill.p) / Math.max(1, hill.hs - hill.p));
    return { roar: C.rising * past * past, groan: 0 };
  }
  return { roar: 0, groan: 0 };
}

/** How near the stadium an ear `d` m from its middle is, 0..1. */
export function crowdNear(d: number): number {
  return Math.max(JUMP_CROWD.least, Math.min(1, JUMP_CROWD.ref / Math.max(1, d)));
}
