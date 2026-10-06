// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TOPSHEETS — how a pair of skis is dressed: the PAINT the topsheet is
// printed in, the TRIM its graphic is cut in, the dark of its sidewalls and
// bindings, the boots' shell, the poles' shaft, and the PATTERN the graphic
// makes down the ski's top. A class has its look — a race ski's plain block
// with a number panel and a bold stripe, a powder ski's big swoosh, a park
// ski's loud two-tone, an all-mountain ski's twin rails — and every pair is
// SOLD IN ONE: its colours are its own, never picked, as a piece of the
// skier's gear is (`outfit.ts`). Everyone on a pair skis it in its sheet.
//
// A PATTERN is a set of decals stated on the topsheet's own face: u from the
// tail (0) to the tip (1), v across from the left edge (-1) to the right
// (1) — so one pattern fits every traced ski — plus whether the boots' shell
// takes the trim and whether the tip carries a race number panel.
//
// Three-free and DOM-free: the builder (`skis-body.ts`) lays the decals;
// `tests/topsheet_test.ts` holds the table.

import type { SkiId } from "@engine";

export type PatternId = "stripe" | "twin" | "swoosh" | "split" | "chevron" | "race";

export type Topsheet = {
  /** The name on the swatch. */
  name: string;
  /** The paint, the graphic's trim, the sidewalls' and bindings' dark, the
   * boots' shell and the poles' shaft — colours as hex. */
  body: number;
  trim: number;
  panel: number;
  boot: number;
  pole: number;
  pattern: PatternId;
};

type UV = [number, number];

export type Pattern = {
  /** Decals on the topsheet, each a closed convex outline in (u, v). */
  top: UV[][];
  /** A TWO-TONE cut: the topsheet forward of `split` (u) is laid in the
   * trim instead of the paint. */
  split?: number;
  /** The boots' shell takes the trim rather than the topsheet's `boot`. */
  boots: boolean;
  /** A race number panel near the tip. */
  plates: boolean;
};

export const PATTERNS: Record<PatternId, Pattern> = {
  // One band down the middle, widening to the tip.
  stripe: {
    top: [
      [
        [0.06, -0.2],
        [0.06, 0.2],
        [0.86, 0.32],
        [0.86, -0.32],
      ],
    ],
    boots: false,
    plates: false,
  },
  // Two rails either side of a plain centre.
  twin: {
    top: [
      [
        [0.05, -0.85],
        [0.05, -0.55],
        [0.88, -0.55],
        [0.88, -0.85],
      ],
      [
        [0.05, 0.55],
        [0.05, 0.85],
        [0.88, 0.85],
        [0.88, 0.55],
      ],
    ],
    boots: false,
    plates: false,
  },
  // A sweep from the tail's left corner across to the tip's right.
  swoosh: {
    top: [
      [
        [0.04, -0.9],
        [0.04, -0.3],
        [0.5, 0.35],
        [0.9, 0.9],
        [0.9, 0.3],
        [0.5, -0.4],
      ],
    ],
    boots: true,
    plates: false,
  },
  // The tip's half in the trim, the tail's in the paint.
  split: {
    top: [],
    split: 0.55,
    boots: false,
    plates: false,
  },
  // Three chevrons pointing to the tip.
  chevron: {
    top: [0.18, 0.4, 0.62].map((u): UV[] => [
      [u, -0.9],
      [u + 0.08, -0.9],
      [u + 0.16, 0],
      [u + 0.08, 0.9],
      [u, 0.9],
      [u + 0.08, 0],
    ]),
    boots: false,
    plates: false,
  },
  // The racer's: a white block forward of the binding and a number panel
  // near the tip, the boots in the trim.
  race: {
    top: [
      [
        [0.6, -0.92],
        [0.6, 0.92],
        [0.84, 0.92],
        [0.84, -0.92],
      ],
    ],
    boots: true,
    plates: true,
  },
};

const BLACK = 0x17191c;
const BOOT = 0x111316;
const POLE = 0x24272c;

const sheet = (
  name: string,
  body: number,
  trim: number,
  pattern: PatternId,
  extra: Partial<Topsheet> = {},
): Topsheet => ({ name, body, trim, panel: BLACK, boot: BOOT, pole: POLE, pattern, ...extra });

export const TOPSHEETS: Record<SkiId, Topsheet> = {
  chamois: sheet("Ember", 0xd5361f, 0xf2f2f2, "twin", { pole: 0xd5361f }),
  swift: sheet("Pollen", 0xf2c21b, 0x17191c, "race", { boot: 0xf2c21b }),
  chough: sheet("Coal", 0x20242a, 0xf2f2f2, "race", { boot: 0xe9ecef }),
  // A super-G pair in violet with a white block: a dark ski reads against
  // the snow, and the colour no other pair wears.
  falcon: sheet("Stoop", 0x4b2a8c, 0xf2f2f2, "race", { boot: 0x4b2a8c, pole: 0xf2f2f2 }),
  // A downhill pair in deep cobalt, never white: a white ski is gone
  // against the snow at the chase camera's range.
  eagle: sheet("Speed", 0x1f4fb8, 0xf2c21b, "race", { boot: 0x1f4fb8, pole: 0xf2c21b }),
  // A ski-cross pair in teal with a black block: a colour no other pair
  // wears, picked out of four abreast on a white course.
  wolverine: sheet("Lagoon", 0x0f8a86, 0x17191c, "race", { boot: 0x0f8a86, pole: 0x17191c }),
  // A speed pair in signal orange with a white block: seen from a long
  // lens down a white track at 200 km/h.
  peregrine: sheet("Tracer", 0xf2541b, 0xf2f2f2, "race", { boot: 0x17191c, pole: 0xf2f2f2 }),
  marmot: sheet("Pine", 0x2c5a3a, 0xf2f2f2, "swoosh", { boot: 0x2c5a3a }),
  hare: sheet("Candy", 0xf05a8a, 0x17191c, "split", { boot: 0xf05a8a }),
  // A big-air pair in a raven's gloss black with a lime twin: black reads
  // against the sky at the top of a jump, the lime against the snow.
  raven: sheet("Gloss", 0x1c1e26, 0xb6e01e, "twin", { boot: 0xb6e01e }),
};
