// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKIER SET ALIGHT — the `fire` event's one-shots (`engine/game/fire-burn.ts`):
// the WHOOMPH of his clothes catching as he goes through the hearth, and the
// SIZZLE of the burn put out (burnt out, or stood up on a reset). The fire
// on him between the two is the bed's (`burn-bed.ts`). No voice of his: a
// body burning is heard as the fire.
//
// A synthetic shell going up is a gust of flame — a low soft thud of air
// drawn in, a brown roar swelling and falling away over half a second, and
// the first crackle of the melting cloth on top.

import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";

export const FIRE_BANK: SoundBank = {
  fire_catch: {
    description:
      "His clothes catch: a low soft thud of air drawn into the flame, a " +
      "brown roar swelling over a tenth of a second and falling away, and a " +
      "bright crackle of melting cloth on top.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 70,
        to: 38,
        durationMs: 260,
        volume: 0.07,
        attackMs: 30,
      },
      {
        call: "noise",
        durationMs: 700,
        volume: 0.08,
        color: "brown",
        attackMs: 90,
        filter: { type: "lowpass", frequency: 520, q: 0.9 },
      },
      {
        call: "noise",
        durationMs: 520,
        volume: 0.035,
        color: "pink",
        delayMs: 40,
        attackMs: 60,
        filter: { type: "bandpass", frequency: 900, q: 0.6 },
      },
      {
        call: "noise",
        durationMs: 40,
        volume: 0.03,
        color: "white",
        delayMs: 160,
        filter: { type: "highpass", frequency: 2400 },
      },
    ],
  },
  fire_out: {
    description:
      "The burn out: a soft wet hiss of the last flames dying on the snow, " +
      "falling away over half a second.",
    voices: [
      {
        call: "noise",
        durationMs: 600,
        volume: 0.03,
        color: "white",
        attackMs: 20,
        filter: { type: "bandpass", frequency: 3200, q: 0.8 },
      },
      {
        call: "noise",
        durationMs: 400,
        volume: 0.025,
        color: "brown",
        filter: { type: "lowpass", frequency: 300 },
      },
    ],
  },
};
