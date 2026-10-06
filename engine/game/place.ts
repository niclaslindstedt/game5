// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// PLACING A RUN AT A MOMENT instead of riding to it. A landing only exists
// once a kicker has been taken, and a screenshot or a test of one used to
// cost the whole run. This stands the skier where the run would have left
// him: at a plan point, on a heading, at a speed — on his legs on the snow,
// or in the air at a height with an attitude and a climb — folded into a
// tuck as though he had been schussing. The tests, the ride lab and the
// app's staged scenes all stage through it.
//
// THE MOMENT ITSELF IS STILL THE ENGINE'S TO EMIT: a placed flight lands on
// the next steps and fires `land` the way every landing fires. Nothing random
// is drawn, so a placed moment reproduces from its description exactly.

import { clamp, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { standSkier } from "./course.ts";
import { derive } from "./skier.ts";
import { bottomlessOf, depthUnder, packedSnow, sinkTarget } from "./snow.ts";
import { probesOf } from "./suspension.ts";
import type { GameState } from "./state.ts";

const normal = { x: 0, y: 1, z: 0 };

export type RunMoment = {
  x: number;
  z: number;
  /** Heading, rad (0 = +z, clockwise from above). */
  heading: number;
  /** Speed along the heading, m/s; at rest when left out. */
  speed?: number;
  /** Height of the CoG above the snow, m. Left out, the skier stands on
   * his legs; given, he is in the air with `vy` m/s of climb. */
  height?: number;
  vy?: number;
  /** Attitude, rad: tips up positive, right side down positive. */
  pitch?: number;
  roll?: number;
  /** A pitch rate already under way, rad/s, tips up positive. */
  pitchRate?: number;
  /** The run clock, and the gate owed — given, the start gate counts as
   * already crossed. */
  time?: number;
  nextCheckpoint?: number;
  /** Seconds of the lights still to run in front of the moment, the
   * skier held in the start gate through them; none when left out. */
  lights?: number;
};

/** Stand the run at a moment. A staged moment has no lights in front of
 * it unless it asks for them: the run is racing from here. */
export function placeRun(state: GameState, moment: RunMoment): void {
  if (moment.lights !== undefined && moment.lights > 0) {
    state.phase = "countdown";
    state.countdown = moment.lights;
  } else if (state.phase === "countdown") {
    state.phase = "racing";
    state.countdown = 0;
  }
  const c = state.skier;
  standSkier(state, moment.x, moment.z, moment.heading);
  // Stood at a moment, off any lift (`lift-ride.ts`).
  state.skier.lift = null;
  state.skier.chairLeft = null;
  // ...and carried there, not skied: where he last left a run is forgotten.
  state.progress.lastOnRun = null;
  const speed = moment.speed ?? 0;
  const pitch = moment.pitch ?? c.pitch;
  const roll = moment.roll ?? c.roll;
  c.q = fromEuler(moment.heading, pitch, roll);
  const level = state.level;
  const fx = Math.sin(moment.heading);
  const fz = Math.cos(moment.heading);
  const flying = moment.height !== undefined && moment.height > 0;
  if (flying) {
    c.vx = fx * speed;
    c.vz = fz * speed;
    c.vy = moment.vy ?? 0;
  } else {
    // ON THE SNOW the way runs ALONG THE SLOPE: a skier placed at speed on
    // a pitch is skiing down it, not flying off it — a level velocity on a
    // 20° face is a launch. So the heading is laid into the ground's
    // tangent plane and the speed put along that.
    level.normalAt(moment.x, moment.z, normal);
    const dn = fx * normal.x + fz * normal.z;
    const tx = fx - dn * normal.x;
    const ty = -dn * normal.y;
    const tz = fz - dn * normal.z;
    const tl = hypot3(tx, ty, tz) || 1;
    c.vx = (tx / tl) * speed;
    c.vy = moment.vy ?? (ty / tl) * speed;
    c.vz = (tz / tl) * speed;
  }
  c.wx = -(moment.pitchRate ?? 0);
  const packed = packedSnow(state, moment.x, moment.z);
  const probes = probesOf(c.spec);
  for (let i = 0; i < probes.length; i++)
    c.sinks[i] = sinkTarget(
      packed,
      speed,
      probes[i].sinkScale,
      probes[i].planeScale,
      depthUnder(state.snowDepth, state.fresh),
      1,
      bottomlessOf(state.snowDepth),
    );
  if (flying) {
    c.y = level.groundAt(moment.x, moment.z) + moment.height!;
    c.airborne = true;
    c.airTime = 0.2;
    c.airReported = true;
    c.launchVy = c.vy;
  } else {
    c.y = level.groundAt(moment.x, moment.z) - c.sinks[probes.length - 1] + c.spec.cogHeight;
  }
  // A skier who has been schussing: folded into his tuck at any pace.
  const tucked = clamp(speed / 5, 0, 1);
  c.tuck = tucked;
  c.crouch = tucked;
  // The crouch sits him lower on his legs (`skier.ts`), never in the air.
  if (!c.airborne) c.y -= c.spec.crouchDrop * c.crouch;
  derive(c, state.level);
  if (moment.time !== undefined) state.progress.time = moment.time;
  if (moment.nextCheckpoint !== undefined) {
    state.progress.nextCheckpoint = moment.nextCheckpoint;
    state.progress.started = true;
  }
}
