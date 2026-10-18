// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT'S HANDS IN A WINGSUIT (`wingsuit.ts`) — the skier's own input, as
// the player's is: what a lab, a test and a pre-roll fly on.
//
//   * `wingsuitPilot`: hands off on the suit's best glide, following the
//     fall line down the face; looking a few seconds ahead along his way and
//     keeping the snow there a clearance under him — turned down the fall
//     line where the ground ahead rises toward him, pulled up (a flare)
//     where it is close — and, at the height it pulls at over the snow,
//     slowed by a flare and THE PULL. Under the canopy it is the skydive's
//     own pattern (`chute-pilot.ts`).
//
// Pure over the state: nothing here moves anything.

import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { nearestTrackPoint } from "../mapgen/query.ts";
import { WINGSUIT } from "./defs/wingsuit.ts";
import { NEUTRAL_INPUT, type GameState, type SkierInput } from "./state.ts";

const B = WINGSUIT.bot;

/** The fall line's way at (x, z), rad (the heading down the steepest
 * slope), or `fallback` on the flat. */
function fallLine(state: GameState, x: number, z: number, fallback: number): number {
  const level = state.level;
  const gx = level.groundAt(x + 8, z) - level.groundAt(x - 8, z);
  const gz = level.groundAt(x, z + 8) - level.groundAt(x, z - 8);
  return hypot(gx, gz) < 0.5 ? fallback : Math.atan2(-gx, -gz);
}

/** THE BOT'S HANDS on the suit this step, from the edge to the pull (null
 * once the canopy is the thing to fly). */
export function wingsuitPilot(state: GameState): SkierInput | null {
  const ch = state.chute;
  if (!ch || ch.suit !== "wingsuit") return null;
  if (ch.mode !== "exit" && ch.mode !== "freefall") {
    return ch.mode === "open" || ch.mode === "released" ? null : { ...NEUTRAL_INPUT };
  }
  if (ch.mode === "exit" && ch.t < WINGSUIT.exit.clear) return { ...NEUTRAL_INPUT };
  const c = state.skier;
  const level = state.level;
  const w = ch.wing;
  // AHEAD: where his way takes him, and the snow there.
  let least = Infinity;
  for (const s of [B.ahead * 0.5, B.ahead]) {
    const x = c.x + c.vx * s;
    const z = c.z + c.vz * s;
    least = Math.min(least, c.y + c.vy * s - WINGSUIT.body - level.groundAt(x, z));
  }
  // THE PULL: by his height over the valley floor the flight ends on (the
  // mountain's foot — the snow under him off a map with none), never in the
  // start arc; or, flying, the snow ahead closing faster than a flare can
  // lift him off it — the pull as the last thing left.
  const floor = level.mountain
    ? Math.max(level.mountain.base.y, level.groundAt(c.x, c.z) - B.open)
    : level.groundAt(c.x, c.z);
  const over = c.y - floor;
  if (ch.mode === "freefall" && (over <= B.open || (least < 0 && ch.agl < B.keep))) {
    return { ...NEUTRAL_INPUT, machine: true };
  }
  // Down the fall line — and, the last `home` m over the floor, for the
  // piste the canopy will be flown to, so the pull is made where its glide
  // reaches open snow rather than over the woods short of it.
  const down = fallLine(state, c.x + c.vx * B.ahead, c.z + c.vz * B.ahead, ch.heading);
  const spot = over <= B.home ? nearestTrackPoint(level, c.x, c.z) : null;
  const way =
    spot && least >= B.keep && hypot(spot.x - c.x, spot.z - c.z) > B.near
      ? Math.atan2(spot.x - c.x, spot.z - c.z)
      : down;
  const gap = angleDiff(ch.heading, way);
  // Down the fall line, gently; harder where the snow ahead closes on him.
  const urgent = least < B.keep;
  const steer = clamp((urgent ? 2 : 0.6) * gap, -1, 1);
  let lean = 0;
  if (least < B.close) lean = 1;
  else if (over <= B.slow) lean = 0.6;
  // ...a bank pulled harder in, the flare spread wide.
  const brake = least < B.close && (w?.alpha ?? 0) < WINGSUIT.lift.stall ? 1 : 0;
  return { ...NEUTRAL_INPUT, steer, lean, brake };
}
