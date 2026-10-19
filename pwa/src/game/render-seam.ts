// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEAM UNDER THE WORLD RENDERER: what `renderer.ts` draws with, whichever
// back end stands there (`gpu-backend.ts`).
//
// On WebGL it is three's WebGLRenderer, made here exactly as it always was.
// On the webgpu paths it is three's WebGPURenderer, made by the factory
// `gpu-device.ts` installs once its device is in hand — a module fetched
// only when a visit asks for it, so the WebGL build never loads three's node
// materials. That renderer is handed back TYPED AS THE WEBGL ONE for the
// members both share (the size, the pixel ratio, the tone mapping, the
// shadow map's switches, `render`): every member only WebGL has is called
// behind `native` in the renderer, and the passes behind `runsPass`. The
// conversion's later parts (`docs/webgpu.md`) narrow this as they go, and
// the last one deletes the WebGL half.

import * as THREE from "three";

import { freshBackend, type BackendState } from "./gpu-backend.ts";
import type { RegionPicture } from "./region-picture.ts";

/** What a frame cost the node renderer, in the WebGL path's own terms. */
export type SeamInfo = {
  calls: number;
  triangles: number;
  points: number;
  programs: number;
  geometries: number;
  textures: number;
};

export type RenderSeam = {
  /** The renderer — the real WebGLRenderer when `native`, else the
   * WebGPURenderer typed as one (see the header). */
  readonly gl: THREE.WebGLRenderer;
  /** Whether `gl` is three's WebGLRenderer. */
  readonly native: boolean;
  /** Resolves once the renderer can draw (WebGPURenderer's `init`). */
  readonly ready: Promise<void>;
  /** What drew the frame; the renderer writes its quarantine into it. */
  readonly state: BackendState;
  /** The largest 2D texture the device takes, px. */
  maxTextureSize(): number;
  /** Before a frame's draws: the node renderer's counters zeroed. */
  beginFrame(): void;
  /** The node renderer's counters since `beginFrame` (unused on WebGL,
   * whose picture reports its own). */
  info(): SeamInfo;
  dispose(): void;
};

export type SeamOptions = { antialias: boolean; preserveDrawingBuffer: boolean };

type Factory = (canvas: HTMLCanvasElement, options: SeamOptions) => RenderSeam;
let factory: Factory | null = null;

/** The node renderer's maker (`gpu-device.ts`), or null for WebGL. */
export function setSeamFactory(next: Factory | null): void {
  factory = next;
}

/** The renderer over `canvas`: the node one if a factory is installed. */
export function openSeam(canvas: HTMLCanvasElement, options: SeamOptions): RenderSeam {
  return factory ? factory(canvas, options) : webglSeam(canvas, options);
}

function webglSeam(canvas: HTMLCanvasElement, options: SeamOptions): RenderSeam {
  const gl = new THREE.WebGLRenderer({
    canvas,
    antialias: options.antialias,
    powerPreference: "high-performance",
    preserveDrawingBuffer: options.preserveDrawingBuffer,
  });
  globalThis.__SH_BACKEND__ = "webgl";
  const none: SeamInfo = {
    calls: 0,
    triangles: 0,
    points: 0,
    programs: 0,
    geometries: 0,
    textures: 0,
  };
  return {
    gl,
    native: true,
    ready: Promise.resolve(),
    state: freshBackend("webgl"),
    maxTextureSize: () => gl.capabilities.maxTextureSize,
    beginFrame: () => {},
    info: () => none,
    dispose() {
      gl.dispose();
      gl.forceContextLoss(); // a phone keeps only a few contexts alive at once
    },
  };
}

/** The webgpu paths' picture: the scene straight onto the canvas — the
 * region's grade is a pass not yet ported (`grade-pass`). */
export function directPicture(seam: RenderSeam): RegionPicture {
  const last = { calls: 0, triangles: 0, points: 0 };
  return {
    load: () => null,
    draw(scene, camera) {
      seam.gl.render(scene, camera);
      const info = seam.info();
      last.calls = info.calls;
      last.triangles = info.triangles;
      last.points = info.points;
    },
    setBuzz: () => {},
    setBlaze: () => {},
    info: () => ({ ...last }),
    dispose: () => {},
  };
}
