// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FEW VECTORS THE SKIER IS POSED WITH — a point in the pair's body
// frame and the arithmetic on it, shared by the pose (`skier-pose.ts`) and
// the arms' strokes (`skier-stroke.ts`). Three-free, so the suite reads
// both.

export type V3 = { x: number; y: number; z: number };

export function add(a: V3, b: V3): V3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
export function sub(a: V3, b: V3): V3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
export function scale(a: V3, k: number): V3 {
  return { x: a.x * k, y: a.y * k, z: a.z * k };
}
export function dot(a: V3, b: V3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
export function len(a: V3): number {
  return Math.sqrt(dot(a, a));
}
export function norm(a: V3): V3 {
  const l = len(a) || 1;
  return scale(a, 1 / l);
}
export function mix(a: V3, b: V3, k: number): V3 {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
}
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** A direction turned the share `k` of the way from `a` to `b` (both of
 * unit length) through the angle between them — never through their
 * normalised chord, which swings round all at once as the two come to
 * point apart: a rod handed from one hold to another turns at an even
 * rate. Two nearly opposite are turned over the chord's own side. */
export function turnTo(a: V3, b: V3, k: number): V3 {
  const c = Math.max(-1, Math.min(1, dot(a, b)));
  const th = Math.acos(c);
  const s = Math.sin(th);
  if (s < 1e-3) return norm(mix(a, b, k));
  const wa = Math.sin((1 - k) * th) / s;
  const wb = Math.sin(k * th) / s;
  return norm({ x: a.x * wa + b.x * wb, y: a.y * wa + b.y * wb, z: a.z * wa + b.z * wb });
}
