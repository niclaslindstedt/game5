// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE'S MOMENTS — the `plane` event's one-shots (`plane.ts`):
// taken aboard at the open door and the turbine started (the igniters'
// ticking, the starter's whir winding up, the LIGHT-OFF's soft whoomp as
// the fuel catches — the bed's whine and thrum run up from there), the skis
// unloading off the snow and thumping back onto it, the wing letting go
// (the airframe's buffet under the bed's horn), out of the door, off it
// onto the snow, and the CRASH.
//
// The gear and the door are metal and keep their edges; the touch-down is
// snow and swallows its own. The crash is the helicopter's explosion
// (`heli-bank.ts`'s crack, boom, roar, rumble and debris) with what a plane
// adds to it: a heavier fireball off the tanks in its wings — a second,
// later roar — and the airframe TEARING as it slides on: a long driven
// scrape of skin on snow, the propeller's blades clattering off the cowl,
// and a wing folding with a deep wrenching groan.

import type { SoundBank, SoundVoice } from "@niclaslindstedt/oss-game-framework/audio/types";

import { HELI_BANK } from "./heli-bank.ts";

/** The igniters' ticks on the start, ms: a fast clicking run. */
const IGNITER: readonly number[] = [0, 110, 220, 330, 440, 550, 660, 770];

/** THE PROPELLER'S BLADES striking and breaking off the cowl after the
 * impact: when, ms, and the ring, Hz. */
const BLADES: readonly { at: number; hz: number }[] = [
  { at: 40, hz: 820 },
  { at: 120, hz: 640 },
  { at: 230, hz: 910 },
];

export const PLANE_BANK: SoundBank = {
  plane_board: {
    description:
      "Into the jump plane's open door and the turbine started: a boot and a " +
      "ski knocking on the aluminium sill, then the igniters TICKING in a " +
      "fast run, the starter's whir winding UP under them, and the LIGHT-OFF " +
      "— a soft brown whoomp as the fuel catches in the burner can.",
    voices: [
      {
        call: "tone",
        type: "triangle",
        from: 240,
        to: 180,
        durationMs: 110,
        volume: 0.045,
        drive: 0.35,
      },
      {
        call: "noise",
        durationMs: 30,
        volume: 0.035,
        color: "white",
        filter: { type: "bandpass", frequency: 2200, q: 3 },
      },
      ...IGNITER.map((at): SoundVoice => ({
        call: "noise",
        durationMs: 8,
        volume: 0.03,
        color: "white",
        delayMs: 300 + at,
        filter: { type: "bandpass", frequency: 4200, q: 5 },
      })),
      {
        call: "tone",
        type: "sawtooth",
        from: 180,
        to: 1400,
        durationMs: 1400,
        volume: 0.012,
        attackMs: 200,
        delayMs: 250,
        filter: { type: "bandpass", frequency: 900, to: 2400, q: 2 },
      },
      {
        call: "noise",
        durationMs: 700,
        volume: 0.05,
        color: "brown",
        attackMs: 60,
        delayMs: 950,
        filter: { type: "lowpass", frequency: 220, to: 600 },
      },
    ],
  },

  plane_liftoff: {
    description:
      "Off the strip: the wheel-skis unloading — the gear legs' creak bending " +
      "UP as the weight comes off them, a last hiss of the skis leaving the " +
      "snow swept bright and gone.",
    voices: [
      {
        call: "tone",
        type: "sawtooth",
        from: 130,
        to: 200,
        durationMs: 300,
        volume: 0.02,
        attackMs: 50,
        filter: { type: "bandpass", frequency: 800, q: 5 },
      },
      {
        call: "noise",
        durationMs: 380,
        volume: 0.035,
        color: "pink",
        filter: { type: "bandpass", frequency: 1600, to: 3400, q: 1 },
      },
    ],
  },

  plane_land: {
    description:
      "Down on the snow: the skis' THUMP opening over a few milliseconds — " +
      "snow has no transient — a brown settle and a hiss as they bite, the " +
      "spring gear's legs creaking DOWN as they take the weight.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 78,
        to: 46,
        durationMs: 230,
        volume: 0.07,
        drive: 0.35,
        attackMs: 6,
      },
      {
        call: "noise",
        durationMs: 300,
        volume: 0.05,
        color: "brown",
        attackMs: 8,
        filter: { type: "lowpass", frequency: 360, to: 120 },
      },
      {
        call: "noise",
        durationMs: 420,
        volume: 0.035,
        color: "pink",
        attackMs: 25,
        delayMs: 20,
        filter: { type: "bandpass", frequency: 2600, to: 1300, q: 0.9 },
      },
      {
        call: "tone",
        type: "sawtooth",
        from: 210,
        to: 140,
        durationMs: 260,
        volume: 0.016,
        delayMs: 50,
        filter: { type: "bandpass", frequency: 780, q: 5 },
      },
    ],
  },

  plane_stall: {
    description:
      "The wing letting go of its air: the airframe's BUFFET — a low shudder " +
      "of brown noise beating at a dozen times a second, the controls going " +
      "slack — under the bed's stall horn.",
    voices: [
      {
        call: "noise",
        durationMs: 900,
        volume: 0.045,
        color: "brown",
        attackMs: 80,
        holdMs: 300,
        filter: { type: "lowpass", frequency: 140, to: 90 },
      },
      {
        call: "tone",
        type: "square",
        from: 13,
        to: 9,
        durationMs: 900,
        volume: 0.03,
        attackMs: 80,
        filter: { type: "lowpass", frequency: 120 },
      },
    ],
  },

  plane_jump: {
    description:
      "Out of the door: the skis' tails knocking on the sill as he goes — a " +
      "short metal knock — and the propeller's blast taking him, a pink " +
      "gust swept up from the cabin's roar into the open air.",
    voices: [
      {
        call: "noise",
        durationMs: 25,
        volume: 0.06,
        color: "white",
        filter: { type: "bandpass", frequency: 2000, q: 3 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 220,
        to: 160,
        durationMs: 100,
        volume: 0.035,
        drive: 0.35,
      },
      {
        call: "noise",
        durationMs: 650,
        volume: 0.06,
        color: "pink",
        attackMs: 40,
        delayMs: 30,
        filter: { type: "bandpass", frequency: 500, to: 2600, q: 0.8 },
      },
    ],
  },

  plane_stepoff: {
    description:
      "Off the stopped plane onto the snow: the boots' knock on the sill and " +
      "the skis set down with a soft brown pat.",
    voices: [
      {
        call: "tone",
        type: "triangle",
        from: 230,
        to: 170,
        durationMs: 100,
        volume: 0.035,
        drive: 0.3,
      },
      {
        call: "noise",
        durationMs: 160,
        volume: 0.04,
        color: "brown",
        attackMs: 6,
        delayMs: 120,
        filter: { type: "lowpass", frequency: 400, to: 160 },
      },
    ],
  },

  plane_crash: {
    description:
      "The plane flown into the mountain: the helicopter's blast — the " +
      "crack, the boom, the fireball's roar, the valley's rumble and the " +
      "debris — and over it the airframe tearing: the propeller's blades " +
      "clattering off, a long driven SCRAPE of skin on snow sweeping down as " +
      "it slides, a wing folding with a deep wrenching GROAN, and the tanks " +
      "going up in a second, later roar.",
    voices: [
      ...HELI_BANK.heli_crash.voices,
      ...BLADES.map((b): SoundVoice => ({
        call: "tone",
        type: "triangle",
        from: b.hz,
        to: b.hz * 0.8,
        durationMs: 120,
        volume: 0.03,
        drive: 0.6,
        delayMs: b.at,
        filter: { type: "bandpass", frequency: b.hz, q: 6 },
      })),
      {
        call: "noise",
        durationMs: 1800,
        volume: 0.05,
        color: "white",
        attackMs: 30,
        delayMs: 80,
        filter: { type: "bandpass", frequency: 2400, to: 700, q: 1.4 },
      },
      {
        call: "tone",
        type: "sawtooth",
        from: 95,
        to: 55,
        durationMs: 900,
        volume: 0.035,
        drive: 0.7,
        attackMs: 60,
        delayMs: 450,
        filter: { type: "bandpass", frequency: 260, q: 3 },
      },
      {
        call: "noise",
        durationMs: 2200,
        volume: 0.06,
        color: "pink",
        attackMs: 120,
        holdMs: 300,
        delayMs: 700,
        filter: { type: "lowpass", frequency: 1800, to: 220 },
        echo: 0.35,
      },
    ],
  },
};
