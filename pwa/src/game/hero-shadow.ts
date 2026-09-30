// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIERS' OWN SHADOWS (SHADOWS HIGH): every skier and his machine drawn
// into a shadow map of their own, a box in the key light's frame just round
// their bound (`shadow-box.ts`'s `heroFrame`), rendered every frame before
// the picture. The wide map's texel is centimetres across — wider than an
// arm — so a skier in it is a blur that swims as he crosses its grid; here a
// texel is millimetres and the box follows the model exactly, so the shadow
// keeps its shape frame to frame. The models are taken OUT of the wide map
// while this is on, so no coarse copy shows round the sharp one; every world
// material takes the darkest of the maps (`haze.ts`'s `heroShadowed`).
//
// ONE TEXTURE, A QUARTER EACH: the four skiers share one atlas, each in his
// own quadrant, so every world material carries one more sampler rather than
// four. Each quadrant's pass is the main scene drawn from that rider's light
// with only his meshes on its layer, in the packed-depth material three's
// own shadow maps are written with — so the snow reads it back the way it
// reads the sun's.

import * as THREE from "three";

import { HERO_SLOTS, type HazeUniforms } from "./haze.ts";
import { HERO_BACK, HERO_DEPTH, heroFrame, type ShadowBox } from "./shadow-box.ts";
import type { SkisModel } from "./skis-body.ts";

/** The first of the layers a slot's meshes are on, besides the picture's. */
const HERO_LAYER = 7;

export type HeroShadow = {
  /** Each rider's quadrant, texels a side; 0 is no map, the skiers left in
   * the wide one. */
  setSize(size: number): void;
  /** Draw each rider into his quadrant from the key light `box` names (null
   * while there is no shadow), and point the world's materials at them.
   * Slot `i` is `models[i]`; the player's is slot 0. */
  render(
    gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    models: readonly SkisModel[],
    box: ShadowBox | null,
  ): void;
  dispose(): void;
};

export function createHeroShadow(haze: HazeUniforms, size: number): HeroShadow {
  let target: THREE.WebGLRenderTarget | null = null;
  let slotSize = 0;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, HERO_BACK + HERO_DEPTH);
  const depth = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    side: THREE.DoubleSide,
  });
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const sphere = new THREE.Sphere();
  const clear = new THREE.Color();
  const on = haze.uHeroOn.value;
  const normalBias = haze.uHeroBias.value;
  const off = (): void => {
    haze.uHero.value.x = 0;
    on.set(0, 0, 0, 0);
  };

  const setSize = (next: number): void => {
    if (next === slotSize) return;
    slotSize = next;
    target?.dispose();
    target = null;
    haze.uHeroMap.value = null;
    off();
    if (next <= 0) return;
    // Nearest, as three's own maps are: the depths are packed into the
    // four channels, and a blend between two packed depths is no depth.
    target = new THREE.WebGLRenderTarget(2 * next, 2 * next, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
    });
    target.texture.name = "riders.shadowMap";
    haze.uHeroMap.value = target.texture;
  };
  setSize(size);

  return {
    setSize,
    render(gl, scene, models, box) {
      const active = target !== null && box !== null && gl.shadowMap.enabled;
      // The wide map casts whoever this one does not.
      for (let i = 0; i < models.length; i++) {
        for (const mesh of models[i].casters) {
          mesh.castShadow = !active || i >= HERO_SLOTS;
          if (i < HERO_SLOTS) mesh.layers.enable(HERO_LAYER + i);
        }
      }
      if (!active || !target || !box) return off();

      const was = gl.getRenderTarget();
      const autoClear = gl.autoClear;
      const autoShadow = gl.shadowMap.autoUpdate;
      const autoMatrix = scene.matrixWorldAutoUpdate;
      const override = scene.overrideMaterial;
      gl.getClearColor(clear);
      const alpha = gl.getClearAlpha();
      // Nothing but depth, and the wide map left alone — the picture's own
      // render draws that. Packed white is the far plane: nothing in the way.
      gl.shadowMap.autoUpdate = false;
      scene.matrixWorldAutoUpdate = false;
      scene.overrideMaterial = depth;
      target.viewport.set(0, 0, 2 * slotSize, 2 * slotSize);
      target.scissorTest = false;
      gl.setRenderTarget(target);
      gl.setClearColor(0xffffff, 1);
      gl.clear(true, true, false);
      gl.autoClear = false;

      let any = 0;
      for (let i = 0; i < HERO_SLOTS; i++) {
        on.setComponent(i, 0);
        const model = models[i];
        if (!model) continue;
        model.bound(sphere);
        const c = sphere.center;
        // A rider past the wide map's circle casts nothing anyone sees: the
        // snow round him has faded every other shadow out already.
        if (Math.hypot(c.x - box.x, c.z - box.z) > box.reach + sphere.radius) continue;
        const frame = heroFrame(sphere.radius, slotSize);
        cam.left = cam.bottom = -frame.half;
        cam.right = cam.top = frame.half;
        cam.updateProjectionMatrix();
        cam.position.set(
          c.x + box.sx * HERO_BACK,
          c.y + box.sy * HERO_BACK,
          c.z + box.sz * HERO_BACK,
        );
        // A sun straight overhead has no "up" of its own to be told apart by.
        cam.up.set(0, 1, 0);
        if (Math.abs(box.sy) > 0.99) cam.up.set(0, 0, 1);
        cam.lookAt(c);
        cam.updateMatrixWorld();
        cam.layers.set(HERO_LAYER + i);
        haze.uHeroMatrix.value[i]
          .multiplyMatrices(bias, cam.projectionMatrix)
          .multiply(cam.matrixWorldInverse);
        normalBias.setComponent(i, frame.normalBias);
        haze.uHero.value.set(1, 1 / slotSize, frame.depthBias, 0);
        on.setComponent(i, 1);
        any = 1;
        // Slot i's quadrant: the shader reads it at the same corner.
        const x = (i % 2) * slotSize;
        const y = Math.floor(i / 2) * slotSize;
        target.viewport.set(x, y, slotSize, slotSize);
        target.scissor.set(x, y, slotSize, slotSize);
        target.scissorTest = true;
        gl.setRenderTarget(target);
        gl.render(scene, cam);
      }
      haze.uHero.value.x = any;

      target.scissorTest = false;
      target.viewport.set(0, 0, 2 * slotSize, 2 * slotSize);
      gl.autoClear = autoClear;
      gl.setClearColor(clear, alpha);
      scene.overrideMaterial = override;
      scene.matrixWorldAutoUpdate = autoMatrix;
      gl.shadowMap.autoUpdate = autoShadow;
      gl.setRenderTarget(was);
    },
    dispose() {
      target?.dispose();
      depth.dispose();
    },
  };
}
