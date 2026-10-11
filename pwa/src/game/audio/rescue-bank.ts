// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEARCH AFTER AN AVALANCHE, AS HEARD (`avalanche-rescue.ts`): the
// transceiver's beep, the probe's stroke into the debris and the give of a
// body under it, and the shovel's bite — a block of the run's bank
// (`bank.ts`), its cues the rescue bed's (`rescue-bed.ts`) and the route's.

import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";

export const RESCUE_BANK: SoundBank = {
  beacon_beep: {
    description:
      "The avalanche transceiver's search beep: a short, clean electronic " +
      "tone in the low kilohertz, a plain square-edged pip with a tight " +
      "envelope, as a handheld unit's small speaker gives it — repeated " +
      "faster the nearer the buried unit, pitched up in the fine search.",
    voices: [
      {
        call: "tone",
        type: "square",
        from: 2350,
        to: 2350,
        durationMs: 60,
        volume: 0.018,
        attackMs: 2,
        filter: { type: "lowpass", frequency: 4200 },
      },
    ],
  },

  probe_in: {
    description:
      "A probe pushed into avalanche debris and finding nothing: the " +
      "aluminium pole's dry hiss through dense, set snow — a short pink " +
      "rasp sliding down — and the dull tap of its tip on the hard bed " +
      "under it, a small low thump.",
    voices: [
      {
        call: "noise",
        durationMs: 180,
        volume: 0.02,
        color: "pink",
        filter: { type: "bandpass", frequency: 1800, to: 900, q: 1.4 },
      },
      {
        call: "tone",
        type: "sine",
        from: 180,
        to: 120,
        durationMs: 60,
        volume: 0.025,
        delayMs: 150,
        drive: 0.4,
      },
    ],
  },

  probe_strike: {
    description:
      "A probe STRIKE: the pole's rasp through the debris stopped short " +
      "by a soft, giving resistance — no tap of the hard bed, a muffled " +
      "low thud that does not ring — and a small bright tick of the " +
      "pole's sections taking the load, the sound a rescuer knows.",
    voices: [
      {
        call: "noise",
        durationMs: 120,
        volume: 0.02,
        color: "pink",
        filter: { type: "bandpass", frequency: 1600, to: 1100, q: 1.4 },
      },
      {
        call: "tone",
        type: "sine",
        from: 95,
        to: 70,
        durationMs: 140,
        volume: 0.05,
        delayMs: 100,
        drive: 0.6,
        filter: { type: "lowpass", frequency: 300 },
      },
      {
        call: "noise",
        durationMs: 25,
        volume: 0.012,
        delayMs: 110,
        color: "white",
        filter: { type: "highpass", frequency: 3500 },
      },
    ],
  },

  shovel_bite: {
    description:
      "A shovel blade driven into avalanche debris and the load thrown: a " +
      "crunching scrape of the blade cutting set snow — brown and pink " +
      "noise through a band that slides down — then, a beat later, the " +
      "soft whump of the block landing on the heap.",
    voices: [
      {
        call: "noise",
        durationMs: 220,
        volume: 0.035,
        color: "brown",
        attackMs: 15,
        filter: { type: "bandpass", frequency: 900, to: 500, q: 0.9 },
      },
      {
        call: "noise",
        durationMs: 160,
        volume: 0.018,
        color: "pink",
        filter: { type: "bandpass", frequency: 2600, to: 1400, q: 1.2 },
      },
      {
        call: "noise",
        durationMs: 180,
        volume: 0.03,
        delayMs: 520,
        color: "brown",
        filter: { type: "lowpass", frequency: 400 },
      },
    ],
  },
};
