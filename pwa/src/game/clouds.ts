// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLOUD ON THE GPU: the field (`cloud-field.ts`) as uniforms every
// frame, its noise as one 3D texture, and the two passes it is drawn with
// before the frame —
//
//   * THE SHADOW MAP: every layer's columns over a box laid across the
//     map at that layer's own height, slid along the sun so the box covers
//     the ground it shades (a channel a layer, `cloud-glsl.ts`'s
//     `cloudShadow` reads it in every world material, `haze.ts`).
//   * THE SLAB (MEDIUM, `CLOUD_TIER`): the layers marched at half the
//     picture's resolution through the lens the frame is drawn with, which
//     the dome (`sky-dome.ts`) lays over its sky. LOW draws the shell in
//     the dome itself and runs no pass. A machine that cannot render into
//     half floats draws the shell whatever the row says.
//   * THE VOLUME (HIGH and MAX): the heaps and decks raymarched through
//     their Perlin-Worley puffs, a sixteenth of a half-resolution picture
//     a frame and the rest carried over (`cloud-volume.ts`). Until its
//     noise lands — made off the thread the first time it is asked for —
//     HIGH draws the slab of eight steps.
//
// The field moves only with the run's clock and the map: the noise's
// offsets wrapped to its period on the CPU, so a float on the GPU never
// carries an hour of the wind's carry.
//
// ON THE NODE RENDERER (`docs/webgpu.md`, part 10) the same passes are drawn
// into three's own targets, each ShaderMaterial by its node twin
// (`cloud-pass-tsl.ts`, `cloud-volume-tsl.ts`) over the same uniforms.

import * as THREE from "three";
import type { Level } from "@engine";

import {
  CLOUD_LAYERS,
  cloudNoise,
  layerPass,
  NOISE_CELLS,
  NOISE_SIZE,
  type CloudLayer,
} from "./cloud-field.ts";
import {
  CLOUD_FIELD_GLSL,
  CLOUD_HALO_GLSL,
  CLOUD_SHELL_GLSL,
  CLOUD_SLAB_GLSL,
  cloudStackGlsl,
} from "./cloud-glsl.ts";
import { cloudTarget, createCloudVolume, volumeNoise, type CloudVolume } from "./cloud-volume.ts";
import { nodeTwin } from "./gpu-backend.ts";
import { carveOf, carveOffsets } from "./cloud-volume-plan.ts";
import { SKY_GLSL, type HazeUniforms } from "./haze.ts";
import type { CloudTier } from "./settings-video.ts";
import { fieldShape } from "./cloud-front.ts";
import { fieldAt, type SkyLook } from "./sky.ts";

type SlabTier = "slab4" | "slab8";
const isVolume = (t: CloudTier): t is "volume" | "volumeFine" =>
  t === "volume" || t === "volumeFine";

/** A slab's `steps` through each layer and its `light` reads toward the
 * sun (MEDIUM 4 + 1; 8 + 2 the stand-in while HIGH's volume is made). */
export const CLOUD_STEPS: Record<SlabTier, { steps: number; light: number }> = {
  slab4: { steps: 4, light: 1 },
  slab8: { steps: 8, light: 2 },
};

/** The shadow map's texels a side and its span, m. */
export const CLOUD_SHADOW = { size: 256, span: 24000 } as const;

/** A lab's hand on the tier (the clouds sheet sets one a column), or null
 * to follow the picture's row. */
let forcedTier: CloudTier | null = null;
export function forceCloudTier(next: CloudTier | null): void {
  forcedTier = next;
}

/** A lab's hand on the volume: march every pixel on the next frame (the
 * carried picture's reference). */
let refreshAsked = false;
export function refreshCloudVolume(): void {
  refreshAsked = true;
}

export type CloudUniforms = ReturnType<typeof cloudUniforms>;
function cloudUniforms() {
  const v4 = (): THREE.Vector4[] => Array.from({ length: CLOUD_LAYERS }, () => new THREE.Vector4());
  const v3 = (): THREE.Vector3[] => Array.from({ length: CLOUD_LAYERS }, () => new THREE.Vector3());
  return {
    uCloudNoise: { value: null as THREE.Data3DTexture | null },
    uCloudA: { value: v4() },
    uCloudB: { value: v4() },
    uCloudC: { value: v4() },
    uCloudSun: { value: v3() },
    uCloudTop: { value: v3() },
    uCloudBase: { value: v3() },
    uCloudOn: { value: new THREE.Vector4() },
    uCloudSea: { value: new THREE.Vector4() },
    uCloudSeaLevel: { value: 0 },
    uCloudVeil: { value: 0 },
    /** The slab's picture (MEDIUM, HIGH): premultiplied, the share hidden. */
    uCloudTex: { value: null as THREE.Texture | null },
  };
}

export type Clouds = {
  uniforms: CloudUniforms;
  /** Whether the dome reads a pass's picture (true) or draws the shell. */
  slab(): boolean;
  /** Whether that picture is the volume's (read as it is) rather than the
   * slab's (its dither resolved on texel corners). */
  volume(): boolean;
  /** Whether the last frame's volume was marched whole (a cut): the labs'. */
  whole(): boolean;
  setTier(tier: CloudTier): void;
  /** The field over `level` at run time `t`, lit by `look`; the passes
   * drawn through `camera`. */
  update(look: SkyLook, level: Level | null, t: number, camera: THREE.Camera): void;
  /** Behind the loading card: HIGH's volume made and its noise landed, so
   * the run's first frames find it ready. */
  prepare(): Promise<void>;
  /** ...and every program the run's first frames draw the clouds with
   * finished: `update` twice over at the run's own sky and clock. */
  warm(look: SkyLook, level: Level, t: number, camera: THREE.Camera): void;
  dispose(): void;
};

function noiseTexture(): THREE.Data3DTexture {
  const N = NOISE_SIZE;
  const tex = new THREE.Data3DTexture(cloudNoise(), N, N, N);
  tex.format = THREE.RedFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.unpackAlignment = 1;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const QUAD = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const SHADOW_FRAGMENT = /* glsl */ `
${CLOUD_FIELD_GLSL}
uniform vec4 uBoxes[${CLOUD_LAYERS}];
varying vec2 vUv;
float columnHere(int i) {
  if (float(i) >= uCloudOn.x) return 0.0;
  vec2 xz = uBoxes[i].xy + vUv / uBoxes[i].z;
  vec2 c = cloudColumn(i, cloudNoise(i, xz));
  return c.y - c.x;
}
void main() {
  gl_FragColor = vec4(columnHere(0), columnHere(1), columnHere(2), 1.0);
}
`;

const SLAB_FRAGMENT = /* glsl */ `
${SKY_GLSL}
${CLOUD_FIELD_GLSL}
${CLOUD_SHELL_GLSL}
${CLOUD_SLAB_GLSL}
${cloudStackGlsl("cloudLayerSlab(i, e, d, L, sky, jit)")}
uniform mat4 uInvViewProj;
uniform vec3 uEye;
varying vec2 vUv;
void main() {
  vec4 far = uInvViewProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize(far.xyz / far.w - uEye);
  vec3 L = uSunPos;
  vec3 sky = skyColour(d);
  gl_FragColor = cloudStack(uEye, d, L, sky, cloudJitter(gl_FragCoord.xy));
}
`;

/** The dome's share: the shell's stack and the halo (the slab's is read
 * off `uCloudTex`). */
export const DOME_CLOUD_GLSL = /* glsl */ `
${CLOUD_FIELD_GLSL}
${CLOUD_SHELL_GLSL}
${cloudStackGlsl("cloudLayerShell(i, e, d, L, sky)")}
${CLOUD_HALO_GLSL}
uniform sampler2D uCloudTex;
`;

const wrap = (x: number): number => x - Math.floor(x);

/** `node`: `gl` is the node renderer typed as WebGL's (`render-seam.ts`),
 * which renders into half floats on every back end it has. */
export function createClouds(
  gl: THREE.WebGLRenderer | null,
  haze: HazeUniforms,
  node = false,
): Clouds {
  const u = cloudUniforms();
  u.uCloudNoise.value = noiseTexture();
  const floats =
    gl !== null &&
    (node ||
      (gl.capabilities.isWebGL2 &&
        (gl.extensions.has("EXT_color_buffer_float") ||
          gl.extensions.has("EXT_color_buffer_half_float"))));
  /** The node renderer draws nothing before its device is made. */
  const drawable = (): boolean =>
    !node || (gl as unknown as { initialized?: boolean }).initialized === true;
  // The node renderer makes a target's texture as a plain one if a material
  // binds it before its pass first draws, and again under the pass — every
  // pipeline built between left bound to the one destroyed. So there the
  // shadow map is drawn the first frame whether a layer stands or not.
  let shadowDrawn = !node;
  let tier: CloudTier = "shell";
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);
  const boxes = Array.from({ length: CLOUD_LAYERS }, () => new THREE.Vector4());
  const shadowMat = new THREE.ShaderMaterial({
    vertexShader: QUAD,
    fragmentShader: SHADOW_FRAGMENT,
    uniforms: { ...u, uBoxes: { value: boxes } },
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
  // The webgpu paths draw it with its node twin (`cloud-pass-tsl.ts`).
  nodeTwin(shadowMat, "clouds", "cloud-map");
  const shadow = gl
    ? cloudTarget(CLOUD_SHADOW.size, CLOUD_SHADOW.size, THREE.UnsignedByteType, node)
    : null;
  haze.uCloudShadow.value = shadow?.texture ?? null;
  const slabU = {
    ...haze,
    ...u,
    uInvViewProj: { value: new THREE.Matrix4() },
    uEye: { value: new THREE.Vector3() },
  };
  let slabMat: THREE.ShaderMaterial | null = null;
  let slabRt: THREE.WebGLRenderTarget | null = null;
  // HIGH's volume, made the first time it is asked for.
  let volume: CloudVolume | null = null;
  let volumeOn = false;
  let fieldKey = 0;
  const size = new THREE.Vector2();
  const vp = new THREE.Matrix4();
  let order: CloudLayer[] = [];
  let ordered: readonly CloudLayer[] | null = null;
  let shaped = "";

  const tierNow = (): CloudTier => forcedTier ?? tier;
  const slabOn = (): boolean => floats && tierNow() !== "shell" && gl !== null;

  function draw(material: THREE.Material, rt: THREE.WebGLRenderTarget): void {
    quad.material = material;
    gl!.setRenderTarget(rt);
    gl!.render(scene, camera);
  }

  function slabFor(t: SlabTier): THREE.ShaderMaterial {
    const { steps, light } = CLOUD_STEPS[t];
    if (slabMat?.defines.STEPS === steps && slabMat.defines.LIGHT === light) return slabMat;
    slabMat?.dispose();
    slabMat = new THREE.ShaderMaterial({
      vertexShader: QUAD,
      fragmentShader: SLAB_FRAGMENT,
      uniforms: slabU,
      defines: { STEPS: steps, LIGHT: light },
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
    return nodeTwin(slabMat, "clouds", "cloud-slab");
  }

  function update(look: SkyLook, level: Level | null, t: number, lens: THREE.Camera): void {
    const field = level ? fieldAt(level, t) : null;
    const layers = field?.layers ?? [];
    // The layers sorted by height, kept with the look's light (one a
    // layer of the field, in the field's own order). Under a moving sky
    // (`cloud-front.ts`) the field is new every frame: the volume's kept
    // picture is thrown away only when the genera it stands change.
    if (layers !== ordered) {
      order = [...layers].sort((a, b) => a.base - b.base).slice(0, CLOUD_LAYERS);
      ordered = layers;
      const shape = field ? fieldShape(field) : "";
      if (!level?.front || shape !== shaped) {
        shaped = shape;
        fieldKey++;
      }
    }
    // The volume is wanted (HIGH, MAX) and its noise has landed.
    const want = slabOn() && isVolume(tierNow());
    if (want && !volume && gl) volume = createCloudVolume(gl, slabU, node);
    const vol = want && volume !== null && volume.ready() ? volume : null;
    if (vol && refreshAsked) vol.refresh();
    refreshAsked = false;
    const vu = volume?.uniforms;
    const floorY = field?.floorY ?? 0;
    const L = look.key;
    const sinE = Math.max(L.y, 0.05);
    const g = level?.ground;
    const cx = g ? g.originX + ((g.cols - 1) * g.cell) / 2 : 0;
    const cz = g ? g.originZ + ((g.rows - 1) * g.cell) / 2 : 0;
    const groundMid = floorY + (level?.mountain?.vertical ?? 0) / 2;
    const texel = CLOUD_SHADOW.span / CLOUD_SHADOW.size;
    if (vu) vu.uEarth.value.set(cx, cz, 1 / (2 * 6371000), floorY);
    let mean = 1;
    u.uCloudOn.value.set(order.length, look.clouds.show, look.clouds.halo, 0);
    haze.uCloudTau.value.set(0, 0, 0, order.length > 0 ? 1 : 0);
    haze.uCloudMean.value.set(1, 1, 1, 1);
    for (let k = 0; k < CLOUD_LAYERS; k++) {
      const l = order[k];
      if (!l) continue;
      const i = layers.indexOf(l);
      const period = NOISE_CELLS * l.size;
      const sx = Math.sin(l.heading);
      const sz = Math.cos(l.heading);
      const ku = 1 / (period * l.stretch);
      u.uCloudA.value[k].set(floorY + l.base, l.depth, l.cut, l.opacity);
      u.uCloudB.value[k].set(sx, sz, ku, 1 / period);
      u.uCloudC.value[k].set(
        wrap(l.ox - l.speed * t * ku),
        wrap(l.oz),
        wrap(t / (NOISE_CELLS * l.life) + l.ow),
        l.dome,
      );
      const lit = look.clouds.layers[i];
      if (lit) {
        u.uCloudSun.value[k].set(...lit.sun);
        u.uCloudTop.value[k].set(...lit.top);
        u.uCloudBase.value[k].set(...lit.base);
      }
      if (vu) {
        vu.uCloudMoon.value.set(...look.clouds.moon);
        const carve = carveOf(l);
        const off = carveOffsets(l, carve, t);
        vu.uVolA.value[k].set(
          1 / carve.shapeTile,
          1 / carve.detailTile,
          carve.marched ? 1 : 0,
          carve.bite,
        );
        vu.uVolB.value[k].set(...off.shape, l.cover);
        vu.uVolC.value[k].set(...off.detail, 0);
        if (lit) {
          vu.uCloudSunLo.value[k].set(...lit.lo);
          vu.uCloudSunHi.value[k].set(...lit.hi);
        }
      }
      // The shadow's box at the layer's middle, slid along the key over
      // the ground's middle and snapped to whole texels.
      const mid = floorY + l.base + l.depth / 2;
      const lean = (mid - groundMid) / sinE;
      const bx = Math.round((cx + L.x * lean) / texel) * texel - CLOUD_SHADOW.span / 2;
      const bz = Math.round((cz + L.z * lean) / texel) * texel - CLOUD_SHADOW.span / 2;
      boxes[k].set(bx, bz, 1 / CLOUD_SHADOW.span, mid);
      haze.uCloudBox.value[k].copy(boxes[k]);
      // A low deck under the eye shades nothing the look's key counts
      // (`SkyLook.clouds.shade`): its share out of both.
      const shade = look.clouds.shade[i] ?? 1;
      const pass = 1 + (layerPass(l, L.y) - 1) * shade;
      mean *= pass;
      haze.uCloudTau.value.setComponent(k, l.tau * look.clouds.show * shade);
      haze.uCloudMean.value.setComponent(k, look.clouds.show ? pass : 1);
    }
    haze.uCloudMean.value.w = look.clouds.show ? mean : 1;
    u.uCloudSea.value.set(...look.sea.colour, look.sea.k);
    u.uCloudOn.value.w = look.sea.top;
    u.uCloudSeaLevel.value = level?.mountain?.sea ?? 0;
    u.uCloudVeil.value = look.clouds.murk;
    if (!gl || !drawable()) return;
    const before = gl.getRenderTarget();
    if (shadow && (order.length > 0 || !shadowDrawn)) draw(shadowMat, shadow);
    shadowDrawn = true;
    u.uCloudTex.value = null;
    volumeOn = false;
    if (vol && order.length > 0 && look.clouds.show > 0) {
      lens.updateMatrixWorld();
      vp.multiplyMatrices(lens.projectionMatrix, lens.matrixWorldInverse);
      slabU.uInvViewProj.value.copy(vp).invert();
      lens.getWorldPosition(slabU.uEye.value);
      u.uCloudTex.value = vol.draw(
        tierNow() as "volume" | "volumeFine",
        lens,
        t,
        haze.uSunPos.value,
        String(fieldKey),
      );
      volumeOn = true;
    } else if (slabOn() && order.length > 0 && look.clouds.show > 0) {
      gl.getDrawingBufferSize(size);
      const w = Math.max(1, Math.round(size.x / 2));
      const h = Math.max(1, Math.round(size.y / 2));
      if (!slabRt || slabRt.width !== w || slabRt.height !== h) {
        slabRt?.dispose();
        slabRt = cloudTarget(w, h, THREE.HalfFloatType, node);
      }
      lens.updateMatrixWorld();
      vp.multiplyMatrices(lens.projectionMatrix, lens.matrixWorldInverse);
      slabU.uInvViewProj.value.copy(vp).invert();
      lens.getWorldPosition(slabU.uEye.value);
      const now = tierNow();
      draw(slabFor(isVolume(now) ? "slab8" : (now as SlabTier)), slabRt);
      u.uCloudTex.value = slabRt.texture;
    }
    gl.setRenderTarget(before);
  }

  return {
    uniforms: u,
    slab: slabOn,
    volume: () => volumeOn,
    whole: () => volume?.whole() ?? false,
    setTier(next) {
      tier = next;
    },
    update,
    async prepare() {
      if (!gl || !slabOn() || !isVolume(tierNow())) return;
      volume ??= createCloudVolume(gl, slabU, node);
      await volumeNoise();
      volume.ready();
    },
    warm(look, level, t, lens) {
      // A driver finishes a program at its first draw, and the volume's
      // first frames — a whole march, then a share marched and the rest
      // carried — linked three of them on the run's first frames, and the
      // dome's reading of it a fourth. The second frame here is no cut, so
      // it takes the share's way; the run's first marches whole again.
      update(look, level, t, lens);
      update(look, level, t, lens);
      volume?.refresh();
    },
    dispose() {
      u.uCloudNoise.value?.dispose();
      shadow?.dispose();
      slabRt?.dispose();
      slabMat?.dispose();
      volume?.dispose();
      shadowMat.dispose();
      quad.geometry.dispose();
      haze.uCloudShadow.value = null;
    },
  };
}
