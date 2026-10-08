// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MORTAL WOUNDS AS HEARD (`engine/game/gore.ts`) — only on a run with
// the INJURIES switch on, the one kind of run that deals them. Spread into
// `RUN_BANK` beside the run's own.
//
// WET, THEN HARD. A body coming apart is not the snow's swell and not the
// trunk's crack: it is a short tearing rasp — bandpassed noise swept down
// through the cloth and the flesh — on a driven, very low thud, with a
// gristly mid knock where a bone parts; then the wet: brown noise through
// a lowpass that wobbles. The skull is the crack of the bone itself, dull
// and close. A spike is the wood's or the steel's own knock under the
// body's weight coming onto it. And DEATH is said by nothing in the
// world: the heart's last beats are the `heartbeat` the bed plays, and
// then the sound of the mountain goes on without him.

import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";

export const GORE_BANK: SoundBank = {
  gore_torn: {
    description:
      "A limb or the head torn off: a tearing rasp — white noise through a " +
      "bandpass swept down from 2.4 kHz to 500 Hz over a fifth of a second " +
      "— on a very low driven thud, a gristly knock at 300 Hz as the joint " +
      "parts, and a wet brown tail through a wobbling lowpass.",
    voices: [
      {
        call: "noise",
        durationMs: 210,
        volume: 0.05,
        attackMs: 4,
        filter: { type: "bandpass", frequency: 2400, to: 500, q: 1.2 },
      },
      {
        call: "tone",
        type: "sine",
        from: 64,
        to: 34,
        durationMs: 300,
        volume: 0.075,
        drive: 0.7,
        attackMs: 2,
      },
      {
        call: "tone",
        type: "square",
        from: 320,
        to: 180,
        durationMs: 40,
        volume: 0.03,
        delayMs: 30,
        drive: 0.5,
        filter: { type: "bandpass", frequency: 420, q: 3 },
      },
      {
        call: "noise",
        durationMs: 520,
        volume: 0.045,
        color: "brown",
        attackMs: 20,
        delayMs: 60,
        filter: { type: "lowpass", frequency: 700, to: 180, q: 4 },
      },
    ],
  },

  gore_crush: {
    description:
      "A skull crushed: a dull close crack — highpassed white for a hundredth " +
      "of a second — and a short crunch of bandpassed noise over a driven " +
      "sine at 90 Hz, then a short wet brown settle.",
    voices: [
      {
        call: "noise",
        durationMs: 12,
        volume: 0.06,
        filter: { type: "highpass", frequency: 900 },
      },
      {
        call: "noise",
        durationMs: 90,
        volume: 0.045,
        delayMs: 8,
        filter: { type: "bandpass", frequency: 1100, to: 600, q: 2 },
      },
      {
        call: "tone",
        type: "sine",
        from: 90,
        to: 50,
        durationMs: 200,
        volume: 0.07,
        drive: 0.65,
      },
      {
        call: "noise",
        durationMs: 360,
        volume: 0.035,
        color: "brown",
        attackMs: 15,
        delayMs: 70,
        filter: { type: "lowpass", frequency: 500, to: 160, q: 3 },
      },
    ],
  },

  gore_open: {
    description:
      "The trunk burst open: a deep driven thud, the ribs' brittle crackle " +
      "— a few short knocks of bandpassed noise — and a long wet brown slop " +
      "through a lowpass that wobbles down.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 58,
        to: 32,
        durationMs: 340,
        volume: 0.08,
        drive: 0.7,
      },
      ...[0, 35, 80, 120].map((delayMs) => ({
        call: "noise" as const,
        durationMs: 14,
        volume: 0.03,
        delayMs,
        filter: { type: "bandpass" as const, frequency: 1800, q: 2.5 },
      })),
      {
        call: "noise",
        durationMs: 800,
        volume: 0.05,
        color: "brown",
        attackMs: 30,
        delayMs: 90,
        filter: { type: "lowpass", frequency: 650, to: 140, q: 5 },
      },
    ],
  },

  gore_impaled: {
    description:
      "Run through on a spike: the body's weight coming onto it — a heavy " +
      "driven sine thud — the wood's knock (a triangle at 260 Hz, bandpassed) " +
      "and a slow wet tearing slide down it, brown noise swept down for most " +
      "of a second.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 70,
        to: 38,
        durationMs: 300,
        volume: 0.075,
        drive: 0.65,
      },
      {
        call: "tone",
        type: "triangle",
        from: 260,
        to: 200,
        durationMs: 120,
        volume: 0.035,
        filter: { type: "bandpass", frequency: 320, q: 3 },
      },
      {
        call: "noise",
        durationMs: 900,
        volume: 0.045,
        color: "brown",
        attackMs: 60,
        delayMs: 40,
        filter: { type: "bandpass", frequency: 900, to: 220, q: 1.5 },
      },
    ],
  },

  heartbeat: {
    description:
      "One beat of his own heart as he bleeds: the lub and the dub — two " +
      "short driven sines at 50 and 44 Hz, the second softer, a sixth of a " +
      "second apart — felt more than heard.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 56,
        to: 44,
        durationMs: 110,
        volume: 0.08,
        drive: 0.45,
        attackMs: 6,
      },
      {
        call: "tone",
        type: "sine",
        from: 50,
        to: 40,
        durationMs: 100,
        volume: 0.06,
        drive: 0.4,
        attackMs: 6,
        delayMs: 170,
      },
    ],
  },
};
