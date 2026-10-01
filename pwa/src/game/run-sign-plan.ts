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

import { trackPointAt, type Level, type PisteGrade, type Run, type TrackPoint } from "@engine";

import { LIFT_LOOK } from "./lift-plan.ts";
import { runName } from "./run-names.ts";

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
    number: run.id,
    name: runName(level, run),
    grade: run.grade,
    lane,
    arrow,
    width: size.width,
    height: size.height,
  };
}

/** What a sign keeps clear of at a lift, m: past a station house's walls,
 * and either side of the line (its ropes, its towers, its drag track). */
const CLEAR = { house: 3, line: 3.5 };

/** Whether (x, z) stands clear of every lift of the area — its two station
 * houses (as `lifts.ts` stands them: behind each wheel, along the line, as
 * `LIFT_LOOK` measures them) and the line from wheel to wheel. */
export function clearOfLifts(level: Level, x: number, z: number): boolean {
  for (const lift of level.resort?.lifts ?? []) {
    const look = LIFT_LOOK[lift.kind];
    const ex = lift.top.x - lift.bottom.x;
    const ez = lift.top.z - lift.bottom.z;
    const len = Math.max(1, Math.hypot(ex, ez));
    const dx = ex / len;
    const dz = ez / len;
    // Along the line from the bottom wheel, and across it.
    const u = (x - lift.bottom.x) * dx + (z - lift.bottom.z) * dz;
    const v = Math.abs((x - lift.bottom.x) * dz - (z - lift.bottom.z) * dx);
    if (u > -CLEAR.line && u < len + CLEAR.line && v < look.gauge / 2 + CLEAR.line) return false;
    const reach = look.house.length + 1.5 + CLEAR.house;
    const across = (look.house.width + look.gauge) / 2 + CLEAR.house;
    if (v < across && ((u <= 0 && u > -reach) || (u >= len && u < len + reach))) return false;
  }
  return true;
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
  const posts = groups.map((g): SignPost => {
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
    return { x, z, y: level.groundAt(x, z), heading, boards: placed };
  });
  cache.set(level, posts);
  return posts;
}
