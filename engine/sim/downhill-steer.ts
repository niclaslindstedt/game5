// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT ON A SPEED COURSE'S LINE (R32, R33) — how a racer holds the
// racing line (`speedLineAt`) through a downhill's gates eight to ten
// metres wide at a hundred kilometres an hour, and round a super-G's
// turning poles at ninety.
//
// A point chased ahead on the line lags it through every long turn: by the
// time the skier's heading has come round to the point, the line has bent
// on, and he runs two to five metres outside it the whole turn — the width
// of a speed gate's tolerance. So the downhiller FEEDS THE LINE'S OWN BEND
// FORWARD: he stands his skis on the edge the line's bend asks a little
// ahead of him (a carved ski's curvature is tan(edge) / sidecut,
// `carveCurvature`), and only CORRECTS on what he is off it by — his
// distance from the line and his heading against it, read with the turn
// his yaw is carrying him into — as a curvature that would bring him back
// onto it over `look` metres, critically damped. The edge he asks is that
// curvature's, as a share of the edge the physics stands him on at this
// speed (`edgeLockAt`). He carves CUT HARD (`TUNING.carve`) — a speed
// racer's skis stood on their edge and pressed into the groove — and the
// speed his line allows is the grip that cut holds (`cutGrip`).

import { angleDiff, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { speedLineAt, trackPointAt } from "../mapgen/index.ts";
import type { TrackHit, TrackPoint } from "../mapgen/types.ts";
import { techniqueOf } from "../game/defs/technique.ts";
import { edgeLockAt, edgeMostOf } from "../game/limits.ts";
import type { GameState } from "../game/state.ts";

/** THE DOWNHILLER'S HOLD ON THE LINE. */
export const DOWNHILL_STEER = {
  /** How far ahead the line's bend is read, s of travel: the edge rolls
   * over in about that. */
  lead: 0.3,
  /** Over how far he comes back onto the line, m — at rest and per m/s. */
  lookBase: 10,
  lookPerSpeed: 0.45,
  /** How far ahead his own turn is read, s — the heading his yaw will
   * have carried him to. */
  yawLead: 0.25,
  /** THE CHECK: a downhiller over the speed his line allows stands up out
   * of the tuck and scrubs with a light skid — this much of the brake at
   * the most, reached `checkPer` m/s over — and never a hockey stop, which
   * at a hundred kilometres an hour slides him off the line and through
   * the next gate's poles. */
  check: 0.1,
  checkPer: 8,
} as const;

/** THE SUPER-G RACER'S HOLD (R33): the downhiller's, the line's bend and
 * his own turn read half as far ahead. A line swung round a turning pole
 * every fifty metres, its bend fed forward as far as a downhiller's, was
 * cut 1.3 m inside on the median gate and three at the worst — he turned
 * for the next swing before this one's apex; read at 0.15 s the median is
 * 0.7 (seeds 1–8). */
export const SUPER_G_STEER = {
  ...DOWNHILL_STEER,
  lead: 0.15,
  yawLead: 0.15,
} as const;

const pt: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };

/** The steer that holds `state`'s skier on the speed course's racing line,
 * −1..1 — or null on a map with neither a downhill nor a super-G. `on` is where he stands on the
 * piste. */
export function downhillSteer(state: GameState, on: TrackHit): number | null {
  const level = state.level;
  const here = speedLineAt(level, on.s);
  if (!here) return null;
  const offset = here.offset;
  const c = state.skier;
  const K = level.superG ? SUPER_G_STEER : DOWNHILL_STEER;
  const v = Math.max(5, c.speed);
  // The line's own heading here: the piste's, turned by how fast the line
  // moves across it.
  const slope =
    ((speedLineAt(level, on.s + 1)?.offset ?? 0) - (speedLineAt(level, on.s - 1)?.offset ?? 0)) / 2;
  const heading = trackPointAt(level, on.s, pt).heading + Math.atan(slope);
  const yaw = rotate(c.q, { x: c.wx, y: c.wy, z: c.wz }).y;
  const off = on.lateral - offset;
  const turned = angleDiff(heading, c.heading + yaw * K.yawLead);
  const bend = speedLineAt(level, on.s + v * K.lead)?.bend ?? 0;
  const look = K.lookBase + K.lookPerSpeed * v;
  const want = bend - (2 * turned) / look - off / (look * look);
  const spec = c.spec;
  const T = techniqueOf(state.rules);
  const lock = Math.max(0.05, Math.min(edgeMostOf(spec, T), edgeLockAt(spec, c.speed, T)));
  const edge = Math.sign(want) * Math.atan(Math.abs(want) * spec.sidecut);
  return clamp(edge / lock, -1, 1);
}
