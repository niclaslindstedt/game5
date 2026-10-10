// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH PIPS A LADDER'S ROW DRAWS. DOM-free: `menu-knobs.tsx` draws them and
// the suite holds them. A short ladder shows a pip a stop; a long one (a
// range of thirty areas on the start card) shows the stretch of it round
// its value, so the row keeps its width however many stops it has.

/** The most pips a row draws. */
export const MOST_PIPS = 13;

/** Which stops' pips a ladder of `n` draws with stop `at` lit (−1 for
 * none): all of them, or the MOST_PIPS round `at`, held inside the ladder. */
export function pipWindow(n: number, at: number): number[] {
  const count = Math.min(n, MOST_PIPS);
  const from = Math.max(0, Math.min(n - count, Math.max(0, at) - (count >> 1)));
  return Array.from({ length: count }, (_, i) => from + i);
}

/** Whether a window cut out of a longer ladder hides stops before its first
 * pip and after its last, so the row fades its pips out at that end. */
export function pipsHidden(n: number, shown: number[]): { before: boolean; after: boolean } {
  return { before: (shown[0] ?? 0) > 0, after: (shown[shown.length - 1] ?? n - 1) < n - 1 };
}
