// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A LAMP'S GLOW FADED INTO THE AIR, AND THE MIST'S WALL, on the node
// renderer (`docs/webgpu.md`, part 2): `glow-fade.ts`'s graft and
// `haze.ts`'s `PAST_THE_WALL` restated as nodes for the webgpu paths, off
// the same shared uniforms (`haze-tsl.ts`'s slots). `gpu-dress.ts` hangs
// them on the node renderer's copy of each material that asks
// (`userData.glowFade`, `userData.hazeWall`).
//
// GLOW POINTS BECOME SPRITES. WebGPU draws a point one pixel across,
// whatever its size, so a glow drawn as `THREE.Points` (a strip's edge
// lamps, the traffic's headlamps) would be a speck. On the webgpu paths
// each is drawn instead by a stand-in (`createGlowSprites`): one instanced sprite
// over the same position and colour buffers — three's point sprite, a quad
// a point, sized as the point was and held at least `MIN_PX` device pixels
// across with its light spread thinner over the extra, as the GLSL holds
// `gl_PointSize`. The points themselves are kept out of the frame while
// their stand-in draws.

import * as THREE from "three";
import {
  float,
  instancedBufferAttribute,
  length,
  materialColor,
  materialOpacity,
  materialPointSize,
  max,
  mix,
  positionView,
  positionWorld,
  cameraPosition,
  pow,
  screenDPR,
  screenSize,
  smoothstep,
  varying,
  vec4,
} from "three/tsl";
import { PointsNodeMaterial } from "three/webgpu";

import { CARRY, MIN_PX, type GlowFade } from "./glow-fade.ts";
import type { HazeUniforms } from "./haze.ts";
import { hazeAir, hazeMist, hazeSlots, type N } from "./haze-tsl.ts";

/** How much of a glow the air and the mist leave at the fragment's point
 * (`glow-fade.ts`): the air's share left raised to `CARRY`, the mist's
 * taken whole, and past `reach` (m, 0: none) nothing. */
export function glowFade(u: HazeUniforms, how: GlowFade): N {
  const s = hazeSlots(u);
  const ray = positionWorld.sub(cameraPosition);
  const dist = length(ray);
  let fade = pow(float(1).sub(hazeAir(s, dist, ray.y)), CARRY).mul(
    float(1).sub(hazeMist(s, dist, ray.y)),
  );
  const reach = how.reach ?? 0;
  if (reach > 0) fade = fade.mul(float(1).sub(smoothstep((reach * 2) / 3, reach, dist)));
  return fade;
}

/** PAST THE MIST'S WALL NOTHING SHOWS (`PAST_THE_WALL`): true where a
 * fragment stands inside the wall — a material's `maskNode`. */
export function insideWall(u: HazeUniforms): N {
  const s = hazeSlots(u);
  const w = positionWorld.sub(cameraPosition);
  const across = mix(length(w), length(w.xz), s.mistAloft);
  return s.mist.lessThanEqual(0).or(across.lessThanEqual(s.mist));
}

/** The stand-ins for a scene's glow points (see the header). */
export type GlowSprites = {
  /** Before a frame: each visible glow point's sprite shown in its place
   * and the points kept out. */
  begin(scene: THREE.Object3D): void;
  /** After it: the points as they were. */
  end(): void;
};

type Stand = { sprite: THREE.Sprite; material: PointsNodeMaterial };

/** A glow's points as one instanced sprite over the same buffers. */
function standFor(points: THREE.Points, u: HazeUniforms, how: GlowFade): Stand {
  const src = points.material as THREE.PointsMaterial;
  const geo = points.geometry;
  const material = new PointsNodeMaterial({
    map: src.map,
    color: src.color,
    size: src.size,
    sizeAttenuation: src.sizeAttenuation,
    transparent: src.transparent,
    opacity: src.opacity,
    depthWrite: src.depthWrite,
    depthTest: src.depthTest,
    blending: src.blending,
    fog: false,
  });
  const position = geo.getAttribute("position") as THREE.BufferAttribute;
  material.positionNode = instancedBufferAttribute(position as never);
  const colour = geo.getAttribute("color") as THREE.BufferAttribute | undefined;
  if (src.vertexColors && colour) {
    const tint: N = instancedBufferAttribute(colour as never);
    material.colorNode = materialColor.mul(vec4(tint, 1));
  }
  // The fewest device pixels across: the size, in the point's own units,
  // that draws `MIN_PX` at this distance (three's point sprite draws a size
  // at `dpr · height / 2 / depth` device pixels when it attenuates).
  const least = src.sizeAttenuation
    ? positionView.z.negate().mul(MIN_PX).div(screenSize.y.mul(0.5))
    : float(MIN_PX).div(screenDPR);
  const size = max(materialPointSize, least);
  material.sizeNode = size;
  const thinned = varying(materialPointSize.div(size));
  const fade = glowFade(u, how).mul(thinned);
  material.opacityNode = materialOpacity.mul(fade);
  material.maskNode = fade.greaterThan(0.003);
  const sprite = new THREE.Sprite(material as unknown as THREE.SpriteMaterial);
  sprite.name = `${points.name || "glow"}-sprites`;
  sprite.frustumCulled = false;
  sprite.renderOrder = points.renderOrder;
  return { sprite, material };
}

export function createGlowSprites(u: HazeUniforms): GlowSprites {
  const stands = new WeakMap<THREE.Points, Stand>();
  const kept: THREE.Points[] = [];
  const shown: THREE.Sprite[] = [];
  const found: THREE.Points[] = [];
  const look = (o: THREE.Object3D): void => {
    if (!(o as THREE.Points).isPoints) return;
    const how = ((o as THREE.Points).material as THREE.Material).userData?.glowFade as
      GlowFade | undefined;
    if (how) found.push(o as THREE.Points);
  };
  return {
    begin(scene) {
      found.length = 0;
      scene.traverseVisible(look);
      for (const p of found) {
        let stand = stands.get(p);
        if (!stand) {
          const how = (p.material as THREE.Material).userData.glowFade as GlowFade;
          stand = standFor(p, u, how);
          stands.set(p, stand);
        }
        const { sprite, material } = stand;
        if (sprite.parent !== p.parent) p.parent?.add(sprite);
        sprite.position.copy(p.position);
        sprite.quaternion.copy(p.quaternion);
        sprite.scale.copy(p.scale);
        const src = p.material as THREE.PointsMaterial;
        material.opacity = src.opacity;
        material.size = src.size;
        material.color.copy(src.color);
        const range = p.geometry.drawRange;
        const n = p.geometry.getAttribute("position").count;
        sprite.count = Math.max(0, Math.min(n - range.start, range.count));
        sprite.visible = sprite.count > 0;
        p.visible = false;
        kept.push(p);
        shown.push(sprite);
      }
    },
    end() {
      for (const p of kept) p.visible = true;
      for (const s of shown) s.visible = false;
      kept.length = 0;
      shown.length = 0;
    },
  };
}
