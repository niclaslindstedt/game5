// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEFORMABLE SNOW'S OWN SHADOWS: its walls, berms and crater rims stand
// in the sun's way, so the key is marched toward the sun over the field —
// the ray's rise over the slope against the snow's relief (`trailRelief`,
// the field inside its window, `deform-field.ts`) — and a low sun leaves a
// cut's sunward wall and a crater's floor in shade. The march is the TRAILS
// stop's (`uDeformMarch`: MEDIUM a few long steps to half a metre, HIGH
// fourteen fine ones to a metre and a half); the snow's own micro-relief
// beyond it is `snow-sky-glsl.ts`'s.
//
// It depends on nothing a pixel has that the field's cell under it does not
// — the field, the trail map, the ground's slope, the sun — so it is marched
// once a cell (`deform-shade.ts`, `DEFORM_MARCH_GLSL`) into the alpha of the
// field the ground reads, and the ground takes it filtered
// (`DEFORM_SHADE_GLSL`): fourteen reads of the relief a pixel were the
// window's dearest part.

/** The march itself, at a point of the field: 1 lit, 0 in the field's own
 * shade. Read after `TRAIL_GLSL`. */
export const DEFORM_MARCH_GLSL = /* glsl */ `
float deformMarch(vec2 p, vec3 sun, vec2 slope) {
  vec2 sl = sun.xz;
  float slh = length(sl);
  if (sun.y <= 0.0 || slh < 1e-3) return 1.0;
  sl /= slh;
  // How fast the ray toward the sun climbs over the ground's own slope.
  float rise = sun.y / slh - dot(slope, sl);
  float h0 = trailRelief(p);
  float lit = 1.0;
  float st = uDeformBox.w * 0.75;
  for (int i = 0; i < 14; i++) {
    if (float(i) >= uDeformMarch.x) break;
    float clear = h0 + rise * st - trailRelief(p + sl * st);
    // A soft edge that widens with the distance to the occluder.
    float pen = 0.003 + 0.04 * st;
    lit = min(lit, smoothstep(-pen, pen, clear));
    st *= uDeformMarch.y;
  }
  return lit;
}
`;

/** The ground's read of it: the cell's march, filtered, faded out with the
 * window's edge and the distance; 1 outside the window. Read after
 * `TRAIL_GLSL`. */
export const DEFORM_SHADE_GLSL = /* glsl */ `
float deformSelf(vec2 p, vec3 sun, float dist) {
  float w = deformWeight(p);
  if (w <= 0.0 || sun.y <= 0.0 || dist >= 60.0) return 1.0;
  float lit = textureLod(uDeform, p / uDeformSpan + 0.5 * uDeformBox.w / uDeformSpan, 0.0).a;
  return mix(1.0, lit, w * (1.0 - smoothstep(35.0, 60.0, dist)));
}
`;
