// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TITLE SCENE'S SHADERS (`title-renderer.ts` compiles them): the plate
// brought to life in two passes and one draw of points. Portable GLSL ES
// 3.00 on RGBA8 targets only, so it runs wherever WebGL2 does — a software
// rasterizer included.
//
//   BRIGHT (half resolution): the light the plate gives off — a bloom
//     prefilter (the plate's bright snow and sky off a blurred mip, and the
//     glow the render marked: the spray and the backlit rims) in rgb, and
//     the GOD RAYS in alpha: 24 steps marched toward the sun over the sky's
//     brightness, so every crest between a pixel and the sun casts a shaft.
//     Its mips are the bloom's blur.
//   COMPOSITE (full resolution): the plate through the crop and the drift,
//     with a depth parallax (the near snow slid against the far ridges,
//     about the skier, off a blurred depth so an edge warps rather than
//     tears); cloud shadows sliding over the sunlit snow; sparkle that
//     twinkles as the lens moves; spindrift streaming off the skyline; the
//     bloom, the rays and the sun's halo; and the lens — exposure, a soft
//     shoulder, the vignette, a touch of chromatic aberration, grain.
//   PARTICLES: the falling snow in three depths and the grains breathing
//     off the frozen spray, soft discs added over the composite.
//
// LINEAR LIGHT: the colour plate is uploaded as sRGB so it samples linear,
// every term is added in linear, and `colourspace` writes sRGB at the end
// (the repo's rule for a hand-written shader). Every moving term is a hash
// or a sine of the title clock, never a stream.

/** A triangle over the whole screen; `vS` is the screen, 0..1 from the top
 * left, the plate's own orientation. */
export const FULLSCREEN_VS = /* glsl */ `#version 300 es
out vec2 vS;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vS = vec2(p.x, 1.0 - p.y);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const COMMON = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform sampler2D uColour;
uniform sampler2D uAux;
uniform vec4 uRect;     // the visible plate: x, y, w, h (UV)
uniform vec2 uSun;      // the sun, plate UV
uniform vec2 uSubject;  // the skier, plate UV
uniform float uT;       // the motion clock, s

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * noise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    a *= 0.5;
  }
  return s;
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec2 plateAt(vec2 s) { return uRect.xy + s * uRect.zw; }
`;

/** Pass one: the bloom's prefilter in rgb and the god rays in alpha. */
export const BRIGHT_FS = /* glsl */ `#version 300 es
${COMMON}
in vec2 vS;
out vec4 outColour;
const int RAY_STEPS = 24;
void main() {
  vec2 uv = plateAt(vS);
  vec3 c = textureLod(uColour, uv, 2.0).rgb;
  // The glow off a blurred mip: the render's own glow pass carries a few
  // hard edges a bloom would print.
  float glow = textureLod(uAux, uv, 2.5).a;
  float l = luma(c);
  vec3 bloom = c * smoothstep(0.8, 1.2, l) * 0.6 + vec3(1.0, 0.86, 0.7) * glow * 0.6;
  // THE RAYS: marched from the pixel toward the sun over the sky's light.
  vec2 d = (uSun - uv) * (0.72 / float(RAY_STEPS));
  vec2 p = uv;
  float decay = 1.0;
  float rays = 0.0;
  float j = hash12(gl_FragCoord.xy + fract(uT) * 37.0);
  p += d * j;
  for (int i = 0; i < RAY_STEPS; i++) {
    p += d;
    vec2 q = clamp(p, vec2(0.0), vec2(1.0));
    vec4 a = textureLod(uAux, q, 3.0);
    float sky = a.b * smoothstep(0.55, 0.95, luma(textureLod(uColour, q, 3.0).rgb));
    rays += (sky + a.a * 0.35) * decay;
    decay *= 0.93;
  }
  rays *= 1.0 / float(RAY_STEPS);
  outColour = vec4(min(bloom, vec3(4.0)) * 0.25, clamp(rays, 0.0, 1.0));
}`;

/** Pass two: the scene, composited. */
export const COMPOSITE_FS = /* glsl */ `#version 300 es
${COMMON}
uniform sampler2D uBright;
uniform vec2 uPar;       // the lens's parallax offset, UV
uniform vec2 uPx;        // one screen pixel in screen units
uniform float uAspect;   // the screen's width / height
uniform float uExposure; // 0..1, the reveal's fade from black
uniform float uFrame;    // a frame counter, for the grain
uniform vec3 uRidge[65]; // the skyline, u evenly spaced: u, v, depth
uniform vec2 uDepth;     // near, far (m)
in vec2 vS;
out vec4 outColour;

float metres(float r) { return uDepth.x * pow(uDepth.y / uDepth.x, r); }
float ridgeAt(float u) {
  float x = clamp(u, 0.0, 1.0) * 64.0;
  int i = int(min(floor(x), 63.0));
  return mix(uRidge[i].y, uRidge[i + 1].y, x - float(i));
}
vec3 colourspace(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
// The parallax: how far a point at depth r slides with the lens, about the
// skier's own depth — the far ridges one way, the near snow the other.
vec2 slide(float r, float rs) {
  float k = 1.0 - metres(rs) / metres(r);
  return uPar * clamp(k, -0.7, 0.7);
}
// One sparkle cell: a glint where the sunlit snow faces the sun just so,
// turning on and off as the lens moves and the clock runs.
float glint(vec2 cell, float lit) {
  float h = hash12(cell);
  if (h < 0.982) return 0.0;
  float h2 = hash12(cell + 17.31);
  float phase = h2 * 6.2832 + dot(uPar, vec2(900.0, 700.0));
  float tw = pow(max(0.0, sin(uT * (0.9 + 2.2 * h2) + phase)), 18.0);
  return tw * lit * lit;
}

void main() {
  vec2 uv0 = plateAt(vS);
  float rs = textureLod(uAux, uSubject, 3.0).r;
  // THE PARALLAX, read off a HEAVILY blurred depth: the slide is a smooth
  // warp of the plate, never a cut along an edge, so nothing tears or smears
  // at the skier's outline or the skyline — the near snow and the far ridges
  // still part, which is all the eye asks of it.
  vec2 uv = uv0 + slide(textureLod(uAux, uv0, 4.5).r, rs);
  vec4 aux = texture(uAux, uv);
  float sky = aux.b;
  float lit = aux.g;

  // THE LENS'S ABERRATION: red and blue pulled apart toward the corners.
  vec2 fromMid = vS - 0.5;
  vec2 ca = fromMid * dot(fromMid, fromMid) * 2.4 * uPx * uRect.zw;
  vec3 c;
  c.r = texture(uColour, uv + ca).r;
  c.g = texture(uColour, uv).g;
  c.b = texture(uColour, uv - ca).b;

  // CLOUD SHADOWS sliding over the sunlit snow, in a ground of their own:
  // the plate's UV opened out as a slope seen from above it, so they shrink
  // up toward the far snow. Never off the plate's depth: that is eight bits
  // of a log at every mip, and its steps print as contours across the slope.
  float reach = 1.0 / (uv.y + 0.18);
  vec2 ground = vec2((uv.x - 0.5) * reach, reach) * 0.9 + vec2(uT * 0.03, -uT * 0.01);
  float cloud = smoothstep(0.42, 0.72, fbm(ground));
  c *= mix(1.0, 0.8, cloud * smoothstep(0.05, 0.6, lit) * (1.0 - sky));

  // SPARKLE: cells locked to the plate (so a glint stays on its crystal as
  // the lens drifts), each a small star of the cell and its four neighbours.
  vec2 cellUv = uv * 1400.0;
  vec2 cell = floor(cellUv);
  float g = glint(cell, lit) * 1.0;
  g += 0.35 * (glint(cell + vec2(1.0, 0.0), lit) + glint(cell - vec2(1.0, 0.0), lit)
             + glint(cell + vec2(0.0, 1.0), lit) + glint(cell - vec2(0.0, 1.0), lit));
  c += vec3(1.0, 0.96, 0.9) * g * 1.6 * (1.0 - sky);

  // SPINDRIFT off the skyline: a domain-warped plume above the ridge,
  // streaming up and to the left on the wind, lit warm toward the sun.
  float above = ridgeAt(uv.x) - uv.y;
  float band = smoothstep(-0.006, 0.003, above) * exp(-max(above, 0.0) / 0.018);
  if (band > 0.002) {
    vec2 q = vec2(uv.x * 22.0 + uT * 0.5, above * 70.0 - uT * 0.25);
    vec2 w = vec2(fbm(q * 0.9 + uT * 0.07), fbm(q * 0.9 + 5.2 - uT * 0.04));
    float plume = smoothstep(0.45, 0.9, fbm(q + 2.4 * w));
    float near = exp(-length((uv - uSun) * vec2(1.0, 1.6)) * 3.0);
    vec3 tint = mix(vec3(0.85, 0.9, 1.0), vec3(1.0, 0.84, 0.64), near);
    c += tint * min(0.3, plume * band * (0.25 + 1.2 * near));
  }

  // THE SUN'S LIGHT: bloom off the bright pass's mips (its own blur), the
  // rays in its alpha, and a halo round the disc — which on a wide screen
  // stands above the frame, so the halo is all of it that reaches in.
  // (A target's first row is its BOTTOM, so the bright pass is read flipped.)
  vec2 bs = vec2(vS.x, 1.0 - vS.y);
  // A tent of taps over two mips, so the wide glow is smooth however a
  // driver filters between its levels.
  vec2 o = uPx * 10.0;
  vec3 wide = textureLod(uBright, bs + vec2(o.x, o.y), 3.0).rgb
            + textureLod(uBright, bs + vec2(-o.x, o.y), 3.0).rgb
            + textureLod(uBright, bs + vec2(o.x, -o.y), 3.0).rgb
            + textureLod(uBright, bs + vec2(-o.x, -o.y), 3.0).rgb;
  vec3 far = textureLod(uBright, bs + vec2(o.x, 0.0) * 2.4, 3.0).rgb
           + textureLod(uBright, bs - vec2(o.x, 0.0) * 2.4, 3.0).rgb
           + textureLod(uBright, bs + vec2(0.0, o.y) * 2.4, 3.0).rgb
           + textureLod(uBright, bs - vec2(0.0, o.y) * 2.4, 3.0).rgb;
  vec3 b = textureLod(uBright, bs, 1.0).rgb * 0.3 + wide * 0.12 + far * 0.1;
  c += b * 0.9;
  float rays = textureLod(uBright, bs, 1.5).a;
  vec3 sunCol = vec3(1.0, 0.82, 0.62);
  c += sunCol * pow(rays, 1.35) * 0.42;
  vec2 sunS = (uSun - uRect.xy) / uRect.zw;
  vec2 ds = (vS - sunS) * vec2(uAspect, 1.0);
  float r2 = dot(ds, ds);
  c += sunCol * (0.3 * exp(-r2 * 7.0) + 0.05 * exp(-r2 * 1.6));

  // THE LENS: exposure up from black, a soft shoulder on what the light
  // added, the vignette, then the grain.
  c *= uExposure;
  c = mix(c, 1.0 - exp(-c * 1.25) * 0.94 - 0.06 * (1.0 - exp(-c * 6.0)), smoothstep(0.75, 1.6, c));
  float v = dot(fromMid * vec2(uAspect * 0.8, 1.0), fromMid * vec2(uAspect * 0.8, 1.0));
  c *= mix(1.0, 0.8, smoothstep(0.12, 0.8, v));
  vec3 outC = colourspace(c);
  // A touch of print contrast in display space, so the haze of the light
  // added over the plate does not lift its shadows to milk.
  outC = mix(outC, outC * outC * (3.0 - 2.0 * outC), 0.22);
  float grain = hash12(gl_FragCoord.xy + vec2(uFrame * 7.13, uFrame * 3.71)) - 0.5;
  outC += grain * 0.035 * (1.0 - 0.6 * luma(outC)) * uExposure;
  outColour = vec4(outC, 1.0);
}`;

/** The particles: snow in three depths and the spray's grains, every one a
 * pure function of its index and the clock. */
export const PARTICLE_VS = /* glsl */ `#version 300 es
precision highp float;
uniform float uT;
uniform vec3 uLayers;   // where each snow layer ends, by index; spray after
uniform float uTotal;
uniform vec4 uRect;
uniform vec2 uPar;
uniform vec2 uSun;      // plate UV
uniform vec3 uSpray;    // the spray's centre (UV) and radius
uniform vec2 uSubject;
uniform vec2 uViewport; // px
uniform float uRatio;   // CSS px to canvas px
uniform float uExposure;
out vec4 vColour;
out float vSoft;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
vec2 toScreen(vec2 uv) { return (uv - uRect.xy) / uRect.zw; }

void main() {
  float i = float(gl_VertexID);
  float h1 = hash11(i * 1.13 + 0.7);
  float h2 = hash11(i * 2.71 + 3.1);
  float h3 = hash11(i * 5.37 + 9.4);
  float h4 = hash11(i * 7.91 + 1.9);
  vec2 s;
  float size;
  float alpha;
  vec3 col = vec3(0.93, 0.96, 1.0);
  vSoft = 1.0;
  vec2 sunS = toScreen(uSun);
  if (i < uLayers.z) {
    // THE FALLING SNOW: far, middle, near — slower, smaller and fainter the
    // further, slid by the lens's parallax by their depth, swaying on the
    // wind and blowing a little to the left.
    float layer = i < uLayers.x ? 0.0 : (i < uLayers.y ? 1.0 : 2.0);
    float fall = mix(0.03, 0.12, layer / 2.0) * (0.75 + 0.5 * h3);
    float wind = mix(-0.012, -0.045, layer / 2.0);
    float sway = sin(uT * (0.6 + h4) + h1 * 6.28) * mix(0.004, 0.018, layer / 2.0);
    float depth = mix(0.3, -1.2, layer / 2.0);
    s.x = fract(h1 + wind * uT + sway - uPar.x / uRect.z * depth * 3.0);
    s.y = fract(h2 + fall * uT - uPar.y / uRect.w * depth * 3.0);
    s = s * 1.1 - 0.05;
    size = mix(1.3, 2.1, h4);
    size *= layer == 0.0 ? 1.0 : (layer == 1.0 ? 1.7 : 4.2 + 3.0 * h3);
    alpha = layer == 0.0 ? 0.4 : (layer == 1.0 ? 0.55 : 0.22);
    vSoft = layer == 2.0 ? 2.2 : 1.0;
    // Backlit: a flake against the sun's side of the sky lights up.
    float near = exp(-dot((s - sunS) * vec2(uViewport.x / uViewport.y, 1.0),
                          (s - sunS) * vec2(uViewport.x / uViewport.y, 1.0)) * 1.4);
    col = mix(col, vec3(1.0, 0.9, 0.78), near);
    alpha *= 1.0 + 1.4 * near;
  } else {
    // THE SPRAY'S GRAINS: born across the frozen spray, nearer the ski than
    // its crown, thrown on outward from the ski, slowed by the air, settling
    // and drifting downwind, faded in and out over a life of their own.
    float life = 2.4 + 0.8 * h4;
    float cyc = uT / life + h1;
    float age = fract(cyc) * life;
    float k = floor(cyc);
    float r1 = hash11(i * 3.3 + k * 1.7);
    float r2 = hash11(i * 6.1 + k * 2.9);
    vec2 toSki = normalize(uSubject - uSpray.xy);
    vec2 ski = uSpray.xy + toSki * uSpray.z * 0.85;
    float a = r1 * 6.2832;
    vec2 born = uSpray.xy + vec2(cos(a), sin(a)) * sqrt(r2) * uSpray.z * 0.62;
    born = mix(born, ski, 0.25 * r2);
    vec2 out1 = normalize(born - ski + 1e-4);
    float push = 0.018 * (1.0 - exp(-age * 1.4)) / 1.4;
    vec2 uv = born + out1 * push + vec2(-0.006, 0.0) * age + vec2(0.0, 0.0045) * age * age;
    s = toScreen(uv);
    float fade = smoothstep(0.0, 0.35, age) * (1.0 - smoothstep(life * 0.55, life, age));
    size = mix(1.2, 3.0, h3 * h3);
    alpha = 0.75 * fade;
    col = vec3(1.0, 0.94, 0.86);
  }
  gl_Position = vec4(s.x * 2.0 - 1.0, 1.0 - s.y * 2.0, 0.0, 1.0);
  gl_PointSize = size * uRatio;
  vColour = vec4(col * alpha * uExposure, 1.0);
}`;

export const PARTICLE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec4 vColour;
in float vSoft;
out vec4 outColour;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = pow(clamp(1.0 - r, 0.0, 1.0), vSoft);
  outColour = vec4(vColour.rgb * a, 0.0);
}`;
