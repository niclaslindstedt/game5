// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GPU'S OWN STOPWATCH ON THE NODE RENDERER (`docs/webgpu.md`, part 14):
// the same `GpuTimer` as WebGL's (`gpu-timer.ts`), answered by three's
// timestamp queries instead of `EXT_disjoint_timer_query_webgl2`.
//
// HOW IT IS CUT. A timestamp query brackets a whole RENDER PASS (WebGPU
// writes one at a pass's start and one at its end, and three's WebGL2 back
// end times each pass with the same extension WebGL's timer uses). So a
// slice here is every pass that began while it was on top of the stack:
// the trail maps under `trail`, the skiers' atlas under `hero`, the picture
// under `scene`, the grade under `grade`, the overlay under `overlay`. A
// pass drawn into a shadow map's depth (three names it `ShadowDepthTexture`)
// is the `shadow` slice whatever is on top, as WebGL's timer pushes it. A
// pass begun with nothing pushed (the sky's and the clouds' passes, which
// WebGL does not time either) is not counted. SPLIT cannot cut inside a
// pass, so it is PASSES here, and the report says so.
//
// HOW IT IS ANSWERED. Each frame's passes are noted by the query's own name
// (three's `uid`, which ends in the frame's number: `info.frame` is moved on
// here a frame at a time, since three moves it only inside its own
// animation loop), and the frame asks three to resolve what is written.
// The answer lands frames later; a frame is summed once every pass it noted
// is in, and given up on when it lags `MAX_LAG` frames.
//
// This module reaches three's node renderer only through the members named
// in `TimedRenderer`, so it imports nothing from `three/webgpu`.

import { noGpu, type GpuMode, type GpuSlice, type GpuTotals } from "./benchmark-report.ts";
import type { GpuTimer } from "./gpu-timer.ts";

/** A query pool's answers: each pass's milliseconds by its `uid`. */
type Pool = { timestamps: Map<string, number> };

/** The members of three's node renderer the timer reads and moves. */
export type TimedRenderer = {
  info: { frame: number };
  backend: {
    trackTimestamp: boolean;
    readonly isWebGPUBackend?: boolean;
    readonly hasTimestamp?: boolean;
    readonly device?: { features: { has(name: string): boolean } } | null;
    timestampQueryPool: Record<string, Pool | null | undefined>;
    initTimestampQuery(type: string, uid: string, descriptor?: unknown): void;
  };
  getRenderTarget(): { depthTexture?: { name?: string } | null } | null;
  resolveTimestampsAsync(type?: string): Promise<number | undefined>;
};

/** One frame's passes still out (by `uid`), what those in have said, and
 * what the frame was drawn without. */
type FrameRecord = {
  out: Map<string, GpuSlice>;
  ms: Partial<Record<GpuSlice, number>>;
  tag: string;
};

/** Frames an answer may lag before its frame is given up on. */
const MAX_LAG = 12;

/** Whether `renderer`'s back end can write timestamps at all. */
export function timesPasses(renderer: TimedRenderer): boolean {
  const b = renderer.backend;
  if (b.isWebGPUBackend === true) return b.device?.features.has("timestamp-query") === true;
  return b.hasTimestamp === true;
}

export function createNodeTimer(renderer: TimedRenderer, asked: GpuMode): GpuTimer {
  const can = asked !== "off" && timesPasses(renderer);
  const mode: GpuMode = can ? "passes" : "off";
  const backend = renderer.backend;
  const stack: GpuSlice[] = [];
  const open: FrameRecord[] = [];
  let current: FrameRecord = { out: new Map(), ms: {}, tag: "" };
  let sums: GpuTotals = noGpu();
  let live = can;

  const init = backend.initTimestampQuery;
  if (can) {
    backend.trackTimestamp = true;
    backend.initTimestampQuery = function (type, uid, descriptor) {
      if (live && type === "render" && stack.length > 0) {
        const shadow = renderer.getRenderTarget()?.depthTexture?.name === "ShadowDepthTexture";
        current.out.set(uid, shadow ? "shadow" : stack[stack.length - 1]);
      }
      init.call(this, type, uid, descriptor);
    };
  }

  /** File every answer the pool holds against the frames waiting on it. */
  const collect = (): void => {
    const pool = backend.timestampQueryPool.render;
    if (!pool) return;
    for (const record of open) {
      for (const [uid, slice] of record.out) {
        const ms = pool.timestamps.get(uid);
        if (ms === undefined) continue;
        record.ms[slice] = (record.ms[slice] ?? 0) + ms;
        record.out.delete(uid);
      }
    }
    while (open.length > 0 && (open[0].out.size === 0 || open.length > MAX_LAG)) {
      const record = open.shift()!;
      if (record.out.size > 0) {
        sums.dropped += 1;
        continue;
      }
      let card = 0;
      for (const [slice, ms] of Object.entries(record.ms) as [GpuSlice, number][]) {
        card += ms;
        if (record.tag === "") sums.ms[slice] = (sums.ms[slice] ?? 0) + ms;
      }
      if (record.tag === "") sums.frames += 1;
      const t = (sums.tags[record.tag] ??= { frames: 0, ms: 0 });
      t.frames += 1;
      t.ms += card;
    }
  };

  return {
    supported: can,
    mode,
    push(slice) {
      if (live) stack.push(slice);
    },
    pop() {
      if (live) stack.pop();
    },
    enter() {},
    inScene() {
      return false;
    },
    frame(tag = "") {
      if (!live) return;
      stack.length = 0;
      current.tag = tag;
      if (current.out.size > 0) open.push(current);
      current = { out: new Map(), ms: {}, tag: "" };
      // The next frame's queries are named apart from this one's.
      renderer.info.frame += 1;
      void renderer.resolveTimestampsAsync("render").then(collect, () => undefined);
    },
    totals() {
      const tags: GpuTotals["tags"] = {};
      for (const [tag, t] of Object.entries(sums.tags)) tags[tag] = { ...t };
      return { frames: sums.frames, dropped: sums.dropped, ms: { ...sums.ms }, tags };
    },
    reset() {
      sums = noGpu();
      open.length = 0;
      current = { out: new Map(), ms: {}, tag: "" };
    },
    dispose() {
      if (!can || !live) return;
      live = false;
      backend.trackTimestamp = false;
      backend.initTimestampQuery = init;
    },
  };
}
