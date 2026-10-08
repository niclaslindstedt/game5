// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOT AIR BALLOON'S MOMENTS — the one-shots its bed raises off the
// blast valve's edges (`balloon-bed.ts`) and the `balloon` event's
// (`route.ts`): the valve's clack and the WHOOMP of the gas lighting, the
// clack of it shut, the wicker creaking as he climbs onto the rim and goes
// over, his boots onto the snow as he steps out, the basket set down on the
// snow, and the basket into it too fast.
//
// Wicker is a soft, many-voiced creak — dozens of canes rubbing at once —
// so it is built of short bands of noise rather than any one tone; the
// valve is steel and keeps its edge; the snow swallows its own.

import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";

export const BALLOON_BANK: SoundBank = {
  balloon_valve: {
    description:
      "The blast valve opened: the lever's steel clack, then the WHOOMP of " +
      "the gas catching off the pilot — a low thump bending down under a " +
      "pink burst that swells open as the flame climbs into the mouth.",
    voices: [
      {
        call: "noise",
        durationMs: 18,
        volume: 0.07,
        color: "white",
        filter: { type: "bandpass", frequency: 3200, q: 4 },
      },
      {
        call: "tone",
        type: "sine",
        from: 95,
        to: 48,
        durationMs: 260,
        volume: 0.075,
        drive: 0.35,
        attackMs: 12,
        delayMs: 25,
      },
      {
        call: "noise",
        durationMs: 420,
        volume: 0.07,
        color: "pink",
        attackMs: 45,
        delayMs: 25,
        filter: { type: "bandpass", frequency: 220, to: 900, q: 0.7 },
      },
    ],
  },
  balloon_shut: {
    description:
      "The blast valve let go: a lighter clack of the lever springing shut, " +
      "and the last gas out of the coil puffing as the flame dies.",
    voices: [
      {
        call: "noise",
        durationMs: 14,
        volume: 0.045,
        color: "white",
        filter: { type: "bandpass", frequency: 2600, q: 4 },
      },
      {
        call: "noise",
        durationMs: 220,
        volume: 0.03,
        color: "pink",
        delayMs: 10,
        filter: { type: "bandpass", frequency: 700, to: 300, q: 0.8 },
      },
    ],
  },
  balloon_jump: {
    description:
      "Over the side: the wicker creaking under his boots as he climbs onto " +
      "the rim — a few short bands of noise, canes rubbing — then the rush " +
      "of the air as he drops away.",
    voices: [
      {
        call: "noise",
        durationMs: 90,
        volume: 0.045,
        color: "pink",
        filter: { type: "bandpass", frequency: 650, to: 480, q: 3 },
      },
      {
        call: "noise",
        durationMs: 70,
        volume: 0.035,
        color: "pink",
        delayMs: 80,
        filter: { type: "bandpass", frequency: 1100, to: 800, q: 3 },
      },
      {
        call: "noise",
        durationMs: 700,
        volume: 0.06,
        color: "pink",
        attackMs: 120,
        delayMs: 150,
        filter: { type: "bandpass", frequency: 350, to: 1800, q: 0.9 },
      },
    ],
  },
  balloon_step: {
    description:
      "Out onto the snow: the wicker creaking as he swings a leg over the " +
      "rim, and his boots crunching down into the snow beside the basket.",
    voices: [
      {
        call: "noise",
        durationMs: 110,
        volume: 0.024,
        color: "pink",
        filter: { type: "bandpass", frequency: 600, to: 450, q: 3 },
      },
      {
        call: "noise",
        durationMs: 120,
        volume: 0.036,
        color: "brown",
        delayMs: 260,
        filter: { type: "lowpass", frequency: 900, to: 400, q: 0.8 },
      },
      {
        call: "noise",
        durationMs: 60,
        volume: 0.018,
        color: "white",
        delayMs: 265,
        filter: { type: "bandpass", frequency: 2400, q: 1.5 },
      },
    ],
  },
  balloon_touch: {
    description:
      "The basket set down on the snow: a soft, heavy thump that opens over " +
      "a few milliseconds, the snow taking it, and the wicker creaking as " +
      "the frame settles under the load.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 70,
        to: 42,
        durationMs: 240,
        volume: 0.045,
        drive: 0.3,
        attackMs: 6,
      },
      {
        call: "noise",
        durationMs: 300,
        volume: 0.03,
        color: "brown",
        filter: { type: "lowpass", frequency: 500, to: 220, q: 0.7 },
      },
      {
        call: "noise",
        durationMs: 160,
        volume: 0.015,
        color: "pink",
        delayMs: 90,
        filter: { type: "bandpass", frequency: 700, to: 520, q: 3 },
      },
    ],
  },
  balloon_crash: {
    description:
      "The basket into the snow too fast: a deep slam, the wicker cracking " +
      "and splintering in a burst of short bright bands, the cylinders' " +
      "steel clanging against the frame, and the snow thrown.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 80,
        to: 34,
        durationMs: 420,
        volume: 0.075,
        drive: 0.45,
        attackMs: 3,
      },
      {
        call: "noise",
        durationMs: 500,
        volume: 0.055,
        color: "brown",
        filter: { type: "lowpass", frequency: 900, to: 250, q: 0.7 },
      },
      {
        call: "noise",
        durationMs: 160,
        volume: 0.033,
        color: "white",
        delayMs: 20,
        filter: { type: "bandpass", frequency: 1800, to: 900, q: 2 },
      },
      {
        call: "noise",
        durationMs: 90,
        volume: 0.028,
        color: "white",
        delayMs: 140,
        filter: { type: "bandpass", frequency: 2600, q: 3 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 1450,
        to: 1380,
        durationMs: 380,
        volume: 0.017,
        delayMs: 60,
      },
    ],
  },
};
