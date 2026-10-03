// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMERA LADDER, as data and as arithmetic. Where each lens stands
// against the skier, how heavy it is, and how it frames the snow ahead — one
// row per rung, because the difference between two cameras IS the row.
// `camera.ts` puts the answer on a three.js camera; this module is
// three-free so the suite reads it (`tests/world_render_test.ts`).
//
// Two kinds of rung. `tips` and `helmet` are WORN: the lens is a point in
// the skier's own body frame, and it pitches and rolls with him — which is
// the whole sensation of those views, the tips nodding over every roller
// and the horizon tipping into every carve. The rest are BOOMS: a lens that
// stands behind the skier on a yaw that FOLLOWS the heading rather than
// copying it, and a height that is sprung rather than bolted, so a mogul
// under the skis is not a mogul under the lens. `orbit` is the menus'
// drone, flown slowly round the skier.
//
// A BOOM HAS WEIGHT. Every reading it chases — the yaw, the height, the
// fall line, the pitch of the look — is a second-order spring
// (`camera-spring.ts`) whose poles the row places: a lens that has to be
// accelerated into a move and settles out of it, rather than one that
// jumps at its fastest the instant the target does.
//
// A BOOM LEANS WITH THE MOUNTAIN, and composes the skier. It reads the
// fall line down its own bearing from just behind the skier to where he
// will be in a moment (`ahead`), so it starts to tip before a face drops
// away; swings its arm up the slope behind him by `incline` of that pitch,
// so the lens keeps its height over the snow; and pitches the look to
// stand him at `place` of the half-fov under the middle of the frame —
// the same place on a green's 9° and a black's 38°. A lens that aimed
// level whatever the snow did stood the skier at the foot of the frame on
// a steep face under half a picture of sky; one that tipped all the way
// with the face would read it as flat. Leaning most of the way keeps the
// horizon riding high in the frame and the drop under it, which is how a
// steep face is FELT.
//
// THE SNOW IS THE DIFFERENCE FROM THE WATER GAME. A skier rides on ground
// that does not move, so the booms follow the TERRAIN'S height under the
// skis rather than a mean water line, and the chase row sits lower than a
// jet ski's: the two tracks the edges cut are the thing a player looks back
// down, and a lens two metres up at five metres back is where they read.
//
// THE SENSE OF SPEED (`PACE`). A lens that only frames reads 100 km/h over
// open snow as half that, so three readings of pace are folded in on top of
// the framing, each small enough to go unnoticed until it is gone:
//
//   * THE STRETCH. The fov widens with speed while the boom pulls in along
//     its own line (`hold`), so the skier keeps his size in the frame and
//     the WORLD is what rushes out past the edges. A boom that ran out with
//     speed as the fov widened would shrink the skier into the distance,
//     which is the one picture that reads as slow.
//   * THE SURGE. The lens has mass on the end of its arm: it falls behind a
//     skier dropping into a tuck and swings in over one throwing a skid,
//     and settles back to its length when the pace is steady.
//   * THE TREMOR. Past a brisk pace the lens buzzes — the chatter of the
//     skis over hard snow — harder on the groomer than in powder, and goes
//     still the moment the skis leave the snow: the air is quiet, which is
//     half of what makes it air. A few incommensurate oscillators under
//     8 Hz on an eased envelope, never a fresh random offset per frame.
//
// THE SKIER STAYS IN THE PICTURE. The boom's height is sprung, and slowly
// in the air, which is what makes a flight hang — but a skier dropping off
// a cliff band falls faster than any spring follows, and a lens that
// trailed him by its whole lag (and aimed from that lagged height) lost him
// out of the bottom of the frame. Two things answer it, neither felt on the
// snow: the lag is let run only to `lagMax` metres, easing into it rather
// than hitting it, and the look TILTS — the aim is pitched down (or up)
// just far enough that the skier stays inside `frame` of the half-fov, the
// way an operator tips the head to follow a drop.
//
// THE BOOM IS PUSHED OFF THE TRUNKS. Off the piste the woods close in, and
// a lens that pulled its arm in for every trunk jolted at the skier, while
// one that swung its whole arm round every crown that came near its line
// wheeled the picture about for trees the skier had long since cleared. So
// the lens answers a trunk the way a magnet answers its like pole: nothing
// at all until it comes within `MAGNET.gap + MAGNET.soft` of the bark, then
// eased sideways off it — more the nearer it is — and never let closer than
// `MAGNET.gap` (`repel`). A skier who just makes it past a tree has the
// lens come by after him and give it a metre, and no more. The look still
// runs through the skier. The boughs are left in the frame: the forest
// takes a tree the lens has passed into out of the picture (`forest.ts`).

import { rotate, type Quat } from "@engine";

import type { RideLook } from "./camera-lift.ts";

import {
  createSpring,
  follow,
  followAngle,
  settle,
  type Poles,
  type Spring,
} from "./camera-spring.ts";

export type Vec3 = { x: number; y: number; z: number };

/** What the rigs read of a skier — the interpolated pose. */
export type RigPose = {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  airborne: boolean;
  /** The packed share under the skis, 0 powder .. 1 groomed. */
  packed: number;
  /** Body → world (the framework's `core/quat` convention). */
  q: Quat;
  /** AT A SUMMIT, 0..1 (`camera-summit.ts`): on a top station's pad and
   * over its lip, where the boom holds its look level (`SUMMIT_LOOK`). */
  summit?: number;
  /** ON A LIFT (`camera-lift.ts`): how much of the lift's close look the
   * boom takes, and that look — from boarding to the lead onto a run. */
  ride?: RideLook | null;
};

/** What a rig asks of the lens this frame. `roll` is the horizon's tilt,
 * rad, right side down positive. */
export type LensPose = { eye: Vec3; target: Vec3; fov: number; roll: number };

export type BoltedRig = {
  kind: "bolted";
  /** The eye in the skier's body frame, m (x right, y up, z forward). */
  eye: Vec3;
  /** How far ahead along the body's forward axis it looks, m. */
  look: number;
  fov: number;
  fovPerSpeed: number;
  /** Share of the skier's roll the horizon keeps, 0..1. */
  rollShare: number;
  /** Share of `PACE.tremor` the lens takes. */
  tremor: number;
};

export type BoomRig = {
  kind: "boom";
  /** Standoff behind the skier, m, and what each m/s of pace adds. */
  dist: number;
  distPerSpeed: number;
  /** Height over the skier, m, on level snow. */
  height: number;
  /** How far past the skier the look reaches, m — where the target stands
   * along the look, which `lookAt` needs and nothing else does. */
  aimAhead: number;
  fov: number;
  fovPerSpeed: number;
  fovMax: number;
  /** THE STRETCH: share of the fov's widening the arm pulls in along its
   * own line to keep the skier his size in the frame, 0..1. */
  hold: number;
  /** Shares of `PACE.surge` and `PACE.tremor` the lens takes. */
  surge: number;
  tremor: number;
  /** How the yaw swings after the nose (`camera-spring.ts`). */
  yaw: Poles;
  /** Share of the travel direction (against the nose) the yaw takes. */
  slipWeight: number;
  /** How the lens's height follows the skier's, on the snow and in the
   * air — softer in the air, which is what makes a flight hang. */
  lift: Poles;
  liftAir: Poles;
  /** The most the lens's height is let trail the skier's, m — a soft cap. */
  lagMax: number;
  /** THE INCLINE: share of the fall line's pitch the arm rises by up the
   * slope behind, and so the look tips down by, 0..1. 1 rides parallel to
   * the snow (a steep face reads flat); 0 stands level (a steep face reads
   * as sky). `inclineSteep` is the share on the steepest faces
   * (`STEEP`): tipped further there, so the piste ahead still shows over
   * the skier's head where the drop needs no help to read. */
  incline: number;
  inclineSteep: number;
  /** How far ahead the fall line is read, s of travel (never under
   * `LEAN_REACH` m), and how the reading is followed. */
  ahead: number;
  lean: Poles;
  /** THE COMPOSITION: where the skier stands in the frame, as a share of
   * the vertical half-fov BELOW the axis, and how the look's pitch chases
   * the angle that puts him there. */
  place: number;
  look: Poles;
  /** Share of the half-fov (vertical) the skier is never let out of, 0..1. */
  frame: number;
  /** The lens is never closer to the snow under it than this, m. */
  clearance: number;
  /** Share of a lift's close look (`RigPose.ride`) the rig takes, 0..1: the
   * chase comes in behind a rider, the far and high lenses keep their own. */
  ride: number;
};

export type OrbitRig = {
  kind: "orbit";
  radius: number;
  height: number;
  /** rad/s round the skier. */
  spin: number;
  fov: number;
};

export type Rig = BoltedRig | BoomRig | OrbitRig;

export type Rung = "tips" | "helmet" | "chase" | "far" | "high" | "orbit";

export const RIGS: Record<Rung, Rig> = {
  // LOW OVER THE SKI TIPS, a hand's height off the snow and a little ahead
  // of the boots: the shovels in the bottom corners and the snow coming
  // straight at the lens — every ripple in the piste, every rut.
  tips: {
    kind: "bolted",
    eye: { x: 0, y: -0.62, z: 0.55 },
    look: 30,
    fov: 74,
    fovPerSpeed: 0.4,
    rollShare: 0.85,
    tremor: 1,
  },
  // THE HELMET CAM: the skier's own eyes, at the height of a standing head
  // over the body's origin (the tuck folds the body and the lens with it,
  // because the eye is in the body frame), looking down the fall line.
  helmet: {
    kind: "bolted",
    eye: { x: 0, y: 0.72, z: 0.08 },
    look: 30,
    fov: 68,
    fovPerSpeed: 0.35,
    rollShare: 0.6,
    tremor: 0.8,
  },
  // THE CHASE: behind and above, the skier composed a little under the
  // middle of the frame and the piste he is about to ski over his head.
  // On a steep face the arm rises up the slope behind him and the look
  // tips down the fall line with it — but only half way: tipped further,
  // the face reads as a flat plain under a level horizon, and the drop
  // under the skis is what a steep piste is felt by. Close and LOW — a
  // little under head height, because the snow streams past at the pace
  // over the lens's height, and a lens two metres up halves it — on a fov
  // that opens wide with speed while the arm pulls in, so the skier keeps
  // his size and the snow at the frame's edges is what rushes.
  chase: {
    kind: "boom",
    dist: 4.3,
    distPerSpeed: 0,
    height: 1.7,
    aimAhead: 12,
    fov: 62,
    fovPerSpeed: 0.75,
    fovMax: 86,
    hold: 0.5,
    surge: 1,
    tremor: 1,
    yaw: { f: 1.2, zeta: 0.9, r: 0 },
    slipWeight: 0.3,
    lift: { f: 1.8, zeta: 0.7, r: 2 },
    liftAir: { f: 0.9, zeta: 0.85, r: 2 },
    lagMax: 2.2,
    incline: 0.5,
    inclineSteep: 0.75,
    ahead: 0.6,
    lean: { f: 0.7, zeta: 1, r: 0 },
    place: 0.3,
    look: { f: 1.6, zeta: 0.85, r: 0 },
    frame: 0.66,
    clearance: 0.9,
    ride: 1,
  },
  far: {
    kind: "boom",
    dist: 10,
    distPerSpeed: 0.02,
    height: 3.8,
    aimAhead: 14,
    fov: 56,
    fovPerSpeed: 0.5,
    fovMax: 76,
    hold: 0.5,
    surge: 1.4,
    tremor: 0.6,
    yaw: { f: 0.8, zeta: 0.9, r: 0 },
    slipWeight: 0.4,
    lift: { f: 1.2, zeta: 0.75, r: 2 },
    liftAir: { f: 0.7, zeta: 0.85, r: 2 },
    lagMax: 3.2,
    incline: 0.4,
    inclineSteep: 0.6,
    ahead: 0.8,
    lean: { f: 0.55, zeta: 1, r: 0 },
    place: 0.22,
    look: { f: 1.2, zeta: 0.9, r: 0 },
    frame: 0.66,
    clearance: 1.4,
    ride: 0,
  },
  high: {
    kind: "boom",
    dist: 13,
    distPerSpeed: 0.05,
    height: 10,
    aimAhead: 14,
    fov: 56,
    fovPerSpeed: 0.2,
    fovMax: 66,
    hold: 0,
    surge: 1,
    tremor: 0.3,
    yaw: { f: 0.65, zeta: 0.9, r: 0 },
    slipWeight: 0.5,
    lift: { f: 0.8, zeta: 0.8, r: 2 },
    liftAir: { f: 0.5, zeta: 0.9, r: 2 },
    lagMax: 4.5,
    incline: 0.35,
    inclineSteep: 0.35,
    ahead: 1,
    lean: { f: 0.45, zeta: 1, r: 0 },
    place: 0.12,
    look: { f: 1, zeta: 0.9, r: 0 },
    frame: 0.66,
    clearance: 3,
    ride: 0,
  },
  orbit: { kind: "orbit", radius: 16, height: 6, spin: 0.14, fov: 55 },
};

/** Shortest signed turn from `a` to `b`, rad. */
export function turn(a: number, b: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** A boom's memory between frames: the springs it swings, lifts, leans and
 * looks on (`camera-spring.ts`), the orbit's angle, and how far out along
 * its arm the lens is let stand (`pull`, 1 the whole arm). `fresh` asks the
 * next frame to snap rather than ease (a new run, a reset). */
export type BoomState = {
  /** The yaw the arm has swung to, rad (free to wind past ±π). */
  yaw: Spring;
  /** The height the lens is framed from, m. */
  y: Spring;
  /** The fall line's pitch the arm leans to, rad, positive dropping ahead. */
  slope: Spring;
  /** The pitch of the look, rad, positive up. */
  pitch: Spring;
  orbit: number;
  pull: number;
  /** THE MAGNET's memory: the side of each trunk the lens is being pushed
   * off to (+1 or -1, across the arm), so a lens that runs at a trunk dead
   * on is not flipped from one side of it to the other half way through;
   * and the slide still owed round a trunk the arm swung over (`Slide`). */
  sides: Map<number, number>;
  slide: Slide | null;
  fresh: boolean;
  /** THE SURGE's memory: the last frame's speed, m/s, the acceleration
   * read off it, m/s², and the metres of standoff it has the arm out to. */
  lastSpeed: number;
  accel: number;
  surge: number;
  /** THE TREMOR's memory: its own clock, s, and its envelope, 0..1. */
  clock: number;
  buzz: number;
};

export function createBoomState(): BoomState {
  return {
    yaw: createSpring(),
    y: createSpring(),
    slope: createSpring(),
    pitch: createSpring(),
    orbit: 0,
    pull: 1,
    sides: new Map(),
    slide: null,
    fresh: true,
    lastSpeed: 0,
    accel: 0,
    surge: 0,
    clock: 0,
    buzz: 0,
  };
}

/** THE SENSE OF SPEED — every number the three readings of pace are made
 * of (the header says what each is for). The rigs only scale them. */
export const PACE = {
  tremor: {
    /** Where it starts, and where it is whole, m/s (36 and 94 km/h). */
    from: 10,
    full: 26,
    /** How far a boom's lens travels at the whole of it, m. */
    travel: 0.01,
    /** How far a bolted lens's aim swings at the whole of it, rad. */
    aim: 0.0012,
    /** How far the horizon cants at the whole of it, rad. */
    roll: 0.0012,
    /** The oscillators, Hz: incommensurate, and under the 8 Hz a 30 fps
     * phone still resolves as a wave rather than a lurch. */
    freq: [4.3, 5.9, 7.3],
    /** Share of it in deep powder against the groomer: powder floats. */
    powder: 0.5,
    /** How briskly the envelope follows, 1/s — gone at once when the snow
     * falls away, back a beat after a landing. */
    rise: 5,
    fall: 16,
  },
  surge: {
    /** Metres of standoff per m/s² along the way, and the most either way:
     * a skier pulling 6 m/s² is let fall a metre behind. */
    gain: 0.16,
    max: 1.1,
    /** How briskly the acceleration is read, and the arm follows it, 1/s. */
    read: 4,
    follow: 3,
  },
} as const;

/** THE TREMOR at this frame: advances the envelope and returns the wave,
 * each axis in -1..1 times the envelope, with the share it was asked for. */
function tremorAt(
  st: BoomState,
  pose: RigPose,
  share: number,
  dt: number,
): { x: number; y: number; r: number } {
  const T = PACE.tremor;
  const pace = Math.max(0, Math.min(1, (pose.speed - T.from) / (T.full - T.from)));
  const ground = T.powder + (1 - T.powder) * Math.max(0, Math.min(1, pose.packed));
  const want = pose.airborne ? 0 : pace * pace * ground * share;
  const rate = want > st.buzz ? T.rise : T.fall;
  st.buzz = st.fresh ? want : st.buzz + (want - st.buzz) * (1 - Math.exp(-rate * dt));
  st.clock += dt;
  if (st.buzz < 1e-4) return { x: 0, y: 0, r: 0 };
  const w = st.clock * Math.PI * 2;
  const a = Math.sin(w * T.freq[0]);
  const b = Math.sin(w * T.freq[1] + 2.1);
  const c = Math.sin(w * T.freq[2] + 4.3);
  return {
    x: (a * 0.6 + c * 0.4) * st.buzz,
    y: (b * 0.7 + c * 0.3) * st.buzz,
    r: (a * 0.5 - b * 0.5) * st.buzz,
  };
}

/** THE SURGE at this frame: metres the arm is let out past its length. */
function surgeAt(st: BoomState, pose: RigPose, share: number, dt: number): number {
  const S = PACE.surge;
  if (st.fresh || dt <= 0) {
    st.lastSpeed = pose.speed;
    st.accel = 0;
    st.surge = 0;
    return 0;
  }
  // Read along the ground only: a fall gains speed the tuck did not.
  const raw = pose.airborne ? 0 : (pose.speed - st.lastSpeed) / dt;
  st.lastSpeed = pose.speed;
  st.accel += (raw - st.accel) * (1 - Math.exp(-S.read * dt));
  const want = Math.max(-S.max, Math.min(S.max, st.accel * S.gain)) * share;
  st.surge += (want - st.surge) * (1 - Math.exp(-S.follow * dt));
  return st.surge;
}

/** WHAT THE LENS MAY NOT STAND INSIDE: the share (0..1) of the line from
 * `from` to `to` that is clear before it first runs into something solid —
 * a trunk, a crown, the arch. `camera-clear.ts` answers it for a map. */
export type LineClear = (from: Vec3, to: Vec3) => number;

/** A trunk the lens is kept off: which tree (`id`), where it stands, its
 * radius, and the heights it runs between, m. */
export type Trunk = { id: number; x: number; z: number; r: number; y0: number; y1: number };
/** THE TRUNKS NEAR A POINT: every one whose bark is within `reach` m of
 * (`x`, `z`) in plan, into `out`. `camera-clear.ts` answers it for a map. */
export type TrunksNear = (x: number, z: number, reach: number, out: Trunk[]) => Trunk[];

/** THE ARM PULLED IN. The arm is shortened to the first thing `clear`
 * calls solid between the skier's head and the lens — at once, because a
 * frame inside a post is the fault — and let back out slowly. Never closer
 * than `PULL_MIN` m. The ridden booms are handed a clear that lets the trees
 * through (`camera-clear.ts`): a trunk flicking past is not worth a jolt —
 * the lens is PUSHED OFF the trunks instead (`trunks`, `repel`). */
export const PULL_MIN = 1.6;
/** How briskly the arm lets back out, 1/s. */
export const PULL_RELEASE = 1.8;
/** The pivot the arm is measured from: over the boots, at the helmet. */
export const PULL_PIVOT = 1.3;

/** One frame of `rig` behind `pose`, `dt` s after the last. `groundAt` keeps
 * the lens out of the hill; `clear` is what the arm pulls in against, and
 * `trunks` what the lens is pushed off. */
export function frameRig(
  rig: Rig,
  pose: RigPose,
  st: BoomState,
  dt: number,
  groundAt: (x: number, z: number) => number,
  clear?: LineClear,
  trunks?: TrunksNear,
): LensPose {
  if (rig.kind === "bolted") {
    const off = rotate(pose.q, rig.eye);
    const eye = { x: pose.x + off.x, y: pose.y + off.y, z: pose.z + off.z };
    // Bolted on, the tremor swings the aim: the whole world buzzes.
    const shake = tremorAt(st, pose, rig.tremor, dt);
    const swing = rig.look * PACE.tremor.aim;
    const fwd = rotate(pose.q, { x: shake.x * swing, y: shake.y * swing, z: rig.look });
    const target = { x: eye.x + fwd.x, y: eye.y + fwd.y, z: eye.z + fwd.z };
    st.fresh = false;
    return {
      eye,
      target,
      fov: rig.fov + rig.fovPerSpeed * pose.speed,
      roll: pose.roll * rig.rollShare + shake.r * PACE.tremor.roll,
    };
  }
  if (rig.kind === "orbit") {
    st.orbit += rig.spin * dt;
    const eye = {
      x: pose.x + Math.sin(st.orbit) * rig.radius,
      y: 0,
      z: pose.z + Math.cos(st.orbit) * rig.radius,
    };
    eye.y = Math.max(pose.y + rig.height, groundAt(eye.x, eye.z) + 2);
    st.fresh = false;
    return { eye, target: { x: pose.x, y: pose.y + 0.6, z: pose.z }, fov: rig.fov, roll: 0 };
  }
  // THE BOOM. Its yaw follows a blend of the nose and the travel.
  const snap = st.fresh;
  const plan = Math.hypot(pose.vx, pose.vz);
  const travel = plan > 2 ? Math.atan2(pose.vx, pose.vz) : pose.heading;
  const want = pose.heading + turn(pose.heading, travel) * rig.slipWeight;
  const yaw = snap ? settle(st.yaw, want) : followAngle(st.yaw, rig.yaw, want, dt);
  const lx = Math.sin(yaw);
  const lz = Math.cos(yaw);
  // THE FALL LINE, read down the arm's own bearing from a little behind the
  // skier to where he will be in `ahead` s — so the arm starts to rise and
  // the look to tip BEFORE the face drops away, not after.
  const reachAhead = Math.max(LEAN_REACH, rig.ahead * pose.speed);
  const drop =
    groundAt(pose.x - lx * LEAN_BEHIND, pose.z - lz * LEAN_BEHIND) -
    groundAt(pose.x + lx * reachAhead, pose.z + lz * reachAhead);
  const ground = Math.max(LEAN_MIN, Math.min(LEAN_MAX, Math.atan2(drop, reachAhead + LEAN_BEHIND)));
  // ON A LIFT (`camera-lift.ts`) the snow under him is the wrong ground: the
  // arm reads his own path instead — the rope's climb, then the ramp's fall.
  const ride = pose.ride ? pose.ride.share * rig.ride : 0;
  const path = Math.max(RIDE_CLIMB, Math.min(LEAN_MAX, -Math.atan2(pose.vy, Math.max(plan, 0.5))));
  const fall = ground + (path - ground) * ride;
  const slope = snap ? settle(st.slope, fall) : follow(st.slope, rig.lean, fall, dt);
  // The height follows the skier on its spring, told the DESCENT the fall
  // line predicts as the target's own velocity: a steady schuss down a face
  // is tracked with no lag, and only the rollers in it are smoothed away.
  const descent = -plan * Math.tan(slope);
  // AT A SUMMIT the height hangs on the air's softer spring: pushed off
  // over the lip, he drops away under a lens that holds a beat at the top.
  const summit = Math.max(0, Math.min(1, pose.summit ?? 0));
  const softly = pose.airborne || summit > SUMMIT_LOOK.soft;
  const lifted = snap
    ? settle(st.y, pose.y)
    : follow(
        st.y,
        softly ? rig.liftAir : rig.lift,
        pose.y,
        dt,
        descent * (1 - summit) * (1 - ride) + pose.vy * ride,
      );
  // The height the lens is FRAMED from: the spring's, with its lag eased
  // into `lagMax` so a long fall cannot leave the lens up on the cliff.
  const lag = pose.y - lifted;
  const y = pose.y - rig.lagMax * Math.tanh(lag / rig.lagMax);
  const surge = surgeAt(st, pose, rig.surge, dt);
  const shake = tremorAt(st, pose, rig.tremor, dt);
  st.fresh = false;
  // THE STRETCH: the arm pulled in along its own line by the share of the
  // fov's widening it holds, so the skier keeps his size in the frame.
  const look = pose.ride;
  const chased =
    Math.min(rig.fovMax, rig.fov + rig.fovPerSpeed * pose.speed) + SUMMIT_LOOK.fov * summit;
  const fov = look ? chased + (look.fov - chased) * ride : chased;
  const half = (d: number) => Math.tan((d * Math.PI) / 360);
  const arm = 1 - rig.hold * (1 - half(rig.fov) / half(chased));
  const far = (rig.dist + rig.distPerSpeed * pose.speed) * arm + surge;
  const dist = look ? far + (look.dist - far) * ride : far;
  const rise = look ? rig.height * arm + (look.height - rig.height * arm) * ride : rig.height * arm;
  // THE INCLINE: the arm swung up the slope behind by its share of the
  // fall line's pitch, about the skier — the lens keeps its height over
  // the snow it stands above instead of meeting it.
  const len = Math.hypot(dist, rise);
  const steep = Math.max(0, Math.min(1, (slope - STEEP.from) / (STEEP.full - STEEP.from)));
  // AT A SUMMIT the arm stays level rather than leaning with the face, so
  // the drop reads as the drop it is.
  const incline =
    (rig.incline + (rig.inclineSteep - rig.incline) * steep * steep * (3 - 2 * steep)) *
    (1 - SUMMIT_LOOK.level * summit) *
    (1 - ride);
  const up = Math.atan2(rise, dist) + incline * slope;
  const eye = {
    x: pose.x - Math.sin(yaw) * len * Math.cos(up),
    y: y + len * Math.sin(up),
    z: pose.z - Math.cos(yaw) * len * Math.cos(up),
  };
  eye.y = Math.max(eye.y, groundAt(eye.x, eye.z) + rig.clearance);
  let fx = Math.sin(yaw);
  let fz = Math.cos(yaw);
  // THE MAGNET: the lens eased off the trunks, the look turned with it so
  // it still runs through the skier.
  if (trunks && repel(eye, pose, st, trunks, snap, dt)) {
    eye.y = Math.max(eye.y, groundAt(eye.x, eye.z) + rig.clearance);
    const bx = pose.x - eye.x;
    const bz = pose.z - eye.z;
    const b = Math.hypot(bx, bz);
    if (b > 1e-3) {
      fx = bx / b;
      fz = bz / b;
    }
  }
  if (clear) pullIn(eye, pose, st, snap, dt, clear, groundAt);
  // THE COMPOSITION: the look pitched to stand the skier `place` of the
  // half-fov under the axis, measured from the sprung height so his heave
  // over a roller moves HIM in the frame rather than the horizon — and
  // chased on its own spring, so the head has weight.
  const halfAngle = (fov * Math.PI) / 360;
  const place = look ? rig.place + (look.place - rig.place) * ride : rig.place;
  const placed = Math.atan(place * Math.tan(halfAngle));
  const back = Math.hypot(pose.x - eye.x, pose.z - eye.z);
  // Carried up a lift the look tips up with the climb, the rope and the
  // top station ahead over his head rather than the slope under the chair.
  const climb = Math.max(0, -slope) * RIDE_LOOK_UP * ride;
  const composed = Math.atan2(y + FRAME_AT - eye.y, back) + placed + climb;
  const pitch = snap ? settle(st.pitch, composed) : follow(st.pitch, rig.look, composed, dt);
  const reach = back + rig.aimAhead;
  const target = {
    x: eye.x + fx * reach,
    y: eye.y + reach * Math.tan(Math.max(-TILT_MAX, Math.min(TILT_MAX, pitch))),
    z: eye.z + fz * reach,
  };
  tiltToFrame(eye, target, pose, halfAngle, rig.frame, placed);
  // The tremor last, on the lens alone: the look's own spring never sees it.
  const buzz = PACE.tremor.travel;
  eye.x += fz * shake.x * buzz;
  eye.y += shake.y * buzz;
  eye.z -= fx * shake.x * buzz;
  return { eye, target, fov, roll: shake.r * PACE.tremor.roll };
}

/** THE LOOK AT A SUMMIT (`camera-summit.ts`): the share of the boom's
 * lean with the mountain taken out (all but a little), the share past which
 * its height hangs on the air's softer spring, and the degrees the fov opens
 * by — the face under the horizon, and the drop off the lip felt. */
export const SUMMIT_LOOK = { level: 0.9, soft: 0.5, fov: 6 } as const;

/** THE FALL LINE's reading: metres behind the skier it starts, the least
 * it reaches ahead, m, and the pitch it is held between, rad (a short rise
 * up a kicker's face tips the arm down a little; a cliff no more than
 * 55°). */
const LEAN_BEHIND = 3;
const LEAN_REACH = 6;
const LEAN_MIN = -0.3;
/** The steepest climb a lift's path is read at, rad (a chair's rope runs
 * up to about 35°). */
const RIDE_CLIMB = -0.65;
/** Share of a lift's climb the look tips up by (`RIGS.chase.ride`). */
const RIDE_LOOK_UP = 0.6;
const LEAN_MAX = 0.95;
/** The fall line's pitch, rad, where a boom's incline starts to move from
 * `incline` toward `inclineSteep`, and where it is all the way there (15°,
 * a blue's pitch, and 35°). */
const STEEP = { from: 0.26, full: 0.61 };

/** Where on the skier the lens frames: the middle of him, between his
 * boots (a metre under his centre of gravity, the pose's origin) and his
 * helmet, m over the origin. */
export const FRAME_AT = -0.1;
/** The steepest the look ever pitches, rad — short of straight down,
 * where `lookAt`'s up vector has no answer. */
const TILT_MAX = 1.35;
/** Share of the kept band the skier roams before the look starts to tip. */
const TILT_KNEE = 0.5;

/** THE TILT, the guard over the composition: pitch the look from `eye`
 * through `target` so the skier never stands more than `frame` of the
 * vertical half-fov (`half` rad) off its axis, keeping the aim's bearing
 * and its reach. The band is measured round where he is COMPOSED (`placed`
 * rad under the axis): inside its knee the look is left alone; past it his
 * offset is eased into the band rather than stopped at it, so the lens
 * tips into a drop and back out of it without a kink. Moves only
 * `target.y`. */
function tiltToFrame(
  eye: Vec3,
  target: Vec3,
  pose: RigPose,
  half: number,
  frame: number,
  placed: number,
): void {
  const reach = Math.hypot(target.x - eye.x, target.z - eye.z);
  if (reach < 1e-6 || half <= 0) return;
  const aim = Math.atan2(target.y - eye.y, reach);
  const skier = Math.atan2(pose.y + FRAME_AT - eye.y, Math.hypot(pose.x - eye.x, pose.z - eye.z));
  const room = Math.max(half * frame - placed, half * 0.1);
  const off = skier - aim + placed;
  const knee = room * TILT_KNEE;
  if (Math.abs(off) <= knee) return;
  const give = room - knee;
  const kept = Math.sign(off) * (knee + give * Math.tanh((Math.abs(off) - knee) / give));
  const pitch = Math.max(-TILT_MAX, Math.min(TILT_MAX, skier + placed - kept));
  target.y = eye.y + reach * Math.tan(pitch);
}

/** THE MAGNET: the free space the lens keeps round a trunk's bark, m; the
 * band beyond it, m, over which the push eases in from nothing; how far
 * over a trunk's top, m, the push fades out, so a lens rising over a tree
 * is let go of smoothly; and how briskly a slide round a trunk the arm has
 * swung over is let out, 1/s. */
export const MAGNET = { gap: 1, soft: 0.8, top: 1, slide: 5 };

/** A lens carried round a trunk: the trunk, and the turn about its axis,
 * rad, and the metres out from it, that the lens stands off where the push
 * alone would put it — both let out at `MAGNET.slide`. */
export type Slide = { x: number; z: number; near: number; turn: number; out: number };

const nearTrunks: Trunk[] = [];
const keptSides = new Map<number, number>();

/** Push `eye` off every trunk `trunks` finds near it, in plan, and say
 * whether it moved. Read across the arm (from the skier out to the lens) a
 * lens comes by a trunk along the arm and passes it to one side; so the
 * push is SIDEWAYS, the way a magnet deflects one going by its like pole.
 * Round each trunk is a wall across the arm, `r + gap` off its axis abeam
 * and closing to nothing `2 (r + gap)` ahead and behind it on a curve that
 * stays outside the circle the lens may not enter; a lens further across
 * than the wall and `soft` beyond it is left where it stands, one inside
 * that band is eased out on a curve that meets the untouched one with no
 * kink, and one inside the wall itself is held at it. It is pushed to the
 * side it came at the trunk on (`st.sides`, taken while it is clear of the
 * band), so a lens dead on a trunk goes round one side of it. Only an arm
 * swung right over a trunk with the lens beside it brings the lens out of
 * the band on the far side: then it is carried round the trunk from where
 * it was held to where it is (`st.slide`), never through it. No spring
 * otherwise, and no look ahead: the lens never lags into the bark. */
function repel(
  eye: Vec3,
  pose: RigPose,
  st: BoomState,
  trunks: TrunksNear,
  snap: boolean,
  dt: number,
): boolean {
  const { gap, soft, top } = MAGNET;
  if (snap) {
    st.sides.clear();
    st.slide = null;
  }
  // The widest trunk the generator grows, m (`forest.trunk`).
  trunks(eye.x, eye.z, 2 * gap + soft + 0.5, nearTrunks);
  keptSides.clear();
  let moved = false;
  let slid = false;
  for (const t of nearTrunks) {
    if (eye.y > t.y1 + top || eye.y < t.y0) continue;
    let ax = eye.x - pose.x;
    let az = eye.z - pose.z;
    const al = Math.hypot(ax, az);
    if (al < 1e-6) continue;
    ax /= al;
    az /= al;
    const rx = eye.x - t.x;
    const rz = eye.z - t.z;
    const along = rx * ax + rz * az;
    const across = rx * az - rz * ax;
    const near = t.r + gap;
    const u = along / (2 * near);
    const wall = Math.abs(u) < 1 ? near * (1 - u * u) ** 2 : 0;
    const band = Math.min(soft, wall);
    const held = st.sides.get(t.id);
    const clearOf = Math.abs(across) >= wall + band;
    const side = clearOf && across !== 0 ? Math.sign(across) : (held ?? (across >= 0 ? 1 : -1));
    if (wall > 0 || held !== undefined) keptSides.set(t.id, side);
    // Over to the far side, clear of the band: carried round from the wall.
    if (held !== undefined && side !== held && wall > 0) {
      const fromX = t.x + along * ax + held * wall * az;
      const fromZ = t.z + along * az - held * wall * ax;
      const was = st.slide && st.slide.x === t.x && st.slide.z === t.z ? st.slide : null;
      const fromA = Math.atan2(fromX - t.x, fromZ - t.z) + (was ? was.turn : 0);
      const fromR = Math.hypot(fromX - t.x, fromZ - t.z) + (was ? was.out : 0);
      slid = true;
      st.slide = {
        x: t.x,
        z: t.z,
        near,
        turn: turn(Math.atan2(rx, rz), fromA),
        out: fromR - Math.hypot(rx, rz),
      };
    }
    if (clearOf) continue;
    const x = side * across;
    const h =
      x <= wall - band ? wall : x >= wall + band ? x : wall + (x - wall + band) ** 2 / (4 * band);
    // Over the trunk's top the push fades out.
    const w = Math.min(1, Math.max(0, (t.y1 + top - eye.y) / top));
    const push = (side * h - across) * w;
    eye.x += push * az;
    eye.z -= push * ax;
    moved = true;
  }
  st.sides.clear();
  for (const [id, side] of keptSides) st.sides.set(id, side);
  const sl = st.slide;
  if (sl) {
    if (!slid) {
      const k = Math.exp(-MAGNET.slide * dt);
      sl.turn *= k;
      sl.out *= k;
    }
    if (Math.abs(sl.turn) < 1e-3 && Math.abs(sl.out) < 1e-3) st.slide = null;
    const rx = eye.x - sl.x;
    const rz = eye.z - sl.z;
    const r = Math.hypot(rx, rz);
    const a = Math.atan2(rx, rz) + sl.turn;
    const out = Math.max(r + sl.out, Math.min(r, sl.near));
    eye.x = sl.x + Math.sin(a) * out;
    eye.z = sl.z + Math.cos(a) * out;
    moved = true;
  }
  return moved;
}

/** Shorten the arm from the skier's helmet to `eye` to what is clear. */
function pullIn(
  eye: Vec3,
  pose: RigPose,
  st: BoomState,
  snap: boolean,
  dt: number,
  clear: LineClear,
  groundAt: (x: number, z: number) => number,
): void {
  const pivot = { x: pose.x, y: pose.y + PULL_PIVOT, z: pose.z };
  const len = Math.hypot(eye.x - pivot.x, eye.y - pivot.y, eye.z - pivot.z);
  if (len <= PULL_MIN) {
    st.pull = 1;
    return;
  }
  const floor = PULL_MIN / len;
  const want = Math.max(floor, Math.min(1, clear(pivot, eye)));
  const was = st.pull;
  if (snap || want < was) st.pull = want;
  else st.pull = was + (want - was) * (1 - Math.exp(-PULL_RELEASE * dt));
  if (st.pull >= 0.999) return;
  eye.x = pivot.x + (eye.x - pivot.x) * st.pull;
  eye.y = pivot.y + (eye.y - pivot.y) * st.pull;
  eye.z = pivot.z + (eye.z - pivot.z) * st.pull;
  // Drawn in along a line that may dip, the lens still keeps off the snow.
  const ground = groundAt(eye.x, eye.z) + 0.5;
  if (eye.y < ground) eye.y = ground;
}

/** THE FLOWN HAND-OVER between two rungs: `t` 0..1 through it, eased. */
export function blendLens(a: LensPose, b: LensPose, t: number): LensPose {
  const s = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  const l = (p: number, q: number): number => p + (q - p) * s;
  return {
    eye: { x: l(a.eye.x, b.eye.x), y: l(a.eye.y, b.eye.y), z: l(a.eye.z, b.eye.z) },
    target: {
      x: l(a.target.x, b.target.x),
      y: l(a.target.y, b.target.y),
      z: l(a.target.z, b.target.z),
    },
    fov: l(a.fov, b.fov),
    roll: l(a.roll, b.roll),
  };
}

/** How long the hand-over between two rungs takes, s. */
export const HANDOVER = 0.6;
