// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A SKIER THROWS, DRAWN — the grains and clumps `spray-sim.ts` flies
// (the edge's sheet, the carve's tail, the powder over the shoulder, the
// landing puff, a body's burst), every one of every skier in ONE draw.
//
// A grain is drawn as the eye and a camera see a small bright thing moving
// fast: a STREAK along its own motion over a short shutter, not a dot — so
// a sheet thrown off a sliding edge reads as a fan of streaks fanning out
// and falling, the way spray reads in a photograph of a hockey stop or a
// turn in powder (a dot cloud reads as foam). A clump is streaked less: it
// is a lump with an edge. A streak is thinned by its length, so a fast
// grain is not brighter than a slow one.
//
// They are lit as the snow is — the sun's colour on the lit side, the
// sky's blue in shade — GLOW against a low sun (a thin sheet of ice
// scatters forward: spray seen into the sun is silver), GLINT as the
// crystals turn (more off new snow than wet), and fade into the same haze.
// The fine powder that hangs is `snow-cloud.ts`'s.

import * as THREE from "three";
import type { Level, SkierState } from "@engine";

import { SKY_GLSL, type HazeUniforms } from "./haze.ts";
import { SHELTER, SHELTER_GLSL } from "./shelter.ts";
import type { SkyLook } from "./sky.ts";
import type { SnowProps } from "./snowpack.ts";
import { createSprayPool } from "./spray-sim.ts";

export { heavyShare } from "./spray-sim.ts";

const CAPACITY = 6000;
/** The shutter a streak is drawn over, s: long enough that a chip thrown
 * at 10 m/s reads as a stroke a hand long at chase range. */
const SHUTTER = 0.045;

export type Spray = {
  /** The one draw (an instanced quad a grain), named `points` for the
   * renderer that adds it. */
  points: THREE.Object3D;
  /** Emit for one rider over `dt`; `landed` is the landing's measure this
   * frame (0 for none); `snow` what the skier is on (`snowpack.ts`). */
  emit(skier: SkierState, level: Level, dt: number, landed: number, snow?: SnowProps): void;
  /** A BURST of snow thrown up at a point — a wipeout's (`size` 1) or a
   * body bouncing on the snow (less) — carried along at (vx, vz). */
  burst(
    x: number,
    y: number,
    z: number,
    vx: number,
    vz: number,
    size: number,
    snow?: SnowProps,
  ): void;
  /** ONE GRAIN OR CLUMP FLUNG from a point at (vx, vy, vz) — a
   * snowmobile's roost off its paddles (`sled-scene.ts`): living `life` s,
   * `size` m across, `hard` 0 a grain puff … 1 a clump. Thinned by the
   * SPRAY row's share. */
  fling(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    hard: number,
  ): void;
  update(dt: number, look: SkyLook, level: Level): void;
  /** Pixels per metre at one metre from the lens (the projection's scale)
   * — the streak keeps a grain at least about a pixel across. */
  setScale(pixelsPerMetre: number): void;
  /** The SPRAY row: the share, 0..1, of every emission rate and of the pool
   * the particles are flown from. */
  setBudget(share: number): void;
  clear(): void;
  dispose(): void;
};

export function createSpray(haze: HazeUniforms): Spray {
  const pool = createSprayPool(CAPACITY);
  // Per grain: where and how big (xyz, size), how it moves and how opaque
  // (xyz, alpha), and what it is (hardness, glint).
  const a0 = new Float32Array(CAPACITY * 4);
  const a1 = new Float32Array(CAPACITY * 4);
  const a2 = new Float32Array(CAPACITY * 2);

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const at0 = new THREE.InstancedBufferAttribute(a0, 4).setUsage(THREE.DynamicDrawUsage);
  const at1 = new THREE.InstancedBufferAttribute(a1, 4).setUsage(THREE.DynamicDrawUsage);
  const at2 = new THREE.InstancedBufferAttribute(a2, 2).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aSpot", at0);
  geometry.setAttribute("aMove", at1);
  geometry.setAttribute("aKind", at2);
  geometry.instanceCount = 0;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...haze,
      uLit: { value: new THREE.Color(1, 1, 1) },
      uShade: { value: new THREE.Color(0.6, 0.7, 0.9) },
      uScale: { value: 600 },
      uShutter: { value: SHUTTER },
      uTime: { value: 0 },
      ...SHELTER,
    },
    vertexShader: /* glsl */ `
      attribute vec4 aSpot;
      attribute vec4 aMove;
      attribute vec2 aKind;
      uniform float uScale;
      uniform float uShutter;
      varying vec2 vUv;
      varying float vAlpha;
      varying float vHard;
      varying float vGlint;
      varying float vUp;
      varying vec3 vWorld;
      void main() {
        vec3 world = aSpot.xyz;
        vec4 head = modelViewMatrix * vec4(world, 1.0);
        // The streak: where it was a shutter ago, a clump streaked less.
        vec3 back = world - aMove.xyz * uShutter * (1.0 - 0.75 * aKind.x);
        vec4 tail = modelViewMatrix * vec4(back, 1.0);
        float depth = max(-head.z, 0.1);
        // Never thinner than about a pixel at its distance, so a far sheet
        // still reads as a fan rather than vanishing.
        float r = max(0.5 * aSpot.w, 0.9 * depth / uScale);
        vec2 d = head.xy - tail.xy;
        float len = length(d);
        vec2 axis = len > 1e-4 ? d / len : vec2(0.0, 1.0);
        vec2 side = vec2(-axis.y, axis.x);
        vec3 mid = 0.5 * (head.xyz + tail.xyz);
        float along = r + 0.5 * len;
        vec3 at = mid + vec3(axis * along * position.x + side * r * position.y, 0.0);
        vUv = position.xy;
        // Thinned by its length: the same light spread down a longer stroke —
        // and let go of close to the lens, where a grain would be an egg
        // across the picture rather than a grain.
        vAlpha = aMove.w * sqrt(r / along) * smoothstep(0.7, 2.2, depth);
        vHard = aKind.x;
        vGlint = aKind.y;
        vUp = (axis * along * position.x + side * r * position.y).y / max(along, r);
        vWorld = world;
        if (aMove.w <= 0.0) at = vec3(0.0, 0.0, 1.0); // dead: behind the lens
        gl_Position = projectionMatrix * vec4(at, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${SKY_GLSL}
      ${SHELTER_GLSL}
      uniform vec3 uLit;
      uniform vec3 uShade;
      uniform float uTime;
      varying vec2 vUv;
      varying float vAlpha;
      varying float vHard;
      varying float vGlint;
      varying float vUp;
      varying vec3 vWorld;
      void main() {
        float r = dot(vUv, vUv);
        if (r > 1.0 || sheltered(vWorld)) discard;
        // A grain is soft to its rim; a clump is a lump with an edge.
        float soft = mix((1.0 - r) * (1.0 - r), smoothstep(1.0, 0.55, r), vHard);
        // Its top is lit, its underside in the sky's blue; a clump more so.
        float lit = clamp(0.45 + vUp * 0.55 * (1.0 + vHard), 0.0, 1.0);
        vec3 col = mix(uShade * (1.0 - 0.3 * vHard), uLit, lit);
        // FORWARD SCATTER: grains of ice seen against the sun glow.
        vec3 ray = vWorld - cameraPosition;
        float d = length(ray);
        vec3 view = ray / max(d, 1e-3);
        float toward = max(dot(view, normalize(uSunDir)), 0.0);
        col += uSunCol * (0.5 * pow(toward, 6.0) + 0.6 * pow(toward, 40.0)) * (1.0 - vHard) * step(0.0, uSunDir.y);
        // GLINTS: a crystal catching the sun as it turns, now and then.
        float flick = fract(sin(dot(floor(vWorld * 40.0), vec3(12.9898, 78.233, 37.719)) + uTime * 3.0) * 43758.5453);
        col += uSunCol * vGlint * step(0.93, flick) * (1.0 - r) * 1.5;
        gl_FragColor = vec4(col, soft * vAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        vec3 hz = hazeColour(view);
        #if defined(TONE_MAPPING)
          hz = toneMapping(hz);
        #endif
        hz = linearToOutputTexel(vec4(hz, 1.0)).rgb;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, hz, hazeAmount(d, ray.y));
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;

  return {
    points: mesh,
    emit: pool.emit,
    burst: pool.burst,
    fling: pool.fling,
    update(dt, look, level) {
      const lit = material.uniforms.uLit.value as THREE.Color;
      const shade = material.uniforms.uShade.value as THREE.Color;
      const sun = look.keyIntensity * 0.34;
      const sky = look.ambient * 0.55;
      lit.setRGB(
        look.keyColour[0] * sun + look.skyLight[0] * sky,
        look.keyColour[1] * sun + look.skyLight[1] * sky,
        look.keyColour[2] * sun + look.skyLight[2] * sky,
      );
      shade.setRGB(
        look.skyLight[0] * sky * 1.2,
        look.skyLight[1] * sky * 1.2,
        look.skyLight[2] * sky * 1.25,
      );
      material.uniforms.uTime.value += dt;
      pool.step(dt, level);
      // Pack the live grains to the front of the instance buffer: the draw
      // pays for what is flying, never for the pool's empty slots.
      const { pos, vel, size, alpha, hard, glint } = pool;
      let n = 0;
      for (let i = 0; i < pool.cap; i++) {
        if (alpha[i] <= 0.004 || size[i] <= 0) continue;
        const k = i * 3;
        a0[n * 4] = pos[k];
        a0[n * 4 + 1] = pos[k + 1];
        a0[n * 4 + 2] = pos[k + 2];
        a0[n * 4 + 3] = size[i];
        a1[n * 4] = vel[k];
        a1[n * 4 + 1] = vel[k + 1];
        a1[n * 4 + 2] = vel[k + 2];
        a1[n * 4 + 3] = alpha[i];
        a2[n * 2] = hard[i];
        a2[n * 2 + 1] = glint[i];
        n++;
      }
      geometry.instanceCount = n;
      if (n > 0) {
        at0.clearUpdateRanges();
        at1.clearUpdateRanges();
        at2.clearUpdateRanges();
        at0.addUpdateRange(0, n * 4);
        at1.addUpdateRange(0, n * 4);
        at2.addUpdateRange(0, n * 2);
        at0.needsUpdate = true;
        at1.needsUpdate = true;
        at2.needsUpdate = true;
      }
    },
    setScale(v) {
      material.uniforms.uScale.value = v;
    },
    setBudget(next) {
      pool.setBudget(next);
    },
    clear() {
      pool.clear();
      geometry.instanceCount = 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
