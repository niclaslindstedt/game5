// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A FLIGHT AS IT ENDED (`tricks.ts`), stated beside `state.ts` — which
// re-exports it — so the state's file stays under its cap.

import type { TrickPose } from "./state.ts";

/** ONE FLIGHT AS IT ENDED: its number in the run, the turns it made on
 * each axis, rad, signed (tips up and clockwise from above positive), the
 * grabs held long enough to count, its air, s, its length over the snow
 * and its height over the take-off, m, whether it left and met the snow
 * switch, the landing's grade (`landingGrade`, null when the snow was met
 * by a body rather than the skis) and how it ended — `landed` whole,
 * `sketchy` (harsh, or still in a grab) or `fell`. */
export type FlightRecord = {
  flight: number;
  flip: number;
  spin: number;
  grabs: TrickPose[];
  air: number;
  length: number;
  height: number;
  switchIn: boolean;
  switchOut: boolean;
  landing: number | null;
  outcome: "landed" | "sketchy" | "fell";
  t: number;
  /** Where it left the snow (or a jib), m — what a judge reads to tell
   * which feature it was thrown off. */
  x?: number;
  z?: number;
  /** Off a PIPE'S wall (R39, `pipe-air.ts`'s `pipeHit`): which wall, how
   * high over its coping and where on the snow it came down. */
  pipe?: PipeHit;
};

/** ONE HIT OF A PIPE: the wall it left (+1 the right of the pipe's line,
 * −1 the left), the feet's height over the coping at the top of the
 * flight, m, and where the landing met the snow — its height against the
 * coping, m (0 at the coping, negative down the wall), and whether that
 * was the wall, the FLAT bottom or the DECK. */
export type PipeHit = {
  side: number;
  over: number;
  met: number;
  on: "wall" | "flat" | "deck";
};
