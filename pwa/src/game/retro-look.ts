// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RETRO SKIER'S LOOK — what the Blender builder (`scripts/blender/
// retro.py`, handed this through `scripts/blender/kinds/retro.mjs`) dresses
// him in, and the bones it gives the parts that fly: a late-eighties
// one-piece in loud colour blocks (a body colour, a shoulder yoke, a band
// slanting across the chest and down the sleeves, a belt at the waist), a
// striped knit bobble hat, a long knit scarf knotted at the throat and
// mirrored wraparound shades. Three-free, DOM-free: the builder and the
// game read one table.

/** One colourway of the suit and its knits, sRGB hex. */
export type RetroColourway = {
  id: string;
  /** The suit's body colour. */
  suit: number;
  /** The shoulder yoke and the collar. */
  yoke: number;
  /** The band across the chest and down the sleeves. */
  stripe: number;
  /** The belt and the cuffs. */
  belt: number;
  /** The hat's and the scarf's two yarns, and the bobble. */
  knit: number;
  knit2: number;
  bobble: number;
  glove: number;
  /** The shades' frame and the tint under the mirror. */
  frame: number;
  lens: number;
  skin: number;
  hair: number;
};

// Three colourways read off period photographs: the day-glo pink of the
// late eighties, a canary one-piece with a navy collar and banded sleeves,
// and a royal-blue suit with an ice-white yoke and a red pinstripe.
export const RETRO_COLOURWAYS: readonly RetroColourway[] = [
  {
    id: "magenta",
    suit: 0xff2e93,
    yoke: 0x19c3c7,
    stripe: 0xf2f230,
    belt: 0x16161c,
    knit: 0xf4f0e6,
    knit2: 0xff2e93,
    bobble: 0x19c3c7,
    glove: 0x16161c,
    frame: 0xf4f0e6,
    lens: 0x5a6cff,
    skin: 0xd09a74,
    hair: 0x6a4424,
  },
  {
    id: "canary",
    suit: 0xf4d21f,
    yoke: 0x1e2f6b,
    stripe: 0xe8357a,
    belt: 0x1e2f6b,
    knit: 0x9fd4ee,
    knit2: 0xf4f0e6,
    bobble: 0x9fd4ee,
    glove: 0x1e2f6b,
    frame: 0x16161c,
    lens: 0xff8a30,
    skin: 0xd09a74,
    hair: 0x2a1c12,
  },
  {
    id: "cobalt",
    suit: 0x2a5bd7,
    yoke: 0xe8eef5,
    stripe: 0xd8232a,
    belt: 0xe8eef5,
    knit: 0xf4f0e6,
    knit2: 0xd8232a,
    bobble: 0xf4f0e6,
    glove: 0x16161c,
    frame: 0xd8d8d8,
    lens: 0x30d0a0,
    skin: 0xd09a74,
    hair: 0xc8a050,
  },
];

/** THE PARTS THAT FLY: each a chain of bones the builder lays hanging at
 * rest and the game swings in the air past him (`retro-wind.ts`) — the
 * scarf's two tails off its knot at the throat, and the hat's bobble on
 * its short stalk. `links` bones a chain, `length` m the whole of it. */
export const RETRO_CHAINS = [
  { name: "scarf_a", links: 6, length: 0.66 },
  { name: "scarf_b", links: 5, length: 0.5 },
  { name: "bobble", links: 1, length: 0.07 },
] as const;

export type RetroChain = (typeof RETRO_CHAINS)[number];

/** A chain's bone `k` (0 nearest its root). */
export const chainBone = (c: { name: string }, k: number): string => `${c.name}_${k}`;
