// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BURNER'S FLAME IN THE RENDERER — the double burner's two jets of
// burning propane roaring up out of the coils into the mouth, and the two
// pilot lights under them (`balloon-fire-plan.ts` decides how long, how
// wide, how bent, the burst and the tail). Each flame is one open tube
// whose shape is worked in the vertex shader — narrow at the jet, widest a
// third of the way up, wobbling, its top laid over by the air past it —
// and whose fire is worked in the fragment shader: a blue, nearly clear
// root over the coil, a yellow-white body whose heart is the brightest
// where the eye looks through the most of it, orange tongues streaming up
// it and tearing off its top. Cheap on purpose: four small tubes and a
// halo, no particles; nothing allocates once it is built. Presentation
// only, its flicker off the run's own clock, never the stream.

import * as THREE from "three";

import { FLAME } from "./balloon-fire-plan.ts";
import { glow } from "./glow-sprite.ts";

/** The tube: rings up its length, and round it. */
const RINGS = 40;
const AROUND = 20;

const VERTEX = /* glsl */ `
uniform float uLen;
uniform float uRad;
uniform float uCut;
uniform float uBurst;
uniform float uTime;
uniform float uSeed;
uniform vec2 uBend;
varying float vH;
varying float vFacing;
varying vec3 vLocal;
void main() {
  float h = position.y;
  float d = h * uLen;
  // THE SHAPE: a jet narrow at the coil, swelling a third of the way up and
  // drawn to a point at the top; the ignition's burst a ball at its top.
  float s = pow(h, 0.62);
  float prof = max(0.08, pow(sin(3.14159 * min(s, 1.0)), 0.75)) * mix(0.75, 1.0, smoothstep(0.02, 0.16, h));
  prof = mix(prof, 1.0, uBurst * smoothstep(0.25, 0.95, h) * 0.6);
  float r = uRad * prof * (1.0 + 0.5 * uBurst);
  // It wobbles, the more the higher, as the jet breaks into turbulence.
  float w1 = sin(d * 1.7 - uTime * 11.0 + uSeed) + 0.5 * sin(d * 3.1 - uTime * 17.0 + uSeed * 2.0);
  float w2 = cos(d * 1.3 - uTime * 9.0 + uSeed * 3.0) + 0.5 * sin(d * 2.7 - uTime * 15.0);
  vec2 wob = vec2(w1, w2) * uRad * 0.2 * h;
  // The air past it lays its top over; the tail lifts off the coil.
  vec2 xz = position.xz * r + wob + uBend * h * h;
  vec3 p = vec3(xz.x, d + uCut * 0.4, xz.y);
  vLocal = vec3(position.x, d, position.z);
  vH = h;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // How much flame the eye looks through here: the cosine across the
  // section, the view's slant along the axis taken out — and looking up the
  // axis, the whole of it.
  vec3 n = normalize(normalMatrix * vec3(position.x, 0.0, position.z));
  vec3 ax = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
  vec3 v = normalize(-mv.xyz);
  float along = abs(dot(v, ax));
  vec3 across = v - ax * dot(v, ax);
  float fac = abs(dot(n, across / max(length(across), 1e-4)));
  vFacing = mix(fac, 1.0, pow(along, 3.0));
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT = /* glsl */ `
uniform float uLen;
uniform float uCut;
uniform float uBright;
uniform float uTime;
uniform float uSeed;
uniform float uBlue;
#define FLAME_BLUE uBlue
uniform float uRise;
uniform float uPilot;
varying float vH;
varying float vFacing;
varying vec3 vLocal;
float fHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float fNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fHash(i), fHash(i + vec3(1, 0, 0)), f.x),
                 mix(fHash(i + vec3(0, 1, 0)), fHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(fHash(i + vec3(0, 0, 1)), fHash(i + vec3(1, 0, 1)), f.x),
                 mix(fHash(i + vec3(0, 1, 1)), fHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
void main() {
  float d = vLocal.y;
  if (d < uCut) discard;
  // TURBULENCE streaming up it: a warped noise climbing at the flame's
  // own speed, finer than the flame is wide, so it reads as roiling soot
  // and torn tongues rather than a smooth glow.
  vec3 q = vec3(vLocal.x * 2.0, d * 3.6 - uTime * uRise * 2.4, vLocal.z * 2.0) + uSeed;
  float warp = fNoise(q * 0.55 + vec3(0.0, -uTime * 3.0, 0.0));
  float n = 0.55 * fNoise(q + warp * 2.2) + 0.3 * fNoise(q * 2.2 + warp) + 0.15 * fNoise(q * 4.7);
  // The eye looks through the most of it at the silhouette's middle.
  float core = pow(vFacing, 2.2);
  float body = pow(vFacing, 0.45);
  // TONGUES: a solid jet low down, torn into licks toward the top.
  float thr = mix(0.02, 0.62, smoothstep(0.22, 1.0, vH)) - core * 0.2;
  float tongue = smoothstep(thr, thr + 0.09, n);
  // THE BLUE ROOT over the jets: a short, clear-blue cone of premixed
  // flame before the soot lights.
  float blue = (1.0 - smoothstep(FLAME_BLUE * 0.55, FLAME_BLUE * 1.15, d - uCut)) * (1.0 - smoothstep(0.0, 0.1, uCut));
  float a = body * mix(tongue * (0.6 + 0.4 * n), 0.7 + 0.3 * core, blue);
  // The jet leaves the coil clear, and the tail's ragged root.
  a *= smoothstep(0.0, 0.04, vH) * smoothstep(0.0, 0.1, d - uCut + 0.03);
  // THE COLOURS: a yellow heart, orange body and tongues, a dull red top,
  // brighter where the soot is thickest.
  // The jet's lower half burns yellow-white through its heart — the
  // brightest thing in a day's frame, held over the tone map's knee.
  float lum = 0.55 + 1.1 * n * n;
  float heart = core * smoothstep(0.85, 0.12, vH);
  vec3 hot = mix(vec3(2.2, 0.85, 0.12), vec3(3.4, 2.45, 0.7), heart);
  hot = mix(hot, vec3(1.05, 0.22, 0.03), smoothstep(0.45, 1.0, vH)) * lum;
  vec3 cold = vec3(0.2, 0.42, 2.2) * (0.75 + 0.8 * core);
  vec3 col = mix(hot, cold, blue);
  float alpha = a * uBright;
  if (uPilot > 0.5) {
    // The pilot: a small blue cone, its inner cone brighter, a yellow tip.
    col = mix(vec3(0.12, 0.3, 1.6) * (0.6 + 0.9 * core), vec3(1.8, 0.85, 0.18), smoothstep(0.62, 1.0, vH));
    alpha = (0.15 + 0.6 * core) * smoothstep(0.0, 0.12, vH) * (1.0 - smoothstep(0.75, 1.0, vH)) * uBright;
  }
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** One flame: its mesh, and its uniforms. */
type Jet = {
  mesh: THREE.Mesh;
  u: {
    uLen: { value: number };
    uRad: { value: number };
    uCut: { value: number };
    uBurst: { value: number };
    uBright: { value: number };
    uTime: { value: number };
    uSeed: { value: number };
    uBend: { value: THREE.Vector2 };
    uBlue: { value: number };
    uRise: { value: number };
    uPilot: { value: number };
  };
};

export type BurnerFlame = {
  group: THREE.Group;
  /** Draw it: the outlets (world), the way up the flame (world), the
   * flame's length, cut, burst and brightness (`stepFlame`), the pilot lit,
   * the bend at the top (world, m), the clock, s, and how dark it is
   * (0 day … 1 night) — the halo's. */
  draw(
    outlets: readonly THREE.Vector3[],
    up: THREE.Vector3,
    now: { length: number; cut: number; burst: number; bright: number },
    pilot: boolean,
    bend: THREE.Vector3,
    t: number,
    night: number,
  ): void;
  hide(): void;
  dispose(): void;
};

export function createBurnerFlame(): BurnerFlame {
  const group = new THREE.Group();
  group.name = "balloon-flame";
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= RINGS; j++) {
    for (let i = 0; i <= AROUND; i++) {
      const a = (i / AROUND) * Math.PI * 2;
      pos.push(Math.cos(a), j / RINGS, Math.sin(a));
    }
  }
  for (let j = 0; j < RINGS; j++) {
    for (let i = 0; i < AROUND; i++) {
      const a = j * (AROUND + 1) + i;
      const b = a + AROUND + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3, 0), 8);

  const jet = (seed: number, pilot: boolean): Jet => {
    const u: Jet["u"] = {
      uLen: { value: 1 },
      uRad: { value: 0.1 },
      uCut: { value: 0 },
      uBurst: { value: 0 },
      uBright: { value: 0 },
      uTime: { value: 0 },
      uSeed: { value: seed },
      uBend: { value: new THREE.Vector2() },
      uBlue: { value: pilot ? 0.12 : FLAME.blue },
      uRise: { value: pilot ? 2 : FLAME.rise },
      uPilot: { value: pilot ? 1 : 0 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 7;
    mesh.visible = false;
    group.add(mesh);
    return { mesh, u };
  };
  const mains = [jet(1.7, false), jet(7.3, false)];
  const pilots = [jet(3.1, true), jet(5.9, true)];
  // THE HALO the flame casts in the air round it — the lit haze a lens
  // sees round a bright flame after dark.
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glow(),
      color: 0xff8a30,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0,
    }),
  );
  halo.renderOrder = 8;
  halo.visible = false;
  group.add(halo);

  const yUp = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const qi = new THREE.Quaternion();
  const local = new THREE.Vector3();

  return {
    group,
    draw(outlets, up, now, pilot, bend, t, night) {
      q.setFromUnitVectors(yUp, up);
      qi.copy(q).invert();
      local.copy(bend).applyQuaternion(qi);
      const on = now.bright > 0.01 && now.length > 0.05;
      for (let i = 0; i < mains.length; i++) {
        const m = mains[i];
        const at = outlets[i];
        m.mesh.visible = on && !!at;
        if (!m.mesh.visible) continue;
        m.mesh.position.copy(at);
        m.mesh.quaternion.copy(q);
        m.u.uLen.value = now.length;
        m.u.uRad.value = FLAME.radius * (0.55 + 0.45 * Math.min(1, now.length / FLAME.length));
        m.u.uCut.value = now.cut;
        m.u.uBurst.value = now.burst;
        m.u.uBright.value = Math.min(1, now.bright);
        m.u.uTime.value = t;
        // Each jet a little its own way, the two tops meeting.
        m.u.uBend.value.set(local.x - (i === 0 ? -0.08 : 0.08) * now.length * 0.1, local.z);
      }
      for (let i = 0; i < pilots.length; i++) {
        const p = pilots[i];
        const at = outlets[i];
        p.mesh.visible = pilot && !!at;
        if (!p.mesh.visible) continue;
        p.mesh.position.copy(at);
        p.mesh.quaternion.copy(q);
        p.u.uLen.value = FLAME.pilot.length * (1 + 0.08 * Math.sin(t * 13 + i * 2));
        p.u.uRad.value = FLAME.pilot.radius;
        p.u.uBright.value = 1;
        p.u.uTime.value = t;
        p.u.uBend.value.set(local.x * 0.03, local.z * 0.03);
      }
      halo.visible = on && outlets.length > 0;
      if (halo.visible) {
        const s = now.length * 0.45;
        halo.position
          .copy(outlets[0])
          .add(outlets[1] ?? outlets[0])
          .multiplyScalar(0.5)
          .addScaledVector(up, s)
          .addScaledVector(bend, 0.25);
        const size = now.length * (1.6 + 0.6 * now.burst);
        halo.scale.set(size, size * 1.3, 1);
        const flick = 0.9 + 0.1 * Math.sin(t * 31) * Math.sin(t * 17);
        (halo.material as THREE.SpriteMaterial).opacity =
          Math.min(1, now.bright) * flick * (0.16 + 0.38 * night);
      }
    },
    hide() {
      for (const j of [...mains, ...pilots]) j.mesh.visible = false;
      halo.visible = false;
    },
    dispose() {
      geo.dispose();
      for (const j of [...mains, ...pilots]) (j.mesh.material as THREE.Material).dispose();
      halo.material.dispose();
    },
  };
}
