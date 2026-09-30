// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE BIRDS SOUND LIKE — the winter wood's cries, as data, spread into
// `RUN_BANK` by `bank.ts` so everything downstream reads one bank. Its own
// module because a bird's cry is the one kind of sound in the bank that is
// neither the wind's nor the snow's.
//
// Which bird makes which of these, how often and how far off it is heard is
// `bird-voice.ts`'s table; this is only what each one IS. The bank's rules
// hold: every voice is the synth's own vocabulary, a def without a
// description fails the test, and every bird is quieter than the snow's
// smallest landing — the wood is heard BETWEEN things, and snow swallows
// sound, so nothing here rings long except what crosses high overhead.

import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";

export const BIRD_BANK: SoundBank = {
  raven_croak: {
    description:
      "A raven's 'kronk': a low hollow driven square through a resonant " +
      "band, gliding down, with a burr of noise on its front, and a second " +
      "shorter one a beat behind — the voice of the winter wood, carried " +
      "across the valley on the echo bus.",
    voices: [
      {
        call: "noise",
        durationMs: 60,
        volume: 0.008,
        attackMs: 4,
        filter: { type: "bandpass", frequency: 900, q: 2 },
      },
      {
        call: "tone",
        type: "square",
        from: 340,
        to: 290,
        durationMs: 240,
        volume: 0.024,
        drive: 0.55,
        attackMs: 10,
        holdMs: 70,
        vibrato: { rateHz: 28, depthCents: 45, delayMs: 0 },
        filter: { type: "bandpass", frequency: 820, to: 700, q: 2.4 },
        echo: 0.24,
      },
      {
        call: "tone",
        type: "square",
        from: 320,
        to: 280,
        durationMs: 180,
        volume: 0.02,
        drive: 0.55,
        attackMs: 10,
        holdMs: 40,
        delayMs: 330,
        vibrato: { rateHz: 28, depthCents: 45, delayMs: 0 },
        filter: { type: "bandpass", frequency: 780, q: 2.4 },
        echo: 0.22,
      },
    ],
  },

  ptarmigan_rattle: {
    description:
      "A willow ptarmigan's 'go-back, go-back': a fast rattle of short " +
      "driven sawtooth knocks through a nasal band, speeding up and falling " +
      "— the sound of a covey that has just gone, heard from the snow it " +
      "went off.",
    voices: [0, 1, 2, 3, 4, 5].map((k) => ({
      call: "tone" as const,
      type: "sawtooth" as const,
      from: 560 - k * 25,
      to: 470 - k * 25,
      durationMs: 70,
      volume: 0.032 - k * 0.003,
      drive: 0.5,
      attackMs: 6,
      delayMs: [0, 120, 225, 315, 395, 465][k],
      filter: { type: "bandpass" as const, frequency: 1250, q: 2 },
      echo: 0.1,
    })),
  },

  capercaillie_knock: {
    description:
      "The capercaillie's dry 'tk-tk': two woody clicks of band-passed white " +
      "noise, close together, and a low hollow pop after them — the big grouse " +
      "grumbling in a pine crown, heard only close under the tree.",
    voices: [
      {
        call: "noise",
        durationMs: 22,
        volume: 0.02,
        filter: { type: "bandpass", frequency: 2100, q: 3 },
      },
      {
        call: "noise",
        durationMs: 22,
        volume: 0.018,
        delayMs: 140,
        filter: { type: "bandpass", frequency: 2000, q: 3 },
      },
      {
        call: "tone",
        type: "sine",
        from: 260,
        to: 170,
        durationMs: 90,
        volume: 0.02,
        drive: 0.3,
        attackMs: 3,
        delayMs: 300,
      },
    ],
  },

  crossbill_chip: {
    description:
      "A crossbill party's 'kip-kip': two hard little sine chips high up, " +
      "a hair apart, bright and dry — the chatter in the spruce tops that " +
      "says the wood is not empty.",
    voices: [
      {
        call: "tone",
        type: "triangle",
        from: 3600,
        to: 3100,
        durationMs: 45,
        volume: 0.018,
        attackMs: 2,
        filter: { type: "highpass", frequency: 1800 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 3500,
        to: 3000,
        durationMs: 45,
        volume: 0.016,
        attackMs: 2,
        delayMs: 110,
        filter: { type: "highpass", frequency: 1800 },
      },
    ],
  },

  grouse_whirr: {
    description:
      "A covey bursting off the snow: the loud whirr of stiff short wings " +
      "— pink bursts at a wingbeat's cadence through a mid band, each softer " +
      "than the last as the birds clear the drift — over a puff of the snow " +
      "they threw. The one bird sound the skier CAUSES.",
    voices: [
      ...[0, 1, 2, 3, 4, 5].map((k) => ({
        call: "noise" as const,
        durationMs: 110,
        volume: 0.034 - k * 0.004,
        color: "pink" as const,
        attackMs: 8,
        delayMs: k * 90,
        filter: { type: "bandpass" as const, frequency: 700 + k * 60, q: 1.4 },
      })),
      {
        call: "noise",
        durationMs: 500,
        volume: 0.016,
        color: "pink",
        attackMs: 20,
        holdMs: 60,
        filter: { type: "lowpass", frequency: 1600, to: 600 },
      },
    ],
  },

  chough_whistle: {
    description:
      "An alpine chough's cry: a ringing, sweet whistle — a sine that " +
      "sweeps up and drops, a touch of chorus, on the echo bus, because it " +
      "is heard off a crag — with a short harsher 'chee' of pink noise on " +
      "the front. The one cry every skier knows from the lift tops.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 2100,
        to: 2900,
        durationMs: 120,
        volume: 0.03,
        detuneCents: 12,
        attackMs: 8,
        echo: 0.2,
      },
      {
        call: "tone",
        type: "sine",
        from: 2900,
        to: 1900,
        durationMs: 260,
        volume: 0.032,
        delayMs: 110,
        detuneCents: 12,
        echo: 0.24,
      },
      {
        call: "noise",
        durationMs: 60,
        volume: 0.012,
        color: "pink",
        attackMs: 3,
        filter: { type: "bandpass", frequency: 3200, q: 2.5 },
      },
    ],
  },

  swan_whoop: {
    description:
      "A whooper swan's bugle: a triangle RISING through a fifth with a " +
      "little drive, a second note answering a shade lower, both long and " +
      "on the echo bus — the call that carries across a whole valley, and " +
      "the reason a line of swans going north is heard before it is seen.",
    voices: [
      {
        call: "tone",
        type: "triangle",
        from: 620,
        to: 900,
        durationMs: 400,
        volume: 0.016,
        drive: 0.3,
        attackMs: 30,
        holdMs: 120,
        vibrato: { rateHz: 6, depthCents: 25, delayMs: 120 },
        filter: { type: "lowpass", frequency: 2400 },
        echo: 0.24,
      },
      {
        call: "tone",
        type: "triangle",
        from: 860,
        to: 780,
        durationMs: 360,
        volume: 0.013,
        drive: 0.3,
        attackMs: 30,
        holdMs: 100,
        delayMs: 330,
        filter: { type: "lowpass", frequency: 2400 },
        echo: 0.24,
      },
    ],
  },

  goose_honk: {
    description:
      "A bean goose's 'ung-ank': two driven squares through a nasal band, " +
      "the second a shade lower and a beat behind, both dark under the " +
      "band — heard off a skein going over high, faint and far.",
    voices: [
      {
        call: "tone",
        type: "square",
        from: 430,
        to: 390,
        durationMs: 170,
        volume: 0.022,
        drive: 0.6,
        attackMs: 12,
        holdMs: 60,
        filter: { type: "bandpass", frequency: 900, q: 1.6 },
        echo: 0.14,
      },
      {
        call: "tone",
        type: "square",
        from: 400,
        to: 360,
        durationMs: 190,
        volume: 0.019,
        drive: 0.6,
        attackMs: 12,
        holdMs: 60,
        delayMs: 200,
        filter: { type: "bandpass", frequency: 860, q: 1.6 },
        echo: 0.14,
      },
    ],
  },
};
