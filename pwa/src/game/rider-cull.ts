// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A RIVAL CLEAR BEHIND THE LENS is left out of the frame.

import * as THREE from "three";

/** A rival is drawn until he is this far BEHIND the lens, m, along its
 * axis: a rider passing the lens is seen going by and out of the frame's
 * edge, never dropped out of the middle of the picture while he is still in
 * it. Past this he is wholly behind the near plane and costs a draw for
 * nothing. */
const LENS_BEHIND = 1;
const lensAxis = new THREE.Vector3();

/** Hide every rider but the player (index 0) clear behind `camera`. */
export function cullBehind(
  camera: THREE.Camera,
  riders: readonly { drawn: { x: number; y: number; z: number }; model: { root: THREE.Object3D } }[],
): void {
  const eye = camera.position;
  lensAxis.set(0, 0, -1).applyQuaternion(camera.quaternion);
  for (let i = 1; i < riders.length; i++) {
    const at = riders[i].drawn;
    const ahead =
      (at.x - eye.x) * lensAxis.x + (at.y - eye.y) * lensAxis.y + (at.z - eye.z) * lensAxis.z;
    riders[i].model.root.visible = ahead > -LENS_BEHIND;
  }
}
