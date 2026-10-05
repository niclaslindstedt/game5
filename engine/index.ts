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
  fieldRules,
  slalomRules,
  SLALOM,
  DOWNHILL,
  downhillRules,
  SUPER_G,
  superGRules,
  SPEED_SKI,
  speedSkiRules,
  DISCIPLINES,
  JURY,
  timeTrialRules,
  tricksRules,
  type Assist,
  type Discipline,
  type GameMode,
  type Jury,
  type RunRules,
} from "./game/defs/modes.ts";
export { juryDay, startGustOf } from "./game/jury.ts";
export {
  DOWNHILL_TECHNIQUE,
  FREE,
  GIANT_SLALOM_TECHNIQUE,
  SLALOM_TECHNIQUE,
  SUPER_G_TECHNIQUE,
  SPEED_SKI_TECHNIQUE,
  TECHNIQUES,
  techniqueOf,
  type Crossing,
  type Technique,
  type TechniqueId,
} from "./game/defs/technique.ts";
export { crossUnderOf, edgeReach } from "./game/incline.ts";
export {
  DOWNHILL_FIELD,
  FIELD,
  SUPER_G_FIELD,
  SPEED_SKI_FIELD,
  createField,
  fieldTimeOf,
  fieldOrderOf,
  fieldPlace,
  startNumbers,
  type Heat,
} from "./game/field.ts";
export {
  DOWNHILL_PAR,
  PAR,
  SUPER_G_PAR,
  SPEED_SKI_PAR,
  downhillPar,
  raceParOf,
  slalomPar,
  speedSkiPar,
  superGPar,
  type Par,
} from "./game/par.ts";
export { stepStrict } from "./game/strict.ts";
export { stepTrap } from "./game/speed-trap.ts";
export { DOWNHILL_NETS, stepNets } from "./game/nets.ts";
export { freshGatePoles, polePlan, stepGatePoles } from "./game/gate-poles.ts";
export {
  SKIS,
  SKI_CATALOG,
  SWIFT,
  CHOUGH,
  EAGLE,
  PEREGRINE,
  FALCON,
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
export { TAIL_RISE, tailRiseOf } from "./game/defs/tails.ts";
export { heldSlip, switchSteer, tailDug } from "./game/switch.ts";
export {
  RIDERS,
  MEDIUM_RIDER,
  riderById,
  isRiderId,
  withRider,
  riderOf,
  type RiddenSpec,
  type RiderId,
  type RiderSpec,
} from "./game/defs/riders.ts";
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
  type BodyState,
  type Injury,
  type Impact,
  type ImpactSource,
  type Thrown,
  type LoneSki,
  type GameEvent,
  type GamePhase,
  type GameState,
  type Progress,
  type Field,
  type FieldRun,
  type GamePoles,
  type RunOut,
  type Rival,
  type Amateur,
  type AmateurMode,
  type CrowdGroup,
  type CrowdState,
  type SkierInput,
  type SkierState,
  type LiftRide,
  type HeliControls,
  type HeliMode,
  type HeliPhaseEvent,
  type HeliState,
  type SledContact,
  type SledControls,
  type SledMode,
  type SledPhaseEvent,
  type SledState,
  type SnowContact,
  type BailCause,
  type TrickKind,
  type TrickPart,
  type TrickPose,
  type TrickState,
} from "./game/state.ts";
export { freshSkier, derive } from "./game/skier.ts";
export { airForce, dragAreaOf, sideAreaOf, type AirForce } from "./game/air.ts";
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
  climbShare,
  driveForce,
  driveReach,
  glideYaw,
  pivotSteps,
  plantPulse,
  poleDuty,
  poleForce,
  poleKeepUp,
  poleSweep,
  skateAngle,
  skateShare,
  skateWork,
  stepQuick,
  stepRound,
  stepWork,
  stepYaw,
  STILL_DRIVE,
  stoodStill,
  strideRate,
  strideShape,
  strideShare,
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
export {
  PART,
  baseOf,
  blowOf,
  bonesOf,
  fracturesOf,
  feelBumps,
  freshBody,
  mendBody,
  markFall,
  riskOf,
  saidOf,
  severityOf,
  snowGive,
  stepBody,
} from "./game/body.ts";
export {
  BODY_PARTS,
  BONES,
  BONE_KINDS,
  INJURIES,
  INJURY,
  pairedBone,
  type BodyPart,
  type Bone,
  type BoneKind,
  type Facing,
  type Fracture,
  type InjuryDef,
  type InjuryKind,
  type Mechanism,
} from "./game/defs/anatomy.ts";
export { dampShare, harshShare, skiBite, skiPull, springShare, takeDamage } from "./game/damage.ts";
export {
  bearingToNext,
  finishRun,
  outRun,
  crossedCheckpoint,
  crossedLine,
  crossingsToFinish,
  freeSpawn,
  freshProgress,
  gateLineAt,
  lineBendAt,
  resetPose,
  resetSkier,
  slalom,
  standSkier,
} from "./game/course.ts";
export {
  lastPiste,
  nearestPiste,
  noteRun,
  pisteHead,
  runUnder,
  skiedResetPoint,
  TRACK_RUN,
} from "./game/skied.ts";
export { collideTrees, keepInBounds, treesNear } from "./game/collision.ts";
export { uprightsNear, type Upright } from "./game/upright-grid.ts";
export { postsOf, solidsNear, solidsOf } from "./game/posts.ts";
export { stakePlan, stepStakes, type StakePlan, type StakeState } from "./game/edge-stakes.ts";
export {
  mastHeight,
  mastLines,
  pisteMasts,
  PISTE_MAST,
  type MastSite,
} from "./game/piste-masts.ts";
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
export { HELI } from "./game/defs/heli.ts";
export {
  HANG_AIR,
  HANG_GROUND,
  freshHeli,
  heliPoint,
  heliWithin,
  heliQuat,
  seatHang,
  startAgain,
  stepHeli,
  thrustMost,
} from "./game/heli.ts";
export { pilotControls, pilotInput, type HeliAim } from "./game/heli-pilot.ts";
export { discQuat, heliMass, ROTOR_AREA, SEAT as HELI_SEAT } from "./game/heli-rotor.ts";
export { helipadOf, type Helipad } from "./game/heli-pad.ts";
export { inducedOf, washAt, type Wash } from "./game/heli-wash.ts";
export {
  SLED,
  SLED_PROBES,
  sledInertia,
  sledMass,
  type SledProbe,
  type SledSuspension,
} from "./game/defs/sled.ts";
export {
  freshSled,
  riderFrame,
  sledControls,
  sledWithin,
  standSled,
  startSled,
  stepSled,
} from "./game/sled.ts";
export { deriveSled, rideSled, sledLockAt } from "./game/sled-body.ts";
export {
  driveForce as sledDriveForce,
  maxDriveForce as sledMaxDrive,
  powerShare as sledPowerShare,
  rpmGoal as sledRpmGoal,
} from "./game/sled-drive.ts";
export { sledSpotOf, type SledSpot } from "./game/sled-pad.ts";
export { sledPilot, type SledAim } from "./game/sled-pilot.ts";
export {
  DRAG_ARM,
  LIFT_LOOK,
  carrierAt,
  carrierCount,
  carrierPassing,
  CHAIR_EXIT,
  chairLane,
  liftPlans,
  clearOfLifts,
  COLUMN_TAPER,
  stationHouses,
  queueLane,
  queueSpot,
  QUEUE_GAP,
  planLift,
  ropeShortfall,
  ropeAt,
  upRope,
  type LiftKind,
  type LiftLook,
  type LiftPlan,
  type StationHouse,
  type Support,
} from "./game/lift-line.ts";
export {
  arriveByLift,
  arrivalOf,
  freeRunOf,
  freeRuns,
  pickFreeRun,
  runsOffTop,
  seatedShare,
  stepLift,
} from "./game/lift-ride.ts";
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
export {
  BODY_HEIGHT,
  GUST_PEAK,
  airAt,
  airflowAt,
  downhillFrom,
  exposureAt,
  profileAt,
  shelterAt,
  windAt,
  windFromOf,
  type AirLevel,
  type AirRider,
  type Airflow,
  type Wind,
} from "./game/wind.ts";
export { freshRate, freshStep, snowAt, visibilityIn, type Fall } from "./game/snowfall.ts";
export {
  TOP_SPEED_PITCH,
  brakeDecel,
  carveCurvature,
  carveMost,
  chatterHold,
  chatterOf,
  cornerGrip,
  cutEdgeAt,
  cutGrip,
  edgeLockAt,
  edgeMostOf,
  flightGravity,
  harshSpeedOf,
  lockAt,
  skidAngleAt,
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
