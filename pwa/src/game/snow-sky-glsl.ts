// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY ON THE SNOW — what the snow takes from the sky beyond three's
// one key and its two-colour hemisphere, spliced into the terrain's shader
// by `snow-glsl.ts` (its pars and the head of its light chunk).
//
// Snow is a near-white scatterer: it hands back almost all the light it is
// given, in the colour it was given it. So the colour of snow IS the colour
// of the light on it, and three lights reach it —
//
//   * THE SKY (`skyIrradiance`, `sky-light.ts`): the whole sphere round it.
//     A face turned from a low sun takes only the sky over it — the deep blue
//     of the zenith and, after sunset, the Belt's pink low in the east — and
//     a face turned to the sun the warm glow round it; three's hemisphere
//     knew only up and down. Under a lid the sky is a grey with no direction
//     but up, and so is this (`sky.ts`).
//   * THE SUN, low and warm through the long air of a winter morning or
//     evening, and grazing: every swell, every drift and every track's wall
//     throws a SHADOW many times its own height long. Those are far finer
//     than the shadow map's texels, so they are marched here, toward the
//     key along the snow's own micro-relief (`snowBumpLit`): the swells, the
//     skied-in heaps, the grain and the trail map's grooves and windrows.
//     The penumbra widens with the distance to what casts it, as a sun of
//     half a degree draws it.
//   * THE SUN THROUGH THE SNOW: a thin edge — a track's wall, the groomer's
//     windrow, a crown's lip — seen against the sun lets some of it through,
//     scattered many times on its way and so tinted the blue of ice (ice
//     absorbs the red a little more than the blue over centimetres). It
//     glows when the eye looks toward the sun past it (`SNOW_SKY_LIGHT`).

/** The functions the light chunk calls — appended to the snow's fragment
 * pars, after the noise, the trail map and the snow's globals. */
export const SNOW_SKY_PARS = /* glsl */ `
// THE SNOW'S MICRO-RELIEF as a height, m: the same swells, heaps, grain and
// trail relief the sample chunk bends the normal by (its weights at the
// shaded point stand in for the casters').
float snowBumpHeight(vec2 q, float swell, float chop, float grain) {
  float h = trailRelief(q);
  if (swell > 0.0) h += 0.35 * swell * snowNoise(q * 0.23);
  if (chop > 0.0) h += 0.32 * chop * snowNoise(q * 0.38 + 13.7);
  if (grain > 0.0) h += 0.035 * grain * snowNoise(q * 1.7);
  return h;
}
// THE SHADOWS OF THE BUMPS: marched toward the key along the snow, eight
// steps from a hand to a dozen metres out, against the plane of the ground
// under the point (\`macro\`, its gradient) — 1 lit, 0 in a bump's shadow.
float snowBumpLit(vec2 p, vec3 L, vec2 macro, float swell, float chop, float grain) {
  float run = length(L.xz);
  if (run < 1e-3) return 1.0;
  vec2 u = L.xz / run;
  // How fast the sun's ray climbs off the ground's plane, per metre across.
  float rise = L.y / run - dot(macro, u);
  if (rise <= 0.0 || rise > 1.6) return 1.0;
  float h0 = snowBumpHeight(p, swell, chop, grain);
  float lit = 1.0;
  float d = 0.15;
  for (int i = 0; i < 8; i++) {
    float above = h0 + d * rise - snowBumpHeight(p + u * d, swell, chop, grain);
    float soft = 0.012 + 0.012 * d;
    lit = min(lit, smoothstep(-soft, soft, above));
    d *= 1.85;
  }
  return lit;
}
`;

/** The head of the snow's light chunk: the sky's light on the snow's own
 * normal in place of the hemisphere's, the bumps' shadows on the key, and
 * the light through the thin edges. */
export const SNOW_SKY_LIGHT = /* glsl */ `
{
  // THE SKY, by direction: replaces three's hemisphere outright (the
  // harmonics carry its night glow and, under a lid, its grey).
  reflectedLight.indirectDiffuse = skyIrradiance(snowN) * BRDF_Lambert(diffuseColor.rgb);
}
#if NUM_DIR_LIGHTS > 0
{
  vec3 keyLit = directLight.color;
  float fade = 1.0 - smoothstep(70.0, 130.0, snowDist);
  if (fade > 0.0 && dot(keyLit, keyLit) > 1e-8 && uSnowSkip.x < 0.5) {
    vec2 bp = vSnowWorld.xz;
    vec2 bguv = (bp - uHeightOrigin + 0.5 * uCell) / (uHeightCount * uCell);
    vec2 macro = texture2D(uGround, bguv).rg;
    float swell = (1.0 - snowPacked) * (1.0 - smoothstep(60.0, 400.0, snowDist));
    float grain = (1.0 - 0.4 * snowNew) * (1.0 - smoothstep(20.0, 90.0, snowDist));
    float bump = mix(1.0, snowBumpLit(bp, uSunDir, macro, swell, snowChop, grain), fade);
    reflectedLight.directDiffuse *= bump;
    reflectedLight.directSpecular *= bump;
    directLight.color *= bump;
  }
  // THE LIGHT THROUGH A THIN EDGE, looked at against the key.
  float thin = max(max(snowWall * (1.0 - 0.6 * snowPacked), snowBerm), snowSlideWall)
    * (1.0 - snowIce) * (1.0 - snowRock) * (1.0 - smoothstep(30.0, 80.0, snowDist));
  if (thin > 0.0) {
    vec3 V = normalize(cameraPosition - vSnowWorld);
    float back = pow(max(dot(-V, uSunDir), 0.0), 3.0);
    float away = 1.0 - smoothstep(-0.25, 0.35, dot(snowN, uSunDir));
    reflectedLight.directDiffuse += BRDF_Lambert(diffuseColor.rgb) * keyLit
      * vec3(0.5, 0.78, 1.0) * (0.55 * thin * back * away);
  }
}
#endif
`;
