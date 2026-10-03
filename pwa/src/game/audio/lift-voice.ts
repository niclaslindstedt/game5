// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFT HEARD — the `lift` event's one-shots (`lift-ride.ts`): the chair
// taking a skier off the load line, its grip running over a tower's sheave
// train — the clatter every rider waits for, a wheel at a time — and the
// skier stood off it at the top. The lifts that are only seen running say
// nothing: their rope is far off, under the wind.

import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";

/** How many sheaves a tower's train carries, and how far apart the grip
 * runs over them at the rope's speed, ms. */
const SHEAVES = 6;
const SHEAVE_MS = 70;

export const LIFT_BANK: SoundBank = {
  lift_board: {
    description:
      "Taken onto a lift: the chair's seat swung in under the skier — a " +
      "low wooden knock on a soft brown bump of the body sitting down, and " +
      "the steel's short ring as the grip pulls away.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 110,
        to: 70,
        durationMs: 160,
        volume: 0.06,
        attackMs: 3,
      },
      {
        call: "noise",
        durationMs: 220,
        volume: 0.05,
        color: "brown",
        filter: { type: "lowpass", frequency: 300 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 880,
        durationMs: 260,
        volume: 0.012,
        delayMs: 120,
      },
    ],
  },
  lift_tower: {
    description:
      "The grip over a tower's sheave train: a run of hard metallic clacks, " +
      "one a wheel, each a short bandpassed knock with a little ring on it, " +
      "under a low rumble of the rope in the sheaves.",
    voices: [
      ...Array.from({ length: SHEAVES }, (_, i) => ({
        call: "noise" as const,
        durationMs: 45,
        volume: 0.05 - i * 0.004,
        color: "white" as const,
        delayMs: i * SHEAVE_MS,
        filter: { type: "bandpass" as const, frequency: 1500 + (i % 2) * 300, q: 3 },
      })),
      {
        call: "noise",
        durationMs: SHEAVES * SHEAVE_MS + 200,
        volume: 0.03,
        color: "brown",
        attackMs: 40,
        filter: { type: "lowpass", frequency: 220 },
      },
    ],
  },
  lift_off: {
    description:
      "Stood off at the top: the skis set down on the ramp — a soft packed " +
      "thump and a short hiss of the bases sliding off.",
    voices: [
      {
        call: "noise",
        durationMs: 180,
        volume: 0.05,
        color: "pink",
        filter: { type: "lowpass", frequency: 700, to: 300 },
      },
      {
        call: "noise",
        durationMs: 420,
        volume: 0.02,
        color: "white",
        attackMs: 60,
        delayMs: 80,
        filter: { type: "highpass", frequency: 2500 },
      },
    ],
  },
};
