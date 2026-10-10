// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE PISTE-HEAD SIGNS STAND — the plan `run-signs.ts` draws: one
// sign at the head of every run of a ski area (R27), and one where a lane
// leaves a run part-way down, each a board on a post with the run's mark,
// its number and its name — a plain plank, no arrow on it. Three-free and
// DOM-free, so the suite reads it.
//
// AS A SKI AREA SIGNS ITS RUNS: a sign stands AT THE PISTE'S EDGE, never
// out in the middle of the slope — just inside the stakes, on the side the
// lift he came up arrives on — a few metres down from the head, turned to
// face a skier at the top so he reads it looking down the run; or, on a run
// a ramp comes down to off a lift's top (R26), a few metres past the ramp's
// foot where it meets the run, on the side the ramp comes in from, turned
// to the skier coming down the ramp, so the run is named as he comes onto
// it. Clear of the lift he came up: never in its station, under its line or
// on its drag track, but further down or across the run. Where a LANE
// branches off, its sign stands at the edge of the run it leaves, a little
// above the junction, on the side the lane turns off to, facing up THAT run
// — the junction sign a skier reads before he has to choose. Signs that would stand within a few metres of each other,
// and the runs leaving one lift's top together, are one SIGN TREE: one post
// among them, its boards stacked, the pistes over the lanes, green to black,
// each a plain plank.
//
// AT A LIFT'S TOP, every run a rider let go there can ski onto down a
// ramp (R26, `Lift.ramps`) is signed BESIDE THE PISTE MAP BOARD he sees
// straight ahead as he comes off the lift (`mapBoardOf`): the runs whose
// ramps leave to his left on a post at the board's left, those to his
// right at its right (two or more runs leaving one way stacked on that
// side's post), each post turned to where he comes off — the chair's lane,
// the gondola's door — so he reads them as he stands up, never edge on.
// EVERY BOARD AT A TOP IS ITSELF AN ARROW: the plank cut to a point at one
// end, standing off its post that way, nothing burned on it — those on the
// left post pointing left, those on the right pointing right, at the
// slopes; and the run's own plain sign stands again where the ramp meets
// it, past the lip. A drag's top, with no board, has an arrow board at the
// head of each ramp, turned to its let-go and pointing the side its ramp
// falls away to. A map from before the ramps keeps a post at a chair's
// parting (`chairLane`) instead, its boards arrows the way their runs
// leave (`signsOf`).
//
// ON A RACE DAY the course is closed and cleared: no sign stands inside a
// race's nets (`onCourse`), from just above its start house to past its
// finish line — a lane's junction sign on the course a racer would ski
// into, a run's head sign on the start drop — nor in a speed track's
// safety margin.

import {
  DISCIPLINE_RULES,
  RESORT_RULES,
  TUNING,
  chairLane,
  clearOfLifts,
  liftPlans,
  nearestTrackPoint,
  raceCourseOf,
  trackPointAt,
  type Level,
  type LiftPlan,
  skiRoutesOf,
  type RunGrade,
  type Run,
  type TrackPoint,
} from "@engine";

import { runName, runNumber } from "./run-names.ts";
import { STRINGS } from "./strings.ts";
import { NETS, netShape } from "./spectator-plan.ts";
import { mapBoardOf, signsOf } from "./station-plan.ts";

/** The sign's measure, m: how far down the run it stands — and, on a run a
 * ramp comes down to off its top, how far past the ramp's foot; how far
 * past the piste's edge (`edge`, inside the stakes' line — `TUNING.stakes.out`
 * — and never nearer the line than `inner`); how far above a junction a lane's sign
 * stands; how far ahead its arrow looks; how close two signs must be to
 * share a post, and how close the heads of two runs off one lift's top. A board's width and height, a lane's smaller one, the
 * lowest board's foot over the snow, the gap between two boards. */
export const SIGN = {
  down: 10,
  lip: 12,
  /** How far down a ski route (R42) its warning board stands, m. */
  warn: 2,
  edge: 0.5,
  inner: 2,
  junction: 20,
  look: 45,
  cluster: 5,
  shared: 40,
  board: { width: 2.4, height: 0.6 },
  lane: { width: 1.8, height: 0.45 },
  foot: 1.45,
  gap: 0.07,
  /** An arrow board's point: how far it reaches past the plank, m. */
  tip: 0.5,
  /** On a race day, how far above the start a sign is taken down, and how
   * far outside the nets a post must stand, m (`onCourse`). */
  house: 20,
  clear: 1,
};

/** The way a sign's run goes from where it stands, as the skier reading
 * it looks — drawn only as an arrow board's `point`, never burned on. */
export type SignArrow = "ahead" | "left" | "right" | "aheadLeft" | "aheadRight";

/** One board on a post. */
export type SignBoard = {
  run: string;
  number: string;
  name: string;
  grade: RunGrade;
  lane: boolean;
  arrow: SignArrow;
  /** Its width and height, m, and its foot over the snow. */
  width: number;
  height: number;
  y: number;
  /** A board CUT AS AN ARROW pointing the reader's left or right (a lift
   * top's, its point `SIGN.tip` of its width), the board itself the arrow;
   * absent on a plain plank — a sign down on the runs. */
  point?: "left" | "right";
  /** A WARNING board (a ski route's, R42): a warning triangle painted where
   * a run's mark would be, the warning burned beside it. */
  warning?: true;
};

/** One post and the boards on it. `heading` is the way the skier reading
 * it looks (heading 0 = +z, clockwise from above); the boards face back
 * up that way. `y` is the snow at its foot. */
export type SignPost = { x: number; y: number; z: number; heading: number; boards: SignBoard[] };

/** Where one board would stand, before the boards are gathered onto posts. */
type Spot = {
  x: number;
  z: number;
  heading: number;
  /** The point on its run its arrow points at. */
  to: TrackPoint;
  /** The lift whose top the run leaves (null for a lane off a run), and
   * the run's head. */
  top: string | null;
  head: TrackPoint;
  board: Omit<SignBoard, "y">;
};

/** The arrow from a sign at (x, z), read looking along `heading`, to a
 * point on the run. */
function arrowTo(x: number, z: number, heading: number, to: TrackPoint): SignArrow {
  const dx = to.x - x;
  const dz = to.z - z;
  const ahead = dx * Math.sin(heading) + dz * Math.cos(heading);
  // The reader's own right as the picture shows it is forward × up — the
  // mirror of the engine's `right` (forward turned clockwise a quarter).
  const right = -dx * Math.cos(heading) + dz * Math.sin(heading);
  const a = Math.atan2(right, ahead);
  const deg = Math.abs(a) * (180 / Math.PI);
  if (deg < 18) return "ahead";
  if (deg < 62) return a > 0 ? "aheadRight" : "aheadLeft";
  return a > 0 ? "right" : "left";
}

/** The point `off` metres to the skier's RIGHT AS THE PICTURE SHOWS HIM
 * (negative: his left) of station `p` — forward × up, the mirror of the
 * engine's `right` (`input-model.ts`'s `SCREEN_TO_ENGINE` says why). */
function beside(p: TrackPoint, off: number): { x: number; z: number } {
  return { x: p.x - Math.cos(p.heading) * off, z: p.z + Math.sin(p.heading) * off };
}

/** An arrow board's point: the side of the reader's view `arrow` leans to,
 * or, straight ahead, the side `to` lies on however little. */
function pointOf(
  x: number,
  z: number,
  heading: number,
  to: { x: number; z: number },
): "left" | "right" {
  const right = -(to.x - x) * Math.cos(heading) + (to.z - z) * Math.sin(heading);
  return right >= 0 ? "right" : "left";
}

const offOf = (p: TrackPoint): number => Math.max(SIGN.inner, p.width / 2 + SIGN.edge);

/** Which side of station `p` (x, z) lies on, as `beside` counts it: 1 the
 * skier's right as the picture shows him, -1 his left. */
function sideOf(p: TrackPoint, x: number, z: number): 1 | -1 {
  return -(x - p.x) * Math.cos(p.heading) + (z - p.z) * Math.sin(p.heading) >= 0 ? 1 : -1;
}

function boardOf(level: Level, run: Run, arrow: SignArrow): Omit<SignBoard, "y"> {
  const lane = run.kind === "road";
  const size = lane ? SIGN.lane : SIGN.board;
  return {
    run: run.id,
    number: runNumber(level, run),
    name: runName(level, run),
    grade: run.grade,
    lane,
    arrow,
    width: size.width,
    height: size.height,
  };
}

/** Whether (x, z) stands clear of every trunk by a couple of metres. */
function clearOfTrees(level: Level, x: number, z: number): boolean {
  return level.trees.every((t) => Math.hypot(t.x - x, t.z - z) > 2.5);
}

/** The first spot of `tries` (an arc down `line` and a side) clear of the
 * lifts and the trees — the first clear of the lifts when none is, the
 * first of them when none of those is. */
function clearSpot(
  level: Level,
  line: Run,
  tries: readonly (readonly [number, number])[],
): { p: TrackPoint; at: { x: number; z: number } } {
  type Found = { p: TrackPoint; at: { x: number; z: number } };
  let first: Found | null = null;
  let lifts: Found | null = null;
  for (const [s, side] of tries) {
    const p = trackPointAt({ track: line }, Math.max(0, Math.min(line.length, s)));
    const at = beside(p, side * offOf(p));
    first ??= { p, at };
    if (!clearOfLifts(level, at.x, at.z)) continue;
    if (clearOfTrees(level, at.x, at.z)) return { p, at };
    lifts ??= { p, at };
  }
  return lifts ?? first!;
}

/** Where a run's sign stands: at its head, or for a lane that branches
 * off a run, above the junction on the run it leaves — a few metres
 * further down, or across the run, where that would put it in a lift's
 * station or under its line. */
function spotOf(level: Level, run: Run, runs: readonly Run[]): Spot | null {
  if (run.points.length < 2) return null;
  const parent = run.branch ? runs.find((r) => r.id === run.branch!.run) : undefined;
  if (run.branch && parent) {
    const to = trackPointAt({ track: run }, Math.min(run.length, SIGN.look));
    const j = trackPointAt({ track: parent }, Math.max(0, run.branch.s - SIGN.junction));
    // The side the lane turns off to, as the skier on the run sees it.
    const side =
      Math.sign(-(to.x - j.x) * Math.cos(j.heading) + (to.z - j.z) * Math.sin(j.heading)) || 1;
    const back = [SIGN.junction, SIGN.junction + 8, SIGN.junction - 8, SIGN.junction + 16];
    const tries = [side, -side].flatMap((k) => back.map((b) => [run.branch!.s - b, k] as const));
    const { p, at } = clearSpot(level, parent, tries);
    return {
      ...at,
      heading: p.heading,
      to,
      top: null,
      head: j,
      board: boardOf(level, run, arrowTo(at.x, at.z, p.heading, to)),
    };
  }
  // A run a ramp comes down to off its top (R26): its sign stands where
  // the ramp's foot meets it — the lip the rider comes over onto its
  // slope — a little down it, at the edge the ramp comes in from, turned
  // to him coming down the ramp.
  const lift = liftPlans(level).find((p) => p.lift.id === run.from);
  const ramp = lift?.lift.ramps?.find((q) => q.run === run.id);
  if (ramp) {
    const s0 = Math.min(run.length / 2, ramp.to.s + SIGN.lip);
    const foot = trackPointAt({ track: run }, s0);
    const k0 = sideOf(foot, ramp.from.x, ramp.from.z);
    const tries = [k0, -k0].flatMap((k) => [0, 5, 10, 15].map((d) => [s0 + d, k] as const));
    const { p, at } = clearSpot(level, run, tries);
    const heading = Math.atan2(at.x - ramp.from.x, at.z - ramp.from.z);
    const to = trackPointAt({ track: run }, Math.min(run.length, p.s + SIGN.look));
    return {
      ...at,
      heading,
      to,
      // Its own: the runs off one top are read at their own ramps' feet.
      top: null,
      head: p,
      board: boardOf(level, run, arrowTo(at.x, at.z, heading, to)),
    };
  }
  // A run off a top with no ramp: at the edge its lift arrives on.
  const down = Math.min(SIGN.down, run.length / 4);
  const steps = [0, 5, 10, 15, 20, 30].map((d) => down + d);
  const near = trackPointAt({ track: run }, down);
  const k0 = lift ? sideOf(near, lift.lift.top.x, lift.lift.top.z) : 1;
  const tries = [k0, -k0].flatMap((k) => steps.map((s) => [s, k] as const));
  const { p, at } = clearSpot(level, run, tries);
  const to = trackPointAt({ track: run }, Math.min(run.length, p.s + SIGN.look));
  return {
    ...at,
    heading: p.heading,
    to,
    top: run.from,
    head: run.points[0],
    board: boardOf(level, run, arrowTo(at.x, at.z, p.heading, to)),
  };
}

/** Whether (x, z) stands on `level`'s race course: inside its nets (a
 * speed track's safety margin), between just above its start house and the
 * nets' end past its finish line. Never on a map with no race set. */
export function onCourse(level: Level, x: number, z: number): boolean {
  const course = raceCourseOf(level);
  if (!course) return false;
  const hit = nearestTrackPoint(level, x, z);
  if (hit.s < course.from - SIGN.house || hit.s > course.to + NETS.after) return false;
  const width = level.track.points[hit.index]?.width ?? 0;
  const out = level.speedSki ? DISCIPLINE_RULES.speedSki.margin : netShape(level).out;
  return hit.distance < width / 2 + out + SIGN.clear;
}

const RANK: Readonly<Record<RunGrade, number>> = {
  green: 0,
  blue: 1,
  red: 2,
  black: 3,
  orange: 4,
};

/** The order boards stack in, top first: the pistes over the lanes, then
 * green to black, then by number. */
function stackOrder(a: Omit<SignBoard, "y">, b: Omit<SignBoard, "y">): number {
  if (a.lane !== b.lane) return a.lane ? 1 : -1;
  if (a.grade !== b.grade) return RANK[a.grade] - RANK[b.grade];
  return Number(a.number) - Number(b.number) || a.number.localeCompare(b.number);
}

const cache = new WeakMap<Level, readonly SignPost[]>();

/** Every sign post of `level`'s ski area — none off a resort. Built once
 * per map. */
export function signPlan(level: Level): readonly SignPost[] {
  const hit = cache.get(level);
  if (hit) return hit;
  const runs = level.resort?.runs ?? [];
  const groups: Spot[][] = [];
  for (const run of runs) {
    const spot = spotOf(level, run, runs);
    if (!spot) continue;
    const near = groups.find(
      (g) =>
        Math.hypot(g[0].x - spot.x, g[0].z - spot.z) < SIGN.cluster ||
        (g[0].top !== null &&
          g[0].top === spot.top &&
          Math.hypot(g[0].head.x - spot.head.x, g[0].head.z - spot.head.z) < SIGN.shared),
    );
    if (near) near.push(spot);
    else groups.push([spot]);
  }
  const posts = groups.flatMap((g): SignPost[] => {
    // A lone sign stands where it was put. A SIGN TREE of signs a few
    // metres apart stands among them — where that is clear of the lift, or
    // where its first board's own sign would have; one of the runs leaving
    // a top together stands where the sign nearest the lift's top would
    // have, at a run's edge on the lift's side, never out between the runs
    // — each turned to their mean way down.
    let { x, z, heading } = g[0];
    if (g.length > 1) {
      const top =
        g[0].top === null ? undefined : liftPlans(level).find((p) => p.lift.id === g[0].top);
      if (top) {
        const t = top.lift.top;
        const first = g.reduce((a, s) =>
          Math.hypot(s.x - t.x, s.z - t.z) < Math.hypot(a.x - t.x, a.z - t.z) ? s : a,
        );
        x = first.x;
        z = first.z;
      } else {
        const mx = g.reduce((a, s) => a + s.x, 0) / g.length;
        const mz = g.reduce((a, s) => a + s.z, 0) / g.length;
        if (clearOfLifts(level, mx, mz) && clearOfTrees(level, mx, mz)) {
          x = mx;
          z = mz;
        }
      }
      heading = Math.atan2(
        g.reduce((a, s) => a + Math.sin(s.heading), 0),
        g.reduce((a, s) => a + Math.cos(s.heading), 0),
      );
    }
    // Re-aim every board from the post it shares, as the skier reading
    // the stack looks.
    const boards = [...g]
      .sort((a, b) => stackOrder(a.board, b.board))
      .map((s) => ({ ...s.board, arrow: arrowTo(x, z, heading, s.to) }));
    // Stack from the bottom up, the last board lowest.
    let foot = SIGN.foot;
    const placed: SignBoard[] = [];
    for (let i = boards.length - 1; i >= 0; i--) {
      placed.unshift({ ...boards[i], y: foot });
      foot += boards[i].height + SIGN.gap;
    }
    if (onCourse(level, x, z)) return [];
    return [{ x, z, y: level.groundAt(x, z), heading, boards: placed }];
  });
  // A SKI ROUTE (R42) is signed where it leaves the pad: a post at the
  // corridor's edge `SIGN.down` m down its line on the side away from the
  // lift, turned to a skier at its head looking down it — the orange
  // double diamond, its number and the warning, a plain plank — and
  // before it, `SIGN.warn` m down on the same side, the WARNING board a
  // skier passes before the slope drops away.
  for (const r of skiRoutesOf(level)) {
    const route = { track: { points: r.points, length: r.length } };
    const at = trackPointAt(route, SIGN.down);
    const lift = liftPlans(level).find((p) => p.lift.id === r.from)?.lift.top;
    const side = lift ? -sideOf(at, lift.x, lift.z) : 1;
    const { x, z } = beside(at, side * offOf(at));
    const warnAt = trackPointAt(route, SIGN.warn);
    const warn = beside(warnAt, side * offOf(warnAt));
    posts.push({
      x: warn.x,
      z: warn.z,
      y: level.groundAt(warn.x, warn.z),
      heading: warnAt.heading,
      boards: [
        {
          run: r.id,
          number: "!",
          name: STRINGS.skiRouteWarning,
          grade: r.grade,
          lane: false,
          arrow: "ahead",
          ...SIGN.board,
          y: SIGN.foot,
          warning: true,
        },
      ],
    });
    posts.push({
      x,
      z,
      y: level.groundAt(x, z),
      heading: at.heading,
      boards: [
        {
          run: r.id,
          number: r.id,
          name: STRINGS.skiRouteSign,
          grade: r.grade,
          lane: false,
          arrow: "ahead",
          ...SIGN.board,
          y: SIGN.foot,
        },
      ],
    });
  }
  cache.set(level, posts);
  return posts;
}

/** THE SIGNS AT EVERY LIFT'S TOP: beside a chair's or a gondola's piste
 * map board, a post either side for the ramps (R26) that leave that way
 * (`besideBoard`); at a drag's top a post at the head of every ramp off it
 * — `SUMMIT.in` m in from the rim and `SUMMIT.edge` m in from the ramp's
 * right-hand edge, turned to a skier reading it where he is let go
 * (`offPoint`), its arrow pointing on to the ramp's foot. A chair's top on
 * a map from before the ramps keeps one post across
 * the far side of its way off (`chairLane`) with an arrow board a run
 * (`signsOf`), those to the lane's side above — the lane's side, the
 * engine's +v, the reader's LEFT. Drawn with the piste-head signs
 * (`run-signs.ts`). */
export function summitSigns(level: Level): SignPost[] {
  const runs = level.resort?.runs ?? [];
  const posts: SignPost[] = [];
  for (const plan of liftPlans(level)) {
    const mapBoard = mapBoardOf(plan);
    if (plan.lift.ramps?.length && mapBoard) {
      posts.push(...besideBoard(level, plan, mapBoard));
      continue;
    }
    if (plan.lift.ramps?.length) {
      // A drag's top, with no board: a post at the head of every ramp.
      for (const ramp of plan.lift.ramps) {
        const run = runs.find((r) => r.id === ramp.run);
        if (!run) continue;
        // Round the pad clockwise from the ramp's head — a ramp leaves out
        // off the rim, so that is to the reader's right — to its edge, in
        // from the rim.
        const mid = padMiddle(plan);
        const r = Math.hypot(ramp.from.x - mid.x, ramp.from.z - mid.z) - SUMMIT.in;
        const head = Math.atan2(ramp.from.x - mid.x, ramp.from.z - mid.z);
        const at = head + (ramp.width / 2 - SUMMIT.edge) / r;
        const x = mid.x + Math.sin(at) * r;
        const z = mid.z + Math.cos(at) * r;
        // Turned to the rider coming off the lift — read as he stands up off
        // the chair, walks out of the cabin or lets go of the bar, never
        // edge on — its arrow pointing from there to the ramp's foot.
        const off = offPoint(plan);
        const heading = Math.atan2(x - off.x, z - off.z);
        const to = { x: ramp.to.x, z: ramp.to.z } as TrackPoint;
        const point = pointOf(x, z, heading, to);
        posts.push({
          x,
          z,
          y: level.groundAt(x, z),
          heading,
          boards: [{ ...boardOf(level, run, point), point, y: SIGN.foot }],
        });
      }
      continue;
    }
    if (plan.lift.kind !== "chair") continue;
    const signs = signsOf(level, plan);
    if (signs.length === 0) continue;
    const lane = chairLane(plan);
    const x = plan.lift.bottom.x + plan.dx * lane.signs + plan.dz * lane.v;
    const z = plan.lift.bottom.z + plan.dz * lane.signs - plan.dx * lane.v;
    const boards = signs.flatMap((sign) => {
      const run = runs.find((r) => r.id === sign.run);
      if (!run) return [];
      const point = sign.way === 1 ? ("left" as const) : ("right" as const);
      return [{ ...boardOf(level, run, point), point }];
    });
    let foot = SIGN.foot;
    const placed: SignBoard[] = [];
    for (let i = boards.length - 1; i >= 0; i--) {
      placed.unshift({ ...boards[i], y: foot });
      foot += boards[i].height + SIGN.gap;
    }
    posts.push({ x, z, y: level.groundAt(x, z), heading: plan.heading, boards: placed });
  }
  return posts.filter((p) => !onCourse(level, p.x, p.z));
}

/** THE SIGNS BESIDE A TOP'S PISTE MAP BOARD (`mapBoardOf`): the runs whose
 * ramps leave to the reader's left on one post at the board's left, those
 * to his right on one at its right — the reader standing where the lift
 * let him go, looking at the board — each post turned to him, its boards
 * stacked green to black, every one an arrow board pointing out from the
 * map its post's way, toward its slope. */
function besideBoard(
  level: Level,
  plan: LiftPlan,
  board: { x: number; z: number; off: { x: number; z: number } },
): SignPost[] {
  const runs = level.resort?.runs ?? [];
  const look = Math.atan2(board.x - board.off.x, board.z - board.off.z);
  const sides = new Map<number, Omit<SignBoard, "y">[]>();
  for (const ramp of plan.lift.ramps ?? []) {
    const run = runs.find((r) => r.id === ramp.run);
    if (!run) continue;
    // The reader's right as the picture shows it (`arrowTo`), from the board.
    const dx = ramp.from.x - board.x;
    const dz = ramp.from.z - board.z;
    const side = -dx * Math.cos(look) + dz * Math.sin(look) >= 0 ? 1 : -1;
    const list = sides.get(side) ?? [];
    list.push(boardOf(level, run, side === 1 ? "right" : "left"));
    sides.set(side, list);
  }
  const posts: SignPost[] = [];
  for (const [side, list] of sides) {
    const x = board.x - Math.cos(look) * SUMMIT.beside * side;
    const z = board.z + Math.sin(look) * SUMMIT.beside * side;
    const heading = Math.atan2(x - board.off.x, z - board.off.z);
    const point = side === 1 ? ("right" as const) : ("left" as const);
    const boards = [...list].sort(stackOrder).map((b) => ({ ...b, point }));
    let foot = SIGN.foot;
    const placed: SignBoard[] = [];
    for (let i = boards.length - 1; i >= 0; i--) {
      placed.unshift({ ...boards[i], y: foot });
      foot += boards[i].height + SIGN.gap;
    }
    posts.push({ x, z, y: level.groundAt(x, z), heading, boards: placed });
  }
  return posts;
}

/** Where a ramp's sign stands at its head, m: in from the pad's rim, and
 * in from the ramp's right-hand edge; and how far short of its top a
 * gondola's door lets its rider out (`TUNING.lift.door`'s); and how far
 * either side of a piste map board's middle the signs beside it stand —
 * half the board, a gap and half a sign. */
const SUMMIT = { in: 3, edge: 2, door: TUNING.lift.door, beside: 3.2 };

/** Where a rider comes off a lift, the place the signs on its top are read
 * from: a chair's lane at the parting past the wheel (`chairLane`), a
 * gondola's door, a drag's let-go. */
function offPoint(plan: LiftPlan): { x: number; z: number } {
  const v = plan.lift.kind === "chair" ? chairLane(plan).v : 0;
  const u =
    plan.lift.kind === "chair"
      ? chairLane(plan).exit
      : plan.lift.kind === "gondola"
        ? plan.length - SUMMIT.door
        : plan.length - RESORT_RULES.lift.drag.letGo;
  return {
    x: plan.lift.bottom.x + plan.dx * u + plan.dz * v,
    z: plan.lift.bottom.z + plan.dz * u - plan.dx * v,
  };
}

/** The middle of the ground a lift's ramps leave from (R26): a pad's, at
 * its top; a drag's, where it lets its rider go. */
function padMiddle(plan: LiftPlan): { x: number; z: number } {
  const back = plan.lift.kind === "drag" ? RESORT_RULES.lift.drag.letGo : 0;
  return { x: plan.lift.top.x - plan.dx * back, z: plan.lift.top.z - plan.dz * back };
}
