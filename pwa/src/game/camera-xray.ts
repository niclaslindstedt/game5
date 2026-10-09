// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE X-RAY CAM'S LENS: flown in off the game's own camera right up to the
// part of him the blow lands on, circling it slowly while the run crawls,
// panning to the next bone that goes and the limb that tears, then drawn
// back out to where the game's own camera has him (`xray-shots.ts` says
// which, and how far back it is). Every move is eased off where the lens
// was, so the fly-in, every pan and the way back are curves, never a cut;
// the circling runs on the WALL clock, so the slowed run still turns.
//
// Three-free: `frameXray` turns what the shot looks at into a `LensPose`
// and the renderer applies it.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import type { LensPose, LineClear, Vec3 } from "./camera-rigs.ts";
import type { XrayShot } from "./xray-shots.ts";

/** The lens, as numbers: metres, wall seconds, degrees, radians. */
export const XRAY_LENS = {
  /** How far off the bone, over it, and the zoom: close enough that the
   * part hit fills the frame. */
  bone: { arm: 0.75, height: 0.3, fov: 34 },
  /** A big flat bone (the ribs, the pelvis, the skull) wants more room. */
  wide: { arm: 1, height: 0.35, fov: 36 },
  tear: { arm: 1.2, height: 0.45, fov: 40 },
  /** THE SHRED CAM: stood back off him, outside, the whole of him and the
   * machine taking him apart in the frame. */
  shred: { arm: 4.2, height: 1.4, fov: 50 },
  /** THE WAY BACK: the whole of him, drawn on toward the game's camera. */
  body: { arm: 2.2, height: 1.2, fov: 46 },
  /** How fast the lens circles, rad/s, and chases its place, its aim and
   * its zoom, 1/s. */
  orbit: 0.32,
  eyeRate: 3.2,
  aimRate: 5,
  fovRate: 3,
  /** THE WAY BACK'S ARC: the lift at its middle, a share of the way the
   * lens goes home, and at the most, m. */
  arc: 0.3,
  arcMost: 5,
  /** Never closer to the snow than this, m, nor pulled closer to what it
   * looks at than `pullMin` by what stands between. */
  clearance: 0.2,
  pullMin: 0.7,
  /** The most a target may move in a frame and still carry the lens with
   * it, m: the lead runs at nearly the run's own pace, a body falling at
   * 60 m/s a metre or two a frame; a jump past this is a new place. */
  carry: 12,
} as const;

/** A side the lens is held off rather than circling: the bearing from the
 * target, rad (0 = +z, clockwise), how far off and over it, m, and the
 * zoom, degrees; no bearing, circling at that arm. */
export type LensSide = { bearing?: number; arm: number; height: number; fov: number };

export type XrayLens = {
  active: boolean;
  eye: Vec3;
  aim: Vec3;
  fov: number;
  /** The bearing the lens circles at, rad (0 = +z, clockwise). */
  yaw: number;
  /** What it looked at last frame, and on which shot: a lens on one shot
   * is carried along with what it looks at (a body falling 60 m/s at the
   * lead's own pace), so the chase is only the framing's. */
  last: Vec3 | null;
  key: string;
};

export function createXrayLens(): XrayLens {
  return {
    active: false,
    eye: { x: 0, y: 0, z: 0 },
    aim: { x: 0, y: 0, z: 0 },
    fov: 50,
    yaw: 0,
    last: null,
    key: "",
  };
}

const chase = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

const WIDE = /^(skull|ribs|pelvis|thoracic|lumbar)/;

/** One frame of the lens, `dt` wall seconds after the last: what the shot
 * looks at (`target`, world), the game's own lens this frame (`home`: flown
 * off on the way in, drawn toward by `back` on the way out), or null to put
 * it down; `side` holds the lens off one side of the target, at its own
 * arm, height and zoom, rather than circling it. */
export function frameXray(
  st: XrayLens,
  shot: XrayShot | null,
  target: Vec3 | null,
  home: LensPose,
  back: number,
  dt: number,
  groundAt: (x: number, z: number) => number,
  clear?: LineClear,
  side?: LensSide,
): LensPose | null {
  if (!shot || !target) {
    st.active = false;
    st.last = null;
    return null;
  }
  if (!st.active) {
    st.active = true;
    st.eye = { ...home.eye };
    st.aim = { ...home.target };
    st.fov = home.fov;
    st.yaw = Math.atan2(home.eye.x - target.x, home.eye.z - target.z);
  }
  const key = shot.kind === "bone" ? shot.bone : shot.kind;
  // A shred's lens circles slower: the pieces are what moves.
  const orbit = shot.kind === "shred" ? XRAY_LENS.orbit * 0.5 : XRAY_LENS.orbit;
  if (st.last && st.key === key) {
    const dx = target.x - st.last.x;
    const dy = target.y - st.last.y;
    const dz = target.z - st.last.z;
    if (dx * dx + dy * dy + dz * dz < XRAY_LENS.carry * XRAY_LENS.carry) {
      st.eye.x += dx;
      st.eye.y += dy;
      st.eye.z += dz;
      st.aim.x += dx;
      st.aim.y += dy;
      st.aim.z += dz;
    }
  }
  st.last = { ...target };
  st.key = key;
  // A bearing asked for (a shred under a piste machine: off its side,
  // behind it, never inside it) is swung to rather than circled.
  if (side?.bearing === undefined) st.yaw += orbit * dt;
  else {
    const off = Math.atan2(Math.sin(side.bearing - st.yaw), Math.cos(side.bearing - st.yaw));
    st.yaw += off * chase(XRAY_LENS.eyeRate, dt);
  }
  let arm: number;
  let height: number;
  let fov: number;
  if (shot.kind === "body") {
    ({ arm, height, fov } = side ?? XRAY_LENS.body);
  } else if (shot.kind === "shred") {
    ({ arm, height, fov } = side ?? XRAY_LENS.shred);
  } else {
    const look =
      shot.kind === "tear"
        ? XRAY_LENS.tear
        : WIDE.test(shot.bone)
          ? XRAY_LENS.wide
          : XRAY_LENS.bone;
    arm = look.arm;
    height = look.height;
    fov = look.fov;
  }
  const eye = {
    x: target.x + Math.sin(st.yaw) * arm,
    y: target.y + height,
    z: target.z + Math.cos(st.yaw) * arm,
  };
  if (clear) pullIn(eye, target, clear);
  const ke = chase(XRAY_LENS.eyeRate, dt);
  st.eye.x += (eye.x - st.eye.x) * ke;
  st.eye.y += (eye.y - st.eye.y) * ke;
  st.eye.z += (eye.z - st.eye.z) * ke;
  const floor = groundAt(st.eye.x, st.eye.z) + XRAY_LENS.clearance;
  if (st.eye.y < floor) st.eye.y = floor;
  const ka = chase(XRAY_LENS.aimRate, dt);
  st.aim.x += (target.x - st.aim.x) * ka;
  st.aim.y += (target.y - st.aim.y) * ka;
  st.aim.z += (target.z - st.aim.z) * ka;
  st.fov += (fov - st.fov) * chase(XRAY_LENS.fovRate, dt);
  // On the way back the lens drawn is this one carried toward the game's
  // own, all the way at `back` = 1: the frame the cam lets go is the
  // frame the two meet.
  const k = clamp(back, 0, 1);
  const mix = (a: number, b: number): number => a + (b - a) * k;
  // Carried home OVER what lies between, not through it (a piste
  // machine's cab, the wreck): lifted on an arc a share of the way it goes.
  const way = Math.hypot(home.eye.x - st.eye.x, home.eye.y - st.eye.y, home.eye.z - st.eye.z);
  const arc = Math.sin(Math.PI * k) * Math.min(XRAY_LENS.arcMost, way * XRAY_LENS.arc);
  return {
    eye: {
      x: mix(st.eye.x, home.eye.x),
      y: mix(st.eye.y, home.eye.y) + arc,
      z: mix(st.eye.z, home.eye.z),
    },
    target: {
      x: mix(st.aim.x, home.target.x),
      y: mix(st.aim.y, home.target.y),
      z: mix(st.aim.z, home.target.z),
    },
    fov: mix(st.fov, home.fov),
    roll: home.roll * k,
  };
}

/** Draw the lens in toward what it looks at, to what is clear. */
function pullIn(eye: Vec3, at: Vec3, clear: LineClear): void {
  const len = Math.hypot(eye.x - at.x, eye.y - at.y, eye.z - at.z);
  if (len <= XRAY_LENS.pullMin) return;
  const share = clear(at, eye);
  if (share >= 1) return;
  const s = Math.max(XRAY_LENS.pullMin / len, share * 0.9);
  eye.x = at.x + (eye.x - at.x) * s;
  eye.y = at.y + (eye.y - at.y) * s;
  eye.z = at.z + (eye.z - at.z) * s;
}
