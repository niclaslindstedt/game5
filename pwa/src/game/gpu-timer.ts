// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GPU'S OWN STOPWATCH — how long the graphics card spent on each slice
// of a frame, off `EXT_disjoint_timer_query_webgl2`, for the benchmark's
// report (`GpuTotals` in `benchmark-report.ts`).
//
// WHY NOT THE FENCE. `drain` reads one pixel back and times the wait, which
// is the card's work PLUS the trip to the browser's GPU process and back, and
// says nothing about WHICH work. A timer query is answered by the card itself:
// the nanoseconds between the commands that began and ended it.
//
// HOW IT IS CUT. One query runs at a time (the extension allows no nesting),
// so the slices are a STACK: `push` pauses the slice underneath and starts its
// own, `pop` ends it and resumes the one below — the shadow pass three runs
// inside `gl.render` is a slice pushed over the scene's. In SPLIT mode the
// scene is cut further as it is drawn: `enter` swaps the innermost slice
// every time the draw calls pass from one subsystem to the next.
//
// HOW TO TRUST IT. A query is answered frames later, so results are gathered
// by frame and a frame is only counted once EVERY one of its queries is in; a
// frame the driver calls disjoint (the clock jumped: a power state, another
// context) is thrown away whole. And on a TILED GPU (every phone, every
// laptop with the GPU on the processor) the fragment work of a render pass is
// done when the pass ENDS, so a query boundary in the middle of one is a
// boundary the driver has to cut the pass at — SPLIT's slices are only
// honest where their sum matches PASSES' `scene`; where they do not (on the
// laptop GPU this was built on, SPLIT's sum was five times the pass), the
// A/B reading is the one to trust: the benchmark hides one subsystem a
// frame in turn (`?ab=1`) and each frame's card time is summed under what it
// was drawn without (`frame`'s tag), so the machine's drift lands on every
// variant alike.

import { noGpu, type GpuMode, type GpuSlice, type GpuTotals } from "./benchmark-report.ts";

export type GpuTimer = {
  /** Whether this context can time anything at all. */
  readonly supported: boolean;
  /** The mode the timer was asked for, OFF where it is not supported. */
  readonly mode: GpuMode;
  /** Start `slice` over whatever is running (which pauses until `pop`). */
  push(slice: GpuSlice): void;
  pop(): void;
  /** SPLIT: the draw calls from here are `slice`'s, in place of the
   * innermost one. A no-op in any other mode, and outside a scene pass. */
  enter(slice: GpuSlice): void;
  /** Whether the innermost slice is the scene's (what `enter` may swap). */
  inScene(): boolean;
  /** The frame is submitted: gather whatever the card has answered. `tag`
   * names what the frame was drawn WITHOUT (an interleaved A/B reading):
   * a tagged frame is summed under its tag alone, never into the slices. */
  frame(tag?: string): void;
  /** Every whole frame answered so far, summed. */
  totals(): GpuTotals;
  /** Forget everything timed so far (the benchmark's green light). */
  reset(): void;
  dispose(): void;
};

/** The subsystems a SPLIT scene is cut into, and the scene's own slice. */
const SCENE_SLICES: ReadonlySet<GpuSlice> = new Set<GpuSlice>([
  "scene",
  "sky",
  "terrain",
  "forest",
  "field",
  "checkpoints",
  "cloud",
  "spray",
  "snowfall",
  "wildlife",
]);

type Pending = { query: WebGLQuery; slice: GpuSlice; frame: FrameRecord };
/** One frame's queries: how many are still out (-1 once it is given up on)
 * and what those in have said. */
type FrameRecord = { left: number; ms: Partial<Record<GpuSlice, number>>; tag: string };

/** Frames a result may lag before its frame is given up on — a context that
 * stops answering must not grow the list forever. */
const MAX_LAG = 12;

export function createGpuTimer(ctx: WebGL2RenderingContext, asked: GpuMode): GpuTimer {
  const ext = asked === "off" ? null : ctx.getExtension("EXT_disjoint_timer_query_webgl2");
  const mode: GpuMode = ext ? asked : "off";
  const stack: GpuSlice[] = [];
  const free: WebGLQuery[] = [];
  const pending: Pending[] = [];
  const open: FrameRecord[] = [];
  let running: WebGLQuery | null = null;
  let current: FrameRecord = { left: 0, ms: {}, tag: "" };
  let sums: GpuTotals = noGpu();

  const start = (slice: GpuSlice): void => {
    if (!ext) return;
    const query = free.pop() ?? ctx.createQuery();
    if (!query) return;
    ctx.beginQuery(ext.TIME_ELAPSED_EXT, query);
    running = query;
    current.left += 1;
    pending.push({ query, slice, frame: current });
  };
  const stop = (): void => {
    if (!ext || running === null) return;
    ctx.endQuery(ext.TIME_ELAPSED_EXT);
    running = null;
  };
  const drop = (record: FrameRecord): void => {
    record.left = -1;
  };

  return {
    supported: ext !== null,
    mode,
    push(slice) {
      if (mode === "off") return;
      stop();
      stack.push(slice);
      start(slice);
    },
    pop() {
      if (mode === "off" || stack.length === 0) return;
      stop();
      stack.pop();
      if (stack.length > 0) start(stack[stack.length - 1]);
    },
    enter(slice) {
      if (mode !== "split" || stack.length === 0) return;
      const top = stack[stack.length - 1];
      if (top === slice || !SCENE_SLICES.has(top)) return;
      stop();
      stack[stack.length - 1] = slice;
      start(slice);
    },
    inScene() {
      return stack.length > 0 && SCENE_SLICES.has(stack[stack.length - 1]);
    },
    frame(tag = "") {
      if (!ext) return;
      // A slice left running over the end of a frame is closed with it.
      while (stack.length > 0) this.pop();
      current.tag = tag;
      open.push(current);
      current = { left: 0, ms: {}, tag: "" };
      const disjoint = ctx.getParameter(ext.GPU_DISJOINT_EXT) === true;
      if (disjoint) for (const record of open) drop(record);
      while (pending.length > 0) {
        const head = pending[0];
        const ready = ctx.getQueryParameter(head.query, ctx.QUERY_RESULT_AVAILABLE) === true;
        const stale = open.length > MAX_LAG && head.frame === open[0];
        if (!ready && !stale) break;
        pending.shift();
        if (ready && head.frame.left >= 0) {
          const ns = ctx.getQueryParameter(head.query, ctx.QUERY_RESULT) as number;
          head.frame.ms[head.slice] = (head.frame.ms[head.slice] ?? 0) + ns / 1e6;
          head.frame.left -= 1;
        } else if (!ready) {
          drop(head.frame);
        }
        free.push(head.query);
      }
      // Whole frames answered, oldest first, are summed; dropped ones counted.
      while (open.length > 0 && (open[0].left === 0 || open[0].left < 0)) {
        const record = open.shift()!;
        if (record.left < 0) {
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
    },
    totals() {
      const tags: GpuTotals["tags"] = {};
      for (const [tag, t] of Object.entries(sums.tags)) tags[tag] = { ...t };
      return { frames: sums.frames, dropped: sums.dropped, ms: { ...sums.ms }, tags };
    },
    reset() {
      for (const record of open) drop(record);
      drop(current);
      sums = noGpu();
      current = { left: 0, ms: {}, tag: "" };
      open.length = 0;
      // The queries still out are collected and discarded as they land.
      for (const p of pending) p.frame.left = -1;
    },
    dispose() {
      stop();
      for (const p of pending) ctx.deleteQuery(p.query);
      for (const q of free) ctx.deleteQuery(q);
      pending.length = 0;
      free.length = 0;
    },
  };
}
