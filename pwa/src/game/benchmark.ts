// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BENCHMARK — one pinned map, the whole field, and a stopwatch.
//
// WHAT IT MEASURES, AND WHY IT IS A TIME. A frame rate is a number about a
// moment: it moves with where the skis is and whatever the machine was busy
// with, and two of them from two machines are only comparable if both were
// reading the same frame, which they never are. So this measures a FIXED
// AMOUNT OF WORK and reports how long the machine took to do it. The race is
// scripted — every skis on the snow is the bot, off the engine's own seeded
// stream, so the same kicker is taken at the same instant on every machine —
// and the run is exactly `frames` frames long. A fast machine is through the
// same race in less of the clock (`benchmark-index.ts` turns that into the
// score).
//
// THE SIMULATION IS NOT WHAT IS TIMED — it is part of the WORK. Every frame
// advances the game by exactly `step` seconds however long it took to draw,
// so the race is identical at six frames a second or six hundred. And the
// loop must NOT wait for anything: no `requestAnimationFrame`, which would
// cap the machine at its display's rate — frames are pumped through a
// MessageChannel, the one scheduler a browser re-enters as fast as the work
// comes back.
//
// THE FENCE. WebGL commands are posted and return at once, so a loop that
// only submits them measures how fast this machine TALKS to its graphics
// card. Every frame therefore ends by reading one pixel back
// (`renderer.drain()`), which cannot be answered until the frame is drawn.
//
// HOW TO READ THE LINE: the workload is fixed ACROSS runs but not flat
// ALONG one. The race starts with four skis on the grid and strings out
// through the woods, so a rate that rises is a machine holding its pace on a
// thinning scene; a rate that FALLS is a machine getting slower faster than
// the race is getting cheaper — on a phone, nearly always the thermal
// governor, and the one reading worth acting on.
//
// THE WARM-UP IS PAID FOR BEHIND THE LOADING CARD (`warmBenchmark`, the
// last step of the load `bench-run.ts` stands up): the lights are counted
// out frame by frame while shaders compile and pools allocate, so the card
// lifts on a race already at green and every frame this module draws after
// it is a frame it is timing.

import { TUNING, botInput, step, type GameState } from "@engine";

import { BENCHMARK, plannedRows } from "./benchmark-plan.ts";
import { SAMPLE_EVERY, benchIndex, type BenchSample } from "./benchmark-index.ts";
import {
  GPU_NAME_CAP,
  noMachine,
  noTotals,
  type FramePhases,
  type FrameTiming,
  type GpuTotals,
  type Hideable,
  type ReportRow,
  type Machine,
  type RunTotals,
  type SceneShare,
} from "./benchmark-report.ts";
import type { DevRenderer, WorldRenderer } from "./renderer-api.ts";

/** Engine steps per frame — exact by construction (`BenchmarkPlan.step`). */
const STEPS_PER_FRAME = Math.max(1, Math.round(BENCHMARK.step / TUNING.dt));

/** The loop's own half of the frame just drawn, rewritten every frame and
 * copied at a reading — a frame that allocated a record of its own timings
 * would be a measurement paying for itself. */
const last: FrameTiming = { simMs: 0, gpuMs: 0, wallMs: 0 };

/** Where the benchmark is, and what it has to say. */
export type BenchmarkStatus = {
  /** `running` is the measured stretch; `done` is the answer. */
  phase: "running" | "done";
  frames: number;
  /** Frames the run is asked for — the plan's, or a price list's shorter
   * stretch (`?frames=`). */
  planned: number;
  /** The pinned rows as the run was stood up (`runRows`). */
  plan: ReportRow[];
  /** Wall clock since the green, s — what is measured. */
  seconds: number;
  /** The run so far on the 100-is-real-time scale. */
  index: number;
  /** Every reading so far, oldest first — the card's graph is this list. */
  samples: BenchSample[];
  /** What each of those frames cost, same order. */
  costs: FramePhases[];
  /** What stood in the scene on the LAST frame, by subsystem. */
  scene: SceneShare[];
  /** Every frame's phases summed — the breakdown the report prints. */
  totals: RunTotals;
  /** The GPU's own timer over the run (`gpu-timer.ts`), where it has one. */
  gpu: GpuTotals;
  /** What the run is drawn without (`?hide=`), for the report's line. */
  hidden: readonly string[];
  machine: Machine;
  /** Skis on the snow, the player's included. */
  skis: number;
  /** The buffer drawn into, device pixels: a time means nothing without it. */
  width: number;
  height: number;
};

/** The race and what draws it — the same pair for the warm-up and for the
 * measured run, because the frames under the loading card have to be the
 * frames that come after it. */
export type BenchmarkRace = {
  /** The player's own run, ridden by the bot like every rival inside it. */
  state: GameState;
  renderer: WorldRenderer & DevRenderer;
};

/** ONE FRAME OF THE RACE, drawn and waited for, and cut into its phases. The
 * warm-up and the measured run share it because a warm-up that stepped any
 * differently would be warming a different frame. `since` is when the frame
 * before it ended, so its bill is its whole PERIOD and a run's periods tile
 * its elapsed time exactly. Returns when the frame closed. */
function benchFrame(race: BenchmarkRace, into?: RunTotals, since?: number): number {
  const { state, renderer } = race;
  const opened = performance.now();
  for (let i = 0; i < STEPS_PER_FRAME; i++) step(state, botInput(state));
  const stepped = performance.now();
  // The frame's time is the PLAN's, not the clock's: the camera eases on it,
  // and a slow machine must frame the race exactly as a fast one does.
  renderer.draw(state, 1, BENCHMARK.step);
  const gpu = renderer.drain();
  const closed = performance.now();
  last.simMs = stepped - opened;
  last.gpuMs = gpu;
  last.wallMs = closed - (since ?? opened);
  if (!into) return closed;
  const cost = renderer.cost();
  into.frames += 1;
  into.sim += last.simMs;
  into.render += cost.frameMs;
  into.pose += cost.poseMs;
  into.trail += cost.trailMs;
  into.world += cost.worldMs;
  into.submit += cost.submitMs;
  into.gpu += gpu;
  into.between += since === undefined ? 0 : opened - since;
  into.wall += last.wallMs;
  return closed;
}

/** The warm-up, cut into slices a loading card can be drawn between. */
export type BenchmarkWarmup = {
  /** Draw warm-up frames while `budget` allows; true while there are more —
   * the shape a load step is asked in (`run-loader.ts`). */
  run: (budget: () => boolean) => boolean;
  /** How far through the lights, 0–1, for the card's bar. */
  progress: () => number;
};

/** WARM THE MACHINE ON THE RACE IT IS ABOUT TO BE TIMED ON: the three lights,
 * frame by frame and each one fenced, so the load is as long as the warm-up
 * really is and what comes back is a race at green on a warm machine. */
export function warmBenchmark(race: BenchmarkRace): BenchmarkWarmup {
  const frames = Math.max(1, Math.round(race.state.rules.countdown / BENCHMARK.step));
  let drawn = 0;
  return {
    progress: () => Math.min(1, drawn / frames),
    run: (budget) => {
      do {
        benchFrame(race);
        drawn += 1;
      } while (race.state.phase === "countdown" && budget());
      return race.state.phase === "countdown";
    },
  };
}

/** The finest step `performance.now()` resolves here, ms: the error bar on
 * every single-frame time. Spins, so it runs once the stopwatch has stopped. */
function clockResolution(): number {
  let finest = Infinity;
  for (let i = 0; i < 8; i++) {
    const from = performance.now();
    let now = from;
    for (let reads = 0; now === from && reads < 1e6; reads++) now = performance.now();
    if (now - from > 0) finest = Math.min(finest, now - from);
  }
  return Number.isFinite(finest) ? finest : 0;
}

/** What drew the run, as much as the browser will say. */
function readMachine(): Machine {
  const machine = noMachine();
  try {
    machine.cores = navigator.hardwareConcurrency || 0;
    machine.clockMs = clockResolution();
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (gl) {
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      const name: unknown = debug
        ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER);
      if (typeof name === "string") machine.gpu = name.slice(0, GPU_NAME_CAP);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    // A browser that withholds any of it leaves an honest zero.
  }
  return machine;
}

/** Drive the measured run — the race is already at green. Returns the way
 * to stop it early: the pump outlives any one frame. */
export function runBenchmark(
  race: BenchmarkRace & {
    onStatus: (status: BenchmarkStatus) => void;
    /** What the whole run is drawn without (`?hide=`). */
    hidden?: readonly Hideable[];
    /** THE INTERLEAVED A/B (`?ab=1`): frame by frame, the picture drawn
     * without each of these in turn and once whole. */
    cycle?: readonly Hideable[];
    /** Frames to time, over the plan's (`?frames=`). */
    frames?: number;
    plan?: ReportRow[];
  },
): () => void {
  const planned = race.frames ?? BENCHMARK.frames;
  const { state, renderer, onStatus } = race;
  const hidden = [...(race.hidden ?? [])];
  const cycle: readonly (Hideable | "")[] = race.cycle ? ["", ...race.cycle] : [];
  const channel = new MessageChannel();
  let stopped = false;
  let frames = 0;
  let green = 0;
  let elapsed = 0;
  /** When the LAST frame ended — the next frame's period starts there. */
  let framed = 0;
  const samples: BenchSample[] = [];
  const costs: FramePhases[] = [];
  let scene: SceneShare[] = [];
  const totals = noTotals();
  let machine = noMachine();

  const report = (phase: BenchmarkStatus["phase"]): void => {
    // Asked every time: a window resized mid-run is a changed workload, and
    // the card must not go on billing the old size.
    const size = renderer.bufferSize();
    onStatus({
      phase,
      frames,
      planned,
      plan: race.plan ?? plannedRows(),
      seconds: elapsed / 1000,
      index: benchIndex(frames * BENCHMARK.step, elapsed / 1000),
      samples: samples.slice(),
      costs: costs.slice(),
      scene,
      totals: { ...totals },
      gpu: renderer.gpuTotals(),
      hidden,
      machine,
      skis: state.rivals.length + 1,
      width: size.w,
      height: size.h,
    });
  };

  const tick = (): void => {
    if (stopped) return;
    if (green === 0) {
      // The warm-up's frames were timed too; the run starts from nothing.
      renderer.resetGpu();
      green = framed = performance.now();
    }
    if (cycle.length > 0) {
      const without = cycle[frames % cycle.length];
      renderer.setHidden(without === "" ? hidden : [...hidden, without], without);
    }
    const now = benchFrame(race, totals, framed);
    frames += 1;
    elapsed = now - green;
    const fps = now > framed ? 1000 / (now - framed) : 0;
    framed = now;
    const finished = frames >= planned;
    // The card is redrawn only on a reading, a quarter second of game apart
    // — a graph redrawn every frame would be a benchmark of its instrument.
    if (finished || frames % SAMPLE_EVERY === 0) {
      samples.push({
        frame: frames,
        index: benchIndex(frames * BENCHMARK.step, elapsed / 1000),
        fps,
      });
      costs.push({ ...renderer.cost(), ...last });
    }
    if (finished) {
      stopped = true;
      // Both walks run once the stopwatch has stopped, on the last frame
      // drawn: what the run was actually measured against.
      scene = renderer.sceneTally();
      machine = readMachine();
      report("done");
      return;
    }
    if (frames % SAMPLE_EVERY === 0) report("running");
    channel.port2.postMessage(0);
  };

  channel.port1.onmessage = tick;
  report("running");
  channel.port2.postMessage(0);
  return (): void => {
    stopped = true;
    channel.port1.onmessage = null;
  };
}
