// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS ON THE HOT AIR BALLOON (`balloon.ts`) — three-free, so the suite
// reads it. The skier's ladder (`camera-rigs.ts`) frames a skier two metres
// tall; stood in a basket under an envelope twenty metres tall, the same
// booms put the balloon out of the top of the frame and the bolted rungs
// inside the wicker. So while he is in the basket the ladder is framed off
// THE BALLOON, on rows of its own, and handed back the moment he is over
// the side (the fall look takes him then, `camera-fall.ts`):
//
//   TIPS    OVER THE RIM: he leans out over the wall the way he faces, his
//           eyes just inside the rim's leather roll, looking DOWN at the
//           snow far below — the rim, the wicker's edge and a corner's
//           rods in the foot of the frame. As he walks the eye slides along
//           the wall; as he turns it goes to the wall he faces.
//   HELMET  HIS OWN EYES where he stands, looking out the way he faces and
//           a little down: the rim across the frame, the flying wires, the
//           mountain over it.
//   CHASE   behind the basket at the height of the envelope's mouth, the
//           whole balloon in the frame and the snow under it;
//   FAR     the same further out and higher, the mountain round it;
//   HIGH    high over it, looking down on the crown and the drop under it;
//   ORBIT   round it, level with its middle.
//
// The booms are framed from a point `lift` m over the basket's floor (the
// balloon's middle, a little under the envelope's), and the bolted rungs'
// eyes are written each frame (`BalloonLadder.pose`) in the frame the pose
// turns them by — the basket's attitude and the way he faces — so a change
// between any two rungs is flown by the lens's own hand-over (`camera.ts`).

import { fromEuler, multiply, rotate, unrotate, type BalloonState, type Quat } from "@engine";

import {
  RIGS,
  type BoltedRig,
  type BoomRig,
  type Rig,
  type RigPose,
  type Rung,
} from "./camera-rigs.ts";

/** THE BALLOON'S LENS, in the basket's frame (x right, y up from the floor,
 * z forward), m and rad. */
export const BALLOON_LOOK = {
  /** How far over the floor the booms frame from, m — the middle of the
   * balloon's whole height (the basket at its foot, the crown 24 m up),
   * pulled down a little toward the basket and the snow under it. */
  lift: 10,
  /** WHERE HIS EYE LEANS TO, half-widths, m: the floor's half (1.35 ×
   * 1.75) less the wall's 0.05 and a hand's 0.1 more, so the rim's leather
   * roll (0.055 thick, standing in over the wall) is a band at the frame's
   * foot rather than a slab across it. */
  inside: { x: 0.525, z: 0.725 },
  /** How near a corner the leaning eye may come along a wall, m: the
   * corner's padded rods rise from it toward the burner frame, and an eye
   * any nearer is inside one. */
  corner: 0.3,
  /** OVER THE RIM (TIPS): his eyes, m over the floor, leant forward over
   * the rim (a standing man's 1.68 bent over a 1.12 m wall, his chin a
   * hand back from the roll), how far they are tipped down, rad, and the
   * fov, deg. */
  over: { y: 1.5, down: 0.95, fov: 74 },
  /** HIS EYES (HELMET): over the floor, m, ahead of his boots, m, tipped
   * down, rad, and the fov, deg. */
  eyes: { y: 1.68, ahead: 0.1, down: 0.5, fov: 72 },
  /** How quickly the leaning eye follows a change of wall, s — he moves his
   * head, it does not jump across a corner. */
  follow: 0.18,
} as const;

const L = BALLOON_LOOK;

const bolted = (fov: number, down: number): BoltedRig => ({
  kind: "bolted",
  eye: { x: 0, y: 0, z: 0 },
  look: 30,
  down,
  fov,
  fovPerSpeed: 0,
  // Stood in a basket hanging still in the air: no buzz, a level horizon.
  rollShare: 0,
  tremor: 0,
  fallDown: 0,
});

const boom = (over: Partial<BoomRig>): BoomRig => ({
  ...(RIGS.chase as BoomRig),
  distPerSpeed: 0,
  fovPerSpeed: 0,
  hold: 0,
  surge: 0,
  tremor: 0,
  // The arm swings round slowly after a balloon that turns slowly, half
  // toward the way it drifts.
  yaw: { f: 0.35, zeta: 1, r: 0 },
  slipWeight: 0.4,
  lift: { f: 0.9, zeta: 0.9, r: 2 },
  liftAir: { f: 0.6, zeta: 0.95, r: 2 },
  lagMax: 6,
  // Level: the slope under a balloon is no reason to tip the lens.
  incline: 0,
  inclineSteep: 0,
  look: { f: 0.8, zeta: 1, r: 0 },
  place: 0,
  frame: 0.9,
  ride: 0,
  fall: 0,
  ...over,
});

/** The ladder's sizes: every boom is framed from `lift` m over the floor,
 * so its height is over that. */
const LADDER = {
  chase: boom({ dist: 31, height: -2, aimAhead: 20, fov: 58, fovMax: 58, clearance: 3 }),
  far: boom({ dist: 62, height: 12, aimAhead: 30, fov: 54, fovMax: 54, clearance: 4 }),
  high: boom({ dist: 34, height: 52, aimAhead: 10, fov: 60, fovMax: 60, clearance: 6 }),
} as const;

/** The basket as drawn this frame: its floor's centre and its attitude. */
export type BasketAt = { x: number; y: number; z: number; q: Quat };

export type BalloonLadder = {
  /** The rows, one per rung — the same object every frame, so the lens
   * knows the ladder it is on (`camera.ts`). Its bolted rows' eyes are
   * rewritten by `pose`. */
  rigs: Record<Rung, Rig>;
  /** THE POSE THE LADDER FRAMES IN THE BASKET, written over `pose`: `lift`
   * m over the basket's floor as drawn (`at`, or the engine's own before
   * the first drawn frame), turned by its attitude and the way he faces;
   * the leaning eye moved on `dt` s. */
  pose(pose: RigPose, b: BalloonState, at: BasketAt | null, dt: number): RigPose;
  /** Start the leaning eye where he leans now (a new ride, a lens snapped). */
  snap(): void;
};

/** WHERE HE LEANS OUT OVER THE RIM, in the basket's frame: from his boots
 * along the way he faces to the wall's inside, kept `corner` m off the
 * corners. */
export function rimPoint(walkX: number, walkZ: number, face: number): { x: number; z: number } {
  const dx = Math.sin(face);
  const dz = Math.cos(face);
  const tx = Math.abs(dx) < 1e-6 ? Infinity : (Math.sign(dx) * L.inside.x - walkX) / dx;
  const tz = Math.abs(dz) < 1e-6 ? Infinity : (Math.sign(dz) * L.inside.z - walkZ) / dz;
  if (tx < tz) {
    const most = L.inside.z - L.corner;
    return { x: Math.sign(dx) * L.inside.x, z: Math.max(-most, Math.min(most, walkZ + dz * tx)) };
  }
  const most = L.inside.x - L.corner;
  return { x: Math.max(-most, Math.min(most, walkX + dx * tz)), z: Math.sign(dz) * L.inside.z };
}

/** HIS EYES, stood where he is, in the basket's frame. */
export function eyePoint(
  walkX: number,
  walkZ: number,
  face: number,
): { x: number; y: number; z: number } {
  let x = walkX + Math.sin(face) * L.eyes.ahead;
  let z = walkZ + Math.cos(face) * L.eyes.ahead;
  // Stood in a corner his head is beside the corner's rod as it leans in
  // toward the burner frame: the eye is held a hand's width off it.
  const rise = (L.eyes.y - RODS.foot.y) / (RODS.head.y - RODS.foot.y);
  const rx = Math.sign(x || 1) * (RODS.foot.x + (RODS.head.x - RODS.foot.x) * rise);
  const rz = Math.sign(z || 1) * (RODS.foot.z + (RODS.head.z - RODS.foot.z) * rise);
  const gap = Math.hypot(x - rx, z - rz);
  if (gap < RODS.clear) {
    // Pushed toward the basket's middle, the way off the rod that stays in.
    const ux = gap > 1e-6 ? (x - rx) / gap : -Math.sign(rx);
    const uz = gap > 1e-6 ? (z - rz) / gap : -Math.sign(rz);
    const inward = ux * -Math.sign(rx) + uz * -Math.sign(rz) > 0;
    const sx = inward ? ux : -Math.sign(rx) * Math.SQRT1_2;
    const sz = inward ? uz : -Math.sign(rz) * Math.SQRT1_2;
    x = rx + sx * RODS.clear;
    z = rz + sz * RODS.clear;
  }
  return { x, y: L.eyes.y, z };
}

/** The corner rods, in the basket's frame (the +x, +z one; the others are
 * its mirrors): from the rim's corner up to the burner frame's, m, and how
 * far off one the standing eye is held, m. */
const RODS = {
  foot: { x: 0.675, y: 1.23, z: 0.875 },
  head: { x: 0.42, y: 2.15, z: 0.42 },
  clear: 0.15,
};

export function createBalloonLadder(): BalloonLadder {
  const tips = bolted(L.over.fov, L.over.down);
  const helmet = bolted(L.eyes.fov, L.eyes.down);
  const rigs: Record<Rung, Rig> = {
    tips,
    helmet,
    chase: LADDER.chase,
    far: LADDER.far,
    high: LADDER.high,
    orbit: { kind: "orbit", radius: 44, height: -2, spin: 0.1, fov: 56 },
  };
  // The leaning eye as it is (it eases after a change of wall), or null.
  let lean: { x: number; z: number } | null = null;
  const into = (out: { x: number; y: number; z: number }, q: Quat, qB: Quat, v: typeof out) => {
    // The eye in the basket's frame → off the pose's point (`lift` m over
    // the floor, straight up in the world) → in the pose's own frame.
    const w = rotate(qB, v);
    const local = unrotate(q, { x: w.x, y: w.y - L.lift, z: w.z });
    out.x = local.x;
    out.y = local.y;
    out.z = local.z;
  };
  return {
    rigs,
    snap() {
      lean = null;
    },
    pose(pose, b, at, dt) {
      const qB = at ? at.q : fromEuler(b.heading, b.pitch, b.roll);
      const q = multiply(qB, fromEuler(b.face, 0, 0));
      const rim = rimPoint(b.walkX, b.walkZ, b.face);
      if (!lean) lean = { ...rim };
      else {
        const k = 1 - Math.exp(-Math.max(0, dt) / L.follow);
        lean.x += (rim.x - lean.x) * k;
        lean.z += (rim.z - lean.z) * k;
      }
      into(tips.eye, q, qB, { x: lean.x, y: L.over.y, z: lean.z });
      into(helmet.eye, q, qB, eyePoint(b.walkX, b.walkZ, b.face));
      pose.x = at ? at.x : b.x;
      pose.y = (at ? at.y : b.y) + L.lift;
      pose.z = at ? at.z : b.z;
      pose.q = q;
      // The booms swing after the basket's own heading, never his face.
      pose.heading = b.heading;
      pose.pitch = 0;
      pose.roll = 0;
      pose.vx = b.vx;
      pose.vy = b.vy;
      pose.vz = b.vz;
      pose.speed = Math.hypot(b.vx, b.vy, b.vz);
      pose.airborne = !b.grounded;
      pose.switched = false;
      pose.packed = 1;
      pose.summit = 0;
      pose.ride = null;
      return pose;
    },
  };
}

/** Whether the lens is the balloon's this frame: he is in its basket. */
export function inBasket(b: BalloonState | undefined, thrown: boolean): b is BalloonState {
  return !!b?.aboard && !thrown;
}
