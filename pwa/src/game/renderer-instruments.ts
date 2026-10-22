// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD RENDERER'S INSTRUMENTS (`renderer.ts`): the GPU's timer and the
// hooks that cut a frame into its slices, the A/B reading's hidden
// subsystems, the fence, and the frame's bill — everything the developer
// page and the benchmark read (`DevRenderer`), and nothing the picture needs.
//
// On the webgpu paths the timer is the node renderer's timestamp queries
// (`gpu-timer-node.ts`), the fence is the device's queue (waited for in the
// background, `drainLater`) or, on three's WebGL2 back end, its context's
// pixel read back, and the bill is read off the node renderer's own
// counters in the WebGL path's terms (`render-seam.ts`).

import type * as THREE from "three";

import type { FrameCost, GpuMode, GpuSlice, Hideable } from "./benchmark-report.ts";
import { createGpuTimer, type GpuTimer } from "./gpu-timer.ts";
import type { RenderSeam } from "./render-seam.ts";
import { SLICE_OF_GROUP } from "./renderer-rider.ts";
import { depthByKind } from "./shadow-depth.ts";

/** The frame's stretches, `performance.now()` at each boundary. */
export type FrameMarks = {
  opened: number;
  posed: number;
  trailed: number;
  built: number;
  closed: number;
};

export type Instruments = {
  /** The GPU's timer as last set (OFF unless the benchmark asks). */
  readonly timer: GpuTimer;
  setTimer(mode: GpuMode): void;
  /** What the frame is drawn WITHOUT, and the tag its time is filed under. */
  readonly hidden: ReadonlySet<Hideable>;
  readonly tag: string;
  setHidden(names: readonly Hideable[], tag: string): void;
  /** Wait for the GPU to finish, ms (one pixel read back; 0 on a WebGPU
   * device, whose wait is `drainLater`). */
  drain(): number;
  /** THE ASYNC FENCE: the ms until the device has run every draw handed to
   * it so far, or null where `drain` already waited (a WebGL2 context). */
  drainLater(): Promise<number> | null;
  /** Write the frame's bill into `cost`: the stretches, and the scene's
   * draw calls and triangles as the picture counted them. */
  bill(cost: FrameCost, at: FrameMarks, scene: { calls: number; triangles: number }): void;
  dispose(): void;
};

export function createInstruments(seam: RenderSeam): Instruments {
  const gl = seam.gl;
  const native = seam.native;
  const ctx = native ? (gl.getContext() as WebGL2RenderingContext) : null;
  const off = (): GpuTimer => createGpuTimer(null as unknown as WebGL2RenderingContext, "off");
  let timer: GpuTimer = ctx ? createGpuTimer(ctx, "off") : off();
  /** The context a pixel read back fences, asked once it exists. */
  let fenced: WebGL2RenderingContext | null | undefined;
  let hidden: ReadonlySet<Hideable> = new Set();
  let tag = "";
  /** The one pixel `drain` reads back. */
  const drained = new Uint8Array(4);
  if (native) {
    const sliceOf = new WeakMap<THREE.Object3D, GpuSlice>();
    const bucket = (object: THREE.Object3D): GpuSlice => {
      let slice = sliceOf.get(object);
      if (slice !== undefined) return slice;
      slice = "scene";
      for (let o: THREE.Object3D | null = object; o; o = o.parent) {
        const named = SLICE_OF_GROUP[o.name];
        if (named !== undefined) {
          slice = named;
          break;
        }
      }
      sliceOf.set(object, slice);
      return slice;
    };
    // SPLIT cuts the scene's pass between subsystems; the sun's map is a slice of its own.
    const direct = gl.renderBufferDirect.bind(gl);
    gl.renderBufferDirect = (camera, sc, geometry, material, object, group) => {
      if (timer.mode === "split" && timer.inScene()) timer.enter(bucket(object));
      direct(camera, sc, geometry, material, object, group);
    };
    const shadowPass = depthByKind(gl.shadowMap.render.bind(gl.shadowMap));
    gl.shadowMap.render = (lights, sc, camera) => {
      const map = gl.shadowMap;
      const live =
        timer.mode !== "off" &&
        map.enabled &&
        (map.autoUpdate || map.needsUpdate) &&
        lights.length > 0;
      if (live) timer.push("shadow");
      shadowPass(lights, sc, camera);
      if (live) timer.pop();
    };
  }
  return {
    get timer() {
      return timer;
    },
    setTimer(mode) {
      timer.dispose();
      timer = ctx ? createGpuTimer(ctx, mode) : (seam.timer(mode) ?? off());
      // The node renderer knows whether its device writes timestamps only
      // once it is ready, and the benchmark asks before that: asked again
      // then, unless something else was asked in between.
      const made = timer;
      if (!ctx && mode !== "off" && !made.supported) {
        void seam.ready.then(() => {
          if (timer !== made) return;
          made.dispose();
          timer = seam.timer(mode) ?? off();
        });
      }
    },
    get hidden() {
      return hidden;
    },
    get tag() {
      return tag;
    },
    setHidden(names, next) {
      hidden = new Set(names);
      tag = next;
    },
    drain() {
      fenced ??= seam.drainContext();
      if (!fenced) return 0;
      const at = performance.now();
      fenced.readPixels(0, 0, 1, 1, fenced.RGBA, fenced.UNSIGNED_BYTE, drained);
      return performance.now() - at;
    },
    drainLater: () => seam.fence(),
    bill(cost, at, scene) {
      cost.poseMs = at.posed - at.opened;
      cost.trailMs = at.trailed - at.posed;
      cost.worldMs = at.built - at.trailed;
      cost.submitMs = at.closed - at.built;
      cost.frameMs = at.closed - at.opened;
      cost.calls = scene.calls;
      cost.triangles = scene.triangles;
      if (native) {
        cost.programs = gl.info.programs?.length ?? 0;
        cost.geometries = gl.info.memory.geometries;
        cost.textures = gl.info.memory.textures;
      } else {
        const info = seam.info();
        cost.programs = info.programs;
        cost.geometries = info.geometries;
        cost.textures = info.textures;
      }
    },
    dispose() {
      timer.dispose();
    },
  };
}
