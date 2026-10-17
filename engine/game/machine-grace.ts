// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
/** THE GRACE AFTER STEPPING OFF A MACHINE: for `MACHINE_GRACE` s after the
 * player leaves the helicopter, the plane, the snowmobile or a piste
 * machine, the machine press does not put him back on — a double tap on
 * touch is easily made skating away, and he may still be standing over the
 * thing he left. Nothing here draws from the stream, and the field it keeps
 * (`GameState.leftMachine`) is written only by a step off, so no digest
 * moves. */

import type { GameState } from "./state.ts";

/** How long, s, the machine he left will not take him back. */
export const MACHINE_GRACE = 5;

/** Whether he rides one of the machines the press boards. */
export function onMachine(run: GameState): boolean {
  return !!(
    run.heli?.rider ||
    run.plane?.rider ||
    run.sled?.rider ||
    run.groomers?.some((g) => g.rider)
  );
}

/** After a step: a rider who was on a machine and no longer is has just
 * stepped off, and the grace starts now. */
export function noteMachine(run: GameState, was: boolean): void {
  if (was && !onMachine(run)) run.leftMachine = run.t;
}

/** Whether the grace after his last step off still runs. */
export function inGrace(run: GameState): boolean {
  return run.leftMachine !== undefined && run.t - run.leftMachine < MACHINE_GRACE;
}
