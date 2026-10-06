// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN AMATEUR DOWN (`crowd.ts`' `fallDown`): thrown off his skis onto a body
// of his own — the player's RAGDOLL (`ragdoll.ts`, thrown as `crash.ts`'
// `throwOf` throws the player) — which goes over, is dragged flat by the
// snow and lies still; then a few seconds lain there, and up on his skis
// where his feet lay, across the fall line, to turn them down the hill.
// The body draws nothing from any stream, so the crowd's own is drawn as
// it always was. How it is drawn is `pwa/src/game/crowd-fall.ts`'s.

import { angleDiff, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { crashOver, throwOf } from "./crash.ts";
import { place, sampleRun, type Along, type CrowdNet } from "./crowd.ts";
import { CROWD } from "./defs/crowd.ts";
import { SKIS } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import { RAGDOLL, stepRagdoll } from "./ragdoll.ts";
import type { Amateur, CrashCause, GameState } from "./state.ts";

const dt = TUNING.dt;
const here: Along = { x: 0, z: 0, heading: 0, width: 0, pitch: 0, bend: 0 };

/** AN AMATEUR THROWN off his skis by `cause` onto a body of his own — the
 * player's RAGDOLL (`crash.ts`' `throwOf`), stood where he is, going at
 * (`vx`, `vy`, `vz`) and turned over onto `side` (−1 left, 1 right) —
 * which the snow drags flat and lays still. The body draws nothing from
 * any stream, so the crowd's own is drawn as it always was. */
export function throwAmateur(
  a: Amateur,
  side: number,
  cause: CrashCause,
  vx = a.vx,
  vz = a.vz,
  vy = 0,
): void {
  a.mode = "down";
  a.fallSide = side;
  a.kickerAt = NaN;
  a.rise = 0;
  const heading = a.heading;
  a.thrown = throwOf(
    cause,
    fromEuler(heading, 0, 0),
    a.x,
    a.y + SKIS.cogHeight,
    a.z,
    { x: vx, y: vy, z: vz },
    heading,
    side,
    STILL,
  );
}

const STILL = { x: 0, y: 0, z: 0 };

/** DOWN: his body stepped while it goes over and lies, then the few
 * seconds he stays there, then up — where his body came to rest, read
 * back into his run's frame, facing down it. */
export function stepDown(state: GameState, net: CrowdNet, a: Amateur): void {
  const b = a.thrown;
  if (!b) {
    a.mode = "ski";
    return;
  }
  a.speed = 0;
  a.fall = 1;
  a.lean = 0;
  if (a.rise > 0) {
    // Getting up: stood on his skis where he lay, the picture lifting his
    // body off the snow onto them (`crowd-fall.ts`).
    a.rise += dt;
    place(a, net.runs[a.run], state.level);
    if (a.rise >= CROWD.fall.rise) {
      a.thrown = null;
      a.rise = 0;
      a.mode = "ski";
      a.fall = 0;
      a.crouch = 0.3;
    }
    return;
  }
  b.t += dt;
  stepRagdoll(state, b);
  a.x = b.x;
  a.y = state.level.groundAt(b.x, b.z);
  a.z = b.z;
  a.vx = b.vx;
  a.vz = b.vz;
  if (!crashOver(b)) return;
  a.timer -= dt;
  if (a.timer > 0) return;
  // Up: on his feet where his feet lie — his arc and his offset there,
  // two passes along the run's line, and off the piste a way back onto it
  // — his skis set across the fall line, as anyone stands up on a slope,
  // on the side nearer the way he was going: he turns them down the hill
  // from there.
  const P = b.points;
  const fx = (P[3 * RAGDOLL.footL] + P[3 * RAGDOLL.footR]) / 2;
  const fz = (P[3 * RAGDOLL.footL + 2] + P[3 * RAGDOLL.footR + 2]) / 2;
  const r = net.runs[a.run];
  for (let k = 0; k < 2; k++) {
    sampleRun(r, a.s, here);
    const dx = fx - here.x;
    const dz = fz - here.z;
    a.s = clamp(a.s + dx * Math.sin(here.heading) + dz * Math.cos(here.heading), 0, r.length - 0.5);
  }
  sampleRun(r, a.s, here);
  a.d = (fx - here.x) * Math.cos(here.heading) - (fz - here.z) * Math.sin(here.heading);
  const half = here.width / 2;
  if (Math.abs(a.d) > half - 0.4) {
    a.wander = a.d - a.centre;
    a.wanderTo = a.s + CROWD.wander.run[0];
  }
  a.yaw = angleDiff(here.heading, b.heading) >= 0 ? Math.PI / 2 : -Math.PI / 2;
  a.rise = dt;
  place(a, r, state.level);
}
