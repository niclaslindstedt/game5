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
//           head over the rim's leather roll, looking DOWN at the snow far
//           below — the roll a thin band across the foot of the frame. As he walks the eye slides along
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

import {
  BALLOON,
  fromEuler,
  multiply,
  rotate,
  unrotate,
  type BalloonState,
  type Quat,
} from "@engine";

import {
  RIGS,
  type BoltedRig,
  type BoomRig,
  type OrbitRig,
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
  /** WHERE HIS EYE LEANS TO, half-widths, m: his head out over the rim's
   * leather roll (centred 0.025 in from the wall's outer face at 0.675 ×
   * 0.875, 0.055 round), right over its middle — so the roll is a
   * thin band across the frame's foot, the drop to the snow the rest of it,
   * and none of the wall's inside or the cylinders in the corners shows. */
  inside: { x: 0.65, z: 0.85 },
  /** How near a corner the leaning eye may come along a wall, m: the
   * corner's padded rods rise from it toward the burner frame, and an eye
   * any nearer is inside one. */
  corner: 0.3,
  /** OVER THE RIM (TIPS): his eyes, m over the floor, leant out over the
   * rim (a standing man's 1.68 bent over a 1.12 m wall, his chin 0.3 m over
   * the roll), how far they are tipped down, rad, and the fov, deg: the
   * frame's foot 86° down, just short of straight under him, where the
   * roll's outer edge stands. */
  over: { y: 1.47, down: 0.88, fov: 72 },
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

/** THE BOOMS ON A TALL SCREEN (a phone held upright): the frame is
 * narrower than it is tall, and a boom framed for a wide one has the
 * envelope's 17.2 m spilling off both sides. Under an aspect of 1 every
 * boom's fov is opened by `fov` degrees for each 0.1 the screen is narrower
 * than square (to `most`), and the arm let out until the envelope's width
 * with `margin` of it again either side fits across. */
export const TALL = { fov: 3, most: 76, margin: 0.3 } as const;

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
  /** Frame the booms for a screen `aspect` wide to its height (`TALL`). */
  fit(aspect: number): void;
};

/** A boom framed for a screen `aspect` wide to its height: `base` itself on
 * a screen at least square, else its fov opened and its arm let out until
 * the envelope fits across (`TALL`). */
export function tallBoom<R extends { fov: number }>(
  base: R,
  aspect: number,
  arm: (r: R) => number,
  withArm: (r: R, fov: number, arm: number) => R,
): R {
  if (aspect >= 1) return base;
  const fov = Math.min(TALL.most, base.fov + TALL.fov * 10 * (1 - aspect));
  const half = Math.tan(((fov / 2) * Math.PI) / 180) * aspect;
  const need = ((BALLOON.envelope.diameter / 2) * (1 + 2 * TALL.margin)) / half;
  return withArm(base, fov, Math.max(arm(base), need));
}

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
  const orbit: OrbitRig = { kind: "orbit", radius: 44, height: -2, spin: 0.1, fov: 56 };
  const rigs: Record<Rung, Rig> = {
    tips,
    helmet,
    chase: LADDER.chase,
    far: LADDER.far,
    high: LADDER.high,
    orbit,
  };
  const boomArm = (r: BoomRig) => r.dist;
  const boomTo = (r: BoomRig, fov: number, dist: number): BoomRig => ({
    ...r,
    fov,
    fovMax: fov,
    dist,
  });
  let fitted = 0;
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
    fit(aspect) {
      // A new row only when the screen's shape has changed.
      const a = Math.round(Math.min(1, aspect) * 100) / 100;
      if (a === fitted) return;
      fitted = a;
      rigs.chase = tallBoom(LADDER.chase, a, boomArm, boomTo);
      rigs.far = tallBoom(LADDER.far, a, boomArm, boomTo);
      rigs.high = tallBoom(LADDER.high, a, boomArm, boomTo);
      rigs.orbit = tallBoom(
        orbit,
        a,
        (r) => r.radius,
        (r, fov, radius) => ({ ...r, fov, radius }),
      );
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

/** WHAT A FLOWN LENS MAY NOT PASS THROUGH, in the basket's frame: the
 * wicker (the floor's plan out to the outer faces, up to the rim's roll)
 * and the envelope (an ellipsoid round it, from just under the mouth to
 * over the crown, a little wider than its 17.2 m), each with a pad, m. The
 * first-person eyes stand over the rim and under the mouth, outside both. */
export const KEEP_OUT = {
  pad: 0.25,
  rimTop: BALLOON.basket.wall + 0.055,
  envelope: {
    y: BALLOON.envelope.mouthHeight + BALLOON.envelope.height * 0.5,
    up: BALLOON.envelope.height * 0.5 + 0.9,
    across: BALLOON.envelope.diameter / 2 + 0.6,
  },
} as const;

/** THE LENS KEPT OUT OF THE BALLOON while a change of rung is flown
 * (`camera.ts`): `eye` (world) put back on the nearest side of the basket's
 * rim or the envelope's skin it was inside, in place. The hand-over blends
 * the eye in a straight line, and the line from a first-person eye to a
 * boom can run through the wicker or up through the envelope; slid over
 * them instead, it never shows their inside. */
export function keepOutOfBalloon(eye: { x: number; y: number; z: number }, at: BasketAt): void {
  const k = KEEP_OUT;
  const l = unrotate(at.q, { x: eye.x - at.x, y: eye.y - at.y, z: eye.z - at.z });
  let moved = false;
  const hx = BALLOON.basket.width / 2 + k.pad;
  const hz = BALLOON.basket.length / 2 + k.pad;
  if (Math.abs(l.x) < hx && Math.abs(l.z) < hz && l.y > -k.pad && l.y < k.rimTop + k.pad) {
    // Over the rim: the way out that never crosses the wicker.
    l.y = k.rimTop + k.pad;
    moved = true;
  }
  const e = k.envelope;
  const sx = l.x / e.across;
  const sy = (l.y - e.y) / e.up;
  const sz = l.z / e.across;
  const r = Math.hypot(sx, sy, sz);
  if (r < 1) {
    // Out along the ellipsoid's own radius, to its skin.
    const n = r > 1e-6 ? 1 / r : 1;
    l.x = sx * n * e.across;
    l.y = e.y + (r > 1e-6 ? sy * n : 1) * e.up;
    l.z = sz * n * e.across;
    moved = true;
  }
  if (!moved) return;
  const w = rotate(at.q, l);
  eye.x = at.x + w.x;
  eye.y = at.y + w.y;
  eye.z = at.z + w.z;
}

/** Whether the lens is the balloon's this frame: he is in its basket. */
export function inBasket(b: BalloonState | undefined, thrown: boolean): b is BalloonState {
  return !!b?.aboard && !thrown;
}
