// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S TRAFFIC, as the engine's public surface re-exports it
// (`engine/index.ts`): the plan and a vehicle at a moment (`traffic.ts`),
// a skier met by one (`traffic-contact.ts`) and the numbers it is all
// dealt and driven by (`defs/traffic.ts`).

export {
  axleToMiddle,
  freshVehiclePose,
  nearTraffic,
  parkedCars,
  trafficOf,
  vehicleAt,
  vehicleCount,
  type Parked,
  type TrafficPlan,
  type Vehicle,
  type VehiclePose,
} from "./traffic.ts";
export { trafficStrike, type TrafficEvent } from "./traffic-contact.ts";
export {
  DRIVES,
  TRAFFIC,
  TRAFFIC_STRIKE,
  VEHICLES,
  type Drive,
  type VehicleKind,
  type VehicleSize,
} from "./defs/traffic.ts";
export { TRAFFIC_SALT } from "./traffic-plan.ts";
