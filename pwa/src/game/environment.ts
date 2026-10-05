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
//
// THE MOUNTAIN'S OWN SHADOW is the other half of the key's shade, over the
// whole map at once (`terrain-shade.ts`): a horizon baked once a map along
// the key's bearing, on while the SHADOWS row casts at all.

import * as THREE from "three";
import type { Heightfield } from "@engine";

import { createHazeUniforms, writeHaze, type HazeUniforms } from "./haze.ts";
import { createSkyDome, type SkyDome } from "./sky-dome.ts";
import { mistFor, type DistanceLevel, type ShadowLook } from "./settings-video.ts";
import { aimShadow, SHADOW_MARGIN, shadowFade, type ShadowBox } from "./shadow-box.ts";
import type { Dir, SkyLook } from "./sky.ts";
import { createTerrainShade } from "./terrain-shade.ts";

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
  /** The map's ground the mountain's shadow is baked off (null: none), and
   * the key it is baked for first; resolves once that shade is drawn. */
  setGround(ground: Heightfield | null, key: Dir | null): Promise<void>;
  /** Resolves once the mountain's shadow for the key last seen is drawn. */
  shadeSettled(): Promise<void>;
  /** Link every program the sun's shadow pass can ask for, now, behind the
   * loading card: one pass of its map over `span` m round the scene with
   * every caster shown (`warmShadows`). */
  warmShadows(gl: THREE.WebGLRenderer, scene: THREE.Scene, span: number): void;
  dispose(): void;
};

/**
 * THE SHADOW PASS'S PROGRAMS, LINKED BEFORE THE RUN. three's `compile`
 * builds every mesh's own program but none of the depth programs its
 * shadow pass draws casters with — one a caster's side, packing and kind
 * (instanced, skinned) — so a caster of a kind not yet in the sun's box (the
 * finish arena's double-sided banners, a slalom's last gates) linked its
 * program the frame it first came in: a stall of tens of milliseconds
 * mid-run on a phone, where the driver links on the thread that draws. One
 * pass of the map, its box opened over the whole map and every caster
 * switched on for it, links them all while the card is still up; what was
 * hidden is hidden again and the box put back.
 */
function warmShadows(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  sun: THREE.DirectionalLight,
  span: number,
): void {
  if (!sun.castShadow || !gl.shadowMap.enabled) return;
  const shown: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh || !o.castShadow) return;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) {
      if (p.visible) continue;
      p.visible = true;
      shown.push(p);
    }
  });
  const cam = sun.shadow.camera;
  const { left, right, top, bottom, near, far } = cam;
  cam.left = cam.bottom = -span;
  cam.right = cam.top = span;
  cam.near = -2 * span;
  cam.far = 2 * span;
  cam.updateProjectionMatrix();
  scene.updateMatrixWorld();
  const wanted = gl.shadowMap.needsUpdate;
  gl.shadowMap.needsUpdate = true;
  gl.shadowMap.render([sun], scene, cam);
  gl.shadowMap.needsUpdate = wanted;
  Object.assign(cam, { left, right, top, bottom, near, far });
  cam.updateProjectionMatrix();
  for (const p of shown) p.visible = false;
}

export function createEnvironment(
  scene: THREE.Scene,
  shadowLook: ShadowLook,
  domeRadius: number,
): Environment {
  const haze = createHazeUniforms();
  const terrain = createTerrainShade(haze);
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
      terrain.update(sky.key, sun.castShadow);
      dome.follow(camera);
    },
    shadow() {
      return sun.castShadow ? box : null;
    },
    setShadow,
    setDistance(next) {
      haze.uMist.value = mistFor(next);
    },
    setGround(ground, key) {
      return terrain.setGround(ground, key, sun.castShadow);
    },
    shadeSettled: () => terrain.settled(),
    warmShadows: (gl, scene, span) => warmShadows(gl, scene, sun, span),
    dispose() {
      terrain.dispose();
      dome.dispose();
      sun.shadow.map?.dispose();
    },
  };
}
