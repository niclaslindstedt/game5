// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIMBS' GEOMETRY — the arithmetic every pose is solved with: two bones
// toward a target (`solveLimb`), a boot's frame on its ski and the knee its
// cuff allows (`bootFrame`, `bootKnee`, `CUFF`), a vector turned about an
// axis. `skier-pose.ts` poses the skier on the skis with it and hangs him
// on the ragdoll. Three-free.

import { add, dot, len, norm, scale, sub, type V3 } from "./skier-vec.ts";

/** A boot's frame: `f` forward along its sole, `n` up out of it. */
export type Boot = { f: V3; n: V3 };

/**
 * TWO BONES FROM `root` TOWARD `target`: the joint between them, bent
 * toward `pole`. Lengths `a` and `b`. A target out of reach is reached for
 * along the same line, fully extended.
 */
export function solveLimb(root: V3, target: V3, a: number, b: number, pole: V3): V3 {
  const span = sub(target, root);
  const d0 = len(span);
  const dir = d0 > 1e-6 ? scale(span, 1 / d0) : { x: 0, y: -1, z: 0 };
  const d = Math.min(Math.max(d0, Math.abs(a - b) + 1e-4), a + b - 1e-4);
  const along = (a * a - b * b + d * d) / (2 * d);
  const up = Math.sqrt(Math.max(0, a * a - along * along));
  let p = sub(pole, scale(dir, dot(pole, dir)));
  if (len(p) < 1e-6) p = { x: 0, y: 1, z: 0 };
  p = norm(p);
  return add(add(root, scale(dir, along)), scale(p, up));
}

/** THE BOOT'S CUFF: how far it leans the shin forward of the ski's normal
 * at the least (the cuff's own forward lean, `ski-gear.ts`'s cuff tipped
 * 0.22 rad, less the little a liner gives) and at the most (a boot flexed
 * as far as a racer's tuck drives it), rad. */
export const CUFF = { least: 0.19, most: 0.72 };

/** A boot's frame: its forward along the ski (turned `turn` about the
 * vertical, clockwise), its UP the ski's normal tipped `edge` about that
 * forward (right edges down positive). */
export function bootFrame(turn: number, edge: number): Boot {
  const f = { x: Math.sin(turn), y: 0, z: Math.cos(turn) };
  const r = { x: Math.cos(turn), y: 0, z: -Math.sin(turn) };
  return { f, n: add(scale(r, Math.sin(edge)), { x: 0, y: Math.cos(edge), z: 0 }) };
}

/**
 * WHERE THE BOOT PUTS THE KNEE: on the boot's plane (its forward and its
 * up), `shin` m up from the cuff at the forward lean that sets the knee
 * `thigh` m from the hip — the leg folded forward, never back — the lean
 * held to what the cuff allows (`CUFF`).
 */
export function bootKnee(hip: V3, cuff: V3, boot: Boot, thigh: number, shin: number): V3 {
  const d = sub(hip, cuff);
  const dn = dot(d, boot.n);
  const df = dot(d, boot.f);
  const r = Math.hypot(dn, df) || 1e-6;
  const c = (dot(d, d) + shin * shin - thigh * thigh) / (2 * shin * r);
  const lean = Math.atan2(df, dn) + Math.acos(Math.max(-1, Math.min(1, c)));
  const k = Math.max(CUFF.least, Math.min(CUFF.most, lean));
  return add(cuff, scale(add(scale(boot.n, Math.cos(k)), scale(boot.f, Math.sin(k))), shin));
}

/** `v` turned `a` rad about the unit `axis` (Rodrigues). */
export function turnAbout(v: V3, axis: V3, a: number): V3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const k = dot(axis, v) * (1 - c);
  return {
    x: v.x * c + (axis.y * v.z - axis.z * v.y) * s + axis.x * k,
    y: v.y * c + (axis.z * v.x - axis.x * v.z) * s + axis.y * k,
    z: v.z * c + (axis.x * v.y - axis.y * v.x) * s + axis.z * k,
  };
}
