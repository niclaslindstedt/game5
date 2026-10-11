// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SKI JUMPING's half of the engine's public surface (R43): the jumping ski,
// the pairs a mode rides beside the catalog, and the mode's numbers — stated
// here so `engine/index.ts` stays under its line cap. The hill itself is the
// generator's (`mapgen/ski-jump.ts`, exported with the rest of `mapgen/`).

export { ALBATROSS, ALL_SKIS, MODE_SKIS } from "./defs/skis.ts";
export { SKI_JUMP, skiJumpRules } from "./defs/ski-jump.ts";
export { JUMP } from "./defs/ski-jump-flight.ts";
export { stepSkiJump } from "./ski-jump.ts";
export {
  freshJump,
  gateSpeed,
  hillDensity,
  juryGate,
  pushShare,
  slopeAt,
  timeToEdge,
  windAlong,
} from "./jump-inrun.ts";
export { idealAoa, jumpFlying, polarAt } from "./jump-flight.ts";
export type {
  JumpLanding,
  JumpOutcome,
  JumpRecord,
  JumpStage,
  SkiJumpState,
} from "./ski-jump-state.ts";
export { HILL_AIR } from "./defs/ski-jump.ts";
export {
  hillAirAt,
  hillAirOf,
  hillMeanAt,
  measuredAt,
  stationsOf,
  stationTimes,
  type HillAir,
  type HillWind,
} from "./jump-wind.ts";
export {
  JUMP_PANEL,
  deductionsOf,
  distancePoints,
  gatePoints,
  judgeJump,
  marksFor,
  noStart,
  scoreJump,
  styleOf,
  tenth,
  windPoints,
  type JumpScore,
  type JumpScoring,
} from "./ski-jump-judge.ts";
export {
  SKI_JUMP_DAY,
  SKI_JUMP_FIELD,
  SKI_JUMP_PAR,
  fileSkiJump,
  finalists,
  freshSkiJumpContest,
  gateFor,
  judgeSkiJumpRun,
  jumpVenueOf,
  jumperLevelOf,
  parDistance,
  rivalJump,
  roundPlan,
  skiJumpBoard,
  skiJumpContestAfter,
  skiJumpPlace,
  skiJumpRoundOf,
  skiJumpSetup,
  skiJumpStandings,
  skipTrial,
  startList,
  type JumpRow,
  type JumpRun,
  type JumpStanding,
  type JumpVenue,
  type RoundPlan,
  type SkiJumpContest,
  type SkiJumpRound,
} from "./ski-jump-contest.ts";
