// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI LET GO (`lone-skis.ts`) AS DRAWN: the world matrix the drawn ski
// is laid by, out of the engine's lone ski — read by `skis-body.ts`.

import * as THREE from "three";
import type { LoneSki } from "@engine";

const lifted = [0, 0, 0, 0, 0, 0];
const tipward = new THREE.Vector3();
const upward = new THREE.Vector3();
const rightward = new THREE.Vector3();

/** A ski let go (`lone-skis.ts`) as a world matrix in the frame the drawn
 * ski is built in: at its boot centre on the base, x to its right, y out
 * of its topsheet, z to its tip. `lift` is how far the drawn snow stands
 * over the engine's ground at a point (the loose cover, `LOOSE`): each end
 * is laid on top of it, never in it — a ski rides up out of the snow. */
export function loneSkiFrame(
  ski: LoneSki,
  out: THREE.Matrix4,
  lift: (x: number, z: number) => number = () => 0,
): THREE.Matrix4 {
  const e = lifted;
  for (let k = 0; k < 6; k++) e[k] = ski.ends[k];
  e[1] += lift(e[0], e[2]);
  e[4] += lift(e[3], e[5]);
  tipward.set(e[0] - e[3], e[1] - e[4], e[2] - e[5]).normalize();
  upward.set(ski.up[0], ski.up[1], ski.up[2]);
  upward.addScaledVector(tipward, -upward.dot(tipward)).normalize();
  rightward.crossVectors(upward, tipward);
  out.makeBasis(rightward, upward, tipward);
  const m = ski.mount;
  return out.setPosition(
    e[3] + (e[0] - e[3]) * m,
    e[4] + (e[1] - e[4]) * m,
    e[5] + (e[2] - e[5]) * m,
  );
}
