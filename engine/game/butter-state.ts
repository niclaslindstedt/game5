// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PRESS'S SHAPES (`butter.ts`), stated beside `state.ts` — which
// re-exports them — so the state's file stays under its cap.

/** Which end of the skis a press is on. */
export type PressEnd = "nose" | "tail";

/** A PRESS RIDDEN INTO A FLIGHT (`butter.ts`): the end, how long it was
 * held, s, and how far it pivoted him on the snow, rad, signed as `spin`. */
export type ButterRecord = { end: PressEnd; held: number; yaw: number };

/** THE PRESS on the snow, a run's tricks' share of it (`TrickState`). */
export type PressState = {
  /** THE PRESS on the snow (`butter.ts`, a run with `RunRules.butters`):
   * the end the skis are pressed onto now, or null; how long it has been
   * held, s; how far it has pivoted him since it began, rad, clockwise
   * from above positive; and how long since it was let go, s. The press
   * he left the snow in is filed with the flight (`FlightRecord.butter`),
   * and `squared` is whether that flight has been owed the rest of the
   * butter's turn. */
  press: PressEnd | null;
  pressEnd: PressEnd | null;
  pressFor: number;
  butterYaw: number;
  /** The rate the butter pivots him at now, rad/s, clockwise positive. */
  pivot: number;
  pressGone: number;
  takeoff: ButterRecord | null;
  squared: boolean;
};
