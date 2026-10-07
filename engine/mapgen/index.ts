// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD GENERATOR's public surface. `engine/index.ts` re-exports all of
// it; nothing outside `mapgen/` should reach past this file.

export * from "./types.ts";
export { generateLevel, levelIsCached, subSeed } from "./generate.ts";
export { boundLevel, portableLevel, type PortableLevel } from "./compile.ts";
export { LEVEL_RULES, bendFloor, inBand, withinBand, type Band } from "./rules.ts";
export { bermCrest, bermProfile } from "./berm.ts";
export {
  GRADES,
  PISTE_GRADES,
  UNGRADED,
  dealGrade,
  gradeOf,
  gradeRow,
  gradeRowOf,
  isPisteGrade,
  pisteGradeOf,
  steepestSpan,
  verticalBand,
  type GradeRow,
  type PisteGrade,
} from "./grades.ts";
export {
  nearestTrackPoint,
  nearestWithin,
  trackPointAt,
  arcAhead,
  arcBetween,
  hubAt,
  outsideHub,
  type HasTrack,
} from "./query.ts";
export { kickerProfile } from "./kickers.ts";
export { treeAge, trunkRadius } from "./forest.ts";
export { cliffFootprint, cliffProfile } from "./cliffs.ts";
export { dealDrifts, driftAt } from "./drift.ts";
export {
  TIMES_OF_DAY,
  dayOfYearOf,
  declinationOf,
  faceTheSun,
  freeHours,
  sunOffFace,
  hourOfTime,
  sunWindow,
  withDay,
  type TimeOfDay,
} from "./sun.ts";
export {
  CLEAR_WEATHER,
  WEATHER_KINDS,
  dealWeather,
  hasLid,
  snowfallBand,
  snows,
  sunsetOf,
  weatherFor,
  weatherOf,
  withSky,
} from "./weather.ts";
export { gridOnTrack, startGateArc } from "./spawn.ts";
export { CLEAR as SURFACE_CLEAR } from "./surface.ts";
export {
  DEFAULT_REGION,
  REGIONS,
  REGION_IDS,
  TREE_KINDS,
  isRegionId,
  regionOf,
  regionRow,
  scaleBand,
  scaleCount,
  treeKindAt,
  type Region,
  type RegionId,
  type TreeKind,
} from "./regions.ts";
// The scoreboard the search gates on, re-exported here so the one surface
// that carries the generator carries its verdict too.
export {
  analyzeLevel,
  type Finding,
  type LevelAnalysis,
  type Severity,
} from "../analysis/index.ts";
export {
  bendRoom,
  finishFrom,
  minRadius,
  minSeparation,
  tightestBend,
  windowGrades,
} from "./track.ts";
export type { BendReading } from "./track.ts";
export {
  CURRENT_GENERATOR_VERSION,
  GENERATOR_VERSIONS,
  GENERATOR_VERSION_IDS,
  generatorTraits,
  isGeneratorVersion,
  type GeneratorTraits,
  type GeneratorVersion,
} from "./versions.ts";
export { levelDigest } from "./digest.ts";
export { PARK_VERSION } from "./trick-field.ts";
// THE RESORT (R25–R30): its rule book, and the scoreboard that holds a
// whole ski area to it — R29's access report among it.
export { RESORT_RULES, type ResortRules } from "./resort-rules.ts";
export { DISCIPLINE_RULES } from "./discipline-rules.ts";
export {
  setSlalom,
  slalomLineAt,
  slalomLineFast,
  slalomStretch,
  type SlalomStretch,
} from "./slalom.ts";
export { downhillCourseOf, setDownhill } from "./downhill.ts";
export { setSuperG, superGCourseOf, superGStart } from "./super-g.ts";
export { giantSlalomCourseOf, giantSlalomStart, setGiantSlalom } from "./giant-slalom.ts";
export { setSpeedSki, speedSkiAim, speedSkiLines } from "./speed-ski.ts";
export { LINE_STEP, speedCourseOf, speedLineAt } from "./speed-course.ts";
export { netsOf, raceCourseOf, type RaceCourse } from "./race-course.ts";
export { type CoursePrep } from "./course-prep.ts";
export {
  accessReport,
  analyzeResort,
  nearestOtherRun,
  nearestRun,
  type AccessReport,
  type ResortAnalysis,
  type RunAccess,
} from "../analysis/resort.ts";
export { chainedLifts, queueFault } from "../analysis/lift-queue.ts";
export { offRamp, rampFrame, rampHeight, rampLip } from "./summit-ramps.ts";
export { setSkiCross, skiCrossCourseOf } from "./ski-cross.ts";
export { jumpHeightAt, jumpProfile, lipSpeed, setBigAir, type JumpProfile } from "./big-air.ts";
export {
  AERIALS_RULE,
  HALFPIPE_RULE,
  MOGULS_RULE,
  SLOPESTYLE_RULE,
  TRICK_RULES,
  type AerialKickerRow,
  type JibRow,
  type JumpRule,
  type SlopeJumpRow,
} from "./trick-rules.ts";
export { courseSpeed, setSlopestyle, slopestyleProfile, type SlopeProfile } from "./slopestyle.ts";
export { halfpipeProfile, setHalfpipe, type HalfpipeProfile } from "./halfpipe.ts";
export {
  nearestAcross,
  pipeCoords,
  pipeSection,
  wallAt,
  wallShare,
  withPipe,
  type PipeFrame,
  type PipeSection,
} from "./pipe.ts";
export {
  mogulsField,
  mogulsProfile,
  setMoguls,
  type AirBump,
  type MogulsProfile,
  type MogulsRule,
} from "./moguls.ts";
export { aerialsHeightAt, aerialsProfile, setAerials, type AerialsProfile } from "./aerials.ts";
export {
  fieldCoords,
  fieldHeight,
  mogulShare,
  mogulsAt,
  withMoguls,
  type MogulField,
  type MogulLine,
} from "./mogul-field.ts";
