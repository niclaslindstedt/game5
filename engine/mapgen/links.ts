// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R27, R29 — THE LANES BETWEEN THE RUNS: the cat tracks that thread a ski
// area together, laid once every piste and every lane off a top station
// is — and the ones R29 asks for, so every piste can be skied again.
//
// A lane off a top station carries a skier who will not ski a red across to
// another sector (`resort.ts`'s road slots). The rest of a ski area's cat
// tracks link its runs to each other, and its runs to the lifts:
//
//   * A BRANCH LANE leaves a piste part-way down — on its edge, the side the
//     other sector lies — and runs across the face to join a piste off
//     ANOTHER lift, so a skier can cross the mountain between courses. Each
//     two sectors side by side across the face are linked one way, or the
//     other where the ground will not carry a lane the first: the
//     shoulder's blues across to the gondola's runs, or back; the peak's
//     across to the outer sector, or back.
//   * A LINK LANE runs from a piste's lower part to a lift's BOTTOM station
//     where R29 asks for one (`layAccess`): to a station no skier reaches,
//     off a piste whose skier could not otherwise get back to its top
//     without a harder run — where no DRAG LIFT (`drags.ts`) brings him —
//     and home to its own lift's station up the mountain off a piste that
//     would leave him far to ski below it.
//
// Both are found by `lanes.ts`'s search and walked like every other lane
// (`network.ts`): the corridors' gap from every run they do not cross, a
// run crossed square, a lane never met, never steeper than `road.grade`.
// Where a branch lane leaves its piste the two are one groomed surface, as
// where a run merges into another; the grading draws it onto the other's
// surface there (`network-build.ts`).

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { LaneAsk, LaneRoute, RoutePoint } from "./lanes.ts";
import type { RunSpec, WalkedRun } from "./network.ts";
import type { LiftPlan } from "./resort.ts";
import { ROAD_ROW } from "./resort.ts";
import { PISTE_GRADES } from "./grades.ts";
import { reckonAccess, type PlanRun } from "./access-build.ts";
import { dragBack, type DragGround } from "./drags.ts";
import { RESORT_RULES as RR } from "./resort-rules.ts";

/** What the resort's builder lends the links: the runs walked so far, the
 * lane search, and the walk that lays one (true when it stood). */
export type LinkBuilder = DragGround & {
  readonly walked: readonly WalkedRun[];
  /** The lifts, a drag lift laid for R29 added to them. */
  readonly lifts: LiftPlan[];
  route(
    x: number,
    z: number,
    side: number,
    may: (run: number) => boolean,
    ask: LaneAsk,
  ): LaneRoute | null;
  lay(spec: RunSpec, shared: (run: number) => boolean): boolean;
  /** How steeply the untouched mountain falls at a plan point, m per m. */
  fall(x: number, z: number): number;
};

/** How far down a piste a branch lane may leave it, and how far up from its
 * end, m; the arcs it is tried at between, m apart. */
const BRANCH_FROM = 200;
const BRANCH_TO = 300;
const BRANCH_STEP = 60;
/** The least plan distance from a branch point to the join, m. */
const BRANCH_LEAST = 100;
/** How far inside its piste's edge a branch lane starts, m. */
const BRANCH_IN = 12;
/** The branch points tried for each pair of sectors, best first. */
const BRANCH_TRIES = 5;
/** What a steep face costs a branch point, as metres further per unit of
 * fall past `STEEP_FREE`: a lane leaves where the face lets it traverse. */
const STEEP_COST = 1500;
const STEEP_FREE = 0.25;
/** How much lower than a branch point the other sector's piste must lie
 * for a lane to reach it, as a pitch over the plan distance: a lane's. */
const BRANCH_FALL = 0.06;
/** The most of an area's kilometres its lanes run to before no more are
 * laid between its runs. */
const LANE_SHARE = 0.13;
/** Where on a piste a link lane to a bottom station leaves it: how far up
 * from the piste's end, m. */
const LINK_FROM = { min: 250, max: 900 };
/** ...and for a link lane home (R29's runout), up from where it begins
 * closing on the run it merges into, m: its own lift's bottom station
 * stands beside the stretch above the junction. */
const LINK_HOME = { min: RR.network.junction, max: 700 };

/** R27 — lay the lanes between the runs: a branch lane between each two
 * sectors side by side, one way or the other, then the way back where the
 * area has room for it. Each laid with the next free number. */
export function layLinks(b: LinkBuilder, nextId: () => string): void {
  const pistes = (from: string): number[] =>
    b.walked.flatMap((w, i) => (w.spec.kind === "piste" && w.spec.from === from ? [i] : []));
  // THE SECTORS across the face, by where their pistes run.
  const sectors = [
    ...new Set(b.walked.filter((w) => w.spec.kind === "piste").map((w) => w.spec.from)),
  ]
    .map((id) => {
      const runs = pistes(id);
      let sx = 0;
      let k = 0;
      for (const r of runs) {
        for (const p of b.walked[r].points) {
          sx += p.x;
          k++;
        }
      }
      return { id, x: sx / Math.max(1, k) };
    })
    .sort((a, c) => a.x - c.x);
  // Each two sectors side by side, one way or the other where the
  // ground will not carry a lane the first: those no run or lane links yet
  // first, the rest while the area has room for more lane.
  const pairs = sectors.slice(1).map((c, i) => [sectors[i], c] as const);
  const linked = (a: string, c: string): boolean =>
    b.walked.some((w) => {
      const into = w.into ? b.walked[w.into.run].spec.from : null;
      return (w.spec.from === a && into === c) || (w.spec.from === c && into === a);
    });
  const order = [
    ...pairs.filter(([a, c]) => !linked(a.id, c.id)),
    ...pairs.filter(([a, c]) => linked(a.id, c.id)),
  ];
  const back: (typeof order)[number][] = [];
  for (const [a, c] of order) {
    if (!room(b)) break;
    if (branch(b, pistes(a.id), c.id, 1, nextId)) back.push([c, a]);
    else if (branch(b, pistes(c.id), a.id, -1, nextId)) back.push([a, c]);
  }
  // ...and, while the area still has room for lane, the way back too: a
  // skier crosses the face either way.
  for (const [a, c] of back) {
    if (!room(b)) break;
    branch(b, pistes(a.id), c.id, Math.sign(sectors.indexOf(c) - sectors.indexOf(a)), nextId);
  }
}

/** How hard a walked run is to ski, for R29, by the colour it was built
 * to: a lane is a green. */
function rank(w: WalkedRun): number {
  return w.spec.kind === "road" ? 0 : PISTE_GRADES.indexOf(w.spec.row.id ?? "green");
}

/** The runs as walked, as R29's reckoning reads them (`access-build.ts`):
 * each as hard as `rankOf` says — the colour it was built to unless told —
 * the run a lane leaves named by `placeOf` its index in the walk (the
 * runs that stand, once some are left out), and ending in the hub where
 * it reaches the floor. */
export function planRuns(
  walked: readonly WalkedRun[],
  rankOf: (i: number) => number = (i) => rank(walked[i]),
  placeOf: (i: number) => number = (i) => i,
): PlanRun[] {
  return walked.map((w, i) => ({
    kind: w.spec.kind,
    rank: rankOf(i),
    from: w.spec.from,
    points: w.points,
    length: w.length,
    into: w.into,
    mergeStart: w.mergeStart,
    ...(w.spec.branch ? { branch: { run: placeOf(w.spec.branch.run), s: w.spec.branch.s } } : {}),
    ...(w.spec.to !== undefined ? { to: w.spec.to } : {}),
    floor: !w.into && w.spec.to === undefined,
  }));
}

/** R29 — BUILD TO ACCESS: while a piste cannot be skied again without a
 * harder run, a DRAG LIFT from its foot back up (`dragBack`), else a link
 * lane off it — or off a run no harder it flows on into — to the bottom
 * station of its own lift, else of the lift nearest its foot; while a
 * lift's bottom station is an island, a link lane to it off the piste
 * nearest; and a link lane home for a piste that leaves its skier far to
 * ski below it. Returns the pistes neither could bring back, by their place in
 * the walk, which the resort leaves out. */
export function layAccess(b: LinkBuilder, nextId: () => string): AccessLaid {
  const lost = new Set<number>();
  const laid = { lost, lanes: 0, drags: 0, home: 0 };
  const tried = new Set<string>();
  for (let round = 0; round < ACCESS_ROUNDS; round++) {
    const runs = planRuns(b.walked);
    const verdict = reckonAccess(
      runs,
      b.lifts.map((l) => ({ id: l.id, bottom: l.bottom, top: l.top, floor: b.floor(l.bottom) })),
    );
    let done = false;
    for (const id of verdict.orphans) {
      if (tried.has(id)) continue;
      tried.add(id);
      const lift = b.lifts.find((l) => l.id === id);
      if (lift && link(b, lift, nextId)) {
        laid.lanes++;
        done = true;
        break;
      }
    }
    if (done) continue;
    const failing = runs.flatMap((_, i) => (verdict.ok[i] || lost.has(i) ? [] : [i]));
    if (failing.length === 0) break;
    for (const i of failing) {
      if (dragBack(b, runs, b.lifts, i)) {
        laid.drags++;
        done = true;
        break;
      }
      // The runs a skier on it goes on down, no harder than it, and the
      // foot of the last.
      const p = b.walked[i];
      const chain = [i];
      for (
        let w = p;
        w.into && rank(b.walked[w.into.run]) <= rank(p) && chain.length <= b.walked.length;
      ) {
        chain.push(w.into.run);
        w = b.walked[w.into.run];
      }
      const foot = b.walked[chain[chain.length - 1]];
      const end = foot.points[foot.points.length - 1];
      const goals = [...b.lifts].sort((l, m) => {
        const own = (x: LiftPlan): number => (x.id === p.spec.from ? -1e9 : 0);
        return (
          own(l) +
          hypot(l.bottom.x - end.x, l.bottom.z - end.z) -
          (own(m) + hypot(m.bottom.x - end.x, m.bottom.z - end.z))
        );
      });
      for (const lift of goals.slice(0, ACCESS_GOALS)) {
        const key = `${i} ${lift.id}`;
        if (tried.has(key)) continue;
        tried.add(key);
        if (link(b, lift, nextId, chain)) {
          laid.lanes++;
          done = true;
          break;
        }
      }
      if (done) break;
      lost.add(i);
    }
    if (!done) break;
  }
  // THE LONG WAY HOME: a piste off a lift whose bottom stands up the
  // mountain (the peak's chair at the mid-station) that leaves its skier
  // more than `access.runout` of the runs below to ski on the way back is
  // given a link lane off its lower part to that bottom station; a drag
  // lift is tried once the runs are graded.
  const runs = planRuns(b.walked);
  const verdict = reckonAccess(
    runs,
    b.lifts.map((l) => ({ id: l.id, bottom: l.bottom, top: l.top, floor: b.floor(l.bottom) })),
  );
  runs.forEach((r, i) => {
    if (lost.has(i) || verdict.home[i] <= RR.access.runout) return;
    const own = b.lifts.find((l) => l.id === r.from);
    if (own && !b.floor(own.bottom) && link(b, own, nextId, [i], LINK_HOME)) laid.home++;
  });
  return laid;
}

/** What `layAccess` laid: the pistes it could not bring back (by their
 * place in the walk), and how many link lanes and drag lifts it laid for
 * pistes that could not be skied again, and link lanes home. */
export type AccessLaid = { lost: Set<number>; lanes: number; drags: number; home: number };

/** How many times R29's verdict is read again as lanes and lifts are laid
 * to it, and how many bottom stations a piste's link lane is tried
 * toward. */
const ACCESS_ROUNDS = 16;
const ACCESS_GOALS = 2;

/** Whether the area has room for another lane: its lanes under
 * `LANE_SHARE` of its kilometres (R27 — a ski area is its pistes, threaded
 * by a few cat tracks). */
function room(b: LinkBuilder): boolean {
  let lanes = 0;
  let all = 0;
  for (const w of b.walked) {
    all += w.length;
    if (w.spec.kind === "road") lanes += w.length;
  }
  return lanes < LANE_SHARE * all;
}

/** A branch point on a piste: the run (its index), the arc, where the lane
 * starts, and how far that is from the nearest point of the other sector
 * low enough to reach. */
type Point = { run: number; s: number; x: number; z: number; far: number };

/** One branch lane off sector `from`'s pistes, toward the `side` sector
 * `to`, at the first of its best branch points that routes; whether one
 * stood. */
function branch(
  b: LinkBuilder,
  from: readonly number[],
  to: string,
  side: number,
  nextId: () => string,
): boolean {
  const targets = b.walked.flatMap((w, i) =>
    w.spec.kind === "piste" && w.spec.from === to ? [i] : [],
  );
  if (from.length === 0 || targets.length === 0) return false;
  const points: Point[] = [];
  for (const r of from) {
    const w = b.walked[r];
    // Never across a junction: clear of where it merges, and of where any
    // other run merges into it or leaves it.
    const busy = b.walked.flatMap((o, i) => [
      ...(o.into?.run === r ? [o.into.s] : []),
      ...(o.spec.branch?.run === r ? [o.spec.branch.s] : []),
      ...(i === r && o.into ? [o.mergeStart] : []),
    ]);
    const last = w.into ? w.mergeStart : w.length - BRANCH_TO;
    // Below every lane that joins it: one leaving above would cross it.
    const first = b.walked.reduce(
      (m, o) =>
        o.spec.kind === "road" && o.into?.run === r
          ? Math.max(m, o.into.s + RR.network.junction)
          : m,
      BRANCH_FROM,
    );
    for (let s = first; s < last; s += BRANCH_STEP) {
      if (busy.some((j) => Math.abs(j - s) < RR.network.junction)) continue;
      const p = w.points[Math.round((s / w.length) * (w.points.length - 1))];
      const off = Math.max(0, p.width / 2 - BRANCH_IN) * side;
      const x = p.x + Math.cos(p.heading) * off;
      const z = p.z - Math.sin(p.heading) * off;
      // The nearest point of the other sector it could fall to at a lane's
      // pitch, and the face it leaves across: a lane is laid where the
      // ground lets it hold its pitch, on a bench rather than a headwall.
      let far = Infinity;
      for (const t of targets) {
        const pts = b.walked[t].points;
        for (let k = 0; k < pts.length; k += 5) {
          const q = pts[k];
          const d = hypot(q.x - x, q.z - z);
          if (q.z - z > 40 && Math.sign(q.x - x) === side && p.y - q.y > d * BRANCH_FALL && d < far)
            far = d;
        }
      }
      const pitch = b.fall(x, z);
      if (far < RR.road.reach.max)
        points.push({
          run: r,
          s: p.s,
          x,
          z,
          far: far + STEEP_COST * Math.max(0, pitch - STEEP_FREE),
        });
    }
  }
  points.sort((a, c) => a.far - c.far);
  for (const p of points.slice(0, BRANCH_TRIES)) {
    const lane = b.route(p.x, p.z, side, (r) => targets.includes(r), {
      least: BRANCH_LEAST,
      box: boxOf(
        p,
        targets.flatMap((t) => b.walked[t].points),
      ),
    });
    if (!lane || lane.run < 0) continue;
    const spec = laneSpec(b.walked[p.run], p, lane, side, nextId());
    if (b.lay({ ...spec, join: lane.run, branch: { run: p.run, s: p.s } }, (r) => r === p.run))
      return true;
  }
  return false;
}

/** One link lane to a lift's bottom station, off the lower part of the
 * piste nearest it that a lane can fall from (of `from`, when given);
 * whether one stood. */
function link(
  b: LinkBuilder,
  lift: LiftPlan,
  nextId: () => string,
  from?: readonly number[],
  reach: { min: number; max: number } = LINK_FROM,
): boolean {
  const goal = lift.bottom;
  const points: Point[] = [];
  b.walked.forEach((w, r) => {
    if (w.spec.kind !== "piste" || (from && !from.includes(r))) return;
    const end = w.into ? w.mergeStart : w.length;
    for (let s = Math.max(BRANCH_FROM, end - reach.max); s < end - reach.min; s += BRANCH_STEP) {
      const p = w.points[Math.round((s / w.length) * (w.points.length - 1))];
      const side = Math.sign(goal.x - p.x) || 1;
      const off = Math.max(0, p.width / 2 - BRANCH_IN) * side;
      const x = p.x + Math.cos(p.heading) * off;
      const z = p.z - Math.sin(p.heading) * off;
      const d = hypot(goal.x - x, goal.z - z);
      if (
        goal.z - z < 40 ||
        p.y - b.height(goal.x, goal.z) < d * BRANCH_FALL ||
        d > RR.road.reach.max
      )
        continue;
      points.push({
        run: r,
        s: p.s,
        x,
        z,
        far: d + STEEP_COST * Math.max(0, b.fall(x, z) - STEEP_FREE),
      });
    }
  });
  points.sort((a, c) => a.far - c.far);
  for (const p of points.slice(0, BRANCH_TRIES)) {
    const side = Math.sign(goal.x - p.x) || 1;
    const lane = b.route(p.x, p.z, side, () => false, { goal, box: boxOf(p, [goal]) });
    if (!lane || lane.run >= 0) continue;
    const spec = laneSpec(b.walked[p.run], p, lane, side, nextId());
    if (b.lay({ ...spec, to: lift.id, branch: { run: p.run, s: p.s } }, (r) => r === p.run))
      return true;
  }
  return false;
}

/** How far round the start and what it may join a lane's search reaches,
 * m: room to wind. */
const BOX_PAD = 240;

/** The stretch of the map a lane from `p` to any of `to` is looked for in. */
function boxOf(
  p: Point,
  to: readonly { x: number; z: number }[],
): { x0: number; x1: number; z1: number } {
  let x0 = p.x;
  let x1 = p.x;
  let z1 = p.z;
  for (const q of to) {
    if (q.z <= p.z) continue;
    x0 = Math.min(x0, q.x);
    x1 = Math.max(x1, q.x);
    z1 = Math.max(z1, q.z);
  }
  return { x0: x0 - BOX_PAD, x1: x1 + BOX_PAD, z1: z1 + BOX_PAD };
}

/** A lane's spec off a branch point along its route. */
function laneSpec(
  parent: WalkedRun,
  p: Point,
  lane: { route: RoutePoint[]; x: number; z: number },
  side: number,
  id: string,
): RunSpec {
  const ahead = lane.route[Math.min(5, lane.route.length - 1)];
  return {
    id,
    from: parent.spec.from,
    kind: "road",
    row: ROAD_ROW,
    x: p.x,
    z: p.z,
    heading: Math.atan2(ahead.x - p.x, Math.max(1, ahead.z - p.z)),
    target: { x: lane.x, z: lane.z },
    amplitude: 0.05,
    route: lane.route,
    lean: side,
  };
}
