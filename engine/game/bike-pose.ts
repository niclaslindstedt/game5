// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE AS THE DRAWING READS IT (`bike.ts`'s state): one plain record a
// frame — where the frame is and how it is turned, each wheel's turn about
// its axle, the bars' steer, each end's compression, the cranks, and where
// the rider's body stands on the frame and how he holds it. Pure over the
// state: no renderer, no DOM, nothing drawn from any stream — the seam a
// drawing (or a lab) builds its picture off.

import { BIKE } from "./defs/bike.ts";
import { riderOnFrame } from "./bike-frame.ts";
import type { BikeMode, BikeState } from "./bike-state.ts";

/** THE BIKE'S POSE at a moment. Lengths m, angles rad; the body frame is
 * the engine's (x right, y up, z forward), from the bottom bracket. */
export type BikePose = {
  mode: BikeMode;
  /** The frame's centre of mass, world, and its attitude (the skier's
   * conventions: heading 0 = +z clockwise, pitch nose-up, roll right side
   * down), with the quaternion they came from. */
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  q: BikeState["q"];
  /** Each wheel's turn about its axle, rad (forward positive). */
  frontSpin: number;
  rearSpin: number;
  /** The bars and fork about the steer axis, rad (right positive). */
  steer: number;
  /** The fork's and the rear's travel used, m at the wheel and as a share
   * of the whole (0 topped out, 1 bottomed). */
  fork: number;
  shock: number;
  forkShare: number;
  shockShare: number;
  /** The cranks' angle, rad, and whether they are being turned. */
  crank: number;
  pedalling: boolean;
  /** The brake levers pulled, 0..1. */
  front: number;
  rear: number;
  /** THE RIDER: his centre of mass on the frame, from the bottom bracket in
   * the body frame, m — down as his legs fold, back as he hangs off the
   * rear — his weight's shift fore and aft (+1 back), the legs folded for a
   * pop, 0..1, and the lean the hands are laying the bike to, rad. */
  rider: { x: number; y: number; z: number };
  shift: number;
  crouch: number;
  lean: number;
  /** Whether he is on it, and walking beside it (the walked distance, m,
   * the pace, m/s, the gait's, and whether he pushes it by its bars —
   * the bike stood at `BIKE.walk.push` from him, facing his way). */
  onIt: boolean;
  walking: { walked: number; pace: number; push: boolean } | null;
  /** In the air, and how long for, s. */
  airborne: boolean;
  airTime: number;
};

const at = { x: 0, y: 0, z: 0 };

/** THE POSE of bike `b`. */
export function bikePose(b: BikeState): BikePose {
  riderOnFrame(b, at);
  return {
    mode: b.mode,
    x: b.x,
    y: b.y,
    z: b.z,
    heading: b.heading,
    pitch: b.pitch,
    roll: b.roll,
    q: b.q,
    frontSpin: b.front.turn,
    rearSpin: b.rear.turn,
    steer: b.steer,
    fork: b.front.comp,
    shock: b.rear.comp,
    forkShare: Math.max(0, Math.min(1, b.front.comp / BIKE.frontEnd.travel)),
    shockShare: Math.max(0, Math.min(1, b.rear.comp / BIKE.rearEnd.travel)),
    crank: b.crank,
    pedalling: b.cadence > 0,
    front: b.controls.front,
    rear: b.controls.rear,
    rider: { x: at.x, y: at.y, z: at.z },
    shift: b.shift,
    crouch: Math.max(b.loaded, b.tuck > 0 ? 1 : 0),
    lean: b.aimLean,
    onIt: b.onIt,
    walking: b.afoot ? { ...b.afoot } : null,
    airborne: b.airborne,
    airTime: b.airTime,
  };
}
