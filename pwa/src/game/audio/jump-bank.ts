// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI JUMP'S MOMENTS, HEARD (R43) — the one-shots the jump's events make
// (`route.ts`, the `skiJump` event and the starter's `go` on a jump), spread
// into `RUN_BANK`. The beds under them — the tracks, the flight's wind and
// the crowd — are `jump-voice.ts`'s.
//
//   * THE START SIGNAL: the jury's light turning green is a short tone
//     with it — two notes rising, a fourth apart, with the hill's echo.
//   * OFF THE BAR: his hands push off the bar and his skis drop into the
//     tracks — a hollow knock of the bar and a hiss starting in the ice.
//   * THE TAKE-OFF: the legs straightened at the table's edge — a dull
//     thump of the push, the tails' crack off the edge, and the air
//     taking him in a rush that sweeps up.
//   * THE LANDING: two long, broad skis set flat onto the steep landing
//     slope at 90 km/h are a SLAP, sharp and broad, with a thump of the
//     legs under it and the skis' hiss running on after it.
//   * THE TELEMARK: the same slap split — the front ski down first, the
//     back one a beat after it as the legs split — and the skis carving on.

import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";

export const JUMP_BANK: SoundBank = {
  sj_signal: {
    description:
      "A SKI JUMP'S START SIGNAL: the jury's light gone green, heard as a " +
      "short electronic signal — two plain sines a fourth apart, the second " +
      "held a little, with the hill's echo after them — so the window to " +
      "leave the bar is heard opening before the light is read.",
    voices: [
      { call: "tone", type: "sine", from: 988, durationMs: 150, volume: 0.03, echo: 0.15 },
      {
        call: "tone",
        type: "sine",
        from: 1319,
        durationMs: 360,
        holdMs: 120,
        volume: 0.032,
        delayMs: 170,
        detuneCents: 5,
        echo: 0.22,
      },
    ],
  },

  sj_bar: {
    description:
      "OFF THE BAR: the jumper's hands push him off the start bar and his " +
      "skis drop into the in-run's tracks — a hollow, driven knock of the " +
      "bar falling low, a dry white tick of the edges finding the ice, and " +
      "a narrow pink hiss starting in the grooves.",
    voices: [
      {
        call: "tone",
        type: "square",
        from: 210,
        to: 150,
        durationMs: 110,
        volume: 0.03,
        drive: 0.5,
        filter: { type: "lowpass", frequency: 1400, to: 500 },
      },
      {
        call: "noise",
        durationMs: 22,
        volume: 0.03,
        color: "white",
        delayMs: 60,
        filter: { type: "bandpass", frequency: 3400, q: 3 },
      },
      {
        call: "noise",
        durationMs: 380,
        volume: 0.02,
        color: "pink",
        delayMs: 70,
        attackMs: 90,
        filter: { type: "bandpass", frequency: 800, to: 1200, q: 1.6 },
      },
    ],
  },

  sj_takeoff: {
    description:
      "THE TAKE-OFF at the table's edge: the legs straightened in a dull " +
      "brown thump, the tails' crack off the edge a dry white tick just " +
      "after it, and the air taking the jumper — a pink rush sweeping up " +
      "from low to bright as the snow's hiss stops under him.",
    voices: [
      {
        call: "noise",
        durationMs: 120,
        volume: 0.05,
        color: "brown",
        attackMs: 6,
        filter: { type: "lowpass", frequency: 320, to: 140 },
      },
      {
        call: "noise",
        durationMs: 30,
        volume: 0.035,
        color: "white",
        delayMs: 25,
        filter: { type: "bandpass", frequency: 2600, q: 2.2 },
      },
      {
        call: "noise",
        durationMs: 520,
        volume: 0.04,
        color: "pink",
        delayMs: 30,
        attackMs: 140,
        filter: { type: "bandpass", frequency: 420, to: 2600, q: 0.8 },
      },
    ],
  },

  sj_land: {
    description:
      "THE LANDING SLAP: two long, broad skis set flat onto the steep " +
      "landing slope at speed — a sharp broadband white slap, a pink body " +
      "under it and the legs' brown thump, then the skis' pink hiss " +
      "running on and falling away down the slope.",
    voices: [
      {
        call: "noise",
        durationMs: 40,
        volume: 0.06,
        color: "white",
        filter: { type: "bandpass", frequency: 1900, q: 0.8 },
      },
      {
        call: "noise",
        durationMs: 140,
        volume: 0.05,
        color: "pink",
        filter: { type: "lowpass", frequency: 3200, to: 900 },
      },
      {
        call: "noise",
        durationMs: 180,
        volume: 0.06,
        color: "brown",
        attackMs: 4,
        filter: { type: "lowpass", frequency: 260, to: 110 },
      },
      {
        call: "noise",
        durationMs: 650,
        volume: 0.026,
        color: "pink",
        delayMs: 60,
        attackMs: 40,
        filter: { type: "bandpass", frequency: 2400, to: 1100, q: 1.2 },
      },
    ],
  },

  sj_telemark: {
    description:
      "THE TELEMARK: the landing's slap split in two as the legs split — " +
      "the front ski's sharp white slap and the legs' thump, the back ski's " +
      "smaller slap a beat after it, and both skis carving on in a long " +
      "pink hiss down the slope.",
    voices: [
      {
        call: "noise",
        durationMs: 35,
        volume: 0.055,
        color: "white",
        filter: { type: "bandpass", frequency: 2000, q: 0.8 },
      },
      {
        call: "noise",
        durationMs: 160,
        volume: 0.055,
        color: "brown",
        attackMs: 4,
        filter: { type: "lowpass", frequency: 260, to: 110 },
      },
      {
        call: "noise",
        durationMs: 30,
        volume: 0.04,
        color: "white",
        delayMs: 75,
        filter: { type: "bandpass", frequency: 1600, q: 0.9 },
      },
      {
        call: "noise",
        durationMs: 110,
        volume: 0.035,
        color: "pink",
        delayMs: 75,
        filter: { type: "lowpass", frequency: 2800, to: 900 },
      },
      {
        call: "noise",
        durationMs: 800,
        volume: 0.026,
        color: "pink",
        delayMs: 110,
        attackMs: 50,
        filter: { type: "bandpass", frequency: 2600, to: 1200, q: 1.2 },
      },
    ],
  },
};
