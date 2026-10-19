// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHO IS SENT FOR A CASUALTY — the one choice between the air ambulance
// and the ski patrol on snowmobiles, made wherever a rescue is called: a
// run that ends injured (`rescue-book.ts`) and an amateur down mid-run
// (`crowd-calls.ts`). Where a machine can set down near him (`fitToLand`)
// it is flown in (`planFlight`); where none can, the patrol drives up to
// him (`planSledRescue`) — and where the patrol has no way up either, the
// air ambulance comes anyway, to the flattest seat it finds.
//
// DOM-free and three-free; a pure function of the map and where he lies.

import { planSledRescue, type Level, type RescueCall, type RescueSledPlan } from "@engine";

import { planFlight, type Called, type RescueFlight } from "./rescue-flight.ts";
import { fitToLand } from "./rescue-plan.ts";

/** What is sent: a flight, or the patrol's plan. */
export type Dispatched =
  { flight: RescueFlight; sleds: null } | { flight: null; sleds: RescueSledPlan };

/** THE RESCUE SENT for `casualties` (the first is where it goes). */
export function dispatchRescue(level: Level, casualties: readonly Called[]): Dispatched {
  const at = casualties[0];
  const sleds = fitToLand(level, at) ? null : planSledRescue(level, at);
  return sleds ? { flight: null, sleds } : { flight: planFlight(level, casualties), sleds: null };
}

/** THE PATROL'S CALL as a run carries it: made at `start` on the run's
 * clock and over at `end`, its first machine's stop as its site. */
export function sledCall(
  plan: RescueSledPlan,
  start: number,
  end: number,
  casualties: RescueCall["casualties"],
  taken: readonly (number | null)[],
): RescueCall {
  const p = plan.park[0];
  return {
    start,
    site: { x: p.x, y: 0, z: p.z, heading: p.heading, pitch: 0, roll: 0 },
    down: end,
    up: end,
    casualties,
    kind: "sled",
    sleds: plan,
    sledsTaken: [...taken],
  };
}
