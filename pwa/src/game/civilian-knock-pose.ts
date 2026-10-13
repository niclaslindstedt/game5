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

import { civilianPosed, moveOf } from "./civilian-moves.ts";
import { lyingPose } from "./crowd-fall.ts";
import { mapPosed, type Posed, type V3 } from "./crowd-rig.ts";
import { keyPoints } from "./party-pose.ts";

/** Where a body's ankles stand off the ragdoll's feet when he is drawn on
 * his feet (`keyPosed`: lifted onto his soles, a little forward) — so a
 * person stood on the ragdoll is drawn exactly as stood in his routine,
 * and the hand-overs between the two ways of drawing him do not jump. */
const SOLES = new Map<CrowdBody, V3>();
function solesOf(body: CrowdBody): V3 {
  let off = SOLES.get(body);
  if (!off) {
    const p = keyPoints(moveOf("stand").key, 0);
    const posed = civilianPosed(body, "stand");
    const f = (i: number): number => (p[3 * R.footL + i] + p[3 * R.footR + i]) / 2;
    const a = (i: number): number => (posed.ankleL[i] + posed.ankleR[i]) / 2;
    off = [a(0) - f(0), a(1) - f(1), a(2) - f(2)];
    SOLES.set(body, off);
  }
  return off;
}

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
  // Stood onto his soles, the offset turned to the way he faces (his
  // right off the hips, ahead square to it).
  const sole = solesOf(body);
  const hr = at(R.hipR);
  const hl = at(R.hipL);
  const rl = Math.hypot(hr[0] - hl[0], hr[2] - hl[2]) || 1;
  const rx = (hr[0] - hl[0]) / rl;
  const rz = (hr[2] - hl[2]) / rl;
  const want: V3 = [
    feet[0] - anchor[0] + rx * sole[0] - rz * sole[2],
    feet[1] - anchor[1] + sole[1],
    feet[2] - anchor[2] + rz * sole[0] + rx * sole[2],
  ];
  const has = mid(posed.ankleL, posed.ankleR);
  const dx = (want[0] - has[0]) * stood;
  const dy = (want[1] - has[1]) * stood;
  const dz = (want[2] - has[2]) * stood;
  return mapPosed(posed, (p) => [p[0] + dx, p[1] + dy, p[2] + dz]);
}
