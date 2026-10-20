// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE NODE RENDERER DRESSED FOR THE WORLD: the haze and the lights the
// webgpu paths draw with (`docs/webgpu.md`, part 2), hung on the scene once
// (`render-seam.ts`'s `dress`, from `gpu-device.ts`'s seam).
//
// WebGL's world materials carry the haze, the key's extras and the lamps in
// GLSL grafted by `hazeMaterial` (`haze.ts`); the node renderer drops every
// graft. So here:
//
//   - the HAZE is the scene's fog node (`haze-tsl.ts`), and fog is kept on
//     only on the node renderer's copy of a material `hazeMaterial` dressed
//     (`userData.haze`) — WebGL hazes those and nothing else;
//   - the KEY and the SKY are `KeyLight` and `SkyLight` (`world-lights.ts`),
//     whose nodes (`lights-tsl.ts`) are taught to the renderer here, and the
//     LAMPS a light of their own added to the scene;
//   - the KEY'S SHADOW MAP is drawn before anything samples it: the node
//     renderer makes a map's depth texture the first time a material binds
//     it, and remakes it under the bindings when the shadow pass first draws
//     into it — so a key whose map stood out the first frames (`sunDue`)
//     left every lit pipeline bound to a destroyed texture, and the device
//     refused every frame after. A map never drawn is asked for at once;
//   - the MIST'S WALL (`PAST_THE_WALL`, `userData.hazeWall`) is the copy's
//     mask, and a GLOW (`glow-fade.ts`, `userData.glowFade`) its opacity
//     faded and its mask — its points drawn as sprites (`glow-tsl.ts`);
//   - a ShaderMaterial flagged with a NODE TWIN (`nodeTwin`: the dome, the
//     far ranges, the GPU sky's passes — part 3) is drawn by that twin
//     (`sky-twins-tsl.ts`), made once over its own uniforms;
//   - the SKIERS' passes' depth (`createShadeDepth`, `userData.shadeCast`)
//     is drawn by `shadows-tsl.ts`'s twin, the mountain's shade discarded,
//     and the atlas they fill is re-pointed each frame (`syncHero`).
//
// Each material is copied into a node material by the renderer's library
// (`fromMaterial`) whenever its pipeline is built; the hook below finishes
// the copy. Nothing here runs on WebGL.

import * as THREE from "three";
import { materialOpacity, toneMappingExposure, uniform } from "three/tsl";
import type { NodeMaterial, WebGPURenderer } from "three/webgpu";

import type { GlowFade } from "./glow-fade.ts";
import { createGlowSprites, glowFade, insideWall } from "./glow-tsl.ts";
import type { HazeUniforms } from "./haze.ts";
import { hazeFog, hazeSlots, syncHaze } from "./haze-tsl.ts";
import { LampsLight, lightSlots, registerLights, syncLights } from "./lights-tsl.ts";
import { heroSlots, shadeDepthTwin, syncHero } from "./shadows-tsl.ts";
import { createTwins } from "./sky-twins-tsl.ts";
import type { KeyLight } from "./world-lights.ts";

export type Dressing = {
  /** Before a frame: the maps the slots hold re-pointed, the glow points
   * swapped for their sprites. */
  begin(): void;
  /** After it: the points as they were. */
  end(): void;
  /** Whether the haze mixes in display space this frame (`render-seam.ts`). */
  hazeInDisplay(on: boolean): void;
};

/** Finish the node renderer's copy of `material` (see the header). */
function finish(copy: NodeMaterial, material: THREE.Material, u: HazeUniforms): void {
  const data = material.userData;
  copy.fog = data.haze === true;
  if (data.hazeWall === true) copy.maskNode = insideWall(u);
  const glow = data.glowFade as GlowFade | undefined;
  if (glow && !(material as THREE.PointsMaterial).isPointsMaterial) {
    const fade = glowFade(u, glow);
    copy.opacityNode = materialOpacity.mul(fade);
    copy.maskNode = fade.greaterThan(0.003);
  }
}

export function dressScene(
  renderer: WebGPURenderer,
  scene: THREE.Scene,
  haze: HazeUniforms,
): Dressing {
  registerLights(renderer);
  // Mixed in display space where WebGL's frame would go straight onto the
  // canvas through ACES, and in linear light where it would go through the
  // grade's target (`haze-tsl.ts`); the webgpu frame itself always goes
  // straight, the grade's pass not being ported yet (`grade-pass`).
  const display = uniform(renderer.toneMapping === THREE.ACESFilmicToneMapping ? 1 : 0);
  const how = { display, exposure: toneMappingExposure };
  const twins = createTwins(haze, how);
  const library = renderer.library;
  const from = library.fromMaterial.bind(library);
  const depths = new WeakMap<THREE.Material, NodeMaterial>();
  library.fromMaterial = (material: THREE.Material): NodeMaterial => {
    const twin = twins.of(material);
    if (twin) return twin;
    if (material.userData.shadeCast === true) {
      let depth = depths.get(material);
      if (!depth) depths.set(material, (depth = shadeDepthTwin(material, haze)));
      return depth;
    }
    const copy = from(material) as NodeMaterial | null;
    if (copy && copy !== (material as unknown)) finish(copy, material, haze);
    return copy as NodeMaterial; // null where three has no node twin, as it returns
  };
  scene.fogNode = hazeFog(haze, how);
  scene.add(new LampsLight(haze));
  const hs = hazeSlots(haze);
  const ls = lightSlots(haze);
  const hero = heroSlots(haze);
  const glows = createGlowSprites(haze);
  const keys: THREE.DirectionalLight[] = [];
  scene.traverse((o) => {
    if ((o as KeyLight).isKeyLight) keys.push(o as KeyLight);
  });
  return {
    begin() {
      syncHaze(hs);
      syncLights(ls);
      syncHero(hero);
      for (const key of keys) {
        const map = key.shadow.map as THREE.RenderTarget | null;
        if (key.castShadow && (!map || map.depthTexture?.version === 0))
          key.shadow.needsUpdate = true;
      }
      glows.begin(scene);
    },
    end: () => glows.end(),
    hazeInDisplay(on) {
      display.value = on && renderer.toneMapping === THREE.ACESFilmicToneMapping ? 1 : 0;
    },
  };
}
