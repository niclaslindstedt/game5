// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BUILDINGS' MATERIAL — the stack `facade-paint.ts` paints, uploaded
// once a page as two texture arrays (the colour with its roughness, and the
// relief's normals), and grafted into a world material: every vertex of a
// building carries the layer it is made of (`facadeLayer`) and its UV over
// that layer's tile (`facadeUv`, `facade-kit.ts`), and its vertex colour
// TINTS the layer (a grey sheet painted red, a white panel left white). The
// normals are bent by the tile's relief in the surface's own frame, found
// from the screen derivatives of the position and the UV — so no tangents
// are stored and a wall at any heading takes the same map.
//
// One material, one draw for every building of a kind on the mountain.

import * as THREE from "three";

import { FACADE, FACADE_LAYERS, FACADE_SIZE, paintFacades } from "./facade-paint.ts";

let stack: { albedo: THREE.DataArrayTexture; normal: THREE.DataArrayTexture } | null = null;
let users = 0;

/** The two arrays, painted and uploaded on the first ask, kept while
 * anything draws with them. */
function facadeStack(): { albedo: THREE.DataArrayTexture; normal: THREE.DataArrayTexture } {
  if (stack) return stack;
  const { albedo, normal } = paintFacades();
  const make = (data: Uint8Array, srgb: boolean) => {
    const t = new THREE.DataArrayTexture(data, FACADE_SIZE, FACADE_SIZE, FACADE_LAYERS);
    t.format = THREE.RGBAFormat;
    t.type = THREE.UnsignedByteType;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };
  stack = { albedo: make(albedo, true), normal: make(normal, false) };
  return stack;
}

/** Hold the stack for a material; `release` lets it go with the last. */
export function holdFacades(): { release(): void } {
  users++;
  facadeStack();
  let held = true;
  return {
    release() {
      if (!held) return;
      held = false;
      users--;
      if (users === 0 && stack) {
        stack.albedo.dispose();
        stack.normal.dispose();
        stack = null;
      }
    },
  };
}

const VERTEX_PARS = `
attribute vec2 facadeUv;
attribute float facadeLayer;
varying vec2 vFacadeUv;
varying float vFacadeLayer;`;

const FRAGMENT_PARS = `
uniform highp sampler2DArray uFacadeAlbedo;
uniform highp sampler2DArray uFacadeNormal;
varying vec2 vFacadeUv;
varying float vFacadeLayer;
vec3 facadePerturb(vec3 eyePos, vec3 n, vec3 mapN, vec2 uv) {
  vec3 q0 = dFdx(eyePos);
  vec3 q1 = dFdy(eyePos);
  vec2 st0 = dFdx(uv);
  vec2 st1 = dFdy(uv);
  vec3 q1perp = cross(q1, n);
  vec3 q0perp = cross(n, q0);
  vec3 T = q1perp * st0.x + q0perp * st1.x;
  vec3 B = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(T, T), dot(B, B));
  float s = det == 0.0 ? 0.0 : inversesqrt(det);
  return normalize(T * (mapN.x * s) + B * (mapN.y * s) + n * mapN.z);
}`;

/** Graft the stack into a world material's shaders: the layer's colour
 * under the vertex colour, its roughness, its relief. */
export function graftFacade(shader: THREE.WebGLProgramParametersWithUniforms): void {
  const s = facadeStack();
  shader.uniforms.uFacadeAlbedo = { value: s.albedo };
  shader.uniforms.uFacadeNormal = { value: s.normal };
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${VERTEX_PARS}`)
    .replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvFacadeUv = facadeUv;\nvFacadeLayer = facadeLayer;",
    );
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${FRAGMENT_PARS}`)
    .replace(
      "#include <map_fragment>",
      `#include <map_fragment>
  float facadeL = floor(vFacadeLayer + 0.5);
  vec4 facadeTexel = texture(uFacadeAlbedo, vec3(vFacadeUv, facadeL));
  // A cabin's casement lights only its glass (the smoothest of it), never
  // its sash and mullions.
  float facadeLit = abs(facadeL - ${FACADE.casement.toFixed(1)}) < 0.5 ? step(facadeTexel.a, 0.2) : 1.0;
  diffuseColor.rgb *= facadeTexel.rgb;`,
    )
    .replace("totalEmissiveRadiance += vGlow *", "totalEmissiveRadiance += facadeLit * vGlow *")
    .replace(
      "#include <roughnessmap_fragment>",
      "#include <roughnessmap_fragment>\n  roughnessFactor *= facadeTexel.a;",
    )
    .replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
  vec3 facadeN = texture(uFacadeNormal, vec3(vFacadeUv, facadeL)).xyz * 2.0 - 1.0;
  normal = facadePerturb(-vViewPosition, normal, facadeN, vFacadeUv);`,
    );
}
