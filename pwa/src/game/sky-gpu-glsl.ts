// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PHYSICAL ATMOSPHERE IN GLSL — `atmosphere-model.ts` (Hillaire 2020)
// restated for the GPU, line for line where it can be: the same media
// (Rayleigh's air, the aerosol's Mie haze, the ozone, the snow's albedo),
// the same transmittance table on Bruneton's parametrisation, the same
// multiple-scattering table (the higher orders summed as 1/(1 − f_ms)),
// the same march for the sky's radiance with the planet's shadow — so the
// MEDIUM and HIGH skies (`sky-gpu.ts`) draw the colours the LOW table was
// baked from. Three-free: strings, and the constants read off `EARTH`.
//
// Kilometres for lengths, the sun's illuminance at the top of the air 1 in
// every channel — the model's units, unexposed. What a sky-view texel
// writes is then EXPOSED exactly as `sky.ts` exposes the LOW grid (its
// exposure, the dome pressed about its mean by `DOME`, the grazing row
// pulled toward the one over it, the night's floor, a veil's thinning).

import { EARTH } from "./atmosphere-model.ts";
import { FROXEL_ATLAS, FROXELS, SKY_TABLES } from "./sky-gpu-plan.ts";
import { DOME, NIGHT_HORIZON, NIGHT_ZENITH } from "./sky.ts";
import { SKY_VIEW_EL } from "./sky-table-format.ts";

const f = (x: number): string => {
  const s = x.toPrecision(7);
  return s.includes(".") || s.includes("e") ? s : `${s}.0`;
};
const v3 = (c: readonly number[]): string => `vec3(${f(c[0])}, ${f(c[1])}, ${f(c[2])})`;

/** The vertex shader every pass draws its one quad with. */
export const QUAD_VERTEX = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** The media and the geometry: what every pass shares. */
export const ATMO_GLSL = /* glsl */ `
#ifndef PI
#define PI 3.141592653589793
#endif
const float RG = ${f(EARTH.groundRadius)};
const float RT = ${f(EARTH.topRadius)};
const vec3 RAY = ${v3(EARTH.rayleigh)};
const float RAY_H = ${f(EARTH.rayleighHeight)};
const float MIE_S = ${f(EARTH.mieScattering)};
const float MIE_E = ${f(EARTH.mieExtinction)};
const float MIE_H = ${f(EARTH.mieHeight)};
const float MIE_G = ${f(EARTH.mieG)};
const vec3 OZONE = ${v3(EARTH.ozone)};
const float OZ_C = ${f(EARTH.ozoneCentre)};
const float OZ_W = ${f(EARTH.ozoneWidth)};
const float ALBEDO = ${f(EARTH.albedo)};

// The media at a height h km: Rayleigh's scattering, Mie's, the extinction.
void medium(float h, out vec3 sr, out float sm, out vec3 ext) {
  float hh = max(h, 0.0);
  sr = RAY * exp(-hh / RAY_H);
  float dm = exp(-hh / MIE_H);
  sm = MIE_S * dm;
  ext = sr + MIE_E * dm + OZONE * max(0.0, 1.0 - abs(h - OZ_C) / OZ_W);
}
float rayleighPhase(float nu) { return 3.0 / (16.0 * PI) * (1.0 + nu * nu); }
float miePhase(float nu) {
  float g = MIE_G;
  float k = 3.0 / (8.0 * PI) * (1.0 - g * g) / (2.0 + g * g);
  return k * (1.0 + nu * nu) / pow(1.0 + g * g - 2.0 * g * nu, 1.5);
}
// The far root of a ray from radius r at zenith cosine mu with the sphere R.
float toSphere(float r, float mu, float R) {
  float disc = r * r * (mu * mu - 1.0) + R * R;
  if (disc < 0.0) return -1.0;
  return -r * mu + sqrt(disc);
}
float toGround(float r, float mu) {
  if (mu >= 0.0) return -1.0;
  float disc = r * r * (mu * mu - 1.0) + RG * RG;
  if (disc < 0.0) return -1.0;
  return max(0.0, -r * mu - sqrt(disc));
}
float horizonMu(float r) {
  float s = RG / r;
  return -sqrt(max(0.0, 1.0 - s * s));
}
vec2 transUv(float r, float mu) {
  float H = sqrt(RT * RT - RG * RG);
  float rho = sqrt(max(0.0, r * r - RG * RG));
  float d = max(0.0, toSphere(r, mu, RT));
  float dMin = RT - r;
  float dMax = rho + H;
  return vec2((d - dMin) / max(1e-9, dMax - dMin), rho / H);
}
`;

/** Reading the two tables built once. */
export const TABLES_GLSL = /* glsl */ `
uniform sampler2D uTrans;
uniform sampler2D uMs;
vec2 lutUv(vec2 uv, vec2 size) { return (clamp(uv, 0.0, 1.0) * (size - 1.0) + 0.5) / size; }
// The sun from radius r at zenith cosine muS: through the air, nothing once
// the planet stands in front of it, softened over the sun's own disc.
vec3 sunTrans(float r, float muS) {
  float hz = horizonMu(r);
  float vis = clamp((muS - hz) / 0.0093 + 0.5, 0.0, 1.0);
  if (vis <= 0.0) return vec3(0.0);
  vec2 uv = transUv(r, max(muS, hz));
  return texture2D(uTrans, lutUv(uv, vec2(${f(SKY_TABLES.trans.width)}, ${f(SKY_TABLES.trans.height)}))).rgb * vis;
}
vec3 multiScat(float r, float muS) {
  vec2 uv = vec2(muS * 0.5 + 0.5, (r - RG) / (RT - RG));
  return texture2D(uMs, lutUv(uv, vec2(${f(SKY_TABLES.ms.size)}))).rgb;
}
`;

/** THE TRANSMITTANCE TABLE: a texel's (r, μ) and the march to the top. */
export const TRANS_FRAGMENT = /* glsl */ `
${ATMO_GLSL}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5) / vec2(${f(SKY_TABLES.trans.width - 1)}, ${f(SKY_TABLES.trans.height - 1)});
  float H = sqrt(RT * RT - RG * RG);
  float rho = H * uv.y;
  float r = sqrt(rho * rho + RG * RG);
  float dMin = RT - r;
  float dMax = rho + H;
  float d = dMin + uv.x * (dMax - dMin);
  float mu = d == 0.0 ? 1.0 : clamp((H * H - rho * rho - d * d) / (2.0 * r * d), -1.0, 1.0);
  float len = max(0.0, toSphere(r, mu, RT));
  float dt = len / ${f(SKY_TABLES.trans.steps)};
  vec3 od = vec3(0.0);
  vec3 sr; float sm; vec3 ext;
  for (int i = 0; i < ${SKY_TABLES.trans.steps}; i++) {
    float t = (float(i) + 0.5) * dt;
    float rr = sqrt(r * r + t * t + 2.0 * r * mu * t);
    medium(rr - RG, sr, sm, ext);
    od += ext * dt;
  }
  gl_FragColor = vec4(exp(-od), 1.0);
}
`;

/** THE MULTIPLE-SCATTERING TABLE: Ψ_ms by height and the sun's angle. */
export const MS_FRAGMENT = /* glsl */ `
${ATMO_GLSL}
${TABLES_GLSL}
void main() {
  float N = ${f(SKY_TABLES.ms.size - 1)};
  float j = gl_FragCoord.y - 0.5;
  float i = gl_FragCoord.x - 0.5;
  float r = RG + max(0.01, (j / N) * (RT - RG));
  float muS = (i / N) * 2.0 - 1.0;
  float sx = sqrt(max(0.0, 1.0 - muS * muS));
  float sy = muS;
  vec3 L2 = vec3(0.0);
  vec3 F = vec3(0.0);
  const int DIRS = ${SKY_TABLES.ms.dirs};
  const int STEPS = ${SKY_TABLES.ms.steps};
  float n = float(DIRS * DIRS);
  vec3 sr; float sm; vec3 ext;
  for (int a = 0; a < DIRS; a++) {
    for (int b = 0; b < DIRS; b++) {
      float cosT = 1.0 - 2.0 * (float(a) + 0.5) / float(DIRS);
      float phi = 2.0 * PI * (float(b) + 0.5) / float(DIRS);
      float sinT = sqrt(max(0.0, 1.0 - cosT * cosT));
      float dx = sinT * cos(phi);
      float dy = cosT;
      float ground = toGround(r, dy);
      float len = ground >= 0.0 ? ground : max(0.0, toSphere(r, dy, RT));
      float dt = len / float(STEPS);
      vec3 T = vec3(1.0);
      for (int s = 0; s < STEPS; s++) {
        float t = (float(s) + 0.3) * dt;
        float px = dx * t;
        float py = r + dy * t;
        float rr = length(vec2(px, py));
        medium(rr - RG, sr, sm, ext);
        float mu = (px * sx + py * sy) / rr;
        vec3 sunT = sunTrans(rr, mu);
        vec3 scat = sr + sm;
        vec3 e = max(ext, vec3(1e-9));
        vec3 stp = exp(-e * dt);
        vec3 share = (1.0 - stp) / e;
        L2 += T * scat * sunT * (1.0 / (4.0 * PI)) * share / n;
        F += T * scat * share / n;
        T *= stp;
      }
      if (ground >= 0.0) {
        float gx = dx * ground;
        float gy = r + dy * ground;
        float gr = length(vec2(gx, gy));
        float gmu = (gx * sx + gy * sy) / gr;
        L2 += T * sunTrans(gr, gmu) * max(0.0, gmu) * (ALBEDO / PI) / n;
      }
    }
  }
  gl_FragColor = vec4(L2 / (1.0 - min(vec3(0.99), F)), 1.0);
}
`;

/** THE SKY'S RADIANCE along `view` from radius `r` with the sun toward
 * `sun` (unit, y up), marched in `STEPS` packed toward the lens. */
export const MARCH_GLSL = /* glsl */ `
vec3 skyMarch(float r, vec3 view, vec3 sun) {
  float mu = view.y;
  float ground = toGround(r, mu);
  float len = ground >= 0.0 ? ground : max(0.0, toSphere(r, mu, RT));
  float nu = dot(view, sun);
  float pr = rayleighPhase(nu);
  float pm = miePhase(nu);
  vec3 L = vec3(0.0);
  vec3 T = vec3(1.0);
  float prev = 0.0;
  vec3 sr; float sm; vec3 ext;
  for (int s = 1; s <= STEPS; s++) {
    float fs = float(s) / float(STEPS);
    float t1 = len * fs * fs;
    float dt = t1 - prev;
    float t = prev + 0.5 * dt;
    prev = t1;
    vec3 p = vec3(0.0, r, 0.0) + view * t;
    float rr = length(p);
    medium(rr - RG, sr, sm, ext);
    float muS = dot(p, sun) / rr;
    vec3 S = (sr * pr + sm * pm) * sunTrans(rr, muS) + (sr + sm) * multiScat(rr, muS);
    vec3 e = max(ext, vec3(1e-9));
    vec3 stp = exp(-e * dt);
    L += T * S * (1.0 - stp) / e;
    T *= stp;
  }
  return L;
}
`;

/** THE SKY-VIEW TABLE, exposed as the LOW grid is (`sky.ts`). */
export const VIEW_FRAGMENT = /* glsl */ `
${ATMO_GLSL}
${TABLES_GLSL}
${MARCH_GLSL}
uniform vec2 uSize;
// The sun's elevation, rad; the lens's radius, km.
uniform float uElevation;
uniform float uRadius;
// The exposure, the dome's mean luminance, the night, the veil's share.
uniform vec4 uExpose;
float lumOf(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 dirOf(float u, float v) {
  float az = u * u * PI;
  float el = v * v * (PI / 2.0);
  float c = cos(el);
  return vec3(sin(az) * c, sin(el), cos(az) * c);
}
// The grazing rows pulled toward the row a step over them, in the
// logarithm, as the LOW grid's is (\`DOME.horizon\`) — faded out over that
// step, as the LOW grid's texture filter fades it.
const float V1 = ${f(1 / (SKY_VIEW_EL - 1))};
vec3 pulled(float u, float v, vec3 sun) {
  vec3 L = skyMarch(uRadius, dirOf(u, v), sun);
  if (v >= V1) return L;
  vec3 L1 = skyMarch(uRadius, dirOf(u, V1), sun);
  float w = ${f(DOME.horizon)} * (1.0 - v / V1);
  return L * pow(max(L1, vec3(1e-30)) / max(L, vec3(1e-30)), vec3(w));
}
vec3 exposed(vec3 L, float v) {
  float Y = lumOf(L);
  float press = Y > 0.0 ? ${f(DOME.gain)} * pow(Y / uExpose.y, ${f(DOME.span - 1)}) : 0.0;
  vec3 floorC = mix(${v3(NIGHT_HORIZON)}, ${v3(NIGHT_ZENITH)}, v);
  return L * uExpose.x * press + floorC * uExpose.z;
}
void main() {
  float u = (gl_FragCoord.x - 0.5) / (uSize.x - 1.0);
  float v = (gl_FragCoord.y - 0.5) / (uSize.y - 1.0);
  vec3 sun = vec3(0.0, sin(uElevation), cos(uElevation));
  vec3 c = exposed(pulled(u, v, sun), v);
  // A veil or heaps between: the blue thinned toward the horizon's white.
  if (uExpose.w > 0.0) c += (exposed(pulled(u, 0.0, sun), 0.0) - c) * uExpose.w;
  gl_FragColor = vec4(min(c, vec3(65000.0)), 1.0);
}
`;

/** THE AERIAL-PERSPECTIVE VOLUME (HIGH): each cell the share of the air's
 * light along its ray that it would have with nothing between the air and
 * the sun — the march toward the sun through the map's ground (`uGround`)
 * finding the ridges that shade it. The air's density along the way is the
 * game's haze (\`hazeAir\`'s law); its make-up and the light on it the
 * model's: the sun through the air (\`sunTrans\`) by the phases, the sky's
 * light (\`multiScat\`) everywhere. */
export const FROXEL_FRAGMENT = /* glsl */ `
${ATMO_GLSL}
${TABLES_GLSL}
uniform mat4 uInvViewProj;
uniform vec3 uEye;
// The sun toward, unit; the lens's radius, km.
uniform vec3 uSun;
uniform float uRadius;
// The game's haze: density 1/m, the thinning height, the floor's share.
uniform vec3 uHazeLaw;
// The ground: its texture (heights, m), its world-to-uv box, and whether
// there is one (x).
uniform sampler2D uGround;
uniform vec4 uGroundBox;
uniform vec4 uGroundOn;
float groundAt(vec2 xz) {
  vec2 uv = (xz - uGroundBox.xy) * uGroundBox.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -1e9;
  return texture2D(uGround, uv).r;
}
// How much of the sun reaches a point in the air: the ground looked for
// along the way to the sun, out to \`reach\` m.
float sunSeen(vec3 p) {
  if (uGroundOn.x < 0.5 || uSun.y < -0.02) return 1.0;
  float seen = 1.0;
  float s = 12.0;
  for (int k = 0; k < ${FROXELS.light}; k++) {
    vec3 q = p + uSun * s;
    float h = groundAt(q.xz);
    seen = min(seen, smoothstep(-4.0, 6.0, q.y - h));
    s *= ${f(Math.pow(FROXELS.reach / 12, 1 / (FROXELS.light - 1)))};
  }
  return seen;
}
float depthOf(float k) { return ${f(FROXELS.depth)} * pow((k + 1.0) / ${f(FROXELS.slices)}, 3.0); }
void main() {
  float px = gl_FragCoord.x - 0.5;
  float slice = floor(px / ${f(FROXELS.size)});
  float x = px - slice * ${f(FROXELS.size)};
  float y = gl_FragCoord.y - 0.5;
  vec2 ndc = (vec2(x, y) + 0.5) / ${f(FROXELS.size)} * 2.0 - 1.0;
  vec4 w = uInvViewProj * vec4(ndc, 1.0, 1.0);
  vec3 dir = normalize(w.xyz / w.w - uEye);
  float D = depthOf(slice);
  float nu = dot(dir, uSun);
  float pr = rayleighPhase(nu);
  float pm = miePhase(nu);
  vec3 lit = vec3(0.0);
  vec3 whole = vec3(0.0);
  float od = 0.0;
  float prev = 0.0;
  vec3 sr; float sm; vec3 ext;
  for (int s = 1; s <= ${FROXELS.steps}; s++) {
    float fs = float(s) / ${f(FROXELS.steps)};
    float t1 = D * fs * fs;
    float dt = t1 - prev;
    float t = prev + 0.5 * dt;
    prev = t1;
    vec3 p = uEye + dir * t;
    float rise = p.y - uEye.y;
    float dens = uHazeLaw.x * mix(uHazeLaw.z, 1.0, exp(-max(rise, 0.0) / uHazeLaw.y));
    float wgt = dens * dt * exp(-od);
    od += dens * dt;
    float rr = uRadius + rise / 1000.0;
    // A few kilometres along a planet's surface: the sun's height is uSun's.
    float muS = uSun.y;
    medium(rr - RG, sr, sm, ext);
    vec3 sun = (sr * pr + sm * pm) * sunTrans(rr, muS);
    vec3 sky = (sr + sm) * multiScat(rr, muS);
    lit += wgt * (sky + sun * sunSeen(p));
    whole += wgt * (sky + sun);
  }
  vec3 share = whole.g > 1e-20 ? lit / max(whole, vec3(1e-20)) : vec3(1.0);
  gl_FragColor = vec4(clamp(share, 0.0, 1.0), 1.0);
}
`;

/** THE AERIAL PERSPECTIVE READ (`haze.ts`'s `aerialShade`): the share of the
 * air's light the sun gives along the way to a world point, off the
 * volume — 1 (the haze as LOW draws it) where there is none, off the
 * screen, or behind the lens. */
export const AERIAL_GLSL = /* glsl */ `
uniform sampler2D uAp;
uniform mat4 uApViewProj;
uniform vec4 uApOn;
vec3 aerialShade(vec3 world) {
  if (uApOn.x < 0.5) return vec3(1.0);
  vec4 c = uApViewProj * vec4(world, 1.0);
  if (c.w <= 0.0) return vec3(1.0);
  vec2 s = c.xy / c.w * 0.5 + 0.5;
  if (s.x < 0.0 || s.y < 0.0 || s.x > 1.0 || s.y > 1.0) return vec3(1.0);
  float k = ${f(FROXELS.slices)} * pow(length(world - cameraPosition) / ${f(FROXELS.depth)}, 1.0 / 3.0) - 1.0;
  float inside = clamp(k + 1.0, 0.0, 1.0);
  k = clamp(k, 0.0, ${f(FROXELS.slices - 1)});
  float k0 = floor(k);
  float k1 = min(k0 + 1.0, ${f(FROXELS.slices - 1)});
  float x = clamp(s.x * ${f(FROXELS.size)}, 0.5, ${f(FROXELS.size - 0.5)});
  float y = s.y;
  vec3 a = texture2D(uAp, vec2((k0 * ${f(FROXELS.size)} + x) / ${f(FROXEL_ATLAS.width)}, y)).rgb;
  vec3 b = texture2D(uAp, vec2((k1 * ${f(FROXELS.size)} + x) / ${f(FROXEL_ATLAS.width)}, y)).rgb;
  return mix(vec3(1.0), mix(a, b, k - k0), inside);
}
`;
