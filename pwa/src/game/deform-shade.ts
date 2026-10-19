// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEFORMABLE SNOW'S OWN SHADE, A CELL AT A TIME (`deform-glsl.ts`): the
// field copied, as it was uploaded, into a ring target of the same size,
// its alpha the march toward the sun from that cell's centre. The ground
// reads this target where it read the field, so the march costs a pass of
// the field's few tens of thousands of cells rather than every pixel the
// window fills — and the ground's program reads no texture more.
//
// Presentation only: it reads the field, the trail map, the ground's slope
// and the sun, and writes nothing back.

import * as THREE from "three";

import { DEFORM_MARCH_GLSL } from "./deform-glsl.ts";
import { TRAIL_GLSL, type TrailUniforms } from "./trail-map.ts";

/** The ground's gradient map and its frame (`terrain.ts`'s): the march
 * climbs over the slope it stands on. */
export type GroundFrame = Record<
  "uGround" | "uHeightOrigin" | "uHeightCount" | "uCell",
  THREE.IUniform
>;

export type DeformShade = {
  /** The field with its shade in alpha: what the ground reads. */
  readonly texture: THREE.Texture;
  /** March every cell of the field as it now stands. */
  draw(gl: THREE.WebGLRenderer): void;
  dispose(): void;
};

const VERTEX = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
${TRAIL_GLSL}
uniform sampler2D uGround;
uniform vec2 uHeightOrigin;
uniform vec2 uHeightCount;
uniform float uCell;
uniform vec3 uSunDir;
${DEFORM_MARCH_GLSL}
void main() {
  ivec2 ij = ivec2(gl_FragCoord.xy);
  vec4 f = texelFetch(uDeform, ij, 0);
  // The cell's world point: the one of its ring's repeats inside the
  // window round the field's centre (\`deformAt\` read backwards).
  float span = uDeformSpan;
  vec2 c = uDeformBox.xy;
  vec2 p = c + mod(vec2(ij) * uDeformBox.w - c + 0.5 * span, span) - 0.5 * span;
  vec2 guv = (p - uHeightOrigin + 0.5 * uCell) / (uHeightCount * uCell);
  gl_FragColor = vec4(f.rgb, deformMarch(p, uSunDir, texture2D(uGround, guv).rg));
}
`;

export function createDeformShade(
  size: number,
  field: THREE.Texture,
  trail: TrailUniforms,
  ground: GroundFrame,
  sun: { value: THREE.Vector3 },
): DeformShade {
  const target = new THREE.WebGLRenderTarget(size, size, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  // The trail map's own uniforms, live, but the field read as uploaded.
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { ...trail, uDeform: { value: field }, ...ground, uSunDir: sun },
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.Camera();
  return {
    texture: target.texture,
    draw(gl) {
      const was = gl.getRenderTarget();
      gl.setRenderTarget(target);
      gl.render(scene, camera);
      gl.setRenderTarget(was);
    },
    dispose() {
      target.dispose();
      material.dispose();
      mesh.geometry.dispose();
    },
  };
}
