// THE MAP OF A RESORT RACED ON ONE OF ITS COURSES (R28): a built resort
// (`resort-build.ts`) stood up as a level — the course's line its track,
// the kickers and drops on it by their arc and every other run's named by
// its run, the gates set down it (and the park, where one is asked for),
// the course's own day (`course-day.ts`), and the mountain's figures.

import { sampleField } from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { compileLevel } from "./compile.ts";
import { courseDay } from "./course-day.ts";
import { courseGates } from "./course-gates.ts";
import { courseArc } from "./courses.ts";
import { nearestTrackPoint, trackPointAt } from "./query.ts";
import { parkCourse, stampPark } from "./resort-park.ts";
import type { BuiltResort } from "./resort-build.ts";
import { gridOnTrack } from "./spawn.ts";
import type { Cliff, Drift, GeneratedLevel, Kicker, TrackPoint, Vec3 } from "./types.ts";
import type { GeneratorVersion } from "./versions.ts";

/** R28 — the map of a resort raced on one of its courses. */
export function resortLevel(
  b: BuiltResort,
  index: number,
  laps: number,
  version: GeneratorVersion,
  park = false,
): GeneratedLevel {
  const { plan: cp, course } = b.courses[index];
  const points: TrackPoint[] = cp.points.map((p) => ({ ...p, y: sampleField(b.ground, p.x, p.z) }));
  const track = { track: { points, length: cp.length } };
  // The kickers and drops on the course by its arc; every other run's are
  // the mountain's, named by their run.
  const kickers: Kicker[] = [];
  const onCourse: Kicker[] = [];
  const cliffs: Cliff[] = [];
  const drops: Cliff[] = [];
  const drifts: Drift[] = [];
  b.runs.forEach((r, i) => {
    r.kickers.forEach((k, n) => {
      const s = courseArc(cp, i, k.s ?? 0) === null ? null : nearestTrackPoint(track, k.x, k.z).s;
      if (s !== null) onCourse.push({ ...k, s, onTrack: true });
      else
        kickers.push({
          ...k,
          id: `${r.run.id}K${n + 1}`,
          onTrack: false,
          s: undefined,
          run: r.run.id,
        });
    });
    r.drops.forEach((d, n) => {
      const s = courseArc(cp, i, d.s ?? 0) === null ? null : nearestTrackPoint(track, d.x, d.z).s;
      if (s !== null) drops.push({ ...d, s, onTrack: true });
      else
        cliffs.push({
          ...d,
          id: `${r.run.id}D${n + 1}`,
          onTrack: false,
          s: undefined,
          run: r.run.id,
        });
    });
    for (const d of r.drifts) {
      if (courseArc(cp, i, d.from) === null || courseArc(cp, i, d.to) === null) continue;
      const at = (s: number): number => {
        const p = trackPointAt({ track: { points: r.walked.points, length: r.walked.length } }, s);
        return nearestTrackPoint(track, p.x, p.z).s;
      };
      drifts.push({ from: at(d.from), to: at(d.to) });
    }
  });
  onCourse.sort((a, c) => (a.s ?? 0) - (c.s ?? 0)).forEach((k, n) => (k.id = `K${n + 1}`));
  drops.sort((a, c) => (a.s ?? 0) - (c.s ?? 0)).forEach((d, n) => (d.id = `D${n + 1}`));
  drifts.sort((a, c) => a.from - c.from);
  const last = points[points.length - 1];
  const base: Vec3 = { x: last.x, z: last.z, y: last.y };
  const { sun, weather } = courseDay(b, course.id);
  // R20 — the park down the course, where one is asked for and fits, and
  // the gates set round it.
  const gatesFor = (field: readonly Kicker[]) =>
    courseGates(
      track,
      drops,
      onCourse,
      course.grade,
      b.sub ^ Math.imul(Number(course.id), 0x51a1e),
      field,
    );
  const { field, checkpoints } = park
    ? parkCourse({ points, length: cp.length }, onCourse, drops, drifts, gatesFor)
    : { field: [], checkpoints: gatesFor([]) };
  const level: GeneratedLevel = {
    ...compileLevel({
      seed: b.seed,
      size: b.plan.size,
      ground: b.ground,
      packed: b.packed,
      points,
      length: cp.length,
      checkpoints,
      ...gridOnTrack(track),
      trees: b.trees,
      kickers: onCourse.concat(field, kickers, b.offKickers),
      cliffs: drops.concat(cliffs, b.cliffs),
      sun,
      laps,
      mountain: {
        summit: { x: b.plan.massif?.peakX ?? 0, z: b.plan.summitZ, y: base.y + b.plan.vertical },
        base,
        vertical: b.plan.vertical,
        // The village's altitude over the sea, and the tree line the plan's
        // height over the floor above it (R21).
        altitude: b.village.y - b.seaY,
        treeLine: b.plan.face
          ? b.plan.treeLine
          : b.village.y - b.seaY + (b.plan.treeLine - b.plan.altitude),
        sea: b.seaY,
      },
      attempt: b.attempt,
      drifts,
      weather,
      version,
      region: b.region.id,
      ...(b.plan.face ? { face: b.plan.face.grid.id, ...b.water } : {}),
      grade: course.grade,
      crust: b.crust,
    }),
    resort: {
      runs: b.runs.map((r) => r.run),
      lifts: b.lifts,
      courses: b.courses.map((c) => c.course),
      course: course.id,
      village: b.village,
      hub: b.hub,
      tunnels: b.tunnels,
      ...(b.routes && b.routes.length > 0 ? { routes: b.routes } : {}),
    },
  };
  return field.length > 0 ? stampPark(level, field) : level;
}
