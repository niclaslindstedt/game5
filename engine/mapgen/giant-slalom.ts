// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R36 — A GIANT SLALOM SET OVER A BUILT MAP. The technical discipline
// between the slalom and the speed events: two runs on the hill the
// super-G is raced on, from a START LOWERED into the giant slalom's band of
// vertical, its gates set every twenty-odd metres alternately either side
// so the racer carves round, ~20 m turns between them at 60–80 km/h. It is
// the turning course a super-G is (`turn-course.ts`) with a technical
// race's numbers — closer gates, a tighter swing, a shorter start drop,
// nets and no speed trap — and a run's own salt: the second run is set
// afresh on the same stretch. Everything is a pure function of the map and
// the run, drawing nothing from the run's stream.

import { DISCIPLINE_RULES } from "./discipline-rules.ts";
import { loweredStart, mostVerticalCourseOf, turnCourse } from "./turn-course.ts";
import type { GiantSlalomCourse, Level } from "./types.ts";

const G = DISCIPLINE_RULES.giantSlalom;

/** What a giant slalom's gates are dealt off beside the map's seed — and
 * the run, so the two runs are two courses on one hill. */
const GIANT_SLALOM_SALT = 0x6151;

/** R36 — THE COURSE A GIANT SLALOM IS RACED ON: the id of the ski area's
 * course (R28) with the most vertical — its start lowered into the band —
 * or null on a map that is not a ski area. */
export function giantSlalomCourseOf(level: Level): string | null {
  return mostVerticalCourseOf(level);
}

/** R36 — WHERE A GIANT SLALOM STARTS on `level`'s piste: where the drop to
 * the finish has come down to `giantSlalom.target`. */
export function giantSlalomStart(level: Level): number {
  return loweredStart(level, G);
}

const set = new WeakMap<Level, [Level | undefined, Level | undefined]>();

/** R36 — A GIANT SLALOM SET OVER `level`: run `run`'s course from the
 * lowered start, as a map whose checkpoints are its gates and whose spawn
 * is the start house. A map already carrying this run's course is that
 * map; one carrying another race — the other run's included — is set over
 * the map under it. Kept per map and run, so a restart or a replay stands
 * on the course the renderer already built. The course keeps the day and
 * the sky of the map it was set over, so a second run is skied under the
 * first run's sun. */
export function setGiantSlalom(level: Level, run: 1 | 2 = 1): Level {
  if (level.giantSlalom?.run === run) return level;
  const original =
    level.slalom?.base ??
    level.downhill?.base ??
    level.superG?.base ??
    level.giantSlalom?.base ??
    level.speedSki?.base ??
    level.skiCross?.base ??
    level.bigAir?.base ??
    level;
  let runs = set.get(original);
  if (!runs) {
    runs = [undefined, undefined];
    set.set(original, runs);
  }
  let course = runs[run - 1];
  if (!course) {
    course = courseOver(original, run);
    runs[run - 1] = course;
  }
  return course.sun === level.sun && course.weather === level.weather
    ? course
    : { ...course, sun: level.sun, weather: level.weather };
}

/** Run `run`'s giant slalom set over `original`, a map with no course on
 * it. */
function courseOver(original: Level, run: 1 | 2): Level {
  const salt = (GIANT_SLALOM_SALT ^ Math.imul(run, 0x9e3779b1)) >>> 0;
  const c = turnCourse(original, giantSlalomStart(original), G, salt);
  const giantSlalom: GiantSlalomCourse = {
    run,
    base: original,
    from: c.from,
    to: c.to,
    vertical: c.vertical,
    nets: c.nets,
    jumps: c.jumps,
    line: c.line,
    turns: c.turns,
  };
  return {
    ...c.base,
    checkpoints: c.checkpoints,
    spawn: c.spawn,
    grid: [c.spawn],
    trees: c.trees,
    giantSlalom,
  };
}
