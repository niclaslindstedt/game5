// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN ANIMAL RUN INTO, AS HEARD (`engine/game/beast-hit.ts`) — spread into
// `RUN_BANK` beside the run's own. Two sounds, picked by what the blow did
// (`route.ts`):
//
//   * KNOCKED DOWN (a run without injuries, or a blow short of killing it):
//     a body against a body — the soft, deep thump of a hide full of muscle
//     taking a skier, rounder than a man shouldered — and the animal's own
//     cry of fright, a short nasal bleat bent down in pitch;
//   * KILLED (the injuries on): a body going through a body — a very low
//     driven thud that is mostly felt, a crack of ribs stoving in on top of
//     it, the wet smack of the barrel bursting (brown noise opened up and
//     shut through a lowpass) and the splatter of what comes out of it
//     landing on the snow a moment later. Scaled by the route by how big the
//     animal is and how hard it was met.

import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";

export const WILD_BANK: SoundBank = {
  beast_knock: {
    description:
      "An animal knocked down: a deep soft thump — a driven triangle bending " +
      "from 120 to 55 Hz under a band of pink noise for the hide — and a " +
      "short nasal bleat of fright, a sawtooth falling from 620 to 380 Hz " +
      "through a bandpass, with a wobble in it.",
    voices: [
      {
        call: "tone",
        type: "triangle",
        from: 120,
        to: 55,
        durationMs: 240,
        volume: 0.06,
        drive: 0.5,
        filter: { type: "lowpass", frequency: 900, to: 300 },
      },
      {
        call: "noise",
        durationMs: 140,
        volume: 0.025,
        color: "pink",
        attackMs: 4,
        filter: { type: "bandpass", frequency: 700, q: 1.2 },
      },
      {
        call: "tone",
        type: "sawtooth",
        from: 620,
        to: 380,
        durationMs: 260,
        volume: 0.022,
        delayMs: 70,
        attackMs: 15,
        vibrato: { rateHz: 14, depthCents: 60 },
        filter: { type: "bandpass", frequency: 1100, q: 2.5 },
      },
    ],
  },

  beast_crush: {
    description:
      "An animal run clean through: a very low driven sine thud falling from " +
      "70 to 30 Hz, a sharp crack of ribs (highpassed white, a hundredth of " +
      "a second, then a gristly bandpassed crunch), the wet smack of the " +
      "barrel bursting — brown noise opening a lowpass and shutting it — " +
      "and the splatter of it on the snow, pink noise in a short scatter.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 70,
        to: 30,
        durationMs: 380,
        volume: 0.08,
        drive: 0.8,
        attackMs: 2,
      },
      {
        call: "noise",
        durationMs: 14,
        volume: 0.07,
        filter: { type: "highpass", frequency: 1200 },
      },
      {
        call: "noise",
        durationMs: 110,
        volume: 0.05,
        delayMs: 8,
        filter: { type: "bandpass", frequency: 900, to: 300, q: 2 },
      },
      {
        call: "noise",
        durationMs: 420,
        volume: 0.06,
        color: "brown",
        attackMs: 10,
        delayMs: 25,
        filter: { type: "lowpass", frequency: 1600, to: 160, q: 5 },
      },
      {
        call: "noise",
        durationMs: 300,
        volume: 0.025,
        color: "pink",
        attackMs: 30,
        delayMs: 260,
        filter: { type: "bandpass", frequency: 2200, to: 900, q: 0.8 },
      },
    ],
  },
};
