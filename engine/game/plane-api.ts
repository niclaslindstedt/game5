// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE, as the engine's public surface re-exports it
// (`engine/index.ts`): its numbers (`defs/plane.ts`), its state, its flight
// (`plane.ts`, the air on it `plane-aero.ts`), its strip (`airstrip.ts`)
// and the bot's hands on it (`plane-pilot.ts`).

export { PLANE, planeMass } from "./defs/plane.ts";
export { AIR_BOUNDS } from "./defs/air-bounds.ts";
export type {
  PlaneControls,
  PlaneEvent,
  PlaneMode,
  PlanePhaseEvent,
  PlaneState,
} from "./plane-state.ts";
export {
  THREE_POINT,
  freshPlane,
  planeAloft,
  planeAboard,
  planeDown,
  planePoint,
  planeWithin,
  startPlane,
  stepPlane,
} from "./plane.ts";
export { COG as PLANE_COG, SECTIONS as PLANE_SECTIONS, planeAir, thrustAt } from "./plane-aero.ts";
export type { PlaneAir } from "./plane-aero.ts";
export { STRIP_LENGTH, airstripOf, onStrip, type Airstrip, type StripPoint } from "./airstrip.ts";
export {
  HANDS as PLANE_HANDS,
  homeControls,
  jumpSpotOf,
  planeFlight,
  planeHold,
  planeInput,
  type PlaneWant,
} from "./plane-pilot.ts";
export { airBounds, airBoundsAt, type AirBounds } from "./collision.ts";
