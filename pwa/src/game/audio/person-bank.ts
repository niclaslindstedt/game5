// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A PERSON RUN INTO, AS HEARD (`engine/game/person-hit.ts`, the `struck`
// event) — spread into `RUN_BANK` beside the run's own. What a body
// meeting a body sounds like, restated from the sound designers' notes on
// a hit to the body (in our own words): DEEPER and more HOLLOW than a blow
// to the face — mostly thud, little crack — built in layers that play as
// one: a low heavy boom for the weight, a short transient over it for the
// meeting, the air knocked out of a chest, and only past a bad blow the
// snap and crunch of bone, kept sparing or it stops reading as a body.
// Two sounds, picked by what the blow did (`route.ts`), each scaled there by
// the closing speed:
//
//   * STRUCK (a blow he lives through, and every blow with the injuries
//     off): two padded bodies of a man's weight meeting — a deep driven
//     sine thud from 85 to 38 Hz that is mostly felt, a dull fleshy slap of
//     brown noise through a closing lowpass, the jackets' nylon in a pink
//     band — and the breath driven out of him, a short voiced "hhuh": a
//     noisy exhale through two vowel-like bands with a low growl under it;
//   * CRUSHED (killed, the injuries on): the same weight met harder and
//     lower, with the RIBS going under it — three short snaps of highpassed
//     white a few milliseconds apart and a gristly crunch after them — a
//     wet brown settle as the chest gives, and no breath at all.

import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";

export const PERSON_BANK: SoundBank = {
  struck_body: {
    description:
      "A person run into: a deep driven sine thud from 85 to 38 Hz, a dull " +
      "fleshy slap of brown noise through a lowpass closing from 900 to 180 " +
      "Hz, the jackets' nylon in a band of pink, and the breath knocked out " +
      "of him — a pink exhale through bands at 700 and 1200 Hz falling, over " +
      "a low sawtooth growl from 150 to 105 Hz.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 85,
        to: 38,
        durationMs: 260,
        volume: 0.07,
        drive: 0.7,
        attackMs: 2,
      },
      {
        call: "noise",
        durationMs: 120,
        volume: 0.045,
        color: "brown",
        filter: { type: "lowpass", frequency: 900, to: 180, q: 1.5 },
      },
      {
        call: "noise",
        durationMs: 70,
        volume: 0.02,
        color: "pink",
        delayMs: 4,
        filter: { type: "bandpass", frequency: 1800, q: 1.4 },
      },
      {
        call: "noise",
        durationMs: 230,
        volume: 0.028,
        color: "pink",
        attackMs: 12,
        delayMs: 45,
        filter: { type: "bandpass", frequency: 700, to: 480, q: 3 },
      },
      {
        call: "noise",
        durationMs: 180,
        volume: 0.014,
        color: "pink",
        attackMs: 12,
        delayMs: 45,
        filter: { type: "bandpass", frequency: 1200, to: 900, q: 4 },
      },
      {
        call: "tone",
        type: "sawtooth",
        from: 150,
        to: 105,
        durationMs: 200,
        volume: 0.012,
        attackMs: 20,
        delayMs: 50,
        filter: { type: "lowpass", frequency: 700 },
      },
    ],
  },

  struck_crush: {
    description:
      "A person run clean through: a very low driven sine thud from 70 to 28 " +
      "Hz, a heavy brown slap, three short snaps of ribs (highpassed white a " +
      "few milliseconds each, 14 and 31 ms apart) and a gristly bandpassed " +
      "crunch falling from 1100 to 350 Hz after them, then a wet brown " +
      "settle through a lowpass shutting from 1400 to 150 Hz. No breath.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 70,
        to: 28,
        durationMs: 420,
        volume: 0.08,
        drive: 0.9,
        attackMs: 2,
      },
      {
        call: "noise",
        durationMs: 140,
        volume: 0.065,
        color: "brown",
        filter: { type: "lowpass", frequency: 1000, to: 160, q: 2 },
      },
      {
        call: "noise",
        durationMs: 9,
        volume: 0.06,
        delayMs: 6,
        filter: { type: "highpass", frequency: 1500 },
      },
      {
        call: "noise",
        durationMs: 8,
        volume: 0.05,
        delayMs: 20,
        filter: { type: "highpass", frequency: 1300 },
      },
      {
        call: "noise",
        durationMs: 10,
        volume: 0.045,
        delayMs: 37,
        filter: { type: "highpass", frequency: 1700 },
      },
      {
        call: "noise",
        durationMs: 130,
        volume: 0.045,
        delayMs: 30,
        filter: { type: "bandpass", frequency: 1100, to: 350, q: 2.2 },
      },
      {
        call: "noise",
        durationMs: 380,
        volume: 0.05,
        color: "brown",
        attackMs: 10,
        delayMs: 60,
        filter: { type: "lowpass", frequency: 1400, to: 150, q: 4 },
      },
    ],
  },
};
