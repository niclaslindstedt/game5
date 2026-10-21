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
//
// THE SAME STANDS, FOR ANY POINTS (part 9). A points material flagged
// `userData.sprite` is stood in for the same way: `plain` (the sparks'
// heads) as a glow's sprite with nothing faded and held a pixel across, as
// WebGL holds a point; any other kind by a quad mesh drawn once a point
// with the material its owner's twins make for it (`custom`: the
// spindrift's, `particle-twins-tsl.ts`'s `pointStand`).

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
import { PointsNodeMaterial, type NodeMaterial } from "three/webgpu";

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

/** Each points attribute's instanced mirror (`perPoint`). */
const mirrors = new WeakMap<THREE.BufferAttribute, THREE.InstancedBufferAttribute>();

/** A POINTS ATTRIBUTE READ ONCE A QUAD: an instanced mirror of `attr` over
 * the same array, for a stand's node to read. The node renderer steps a
 * buffer by the instance only when the attribute itself is instanced, so
 * a plain one handed to `instancedBufferAttribute` is read by the vertex,
 * and every quad would be drawn between the first four points. The
 * mirror is brought up to its source's version each frame (`begin`). */
export function perPoint(attr: THREE.BufferAttribute): THREE.InstancedBufferAttribute {
  let mirror = mirrors.get(attr);
  if (!mirror) {
    mirror = new THREE.InstancedBufferAttribute(attr.array, attr.itemSize, attr.normalized);
    mirror.setUsage(attr.usage);
    mirrors.set(attr, mirror);
  }
  return mirror;
}

/** Every mirror of `geo`'s attributes up to its source's version and array. */
function syncMirrors(geo: THREE.BufferGeometry): void {
  for (const name in geo.attributes) {
    const attr = geo.attributes[name] as THREE.BufferAttribute;
    const mirror = mirrors.get(attr);
    if (!mirror) continue;
    if (mirror.array !== attr.array) {
      mirror.array = attr.array;
      mirror.needsUpdate = true;
    }
    if (mirror.version < attr.version) mirror.version = attr.version;
  }
}

type Stand = { sprite: THREE.Object3D & { count: number }; material: PointsNodeMaterial | null };

/** A glow's points as one instanced sprite over the same buffers; `how`
 * null for points nothing fades (a plain stand, at least a pixel across). */
function standFor(points: THREE.Points, u: HazeUniforms, how: GlowFade | null): Stand {
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
  material.positionNode = instancedBufferAttribute(perPoint(position) as never);
  const colour = geo.getAttribute("color") as THREE.BufferAttribute | undefined;
  if (src.vertexColors && colour) {
    const tint: N = instancedBufferAttribute(perPoint(colour) as never);
    material.colorNode = materialColor.mul(vec4(tint, 1));
  }
  // The fewest device pixels across: the size, in the point's own units,
  // that draws `MIN_PX` at this distance (three's point sprite draws a size
  // at `dpr · height / 2 / depth` device pixels when it attenuates).
  const px = how ? MIN_PX : 1;
  const least = src.sizeAttenuation
    ? positionView.z.negate().mul(px).div(screenSize.y.mul(0.5))
    : float(px).div(screenDPR);
  const size = max(materialPointSize, least);
  material.sizeNode = size;
  if (how) {
    const thinned = varying(materialPointSize.div(size));
    const fade = glowFade(u, how).mul(thinned);
    material.opacityNode = materialOpacity.mul(fade);
    material.maskNode = fade.greaterThan(0.003);
  }
  const sprite = new THREE.Sprite(material as unknown as THREE.SpriteMaterial);
  sprite.name = `${points.name || "glow"}-sprites`;
  sprite.frustumCulled = false;
  sprite.renderOrder = points.renderOrder;
  return { sprite, material };
}

/** The unit quad a custom stand draws once a point: its corners at ±1, as
 * `gl_PointCoord` spans the point. */
let quad: THREE.BufferGeometry | null = null;
function unitQuad(): THREE.BufferGeometry {
  if (quad) return quad;
  quad = new THREE.BufferGeometry();
  quad.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3),
  );
  quad.setIndex([0, 1, 2, 0, 2, 3]);
  return quad;
}

/** Points with a material of their own as a quad mesh drawn once a point. */
function customStand(points: THREE.Points, material: NodeMaterial): Stand {
  const mesh = new THREE.Mesh(unitQuad(), material) as unknown as THREE.Mesh & { count: number };
  mesh.count = 0;
  mesh.name = `${points.name || "points"}-stand`;
  mesh.frustumCulled = false;
  mesh.renderOrder = points.renderOrder;
  return { sprite: mesh, material: null };
}

/** Whether `p` is points a stand draws: a glow, or flagged `sprite`. */
function stood(p: THREE.Points): boolean {
  const data = (p.material as THREE.Material).userData;
  return !!data && (data.glowFade !== undefined || typeof data.sprite === "string");
}

export function createGlowSprites(
  u: HazeUniforms,
  custom: (points: THREE.Points) => NodeMaterial | null = () => null,
): GlowSprites {
  const stands = new WeakMap<THREE.Points, Stand | null>();
  const kept: THREE.Points[] = [];
  const shown: THREE.Object3D[] = [];
  const found: THREE.Points[] = [];
  const look = (o: THREE.Object3D): void => {
    if ((o as THREE.Points).isPoints && stood(o as THREE.Points)) found.push(o as THREE.Points);
  };
  const make = (p: THREE.Points): Stand | null => {
    const data = (p.material as THREE.Material).userData;
    if (data.glowFade !== undefined) return standFor(p, u, data.glowFade as GlowFade);
    if (data.sprite === "plain") return standFor(p, u, null);
    const material = custom(p);
    return material ? customStand(p, material) : null;
  };
  return {
    begin(scene) {
      found.length = 0;
      scene.traverseVisible(look);
      for (const p of found) {
        let stand = stands.get(p);
        if (stand === undefined) stands.set(p, (stand = make(p)));
        if (!stand) continue;
        syncMirrors(p.geometry);
        const { sprite, material } = stand;
        if (sprite.parent !== p.parent) p.parent?.add(sprite);
        sprite.position.copy(p.position);
        sprite.quaternion.copy(p.quaternion);
        sprite.scale.copy(p.scale);
        const src = p.material as THREE.PointsMaterial;
        if (material) {
          material.opacity = src.opacity;
          material.size = src.size;
          material.color.copy(src.color);
        }
        const range = p.geometry.drawRange;
        const n = p.geometry.getAttribute("position").count;
        sprite.count = Math.max(0, Math.min(n - range.start, range.count));
        // Shown even empty: three draws nothing with no instances but
        // builds the pipeline, so the warm-up builds it behind the card.
        sprite.visible = true;
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
