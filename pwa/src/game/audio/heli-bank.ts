// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER'S MOMENTS — the `heli` event's one-shots (`heli.ts`) and
// the fire's crackle the bed raises as a cue: the skier's boots on the skid
// as he is taken on, the skids creaking as the weight comes off them and
// thumping back down into the snow, the clack and the rush of the drop, and
// the CRASH — the one sound in the game bigger than a fall.
//
// The skids and the boots are metal on metal and keep their edges; the
// landing is snow and swallows its own. The explosion is built as a real
// one is heard: a CRACK first (the blast front, broadband and hard, the one
// voice here with no attack at all), a deep BOOM under it bending down into
// the sub-bass with a long tail, the fireball's ROAR opening over it, a
// RUMBLE of brown noise rolling on for seconds — sent into the echo bus,
// the valley throwing it back — and the DEBRIS: hard little knocks of metal
// and a few heavier clunks coming down over the next two seconds.
// `route.ts` scales it by the distance it was heard from.

import type { SoundBank, SoundVoice } from "@niclaslindstedt/oss-game-framework/audio/types";

/** THE DEBRIS coming down after the blast: when each piece lands, ms, how
 * loud, and its ring, Hz — panels and fittings, a fixed scatter so the
 * crash sounds the same each time it is heard. */
const DEBRIS: readonly { at: number; volume: number; hz: number }[] = [
  { at: 260, volume: 0.04, hz: 2900 },
  { at: 410, volume: 0.035, hz: 2100 },
  { at: 520, volume: 0.03, hz: 3500 },
  { at: 700, volume: 0.032, hz: 1700 },
  { at: 860, volume: 0.024, hz: 2600 },
  { at: 1080, volume: 0.022, hz: 3100 },
  { at: 1350, volume: 0.018, hz: 1900 },
  { at: 1700, volume: 0.014, hz: 2400 },
  { at: 2100, volume: 0.01, hz: 3300 },
];

/** The heavier pieces: a low driven knock each, ms and Hz. */
const CLUNKS: readonly { at: number; hz: number }[] = [
  { at: 380, hz: 170 },
  { at: 940, hz: 130 },
  { at: 1500, hz: 150 },
];

const debris: SoundVoice[] = [
  ...DEBRIS.map((d): SoundVoice => ({
    call: "noise",
    durationMs: 45,
    volume: d.volume,
    color: "white",
    delayMs: d.at,
    filter: { type: "bandpass", frequency: d.hz, q: 4 },
  })),
  ...CLUNKS.map((c): SoundVoice => ({
    call: "tone",
    type: "triangle",
    from: c.hz,
    to: c.hz * 0.7,
    durationMs: 140,
    volume: 0.03,
    drive: 0.5,
    delayMs: c.at,
  })),
];

export const HELI_BANK: SoundBank = {
  heli_board: {
    description:
      "Taken onto the helicopter's skid: two boots and a pair of skis " +
      "landing on the aluminium tube — a short driven knock with the tube's " +
      "thin ring over it, and the second boot a beat after the first, " +
      "softer. Metal on metal, so it keeps its edge.",
    voices: [
      {
        call: "tone",
        type: "triangle",
        from: 260,
        to: 190,
        durationMs: 120,
        volume: 0.05,
        drive: 0.35,
      },
      {
        call: "noise",
        durationMs: 35,
        volume: 0.04,
        color: "white",
        filter: { type: "bandpass", frequency: 1900, q: 3 },
      },
      { call: "tone", type: "sine", from: 1250, durationMs: 220, volume: 0.008 },
      {
        call: "tone",
        type: "triangle",
        from: 240,
        to: 180,
        durationMs: 110,
        volume: 0.035,
        drive: 0.35,
        delayMs: 150,
      },
      {
        call: "noise",
        durationMs: 30,
        volume: 0.028,
        color: "white",
        delayMs: 150,
        filter: { type: "bandpass", frequency: 2100, q: 3 },
      },
    ],
  },

  heli_liftoff: {
    description:
      "Light on the skids: the cross tubes creak as the weight comes off " +
      "them — a resonant sawtooth bending UP — over a pink swell of snow " +
      "lifted off the surface as the downwash takes hold.",
    voices: [
      {
        call: "tone",
        type: "sawtooth",
        from: 150,
        to: 230,
        durationMs: 320,
        volume: 0.03,
        attackMs: 60,
        filter: { type: "bandpass", frequency: 900, q: 5 },
      },
      {
        call: "noise",
        durationMs: 700,
        volume: 0.055,
        color: "pink",
        attackMs: 180,
        holdMs: 120,
        filter: { type: "bandpass", frequency: 500, to: 1800, q: 0.8 },
      },
    ],
  },

  heli_land: {
    description:
      "Set down: the skids come onto the snow — a low driven thump that " +
      "opens over a few milliseconds, because snow has no transient, under a " +
      "brown settle and the tubes' creak bending DOWN as they take the " +
      "weight.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 85,
        to: 50,
        durationMs: 200,
        volume: 0.06,
        drive: 0.3,
        attackMs: 5,
      },
      {
        call: "noise",
        durationMs: 260,
        volume: 0.05,
        color: "brown",
        attackMs: 6,
        filter: { type: "lowpass", frequency: 320, to: 130 },
      },
      {
        call: "tone",
        type: "sawtooth",
        from: 220,
        to: 150,
        durationMs: 240,
        volume: 0.015,
        delayMs: 40,
        filter: { type: "bandpass", frequency: 850, q: 5 },
      },
    ],
  },

  heli_drop: {
    description:
      "Dropped off the skid: the skis' clack as they leave the tube, then " +
      "the rush of falling out of the downwash — a pink band swept UP from " +
      "low to bright as it swells, a body of brown air under it.",
    voices: [
      {
        call: "noise",
        durationMs: 28,
        volume: 0.06,
        color: "white",
        filter: { type: "bandpass", frequency: 2300, q: 3 },
      },
      {
        call: "noise",
        durationMs: 600,
        volume: 0.06,
        color: "pink",
        attackMs: 70,
        delayMs: 20,
        filter: { type: "bandpass", frequency: 400, to: 2000, q: 0.9 },
      },
      {
        call: "noise",
        durationMs: 500,
        volume: 0.03,
        color: "brown",
        attackMs: 60,
        filter: { type: "lowpass", frequency: 260, to: 140 },
      },
    ],
  },

  heli_chop: {
    description:
      "A rotor blade through a body (`heli-grip.ts`): a hard CRACK with no " +
      "attack, a wet tearing smack swept DOWN under it, a low thud of the " +
      "blade taking the load and the blade's own short ring after.",
    voices: [
      {
        call: "noise",
        durationMs: 22,
        volume: 0.12,
        color: "white",
        filter: { type: "highpass", frequency: 1500 },
      },
      {
        call: "noise",
        durationMs: 140,
        volume: 0.09,
        color: "pink",
        attackMs: 2,
        filter: { type: "bandpass", frequency: 1600, to: 420, q: 1.2 },
      },
      {
        call: "tone",
        type: "sine",
        from: 120,
        to: 55,
        durationMs: 160,
        volume: 0.08,
        drive: 0.5,
        attackMs: 2,
      },
      {
        call: "tone",
        type: "triangle",
        from: 1180,
        to: 1120,
        durationMs: 260,
        volume: 0.012,
        delayMs: 15,
        filter: { type: "bandpass", frequency: 1150, q: 9 },
      },
    ],
  },

  heli_crash: {
    description:
      "The helicopter blowing up: a hard white CRACK with no attack — the " +
      "blast front — then a deep driven BOOM bending down into the sub-bass " +
      "with a long tail, the fireball's pink ROAR opening and darkening " +
      "over it, a brown RUMBLE rolling on for nearly four seconds and thrown " +
      "back by the valley through the echo, and DEBRIS coming down after: " +
      "hard metal knocks and heavier clunks over two seconds.",
    voices: [
      {
        call: "noise",
        durationMs: 30,
        volume: 0.08,
        color: "white",
        filter: { type: "highpass", frequency: 1800 },
      },
      {
        call: "noise",
        durationMs: 90,
        volume: 0.08,
        color: "white",
        filter: { type: "bandpass", frequency: 1400, to: 380, q: 0.7 },
      },
      {
        call: "tone",
        type: "sine",
        from: 75,
        to: 28,
        durationMs: 2400,
        volume: 0.08,
        drive: 0.6,
        attackMs: 3,
      },
      {
        call: "tone",
        type: "triangle",
        from: 46,
        to: 22,
        durationMs: 3200,
        volume: 0.07,
        drive: 0.4,
        attackMs: 12,
        holdMs: 200,
      },
      {
        call: "noise",
        durationMs: 2600,
        volume: 0.06,
        color: "pink",
        attackMs: 8,
        filter: { type: "lowpass", frequency: 3200, to: 260 },
        echo: 0.3,
      },
      {
        call: "noise",
        durationMs: 3800,
        volume: 0.07,
        color: "brown",
        attackMs: 20,
        holdMs: 300,
        filter: { type: "lowpass", frequency: 640, to: 80 },
        echo: 0.45,
      },
      ...debris,
    ],
  },

  heli_crackle: {
    description:
      "One pop of the burning wreck, raised by the bed while it burns: a " +
      "few milliseconds of white grit in a bright band — the fuel and the " +
      "resin spitting — over a duller knock of something giving way in the " +
      "heat, pitched and sized off the slot it lands in.",
    voices: [
      {
        call: "noise",
        durationMs: 16,
        volume: 0.07,
        color: "white",
        filter: { type: "bandpass", frequency: 2600, q: 1.6 },
      },
      {
        call: "noise",
        durationMs: 12,
        volume: 0.035,
        color: "white",
        filter: { type: "bandpass", frequency: 900, q: 2 },
      },
    ],
  },
};
