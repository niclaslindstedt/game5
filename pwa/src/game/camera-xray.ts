// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE X-RAY CAM'S LENS: close on the bone that is breaking, circling it
// slowly while the run crawls, panning to the next bone that goes and the
// limb that tears, then drawing back to the whole of him (`xray-shots.ts`
// says which). Every move is eased off where the lens was — the ladder's
// or the death cam's — so the fly-in and every pan is a curve, never a cut;
// the circling runs on the WALL clock, so the slowed run still turns.
//
// Three-free: `frameXray` turns what the shot looks at into a `LensPose`
// and the renderer applies it.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import type { LensPose, LineClear, Vec3 } from "./camera-rigs.ts";
import type { XrayShot } from "./xray-shots.ts";

/** The lens, as numbers: metres, wall seconds, degrees, radians. */
export const XRAY_LENS = {
  /** How far off the bone, over it, and the zoom. */
  bone: { arm: 1.1, height: 0.55, fov: 38 },
  /** A big flat bone (the ribs, the pelvis, the skull) wants more room. */
  wide: { arm: 1.5, height: 0.6, fov: 40 },
  tear: { arm: 2, height: 0.8, fov: 44 },
  /** THE BODY: from its arm and height out to `far` and `top` over `out` s. */
  body: { arm: 2.6, height: 1.6, fov: 48, far: 4.8, top: 3.6, out: 2.5 },
  /** How fast the lens circles, rad/s, and chases its place, its aim and
   * its zoom, 1/s. */
  orbit: 0.32,
  eyeRate: 3.2,
  aimRate: 5,
  fovRate: 3,
  /** Never closer to the snow than this, m, nor pulled closer to what it
   * looks at than `pullMin` by what stands between. */
  clearance: 0.25,
  pullMin: 1,
} as const;

export type XrayLens = {
  active: boolean;
  eye: Vec3;
  aim: Vec3;
  fov: number;
  /** The bearing the lens circles at, rad (0 = +z, clockwise). */
  yaw: number;
  /** Wall seconds on the body shot. */
  bodyAge: number;
};

export function createXrayLens(): XrayLens {
  return {
    active: false,
    eye: { x: 0, y: 0, z: 0 },
    aim: { x: 0, y: 0, z: 0 },
    fov: 50,
    yaw: 0,
    bodyAge: 0,
  };
}

const chase = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

const WIDE = /^(skull|ribs|pelvis|thoracic|lumbar)/;

/** One frame of the lens, `dt` wall seconds after the last: what the shot
 * looks at (`target`, world), the lens to fly off (`from`), or null to put
 * it down. */
export function frameXray(
  st: XrayLens,
  shot: XrayShot | null,
  target: Vec3 | null,
  from: LensPose,
  dt: number,
  groundAt: (x: number, z: number) => number,
  clear?: LineClear,
): LensPose | null {
  if (!shot || !target) {
    st.active = false;
    return null;
  }
  if (!st.active) {
    st.active = true;
    st.eye = { ...from.eye };
    st.aim = { ...from.target };
    st.fov = from.fov;
    st.yaw = Math.atan2(from.eye.x - target.x, from.eye.z - target.z);
    st.bodyAge = 0;
  }
  st.yaw += XRAY_LENS.orbit * dt;
  let arm: number;
  let height: number;
  let fov: number;
  if (shot.kind === "body") {
    st.bodyAge += dt;
    const b = XRAY_LENS.body;
    const k = clamp(st.bodyAge / b.out, 0, 1);
    const s = k * k * (3 - 2 * k);
    arm = b.arm + (b.far - b.arm) * s;
    height = b.height + (b.top - b.height) * s;
    fov = b.fov;
  } else {
    st.bodyAge = 0;
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
  return { eye: { ...st.eye }, target: { ...st.aim }, fov: st.fov, roll: 0 };
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
