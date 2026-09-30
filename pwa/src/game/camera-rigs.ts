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

import { rotate, type Quat } from "@engine";

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
  /** Height over the skier, m. */
  height: number;
  /** Aim point ahead of the skier, m, and over it. */
  aimAhead: number;
  aimHeight: number;
  fov: number;
  fovPerSpeed: number;
  fovMax: number;
  /** THE STRETCH: share of the fov's widening the arm pulls in along its
   * own line to keep the skier his size in the frame, 0..1. */
  hold: number;
  /** Shares of `PACE.surge` and `PACE.tremor` the lens takes. */
  surge: number;
  tremor: number;
  /** How briskly the yaw follows the nose, 1/s. */
  followRate: number;
  /** Share of the travel direction (against the nose) the yaw takes. */
  slipWeight: number;
  /** How fast the lens height follows the skier's, 1/s, on the snow and in
   * the air. */
  heightFollow: number;
  heightFollowAir: number;
  /** The most the lens's height is let trail the skier's, m — a soft cap. */
  lagMax: number;
  /** Share of the half-fov (vertical) the skier is kept inside, 0..1. */
  frame: number;
  /** The lens is never closer to the snow under it than this, m. */
  clearance: number;
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
  // A skier's origin stands a metre over his skis, so the aim sits a
  // little BELOW it: the boots and the skis stay in the frame, not just
  // the helmet. LOW AND CLOSE, because speed is read off the snow streaming
  // under the lens: the nearer the eye is to the ground the faster the
  // ground goes past it, and a camera a storey up flattens a schuss into a
  // stroll.
  chase: {
    kind: "boom",
    dist: 5.2,
    distPerSpeed: 0,
    height: 1.6,
    aimAhead: 8,
    aimHeight: -0.25,
    fov: 62,
    fovPerSpeed: 0.75,
    fovMax: 90,
    hold: 0.45,
    surge: 1,
    tremor: 1,
    followRate: 4.2,
    slipWeight: 0.3,
    heightFollow: 6,
    heightFollowAir: 3.2,
    lagMax: 2.2,
    frame: 0.6,
    clearance: 0.9,
  },
  far: {
    kind: "boom",
    dist: 10,
    distPerSpeed: 0.02,
    height: 3.6,
    aimAhead: 10,
    aimHeight: -0.2,
    fov: 56,
    fovPerSpeed: 0.45,
    fovMax: 76,
    hold: 0.5,
    surge: 1.4,
    tremor: 0.6,
    followRate: 2.6,
    slipWeight: 0.4,
    heightFollow: 3.5,
    heightFollowAir: 2.2,
    lagMax: 3.2,
    frame: 0.6,
    clearance: 1.4,
  },
  high: {
    kind: "boom",
    dist: 13,
    distPerSpeed: 0.05,
    height: 10,
    aimAhead: 8,
    aimHeight: 0,
    fov: 56,
    fovPerSpeed: 0.2,
    fovMax: 66,
    hold: 0,
    surge: 1,
    tremor: 0.3,
    followRate: 2,
    slipWeight: 0.5,
    heightFollow: 2.5,
    heightFollowAir: 1.6,
    lagMax: 4.5,
    frame: 0.6,
    clearance: 3,
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

/** A boom's memory between frames: the yaw it has swung to, the height it
 * has sprung to, the orbit's angle, and how far out along its arm the lens
 * is let stand (`pull`, 1 the whole arm). `fresh` asks the next frame to
 * snap rather than ease (a new run, a reset). */
export type BoomState = {
  yaw: number;
  y: number;
  orbit: number;
  pull: number;
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
    yaw: 0,
    y: 0,
    orbit: 0,
    pull: 1,
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
    /** Where it starts, and where it is whole, m/s (40 and 110 km/h). */
    from: 11,
    full: 30.5,
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
 * through (`camera-clear.ts`): a trunk flicking past is not worth a jolt. */
export const PULL_MIN = 1.6;
/** How briskly the arm lets back out, 1/s. */
export const PULL_RELEASE = 1.8;
/** The pivot the arm is measured from: over the boots, at the helmet. */
export const PULL_PIVOT = 1.3;

/** One frame of `rig` behind `pose`, `dt` s after the last. `groundAt` keeps
 * the lens out of the hill. */
export function frameRig(
  rig: Rig,
  pose: RigPose,
  st: BoomState,
  dt: number,
  groundAt: (x: number, z: number) => number,
  clear?: LineClear,
): LensPose {
  if (rig.kind === "bolted") {
    const off = rotate(pose.q, rig.eye);
    const eye = { x: pose.x + off.x, y: pose.y + off.y, z: pose.z + off.z };
    // Bolted on, the tremor swings the aim: the whole world buzzes.
    const shake = tremorAt(st, pose, rig.tremor, dt);
    const swing = rig.look * PACE.tremor.aim;
    const fwd = rotate(pose.q, { x: shake.x * swing, y: shake.y * swing, z: rig.look });
    const target = { x: eye.x + fwd.x, y: eye.y + fwd.y, z: eye.z + fwd.z };
    st.yaw = pose.heading;
    st.y = pose.y;
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
  const plan = Math.hypot(pose.vx, pose.vz);
  const travel = plan > 2 ? Math.atan2(pose.vx, pose.vz) : pose.heading;
  const want = pose.heading + turn(pose.heading, travel) * rig.slipWeight;
  const k = st.fresh ? 1 : 1 - Math.exp(-rig.followRate * dt);
  st.yaw += turn(st.yaw, want) * k;
  const hk = st.fresh
    ? 1
    : 1 - Math.exp(-(pose.airborne ? rig.heightFollowAir : rig.heightFollow) * dt);
  st.y += (pose.y - st.y) * hk;
  // The height the lens is FRAMED from: the spring's, with its lag eased
  // into `lagMax` so a long fall cannot leave the lens up on the cliff.
  const lag = pose.y - st.y;
  const y = pose.y - rig.lagMax * Math.tanh(lag / rig.lagMax);
  const surge = surgeAt(st, pose, rig.surge, dt);
  const shake = tremorAt(st, pose, rig.tremor, dt);
  const snap = st.fresh;
  st.fresh = false;
  const fx = Math.sin(st.yaw);
  const fz = Math.cos(st.yaw);
  // THE STRETCH: the arm pulled in along its own line by the share of the
  // fov's widening it holds, so the skier keeps his size in the frame.
  const fov = Math.min(rig.fovMax, rig.fov + rig.fovPerSpeed * pose.speed);
  const half = (d: number) => Math.tan((d * Math.PI) / 360);
  const arm = 1 - rig.hold * (1 - half(rig.fov) / half(fov));
  const dist = (rig.dist + rig.distPerSpeed * pose.speed) * arm + surge;
  const buzz = PACE.tremor.travel;
  const eye = {
    x: pose.x - fx * dist + fz * shake.x * buzz,
    y: y + rig.height * arm + shake.y * buzz,
    z: pose.z - fz * dist - fx * shake.x * buzz,
  };
  const floor = groundAt(eye.x, eye.z) + rig.clearance;
  if (eye.y < floor) eye.y = floor;
  if (clear) pullIn(eye, pose, st, snap, dt, clear, groundAt);
  const target = {
    x: pose.x + fx * rig.aimAhead,
    y: y + rig.aimHeight,
    z: pose.z + fz * rig.aimAhead,
  };
  tiltToFrame(eye, target, pose, ((fov * Math.PI) / 360) * rig.frame);
  return { eye, target, fov, roll: shake.r * PACE.tremor.roll };
}

/** Where on the skier the tilt frames: the middle of his body, m over the
 * body's origin. */
export const FRAME_AT = 0.9;
/** The steepest the tilt ever pitches the look, rad — short of straight
 * down, where `lookAt`'s up vector has no answer. */
const TILT_MAX = 1.35;
/** Share of the kept band the skier roams before the look starts to tip. */
const TILT_KNEE = 0.5;

/** THE TILT: pitch the look from `eye` through `target` so the skier
 * stands within `half` rad of its axis, keeping the aim's bearing and its
 * reach. Inside the knee (half of `half`) the look is left alone; past it
 * the skier's offset is eased into `half` rather than stopped at it, so the
 * lens tips into a drop and back out of it without a kink. Moves only
 * `target.y`. */
function tiltToFrame(eye: Vec3, target: Vec3, pose: RigPose, half: number): void {
  const reach = Math.hypot(target.x - eye.x, target.z - eye.z);
  if (reach < 1e-6 || half <= 0) return;
  const aim = Math.atan2(target.y - eye.y, reach);
  const skier = Math.atan2(pose.y + FRAME_AT - eye.y, Math.hypot(pose.x - eye.x, pose.z - eye.z));
  const off = skier - aim;
  const knee = half * TILT_KNEE;
  if (Math.abs(off) <= knee) return;
  const room = half - knee;
  const kept = Math.sign(off) * (knee + room * Math.tanh((Math.abs(off) - knee) / room));
  const pitch = Math.max(-TILT_MAX, Math.min(TILT_MAX, skier - kept));
  target.y = eye.y + reach * Math.tan(pitch);
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
