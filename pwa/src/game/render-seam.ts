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

import type { GpuMode } from "./benchmark-report.ts";
import { freshBackend, type BackendState } from "./gpu-backend.ts";
import type { GpuTimer } from "./gpu-timer.ts";
import type { WoodsKit } from "./forest-nodes.ts";
import type { HazeUniforms } from "./haze.ts";
import type { NodePicture } from "./region-picture.ts";

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
  /** Hang what the node renderer draws the haze and the lights with on
   * `scene` (`gpu-dress.ts`): nothing on WebGL, whose materials carry
   * their own GLSL (`haze.ts`). Once, before the first frame. */
  dress(scene: THREE.Scene, haze: HazeUniforms): void;
  /** Before a frame's draws: the node renderer's counters zeroed and what
   * the dressing reads brought up to the frame. */
  beginFrame(): void;
  /** The node renderer's half of the picture (`region-picture.ts`): the
   * canvas's samples, the grade's node pass (`grade-tsl.ts`), where the
   * haze mixes and the counters. Null on WebGL, whose picture is its own. */
  readonly post: NodePicture | null;
  /** The node renderer's materials for the woods (`forest-tsl.ts`), made
   * by the dressing: null on WebGL, whose woods are one batch of GLSL
   * (`forest-batch.ts`), and before `dress`. */
  woods(): WoodsKit | null;
  /** After a frame's draws: what `beginFrame` stood in for put back. */
  endFrame(): void;
  /** Resolves once the device has run every draw handed to it so far: a
   * software device builds a pipeline's code the first time it runs it, so
   * the warm-up waits here under the card (`warmNode`). At once on WebGL. */
  settled(): Promise<void>;
  /** The node renderer's counters since `beginFrame` (unused on WebGL,
   * whose picture reports its own). */
  info(): SeamInfo;
  /** THE NODE RENDERER'S TIMER (`gpu-timer-node.ts`), cut at `mode`; null
   * on WebGL, whose instruments time its context themselves. */
  timer(mode: GpuMode): GpuTimer | null;
  /** THE FENCE, waited for in the background (`renderer-instruments.ts`):
   * resolves with the ms from now until the device has run every draw
   * handed to it so far. Null where a pixel read back is the fence (WebGL
   * and the node renderer's WebGL2 back end, `drainContext`). */
  fence(): Promise<number> | null;
  /** The WebGL2 context a pixel read back waits on: WebGL's own, the node
   * renderer's WebGL2 back end's, or null on a WebGPU device. */
  drainContext(): WebGL2RenderingContext | null;
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
    dress: () => {},
    beginFrame: () => {},
    post: null,
    woods: () => null,
    endFrame: () => {},
    settled: () => Promise.resolve(),
    info: () => none,
    timer: () => null,
    fence: () => null,
    drainContext: () => gl.getContext() as WebGL2RenderingContext,
    dispose() {
      gl.dispose();
      gl.forceContextLoss(); // a phone keeps only a few contexts alive at once
    },
  };
}
