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
uniform float uBuzz;
uniform vec3 uBlaze;
uniform float uTime;
varying vec2 vUv;

const float MID_P = 0.42426407;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

// THE BUZZ (region-picture's setBuzz): the picture swimming — warped in slow
// waves, seen double, its colours split toward the edges and smeared — at
// 0 not read at all.
vec3 split(vec2 uv, vec2 ch) {
  return vec3(
    texture2D(uPicture, uv + ch).r,
    texture2D(uPicture, uv).g,
    texture2D(uPicture, uv - ch).b
  );
}
vec3 drunk(vec2 uv) {
  float b = uBuzz;
  vec2 c = uv - 0.5;
  vec2 wave = vec2(sin(uv.y * 6.0 + uTime * 1.3), cos(uv.x * 4.5 + uTime * 1.05)) * 0.014 * b;
  uv = 0.5 + c * (1.0 - 0.06 * b * (0.5 + 0.5 * sin(uTime * 0.7))) + wave;
  vec2 ch = c * 0.022 * b;
  vec2 twin = vec2(sin(uTime * 0.63), 0.35 * cos(uTime * 0.41)) * 0.04 * b;
  float r = 0.0045 * b;
  vec3 a = split(uv, ch) * 0.4
    + (split(uv + vec2(r, 0.0), ch) + split(uv - vec2(r, 0.0), ch)
      + split(uv + vec2(0.0, r), ch) + split(uv - vec2(0.0, r), ch)) * 0.15;
  vec3 e = split(uv + twin, ch);
  return mix(a, e, 0.45 * smoothstep(0.0, 0.5, b));
}

// THE BLAZE (region-picture's setBlaze): a fire through his own eyes — the
// heat's shimmer rising through the picture, flames licking up from its
// foot and a warm cast over it, the flash washing it white, the smoke
// closing in from its edges — at 0, 0, 0 not read at all.
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float flames(vec2 uv, float t) {
  vec2 q = vec2(uv.x * 7.0, uv.y * 3.2 - t * 2.6);
  float n = noise(q) * 0.55 + noise(q * 2.1 + 3.7) * 0.3 + noise(q * 4.3 - 1.9) * 0.15;
  return n;
}
vec3 blaze(vec3 c, vec2 uv) {
  float heat = uBlaze.x;
  float flash = uBlaze.y;
  float smoke = uBlaze.z;
  float t = uTime;
  // The cast: the light of the fire warming everything seen.
  c = mix(c, c * vec3(1.35, 0.82, 0.5) + vec3(0.06, 0.018, 0.0), heat * 0.7);
  // The tongues up from the foot of the picture, ragged and rising.
  float reach = 0.18 + 0.42 * heat;
  float n = flames(uv, t);
  float tongue = smoothstep(reach, reach * 0.25, uv.y + (0.5 - n) * reach * 0.9);
  float core = smoothstep(reach * 0.55, 0.0, uv.y + (0.5 - n) * reach * 0.6);
  vec3 fire = mix(vec3(1.0, 0.32, 0.04), vec3(1.0, 0.82, 0.42), core);
  c = mix(c, fire * (1.2 + core), clamp(tongue * heat * 1.1, 0.0, 1.0));
  // The smoke at the edges, rolling.
  float edge = smoothstep(0.2, 0.75, length((uv - 0.5) * vec2(1.25, 1.0)));
  float roll = noise(uv * 5.0 + vec2(t * 0.3, t * 0.7)) * 0.6 + 0.4;
  c = mix(c, vec3(0.05, 0.04, 0.035), clamp(smoke * edge * roll * 1.3, 0.0, 0.92));
  c *= 1.0 - smoke * 0.25;
  // The flash.
  return mix(c, vec3(1.0, 0.94, 0.82), clamp(flash, 0.0, 1.0));
}

void main() {
  vec2 at = vUv;
  if (uBlaze.x > 0.0) {
    // The air over the fire shimmering: the picture wavering, most low down.
    float lo = 1.0 - vUv.y;
    at += vec2(sin(vUv.y * 38.0 + uTime * 11.0), cos(vUv.x * 31.0 + uTime * 9.0))
      * 0.0045 * uBlaze.x * (0.35 + lo);
  }
  vec3 seen = uBuzz > 0.0 ? drunk(at) : texture2D(uPicture, at).rgb;
  gl_FragColor = vec4(max(seen, 0.0), 1.0);
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

  // ...and the edges of the buzz closing in, warm.
  if (uBuzz > 0.0) {
    float edge = smoothstep(0.3, 0.8, length((vUv - 0.5) * vec2(1.2, 1.0)));
    c *= 1.0 - uBuzz * 0.6 * edge;
    c = mix(c, c * vec3(1.08, 0.97, 0.86), uBuzz * 0.6);
  }

  if (uBlaze.x + uBlaze.y + uBlaze.z > 0.0) c = blaze(c, vUv);

  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;

/** The pass's uniforms: the GLSL reads them by name, and the node
 * renderer's grade (`grade-tsl.ts`) reads the same objects by reference, so
 * one writer drives both. */
export type GradeUniforms = {
  uPicture: { value: THREE.Texture };
  uContrast: { value: number };
  uLift: { value: number };
  uSaturation: { value: number };
  uTint: { value: THREE.Vector3 };
  uShade: { value: THREE.Vector3 };
  uGlow: { value: THREE.Vector3 };
  uSplit: { value: THREE.Vector2 };
  uBuzz: { value: number };
  uBlaze: { value: THREE.Vector3 };
  uTime: { value: number };
};

/** How the node renderer draws the pass (`grade-tsl.ts`, handed in by the
 * seam): the grade over `uniforms` written onto the canvas. Null on WebGL. */
export type NodeGrade = (uniforms: GradeUniforms) => {
  /** Write the canvas, the colour shaded by the RAYS first when `shaded`. */
  render(shaded?: boolean): void;
  dispose(): void;
};

export type GradePass = {
  /** Where the frame is drawn instead of the canvas. */
  readonly target: THREE.WebGLRenderTarget;
  /** Size it in DEVICE pixels — the drawing buffer's own size. */
  setSize(w: number, h: number): void;
  /** Multisample it this many times a pixel (0: not at all). */
  setSamples(n: number): void;
  setGrade(grade: ColourGrade): void;
  /** How drunk the picture is, 0..1, and the clock it swims by, s. */
  setBuzz(buzz: number, t: number): void;
  /** The fire through his eyes: its heat, flash and smoke, 0..1 each, and
   * the clock its flames rise by, s. */
  setBlaze(heat: number, flash: number, smoke: number, t: number): void;
  /** Read the picture back, tone-map and grade it, write the canvas — on
   * the node renderer shaded by the RAYS first when `shaded`. */
  render(renderer: THREE.WebGLRenderer, shaded?: boolean): void;
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

/** The pass, multisampled `samples` times a pixel. With `node` (the node
 * renderer's grade) its target is three's own `RenderTarget` and the node
 * grade draws it; the GLSL quad is never drawn. */
export function createGradePass(samples: number, node: NodeGrade | null = null): GradePass {
  const options = {
    type: THREE.HalfFloatType,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
    samples,
  };
  const target = node
    ? (new THREE.RenderTarget(4, 4, options) as THREE.WebGLRenderTarget)
    : new THREE.WebGLRenderTarget(4, 4, options);
  // The picture's depth is the multisampled buffer's own and nothing reads
  // it once the scene is drawn: only the colour is resolved for the grade.
  target.resolveDepthBuffer = false;
  const uniforms: GradeUniforms = {
    uPicture: { value: target.texture },
    uContrast: { value: 1 },
    uLift: { value: 0 },
    uSaturation: { value: 1 },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
    uShade: { value: new THREE.Vector3(1, 1, 1) },
    uGlow: { value: new THREE.Vector3(1, 1, 1) },
    uSplit: { value: new THREE.Vector2(0, 0) },
    uBuzz: { value: 0 },
    uBlaze: { value: new THREE.Vector3(0, 0, 0) },
    uTime: { value: 0 },
  };
  const drawn = node?.(uniforms) ?? null;
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
    setSamples(n) {
      if (target.samples === n) return;
      target.samples = n;
      // The framebuffers are made again, at the new count, at the next draw.
      target.dispose();
    },
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
    setBuzz(buzz, t) {
      uniforms.uBuzz.value = buzz;
      uniforms.uTime.value = t;
    },
    setBlaze(heat, flash, smoke, t) {
      uniforms.uBlaze.value.set(heat, flash, smoke);
      uniforms.uTime.value = t;
    },
    render(renderer, shaded = false) {
      if (drawn) drawn.render(shaded);
      else renderer.render(scene, camera);
    },
    dispose() {
      target.dispose();
      drawn?.dispose();
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
