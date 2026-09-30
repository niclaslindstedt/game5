// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A SKIER MEETS, AND WHAT HE COMES DOWN INTO — the contact sounds the
// route picks between off what the app knows and the event does not say
// (`route.ts`'s `Contact`): the snow under the skis at a landing or a fall,
// and which trunk a hit met. Spread into `RUN_BANK` beside the run's own.
//
// THE SAME RULE AS THE REST OF THE BANK: snow swallows transients. A landing
// in deep powder and a body in it are swells — brown mass opening over a few
// milliseconds under a pink puff — and the only sharp edges here are the
// things that are not snow: bark and dead wood, the steel of an edge ripping
// loose, a pair of skis clattering off on their own, a ski's flat base
// slapped down on ice.
//
// THE YARD SALE IS IN EVERY WIPEOUT. A skier thrown is a body and two skis
// arriving separately, so each fall below ends on the skis' own clatter —
// short driven triangles knocking, a beat apart — after the body's thud.

import type { SoundBank } from "@niclaslindstedt/oss-game-framework/audio/types";

/** The skis knocking off on their own after a fall: two clacks, a beat
 * apart, the second quieter and lower. `at` is when the first lands, ms. */
function clatter(at: number, volume: number) {
  return [
    {
      call: "tone" as const,
      type: "triangle" as const,
      from: 520,
      to: 380,
      durationMs: 45,
      volume,
      drive: 0.5,
      delayMs: at,
      filter: { type: "bandpass" as const, frequency: 1400, q: 1.8 },
    },
    {
      call: "tone" as const,
      type: "triangle" as const,
      from: 440,
      to: 330,
      durationMs: 40,
      volume: volume * 0.7,
      drive: 0.5,
      delayMs: at + 130,
      filter: { type: "bandpass" as const, frequency: 1200, q: 1.8 },
    },
  ];
}

export const CONTACT_BANK: SoundBank = {
  land_powder: {
    description:
      "A clean landing in DEEP loose snow: the whumpf. No knock at all — a " +
      "low brown swell that opens over a dozen milliseconds as the skis go " +
      "under, a sine under it bending down for the legs taking it, then a " +
      "long pink cloud of powder thrown up and hanging. Snow has no " +
      "transient and deep snow least of all.",
    voices: [
      {
        call: "noise",
        durationMs: 340,
        volume: 0.05,
        color: "brown",
        attackMs: 14,
        holdMs: 40,
        filter: { type: "lowpass", frequency: 420, to: 160 },
      },
      {
        call: "tone",
        type: "sine",
        from: 80,
        to: 48,
        durationMs: 200,
        volume: 0.04,
        drive: 0.25,
        attackMs: 8,
      },
      {
        call: "noise",
        durationMs: 620,
        volume: 0.032,
        color: "pink",
        attackMs: 40,
        delayMs: 30,
        holdMs: 120,
        filter: { type: "bandpass", frequency: 900, to: 2400, q: 0.6 },
      },
    ],
  },

  land_ice: {
    description:
      "A clean landing on ICE or wind-hardened crust: the skis slapped down " +
      "flat — a short bright clack of two bases, a white band gone in a " +
      "fortieth of a second over a driven triangle knock — then the steel " +
      "skittering for a moment on the hard stuff as the edges look for a " +
      "grip, and hardly any snow in the air.",
    voices: [
      {
        call: "noise",
        durationMs: 26,
        volume: 0.045,
        filter: { type: "bandpass", frequency: 2200, q: 1.4 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 260,
        to: 180,
        durationMs: 90,
        volume: 0.04,
        drive: 0.5,
      },
      {
        call: "tone",
        type: "sine",
        from: 86,
        to: 56,
        durationMs: 140,
        volume: 0.04,
        drive: 0.35,
        attackMs: 2,
      },
      {
        call: "noise",
        durationMs: 180,
        volume: 0.016,
        delayMs: 20,
        filter: { type: "bandpass", frequency: 3800, to: 2600, q: 5 },
      },
    ],
  },

  brush_tree: {
    description:
      "A trunk BRUSHED rather than met: the shoulder through the lowest " +
      "boughs — a soft pink swish through needles — and a light knock on " +
      "the bark, a filtered triangle with no crack in it, then a little of " +
      "the tree's load sifting down after. The warning, not the wreck.",
    voices: [
      {
        call: "noise",
        durationMs: 220,
        volume: 0.03,
        color: "pink",
        attackMs: 20,
        filter: { type: "bandpass", frequency: 2600, to: 1400, q: 0.8 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 210,
        to: 170,
        durationMs: 70,
        volume: 0.03,
        drive: 0.3,
        delayMs: 30,
        filter: { type: "lowpass", frequency: 900 },
      },
      {
        call: "noise",
        durationMs: 480,
        volume: 0.018,
        color: "pink",
        attackMs: 60,
        delayMs: 110,
        holdMs: 80,
        filter: { type: "lowpass", frequency: 2000, to: 700 },
      },
    ],
  },

  hit_snag: {
    description:
      "A skier into a DEAD snag: bone-dry wood, so the crack is higher and " +
      "splintering — two short white bursts a few milliseconds apart — over " +
      "a hollow knock, a triangle ringing in a narrow band because the trunk " +
      "is a pipe. And no snow comes down: a bare snag carries no load.",
    voices: [
      {
        call: "noise",
        durationMs: 14,
        volume: 0.06,
        filter: { type: "highpass", frequency: 700 },
        echo: 0.25,
      },
      {
        call: "noise",
        durationMs: 22,
        volume: 0.04,
        delayMs: 18,
        filter: { type: "highpass", frequency: 1100 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 330,
        to: 290,
        durationMs: 260,
        volume: 0.04,
        drive: 0.35,
        filter: { type: "bandpass", frequency: 700, q: 4 },
      },
      {
        call: "tone",
        type: "sine",
        from: 120,
        to: 100,
        durationMs: 160,
        volume: 0.045,
        drive: 0.5,
        filter: { type: "lowpass", frequency: 700 },
      },
    ],
  },

  wipeout_tree: {
    description:
      "Thrown at a trunk's foot — the crack is the `hit` beside it; this " +
      "is what follows: the body crumpling into the snow round the roots, a " +
      "heavy driven thud with brown mass, the tree's whole load coming down " +
      "on him a beat later as a long pink sheet, and the skis clattering " +
      "off on their own.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 70,
        to: 40,
        durationMs: 260,
        volume: 0.065,
        drive: 0.6,
        attackMs: 3,
        delayMs: 40,
      },
      {
        call: "noise",
        durationMs: 360,
        volume: 0.05,
        color: "brown",
        attackMs: 6,
        delayMs: 40,
        filter: { type: "lowpass", frequency: 340, to: 130 },
      },
      {
        call: "noise",
        durationMs: 1100,
        volume: 0.04,
        color: "pink",
        attackMs: 80,
        delayMs: 160,
        holdMs: 260,
        filter: { type: "lowpass", frequency: 2600, to: 600 },
      },
      ...clatter(260, 0.028),
    ],
  },

  wipeout_nose: {
    description:
      "Over the tips: the fronts of the skis dig in and stop dead — a brown " +
      "shove of snow bulldozed ahead — the bindings letting go with a hard " +
      "click, the body pitched face-first into the slope a beat later as " +
      "the biggest thud in the bank, a pink explosion of snow over it, and " +
      "the skis clattering off.",
    voices: [
      {
        call: "noise",
        durationMs: 140,
        volume: 0.04,
        color: "brown",
        attackMs: 10,
        filter: { type: "lowpass", frequency: 500, to: 250 },
      },
      {
        call: "tone",
        type: "square",
        from: 900,
        to: 700,
        durationMs: 18,
        volume: 0.02,
        delayMs: 70,
        filter: { type: "bandpass", frequency: 1800, q: 2 },
      },
      {
        call: "tone",
        type: "sine",
        from: 74,
        to: 38,
        durationMs: 300,
        volume: 0.075,
        drive: 0.65,
        attackMs: 2,
        delayMs: 150,
      },
      {
        call: "noise",
        durationMs: 360,
        volume: 0.052,
        color: "brown",
        attackMs: 5,
        delayMs: 150,
        filter: { type: "lowpass", frequency: 320, to: 120 },
      },
      {
        call: "noise",
        durationMs: 700,
        volume: 0.04,
        color: "pink",
        attackMs: 30,
        delayMs: 170,
        holdMs: 120,
        filter: { type: "bandpass", frequency: 800, to: 2600, q: 0.6 },
      },
      ...clatter(380, 0.03),
    ],
  },

  wipeout_roll: {
    description:
      "A fall at speed, TUMBLING: the body hitting the slope again and " +
      "again down the fall line — four driven thumps, each later, lower and " +
      "quieter than the last, a pink puff thrown off each — and the skis " +
      "knocking free somewhere in the middle of it.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 80,
        to: 46,
        durationMs: 200,
        volume: 0.065,
        drive: 0.55,
        attackMs: 3,
      },
      {
        call: "tone",
        type: "sine",
        from: 72,
        to: 44,
        durationMs: 180,
        volume: 0.05,
        drive: 0.5,
        attackMs: 3,
        delayMs: 230,
      },
      {
        call: "tone",
        type: "sine",
        from: 66,
        to: 42,
        durationMs: 170,
        volume: 0.038,
        drive: 0.45,
        attackMs: 3,
        delayMs: 480,
      },
      {
        call: "tone",
        type: "sine",
        from: 60,
        to: 40,
        durationMs: 160,
        volume: 0.026,
        drive: 0.4,
        attackMs: 4,
        delayMs: 760,
      },
      {
        call: "noise",
        durationMs: 1100,
        volume: 0.032,
        color: "pink",
        attackMs: 40,
        holdMs: 500,
        filter: { type: "bandpass", frequency: 1000, to: 2200, q: 0.6 },
      },
      ...clatter(330, 0.026),
    ],
  },

  wipeout_catch: {
    description:
      "An EDGE CAUGHT — the high-side: the steel ripping sideways across " +
      "the snow for a fraction of a second, a rising white band that is the " +
      "loudest scrape the skis make, then nothing as he is thrown — the " +
      "body slammed down on the far side as a heavy thud a beat later, a " +
      "sliding pink hiss after it, and the skis clattering off.",
    voices: [
      {
        call: "noise",
        durationMs: 110,
        volume: 0.045,
        attackMs: 8,
        filter: { type: "bandpass", frequency: 1600, to: 3400, q: 2.5 },
      },
      {
        call: "tone",
        type: "sine",
        from: 76,
        to: 40,
        durationMs: 280,
        volume: 0.07,
        drive: 0.6,
        attackMs: 2,
        delayMs: 220,
      },
      {
        call: "noise",
        durationMs: 320,
        volume: 0.048,
        color: "brown",
        attackMs: 5,
        delayMs: 220,
        filter: { type: "lowpass", frequency: 340, to: 130 },
      },
      {
        call: "noise",
        durationMs: 800,
        volume: 0.03,
        color: "pink",
        attackMs: 60,
        delayMs: 280,
        holdMs: 200,
        filter: { type: "bandpass", frequency: 1600, to: 900, q: 0.7 },
      },
      ...clatter(420, 0.026),
    ],
  },
};
