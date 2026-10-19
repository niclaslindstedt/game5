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
import { benchScene, sceneHour, sceneSky, type BenchSceneId } from "./bench-scenes.ts";
import { SWEEP, dealSweep, type SweepPicture, type SweepResult } from "./picture-sweep.ts";
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
  /** A shorter stretch than the plan's (`?frames=`), and the SCENE
   * (`?view=`, `bench-scenes.ts`): the plan's race, the VISTA — the lens
   * planted high on the basin's edge, where DISTANCE is dearest — sunset,
   * night or a snowfall. A price list's knobs, never a score to hold a run
   * to. */
  frames: number | null;
  view: BenchSceneId;
  /** THE PICTURE SWEEP (`?sweep=`): this many random pictures, a block of
   * frames each, every row priced off the lot (`picture-sweep.ts`) — a
   * price list's, never a score, so it is not kept in the history. */
  sweep: number | null;
};

/** Which run a press asks for: the SCORE, the score PART BY PART (the
 * interleaved A/B) or the PICTURE COSTS (the sweep). */
export type BenchKind = "score" | "parts" | "costs";

export type BenchRun = {
  /** Left out, the URL's ask (`?sweep=`, `?ab=`, `?view=`) — the
   * developer page's presses name theirs. Several scenes run one after
   * another. */
  start: (kind?: BenchKind, scenes?: readonly BenchSceneId[]) => void;
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
export function runRows(
  world: Pick<BenchWorld, "frames" | "view" | "sweep">,
  level?: Level,
): ReportRow[] {
  const rows = plannedRows({ ...BENCHMARK, frames: world.frames ?? BENCHMARK.frames });
  const scene = benchScene(world.view);
  if (scene.id !== "race") {
    rows.push({ label: "scene", value: scene.id });
    const sky = rows.find((r) => r.label === "sky");
    const hour = level ? sceneHour(scene, level).toFixed(1) : String(scene.time);
    if (sky) sky.value = `${scene.weather} ${hour}h, calm`;
  }
  if (world.sweep) rows.push({ label: "sweep", value: `${world.sweep} random pictures` });
  return rows;
}

export function createBenchRun(world: BenchWorld): BenchRun {
  let stop: (() => void) | null = null;
  /** The run going, for `stop` to put back after: a sweep deals the
   * player's picture away, the vista takes the lens. */
  let sweeping = false;
  let planted = false;

  /** ONE SCENE'S RUN. A PICTURE COSTS run over several scenes runs them one
   * after another, each its own load and race, the sweeps gathered as they
   * finish and the card done only after the last. */
  const runScene = (
    kind: BenchKind,
    scenes: readonly BenchSceneId[],
    at: number,
    swept: SweepResult[],
  ): void => {
    const view = scenes[at];
    const scene = benchScene(view);
    const ab = kind === "parts";
    const sweep = kind === "costs" ? (world.sweep ?? SWEEP.blocks) : null;
    const asked = { frames: world.frames, view, sweep };
    const last = at === scenes.length - 1;
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
    const race = (level: Level = benchmarkLevel()): GameState =>
      createGame({ seed: BENCHMARK.seed, level, sky: sceneSky(scene, level) });
    const pictures = sweep ? dealSweep(sweep, SWEEP.seed + at) : null;
    sweeping = pictures !== null;
    planted = scene.vista;
    const draw = (picture: SweepPicture): void => world.renderer.setVideo(picture);
    // The sweep's first picture is the one warmed, so the lights compile
    // what the first block draws.
    if (pictures) draw(pictures[0]);
    world.begin({
      build: () => race(),
      camera: { rider: BENCHMARK.camera, craft: BENCHMARK.camera },
      after: [
        {
          id: "lights",
          label: STRINGS.loadLights,
          progress: () => warm?.progress() ?? 0,
          // Built on the first slice: the race it warms is what the steps
          // before it have just made.
          run: (budget) => {
            if (!warm && scene.vista) world.renderer.setOverride(vistaOf(world.current().level));
            warm ??= warmBenchmark({ state: world.current(), renderer: world.renderer });
            return warm.run(budget);
          },
        },
      ],
      done: () => {
        world.lift();
        world.silence();
        const rows = runRows(asked, world.current().level);
        stop = runBenchmark({
          state: world.current(),
          renderer: world.renderer,
          hidden: world.hide,
          frames: world.frames ?? undefined,
          plan: ab ? [...rows, { label: "a/b", value: "by part" }] : rows,
          cycle: ab ? HIDEABLE.filter((h) => !world.hide.includes(h)) : undefined,
          sweep: pictures
            ? {
                plan: { ...SWEEP, blocks: pictures.length },
                pictures,
                view,
                apply: draw,
                restart: () => race(world.current().level),
              }
            : undefined,
          onStatus: (reading) => {
            const done = reading.phase === "done";
            const sweeps = reading.sweep ? [...swept, reading.sweep] : swept;
            const status: BenchmarkStatus = {
              ...reading,
              // A scene with more after it is not the run's end.
              phase: done && !last ? "running" : reading.phase,
              sweeps: pictures ? sweeps : undefined,
              scenes: scenes.length > 1 ? { at, of: scenes.length, id: view } : undefined,
            };
            world.setStatus(status);
            if (done && !last) {
              runScene(kind, scenes, at + 1, sweeps);
              return;
            }
            // The picture the sweep dealt last is put back to the player's.
            if (pictures && done) world.renderer.setVideo(world.video());
            // KEPT AT THE END, by the app rather than the card: a score is
            // only worth anything against a second one, and by the time that
            // second run is set up the first card is gone.
            if (!done || pictures) return;
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
              fence: status.fence,
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
    start: (kind = world.sweep ? "costs" : world.ab ? "parts" : "score", scenes = [world.view]) =>
      runScene(kind, scenes.length > 0 ? scenes : [world.view], 0, []),
    stop: () => {
      stop?.();
      stop = null;
      world.renderer.setGpuTimer("off");
      world.renderer.setHidden([]);
      if (planted) world.renderer.setOverride(null);
      if (sweeping) world.renderer.setVideo(world.video());
      sweeping = false;
      planted = false;
      world.setStatus(null);
    },
  };
}
