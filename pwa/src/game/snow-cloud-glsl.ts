// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW CLOUD'S SHADERS AND NOISE — split out of `snow-cloud.ts`, which
// flies the puffs, sorts them and shadows the cloud; this is how one puff
// is drawn: the vertex stage (the veil, the cull, the light the puff's
// middle takes off the sky) and the fragment stage (the body, the scatter,
// the glints, the lamps, the haze).

import * as THREE from "three";

import { LAMP_GLSL, LAMP_SLOTS, SKY_GLSL } from "./haze.ts";
import { SHELTER_GLSL } from "./shelter.ts";
import { AIR_LIGHT_FRAGMENT, AIR_LIGHT_VERTEX } from "./snow-air-light.ts";

/** The cloud's own stream: nothing drawn may draw from the engine's. */
export function makeRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** A tiling noise the puffs are carved from: two octaves of smooth value
 * noise at two scales in R and G, and a third seed in B. */
export function noiseTexture(): THREE.DataTexture {
  const n = 64;
  const random = makeRandom(0xc10d);
  const lattice = (cells: number) => {
    const v = new Float32Array(cells * cells);
    for (let i = 0; i < v.length; i++) v[i] = random();
    return (x: number, y: number) => {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const fx = x - xi;
      const fy = y - yi;
      const at = (a: number, b: number) =>
        v[(((b % cells) + cells) % cells) * cells + (((a % cells) + cells) % cells)];
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const top = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
      const bottom = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
      return top + (bottom - top) * sy;
    };
  };
  const fbm = (cells: number) => {
    const a = lattice(cells);
    const b = lattice(cells * 2);
    const c = lattice(cells * 4);
    return (x: number, y: number) =>
      (a(x * cells, y * cells) * 0.55 +
        b(x * cells * 2, y * cells * 2) * 0.3 +
        c(x * cells * 4, y * cells * 4) * 0.15 -
        0.5) *
        1.6 +
      0.5;
  };
  const r = fbm(4);
  const g = fbm(8);
  const b = fbm(5);
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      const u = x / n;
      const v = y / n;
      data[i] = Math.round(255 * Math.min(1, Math.max(0, r(u, v))));
      data[i + 1] = Math.round(255 * Math.min(1, Math.max(0, g(u, v))));
      data[i + 2] = Math.round(255 * Math.min(1, Math.max(0, b(u, v))));
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export const CLOUD_VERTEX = /* glsl */ `
attribute vec4 iPos;
attribute vec4 iLook;
attribute vec4 iSnow;
uniform float uNear;
uniform vec4 uFocus;
${AIR_LIGHT_VERTEX}
varying vec2 vUv;
varying vec2 vSpin;
varying vec4 vLook;
varying vec4 vSnow;
varying vec3 vWorld;
varying vec3 vRight;
varying vec3 vUp;
varying float vRadius;
void main() {
  vec3 R = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 U = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float dist = length(iPos.xyz - cameraPosition);
  // Away close to the lens: a chase camera rides in its own skier's plume.
  float near = smoothstep(uNear * 0.35 + iPos.w * 0.2, uNear + iPos.w * 0.9, dist);
  // THE VEIL: the skier's own lens looks THROUGH his plume at him — what
  // stands between the lens and the skier, near the line of sight, is thinned
  // to \`uFocus.w\` (1 where the lens is planted and sees the cloud whole).
  // It reaches a metre PAST him too: his newest puffs are born round his
  // skis, at his own depth, and a ball of them sat on him otherwise.
  vec3 fwd = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  vec3 toF = uFocus.xyz - cameraPosition;
  vec3 toP = iPos.xyz - cameraPosition;
  float before = smoothstep(dot(toF, fwd) + 1.0, dot(toF, fwd) - 1.5, dot(toP, fwd));
  vec3 dirF = toF / max(length(toF), 1e-3);
  float lat = length(toP - dirF * dot(toP, dirF));
  float onLine = 1.0 - smoothstep(1.2 + iPos.w * 0.6, 3.0 + iPos.w * 1.4, lat);
  vLook = iLook;
  vLook.x *= near * mix(1.0, uFocus.w, before * onLine);
  vUv = position.xy;
  float c = cos(iSnow.z);
  float s = sin(iSnow.z);
  vSpin = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
  vSnow = iSnow;
  vRight = R;
  vUp = U;
  // Drawn a fifth wider than it flies, its alpha thinned to match: its soft
  // rim reaches the next puff's, and a row of them is one veil.
  vRadius = iPos.w * 1.2;
  vec3 w = iPos.xyz + (R * position.x + U * position.y) * vRadius;
  // The sky's light where the puff's middle is (\`snow-air-light.ts\`).
  airLight(iPos.xyz);
  vWorld = w;
  // A puff too faint to see is not drawn at all: the veiled and the near
  // ones are the biggest on the screen, and fill is what a cloud costs.
  gl_Position = vLook.x > 0.025 ? projectionMatrix * viewMatrix * vec4(w, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}
`;

export const CLOUD_FRAGMENT = /* glsl */ `
${SKY_GLSL}
${SHELTER_GLSL}
uniform sampler2D uNoise;
uniform vec3 uKey;
uniform float uFlat;
uniform float uGlint;
uniform float uTime;
uniform float uNight;
${LAMP_GLSL}
${AIR_LIGHT_FRAGMENT}
varying vec2 vUv;
varying vec2 vSpin;
varying vec4 vLook;
varying vec4 vSnow;
varying vec3 vWorld;
varying vec3 vRight;
varying vec3 vUp;
varying float vRadius;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// The snow at a point of the sprite: a ball eroded by the noise, torn
// further into wisps the older it is — and its outline WARPED by the noise
// before it is measured: a puff of fine snow is a lobed, torn thing whose
// edge wanders, never a disc with a frayed rim.
float density(vec2 uv, vec2 spin, vec2 o, float age) {
  float r2 = dot(uv, uv);
  float n1 = texture2D(uNoise, spin * 0.38 + o + vec2(age * 0.22, -age * 0.31)).r;
  float n2 = texture2D(uNoise, spin * 0.8 + o.yx + vec2(-age * 0.15, age * 0.5)).g;
  // The fine curl that keeps a puff filling the lens from going smooth.
  float n3 = texture2D(uNoise, spin * 2.3 - o + vec2(age * 0.7, age * 0.2)).b;
  float n = n1 * 0.52 + n2 * 0.3 + n3 * 0.18;
  vec2 w = uv + (vec2(n1, n2) - 0.5) * (0.55 + 0.35 * age);
  float rw = dot(w, w);
  float body = 1.0 - rw;
  float erode = 0.15 + 0.55 * age;
  // A soft billow edge young, torn wisps old: fine snow in the air has no
  // surface, and a puff cut off crisp reads as a ball of cotton — most of
  // all against a low sun, where its glow outlines it.
  float v = body * (0.5 + 1.15 * n) - erode * (1.0 - n);
  return smoothstep(-0.05, 0.62 - 0.27 * age, v) * exp(-2.6 * rw) * (1.0 - r2 * r2);
}

void main() {
  float r2 = dot(vUv, vUv);
  // None of it inside the cabin the lens is in (\`shelter.ts\`).
  if (r2 > 1.0 || sheltered(vWorld)) discard;
  float age = vLook.z;
  float seed = vLook.y;
  vec2 o = vec2(fract(seed * 7.13), fract(seed * 3.71));
  float d = density(vUv, vSpin, o, age);
  vec3 toEye = normalize(cameraPosition - vWorld);
  float z = sqrt(max(0.0, 1.0 - r2));
  // Into the snow: a puff sitting on the ground thins out where it meets
  // it — measured on the ball's FRONT surface, not the flat card, which a
  // lens looking down would see cut off into a crescent.
  vec3 surface = vWorld + toEye * z * vRadius;
  float ground = smoothstep(vLook.w - 0.02, vLook.w + vRadius * 0.3, surface.y);
  float alpha = d * vLook.x * ground * 0.9;
  if (alpha < 0.004) discard;
  // A normal off the ball, bent by the noise so the lit side has relief.
  float bx = texture2D(uNoise, vSpin * 0.6 + o + 0.13).b - 0.5;
  float by = texture2D(uNoise, vSpin * 0.6 + o.yx + 0.41).b - 0.5;
  // Not a hard ball: a flattened bulge, so a row of puffs is one body of
  // cloud rather than a string of beads each shaded on its own.
  // An avalanche's deep billow (\`dense\`) is rounder: a cauliflower head
  // with a lit crown and a shaded flank and foot.
  float deep = clamp(vSnow.y - 1.2, 0.0, 1.5);
  float rounder = mix(0.6, 1.0, min(deep, 1.0));
  vec3 N = normalize(vRight * (vUv.x * rounder + bx * 1.2) + vUp * (vUv.y * rounder + by * 1.2) + toEye * (0.4 + z));

  // SELF-SHADOW: how much snow lies between here and the key light, read a
  // step toward it across the sprite, and how thick the puff is.
  vec2 lp = vec2(dot(uKey, vRight), dot(uKey, vUp));
  float toward = density(vUv + lp * 0.45, vSpin + lp * 0.45, o, age);
  float thick = vSnow.y;
  // The puff's own relief, lightly, over the WHOLE CLOUD's shadow on it
  // (\`vSnow.w\`: how much of the sun reaches it through the rest).
  float shade = vSnow.w * exp(-(toward * 0.35 + d * 0.15) * thick);
  float wrap = mix(0.45, 0.2, min(deep, 1.0));
  float lambert = clamp((dot(N, uKey) + wrap) / (1.0 + wrap), 0.0, 1.0);

  // FORWARD SCATTER, two lobes of Henyey–Greenstein: a SHARP one (g 0.86)
  // — the ice crystals' own halo, a plume crossing the sun lit white-hot
  // round it — and a BROAD one (g 0.45), the whole cloud's glow toward the
  // light. Strongest where the sun's path through the cloud is short
  // (\`shade\`): against a low sun the thin side of a plume lines itself in
  // silver and gold while its core stays soft. It is the whole plume's lit
  // share that glows, never a rim drawn per puff, or a string of puffs
  // lights up as a string of rings.
  float mu = dot(-toEye, uKey);
  float g1 = 0.86;
  float g2 = 0.45;
  float hg1 = (1.0 - g1 * g1) / pow(1.0 + g1 * g1 - 2.0 * g1 * mu, 1.5);
  float hg2 = (1.0 - g2 * g2) / pow(1.0 + g2 * g2 - 2.0 * g2 * mu, 1.5);
  float hg = 0.35 * hg1 + 0.65 * hg2;
  float thin = 1.0 - d * 0.3;
  float forward = (0.06 * hg1 + 0.25 * hg2) * thin * mix(0.35, 1.25, shade);

  float direct = lambert * shade * (1.0 - 0.7 * uFlat) + forward * (1.0 - 0.8 * uFlat);
  // MANY SCATTERINGS: fine snow is nearly white to the light it holds, so
  // what does not come straight through is not lost but bounced on — the
  // shaded core of a sunlit plume is a lit grey-white, powdered sugar,
  // never the dull grey of a lump. (In the mountain's shade there is no
  // key to bounce: \`vAirKey\` is the sky's alone there.)
  direct += (1.0 - shade) * 0.22 * (0.5 + 0.5 * lambert) * (1.0 - 0.7 * uFlat);
  // THE SKY round it, on the bent normal (\`airSky\`): the zenith's blue
  // on top, the snow's bounce under it, the warm sky on the sun's side. A
  // deep billow's shaded side darker than a thin puff's, and its foot
  // darker still, under the rest of the cloud.
  vec3 amb = airSky(N) * mix(0.6 - 0.12 * deep, 1.0, shade);
  amb *= mix(1.0, 0.78 + 0.22 * smoothstep(-0.9, 0.3, vUv.y), min(deep, 1.0));
  // Under the moon the snow on the ground is darker than the lights alone
  // say (the grade and the snow's own night); the cloud keeps pace with it.
  vec3 col = 0.96 * (1.0 - 0.15 * uNight) * (amb + vAirKey * direct);

  // GLINTS: single crystals catching the key light, twinkling as they
  // turn — a pixel each, so they are hashed on the screen's own grid.
  vec2 gp = gl_FragCoord.xy / 2.0;
  float h = hash(floor(gp) + vec2(seed * 97.0, floor(uTime * 15.0 + seed * 40.0)));
  float spot = smoothstep(0.55, 0.1, length(fract(gp) - 0.5));
  // Most of them toward the sun, where the facets can throw it at the eye.
  float odds = 0.004 * vSnow.x * (0.4 + hg * 0.35);
  float glint = step(1.0 - odds, h) * spot * uGlint * smoothstep(0.1, 0.5, d) * shade;
  col += vAirKey * glint * (3.0 + hg);

  // THE LAMPS: a floodlight's cone, a headlamp's beam, lights what it
  // passes through — brightest seen looking back up it. The slots are dealt
  // in order (\`dealLamps\`), so the first empty one ends them: by day the
  // loop is one test, not six.
  for (int i = 0; i < ${LAMP_SLOTS}; i++) {
    if (uLampOn[i] <= 0.0) break;
    vec3 back = uLampPos[i] - vWorld;
    float gap = length(back);
    float toward = 0.5 + 0.5 * pow(max(0.0, dot(-toEye, uLampDir[i])), 3.0);
    col += uLampCol[i] * lampReach(i, back / max(gap, 1e-3), gap) * toward * 1.8;
  }
  col += uPisteCol * length(pisteLight(vWorld)) * 1.2;
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  vec3 ray = vWorld - cameraPosition;
  float dist = length(ray);
  vec3 hz = hazeColour(ray / max(dist, 1e-3));
  #if defined(TONE_MAPPING)
    hz = toneMapping(hz);
  #endif
  hz = linearToOutputTexel(vec4(hz, 1.0)).rgb;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, hz, hazeAmount(dist, ray.y));
}
`;
