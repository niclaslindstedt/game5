// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A CIVILIAN KNOCKED, POSED — the person's figure hung on his ragdoll
// (`civilian-knock.ts`) the way an amateur down is (`crowd-fall.ts`): the
// ragdoll's points read as the player's thrown pose (`ragdollPose`), turned
// into the crowd's joints (`fromPlayer`) and sized to his body. Three-free.
//
// The ragdoll is the reference man's, and a body is sized to his own
// height ABOUT HIS HIPS — right for a body lying, where every limb is laid
// round them, but a child stood on the reference man's long legs would hang
// his feet in the air. So the smaller the body the more of the figure is
// set down onto the ragdoll's feet as he stands up: all of it stood, none
// of it lying flat.

import { RAGDOLL as R, type CrowdBody } from "@engine";

import { lyingPose } from "./crowd-fall.ts";
import { mapPosed, type Posed, type V3 } from "./crowd-rig.ts";

/** HIS FIGURE on the ragdoll's `points` (world), in the world less
 * `anchor`. */
export function knockedPose(points: readonly number[], body: CrowdBody, anchor: V3): Posed {
  const posed = lyingPose(points, body, anchor);
  const at = (i: number): V3 => [points[3 * i], points[3 * i + 1], points[3 * i + 2]];
  const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const hips = mid(at(R.hipL), at(R.hipR));
  const neck = mid(at(R.shoulderL), at(R.shoulderR));
  const sx = neck[0] - hips[0];
  const sy = neck[1] - hips[1];
  const sz = neck[2] - hips[2];
  const up = sy / (Math.hypot(sx, sy, sz) || 1);
  const stood = Math.max(0, Math.min(1, (up - 0.35) / 0.5));
  if (stood <= 0) return posed;
  // The ragdoll's ankles, and the figure's.
  const feet = mid(at(R.footL), at(R.footR));
  const want: V3 = [feet[0] - anchor[0], feet[1] - anchor[1], feet[2] - anchor[2]];
  const has = mid(posed.ankleL, posed.ankleR);
  const dx = (want[0] - has[0]) * stood;
  const dy = (want[1] - has[1]) * stood;
  const dz = (want[2] - has[2]) * stood;
  return mapPosed(posed, (p) => [p[0] + dx, p[1] + dy, p[2] + dz]);
}
