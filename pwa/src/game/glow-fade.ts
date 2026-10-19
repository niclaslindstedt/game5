// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A LAMP'S GLOW FADED INTO THE AIR. The glows (`glow-sprite.ts`) are
// additive sprites and points drawn with three's fog off, so nothing in
// them knew the weather: a strip's edge lamps kilometres off still shone
// through a storm that hides the ground forty metres away, and a point a
// fraction of a pixel wide shimmered as it fell between pixels. This graft
// gives any glow material the ground's own law — the air in front of it
// (`hazeAir`) and the DISTANCE row's mist (`hazeMist`) take its light away
// as they take the snow behind it — and holds a glow POINT at least
// `MIN_PX` device pixels across, its light spread thinner over the extra,
// so a far lamp is a steady dot or nothing, never a flicker. A mark that
// is thinner than a pixel long before the air takes it (a boarding ring's
// band) is given a REACH as well, past which it is gone.

import * as THREE from "three";

import { HAZE_AMOUNT_GLSL, type HazeUniforms } from "./haze.ts";

/** The fewest device pixels a glow point is drawn across. */
export const MIN_PX = 2.5;

/** A lamp carries a little further through the air than the ground lit by
 * daylight does: its share left is the air's raised to this. */
export const CARRY = 0.7;

const UNIFORMS = /* glsl */ `
uniform float uHaze;
uniform float uHazeLift;
uniform float uHazeFloor;
uniform float uMist;
uniform float uMistAloft;
uniform float uMistOpen;
varying float vGlowFade;
${HAZE_AMOUNT_GLSL}
`;

/** How a glow fades: `reach`, m, the distance it is gone by (faded out
 * over its last third), none when the air alone may take it. */
export type GlowFade = { reach?: number };

/** Fade `material` (a glow's points, sprite or unlit mesh) into the haze
 * `u` along its distance from the lens. */
export function fadeGlow<
  M extends THREE.PointsMaterial | THREE.SpriteMaterial | THREE.MeshBasicMaterial,
>(material: M, u: HazeUniforms, how: GlowFade = {}): M {
  const points = material instanceof THREE.PointsMaterial;
  const reach = how.reach ?? 0;
  const key = `glow-fade:${points ? "points" : "flat"}:${reach}`;
  material.customProgramCacheKey = (): string => key;
  // What the node renderer's copy fades by (`glow-tsl.ts`), which drops this graft.
  material.userData.glowFade = how;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uHaze: u.uHaze,
      uHazeLift: u.uHazeLift,
      uHazeFloor: u.uHazeFloor,
      uMist: u.uMist,
      uMistAloft: u.uMistAloft,
      uMistOpen: u.uMistOpen,
    });
    // The lens is where the view's own frame puts it: the world point is
    // the view-space one turned back through the view's rotation.
    const fade = /* glsl */ `
      vec3 gfWorld = (mvPosition.xyz - viewMatrix[3].xyz) * mat3(viewMatrix);
      float gfDist = length(mvPosition.xyz);
      float gfRise = gfWorld.y - cameraPosition.y;
      vGlowFade = pow(1.0 - hazeAir(gfDist, gfRise), ${CARRY.toFixed(2)})
        * (1.0 - hazeMist(gfDist, gfRise));
      ${reach > 0 ? `vGlowFade *= 1.0 - smoothstep(${((reach * 2) / 3).toFixed(1)}, ${reach.toFixed(1)}, gfDist);` : ""}
    `;
    const hold = points
      ? /* glsl */ `
      float gfPx = gl_PointSize;
      gl_PointSize = max(gl_PointSize, ${MIN_PX.toFixed(1)});
      vGlowFade *= gfPx / gl_PointSize;
    `
      : "";
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${UNIFORMS}`)
      .replace("#include <fog_vertex>", `#include <fog_vertex>\n${fade}${hold}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGlowFade;")
      .replace(
        "#include <fog_fragment>",
        "#include <fog_fragment>\n  if (vGlowFade <= 0.003) discard;\n  gl_FragColor.a *= vGlowFade;",
      );
  };
  return material;
}
