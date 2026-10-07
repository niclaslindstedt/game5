// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A FREESTYLE CONTEST'S BOARD ON THE PLATE — which of the phase's rows the
// plate has room for. DOM-free: big air, slopestyle, the halfpipe, moguls
// and aerials all cut their board here, and `hud-contest-board.tsx` draws
// it with a gap row wherever the places skip.
//
// The leaders head it; a player down the field is shown WITH THE RIVALS
// EITHER SIDE OF HIM, so he reads whom he beat and whom he trails rather
// than a lone row of his own under the top seven.

import type { HudSnapshot } from "./snapshot.ts";

/** How many of the board the plate shows. */
export const BOARD_ROWS = 8;

/** The rows the plate shows of `rows` (best first, the player's row
 * `you`): all of the top `size` while he is among them, else the leaders
 * and the player with a rival either side of him. */
export function boardWindow<R extends { you: boolean }>(rows: R[], size = BOARD_ROWS): R[] {
  const you = rows.findIndex((r) => r.you);
  if (you < size) return rows.slice(0, size);
  const around = rows.slice(you - 1, you + 2);
  return [...rows.slice(0, size - around.length), ...around];
}

/** Whether a FREESTYLE CONTEST'S PLATE is up on this snapshot — a jump or
 * a run the panel has judged. The run's HUD steps aside for it (`App.tsx`):
 * its clock, chips, body and dials are the run's, the run is over, and
 * drawn under a plate this full they read through it as clutter. */
export function contestPlateUp(snap: HudSnapshot | null): boolean {
  return Boolean(
    snap?.bigAir?.judged ||
    snap?.slopestyle?.judged ||
    snap?.halfpipe?.judged ||
    snap?.moguls?.judged ||
    snap?.aerials?.judged,
  );
}
