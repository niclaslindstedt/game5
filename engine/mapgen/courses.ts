// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R28 — THE COURSES: the line a skier follows from a run's top station down
// the network to the village, which is what a map of a resort is raced on.
//
// A course is the run it starts on, then the run that one merges into from
// the arc it joins at, and so on until a run reaches the floor. The runs
// were walked onto each other's lines, so where one joins the next they are
// already running together a stride apart; the course eases across that
// last stride over `course.merge` metres — a lane change down a groomed
// surface both runs share — and is then laid again every two metres from
// the top, like any piste (`TrackPoint`'s even stations are what the piste
// queries count on). Each piece remembers where on the course it lies, so a
// kicker, a drop or a drift a run carries can be named by its arc down the
// course instead.

import { clamp, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import type { WalkedRun } from "./network.ts";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import { setHeadings } from "./track.ts";
import type { TrackPoint } from "./types.ts";

/** One run's stretch of a course: the run (its index in the walk), the
 * arcs on it the course runs between, and the course's arcs there. */
export type Piece = {
  run: number;
  from: number;
  to: number;
  at: number;
  until: number;
};

export type CoursePlan = {
  /** The index of the run it starts on. */
  start: number;
  pieces: Piece[];
  points: TrackPoint[];
  length: number;
};

/** A point of a run `s` metres down it, interpolated. */
function runAt(run: WalkedRun, s: number): { x: number; z: number; width: number } {
  const pts = run.points;
  const n = pts.length;
  const u = clamp(s, 0, run.length) / run.length;
  const f = u * (n - 1);
  const i = Math.min(n - 2, Math.floor(f));
  const t = f - i;
  const a = pts[i];
  const b = pts[i + 1];
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    width: a.width + (b.width - a.width) * t,
  };
}

/** The point of a run nearest (x, z) between arcs `from` and `to`. */
function nearestOn(
  run: WalkedRun,
  x: number,
  z: number,
  from: number,
  to: number,
): { x: number; z: number; width: number } {
  const pts = run.points;
  const n = pts.length;
  const step = run.length / Math.max(1, n - 1);
  const i0 = clamp(Math.floor(from / step), 0, n - 2);
  const i1 = clamp(Math.ceil(to / step), i0 + 1, n - 1);
  let best = Infinity;
  let out = { x: pts[i1].x, z: pts[i1].z, width: pts[i1].width };
  for (let i = i0; i < i1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    const px = a.x + dx * t;
    const pz = a.z + dz * t;
    const d = (px - x) ** 2 + (pz - z) ** 2;
    if (d < best) {
      best = d;
      out = { x: px, z: pz, width: a.width + (b.width - a.width) * t };
    }
  }
  return out;
}

/** R28 — the course down the network from run `start`'s top station. */
export function composeCourse(runs: readonly WalkedRun[], start: number): CoursePlan | string {
  const step = R.track.step;
  const merge = RR.course.merge;
  type Raw = { x: number; z: number; width: number; piece: number };
  const line: Raw[] = [];
  const spans: { run: number; from: number; to: number }[] = [];
  let cur = start;
  let from = 0;
  for (let guard = 0; guard < runs.length + 1; guard++) {
    const run = runs[cur];
    if (!run) return "a course runs into a run that was never laid";
    const piece = spans.length;
    spans.push({ run: cur, from, to: run.length });
    const into = run.into;
    const target = into ? runs[into.run] : null;
    for (let s = from; s <= run.length + 1e-6; s += step) {
      const p = runAt(run, s);
      if (into && target && s > run.length - merge) {
        // Across the junction: onto the other's line — the nearest point of
        // it up to the junction, so a run that came in from the side eases
        // across rather than along — eased.
        const w = smoothstep(run.length - merge, run.length, s);
        const q = nearestOn(target, p.x, p.z, into.s - 2 * merge, into.s);
        p.x += (q.x - p.x) * w;
        p.z += (q.z - p.z) * w;
        p.width += (q.width - p.width) * w;
      }
      line.push({ ...p, piece });
    }
    if (!into) break;
    cur = into.run;
    from = into.s + step;
    if (spans.some((sp) => sp.run === cur)) return "a course loops back onto a run it skied";
  }
  // Laid again every two metres.
  const n0 = line.length;
  const cum = new Float64Array(n0);
  for (let i = 1; i < n0; i++) {
    cum[i] = cum[i - 1] + hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z);
  }
  const total = cum[n0 - 1];
  const count = Math.max(2, Math.round(total / step));
  const spacing = total / count;
  const points: TrackPoint[] = [];
  const pieceAt: number[] = [];
  let j = 0;
  for (let k = 0; k <= count; k++) {
    const s = k * spacing;
    while (j < n0 - 2 && cum[j + 1] < s) j++;
    const t = cum[j + 1] > cum[j] ? (s - cum[j]) / (cum[j + 1] - cum[j]) : 0;
    const a = line[j];
    const b = line[j + 1];
    points.push({
      x: a.x + (b.x - a.x) * t,
      z: a.z + (b.z - a.z) * t,
      y: 0,
      s,
      heading: 0,
      width: a.width + (b.width - a.width) * t,
    });
    pieceAt.push(t < 0.5 ? a.piece : b.piece);
  }
  setHeadings(points);
  // Where on the course each piece lies.
  const pieces: Piece[] = spans.map((sp, k) => {
    let at = Infinity;
    let until = -Infinity;
    for (let i = 0; i < points.length; i++) {
      if (pieceAt[i] !== k) continue;
      at = Math.min(at, points[i].s);
      until = Math.max(until, points[i].s);
    }
    return { ...sp, at, until };
  });
  return { start, pieces, points, length: count * spacing };
}

/** The course's arc at run `run`'s arc `s`, or null where the course does
 * not ski that stretch of that run. */
export function courseArc(course: CoursePlan, run: number, s: number): number | null {
  for (const p of course.pieces) {
    if (p.run !== run || s < p.from - 1e-6 || s > p.to + 1e-6) continue;
    const k = (p.until - p.at) / Math.max(1e-9, p.to - p.from);
    return p.at + (s - p.from) * k;
  }
  return null;
}
