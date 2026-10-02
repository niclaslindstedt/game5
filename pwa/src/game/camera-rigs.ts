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
// THE BOOM SWAYS ROUND THE TREES. Off the piste the woods close in, and a
// lens that rode straight through every crown behind the skier was a frame
// of green — while one that pulled its arm in for every trunk jolted at
// him. So the arm SWINGS: every frame a fan of yaws either side of where it
// would stand is tried (`SWAY`), each for whether the line from the
// skier's helmet out to the lens runs clear of the trees as drawn, now and
// where both will be a beat from now; the clearest, nearest the middle and
// nearest the last pick, is the yaw the arm swings to on a spring of its
// own (`sway`). The look still runs through the skier, so he stays the
// middle of the picture while the woods wheel past. Where there is no
// clear line — a thicket — the arm stays where it is and the boughs are in
// the frame: the trees are never taken out of the picture.

import { rotate, type Quat } from "@engine";

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
  /** THE SWAY: the most the arm swings round the skier off a tree, rad, and
   * how it swings there (`camera-spring.ts`). */
  sway: number;
  swing: Poles;
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
    sway: 0.75,
    swing: { f: 1.3, zeta: 1, r: 0 },
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
    sway: 0.5,
    swing: { f: 1, zeta: 1, r: 0 },
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
    sway: 0.3,
    swing: { f: 0.8, zeta: 1, r: 0 },
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
  /** THE SWAY: the yaw the arm is swung round the skier by, rad, and the
   * one it was last asked to swing to. */
  sway: Spring;
  swayWant: number;
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
    sway: createSpring(),
    swayWant: 0,
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

/** THE ARM PULLED IN. The arm is shortened to the first thing `clear`
 * calls solid between the skier's head and the lens — at once, because a
 * frame inside a post is the fault — and let back out slowly. Never closer
 * than `PULL_MIN` m. The ridden booms are handed a clear that lets the trees
 * through (`camera-clear.ts`): a trunk flicking past is not worth a jolt —
 * they SWAY round the trees instead (`woods`, `swayTo`). */
export const PULL_MIN = 1.6;
/** How briskly the arm lets back out, 1/s. */
export const PULL_RELEASE = 1.8;
/** The pivot the arm is measured from: over the boots, at the helmet. */
export const PULL_PIVOT = 1.3;

/** One frame of `rig` behind `pose`, `dt` s after the last. `groundAt` keeps
 * the lens out of the hill; `clear` is what the arm pulls in against, and
 * `woods` what it sways round. */
export function frameRig(
  rig: Rig,
  pose: RigPose,
  st: BoomState,
  dt: number,
  groundAt: (x: number, z: number) => number,
  clear?: LineClear,
  woods?: LineClear,
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
  const fall = Math.max(LEAN_MIN, Math.min(LEAN_MAX, Math.atan2(drop, reachAhead + LEAN_BEHIND)));
  const slope = snap ? settle(st.slope, fall) : follow(st.slope, rig.lean, fall, dt);
  // The height follows the skier on its spring, told the DESCENT the fall
  // line predicts as the target's own velocity: a steady schuss down a face
  // is tracked with no lag, and only the rollers in it are smoothed away.
  const descent = -plan * Math.tan(slope);
  const lifted = snap
    ? settle(st.y, pose.y)
    : follow(st.y, pose.airborne ? rig.liftAir : rig.lift, pose.y, dt, descent);
  // The height the lens is FRAMED from: the spring's, with its lag eased
  // into `lagMax` so a long fall cannot leave the lens up on the cliff.
  const lag = pose.y - lifted;
  const y = pose.y - rig.lagMax * Math.tanh(lag / rig.lagMax);
  const surge = surgeAt(st, pose, rig.surge, dt);
  const shake = tremorAt(st, pose, rig.tremor, dt);
  st.fresh = false;
  // THE STRETCH: the arm pulled in along its own line by the share of the
  // fov's widening it holds, so the skier keeps his size in the frame.
  const fov = Math.min(rig.fovMax, rig.fov + rig.fovPerSpeed * pose.speed);
  const half = (d: number) => Math.tan((d * Math.PI) / 360);
  const arm = 1 - rig.hold * (1 - half(rig.fov) / half(fov));
  const dist = (rig.dist + rig.distPerSpeed * pose.speed) * arm + surge;
  const rise = rig.height * arm;
  // THE INCLINE: the arm swung up the slope behind by its share of the
  // fall line's pitch, about the skier — the lens keeps its height over
  // the snow it stands above instead of meeting it.
  const len = Math.hypot(dist, rise);
  const steep = Math.max(0, Math.min(1, (slope - STEEP.from) / (STEEP.full - STEEP.from)));
  const incline = rig.incline + (rig.inclineSteep - rig.incline) * steep * steep * (3 - 2 * steep);
  const up = Math.atan2(rise, dist) + incline * slope;
  // THE SWAY: the arm swung round the skier off the trees, the look with it.
  const standAt = (turned: number): Vec3 => {
    const e = {
      x: pose.x - Math.sin(turned) * len * Math.cos(up),
      y: y + len * Math.sin(up),
      z: pose.z - Math.cos(turned) * len * Math.cos(up),
    };
    e.y = Math.max(e.y, groundAt(e.x, e.z) + rig.clearance);
    return e;
  };
  if (woods && rig.sway > 0) st.swayWant = swayTo(rig, pose, st, yaw, standAt, woods, snap, dt);
  else st.swayWant = 0;
  const sway = snap ? settle(st.sway, st.swayWant) : follow(st.sway, rig.swing, st.swayWant, dt);
  const fx = Math.sin(yaw + sway);
  const fz = Math.cos(yaw + sway);
  const eye = standAt(yaw + sway);
  if (clear) pullIn(eye, pose, st, snap, dt, clear, groundAt);
  // THE COMPOSITION: the look pitched to stand the skier `place` of the
  // half-fov under the axis, measured from the sprung height so his heave
  // over a roller moves HIM in the frame rather than the horizon — and
  // chased on its own spring, so the head has weight.
  const halfAngle = (fov * Math.PI) / 360;
  const placed = Math.atan(rig.place * Math.tan(halfAngle));
  const back = Math.hypot(pose.x - eye.x, pose.z - eye.z);
  const composed = Math.atan2(y + FRAME_AT - eye.y, back) + placed;
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

/** THE FALL LINE's reading: metres behind the skier it starts, the least
 * it reaches ahead, m, and the pitch it is held between, rad (a short rise
 * up a kicker's face tips the arm down a little; a cliff no more than
 * 55°). */
const LEAN_BEHIND = 3;
const LEAN_REACH = 6;
const LEAN_MIN = -0.3;
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

/** THE SWAY's fan: how many yaws either side of the arm's own are tried;
 * the moments ahead each line is tried again at, s; what a pick costs — a
 * line into a tree, a yaw off the middle (at the fan's edge) and a swing
 * over to the other side of the skier, each against the others; and how
 * briskly a swing is let back toward the middle once it is no longer
 * needed, 1/s. */
const SWAY = {
  steps: 4,
  ahead: [0, 0.25, 0.5, 0.75],
  tree: 1,
  edge: 0.2,
  change: 0.15,
  release: 2,
};

/** The yaw, rad round the skier off the arm's own (`yaw`), whose line from
 * his helmet to the lens (`standAt`) runs clearest of `woods` — now and at
 * each of `SWAY.ahead`, both ends carried along the skier's way, so the arm
 * starts to swing for a trunk before it is in the line. A line into a tree
 * costs the most, and the more of it is lost the more; then a yaw off the
 * middle; and a swing to the other side from the last pick, so the arm
 * commits to a side of a trunk rather than dithering over it. A wider swing
 * is taken at once; a narrower one on the same side only eased toward, so
 * the arm is not called back before its lagging lens has cleared the tree. */
function swayTo(
  rig: BoomRig,
  pose: RigPose,
  st: BoomState,
  yaw: number,
  standAt: (turned: number) => Vec3,
  woods: LineClear,
  snap: boolean,
  dt: number,
): number {
  const pivot = { x: pose.x, y: pose.y + PULL_PIVOT, z: pose.z };
  const lost = (share: number): number => (share >= 1 ? 0 : 0.75 + 0.25 * (1 - share));
  const blocked = (turned: number): number => {
    const eye = standAt(yaw + turned);
    let sum = 0;
    for (const t of SWAY.ahead) {
      const ax = pose.vx * t;
      const ay = pose.vy * t;
      const az = pose.vz * t;
      sum += lost(
        woods(
          { x: pivot.x + ax, y: pivot.y + ay, z: pivot.z + az },
          { x: eye.x + ax, y: eye.y + ay, z: eye.z + az },
        ),
      );
    }
    return (SWAY.tree * sum) / SWAY.ahead.length;
  };
  const held = st.swayWant;
  // The middle open and nothing held: nothing to swing for.
  if (held === 0 && blocked(0) === 0) return 0;
  let best = 0;
  let cost = Infinity;
  for (let k = -SWAY.steps; k <= SWAY.steps; k++) {
    const turned = (rig.sway * k) / SWAY.steps;
    const off = turned / rig.sway;
    const c = blocked(turned) + SWAY.edge * off * off + (turned * held < 0 ? SWAY.change : 0);
    if (c < cost) {
      cost = c;
      best = turned;
    }
  }
  // At once: a fresh frame, nothing held, or a wider swing on the side held.
  if (snap || held === 0 || (best * held > 0 && Math.abs(best) >= Math.abs(held))) return best;
  // Eased: narrower on the same side, or home, or over through the middle.
  const eased = held + (best - held) * (1 - Math.exp(-SWAY.release * dt));
  return Math.abs(eased) < 1e-3 ? 0 : eased;
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
