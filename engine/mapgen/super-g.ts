// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R33 — A SUPER-G SET OVER A BUILT MAP. The speed discipline with gates
// that TURN: one run on the downhill's hill from a START LOWERED into the
// super-G's band of vertical, its gates set every fifty metres or so
// alternately either side, so the racer carves long, fast turns between
// them at 80–100 km/h — where a downhill's gates only mark a line. What it
// sets over the map is the turning course every such race shares
// (`turn-course.ts`: the start house over the lowered start, the kickers
// levelled, the snow groomed hard and combed, the crests shaved round for
// a super-G's speed, the trees cut, the A-nets along both edges, the line
// swung round its gates) and a speed event's SPEED TRAP. Everything is a
// pure function of the map, drawing nothing from the run's stream — so no
// digest moves and a restart stands on the very course it left.

import { DISCIPLINE_RULES } from "./discipline-rules.ts";
import { trackPointAt } from "./query.ts";
import { trapArc } from "./speed-course.ts";
import { loweredStart, mostVerticalCourseOf, turnCourse } from "./turn-course.ts";
import type { Level, SuperGCourse } from "./types.ts";

const G = DISCIPLINE_RULES.superG;

/** What a super-G's gates are dealt off beside the map's seed. */
const SUPER_G_SALT = 0x5e9a;

/** R33 — THE COURSE A SUPER-G IS RACED ON: the id of the ski area's course
 * (R28) with the most vertical — its start lowered into the band — or null
 * on a map that is not a ski area. */
export function superGCourseOf(level: Level): string | null {
  return mostVerticalCourseOf(level);
}

/** R33 — WHERE A SUPER-G STARTS on `level`'s piste: its start gate where
 * the drop to the finish has come down to `superG.target`, or the piste's
 * own start gate where it never was that high — and never on a drop's
 * lip. */
export function superGStart(level: Level): number {
  return loweredStart(level, G);
}

const set = new WeakMap<Level, Level>();

/** R33 — A SUPER-G SET OVER `level`: its piste from the lowered start as a
 * super-G course, as a map whose checkpoints are its gates and whose spawn
 * is the start house. A map that already carries a super-G is that map;
 * one carrying another race is set over the map under it. Kept per map,
 * so a restart or a replay stands on the course the renderer already
 * built. The course keeps the day and the sky of the map it was set
 * over. */
export function setSuperG(level: Level): Level {
  if (level.superG) return level;
  const original =
    level.slalom?.base ??
    level.downhill?.base ??
    level.giantSlalom?.base ??
    level.speedSki?.base ??
    level.skiCross?.base ??
    level.bigAir?.base ??
    level;
  let course = set.get(original);
  if (!course) {
    course = courseOver(original);
    set.set(original, course);
  }
  return course.sun === level.sun && course.weather === level.weather
    ? course
    : { ...course, sun: level.sun, weather: level.weather };
}

/** The super-G set over `original`, a map with no course on it. */
function courseOver(original: Level): Level {
  const c = turnCourse(original, superGStart(original), G, SUPER_G_SALT);
  const trapS = trapArc(c.base, c.from, c.to, G.trap);
  const trapAt = trackPointAt(c.base, trapS);
  const superG: SuperGCourse = {
    base: original,
    from: c.from,
    to: c.to,
    vertical: c.vertical,
    trap: {
      s: trapS,
      x: trapAt.x,
      z: trapAt.z,
      heading: trapAt.heading,
      width: trapAt.width + 2 * G.nets.gap,
    },
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
    superG,
  };
}
