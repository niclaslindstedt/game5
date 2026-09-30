// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TOPSHEETS — how a pair of skis is dressed: the PAINT the topsheet is
// printed in, the TRIM its graphic is cut in, the dark of its sidewalls and
// bindings, the boots' shell, the poles' shaft, and the PATTERN the graphic
// makes down the ski's top. A pair is sold in a handful of these a season,
// and a class has its look: a race ski's plain white block with a number
// panel and a bold stripe, a powder ski's big swoosh, a park ski's loud
// two-tone, an all-mountain ski's twin rails. Every pair carries four; the
// first is its own, the one the ski card shows it in before a skier has
// picked.
//
// A PATTERN is a set of decals stated on the topsheet's own face: u from the
// tail (0) to the tip (1), v across from the left edge (-1) to the right
// (1) — so one pattern fits every traced ski — plus whether the boots' shell
// takes the trim and whether the tip carries a race number panel.
//
// Three-free and DOM-free: the builder (`skis-body.ts`) lays the decals, the
// ski card (`menu-skis.tsx`) shows the swatches, and `settings.ts` keeps the
// pick; `tests/topsheet_test.ts` holds the table.

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

export const TOPSHEETS: Record<SkiId, readonly Topsheet[]> = {
  chamois: [
    sheet("Ember", 0xd5361f, 0xf2f2f2, "twin", { pole: 0xd5361f }),
    sheet("Frost", 0xeef1f4, 0xd5361f, "swoosh", { boot: 0xe8ebee }),
    sheet("Slate", 0x3b4149, 0xb6e02a, "stripe"),
    sheet("Lake", 0x2a67c8, 0xf2f2f2, "split", { pole: 0x2a67c8 }),
  ],
  swift: [
    sheet("Pollen", 0xf2c21b, 0x17191c, "race", { boot: 0xf2c21b }),
    sheet("Blaze", 0xf0661a, 0xf2f2f2, "stripe", { boot: 0xf0661a }),
    sheet("Ghost", 0xe9ecef, 0x1c6fd6, "race", { boot: 0xe9ecef }),
    sheet("Ink", 0x1b1e26, 0xf0661a, "chevron"),
  ],
  chough: [
    sheet("Coal", 0x20242a, 0xf2f2f2, "race", { boot: 0xe9ecef }),
    sheet("Cobalt", 0x2451b8, 0xf2f2f2, "race", { boot: 0x2451b8 }),
    sheet("Signal", 0xd5361f, 0xf2f2f2, "stripe", { boot: 0xd5361f }),
    sheet("Lime", 0xb6e02a, 0x1b1e26, "chevron"),
  ],
  eagle: [
    sheet("Speed", 0xf2f2f2, 0xd5361f, "race", { boot: 0xf2f2f2, pole: 0xd5361f }),
    sheet("Night", 0x14161b, 0xf2c21b, "race", { boot: 0x14161b }),
    sheet("Navy", 0x1d2f5c, 0xf2f2f2, "stripe", { boot: 0x1d2f5c }),
    sheet("Rust", 0xa8401a, 0xf2f2f2, "twin"),
  ],
  marmot: [
    sheet("Pine", 0x2c5a3a, 0xf2f2f2, "swoosh", { boot: 0x2c5a3a }),
    sheet("Snow", 0xeef1f4, 0x2c5a3a, "split", { boot: 0xe8ebee }),
    sheet("Aurora", 0x5a3a8c, 0x3fd0b0, "swoosh"),
    sheet("Ochre", 0xd9a12a, 0x17191c, "chevron", { boot: 0xd9a12a }),
  ],
  hare: [
    sheet("Candy", 0xf05a8a, 0x17191c, "split", { boot: 0xf05a8a }),
    sheet("Mint", 0x3fd0b0, 0xf2f2f2, "twin", { boot: 0x3fd0b0 }),
    sheet("Tangerine", 0xf0661a, 0xf2c21b, "chevron"),
    sheet("Chalk", 0xe9ecef, 0xf05a8a, "swoosh", { boot: 0xe8ebee }),
  ],
};

/** Every topsheet index a pair carries, for the card's swatches. */
export const TOPSHEET_IDS = [0, 1, 2, 3] as const;

/** The topsheet at `index` for a pair, or its own for one out of range. */
export function topsheetOf(id: SkiId, index: number | undefined): Topsheet {
  const list = TOPSHEETS[id];
  return list[index !== undefined && index >= 0 && index < list.length ? Math.floor(index) : 0];
}

/** Every pair's topsheets, keyed as the shell reads them. */
export const SKI_TOPSHEETS = TOPSHEETS;
