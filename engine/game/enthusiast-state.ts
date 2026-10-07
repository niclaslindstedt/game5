// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT AN ENTHUSIAST KEEPS (`enthusiasts.ts`) — `Rival.free`, beside the
// whole run every rival is.

import type { RiderId } from "./defs/riders.ts";

/** His look (a number the app deals his outfit off — the engine never reads
 * it), the build he skis at, the run of the crowd's network he is skiing
 * (`crowdNet`), and how long he has been stood still, lost or waiting at
 * the bottom, s. */
export type FreeRider = {
  look: number;
  rider: RiderId;
  run: number;
  still: number;
  /** How many times he has gone up a lift: the seed of his next pick. */
  laps: number;
  /** Down at the village and stopping: the lift waits for him. */
  down: boolean;
  /** Skiing his run from the head of the ramp off its top
   * (`Lift.ramps`), having come up the lift. */
  ramped: boolean;
  /** Whether he has had his skis on his run since he came up a lift. */
  on: boolean;
  /** Seconds left skiing straight off the lift he was stood off. */
  unload: number;
};
