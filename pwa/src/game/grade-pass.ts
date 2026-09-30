// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GRADE, AS A PASS — the last thing that happens to a frame in a region
// that is graded at all (`colour-grade.ts`; the alpine is not, and draws no
// pass). The sibling jet-ski game's grade pass, ported.
//
// The whole picture is drawn into a texture instead of onto the canvas, and
// then ONE screen-filling triangle pair reads it back, TONE-MAPS it with the
// renderer's own curve and exposure, grades it and writes the canvas. Two
// reasons it is a pass and not a hook in every material:
//
//   ONCE PER PIXEL. Grading inside the materials grades every LAYER of a
//   transparent pixel separately before they are blended — the falling
//   snow, the spray, the ghost are all transparent — and a saturation
//   applied four times through a plume of powder is not the one authored.
//
//   ONE MATERIAL, ONE SET OF UNIFORMS. A region changes seven dials here,
//   with no material in the scene recompiled on the way to a new country.
//
// THE PICTURE IS HDR. The snow is painted brighter than white on purpose
// (`snow-glsl.ts`'s GLARE) and it is the tone mapper that takes it down to
// an unclipped white, so the target is HALF FLOAT and holds the scene's
// linear light as three computed it: three draws into a render target with
// no tone mapping and no output conversion, and this pass then does both —
// `tonemapping_fragment` (the renderer's ACES and its exposure, because the
// pass is drawn to the canvas) before the grade, `colorspace_fragment`
// after it. A machine that cannot render to half floats is not graded at
// all (`gradeSupported`) and sees the picture as authored.
//
// THE ANTI-ALIASING MOVES WITH THE PICTURE: everything with an edge is
// drawn off-screen, so the target is multisampled when the picture is.

import * as THREE from "three";

import { gradeColour, type ColourGrade } from "./colour-grade.ts";

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  // The geometry IS clip space: a 2×2 plane's corners, straight through.
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** The fragment half — `gradeLinear` in `colour-grade.ts` in GLSL, step for
 * step, the same two clamps. */
export const GRADE_FRAGMENT = /* glsl */ `
uniform sampler2D uPicture;
uniform float uContrast;
uniform float uLift;
uniform float uSaturation;
uniform vec3 uTint;
uniform vec3 uShade;
uniform vec3 uGlow;
uniform vec2 uSplit;
varying vec2 vUv;

const float MID_P = 0.42426407;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

void main() {
  vec4 picture = texture2D(uPicture, vUv);
  gl_FragColor = vec4(max(picture.rgb, 0.0), 1.0);
  #include <tonemapping_fragment>
  vec3 c = gl_FragColor.rgb;

  // THE CONTRAST, then THE LIFT, in the perceptual coordinate.
  vec3 s = MID_P + (sqrt(max(c, 0.0)) - MID_P) * uContrast;
  s = max(s + uLift * (1.0 - s), 0.0);
  c = s * s;

  // THE SATURATION, about the pixel's own light.
  float l = dot(c, LUMA);
  c = max(l + (c - l) * uSaturation, 0.0);

  // THE CAST.
  c *= uTint;

  // THE SPLIT.
  float w = clamp(sqrt(max(dot(c, LUMA), 0.0)), 0.0, 1.0);
  float shade = uSplit.x * (1.0 - w);
  float glow = uSplit.y * w;
  c *= 1.0 - shade + shade * uShade;
  c *= 1.0 - glow + glow * uGlow;

  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;

export type GradePass = {
  /** Where the frame is drawn instead of the canvas. */
  readonly target: THREE.WebGLRenderTarget;
  /** Size it in DEVICE pixels — the drawing buffer's own size. */
  setSize(w: number, h: number): void;
  setGrade(grade: ColourGrade): void;
  /** Read the picture back, tone-map and grade it, write the canvas. */
  render(renderer: THREE.WebGLRenderer): void;
  dispose(): void;
};

/** Whether this GPU can draw the picture into half floats — the grade's
 * precondition. */
export function gradeSupported(renderer: THREE.WebGLRenderer): boolean {
  return (
    renderer.extensions.has("EXT_color_buffer_float") ||
    renderer.extensions.has("EXT_color_buffer_half_float")
  );
}

export function createGradePass(samples: number): GradePass {
  const target = new THREE.WebGLRenderTarget(4, 4, {
    type: THREE.HalfFloatType,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
    samples,
  });
  const uniforms = {
    uPicture: { value: target.texture },
    uContrast: { value: 1 },
    uLift: { value: 0 },
    uSaturation: { value: 1 },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
    uShade: { value: new THREE.Vector3(1, 1, 1) },
    uGlow: { value: new THREE.Vector3(1, 1, 1) },
    uSplit: { value: new THREE.Vector2(0, 0) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: GRADE_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  // The vertex shader reads no matrix, so the camera is only there because
  // `render` wants one, and culling is off because the plane's world bounds
  // are a unit square at the origin.
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.Camera();
  const rgb: [number, number, number] = [0, 0, 0];
  const cast = (hex: string, into: THREE.Vector3): void => {
    gradeColour(hex, rgb);
    into.set(rgb[0], rgb[1], rgb[2]);
  };
  return {
    target,
    setSize(w, h) {
      const wide = Math.max(1, Math.round(w));
      const high = Math.max(1, Math.round(h));
      if (target.width !== wide || target.height !== high) target.setSize(wide, high);
    },
    setGrade(grade) {
      uniforms.uContrast.value = grade.contrast;
      uniforms.uLift.value = grade.lift;
      uniforms.uSaturation.value = grade.saturation;
      cast(grade.tint, uniforms.uTint.value);
      cast(grade.shade, uniforms.uShade.value);
      cast(grade.glow, uniforms.uGlow.value);
      uniforms.uSplit.value.set(grade.split[0], grade.split[1]);
    },
    render(renderer) {
      renderer.render(scene, camera);
    },
    dispose() {
      target.dispose();
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
