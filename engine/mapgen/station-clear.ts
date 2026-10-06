// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R26 — THE STATIONS BESIDE THE RUNS. A lift's station is built beside the
// pistes, never on one: its house, its wheel, its load line and the corral
// that brings a skier to it stand on their own ground at the edge of the
// groomed snow, and a T-bar's track — ridden on the snow — never crosses a
// piste at all (`docs/summit-stations.md`).
//
// The stations are placed before the runs are walked (`resort.ts`), the
// drag lifts while access is cured (`drags.ts`), and the runs come down
// where the mountain sends them — so once every run stands, each BOTTOM
// station's FOOTPRINT (`lift.footprint`: a rectangle `back` metres behind
// its wheel, `ahead` in front of it, `half` either side of the line) is
// read against every run's surface, and a drag's whole line against every
// piste, and a station on one is SLID across its line, the nearest way
// first, to where it stands clear — on ground level enough to build on, a
// link lane still reaching it, still on the valley floor if it was. A
// drag's top may slide too, a little. A lift that fits nowhere is named,
// and the attempt refused (the analyzer holds the same rule).
//
// Pure over the runs and the ground; draws nothing from the stream.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import type { LiftPlan } from "./resort.ts";
import type { Lift } from "./types.ts";

type Point = { x: number; z: number };

/** What the stations are read against: whether a point stands on some
 * run's surface (`pad` m past its half-width) and on a piste's, the
 * ground's height, whether a point is on the valley floor, and where the
 * link lanes to a lift's bottom station end. */
export type StationGround = {
  onRun(x: number, z: number, pad: number): boolean;
  onPiste(x: number, z: number, pad: number): boolean;
  height(x: number, z: number): number;
  floor(p: Point): boolean;
  linkEnds(id: string): readonly Point[];
};

/** The slides tried across a chair's or a gondola's line at its bottom
 * station, m, nearest first. */
const SLIDES = [0, 6, -6, 12, -12, 18, -18, 26, -26, 34, -34, 44, -44, 56, -56, 70, -70, 86, -86];
/** A DRAG RE-LAID once its runs stand: its top moved this far round where
 * it was, m, on as many bearings (access holds it to the starts it
 * serves), and its foot slid this far either way across, m, every `step`. */
const DRAG_TOP = { reach: [0, 15, 30, 45, 60, 75, 95, 120, 150], bearings: 12 };
const DRAG_FOOT = { reach: 180, step: 10, up: [0, 0.25, 0.45, 0.6, 0.72] };

/** The step a footprint and a drag's line are read at, m; how far off a
 * run's surface a station keeps, m; the most the ground may fall across a
 * bottom station's footprint, m per m; how near a link lane's end its
 * lift's bottom station stays, m. */
const READ = 3;
const MARGIN = 2;
const LEVEL = 0.22;
const LINK = 18;
/** The least a drag climbs, m, and how far inside its steepest pull a
 * drag re-laid keeps (`drags.ts`'s own margin). */
const RISE = 30;
const PITCH_MARGIN = 0.9;

/** A station's footprint as points to read, its wheel at `at`, the line
 * running `dir` (unit, up the line from a bottom station, down it from a
 * top). */
function footprint(kind: LiftPlan["kind"], at: Point, dir: Point): Point[] {
  const F = RR.lift.footprint[kind];
  const out: Point[] = [];
  for (let u = -F.back; u <= F.ahead + 1e-6; u += READ) {
    for (let v = -F.half; v <= F.half + 1e-6; v += READ) {
      out.push({ x: at.x + dir.x * u + dir.z * v, z: at.z + dir.z * u - dir.x * v });
    }
  }
  return out;
}

/** Whether a bottom station at `bottom` on a line to `top` stands clear of
 * the runs, on its own level ground. */
function clearBottom(g: StationGround, kind: LiftPlan["kind"], bottom: Point, top: Point): boolean {
  // Its level first — reads of the ground, where the runs are a search.
  if (!standsLevel(g.height, kind, bottom, top)) return false;
  return bottomFootprint(kind, bottom, top).every((p) => !g.onRun(p.x, p.z, MARGIN));
}

/** A bottom station's footprint at `bottom` on a line to `top`, as points. */
export function bottomFootprint(kind: LiftPlan["kind"], bottom: Point, top: Point): Point[] {
  const len = hypot(top.x - bottom.x, top.z - bottom.z) || 1;
  return footprint(kind, bottom, { x: (top.x - bottom.x) / len, z: (top.z - bottom.z) / len });
}

/** Whether a bottom station at `bottom` on a line to `top` stands on
 * ground level enough to build on. */
export function standsLevel(
  height: (x: number, z: number) => number,
  kind: LiftPlan["kind"],
  bottom: Point,
  top: Point,
): boolean {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of bottomFootprint(kind, bottom, top)) {
    const y = height(p.x, p.z);
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  const F = RR.lift.footprint[kind];
  return (hi - lo) / Math.max(F.back + F.ahead, 2 * F.half) <= LEVEL;
}

/** Whether a drag's line crosses no piste, climbs, keeps to a drag's
 * length and pull where it is `banded` (R26), and its top's footprint
 * stands clear of every run. */
function clearDrag(g: StationGround, bottom: Point, top: Point, banded: boolean): boolean {
  const D = RR.lift.drag;
  const len = hypot(top.x - bottom.x, top.z - bottom.z) || 1;
  if (banded && (len < D.length.min || len > D.length.max)) return false;
  // Never steeper than a rope pulls a skier on his skis (R26) — asked
  // first, being a few reads of the ground where the pistes are a search.
  const at = (u: number): number =>
    g.height(bottom.x + ((top.x - bottom.x) * u) / len, bottom.z + ((top.z - bottom.z) * u) / len);
  if (at(len) - at(0) < RISE) return false;
  for (let u = 0; banded && u + D.pitchWindow <= len; u += READ) {
    if ((at(u + D.pitchWindow) - at(u)) / D.pitchWindow > D.pitch * PITCH_MARGIN) return false;
  }
  for (let u = 0; u <= len; u += READ) {
    const t = u / len;
    if (g.onPiste(bottom.x + (top.x - bottom.x) * t, bottom.z + (top.z - bottom.z) * t, MARGIN))
      return false;
  }
  const down = { x: (bottom.x - top.x) / len, z: (bottom.z - top.z) / len };
  return footprint("drag", top, down).every((p) => !g.onRun(p.x, p.z, MARGIN));
}

/** Where a lift's ends may go, the nearest first: a chair's or a
 * gondola's bottom station slid across its line; a drag re-laid, its top
 * round where it was and its foot along the floor or up its line. */
function candidates(l: LiftPlan): { bottom: Point; top: Point; cost: number }[] {
  const len = hypot(l.top.x - l.bottom.x, l.top.z - l.bottom.z) || 1;
  const right = { x: (l.top.z - l.bottom.z) / len, z: -(l.top.x - l.bottom.x) / len };
  const out: { bottom: Point; top: Point; cost: number }[] = [];
  if (l.kind !== "drag") {
    for (const sb of SLIDES)
      out.push({
        bottom: { x: l.bottom.x + right.x * sb, z: l.bottom.z + right.z * sb },
        top: l.top,
        cost: Math.abs(sb),
      });
    return out;
  }
  for (const r of DRAG_TOP.reach) {
    for (let k = 0; k < (r === 0 ? 1 : DRAG_TOP.bearings); k++) {
      const a = (k / DRAG_TOP.bearings) * Math.PI * 2;
      const top = { x: l.top.x + Math.sin(a) * r, z: l.top.z + Math.cos(a) * r };
      for (const up of DRAG_FOOT.up) {
        // Its foot up its line, a shorter drag beside the run it serves.
        const fx = l.bottom.x + (l.top.x - l.bottom.x) * up;
        const fz = l.bottom.z + (l.top.z - l.bottom.z) * up;
        for (let sb = -DRAG_FOOT.reach; sb <= DRAG_FOOT.reach; sb += DRAG_FOOT.step) {
          const bottom = { x: fx + right.x * sb, z: fz + right.z * sb };
          out.push({ bottom, top, cost: Math.abs(sb) + 2 * r + up * len });
        }
      }
    }
  }
  return out.sort((a, b) => a.cost - b.cost);
}

/** R26 — every lift's bottom station (and a drag, re-laid) stood clear of
 * the runs where it stands on one, each the nearest way that leaves every
 * piste reached (`ok`). The lift that fits nowhere, or null. Moves the
 * lifts in place. */
export function clearStations(
  g: StationGround,
  lifts: LiftPlan[],
  ok: (lifts: readonly LiftPlan[]) => boolean,
): string | null {
  for (const l of lifts) {
    const ends = g.linkEnds(l.id);
    const wasFloor = g.floor(l.bottom);
    const was = { bottom: l.bottom, top: l.top };
    const fits = (c: { bottom: Point; top: Point }): boolean =>
      (l.kind === "drag" || g.floor(c.bottom) === wasFloor) &&
      ends.every(
        (e) =>
          hypot(e.x - c.bottom.x, e.z - c.bottom.z) <=
          Math.max(LINK, hypot(e.x - was.bottom.x, e.z - was.bottom.z)),
      ) &&
      clearBottom(g, l.kind, c.bottom, c.top) &&
      // The nursery's drag (D1) is laid by the plan, not to R29's bands.
      (l.kind !== "drag" || clearDrag(g, c.bottom, c.top, l.id !== "D1"));
    if (fits(was)) continue;
    let placed = false;
    for (const c of candidates(l)) {
      if (!fits(c)) continue;
      l.bottom = c.bottom;
      l.top = c.top;
      if (ok(lifts)) {
        placed = true;
        break;
      }
    }
    if (!placed) {
      l.bottom = was.bottom;
      l.top = was.top;
      return l.id;
    }
  }
  return null;
}

/** Plan distance from a point to a lift's line, m. */
export function nearLine(l: Lift, x: number, z: number): number {
  const dx = l.top.x - l.bottom.x;
  const dz = l.top.z - l.bottom.z;
  const len2 = dx * dx + dz * dz || 1;
  let t = ((x - l.bottom.x) * dx + (z - l.bottom.z) * dz) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return hypot(x - (l.bottom.x + dx * t), z - (l.bottom.z + dz * t));
}
