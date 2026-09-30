// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW OFTEN A THING IS MET, as a word — the ladder every row of the wildlife
// (`bird-defs.ts`, `beast-defs.ts`) is filed on.
//
// The NUMBER is the truth: `perKm`, groups per kilometre of the loop, which
// the placers turn into a count by drawing the fraction rather than rounding
// it (`groupCount`) — a moose at 0.12 a kilometre over a three-kilometre
// loop is an expected 0.36 of one, so about one map in three has a moose on
// it, which is what the row asked for. The WORD is only its label, derived
// here and never stated in a row, so the two can never disagree.
//
// A loop is some three kilometres, so "common" is several groups a map and
// "legendary" is a handful of maps in a hundred. A word nothing earns is a
// word that means nothing, and `tests/birds_test.ts` holds every rung to at
// least one row.

import type { Rng } from "@engine";

export type Rarity = "common" | "uncommon" | "scarce" | "rare" | "legendary";

/** `perKm` at or above which a row earns each word, richest first. */
export const RARITY_FLOOR: readonly (readonly [Rarity, number])[] = [
  ["common", 1],
  ["uncommon", 0.4],
  ["scarce", 0.2],
  ["rare", 0.08],
  ["legendary", 0],
];

/** How often a row is met, as a word. */
export function rarityOf(perKm: number): Rarity {
  for (const [word, floor] of RARITY_FLOOR) if (perKm >= floor) return word;
  return "legendary";
}

/** How many groups a loop of `km` carries at `perKm`: the whole part of the
 * expectation, plus the fraction as the chance of one more. */
export function groupCount(rng: Rng, perKm: number, km: number): number {
  const expected = perKm * km;
  const whole = Math.floor(expected);
  return whole + (rng.chance(expected - whole) ? 1 : 0);
}
