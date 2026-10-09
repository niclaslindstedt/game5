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
export { jibAt, jibLength, stepJib } from "./game/jib.ts";
export {
  SLOPE_JUDGING,
  jibDifficulty,
  jibImpression,
  judgeSlopestyle,
  type SlopeScore,
} from "./game/slopestyle-judge.ts";
export {
  SLOPE_FIELD,
  bestRun,
  freshSlopestyle,
  judgeSlopeRun,
  rivalRun,
  runsIn,
  slopeBoard,
  slopeContestAfter,
  slopePhase,
  slopePlace,
  type SlopeContest,
  type SlopePhase,
  type SlopeRow,
  type SlopeRun,
} from "./game/slopestyle-contest.ts";
export {
  PIPE_JUDGING,
  hitsOf,
  isAlleyOop,
  judgeHalfpipe,
  readHit,
  runImpression,
  type HitRead,
  type PipeScore,
} from "./game/halfpipe-judge.ts";
export {
  PIPE_FIELD,
  bestPipeRun,
  freshHalfpipe,
  judgePipeRun,
  pipeBoard,
  pipeContestAfter,
  pipePhase,
  pipePlace,
  pipeRivalRun,
  pipeRunsIn,
  type PipeContest,
  type PipePhase,
  type PipeRow,
  type PipeRun,
} from "./game/halfpipe-contest.ts";
export { PIPE_AIR, pipeHit, pipeLanding, stepPipeAir, type PipeLanding } from "./game/pipe-air.ts";
export {
  MOGUL_PANEL,
  ddOf,
  judgeMoguls,
  scoreMoguls,
  turnQuality,
  type MogulJump,
  type MogulScore,
} from "./game/moguls-judge.ts";
export {
  MOGUL_FIELD,
  MOGUL_PHASES,
  freshMoguls,
  judgeMogulsRun,
  mogulBoard,
  mogulOrder,
  mogulPhase,
  mogulPlace,
  mogulRivalRun,
  mogulsContestAfter,
  paceTimeOf,
  type MogulPhase,
  type MogulRow,
  type MogulRun,
  type MogulsContest,
} from "./game/moguls-contest.ts";
export { TURN_READ, freshTurns, stepMogulTurns, type MogulTurns } from "./game/mogul-turns.ts";
export {
  AERIAL_PANEL,
  aerialTotal,
  airOf,
  dnfOf,
  formOf,
  judgeAerial,
  landingOf,
  middleThree,
  scoreAerial,
  type AerialDnf,
  type AerialSheet,
} from "./game/aerials-judge.ts";
export {
  AERIAL_FIELD,
  AERIAL_PHASES,
  aerialBoard,
  aerialLevelOf,
  aerialOrder,
  aerialPhase,
  aerialPlace,
  aerialRivalJump,
  aerialsContestAfter,
  barredPlans,
  freshAerials,
  judgeAerialRun,
  type AerialJumpRun,
  type AerialPhase,
  type AerialRow,
  type AerialsContest,
} from "./game/aerials-contest.ts";
export {
  AERIAL_FLIGHT,
  aerialFlying,
  freshAerial,
  stepAerial,
  type AerialFlight,
  type AerialRead,
  type FlownFlip,
} from "./game/aerial-flight.ts";
export {
  AERIAL_JUMPS,
  aerialJump,
  codeOf,
  flipsOf,
  isAerialCode,
  kickerOf,
  twistsOf,
  type AerialFlip,
  type AerialJumpRow,
} from "./game/defs/aerial-jumps.ts";
export { MOGUL_ABSORB, absorbedAt, riddenLevel } from "./game/mogul-ride.ts";
export { snowNormal, uprightOn } from "./game/snow-normal.ts";

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
  GIANT_SLALOM,
  giantSlalomRules,
  SPEED_SKI,
  speedSkiRules,
  BIG_AIR,
  bigAirRules,
  HALFPIPE,
  halfpipeRules,
  MOGULS,
  mogulsRules,
  AERIALS,
  aerialsRules,
  JIBS,
  SLOPESTYLE,
  slopestyleRules,
  FREESTYLE,
  type Freestyle,
  SKI_CROSS,
  skiCrossRules,
  skiCrossHeatRules,
  DISCIPLINES,
  JURY,
  RACE_SKIS,
  raceSkisOf,
  RACE_RIDERS,
  raceRiderOf,
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
  SKI_CROSS_TECHNIQUE,
  MOGULS_TECHNIQUE,
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
  GIANT_SLALOM_FIELD,
  SPEED_SKI_FIELD,
  SKI_CROSS_FIELD,
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
  GIANT_SLALOM_PAR,
  giantSlalomPar,
  SPEED_SKI_PAR,
  SKI_CROSS_PAR,
  downhillPar,
  raceParOf,
  slalomPar,
  speedSkiPar,
  skiCrossPar,
  superGPar,
  type Par,
} from "./game/par.ts";
export { stepStrict } from "./game/strict.ts";
export {
  CROSS_DEAL,
  CROSS_ROUNDS,
  QUARTERS,
  advance,
  bracketDone,
  dealHeat,
  finalPlace,
  heatsOf,
  nextHeat,
  placeOrder,
  qualified,
  qualify,
  standings as crossStandings,
  type Bracket,
  type CrossEntry,
  type CrossHeat,
  type CrossPlace,
  type CrossResult,
  type CrossRound,
} from "./game/cross-bracket.ts";
export {
  BIG_AIR_FIELD,
  boardOf,
  contestAfter,
  freshBigAir,
  judgeRun,
  jumpOf,
  jumpsIn,
  nextPhase,
  placeOf,
  rivalJump,
  totalOf,
  type BigAirContest,
  type BigAirJump,
  type BigAirPhase,
  type BigAirRow,
} from "./game/big-air-contest.ts";
export { inRunInput } from "./game/in-run.ts";
export {
  JUDGING,
  difficultyOf,
  impressionOf,
  panelScore,
  readTrick,
  trickKind,
  type TrickRead,
} from "./game/judge.ts";
export { CROSS_HEAT, crossCountdown, heatResult, stepDrafts } from "./game/cross-heat.ts";
export { stepTrap } from "./game/speed-trap.ts";
export { DOWNHILL_NETS, catchInNets, netPocket, stepNets } from "./game/nets.ts";
export { freshGatePoles, polePlan, stepGatePoles } from "./game/gate-poles.ts";
export {
  SKIS,
  SKI_CATALOG,
  SWIFT,
  CHOUGH,
  EAGLE,
  PEREGRINE,
  WOLVERINE,
  FALCON,
  MARMOT,
  HARE,
  RAVEN,
  IBEX,
  KESTREL,
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
export { inCabin } from "./game/crowd-lift.ts";
export { dealEnthusiasts, nightOver, stepEnthusiasts } from "./game/enthusiasts.ts";
export { ENTHUSIASTS } from "./game/defs/enthusiasts.ts";
export type { FreeRider } from "./game/enthusiast-state.ts";
export { throwAmateur } from "./game/crowd-down.ts";
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
  type AfterskiState,
  type Fetch,
  type TownWalk,
  type Wobble,
  type GameEvent,
  type GamePhase,
  type GameState,
  type Progress,
  type Field,
  type FieldRun,
  type GamePoles,
  type RunMark,
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
  type ParaControls,
  type ParaEvent,
  type ParaMode,
  type ParaPhaseEvent,
  type ParaPiece,
  type ParaState,
  type BalloonEvent,
  type BalloonMode,
  type BalloonPhaseEvent,
  type BalloonState,
  type SnowContact,
  type BailCause,
  type TrickKind,
  type TrickPart,
  type TrickPose,
  type TrickState,
  type FlightRecord,
  type JibRecord,
  type JibRide,
  type JibStance,
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
  packedSnow,
  looseOf,
  pisteIce,
  depthUnder,
  type Grip,
} from "./game/snow.ts";
export { pisteDayOf, type PisteDay } from "./game/piste-day.ts";
export { PISTE_DAY } from "./game/defs/piste-day.ts";
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
  hillSide,
  laySkis,
  sidestepEdge,
  sidestepPace,
  sidestepReach,
  sideSteps,
  skiOffsets,
  slideOver,
  slopeOf,
  stepSide,
} from "./game/sidestep.ts";
export {
  fallHeight,
  landingAhead,
  landingLoad,
  landingLoss,
  landingFaults,
  landingOff,
  landingTolerance,
  type Landing,
  type LandingFaults,
} from "./game/flight.ts";
export {
  bodyThrown,
  crashLimit,
  crashOver,
  mayGetUp,
  noseDown,
  throwRider,
  wipeoutCause,
  type CrashLimit,
} from "./game/crash.ts";
export { RAGDOLL, centreOf, stepRagdoll } from "./game/ragdoll.ts";
export { letGo } from "./game/lone-skis.ts";
export { trenched, trenchGrip } from "./game/trench.ts";
export {
  wellAt,
  wellDepthOf,
  wellLoose,
  wellShareOf,
  wellsOf,
  withWells,
} from "./game/tree-well.ts";
export { TREE_WELLS } from "./game/defs/tree-wells.ts";
export {
  FRACTURE_GRADE,
  PART,
  baseOf,
  blowOf,
  bonesOf,
  doseOn,
  energyOver,
  fractureEnergyOf,
  fracturesOf,
  feelBumps,
  freshBody,
  mendBody,
  markFall,
  organsOf,
  organsOfInjury,
  riskOf,
  saidOf,
  severityOf,
  snowGive,
  stepBody,
} from "./game/body.ts";
export { bleedsOf, holdsHim, isDead, stepGore, type Bleed } from "./game/gore.ts";
export { RESCUE, callRescue, disables, disablingOf, isInjured } from "./game/rescue.ts";
export {
  GORE_OPEN,
  GORE_PIECES,
  freshGore,
  lostPiece,
  type DeathCause,
  type GoreOpen,
  type GorePiece,
  type GoreState,
  type Impaled,
  type TornPiece,
} from "./game/gore-state.ts";
export { GORE } from "./game/defs/gore.ts";
export {
  BODY_PARTS,
  BONES,
  BONE_KINDS,
  INJURIES,
  INJURY,
  ORGANS,
  ORGAN_KINDS,
  pairedBone,
  pairedOrgan,
  type BodyPart,
  type Bone,
  type BoneKind,
  type Organ,
  type OrganKind,
  type Facing,
  type Fracture,
  type InjuryDef,
  type InjuryKind,
  type Mechanism,
} from "./game/defs/anatomy.ts";
export { dampShare, harshShare, skiBite, skiPull, springShare, takeDamage } from "./game/damage.ts";
export {
  hurtDrive,
  hurtEdge,
  hurtGrip,
  hurtLanding,
  hurtOf,
  hurtRate,
  hurtTuck,
  stepHurt,
} from "./game/hurt.ts";
export { HURT } from "./game/defs/hurt.ts";
export type { Hurt } from "./game/hurt-state.ts";
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
  forgetRun,
  lastPiste,
  leftRunPoint,
  nearestPiste,
  noteRun,
  pisteHead,
  runUnder,
  skiedResetPoint,
  topOfSlope,
  TRACK_RUN,
} from "./game/skied.ts";
export { GRIMBEAR } from "./game/defs/grimbear.ts";
export { freshGrimbear, stepGrimbear, type GrimbearAsk } from "./game/grimbear.ts";
export type { GrimbearPhase, GrimbearState } from "./game/grimbear-state.ts";
export { GROOMER } from "./game/defs/groomer.ts";
export {
  freshGroomers,
  groomerCount,
  groomersOut,
  groomerStrike,
  groomerWithin,
  onSkis,
  seatOf,
  stepGroomers,
  type GroomerAsk,
} from "./game/groomer.ts";
export {
  freshGroomed,
  GROOM_CELL,
  groomCellOf,
  groomedFresh,
  groomSegment,
} from "./game/groomed.ts";
export type { GroomedSnow, GroomerEvent, GroomerMode, GroomerState } from "./game/groomer-state.ts";
export { collideTrees, keepInBounds, treesNear } from "./game/collision.ts";
export { uprightsNear, type Stuff, type Upright } from "./game/upright-grid.ts";
export { postsOf, solidsNear, solidsOf } from "./game/posts.ts";
export {
  gunSeason,
  gunSolid,
  machineSnowAt,
  machineSnowOf,
  nozzleOf,
  snowGunsOf,
  snowGunsOut,
  snowGunsRun,
  standingGuns,
  whaleOf,
  whaleShare,
  type MachineSnow,
  type SnowGun,
  type SnowGunMount,
  type Whale,
} from "./game/snow-guns.ts";
export { SNOW_GUN } from "./game/defs/snow-guns.ts";
export { cabinsOf, type Cabin } from "./game/cabins.ts";
// A building's walls, its doorway and its door (`building-walls.ts`).
export * from "./game/building-walls.ts";
export * from "./game/defs/building-walls.ts";
// A door opened: the leaves, the skier's move through it (`doorway.ts`).
export * from "./game/doorway.ts";
export { DOOR } from "./game/defs/doors.ts";
export {
  CABINS,
  CABIN_LAYOUT,
  type CabinDef,
  type CabinKind,
  type LogKind,
} from "./game/defs/cabins.ts";
// THE SKI AREA'S BUILDINGS AND THE VILLAGE'S STREETS: where they stand, the
// plan, what it carries, the questions asked of it.
export * from "./game/village-api.ts";
export * from "./game/traffic-api.ts";
export {
  hashOf as rockHash,
  onAnyCliff,
  rockShare,
  rockyCliff,
  unit as rockDraw,
  wallOf,
} from "./game/rocks.ts";
export { ROCKS } from "./game/defs/rocks.ts";
export { cliffWalls, faceShare, wallSolids, type CliffWall } from "./game/cliff-wall.ts";
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
export { HELI_BLADES, HELI_GRIP } from "./game/defs/heli-grip.ts";
export { WRECK, fireFlux, fireballAt, fireballGrowth, fireballOf } from "./game/defs/heli-wreck.ts";
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
export { bladeAt, fallsIntoRotor, gripLoad, rotorStrike } from "./game/heli-grip.ts";
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
export { PARA, pilotMass as paraPilotMass } from "./game/defs/para.ts";
export {
  freshPara,
  paraControls,
  paraRigged,
  paraStartOf,
  startPara,
  stepPara,
} from "./game/para.ts";
export { paraPilot } from "./game/para-pilot.ts";
export { eddyUp, paraAirAt, type ParaAir } from "./game/para-air.ts";
export {
  BALLOON,
  BALLOON_CENTRE,
  BALLOON_EMPTY,
  BALLOON_PLAN,
  BALLOON_SIDE,
} from "./game/defs/balloon.ts";
export {
  balloonAboard,
  balloonDown,
  balloonSiteOf,
  balloonTrim,
  freshBalloon,
  standingPoint as balloonStandingPoint,
  startBalloon,
  stepBalloon,
  walkMostX as balloonWalkMostX,
  walkMostZ as balloonWalkMostZ,
} from "./game/balloon.ts";
export { balloonPilot, PILOT_HOLD as BALLOON_PILOT_HOLD } from "./game/balloon-pilot.ts";
export {
  BALLOON_AIR,
  airDensity as balloonAirDensity,
  airKelvin as balloonAirKelvin,
  airPressure as balloonAirPressure,
  balloonWindAt,
  upValley,
} from "./game/balloon-air.ts";
export {
  DRAG_ARM,
  LIFT_LOOK,
  carrierAt,
  carrierCount,
  carrierPassing,
  carrierSpeedAt,
  carrierGripAt,
  CHAIR_EXIT,
  chairLane,
  liftPlans,
  clearOfLifts,
  COLUMN_TAPER,
  stationHouses,
  queueLane,
  queueSpot,
  BOARDING_RING,
  boardingRing,
  letGoOf,
  ringFrame,
  CORRAL_TAIL,
  ringWalk,
  QUEUE_GAP,
  planLift,
  ropeShortfall,
  ruledLiftPlans,
  pisteGap,
  TOWER_PAD,
  TOWER_SITE,
  ropeAt,
  upRope,
  type LiftKind,
  type LiftLook,
  type LiftPlan,
  type StationHouse,
  type Support,
} from "./game/lift-line.ts";
export { carrierSwingAt } from "./game/carrier-swing.ts";
export {
  arriveByLift,
  arrivalOf,
  cabinDoors,
  chairStrike,
  emptyChairAt,
  freeRunOf,
  freeRuns,
  pickFreeRun,
  runsOffTop,
  seatedShare,
  stepLift,
} from "./game/lift-ride.ts";
export { CABIN_HALF, carrierNear, gondolaGrip, platformOf, railAt } from "./game/lift-board.ts";
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
export {
  afterskiNear,
  afterskiWithin,
  doorOf,
  freshAfterski,
  insideOf,
  lodgesOf,
  stepAfterski,
} from "./game/afterski.ts";
export {
  buzzLimit,
  buzzOf,
  drunkInput,
  fetchesSkis,
  getUp,
  soberUp,
  stepFetch,
} from "./game/buzz.ts";
export { AFTERSKI, BUZZ } from "./game/defs/afterski.ts";
export { TOWN } from "./game/defs/town.ts";
export { TOWN_KEYS, strideBob, stridePace, townEase, townShare } from "./game/town.ts";
