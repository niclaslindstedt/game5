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
// with only his meshes on its layer, through the depth material the trees'
// casters use (the mountain's own shade discarded) — and the snow reads the
// DEPTH ATTACHMENT back through a comparing sampler, the GPU's own PCF.

import * as THREE from "three";

import { HERO_SLOTS, type HazeUniforms } from "./haze.ts";
import { HERO_BACK, HERO_DEPTH, heroFrame, type ShadowBox } from "./shadow-box.ts";
import type { SkisModel } from "./skis-body.ts";
import { createShadeDepth } from "./terrain-shade.ts";

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
  // What the mountain already shades casts nothing (`terrain-shade.ts`).
  const depth = createShadeDepth(haze, { side: THREE.DoubleSide });
  // Only the depth attachment is read: the colour is never written.
  depth.colorWrite = false;
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const sphere = new THREE.Sphere();
  /** The scene's children switched off for the passes. */
  const hid: THREE.Object3D[] = [];
  /** Whether a child of the scene holds a light — each one put on every
   * slot's layer as it is found, so the passes see the lights the picture
   * does. A child is looked through once. */
  const holds = new WeakMap<THREE.Object3D, boolean>();
  const lit = (child: THREE.Object3D): boolean => {
    let found = holds.get(child);
    if (found !== undefined) return found;
    found = false;
    child.traverse((o) => {
      if (!(o as THREE.Light).isLight) return;
      found = true;
      for (let i = 0; i < HERO_SLOTS; i++) o.layers.enable(HERO_LAYER + i);
    });
    holds.set(child, found);
    return found;
  };
  const clear = new THREE.Color();
  const on = haze.uHeroOn.value;
  const normalBias = haze.uHeroBias.value;
  const off = (): void => {
    haze.uHero.value.x = 0;
    on.set(0, 0, 0, 0);
  };

  /** Whether `target` is on the GPU yet — three makes a render target's
   * textures only the first time it is drawn into or `initRenderTarget`
   * is asked. */
  let made = false;

  const setSize = (next: number): void => {
    if (target && next === slotSize) return;
    slotSize = next;
    target?.depthTexture?.dispose();
    target?.dispose();
    made = false;
    off();
    // The receivers read the DEPTH attachment through a comparing sampler
    // (`haze.ts`'s `heroLerp`): one tap is four compares blended bilinearly
    // by the GPU, which is why it is filtered linearly. With no map (SHADOWS
    // below HIGH) the sampler is still handed one, a texel a side: WebGL
    // refuses EVERY draw whose comparing sampler is bound to anything but a
    // comparing depth texture, and three's own stand-in for an empty one is
    // never uploaded, so the snow, the woods and every lit model would
    // vanish — whatever `uHero` says, the binding is checked, not the read.
    const side = next > 0 ? 2 * next : 1;
    const depthTexture = new THREE.DepthTexture(side, side, THREE.UnsignedIntType);
    depthTexture.compareFunction = THREE.LessEqualCompare;
    depthTexture.minFilter = THREE.LinearFilter;
    depthTexture.magFilter = THREE.LinearFilter;
    depthTexture.name = "riders.shadowMap";
    target = new THREE.WebGLRenderTarget(side, side, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      depthTexture,
    });
    haze.uHeroMap.value = depthTexture;
  };
  setSize(size);

  return {
    setSize,
    render(gl, scene, models, box) {
      const active = slotSize > 0 && target !== null && box !== null && gl.shadowMap.enabled;
      // The wide map casts whoever this one does not.
      for (let i = 0; i < models.length; i++) {
        for (const mesh of models[i].casters) {
          mesh.castShadow = !active || i >= HERO_SLOTS;
          if (i < HERO_SLOTS) mesh.layers.enable(HERO_LAYER + i);
        }
      }
      // Made on the GPU before any frame can sample it, drawn into or not —
      // a target never drawn into is no texture at all to the sampler.
      if (target && !made) {
        gl.initRenderTarget(target);
        made = true;
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
      // render draws that. The depth cleared to the far plane: nothing in
      // the way.
      gl.shadowMap.autoUpdate = false;
      scene.matrixWorldAutoUpdate = false;
      scene.overrideMaterial = depth;
      target.viewport.set(0, 0, 2 * slotSize, 2 * slotSize);
      target.scissorTest = false;
      gl.setRenderTarget(target);
      gl.setClearColor(0xffffff, 1);
      gl.clear(true, true, false);
      gl.autoClear = false;
      // Only the riders' own subtrees are walked: three visits every object
      // in the scene on every pass whatever its layer — hundreds of them,
      // four passes a frame. What holds a LIGHT is walked too, and every
      // light is on the passes' layers: three keys its lights by how many of
      // each a render sees, and a pass that saw none moved that key twice a
      // frame, which had every lit material in the picture rebuild its
      // program's parameters on every frame after.
      for (const child of scene.children) {
        if (!child.visible || lit(child)) continue;
        let rider = false;
        for (let i = 0; i < HERO_SLOTS && i < models.length; i++) {
          if (models[i].root === child) rider = true;
        }
        if (rider) continue;
        child.visible = false;
        hid.push(child);
      }

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

      for (const o of hid) o.visible = true;
      hid.length = 0;
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
      target?.depthTexture?.dispose();
      target?.dispose();
      depth.dispose();
    },
  };
}
