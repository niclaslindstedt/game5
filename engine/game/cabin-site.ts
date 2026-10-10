// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SITE A BUILDING IS STOOD ON, as plan geometry: the hash every placer
// deals its choices off, a building's rectangle in the world, the circle
// that holds its roof, the fall line, a line's station by its arc, and
// whether two buildings' roofs keep a gap. Shared by the cabins' placer
// (`cabins.ts`) and the ski area's own buildings (`resort-buildings.ts`);
// pure functions of their arguments.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { sampleField } from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { regionOf } from "../mapgen/regions.ts";
import type { Level, TrackPoint } from "../mapgen/types.ts";
import { CABINS, type CabinKind } from "./defs/cabins.ts";

/** A line a building may stand beside: a run, a lane, or the one piste. */
export type Line = { id: string; road: boolean; track: { points: TrackPoint[]; length: number } };

/** A small FNV hash of the seed, a run, a station and a salt, to 0..1. */
export function pick(seed: number, id: string, k: number, salt: number): number {
  let h = 2166136261 ^ (seed >>> 0);
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h = Math.imul(h ^ k, 16777619);
  h = Math.imul(h ^ salt, 16777619);
  h ^= h >>> 13;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** A building's corners in plan — its walls' (`pad` 0) or wider — in the
 * world, from its middle and heading: the building's x is the heading's
 * right, its z the heading; its middles too, and with `every` a point at
 * least that often along and across, so nothing narrower slips between. */
export function rectPoints(
  kind: CabinKind,
  x: number,
  z: number,
  heading: number,
  roof: boolean,
  pad: number,
  every = Infinity,
): [number, number][] {
  const d = CABINS[kind];
  const r = roof ? d.reach : { side: 0, back: 0, front: 0 };
  const x0 = -d.width / 2 - r.side - pad;
  const x1 = d.width / 2 + r.side + pad;
  const z0 = -d.depth / 2 - r.back - pad;
  const z1 = d.depth / 2 + r.front + pad;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const out: [number, number][] = [];
  const nu = Math.max(2, Math.ceil((x1 - x0) / every));
  const nv = Math.max(2, Math.ceil((z1 - z0) / every));
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      const lx = x0 + ((x1 - x0) * i) / nu;
      const lz = z0 + ((z1 - z0) * j) / nv;
      // Right of the heading is (cos h, −sin h).
      out.push([x + lx * fz + lz * fx, z - lx * fx + lz * fz]);
    }
  }
  return out;
}

/** The radius of a building's roof, m — the circle that holds it. */
export function roofRadius(kind: CabinKind): number {
  const d = CABINS[kind];
  const r = d.reach;
  return hypot(d.width / 2 + r.side, d.depth / 2 + Math.max(r.front, r.back));
}

/** Half a building's walls' longer side, m. */
export function wallRadius(kind: CabinKind): number {
  return Math.max(CABINS[kind].width, CABINS[kind].depth) / 2;
}

/** A building as its roof stands in plan: its kind, middle and heading. */
type Placed = { kind: CabinKind; x: number; z: number; heading: number };

/** Whether the roofs of two buildings (their reach included) come nearer
 * than `gap` m — the two rectangles held apart along all four of their
 * axes (the separating-axis test). */
export function roofsMeet(a: Placed, b: Placed, gap: number): boolean {
  const half = (p: Placed): { cx: number; cz: number; hw: number; hd: number } => {
    const d = CABINS[p.kind];
    // The roof's own middle sits off the walls' by half its reach's lean.
    const off = (d.reach.front - d.reach.back) / 2;
    return {
      cx: p.x + Math.sin(p.heading) * off,
      cz: p.z + Math.cos(p.heading) * off,
      hw: d.width / 2 + d.reach.side + gap / 2,
      hd: d.depth / 2 + (d.reach.front + d.reach.back) / 2 + gap / 2,
    };
  };
  const ra = half(a);
  const rb = half(b);
  const dx = rb.cx - ra.cx;
  const dz = rb.cz - ra.cz;
  for (const [p, q, hp, hq] of [
    [a, b, ra, rb],
    [b, a, rb, ra],
  ] as const) {
    // p's two axes: its right and its front.
    const axes: [number, number][] = [
      [Math.cos(p.heading), -Math.sin(p.heading)],
      [Math.sin(p.heading), Math.cos(p.heading)],
    ];
    for (let k = 0; k < 2; k++) {
      const [ux, uz] = axes[k];
      const own = k === 0 ? hp.hw : hp.hd;
      const qr = [Math.cos(q.heading), -Math.sin(q.heading)];
      const qf = [Math.sin(q.heading), Math.cos(q.heading)];
      const other =
        hq.hw * Math.abs(qr[0] * ux + qr[1] * uz) + hq.hd * Math.abs(qf[0] * ux + qf[1] * uz);
      if (Math.abs(dx * ux + dz * uz) > own + other) return false;
    }
  }
  return true;
}

/** Whether (x, z) is a groomer's snow a building or a street keeps off:
 * packed past a quarter — but on a REAL FACE (`Level.face`), a wind crust
 * folded into the packed field (R21) is not a piste, so only what is
 * packed past what the crust alone packs counts there. A map with no face
 * reads the packed field alone, as it always has. */
export function groomedAt(level: Level): (x: number, z: number) => boolean {
  const crust = level.face ? (level.crust ?? null) : null;
  if (!crust) return (x, z) => level.packedAt(x, z) > 0.25;
  const support = regionOf(level).crust?.packed ?? 0;
  return (x, z) => {
    const p = level.packedAt(x, z);
    return p > 0.25 && p > sampleField(crust, x, z) * support + 0.05;
  };
}

/** The heading straight down the ground's fall line at (x, z). */
export function downhillOf(level: Level, x: number, z: number): number {
  const gx = level.groundAt(x + 4, z) - level.groundAt(x - 4, z);
  const gz = level.groundAt(x, z + 4) - level.groundAt(x, z - 4);
  return Math.atan2(-gx, -gz);
}

/** `from` turned toward `to` by no more than `most` radians. */
export function toward(from: number, to: number, most: number): number {
  let d = to - from;
  d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
  return from + Math.max(-most, Math.min(most, d));
}

/** The distance in plan from (x, z) to the segment a→b, m. */
export function toSegment(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const ex = bx - ax;
  const ez = bz - az;
  const len2 = Math.max(1e-6, ex * ex + ez * ez);
  const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / len2));
  return hypot(ax + ex * t - x, az + ez * t - z);
}

/** A line's station `s` m down it (`trackPointAt` over bare points). */
export function pointAt(points: TrackPoint[], length: number, s: number, out: TrackPoint): void {
  const n = points.length;
  const u = Math.max(0, Math.min(length, s));
  let i = Math.min(n - 2, Math.max(0, Math.floor((u / Math.max(1e-6, length)) * (n - 1))));
  while (i > 0 && points[i].s > u) i--;
  while (i < n - 2 && points[i + 1].s <= u) i++;
  const a = points[i];
  const b = points[Math.min(n - 1, i + 1)];
  const t = b.s > a.s ? (u - a.s) / (b.s - a.s) : 0;
  out.x = a.x + (b.x - a.x) * t;
  out.z = a.z + (b.z - a.z) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.s = u;
  out.heading = t < 0.5 ? a.heading : b.heading;
  out.width = a.width + (b.width - a.width) * t;
}
