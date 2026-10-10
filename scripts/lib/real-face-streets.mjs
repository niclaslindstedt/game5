// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL FACES' STREETS — the town at the foot of a real face, roughly:
// its car roads as a few bends each and a rough footprint (a middle and a
// radius), so a village raised on the face can lay its streets the way the
// real town's run (`engine/game/real-streets.ts`). Read by the hints bake
// (`scripts/real-hints.mjs`) off the same map data as the lifts, pistes and
// houses, on the same crop.
//
// ROUGH ON PURPOSE: a street is its class (a MAIN road — a through road,
// trunk to tertiary — or a STREET — a residential, unclassified, living or
// pedestrian street, or a service road with a name, which is a street in
// all but its tag; the nameless service roads are driveways, parking aisles
// and the ski area's tracks, and are left out) and its bends to a few
// metres. The ways of one class that meet end to end at a node no third
// way of that class reaches are joined into one street first, so a street
// split into many ways is kept as the one line it is. Nothing is kept by
// name — a name's presence is read to tell a street from a driveway, and
// the name itself is dropped.
//
// SMALL ON PURPOSE: the streets are ranked by how much of the town they
// are — a main road over a street, a long one over a short one, and both
// by how near the town's middle they run — and kept the best first until
// `BUDGET` bytes or `MOST` streets, whichever comes first. A face's town is
// a couple of KB of its hints file.

import { SIZE, mapAt } from "./real-face-crops.mjs";

/** The road classes kept: 0 a main road, 1 a street. */
const CLASSES = {
  trunk: 0,
  primary: 0,
  secondary: 0,
  tertiary: 0,
  unclassified: 1,
  residential: 1,
  living_street: 1,
  pedestrian: 1,
};

/** How far a street's line may stray from its bends, m; the shortest
 * street kept, m; the most streets a face keeps and the bytes they may
 * take; the radius the town's middle is searched over, m, and the share of
 * its kept street length its radius holds. */
const STRAY = 3;
const SHORTEST = 40;
const MOST = 90;
const BUDGET = 1800;
const REACH = 500;
const HOLD = 0.6;

/** A way's class, or undefined for one that is not a street. */
function classOf(tags) {
  if (tags.highway === "service") return tags.name ? 1 : undefined;
  return CLASSES[tags.highway];
}

/** The ways of one class joined end to end where only two of them meet —
 * each street as a list of node ids. */
function chained(ways) {
  const ends = new Map();
  const at = (id) => ends.get(id) ?? [];
  for (const w of ways) {
    for (const id of [w.refs[0], w.refs.at(-1)]) ends.set(id, [...at(id), w]);
  }
  const used = new Set();
  const out = [];
  for (const w of ways) {
    if (used.has(w)) continue;
    used.add(w);
    let line = [...w.refs];
    for (const forward of [true, false]) {
      for (;;) {
        const tip = forward ? line.at(-1) : line[0];
        const meet = at(tip).filter((o) => !used.has(o));
        if (at(tip).length !== 2 || meet.length !== 1 || line[0] === line.at(-1)) break;
        const o = meet[0];
        used.add(o);
        if (forward) {
          const refs = o.refs[0] === tip ? o.refs : [...o.refs].reverse();
          line = [...line, ...refs.slice(1)];
        } else {
          const refs = o.refs.at(-1) === tip ? o.refs : [...o.refs].reverse();
          line = [...refs.slice(0, -1), ...line];
        }
      }
    }
    out.push({ cls: w.cls, refs: line });
  }
  return out;
}

const inMap = ([x, z]) => x >= 0 && x <= SIZE && z >= 0 && z <= SIZE;

/** A line cut where it leaves the map: every stretch that stays on it. */
function pieces(pts) {
  const out = [];
  let cur = [];
  for (const p of pts) {
    if (inMap(p)) cur.push(p);
    else {
      if (cur.length > 1) out.push(cur);
      cur = [];
    }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

const lengthOf = (pts) =>
  pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

/** How far a point is from a line, m. */
function toLine(pts, x, z) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1];
    const [bx, bz] = pts[i];
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z));
  }
  return best;
}

/** The town's middle: where the most street (a main road twice over) lies
 * within `REACH` of it, searched on a 50 m grid. */
function middleOf(streets) {
  const STEP = 50;
  const n = SIZE / STEP;
  const mass = new Float64Array((n + 1) * (n + 1));
  for (const s of streets) {
    const w = s.cls === 0 ? 2 : 1;
    for (let i = 1; i < s.points.length; i++) {
      const [ax, az] = s.points[i - 1];
      const [bx, bz] = s.points[i];
      const l = Math.hypot(bx - ax, bz - az);
      const k = Math.max(1, Math.ceil(l / 10));
      for (let j = 0; j < k; j++) {
        const t = (j + 0.5) / k;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        mass[Math.round(z / STEP) * (n + 1) + Math.round(x / STEP)] += (w * l) / k;
      }
    }
  }
  const r = Math.round(REACH / STEP);
  let best = { x: SIZE / 2, z: SIZE / 2, m: -1 };
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      let m = 0;
      for (let a = Math.max(0, i - r); a <= Math.min(n, i + r); a++) {
        for (let b = Math.max(0, j - r); b <= Math.min(n, j + r); b++) {
          if ((a - i) ** 2 + (b - j) ** 2 <= r * r) m += mass[a * (n + 1) + b];
        }
      }
      if (m > best.m) best = { x: j * STEP, z: i * STEP, m };
    }
  }
  return best;
}

/**
 * A face's TOWN off its map data: `{ town, streets }` — the town's middle
 * and radius (m) and its streets, each `{ cls, points }` on the map, the
 * best first — or `{ town: null, streets: [] }` where the face has none.
 * `thin(points, tol)` thins a line to its bends; `sizeOf(streets)` is how
 * many bytes those streets take as baked.
 */
/** A line thinned to its bends — a RING (a loop or a roundabout, its ends
 * on one point) halved at the point farthest from its ends first, since a
 * line thinned between two ends on one point keeps nothing but them. */
function thinRing(pts, thin) {
  const [a, z] = [pts[0], pts.at(-1)];
  if (Math.hypot(a[0] - z[0], a[1] - z[1]) > STRAY) return thin(pts, STRAY);
  let far = 0;
  pts.forEach((p, i) => {
    if (Math.hypot(p[0] - a[0], p[1] - a[1]) > Math.hypot(pts[far][0] - a[0], pts[far][1] - a[1]))
      far = i;
  });
  if (far === 0) return [a, a];
  return [...thin(pts.slice(0, far + 1), STRAY), ...thin(pts.slice(far), STRAY).slice(1)];
}

export function townOf(face, data, thin, sizeOf) {
  const { nodes, ways } = data;
  const roads = [];
  for (const w of ways.values()) {
    const cls = classOf(w.tags);
    if (cls === undefined || w.tags.area === "yes" || w.refs.length < 2) continue;
    roads.push({ cls, refs: w.refs });
  }
  const streets = [];
  for (const cls of [0, 1]) {
    for (const s of chained(roads.filter((r) => r.cls === cls))) {
      const pts = s.refs
        .map((r) => nodes.get(r))
        .filter(Boolean)
        .map((g) => mapAt(face, ...g));
      for (const piece of pieces(pts)) {
        if (lengthOf(piece) < SHORTEST) continue;
        streets.push({ cls, points: thinRing(piece, thin), length: lengthOf(piece) });
      }
    }
  }
  if (streets.length === 0) return { town: null, streets: [] };
  const mid = middleOf(streets);
  const near = (s) => toLine(s.points, mid.x, mid.z);
  const ranked = streets
    .map((s) => ({ s, score: ((s.cls === 0 ? 3 : 1) * s.length) / (1 + (near(s) / 400) ** 2) }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.s);
  const kept = [];
  for (const s of ranked) {
    if (kept.length >= MOST) break;
    if (sizeOf([...kept, s]) > BUDGET) continue;
    kept.push(s);
  }
  // The town's radius: the circle round its middle that holds `HOLD` of
  // the kept streets' length, read at their bends.
  const dists = [];
  for (const s of kept) {
    for (let i = 1; i < s.points.length; i++) {
      const [ax, az] = s.points[i - 1];
      const [bx, bz] = s.points[i];
      const l = Math.hypot(bx - ax, bz - az);
      dists.push({ d: Math.hypot((ax + bx) / 2 - mid.x, (az + bz) / 2 - mid.z), l });
    }
  }
  dists.sort((a, b) => a.d - b.d);
  const total = dists.reduce((s, d) => s + d.l, 0);
  let held = 0;
  let radius = 0;
  for (const d of dists) {
    held += d.l;
    radius = d.d;
    if (held >= total * HOLD) break;
  }
  return { town: { x: mid.x, z: mid.z, r: radius }, streets: kept };
}
