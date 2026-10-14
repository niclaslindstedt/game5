// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIRE'S SHADERS, shared by everything that burns: a camp fire's and a
// bonfire's flames, sparks and smoke (`fires-view.ts`) and a skier's
// clothes alight (`burn-view.ts`). Each is the fragment half alone — the
// vertex half says where a particle is, which a hearth works out off the
// clock and a burning body off its own pool — over three varyings each:
//
//   * FLAME_FRAGMENT: `vUv` (x −1…1 across, y 0…1 up), `vSeed` (0…1) and
//     `vFade` (its whole alpha) — a tongue of fire licking and tearing off
//     its top, a yellow-white heart, an orange body, red tips.
//   * SPARK_FRAGMENT: `vUv`, `vAlpha` and `vHeat` (1 just thrown … 0 out),
//     drawn additively.
//   * SMOKE_FRAGMENT: `vUv`, `vAlpha`, `vCol` and `vSeed` — a soft, wispy
//     puff.

import { FIRE_COLOURS } from "./fireball.ts";

export const NOISE = /* glsl */ `
float fHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float fNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fHash(i), fHash(i + vec2(1.0, 0.0)), f.x),
             mix(fHash(i + vec2(0.0, 1.0)), fHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fFbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * fNoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}
`;

const v3 = (c: readonly number[]): string => `vec3(${c.map((x) => x.toFixed(3)).join(", ")})`;
export const COLOURS = /* glsl */ `
const vec3 F_WHITE = ${v3(FIRE_COLOURS.white)};
const vec3 F_ORANGE = ${v3(FIRE_COLOURS.orange)};
const vec3 F_RED = ${v3(FIRE_COLOURS.red)};
`;

export const FADE = /* glsl */ `
uniform float uHaze;
uniform float uReach;
float fadeAt(float dist) {
  return smoothstep(uReach, uReach * 0.7, dist) * exp(-dist * uHaze * 0.6);
}
`;

/** A tongue of fire. */
export const FLAME_FRAGMENT = /* glsl */ `
      uniform float uTime;
      ${NOISE}
      ${COLOURS}
      varying vec2 vUv;
      varying float vSeed;
      varying float vFade;
      void main() {
        float v = vUv.y;
        float t = uTime;
        float n = fFbm(vec2(vUv.x * 1.8 + vSeed * 7.0, v * 2.6 - t * 3.0 + vSeed * 3.0));
        float n2 = fNoise(vec2(vUv.x * 5.0 + vSeed * 13.0, v * 7.0 - t * 6.0));
        // Licking side to side, the more the higher.
        float u = vUv.x + (n - 0.5) * 1.0 * v + 0.18 * sin(v * 7.0 - t * 8.0 + vSeed * 20.0) * v;
        // Widest low, drawn to a point at the top.
        float prof = (1.0 - pow(v, 1.15)) * mix(0.65, 1.0, smoothstep(0.0, 0.15, v));
        // Its tongues torn off the top.
        float d = prof - abs(u) + (n2 - 0.5) * 0.55 * v * v + (n - 0.5) * 0.35;
        float a = smoothstep(0.0, 0.1, d);
        if (a < 0.01) discard;
        float heat = clamp(d * 2.4 * (1.2 - v), 0.0, 1.0);
        vec3 col = mix(F_RED, F_ORANGE, smoothstep(0.04, 0.4, heat));
        col = mix(col, F_WHITE, smoothstep(0.5, 0.95, heat));
        float alpha = a * mix(0.55, 1.0, heat) * smoothstep(0.0, 0.05, v) * vFade;
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`;

/** A spark, additive. */
export const SPARK_FRAGMENT = /* glsl */ `
      ${COLOURS}
      varying vec2 vUv;
      varying float vAlpha;
      varying float vHeat;
      void main() {
        float r = dot(vUv, vUv);
        if (r > 1.0) discard;
        vec3 col = mix(F_RED * 2.2, F_ORANGE * 1.6, vHeat);
        col = mix(col, F_WHITE * 1.3, smoothstep(0.85, 1.0, vHeat));
        gl_FragColor = vec4(col * (1.0 - r) * vAlpha, 1.0);
        #include <colorspace_fragment>
      }`;

/** A puff of smoke. */
export const SMOKE_FRAGMENT = /* glsl */ `
      ${NOISE}
      varying vec2 vUv;
      varying float vAlpha;
      varying vec3 vCol;
      varying float vSeed;
      void main() {
        float r = dot(vUv, vUv);
        if (r > 1.0) discard;
        float soft = (1.0 - r) * (1.0 - r);
        float wisp = 0.55 + 0.6 * fNoise(vUv * 2.5 + vSeed * 30.0);
        gl_FragColor = vec4(vCol, vAlpha * soft * wisp);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`;
