// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SKIING HURT — on a run that carries its injuries through a fall (the
// INJURIES switch, `GameState.gore`), a reset stands the skier back up with
// every injury he took (`course.ts`' `resetSkier`), and what they cost him
// is read here, off his body (`BodyState.worst`), into shares of what he can
// still do (`Hurt`, `SkierState.hurt`), each 1 sound … `HURT.floor`:
//
//   - THE EDGE he can stand on and how fast he tips the skis over, by the
//     leg on the OUTSIDE of the turn — the one that carries it — so a hurt
//     left knee costs his right turns; the hold of each ski's edge by its own
//     leg;
//   - THE TURN-IN, slowed by the head and the neck as well (a concussed
//     skier answers late);
//   - THE DRIVE he makes with the poles and the skate, by the arms first;
//   - THE TUCK he can fold into, by the legs and the trunk;
//   - THE LANDING the legs take before it is harsh.
//
// The shares are worked out once a step for the player alone, and only on a
// run with the switch on: anywhere else `SkierState.hurt` is never written,
// every share below reads exactly 1 and the arithmetic is the same to the
// last bit, so no digest moves.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { PART } from "./body.ts";
import { HURT } from "./defs/hurt.ts";
import type { Hurt } from "./hurt-state.ts";
import type { BodyState, GameState, SkierState } from "./state.ts";

const lossOf = (ais: number): number => HURT.loss[clamp(Math.round(ais), 0, HURT.loss.length - 1)];

/** The worst loss among `parts`. */
function worstOf(body: BodyState, parts: readonly (keyof typeof PART)[]): number {
  let most = 0;
  for (const p of parts) most = Math.max(most, lossOf(body.worst[PART[p]]));
  return most;
}

const share = (...costs: number[]): number => {
  let s = 1;
  for (const c of costs) s *= 1 - c;
  return Math.max(HURT.floor, s);
};

/** WHAT HIS INJURIES LEAVE HIM, off `body`. */
export function hurtOf(body: BodyState): Hurt {
  const legL = worstOf(body, ["thighL", "kneeL", "shinL", "footL"]);
  const legR = worstOf(body, ["thighR", "kneeR", "shinR", "footR"]);
  const legs = Math.max(legL, legR);
  const arms = worstOf(body, ["shoulderL", "shoulderR", "armL", "armR", "handL", "handR"]);
  const trunk = worstOf(body, ["chest", "back", "abdomen", "pelvis"]);
  const head = worstOf(body, ["head", "neck"]);
  const H = HURT;
  const edgeBy = (leg: number) => share(H.edge.leg * leg, H.edge.trunk * trunk);
  const rateBy = (leg: number) => share(H.rate.leg * leg, H.rate.head * head, H.rate.trunk * trunk);
  return {
    edge: [edgeBy(legL), edgeBy(legR)],
    rate: [rateBy(legL), rateBy(legR)],
    grip: [share(H.grip.leg * legL), share(H.grip.leg * legR)],
    drive: share(H.drive.arm * arms, H.drive.leg * legs, H.drive.trunk * trunk),
    tuck: share(H.tuck.leg * legs, H.tuck.trunk * trunk),
    landing: share(H.landing.leg * legs, H.landing.trunk * trunk),
  };
}

/** The player's shares this step, on a run that carries its injuries. */
export function stepHurt(run: GameState): void {
  if (!run.gore) return;
  const c = run.skier;
  // Untouched, he is sound: nothing written, nothing to read.
  if (!c.hurt && c.body.injuries.length === 0) return;
  c.hurt = hurtOf(c.body);
}

/** The leg that carries a turn of `edge` (positive right): the OUTSIDE
 * one — his left in a right turn. 0 left, 1 right. */
const outside = (edge: number): 0 | 1 => (edge > 0 ? 0 : 1);

/** The share of the edge he can stand on, turning toward `goal`'s side. */
export function hurtEdge(c: SkierState, goal: number): number {
  return c.hurt ? c.hurt.edge[outside(goal)] : 1;
}

/** The share of the rate he tips his skis over at, toward `goal`'s side. */
export function hurtRate(c: SkierState, goal: number): number {
  return c.hurt ? c.hurt.rate[outside(goal)] : 1;
}

/** The share of its edge's hold the ski on `side` (−1 left, +1 right) has. */
export function hurtGrip(c: SkierState, side: number): number {
  return c.hurt ? c.hurt.grip[side < 0 ? 0 : 1] : 1;
}

/** The share of his drive, his tuck and his landing he has left. */
export const hurtDrive = (c: SkierState): number => c.hurt?.drive ?? 1;
export const hurtTuck = (c: SkierState): number => c.hurt?.tuck ?? 1;
export const hurtLanding = (c: SkierState): number => c.hurt?.landing ?? 1;
