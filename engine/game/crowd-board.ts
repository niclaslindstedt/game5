// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CROWD'S SNOWBOARDERS — what an amateur on a board (`Amateur.board`,
// dealt by `crowd-deal.ts`) does that one on skis does not. He is stepped
// along his run as every amateur is (`crowd.ts`); what differs is his body:
//
//   * HE SITS DOWN. A rider stopped on a slope has no poles to lean on and
//     both feet strapped to one plank, so he sits in the snow facing down
//     the hill, his heel edge dug in — at the top of a run and just below a
//     crest, where riders gather (the project's snowboard research, the
//     resting and strap-in photographs). Each of his stops long enough is
//     sat as often as not (`CROWD.board.sit`), eased down and back up over
//     `sitRise` s (`stepSit`).
//   * OFF A LIFT HE STRAPS IN. He rides up with his rear foot out of its
//     binding, and at the top of his run he stops to strap it back in, sat
//     down most of the time (`strapIn`).
//   * HE FALLS ON HIS BACK. Caught edges throw a rider over the edge that
//     dug, and most of the falls are backward, onto his seat and his hands
//     (`boardFallSide`: the heel side, where the body faces the toe edge).
//
// Every draw is off the crowd's own stream (`CrowdState.rng`).

import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { band } from "./crowd-deal.ts";
import { CROWD } from "./defs/crowd.ts";
import { TUNING } from "./defs/tuning.ts";
import type { Amateur } from "./state.ts";

const B = CROWD.board;

/** The share of a rider's falls that are backward, onto his heel side. */
const BACKWARD = 0.7;

/** The side a rider goes down on (−1 left, 1 right of his way): his heel
 * edge's most of the time — a regular rider faces the board's right, so
 * his heels are on its left. */
export function boardFallSide(rng: Rng, a: Pick<Amateur, "board">): number {
  const heel = a.board === "goofy" ? 1 : -1;
  return rng.chance(BACKWARD) ? heel : -heel;
}

/** A stop of `hold` s begun: sat, if he is a rider and it is long enough
 * for it — the draw made only for a rider, so a crowd on skis alone deals
 * as it always did. */
export function sitFor(rng: Rng, a: Amateur, hold: number): void {
  a.sitDown = a.board !== null && hold >= B.sitFor && rng.chance(B.sit);
}

/** Off a lift and onto his run: a rider stops to strap his rear foot in,
 * sat down most of the time. */
export function strapIn(rng: Rng, a: Amateur): void {
  if (a.board === null) return;
  a.mode = "stop";
  a.timer = band(rng, B.strap);
  a.sitDown = rng.chance(B.strapSat);
}

/** HOW FAR DOWN HE SITS this step: down while a sat stop has him stood
 * still with the time to get up again left, up otherwise — at a rate the
 * whole motion takes `sitRise` s. */
export function stepSit(a: Amateur): void {
  const down = a.sitDown && a.mode === "stop" && a.speed === 0 && a.timer > B.sitRise;
  const rate = TUNING.dt / B.sitRise;
  a.sit = down ? Math.min(1, a.sit + rate) : Math.max(0, a.sit - rate);
  if (a.mode !== "stop") a.sitDown = false;
}
