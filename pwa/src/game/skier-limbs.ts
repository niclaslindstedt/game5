// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIMBS' GEOMETRY — the arithmetic every pose is solved with: two bones
// toward a target (`solveLimb`), a boot's frame on its ski and the knee its
// cuff allows (`bootFrame`, `bootKnee`, `CUFF`), the pelvis tilted over the
// higher ski (`pelvisAxis`), how far the hips must lift so no knee folds
// past a skier's (`kneeRoom`), a vector turned about an axis. `skier-pose.ts` poses the skier on the skis with it and hangs him
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
 * forward (right edges down positive). On a body INCLINED `incline` rad to
 * the snow (`ski-stand.ts`) the ski is turned about the SNOW's normal and
 * tipped against the snow — `edge` stays the tilt in the body's frame —
 * and the whole is then rolled into the body's frame: a ski pivoted
 * across under an inclined skier stays flat on the snow, never one end
 * buried and the other in the air. */
export function bootFrame(turn: number, edge: number, incline = 0): Boot {
  const e = edge + incline;
  const f = { x: Math.sin(turn), y: 0, z: Math.cos(turn) };
  const r = { x: Math.cos(turn), y: 0, z: -Math.sin(turn) };
  const n = add(scale(r, Math.sin(e)), { x: 0, y: Math.cos(e), z: 0 });
  if (incline === 0) return { f, n };
  const c = Math.cos(incline);
  const sn = Math.sin(incline);
  const roll = (v: V3): V3 => ({ x: v.x * c - v.y * sn, y: v.x * sn + v.y * c, z: v.z });
  return { f: roll(f), n: roll(n) };
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

/** THE PELVIS'S TILT: the share of the skis' difference in height it takes
 * up, and the most it rises on one side, as a sine of the tilt (30°). */
export const PELVIS = { take: 0.8, most: 0.5 };

/**
 * THE PELVIS'S AXIS, left hip to right: turned `yaw` rad (clockwise from
 * above) and TILTED with the angulation — the hip over the higher ski (the
 * inside one, on an inclined stance — `ski-stand.ts`), `rise` m higher
 * than the other, rides up and the other drops, so the two legs share
 * their difference between the hips and both knees, never the inside knee
 * folding up alone beside a straight outside leg. `half` is half the hips'
 * width.
 */
export function pelvisAxis(yaw: number, rise: number, half: number): V3 {
  const hike = (PELVIS.take * rise) / (2 * half);
  const tilt = Math.asin(Math.max(-PELVIS.most, Math.min(PELVIS.most, hike)));
  return {
    x: Math.cos(yaw) * Math.cos(tilt),
    y: Math.sin(tilt),
    z: -Math.sin(yaw) * Math.cos(tilt),
  };
}

/** The most a knee folds, rad of flexion: standing or turning (a racer's
 * inside knee at the height of a slalom turn folds 113–122°), and in a
 * full tuck. */
export const KNEE_MOST = { bent: 1.97, tucked: 2.16 };

/**
 * THE KNEES FOLD ONLY AS FAR AS KNEES DO: how far the hips (`hips`, the
 * pelvis's middle on `pelvis`, `half` its half width) must lift, m, so that
 * neither leg — a `thigh` and a `shin` from each hip joint to its cuff in
 * `feet` — folds past `KNEE_MOST` (`crouch` of the way to the tucked
 * one; `bent` the most turning, a technique's own); as far as the other
 * leg reaches, never stretching it. A skier gets low by bending at the hip,
 * never by a knee folded up past a skier's.
 */
export function kneeRoom(
  hips: V3,
  pelvis: V3,
  feet: readonly [V3, V3],
  crouch: number,
  half: number,
  thigh: number,
  shin: number,
  bent = KNEE_MOST.bent,
): number {
  const most = bent + (KNEE_MOST.tucked - bent) * crouch;
  const span = Math.sqrt(thigh * thigh + shin * shin + 2 * thigh * shin * Math.cos(most));
  const reach = (thigh + shin) * 0.97;
  let need = 0;
  let room = Infinity;
  [-1, 1].forEach((side, i) => {
    const d = sub(add(hips, scale(pelvis, side * half)), feet[i]);
    const flat = d.x * d.x + d.z * d.z;
    if (flat < span * span) need = Math.max(need, Math.sqrt(span * span - flat) - d.y);
    room = Math.min(room, flat < reach * reach ? Math.sqrt(reach * reach - flat) - d.y : 0);
  });
  return Math.max(0, Math.min(need, room));
}

/**
 * HOW FAR THE HIPS CAN RISE, m, before the leg on `side` (−1 left) — a
 * `thigh` and a `shin` from its hip joint (`hips` on `pelvis`, `half` its
 * half width) to its cuff at `foot` — is let out to `flex` rad of knee
 * flexion: an outside leg held long, never locked straight.
 */
export function legRoom(
  hips: V3,
  pelvis: V3,
  foot: V3,
  side: number,
  half: number,
  thigh: number,
  shin: number,
  flex: number,
): number {
  const span = Math.sqrt(thigh * thigh + shin * shin + 2 * thigh * shin * Math.cos(flex));
  const d = sub(add(hips, scale(pelvis, side * half)), foot);
  const flat = d.x * d.x + d.z * d.z;
  return flat < span * span ? Math.max(0, Math.sqrt(span * span - flat) - d.y) : 0;
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

/** How far either side of nought the legs' hang is eased into, m: a
 * corner there in the hips' and the hands' height is a snap each time his
 * weight passes from ski to ski. */
const HANG_EASE = 0.03;

/** THE LEGS TAKE THE SKIS' LIFT, m: skis brought up toward him by the
 * engine's legs (`lift`, the two skis' mean) fold his knees and leave his
 * hips where his mass is — the spring legs a skier rides bumps on — but a
 * skier hanging in the air with his legs long is not stretched straight by
 * them: his hips come down half of that, the corner at nought rounded over
 * `HANG_EASE`. */
export function hipsOver(lift: number): number {
  const w = HANG_EASE;
  if (lift <= -w) return lift / 2;
  if (lift >= w) return 0;
  return -((w - lift) * (w - lift)) / (8 * w);
}
