// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE, as the engine's public surface re-exports it
// (`engine/index.ts`): its numbers, its bodies, the game's handling of it,
// the pose the drawing reads and the bot's hands.
export { BIKE, bikeMass, type BikeEnd } from "./defs/bike.ts";
export {
  BB as BIKE_BB,
  REAR_AXLE as BIKE_REAR_AXLE,
  STEER_AXIS as BIKE_STEER_AXIS,
  TRAIL as BIKE_TRAIL,
  WHEELBASE as BIKE_WHEELBASE,
  frontAxleAt as bikeFrontAxleAt,
  springsFor as bikeSpringsFor,
} from "./bike-geometry.ts";
export {
  absorbOf,
  bikeSteerFor,
  bikeTurnAsked,
  rideBike,
  type BikeRide,
  type BikeStepReport,
  type BikeWorld,
} from "./bike-body.ts";
export {
  bikeToWorld,
  derive as deriveBike,
  massCentre as bikeMassCentre,
  riderOnFrame,
} from "./bike-frame.ts";
export { freshBike, placeBike } from "./bike-place.ts";
export {
  crashOf as crashBike,
  startLanding,
  stepLanding,
  type BikeZone,
  type ZonedWorld,
} from "./bike-judge.ts";
export type * from "./bike-state.ts";
export { bikeControls, bikeInput, bikeWithin, freshBikeRide, startBike, stepBike } from "./bike.ts";
export { bikeWorldOf, zoneAt as bikeZoneAt } from "./bike-world.ts";
export { bikePose, type BikePose } from "./bike-pose.ts";
