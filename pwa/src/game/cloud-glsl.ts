// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLOUD IN GLSL — the field (`cloud-field.ts`) read on the GPU exactly
// as the CPU twin reads it, and the three ways it is drawn and felt:
//
//   * `cloudShell` (LOW): one read where the view crosses each layer's
//     middle, lit off the column standing there — a heap's flat base and
//     grown top, a sheet's thickness — with no march.
//   * `cloudSlab` (MEDIUM, HIGH — `clouds.ts`'s half-resolution pass): a
//     few steps through each layer's slab, a sample or two toward the sun
//     from each, so a heap has a shaded side, a bright rim and a dark base.
//     Part 7's true volume takes this one's place on HIGH.
//   * `cloudShadow` (every world material, through `haze.ts`): the columns
//     between a point and the sun, off a map of every layer laid over the
//     map (`clouds.ts`), as a share of the field's mean — `SkyLook`'s key
//     is that mean, so a place in a gap takes the sun whole and one under a
//     heap its share.
//
// THE LIGHT IN A LAYER comes down onto its tops while the sun stands over
// its horizon, and UP INTO ITS BASES once it is under it (a layer still in
// the sun after the snow's sunset) — the sun's colour at that layer's own
// height (`cloud-light.ts`); the forward scatter of the droplets lights the
// thin edges toward the sun (the silver lining); the sky lights the rest,
// greyer toward the base. Far off, the air between takes it (Rayleigh's
// and the haze's extinction per channel, at the heights between), so a
// heap on the horizon goes into the sky's own colour.

import { CLOUD_LAYERS, EDGE, NOISE_SIZE, SECOND } from "./cloud-field.ts";

const f = (x: number): string => x.toFixed(5);

/** The uniforms and the field's reading: noise, coordinates, columns. */
export const CLOUD_FIELD_GLSL = /* glsl */ `
uniform highp sampler3D uCloudNoise;
// Per layer: base (world y), depth, cut, opacity.
uniform vec4 uCloudA[${CLOUD_LAYERS}];
// The wind's way (x, z), and the periods a metre along and across.
uniform vec4 uCloudB[${CLOUD_LAYERS}];
// The noise's offsets along and across (the wind's carry), its time
// slice, and the dome (1 a heap, 0 a sheet).
uniform vec4 uCloudC[${CLOUD_LAYERS}];
uniform vec3 uCloudSun[${CLOUD_LAYERS}];
uniform vec3 uCloudTop[${CLOUD_LAYERS}];
uniform vec3 uCloudBase[${CLOUD_LAYERS}];
// x how many layers, y how much is shown, z the halo, w the sea's top.
uniform vec4 uCloudOn;
// The sea of a valley fog seen from above: its colour, its density.
uniform vec4 uCloudSea;
// The sea's height of the map's frame, m (an altitude is y less it).
uniform float uCloudSeaLevel;

float cloudNoise(int i, vec2 xz) {
  vec4 B = uCloudB[i];
  vec4 C = uCloudC[i];
  vec3 p = vec3(dot(xz, B.xy) * B.z + C.x, (xz.x * B.y - xz.y * B.x) * B.w + C.y, C.z);
  vec2 r = vec2(p.x * ${f(Math.cos(SECOND.turn))} - p.y * ${f(Math.sin(SECOND.turn))},
                p.x * ${f(Math.sin(SECOND.turn))} + p.y * ${f(Math.cos(SECOND.turn))})
    * ${f(SECOND.scale)} + vec2(${f(SECOND.off[0])}, ${f(SECOND.off[1])});
  vec3 q = vec3(r, p.z * ${f(SECOND.w)} + ${f(SECOND.off[2])});
  return ${f(1 - SECOND.weight)} * texture(uCloudNoise, p).r + ${f(SECOND.weight)} * texture(uCloudNoise, q).r;
}

// The column a noise stands up: its bottom and top, 0..1 of the depth —
// its edge widened by \`w\` where a pixel spans more of the field than the
// noise's own detail (far off and low), so the cells there blur to the
// layer's grey rather than flicker as boxes.
vec2 cloudColumnSoft(int i, float n, float w) {
  float c = smoothstep(uCloudA[i].z - 0.5 * w, uCloudA[i].z + ${f(EDGE)} + w, n);
  float s = smoothstep(0.0, 0.25, c);
  float dome = uCloudC[i].w;
  float bottom = (0.5 - 0.5 * s) * (1.0 - dome);
  float top = (0.5 + 0.5 * s) * (1.0 - dome) + pow(c, 0.55) * dome;
  return vec2(bottom, max(bottom, top));
}
vec2 cloudColumn(int i, float n) {
  return cloudColumnSoft(i, n, 0.0);
}

// The air between the eye and a cloud \`dist\` m off, its altitudes over the
// sea \`a0\` and \`a1\`: what of the cloud's light gets through, per channel.
vec3 cloudAir(float dist, float a0, float a1) {
  float a = max(0.0, 0.5 * (a0 + a1));
  vec3 beta = vec3(5.8e-6, 13.6e-6, 33.1e-6) * exp(-a / 8000.0) + 4.4e-6 * exp(-a / 1200.0);
  return exp(-beta * dist);
}

float cloudHg(float mu, float g) {
  return (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5);
}

// The light at height \`h\` (0..1 of the depth) in layer \`i\`'s column
// \`col\`, the sun \`L\`, the view's cosine to it \`mu\`; \`od\` the optical
// depth toward the sun inside the cloud (the caller's).
vec3 cloudLit(int i, float h, vec2 col, vec3 L, float mu, vec2 od) {
  // Light that has scattered on through the cloud carries further than the
  // direct beam: a second, slower lobe (the many-scattering's). The beam
  // through the top and the one up into the base handed over as the sun
  // crosses the layer's horizon — through its sides, about level.
  vec2 Tb = max(exp(-od), 0.3 * exp(-0.2 * od));
  float Ts = mix(Tb.y, Tb.x, smoothstep(-0.05, 0.05, L.y));
  // A broad lobe, and the droplets' forward peak: the silver lining.
  float phase = 0.75 + 0.12 * cloudHg(mu, 0.75) + 0.25 * cloudHg(mu, -0.25);
  float k = clamp((h - col.x) / max(col.y - col.x, 1e-3), 0.0, 1.0);
  vec3 amb = mix(uCloudBase[i], uCloudTop[i], k) * (0.75 + 0.25 * k);
  return uCloudSun[i] * Ts * phase + amb;
}

// The optical depth toward the sun inside a column, read off the column
// itself: up to its top (x) and down to its base (y) — the sun comes in
// through the one while it stands over the layer's horizon, and through
// the other once it is under it.
vec2 cloudOdColumn(int i, float h, vec2 col, vec3 L) {
  float op = uCloudA[i].w * 0.12 / max(abs(L.y), 0.06);
  return op * vec2(max(col.y - h, 0.0), max(h - col.x, 0.0));
}
`;

/** LOW's cloud: one read a layer, front to back. `d` the view, `e` the eye
 * (world), `L` toward the sun. Premultiplied colour, and the share hidden. */
export const CLOUD_SHELL_GLSL = /* glsl */ `
vec4 cloudLayerShell(int i, vec3 e, vec3 d, vec3 L, vec3 sky) {
  float mid = uCloudA[i].x + 0.5 * uCloudA[i].y;
  float t = (mid - e.y) / d.y;
  if (t <= 0.0 || t > 140000.0) return vec4(0.0);
  vec3 p = e + d * t;
  // The pixel's footprint on the layer, in the noise's units (a pixel about
  // two thousandths of a radian, drawn out along a low view).
  float foot = t * 0.002 / max(abs(d.y), 0.03) * max(uCloudB[i].z, uCloudB[i].w);
  // A sheet read once has no depth to fade its rim through, as the slab's
  // and the march's steps do: its edge is let out over more of the noise,
  // so thin ice frays into the blue instead of standing cut out of it.
  vec2 col = cloudColumnSoft(i, cloudNoise(i, p.xz), min(foot * 6.0, 0.6) + 0.12 * (1.0 - uCloudC[i].w));
  float F = col.y - col.x;
  if (F <= 0.0) return vec4(0.0);
  // Lit as its upper part (what of a heap shows round its base), and thin
  // toward its edge, where the column runs out, so no cut-out rims it.
  float h = mix(col.x, col.y, 0.7);
  vec2 od = cloudOdColumn(i, h, col, L);
  vec3 c = cloudLit(i, h, col, L, dot(d, L), od);
  float a = (1.0 - exp(-uCloudA[i].w * F / max(abs(d.y), 0.03) * 0.5)) * smoothstep(0.0, 0.3, F);
  a *= smoothstep(140000.0, 60000.0, t);
  vec3 T = cloudAir(t, e.y - uCloudSeaLevel, p.y - uCloudSeaLevel);
  c = c * T + sky * (1.0 - T);
  return vec4(c * a, a);
}
`;

/** MEDIUM's and HIGH's: `STEPS` steps through each slab and `LIGHT` reads
 * toward the sun from each (defines the pass sets). */
export const CLOUD_SLAB_GLSL = /* glsl */ `
// Where in its step each pixel reads: a 2 x 2 ordered dither the dome's
// tent averages away, so four neighbours together read four times the steps.
float cloudJitter(vec2 px) {
  vec2 q = mod(floor(px), 2.0);
  return 0.125 + 0.25 * (2.0 * abs(q.x - q.y) + q.y);
}
vec4 cloudLayerSlab(int i, vec3 e, vec3 d, vec3 L, vec3 sky, float jit) {
  float yb = uCloudA[i].x;
  float depth = uCloudA[i].y;
  float yt = yb + depth;
  float t0;
  float t1;
  if (abs(d.y) < 1e-4) {
    if (e.y < yb || e.y > yt) return vec4(0.0);
    t0 = 0.0;
    t1 = 140000.0;
  } else {
    float ta = (yb - e.y) / d.y;
    float tb = (yt - e.y) / d.y;
    t0 = max(min(ta, tb), 0.0);
    t1 = min(max(ta, tb), 140000.0);
  }
  if (t1 <= t0) return vec4(0.0);
  // A slab seen edge-on near the horizon is walked no further than a few
  // cells of it: what is past them is hidden by them or by the air.
  t1 = min(t1, t0 + 12.0 * depth / max(abs(d.y), 0.02) + 4000.0);
  float dt = (t1 - t0) / float(STEPS);
  // Steps longer than a fraction of a cell would read the field on a few
  // planes and stripe it: there, far and low, the shell's one read stands in
  // (a heap that far off is a shape against the sky, not a volume).
  float cell = 0.25 / max(uCloudB[i].z, uCloudB[i].w);
  float near = smoothstep(0.5 * cell, 0.2 * cell, dt);
  vec4 shell = near < 1.0 ? cloudLayerShell(i, e, d, L, sky) : vec4(0.0);
  if (near <= 0.0) return shell;
  float sigma = uCloudA[i].w / depth;
  float mu = dot(d, L);
  vec3 acc = vec3(0.0);
  float T = 1.0;
  for (int k = 0; k < STEPS; k++) {
    float t = t0 + (float(k) + jit) * dt;
    vec3 p = e + d * t;
    vec2 col = cloudColumn(i, cloudNoise(i, p.xz));
    // The share of this step's run of heights inside the column, taken whole
    // rather than at a point: a few steps through a heap then never slice it
    // into layers (a step seen steeply crosses much of the depth).
    float hm = (p.y - yb) / depth;
    float hs = 0.5 * abs(d.y) * dt / depth + 0.03;
    float lo = hm - hs;
    float hi = hm + hs;
    float fill = max(0.0, min(hi, col.y) - max(lo, col.x)) / (hi - lo);
    if (fill <= 0.0) continue;
    float h = clamp(hm, col.x, col.y);
    // Toward the sun: the column here, and LIGHT reads of the columns the
    // beam crosses on its way out of the layer (on whichever path it takes).
    vec2 od = cloudOdColumn(i, h, col, L);
    #if LIGHT > 0
      float run = depth / max(abs(L.y), 0.12);
      for (int j = 1; j <= LIGHT; j++) {
        vec3 q = p + L * run * (float(j) / float(LIGHT + 1));
        vec2 cq = cloudColumn(i, cloudNoise(i, q.xz));
        float hq = (q.y - yb) / depth;
        float inq = smoothstep(cq.x - 0.04, cq.x + 0.03, hq) * smoothstep(cq.y + 0.04, cq.y - 0.03, hq);
        od += vec2(sigma * 0.12 * inq * run / float(LIGHT + 1));
      }
      od *= 0.6;
    #endif
    float a = 1.0 - exp(-sigma * fill * dt);
    vec3 c = cloudLit(i, h, col, L, mu, od);
    vec3 air = cloudAir(t, e.y - uCloudSeaLevel, p.y - uCloudSeaLevel);
    acc += T * a * (c * air + sky * (1.0 - air));
    T *= 1.0 - a;
    if (T < 0.02) break;
  }
  float fade = smoothstep(140000.0, 60000.0, t0);
  return mix(shell, vec4(acc * fade, (1.0 - T) * fade), near);
}
`;

/** The layers in order along the view, front to back, through `LAYER(i)`
 * (a shell's or a slab's). The field's layers are kept sorted by height
 * (`clouds.ts`), so up the view is up the list and down it is down it. */
export const cloudStackGlsl = (layer: string): string => /* glsl */ `
vec4 cloudStack(vec3 e, vec3 d, vec3 L, vec3 sky, float jit) {
  vec4 acc = vec4(0.0);
  int n = int(uCloudOn.x + 0.5);
  for (int k = 0; k < ${CLOUD_LAYERS}; k++) {
    if (k >= n) break;
    int i = d.y >= 0.0 ? k : n - 1 - k;
    vec4 c = ${layer};
    acc.rgb += (1.0 - acc.a) * c.rgb;
    acc.a += (1.0 - acc.a) * c.a;
  }
  return acc * uCloudOn.y;
}
`;

/** THE 22° HALO round the sun in a veil of ice: refracted light, red on
 * its sharp inner edge and fading outward, a darker sky inside it. */
export const CLOUD_HALO_GLSL = /* glsl */ `
vec3 cloudHalo(vec3 d, vec3 sun, vec3 sunCol, float strength) {
  if (strength <= 0.0) return vec3(0.0);
  float th = degrees(acos(clamp(dot(d, sun), -1.0, 1.0)));
  vec3 edge = vec3(21.75, 22.0, 22.3);
  vec3 ring = exp(-pow((vec3(th) - edge) / 0.45, vec3(2.0)));
  vec3 skirt = step(edge, vec3(th)) * exp(-(vec3(th) - edge) / 3.0) * 0.35;
  return sunCol * (ring + skirt) * strength * 0.16;
}
`;

/** THE CLOUDS' SHADOW on the snow, for every world material: the share of
 * the key a point takes against the field's mean (1 with no field). Reads
 * `haze.ts`'s `uCloudShadow` map: a layer a channel, each laid over the map
 * at that layer's middle height (`uCloudBox`: its first corner, one over
 * its span, the height), the columns' share of the depth in it. */
export const CLOUD_SHADOW_GLSL = /* glsl */ `
uniform sampler2D uCloudShadow;
uniform vec4 uCloudBox[${CLOUD_LAYERS}];
uniform vec4 uCloudTau;
uniform vec4 uCloudMean;
float cloudLayerShadow(vec3 p, vec4 box, float F0, float tau, float mean, vec3 L) {
  if (tau <= 0.0) return 1.0;
  // Ground standing up out of a layer (a summit over a low deck) is in the
  // sun over it: its shadow eased out across the layer's middle.
  float out1 = smoothstep(box.w - 60.0, box.w + 60.0, p.y);
  if (out1 >= 1.0) return 1.0;
  vec2 q = p.xz + L.xz * (box.w - p.y) / L.y;
  vec2 uv = (q - box.xy) * box.z;
  if (uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) return mix(mean, 1.0, out1);
  return mix(exp(-F0 * tau / max(L.y, 0.08)), 1.0, out1);
}
float cloudShadow(vec3 p) {
  vec3 L = uSunDir;
  if (uCloudTau.w < 0.5 || L.y <= 0.02) return 1.0;
  vec4 F = vec4(0.0);
  // One read serves every layer whose box is the same (all of them: they
  // are laid over one span), offset by each layer's own lean of the sun.
  vec2 q0 = p.xz + L.xz * (uCloudBox[0].w - p.y) / L.y;
  vec2 q1 = p.xz + L.xz * (uCloudBox[1].w - p.y) / L.y;
  vec2 q2 = p.xz + L.xz * (uCloudBox[2].w - p.y) / L.y;
  F.r = texture(uCloudShadow, (q0 - uCloudBox[0].xy) * uCloudBox[0].z).r;
  F.g = texture(uCloudShadow, (q1 - uCloudBox[1].xy) * uCloudBox[1].z).g;
  F.b = texture(uCloudShadow, (q2 - uCloudBox[2].xy) * uCloudBox[2].z).b;
  float T = cloudLayerShadow(p, uCloudBox[0], F.r, uCloudTau.x, uCloudMean.x, L)
          * cloudLayerShadow(p, uCloudBox[1], F.g, uCloudTau.y, uCloudMean.y, L)
          * cloudLayerShadow(p, uCloudBox[2], F.b, uCloudTau.z, uCloudMean.z, L);
  return T / max(uCloudMean.w, 1e-3);
}
`;

/** The texels a side of the noise's 3D texture (`cloud-field.ts`). */
export const CLOUD_NOISE_SIZE = NOISE_SIZE;
