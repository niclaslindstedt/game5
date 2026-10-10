// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS ON THE JUMP PLANE (`plane.ts`) — three-free, so the suite reads
// it. While the skier stands in its door the ladder's lenses, built to frame
// a skier a metre tall, would stand inside a sixteen-metre wing; so the
// plane takes the lens, rung by rung, and hands it back to the ladder the
// moment he jumps or steps off:
//
//   CHASE  behind the tail and over it, along the way the airframe points,
//          rolled with it — a flight game's chase view, the one a loop and
//          a roll read from: the whole plane stays square in the frame and
//          the mountain turns round it;
//   FAR    the same further out, the mountain round it;
//   HIGH   high over it looking down, turned only with its heading — the
//          snow under it and how far down it is;
//   ORBIT  swung slowly round it, level;
//   TIPS   OUT OF THE DOOR: a lens held just outside the jump door (on the
//          right as a pilot sees it, `PLANE.door`), under the wing, bolted
//          to the airframe and looking down and forward past the strut at
//          the snow going by — the jumper's own look before the exit;
//   HELMET THE COCKPIT: the pilot's eye in the left seat (`PLANE.pilotEye`),
//          bolted to the airframe — it pitches, rolls and loops with it.
//
// A change of rung is FLOWN, never cut: for `HANDOVER` s both rungs are
// framed and the lens is flown round the airframe (`orbitBlend`) rather
// than through it. Every boom is kept clear of the snow.

import { PLANE, rotate, type PlaneState, type Quat } from "@engine";

import { TALL } from "./camera-balloon.ts";
import { HANDOVER, type LensPose } from "./camera-rigs.ts";
import { orbitBlend, rollFor } from "./camera-heli.ts";
import type { CameraRung } from "./renderer-api.ts";

/** Per boom: the standoff behind the plane's middle, m, and what each m/s
 * of airspeed adds; the height over it, m (along the airframe's up on the
 * chase and the far lens, the world's on the high); how far out to the
 * door's side, m (so the jumper in it is in the frame); how far ahead of
 * it the look aims, m; the fov, deg. */
export const PLANE_LOOK = {
  chase: { dist: 16, distPerSpeed: 0.05, height: 3.6, side: 4, ahead: 14, fov: 60 },
  far: { dist: 46, distPerSpeed: 0.15, height: 10, side: 8, ahead: 20, fov: 56 },
  high: { dist: 14, distPerSpeed: 0.1, height: 55, side: 0, ahead: 8, fov: 62 },
  /** The orbit: its radius and height over the middle, m, its turn, rad/s,
   * and its fov, deg. */
  orbit: { radius: 30, height: 6, spin: 0.16, fov: 56 },
  /** The door lens, body frame (y up from the ground datum, z forward):
   * just outside the door's aft edge at a head's height; how far it
   * is turned out of the door and down, rad, and its fov, deg. */
  door: {
    eye: { x: PLANE.door.x + Math.sign(PLANE.door.x) * 0.3, y: 2.0, z: PLANE.door.back + 0.45 },
    out: 1.05,
    down: 0.45,
    fov: 84,
  },
  /** The cockpit lens: how far down the look is tipped off the fuselage
   * line, rad (over the long nose), and its fov, deg. */
  cockpit: { down: 0.1, fov: 74 },
  /** How briskly the booms follow the airframe's attitude, 1/s. */
  follow: 3,
  /** The least gap the booms keep from the snow, m. */
  clearance: 2.5,
  /** The least the lens stands off the middle half-way through a
   * hand-over, m: clear of the wingtips. */
  orbitLeast: 10,
  /** On a tall screen the booms' fov is opened as the balloon's are
   * (`TALL`) and the arm let out until the wingspan with `margin` of it
   * again either side fits across. */
  margin: 0.15,
} as const;

/** A boom's fov and standoff on a screen `aspect` wide to its height:
 * its own on one at least square, opened and let out on a tall one. */
function tallFit(fov: number, dist: number, aspect: number): { fov: number; dist: number } {
  if (aspect >= 1) return { fov, dist };
  const wide = Math.min(TALL.most, fov + TALL.fov * 10 * (1 - aspect));
  const half = Math.tan(((wide / 2) * Math.PI) / 180) * aspect;
  const need = ((PLANE.wing.span / 2) * (1 + 2 * PLANE_LOOK.margin)) / half;
  return { fov: wide, dist: Math.max(dist, need) };
}

/** The booms' memory between frames: the forward and up they frame along
 * (the airframe's, followed on a spring), the high lens's bearing, the
 * orbit's angle, whether the next frame starts afresh, whether a change of
 * rung on the next frame is cut rather than flown, and the hand-over — the
 * rung framed last, the one it is flown from and the seconds since. */
export type PlaneCam = {
  fwd: Vec;
  up: Vec;
  yaw: number;
  spin: number;
  fresh: boolean;
  cut: boolean;
  rung: CameraRung | null;
  from: CameraRung | null;
  since: number;
};

type Vec = { x: number; y: number; z: number };

export function createPlaneCam(): PlaneCam {
  return {
    fwd: { x: 0, y: 0, z: 1 },
    up: { x: 0, y: 1, z: 0 },
    yaw: 0,
    spin: 0,
    fresh: true,
    cut: false,
    rung: null,
    from: null,
    since: HANDOVER,
  };
}

/** The plane as drawn: its ground datum and orientation, body to world. */
export type PlaneAt = { x: number; y: number; z: number; q: Quat };

/** THE AIRFRAME'S MIDDLE as drawn — its centre of gravity — which the booms
 * frame and a hand-over flies round. */
export function planeMiddleOf(at: PlaneAt): Vec {
  const off = rotate(at.q, { x: 0, y: PLANE.cog.y, z: PLANE.cog.z });
  return { x: at.x + off.x, y: at.y + off.y, z: at.z + off.z };
}

function unit(v: Vec): Vec {
  const l = Math.hypot(v.x, v.y, v.z);
  return l < 1e-9 ? { x: 0, y: 0, z: 1 } : { x: v.x / l, y: v.y / l, z: v.z / l };
}

/** `v` eased toward `to` by `k`, kept a unit. */
function easeVec(v: Vec, to: Vec, k: number): void {
  const u = unit({
    x: v.x + (to.x - v.x) * k,
    y: v.y + (to.y - v.y) * k,
    z: v.z + (to.z - v.z) * k,
  });
  v.x = u.x;
  v.y = u.y;
  v.z = u.z;
}

/** The booms stepped `dt` on: their frame after the airframe's attitude,
 * the high lens's bearing after its heading, the orbit on round. */
function stepCam(cam: PlaneCam, p: PlaneState, at: PlaneAt, dt: number): void {
  const fwd = rotate(at.q, { x: 0, y: 0, z: 1 });
  const up = rotate(at.q, { x: 0, y: 1, z: 0 });
  if (cam.fresh) {
    Object.assign(cam.fwd, fwd);
    Object.assign(cam.up, up);
    cam.yaw = p.heading;
  } else {
    const k = 1 - Math.exp(-PLANE_LOOK.follow * dt);
    easeVec(cam.fwd, fwd, k);
    easeVec(cam.up, up, k);
    let d = p.heading - cam.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    cam.yaw += d * k;
  }
  cam.spin += PLANE_LOOK.orbit.spin * dt;
}

/** A lens bolted to the airframe at `eye` (body frame), looking along
 * `look` (body frame), its horizon the airframe's. */
function bolted(at: PlaneAt, eye: Vec, look: Vec, fov: number): LensPose {
  const off = rotate(at.q, eye);
  const e = { x: at.x + off.x, y: at.y + off.y, z: at.z + off.z };
  const f = unit(rotate(at.q, look));
  const reach = 30;
  return {
    eye: e,
    target: { x: e.x + f.x * reach, y: e.y + f.y * reach, z: e.z + f.z * reach },
    fov,
    roll: rollFor(f, rotate(at.q, { x: 0, y: 1, z: 0 })),
  };
}

/** THE LENS ON RUNG `rung` this frame, off the booms' frame as it stands —
 * a pure function of the plane, that frame and the snow. */
export function planeLens(
  cam: PlaneCam,
  p: PlaneState,
  at: PlaneAt,
  rung: CameraRung,
  groundAt: (x: number, z: number) => number,
  aspect = 16 / 9,
): LensPose {
  if (rung === "tips") {
    const D = PLANE_LOOK.door;
    const look = {
      x: Math.sign(PLANE.door.x) * Math.sin(D.out) * Math.cos(D.down),
      y: -Math.sin(D.down),
      z: Math.cos(D.out) * Math.cos(D.down),
    };
    return bolted(at, D.eye, look, D.fov);
  }
  if (rung === "helmet") {
    const C = PLANE_LOOK.cockpit;
    return bolted(at, PLANE.pilotEye, { x: 0, y: -Math.sin(C.down), z: Math.cos(C.down) }, C.fov);
  }
  const centre = planeMiddleOf(at);
  const keep = (eye: Vec): Vec => {
    eye.y = Math.max(eye.y, groundAt(eye.x, eye.z) + PLANE_LOOK.clearance);
    return eye;
  };
  if (rung === "orbit") {
    const O = PLANE_LOOK.orbit;
    const fit = tallFit(O.fov, O.radius, aspect);
    const eye = keep({
      x: centre.x + Math.sin(cam.spin) * fit.dist,
      y: centre.y + O.height,
      z: centre.z + Math.cos(cam.spin) * fit.dist,
    });
    return { eye, target: { ...centre }, fov: fit.fov, roll: 0 };
  }
  if (rung === "high") {
    const L = PLANE_LOOK.high;
    const fit = tallFit(L.fov, 0, aspect);
    const dist = L.dist + L.distPerSpeed * p.airspeed;
    const fx = Math.sin(cam.yaw);
    const fz = Math.cos(cam.yaw);
    const eye = keep({ x: centre.x - fx * dist, y: centre.y + L.height, z: centre.z - fz * dist });
    return {
      eye,
      target: { x: centre.x + fx * L.ahead, y: centre.y, z: centre.z + fz * L.ahead },
      fov: fit.fov,
      roll: 0,
    };
  }
  const L = rung === "far" ? PLANE_LOOK.far : PLANE_LOOK.chase;
  const fit = tallFit(L.fov, L.dist + L.distPerSpeed * p.airspeed, aspect);
  const dist = fit.dist;
  const f = cam.fwd;
  const u = cam.up;
  // The door's side: the engine's right is up × forward, the door's sign on it.
  const k = Math.sign(PLANE.door.x) * L.side;
  const r = { x: u.y * f.z - u.z * f.y, y: u.z * f.x - u.x * f.z, z: u.x * f.y - u.y * f.x };
  const eye = keep({
    x: centre.x - f.x * dist + u.x * L.height + r.x * k,
    y: centre.y - f.y * dist + u.y * L.height + r.y * k,
    z: centre.z - f.z * dist + u.z * L.height + r.z * k,
  });
  const target = {
    x: centre.x + f.x * L.ahead,
    y: centre.y + f.y * L.ahead,
    z: centre.z + f.z * L.ahead,
  };
  const look = unit({ x: target.x - eye.x, y: target.y - eye.y, z: target.z - eye.z });
  return { eye, target, fov: fit.fov, roll: rollFor(look, u) };
}

/** ONE FRAME OF THE PLANE'S LENS on rung `rung`, `dt` s after the last, the
 * plane drawn at `at` on a screen `aspect` wide to its height — flown
 * across from the rung before for `HANDOVER` s after a change. */
export function framePlane(
  cam: PlaneCam,
  p: PlaneState,
  at: PlaneAt,
  rung: CameraRung,
  dt: number,
  groundAt: (x: number, z: number) => number,
  aspect = 16 / 9,
): LensPose {
  stepCam(cam, p, at, dt);
  if (cam.fresh || (cam.cut && cam.rung !== rung)) {
    cam.from = null;
    cam.since = HANDOVER;
  } else if (cam.rung !== null && cam.rung !== rung) {
    cam.from = cam.rung;
    cam.since = 0;
  }
  cam.fresh = false;
  cam.cut = false;
  cam.rung = rung;
  const lens = planeLens(cam, p, at, rung, groundAt, aspect);
  if (cam.from === null || cam.since >= HANDOVER) {
    cam.from = null;
    return lens;
  }
  cam.since += dt;
  const from = planeLens(cam, p, at, cam.from, groundAt, aspect);
  return orbitBlend(from, lens, cam.since / HANDOVER, planeMiddleOf(at), PLANE_LOOK.orbitLeast);
}
