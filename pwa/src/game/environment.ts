// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR: the two lights, the dome and the haze, answering to one
// `SkyLook` (`sky.ts`) read every frame — the sun stands at the run's one
// hour (`clock.ts`), but a sky picked on a card or a lab's cell can change
// under a live scene. The key light is whichever of the sun and the
// moon the look names; under a lid it is a glow with no shadow worth the
// name, and the hemisphere carries the picture.
//
// THE KEY LIGHT'S SHADOW IS ONE MAP OVER ONE PATCH. A directional light's
// shadow map has a fixed number of texels, and spread over the whole basin a
// skier's shadow would be one of them. So the map covers a circle a SHADOWS
// row's `reach` round a centre standing AHEAD of the lens (`shadow-box.ts`),
// its box snapped to whole shadow texels in the light's own frame so a
// shadow edge does not crawl as the lens moves, and every shadow fades out
// over the circle's rim instead of stopping at the map's edge. Past it the
// haze and the terrain's forest tint carry the woods.

import * as THREE from "three";

import { createHazeUniforms, writeHaze, type HazeUniforms } from "./haze.ts";
import { createSkyDome, type SkyDome } from "./sky-dome.ts";
import { mistFor, type DistanceLevel, type ShadowLook } from "./settings-video.ts";
import { aimShadow, SHADOW_MARGIN, shadowFade, type ShadowBox } from "./shadow-box.ts";
import type { SkyLook } from "./sky.ts";

/** Where the key light is parked along the sun, m (it is directional; the
 * distance only has to clear anything that casts). */
const KEY_DISTANCE = 300;

export type Environment = {
  haze: HazeUniforms;
  sun: THREE.DirectionalLight;
  dome: SkyDome;
  /** Apply a look, and aim the shadow ahead of `camera`, its box standing
   * at height `y` (the skier's: what the depth range is centred on);
   * `drift` is how far the wind has carried the cloud (`sky-dome.ts`). */
  update(look: SkyLook, camera: THREE.Camera, y: number, drift?: { x: number; z: number }): void;
  /** Where the shadow stands this frame, or null while the SHADOWS row is
   * off — what `forest.ts` picks its casters by. */
  shadow(): ShadowBox | null;
  /** The SHADOWS row: the map's texels and its reach. */
  setShadow(look: ShadowLook): void;
  /** The DISTANCE row, whose mist is `mistFor`'s. */
  setDistance(distance: DistanceLevel): void;
  dispose(): void;
};

export function createEnvironment(
  scene: THREE.Scene,
  shadowLook: ShadowLook,
  domeRadius: number,
): Environment {
  const haze = createHazeUniforms();
  const dome = createSkyDome(haze, domeRadius);
  dome.mesh.name = "sky";
  scene.add(dome.mesh);

  const hemi = new THREE.HemisphereLight(0x88aaff, 0xffffff, 1);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  const cam = sun.shadow.camera;
  cam.near = 1;
  cam.far = KEY_DISTANCE * 2;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  /** The box's centre snaps to this, so shadow edges do not crawl. */
  let texel = 1;
  const box: ShadowBox = { x: 0, y: 0, z: 0, reach: 0, sx: 0, sy: 1, sz: 0 };
  const setShadow = ({ size, reach }: ShadowLook): void => {
    sun.castShadow = size > 0;
    box.reach = reach;
    const half = reach + SHADOW_MARGIN;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.updateProjectionMatrix();
    texel = (2 * half) / Math.max(size, 1);
    // Off the surface by most of a texel, in metres: the map's own grain is
    // what raises acne on snow the low sun grazes, so the offset scales
    // with it rather than being one number for every stop.
    sun.shadow.normalBias = texel * 0.7;
    const [inner, outer] = shadowFade(reach);
    haze.uShadowFade.value.z = inner;
    haze.uShadowFade.value.w = outer;
    if (size > 0 && sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      // Three allocates the map on first use at the size it finds; a map
      // already standing at another size has to go for the new one to come.
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  };
  setShadow(shadowLook);
  const lightSpace = new THREE.Matrix4();
  const inv = new THREE.Matrix4();
  const at = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const look = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  return {
    haze,
    sun,
    dome,
    update(sky, camera, y, drift) {
      writeHaze(haze, sky);
      dome.update(sky, drift?.x ?? 0, drift?.z ?? 0);
      // The key is the sun by day and the moon by night (`sky.ts`).
      sun.color.setRGB(...sky.keyColour);
      sun.intensity = sky.keyIntensity;
      hemi.color.setRGB(...sky.skyLight);
      hemi.groundColor.setRGB(...sky.groundLight);
      hemi.intensity = sky.ambient;
      camera.getWorldDirection(look);
      aimShadow(box, camera.position.x, camera.position.z, look.x, look.z, box.reach);
      box.y = y;
      // The key's direction, kept a hair over the horizon so the box has a
      // light to stand under.
      dir.set(sky.key.x, Math.max(sky.key.y, 0.02), sky.key.z).normalize();
      box.sx = dir.x;
      box.sy = dir.y;
      box.sz = dir.z;
      haze.uShadowFade.value.x = box.x;
      haze.uShadowFade.value.y = box.z;
      // Snap the box's centre to whole texels in the light's own frame.
      lightSpace.lookAt(dir, origin, up);
      inv.copy(lightSpace).invert();
      at.set(box.x, box.y, box.z).applyMatrix4(inv);
      at.x = Math.round(at.x / texel) * texel;
      at.y = Math.round(at.y / texel) * texel;
      at.applyMatrix4(lightSpace);
      sun.target.position.copy(at);
      sun.position.copy(at).addScaledVector(dir, KEY_DISTANCE);
      sun.target.updateMatrixWorld();
      dome.follow(camera);
    },
    shadow() {
      return sun.castShadow ? box : null;
    },
    setShadow,
    setDistance(next) {
      haze.uMist.value = mistFor(next);
    },
    dispose() {
      dome.dispose();
      sun.shadow.map?.dispose();
    },
  };
}
