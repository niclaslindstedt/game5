// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A RENDERER OF ITS OWN, on the back end a link asks for (`?renderer=`,
// `gpu-backend.ts`, `docs/webgpu.md`): what the gear stage behind the
// rider and gear cards (`gear-stage.ts`) and every lab page that draws its
// own sheet (`pwa/src/tools/*-harness.ts`) make in place of a bare
// `WebGLRenderer`.
//
// On WebGL it IS the bare `WebGLRenderer`, made with the same switches the
// page made before, so a WebGL picture is the same to the bit. On the
// webgpu paths it is three's node renderer on the device the world renderer
// shares (`gpu-device.ts`, fetched as its own chunk only then), handed back
// typed as WebGL's for the members both have, and every scene it draws is
// dressed the first time (`gpu-dress.ts`: the haze as the fog node, the
// key's, the sky's and the lamps' light nodes, every twin and graft) so a
// material made the game's way draws as the game draws it.
//
// A WORLD RENDERER'S page (the labs that draw through `renderer.ts`) asks
// for the back end with `labBackend` before it makes one: the renderer's
// own seam is then made on it.

import * as THREE from "three";

import { pageBackend, type Backend, type BackendAsk } from "./gpu-backend.ts";
import type { HazeUniforms } from "./haze.ts";

export type OwnGpuOptions = {
  antialias?: boolean;
  preserveDrawingBuffer?: boolean;
  /** The haze the page's own materials were made with (`hazeMaterial`):
   * the node renderer's fog reads it. A still, clear one when unsaid. */
  haze?: HazeUniforms;
  /** The back end; the page's (`pageBackend`) when unsaid. */
  backend?: BackendAsk;
};

export type OwnGpu = {
  /** The renderer: three's WebGLRenderer when `native`, else the node
   * renderer typed as one (see the header). */
  readonly renderer: THREE.WebGLRenderer;
  readonly native: boolean;
  /** What really draws: `webgpu` asked with no adapter runs `webgpu-gl`. */
  readonly running: Backend;
  /** Resolves once the device has run every draw handed to it so far. */
  settled(): Promise<void>;
};

/** The back end the page asks for (`pageBackend`: the link's word, the game's ask, else a lab's WebGL). */
export function askedBackend(): BackendAsk {
  const query = typeof location === "undefined" ? "" : location.search;
  return pageBackend(query);
}

/** For a page that draws through the world renderer: the device made and
 * the seam's factory installed for the back end asked (`prepareGpu`). */
export async function labBackend(asked: BackendAsk = askedBackend()): Promise<BackendAsk> {
  if (asked !== "webgl") await import("./gpu-device.ts").then((m) => m.prepareGpu(asked));
  return asked;
}

export async function createGpu(
  canvas: HTMLCanvasElement,
  options: OwnGpuOptions = {},
): Promise<OwnGpu> {
  const asked = options.backend ?? askedBackend();
  if (asked === "webgl") {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: options.antialias ?? false,
      ...(options.preserveDrawingBuffer ? { preserveDrawingBuffer: true } : {}),
    });
    globalThis.__SH_BACKEND__ ??= "webgl";
    return { renderer, native: true, running: "webgl", settled: () => Promise.resolve() };
  }
  const [{ ownRenderer }, { createHazeUniforms }] = await Promise.all([
    import("./gpu-device.ts"),
    import("./haze.ts"),
  ]);
  const haze = options.haze ?? createHazeUniforms();
  const own = await ownRenderer(canvas, { antialias: options.antialias ?? false }, asked, haze);
  return {
    renderer: own.renderer as unknown as THREE.WebGLRenderer,
    native: false,
    running: own.running,
    settled: own.settled,
  };
}
