// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GPU SKY — the MEDIUM and HIGH skies (`sky-gpu-plan.ts` says what
// each draws; `sky-gpu-glsl.ts` is the model they run). Render targets on
// the GPU, drawn as one full-screen quad each:
//
//   * the TRANSMITTANCE and MULTIPLE-SCATTERING tables, once — the air
//     never changes under a run;
//   * the SKY-VIEW table, again whenever what it shows has moved (the sun
//     a hundredth of a degree, the exposure, a veil) — on the LOW grid's
//     own layout, so `skyColour(dir)` reads it unchanged through the shared
//     `uSkyView` slot; under a LID the deck is the LOW grid's at every
//     tier, so the slot is handed back to it;
//   * on HIGH, the AERIAL-PERSPECTIVE VOLUME every frame (it is the lens's
//     own): the share of the air's light along each ray the sun gives,
//     marched toward the sun through the map's ground (`setGround`), read
//     by `haze.ts`'s `aerialShade` in every world material.
//
// Half-float targets: a WebGL2 context that cannot render into them (no
// `EXT_color_buffer_float` or `_half_float`) draws the LOW sky at every
// stop — the game never asks for more than the machine has.

import * as THREE from "three";
import type { Heightfield } from "@engine";

import type { HazeUniforms } from "./haze.ts";
import {
  FROXEL_ATLAS,
  FROXELS,
  hazeTint,
  SKY_REDRAW,
  SKY_TABLES,
  SKY_TIER_LOOK,
  type Rgb,
} from "./sky-gpu-plan.ts";
import {
  FROXEL_FRAGMENT,
  MS_FRAGMENT,
  QUAD_VERTEX,
  TRANS_FRAGMENT,
  VIEW_FRAGMENT,
} from "./sky-gpu-glsl.ts";
import type { SkyLook } from "./sky.ts";
import { SKY_VIEW_AZ, SKY_VIEW_EL } from "./sky-table-format.ts";
import type { Tier } from "./settings-video.ts";

export type SkyGpu = {
  /** The tier asked for (the DISTANCE row's `SKY_TIER`). */
  setTier(tier: Tier): void;
  /** The tier drawn: the one asked for, LOW where the GPU cannot. */
  tier(): Tier;
  /** The map's ground the air's shadows are marched through (null: none). */
  setGround(ground: Heightfield | null): void;
  /** Draw what is due for this look and lens and hand it to the haze's
   * uniforms — after `writeHaze`, before the frame is drawn. */
  update(look: SkyLook, camera: THREE.Camera): void;
  dispose(): void;
};

/** A LAB'S HAND ON THE TIER (`make sky ARGS=--sheet=skytier`): every sky
 * built after this draws `tier` whatever its DISTANCE row says; null gives
 * the row back. Never set by the game. */
let forced: Tier | null = null;
export function forceSkyTier(tier: Tier | null): void {
  forced = tier;
}

/** Whether `gl` can render into the half-float tables. */
export function gpuSkyAvailable(gl: THREE.WebGLRenderer): boolean {
  return (
    gl.capabilities.isWebGL2 &&
    (gl.extensions.has("EXT_color_buffer_float") ||
      gl.extensions.has("EXT_color_buffer_half_float"))
  );
}

function target(w: number, h: number): THREE.WebGLRenderTarget {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  rt.texture.colorSpace = THREE.NoColorSpace;
  return rt;
}

function pass(
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
  defines: Record<string, number> = {},
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: QUAD_VERTEX,
    fragmentShader,
    uniforms,
    defines,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
}

/** The ground as a texture of heights, m, ≤ 512 texels a side, and its
 * world-to-uv box (the origin less half a texel, one over the span). */
function groundTexture(g: Heightfield): { tex: THREE.DataTexture; box: THREE.Vector4 } {
  const step = Math.max(1, Math.ceil(Math.max(g.cols, g.rows) / 512));
  const w = Math.floor((g.cols - 1) / step) + 1;
  const h = Math.floor((g.rows - 1) / step) + 1;
  const data = new Uint16Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      data[j * w + i] = THREE.DataUtils.toHalfFloat(g.data[j * step * g.cols + i * step]);
  const tex = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  const d = g.cell * step;
  return {
    tex,
    box: new THREE.Vector4(g.originX - d / 2, g.originZ - d / 2, 1 / (w * d), 1 / (h * d)),
  };
}

export function createSkyGpu(gl: THREE.WebGLRenderer | null, haze: HazeUniforms): SkyGpu {
  const able = gl !== null && gpuSkyAvailable(gl);
  let asked: Tier = "low";
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);

  // The tables built once, the first time a GPU tier is drawn.
  let trans: THREE.WebGLRenderTarget | null = null;
  let ms: THREE.WebGLRenderTarget | null = null;
  const tables = {
    uTrans: { value: null as THREE.Texture | null },
    uMs: { value: null as THREE.Texture | null },
  };

  let view: THREE.WebGLRenderTarget | null = null;
  let viewMat: THREE.ShaderMaterial | null = null;
  const viewU = {
    ...tables,
    uSize: { value: new THREE.Vector2() },
    uElevation: { value: 0 },
    uRadius: { value: 6360 },
    uExpose: { value: new THREE.Vector4() },
  };
  /** What the sky-view table was last drawn for. */
  const drawn = { elevation: NaN, radius: NaN, exposure: NaN, mean: NaN, night: NaN, veil: NaN };

  let ap: THREE.WebGLRenderTarget | null = null;
  const apU = {
    ...tables,
    uInvViewProj: { value: new THREE.Matrix4() },
    uEye: { value: new THREE.Vector3() },
    uSun: { value: new THREE.Vector3() },
    uRadius: { value: 6360 },
    uHazeLaw: { value: new THREE.Vector3() },
    uGround: { value: null as THREE.Texture | null },
    uGroundBox: { value: new THREE.Vector4(0, 0, 1, 1) },
    uGroundOn: { value: new THREE.Vector4(0, 0, 0, 0) },
  };
  const apMat = pass(FROXEL_FRAGMENT, apU);
  let ground: THREE.DataTexture | null = null;
  const tint: Rgb = [1, 1, 1];

  const tierNow = (): Tier => (able ? (forced ?? asked) : "low");

  function draw(material: THREE.Material, rt: THREE.WebGLRenderTarget): void {
    quad.material = material;
    gl!.setRenderTarget(rt);
    gl!.render(scene, camera);
  }

  function buildTables(): void {
    const t = SKY_TABLES;
    trans = target(t.trans.width, t.trans.height);
    ms = target(t.ms.size, t.ms.size);
    const tm = pass(TRANS_FRAGMENT, {});
    draw(tm, trans);
    tables.uTrans.value = trans.texture;
    const mm = pass(MS_FRAGMENT, tables);
    draw(mm, ms);
    tables.uMs.value = ms.texture;
    tm.dispose();
    mm.dispose();
  }

  /** The sky-view table and its material, for the tier drawn. */
  function viewFor(tier: Tier): void {
    const look = SKY_TIER_LOOK[tier];
    if (!look.lut) return;
    const [w, h] = look.lut;
    if (view && view.width === w && view.height === h && viewMat?.defines.STEPS === look.steps)
      return;
    view?.dispose();
    viewMat?.dispose();
    view = target(w, h);
    viewMat = pass(VIEW_FRAGMENT, viewU, { STEPS: look.steps });
    viewU.uSize.value.set(w, h);
    drawn.elevation = NaN;
  }

  const moved = (a: number, b: number): boolean =>
    !(Math.abs(a - b) <= SKY_REDRAW.share * Math.max(Math.abs(a), Math.abs(b), 1e-9));

  function showGrid(): void {
    haze.uSkyView.value = haze.uSkyGrid.value;
    haze.uSkyViewSize.value.set(SKY_VIEW_AZ, SKY_VIEW_EL);
  }

  return {
    setTier(tier) {
      asked = tier;
    },
    tier: tierNow,
    setGround(g) {
      ground?.dispose();
      ground = null;
      apU.uGround.value = null;
      apU.uGroundOn.value.x = 0;
      if (!g) return;
      const built = groundTexture(g);
      ground = built.tex;
      apU.uGround.value = ground;
      apU.uGroundBox.value.copy(built.box);
      apU.uGroundOn.value.x = 1;
    },
    update(look, lens) {
      const tier = tierNow();
      const want = SKY_TIER_LOOK[tier];
      const lidded = look.cloud.genus === 3;
      if (!gl || !want.lut) {
        showGrid();
        haze.uHazeTint.value.set(1, 1, 1);
        haze.uApOn.value.x = 0;
        return;
      }
      const before = gl.getRenderTarget();
      if (!trans) buildTables();
      viewFor(tier);
      // THE SKY-VIEW TABLE, as the LOW grid is exposed.
      if (lidded) showGrid();
      else {
        const radius = 6360 + Math.max(0.002, look.altitude / 1000);
        if (
          Math.abs(look.elevation - drawn.elevation) >= SKY_REDRAW.elevation ||
          radius !== drawn.radius ||
          moved(look.exposure, drawn.exposure) ||
          moved(look.domeMean, drawn.mean) ||
          Math.abs(look.night - drawn.night) > SKY_REDRAW.share ||
          Math.abs(look.veil - drawn.veil) > SKY_REDRAW.share
        ) {
          viewU.uElevation.value = look.elevation;
          viewU.uRadius.value = radius;
          viewU.uExpose.value.set(look.exposure, look.domeMean, look.night, look.veil);
          draw(viewMat!, view!);
          Object.assign(drawn, {
            elevation: look.elevation,
            radius,
            exposure: look.exposure,
            mean: look.domeMean,
            night: look.night,
            veil: look.veil,
          });
        }
        haze.uSkyView.value = view!.texture;
        haze.uSkyViewSize.value.set(view!.width, view!.height);
      }
      // THE HAZE: the model's extinction per channel.
      hazeTint(look.haze, look.altitude, tint);
      haze.uHazeTint.value.set(tint[0], tint[1], tint[2]);
      // THE AERIAL-PERSPECTIVE VOLUME, the lens's own, every frame.
      const air = want.froxels && !lidded && look.sun.y > -0.05;
      if (air && (lens as THREE.PerspectiveCamera).isPerspectiveCamera) {
        if (!ap) ap = target(FROXEL_ATLAS.width, FROXEL_ATLAS.height);
        lens.updateMatrixWorld();
        const vp = haze.uApViewProj.value;
        vp.multiplyMatrices(lens.projectionMatrix, lens.matrixWorldInverse);
        apU.uInvViewProj.value.copy(vp).invert();
        lens.getWorldPosition(apU.uEye.value);
        apU.uSun.value.set(look.sun.x, look.sun.y, look.sun.z);
        apU.uRadius.value = 6360 + Math.max(0.002, look.altitude / 1000);
        apU.uHazeLaw.value.set(look.haze, look.hazeLift, haze.uHazeFloor.value);
        draw(apMat, ap);
        haze.uAp.value = ap.texture;
        haze.uApOn.value.set(1, FROXELS.depth, 0, 0);
      } else haze.uApOn.value.x = 0;
      gl.setRenderTarget(before);
    },
    dispose() {
      if (haze.uSkyView.value !== haze.uSkyGrid.value) showGrid();
      haze.uAp.value = null;
      haze.uApOn.value.x = 0;
      for (const rt of [trans, ms, view, ap]) rt?.dispose();
      viewMat?.dispose();
      apMat.dispose();
      ground?.dispose();
      quad.geometry.dispose();
    },
  };
}
