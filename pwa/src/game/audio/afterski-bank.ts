// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AFTERSKI'S MOMENTS — the `afterski` event's one-shots (the lodge's
// door, a beer, out again) and the `fetch` event's (a buzzed skier getting
// up off the snow, a ski picked up, the boots clicked back into the
// bindings). The room inside is a bed of its own (`afterski-bed.ts`); these
// are the edges on it.
//
// Glass keeps its edges and wood its knock; the snow outside swallows its
// own, as everywhere in the bank.

import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";

export const AFTERSKI_BANK: SoundBank = {
  afterski_in: {
    description:
      "Through the lodge's door: the heavy wooden door knocking shut behind " +
      "him, and the room swelling up over it — a warm brown roar of voices " +
      "opening over a third of a second, with a cheer on top of it.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 110,
        to: 70,
        durationMs: 140,
        volume: 0.05,
        drive: 0.4,
        attackMs: 3,
      },
      {
        call: "noise",
        durationMs: 60,
        volume: 0.03,
        color: "brown",
        filter: { type: "lowpass", frequency: 900 },
      },
      {
        call: "noise",
        durationMs: 900,
        volume: 0.045,
        color: "pink",
        delayMs: 80,
        attackMs: 280,
        filter: { type: "bandpass", frequency: 700, q: 0.8 },
      },
      {
        call: "noise",
        durationMs: 500,
        volume: 0.025,
        color: "pink",
        delayMs: 260,
        attackMs: 120,
        filter: { type: "bandpass", frequency: 1600, to: 1300, q: 1.5 },
      },
    ],
  },
  afterski_beer: {
    description:
      "A beer: two glasses clinked — a bright pair of sine partials ringing " +
      "off — then the gulp, three low wet swallows going down, and a short " +
      "cheer from the table thrown up behind it.",
    voices: [
      { call: "tone", type: "sine", from: 2630, to: 2600, durationMs: 260, volume: 0.03 },
      { call: "tone", type: "sine", from: 4180, to: 4150, durationMs: 180, volume: 0.016 },
      {
        call: "noise",
        durationMs: 12,
        volume: 0.03,
        color: "white",
        filter: { type: "highpass", frequency: 3000 },
      },
      {
        call: "tone",
        type: "sine",
        from: 180,
        to: 120,
        durationMs: 90,
        volume: 0.04,
        delayMs: 420,
      },
      {
        call: "tone",
        type: "sine",
        from: 170,
        to: 115,
        durationMs: 90,
        volume: 0.04,
        delayMs: 620,
      },
      {
        call: "tone",
        type: "sine",
        from: 175,
        to: 110,
        durationMs: 110,
        volume: 0.04,
        delayMs: 820,
      },
      {
        call: "noise",
        durationMs: 600,
        volume: 0.03,
        color: "pink",
        delayMs: 1050,
        attackMs: 90,
        filter: { type: "bandpass", frequency: 1400, to: 1100, q: 1.4 },
      },
    ],
  },
  afterski_out: {
    description:
      "Out of the lodge: the room's roar cut off by the door swinging shut, " +
      "a knock of wood and the latch, and the cold outside — a soft pink " +
      "breath of wind with nothing under it.",
    voices: [
      {
        call: "noise",
        durationMs: 260,
        volume: 0.035,
        color: "pink",
        filter: { type: "bandpass", frequency: 700, q: 0.8 },
      },
      {
        call: "tone",
        type: "sine",
        from: 105,
        to: 68,
        durationMs: 140,
        volume: 0.05,
        drive: 0.4,
        delayMs: 220,
      },
      {
        call: "noise",
        durationMs: 25,
        volume: 0.025,
        color: "white",
        delayMs: 240,
        filter: { type: "bandpass", frequency: 2600, q: 3 },
      },
      {
        call: "noise",
        durationMs: 700,
        volume: 0.02,
        color: "pink",
        delayMs: 300,
        attackMs: 200,
        filter: { type: "lowpass", frequency: 1200 },
      },
    ],
  },
  fetch_up: {
    description:
      "Getting up off the snow in his boots: a grunt-like low swell of " +
      "driven sine, the snow creaking and sliding off his jacket as a brown " +
      "and pink shuffle, slow, with no transient at all.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 130,
        to: 160,
        durationMs: 300,
        volume: 0.03,
        drive: 0.5,
        attackMs: 60,
      },
      {
        call: "noise",
        durationMs: 500,
        volume: 0.03,
        color: "brown",
        attackMs: 80,
        filter: { type: "lowpass", frequency: 600, to: 300 },
      },
      {
        call: "noise",
        durationMs: 400,
        volume: 0.018,
        color: "pink",
        delayMs: 200,
        attackMs: 60,
        filter: { type: "bandpass", frequency: 1800, q: 1 },
      },
    ],
  },
  fetch_ski: {
    description:
      "A ski picked up off the snow: its edge scraping free, a hollow knock " +
      "of the plastic topsheet against his glove and shoulder, and the " +
      "snow brushed off it as a short pink hiss.",
    voices: [
      {
        call: "noise",
        durationMs: 120,
        volume: 0.025,
        color: "white",
        filter: { type: "bandpass", frequency: 3200, to: 2400, q: 2 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 420,
        to: 300,
        durationMs: 70,
        volume: 0.035,
        drive: 0.3,
        delayMs: 140,
      },
      {
        call: "noise",
        durationMs: 200,
        volume: 0.02,
        color: "pink",
        delayMs: 180,
        filter: { type: "highpass", frequency: 1500 },
      },
    ],
  },
  fetch_in: {
    description:
      "Back into the bindings: the boot's toe set in and the heel stamped " +
      "down, twice — the hard snap of the heel piece closing, a metallic " +
      "click with a short ring — and he is on his skis again.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 95,
        to: 60,
        durationMs: 90,
        volume: 0.04,
        drive: 0.35,
      },
      {
        call: "noise",
        durationMs: 18,
        volume: 0.035,
        color: "white",
        delayMs: 180,
        filter: { type: "bandpass", frequency: 3400, q: 4 },
      },
      {
        call: "tone",
        type: "square",
        from: 1900,
        to: 1500,
        durationMs: 40,
        volume: 0.02,
        delayMs: 182,
      },
      {
        call: "noise",
        durationMs: 18,
        volume: 0.035,
        color: "white",
        delayMs: 520,
        filter: { type: "bandpass", frequency: 3200, q: 4 },
      },
      {
        call: "tone",
        type: "square",
        from: 1800,
        to: 1450,
        durationMs: 40,
        volume: 0.02,
        delayMs: 522,
      },
    ],
  },
};
