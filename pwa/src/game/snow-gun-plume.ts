// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW GUNS' PLUMES — the cone of fine ice a running gun throws over
// its run (`snow-guns.ts` in the engine, the guns as drawn `snow-guns-view.ts`).
//
// A plume is a few hundred soft puffs per gun, each one a pure function of
// the clock in the shader — nothing is stepped on the CPU, the whole ski
// area one instanced draw. A puff leaves the nozzle at the jet's speed along
// the drum's aim as it stood WHEN THE PUFF LEFT (so a sweeping fan gun lays
// a curved fan of snow, as a real one does), loses that speed to the air on
// a time constant (`drag`), is carried off by the wind, settles at the speed
// small ice settles at, swells as the cone opens (1.2 m at the mouth, some
// 15–25 m wide at its end) and thins as it goes: dense and white as steam
// at the mouth, a veil of drifting crystals over the run, gone at the snow.
// A fan gun's cone rises 8–15 m and lands 40–60 m out; a lance's mist leaves
// its head slowly and falls in a fine drift 10–35 m downwind.
//
// Lit as the falling snow is (the key and the sky), brighter looking into a
// low sun through it (ice scatters forward) and by the floodlights and the
// lamps after dark; faded into the haze. Presentation only.

import * as THREE from "three";
import { SNOW_GUN, type Level, type SnowGun, type Wind } from "@engine";

import { LAMP_GLSL, LAMP_SLOTS, type HazeUniforms } from "./haze.ts";
import type { SkyLook } from "./sky.ts";

/** How a kind's jet flies: the speed it leaves at, m/s, how far up from
 * the aim's tilt it is thrown, rad, the drag's rate, 1/s, how fast its ice
 * settles, m/s, how long a puff lives, s, the cone's spread either side,
 * rad, a puff's size at the mouth and how much it swells a second, m, and
 * how thick it is drawn; the puffs a gun throws. */
export const PLUME = {
  fan: {
    speed: 24,
    drag: 0.6,
    settle: 2.5,
    life: 9,
    spread: 0.075,
    size: 0.9,
    swell: 1.0,
    alpha: 0.75,
    puffs: 360,
  },
  lance: {
    speed: 11,
    drag: 0.7,
    settle: 0.55,
    life: 12,
    spread: 0.16,
    size: 0.5,
    swell: 0.9,
    alpha: 0.45,
    puffs: 160,
  },
  /** Past this from the lens a plume is not drawn, m. */
  reach: 900,
} as const;

export type Plumes = {
  mesh: THREE.Mesh;
  /** One frame: the run's clock, the sky, the wind, the lens. */
  update(t: number, look: SkyLook, wind: Wind, eye: THREE.Vector3, pixels: number): void;
  dispose(): void;
};

/** The ground under a gun's plume, as a plane: its height at the gun's
 * foot and its fall along x and z — read off the map at the foot, where
 * the cone lands and to either side of it. */
function groundPlane(level: Level, g: SnowGun): [number, number, number] {
  const r = 12;
  const gx =
    (level.groundAt(g.land.x + r, g.land.z) - level.groundAt(g.land.x - r, g.land.z)) / (2 * r);
  const gz =
    (level.groundAt(g.land.x, g.land.z + r) - level.groundAt(g.land.x, g.land.z - r)) / (2 * r);
  return [g.y, gx, gz];
}

export function createPlumes(level: Level, guns: readonly SnowGun[], haze: HazeUniforms): Plumes {
  const count = guns.reduce((n, g) => n + PLUME[g.mount === "lance" ? "lance" : "fan"].puffs, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3),
  );
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  // Per puff: its gun's nozzle and aim; the ground's plane (its height at
  // the foot, its fall along x and z) and how thick the kind is drawn; the
  // jet (speed, tilt, sweep, the sweep's phase); the air on it (drag,
  // settling, life, spread); its own scatter; the foot in plan, the size
  // at the mouth and the swell.
  const nozzle = new Float32Array(count * 4);
  const ground = new Float32Array(count * 4);
  const jet = new Float32Array(count * 4);
  const puff = new Float32Array(count * 4);
  const seed = new Float32Array(count * 4);
  const foot = new Float32Array(count * 4);
  // A fixed scatter, so a seed's plumes look the same twice.
  let h = 0x2545f491;
  const rand = (): number => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
  let k = 0;
  guns.forEach((g, gi) => {
    const lance = g.mount === "lance";
    const P = PLUME[lance ? "lance" : "fan"];
    const tilt = lance ? -0.05 : SNOW_GUN.fan.tilt;
    const sweep = lance ? 0 : SNOW_GUN.fan.sweep;
    const phase = (gi * 2.399963) % (Math.PI * 2);
    const [y, gx, gz] = groundPlane(level, g);
    for (let i = 0; i < P.puffs; i++, k++) {
      nozzle.set([g.nozzle.x, g.nozzle.y, g.nozzle.z, g.aim], k * 4);
      ground.set([y, gx, gz, P.alpha], k * 4);
      jet.set([P.speed, tilt, sweep, phase], k * 4);
      puff.set([P.drag, P.settle, P.life, P.spread], k * 4);
      seed.set([rand(), rand(), rand(), rand()], k * 4);
      foot.set([g.x, g.z, P.size, P.swell], k * 4);
    }
  });
  geo.setAttribute("aNozzle", new THREE.InstancedBufferAttribute(nozzle, 4));
  geo.setAttribute("aGround", new THREE.InstancedBufferAttribute(ground, 4));
  geo.setAttribute("aJet", new THREE.InstancedBufferAttribute(jet, 4));
  geo.setAttribute("aPuff", new THREE.InstancedBufferAttribute(puff, 4));
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 4));
  geo.setAttribute("aFoot", new THREE.InstancedBufferAttribute(foot, 4));
  geo.instanceCount = count;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWind: { value: new THREE.Vector3() },
      uLit: { value: new THREE.Color(1, 1, 1) },
      uShade: { value: new THREE.Color(0.6, 0.65, 0.75) },
      uSun: haze.uSunDir,
      uSunCol: haze.uSunCol,
      uHaze: haze.uHaze,
      uMist: haze.uMist,
      uPeriod: { value: SNOW_GUN.fan.period },
      uReach: { value: PLUME.reach },
      uLampPos: haze.uLampPos,
      uLampDir: haze.uLampDir,
      uLampOn: haze.uLampOn,
      uLampCol: haze.uLampCol,
      uLampBeam: haze.uLampBeam,
      uPisteLight: haze.uPisteLight,
      uPisteBox: haze.uPisteBox,
      uPisteOn: haze.uPisteOn,
      uPisteCol: haze.uPisteCol,
    },
    vertexShader: /* glsl */ `
      attribute vec4 aNozzle;
      attribute vec4 aGround;
      attribute vec4 aJet;
      attribute vec4 aPuff;
      attribute vec4 aSeed;
      attribute vec4 aFoot;
      uniform float uTime;
      uniform vec3 uWind;
      uniform vec3 uLit;
      uniform vec3 uShade;
      uniform vec3 uSun;
      uniform vec3 uSunCol;
      uniform float uHaze;
      uniform float uMist;
      uniform float uPeriod;
      uniform float uReach;
      ${LAMP_GLSL}
      varying vec2 vAt;
      varying float vAlpha;
      varying vec3 vCol;
      varying float vCore;
      void main() {
        float drag = aPuff.x;
        float settle = aPuff.y;
        float life = aPuff.z;
        float spread = aPuff.w;
        // Its age, and the moment it left the nozzle.
        float tau = mod(uTime + aSeed.x * life, life);
        float left = uTime - tau;
        // The aim as it stood then: the drum swept about its aim.
        float yaw = aNozzle.w + aJet.z * sin(6.2831853 * left / uPeriod + aJet.w);
        // Scattered over the cone, tighter at its heart.
        float r = spread * sqrt(aSeed.y);
        float a = 6.2831853 * aSeed.z;
        yaw += r * cos(a);
        float tilt = aJet.y + r * sin(a);
        vec3 dir = vec3(sin(yaw) * cos(tilt), sin(tilt), cos(yaw) * cos(tilt));
        float speed = aJet.x * (0.8 + 0.4 * fract(aSeed.w * 7.31));
        // The jet slowed by the air toward the speed its ice ends at: the
        // wind's, falling at the speed it settles at (linear drag, solved).
        float slow = (1.0 - exp(-drag * tau)) / drag;
        vec3 term = uWind - vec3(0.0, settle * (0.8 + 0.4 * aSeed.y), 0.0);
        vec3 p = aNozzle.xyz + (dir * speed - term) * slow + term * tau;
        // The ground under it, a plane through the gun's foot.
        float floorY = aGround.x + aGround.y * (p.x - aFoot.x) + aGround.z * (p.z - aFoot.y);
        float above = p.y - floorY;
        float grow = clamp(tau / life, 0.0, 1.0);
        float size = aFoot.z + aFoot.w * tau * (0.7 + 0.6 * aSeed.w);
        vec3 eye = cameraPosition - p;
        float dist = length(eye);
        vAlpha = aGround.w
          // Born in a breath, thinning as it swells and spreads, gone at the snow.
          * smoothstep(0.0, 0.04, tau) * (1.0 - grow) / (1.0 + 0.18 * size * size)
          * smoothstep(0.0, 1.5, above)
          * smoothstep(uReach, uReach * 0.7, dist)
          * exp(-dist * uHaze * 0.9)
          * (uMist > 0.0 ? smoothstep(uMist, uMist * 0.8, dist) : 1.0);
        // A puff right at the lens is not drawn into it.
        vAlpha *= smoothstep(1.0, 4.0, dist);
        vCore = exp(-tau * 0.9);
        // Lit by the key and the sky; brighter looking into the sun through
        // it — ice throws its light forward — and darker at the cone's heart.
        vec3 view = -eye / max(dist, 1e-3);
        float forward = pow(max(dot(view, uSun), 0.0), 6.0);
        vCol = mix(uLit, uShade, vCore * 0.12) + uSunCol * forward * 0.35 * smoothstep(0.0, 0.1, uSun.y);
        for (int i = 0; i < ${LAMP_SLOTS}; i++) {
          if (uLampOn[i] <= 0.0) break;
          if (uLampOn[i] <= 0.001) continue;
          vec3 L = uLampPos[i] - p;
          float d = length(L);
          vCol += uLampCol[i] * lampReach(i, L / max(d, 1e-3), d) * 5.0;
        }
        vCol += uPisteCol * length(pisteLight(p)) * 5.0;
        if (vAlpha < 0.002 || dist > uReach) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          return;
        }
        vec4 mv = viewMatrix * vec4(p, 1.0);
        // Turned a little each, so the puffs never line up.
        float spin = aSeed.w * 6.2831853 + tau * 0.3;
        vec2 q = vec2(cos(spin) * position.x - sin(spin) * position.y,
                      sin(spin) * position.x + cos(spin) * position.y);
        mv.xy += q * size;
        gl_Position = projectionMatrix * mv;
        vAt = position.xy;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vAt;
      varying float vAlpha;
      varying vec3 vCol;
      varying float vCore;
      void main() {
        float r = dot(vAt, vAt);
        if (r > 1.0) discard;
        // A soft puff with a little grain in it, so the cone reads as ice.
        float soft = (1.0 - r) * (1.0 - r);
        float grain = 0.8 + 0.2 * fract(sin(dot(floor(vAt * 6.0), vec2(12.9898, 78.233))) * 43758.5);
        gl_FragColor = vec4(vCol, vAlpha * soft * grain);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.name = "snow-gun-plumes";
  const U = mat.uniforms;
  return {
    mesh,
    update(t, look, wind) {
      U.uTime.value = t;
      U.uWind.value.set(wind.x, 0, wind.z);
      // Lit as the falling snow is, a little brighter: it is dense ice.
      const k = look.keyIntensity * 0.45;
      const a = look.ambient * 0.8;
      U.uLit.value.setRGB(
        look.keyColour[0] * k + look.skyLight[0] * a,
        look.keyColour[1] * k + look.skyLight[1] * a,
        look.keyColour[2] * k + look.skyLight[2] * a,
      );
      // Its heart in its own shade: the sky's blue, as the snow's shadows.
      U.uShade.value.setRGB(
        look.keyColour[0] * k * 0.35 + look.skyLight[0] * a,
        look.keyColour[1] * k * 0.35 + look.skyLight[1] * a,
        look.keyColour[2] * k * 0.35 + look.skyLight[2] * a,
      );
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
