// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE LIGHTS AS DRAWN — the floodlight masts `piste-light-plan.ts`
// stands along every run, and the light they lay on the snow after dark.
//
//   * THE MASTS stand by day and by night: a galvanised pole, a crossarm
//     at its head and one to three floodlights on it, each turned to where
//     the plan aims it — all of them four instanced draws for the whole
//     ski area. Like the edge poles they are scenery the engine does not
//     know.
//   * THE LIGHT is baked ONCE A MAP (`bakePisteLight`, the vector
//     irradiance on the ground over the whole map) the first time the
//     lamps come on, uploaded as one half-float texture, and read by every
//     world material through the shared haze uniforms (`haze.ts`'s
//     `pisteLight`): the snow with its glitter, the woods, the skiers, the
//     falling snow and the snow cloud. A few hundred lamps cost one
//     texture read a pixel, never a loop — the six lamp slots stay the
//     moving lamps' (the headlamps, the arena's floods). Off the piste the
//     beams are cut off and the map holds nothing: the woods stay dark.
//   * THE LAMPS GLOW, seen from in front: a halo on each glass, drawn at
//     least a few pixels wide, so a lit run reads from across the valley
//     as the string of lights it is.
//
// THE LAMPS COME ON WITH THE DARK (`SkyLook.lamps`), with the arena's
// floods and every headlamp.

import * as THREE from "three";
import type { Level } from "@engine";

import { hazeMaterial, PAST_THE_WALL, type HazeUniforms } from "./haze.ts";
import {
  bakePisteLight,
  planPisteLights,
  PISTE_LIGHT_COLOUR,
  type PisteMast,
} from "./piste-light-plan.ts";

/** One lux in the lamp slots' units (`haze.ts`'s `lampReach`): a
 * headlamp's 600 lm spot lays some 14 lx on the snow fifteen metres off and
 * reads 0.2 there, so the two kinds of lamp light the snow on one scale. */
export const LUX_TO_LAMP = 1 / 110;

/** The pole's girth at its foot and its head, m, and how far its foot is
 * sunk in the snow; the crossarm's section and its overhang past the
 * outer lamps; the floodlight's housing (across, tall, deep) and its glass. */
const POLE = { foot: 0.12, head: 0.065, sunk: 0.4 };
const ARM = { section: 0.08, over: 0.25, below: 0.15, spread: 0.7 };
const LAMP = { w: 0.6, h: 0.4, d: 0.14, glass: 0.9 };

/** THE GLOW: the halo's width, m, the fewest pixels it is drawn across
 * however far off, and the glass's glow by day and what the dark adds
 * (emissive intensity). */
const GLOW = { size: 2.4, minPx: 3.5, day: 0.05, night: 3.5 };

export type PisteLights = {
  group: THREE.Group;
  /** The masts, for the labs. */
  masts: readonly PisteMast[];
  /** Light them at `dark` (0 off … 1 full night), with `pixels` the lens's
   * focal length in pixels. */
  setLamps(dark: number, pixels: number): void;
  dispose(): void;
};

/** The halo's shader: a quad turned to the lens at each glass, at least
 * `uMinPx` wide, bright seen from in front of the lamp and nothing from
 * behind it, faded into the haze and gone past the mist's wall. */
function glowMaterial(haze: HazeUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOn: { value: 0 },
      uPixels: { value: 1000 },
      uCol: { value: new THREE.Vector3(...PISTE_LIGHT_COLOUR) },
      uHaze: haze.uHaze,
      uMist: haze.uMist,
    },
    vertexShader: /* glsl */ `
      attribute vec3 aCentre;
      attribute vec3 aAim;
      uniform float uOn;
      uniform float uPixels;
      uniform float uHaze;
      uniform float uMist;
      varying vec2 vAt;
      varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(aCentre, 1.0);
        float depth = max(-mv.z, 0.1);
        vec3 back = cameraPosition - aCentre;
        float dist = length(back);
        // A flood's glass shines one way: blazing seen from in front,
        // nothing from behind.
        float facing = dot(aAim, back / max(dist, 1e-3));
        float size = max(${GLOW.size.toFixed(2)}, ${GLOW.minPx.toFixed(1)} * depth / uPixels);
        vAlpha = uOn * smoothstep(-0.2, 0.65, facing)
          // A halo drawn wider than it is carries its light thinner.
          * mix(1.0, ${GLOW.size.toFixed(2)} / size, 0.6)
          * exp(-dist * uHaze * 0.7)
          * (uMist > 0.0 ? step(dist, uMist) : 1.0);
        mv.xy += position.xy * size;
        gl_Position = projectionMatrix * mv;
        vAt = position.xy * 2.0;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol;
      varying vec2 vAt;
      varying float vAlpha;
      void main() {
        float r = length(vAt);
        if (r > 1.0 || vAlpha <= 0.0) discard;
        float core = smoothstep(0.22, 0.0, r);
        float halo = pow(1.0 - r, 3.0) * 0.55;
        gl_FragColor = vec4(mix(uCol, vec3(1.0), core) * 2.5, (core + halo) * vAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** THE LIGHT ON THE GROUND, on the GPU: the bake as one half-float texture
 * over the whole map, and the box the shaders turn a world point into its
 * texel by (the origin less half a texel, and one over the span). */
function uploadLight(
  level: Level,
  masts: readonly PisteMast[],
  haze: HazeUniforms,
): THREE.DataTexture {
  const map = bakePisteLight(level, masts);
  const halves = new Uint16Array(map.data.length);
  for (let i = 0; i < halves.length; i++) halves[i] = THREE.DataUtils.toHalfFloat(map.data[i]);
  const texture = new THREE.DataTexture(
    halves,
    map.cols,
    map.rows,
    THREE.RGBAFormat,
    THREE.HalfFloatType,
  );
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  haze.uPisteLight.value = texture;
  haze.uPisteBox.value.set(
    map.originX - map.cell / 2,
    map.originZ - map.cell / 2,
    1 / (map.cols * map.cell),
    1 / (map.rows * map.cell),
  );
  return texture;
}

export function createPisteLights(level: Level, haze: HazeUniforms): PisteLights {
  const group = new THREE.Group();
  group.name = "piste-lights";
  const masts = planPisteLights(level);
  const lamps = masts.flatMap((m) => m.lamps);
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const std = (p: THREE.MeshStandardMaterialParameters, name: string) => {
    const m = hazeMaterial(new THREE.MeshStandardMaterial(p), haze, name, PAST_THE_WALL);
    mats.push(m);
    return m;
  };
  const steel = std({ color: 0x9aa2a9, roughness: 0.45, metalness: 0.6 }, "piste-mast");
  const housing = std({ color: 0x2b3036, roughness: 0.55, metalness: 0.3 }, "piste-lamp");
  const glass = std(
    { color: 0xdfe6ec, emissive: 0xffe9d0, emissiveIntensity: GLOW.day, roughness: 0.15 },
    "piste-glass",
  ) as THREE.MeshStandardMaterial;

  // The pole from its foot (y 0) to its head (y 1), stretched per mast; the
  // crossarm across its head (x −½…½), stretched to its lamps; the housing
  // with its glass on its face (+z), turned per lamp to its aim.
  const poleGeo = new THREE.CylinderGeometry(POLE.head, POLE.foot, 1, 6, 1, true).translate(
    0,
    0.5,
    0,
  );
  const armGeo = new THREE.BoxGeometry(1, ARM.section, ARM.section);
  const lampGeo = new THREE.BoxGeometry(LAMP.w, LAMP.h, LAMP.d);
  const glassGeo = new THREE.PlaneGeometry(LAMP.w * LAMP.glass, LAMP.h * LAMP.glass).translate(
    0,
    0,
    LAMP.d / 2 + 0.002,
  );
  geos.push(poleGeo, armGeo, lampGeo, glassGeo);
  const poles = new THREE.InstancedMesh(poleGeo, steel, Math.max(1, masts.length));
  const arms = new THREE.InstancedMesh(armGeo, steel, Math.max(1, masts.length));
  const heads = new THREE.InstancedMesh(lampGeo, housing, Math.max(1, lamps.length));
  const glasses = new THREE.InstancedMesh(glassGeo, glass, Math.max(1, lamps.length));
  poles.castShadow = arms.castShadow = heads.castShadow = true;
  poles.count = arms.count = masts.length;
  heads.count = glasses.count = lamps.length;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const at = new THREE.Vector3();
  const size = new THREE.Vector3();
  const aimer = new THREE.Object3D();
  let li = 0;
  masts.forEach((m, i) => {
    q.setFromAxisAngle(up, m.heading);
    at.set(m.x, m.y - POLE.sunk, m.z);
    poles.setMatrixAt(i, m4.compose(at, q, size.set(1, m.height + POLE.sunk, 1)));
    // The arm runs across the mast's face (the run's way), at its head.
    const reach = (m.lamps.length - 1) * ARM.spread + 2 * ARM.over + LAMP.w;
    q.setFromAxisAngle(up, m.heading + Math.PI / 2);
    at.set(m.x, m.y + m.height + ARM.below, m.z);
    arms.setMatrixAt(i, m4.compose(at, q, size.set(reach, 1, 1)));
    for (const l of m.lamps) {
      aimer.position.set(l.x, l.y, l.z);
      aimer.lookAt(l.x + l.dx, l.y + l.dy, l.z + l.dz);
      aimer.updateMatrix();
      heads.setMatrixAt(li, aimer.matrix);
      glasses.setMatrixAt(li, aimer.matrix);
      li++;
    }
  });
  for (const mesh of [poles, arms, heads, glasses]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }

  // THE HALOES: one quad a glass, turned to the lens in the shader.
  const quad = new THREE.PlaneGeometry(1, 1);
  const glowGeo = new THREE.InstancedBufferGeometry();
  glowGeo.index = quad.index;
  glowGeo.setAttribute("position", quad.getAttribute("position"));
  const centres = new Float32Array(lamps.length * 3);
  const aims = new Float32Array(lamps.length * 3);
  lamps.forEach((l, i) => {
    centres.set([l.x + l.dx * 0.12, l.y + l.dy * 0.12, l.z + l.dz * 0.12], i * 3);
    aims.set([l.dx, l.dy, l.dz], i * 3);
  });
  glowGeo.setAttribute("aCentre", new THREE.InstancedBufferAttribute(centres, 3));
  glowGeo.setAttribute("aAim", new THREE.InstancedBufferAttribute(aims, 3));
  glowGeo.instanceCount = lamps.length;
  geos.push(quad, glowGeo);
  const glowMat = glowMaterial(haze);
  mats.push(glowMat);
  const halo = new THREE.Mesh(glowGeo, glowMat);
  halo.frustumCulled = false;
  halo.renderOrder = 7;
  halo.visible = false;
  group.add(halo);

  haze.uPisteCol.value.set(...PISTE_LIGHT_COLOUR);
  let texture: THREE.DataTexture | null = null;
  return {
    group,
    masts,
    setLamps(dark, pixels) {
      const on = Math.min(1, Math.max(0, dark));
      glass.emissiveIntensity = GLOW.day + GLOW.night * on;
      halo.visible = on > 0.02 && lamps.length > 0;
      glowMat.uniforms.uOn.value = on;
      glowMat.uniforms.uPixels.value = pixels;
      // The light is baked the first time it is wanted: a map skied by day
      // never pays for it.
      if (on > 0.001 && texture === null && lamps.length > 0) {
        texture = uploadLight(level, masts, haze);
      }
      haze.uPisteOn.value.x = texture ? on * LUX_TO_LAMP : 0;
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const mesh of [poles, arms, heads, glasses]) mesh.dispose();
      texture?.dispose();
      if (texture && haze.uPisteLight.value === texture) haze.uPisteLight.value = null;
      haze.uPisteOn.value.x = 0;
    },
  };
}
