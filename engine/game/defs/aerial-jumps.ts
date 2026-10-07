// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AERIALS JUMPS the game offers, with their DEGREE OF DIFFICULTY — every
// back jump of the governing body's published jump code and DD chart (its
// 2023 edition, `docs/freestyle.md` § *Aerials*) but the PIKES and the
// tuck-tuck off the single kicker, whose positions the game's skier has no
// press for. A jump the chart does not name is not offered: a DD is never
// guessed.
//
// THE CODE (the chart's): `b` for a BACK jump, then a letter a flip, in
// order — `L` a LAYOUT (straight, no twist), `T` a TUCK (folded, no twist),
// or the TWISTS turned inside a layout flip: `F` a full, `dF` a double
// full, `tF` a triple full. `bFdFF` is a triple: a full in the first flip,
// a double in the second, a full in the third.
//
// THE KICKER is the flips': a single's off the single kicker, a double's
// off the double, a triple's off the triple (R41).

import type { AerialKicker } from "../../mapgen/types.ts";

/** ONE FLIP of a jump: the whole twists turned in it, and whether it is
 * TUCKED (a twisting flip is a layout). */
export type AerialFlip = { twists: number; tuck: boolean };

/** A ROW of the DD chart: the code and its DD for the men and the women. */
export type AerialJumpRow = { code: string; men: number; women: number };

/** THE CHART, singles, then doubles, then triples, each by DD. */
export const AERIAL_JUMPS: readonly AerialJumpRow[] = [
  { code: "bT", men: 2.0, women: 2.0 },
  { code: "bL", men: 2.05, women: 2.05 },
  { code: "bF", men: 2.3, women: 2.3 },
  { code: "bdF", men: 2.9, women: 2.9 },
  { code: "bLT", men: 2.6, women: 2.6 },
  { code: "bLL", men: 2.65, women: 2.65 },
  { code: "bFT", men: 2.85, women: 2.85 },
  { code: "bLF", men: 2.9, women: 2.9 },
  { code: "bFF", men: 3.15, women: 3.15 },
  { code: "bdFT", men: 3.225, women: 3.225 },
  { code: "bLdF", men: 3.275, women: 3.275 },
  { code: "bdFF", men: 3.525, women: 3.525 },
  { code: "bFdF", men: 3.525, women: 3.525 },
  { code: "bLtF", men: 3.75, women: 3.75 },
  { code: "bdFdF", men: 3.9, women: 3.9 },
  { code: "bFtF", men: 4.0, women: 4.0 },
  { code: "btFF", men: 4.0, women: 4.0 },
  { code: "bLTT", men: 3.2, women: 3.392 },
  { code: "bLFT", men: 3.5, women: 3.71 },
  { code: "bLTF", men: 3.5, women: 3.71 },
  { code: "bFTF", men: 3.75, women: 3.975 },
  { code: "bLFF", men: 3.8, women: 4.028 },
  { code: "bFFF", men: 4.05, women: 4.293 },
  { code: "bFdFT", men: 4.125, women: 4.373 },
  { code: "bLdFF", men: 4.175, women: 4.425 },
  { code: "bLFdF", men: 4.275, women: 4.531 },
  { code: "bFdFF", men: 4.425, women: 4.69 },
  { code: "bdFFF", men: 4.525, women: 4.796 },
  { code: "bFFdF", men: 4.525, women: 4.796 },
  { code: "bLtFF", men: 4.65, women: 4.929 },
  { code: "bdFFdF", men: 5.0, women: 5.3 },
  { code: "bdFdFF", men: 5.1, women: 5.406 },
  { code: "bFdFdF", men: 5.1, women: 5.406 },
  { code: "bFtFF", men: 5.2, women: 5.512 },
  { code: "bFFtF", men: 5.3, women: 5.618 },
  { code: "bdFdFdF", men: 5.675, women: 6.0155 },
  { code: "bFtFdF", men: 5.775, women: 6.1215 },
];

/** The flips a code names, in order, or null for a code that is no back
 * jump. */
export function flipsOf(code: string): AerialFlip[] | null {
  if (!code.startsWith("b")) return null;
  const flips: AerialFlip[] = [];
  let i = 1;
  while (i < code.length) {
    const c = code[i];
    if (c === "L" || c === "T") {
      flips.push({ twists: 0, tuck: c === "T" });
      i += 1;
    } else if (c === "F") {
      flips.push({ twists: 1, tuck: false });
      i += 1;
    } else if ((c === "d" || c === "t") && code[i + 1] === "F") {
      flips.push({ twists: c === "d" ? 2 : 3, tuck: false });
      i += 2;
    } else return null;
  }
  return flips.length > 0 ? flips : null;
}

/** The code of a run of flips (`flipsOf`'s inverse). */
export function codeOf(flips: readonly AerialFlip[]): string {
  const letter = (f: AerialFlip): string =>
    f.twists === 0 ? (f.tuck ? "T" : "L") : (["", "F", "dF", "tF"][f.twists] ?? `${f.twists}F`);
  return "b" + flips.map(letter).join("");
}

/** The chart's row for `code`, or null for a jump it does not name. */
export function aerialJump(code: string): AerialJumpRow | null {
  return AERIAL_JUMPS.find((j) => j.code === code) ?? null;
}

/** Whether `code` is a jump the game offers. */
export function isAerialCode(value: unknown): value is string {
  return typeof value === "string" && aerialJump(value) !== null;
}

/** The kicker a jump is jumped off: its flips'. */
export function kickerOf(code: string): AerialKicker {
  const n = flipsOf(code)?.length ?? 3;
  return n <= 1 ? "single" : n === 2 ? "double" : "triple";
}

/** The twists a jump turns in all. */
export function twistsOf(code: string): number {
  return (flipsOf(code) ?? []).reduce((s, f) => s + f.twists, 0);
}
