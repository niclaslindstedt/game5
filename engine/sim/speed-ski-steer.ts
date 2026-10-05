// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT ON A SPEED TRACK (R34) — a speed skier's whole run: out of the
// house on the push the tuck throws him into, and from there FOLDED, the
// skis flat, straight down the middle of the track. He holds it with the
// smallest corrections a body in a tuck makes — the downhiller's hold on a
// line (`downhill-steer.ts`) with the line the track's middle and no bend
// to feed forward, read far ahead, the edge he asks a share of the speed
// skier's few degrees — and never brakes: the timing zone ends his run,
// and past it the run-out's stand-up and skid are the engine's
// (`run.ts`), as they are for every racer home.

import { angleDiff, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import type { TrackHit } from "../mapgen/types.ts";
import { techniqueOf } from "../game/defs/technique.ts";
import { edgeLockAt, edgeMostOf } from "../game/limits.ts";
import { NEUTRAL_INPUT, type GameState, type SkierInput } from "../game/state.ts";

/** THE SPEED SKIER'S HOLD ON THE TRACK'S MIDDLE. */
export const SPEED_SKI_STEER = {
  /** Over how far he comes back onto the middle, m — at rest and per m/s:
   * at 200 km/h a correction is spread over a hundred metres and more. */
  lookBase: 15,
  lookPerSpeed: 2,
  /** How far ahead his own turn is read, s. */
  yawLead: 0.3,
} as const;

/** The input that skis `state`'s skier down the speed track, or null on a
 * map with none. `on` is where he stands on the track. */
export function speedSkiInput(state: GameState, on: TrackHit): SkierInput | null {
  const level = state.level;
  if (!level.speedSki || !state.rules.course) return null;
  const c = state.skier;
  const K = SPEED_SKI_STEER;
  const v = Math.max(5, c.speed);
  const heading = level.track.points[0].heading;
  const yaw = rotate(c.q, { x: c.wx, y: c.wy, z: c.wz }).y;
  const turned = angleDiff(heading, c.heading + yaw * K.yawLead);
  const look = K.lookBase + K.lookPerSpeed * v;
  const want = -(2 * turned) / look - on.lateral / (look * look);
  const spec = c.spec;
  const T = techniqueOf(state.rules);
  const lock = Math.max(0.05, Math.min(edgeMostOf(spec, T), edgeLockAt(spec, c.speed, T)));
  const edge = Math.sign(want) * Math.atan(Math.abs(want) * spec.sidecut);
  return { ...NEUTRAL_INPUT, steer: clamp(edge / lock, -1, 1), tuck: 1 };
}
