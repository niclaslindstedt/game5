// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DEVELOPER ▸ BENCHMARK, as the app runs it: the pinned race stood up behind
// the loading card, warmed there, lifted onto the `bench` surface and timed
// (`benchmark.ts`), then written down (`benchmark-history.ts`) and handed
// back.
//
// It is a RUN in every sense the engine and the renderer care about — the
// pinned map, the whole field, a bot at every set of bars including the
// player's. What it is not is a run the APP is playing: nothing is filed or
// recorded (it is stood up as a mode that keeps no book), no HUD is drawn,
// and the app's own loop hands the canvas over for as long as it lasts
// (`appDraws` in `shell.ts`), because the benchmark pumps its own frames as
// fast as the machine will draw them and a frame drawn between two of those
// is time the measurement is charged for and did not spend.
//
// THE INSTRUMENTS GO DARK FOR IT. The free camera would time a view nobody
// rides and the trail overlay a pass nobody draws, so both are taken off the
// renderer at the start; the developer page's loop puts back whatever is
// switched on when the canvas comes home.
//
// A FACTORY OVER `App.tsx`'s closures, the `app-load.ts` shape.

import { createGame, type GameMode, type GameState, type Level } from "@engine";

import type { LoadPlan } from "./app-load.ts";
import { rememberBenchmark } from "./benchmark-history.ts";
import { BENCHMARK, benchmarkLevel, plannedRows } from "./benchmark-plan.ts";
import {
  HIDEABLE,
  pictureRows,
  type GpuMode,
  type Hideable,
  type ReportRow,
} from "./benchmark-report.ts";
import type { LensPose } from "./camera-rigs.ts";
import {
  runBenchmark,
  warmBenchmark,
  type BenchmarkStatus,
  type BenchmarkWarmup,
} from "./benchmark.ts";
import type { DevRenderer, WorldRenderer } from "./renderer-api.ts";
import type { VideoSettings } from "./settings-video.ts";
import { STRINGS } from "./strings.ts";

export type BenchWorld = {
  renderer: WorldRenderer & DevRenderer;
  /** The engine state the load stood up — read after the card lifts. */
  current: () => GameState;
  /** Put a load up (`createLoader`). */
  begin: (plan: LoadPlan) => void;
  /** The mode the app files a run under: the benchmark's keeps no book. */
  setMode: (mode: GameMode) => void;
  /** Lift the loading card onto the `bench` surface. */
  lift: () => void;
  /** Hush the beds — fed by frames the app's loop no longer draws. */
  silence: () => void;
  /** The card is the status and the status is the card: non-null IS the
   * `bench` surface being up. */
  setStatus: (status: BenchmarkStatus | null) => void;
  /** OPTIONS ▸ PICTURE as it stands, written beside the score. */
  video: () => VideoSettings;
  /** The GPU timer's cut for the run, and what it is drawn without (the
   * URL's `?gpu=` and `?hide=`). */
  gpu: GpuMode;
  hide: readonly Hideable[];
  /** Interleave the A/B: every subsystem hidden a frame in turn (`?ab=1`). */
  ab: boolean;
  /** A shorter stretch than the plan's (`?frames=`), and the VISTA — the
   * lens planted high on the basin's edge looking across all of it
   * (`?view=vista`), the view DISTANCE is dearest from. Both are a price
   * list's (`make bench --costs`), never a score to hold a run to. */
  frames: number | null;
  vista: boolean;
};

export type BenchRun = {
  start: () => void;
  /** Take the pump off the machine (leaving the card, or the app going). */
  stop: () => void;
};

/** The map's line on the card and in the report. */
export function benchmarkMap(): string {
  return STRINGS.benchMap(BENCHMARK.seed);
}

/** THE VISTA: from high over the basin's edge (a tenth of the way in from
 * a corner, sixty metres over the snow) across its middle to the far rim. */
export function vistaOf(level: Level): LensPose {
  const edge = level.size * 0.1;
  const mid = level.size / 2;
  return {
    eye: { x: edge, y: level.groundAt(edge, edge) + 60, z: edge },
    target: { x: mid, y: level.groundAt(mid, mid), z: mid },
    fov: 60,
    roll: 0,
  };
}

/** The pinned rows, and what a price list moved off them. */
export function runRows(world: Pick<BenchWorld, "frames" | "vista">): ReportRow[] {
  const rows = plannedRows({ ...BENCHMARK, frames: world.frames ?? BENCHMARK.frames });
  if (world.vista) rows.push({ label: "view", value: "vista" });
  return rows;
}

export function createBenchRun(world: BenchWorld): BenchRun {
  let stop: (() => void) | null = null;

  const start = (): void => {
    stop?.();
    stop = null;
    world.setStatus(null);
    world.setMode("free");
    world.renderer.setOverride(null);
    world.renderer.setTrailOverlay(false);
    // Set before the warm-up, so the frames it warms are drawn the way the
    // timed ones are.
    world.renderer.setGpuTimer(world.gpu);
    world.renderer.setHidden(world.hide);
    let warm: BenchmarkWarmup | null = null;
    world.begin({
      build: () =>
        createGame({
          seed: BENCHMARK.seed,
          level: benchmarkLevel(),
          mode: BENCHMARK.mode,
          sky: BENCHMARK.sky,
        }),
      camera: BENCHMARK.camera,
      after: [
        {
          id: "lights",
          label: STRINGS.loadLights,
          progress: () => warm?.progress() ?? 0,
          // Built on the first slice: the race it warms is what the steps
          // before it have just made.
          run: (budget) => {
            if (!warm && world.vista) world.renderer.setOverride(vistaOf(world.current().level));
            warm ??= warmBenchmark({ state: world.current(), renderer: world.renderer });
            return warm.run(budget);
          },
        },
      ],
      done: () => {
        world.lift();
        world.silence();
        stop = runBenchmark({
          state: world.current(),
          renderer: world.renderer,
          hidden: world.hide,
          frames: world.frames ?? undefined,
          plan: runRows(world),
          cycle: world.ab ? HIDEABLE.filter((h) => !world.hide.includes(h)) : undefined,
          onStatus: (status) => {
            world.setStatus(status);
            // KEPT AT THE END, by the app rather than the card: a score is
            // only worth anything against a second one, and by the time that
            // second run is set up the first card is gone.
            if (status.phase !== "done") return;
            rememberBenchmark({
              at: Date.now(),
              index: status.index,
              map: benchmarkMap(),
              skis: status.skis,
              width: status.width,
              height: status.height,
              pixelRatio: devicePixelRatio,
              picture: pictureRows(world.video()),
              plan: status.plan,
              samples: status.samples,
              costs: status.costs,
              scene: status.scene,
              totals: status.totals,
              gpu: status.gpu,
              hidden: status.hidden,
              machine: status.machine,
              step: BENCHMARK.step,
              frames: status.planned,
            });
          },
        });
      },
    });
  };

  return {
    start,
    stop: () => {
      stop?.();
      stop = null;
      world.renderer.setGpuTimer("off");
      world.renderer.setHidden([]);
      if (world.vista) world.renderer.setOverride(null);
      world.setStatus(null);
    },
  };
}
