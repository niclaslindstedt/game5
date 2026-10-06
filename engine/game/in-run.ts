// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE IN-RUN RIDDEN TUCKED (`RunRules.inRun`): a big air jump (R37) is
// built for the speed a skier tucked from the start gate carries off its
// lip (`TRICK_RULES.bigAir.speed`), and one stood up or braking down it
// comes off it far slower and down on the knuckle — and so does one sat
// back on his tails (the lean back, the down arrow, costs him a quarter of
// the lip's speed). A contest skier drops in straight, tucked and centred,
// so from the start gate to the lip the tuck is held, the brake let go and
// his weight kept over his feet, whatever is pressed; the edge and the
// jump stay his own, and in the air and past the lip every control is
// again.

import { nearestTrackPoint } from "../mapgen/index.ts";
import type { GameState, SkierInput } from "./state.ts";

/** The controls the skier rides this step on: `held`, tucked, unbraked and
 * centred on a big air in-run. */
export function inRunInput(run: GameState, held: SkierInput): SkierInput {
  const jump = run.level.bigAir;
  if (!run.rules.inRun || !jump || run.phase !== "racing") return held;
  if (held.tuck === 1 && held.brake === 0 && held.lean === 0) return held;
  const c = run.skier;
  if (c.airborne) return held;
  if (nearestTrackPoint(run.level, c.x, c.z).s >= jump.lip) return held;
  return { ...held, tuck: 1, brake: 0, lean: 0 };
}
