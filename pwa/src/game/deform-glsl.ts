// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEFORMABLE SNOW'S OWN SHADOWS, as the ground's fragment reads them:
// its walls, berms and crater rims stand in the sun's way, so the key is
// marched toward the sun over the field — the ray's rise over the slope
// against the snow's relief (`trailRelief`, the field inside its window,
// `deform-field.ts`) — and a low sun leaves a cut's sunward wall and a
// crater's floor in shade. The march is the TRAILS stop's (`uDeformMarch`:
// MEDIUM a few long steps to half a metre, HIGH fourteen fine ones to a
// metre and a half); the snow's own micro-relief beyond it is
// `snow-sky-glsl.ts`'s. Read after `TRAIL_GLSL`; 1 outside the window.

export const DEFORM_SHADE_GLSL = /* glsl */ `
float deformSelf(vec2 p, vec3 sun, vec2 slope, float dist) {
  float w = deformWeight(p);
  vec2 sl = sun.xz;
  float slh = length(sl);
  if (w <= 0.0 || sun.y <= 0.0 || slh < 1e-3 || dist >= 60.0) return 1.0;
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
  return mix(1.0, lit, w * (1.0 - smoothstep(35.0, 60.0, dist)));
}
`;
