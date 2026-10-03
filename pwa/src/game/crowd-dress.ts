// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE CROWD WEARS — one palette every amateur's kit is painted from,
// and the outfit each one is dealt off his id and the map's seed: a jacket,
// pants, a helmet or a hat, his skis, the jacket's second colour, his skin
// and his hair. Three-free and DOM-free, and presentation alone: the
// engine's amateur carries no colour, so nothing here moves a digest.
//
// A SLOPE READS AS A CROWD by its colour: dots of red, blue and yellow
// against the white, more of the bright ones than of the black. So the
// palette is a resort's — the holiday skier's bright shell, the old hand's
// navy and burgundy, the teenager's black, the freerider's olive and
// orange — and a ski school's children all wear the school's one bib
// colour, as they do, so a snake of them reads as one thing from the lift.

import type { Amateur, CrowdGroup } from "@engine";

/** Which colour of the outfit a vertex of the figure takes (`aSlot`): 0
 * its own, painted into the mesh (the boots, the goggles, the poles). */
export const DRESS_SLOT = {
  own: 0,
  jacket: 1,
  pants: 2,
  head: 3,
  skis: 4,
  accent: 5,
  skin: 6,
  hair: 7,
} as const;

const JACKETS = [
  0xc8202a, 0x1f5fbf, 0xf2c12e, 0x15918f, 0xe8661c, 0x6b3fa0, 0x1c1d22, 0xe9ecef, 0xe0508f,
  0x2f8f3a, 0x1d2a4f, 0x9cc63a, 0x5fb1e6, 0x7a1f2e, 0xc99a2e, 0x6d7480,
];
const PANTS = [0x18191d, 0x1e2638, 0x3a3d44, 0xdfe3e7, 0xa3222b, 0x8b7d5a, 0x4f5a34, 0x6f9ccf];
const HEADS = [0xeef0f2, 0x16171a, 0x9aa1aa, 0xc0242c, 0x2353a8, 0xe46aa2, 0xe3742a, 0x3a8f4a];
const SKIS = [0xd2232a, 0xf0f0f0, 0x1a1a1e, 0x2457b8, 0xf2c22c, 0x93c83a, 0xec6b1f, 0x7040a8];
const SKINS = [0xf1c9a5, 0xd9a27a, 0xa86f4c, 0x6e4630];
const HAIRS = [0xd8b467, 0x6a4428, 0x1f1a17, 0xb9b6b0];

/** THE PALETTE, as hex: jackets, pants, heads, skis, skins, hairs — in that
 * order, so an outfit is seven indices into one array. */
export const CROWD_PALETTE: readonly number[] = [
  ...JACKETS,
  ...PANTS,
  ...HEADS,
  ...SKIS,
  ...SKINS,
  ...HAIRS,
];
const AT = {
  jacket: 0,
  pants: JACKETS.length,
  head: JACKETS.length + PANTS.length,
  skis: JACKETS.length + PANTS.length + HEADS.length,
  skin: JACKETS.length + PANTS.length + HEADS.length + SKIS.length,
  hair: JACKETS.length + PANTS.length + HEADS.length + SKIS.length + SKINS.length,
};

/** The jackets each kind of person reaches for, by index into `JACKETS`. */
const BRIGHT = [0, 1, 2, 3, 4, 5, 8, 9, 11, 12];
const MUTED = [1, 6, 10, 13, 14, 15, 3, 0];
const DARK = [6, 6, 10, 15, 11, 4, 8];
const EARTH = [4, 9, 14, 6, 13, 3, 2];
/** The colours a ski school's bibs come in. */
const BIBS = [2, 4, 0, 11, 12];

/** A small integer hash: the same amateur on the same map, the same kit. */
function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}

/** An outfit: seven indices into `CROWD_PALETTE` — jacket, pants, head,
 * skis, accent, skin, hair. */
export type Outfit = [number, number, number, number, number, number, number];

/** THE KIT an amateur is dealt: off his id and the map's seed, by who he
 * is — and, in a ski school, the school's bib. */
export function outfitOf(a: Amateur, group: CrowdGroup | undefined, seed: number): Outfit {
  const h = hash(a.id, seed);
  const pick = (list: readonly number[], shift: number): number =>
    list[(h >>> shift) % list.length];
  const body = a.body;
  const pool =
    body === "oldMan" || body === "oldWoman"
      ? MUTED
      : body === "teen"
        ? DARK
        : body === "freerider"
          ? EARTH
          : BRIGHT;
  let jacket = pick(pool, 0);
  if (group?.kind === "school" && a.rank > 0) {
    jacket = BIBS[hash(a.group, seed) % BIBS.length];
  }
  // A one-piece suit is one colour from the collar to the boots.
  const pants =
    body === "retro"
      ? AT.jacket + jacket
      : AT.pants + ((h >>> 5) % 3 === 0 ? (h >>> 7) % 8 : (h >>> 7) % 3);
  const accent = AT.jacket + ((jacket + 1 + ((h >>> 11) % 5)) % JACKETS.length);
  return [
    AT.jacket + jacket,
    pants,
    AT.head + ((h >>> 14) % HEADS.length),
    AT.skis + ((h >>> 17) % SKIS.length),
    accent,
    AT.skin + ((h >>> 20) % SKINS.length),
    AT.hair + (body === "oldMan" || body === "oldWoman" ? 3 : (h >>> 23) % 3),
  ];
}
