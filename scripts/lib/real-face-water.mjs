// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL FACES' WATER — the lakes, ponds, reservoirs and rivers a real
// face's map data draws, and the streams too thin to be mapped as an area,
// read onto the face's map for the hints' bake (`scripts/real-hints.mjs`).
//
// AREAS: a closed way or a multipolygon relation tagged `natural=water`
// (whatever its `water=`), `landuse=reservoir` or `waterway=riverbank`,
// each outer ring a body and its inner rings its holes (the islands). Each
// is CLIPPED to the face's 4×4 km window (`clipped` where it was cut),
// thinned to ~4 m and kept on a 2 m grain; its outer ring turned
// counter-clockwise (a positive area in x, z) and its holes clockwise. Its
// REAL LEVEL is the lowest the face's own heights stand along its shore —
// where the water would spill — in real metres. None under `LEAST` m² is
// kept, and no more than `BODIES` a face, the largest first.
//
// LINES: every `waterway=river|stream` way, cut to its pieces inside the
// window and out of every body kept (a river mapped as an area as well is
// the area there), ordered DOWNSTREAM — its first point the uphill one by
// the heights, the map's own direction where they cannot tell — thinned
// and kept as the areas are, with a width (its tag's, or a river's or a
// stream's usual). No more than `STREAMS` a face, the longest first.
//
// Nothing is kept by name.

import { SIZE, mapAt } from "./real-face-crops.mjs";

/** The least area kept, m², the most bodies and streams a face, how far a
 * thinned outline strays, m, the grain it is kept on, m, and the shortest
 * stream piece kept, m. */
export const LEAST = 400;
export const BODIES = 40;
export const STREAMS = 30;
const STRAY = 4;
export const GRAIN = 2;
const SHORTEST = 40;
/** How much higher a stream's last point must stand than its first, m, for
 * the heights to turn it round against the way the map draws it. */
const TURN = 2;

/** The kinds, in the order the bake writes them. */
export const BODY_KINDS = ["lake", "pond", "reservoir", "river"];
export const STREAM_KINDS = ["river", "stream"];

/** Whether a way's or a relation's tags are a body of water. */
const isWater = (t) =>
  t.natural === "water" || t.landuse === "reservoir" || t.waterway === "riverbank";

/** A body's kind off its tags, and its area, m², where the tags leave it open. */
function kindOf(t, area) {
  if (t.waterway === "riverbank" || ["river", "stream", "canal", "stream_pool"].includes(t.water))
    return 3;
  if (t.landuse === "reservoir" || t.water === "reservoir") return 2;
  if (t.water === "lake" || t.water === "oxbow" || t.water === "lagoon") return 0;
  if (t.water === "pond" || t.water === "basin" || t.water === "lock") return 1;
  return area < 20000 ? 1 : 0;
}

/** Twice the signed area of a ring (x, z pairs, not closed), m². */
function signed2(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, z0] = ring[i];
    const [x1, z1] = ring[(i + 1) % ring.length];
    a += x0 * z1 - x1 * z0;
  }
  return a;
}

function inside(ring, x, z) {
  let odd = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) odd = !odd;
  }
  return odd;
}

/** A ring (not closed) clipped to the window (Sutherland–Hodgman, one
 * edge of the square at a time). */
function clipRing(ring) {
  const edges = [(p) => p[0] >= 0, (p) => p[0] <= SIZE, (p) => p[1] >= 0, (p) => p[1] <= SIZE];
  const cut = [
    (a, b) => [0, a[1] + ((b[1] - a[1]) * (0 - a[0])) / (b[0] - a[0])],
    (a, b) => [SIZE, a[1] + ((b[1] - a[1]) * (SIZE - a[0])) / (b[0] - a[0])],
    (a, b) => [a[0] + ((b[0] - a[0]) * (0 - a[1])) / (b[1] - a[1]), 0],
    (a, b) => [a[0] + ((b[0] - a[0]) * (SIZE - a[1])) / (b[1] - a[1]), SIZE],
  ];
  let out = ring;
  for (let e = 0; e < 4 && out.length > 0; e++) {
    const src = out;
    out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[(i + src.length - 1) % src.length];
      const b = src[i];
      const ina = edges[e](a);
      const inb = edges[e](b);
      if (inb) {
        if (!ina) out.push(cut[e](a, b));
        out.push(b);
      } else if (ina) out.push(cut[e](a, b));
    }
  }
  return out;
}

/** A line thinned to the bends that keep it within `tol` (Douglas–Peucker). */
function thin(pts, tol) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts.at(-1)];
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  let worst = 0;
  let at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d =
      len > 1e-9
        ? Math.abs((pts[i][0] - a[0]) * dz - (pts[i][1] - a[1]) * dx) / len
        : Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1]);
    if (d > worst) [worst, at] = [d, i];
  }
  if (worst <= tol) return [a, b];
  return [...thin(pts.slice(0, at + 1), tol).slice(0, -1), ...thin(pts.slice(at), tol)];
}

const onGrain = (p) => [Math.round(p[0] / GRAIN) * GRAIN, Math.round(p[1] / GRAIN) * GRAIN];

/** A point list on the grain with no point repeated after itself. */
function grained(pts) {
  const out = [];
  for (const p of pts.map(onGrain)) {
    const last = out.at(-1);
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}

/** A ring thinned, on the grain and turned to `ccw` — or null where too
 * little of it is left. Halved at its farthest point first, since a line
 * thinned between two ends on one point keeps nothing but them. */
function keptRing(ring, ccw) {
  let far = 0;
  const [a] = ring;
  ring.forEach((p, i) => {
    if (Math.hypot(p[0] - a[0], p[1] - a[1]) > Math.hypot(ring[far][0] - a[0], ring[far][1] - a[1]))
      far = i;
  });
  const closed = [...ring, a];
  const pts = [
    ...thin(closed.slice(0, far + 1), STRAY),
    ...thin(closed.slice(far), STRAY).slice(1),
  ];
  const out = grained(pts.slice(0, -1));
  while (out.length > 1 && out[0][0] === out.at(-1)[0] && out[0][1] === out.at(-1)[1]) out.pop();
  if (out.length < 3 || Math.abs(signed2(out)) < 1e-6) return null;
  return signed2(out) > 0 === ccw ? out : out.reverse();
}

/** Closed rings of node ids joined end to end out of a multipolygon's
 * member ways (each possibly a piece of a ring). */
function joinRings(lines) {
  const open = lines.map((l) => l.slice());
  const rings = [];
  while (open.length > 0) {
    let ring = open.shift();
    while (ring[0] !== ring.at(-1)) {
      const end = ring.at(-1);
      const i = open.findIndex((l) => l[0] === end || l.at(-1) === end);
      if (i < 0) break;
      const [l] = open.splice(i, 1);
      ring = ring.concat((l[0] === end ? l : l.slice().reverse()).slice(1));
    }
    if (ring[0] === ring.at(-1) && ring.length >= 4) rings.push(ring.slice(0, -1));
  }
  return rings;
}

/**
 * A face's water off its map data: `{ bodies, streams, missing }` — each
 * body `{ kind, rings, level, area, clipped }` (`rings[0]` the outer,
 * counter-clockwise; the holes clockwise; x, z pairs on the map; `level`
 * the real metres its shore stands at lowest), each stream `{ kind, line,
 * width }` (x, z pairs, downstream), and how many relations were left out
 * for want of their members. `height(x, z)` reads the face's own heights;
 * `relationFull(id)` and `readXml` are the bake's (`forestPolygons`'s).
 */
export async function waterOf(face, data, height, relationFull, readXml) {
  const at = (nodes, ref) => {
    const g = nodes.get(ref);
    return g ? mapAt(face, ...g) : null;
  };
  /** Each polygon: its tags, its outer rings and its inner rings, on the map. */
  const polys = [];
  const members = new Set();
  let missing = 0;
  for (const [id, r] of data.relations) {
    if (r.tags.type !== "multipolygon" || !isWater(r.tags)) continue;
    for (const m of r.members) members.add(m);
    let src = data;
    if (r.members.some((m) => !data.ways.has(m))) {
      const xml = await relationFull(id);
      src = xml ? readXml(xml, { nodes: new Map(), ways: new Map(), relations: new Map() }) : null;
      if (!src || r.members.some((m) => !src.ways.has(m))) {
        missing++;
        continue;
      }
    }
    const ringsBy = (inner) =>
      joinRings(
        r.members
          .filter((_, i) => (r.roles[i] === "inner") === inner)
          .map((m) => src.ways.get(m).refs),
      ).map((refs) => refs.map((ref) => at(src.nodes, ref)));
    const outer = ringsBy(false);
    const holes = ringsBy(true);
    if ([...outer, ...holes].some((ring) => ring.some((p) => !p))) {
      missing++;
      continue;
    }
    polys.push({ tags: r.tags, outer, holes });
  }
  for (const [id, w] of data.ways) {
    if (!isWater(w.tags) || members.has(id) || w.refs[0] !== w.refs.at(-1) || w.refs.length < 4)
      continue;
    const ring = w.refs.slice(0, -1).map((ref) => at(data.nodes, ref));
    if (ring.some((p) => !p)) continue;
    polys.push({ tags: w.tags, outer: [ring], holes: [] });
  }
  const inWindow = (p) => p[0] > 0 && p[0] < SIZE && p[1] > 0 && p[1] < SIZE;
  let bodies = [];
  for (const poly of polys) {
    for (const ring of poly.outer) {
      const clippedRing = clipRing(ring);
      const outer = clippedRing.length >= 3 ? keptRing(clippedRing, true) : null;
      if (!outer) continue;
      const holes = poly.holes
        .filter((h) => inside(ring, h[0][0], h[0][1]))
        .map((h) => clipRing(h))
        .filter((h) => h.length >= 3)
        .map((h) => keptRing(h, false))
        .filter(Boolean);
      const area = (signed2(outer) - holes.reduce((s, h) => s - signed2(h), 0)) / 2;
      if (area < LEAST) continue;
      // The shore's lowest, off its own points inside the window (the
      // window's edge is no shore), every one of them where it has none.
      const shore = clippedRing.filter(inWindow);
      const level = Math.min(...(shore.length > 0 ? shore : clippedRing).map((p) => height(...p)));
      bodies.push({
        kind: kindOf(poly.tags, area),
        rings: [outer, ...holes],
        level,
        area,
        clipped: ring.some((p) => !inWindow(p)),
      });
    }
  }
  bodies = bodies.sort((a, b) => b.area - a.area).slice(0, BODIES);
  const wet = (p) =>
    bodies.some(
      (b) => inside(b.rings[0], p[0], p[1]) && !b.rings.slice(1).some((h) => inside(h, p[0], p[1])),
    );
  let streams = [];
  for (const w of data.ways.values()) {
    const kind = STREAM_KINDS.indexOf(w.tags.waterway);
    if (kind < 0 || w.refs.length < 2) continue;
    const pts = w.refs.map((ref) => at(data.nodes, ref)).filter(Boolean);
    // Its pieces inside the window and out of every body.
    const pieces = [];
    let cur = [];
    for (const p of pts) {
      if (inWindow(p) && !wet(p)) cur.push(p);
      else {
        if (cur.length > 1) pieces.push(cur);
        cur = [];
      }
    }
    if (cur.length > 1) pieces.push(cur);
    const tagged = Number.parseFloat(w.tags.width);
    const width = Number.isFinite(tagged)
      ? Math.min(kind === 0 ? 30 : 4, Math.max(kind === 0 ? 8 : 2, tagged))
      : kind === 0
        ? 12
        : 3;
    for (let piece of pieces) {
      const length = piece
        .slice(1)
        .reduce((s, p, i) => s + Math.hypot(p[0] - piece[i][0], p[1] - piece[i][1]), 0);
      if (length < SHORTEST) continue;
      if (height(...piece.at(-1)) > height(...piece[0]) + TURN) piece = piece.slice().reverse();
      const line = grained(thin(piece, STRAY));
      if (line.length >= 2) streams.push({ kind, line, width: Math.round(width), length });
    }
  }
  streams = streams.sort((a, b) => b.length - a.length).slice(0, STREAMS);
  return { bodies, streams, missing };
}

/** The water onto a varint writer's `put`, after the town: how many
 * bodies, then each one's kind and whether it was clipped, its real level
 * (whole metres), its rings' count and each ring's points' count and its
 * points, every one told as its step on the grain from the one before;
 * then how many streams, and each one's kind, width (m), points' count and
 * points the same way. */
export function putWater(put, water) {
  const q = (v) => Math.round(v / GRAIN);
  let [px, pz] = [0, 0];
  const putPoints = (pts) => {
    put(pts.length);
    for (const [x, z] of pts) {
      put(q(x) - px);
      put(q(z) - pz);
      [px, pz] = [q(x), q(z)];
    }
  };
  put(water.bodies.length);
  for (const b of water.bodies) {
    put(b.kind * 2 + (b.clipped ? 1 : 0));
    put(Math.round(b.level));
    put(b.rings.length);
    for (const r of b.rings) putPoints(r);
  }
  put(water.streams.length);
  for (const s of water.streams) {
    put(s.kind);
    put(s.width);
    putPoints(s.line);
  }
}
