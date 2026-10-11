// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVE'S MOMENTS — the `chute` event's one-shots (`chute.ts`) and
// the creaks the bed raises while he hangs caught: into the plane's blast
// out of the door, the pilot chute thrown and flapping out on its bridle
// (the reserve's sprung out of its tray with a thunk),
// the lines' SNAP at line stretch, the canopy's WHUMP as it pressurises and
// the slider slaps down, the cut-away's release clicking and the canopy
// whipping off him, the risers let go as his skis take the snow, and the
// canopy caught — in a crown (the boughs cracking, the needles hissing, the
// wood creaking as he swings) or on a lift (the rope's twang and steel).
//
// Cloth is a flutter of many little slaps, so it is built of short bands of
// pink noise; the release's rings and the lift's steel keep their edges;
// the snow swallows its own.

import type { SoundBank, SoundVoice } from "@niclaslindstedt/oss-game-framework/audio/types";

/** The pilot chute's flaps as it catches the air, ms. */
const PILOT_FLAPS: readonly number[] = [40, 95, 140, 180, 215, 250];
/** The boughs breaking as a canopy comes down over a crown, ms and Hz. */
const BOUGHS: readonly { at: number; hz: number }[] = [
  { at: 60, hz: 1800 },
  { at: 210, hz: 1300 },
  { at: 380, hz: 2200 },
  { at: 610, hz: 1500 },
];

const flapAt = (at: number, volume: number, hz: number): SoundVoice => ({
  call: "noise",
  durationMs: 22,
  volume,
  color: "pink",
  delayMs: at,
  filter: { type: "bandpass", frequency: hz, q: 1.6 },
});

export const CHUTE_BANK: SoundBank = {
  chute_exit: {
    description:
      "Out into the propeller's blast: a pink GUST swept up as the slipstream " +
      "takes him, a brown buffet under it, and the plane's noise tearing " +
      "away behind — the bed's roar takes over.",
    voices: [
      {
        call: "noise",
        durationMs: 900,
        volume: 0.065,
        color: "pink",
        attackMs: 30,
        filter: { type: "bandpass", frequency: 700, to: 2400, q: 0.7 },
      },
      {
        call: "noise",
        durationMs: 700,
        volume: 0.05,
        color: "brown",
        attackMs: 40,
        filter: { type: "lowpass", frequency: 260, to: 140 },
      },
    ],
  },

  chute_throw: {
    description:
      "The pilot chute thrown: the hand's slap on the pouch, then the little " +
      "canopy FLAPPING open in the airstream on its bridle — a quick run of " +
      "cloth slaps — and the closing pin's tick as the container opens.",
    voices: [
      flapAt(0, 0.055, 900),
      ...PILOT_FLAPS.map((at, i) => flapAt(at, 0.045 - i * 0.004, 1100 + i * 120)),
      {
        call: "noise",
        durationMs: 10,
        volume: 0.03,
        color: "white",
        delayMs: 300,
        filter: { type: "bandpass", frequency: 3600, q: 5 },
      },
    ],
  },

  chute_reserve: {
    description:
      "THE RESERVE: the metal handle's rasp out of its pocket and the pin's " +
      "tick, the flap thrown open with a hollow THUNK as the spring launches " +
      "the pilot chute off his back, and its quick flaps catching the air.",
    voices: [
      {
        call: "noise",
        durationMs: 60,
        volume: 0.035,
        color: "white",
        filter: { type: "bandpass", frequency: 2800, to: 4200, q: 3 },
      },
      {
        call: "noise",
        durationMs: 10,
        volume: 0.04,
        color: "white",
        delayMs: 70,
        filter: { type: "bandpass", frequency: 3800, q: 5 },
      },
      { call: "tone", type: "sine", from: 190, to: 70, durationMs: 120, volume: 0.05, delayMs: 85 },
      ...PILOT_FLAPS.map((at, i) => flapAt(110 + at * 0.7, 0.05 - i * 0.005, 1000 + i * 130)),
    ],
  },

  chute_lines: {
    description:
      "LINE STRETCH: the bag stripped off the lines and the lines snapping " +
      "taut — a hard pink crack with almost no attack, a low tug thudding " +
      "through the harness, and the bag's cloth flapping off.",
    voices: [
      {
        call: "noise",
        durationMs: 40,
        volume: 0.075,
        color: "pink",
        filter: { type: "bandpass", frequency: 1400, to: 600, q: 0.9 },
      },
      {
        call: "tone",
        type: "sine",
        from: 90,
        to: 55,
        durationMs: 180,
        volume: 0.05,
        drive: 0.3,
        attackMs: 4,
      },
      flapAt(60, 0.025, 800),
      flapAt(120, 0.02, 950),
    ],
  },

  chute_open: {
    description:
      "The canopy OPEN: the cells pressurising in a deep WHUMP — a brown " +
      "boom opening over a few milliseconds — a pink crack of cloth over it " +
      "as the slider slaps down the lines, and the roar falling away under " +
      "a last sigh of air spilling off the canopy's edges.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 70,
        to: 38,
        durationMs: 320,
        volume: 0.075,
        drive: 0.4,
        attackMs: 8,
      },
      {
        call: "noise",
        durationMs: 60,
        volume: 0.065,
        color: "pink",
        attackMs: 3,
        filter: { type: "bandpass", frequency: 1600, to: 700, q: 0.8 },
      },
      {
        call: "noise",
        durationMs: 260,
        volume: 0.05,
        color: "brown",
        attackMs: 10,
        filter: { type: "lowpass", frequency: 420, to: 140 },
      },
      flapAt(180, 0.025, 1200),
      {
        call: "noise",
        durationMs: 900,
        volume: 0.03,
        color: "pink",
        attackMs: 120,
        delayMs: 150,
        filter: { type: "bandpass", frequency: 1800, to: 500, q: 0.7 },
      },
    ],
  },

  chute_release: {
    description:
      "CUT AWAY: the release handle's yank, the three rings' metallic CLICKS " +
      "letting go a beat apart, and the canopy whipping off him — a pink " +
      "rip of cloth swept up and away.",
    voices: [
      {
        call: "noise",
        durationMs: 12,
        volume: 0.06,
        color: "white",
        filter: { type: "bandpass", frequency: 3400, q: 5 },
      },
      { call: "tone", type: "sine", from: 2600, durationMs: 90, volume: 0.012 },
      {
        call: "noise",
        durationMs: 10,
        volume: 0.045,
        color: "white",
        delayMs: 45,
        filter: { type: "bandpass", frequency: 3900, q: 5 },
      },
      {
        call: "noise",
        durationMs: 500,
        volume: 0.05,
        color: "pink",
        attackMs: 20,
        delayMs: 40,
        filter: { type: "bandpass", frequency: 600, to: 2400, q: 1 },
      },
    ],
  },

  chute_land: {
    description:
      "Down on the skis under the canopy and let go of it: the skis' hiss " +
      "biting the snow, the releases' clicks, and the canopy behind him " +
      "sighing down onto the snow in a soft collapse of cloth.",
    voices: [
      {
        call: "noise",
        durationMs: 450,
        volume: 0.04,
        color: "pink",
        attackMs: 20,
        filter: { type: "bandpass", frequency: 2600, to: 1400, q: 0.9 },
      },
      {
        call: "noise",
        durationMs: 10,
        volume: 0.04,
        color: "white",
        delayMs: 160,
        filter: { type: "bandpass", frequency: 3400, q: 5 },
      },
      {
        call: "noise",
        durationMs: 900,
        volume: 0.03,
        color: "pink",
        attackMs: 150,
        delayMs: 250,
        filter: { type: "bandpass", frequency: 900, to: 300, q: 0.8 },
      },
    ],
  },

  chute_snag_tree: {
    description:
      "The canopy down over a crown: the boughs CRACKING as the cloth drapes " +
      "and drags them down, a hiss of needles and shaken snow, and the jolt " +
      "of the lines taking him with a low thud.",
    voices: [
      ...BOUGHS.map((b): SoundVoice => ({
        call: "noise",
        durationMs: 28,
        volume: 0.05,
        color: "white",
        delayMs: b.at,
        filter: { type: "bandpass", frequency: b.hz, q: 2.2 },
      })),
      {
        call: "noise",
        durationMs: 900,
        volume: 0.04,
        color: "pink",
        attackMs: 60,
        filter: { type: "bandpass", frequency: 3000, to: 1200, q: 0.8 },
      },
      {
        call: "tone",
        type: "sine",
        from: 85,
        to: 55,
        durationMs: 200,
        volume: 0.05,
        drive: 0.3,
        attackMs: 5,
        delayMs: 300,
      },
    ],
  },

  chute_snag_lift: {
    description:
      "The canopy caught on a lift: the haul rope's steel TWANG as the lines " +
      "wrap it — a ringing tone bending down — a clank of a sheave or a " +
      "hanger, and the jolt of the lines taking him.",
    voices: [
      {
        call: "tone",
        type: "triangle",
        from: 310,
        to: 240,
        durationMs: 900,
        volume: 0.035,
        attackMs: 4,
        filter: { type: "bandpass", frequency: 600, q: 4 },
      },
      {
        call: "noise",
        durationMs: 30,
        volume: 0.05,
        color: "white",
        delayMs: 80,
        filter: { type: "bandpass", frequency: 2200, q: 3 },
      },
      {
        call: "tone",
        type: "sine",
        from: 85,
        to: 55,
        durationMs: 200,
        volume: 0.05,
        drive: 0.3,
        attackMs: 5,
        delayMs: 200,
      },
    ],
  },

  chute_creak: {
    description:
      "Hanging caught in the tree: a branch CREAKING under his weight as he " +
      "swings — a slow resonant sawtooth bending, with the needles' rustle.",
    voices: [
      {
        call: "tone",
        type: "sawtooth",
        from: 170,
        to: 120,
        durationMs: 420,
        volume: 0.022,
        attackMs: 60,
        filter: { type: "bandpass", frequency: 700, q: 6 },
      },
      {
        call: "noise",
        durationMs: 350,
        volume: 0.015,
        color: "pink",
        attackMs: 80,
        filter: { type: "bandpass", frequency: 2800, q: 1 },
      },
    ],
  },

  chute_creak_steel: {
    description:
      "Hanging caught on the lift: the rope and its steel GROANING under his " +
      "weight as he swings — a thin resonant tone bending, the lines " +
      "rubbing the wire.",
    voices: [
      {
        call: "tone",
        type: "sawtooth",
        from: 420,
        to: 360,
        durationMs: 500,
        volume: 0.032,
        attackMs: 70,
        filter: { type: "bandpass", frequency: 1200, q: 8 },
      },
      {
        call: "noise",
        durationMs: 300,
        volume: 0.02,
        color: "white",
        attackMs: 60,
        filter: { type: "bandpass", frequency: 3600, q: 2 },
      },
    ],
  },
};
