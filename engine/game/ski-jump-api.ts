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
} from "./jump-inrun.ts";
export { idealAoa, jumpFlying, polarAt } from "./jump-flight.ts";
export type {
  JumpLanding,
  JumpOutcome,
  JumpRecord,
  JumpStage,
  SkiJumpState,
} from "./ski-jump-state.ts";
