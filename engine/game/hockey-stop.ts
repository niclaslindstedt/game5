// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOCKEY STOP — how a freestyle run that is over is ridden out
// (`RunRules.hockeyStop`). A jump landed, a pipe or a mogul course run, the
// buzzer gone: the skier is done, and a skier who is done does not let the
// run-out carry him on down the mountain — he throws his skis across the
// fall line on the brake (`skier.ts`'s skid, pivoted toward the side the
// edge is on), scrubs his speed off in a spray and stands there, the skis
// across the slope holding him like a racer under the lights.
//
// It is an INPUT, as the race's coast is (`run.ts`'s `runOut`): the
// physics skids him, the renderer sprays it, nothing below is told.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";

import { NEUTRAL_INPUT, type GameState, type SkierInput } from "./state.ts";

/** The hockey stop's numbers. */
export const HOCKEY_STOP = {
  /** How hard the edge is asked round toward across the fall line, per
   * radian still to turn — full lock a radian or more short of it. */
  gain: 1.6,
  /** ...and never less than this, so the skis stay pivoted across
   * (`skier.ts`'s skid takes its side and its full angle off the steer
   * from half a lock) once he is across. */
  hold: 0.5,
  /** Under this speed, m/s, on the snow, the stop is MADE: he is held
   * where he stands (`run.ts`, `stopMade`), as a racer under the lights
   * is — the last crawl of a skid is a moment, and on a pitch steeper than
   * the scrub can hold it would otherwise carry him on down. */
  settle: 2,
} as const;

const STOP: SkierInput = { ...NEUTRAL_INPUT, brake: 1 };
const normal: Vec3 = { x: 0, y: 1, z: 0 };

/** A turn held to (−π, π]. */
function wrap(a: number): number {
  let r = a % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  if (r <= -Math.PI) r += 2 * Math.PI;
  return r;
}

/** Whether the hockey stop is MADE: a finished freestyle run, its skier on
 * the snow and on his skis, who came into this step under `settle` m/s
 * (`speed0`). Once made it stays made — the step that holds him leaves
 * him still. */
export function stopMade(run: GameState, speed0: number): boolean {
  const c = run.skier;
  return (
    run.rules.hockeyStop === true &&
    run.phase === "finished" &&
    c.thrown === null &&
    !c.airborne &&
    speed0 < HOCKEY_STOP.settle
  );
}

/** What a finished freestyle skier holds this step: the brake full on, and
 * the edge turning him the shorter way round to ACROSS the fall line, held
 * at `hold` once he is. Shared, never kept. */
export function hockeyStop(run: GameState): SkierInput {
  const c = run.skier;
  run.level.normalAt(c.x, c.z, normal);
  const flat = hypot(normal.x, normal.z);
  // Where the snow falls away, as a heading (0 = +z, clockwise from above).
  const off = flat > 1e-3 ? wrap(c.heading - Math.atan2(normal.x, normal.z)) : Math.PI / 2;
  const short = Math.PI / 2 - Math.abs(off);
  // The side is picked once — the shorter way round — and kept: once the
  // skis are thrown it is the side they are pivoted to, and a stop that
  // swapped them through the fall line mid-skid would be two stops.
  const side = Math.abs(c.skiAngle) > 0.05 ? Math.sign(c.skiAngle) : off >= 0 ? 1 : -1;
  const ask = Math.max(HOCKEY_STOP.hold, Math.min(1, short * HOCKEY_STOP.gain));
  // Held on after the stop is made, so he stands with the skis still
  // thrown across: the brake held keeps him from stepping round on the
  // spot (`poles.ts`'s `stoodStill`).
  STOP.steer = side * ask;
  return STOP;
}
