// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R43 — A DUAL MOGULS COURSE BUILT OVER A BUILT MAP: R42's venue
// (`moguls.ts`'s `mogulsVenue`) to the dual row's numbers, its mogul field
// laid down TWO LINES on one rhythm — one down the middle of each lane —
// and its air bumps level across both. Each lane has its own gates; a map
// is skied in ONE lane at a time (`Level.dualMoguls.lane`), its
// `checkpoints`, `spawn` and `grid` that lane's, so the strict gates, the
// reset and the bot read the lane they are in and nothing else. The other
// skier of a dual is a run of his own over the same venue in the other
// lane (`laneOf`).
//
// The course is the same on every map: only WHERE it stands is the map's.
// Everything is a pure function of the map, drawing nothing from any
// stream — no digest moves.

import { DUAL_MOGULS_RULE } from "./trick-rules.ts";
import { originalOf } from "./straight-venue.ts";
import { mogulsVenue } from "./moguls.ts";
import type { Checkpoint, DualLane, Level } from "./types.ts";

const built = new WeakMap<Level, Level>();

/** THE MAP SKIED IN LANE `lane` (0 the blue, 1 the red) of the dual course
 * on `level` — `level` itself when it is already that lane's. */
export function laneOf(level: Level, lane: 0 | 1): Level {
  const dual = level.dualMoguls;
  if (!dual || dual.lane === lane) return level;
  const L = dual.lanes[lane];
  // The other skier stands beside: the lane's own spot first.
  const other = dual.lanes[lane === 0 ? 1 : 0].spawn;
  return {
    ...level,
    checkpoints: L.checkpoints,
    spawn: L.spawn,
    grid: [L.spawn, other],
    dualMoguls: { ...dual, lane },
  };
}

/** R43 — A DUAL MOGULS COURSE BUILT OVER `level`, skied in lane `lane` (the
 * blue when left out): a map already carrying one is that map in that
 * lane; one carrying any other course is built over the map under it.
 * Kept per map; the course keeps the day and the sky of the map it was
 * built over. */
export function setDualMoguls(level: Level, lane: 0 | 1 = 0): Level {
  if (level.dualMoguls) return laneOf(level, lane);
  const original = originalOf(level);
  let course = built.get(original);
  if (!course) {
    course = buildOver(original);
    built.set(original, course);
  }
  const dayed =
    course.sun === level.sun && course.weather === level.weather
      ? course
      : { ...course, sun: level.sun, weather: level.weather };
  return laneOf(dayed, lane);
}

/** The course over `original`, a map with no course on it, in its blue
 * lane. */
function buildOver(original: Level): Level {
  const R = DUAL_MOGULS_RULE;
  const half = R.lanes.apart / 2;
  // Looking UP the hill the blue lane is on the left: on the right of the
  // line facing down it.
  const offsets = [half, -half] as const;
  const { level, course, p, across, spawnAt } = mogulsVenue(
    original,
    R,
    offsets.map((offset) => ({ offset, width: R.track })),
    2 * R.lanes.width,
  );
  const lane = (k: 0 | 1): DualLane => {
    const colour = k === 0 ? "blue" : "red";
    const offset = offsets[k];
    const gate = (s: number, width: number): Checkpoint => ({
      ...across(s, width, offset),
      colour,
    });
    return {
      colour,
      offset,
      width: R.lanes.width,
      checkpoints: [
        gate(p.gate, 4),
        ...course.gates.map((s) => gate(s, R.lanes.width)),
        gate(p.finish, R.lanes.width + 2),
      ],
      spawn: spawnAt(offset),
    };
  };
  const lanes: [DualLane, DualLane] = [lane(0), lane(1)];
  // As drawn: both lanes' gates as one, across the pair of them.
  const drawn: Checkpoint[] = [
    across(p.gate, 2 * R.lanes.width),
    ...course.gates.map((s, i) => ({
      ...across(s, 2 * R.lanes.width),
      colour: i % 2 === 0 ? ("blue" as const) : ("red" as const),
    })),
    across(p.finish, R.width),
  ];
  return {
    ...level,
    checkpoints: lanes[0].checkpoints,
    spawn: lanes[0].spawn,
    grid: [lanes[0].spawn, lanes[1].spawn],
    moguls: course,
    dualMoguls: { lanes, lane: 0, drawn },
  };
}
