// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FALL LOOK — the lens over a skier falling a long way: pushed off a
// helicopter's skid, let go of a paramotor's wing, sent off a cliff band.
// Three-free, so the suite reads it (`tests/camera_test.ts`).
//
// A boom framed for skiing stands behind the skier a little over his head
// and looks down the hill past him; a skier twenty metres up is then a
// figure against the haze with the snow he is about to meet out of the
// bottom of the frame — and the snow is the one thing he needs to see,
// because it is where he will land and how steep it is there that decide
// whether he rides it away. So once a flight's ARC (the ballistic path
// from where he is, traced over the map until it meets the snow) says he
// has a long way still to fall, the boom climbs up over his back the way a
// skydiver's camera flier does, and the look tips down to hold both of
// them: the skier near the top of the frame and the snow under the arc —
// THE LANDING — below him. The worn lenses (TIPS, HELMET) look down with
// his head, the way a skier spots a drop.
//
// It comes in with the fall and stays for the whole of it (the share is
// never let down while he is still in the air, so the lens does not wheel
// back up over the last metres, the ones he lands by); back on the snow
// it is let go over a second, so a landing ridden away is followed out
// down the face rather than cut to. A kicker's flight never brings it in:
// it starts at `FALL.from` metres still to fall, past any jump on a piste.

import type { RigPose, Vec3 } from "./camera-rigs.ts";

export const FALL = {
  /** Metres still to fall (the CoG over where the arc meets the snow)
   * where the look starts to come in, and where it is whole. */
  from: 7,
  full: 18,
  /** How briskly the share comes in while he falls, and goes once he is
   * on the snow, 1/s. */
  rise: 1.6,
  release: 1.1,
  /** The boom's arm over his back when the look is whole, rad above the
   * level (55°), and how much longer the arm is let out, × its length. */
  up: 0.96,
  reach: 1.25,
  /** Where the skier is held in the frame, as a share of the vertical
   * half-fov ABOVE the axis at most and BELOW it at most — the look tips
   * down between him and his landing inside that band. */
  top: 0.55,
  under: 0.25,
  /** The share of the half-fov the skier is never let out of, whole. */
  frame: 0.9,
  /** How many degrees the fov opens by (none: it has opened with the
   * speed already, and wider still the skier is a speck). */
  fov: 0,
  /** Share of the way across the travel against the nose the boom's yaw
   * takes: a skier falling with any way on him is followed along it, so
   * where he lands stays ahead of the lens. */
  slip: 1,
  /** The arc: its step, s, how far ahead it is traced, s, and the pull,
   * m/s² (the air's drag left out — it only shortens the fall). */
  step: 1 / 15,
  horizon: 12,
  g: 9.81,
  /** Where the CoG stands over the snow at a touchdown, m. */
  stand: 1,
} as const;

/** A lens's memory of a fall: the share of the look, 0..1, and where the
 * arc last met the snow. */
export type FallMemory = { share: number; land: Vec3 };

export function createFallMemory(): FallMemory {
  return { share: 0, land: { x: 0, y: 0, z: 0 } };
}

/** WHERE THIS FALL COMES DOWN: the arc from the pose under `FALL.g`,
 * traced until the CoG is back at its standing height over the snow, into
 * `out` (the snow under that point); false if the arc runs past
 * `FALL.horizon` without meeting it, when `out` is the snow under its end. */
export function fallAhead(
  pose: RigPose,
  groundAt: (x: number, z: number) => number,
  out: Vec3,
): boolean {
  let x = pose.x;
  let y = pose.y;
  let z = pose.z;
  let vy = pose.vy;
  for (let t = FALL.step; t <= FALL.horizon; t += FALL.step) {
    x += pose.vx * FALL.step;
    z += pose.vz * FALL.step;
    vy -= FALL.g * FALL.step;
    y += vy * FALL.step;
    const ground = groundAt(x, z);
    if (y - FALL.stand > ground) continue;
    out.x = x;
    out.y = ground;
    out.z = z;
    return true;
  }
  out.x = x;
  out.y = groundAt(x, z);
  out.z = z;
  return false;
}

/** THE SHARE OF THE FALL LOOK this frame, stepped on `mem`: brought in
 * while the arc says he has a long way down, held through the rest of the
 * fall, let go on the snow. `snap` takes the share at once (a new run). */
export function stepFall(
  mem: FallMemory,
  pose: RigPose,
  groundAt: (x: number, z: number) => number,
  dt: number,
  snap: boolean,
): number {
  let want = 0;
  if (pose.airborne && !pose.ride) {
    fallAhead(pose, groundAt, mem.land);
    const drop = pose.y - FALL.stand - mem.land.y;
    const u = Math.max(0, Math.min(1, (drop - FALL.from) / (FALL.full - FALL.from)));
    // Held while he is still up: only a bigger fall raises it.
    want = Math.max(u * u * (3 - 2 * u), snap ? 0 : mem.share);
  }
  if (snap) mem.share = want;
  else {
    const rate = want > mem.share ? FALL.rise : FALL.release;
    mem.share += (want - mem.share) * (1 - Math.exp(-rate * dt));
    if (mem.share < 1e-4) mem.share = 0;
  }
  return mem.share;
}

/** The share as the lens moves by it: eased at both ends. */
export function fallEase(share: number): number {
  const s = Math.max(0, Math.min(1, share));
  return s * s * (3 - 2 * s);
}

/** THE LOOK'S PITCH IN A FALL, rad, positive up: from `eye`, along the
 * plan bearing (`fx`, `fz`), halfway between the skier (`skierPitch`, the
 * pitch the skier stands at from the eye) and his landing — held so the
 * skier is no more than `FALL.top` of the half-fov above the axis and
 * `FALL.under` below it. `half` is the vertical half-fov, rad. */
export function fallPitch(
  eye: Vec3,
  fx: number,
  fz: number,
  land: Vec3,
  skierPitch: number,
  half: number,
): number {
  const ahead = (land.x - eye.x) * fx + (land.z - eye.z) * fz;
  const landPitch = Math.atan2(land.y - eye.y, Math.max(0.5, ahead));
  const t = Math.tan(half);
  const above = Math.atan(FALL.top * t);
  const below = Math.atan(FALL.under * t);
  const mid = (skierPitch + landPitch) / 2;
  return Math.max(skierPitch - above, Math.min(skierPitch + below, mid));
}
