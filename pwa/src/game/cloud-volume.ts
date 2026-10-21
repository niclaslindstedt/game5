// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HIGH'S CLOUD ON THE GPU — the raymarched volume (`cloud-volume-glsl.ts`)
// drawn into a picture kept at half the screen's width and height, a
// sixteenth of it marched afresh a frame and the rest carried over from
// the last frame's picture through the lens's move (`cloud-volume-plan.ts`
// says which pixels, and when nothing may be carried). The dome lays the
// kept picture over its sky as it lays MEDIUM's slab (`sky-dome.ts`).
//
// Three passes, each a full-screen triangle pair:
//
//   * FRESH: one pixel of every block marched — its cloud and the distance
//     its light comes from (two targets at once).
//   * CARRY: every pixel of the kept picture — the fresh ones taken as they
//     are, the others found on the last picture (followed out to the fresh
//     marches' distance and put back through last frame's lens), held
//     within what the fresh marches round them say so nothing carried
//     wrongly lingers, and the fresh marches' own where the last picture
//     never looked.
//   * WHOLE: on a cut, every pixel marched at once.
//
// The noise is made in a worker (`cloud-noise-worker.ts`) the first time
// a volume is asked for; until it lands HIGH draws the slab.
//
// On the node renderer the same three passes draw into three's own targets
// (the fresh one with its two attachments), each by its node twin
// (`cloud-volume-tsl.ts`), over the same uniforms.

import * as THREE from "three";

import {
  cloudDetailNoise,
  cloudShapeNoise,
  DETAIL_SIZE,
  SHAPE_SIZE,
} from "./cloud-volume-noise.ts";
import type { NoiseReply } from "./cloud-noise-worker.ts";
import { CLOUD_FIELD_GLSL, CLOUD_SHELL_GLSL } from "./cloud-glsl.ts";
import { nodeTwin } from "./gpu-backend.ts";
import { CLOUD_VOLUME_GLSL } from "./cloud-volume-glsl.ts";
import {
  bayerOrder,
  isCut,
  VOLUME_LOOK,
  volumeSizes,
  type VolumeLook,
  type VolumeView,
} from "./cloud-volume-plan.ts";
import { SKY_GLSL } from "./haze.ts";

// THE NOISE, once a page: asked of a worker, or made here without one.
let noise: NoiseReply | null = null;
let asked: Promise<NoiseReply> | null = null;

/** The volume's noise, asked for if it is not yet (resolves when it lands). */
export function volumeNoise(): Promise<NoiseReply> {
  if (noise) return Promise.resolve(noise);
  if (asked) return asked;
  asked = new Promise<NoiseReply>((done) => {
    const inPlace = (): void => {
      noise = { shape: cloudShapeNoise(), detail: cloudDetailNoise() };
      done(noise);
    };
    if (typeof Worker === "undefined") {
      inPlace();
      return;
    }
    try {
      const worker = new Worker(new URL("./cloud-noise-worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (e: MessageEvent<NoiseReply>) => {
        noise = e.data;
        worker.terminate();
        done(noise);
      };
      worker.onerror = () => {
        worker.terminate();
        inPlace();
      };
      worker.postMessage(0);
    } catch {
      inPlace();
    }
  });
  return asked;
}

function texture3d(data: Uint8Array, n: number): THREE.Data3DTexture {
  const tex = new THREE.Data3DTexture(data, n, n, n);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** The volume's own uniforms (the field's and the haze's are the caller's). */
export function volumeUniforms() {
  const v4 = (n: number): THREE.Vector4[] => Array.from({ length: n }, () => new THREE.Vector4());
  const v3 = (n: number): THREE.Vector3[] => Array.from({ length: n }, () => new THREE.Vector3());
  return {
    uVolShape: { value: null as THREE.Data3DTexture | null },
    uVolDetail: { value: null as THREE.Data3DTexture | null },
    uVolA: { value: v4(3) },
    uVolB: { value: v4(3) },
    uVolC: { value: v4(3) },
    uCloudSunLo: { value: v3(3) },
    uCloudSunHi: { value: v3(3) },
    uCloudMoon: { value: new THREE.Vector3() },
    uEarth: { value: new THREE.Vector4(0, 0, 1 / (2 * 6371000), 0) },
  };
}
export type VolumeUniforms = ReturnType<typeof volumeUniforms>;

const QUAD = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const MARCH = /* glsl */ `
${SKY_GLSL}
${CLOUD_FIELD_GLSL}
${CLOUD_SHELL_GLSL}
${CLOUD_VOLUME_GLSL}
uniform mat4 uInvViewProj;
uniform vec3 uEye;
uniform vec2 uKeep;
uniform vec2 uPhase;
uniform float uBlock;
uniform float uFrame;
layout(location = 0) out highp vec4 oCloud;
#ifndef WHOLE
layout(location = 1) out highp vec4 oDist;
#endif
// Where in its step each pixel reads: an interleaved gradient over the
// screen, turned on by the golden ratio a frame.
float volJitter(vec2 px) {
  return fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715))) + uFrame * 0.618034);
}
void main() {
  vec2 px = floor(gl_FragCoord.xy);
  #ifdef WHOLE
    vec2 kp = px;
  #else
    vec2 kp = px * uBlock + uPhase;
  #endif
  vec2 uv = (kp + 0.5) / uKeep;
  vec4 far = uInvViewProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize(far.xyz / far.w - uEye);
  float dist;
  oCloud = volStack(uEye, d, uSunPos, skyColour(d), volJitter(kp), dist);
  // A pixel the march could not settle is left clear rather than carried
  // on as a hole for sixteen frames.
  if (any(isnan(oCloud)) || any(isinf(oCloud)) || isnan(dist)) {
    oCloud = vec4(0.0);
    dist = 1e5;
  }
  #ifndef WHOLE
    oDist = vec4(dist * 0.001, 0.0, 0.0, 1.0);
  #endif
}
`;

const CARRY = /* glsl */ `
uniform sampler2D uFresh;
uniform sampler2D uFreshDist;
uniform sampler2D uHistory;
uniform mat4 uInvViewProj;
uniform mat4 uPrevVP;
uniform vec3 uEye;
uniform vec2 uKeep;
uniform vec2 uFreshSize;
uniform vec2 uPhase;
uniform float uBlock;
void main() {
  vec2 px = floor(gl_FragCoord.xy);
  vec2 cell = floor(px / uBlock);
  ivec2 ci = ivec2(cell);
  ivec2 top = ivec2(uFreshSize) - 1;
  bool marched = all(equal(px - cell * uBlock, uPhase));
  // The fresh marches round this pixel: their texel centres stand at
  // (cell × block + phase + ½) on the kept picture.
  vec2 fuv = ((px - uPhase) / uBlock + 0.5) / uFreshSize;
  vec4 fresh = marched ? texelFetch(uFresh, ci, 0) : texture(uFresh, fuv);
  vec4 lo = vec4(1e9);
  vec4 hi = vec4(-1e9);
  float near = 1e9;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      ivec2 q = clamp(ci + ivec2(x, y), ivec2(0), top);
      vec4 c = texelFetch(uFresh, q, 0);
      lo = min(lo, c);
      hi = max(hi, c);
      near = min(near, texelFetch(uFreshDist, q, 0).r);
    }
  // Where this pixel's cloud stood on the last picture.
  vec2 uv = (px + 0.5) / uKeep;
  vec4 far = uInvViewProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize(far.xyz / far.w - uEye);
  vec4 was = uPrevVP * vec4(uEye + d * near * 1000.0, 1.0);
  vec2 puv = was.xy / was.w * 0.5 + 0.5;
  if (was.w <= 0.0 || any(lessThan(puv, vec2(0.0))) || any(greaterThan(puv, vec2(1.0)))) {
    gl_FragColor = fresh;
    return;
  }
  vec4 kept = texture(uHistory, puv);
  // How far the picture moved under this pixel, in its pixels: held still,
  // what the last sixteen frames found is kept whole (finer than any one
  // frame's marches); moving, it is held within what the fresh marches
  // round it say (with a little slack), so nothing carried wrongly lingers.
  float moved = length((puv - uv) * uKeep);
  vec4 pad = (hi - lo) * 0.25 + 0.02;
  kept = mix(kept, clamp(kept, lo - pad, hi + pad), smoothstep(0.25, 1.5, moved));
  // A marched pixel takes its march, averaged with what was there while
  // the picture stands (each pixel's jittered steps then settle).
  gl_FragColor = marched ? mix(kept, fresh, mix(0.5, 1.0, smoothstep(0.25, 1.5, moved))) : kept;
}
`;

/** A pass's picture: three's own target on the node renderer (`node`),
 * typed as the one `gl` is typed to take. */
export function cloudTarget(
  w: number,
  h: number,
  type: THREE.TextureDataType,
  node: boolean,
  count = 1,
): THREE.WebGLRenderTarget {
  const options: THREE.RenderTargetOptions = {
    type,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
    count,
  };
  const rt = node
    ? (new THREE.RenderTarget(w, h, options) as THREE.WebGLRenderTarget)
    : new THREE.WebGLRenderTarget(w, h, options);
  for (const t of rt.textures) t.colorSpace = THREE.NoColorSpace;
  return rt;
}

function target(w: number, h: number, node: boolean, count = 1): THREE.WebGLRenderTarget {
  const rt = cloudTarget(w, h, THREE.HalfFloatType, node, count);
  if (count > 1) rt.textures[1].minFilter = rt.textures[1].magFilter = THREE.NearestFilter;
  return rt;
}

export type CloudVolume = {
  uniforms: VolumeUniforms;
  /** Whether the noise has landed; asks for it the first time. */
  ready(): boolean;
  /** This frame's share drawn through `lens`; the kept picture back.
   * `key` names what makes the last picture another sky's. */
  draw(
    look: VolumeLookName,
    lens: THREE.Camera,
    t: number,
    sun: THREE.Vector3,
    key: string,
  ): THREE.Texture;
  /** Whether the last frame was marched whole (a cut), for the labs. */
  whole(): boolean;
  /** March every pixel next frame. */
  refresh(): void;
  dispose(): void;
};

export type VolumeLookName = keyof typeof VOLUME_LOOK;

/** HIGH's volume over `gl`, sharing the field's and the haze's uniforms
 * (`shared`); `node` when `gl` is the node renderer. */
export function createCloudVolume(
  gl: THREE.WebGLRenderer,
  shared: Record<string, THREE.IUniform>,
  node = false,
): CloudVolume {
  const u = volumeUniforms();
  const own = {
    uKeep: { value: new THREE.Vector2() },
    uPhase: { value: new THREE.Vector2() },
    uBlock: { value: 4 },
    uFrame: { value: 0 },
    uFresh: { value: null as THREE.Texture | null },
    uFreshDist: { value: null as THREE.Texture | null },
    uHistory: { value: null as THREE.Texture | null },
    uFreshSize: { value: new THREE.Vector2() },
    uPrevVP: { value: new THREE.Matrix4() },
  };
  const uniforms = { ...shared, ...u, ...own };
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);
  const carry = new THREE.ShaderMaterial({
    vertexShader: QUAD,
    fragmentShader: CARRY,
    uniforms,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
  // The webgpu paths draw each pass with its node twin (`cloud-volume-tsl.ts`).
  nodeTwin(carry, "clouds", "cloud-carry");
  let marchFor: {
    look: VolumeLook;
    fresh: THREE.ShaderMaterial;
    whole: THREE.ShaderMaterial;
  } | null = null;
  const march = (look: VolumeLook, whole: boolean): THREE.ShaderMaterial => {
    if (marchFor?.look !== look) {
      marchFor?.fresh.dispose();
      marchFor?.whole.dispose();
      const make = (w: boolean): THREE.ShaderMaterial =>
        nodeTwin(
          new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader: QUAD,
            fragmentShader: MARCH,
            uniforms,
            defines: { STEPS: look.steps, LIGHT: look.light, ...(w ? { WHOLE: 1 } : {}) },
            depthTest: false,
            depthWrite: false,
            blending: THREE.NoBlending,
          }),
          "clouds",
          "cloud-march",
        );
      marchFor = { look, fresh: make(false), whole: make(true) };
    }
    return whole ? marchFor.whole : marchFor.fresh;
  };
  let keep: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null = null;
  let fresh: THREE.WebGLRenderTarget | null = null;
  let read = 0;
  let frame = 0;
  let last: VolumeView | null = null;
  let wasWhole = false;
  let forced = true;
  const size = new THREE.Vector2();
  const vp = new THREE.Matrix4();
  const ahead = new THREE.Vector3();
  const eye = new THREE.Vector3();

  function render(material: THREE.Material, rt: THREE.WebGLRenderTarget): void {
    quad.material = material;
    gl.setRenderTarget(rt);
    gl.render(scene, camera);
  }

  return {
    uniforms: u,
    ready() {
      if (u.uVolShape.value) return true;
      if (noise) {
        u.uVolShape.value = texture3d(noise.shape, SHAPE_SIZE);
        u.uVolDetail.value = texture3d(noise.detail, DETAIL_SIZE);
        forced = true;
        return true;
      }
      void volumeNoise();
      return false;
    },
    draw(name, lens, t, sun, key) {
      const look = VOLUME_LOOK[name];
      gl.getDrawingBufferSize(size);
      const { keep: kw, fresh: fw } = volumeSizes(size.x, size.y, look.block);
      if (!keep || keep[0].width !== kw[0] || keep[0].height !== kw[1]) {
        keep?.forEach((k) => k.dispose());
        keep = [target(kw[0], kw[1], node), target(kw[0], kw[1], node)];
        forced = true;
      }
      if (!fresh || fresh.width !== fw[0] || fresh.height !== fw[1]) {
        fresh?.dispose();
        fresh = target(fw[0], fw[1], node, 2);
      }
      lens.updateMatrixWorld();
      vp.multiplyMatrices(lens.projectionMatrix, lens.matrixWorldInverse);
      lens.getWorldPosition(eye);
      lens.getWorldDirection(ahead);
      const view: VolumeView = {
        eye: [eye.x, eye.y, eye.z],
        ahead: [ahead.x, ahead.y, ahead.z],
        t,
        sun: [sun.x, sun.y, sun.z],
        key: `${key}|${name}|${kw[0]}x${kw[1]}`,
      };
      const whole = forced || isCut(last, view);
      own.uKeep.value.set(kw[0], kw[1]);
      own.uFreshSize.value.set(fw[0], fw[1]);
      own.uBlock.value = look.block;
      own.uFrame.value = frame % 64;
      const write = 1 - read;
      if (whole) {
        render(march(look, true), keep[write]);
      } else {
        const order = bayerOrder(look.block);
        const [px, py] = order[frame % order.length];
        own.uPhase.value.set(px, py);
        render(march(look, false), fresh);
        own.uFresh.value = fresh.textures[0];
        own.uFreshDist.value = fresh.textures[1];
        own.uHistory.value = keep[read].texture;
        render(carry, keep[write]);
      }
      read = write;
      own.uPrevVP.value.copy(vp);
      last = view;
      wasWhole = whole;
      forced = false;
      frame++;
      return keep[read].texture;
    },
    whole: () => wasWhole,
    refresh() {
      forced = true;
    },
    dispose() {
      keep?.forEach((k) => k.dispose());
      fresh?.dispose();
      carry.dispose();
      marchFor?.fresh.dispose();
      marchFor?.whole.dispose();
      u.uVolShape.value?.dispose();
      u.uVolDetail.value?.dispose();
      quad.geometry.dispose();
    },
  };
}
