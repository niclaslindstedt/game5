// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE IN-RUN RIDDEN TUCKED (`RunRules.inRun`): a straight venue's in-run
// (R37) is sized for the speed a skier tucked from the start gate carries
// off its lip (`lipSpeed`), and one stood up, braking or sat back on his
// tails down it comes off far slower and short. A contest skier drops in
// straight, tucked and centred, so from the start gate to the lip the tuck
// is held, the brake let go and his weight kept over his feet, whatever is
// pressed; in the air and past the lip every control is his again. An
// AERIALS site's in-run (R41) is ridden so to its kicker, and STRAIGHT: the
// edge and the jump are held too — a 71° kicker is met square and taken as
// it throws him, never popped. A SKI JUMP's in-run (R43) is ridden in the
// crouch, straight, to the edge, the jump key his own.

import { nearestTrackPoint } from "../mapgen/index.ts";
import type { GameState, SkierInput } from "./state.ts";

/** The controls the skier rides this step on: `held`, tucked, unbraked and
 * centred on an in-run. */
export function inRunInput(run: GameState, held: SkierInput): SkierInput {
  // A SKI JUMP'S IN-RUN (R43): the crouch held in the tracks, straight and
  // unbraked, to the edge — the jump key the jumper's own. The tracks
  // themselves are the wire's (`jump-inrun.ts`, on the controls as asked);
  // this is what the engine's skier reads meanwhile.
  const hill = run.level.skiJump;
  if (hill && run.rules.inRun) {
    const c = run.skier;
    if (run.phase !== "racing" || c.airborne) return held;
    if (nearestTrackPoint(run.level, c.x, c.z).s >= hill.edge) return held;
    return { ...held, tuck: 1, brake: 0, lean: 0, steer: 0 };
  }
  const site = run.level.aerials;
  if (!run.rules.inRun || !site || run.phase !== "racing") return held;
  const c = run.skier;
  if (c.airborne) return held;
  const s = nearestTrackPoint(run.level, c.x, c.z).s;
  if (s >= site.lip || s >= site.foot) return held;
  return { ...held, tuck: 1, brake: 0, lean: 0, steer: 0, jump: false };
}
