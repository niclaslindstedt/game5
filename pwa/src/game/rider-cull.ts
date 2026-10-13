// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The rivals the renderer leaves out of a frame: those clear behind the lens.

import * as THREE from "three";

import type { Rider } from "./renderer-rider.ts";

/** A RIVAL is drawn until he is this far BEHIND the lens, m, along its
 * axis: a rider passing the lens is seen going by and out of the frame's
 * edge, never dropped out of the middle of the picture while he is still in
 * it. Past this he is wholly behind the near plane and costs a draw for
 * nothing. */
const LENS_BEHIND = 1;
const lensAxis = new THREE.Vector3();

/** Leave out of this frame every rival (slot 1 on) clear behind `lens`. */
export function hideBehind(riders: readonly Rider[], lens: THREE.Camera): void {
  const eye = lens.position;
  lensAxis.set(0, 0, -1).applyQuaternion(lens.quaternion);
  for (let i = 1; i < riders.length; i++) {
    const at = riders[i].drawn;
    const ahead =
      (at.x - eye.x) * lensAxis.x + (at.y - eye.y) * lensAxis.y + (at.z - eye.z) * lensAxis.z;
    riders[i].model.root.visible = ahead > -LENS_BEHIND;
  }
}
