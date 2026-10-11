// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AVALANCHE IN THE SNOW'S SHADER — the bed surface lowered behind the
// crown and between the flanks, and the debris raised and broken into
// blocks where the flow came to rest (`avalanche-view.ts` fills the
// uniforms, `avalanche-plan.ts` decides every number). The ground's mesh
// (`snow-glsl.ts`) is lowered and raised by `slideAt`, the per-pixel normal
// takes its slope, and the colour reads which it is: the bed a smoother,
// greyer old surface scored down the fall line, the crown's wall banded by
// the slab's layers, the debris a jumble of white blocks with shade in
// every gap and a fleck of dirt or wood here and there.
//
// The uniforms ride the shared haze object (`haze.ts`), which every world
// material already carries; with `uSlideOn` nought nothing here costs more
// than a branch.

import { SLIDE_LOOK } from "./avalanche-plan.ts";

const f = (n: number): string => n.toFixed(4);
const C = SLIDE_LOOK.crown;
const F = SLIDE_LOOK.flank;
const B = SLIDE_LOOK.bed;

/** Declarations and the reads, for both halves of the snow's shader. */
export const SLIDE_GLSL = /* glsl */ `
uniform vec4 uSlab0;     // crown's middle x, z; fall line fx, fz
uniform vec4 uSlab1;     // left, right, length, depth (m)
uniform vec4 uSlabJog;   // the crown's and flanks' phases
uniform vec4 uSlideBox;  // the debris map's corner u0, v0 and span u, v (m)
uniform vec4 uSlideOn;   // x: a slab drawn, y: debris drawn
uniform sampler2D uSlide;

vec2 slideFrame(vec2 p) {
  vec2 d = p - uSlab0.xy;
  return vec2(d.x * uSlab0.w - d.y * uSlab0.z, d.x * uSlab0.z + d.y * uSlab0.w);
}
// THE BED (\`avalanche-plan.ts\`'s \`bedDepth\`, line for line).
float slideBed(vec2 uv) {
  float u = uv.x;
  float v = uv.y;
  float top = ${f(C.jog[0])} * sin(u * ${f(C.wave[0])} + uSlabJog.x)
            + ${f(C.jog[1])} * sin(u * ${f(C.wave[1])} + uSlabJog.y);
  if (v < top || v > uSlab1.z) return 0.0;
  float left = uSlab1.x + ${f(F.ragged)} * sin(v * ${f(F.wave)} + uSlabJog.z);
  float right = uSlab1.y + ${f(F.ragged)} * sin(v * ${f(F.wave * 1.3)} + uSlabJog.w);
  if (u > left || u < -right) return 0.0;
  float edge = min(left - u, u + right);
  float t = clamp((v - top) / uSlab1.z, 0.0, 1.0);
  return uSlab1.w * (1.0 - ${f(B.thin)} * t)
    * (${f(F.lowShare)} + ${f(1 - F.lowShare)} * smoothstep(0.0, ${f(F.low)}, edge))
    * (1.0 - smoothstep(uSlab1.z - ${f(B.toe)}, uSlab1.z, v));
}
float slideDebris(vec2 uv) {
  if (uSlideOn.y <= 0.0) return 0.0;
  vec2 q = (uv - uSlideBox.xy) / uSlideBox.zw;
  if (q.x <= 0.0 || q.y <= 0.0 || q.x >= 1.0 || q.y >= 1.0) return 0.0;
  return textureLod(uSlide, q, 0.0).r;
}
// The snow's height off the old surface here, m: the bed below it, the
// debris above it.
float slideAt(vec2 p) {
  if (uSlideOn.x <= 0.0) return 0.0;
  vec2 uv = slideFrame(p);
  return slideDebris(uv) - slideBed(uv);
}
`;

/** In the fragment half's sample, beside the tree wells: the slope of the
 * slide's surface onto the normal, and what it is here. Needs `p`,
 * `grad`, `snowDist`. Writes `snowSlide` (m off the old surface),
 * `snowBed` (0..1 the bed's share), `snowDebris` (m), `snowSlideWall` (0..1 on the crown's or a flank's wall). */
export const SLIDE_NORMAL = /* glsl */ `
  snowSlide = 0.0;
  snowBed = 0.0;
  snowDebris = 0.0;
  snowSlideWall = 0.0;
  if (uSlideOn.x > 0.0) {
    vec2 suv = slideFrame(p);
    float bed = slideBed(suv);
    snowDebris = slideDebris(suv);
    snowSlide = snowDebris - bed;
    snowBed = bed > 0.0 ? clamp(1.0 - snowDebris / 0.35, 0.0, 1.0) : 0.0;
    if (snowDist < 400.0 && (bed > 0.0 || snowDebris > 0.0 || abs(suv.x) < uSlab1.x + uSlab1.y + 4.0)) {
      float se = clamp(length(fwidth(p)) * 0.6, 0.06, 0.6);
      vec2 sg = vec2(slideAt(p + vec2(se, 0.0)) - slideAt(p - vec2(se, 0.0)),
                     slideAt(p + vec2(0.0, se)) - slideAt(p - vec2(0.0, se))) / (2.0 * se);
      // A WALL: the crown's and the flanks' steps, as steep as the mesh is fine.
      snowSlideWall = smoothstep(1.2, 3.0, length(sg));
      grad += sg;
      // THE DEBRIS: blocks and rounded balls in a jumble, each a bump with
      // a hollow between — cells a metre and a third of one across, faded
      // out before they alias.
      if (snowDebris > 0.02) {
        float k = smoothstep(0.02, 0.35, snowDebris);
        float px = length(fwidth(p));
        float a1 = 1.0 - smoothstep(0.25, 0.6, px * 0.9);
        float a2 = 1.0 - smoothstep(0.25, 0.6, px * 2.8);
        grad += slideLumpGrad(p * 0.9) * 0.9 * 0.55 * k * a1;
        grad += slideLumpGrad(p * 2.8 + 11.0) * 2.8 * 0.18 * k * a2;
        grad += snowNoiseGrad(p * 0.22 + 5.0, 0.3) * 0.22 * 0.6 * k;
      }
      // THE BED: scored down the fall line where the blocks slid.
      if (snowBed > 0.0) {
        vec2 fl = uSlab0.zw;
        vec2 ac = vec2(fl.y, -fl.x);
        vec2 q = vec2(dot(p, ac) * 1.6, dot(p, fl) * 0.05);
        vec2 g2 = snowNoiseGrad(q, 0.2);
        grad += (ac * g2.x * 1.6 + fl * g2.y * 0.05) * 0.03 * snowBed * (1.0 - smoothstep(30.0, 120.0, snowDist));
      }
    }
  }
`;

/** The lumps' field: a cell a unit across, each a rounded block with its
 * own height, the gaps between low. `slideLumps` is its height, 0..1;
 * `slideLumpGrad` its slope, by finite difference. Fragment half only. */
export const SLIDE_LUMPS = /* glsl */ `
float slideLumps(vec2 p) {
  vec2 i = floor(p);
  vec2 fr = fract(p);
  float best = 9.0;
  float second = 9.0;
  float tall = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 c = vec2(float(x), float(y));
      vec3 r = snowHash3(vec3(i + c, 3.7));
      vec2 o = c + 0.15 + 0.7 * r.xy - fr;
      float d = dot(o, o) * (0.7 + 0.6 * r.z);
      if (d < best) {
        second = best;
        best = d;
        tall = r.z;
      } else if (d < second) {
        second = d;
      }
    }
  }
  float edge = sqrt(second) - sqrt(best);
  return (0.45 + 0.55 * tall) * smoothstep(0.0, 0.45, edge);
}
vec2 slideLumpGrad(vec2 p) {
  float e = 0.08;
  return vec2(slideLumps(p + vec2(e, 0.0)) - slideLumps(p - vec2(e, 0.0)),
              slideLumps(p + vec2(0.0, e)) - slideLumps(p - vec2(0.0, e))) / (2.0 * e);
}
`;

/** In the albedo, after the tree wells: the bed, the wall's layers, the
 * debris. Needs `p`, `alb`, `vSnowWorld`. */
export const SLIDE_ALBEDO = /* glsl */ `
  if (uSlideOn.x > 0.0) {
    float px = length(fwidth(p));
    // THE BED SURFACE: the old snow the slab slid off — harder, a little
    // greyer and cooler than the new, glazed in patches.
    if (snowBed > 0.0) {
      float patchy = snowNoise(p * 0.12 + 3.0);
      alb = mix(alb, vec3(0.69, 0.75, 0.85) * (0.94 + 0.1 * patchy), 0.8 * snowBed);
    }
    // THE WALL: the slab's layers in bands, the harder ones whiter, the
    // weak layer at its foot a darker, sugary line.
    if (snowSlideWall > 0.0) {
      float warp = snowNoise(p * 0.35) * 0.12;
      float bands = 0.5 + 0.5 * sin((vSnowWorld.y + warp) * 23.0);
      vec3 wall = mix(vec3(0.8, 0.86, 0.95), vec3(0.96, 0.98, 1.0), bands);
      alb = mix(alb, wall, snowSlideWall);
    }
    // THE DEBRIS: the slab's inside turned out, whiter than the old
    // surface, a shade in every gap, and a fleck of dirt, bark or a
    // broken branch here and there.
    if (snowDebris > 0.02) {
      float k = smoothstep(0.02, 0.3, snowDebris);
      float a1 = 1.0 - smoothstep(0.3, 0.7, px * 0.9);
      float lump = slideLumps(p * 0.9);
      float gap = 1.0 - smoothstep(0.05, 0.4, lump);
      alb = mix(alb, vec3(0.97, 0.98, 1.0), 0.5 * k);
      alb *= mix(vec3(1.0), vec3(0.66, 0.74, 0.86), gap * 0.55 * k * a1);
      float a3 = 1.0 - smoothstep(0.3, 0.7, px * 4.0);
      float fleck = smoothstep(0.93, 0.985, snowNoise(p * 4.0 + 61.0));
      alb = mix(alb, vec3(0.32, 0.27, 0.22), fleck * 0.55 * k * a3);
    }
  }
`;
