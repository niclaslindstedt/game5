// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The snow shader's small helpers (`snow-glsl.ts`): the hashes and the
// value noise its relief and its crust are made of, and the glints its
// crystals flare in.

export const SNOW_NOISE_GLSL = /* glsl */ `
vec3 snowHash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float snowHash1(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float snowNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(snowHash1(i), snowHash1(i + vec2(1, 0)), u.x),
             mix(snowHash1(i + vec2(0, 1)), snowHash1(i + vec2(1, 1)), u.x), u.y);
}
// The gradient of value noise, ANALYTIC: one cell's four hashes and the
// smoothstep's own slope, where a finite difference paid sixteen — the
// micro-relief calls it a dozen times a pixel and the ground is most of a
// phone's frame. \`e\` was that difference's half step; it is kept as the
// width the gradient is softened over (a box of 2e is about a slope cut by
// 1 - 2e² at the cell's own scale), so each octave keeps the strength it
// was tuned at.
vec2 snowNoiseGrad(vec2 p, float e) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 du = 6.0 * f * (1.0 - f);
  float a = snowHash1(i);
  float b = snowHash1(i + vec2(1, 0));
  float c = snowHash1(i + vec2(0, 1));
  float d = snowHash1(i + vec2(1, 1));
  float k = a - b - c + d;
  return du * vec2(b - a + k * u.y, c - a + k * u.x) * (1.0 - 2.0 * e * e);
}
`;

export const SNOW_GLINTS_GLSL = /* glsl */ `
// ONE LAYER OF CRYSTALS: a cell of world space holds at most one, at a
// random place in it with a random facet; it flares when that facet lines
// the sun up with the eye. Drawn as a POINT — a disc at least a pixel
// across, its brightness scaled down as it is widened — rather than as the
// whole cell, which reads as confetti.
float snowGlints(vec3 wp, float scale, float sharp, float keep, vec3 N, vec3 H, float seed) {
  vec3 q = wp * scale;
  vec3 cell = floor(q);
  vec3 r = snowHash3(cell + seed);
  if (r.z > keep) return 0.0;
  vec3 facet = normalize(N + (snowHash3(cell + seed + 7.13) * 2.0 - 1.0) * 0.6);
  float g = pow(max(dot(facet, H), 0.0), sharp);
  vec3 f = fract(q) - (0.2 + 0.6 * r);
  float rad = max(0.14, length(fwidth(q)) * 0.75);
  float spot = 1.0 - smoothstep(rad * 0.45, rad, length(f));
  float k = 0.14 / rad;
  return g * spot * k * k;
}
`;
