// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIND TUNNEL, HEARD — the gale a skier is blown down the valley floor
// in (`wind-tunnel-plan.ts`), as three layers and two one-shots.
//
//   GALE  the roar of the lane: a broad pink band that opens as he goes
//         in and WAVERS on a slow beat — the air buffeting off the arches
//         — loudest in the middle of the lane, a murmur from beside it
//   BODY  the brown weight under it, the pressure of a column of air that
//         is moving; it is what makes the gale sound big rather than bright
//   FAN   the fan's motor at the entrance: a low detuned saw through a
//         lowpass, loud by the cowl and gone a hundred metres down
//
// And the two moments the engine says he is taken in and let go (its
// `tunnel` event, `route.ts`): the WHOOSH in (a pink sweep opening upward
// over a brown swell — sucked in) and the one out (the sweep falling away
// as the air lets go of him).
//
// The bed is a pure function of where the skier stands against the nearest
// tunnel, so the suite reads it and the audition page drives it from a
// slider; the scheduler is `ride-bed.ts`, which plays it through the wind's
// fader — it IS wind — and builds it only on a map with a tunnel on it.

import type { LayerSpec, LayerTarget } from "@niclaslindstedt/oss-game-framework/audio/voice";
import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";

/** How far outside a lane its gale is heard at all, m. */
export const TUNNEL_HEARD = 30;

/** The share of the gale heard from beside a lane, at its edge. */
const OUTSIDE = 0.3;

/** How far down a lane the fan's motor carries, m. */
const FAN_REACH = 90;

/** One skier against the nearest tunnel at one instant. */
export type TunnelVoice = {
  /** How much in it he is, 0..1: 1 in the lane, falling off beside it. */
  presence: number;
  /** How near the fan, 0..1: 1 at the mouth. */
  fan: number;
  /** The engine's clock, s — the gale's waver is a beat on it. */
  t: number;
};

export type TunnelLayer = "gale" | "body" | "fan";

/** What each layer is BUILT from — decided once. */
export const TUNNEL_LAYERS: Record<TunnelLayer, LayerSpec> = {
  gale: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.7 } },
  body: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.8 } },
  fan: {
    kind: "tone",
    type: "sawtooth",
    detuneCents: 14,
    drive: 0.3,
    filter: { type: "lowpass", q: 1.2 },
  },
};

/** How fast each layer follows, s: the gale opens like a door of air, not
 * a switch, and the body a little slower behind it. */
export const TUNNEL_GLIDE: Record<TunnelLayer, number> = { gale: 0.3, body: 0.45, fan: 0.3 };

/** The voice of a skier `out` m outside a lane `s` m down it (`out` 0 is
 * in it); null for no tunnel within `TUNNEL_HEARD`. */
export function tunnelVoiceAt(hit: { out: number; s: number } | null, t: number): TunnelVoice {
  if (!hit) return { presence: 0, fan: 0, t };
  const presence = hit.out <= 0 ? 1 : OUTSIDE * Math.max(0, 1 - hit.out / TUNNEL_HEARD);
  const fan = Math.max(0, 1 - Math.max(0, hit.s) / FAN_REACH) * Math.min(1, presence * 2);
  return { presence, fan, t };
}

/** Where every layer should be for `voice`, through the seat's wind. */
export function tunnelTargets(
  voice: TunnelVoice,
  mix: { wind: number },
): Record<TunnelLayer, LayerTarget> {
  const p = Math.min(1, Math.max(0, voice.presence));
  // Two beats a little apart, so the buffeting never settles into a pulse.
  const waver = 0.5 + 0.3 * Math.sin(voice.t * 2.3) + 0.2 * Math.sin(voice.t * 5.1 + 1.3);
  return {
    gale: {
      level: p * p * (0.03 + 0.012 * waver) * mix.wind,
      cutoff: 500 + 1300 * p + 500 * waver * p,
    },
    body: {
      level: p * 0.04 * mix.wind,
      cutoff: 140 + 120 * p,
    },
    fan: {
      level: voice.fan * 0.012 * mix.wind,
      hz: 48 + 6 * voice.fan,
      cutoff: 260 + 260 * voice.fan,
      grit: voice.fan,
    },
  };
}

/** THE MOUTH CROSSED, in and out — the `tunnel` event's two sounds. */
export const TUNNEL_BANK: SoundBank = {
  tunnel_in: {
    description:
      "Blown into a wind tunnel: the air takes the skier — a pink band " +
      "sweeping UP from low to bright as it swells open over a tenth of a " +
      "second, under a brown swell of pressure, so it is heard as being " +
      "sucked in rather than as a hit.",
    voices: [
      {
        call: "noise",
        durationMs: 650,
        volume: 0.05,
        color: "pink",
        attackMs: 120,
        holdMs: 120,
        filter: { type: "bandpass", frequency: 420, to: 3200, q: 0.9 },
      },
      {
        call: "noise",
        durationMs: 700,
        volume: 0.045,
        color: "brown",
        attackMs: 160,
        filter: { type: "lowpass", frequency: 160, to: 420 },
      },
    ],
  },
  tunnel_out: {
    description:
      "Out of the far end of a wind tunnel: the air lets go — the pink " +
      "band falls away from bright to low and the brown pressure drains " +
      "out under it, the gale left behind.",
    voices: [
      {
        call: "noise",
        durationMs: 700,
        volume: 0.04,
        color: "pink",
        attackMs: 30,
        filter: { type: "bandpass", frequency: 2600, to: 380, q: 0.9 },
      },
      {
        call: "noise",
        durationMs: 600,
        volume: 0.03,
        color: "brown",
        attackMs: 20,
        filter: { type: "lowpass", frequency: 380, to: 120 },
      },
    ],
  },
};
