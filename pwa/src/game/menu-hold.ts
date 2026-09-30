// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOOR THAT IS NOT A BUTTON — the front door's title, which lets the
// developer page out on a seven-second hold (`DEV_HOLD_MS` in settings.ts).
//
// IT IS HELD ON THE TITLE AND NOT ON A TILE, and that is the whole shape of
// this module. The mark and the name are the one large thing on the front
// door that a press does nothing to — every tile under them starts a race or
// opens a card — so a finger resting there for seven seconds is asking for
// one thing only, and nothing has to be swallowed on the way out: the hold
// cannot also be a press, because there was no press to be.
//
// THE HOLD ITSELF IS SILENT. Nothing fills and no word changes — a door
// meant to stay hidden cannot advertise itself to everybody who rests a
// thumb on the title. The receipt is the DEVELOPER chip appearing on the
// strip along the foot the moment it lands.
//
// DOM-free, so `tests/benchmark_test.ts` reads the whole state machine;
// `menu-main.tsx` owns the pointer events and the timer.

/** A hold in progress, or the absence of one. */
export type HoldState = {
  /** When the finger went down, on the caller's clock (ms); null when
   * nothing is held. */
  from: number | null;
  /** True once the hold has run its length — so the clock is not asked a
   * second time while the finger is still down. */
  fired: boolean;
};

export const NO_HOLD: HoldState = { from: null, fired: false };

/** The hold one moment on. Returns the SAME object when nothing changed, so
 * a caller that asks early can tell "not yet" from "fired" by identity. */
export function tickHold(hold: HoldState, now: number, lengthMs: number): HoldState {
  if (hold.from === null || hold.fired) return hold;
  if (now - hold.from < lengthMs) return hold;
  return { from: hold.from, fired: true };
}

/**
 * How long to wait before asking {@link tickHold} again, ms; zero once due.
 *
 * THE CALLER LOOPS ON THIS rather than trusting one timeout: a timer is set
 * against one clock and `tickHold` reads another, and a browser may deliver
 * a timeout a fraction early — so a wake that finds the hold a millisecond
 * short is ordinary, and asking again for what is left is the whole answer.
 * It cannot spin: anything owed is at least a millisecond.
 */
export function holdWait(hold: HoldState, now: number, lengthMs: number): number {
  if (hold.from === null || hold.fired) return 0;
  const left = lengthMs - (now - hold.from);
  return left <= 0 ? 0 : Math.max(1, left);
}
