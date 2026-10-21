// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S ONE-SHOTS beside its guns (`gunfire-bank.ts`) and its beds
// (`army-bed.ts`, `army-air-bed.ts`): a wave's carrier or truck letting its
// men out (`army-vehicle`'s `drop`), and a paramotor's wing or a balloon's
// envelope torn out of the sky (`army-air`'s `downed`).
//
// What they ARE to an ear: a steel door or tailgate dropped open is a hard
// metallic CLANK — a broadband strike with no attack, the plate's low body
// knocked into ringing for a moment, a latch's tick before it and the
// hinge's short grind; a canopy's cloth ripping is a dry tearing NOISE
// swept up through the mids in quick grains, as the threads go one panel
// at a time, and a loose flap after it.

import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";

export const ARMY_BANK: SoundBank = {
  army_tailgate: {
    description:
      "A carrier's back door or a truck's tailgate dropped open for the men: " +
      "the latch's tick, the hinge's short grind, then the steel's clank — " +
      "a white strike, a driven body from 160 Hz and a plate ring at 620 Hz.",
    voices: [
      {
        call: "noise",
        durationMs: 12,
        volume: 0.04,
        color: "white",
        filter: { type: "highpass", frequency: 3000 },
      },
      {
        call: "noise",
        durationMs: 140,
        volume: 0.03,
        color: "pink",
        delayMs: 20,
        attackMs: 20,
        filter: { type: "bandpass", frequency: 900, to: 1400, q: 3 },
      },
      {
        call: "noise",
        durationMs: 40,
        volume: 0.08,
        color: "white",
        delayMs: 170,
        filter: { type: "bandpass", frequency: 1800, q: 0.8 },
      },
      {
        call: "tone",
        type: "square",
        from: 160,
        to: 120,
        durationMs: 160,
        volume: 0.05,
        delayMs: 170,
        drive: 0.6,
        attackMs: 1,
        filter: { type: "lowpass", frequency: 900 },
      },
      {
        call: "tone",
        type: "sine",
        from: 620,
        to: 590,
        durationMs: 420,
        volume: 0.025,
        delayMs: 172,
        echo: 0.2,
      },
    ],
  },
  cloth_rip: {
    description:
      "A wing or an envelope torn open: a dry tear swept up from 600 Hz to " +
      "3 kHz in quick grains as the panels go, a second tear on its heels, " +
      "then the loose cloth's low flapping rush.",
    voices: [
      {
        call: "noise",
        durationMs: 260,
        volume: 0.06,
        color: "white",
        attackMs: 8,
        filter: { type: "bandpass", frequency: 600, to: 3000, q: 1.6 },
      },
      {
        call: "noise",
        durationMs: 180,
        volume: 0.05,
        color: "white",
        delayMs: 230,
        attackMs: 6,
        filter: { type: "bandpass", frequency: 900, to: 2400, q: 1.8 },
      },
      {
        call: "noise",
        durationMs: 700,
        volume: 0.04,
        color: "brown",
        delayMs: 300,
        attackMs: 80,
        filter: { type: "lowpass", frequency: 500, to: 220 },
      },
    ],
  },
};
