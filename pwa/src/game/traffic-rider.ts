// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CYCLIST, POSED — a winter cyclist on the village's streets
// (`traffic.ts`'s bicycles) drawn on the crowd's own bodies in their winter
// kit (`civilian-shapes.ts`' `buildPosedFigure`, the keys laid on them by
// `civilian-moves.ts`' `keyPosed`): sat on the saddle, his hands on the
// grips, his feet on the pedals as the cranks turn. The cranks' turn is
// EIGHT KEYS a revolution apart by an eighth (`PEDAL_POSES`), each foot on
// its pedal where the crank puts it (the ball of the foot on the spindle,
// the ankle over and behind it), the other foot half a turn on; a moment
// is the blend of the two keys either side of it (`pedalDials`). The
// cranks turn once for `PEDAL_STRIDE` m ridden — a winter cyclist's easy
// gear, some 60 turns a minute at 13 km/h. Three-free, so the suite reads
// it. The frame is the bicycle's (`traffic-look.ts`' `BIKE`): x right,
// y up off the road, z forward, the bicycle's middle at 0.

import type { CrowdBody } from "@engine";

import type { Holding } from "./civilian-moves.ts";
import { keyPosed } from "./civilian-moves.ts";
import { CROWD_LOOKS, type Posed } from "./crowd-rig.ts";
import { STAND, blend, v, type Key } from "./party-pose.ts";
import { BIKE } from "./traffic-look.ts";

/** How far a turn of the cranks carries the bicycle, m. */
export const PEDAL_STRIDE = 3.6;

/** How many keys a turn of the cranks is drawn between. */
export const PEDAL_KEYS = 8;

/** The targets, the base (the right crank straight up) first: every one a
 * whole body, the cranks an eighth of a turn further on. */
export const PEDAL_POSES = Array.from({ length: PEDAL_KEYS - 1 }, (_, i) => `pedal${i + 1}`);

/** Where the ankle rides over a pedal's spindle: up and back of it. */
const OVER = { y: 0.08, z: -0.07 };

/** SAT ON THE BICYCLE with the right crank at `angle` (rad from straight
 * up, turning forward): the hips over the saddle, the trunk leant forward
 * to the bars, the head up to see ahead. */
export function pedalKey(angle: number): Key {
  const B = BIKE;
  const key = blend(STAND, STAND, 0);
  key.hipY = B.saddle.y + 0.06;
  key.hipZ = B.saddle.z + 0.02;
  key.hipX = 0;
  key.pitch = 0.5;
  key.nod = -0.32;
  key.roll = 0;
  key.twist = 0;
  const foot = (a: number, x: number) =>
    v(x, B.bb.y + Math.cos(a) * B.crank + OVER.y, B.bb.z + Math.sin(a) * B.crank + OVER.z);
  key.feet = [foot(angle + Math.PI, -0.12), foot(angle, 0.12)];
  key.hands = [v(-B.grips.x, B.grips.y, B.grips.z), v(B.grips.x, B.grips.y, B.grips.z)];
  // The hips rock a little over the pushing leg.
  key.roll = 0.04 * Math.sin(angle);
  return key;
}

const EMPTY: Holding = { tool: "hold", tip: 0 };

/** The skeleton of every target of `body`, the base first — what the
 * figure is built at. */
export function pedalTargets(body: CrowdBody): { posed: Posed; holding: Holding }[] {
  const look = CROWD_LOOKS[body];
  return Array.from({ length: PEDAL_KEYS }, (_, i) => ({
    posed: keyPosed(pedalKey((i / PEDAL_KEYS) * Math.PI * 2), look),
    holding: EMPTY,
  }));
}

/** THE WEIGHTS of a moment `rolled` m into the ride, one a target in
 * `PEDAL_POSES`' order, into `out` (relative to the base): the two keys
 * either side of the cranks' turn blended. */
export function pedalDials(rolled: number, out: Float32Array | number[]): void {
  out.fill(0);
  const turn = rolled / PEDAL_STRIDE;
  const x = (turn - Math.floor(turn)) * PEDAL_KEYS;
  const q = Math.floor(x) % PEDAL_KEYS;
  const f = x - Math.floor(x);
  const q1 = (q + 1) % PEDAL_KEYS;
  if (q > 0) out[q - 1] += 1 - f;
  if (q1 > 0) out[q1 - 1] += f;
}
