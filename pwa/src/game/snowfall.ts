// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW IN THE AIR: the fall R19 deals, and the spindrift the wind lifts
// off the ridges. Both are carried by the engine's own wind (`windAt`), so
// the flakes, the drift off a crest and the cloud overhead all go the same
// way at the same pace.
//
//   * THE FALL is a box of flakes round the lens, WRAPPED: each flake's
//     place is its seed in the box plus how far the air has carried the
//     whole fall (`shift`), taken modulo the box about the lens — so the box
//     is always full wherever the lens goes and the CPU moves nothing but
//     one vector a frame. How hard it snows is how many of the flakes are
//     drawn (the draw range), and the picture's SPRAY row caps the pool.
//     A flake in a beam lights up — the player's headlamp, a rival's, the
//     finish arena's floods: the snow streaming through a lamp is most of
//     what a night fall looks like.
//   * THE AIR'S CRYSTALS: under a sky that is not snowing the box is never
//     quite empty — a few thousand of the same flakes, drawn as fine ice
//     dust that hangs rather than falls, near the lens only. It is the one
//     thing in open air close enough to stream past: at pace the crystals
//     whip by the lens, which is most of what says the skier is FAST over a
//     meadow with nothing else near it. As the fall starts they become it.
//   * THE SPINDRIFT is a few hundred grains on the CPU, lifted where the
//     ground CRESTS (the ground over its neighbours) and blown downwind a
//     metre or two off the snow, fading as they go. Only a wind that could
//     really lift dry snow makes any: none under six metres a second.
//
// Presentation only, and never read by the engine. Drawn after the world,
// blended over it, writing no depth.

import * as THREE from "three";
import { createRng, type Level, type Wind } from "@engine";

import { LAMP_GLSL, LAMP_SLOTS, type HazeUniforms } from "./haze.ts";
import type { SkyLook } from "./sky.ts";

/** Flakes in the pool at a SPRAY share of 1. */
const FLAKES = 14000;
/** The box of air round the lens the fall fills, m a side. */
const BOX = 48;
/** How fast a flake falls through still air, m/s. */
const FALL_SPEED = 1.1;
/** The air's crystals at a SPRAY share of 1, how slowly they settle, m/s,
 * and how far from the lens they are drawn, m (faded from its middle). */
const MOTES = 4000;
const MOTE_SETTLE = 0.2;
const MOTE_REACH = 14;
/** Spindrift grains at a SPRAY share of 1. */
const GRAINS = 900;
/** The wind at which dry snow starts to lift, and where it is all lifting,
 * m/s. */
const LIFT = { from: 6, full: 13 };

export type Snowfall = {
  group: THREE.Group;
  /** One frame: the look (how hard it falls, how it is lit), the wind, the
   * lens, and the level for the ground the spindrift runs on. */
  update(look: SkyLook, wind: Wind, camera: THREE.Camera, level: Level, dt: number): void;
  /** The pixels a metre spans at a metre from the lens. */
  setScale(pixelsPerMetre: number): void;
  /** The SPRAY row's share of the pools. */
  setBudget(share: number): void;
  clear(): void;
  dispose(): void;
};

export function createSnowfall(haze: HazeUniforms): Snowfall {
  const group = new THREE.Group();
  const rng = createRng(0x51e7);
  let share = 1;

  // THE FALL.
  const seeds = new Float32Array(FLAKES * 4);
  for (let i = 0; i < FLAKES * 4; i++) seeds[i] = rng.next();
  const fallGeo = new THREE.BufferGeometry();
  // Three wants a position attribute to size the draw; the shader uses the
  // seeds alone.
  fallGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(FLAKES * 3), 3));
  fallGeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
  fallGeo.setDrawRange(0, 0);
  const own = {
    uShift: { value: new THREE.Vector3() },
    uCam: { value: new THREE.Vector3() },
    uTime: { value: 0 },
    uScale: { value: 600 },
    uLit: { value: new THREE.Color(1, 1, 1) },
    /** How big the flakes are: a flurry's fine crystals to a storm's
     * wet clumps driving past the lens. */
    uSize: { value: 1 },
    /** 1 when the box holds only the air's crystals, 0 in a fall. */
    uMote: { value: 0 },
  };
  const fallMat = new THREE.ShaderMaterial({
    uniforms: {
      ...own,
      uLampPos: haze.uLampPos,
      uLampDir: haze.uLampDir,
      uLampOn: haze.uLampOn,
      uLampCol: haze.uLampCol,
      uLampBeam: haze.uLampBeam,
    },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform vec3 uShift;
      uniform vec3 uCam;
      uniform float uTime;
      uniform float uScale;
      uniform float uSize;
      uniform float uMote;
      uniform vec3 uLit;
      ${LAMP_GLSL}
      varying float vAlpha;
      varying vec3 vCol;
      void main() {
        vec3 p = aSeed.xyz * ${BOX.toFixed(1)} + uShift;
        // Each flake flutters on its own clock as it falls.
        float ph = aSeed.w * 43.0;
        p.x += sin(uTime * (0.8 + aSeed.w) + ph) * 0.35;
        p.z += cos(uTime * (0.7 + aSeed.w) + ph * 1.3) * 0.35;
        p = mod(p - uCam + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)} + uCam;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float depth = max(-mv.z, 0.05);
        float size = (0.035 + 0.05 * aSeed.w) * uSize * mix(1.0, 0.35, uMote);
        float px = size * uScale / depth;
        gl_PointSize = clamp(px, 1.0, 24.0);
        float dist = length(p - uCam);
        // A flake smaller than a pixel is drawn a pixel wide and fainter;
        // the box's edge fades, so its wrap is never seen. The air's
        // crystals are only drawn near the lens, where they stream past.
        float reach = mix(${(BOX / 2).toFixed(1)}, ${MOTE_REACH.toFixed(1)}, uMote);
        vAlpha = min(px, 1.0) * smoothstep(reach, reach * 0.6, dist)
          * smoothstep(0.25, 1.0, dist) * mix(1.0, 0.6, uMote);
        vCol = uLit;
        for (int i = 0; i < ${LAMP_SLOTS}; i++) {
          if (uLampOn[i] <= 0.001) continue;
          vec3 L = uLampPos[i] - p;
          float d = length(L);
          vCol += uLampCol[i] * lampReach(i, L / max(d, 1e-3), d) * 7.0;
        }
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying vec3 vCol;
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0;
        float r = dot(q, q);
        if (r > 1.0) discard;
        gl_FragColor = vec4(vCol * 1.15, vAlpha * (1.0 - r * r));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const fall = new THREE.Points(fallGeo, fallMat);
  fall.frustumCulled = false;
  fall.renderOrder = 5;
  group.add(fall);

  // THE SPINDRIFT.
  const gPos = new Float32Array(GRAINS * 3);
  const gAlpha = new Float32Array(GRAINS);
  const gAge = new Float32Array(GRAINS);
  const gLife = new Float32Array(GRAINS);
  const gRise = new Float32Array(GRAINS);
  const driftGeo = new THREE.BufferGeometry();
  const gPosAttr = new THREE.BufferAttribute(gPos, 3).setUsage(THREE.DynamicDrawUsage);
  const gAlphaAttr = new THREE.BufferAttribute(gAlpha, 1).setUsage(THREE.DynamicDrawUsage);
  driftGeo.setAttribute("position", gPosAttr);
  driftGeo.setAttribute("aAlpha", gAlphaAttr);
  const driftMat = new THREE.ShaderMaterial({
    uniforms: { uScale: own.uScale, uLit: own.uLit },
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      uniform float uScale;
      varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float px = 0.22 * uScale / max(-mv.z, 0.1);
        gl_PointSize = clamp(px, 1.0, 64.0);
        vAlpha = aAlpha * min(px, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uLit;
      varying float vAlpha;
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0;
        float r = dot(q, q);
        if (r > 1.0) discard;
        gl_FragColor = vec4(uLit, vAlpha * (1.0 - r) * (1.0 - r) * 0.35);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const drift = new THREE.Points(driftGeo, driftMat);
  drift.frustumCulled = false;
  drift.renderOrder = 5;
  group.add(drift);

  /** How far above its neighbours the ground crests here, m. */
  const crest = (level: Level, x: number, z: number): number => {
    const r = 7;
    const mean =
      (level.groundAt(x + r, z) +
        level.groundAt(x - r, z) +
        level.groundAt(x, z + r) +
        level.groundAt(x, z - r)) /
      4;
    return level.groundAt(x, z) - mean;
  };

  const lift = (level: Level, i: number, cx: number, cz: number, wind: Wind): boolean => {
    // Upwind of the lens, so the drift blows across the picture.
    const up = wind.speed > 0 ? 1 / wind.speed : 0;
    for (let tries = 0; tries < 3; tries++) {
      const a = rng.next() * Math.PI * 2;
      const r = 4 + rng.next() * 45;
      const x = cx + Math.cos(a) * r - wind.x * up * 12;
      const z = cz + Math.sin(a) * r - wind.z * up * 12;
      // Off a crest every time; off the open snow now and then.
      if (crest(level, x, z) < 0.15 && rng.next() > 0.2) continue;
      gPos[i * 3] = x;
      gPos[i * 3 + 1] = level.groundAt(x, z) + 0.1;
      gPos[i * 3 + 2] = z;
      gAge[i] = 0;
      gLife[i] = 1.2 + rng.next() * 2;
      gRise[i] = 0.3 + rng.next() * 0.9;
      return true;
    }
    return false;
  };

  let grains = GRAINS;
  const api: Snowfall = {
    group,
    update(look, wind, camera, level, dt) {
      const step = Math.min(dt, 0.1);
      // Lit by the sky and the key, never brighter than the snow it lands on.
      const k = look.keyIntensity * 0.25;
      const a = look.ambient * 0.55;
      own.uLit.value.setRGB(
        look.keyColour[0] * k + look.skyLight[0] * a,
        look.keyColour[1] * k + look.skyLight[1] * a,
        look.keyColour[2] * k + look.skyLight[2] * a,
      );
      own.uCam.value.copy(camera.position);
      own.uTime.value += step;
      const s = own.uShift.value;
      // A fall of a tenth or more is a fall; under that the box is the
      // air's crystals, settling slowly, and a fall grows out of them.
      const mote = 1 - Math.min(1, look.snowfall / 0.1);
      own.uMote.value = mote;
      s.x = (s.x + wind.x * step) % BOX;
      s.y = (s.y - (FALL_SPEED + (MOTE_SETTLE - FALL_SPEED) * mote) * step) % BOX;
      s.z = (s.z + wind.z * step) % BOX;
      const flakes = Math.round(share * Math.max(FLAKES * Math.pow(look.snowfall, 0.7), MOTES));
      own.uSize.value = 0.8 + 1.3 * look.snowfall;
      fallGeo.setDrawRange(0, flakes);
      fall.visible = flakes > 0;

      const strength =
        Math.max(0, Math.min(1, (wind.speed - LIFT.from) / (LIFT.full - LIFT.from))) *
        (1 - look.fog);
      const want = Math.round(grains * strength);
      let live = 0;
      for (let i = 0; i < grains; i++) {
        if (gLife[i] <= 0) {
          gAlpha[i] = 0;
          if (live < want && lift(level, i, camera.position.x, camera.position.z, wind)) live++;
          continue;
        }
        gAge[i] += step;
        const t = gAge[i] / gLife[i];
        if (t >= 1) {
          gLife[i] = 0;
          gAlpha[i] = 0;
          continue;
        }
        live++;
        const x = gPos[i * 3] + wind.x * 1.1 * step;
        const z = gPos[i * 3 + 2] + wind.z * 1.1 * step;
        gPos[i * 3] = x;
        gPos[i * 3 + 2] = z;
        gPos[i * 3 + 1] = level.groundAt(x, z) + 0.1 + gRise[i] * Math.sin(t * Math.PI * 0.6);
        gAlpha[i] = Math.sin(t * Math.PI) * strength;
      }
      for (let i = grains; i < GRAINS; i++) gAlpha[i] = 0;
      drift.visible = live > 0;
      driftGeo.setDrawRange(0, grains);
      gPosAttr.needsUpdate = true;
      gAlphaAttr.needsUpdate = true;
    },
    setScale(v) {
      own.uScale.value = v;
    },
    setBudget(next) {
      share = Math.max(0, Math.min(1, next));
      grains = Math.round(GRAINS * share);
      for (let i = grains; i < GRAINS; i++) gLife[i] = 0;
    },
    clear() {
      gLife.fill(0);
      gAlpha.fill(0);
    },
    dispose() {
      fallGeo.dispose();
      fallMat.dispose();
      driftGeo.dispose();
      driftMat.dispose();
    },
  };
  return api;
}
