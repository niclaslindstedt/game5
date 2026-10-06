// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R32 — A DOWNHILL SET OVER A BUILT MAP. The map is the mountain and stays
// it; a downhill is raced down the WHOLE of its piste, from the start gate
// under the summit station to the finish line in the village — the
// longest, fastest course the game sets. What it sets over the map is the
// course: a start house over the top of the piste, the SPEED GATES down it
// (four poles and two red panels, set to mark the line rather than to make
// the turns), the A-NETS along both its edges, the SPEED TRAP and the
// intermediate timing points — and what the organisers prepare for it,
// as for a slalom (`course-prep.ts`): the kickers levelled, the snow
// groomed hard and combed of its short lips, the trees cut.
//
// WHICH COURSE: a ski area has a course down from every top station
// (R28); a downhill is raced on the one with the most vertical
// (`downhillCourseOf`), which on a mountain with a black is the black
// from under the summit to the village — some 2.7–3.2 km over 900–1100 m,
// a men's downhill's band.
//
// THE LINE COMES FIRST, the gates after it: a downhill's racing line is
// the line down the piste that bends the least — inside every bend's apex,
// across the piste between two bends, straight over a jump — kept a gate's
// half-width inside the piste's edges, and its gates MARK it, a speed gate
// centred on it about every eighty metres (the measured median), none on a
// jump. The line is relaxed out of the centreline coarse to fine (`line`),
// so a long bend is read as one. Everything is a pure function of the map,
// drawing nothing from any stream — so no digest moves and a
// restart stands on the very course it left.

import { clearedTrees, prepareCourse } from "./course-prep.ts";
import { DISCIPLINE_RULES } from "./discipline-rules.ts";
import { trackPointAt } from "./query.ts";
import { gateArcs, lineOffset, racingLine, trapArc } from "./speed-course.ts";
import type { Checkpoint, DownhillCourse, Level, Spawn } from "./types.ts";

const D = DISCIPLINE_RULES.downhill;

/** R32 — THE COURSE A DOWNHILL IS RACED ON: the id of the ski area's course
 * (R28) with the most vertical — the one inside the rule's band first,
 * where the area has one — or null on a map that is not a ski area. */
export function downhillCourseOf(level: Level): string | null {
  const courses = level.resort?.courses ?? [];
  let best: { id: string; drop: number; fits: boolean } | null = null;
  for (const c of courses) {
    const fits = c.drop >= D.vertical.min && c.drop <= D.vertical.max;
    if (
      !best ||
      (fits && !best.fits) ||
      (fits === best.fits && (c.drop > best.drop || (c.drop === best.drop && c.id < best.id)))
    ) {
      best = { id: c.id, drop: c.drop, fits };
    }
  }
  return best?.id ?? null;
}

const set = new WeakMap<Level, Level>();

/** R32 — A DOWNHILL SET OVER `level`: its whole piste as a downhill course,
 * as a map whose checkpoints are its gates and whose spawn is the start
 * house. A map that already carries a downhill is that map; one carrying a
 * slalom or a super-G is set over the map under it. Kept per map, so a restart or a
 * replay stands on the course the renderer already built. The course keeps
 * the day and the sky of the map it was set over. */
export function setDownhill(level: Level): Level {
  if (level.downhill) return level;
  const original =
    level.slalom?.base ??
    level.superG?.base ??
    level.giantSlalom?.base ??
    level.speedSki?.base ??
    level.skiCross?.base ??
    level.bigAir?.base ??
    level.knuckleHuck?.base ??
    level.slopestyle?.base ??
    level.railJam?.base ??
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

/** The downhill set over `original`, a map with no course on it. */
function courseOver(original: Level): Level {
  const L = original.track.length;
  const from = original.checkpoints[0]?.s ?? 0;
  const to = L;
  const stretch = { from, to };
  const base = prepareCourse(original, stretch, D);
  // The jumps the course keeps: its drops (R24), by arc.
  const jumps = (base.cliffs ?? [])
    .filter((c) => c.onTrack && c.s !== undefined && c.s > from && c.s < to)
    .map((c) => c.s ?? 0)
    .sort((a, b) => a - b);
  const line = racingLine(base, from, to, D.line);
  const offsetAt = (at: number): number => lineOffset(line, from, at, D.line.step);
  const arcs = gateArcs(from, to, jumps, D.spacing, D.jump);
  const checkpoints: Checkpoint[] = [];
  const startAt = trackPointAt(base, from);
  checkpoints.push({
    x: startAt.x,
    z: startAt.z,
    y: startAt.y,
    heading: startAt.heading,
    width: 2,
    s: from,
    colour: "red",
  });
  for (const at of arcs) {
    const p = trackPointAt(base, at);
    const offset = offsetAt(at);
    const x = p.x + Math.cos(p.heading) * offset;
    const z = p.z - Math.sin(p.heading) * offset;
    checkpoints.push({
      x,
      z,
      y: base.groundAt(x, z),
      heading: p.heading,
      width: D.width,
      s: at,
      colour: "red",
      offset,
      span: p.width,
      panels: true,
    });
  }
  const finishAt = trackPointAt(base, to);
  checkpoints.push({
    x: finishAt.x,
    z: finishAt.z,
    y: finishAt.y,
    heading: finishAt.heading,
    width: Math.max(D.finishWidth, finishAt.width + 6),
    s: to,
    colour: "red",
  });
  const house = trackPointAt(base, from - D.stand);
  const spawn: Spawn = { x: house.x, z: house.z, heading: startAt.heading };
  const trapS = trapArc(base, from, to, D.trap);
  const trapAt = trackPointAt(base, trapS);
  const downhill: DownhillCourse = {
    base: original,
    from,
    to,
    vertical: startAt.y - finishAt.y,
    trap: {
      s: trapS,
      x: trapAt.x,
      z: trapAt.z,
      heading: trapAt.heading,
      width: trapAt.width + 2 * D.nets.gap,
    },
    nets: { gap: D.nets.gap, height: D.nets.height, from: from - D.stand - 6, to: to - 10 },
    jumps,
    line: Array.from(line, (x, i) => ({ s: from + i * D.line.step, x })),
  };
  return {
    ...base,
    checkpoints,
    spawn,
    grid: [spawn],
    trees: clearedTrees(base, stretch, D),
    downhill,
  };
}
