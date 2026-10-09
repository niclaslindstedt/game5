// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT AN INSTANCED VIEW LEAVES OUT: the one test the views that pose a
// figure an instance (the crowd, the people on foot, the dogs, the
// traffic) ask before they pose and send one. Those meshes hold every
// instance in sight of the lens all round it — three cannot cull an
// instance, only a whole mesh, and a crowd's mesh spans the ski area — so
// at the foot of the mountain, where the village, its people, its dogs and
// its cars all stand within a few hundred metres, every one behind the
// lens was posed, sent and drawn (and drawn again into the sun's map).
//
// AN INSTANCE IS KEPT when its bound meets the lens's frustum, or — when
// its cut casts — when its shadow can land in the sun's circle
// (`shadow-box.ts`'s `castsInto`, the forest's own rule), so a figure just
// behind the lens still lays its shadow across the snow in front of it.
// Everything else is left out of both passes.
//
// The renderer aims it once a frame (`aim`), after the lens is set and the
// sun's box placed; a view handed none (a lab, a harness) keeps everything.

import * as THREE from "three";

import { castsInto, type ShadowBox } from "./shadow-box.ts";

/** A person's bound for the cull, m: a sphere `radius` round the middle
 * of a column `height` tall off his feet — wide enough for a skier stood
 * up, spread on the snow or sat on a chair (the crowd's seated figure is
 * asked a metre lower, his legs hanging under the seat). */
export const FIGURE = { radius: 1.6, height: 3 };

export type ViewCull = {
  /** Whether a figure standing at (`x`, `y`, `z`), `height` tall and
   * `radius` round its middle, is to be drawn: in the frustum, or — when
   * `casts` — throwing its shadow into the sun's circle. */
  seen(x: number, y: number, z: number, radius: number, height: number, casts: boolean): boolean;
  /** Whether a sphere `radius` round (`x`, `y`, `z`) meets the frustum. */
  inView(x: number, y: number, z: number, radius: number): boolean;
  /** Whether something `radius` round standing at most `height` over the
   * snow at (`x`, `z`) can throw its shadow into the sun's circle. */
  shadows(x: number, z: number, height: number, radius: number): boolean;
};

export type ViewCuller = ViewCull & {
  /** Aim at `camera` as it stands this frame, and the sun's box `shadow`
   * (null: no map, nothing kept for its shadow). */
  aim(camera: THREE.Camera, shadow: ShadowBox | null): void;
};

export function createViewCull(): ViewCuller {
  const frustum = new THREE.Frustum();
  const pv = new THREE.Matrix4();
  const sphere = new THREE.Sphere();
  let sun: ShadowBox | null = null;
  const inView = (x: number, y: number, z: number, radius: number): boolean => {
    sphere.center.set(x, y, z);
    sphere.radius = radius;
    return frustum.intersectsSphere(sphere);
  };
  const shadows = (x: number, z: number, height: number, radius: number): boolean =>
    sun !== null && castsInto(sun, x, z, height, radius);
  return {
    aim(camera, shadow) {
      camera.updateMatrixWorld();
      pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(pv);
      sun = shadow;
    },
    inView,
    shadows,
    seen(x, y, z, radius, height, casts) {
      return inView(x, y + height / 2, z, radius) || (casts && shadows(x, z, height, radius));
    },
  };
}
