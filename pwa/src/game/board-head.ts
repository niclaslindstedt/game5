// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWBOARDER'S HEAD as the rig turns it: a look and the up it is held
// to read as the rig's head angles, and back. Three-free, for the pose
// (`board-pose.ts`), the metrics and the suite.

import type { SkierPose } from "./skier-pose.ts";
import { dot, norm, type V3 } from "./skier-vec.ts";

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/** HOW HIS HEAD IS TURNED: looking along `look` (body frame), its up held
 * toward `up` — read as the rig's head angles (`skier-rig.ts`'s
 * `headAxes`: yaw `look / 2`, pitch `−0.2 + pitch × 0.3`, roll
 * `−headRoll`, three's "YXZ"). */
export function headAngles(look: V3, up: V3): { look: number; pitch: number; headRoll: number } {
  const fwd = norm(look);
  const right = norm(cross(up, fwd));
  const a = -Math.asin(clamp(fwd.y, -1, 1));
  const b = Math.atan2(fwd.x, fwd.z);
  const x0 = { x: Math.cos(b), y: 0, z: -Math.sin(b) };
  const y0 = { x: Math.sin(a) * Math.sin(b), y: Math.cos(a), z: Math.sin(a) * Math.cos(b) };
  const c = Math.atan2(dot(right, y0), dot(right, x0));
  return { look: 2 * b, pitch: (a + 0.2) / 0.3, headRoll: -c };
}

/** The head's forward as the rig turns it for `look`, `pitch` (the rig's
 * own readings, `headAngles`' inverse). */
export function headForward(p: Pick<SkierPose, "look" | "pitch">): V3 {
  const a = -0.2 + p.pitch * 0.3;
  const b = p.look * 0.5;
  return { x: Math.cos(a) * Math.sin(b), y: -Math.sin(a), z: Math.cos(a) * Math.cos(b) };
}

/** Angle from `a` to `b` about the body's up, rad, wrapped to ±π. */
export function yawBetween(a: V3, b: V3): number {
  const d = Math.atan2(b.x, b.z) - Math.atan2(a.x, a.z);
  return Math.atan2(Math.sin(d), Math.cos(d));
}
