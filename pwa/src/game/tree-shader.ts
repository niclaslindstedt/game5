// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREE MATERIALS — what the shader-shaped forest (`forest.ts`) draws
// its templates (`tree-templates.ts`) with: the woods' lit, hazed material
// with the shaping (`tree-glsl.ts`) put in where three would read a
// position and a normal, and the casters' depth with the same shaping, so
// every tree throws its own shadow — its tiers, its lean, its sway in the
// wind. One material a family a cut: the tables and the wind are uniforms
// every one of them shares.

import * as THREE from "three";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { createShadeDepth } from "./terrain-shade.ts";
import type { Template } from "./tree-templates.ts";
import {
  TREE_COMMON,
  TREE_DITHER,
  TREE_FRAGMENT_PARS,
  TREE_NORMAL,
  TREE_SHAPE,
  TREE_SNOW,
  TREE_BACKLIGHT,
  TREE_VERTEX_PARS,
  shaperOf,
} from "./tree-glsl.ts";

/** The uniforms every tree material reads: the two tables and the wind. */
export type TreeUniforms = {
  uTrees: { value: THREE.Texture | null };
  uVariants: { value: THREE.Texture | null };
  uTreeWind: { value: THREE.Vector4 };
  uTreeLee: { value: THREE.Vector2 };
};

export function createTreeUniforms(): TreeUniforms {
  return {
    uTrees: { value: null },
    uVariants: { value: null },
    uTreeWind: { value: new THREE.Vector4(1, 0, 0, 0) },
    uTreeLee: { value: new THREE.Vector2(1, 0) },
  };
}

/** A template's `#define`s, as a block of GLSL and as a cache key. */
function definesOf(t: Template): { glsl: string; key: string } {
  const all = { TPL_SKETCH: 0, TPL_FULL: 0, TPL_LEAF: 0, ...t.defines };
  const entries = Object.entries(all).sort(([a], [b]) => a.localeCompare(b));
  return {
    glsl: entries.map(([k, v]) => `#define ${k} ${v}`).join("\n"),
    key: `${t.family}:${entries.map(([k, v]) => `${k}=${v}`).join(",")}`,
  };
}

/** The vertex half every tree program shares: the template's size, the
 * tables, the family's shaper. */
function vertexPars(t: Template): string {
  return `${definesOf(t).glsl}\n${TREE_COMMON}\n${shaperOf(t.family)}`;
}

/** The woods' material for template `t`. */
export function treeMaterial(t: Template, haze: HazeUniforms, u: TreeUniforms): THREE.Material {
  const name = `tree-${definesOf(t).key}`;
  return hazeMaterial(
    new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 }),
    haze,
    name,
    (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${vertexPars(t)}\n${TREE_VERTEX_PARS}`)
        .replace("#include <beginnormal_vertex>", TREE_SHAPE)
        .replace("#include <begin_vertex>", "vec3 transformed = tWorld;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${TREE_FRAGMENT_PARS}`)
        .replace("void main() {", `void main() {\n${TREE_DITHER}`)
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>\n  diffuseColor.rgb *= vTreeColor;\n${TREE_SNOW}`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>\n${TREE_BACKLIGHT}`,
        )
        .replace(
          "#include <normal_fragment_begin>",
          `#include <normal_fragment_begin>\n${TREE_NORMAL}`,
        );
    },
  );
}

/** The casters' depth for template `t`: the mountain's own shade test
 * (`terrain-shade.ts`) over the same shaping. */
export function treeDepth(
  t: Template,
  haze: HazeUniforms,
  u: TreeUniforms,
): THREE.MeshDepthMaterial {
  const depth = createShadeDepth(haze);
  const shade = depth.onBeforeCompile.bind(depth);
  const key = `tree-depth-${definesOf(t).key}`;
  depth.customProgramCacheKey = (): string => key;
  depth.onBeforeCompile = (shader, renderer) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${vertexPars(t)}`)
      .replace(
        "#include <begin_vertex>",
        `TreeFrame T = treeFrame(int(tree.x + 0.5));
  vec3 tLocal; vec3 tNormal; vec3 tColour; float tFacet; float tBob;
  shapeTree(T, tLocal, tNormal, tColour, tFacet, tBob);
  vec3 transformed = treeWorld(T, tLocal, tBob);`,
      );
    shade(shader, renderer);
  };
  return depth;
}

/** A material that draws nothing in the picture: the casters are drawn
 * into the shadow map alone (their `customDepthMaterial`), and three picks
 * its shadow pass off the main camera's layers, so a layer cannot keep them
 * out — every vertex is put outside the clip volume instead. */
export function casterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: "void main() { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }",
    fragmentShader: "void main() { gl_FragColor = vec4(0.0); }",
  });
}
