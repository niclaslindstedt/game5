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

/** WHAT THE GUARD DOES WITH A TOUCH'S END: `leave` it to the browser, or
 * `take` it — cancel the end (no zoom, no loupe) and click the pressed
 * element itself. It is taken ONLY when both halves are sure: the end can
 * be cancelled, and the touch is a tap on the element it began on. Anything
 * less is left whole, because half a take is a broken press —
 * - an end the browser will not let be cancelled (a scroll under way, a
 *   main thread it judged busy) still makes its own click, and a click of
 *   ours beside it steps a row TWICE;
 * - a cancelled end that is then judged no tap (a finger that rolled past
 *   the slop) has had its click taken and none given back, and the press
 *   is LOST. */
export function loupeAction(end: {
  second: boolean;
  cancelable: boolean;
  editable: boolean;
  tap: boolean;
}): "leave" | "take" {
  return end.second && end.cancelable && !end.editable && end.tap ? "take" : "leave";
}
