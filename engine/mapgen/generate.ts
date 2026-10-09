// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GENERATOR'S OUTER LOOP: a seed in, a clean map out, or a thrown
// error that names what could not be made clean.
//
// A map is a pure function of its seed. Each ATTEMPT draws everything from
// a sub-seed derived from the seed and the attempt number — the mountain,
// the start, the piste, the kickers, the forest, the day — compiles it, and
// asks the analysis (the same rule book, re-checked on the finished map
// rather than on the plan) whether it is clean. An attempt the search
// itself gives up on, or one the analysis finds a fault in, is rejected and
// the next sub-seed is tried; the attempts are bounded, the order is fixed,
// and so the map a seed produces is the same on every machine, and the
// reason it took three tries is in the log.
//
// THE ORDER inside an attempt is the dependency order, and it matters:
//
//   1. the mountain (R2, R3), baked once onto the grid
//   2. the start (R12): where under the ridge, and the heading out of it
//   3. the piste (R5–R7), walked again until one fits the face, and
//      graded into that mountain (R8)
//   4. the drops across a black (R24), added to the graded line — off a
//      stream of their own
//   4a the piste's kickers (R9), clear of the drops, added to the line
//   5. the corridor pressed into the ground, and the packed field (R8, R10)
//   6. the natural kickers off the piste (R4), stamped where the corridor
//      is not
//   6a the cliffs (R22), cut clear of the piste and the kickers — off a
//      stream of their own
//   7. the terrain park (R20) chosen on the finished piste — only on a map
//      asked for one, and drawing nothing
//   7a the drifts across the finished piste (R17) — off a stream of their
//      own, so they thin the packed field and move nothing else
//   7b the wind crust (R21), laid on the finished mountain and folded into
//      the packed field clear of the piste (R10 holds) — off a stream of
//      its own, and skipped in a region whose row lays none
//   8. the forest (R14), which keeps clear of everything above
//   9. the day (R15)
//  10. the weather (R19) — off a stream of its own, last, so it moves
//      nothing above; an evening it deals moves only the day's start hour
//  11. the park stamped into the finished mountain, the trees on the
//      ground it reshaped cleared — so a tricks map is its seed's map with
//      the park on its piste, and every other map is exactly what it was
//  12. the gates (R11) and the start line (R13), read off the piste as it
//      finally lies
//
// THE REGION (R21) scales the numbers steps 1, 6, 8 and 9 draw with and
// draws nothing in their place; the alpine's row is all ones and lays no
// crust, so a map nobody asked a region of is the alpine's.
//
// THE GRADE (R23) sets the numbers steps 1 to 7a draw with. The one piste
// is built only by a version from before the resorts (`singlePiste`, v1 —
// the trick maps and the benchmark stand on it), which is also from before
// the grades: it builds on the UNGRADED row, the rule book's own numbers,
// down a face due north, and so draws exactly what it always drew. A ski
// area's runs are graded run by run (`resort-build.ts`).

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import {
  sampleField,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { analyzeLevel } from "../analysis/index.ts";
import { debug } from "@niclaslindstedt/oss-game-framework/core/output";
import { compileLevel } from "./compile.ts";
import { dealDrifts, stampDrifts } from "./drift.ts";
import { layCliffs } from "./cliffs.ts";
import { layDrops, publishDrops } from "./drops.ts";
import { UNGRADED, dealGrade, type GradeRow } from "./grades.ts";
import { growForest } from "./forest.ts";
import { layOffKickers, layTrackKickers, publishTrackKickers } from "./kickers.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import { planTrickField, stampTrickField } from "./trick-field.ts";
import { chooseStart, gridOnTrack, layCheckpoints } from "./spawn.ts";
import { dealSun } from "./sun.ts";
import { bakeCountry, planTerrain } from "./terrain.ts";
import { dealWeather, withSky } from "./weather.ts";
import { regionRow, type Region } from "./regions.ts";
import { foldSurface, layCrust } from "./surface.ts";
import { drawPiste, gradePiste, stampCorridor, trackOf, type Piste } from "./track.ts";
import type { GenerateOptions, GeneratedLevel, Kicker, Mountain, TreeDef } from "./types.ts";
import { generatorTraits, type GeneratorVersion } from "./versions.ts";
import { chooseCourse } from "./course-gates.ts";
import { buildResort, resortLevel, type BuiltResort } from "./resort-build.ts";
import { laySkiRoutes } from "./ski-routes.ts";
import { resortCached } from "./resort-cache.ts";
import { analyzeResort } from "../analysis/resort.ts";

/** How many pistes an attempt walks before it gives up on its mountain. */
const DRAWS = 40;

/** The sub-seed of an attempt: the golden-ratio stride keeps successive
 * attempts far apart in the generator's state space. */
export function subSeed(seed: number, attempt: number): number {
  return (seed + attempt * 0x9e3779b9) >>> 0;
}

/** R20 — the trees the park's stamp moved the ground under by more than
 * `TREE_SHIFT` m are cleared, and every other keeps its foot on the ground
 * as it now lies: the woods are the race map's, less what stood on the
 * ground the park was shaped out of. */
const TREE_SHIFT = 0.25;
function clearField(trees: TreeDef[], ground: Heightfield): TreeDef[] {
  const kept: TreeDef[] = [];
  for (const t of trees) {
    const y = sampleField(ground, t.x, t.z);
    if (Math.abs(y - t.y) > TREE_SHIFT) continue;
    t.y = y;
    kept.push(t);
  }
  return kept;
}

/** One attempt: a level, or the reason this sub-seed could not make one. */
function attemptLevel(
  seed: number,
  attempt: number,
  laps: number,
  version: GeneratorVersion,
  tricks: boolean,
  region: Region,
  grade: GradeRow,
): GeneratedLevel | string {
  const sub = subSeed(seed, attempt);
  const rng = createRng(sub);
  const plan = planTerrain(rng, region, grade);
  const ground = bakeCountry(plan);

  const start = chooseStart(rng, ground, grade);
  if (typeof start === "string") return start;
  let piste: Piste | null = null;
  let why = "";
  for (let d = 0; d < DRAWS && !piste; d++) {
    const drawn = drawPiste(rng, plan, ground, start);
    if (typeof drawn === "string") {
      why = drawn;
      continue;
    }
    const graded = gradePiste(
      drawn,
      ground,
      grade.track.maxGrade,
      grade.id === null || grade.id === "black" ? undefined : grade.steepest.max,
    );
    if (graded) {
      why = graded;
      continue;
    }
    piste = drawn;
  }
  if (!piste) return `no piste fits this mountain (last: ${why})`;

  const trackDrops = layDrops(sub, piste, grade);
  if (trackDrops.length < grade.drops.min) {
    return `only ${trackDrops.length} drop(s) fit the piste (R24)`;
  }
  const trackKickers = layTrackKickers(rng, piste, grade, trackDrops);
  const drops = publishDrops(piste, trackDrops);
  const { packed, near, along, dist } = stampCorridor(piste, ground);
  const offKickers = layOffKickers(rng, plan, ground, piste);
  const cliffs = layCliffs(sub, plan, ground, trackOf(piste), offKickers, drops);

  // Publish the heights the ground actually carries, so a reader of a
  // station and a reader of `groundAt` under it read the same number.
  for (const p of piste.points) p.y = sampleField(ground, p.x, p.z);
  const kickers = publishTrackKickers(piste, trackKickers).concat(offKickers);
  for (const k of kickers) k.y = sampleField(ground, k.x, k.z);
  for (const d of drops) d.y = sampleField(ground, d.x, d.z);
  // R20 — the park is chosen here, so the drifts keep off it, and stamped
  // last, onto the finished mountain.
  let field: Kicker[] = [];
  if (tricks) {
    const planned = planTrickField(piste, kickers, drops);
    if (typeof planned === "string") return planned;
    field = planned;
  }
  const drifts = dealDrifts(sub, piste.length, kickers.concat(field), grade.drift, drops);
  stampDrifts(packed, near, along, drifts, R.track.step);
  const crust = layCrust(sub, region, ground);
  if (crust) foldSurface(packed, dist, region, crust);

  // THE MOUNTAIN as published (R2): the base at the finish line, the
  // summit the profile's own height above it at the head of the fall line.
  const last = piste.points[piste.points.length - 1];
  const base = { x: last.x, z: last.z, y: sampleField(ground, last.x, last.z) };
  const mountain: Mountain = {
    summit: { x: start.x, z: plan.summitZ, y: base.y + plan.vertical },
    base,
    vertical: plan.vertical,
    altitude: plan.altitude,
    treeLine: plan.treeLine,
    sea: base.y - plan.altitude,
  };

  const treeLineY = base.y + (plan.treeLine - plan.altitude);
  const edges = drops.length > 0 ? drops.concat(cliffs) : cliffs;
  let trees = growForest(rng, plan, ground, trackOf(piste), kickers, edges, treeLineY);
  const day = dealSun(rng, region.sun);
  const { weather, hour } = dealWeather(sub, day);
  // R15 — the one piste's face is due north (from before the face was
  // turned to the sun), so no `facing` is dealt or published.
  const sun = { ...day, hour };
  if (field.length > 0) {
    stampTrickField(ground, field, { near, along, dist }, piste);
    trees = clearField(trees, ground);
    for (const p of piste.points) p.y = sampleField(ground, p.x, p.z);
  }
  const checkpoints = layCheckpoints(trackOf(piste));
  const { spawn, grid } = gridOnTrack(trackOf(piste));

  return compileLevel({
    seed,
    size: R.world.size,
    ground,
    packed,
    points: piste.points,
    length: piste.length,
    checkpoints,
    spawn,
    grid,
    trees,
    kickers: kickers.concat(field),
    cliffs: edges,
    sun,
    laps,
    mountain,
    attempt,
    drifts,
    weather,
    version,
    region: region.id,
    grade: grade.id,
    crust,
  });
}

/** Generate the map for a seed: the first attempt the analysis passes. */
export function generateLevel(seed: number, opts: GenerateOptions = {}): GeneratedLevel {
  const attempts = opts.attempts ?? 16;
  const laps = opts.laps ?? R.race.laps;
  const traits = generatorTraits(opts.version);
  const { version } = traits;
  if (!traits.singlePiste) return generateResortLevel(seed, opts, attempts, laps, version);
  const region = regionRow(opts.region);
  const grade = UNGRADED;
  const reasons: string[] = [];
  for (let a = 0; a < attempts; a++) {
    const built = attemptLevel(seed, a, laps, version, opts.tricks === true, region, grade);
    if (typeof built === "string") {
      reasons.push(`#${a}: ${built}`);
      continue;
    }
    const analysis = analyzeLevel(built);
    if (analysis.ok) {
      if (reasons.length > 0)
        debug(`level ${seed}: accepted attempt ${a} after ${reasons.join("; ")}`);
      return opts.sky ? withSky(built, opts.sky) : built;
    }
    const errors = analysis.findings.filter((f) => f.severity === "error");
    reasons.push(`#${a}: ${errors.map((f) => `${f.rule} ${f.message}`).join(", ")}`);
  }
  throw new Error(`level ${seed}: no clean map in ${attempts} attempts — ${reasons.join("; ")}`);
}

/** Whether `generateLevel(seed, opts)` would be answered off the ski area
 * this thread built last (`buildResort`'s one-resort cache): a course's map
 * stood up in milliseconds rather than a mountain raised in seconds. */
export function levelIsCached(seed: number, opts: GenerateOptions = {}): boolean {
  const traits = generatorTraits(opts.version);
  if (traits.singlePiste) return false;
  return resortCached(seed, opts.region, opts.attempts ?? 16, traits.version);
}

/** R25–R28 — a map of a resort: the ski area the seed builds (the first
 * attempt whose network and whose courses the analysis passes), raced on
 * the course asked for. */
function generateResortLevel(
  seed: number,
  opts: GenerateOptions,
  attempts: number,
  laps: number,
  version: GeneratorVersion,
): GeneratedLevel {
  const accept = (b: BuiltResort): string | null => {
    // The network once, on the first course's map; then every course on
    // its own — a course that will not stand is not offered.
    const first = resortLevel(b, 0, laps, version);
    const network = analyzeResort(first);
    const errors = network.findings.filter((f) => f.severity === "error");
    if (errors.length > 0) return errors.map((f) => `${f.rule} ${f.message}`).join(", ");
    b.courses = b.courses.filter((c, i) => {
      const level = i === 0 ? first : resortLevel(b, i, laps, version);
      const course = analyzeLevel(level, { network: false });
      if (!course.ok) {
        const why = course.findings.filter((f) => f.severity === "error");
        debug(
          `resort ${seed}: course ${c.course.id} left out — ${why.map((f) => `${f.rule} ${f.message}`).join(", ")}`,
        );
      }
      return course.ok;
    });
    return b.courses.length > 0 ? null : "no course down the network stands";
  };
  const built = buildResort(seed, opts.region, attempts, subSeed, accept, version);
  // R42 — the ski routes, found on the finished mountain; a version from
  // before them marks none.
  if (!generatorTraits(version).noRoutes) built.routes ??= layRoutes(built);
  const index = chooseCourse(built, {
    course: opts.course,
    grade: opts.grade,
    dealt: dealGrade(seed),
  });
  const level = opts.tricks ? parkedLevel(seed, built, index, laps, version, opts.course) : null;
  const raced = level ?? resortLevel(built, index, laps, version);
  return opts.sky ? withSky(raced, opts.sky) : raced;
}

/** R42 — the ski routes of a built ski area. */
function layRoutes(b: BuiltResort) {
  return laySkiRoutes({
    ground: b.ground,
    runs: b.runs.map((r) => r.run),
    lifts: b.lifts,
    trees: b.trees,
    size: b.plan.size,
  });
}

/** R20 on a ski area — the course with the terrain park laid down it: the
 * course asked for, or the one the seed's grade picked and, where that will
 * not carry a park that stands, the first of the others that will; null
 * where none does (the map is then ridden without one). */
function parkedLevel(
  seed: number,
  built: BuiltResort,
  index: number,
  laps: number,
  version: GeneratorVersion,
  asked: string | undefined,
): GeneratedLevel | null {
  const order = [index, ...built.courses.map((_, i) => i).filter((i) => i !== index)];
  for (const i of asked === undefined ? order : [index]) {
    const parked = resortLevel(built, i, laps, version, true);
    const why = parked.kickers.some((k) => k.trick)
      ? analyzeLevel(parked, { network: false })
          .findings.filter((f) => f.severity === "error")
          .map((f) => `${f.rule} ${f.message}`)
          .join(", ")
      : "no park fits it";
    if (why === "") return parked;
    debug(`resort ${seed}: course ${built.courses[i].course.id} carries no park — ${why}`);
  }
  return null;
}
