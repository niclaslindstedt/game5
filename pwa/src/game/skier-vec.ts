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
