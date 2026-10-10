// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WATER AS SHADED — grafted into a `MeshStandardMaterial` that
// `hazeMaterial` already carries the sky, the haze, the sun's shadows and
// the lamps into (`water-view.ts` builds it). Per fragment:
//
//   * WHERE IT IS: its distance to the shore, off the shore map (a stream's
//     off its ribbon), roughened by noise so no edge is a contour line.
//   * WHAT IS ON IT: the ice from the shore out to A m and beyond B m (the
//     autumn's shore ice, the spring's moat), and on the ice the snow — a
//     whole snowed cover is not drawn at all, the terrain's own snow under
//     it is the lake — the wind's scoured patches of grey ice, the new
//     cover's BLACK ICE with its white cracks, the spring's ROTTEN grey ice
//     and the meltwater pooled on it.
//   * HOW IT MOVES: a few wind waves summed with their exact slopes, faded
//     out wherever a pixel spans more than a wave — the far water goes calm
//     rather than shimmering — and nothing at all in still air: a mountain
//     lake on a still day is a mirror.
//   * WHAT IT MIRRORS: the sky over the lake's skyline and the hills under
//     it (the horizon `water-plan.ts` reads round every lake: its height,
//     how wooded, how far, hazed by that distance), weighted by Fresnel.
//
// Nothing here reads the trail map or the terrain's textures: a lake costs
// its own pixels and three texture reads, and an all-snowed map draws none.

import { HORIZON_REACH, SHORE_SCALE } from "./water-plan.ts";

/** Attributes and varyings, for the vertex shader's head. */
export const WATER_VERTEX_PARS = /* glsl */ `
attribute vec4 aIce;
attribute vec4 aWater;
attribute vec4 aFlow;
varying vec4 vIce;
varying vec4 vWater;
varying vec4 vFlow;
`;

export const WATER_VERTEX_MAIN = /* glsl */ `
vIce = aIce;
vWater = aWater;
vFlow = aFlow;
`;

/** The fragment's uniforms and helpers, after `#include <common>`. */
export const WATER_FRAGMENT_PARS = /* glsl */ `
varying vec4 vIce;
varying vec4 vWater;
varying vec4 vFlow;
uniform sampler2D uShore;
uniform vec4 uShoreBox;
uniform vec2 uShoreHalf;
uniform sampler2D uLakeHorizon;
uniform float uLakeHorizonRows;
uniform float uWaterT;
uniform vec2 uWaterWind;
uniform vec3 uDeep;
uniform vec3 uShallow;

float wHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float wNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x),
             mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float wFbm(vec2 p) {
  return 0.55 * wNoise(p) + 0.3 * wNoise(p * 2.07 + 5.3) + 0.15 * wNoise(p * 4.13 + 1.7);
}

// One wind wave's slope (d/dx, d/dz) at p: a crest k rad/m along dir,
// running at the deep-water speed, its slope s, faded by the pixel's span.
vec2 wWave(vec2 p, vec2 dir, float k, float s, float span) {
  float fade = clamp(1.5 - span * k * 0.5, 0.0, 1.0);
  float w = sqrt(9.81 * k);
  return dir * (s * fade * cos(dot(p, dir) * k - w * uWaterT));
}

// The sky over the skyline and the hills under it, along r (up).
vec3 wMirror(vec3 r, float row) {
  vec3 sky = skyColour(r);
  if (row < 0.0) return sky;
  float az = atan(r.x, r.z) / 6.28318530718;
  vec4 hz = texture2D(uLakeHorizon, vec2(fract(az), (row + 0.5) / uLakeHorizonRows));
  float up = asin(clamp(r.y, 0.0, 1.0)) / 1.57079632679;
  float under = 1.0 - smoothstep(hz.r - 0.004, hz.r + 0.004, up);
  if (under <= 0.0) return sky;
  float wood = mix(hz.g, hz.b, clamp(up / max(hz.r, 1e-3), 0.0, 1.0));
  float sun = max(uSunDir.y, 0.0);
  vec3 snow = uHorizon * 0.6 + uSunCol * 0.55 * sun;
  vec3 woods = (uZenith * 0.1 + uSunCol * 0.04 * sun) * vec3(0.5, 0.72, 0.58);
  vec3 hill = mix(snow, woods, smoothstep(0.0, 0.6, wood));
  vec3 h = normalize(vec3(r.x, 0.02, r.z));
  hill = mix(hill, hazeColour(h), hazeAmount(hz.a * ${HORIZON_REACH.toFixed(1)}, 0.0));
  return mix(sky, hill, under);
}
`;

/** Replaces `#include <color_fragment>`: the surface decided, into the
 * locals the later chunks read (`wRough`, `wNormal`, `wMirrorShare`). */
export const WATER_FRAGMENT_COLOUR = /* glsl */ `
vec2 wp = vHazeWorld.xz;
vec3 wView = vHazeWorld - cameraPosition;
float wDist = length(wView);
float wSpan = max(length(fwidth(wp)), 1e-3);
// The shore's distance: the map's, or across a stream's ribbon.
float wShore = vFlow.w >= 0.0
  ? vFlow.w
  : texture2D(uShore, (wp - uShoreBox.xy) * uShoreBox.zw + uShoreHalf).r * ${(255 / SHORE_SCALE).toFixed(2)};
float wEdge = wShore + (wFbm(wp * 0.05) - 0.5) * 14.0;
float wIce = max(1.0 - smoothstep(vIce.x - 1.5, vIce.x + 1.5, wEdge),
                 smoothstep(vIce.y - 1.5, vIce.y + 1.5, wEdge));

// THE WIND'S WAVES (and a stream's run), their slopes summed.
vec2 wFlowAt = wp - vFlow.xy * vFlow.z * uWaterT;
float wWind = length(uWaterWind);
vec2 wd = wWind > 0.01 ? uWaterWind / wWind : vec2(0.0, 1.0);
vec2 wq = vec2(-wd.y, wd.x);
float wRough = clamp(wWind / 9.0, 0.0, 1.0) + vFlow.z * 0.6;
float wSlope = 0.006 + 0.09 * wRough;
vec2 wGrad = wWave(wFlowAt, wd, 2.1, wSlope, wSpan)
  + wWave(wFlowAt, normalize(wd + wq * 0.6), 3.4, wSlope * 0.7, wSpan)
  + wWave(wFlowAt, normalize(wd - wq * 0.7), 5.3, wSlope * 0.5, wSpan)
  + wWave(wFlowAt, normalize(wd + wq * 0.25), 8.9, wSlope * 0.35, wSpan);
float wN0 = wNoise(wFlowAt * 1.3 - wd * uWaterT * 0.6);
float wN1 = wNoise((wFlowAt + vec2(0.3, 0.0)) * 1.3 - wd * uWaterT * 0.6);
float wN2 = wNoise((wFlowAt + vec2(0.0, 0.3)) * 1.3 - wd * uWaterT * 0.6);
float wFine = clamp(1.5 - wSpan * 2.0, 0.0, 1.0) * wSlope * 1.2;
wGrad += vec2(wN1 - wN0, wN2 - wN0) / 0.3 * wFine;
vec3 wWater = normalize(vec3(-wGrad.x, 1.0, -wGrad.y));

// THE WATER'S OWN COLOUR: the bed through the shallows, deep further out.
vec3 wOpen = mix(uShallow, uDeep, smoothstep(0.5, 22.0, wShore));

// THE ICE: new black ice and its cracks, grey snow ice, the spring's rot.
// Thin white cracks, straight-ish between their kinks (a ridged noise
// warped a little), only where a pixel is fine enough to hold one.
vec2 wCp = wp * 0.07 + vec2(wNoise(wp * 0.02), wNoise(wp * 0.02 + 7.0)) * 1.5;
float wCrack = 1.0 - smoothstep(0.0, 0.012 + wSpan * 0.004, abs(wNoise(wCp) - 0.5));
wCrack = max(wCrack, (1.0 - smoothstep(0.0, 0.008 + wSpan * 0.004, abs(wNoise(wCp * 3.1 + 9.0) - 0.5))) * 0.45);
wCrack *= clamp(1.4 - wSpan * 2.0, 0.0, 1.0);
vec3 wBlack = vec3(0.012, 0.02, 0.026) + vec3(0.5, 0.56, 0.6) * wCrack * 0.45;
vec3 wGrey = vec3(0.50, 0.57, 0.61) * (0.9 + 0.2 * wNoise(wp * 0.4));
vec3 wRot = vec3(0.16, 0.18, 0.185) * (0.8 + 0.4 * wFbm(wp * 0.2));
float wPool = smoothstep(0.55, 0.62, wFbm(wp * 0.07 + 3.0)) * vIce.w;
vec3 wIceCol = mix(wGrey, wBlack, vWater.y);
wIceCol = mix(wIceCol, wRot, vIce.w);
float wIceRough = mix(mix(0.35, 0.07, vWater.y), 0.3, vIce.w);
float wIceMirror = mix(mix(0.12, 0.8, vWater.y), 0.35, vIce.w);
// The wind's scoured patches, streaked along it; the rest is the snow,
// which is the terrain's own.
float wScour = smoothstep(0.5, 0.62, wFbm(vec2(dot(wp, wd) * 0.006, dot(wp, wq) * 0.03)));
float wSnowed = vIce.z * (1.0 - wScour);
// The meltwater pooled on rotten ice is open water to the eye.
wIce *= 1.0 - wPool;

vec3 wSurface = mix(wOpen, wIceCol, wIce);
float wMirrorShare = mix(1.0, wIceMirror, wIce);
wRough = mix(mix(0.04, 0.12, wRough), wIceRough, wIce);
vec3 wNormal = normalize(mix(wWater, vec3(0.0, 1.0, 0.0), wIce));
float wAlpha = smoothstep(0.0, 1.2, wShore) * (1.0 - wSnowed * wIce);
if (wAlpha < 0.004) discard;
diffuseColor.rgb = wSurface;
diffuseColor.a = wAlpha;
`;

/** After `#include <roughnessmap_fragment>`. */
export const WATER_FRAGMENT_ROUGHNESS = /* glsl */ `
roughnessFactor = wRough;
`;

/** After `#include <normal_fragment_maps>`: the wave's normal, in view space. */
export const WATER_FRAGMENT_NORMAL = /* glsl */ `
normal = normalize((viewMatrix * vec4(wNormal, 0.0)).xyz);
`;

/** Before `#include <opaque_fragment>`: the mirror, by Fresnel. */
export const WATER_FRAGMENT_MIRROR = /* glsl */ `
{
  vec3 wv = wView / max(wDist, 1e-3);
  vec3 wr = reflect(wv, wNormal);
  wr.y = max(wr.y, 0.002);
  float wCos = clamp(dot(wNormal, -wv), 0.0, 1.0);
  float wF = 0.02 + 0.98 * pow(1.0 - wCos, 5.0);
  outgoingLight += wMirror(normalize(wr), vWater.x) * wF * wMirrorShare;
}
`;
