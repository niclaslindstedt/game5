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
import type { HazeUniforms } from "./haze.ts";
import { regionOf } from "@engine";

import { gradeOf, isNeutral } from "./colour-grade.ts";
import { drawsStraight, type RegionPicture } from "./region-picture.ts";
import { summerShown } from "./season-look.ts";
import { ANTIALIAS_SAMPLES, type AntialiasLevel } from "./settings-video.ts";

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
  /** Whether WebGL would draw this frame straight onto the canvas, where
   * three hazes in display space (`region-picture.ts`'s `drawsStraight`):
   * the node renderer's haze mixes where WebGL's would. Nothing on WebGL. */
  hazeInDisplay(on: boolean): void;
  /** After a frame's draws: what `beginFrame` stood in for put back. */
  endFrame(): void;
  /** Resolves once the device has run every draw handed to it so far: a
   * software device builds a pipeline's code the first time it runs it, so
   * the warm-up waits here under the card (`warmNode`). At once on WebGL. */
  settled(): Promise<void>;
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
    dress: () => {},
    beginFrame: () => {},
    hazeInDisplay: () => {},
    endFrame: () => {},
    settled: () => Promise.resolve(),
    info: () => none,
    dispose() {
      gl.dispose();
      gl.forceContextLoss(); // a phone keeps only a few contexts alive at once
    },
  };
}

/** The webgpu paths' picture: the scene straight onto the canvas — the
 * region's grade is a pass not yet ported (`grade-pass`). It still keeps
 * what WebGL's picture would have drawn through (`drawsStraight`: the
 * grade, the buzz, the blaze, and the ANTIALIAS row against the canvas as
 * it was made, `canvas` samples) and tells the seam each frame, so the haze
 * is mixed where WebGL's is (`hazeInDisplay`). */
export function directPicture(
  seam: RenderSeam,
  antialias: () => AntialiasLevel,
  canvas: number,
): RegionPicture {
  const last = { calls: 0, triangles: 0, points: 0 };
  let graded = false;
  let buzz = 0;
  let burning = false;
  return {
    load(level) {
      graded = !isNeutral(gradeOf(regionOf(level).id, summerShown()));
      return null;
    },
    draw(scene, camera) {
      const samples = ANTIALIAS_SAMPLES[antialias()];
      seam.hazeInDisplay(drawsStraight({ graded, buzz, burning, samples, canvas }));
      seam.gl.render(scene, camera);
      const info = seam.info();
      last.calls = info.calls;
      last.triangles = info.triangles;
      last.points = info.points;
    },
    setBuzz(b) {
      buzz = b > 1e-3 ? b : 0;
    },
    setBlaze(b) {
      burning = !!b && b.heat + b.flash + b.smoke > 1e-3;
    },
    info: () => ({ ...last }),
    dispose: () => {},
  };
}
