// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE PISTE-HEAD SIGNS STAND — the plan `run-signs.ts` draws: one
// sign at the head of every run of a ski area (R27), and one where a lane
// leaves a run part-way down, each a board on a post with the run's mark,
// its number, its name and an arrow the way it goes. Three-free and
// DOM-free, so the suite reads it.
//
// AS A SKI AREA SIGNS ITS RUNS: a sign stands a few metres down from the
// head, on the skier's right going down (the side the orange-banded stakes
// stand on), turned to face a skier at the top so he reads it looking down
// the run — and clear of the lift he came up: never in its station, under
// its line or on its drag track, but further down or across the run. Where a LANE branches off, its sign stands on the
// run it leaves, a little above the junction, on the side the lane turns
// off to, facing up THAT run — the junction sign a skier reads before he
// has to choose. Signs that would stand within a few metres of each other,
// and the runs leaving one lift's top together, are one SIGN TREE: one post
// among them, its boards stacked, the pistes over the lanes, green to black,
// each arrow pointing its own run's way.
//
// AT A LIFT'S TOP, every run a rider let go there can ski onto has a sign
// at the HEAD OF ITS RAMP (R26, `Lift.ramps`): on the pad a few steps short
// of the rim, at the ramp's right-hand edge, turned to face back up across
// the pad — so it stands LOWER than he came off the lift, down the pad's
// lean, in front of him as he looks for his way down, and he follows the
// one he wants straight down its ramp onto its run. A map from before the
// ramps keeps a post at a chair's parting (`chairLane`) instead, each
// plank CUT AS AN ARROW the way its run leaves (`signsOf`).
//
// ON A RACE DAY the course is closed and cleared: no sign stands inside a
// race's nets (`onCourse`), from just above its start house to past its
// finish line — a lane's junction sign on the course a racer would ski
// into, a run's head sign on the start drop — nor in a speed track's
// safety margin.

import {
  DISCIPLINE_RULES,
  RESORT_RULES,
  chairLane,
  clearOfLifts,
  liftPlans,
  nearestTrackPoint,
  raceCourseOf,
  trackPointAt,
  type Level,
  type LiftPlan,
  type PisteGrade,
  type Run,
  type TrackPoint,
} from "@engine";

import { runName, runNumber } from "./run-names.ts";
import { NETS, netShape } from "./spectator-plan.ts";
import { signsOf } from "./station-plan.ts";

/** The sign's measure, m: how far down the run it stands; how far off the
 * line (half the run's width less a metre, held between `side`'s bounds —
 * at the edge of a narrow run, on the groomed snow of a wide one, where a
 * skier at the top has it in view); how far above a junction a lane's sign
 * stands; how far ahead its arrow looks; how close two signs must be to
 * share a post, and how close the heads of two runs off one lift's top. A board's width and height, a lane's smaller one, the
 * lowest board's foot over the snow, the gap between two boards. */
export const SIGN = {
  down: 10,
  side: { min: 4, max: 5.5 },
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

/** The way a sign's arrow points, as the skier reading it looks. */
export type SignArrow = "ahead" | "left" | "right" | "aheadLeft" | "aheadRight";

/** One board on a post. */
export type SignBoard = {
  run: string;
  number: string;
  name: string;
  grade: PisteGrade;
  lane: boolean;
  arrow: SignArrow;
  /** Its width and height, m, and its foot over the snow. */
  width: number;
  height: number;
  y: number;
  /** A board CUT AS AN ARROW pointing the reader's left or right (a chair
   * top's, its point `SIGN.tip` of its width), its arrow the board itself;
   * absent on a plank with its arrow burned on. */
  point?: "left" | "right";
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

const offOf = (p: TrackPoint): number =>
  Math.min(SIGN.side.max, Math.max(SIGN.side.min, p.width / 2 - 1));

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
 * lifts — the first of them when none is. */
function clearSpot(
  level: Level,
  line: Run,
  tries: readonly (readonly [number, number])[],
): { p: TrackPoint; at: { x: number; z: number } } {
  let first: { p: TrackPoint; at: { x: number; z: number } } | null = null;
  for (const [s, side] of tries) {
    const p = trackPointAt({ track: line }, Math.max(0, Math.min(line.length, s)));
    const at = beside(p, side * offOf(p));
    first ??= { p, at };
    if (clearOfLifts(level, at.x, at.z)) return { p, at };
  }
  return first!;
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
  const down = Math.min(SIGN.down, run.length / 4);
  const steps = [0, 5, 10, 15, 20, 30].map((d) => down + d);
  const tries = [1, -1].flatMap((k) => steps.map((s) => [s, k] as const));
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

const RANK: Readonly<Record<PisteGrade, number>> = { green: 0, blue: 1, red: 2, black: 3 };

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
    // A lone sign stands where it was put. A SIGN TREE stands among the
    // runs it points to, turned to their mean way down — where that is
    // clear of the lift, or where its first board's own sign would have.
    let { x, z, heading } = g[0];
    if (g.length > 1) {
      const mx = g.reduce((a, s) => a + s.x, 0) / g.length;
      const mz = g.reduce((a, s) => a + s.z, 0) / g.length;
      if (clearOfLifts(level, mx, mz) && clearOfTrees(level, mx, mz)) {
        x = mx;
        z = mz;
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
  cache.set(level, posts);
  return posts;
}

/** THE SIGNS AT EVERY LIFT'S TOP: a post at the head of every ramp off it
 * (R26) — `SUMMIT.in` m in from the rim onto the pad and `SUMMIT.edge` m in
 * from the ramp's right-hand edge, a skier reading it looking down the
 * ramp — with its run's board, its arrow pointing down the ramp to the
 * run. A chair's top on a map from before the ramps keeps one post across
 * the far side of its way off (`chairLane`) with an arrow board a run
 * (`signsOf`), those to the lane's side above — the lane's side, the
 * engine's +v, the reader's LEFT. Drawn with the piste-head signs
 * (`run-signs.ts`). */
export function summitSigns(level: Level): SignPost[] {
  const runs = level.resort?.runs ?? [];
  const posts: SignPost[] = [];
  for (const plan of liftPlans(level)) {
    if (plan.lift.ramps?.length) {
      for (const ramp of plan.lift.ramps) {
        const run = runs.find((r) => r.id === ramp.run);
        if (!run) continue;
        const heading = Math.atan2(ramp.to.x - ramp.from.x, ramp.to.z - ramp.from.z);
        // Round the pad clockwise from the ramp's head — a ramp leaves out
        // off the rim, so that is to the reader's right — to its edge, in
        // from the rim.
        const mid = padMiddle(plan);
        const r = Math.hypot(ramp.from.x - mid.x, ramp.from.z - mid.z) - SUMMIT.in;
        const head = Math.atan2(ramp.from.x - mid.x, ramp.from.z - mid.z);
        const at = head + (ramp.width / 2 - SUMMIT.edge) / r;
        const x = mid.x + Math.sin(at) * r;
        const z = mid.z + Math.cos(at) * r;
        const to = { x: ramp.to.x, z: ramp.to.z } as TrackPoint;
        const board = boardOf(level, run, arrowTo(x, z, heading, to));
        posts.push({
          x,
          z,
          y: level.groundAt(x, z),
          heading,
          boards: [{ ...board, y: SIGN.foot }],
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

/** Where a ramp's sign stands at its head, m: in from the pad's rim, and
 * in from the ramp's right-hand edge. */
const SUMMIT = { in: 3, edge: 2 };

/** The middle of the ground a lift's ramps leave from (R26): a pad's, at
 * its top; a drag's, where it lets its rider go. */
function padMiddle(plan: LiftPlan): { x: number; z: number } {
  const back = plan.lift.kind === "drag" ? RESORT_RULES.lift.drag.letGo : 0;
  return { x: plan.lift.top.x - plan.dx * back, z: plan.lift.top.z - plan.dz * back };
}
