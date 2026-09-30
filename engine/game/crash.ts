// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIPEOUT — the skier thrown off his skis, and the few seconds before
// the reset stands him back on the piste.
//
// FOUR WAYS OFF, each a threshold on something the step has already
// measured, and each well past anything a clean run meets (`TUNING.crash`):
//   - a TRUNK met hard — the `hit` event's closing speed past `treeSpeed`:
//     the trunk stops the skis, and the man on them goes on at the way he
//     had until the snow or the trunk itself stops him;
//   - a LANDING OVER THE TIPS — a `land` ending a flight of `noseAir` s or
//     more, past `noseImpact` m/s into the slope with the tips more than
//     `noseAngle` down against it: the tips dig and he goes over them. The
//     rebound hop after a touchdown is not judged — a skier who lands
//     tail-first and slaps down onto his tips is riding his own landing;
//   - a FALL AT SPEED — the body lying over on the SNOW (its up under
//     `reset.overUp` of the snow's normal) for `rollHold` s, still going
//     `rollSpeed` or more: an edge lost. Turning over in the air is not yet
//     a fall — the landing decides — and a slow sit-down he rides out, the
//     reset's own clock (`reset.overFor`) standing him up as before;
//   - a CAUGHT EDGE, the high-side — a ski stood well over on its edge
//     (`skier.slipEdge`) while the snow slides past across it faster than
//     `skier.slipSpeed`: the edge bites all at once and the body is thrown
//     over it.
//
// THE SKIER THROWN is a body of his own (`Thrown`): a RAGDOLL
// (`ragdoll.ts`) — the hips, the shoulders, the head and the four limbs as
// thirteen points held at the joints — laid where he stood and sent off at
// `keep` of his velocity before the blow plus a climb, turning head over
// heels at his speed over `tumbleRadius` (with `carry` of his own turning
// on top). Every point meets the snow and the trunks on its own, so he goes
// over once or twice with his arms and legs flung, is dragged down by the
// snow on every turn — at once in deep powder — and slides to rest lying on
// it, the way a body does. None of it is drawn from the stream: a crash is
// a pure function of the moment it started, so a run replays wipeout for
// wipeout.
//
// THE SKIS go on without him — the yard sale: the controls let go
// (`run.ts`), the bindings released, the skis sliding on down the slope
// whatever the hull makes of the ground — and a landing over the tips is
// given the tip-over the tips digging in would put into them. He takes no
// gate while he is off them; the race clock runs.
//
// THE RESET comes once he has been off `lieMin` s and has lain still for
// `lieStill` of them, or at `lieMax` whatever he is doing — the engine's
// reset, reported `auto`. The still beat is the one the app's death cam
// (`camera-death.ts`) rises into the sky over him on.

import { clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { rotate, type Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import { TUNING } from "./defs/tuning.ts";
import { centreOf, stepRagdoll, throwBody } from "./ragdoll.ts";
import type { CrashCause, GameEvent, GameState, SkierState, Thrown } from "./state.ts";

const K = TUNING.crash;
const dt = TUNING.dt;
const n: Vec3 = { x: 0, y: 1, z: 0 };

/** How far the skis' tips point DOWN against the snow under them, rad —
 * negative for tips up off the slope. */
export function noseDown(state: GameState): number {
  const c = state.skier;
  state.level.normalAt(c.x, c.z, n);
  const f = rotate(c.q, { x: 0, y: 0, z: 1 });
  return Math.asin(clamp(-(f.x * n.x + f.y * n.y + f.z * n.z), -1, 1));
}

/** What, of this step's events and the skier's attitude, throws him — or
 * null. `speed0` is his speed before the step. */
export function wipeoutCause(
  state: GameState,
  events: readonly GameEvent[],
  speed0: number,
): CrashCause | null {
  for (const e of events) {
    if (e.kind === "hit" && e.speed >= K.treeSpeed) return "tree";
    // Only the touchdown that ends a real flight: the rebound hop off a
    // landing is that landing's own, however the nose comes down on it.
    if (
      e.kind === "land" &&
      e.airTime >= K.noseAir &&
      e.impact >= K.noseImpact &&
      noseDown(state) >= K.noseAngle
    ) {
      return "nose";
    }
  }
  // Over is over against the SNOW, not the sky — a skier on a steep face
  // stands well off vertical — and ON the snow: a skier turning over in the
  // air has not fallen until he comes down, and one who clips a hip on the
  // way round and comes back onto his skis skis away. So the clock is
  // `rolledFor`, time lying over on the snow, held `rollHold`.
  const c = state.skier;
  const over = !c.airborne && overSnow(state);
  c.rolledFor = over ? c.rolledFor + dt : 0;
  if (c.rolledFor >= K.rollHold && speed0 >= K.rollSpeed) return "roll";
  // THE CAUGHT EDGE: on the snow, the ski well over, sliding across it fast
  // — and not in a SKID, which is a slide the skier asked for: a hockey
  // stop is the skis thrown across the way and slid on their edges.
  const SK = TUNING.skier;
  if (
    !c.airborne &&
    c.skid < K.catchSkid &&
    Math.abs(c.edge) >= SK.slipEdge &&
    c.sideSlip >= SK.slipSpeed
  )
    return "catch";
  return null;
}

/** Whether the skier's up axis is under `reset.overUp` of the snow's own. */
function overSnow(state: GameState): boolean {
  const c = state.skier;
  state.level.normalAt(c.x, c.z, n);
  const up = rotate(c.q, { x: 0, y: 1, z: 0 });
  return up.x * n.x + up.y * n.y + up.z * n.z < TUNING.reset.overUp;
}

/** Throw the skier: `v0` is his velocity before the blow, which is what
 * he carries on with. */
export function throwRider(
  state: GameState,
  cause: CrashCause,
  v0: Vec3,
  events: GameEvent[],
): Thrown {
  const c = state.skier;
  const flat = hypot(v0.x, v0.z);
  const speed = hypot3(v0.x, v0.y, v0.z);
  const heading = flat > 1 ? Math.atan2(v0.x, v0.z) : c.heading;
  // Head over heels about the axis across the way he goes, forward
  // positive (a right-handed turn about his right), and a share of his own
  // turning — a body going over takes its turn with it.
  const over = Math.min(K.maxSpin, (flat * K.keep) / K.tumbleRadius);
  const own = rotate(c.q, { x: c.wx, y: c.wy, z: c.wz });
  const w = {
    x: Math.cos(heading) * over + own.x * K.carry,
    y: own.y * K.carry,
    z: -Math.sin(heading) * over + own.z * K.carry,
  };
  const v = { x: v0.x * K.keep, y: Math.max(0, v0.y) * K.keep + K.throwUp, z: v0.z * K.keep };
  const body = throwBody(c.q, c.x, c.y, c.z, v, w);
  const com = centreOf(body.points);
  const thrown: Thrown = {
    cause,
    t: 0,
    x: com.x,
    y: com.y,
    z: com.z,
    vx: v.x,
    vy: v.y,
    vz: v.z,
    heading,
    tumble: 0,
    points: body.points,
    last: body.last,
    touching: false,
    still: 0,
  };
  if (cause === "nose") {
    // The tips dig and the skis go over them: a tips-down pitch rate is a
    // positive `wx`.
    const e = events.find((ev) => ev.kind === "land");
    const impact = e && e.kind === "land" ? e.impact : 0;
    c.wx += Math.min(K.skiKickMax, K.skiKick * impact);
  }
  c.thrown = thrown;
  events.push({ kind: "wipeout", t: state.t, cause, speed, x: c.x, z: c.z });
  return thrown;
}

/** One step of the skier's own body on the snow. */
export function stepThrown(state: GameState, b: Thrown): void {
  b.t += dt;
  stepRagdoll(state, b);
}

/** Whether the skier has lain long enough for the reset to stand him up. */
export function crashOver(b: Thrown): boolean {
  if (b.t >= K.lieMax) return true;
  return b.t >= K.lieMin && b.still >= K.lieStill;
}

/** The skis' share of the step's bookkeeping with nobody on them: nothing
 * is asked of the automatic reset's clocks while the crash owns the run. */
export function quietClocks(c: SkierState): void {
  c.overFor = 0;
  c.stuckFor = 0;
  c.trenchFor = 0;
  c.boggedFor = 0;
  c.rolledFor = 0;
}
