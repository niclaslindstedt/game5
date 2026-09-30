// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DEVELOPER ▸ TRAIL MAP: the two maps the snow reads its furrows off
// (`trail-map.ts`), drawn flat in the bottom-right corner of the picture,
// clear of the speedo — the fine window that follows the leader, and the
// coarse map of the whole basin to its right.
//
// It exists because a furrow that is missing from the snow is missing for
// one of two reasons that look identical from a chase camera: it was never
// STAMPED, or it was stamped and the ground is not READING it. With the maps
// on screen the question answers itself — a stripe in the square and no
// trough on the snow is the shader; no stripe is the stamp.
//
// The channels are the maps' own (`TRAIL_GLSL`): red is the furrow's depth,
// green the plough's berm, each a share of its ceiling. Drawn as depth in
// warm white and berm in blue over near-black, so an empty map reads as an
// empty map rather than as nothing drawn. Presentation of an instrument: one
// extra pass after the frame, only while the row is on.

import * as THREE from "three";

import type { TrailUniforms } from "./trail-map.ts";

/** Each square's side as a share of the buffer's height, and its margin. */
const SIDE = 0.26;
const MARGIN = 0.02;

export type TrailOverlay = {
  /** Draw both maps over the corner of what `gl` just rendered. */
  draw(gl: THREE.WebGLRenderer, maps: TrailUniforms): void;
  dispose(): void;
};

export function createTrailOverlay(): TrailOverlay {
  const material = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: null as THREE.Texture | null } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec2 vUv;
      void main() {
        // A furrow is a few texels wide in a map a thousand across, drawn
        // into a square a fifth of that: one tap would land between the
        // lines and draw an empty map. So the square's pixel takes the
        // MOST of the texels under it.
        vec2 foot = fwidth(vUv);
        vec2 t = vec2(0.0);
        for (int i = 0; i < 4; i++) {
          for (int j = 0; j < 4; j++) {
            vec2 at = vUv + (vec2(float(i), float(j)) / 3.0 - 0.5) * foot;
            t = max(t, texture2D(uMap, at).rg);
          }
        }
        vec3 c = vec3(0.03, 0.05, 0.08);
        c = mix(c, vec3(0.25, 0.55, 1.0), clamp(t.y * 6.0, 0.0, 1.0));
        c = mix(c, vec3(1.0, 0.92, 0.8), clamp(t.x * 8.0, 0.0, 1.0));
        gl_FragColor = vec4(c, 0.92);
        #include <colorspace_fragment>
      }
    `,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const size = new THREE.Vector2();

  return {
    draw(gl, maps) {
      gl.getDrawingBufferSize(size);
      const ratio = gl.getPixelRatio();
      // The viewport is in CSS pixels; the buffer in device pixels.
      const side = Math.round((size.y * SIDE) / ratio);
      const margin = Math.round((size.y * MARGIN) / ratio);
      const autoClear = gl.autoClear;
      gl.autoClear = false;
      gl.setScissorTest(true);
      const width = size.x / ratio;
      [maps.uTrailFine.value, maps.uTrailCoarse.value].forEach((texture, i) => {
        const x = width - (2 - i) * (side + margin);
        gl.setViewport(x, margin, side, side);
        gl.setScissor(x, margin, side, side);
        material.uniforms.uMap.value = texture;
        gl.render(scene, camera);
      });
      gl.setScissorTest(false);
      gl.setViewport(0, 0, width, size.y / ratio);
      gl.autoClear = autoClear;
    },
    dispose() {
      quad.geometry.dispose();
      material.dispose();
    },
  };
}
