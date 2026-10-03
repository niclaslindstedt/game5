// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R26, R29 — A DRAG LIFT LAID TO A PISTE'S FOOT: the T-bar or the platter a
// ski area puts where a run comes down with no way back up — from beside
// the run's foot (its finish, the stretch it merges in, or a little way up
// its lower part), up the slope beside it, to the station or the lane its
// skier wants.
//
// A surface lift pulls a skier up on his skis, so it is short (a few
// hundred metres to a kilometre and a bit) and never steep (the rope is let
// climb about forty per cent), and its track is a groomed lane of its own:
// it crosses no piste (on a version from before the stations stood beside
// the runs, one square), and never runs up one. Its top stands beside
// the station or the lane it serves, on ground level enough to step off
// onto, so a skier off it is where that station's runs start.

import { angleDiff, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { reckonAccess, type PlanLift, type PlanRun } from "./access-build.ts";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import { withinBand } from "./rules.ts";
import type { LiftPlan } from "./resort.ts";

type Point = { x: number; z: number };

/** What a drag lift's line is read against: the mountain's height, the
 * nearest piste to a point (its distance from the line, width and heading;
 * Infinity where none is near), and whether a bottom station stands in the
 * hub. */
export type DragGround = {
  height(x: number, z: number): number;
  piste(x: number, z: number): { distance: number; width: number; heading: number };
  floor(p: Point): boolean;
  /** Whether a drag's line may cross a piste square — a version from
   * before the stations stood beside the runs (`rawStations`); left out,
   * it crosses none. */
  crossing?: boolean;
};

/** A foot a drag lift may leave: a station on a run. */
export type Foot = { x: number; z: number; heading: number; width: number };

/** The step a drag lift's line is read along, m; how far from either end
 * it is read for the runs it would run up (its bottom stands beside the
 * foot, its top beside a station the runs leave), m. */
const READ = 5;
const ENDS = 40;
/** The least a drag lift climbs, m (R26's lifts all climb), and how far
 * inside its steepest it is laid on the mountain, which the runs pressed
 * into it move a little. */
const RISE = 30;
const PITCH_MARGIN = 0.9;
/** How far up a run from its foot the next foot is tried, m, and how many;
 * how many targets each is tried toward; how far apart along a lane its
 * points are offered as targets, m. */
const FOOT_STEP = 180;
const FEET = 5;
const TARGETS = 4;
const LANE_STEP = 120;

/** How far out from the foot's run the bottom station is tried, as
 * multiples of its first place off the run's edge; and how far either way
 * of square across the line beside the station its top is tried, m — a
 * drag laid up beside the piste it serves keeps off it, and its top stays
 * a skate from the station. */
const OUT = [1, 1.8, 2.8, 4];
const ASIDE = [0, 30, -30, 55, -55];

/** R26 — a drag lift `id` from beside `foot` up to beside `station`, the
 * first place either side of the foot, and either side of the station, it
 * fits; null where it fits nowhere. */
export function planDrag(g: DragGround, foot: Foot, station: Point, id: string): LiftPlan | null {
  const D = RR.lift.drag;
  for (const out of OUT) {
    for (const sgn of [1, -1]) {
      // Beside the foot, off the run's edge.
      const off = (foot.width / 2 + D.room + 6) * out * sgn;
      const bottom = {
        x: foot.x + Math.cos(foot.heading) * off,
        z: foot.z - Math.sin(foot.heading) * off,
      };
      for (const aside of ASIDE) {
        const dx = station.x - bottom.x;
        const dz = station.z - bottom.z;
        const d = hypot(dx, dz);
        // Short of the station along the line, and aside of it across.
        const top = {
          x: station.x - (dx / d) * D.beside + (dz / d) * aside,
          z: station.z - (dz / d) * D.beside - (dx / d) * aside,
        };
        const reach = hypot(top.x - bottom.x, top.z - bottom.z);
        if (!withinBand(reach, D.length)) continue;
        if (fits(g, bottom, top)) return { id, kind: "drag", bottom, top };
      }
    }
  }
  return null;
}

/** Whether a drag lift's line from `a` up to `b` climbs, never steeper
 * than a surface lift pulls, runs up no piste, and tops out on the level. */
function fits(g: DragGround, a: Point, b: Point): boolean {
  const D = RR.lift.drag;
  const length = hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(2, Math.ceil(length / READ));
  const heading = Math.atan2(b.x - a.x, b.z - a.z);
  const ys: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    ys.push(g.height(x, z));
    const u = t * length;
    if (u < ENDS || u > length - ENDS) continue;
    const p = g.piste(x, z);
    if (p.distance > p.width / 2 + D.room) continue;
    // A T-bar's track is ridden on the snow: it crosses no piste (R26).
    if (!g.crossing) return false;
    // Up a run, either way along it, is never a drag's track.
    const along = Math.abs(angleDiff(heading, p.heading));
    if (Math.min(along, Math.PI - along) < Math.PI / 2 - D.square) return false;
  }
  if (ys[n] - ys[0] < RISE) return false;
  const k = Math.max(1, Math.round(D.pitchWindow / (length / n)));
  for (let i = 0; i + k <= n; i++) {
    if ((ys[i + k] - ys[i]) / (k * (length / n)) > D.pitch * PITCH_MARGIN) return false;
  }
  return padGrade(g, b) <= D.padGrade;
}

/** The most the ground falls across a top station's pad, m per m. */
export function padGrade(g: { height(x: number, z: number): number }, p: Point): number {
  const h = RR.lift.pad / 2;
  return (
    Math.max(
      Math.abs(g.height(p.x + h, p.z) - g.height(p.x - h, p.z)),
      Math.abs(g.height(p.x, p.z + h) - g.height(p.x, p.z - h)),
    ) /
    (2 * h)
  );
}

/** The lifts as the reckoning reads them. */
export function planLifts(g: DragGround, lifts: readonly LiftPlan[]): PlanLift[] {
  return lifts.map((l) => ({ id: l.id, bottom: l.bottom, top: l.top, floor: g.floor(l.bottom) }));
}

/** R26, R29 — A DRAG LIFT TO BRING PISTE `i` BACK: from beside a foot —
 * `back`: of the runs no harder than it a skier on it goes down, for a
 * piste that cannot be skied again; `home`: of its own, where it merges,
 * for one whose skier would ski too far on below it (`access.runout`) —
 * its end or a little way up, to beside its own top, another station up
 * the mountain, or a point of a lane, nearest first; kept (pushed onto
 * `lifts`) only where the reckoning's verdict on the piste turns. The
 * drag kept, or null. */
export function dragBack(
  g: DragGround,
  runs: readonly PlanRun[],
  lifts: LiftPlan[],
  i: number,
  why: "back" | "home" = "back",
): LiftPlan | null {
  const p = runs[i];
  // The runs a skier on it goes on down, no harder than it.
  let foot = p;
  for (
    let k = 0;
    why === "back" && foot.into && runs[foot.into.run].rank <= p.rank && k < runs.length;
    k++
  ) {
    foot = runs[foot.into.run];
  }
  const own = lifts.find((l) => l.id === p.from);
  const id = `D${lifts.filter((l) => l.kind === "drag").length + 1}`;
  for (let f = 0; f < FEET; f++) {
    // Off a run that cannot be skied on, a little up from where it begins
    // closing on the harder one; off one that ends, or one that has joined
    // the run it merges into, its end — and on up it.
    const at =
      (why === "back" && foot.into ? foot.mergeStart - 20 : foot.length - 20) - f * FOOT_STEP;
    if (at < FOOT_STEP / 2 || (why === "home" && at < foot.mergeStart - FOOT_STEP)) break;
    const q = pointAt(foot.points, at);
    const base = { x: q.x, z: q.z, heading: q.heading, width: q.width };
    const targets: (Point & { first: boolean })[] = [];
    for (const l of lifts) {
      if (l === own) targets.push({ ...l.top, first: true });
      else if (l.kind !== "drag") targets.push({ ...l.top, first: false });
      if (!g.floor(l.bottom) && l.kind !== "drag") targets.push({ ...l.bottom, first: false });
    }
    runs.forEach((r, k) => {
      if (r.kind !== "road" || k === i) return;
      for (let s = LANE_STEP; s < r.length - LANE_STEP / 2; s += LANE_STEP) {
        const t = pointAt(r.points, s);
        targets.push({ x: t.x, z: t.z, first: false });
      }
    });
    const D = RR.lift.drag;
    const ranked = targets
      .filter((t) => t.z < base.z - 60)
      .map((t) => ({ t, d: hypot(t.x - base.x, t.z - base.z) }))
      .filter((c) => c.d >= D.length.min && c.d <= D.length.max + D.beside)
      .sort((a, c) => (a.t.first === c.t.first ? a.d - c.d : a.t.first ? -1 : 1));
    for (const { t } of ranked.slice(0, TARGETS)) {
      const lift = planDrag(g, base, t, id);
      if (!lift) continue;
      lifts.push(lift);
      const v = reckonAccess(runs, planLifts(g, lifts));
      if (v.ok[i] && (why === "back" || v.home[i] <= RR.access.runout)) return lift;
      lifts.pop();
    }
  }
  return null;
}

/** The station of a line nearest an arc. */
function pointAt<P extends { s: number }>(points: readonly P[], s: number): P {
  let best = points[0];
  for (const q of points) if (Math.abs(q.s - s) < Math.abs(best.s - s)) best = q;
  return best;
}

/** R26, R29 — THE DRAG LIFTS SETTLED, once the runs that stand are graded
 * and measured: the drags laid before that no longer fit taken down, a
 * drag lift for every piste that cannot be skied again,
 * then for every one whose skier skis more than `access.runout` on below
 * it where one fits; then every drag nothing needs any more taken down —
 * its piste left out, or brought back by a lane laid after it — but those
 * `pinned` (a lane runs to its bottom), and the rest numbered on from the
 * nursery's D1. Why the area must be refused, and the drags renamed. */
export function settleDrags(
  g: DragGround,
  runs: readonly PlanRun[],
  lifts: LiftPlan[],
  name: (i: number) => string,
  pinned: (id: string) => boolean,
): { refused: string | null; renamed: Map<string, string>; drags: number; home: number } {
  const renamed = new Map<string, string>();
  let drags = 0;
  let home = 0;
  // A drag laid before the runs were graded that no longer fits the
  // pressed mountain comes down first.
  for (let k = lifts.length - 1; k >= 0; k--) {
    const l = lifts[k];
    if (l.kind === "drag" && l.id !== "D1" && !pinned(l.id) && !fits(g, l.bottom, l.top))
      lifts.splice(k, 1);
  }
  const read = (): ReturnType<typeof reckonAccess> => reckonAccess(runs, planLifts(g, lifts));
  let v = read();
  for (let i = 0; i < runs.length; i++) {
    if (!v.ok[i] && dragBack(g, runs, lifts, i)) {
      drags++;
      v = read();
    }
  }
  const stranded = runs.findIndex((_, i) => !v.ok[i]);
  if (stranded >= 0)
    return { refused: `R29: piste ${name(stranded)} — ${v.why[stranded]}`, renamed, drags, home };
  if (v.orphans.length > 0)
    return { refused: `R29: no skier reaches ${v.orphans.join(", ")}`, renamed, drags, home };
  for (let i = 0; i < runs.length; i++) {
    if (v.home[i] > RR.access.runout && dragBack(g, runs, lifts, i, "home")) {
      home++;
      v = read();
    }
  }
  const want = v;
  for (let k = lifts.length - 1; k >= 0; k--) {
    const l = lifts[k];
    if (l.kind !== "drag" || l.id === "D1" || pinned(l.id)) continue;
    lifts.splice(k, 1);
    const without = read();
    const needed =
      without.orphans.length > 0 ||
      runs.some(
        (_, i) =>
          !without.ok[i] ||
          (want.home[i] <= RR.access.runout && without.home[i] > RR.access.runout),
      );
    if (needed) lifts.splice(k, 0, l);
  }
  let n = 1;
  for (const l of lifts) {
    if (l.kind !== "drag" || l.id === "D1") continue;
    renamed.set(l.id, `D${++n}`);
    l.id = `D${n}`;
  }
  return { refused: null, renamed, drags, home };
}
