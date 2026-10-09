// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIS OFF IN TOWN — the `town` event's one-shots (`engine/game/town.ts`):
// a heel piece pressed open with the pole and the boot stepped out, the
// pair's bases clapped together, the pair swung up onto the shoulder, his
// boots on the gritted street, the pair laid down on the snow and the heel
// piece snapped shut as he steps back in. The stop on his edges is the
// ride's own scrape; nothing is added for it.
//
// A ski boot on a street is hard plastic on grit — a short knock with a
// crunch under it, never a shoe's soft tread; the bindings are steel on
// steel.

import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";

export const TOWN_BANK: SoundBank = {
  town_heel: {
    description:
      "Out of a binding: the pole's tip pressed on the heel piece's lever — " +
      "a dull metallic clack as it springs open — and the boot lifted out " +
      "of the snow under it as a short brown scuff.",
    voices: [
      {
        call: "noise",
        durationMs: 22,
        volume: 0.03,
        color: "white",
        filter: { type: "bandpass", frequency: 2600, q: 3 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 760,
        to: 520,
        durationMs: 60,
        volume: 0.025,
        drive: 0.3,
      },
      {
        call: "noise",
        durationMs: 180,
        volume: 0.02,
        color: "brown",
        delayMs: 120,
        attackMs: 20,
        filter: { type: "lowpass", frequency: 700 },
      },
    ],
  },
  town_clap: {
    description:
      "The pair's bases clapped together to stick them base to base: a " +
      "hard flat knock of the two skis meeting, and the snow knocked off " +
      "them as a short pink hiss falling away.",
    voices: [
      {
        call: "noise",
        durationMs: 30,
        volume: 0.045,
        color: "white",
        filter: { type: "bandpass", frequency: 1400, q: 1.5 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 330,
        to: 240,
        durationMs: 80,
        volume: 0.035,
        drive: 0.4,
      },
      {
        call: "noise",
        durationMs: 260,
        volume: 0.018,
        color: "pink",
        delayMs: 40,
        filter: { type: "highpass", frequency: 1800 },
      },
    ],
  },
  town_shoulder: {
    description:
      "The pair swung up onto his shoulder: a swish of air and the jacket's " +
      "nylon, then a soft low thud as the skis settle on the shoulder pad.",
    voices: [
      {
        call: "noise",
        durationMs: 260,
        volume: 0.018,
        color: "pink",
        attackMs: 120,
        filter: { type: "bandpass", frequency: 1600, to: 900, q: 0.8 },
      },
      {
        call: "tone",
        type: "sine",
        from: 120,
        to: 80,
        durationMs: 110,
        volume: 0.045,
        drive: 0.3,
        delayMs: 220,
      },
      {
        call: "noise",
        durationMs: 70,
        volume: 0.02,
        color: "brown",
        delayMs: 220,
        filter: { type: "lowpass", frequency: 500 },
      },
    ],
  },
  town_step: {
    description:
      "A ski boot set down on the gritted street: the hard plastic sole's " +
      "short knock with a crunch of grit and packed snow under it — quiet, " +
      "one for every step he takes.",
    voices: [
      {
        call: "tone",
        type: "triangle",
        from: 210,
        to: 150,
        durationMs: 45,
        volume: 0.018,
        drive: 0.25,
      },
      {
        call: "noise",
        durationMs: 110,
        volume: 0.016,
        color: "white",
        attackMs: 4,
        filter: { type: "bandpass", frequency: 2200, q: 1.2 },
      },
    ],
  },
  town_lay: {
    description:
      "The pair laid down on the snow side by side: two soft knocks of the " +
      "skis landing a beat apart, and the snow pressing under them.",
    voices: [
      {
        call: "tone",
        type: "triangle",
        from: 260,
        to: 190,
        durationMs: 60,
        volume: 0.025,
        drive: 0.3,
      },
      {
        call: "tone",
        type: "triangle",
        from: 240,
        to: 180,
        durationMs: 60,
        volume: 0.022,
        drive: 0.3,
        delayMs: 140,
      },
      {
        call: "noise",
        durationMs: 220,
        volume: 0.016,
        color: "brown",
        delayMs: 30,
        filter: { type: "lowpass", frequency: 900 },
      },
    ],
  },
  town_snap: {
    description:
      "A boot stamped back into its binding: the toe set in with a low " +
      "knock, then the heel piece snapping shut — a hard metallic click " +
      "with a short ring.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 95,
        to: 60,
        durationMs: 80,
        volume: 0.035,
        drive: 0.35,
      },
      {
        call: "noise",
        durationMs: 18,
        volume: 0.035,
        color: "white",
        delayMs: 70,
        filter: { type: "bandpass", frequency: 3400, q: 4 },
      },
      {
        call: "tone",
        type: "square",
        from: 1900,
        to: 1500,
        durationMs: 40,
        volume: 0.02,
        delayMs: 72,
      },
    ],
  },
};
