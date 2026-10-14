// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIGHT ON SNOW IN THE AIR — what reaches a grain of the spray or a
// puff of the snow cloud, by the sky's own names (`sky-light.ts`,
// `terrain-shadow.ts`, `cloud-glsl.ts`), so the snow a skier throws is lit
// as the snow it was thrown off:
//
//   * THE KEY (`uKeyCol`: the key's colour × its intensity ÷ π — what white
//     snow square to it hands back) taken BY HEIGHT through the long air
//     (`keyAtHeight`), THROUGH THE WEATHER'S CLOUD (`cloudShadow`) and PAST
//     THE MOUNTAIN (`terrainLit`): a stop in the mountain's shade at a low
//     sun throws snow lit by the sky alone, never a white fan on blue snow;
//   * THE SKY round it (`skyIrradiance`), read on four faces — up, down,
//     toward the key and away from it, level — so a grain's top takes the
//     zenith's blue, its underside the snow's bounce and its sun side the
//     warm sky round a low sun; lifted in the mountain's shade as every
//     other material is (`uShadeLift`).
//
// Read ONCE A PARTICLE, in the vertex stage (a grain or a puff is far
// smaller than the light's own detail), and handed on as varyings. The
// lamps after dark are the fragment's (`LAMP_GLSL`): a beam is narrower
// than a plume.

import * as THREE from "three";

import { CLOUD_SHADOW_GLSL } from "./cloud-glsl.ts";
import { SKY_LIGHT_GLSL } from "./sky-light.ts";
import type { SkyLook } from "./sky.ts";
import { TERRAIN_SHADOW_GLSL } from "./terrain-shadow.ts";

/** The vertex stage's half: the uniforms it reads (the haze's, plus
 * `uKeyCol`) and `airLight(p)`, which fills the five varyings. */
export const AIR_LIGHT_VERTEX = /* glsl */ `
uniform vec3 uSunDir;
uniform float uShadeLift;
uniform vec3 uKeyCol;
${TERRAIN_SHADOW_GLSL}
${CLOUD_SHADOW_GLSL}
${SKY_LIGHT_GLSL}
varying vec3 vAirKey;
varying vec3 vAirUp;
varying vec3 vAirDown;
varying vec3 vAirTo;
varying vec3 vAirFrom;
void airLight(vec3 p) {
  float sun = terrainLit(p);
  vAirKey = uKeyCol * keyAtHeight(p.y) * cloudShadow(p) * sun;
  // The sky's irradiance ÷ π: the radiance white snow hands back of it.
  float lift = (1.0 + uShadeLift * (1.0 - sun)) * 0.31831;
  vec2 k = uSunDir.xz;
  float kl = length(k);
  vec3 level = kl > 1e-3 ? vec3(k.x / kl, 0.0, k.y / kl) : vec3(1.0, 0.0, 0.0);
  vAirUp = skyIrradiance(vec3(0.0, 1.0, 0.0)) * lift;
  vAirDown = skyIrradiance(vec3(0.0, -1.0, 0.0)) * lift;
  vAirTo = skyIrradiance(level) * lift;
  vAirFrom = skyIrradiance(-level) * lift;
}
`;

/** The fragment stage's half: the varyings, and `airSky(n)` — the sky's
 * light on a world normal off the four faces. */
export const AIR_LIGHT_FRAGMENT = /* glsl */ `
varying vec3 vAirKey;
varying vec3 vAirUp;
varying vec3 vAirDown;
varying vec3 vAirTo;
varying vec3 vAirFrom;
vec3 airSky(vec3 n) {
  vec2 k = uSunDir.xz;
  float kl = length(k);
  vec2 level = kl > 1e-3 ? k / kl : vec2(1.0, 0.0);
  float across = dot(n.xz, level);
  float wUp = max(n.y, 0.0);
  float wDown = max(-n.y, 0.0);
  float wTo = max(across, 0.0);
  float wFrom = max(-across, 0.0);
  float rest = max(1.0 - wUp - wDown - wTo - wFrom, 0.0);
  vec3 mean = 0.25 * (vAirUp + vAirDown + vAirTo + vAirFrom);
  return (vAirUp * wUp + vAirDown * wDown + vAirTo * wTo + vAirFrom * wFrom + mean * rest)
    / max(wUp + wDown + wTo + wFrom + rest, 1e-3);
}
`;

/** `uKeyCol`, the one uniform the chunk adds to the haze's. */
export function airLightUniforms(): { uKeyCol: { value: THREE.Color } } {
  return { uKeyCol: { value: new THREE.Color(1, 1, 1) } };
}

/** The key's colour × its intensity ÷ π, off the frame's look. */
export function setAirKey(col: THREE.Color, look: SkyLook): void {
  const k = look.keyIntensity / Math.PI;
  col.setRGB(look.keyColour[0] * k, look.keyColour[1] * k, look.keyColour[2] * k);
}
