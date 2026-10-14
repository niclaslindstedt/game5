// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE'S MOMENTS — the `bike` event's one-shots (`bike.ts`):
// a leg over and the cleats clipped, a foot down and off it, the bike
// picked up off the ground, hooked onto a chair, a LANDING taken on the
// suspension (the fork and the shock bottoming out on a hard one) and the
// CRASH — the bike and the rider hitting the ground, the frame's clatter
// and the dirt. `route.ts` scales them by the distance and the speed.

import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";

export const BIKE_BANK: SoundBank = {
  bike_board: {
    description:
      "A leg over and away: the saddle's creak under a hand, a shoe's sole " +
      "on the pedal's pins, and the freehub's quick ratchet as the cranks " +
      "are backpedalled into place.",
    voices: [
      {
        call: "noise",
        durationMs: 70,
        volume: 0.025,
        color: "pink",
        filter: { type: "bandpass", frequency: 900, q: 2 },
      },
      {
        call: "noise",
        durationMs: 25,
        volume: 0.03,
        color: "white",
        delayMs: 160,
        filter: { type: "bandpass", frequency: 3400, q: 3 },
      },
      {
        call: "tone",
        type: "square",
        from: 38,
        to: 30,
        durationMs: 260,
        volume: 0.01,
        delayMs: 260,
        filter: { type: "highpass", frequency: 3000, q: 2 },
      },
    ],
  },

  bike_hop: {
    description:
      "A foot down and off it: a shoe scuffing onto the dirt and the bike " +
      "let down onto its side — a hollow knock of the frame and the bars.",
    voices: [
      {
        call: "noise",
        durationMs: 90,
        volume: 0.03,
        color: "brown",
        filter: { type: "lowpass", frequency: 700 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 420,
        to: 300,
        durationMs: 110,
        volume: 0.02,
        delayMs: 260,
      },
      {
        call: "noise",
        durationMs: 120,
        volume: 0.025,
        color: "pink",
        delayMs: 260,
        filter: { type: "bandpass", frequency: 1600, q: 1.5 },
      },
    ],
  },

  bike_right: {
    description:
      "The bike picked up off the ground: the bars swung round, a wheel " +
      "spun free with the hub ticking, and the tyres set down on the dirt.",
    voices: [
      {
        call: "tone",
        type: "square",
        from: 44,
        to: 18,
        durationMs: 520,
        volume: 0.01,
        filter: { type: "highpass", frequency: 3000, q: 2 },
      },
      {
        call: "noise",
        durationMs: 120,
        volume: 0.035,
        color: "brown",
        delayMs: 380,
        filter: { type: "lowpass", frequency: 500 },
      },
    ],
  },

  bike_lift: {
    description:
      "The bike hooked onto the chair: the wheel dropped into the carrier's " +
      "hook with a steel clank and a rattle of the chain.",
    voices: [
      {
        call: "tone",
        type: "triangle",
        from: 980,
        to: 860,
        durationMs: 180,
        volume: 0.02,
        drive: 0.4,
      },
      {
        call: "noise",
        durationMs: 140,
        volume: 0.02,
        color: "white",
        delayMs: 60,
        filter: { type: "bandpass", frequency: 2200, q: 2.5 },
      },
    ],
  },

  bike_land: {
    description:
      "Down off a jump: both tyres slapping the dirt, the fork and the shock " +
      "taking it — a deep thunk of the suspension, and the chain slapping the " +
      "stay.",
    voices: [
      {
        call: "noise",
        durationMs: 90,
        volume: 0.045,
        color: "brown",
        filter: { type: "lowpass", frequency: 600 },
      },
      {
        call: "tone",
        type: "sine",
        from: 95,
        to: 55,
        durationMs: 160,
        volume: 0.05,
        drive: 0.3,
      },
      {
        call: "noise",
        durationMs: 110,
        volume: 0.02,
        color: "white",
        delayMs: 30,
        filter: { type: "bandpass", frequency: 2000, q: 2.4 },
      },
    ],
  },

  bike_bottom: {
    description:
      "Landed hard: the suspension bottoming out on its stops — a heavy " +
      "metallic clack over the thunk, the frame ringing.",
    voices: [
      {
        call: "noise",
        durationMs: 110,
        volume: 0.06,
        color: "brown",
        filter: { type: "lowpass", frequency: 500 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 640,
        to: 520,
        durationMs: 220,
        volume: 0.025,
        drive: 0.5,
        delayMs: 20,
      },
      {
        call: "tone",
        type: "sine",
        from: 80,
        to: 42,
        durationMs: 240,
        volume: 0.07,
        drive: 0.4,
      },
    ],
  },

  bike_crash: {
    description:
      "The bike and the rider going down: a body on the dirt, the frame and " +
      "the bars clattering, the chain thrashing, and a long scrape of tyres " +
      "and stones as it all slides to a stop.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 100,
        to: 45,
        durationMs: 300,
        volume: 0.07,
        drive: 0.4,
      },
      {
        call: "noise",
        durationMs: 160,
        volume: 0.06,
        color: "white",
        filter: { type: "bandpass", frequency: 2400, to: 1300, q: 1.6 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 860,
        to: 700,
        durationMs: 260,
        volume: 0.02,
        delayMs: 60,
      },
      {
        call: "noise",
        durationMs: 80,
        volume: 0.03,
        color: "white",
        delayMs: 240,
        filter: { type: "bandpass", frequency: 3000, q: 4 },
      },
      {
        call: "noise",
        durationMs: 900,
        volume: 0.05,
        color: "pink",
        attackMs: 20,
        holdMs: 150,
        delayMs: 80,
        filter: { type: "bandpass", frequency: 1100, to: 350, q: 0.8 },
      },
    ],
  },
};
