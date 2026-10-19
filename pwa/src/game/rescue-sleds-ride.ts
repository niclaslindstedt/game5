// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PATROL SAT ON ITS SNOWMOBILES — the two poses a patroller rides in
// (`SLED_SEATS`): the DRIVER astride the front of the seat, his boots on
// the running boards either side of the tunnel, his knees out round the
// seat, leaning a little into the bars with both hands on the grips; the
// PASSENGER astride behind him, sat up higher on the back of the seat over
// the tail pack, his boots on the boards' back ends and his hands on the
// grab handles at his hips. Keys of a body in its boots (`party-pose.ts`)
// laid on each crowd body by `keyPosed`, added to the air crew's targets
// (`crewTargets`) so the walk, the step off and the ride blend in one
// figure. Three-free, so the suite reads it.
//
// THE FRAME: the patroller's own, the floor at the running boards — the
// view hangs a seated figure `SEAT_RISE` under the seat's top the crew's
// plan sits him at (`SledCrewFrame.crew`). Every height is written for the
// MACHINE (the boards, the seat, the grips are where the model has them,
// `sled-look.ts`) and divided by the body's own scale, so a short
// patroller's hips are on the seat as a tall one's are.

import type { CrowdBody } from "@engine";

import type { Holding } from "./civilian-moves.ts";
import { keyPosed } from "./civilian-moves.ts";
import { CROWD_LOOKS, type Posed } from "./crowd-rig.ts";
import { ANKLE, v, type Key } from "./party-pose.ts";
import { crewTargets } from "./rescue-crew.ts";
import { SLED_CREW } from "./rescue-sleds-crew.ts";
import { SLED_LOOK } from "./sled-look.ts";

/** The running boards over the snow under the belt, m (the trace's tunnel
 * floor where the boards run). */
export const BOARDS = 0.36;

/** How far each seat's top is over the boards, m. */
export const SEAT_RISE = {
  driver: SLED_CREW.seats.driver.up - BOARDS,
  passenger: SLED_CREW.seats.passenger.up - BOARDS,
} as const;

/** The seat's give and the hips' joint over the seat's top, m. */
const HIP_OVER = 0.1;

/** The grips off the driver's seat point (the trace's grip, its bar's width
 * less a glove), m: across, over the boards, ahead. */
const GRIPS = {
  x: SLED_LOOK.barWidth / 2 - 0.05,
  y: SLED_LOOK.grip[1] - BOARDS,
  z: SLED_LOOK.grip[0] - (3.2 / 2 + SLED_CREW.seats.driver.along) - 0.02,
};

/** THE TWO RIDES, in the machine's metres. */
function rideKey(place: "driver" | "passenger"): Key {
  if (place === "driver") {
    return {
      hipY: SEAT_RISE.driver + HIP_OVER,
      hipX: 0,
      hipZ: -0.2,
      pitch: 0.32,
      roll: 0,
      twist: 0,
      nod: -0.22,
      feet: [v(-0.27, ANKLE, 0.16), v(0.27, ANKLE, 0.16)],
      hands: [v(-GRIPS.x, GRIPS.y, GRIPS.z), v(GRIPS.x, GRIPS.y, GRIPS.z)],
      kneesOut: 0.22,
      elbowsOut: 0.2,
    };
  }
  return {
    hipY: SEAT_RISE.passenger + HIP_OVER,
    hipX: 0,
    hipZ: -0.08,
    pitch: 0.12,
    roll: 0,
    twist: 0,
    nod: -0.05,
    feet: [v(-0.27, ANKLE, 0.3), v(0.27, ANKLE, 0.3)],
    hands: [
      v(-0.27, SEAT_RISE.passenger + 0.05, -0.05),
      v(0.27, SEAT_RISE.passenger + 0.05, -0.05),
    ],
    kneesOut: 0.2,
    elbowsOut: 0.05,
  };
}

/** A key's every length over `k` (the body's scale on the reference man),
 * so that once `keyPosed` scales it back it stands at the machine's metres. */
function unscaled(key: Key, k: number): Key {
  const s = (p: { x: number; y: number; z: number }) => v(p.x / k, p.y / k, p.z / k);
  return {
    ...key,
    hipY: key.hipY / k,
    hipX: key.hipX / k,
    hipZ: key.hipZ / k,
    feet: [s(key.feet[0]), s(key.feet[1])],
    hands: [s(key.hands[0]), s(key.hands[1])],
  };
}

/** The two rides' place in the morph targets after the air crew's. */
export const RIDES = ["driver", "passenger"] as const;

const EMPTY: Holding = { tool: "hold", tip: 0 };

/** A ride's skeleton on `body`. */
export function ridePosed(body: CrowdBody, place: "driver" | "passenger"): Posed {
  const look = CROWD_LOOKS[body];
  return keyPosed(unscaled(rideKey(place), look.height / 1.8), look);
}

/** THE PATROLLER'S TARGETS: the air crew's (the stance first), then the
 * driver's and the passenger's rides. */
export function patrolTargets(body: CrowdBody): { posed: Posed; holding: Holding }[] {
  return [
    ...crewTargets(body),
    ...RIDES.map((place) => ({ posed: ridePosed(body, place), holding: EMPTY })),
  ];
}
