// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARTS OF THE RETRO SKIER THAT FLY (`retro-look.ts`'s `RETRO_CHAINS`):
// the scarf's two tails and the hat's bobble, swung in the AIR PAST HIM.
// Presentation only — nothing the engine reads, nothing drawn from its
// stream — so it is stepped on the picture's own clock.
//
// Each chain is a string of points in the WORLD (a verlet rope): its first
// point held where its root rides on him (the knot on the chest, the crown
// on the head), every other point carried by its own momentum, pulled by
// gravity and dragged toward the air's velocity — so at a standstill the
// tails hang, at speed they stream out behind him and flog, and a landing
// throws them. Each link is held to its length, the rope is eased back
// toward the shape it was laid in (a knit scarf's own stiffness; the
// bobble's stalk much stiffer), and every point is pushed out of a few
// spheres round his trunk and head so a tail lies over a shoulder rather
// than through it. Three-free: the drawer hands in matrices as arrays.

import type { V3 } from "./skier-pose.ts";

/** How a kind of chain behaves. */
export type ChainFeel = {
  /** How fast the air drags a point to its own velocity, 1/s — high for a
   * light open knit, low for a dense ball of yarn. */
  drag: number;
  /** How hard each point is eased toward its rest shape, 1/s². */
  stiff: number;
  /** Velocity kept a step (1 is none lost). */
  keep: number;
  /** THE FLOG: a cloth tail in a stream does not lie still along it but
   * flaps in a wave run down it from the root (its wake shed side to side).
   * The push across the stream, m/s² per m/s of air past him, at the tip
   * (none at the root). */
  flog: number;
  /** The wave's frequency, Hz per m/s of air past him, and its most. */
  rate: number;
  most: number;
  /** How far the wave lags a link down the tail, radians. */
  lag: number;
};

export const FEEL: Record<"scarf" | "bobble", ChainFeel> = {
  scarf: { drag: 5.5, stiff: 6, keep: 0.985, flog: 1.6, rate: 0.42, most: 7, lag: 0.9 },
  bobble: { drag: 1.2, stiff: 900, keep: 0.94, flog: 0.5, rate: 0.6, most: 9, lag: 0 },
};

/** A chain as laid at rest, in the frame of the bone its root rides
 * (`anchor`): its joints, root first, and how many of them are held where
 * they lie on him (`pin`, 1 if left out: the root alone) — a tail laid over
 * the shoulder leaves him from behind it, never through his chest. */
export type ChainRest = {
  name: string;
  anchor: number;
  joints: V3[];
  feel: ChainFeel;
  pin?: number;
};

/** A sphere he fills, in the frame of bone `bone`: its centre and radius. */
export type Collider = { bone: number; at: V3; r: number };

/** A bone's world frame as a column-major 4×4 (three's `elements`). */
export type Mat = ArrayLike<number>;

const G = -9.81;

function apply(m: Mat, p: V3): V3 {
  return {
    x: m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12],
    y: m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13],
    z: m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14],
  };
}

function unit(v: V3): V3 {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function cross(a: V3, b: V3): V3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

type Rope = { rest: ChainRest; p: V3[]; q: V3[]; seg: number[] };

export type RetroWind = {
  /** Step every chain `dt` s with the bones' world frames `bones` (by
   * index) and the wind `air` (m/s, world). */
  step(bones: readonly Mat[], dt: number, air?: V3): void;
  /** Each chain's points in the world, root first. */
  points(): V3[][];
  /** Lay every chain back to rest on the next step (a reset, a cut). */
  reset(): void;
};

export function createRetroWind(
  chains: readonly ChainRest[],
  colliders: readonly Collider[],
): RetroWind {
  /** Each chain's flog wave, radians. */
  const phase = chains.map(() => 0);
  const ropes: Rope[] = chains.map((c) => ({
    rest: c,
    p: [],
    q: [],
    seg: c.joints
      .slice(1)
      .map((j, k) => Math.hypot(j.x - c.joints[k].x, j.y - c.joints[k].y, j.z - c.joints[k].z)),
  }));
  let fresh = true;

  function lay(r: Rope, m: Mat): void {
    r.p = r.rest.joints.map((j) => apply(m, j));
    r.q = r.p.map((v) => ({ ...v }));
  }

  return {
    step(bones, dt, air = { x: 0, y: 0, z: 0 }) {
      if (dt <= 1e-5) return;
      const h = Math.min(dt, 1 / 30);
      const spheres = colliders.map((c) => ({ at: apply(bones[c.bone], c.at), r: c.r }));
      for (const [ri, r] of ropes.entries()) {
        const m = bones[r.rest.anchor];
        const root = apply(m, r.rest.joints[0]);
        // A jump of the root (a reset, a teleport) lays the chain afresh.
        const moved = r.p.length
          ? Math.hypot(root.x - r.p[0].x, root.y - r.p[0].y, root.z - r.p[0].z)
          : Infinity;
        if (fresh || moved > 3) lay(r, m);
        const f = r.rest.feel;
        const goal = r.rest.joints.map((j) => apply(m, j));
        const shift = { x: root.x - goal[0].x, y: root.y - goal[0].y, z: root.z - goal[0].z };
        // The air past the root, and the two ways across it the tail flogs:
        // the anchor's side, and the third way square to both.
        const rv = r.p.length
          ? { x: (root.x - r.q[0].x) / h, y: (root.y - r.q[0].y) / h, z: (root.z - r.q[0].z) / h }
          : air;
        const past = { x: air.x - rv.x, y: air.y - rv.y, z: air.z - rv.z };
        const u = Math.hypot(past.x, past.y, past.z);
        const side = unit({ x: m[0], y: m[1], z: m[2] });
        const flow =
          u > 1e-3 ? { x: past.x / u, y: past.y / u, z: past.z / u } : { x: 0, y: 0, z: 0 };
        const up = unit(cross(flow, side));
        phase[ri] += 2 * Math.PI * Math.min(f.most, f.rate * u) * h;
        const pin = Math.max(1, r.rest.pin ?? 1);
        for (let k = 0; k < pin; k++) {
          const held =
            k === 0
              ? root
              : { x: goal[k].x + shift.x, y: goal[k].y + shift.y, z: goal[k].z + shift.z };
          r.p[k] = held;
          r.q[k] = held;
        }
        for (let k = pin; k < r.p.length; k++) {
          const p = r.p[k];
          const q = r.q[k];
          const v = { x: (p.x - q.x) / h, y: (p.y - q.y) / h, z: (p.z - q.z) / h };
          const want = { x: goal[k].x + shift.x, y: goal[k].y + shift.y, z: goal[k].z + shift.z };
          // The flog: a wave down the tail, growing to the tip, mostly
          // side to side and a little up and down.
          const w = phase[ri] - f.lag * k;
          const out = f.flog * u * (k / (r.p.length - 1));
          const fs = out * Math.sin(w);
          const fu = out * 0.5 * Math.sin(w * 0.5 + 1.3);
          const a = {
            x: f.drag * (air.x - v.x) + f.stiff * (want.x - p.x) + fs * side.x + fu * up.x,
            y: G + f.drag * (air.y - v.y) + f.stiff * (want.y - p.y) + fs * side.y + fu * up.y,
            z: f.drag * (air.z - v.z) + f.stiff * (want.z - p.z) + fs * side.z + fu * up.z,
          };
          r.q[k] = { ...p };
          r.p[k] = {
            x: p.x + (p.x - q.x) * f.keep + a.x * h * h,
            y: p.y + (p.y - q.y) * f.keep + a.y * h * h,
            z: p.z + (p.z - q.z) * f.keep + a.z * h * h,
          };
        }
        // Each link held to its length, root outward, and every point out
        // of his body.
        for (let it = 0; it < 4; it++) {
          for (let k = pin; k < r.p.length; k++) {
            const a = r.p[k - 1];
            const b = r.p[k];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dz = b.z - a.z;
            const d = Math.hypot(dx, dy, dz) || 1e-6;
            const s = r.seg[k - 1] / d;
            r.p[k] = { x: a.x + dx * s, y: a.y + dy * s, z: a.z + dz * s };
          }
          for (let k = pin; k < r.p.length; k++) {
            for (const sp of spheres) {
              const p = r.p[k];
              const dx = p.x - sp.at.x;
              const dy = p.y - sp.at.y;
              const dz = p.z - sp.at.z;
              const d = Math.hypot(dx, dy, dz);
              if (d < sp.r && d > 1e-6) {
                const s = sp.r / d;
                r.p[k] = { x: sp.at.x + dx * s, y: sp.at.y + dy * s, z: sp.at.z + dz * s };
              }
            }
          }
        }
      }
      fresh = false;
    },
    points: () => ropes.map((r) => r.p),
    reset() {
      fresh = true;
    },
  };
}
