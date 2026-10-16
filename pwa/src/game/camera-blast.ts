// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BLAST THROUGH HIS OWN EYES — a snowmobile's tank going up under a
// rider who was watching it from his own eyes (the TIPS and HELMET rungs:
// the cockpit over the bars). The lens is left where his head is: in it,
// thrown off the seat by the ball, tumbling with his body as the ragdoll
// turns (`Thrown.points` — the head looking out of his chest's front, the
// horizon rolled with his shoulders), shaken hard at the blast and less as
// he flies, the field blown wide at the flash and narrowing back — until he
// lies still or a few seconds have gone, when the ladder has him again.
// The picture's own heat, flash and smoke over it are `blaze` beside it.
//
// Three-free and pure: the thrown body and the time since the blast in,
// a lens out.

import { RAGDOLL } from "@engine";
import type { LensPose } from "./camera-rigs.ts";

/** HOW IT IS SHOT: how long it holds at most, s, and how long he must lie
 * still before it hands back, s; the shake at the blast, m and rad, its
 * fall, s, and its rate, Hz; the field at the flash and settled, degrees,
 * and how fast it narrows, s; how far ahead the look is, m; how far over
 * the snow the eye is kept, m. */
export const BLAST_CAM = {
  holds: 4.5,
  still: 0.8,
  shake: { eye: 0.16, look: 0.7, fall: 1.4, rate: 23 },
  fov: { flash: 104, settled: 84, narrow: 0.9 },
  look: 6,
  clear: 0.12,
} as const;

/** THE BLAZE OVER THE PICTURE: the fire's heat on it (a warm cast, a heat
 * shimmer and flames licking up from its foot), the flash (washed white),
 * and the smoke (the edges closing in dark), each 0..1. */
export type Blaze = { heat: number; flash: number; smoke: number };

type V = { x: number; y: number; z: number };

const at = (p: readonly number[], last: readonly number[], i: number, a: number): V => ({
  x: last[i * 3] + (p[i * 3] - last[i * 3]) * a,
  y: last[i * 3 + 1] + (p[i * 3 + 1] - last[i * 3 + 1]) * a,
  z: last[i * 3 + 2] + (p[i * 3 + 2] - last[i * 3 + 2]) * a,
});
const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: V, b: V): V => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const dot = (a: V, b: V): number => a.x * b.x + a.y * b.y + a.z * b.z;
function norm(a: V): V {
  const l = Math.hypot(a.x, a.y, a.z);
  return l > 1e-6 ? { x: a.x / l, y: a.y / l, z: a.z / l } : { x: 0, y: 0, z: 1 };
}

/** Whether the blast lens still holds `since` s after the tank went up,
 * with him lain still `still` s. */
export const blastHolds = (since: number, still: number): boolean =>
  since >= 0 && since < BLAST_CAM.holds && still < BLAST_CAM.still;

/** THE LENS IN HIS HEAD `since` s after the blast: `points` and `last` his
 * ragdoll's (`Thrown`), drawn `alpha` of the way between them; `ground` the
 * snow's height under a point. */
export function blastLens(
  points: readonly number[],
  last: readonly number[],
  alpha: number,
  since: number,
  ground: (x: number, z: number) => number,
): LensPose {
  const R = RAGDOLL;
  const C = BLAST_CAM;
  const head = at(points, last, R.head, alpha);
  const sl = at(points, last, R.shoulderL, alpha);
  const sr = at(points, last, R.shoulderR, alpha);
  const hl = at(points, last, R.hipL, alpha);
  const hr = at(points, last, R.hipR, alpha);
  const hips = { x: (hl.x + hr.x) / 2, y: (hl.y + hr.y) / 2, z: (hl.z + hr.z) / 2 };
  const spine = norm(sub(head, hips));
  // His shoulders' line points to his LEFT here (the ragdoll's own), so the
  // chest's front is the spine crossed with it.
  const across = norm(sub(sl, sr));
  const face = norm(cross(spine, across));
  // The shake: hard at the blast, dying away.
  const k = Math.exp(-since / C.shake.fall);
  const w = since * C.shake.rate * Math.PI * 2;
  const jx = Math.sin(w) * 0.6 + Math.sin(w * 1.7 + 1.3) * 0.4;
  const jy = Math.sin(w * 1.3 + 0.4) * 0.6 + Math.sin(w * 2.3) * 0.4;
  const jz = Math.sin(w * 0.9 + 2.1) * 0.6 + Math.sin(w * 1.9 + 0.7) * 0.4;
  const eye = {
    x: head.x + face.x * 0.08 + jx * C.shake.eye * k,
    y: head.y + face.y * 0.08 + jy * C.shake.eye * k,
    z: head.z + face.z * 0.08 + jz * C.shake.eye * k,
  };
  eye.y = Math.max(eye.y, ground(eye.x, eye.z) + C.clear);
  const swing = C.shake.look * k * C.look;
  const target = {
    x: eye.x + face.x * C.look + jy * swing * 0.5,
    y: eye.y + face.y * C.look + jz * swing * 0.5,
    z: eye.z + face.z * C.look + jx * swing * 0.5,
  };
  // The horizon rolled to his shoulders: the world's up turned onto his
  // spine about the line he looks along.
  const f = norm(sub(target, eye));
  const up0 = norm({ x: -f.x * f.y, y: 1 - f.y * f.y, z: -f.z * f.y });
  const sp = norm(
    sub(spine, { x: f.x * dot(f, spine), y: f.y * dot(f, spine), z: f.z * dot(f, spine) }),
  );
  const roll = Math.atan2(dot(f, cross(up0, sp)), dot(up0, sp));
  const n = Math.min(1, since / C.fov.narrow);
  const fov = C.fov.flash + (C.fov.settled - C.fov.flash) * n * n * (3 - 2 * n);
  return { eye, target, fov, roll };
}

/** THE BLAZE through his own eyes: `fuse` the share of the fuse burnt
 * before the blast (0..1, the flames off the hood in front of him), and
 * `since` s after it (−1 before) — the flash, then the heat and the smoke
 * he lies in. `burning` whether his own clothes are alight. */
export function blazeOf(fuse: number, since: number, burning: boolean): Blaze {
  if (since < 0) {
    const f = Math.max(0, Math.min(1, fuse));
    return { heat: 0.2 + 0.45 * f * f, flash: 0, smoke: 0.3 * f };
  }
  const flash = Math.exp(-since / 0.18) * (since < 0.06 ? since / 0.06 : 1);
  const ball = Math.exp(-since / 1.6);
  const heat = Math.max(burning ? 0.55 : 0, 0.95 * ball);
  const smoke = Math.min(0.85, 0.3 + 0.5 * (1 - ball)) * (burning ? 1 : Math.exp(-since / 6));
  return { heat, flash, smoke };
}
