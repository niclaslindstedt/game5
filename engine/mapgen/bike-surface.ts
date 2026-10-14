// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R44 — THE BIKE PARK AS GROUND. A trail's tread is a metre or two wide and
// its features are shaped to the decimetre — a berm's face, a table's lip,
// a root a hand high — far finer than the 2 m grid a map is baked on. So,
// as the halfpipe's walls are (R39, `pipe.ts`), the park is a LAYERED
// SURFACE: inside a trail's footprint `groundAt` and `normalAt` answer off
// the trail's own shape (`bike-trail-shape.ts`: the bench, the outslope or
// the berm's bank, the features), eased into the map's ground across its
// shoulders; everywhere else the map's own grid answers. The grid itself is
// LAID under each footprint to just below that surface — cut under a cut,
// raised into an embankment under a fill — so what the renderer lays over
// it (the tread drawn off the same function) is never pierced by the
// terrain under it, and never floats over ground that is not there.
//
// Pure: no stream is drawn from. The index a point is looked up by is
// built once a park and kept.

import { clamp, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { BIKE_PARK_RULES as B } from "./bike-park-rules.ts";
import type { BikePark, BikeTrail, BikeTrailHit } from "./bike-park-types.ts";
import { bermWeight, featureHeight } from "./bike-trail-shape.ts";
import type { Level, TreeDef, Vec3 } from "./types.ts";

/** The index's cell, m. */
const CELL = 8;

type Index = {
  readonly cells: Map<number, number[]>;
  /** Every segment as (trail, station) packed: trail × 2^20 + station. */
  readonly reach: number;
  /** Per trail, its features' starts in order (for the arc lookup). */
  readonly starts: number[][];
};

const indexes = new WeakMap<BikePark, Index>();

const keyOf = (i: number, j: number): number => (i + 4096) * 8192 + (j + 4096);

/** The widest a footprint reaches from its centre line, m. */
export function footprintReach(park: BikePark): number {
  let w = 0;
  for (const t of park.trails) for (const p of t.points) w = Math.max(w, p.width);
  return w / 2 + B.bench.widest + 0.5;
}

function indexOf(park: BikePark): Index {
  let idx = indexes.get(park);
  if (idx) return idx;
  const cells = new Map<number, number[]>();
  const reach = footprintReach(park);
  park.trails.forEach((t, ti) => {
    for (let k = 0; k + 1 < t.points.length; k++) {
      const a = t.points[k];
      const b = t.points[k + 1];
      const i0 = Math.floor((Math.min(a.x, b.x) - reach) / CELL);
      const i1 = Math.floor((Math.max(a.x, b.x) + reach) / CELL);
      const j0 = Math.floor((Math.min(a.z, b.z) - reach) / CELL);
      const j1 = Math.floor((Math.max(a.z, b.z) + reach) / CELL);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const key = keyOf(i, j);
          let list = cells.get(key);
          if (!list) cells.set(key, (list = []));
          list.push(ti * 1048576 + k);
        }
      }
    }
  });
  const starts = park.trails.map((t) => t.features.map((f) => f.from));
  idx = { cells, reach, starts };
  indexes.set(park, idx);
  return idx;
}

/** The bench's height at arc `s` of `trail`, m. */
export function benchAt(trail: BikeTrail, s: number): number {
  const p = trail.points;
  const k = clamp(Math.floor(s), 0, p.length - 2);
  // Stations stand a metre apart from the head: station k at about s = k.
  let i = k;
  while (i > 0 && p[i].s > s) i--;
  while (i < p.length - 2 && p[i + 1].s < s) i++;
  const a = p[i];
  const b = p[i + 1];
  const t = clamp((s - a.s) / Math.max(1e-6, b.s - a.s), 0, 1);
  return a.y + (b.y - a.y) * t;
}

/** The tread's half-width at arc `s` of `trail`, m. */
function halfAt(trail: BikeTrail, s: number): number {
  const p = trail.points;
  const i = clamp(Math.round(s), 0, p.length - 1);
  return p[i].width / 2;
}

/** THE TREAD's height at arc `s`, `a` m right of the centre line (inside
 * the tread), of trail number `ti` of `park`. */
export function treadAt(park: BikePark, ti: number, s: number, a: number): number {
  const trail = park.trails[ti];
  const idx = indexOf(park);
  const half = halfAt(trail, s);
  const p = trail.points[clamp(Math.round(s), 0, trail.points.length - 1)];
  let y = benchAt(trail, s);
  let berm = 0;
  const starts = idx.starts[ti];
  // The features near s: the last starting before it, and those just after.
  let lo = 0;
  let hi = starts.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (starts[m] <= s + 4) lo = m + 1;
    else hi = m;
  }
  for (let k = lo - 1; k >= 0 && k >= lo - 3; k--) {
    const f = trail.features[k];
    if (s > f.to + 4) continue;
    y += featureHeight(f, s, a, half);
    if (f.kind === "berm") berm = Math.max(berm, bermWeight(f, s));
  }
  // Water leaves the tread off its downhill edge, but for a berm's bank.
  y -= B.bench.outslope * a * p.downhill * (1 - berm);
  return y;
}

/** WHERE (x, z) IS ON THE PARK: the trail whose surface it stands most
 * on, or null off every footprint. `ground` is the map's own ground there
 * (the base it is eased into). Where two TREADS overlap — a CROSSING — the
 * height is the two blended by how far into each the point stands (a
 * tread's weight falls to nothing at its edge), so the ground runs on
 * through the crossing with no step where one tread meets the other; a
 * tread always stands over another trail's shoulder. */
export function bikeHit(
  park: BikePark,
  x: number,
  z: number,
  ground: number,
): (BikeTrailHit & { y: number }) | null {
  const idx = indexOf(park);
  const list = idx.cells.get(keyOf(Math.floor(x / CELL), Math.floor(z / CELL)));
  if (!list) return null;
  let best: (BikeTrailHit & { y: number }) | null = null;
  let sum = 0;
  let sumY = 0;
  // The nearest segment of each trail, then the trail stood on most.
  const near = new Map<number, { k: number; d: number; t: number; lateral: number }>();
  for (const code of list) {
    const ti = Math.floor(code / 1048576);
    const k = code - ti * 1048576;
    const pts = park.trails[ti].points;
    const a = pts[k];
    const b = pts[k + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l2 = dx * dx + dz * dz || 1e-9;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / l2, 0, 1);
    const px = a.x + dx * t;
    const pz = a.z + dz * t;
    const d = hypot(x - px, z - pz);
    const had = near.get(ti);
    if (had && had.d <= d) continue;
    // Right of the way is +: the way is (dx, dz), its right (dz, −dx).
    const len = Math.sqrt(l2);
    const lateral = ((x - px) * dz - (z - pz) * dx) / len;
    near.set(ti, { k, d, t, lateral });
  }
  for (const [ti, n] of near) {
    const trail = park.trails[ti];
    const a = trail.points[n.k];
    const b = trail.points[n.k + 1];
    const s = a.s + (b.s - a.s) * n.t;
    const half = a.width / 2 + (b.width / 2 - a.width / 2) * n.t;
    if (n.d > half + B.bench.widest) continue;
    let y: number;
    let weight: number;
    let blend: number;
    if (n.d <= half) {
      y = treadAt(park, ti, s, n.lateral);
      weight = 1;
      blend = Math.max(1e-3, (half - n.d) / Math.max(half, 0.1));
    } else {
      const side = n.lateral >= 0 ? half : -half;
      const edge = treadAt(park, ti, s, side);
      const w = clamp(
        B.bench.shoulder + B.bench.bank * Math.abs(edge - ground),
        B.bench.shoulder,
        B.bench.widest,
      );
      const t = (n.d - half) / w;
      if (t >= 1) continue;
      const k = smoothstep(0, 1, t);
      y = edge + (ground - edge) * k;
      weight = 1 - k;
      blend = 0;
    }
    sum += blend;
    sumY += blend * y;
    if (
      !best ||
      weight > best.weight ||
      (weight === best.weight && Math.abs(n.lateral) < Math.abs(best.lateral))
    ) {
      best = { trail, index: n.k, s, lateral: n.lateral, half, weight, y };
    }
  }
  if (best && sum > 0) best.y = sumY / sum;
  return best;
}

/** `base` with `park` laid on it: `groundAt` and `normalAt` answering off
 * the trails inside their footprints, the grid cut under them, the trees
 * on a tread and its fall zone felled and those on a shoulder stood on it. */
export function withBikeSurface(base: Level, park: BikePark): Level {
  const groundAt = (x: number, z: number): number => {
    const g = base.groundAt(x, z);
    const hit = bikeHit(park, x, z, g);
    return hit ? hit.y : g;
  };
  const e = 0.08;
  const normalAt = (x: number, z: number, out: Vec3): void => {
    const g = base.groundAt(x, z);
    if (!bikeHit(park, x, z, g)) {
      base.normalAt(x, z, out);
      return;
    }
    const gx = (groundAt(x + e, z) - groundAt(x - e, z)) / (2 * e);
    const gz = (groundAt(x, z + e) - groundAt(x, z - e)) / (2 * e);
    const inv = 1 / Math.sqrt(gx * gx + 1 + gz * gz);
    out.x = -gx * inv;
    out.y = inv;
    out.z = -gz * inv;
  };
  // THE GRID LAID under every footprint, to just under the surface: cut
  // down under a cut and RAISED under a fill, so the bench a trail is
  // built up on stands on an embankment of the mountain's own ground —
  // never a tread floating over the grass with nothing under it.
  const field = base.ground;
  const data = new Float32Array(field.data);
  const reach = footprintReach(park);
  const seen = new Uint8Array(data.length);
  for (const t of park.trails) {
    for (let k = 0; k < t.points.length; k += 2) {
      const p = t.points[k];
      const c0 = clamp(Math.floor((p.x - reach - field.originX) / field.cell), 0, field.cols - 1);
      const c1 = clamp(Math.ceil((p.x + reach - field.originX) / field.cell), 0, field.cols - 1);
      const r0 = clamp(Math.floor((p.z - reach - field.originZ) / field.cell), 0, field.rows - 1);
      const r1 = clamp(Math.ceil((p.z + reach - field.originZ) / field.cell), 0, field.rows - 1);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const i = r * field.cols + c;
          if (seen[i]) continue;
          seen[i] = 1;
          const x = field.originX + c * field.cell;
          const z = field.originZ + r * field.cell;
          const hit = bikeHit(park, x, z, field.data[i]);
          if (hit) data[i] = hit.y - 0.12;
        }
      }
    }
  }
  const ground = { ...field, data };
  return {
    ...base,
    ground,
    groundAt,
    normalAt,
    trees: parkTrees(base, park),
    bikePark: park,
  };
}

/** The woods with every tread and its fall zone felled, and what stands
 * on a shoulder stood on it. */
function parkTrees(base: Level, park: BikePark): TreeDef[] {
  const out: TreeDef[] = [];
  const fall: Record<string, number> = {};
  for (const t of park.trails) {
    fall[t.id] = t.kind === "race" ? 2 : B.grades[t.grade].fall;
  }
  const idx = indexOf(park);
  for (const tree of base.trees) {
    if (inFallZone(park, idx, tree, fall)) continue;
    const g = base.groundAt(tree.x, tree.z);
    const hit = bikeHit(park, tree.x, tree.z, g);
    if (!hit) {
      out.push(tree);
      continue;
    }
    out.push(Math.abs(hit.y - tree.y) > 0.01 ? { ...tree, y: hit.y } : tree);
  }
  return out;
}

/** Whether a trunk stands on any trail's tread or in its fall zone. */
function inFallZone(
  park: BikePark,
  idx: Index,
  tree: TreeDef,
  fall: Record<string, number>,
): boolean {
  const ci = Math.floor(tree.x / CELL);
  const cj = Math.floor(tree.z / CELL);
  for (let j = cj - 1; j <= cj + 1; j++) {
    for (let i = ci - 1; i <= ci + 1; i++) {
      for (const code of idx.cells.get(keyOf(i, j)) ?? []) {
        const ti = Math.floor(code / 1048576);
        const k = code - ti * 1048576;
        const trail = park.trails[ti];
        const a = trail.points[k];
        const b = trail.points[k + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const l2 = dx * dx + dz * dz || 1e-9;
        const t = clamp(((tree.x - a.x) * dx + (tree.z - a.z) * dz) / l2, 0, 1);
        const d = hypot(tree.x - a.x - dx * t, tree.z - a.z - dz * t);
        if (d < Math.max(a.width, b.width) / 2 + B.clear + fall[trail.id] + tree.radius)
          return true;
      }
    }
  }
  return false;
}

/** The nearest point on any trail's centre line to (x, z) within `within`
 * m (the index's reach at most when larger), or null. */
export function nearestTrailPoint(
  park: BikePark,
  x: number,
  z: number,
  within = 50,
): {
  trail: BikeTrail;
  index: number;
  s: number;
  distance: number;
  half: number;
  x: number;
  z: number;
} | null {
  const idx = indexOf(park);
  const r = Math.ceil(within / CELL);
  const ci = Math.floor(x / CELL);
  const cj = Math.floor(z / CELL);
  let best: ReturnType<typeof nearestTrailPoint> = null;
  for (let j = cj - r; j <= cj + r; j++) {
    for (let i = ci - r; i <= ci + r; i++) {
      const list = idx.cells.get(keyOf(i, j));
      if (!list) continue;
      for (const code of list) {
        const ti = Math.floor(code / 1048576);
        const k = code - ti * 1048576;
        const trail = park.trails[ti];
        const a = trail.points[k];
        const b = trail.points[k + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const l2 = dx * dx + dz * dz || 1e-9;
        const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / l2, 0, 1);
        const px = a.x + dx * t;
        const pz = a.z + dz * t;
        const d = hypot(x - px, z - pz);
        if (d > within || (best && d >= best.distance)) continue;
        best = {
          trail,
          index: k,
          s: a.s + (b.s - a.s) * t,
          distance: d,
          half: a.width / 2,
          x: px,
          z: pz,
        };
      }
    }
  }
  return best;
}
