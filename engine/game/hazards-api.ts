// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A FREE RIDE'S HAZARDS OFF THE PISTE, as the engine's public surface
// re-exports them (`engine/index.ts`): the grimbear in the woods
// (`grimbear.ts`) and the avalanche on a loaded slope (`avalanche.ts`), each
// with its numbers and its state.

export { GRIMBEAR } from "./defs/grimbear.ts";
export { freshGrimbear, stepGrimbear, type GrimbearAsk } from "./grimbear.ts";
export type { GrimbearPhase, GrimbearState } from "./grimbear-state.ts";
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
export {
  CELL as AVALANCHE_CELL,
  type AvalancheEvent,
  type AvalancheState,
  type AvalancheVictim,
  type SlabFrame,
  type Slide,
} from "./avalanche-state.ts";
