// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POLICE MACHINE'S LIVERY, laid over the air ambulance's model in code
// (`heli-view.ts`' `HeliLook.livery`) until the police machine has a model
// of its own: the skin dark blue, the cowling, the fins and the blade tips
// white, a white cheat line, and the band low along the cabin and up the
// boom a CHEQUER of blue and fluorescent yellow — the high-visibility
// pattern police vehicles carry. The model has no texture coordinates, so
// the chequer is cut in the shader off the model's own frame, square cells
// along its length and up its side. The materials are named as
// `scripts/blender/rescue.py` names them.

import * as THREE from "three";

/** The colours, by the model's material names (sRGB). */
export const POLICE_COLOURS: Readonly<Record<string, number>> = {
  trim: 0x16264f,
  paint: 0xe9ecef,
  stripe: 0xf2f4f5,
  mark_white: 0xf2f4f5,
  emblem: 0x16264f,
};

/** The chequer's two colours (sRGB) and its cell, m. */
const CHEQUER = { blue: 0x1b3f9c, yellow: 0xd8f21c, cell: 0.17 } as const;

const blue = new THREE.Color(CHEQUER.blue);
const yellow = new THREE.Color(CHEQUER.yellow);

/** The chequer grafted into a material's shader, after its own colour. */
function chequer(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.uniforms.uChqA = { value: blue };
  shader.uniforms.uChqB = { value: yellow };
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vLivery;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLivery = position;");
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      "#include <common>\nvarying vec3 vLivery;\nuniform vec3 uChqA;\nuniform vec3 uChqB;",
    )
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      {
        vec2 cell = floor(vLivery.zy / ${CHEQUER.cell.toFixed(3)});
        float k = mod(cell.x + cell.y, 2.0);
        diffuseColor.rgb = mix(uChqA, uChqB, k);
      }`,
    );
}

/** THE LIVERY over one of the model's materials: repainted by its name,
 * the band handed the chequer. */
export function policeLivery(
  m: THREE.MeshStandardMaterial,
): ((shader: THREE.WebGLProgramParametersWithUniforms) => void) | void {
  const hex = POLICE_COLOURS[m.name];
  if (hex !== undefined) m.color.setHex(hex);
  if (m.name === "band") {
    m.color.setHex(0xffffff);
    return chequer;
  }
}
