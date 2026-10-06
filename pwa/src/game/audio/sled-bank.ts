// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE'S MOMENTS — the `sled` event's one-shots (`sled.ts`): the
// rider stepping on and the engine STARTING (the electric starter's whirr
// and the twin catching on the second turn — the bed's idle takes over from
// there), his boots coming off the boards, the machine heaved back onto its
// belt, and the CRASH — its plastic cowl and its tunnel hitting the snow
// with the rider going off it.
//
// The boards are aluminium and keep their edges; the snow swallows its
// own. `route.ts` scales them by the distance they were heard from.

import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";

export const SLED_BANK: SoundBank = {
  sled_board: {
    description:
      "On the boards and away: two boots onto the perforated aluminium — a " +
      "short knock with a thin ring — the starter motor's whirr winding up, " +
      "and the twin catching with a cough and a blat as the idle takes over.",
    voices: [
      {
        call: "tone",
        type: "triangle",
        from: 300,
        to: 220,
        durationMs: 90,
        volume: 0.04,
        drive: 0.35,
      },
      {
        call: "noise",
        durationMs: 30,
        volume: 0.03,
        color: "white",
        delayMs: 120,
        filter: { type: "bandpass", frequency: 2300, q: 3 },
      },
      {
        call: "tone",
        type: "sawtooth",
        from: 70,
        to: 150,
        durationMs: 420,
        volume: 0.022,
        attackMs: 40,
        delayMs: 220,
        filter: { type: "bandpass", frequency: 700, q: 2 },
      },
      {
        call: "noise",
        durationMs: 120,
        volume: 0.05,
        color: "brown",
        delayMs: 620,
        filter: { type: "lowpass", frequency: 500 },
      },
      {
        call: "tone",
        type: "sawtooth",
        from: 95,
        to: 60,
        durationMs: 260,
        volume: 0.05,
        drive: 0.8,
        delayMs: 640,
        filter: { type: "lowpass", frequency: 1400, q: 0.8 },
      },
    ],
  },

  sled_hop: {
    description:
      "Off the boards and onto the skis: a boot scuffing off the aluminium " +
      "plate and the skis' clack as they meet the snow side by side.",
    voices: [
      {
        call: "noise",
        durationMs: 80,
        volume: 0.03,
        color: "pink",
        filter: { type: "bandpass", frequency: 1500, q: 2 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 520,
        to: 380,
        durationMs: 60,
        volume: 0.025,
        drive: 0.3,
        delayMs: 90,
      },
      {
        call: "noise",
        durationMs: 140,
        volume: 0.03,
        color: "pink",
        attackMs: 8,
        delayMs: 100,
        filter: { type: "lowpass", frequency: 900 },
      },
    ],
  },

  sled_right: {
    description:
      "The machine heaved back over onto its belt: a grunt of plastic as the " +
      "cowl leaves the snow, and the whole sled dropping onto its springs — " +
      "a low thump with the snow's hush round it.",
    voices: [
      {
        call: "noise",
        durationMs: 160,
        volume: 0.025,
        color: "pink",
        attackMs: 40,
        filter: { type: "bandpass", frequency: 700, q: 1.5 },
      },
      {
        call: "tone",
        type: "sine",
        from: 90,
        to: 55,
        durationMs: 220,
        volume: 0.07,
        delayMs: 180,
      },
      {
        call: "noise",
        durationMs: 260,
        volume: 0.04,
        color: "brown",
        attackMs: 10,
        delayMs: 180,
        filter: { type: "lowpass", frequency: 600 },
      },
    ],
  },

  sled_crash: {
    description:
      "The sled going over: its cowl and tunnel slammed into the snow — a " +
      "deep driven thump, the plastic's crack and rattle over it, the " +
      "aluminium tunnel's clang, and a long rush of snow as it slides and " +
      "the belt beats the air.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 110,
        to: 40,
        durationMs: 380,
        volume: 0.08,
        drive: 0.5,
      },
      {
        call: "noise",
        durationMs: 180,
        volume: 0.07,
        color: "white",
        filter: { type: "bandpass", frequency: 2600, to: 1400, q: 1.6 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 780,
        to: 640,
        durationMs: 300,
        volume: 0.02,
        delayMs: 40,
      },
      {
        call: "noise",
        durationMs: 60,
        volume: 0.035,
        color: "white",
        delayMs: 230,
        filter: { type: "bandpass", frequency: 3200, q: 4 },
      },
      {
        call: "noise",
        durationMs: 1100,
        volume: 0.06,
        color: "pink",
        attackMs: 30,
        holdMs: 200,
        delayMs: 60,
        filter: { type: "bandpass", frequency: 900, to: 300, q: 0.7 },
      },
    ],
  },
};
