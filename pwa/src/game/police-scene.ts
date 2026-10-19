// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A FATAL ACCIDENT'S SCENE, LAID OUT — the geometry the police work to
// (`police-plan.ts` times it): the EVIDENCE read off the run that ended
// dead (where he struck, the blood a smash left on a solid, the pieces torn
// off him where they came down, the skis that went on without him, the
// body), numbered from the impact down to the body; the CORDON round all
// of it with room to spare, as stakes on a ring; and the WAYS walked about
// it, kept off the body and off the machine. Three-free and DOM-free, so
// the suite reads it. The research is `docs/police.md`.

import { RAGDOLL, type Evidence, type GameState, type Level } from "@engine";

import { smoothPath } from "./rescue-flight.ts";
import { POLICE, type P2, type Path } from "./police-defs.ts";

const E = POLICE.evidence;
const C = POLICE.cordon;
/** Gravity for a torn piece's flight to the snow, m/s². */
const G = 9.81;

const hy = (x: number, z: number): number => Math.hypot(x, z);

/** Where a torn piece flown off at (x, y, z) with (vx, vy, vz) comes down
 * on the snow: a stone's flight, no drag, stepped to the ground. */
function landing(
  level: Level,
  p: { x: number; y: number; z: number; vx: number; vy: number; vz: number },
): P2 {
  let { x, y, z, vy } = p;
  const dt = 0.02;
  for (let t = 0; t < 8; t += dt) {
    vy -= G * dt;
    x += p.vx * dt;
    y += vy * dt;
    z += p.vz * dt;
    if (y <= level.groundAt(x, z)) break;
  }
  return { x, z };
}

/** THE EVIDENCE OF A RUN THAT ENDED DEAD, numbered in order: the impact
 * (`impact`, the run's last wipeout, where it was seen — left out when he
 * lies on it), every smear of him on a solid, every piece torn off where
 * it came down (a crushed one where it was crushed), every ski let go, and
 * the body last at `body`. Items nearer each other than `merge` are one;
 * nearer him than `near`, set off him; further than `far`, left out. */
export function evidenceOf(state: GameState, body: P2, impact: P2 | null): Evidence[] {
  const level = state.level;
  const g = state.gore;
  const items: Evidence[] = [];
  if (impact && hy(impact.x - body.x, impact.z - body.z) > E.near)
    items.push({ what: "impact", x: impact.x, z: impact.z });
  for (const s of g?.smears ?? []) {
    items.push({ what: "blood", x: s.x + s.nx * 0.35, z: s.z + s.nz * 0.35 });
  }
  for (const p of g?.torn ?? []) {
    const at = p.pulped ? { x: p.x, z: p.z } : landing(level, p);
    items.push({ what: "piece", ...at });
  }
  const off = state.skier.thrown;
  for (const ski of [...(off?.skis ?? []), ...(off?.halves ?? [])]) {
    const e = ski.ends;
    if (ski.held > 0) continue;
    items.push({ what: "ski", x: (e[0] + e[3]) / 2, z: (e[2] + e[5]) / 2 });
  }
  // Off him and apart, near enough to be his.
  const kept: Evidence[] = [];
  for (const it of items) {
    const dx = it.x - body.x;
    const dz = it.z - body.z;
    const d = hy(dx, dz);
    if (d > E.far) continue;
    const at =
      d < E.near
        ? d > 1e-3
          ? { x: body.x + (dx / d) * E.near, z: body.z + (dz / d) * E.near }
          : { x: body.x + E.near, z: body.z }
        : it;
    if (kept.some((k) => hy(k.x - at.x, k.z - at.z) < E.merge)) continue;
    kept.push({ what: it.what, x: at.x, z: at.z });
  }
  // From the impact down to him: along the way from the first to him.
  const from = kept.find((k) => k.what === "impact") ?? kept[0] ?? body;
  const ax = body.x - from.x;
  const az = body.z - from.z;
  const along = (p: P2): number => (p.x - from.x) * ax + (p.z - from.z) * az;
  const rest = kept
    .filter((k) => k.what !== "impact")
    .sort((a, b) => along(a) - along(b))
    .slice(0, E.most - 2);
  const impactItem = kept.find((k) => k.what === "impact");
  return [...(impactItem ? [impactItem] : []), ...rest, { what: "body", x: body.x, z: body.z }];
}

/** Where he lay as a run ended (his hips), else where he was. */
export function lyingAt(s: GameState): P2 {
  const P = s.skier.thrown?.points;
  if (!P) return { x: s.skier.x, z: s.skier.z };
  const a = 3 * RAGDOLL.hipL;
  const b = 3 * RAGDOLL.hipR;
  return { x: (P[a] + P[b]) / 2, z: (P[a + 2] + P[b + 2]) / 2 };
}

/** The convex hull of `pts`, counter-clockwise seen from above with x to
 * the right and z up the page (Andrew's monotone chain). */
export function hullOf(pts: readonly P2[]): P2[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.z - b.z);
  if (p.length < 3) return p;
  const cross = (o: P2, a: P2, b: P2): number =>
    (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lower: P2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0)
      lower.pop();
    lower.push(q);
  }
  const upper: P2[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0)
      upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** THE CORDON'S RING: the hull of an octagon `margin` m round every item
 * (the body's taking in his length), its corners closer than `gapLeast`
 * made one stake and its spans longer than `gapMost` given stakes between. */
export function ringOf(evidence: readonly Evidence[]): P2[] {
  const pts: P2[] = [];
  for (const e of evidence) {
    // An octagon round each, over by what its chords cut off the circle.
    const r = (C.margin + (e.what === "body" ? POLICE.body.half : 0)) / Math.cos(Math.PI / 8);
    for (let k = 0; k < 8; k++) {
      const a = ((k + 0.5) / 8) * Math.PI * 2;
      pts.push({ x: e.x + Math.sin(a) * r, z: e.z + Math.cos(a) * r });
    }
  }
  const hull = hullOf(pts);
  // Corners closer than the least gap: one stake, the first kept.
  const corners: P2[] = [];
  for (const p of hull) {
    const last = corners[corners.length - 1];
    if (last && hy(p.x - last.x, p.z - last.z) < C.gapLeast) continue;
    corners.push(p);
  }
  while (
    corners.length > 3 &&
    hy(corners[0].x - corners[corners.length - 1].x, corners[0].z - corners[corners.length - 1].z) <
      C.gapLeast
  )
    corners.pop();
  // Long spans: stakes between, evenly.
  const ring: P2[] = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const n = Math.ceil(hy(b.x - a.x, b.z - a.z) / C.gapMost);
    for (let k = 0; k < n; k++)
      ring.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  }
  return ring;
}

/** A line the scene's walkers keep off: a capsule from `a` to `b`, `r` m
 * round it. */
export type Keep = { a: P2; b: P2; r: number };

/** How far (x, z) is from the segment a–b. */
export function toSeg(p: P2, a: P2, b: P2): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz || 1;
  const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
  return hy(p.x - a.x - dx * u, p.z - a.z - dz * u);
}

/** How near two segments come (sampled along the first). */
function segGap(a: P2, b: P2, c: P2, d: P2): { gap: number; at: P2 } {
  const n = Math.max(2, Math.ceil(hy(b.x - a.x, b.z - a.z) / 0.25));
  let best = { gap: Infinity, at: a };
  for (let i = 0; i <= n; i++) {
    const p = { x: a.x + ((b.x - a.x) * i) / n, z: a.z + ((b.z - a.z) * i) / n };
    const g = toSeg(p, c, d);
    if (g < best.gap) best = { gap: g, at: p };
  }
  return best;
}

/** Whether a point is clear of every keep. */
export function clearOf(p: P2, keeps: readonly Keep[], slack = 0): boolean {
  return keeps.every((k) => toSeg(p, k.a, k.b) >= k.r - slack);
}

/** A point pushed out of every keep it is inside, to `r` and a little. */
export function outOf(p: P2, keeps: readonly Keep[]): P2 {
  let q = p;
  for (let it = 0; it < 4; it++) {
    for (const k of keeps) {
      const d = toSeg(q, k.a, k.b);
      if (d >= k.r + 0.05) continue;
      const dx = k.b.x - k.a.x;
      const dz = k.b.z - k.a.z;
      const l2 = dx * dx + dz * dz || 1;
      const u = Math.max(0, Math.min(1, ((q.x - k.a.x) * dx + (q.z - k.a.z) * dz) / l2));
      const c = { x: k.a.x + dx * u, z: k.a.z + dz * u };
      let nx = q.x - c.x;
      let nz = q.z - c.z;
      const n = hy(nx, nz);
      if (n < 1e-6) {
        nx = -dz;
        nz = dx;
      }
      const m = hy(nx, nz) || 1;
      q = { x: c.x + (nx / m) * (k.r + 0.1), z: c.z + (nz / m) * (k.r + 0.1) };
    }
  }
  return q;
}

/** THE WAY FROM `a` TO `b` kept off every keep: straight where it can be,
 * else round each keep it would cross by a point out to its side (the
 * nearer side), and again until it is clear — smoothed a little so no
 * corner is sharper than a walker turns. */
export function route(a: P2, b: P2, keeps: readonly Keep[]): Path {
  const pts: P2[] = [a, b];
  const pad = 0.9;
  for (let pass = 0; pass < 24; pass++) {
    let fixed = false;
    for (let i = 0; i + 1 < pts.length && !fixed; i++) {
      const p = pts[i];
      const q = pts[i + 1];
      for (const k of keeps) {
        const { gap, at } = segGap(p, q, k.a, k.b);
        if (gap >= k.r) continue;
        // Round it: out from its line through the nearest point, square
        // to the way walked, past both its ends where it is long.
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        const l = hy(dx, dz) || 1;
        let nx = -dz / l;
        let nz = dx / l;
        const mid = { x: (k.a.x + k.b.x) / 2, z: (k.a.z + k.b.z) / 2 };
        if ((at.x - mid.x) * nx + (at.z - mid.z) * nz < 0) {
          nx = -nx;
          nz = -nz;
        }
        const len = hy(k.b.x - k.a.x, k.b.z - k.a.z);
        const along = { x: dx / l, z: dz / l };
        const reach = k.r + pad;
        // Each end of the keep, carried out to the chosen side.
        const ends = [k.a, k.b]
          .map((e) => ({ x: e.x + nx * reach, z: e.z + nz * reach }))
          .sort(
            (u, v) =>
              (u.x - p.x) * along.x +
              (u.z - p.z) * along.z -
              ((v.x - p.x) * along.x + (v.z - p.z) * along.z),
          );
        const extra = len < 0.5 ? [{ x: mid.x + nx * reach, z: mid.z + nz * reach }] : ends;
        // Pushed clear of the other keeps too.
        pts.splice(i + 1, 0, ...extra.map((e) => outOf(e, keeps)));
        fixed = true;
        break;
      }
    }
    if (!fixed) break;
  }
  return smoothPath(pts, 0.5);
}

/** Where along a path a walker is at arc `d`, and the way he faces. */
export function onPath(path: Path, d: number): { x: number; z: number; heading: number } {
  const { pts, s, length } = path;
  if (pts.length < 2) return { x: pts[0].x, z: pts[0].z, heading: 0 };
  const at = Math.max(0, Math.min(length, d));
  let i = 0;
  while (i < s.length - 2 && s[i + 1] < at) i++;
  const span = s[i + 1] - s[i] || 1;
  const u = (at - s[i]) / span;
  const a = pts[i];
  const b = pts[i + 1];
  return {
    x: a.x + (b.x - a.x) * u,
    z: a.z + (b.z - a.z) * u,
    heading: Math.atan2(b.x - a.x, b.z - a.z),
  };
}

/** The heading from `a` to `b`. */
export const headingTo = (a: P2, b: P2): number => Math.atan2(b.x - a.x, b.z - a.z);
