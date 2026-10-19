// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RESCUE'S PUBLIC SURFACE, re-exported whole by `engine/index.ts`: who
// needs one (`rescue.ts`), and the ski patrol's snowmobiles — the rescue by
// snowmobile planned (`rescue-sled-route.ts`), its machines at a moment and
// stolen (`rescue-sled.ts`) and its numbers (`defs/rescue-sleds.ts`).

export { RESCUE, callRescue, disables, disablingOf, isInjured } from "./rescue.ts";
export {
  freshSledsFrame,
  otherSledWithin,
  rescueSledsAt,
  sledCallGone,
  towOf,
  type OtherSled,
  type RescueSledPose,
  type RescueSledsFrame,
} from "./rescue-sled.ts";
export {
  onRoute,
  planSledRescue,
  type RescueSledPlan,
  type SledPark,
  type SledRoute,
} from "./rescue-sled-route.ts";
export { RESCUE_SLEDS } from "./defs/rescue-sleds.ts";
