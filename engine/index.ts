// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public entry point for the game engine. The engine is framework-free and
// renderer-free: the browser app under `pwa/` consumes this module via the
// `@engine` alias, drives `step()` from its render loop at a fixed timestep,
// and reads the returned state to draw. The headless simulator and the tests
// consume the very same surface. See docs/architecture.md.

export { engineVersion } from "./version.ts";
export {
  status,
  info,
  warn,
  error,
  header,
  debug,
  setOutputSink,
  setDebugEnabled,
  recentLogs,
  type OutputLevel,
  type OutputSink,
} from "@niclaslindstedt/oss-game-framework/core/output";

// The generic pool the app and the tools reach for.
export {
  createHeightfield,
  fillField,
  sampleField,
  sampleFieldGradient,
  fieldGradient,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
export { createRng, type Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
export {
  fromEuler,
  toEuler,
  rotate,
  unrotate,
  multiply,
  normalize,
  identity,
  type Quat,
} from "@niclaslindstedt/oss-game-framework/core/quat";
export {
  angleDiff,
  clamp,
  hypot,
  hypot3,
  hypot4,
  lerp,
  TAU,
} from "@niclaslindstedt/oss-game-framework/core/math";
export {
  hash2,
  noiseField,
  sampleNoise,
  valueNoise,
} from "@niclaslindstedt/oss-game-framework/core/noise";
export {
  moonAt,
  sunAt,
  SOUTH,
  type MoonPlace,
  type SunPlace,
} from "@niclaslindstedt/oss-game-framework/core/solar";

// THE WORLD (engine/mapgen/): the generator, the Level contract, the track
// queries.
export * from "./mapgen/index.ts";

// The run.
export { createGame, rulesFor, step, FIELD_SIZE, type CreateGameOptions } from "./game/step.ts";
export {
  FULL_ASSIST,
  GAME_MODES,
  MODE_RULES,
  RACE,
  SNOW_DIAL,
  TIME_TRIAL,
  TRICKS_RUN,
  clampSnowDepth,
  freeRules,
  isGameMode,
  openRules,
  raceRules,
  timeTrialRules,
  tricksRules,
  type Assist,
  type GameMode,
  type RunRules,
} from "./game/defs/modes.ts";
export {
  SKIS,
  SKI_CATALOG,
  SWIFT,
  CHOUGH,
  EAGLE,
  MARMOT,
  HARE,
  skisById,
  isSkiId,
  inertiaOf,
  totalMass,
  envelopeOf,
  type SkiId,
  type SkiSpec,
  type LegSpec,
} from "./game/defs/skis.ts";
export { TUNING } from "./game/defs/tuning.ts";
export {
  CROWD,
  CROWD_BODIES,
  CROWD_GROUPS,
  CROWD_KINDS,
  CROWD_SIZE,
  TURN_STYLES,
  type AmateurKnobs,
  type CrowdBody,
  type CrowdKind,
  type GroupKind,
  type TurnStyle,
} from "./game/defs/crowd.ts";
export {
  clipCrowd,
  createCrowd,
  crowdNet,
  stepCrowd,
  type CrowdNet,
  type NetRun,
} from "./game/crowd.ts";
export {
  NEUTRAL_INPUT,
  type CraftState,
  type CrashCause,
  type Save,
  type SaveKind,
  type DamagePart,
  type SkierDamage,
  type Thrown,
  type GameEvent,
  type GamePhase,
  type GameState,
  type Progress,
  type Rival,
  type Amateur,
  type AmateurMode,
  type CrowdGroup,
  type CrowdState,
  type SkierInput,
  type SkierState,
  type LiftRide,
  type SnowContact,
  type BailCause,
  type TrickKind,
  type TrickPart,
  type TrickPose,
  type TrickState,
} from "./game/state.ts";
export { freshSkier, skidAngleAt, dragAreaOf, derive } from "./game/skier.ts";
export {
  probesOf,
  hullOf,
  bootOffset,
  type Probe,
  type HullPoint,
  type Station,
} from "./game/suspension.ts";
export { footprintOf, pressureOf, type Footprint } from "./game/footprint.ts";
export {
  sinkTarget,
  snowDrag,
  powderFloor,
  gripAt,
  onIce,
  restSinkOf,
  snowCoverOf,
  bottomlessOf,
  settleShare,
  packedUnder,
  depthUnder,
  type Grip,
} from "./game/snow.ts";
export {
  driveForce,
  driveReach,
  plantPulse,
  poleForce,
  poleKeepUp,
  poleSweep,
  skateShare,
  strideRate,
  strideShare,
  strideShape,
} from "./game/poles.ts";
export {
  fallHeight,
  landingAhead,
  landingLoad,
  landingLoss,
  landingOff,
  landingTolerance,
  type Landing,
} from "./game/flight.ts";
export { crashLimit, crashOver, noseDown, wipeoutCause, type CrashLimit } from "./game/crash.ts";
export { RAGDOLL, centreOf } from "./game/ragdoll.ts";
export { trenched, trenchGrip } from "./game/trench.ts";
export { dampShare, harshShare, skiBite, skiPull, springShare, takeDamage } from "./game/damage.ts";
export {
  bearingToNext,
  crossedCheckpoint,
  crossedLine,
  crossingsToFinish,
  freeSpawn,
  freshProgress,
  gateLineAt,
  resetPose,
  resetSkier,
  slalom,
  standSkier,
} from "./game/course.ts";
export { collideTrees, keepInBounds, treesNear } from "./game/collision.ts";
export {
  clipRiders,
  createRivals,
  fieldOrder,
  gridSlot,
  raceProgress,
  racePlace,
  stepRivals,
} from "./game/rivals.ts";
export { stepRun } from "./game/run.ts";
export {
  DRAG_ARM,
  LIFT_LOOK,
  carrierAt,
  carrierCount,
  carrierPassing,
  liftPlans,
  queueLane,
  queueSpot,
  QUEUE_GAP,
  planLift,
  ropeAt,
  upRope,
  type LiftKind,
  type LiftLook,
  type LiftPlan,
  type Support,
} from "./game/lift-line.ts";
export { arriveByLift, leadInput, seatedShare, stepLift } from "./game/lift-ride.ts";
export {
  airPointsPerSecond,
  landingGrade,
  freshTricks,
  lengthPointsPerMetre,
  stepTricks,
} from "./game/tricks.ts";
export { poseInput, poseOf, stepStrokes } from "./game/strokes.ts";
export { placeRun, type RunMoment } from "./game/place.ts";
export { moonAgeOn, moonAtRun, sunAtRun, worldHeadingOf } from "./game/clock.ts";
export { windAt, type Wind } from "./game/wind.ts";
export { freshRate, freshStep, snowAt, visibilityIn, type Fall } from "./game/snowfall.ts";
export {
  TOP_SPEED_PITCH,
  brakeDecel,
  carveCurvature,
  cornerGrip,
  edgeLockAt,
  flightGravity,
  harshSpeedOf,
  lockAt,
  terminalSpeed,
  topSpeedOf,
  tipLimit,
} from "./game/limits.ts";

// How hard a map is, and what kind of hard (engine/rating/).
export {
  LADDER,
  RATING,
  RATING_AXES,
  WALL_REACH,
  characterDistance,
  cornerRadius,
  leadingAxis,
  rateLadder,
  rateLevel,
  skyWeight,
  type LadderReport,
  type MapRating,
  type RateOptions,
  type RatingAxes,
} from "./rating/index.ts";

// The bot skier and the headless simulator.
export { botInput, RIDER_BOT, type BotProfile } from "./sim/bot.ts";
export { simulateRun, SIM_SECONDS, type RunReport, type SimOptions } from "./sim/simulate.ts";
