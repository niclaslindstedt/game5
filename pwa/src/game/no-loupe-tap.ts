// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT IS A DOUBLE TAP, to the loupe guard (`no-loupe.ts`): DOM-free, so the
// suite can hold it.

/** How close together two taps must come to be a double tap to iOS, in ms. */
export const SECOND_TAP_MS = 400;

/** How far a touch may travel and still be a tap rather than a drag, in px. */
export const TAP_SLOP_PX = 12;

/** Whether a touch that ended at `now` is the second tap of a double tap —
 * the one iOS turns into a zoom or the loupe — after one that ended at
 * `last` (`-Infinity` when there was none). */
export function isSecondTap(last: number, now: number): boolean {
  return now - last >= 0 && now - last < SECOND_TAP_MS;
}

/** Whether a touch that started at (`x0`, `y0`) and ended at (`x1`, `y1`) is
 * still a tap — the press a click is owed for. */
export function isTap(x0: number, y0: number, x1: number, y1: number): boolean {
  return Math.hypot(x1 - x0, y1 - y0) <= TAP_SLOP_PX;
}
