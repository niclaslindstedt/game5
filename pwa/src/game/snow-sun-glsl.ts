// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUN ON THE SNOW, past what the material gathers: the wrap's blue
// terminator, the glitter (two sizes of crystal cell, by the snow's age) and
// the forward GLARE off a crust, wet snow, the groomer and ice. Spliced into
// `snow-glsl.ts`'s light chunk, last.

/** How bright the sun's forward glare off the snow is drawn, over the key's
 * own light: set by looking into the sun (`make snow ARGS=--sheet=sun`). */
export const SUN_GLARE = 0.6;

/** The light chunk's last part: the key's own terms. */
export const SNOW_SUN_LIGHT = /* glsl */ `
#if NUM_DIR_LIGHTS > 0
{
  vec3 sunLit = directLight.color * snowSelf;
  float ndl = dot(snowN, uSunDir);
  // Wrap: what the terminator gains, tinted the blue of light that has been
  // through a few centimetres of ice.
  float wrap = (max(0.0, (ndl + 0.45) / 1.45) - max(ndl, 0.0)) * (1.0 - 0.7 * uFlat);
  reflectedLight.directDiffuse +=
    BRDF_Lambert(diffuseColor.rgb) * sunLit * wrap * vec3(0.55, 0.78, 1.0) * 0.9;

  // THE GLITTER, two sizes of crystal cell: the fine one close in, a
  // sparser, larger one carrying it a little further out.
  // No crystal is drawn past 140 m, nor on a sky that does not glitter.
  if (snowDist < 140.0 && uGlitter > 0.0 && uSnowSkip.z < 0.5) {
    vec3 V = normalize(cameraPosition - vSnowWorld);
    vec3 H = normalize(uSunDir + V);
    float loose = (1.0 - snowPacked * 0.8) * (1.0 - snowPress * 0.6) * (1.0 - snowIce) * (1.0 - snowRock);
    // THE GRAINS BY AGE: new snow's crystals a dense dust of fine points;
    // old snow's rounded into fewer, coarser grains — the fine layer thinned,
    // the coarse one fuller and brought in close; a crust's and wet snow's
    // glazed over; and HOAR's feathers the biggest, brightest flashes of all,
    // facing every way.
    float keepFine = 0.6 * (1.0 + 0.45 * snowNew + 0.5 * snowHoar) * (1.0 - 0.55 * snowOld);
    float keepCoarse = mix(0.35, 0.6, max(snowOld, snowHoar));
    float near = mix(8.0, 1.5, max(snowOld, snowHoar));
    float glaze = (1.0 - 0.6 * snowSunCrust) * (1.0 - 0.85 * snowWet);
    float glint = 0.0;
    if (snowDist < 45.0) {
      glint += snowGlints(vSnowWorld, 7.0, mix(600.0, 320.0, snowNew), keepFine, snowN, H, 0.0)
        * (1.0 - smoothstep(15.0, 45.0, snowDist)) * (1.0 + 0.3 * snowNew + 1.5 * snowHoar);
    }
    if (snowDist > near) {
      glint += snowGlints(vSnowWorld, 2.5, mix(900.0, 140.0, snowHoar), mix(keepCoarse, 0.9, snowHoar), snowN, H, 31.0)
        * smoothstep(near, near + 17.0, snowDist) * (1.0 - smoothstep(50.0, 140.0 + 60.0 * snowHoar, snowDist))
        * (1.0 + 0.6 * snowOld + 4.0 * snowHoar);
    }
    // IN THE SUN'S OWN COLOUR: a crystal returns the light that reached it,
    // so under a low sun it flashes gold, not white. Its flare is eased
    // toward the clip the warmer the sun is — the tone curve whitens any
    // channel driven far past it — and its hue taken a little further, as
    // the eye sees a point of a warm sun against snow lit by the blue sky.
    float sunMax = max(max(sunLit.r, sunLit.g), max(sunLit.b, 1e-4));
    vec3 sunTint = sunLit / sunMax;
    float warmth = clamp(1.0 - sunTint.b / max(sunTint.r, 1e-4), 0.0, 1.0);
    float flare = sunMax * glint * loose * glaze * 18.0 * uGlitter;
    flare = mix(flare, flare / (1.0 + flare / 2.5), warmth);
    reflectedLight.directSpecular += pow(sunTint, vec3(1.0 + 1.5 * warmth)) * flare;
  }

  // THE GLARE: the sun scattered forward off the snow, the brighter the
  // more grazing the look. Powder spreads it into a broad sheen; a crust,
  // wet snow, the polished groomer and ice gather it into a hard streak
  // toward the sun. Its own lobe over the material's GGX, which at snow's
  // roughness all but loses it. Under a lid there is no sun to glare.
  if (uSnowSkip.z < 0.5) {
    vec3 V = normalize(cameraPosition - vSnowWorld);
    float rv = max(dot(reflect(-uSunDir, snowN), V), 0.0);
    float gloss = clamp(0.3 * snowPacked + 0.85 * snowSunCrust + 0.55 * snowWet
      + 0.3 * snowScour + 0.9 * snowIce, 0.0, 1.0) * (1.0 - snowRock);
    float k = mix(6.0, 140.0, gloss * gloss);
    float graze = 1.0 - max(dot(snowN, V), 0.0);
    graze *= graze;
    float lobe = pow(rv, k) * (0.25 + 2.5 * gloss * gloss) * (0.15 + 1.6 * graze);
    reflectedLight.directSpecular += sunLit * lobe * ${SUN_GLARE.toFixed(3)} * (1.0 - 0.8 * snowNew * (1.0 - gloss));
  }
}
#endif`;
