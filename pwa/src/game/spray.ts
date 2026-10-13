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
import type { AgedSnow, SnowProps } from "./snowpack.ts";
import { createSprayPool, SPRAY_MODEL, type SprayModel } from "./spray-sim.ts";

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
   * frame (0 for none); `snow` what the skier is on, as its age leaves it
   * (`snowpack.ts`'s `ageSnow`). */
  emit(
    skier: SkierState,
    level: Level,
    dt: number,
    landed: number,
    snow?: SnowProps | AgedSnow,
  ): void;
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
  /** How a grain flies (`spray-sim.ts`'s `SprayModel`) — the game flies
   * `SPRAY_MODEL`; the labs fly each candidate. */
  setModel(model: SprayModel): void;
  clear(): void;
  dispose(): void;
};

/** The model every spray made from now on flies — `SPRAY_MODEL` unless a
 * lab says otherwise (`flySprayAs`, the spray lab's `?spray=`). */
let flown: SprayModel = SPRAY_MODEL;

/** A LAB'S SWITCH: fly every spray made after this by `model`. */
export function flySprayAs(model: SprayModel): void {
  flown = model;
}

export function createSpray(haze: HazeUniforms): Spray {
  const pool = createSprayPool(CAPACITY);
  pool.model = flown;
  // Per grain: where and how big (xyz, size), how it moves and how opaque
  // (xyz, alpha), and what it is (hardness, glint, its own seed).
  const a0 = new Float32Array(CAPACITY * 4);
  const a1 = new Float32Array(CAPACITY * 4);
  const a2 = new Float32Array(CAPACITY * 3);

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const at0 = new THREE.InstancedBufferAttribute(a0, 4).setUsage(THREE.DynamicDrawUsage);
  const at1 = new THREE.InstancedBufferAttribute(a1, 4).setUsage(THREE.DynamicDrawUsage);
  const at2 = new THREE.InstancedBufferAttribute(a2, 3).setUsage(THREE.DynamicDrawUsage);
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
      // 0 draws every grain round (the `puff` model), 1 streaked.
      uStreak: { value: pool.model === "puff" ? 0 : 1 },
      uTime: { value: 0 },
      ...SHELTER,
    },
    vertexShader: /* glsl */ `
      attribute vec4 aSpot;
      attribute vec4 aMove;
      attribute vec3 aKind;
      uniform float uScale;
      uniform float uShutter;
      uniform float uStreak;
      uniform vec3 uSunDir;
      varying vec2 vUv;
      varying float vAlpha;
      varying float vHard;
      varying float vGlint;
      varying float vSeed;
      varying float vSize;
      varying float vPix;
      varying vec2 vSunSide;
      varying vec3 vWorld;
      void main() {
        vec3 world = aSpot.xyz;
        vec4 head = modelViewMatrix * vec4(world, 1.0);
        // The streak: where it was a shutter ago, a clump streaked less.
        vec3 back = world - aMove.xyz * uShutter * uStreak * (1.0 - 0.75 * aKind.x);
        vec4 tail = modelViewMatrix * vec4(back, 1.0);
        float depth = max(-head.z, 0.1);
        // A clump is drawn a size smaller than it flies: what reads as a
        // lump of snow at chase range is a fist, never a ball, and the ragged
        // edge the fragment cuts takes the rest of its silhouette.
        float drawn = aSpot.w * (1.0 - 0.45 * aKind.x);
        // Never thinner than about a pixel at its distance, so a far sheet
        // still reads as a fan rather than vanishing.
        float r = max(0.5 * drawn, 0.9 * depth / uScale);
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
        vSeed = aKind.z;
        vSize = aSpot.w;
        // How many pixels across its half-width is: a grain a pixel or two
        // across is a speck, a big one near the lens is a cluster of them.
        vPix = r * uScale / depth;
        // The sun's side of the quad, in its own (along, across) frame: a
        // clump's facets and a wisp's lit edge are turned to it.
        vec2 sunView = (viewMatrix * vec4(normalize(uSunDir), 0.0)).xy;
        float sl = length(sunView);
        sunView = sl > 1e-3 ? sunView / sl : vec2(0.0, 1.0);
        vSunSide = vec2(dot(sunView, axis), dot(sunView, side));
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
      varying float vSeed;
      varying float vSize;
      varying float vPix;
      varying vec2 vSunSide;
      varying vec3 vWorld;
      float sprayHash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float sprayNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = sprayHash(i);
        float b = sprayHash(i + vec2(1.0, 0.0));
        float c = sprayHash(i + vec2(0.0, 1.0));
        float e = sprayHash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, e, f.x), f.y);
      }
      void main() {
        if (sheltered(vWorld)) discard;
        vec2 o = vec2(vSeed * 17.3, vSeed * 41.9);
        // THE SILHOUETTE. A clump is a broken lump: its rim pushed in and
        // out round it by a noise of the angle, never a disc. A grain is a
        // soft speck, and a big soft one — the powder a turn puts in the air
        // — is a WISP: a little volume of snow eroded by a noise, thinner
        // the bigger it has spread, so a sheet of them builds a veil rather
        // than a pile of balls.
        float ang = atan(vUv.y, vUv.x);
        float rim = 0.72 + 0.28 * sprayNoise(vec2(ang * 1.1 + o.x, o.y)) + 0.1 * sprayNoise(vec2(ang * 2.6 - o.y, o.x));
        float r = dot(vUv, vUv);
        float rc = r / (rim * rim);
        float wisp = smoothstep(0.08, 0.35, vSize) * (1.0 - vHard);
        float n = sprayNoise(vUv * 2.2 + o) * 0.65 + sprayNoise(vUv * 5.3 - o) * 0.35;
        float grain = (1.0 - r) * (1.0 - r);
        float puffy = clamp((1.0 - r) * (0.35 + 1.1 * n) - 0.28, 0.0, 1.0);
        // ONLY A TRUE CLUMP IS ONE LUMP. Anything softer the sim flies as
        // one particle is, seen close, a LITTLE VOLUME OF GRAINS: specks
        // scattered over its footprint (a cell each, jittered, some empty)
        // in a thin haze of the fines — so a powder plume and a stop's sheet
        // read as granular snow in the air, never as a pile of soft balls.
        // Far off, where the particle is a pixel or two, it is the speck.
        float clumpy = smoothstep(0.72, 0.95, vHard);
        vec2 q = vUv * 3.2 + o;
        vec2 ci = floor(q);
        vec2 cf = fract(q) - 0.5;
        float hr = sprayHash(ci + o);
        vec2 jit = vec2(sprayHash(ci + 3.1), sprayHash(ci + 7.7)) - 0.5;
        float dotR = 0.12 + 0.2 * hr;
        float speck = smoothstep(dotR, dotR * 0.45, length(cf - jit * 0.55)) * step(0.3, hr);
        float cluster = speck * (1.0 - r) * (0.75 + 0.35 * hr) + 0.22 * puffy;
        float close = smoothstep(3.0, 9.0, vPix);
        float soft = mix(grain, mix(cluster, puffy * 0.45, wisp * 0.6), close);
        float body = mix(soft, smoothstep(1.0, 0.7, rc), clumpy);
        if (body <= 0.003) discard;
        // Spread thin: a puff grown to many times its first size is the
        // same snow over a wider space.
        float thin = mix(1.0, clamp(0.09 / max(vSize, 1e-3), 0.4, 1.0), 1.0 - clumpy);
        // THE LIGHT. A clump has FACETS: a pseudo-normal off its position on
        // the quad and the noise, lit by the sun's side, shaded the sky's
        // blue away from it. A grain or a wisp is lit through: the sky and
        // the sun round it, and on the sun's side a brighter edge.
        vec2 facet = normalize(vUv + (vec2(sprayNoise(vUv * 3.0 + o), sprayNoise(vUv * 3.0 - o)) - 0.5) * 1.2 + 1e-4);
        float toSun = dot(facet, vSunSide);
        float litClump = clamp(0.5 + 0.55 * toSun, 0.0, 1.0);
        // A volume of grains shades itself: seen close, its far side and
        // its middle stand in the sky's blue, and only the sun's side of it
        // is as white as the sunlit snow — so a plume reads against the
        // slope it rose from rather than vanishing into it.
        float litSoft = clamp(mix(0.62, 0.42, close) + 0.3 * dot(vUv, vSunSide), 0.0, 1.0);
        float lit = mix(litSoft, litClump, clumpy);
        vec3 col = mix(uShade * (1.0 - 0.25 * vHard), uLit, lit);
        // FORWARD SCATTER: ice grains between the eye and the sun throw it
        // on along the way it was going (Henyey–Greenstein, g 0.78) — a
        // backlit spray is a silver sheet, a powder plume glows white-gold
        // round a low sun, and the THIN of it glows the most: the edge of a
        // wisp and the fine grains, not the clump's opaque middle.
        vec3 ray = vWorld - cameraPosition;
        float d = length(ray);
        vec3 view = ray / max(d, 1e-3);
        float mu = dot(view, normalize(uSunDir));
        float g = 0.78;
        float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5) / 12.0;
        float through = (1.0 - 0.75 * clumpy) * (1.0 - 0.55 * body);
        float above = smoothstep(-0.02, 0.06, uSunDir.y);
        col += uSunCol * hg * through * above * 0.9;
        // GLINTS: a crystal catching the sun as it turns — a pixel each,
        // more of them toward the sun, a clump's facets the most.
        vec2 gp = gl_FragCoord.xy;
        float flick = sprayHash(floor(gp) + vec2(vSeed * 97.0, floor(uTime * 14.0 + vSeed * 31.0)));
        float odds = (0.03 + 0.05 * vHard) * vGlint * (0.4 + min(hg, 3.0) * 0.4);
        col += uSunCol * step(1.0 - odds, flick) * body * 2.2 * above;
        gl_FragColor = vec4(col, body * vAlpha * thin);
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
        a2[n * 3] = hard[i];
        a2[n * 3 + 1] = glint[i];
        // Its own seed off its slot, steady for its life: its ragged rim
        // and its wisp's noise do not boil from frame to frame.
        a2[n * 3 + 2] = (i * 0.618034) % 1;
        n++;
      }
      geometry.instanceCount = n;
      if (n > 0) {
        at0.clearUpdateRanges();
        at1.clearUpdateRanges();
        at2.clearUpdateRanges();
        at0.addUpdateRange(0, n * 4);
        at1.addUpdateRange(0, n * 4);
        at2.addUpdateRange(0, n * 3);
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
    setModel(model) {
      pool.model = model;
      material.uniforms.uStreak.value = model === "puff" ? 0 : 1;
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
