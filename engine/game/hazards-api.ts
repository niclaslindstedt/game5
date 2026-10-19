// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A FREE RIDE'S HAZARDS OFF THE PISTE, as the engine's public surface
// re-exports them (`engine/index.ts`): the grimbear in the woods
// (`grimbear.ts`), the avalanche on a loaded slope (`avalanche.ts`) and the
// camp fires and bonfires a skier can ride into (`fires.ts`,
// `fire-burn.ts`), each with its numbers and its state.

export { GRIMBEAR } from "./defs/grimbear.ts";
export { freshGrimbear, stepGrimbear, type GrimbearAsk } from "./grimbear.ts";
export type { GrimbearPhase, GrimbearState } from "./grimbear-state.ts";
// THINGS THAT GO WRONG IN THE AIR (`mishaps.ts`): its numbers and stream.
export * from "./mishaps.ts";
export { AVALANCHE } from "./defs/avalanche.ts";
export {
  avalancheHazard,
  avalancheHolds,
  debrisDepth,
  freshAvalanche,
  loadOf as avalancheLoad,
  release as releaseAvalanche,
  steepShare,
  stepAvalanche,
  survivalMinutes,
} from "./avalanche.ts";
export { AVALANCHE_RESCUE } from "./defs/avalanche-rescue.ts";
export { burialOf, patrolMan, patrolReach, type PatrolMan } from "./avalanche-rescue.ts";
export {
  CELL as AVALANCHE_CELL,
  type AvalancheEvent,
  type AvalancheState,
  type AvalancheVictim,
  type Beacon,
  type Burial,
  type BuriedWho,
  type Patrol,
  type PatrolAct,
  type ProbeHole,
  type SlabFrame,
  type Slide,
} from "./avalanche-state.ts";
export { firesNear, firesOf, type Fire, type FireSeat } from "./fires.ts";
export { fireStrike, stepBurn, type BurnState } from "./fire-burn.ts";
export { sledBallAt, sledFireFlux } from "./sled-fire.ts";
export { SLED_FIRE } from "./defs/sled-fire.ts";
export { FIRE_BURN, FIRE_KINDS, FIRE_LAYOUT, type FireDef, type FireKind } from "./defs/fires.ts";
// THE WANTED LEVEL (`wanted.ts`): the army hunting a skier who stole a
// helicopter — its numbers, its state and its hook (`raiseHeat`).
export {
  WANTED,
  type GroundWaves,
  type PursuerKind,
  type WantedCause,
  type WantedRoster,
  type WaveMix,
} from "./defs/wanted.ts";
export {
  arrestSkier,
  arrestedOf,
  freshWanted,
  groundWave,
  quarryOf,
  raiseHeat,
  rosterOf,
  seesQuarry,
  setWanted,
  stepWanted,
  survivedOf,
  wavesSent,
} from "./wanted.ts";
export type { Pursuer, WantedEnd, WantedEvent, WantedState } from "./wanted-state.ts";
