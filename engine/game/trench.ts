// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// BOGGED IN DEEP POWDER. A skier who has stopped in fresh snow and pushes
// on his poles does not glide off: the baskets sink, the skis are pressed
// down under him, and he sinks — until he stands in snow to his knees with
// the skis hanging in the hole they have pressed, and he is BOGGED.
//
// The model is one number, `SkierState.trench`, m: how far the hole under
// the skis is pressed past the sink the snow's own model allows. `skier.ts`
// adds it to the skis' support (so the knees, which read the powder's
// floor, take the load the skis lose — waist deep, which is what bogged IS)
// and takes a share of the poles' push away with it. Here it is dug and
// filled:
//
//   - he SINKS only once he has been stuck (`SkierState.stuckFor`, the
//     automatic reset's own clock) for `trench.after` s, at a rate that goes
//     with the powder and how hard he is pushing — so a push off out of a
//     powder start never gets near it;
//   - ROCKING packs it back: every metre his weight moves fore and aft or
//     side to side (`hipAft`, `hipRight` — the lean and the edge thrown
//     about) fills `trench.rock` of it;
//   - MOVING OUT clears it, by the metre of way made good.
//
// Past `trench.stuckAt` he is bogged: `stuck` fires once, and the automatic
// reset waits `trench.holdFor` s rather than `reset.stuckFor`, so the skier
// has the time to work out before the engine does it for him. Nothing here
// draws from the stream.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { TUNING } from "./defs/tuning.ts";
import type { GameEvent, GameState } from "./state.ts";

const T = TUNING.trench;
const dt = TUNING.dt;

/** Whether the skier is bogged. */
export function trenched(depth: number): boolean {
  return depth > T.stuckAt;
}

/** The share of the poles' push a hole `depth` m deep leaves them. */
export function trenchGrip(depth: number): number {
  return 1 - T.grip * clamp(depth / T.max, 0, 1);
}

/** Sink or fill the hole by one step. `moved` is how far the skier's
 * weight moved this step, m. Called by `stepSkier` once the clocks are
 * read. */
export function stepTrench(state: GameState, moved: number, events: GameEvent[]): void {
  const c = state.skier;
  const was = c.trench;
  // BOGGED: pushing on the poles in powder and going nowhere — at a crawl,
  // whichever way he is crawling.
  const bogged = c.tuck > 0.5 && c.speed < T.creep && c.packed < 0.5;
  c.boggedFor = bogged ? c.boggedFor + dt : 0;
  if (was > 0 || c.boggedFor >= T.after) {
    let d = was;
    if (c.boggedFor >= T.after) d += T.dig * (1 - c.packed) * c.tuck * dt;
    // ...worse with no poles to lever himself on (`poles.bare.rock`).
    d -= T.rock * (c.poles ? 1 : TUNING.poles.bare.rock) * moved;
    // Creeping about in the hole is not moving out of it.
    d -= T.clear * Math.max(0, Math.abs(c.way) - T.creep) * dt;
    c.trench = clamp(d, 0, T.max);
  }
  if (trenched(c.trench) && !trenched(was)) events.push({ kind: "stuck", t: state.t });
  c.trenchFor = c.trench > 0 ? c.trenchFor + dt : 0;
}
