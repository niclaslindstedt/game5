// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLAB BROKEN INTO PLATES — three-free, so the suite reads it
// (`tests/avalanche_look_test.ts`); `avalanche-plates.ts` draws them.
//
// A slab does not break on a grid. The crack runs out from where it was
// triggered at tens of metres a second and the slab comes apart behind it
// into IRREGULAR POLYGONS of very different sizes — big tabular blocks
// metres across beside small fragments — each its own thickness. Here the
// cut is a Voronoi tessellation of points jittered over the slab, some
// left out (so a neighbour grows over their room) and some doubled (so a
// small fragment sits beside a big block), every cell clipped to the
// crown's and the flanks' lines and cut down to at most `CORNERS` corners
// (what the plates' vertex shader reads). Each plate is carried by the
// three parcels nearest it (`near`, `weight`), so the slab stretches and
// crowds as the flow does — cracks opening where it runs apart, plates
// riding up over each other where it piles — and it starts to move only
// when the crack has reached it (`crack`, s after the release).

import type { SlabFrame } from "@engine";

import { bedDepth, crownAt, hash01, SLIDE_LOOK } from "./avalanche-plan.ts";

/** The most corners a plate's outline keeps. */
export const CORNERS = 8;

export const CRACK = {
  /** A plate's mean size, m: a slab breaks into blocks metres across. */
  size: 4.6,
  /** The jitter of a cell's point, its share of the spacing. */
  jitter: 0.48,
  /** The share of the points left out (their neighbours take their room)
   * and the share that put a second, smaller point beside themselves. */
  drop: 0.24,
  split: 0.3,
  /** A plate's thickness, its share of the bed's depth there, dealt. */
  thick: [0.75, 1.2] as const,
  /** How fast the crack runs out from the trigger, m/s (a dry slab's
   * fracture propagates at 20–60 m/s), and the most time it may take to
   * reach the slab's far corner, s — the engine sets the whole slab off at
   * once, so the drawn crack may not lag it long. */
  speed: 45,
  most: 1.6,
  /** Where the trigger stands: this far down the slab from the crown, m,
   * at most this share of its length. */
  trigger: 18,
  triggerShare: 0.15,
} as const;

/** ONE PLATE: its middle in the slab's frame (m), its outline as
 * `CORNERS` corners (u, v pairs round the middle, m, anticlockwise from
 * above, a short outline padded by repeating its last corner), its mean
 * radius and thickness (m), the three parcels that carry it and their
 * weights, and when the crack reaches it (s after the release). */
export type Plate = {
  u: number;
  v: number;
  outline: Float32Array;
  r: number;
  h: number;
  near: [number, number, number];
  weight: [number, number, number];
  crack: number;
};

type Pt = { u: number; v: number };

/** Clip `poly` to the half-plane a·u + b·v ≤ c (Sutherland–Hodgman). */
function clip(poly: Pt[], a: number, b: number, c: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const dp = a * p.u + b * p.v - c;
    const dq = a * q.u + b * q.v - c;
    if (dp <= 0) out.push(p);
    if (dp < 0 !== dq < 0 && dp !== dq) {
      const t = dp / (dp - dq);
      out.push({ u: p.u + (q.u - p.u) * t, v: p.v + (q.v - p.v) * t });
    }
  }
  return out;
}

/** The polygon's signed area (anticlockwise in u, v positive) and middle. */
function centroid(poly: Pt[]): { a: number; u: number; v: number } {
  let a = 0;
  let cu = 0;
  let cv = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const x = p.u * q.v - q.u * p.v;
    a += x;
    cu += (p.u + q.u) * x;
    cv += (p.v + q.v) * x;
  }
  a /= 2;
  if (Math.abs(a) < 1e-9) return { a: 0, u: poly[0].u, v: poly[0].v };
  return { a, u: cu / (6 * a), v: cv / (6 * a) };
}

/** Cut `poly` down to `CORNERS` corners: the corner whose triangle with
 * its neighbours is smallest goes first, so the outline keeps its shape. */
function simplify(poly: Pt[]): Pt[] {
  const p = poly.slice();
  while (p.length > CORNERS) {
    let best = 0;
    let least = Infinity;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length];
      const b = p[i];
      const c = p[(i + 1) % p.length];
      const area = Math.abs((b.u - a.u) * (c.v - a.v) - (c.u - a.u) * (b.v - a.v));
      if (area < least) {
        least = area;
        best = i;
      }
    }
    p.splice(best, 1);
  }
  return p;
}

/** THE CRACK'S FRONT: where it starts in the slab's frame (`u`, `v`) and
 * how fast it runs out from there, m/s — quick enough to reach the slab's
 * far corner within `CRACK.most` s. */
export type CrackFront = { u: number; v: number; speed: number };

export function crackFront(slab: SlabFrame): CrackFront {
  const mid = (slab.left - slab.right) / 2;
  const wide = slab.left + slab.right;
  const u = mid + (hash01(Math.round(slab.x), Math.round(slab.z), 0x7c) - 0.5) * wide * 0.5;
  const v = Math.min(CRACK.trigger, slab.length * CRACK.triggerShare);
  const reach = Math.max(
    Math.hypot(u + slab.right, slab.length - v),
    Math.hypot(slab.left - u, slab.length - v),
    Math.hypot(u + slab.right, v),
    Math.hypot(slab.left - u, v),
  );
  return { u, v, speed: Math.max(CRACK.speed, reach / CRACK.most) };
}

/** When the crack reaches (`u`, `v`), s after the release. */
export function crackAt(front: CrackFront, u: number, v: number): number {
  return Math.hypot(u - front.u, v - front.v) / front.speed;
}

/** How far the slab has dropped away from the old surface at (`u`, `v`)
 * `t` s after the release, 0..1: none before the crack reaches it, all of
 * it a tenth of a second after. Mirrored in `avalanche-glsl.ts`. */
export function crackGone(front: CrackFront, u: number, v: number, t: number): number {
  return Math.min(1, Math.max(0, (t - crackAt(front, u, v)) / 0.1));
}

/** THE SLAB CUT INTO PLATES (see the header), each handed to the three
 * parcels nearest it (`starts`: the parcels' plan positions at the
 * release, x and z a parcel). */
export function crackSlab(
  slab: SlabFrame,
  phase: readonly number[],
  starts: Float64Array,
  parcels: number,
): Plate[] {
  const most = SLIDE_LOOK.plate.most;
  const wide = slab.left + slab.right;
  // Coarser on a slab too big for the budget.
  const s = Math.max(CRACK.size, Math.sqrt((wide * slab.length) / (most * 0.75)));
  const cols = Math.max(1, Math.ceil(wide / s));
  const rows = Math.max(1, Math.ceil(slab.length / s));
  const pts: Pt[] = [];
  const salt = Math.round(slab.x * 3) ^ Math.round(slab.z * 5);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const h = hash01(i + salt, j, 0xd0);
      // Some left out: a neighbour grows over their room into a big block.
      if (h < CRACK.drop && i > 0 && j > 0) continue;
      const u = -slab.right + (i + 0.5 + CRACK.jitter * (hash01(i, j + salt, 1) * 2 - 1)) * s;
      const v = (j + 0.5 + CRACK.jitter * (hash01(i + salt, j, 2) * 2 - 1)) * s;
      pts.push({ u, v });
      // Some doubled: a small fragment broken off beside it.
      if (h > 1 - CRACK.split) {
        const a = hash01(i, j, 3 + salt) * Math.PI * 2;
        pts.push({ u: u + Math.cos(a) * s * 0.38, v: v + Math.sin(a) * s * 0.38 });
      }
    }
  }
  // The points bucketed, so a cell's neighbours are found near it.
  const B = s;
  const nbu = Math.ceil((wide + 2 * s) / B) + 1;
  const nbv = Math.ceil((slab.length + 2 * s) / B) + 1;
  const buckets: number[][] = Array.from({ length: nbu * nbv }, () => []);
  const bi = (u: number) => Math.max(0, Math.min(nbu - 1, Math.floor((u + slab.right + s) / B)));
  const bj = (v: number) => Math.max(0, Math.min(nbv - 1, Math.floor((v + s) / B)));
  pts.forEach((p, k) => buckets[bj(p.v) * nbu + bi(p.u)].push(k));
  const F = SLIDE_LOOK.flank;
  const front = crackFront(slab);
  const plates: Plate[] = [];
  for (let k = 0; k < pts.length && plates.length < most; k++) {
    const p = pts[k];
    const r = 2.6 * s;
    let poly: Pt[] = [
      { u: p.u - r, v: p.v - r },
      { u: p.u + r, v: p.v - r },
      { u: p.u + r, v: p.v + r },
      { u: p.u - r, v: p.v + r },
    ];
    const i0 = bi(p.u);
    const j0 = bj(p.v);
    for (let j = Math.max(0, j0 - 2); j <= Math.min(nbv - 1, j0 + 2) && poly.length; j++) {
      for (let i = Math.max(0, i0 - 2); i <= Math.min(nbu - 1, i0 + 2) && poly.length; i++) {
        for (const o of buckets[j * nbu + i]) {
          if (o === k) continue;
          const q = pts[o];
          const a = q.u - p.u;
          const b = q.v - p.v;
          const c = a * (p.u + q.u) * 0.5 + b * (p.v + q.v) * 0.5;
          poly = clip(poly, a, b, c);
        }
      }
    }
    if (poly.length < 3) continue;
    // To the slab: the crown's line and the flanks', each as the tangent
    // at the cell's own point.
    const e = 0.5;
    const top = crownAt(phase, p.u);
    const slope = (crownAt(phase, p.u + e) - crownAt(phase, p.u - e)) / (2 * e);
    poly = clip(poly, slope, -1, slope * p.u - top);
    const lw = F.wave;
    const left = slab.left + F.ragged * Math.sin(p.v * lw + phase[2]);
    const dl = F.ragged * lw * Math.cos(p.v * lw + phase[2]);
    poly = clip(poly, 1, -dl, left - dl * p.v);
    const rw = F.wave * 1.3;
    const right = slab.right + F.ragged * Math.sin(p.v * rw + phase[3]);
    const dr = F.ragged * rw * Math.cos(p.v * rw + phase[3]);
    poly = clip(poly, -1, -dr, right - dr * p.v);
    // A tangent carried far off its point overshoots the ragged line's
    // reach: never past its furthest.
    poly = clip(poly, 1, 0, slab.left + F.ragged);
    poly = clip(poly, -1, 0, slab.right + F.ragged);
    poly = clip(poly, 0, 1, slab.length);
    if (poly.length < 3) continue;
    const mid = centroid(poly);
    if (mid.a < 0.4) continue;
    const bed = bedDepth(slab, phase, mid.u, mid.v);
    if (bed <= 0.05) continue;
    const corners = simplify(poly);
    const outline = new Float32Array(CORNERS * 2);
    for (let c = 0; c < CORNERS; c++) {
      const q = corners[Math.min(c, corners.length - 1)];
      outline[c * 2] = q.u - mid.u;
      outline[c * 2 + 1] = q.v - mid.v;
    }
    const th = CRACK.thick[0] + (CRACK.thick[1] - CRACK.thick[0]) * hash01(k, salt, 4);
    // The three parcels nearest, weighted by the inverse of the square.
    const x = slab.x + slab.fz * mid.u + slab.fx * mid.v;
    const z = slab.z - slab.fx * mid.u + slab.fz * mid.v;
    const near: [number, number, number] = [0, 0, 0];
    const dist: [number, number, number] = [Infinity, Infinity, Infinity];
    for (let n = 0; n < parcels; n++) {
      const d = (starts[n * 2] - x) ** 2 + (starts[n * 2 + 1] - z) ** 2;
      if (d >= dist[2]) continue;
      let at = 2;
      while (at > 0 && d < dist[at - 1]) {
        dist[at] = dist[at - 1];
        near[at] = near[at - 1];
        at--;
      }
      dist[at] = d;
      near[at] = n;
    }
    const weight: [number, number, number] = [0, 0, 0];
    let sum = 0;
    for (let n = 0; n < 3; n++) {
      weight[n] = Number.isFinite(dist[n]) ? 1 / (dist[n] + 4) : 0;
      sum += weight[n];
    }
    for (let n = 0; n < 3; n++) weight[n] = sum > 0 ? weight[n] / sum : n === 0 ? 1 : 0;
    plates.push({
      u: mid.u,
      v: mid.v,
      outline,
      r: Math.sqrt(mid.a / Math.PI),
      h: Math.min(slab.depth, bed * th),
      near,
      weight,
      crack: crackAt(front, mid.u, mid.v),
    });
  }
  return plates;
}

/** How far a plate has started off, 0..1, `since` s after its crack. */
export function crackOpen(since: number): number {
  const t = Math.min(1, Math.max(0, since / 0.45));
  return t * t * (3 - 2 * t);
}
