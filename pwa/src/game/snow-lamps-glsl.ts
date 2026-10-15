// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LAMPS ON THE SNOW: every slot's beam (`haze.ts`'s `lampReach`) and
// the piste lights' bake (`pisteLight`) lighting the snow by its own normal,
// and the crystals glinting toward each lamp. Spliced into `snow-glsl.ts`'s
// light chunk.

import { LAMP_SLOTS } from "./haze.ts";

/** In the light chunk, after the sky's light and the flat light. */
export const SNOW_LAMPS_LIGHT = /* glsl */ `
{
  vec3 V = normalize(cameraPosition - vSnowWorld);
  float loose = (1.0 - snowPacked * 0.8) * (1.0 - snowPress * 0.6) * (1.0 - snowIce) * (1.0 - snowRock);
  vec3 lampLit = vec3(0.0);
  vec3 lampGlint = vec3(0.0);
  // THE LAMPS' CRYSTALS: every lamp glints off the same cells (one seed),
  // so a cell's facet and its spot are found once, and each lamp pays only
  // its own highlight — \`snowGlints\` lamp by lamp, without its hashes
  // done six times over a pixel. The footprint is read out here, where
  // every pixel of the quad still runs it. LAMPS LOW draws none of them
  // (\`uLampGlint\`): the beams light the snow and no crystal flares.
  vec3 lgQ = vSnowWorld * 7.0;
  float lgRad = max(0.14, length(fwidth(lgQ)) * 0.75);
  float lgK = 0.14 / lgRad;
  vec3 lgFacet = vec3(0.0);
  float lgSpot = 0.0;
  if (uLampOn[0] > 0.0 && uLampGlint > 0.0 && snowDist < 40.0) {
    vec3 lgCell = floor(lgQ);
    vec3 lgR = snowHash3(lgCell + 57.0);
    if (lgR.z <= 0.6) {
      lgFacet = normalize(snowN + (snowHash3(lgCell + 57.0 + 7.13) * 2.0 - 1.0) * 0.6);
      vec3 f = fract(lgQ) - (0.2 + 0.6 * lgR);
      lgSpot = 1.0 - smoothstep(lgRad * 0.45, lgRad, length(f));
    }
  }
  for (int i = 0; i < ${LAMP_SLOTS}; i++) {
    if (uLampOn[i] <= 0.0) break;
    if (uLampOn[i] <= 0.001) continue;
    vec3 L = uLampPos[i] - vSnowWorld;
    float d = length(L);
    L /= max(d, 1e-3);
    float e = lampReach(i, L, d);
    // Outside its beam a lamp adds nothing, and is not asked to.
    if (e <= 0.0) continue;
    lampLit += uLampCol[i] * (e * max(dot(snowN, L), 0.0));
    if (lgSpot > 0.0) {
      vec3 H = normalize(L + V);
      float g = pow(max(dot(lgFacet, H), 0.0), 600.0);
      lampGlint += uLampCol[i] * (e * (g * lgSpot * lgK * lgK));
    }
  }
  // THE PISTE LIGHTS, baked: a lit run's snow glitters toward its masts.
  if (uPisteOn.x > 0.0) {
    vec3 pv = pisteLight(vSnowWorld);
    float pe = length(pv);
    if (pe > 1e-4) {
      lampLit += uPisteCol * max(dot(snowN, pv), 0.0);
      if (snowDist < 40.0 && uLampGlint > 0.0) {
        vec3 H = normalize(pv / pe + V);
        lampGlint += uPisteCol * (pe * snowGlints(vSnowWorld, 7.0, 600.0, 0.6, snowN, H, 83.0));
      }
    }
  }
  reflectedLight.directDiffuse += BRDF_Lambert(diffuseColor.rgb) * lampLit * 9.0;
  reflectedLight.directSpecular += lampGlint * loose
    * (1.0 - smoothstep(12.0, 40.0, snowDist)) * 12.0;
}`;
