// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A LOAD IS ASKED TO STAND UP.
//
// And `raceOrFallback` at the foot: the race the page MOUNTS over, before any
// load — the one place a refused seed quietly falls back to another map.
//
// `run-loader.ts` is the SEQUENCING: it cuts a load into steps, spends a
// share of each frame on them and never learns what any of them does. This
// is the other half — what the steps ARE — and it lives beside `App.tsx`
// rather than inside it because it is a FACTORY over the app's own closures:
// the engine state a load adopts, the renderer it builds into and the
// surface it lifts onto are `App.tsx`'s, built once on mount and outliving
// every card.
//
// FIVE PHASES, and the card counts them (`loading-screen.tsx`):
//
//   the mountain  `generateLevel` and `createGame` — the map raised off its
//                 seed, the piste laid and graded into it, the field stood
//                 on the start line. The map is generated on a worker
//                 (`map-build.ts`) wherever it costs seconds, and the bar
//                 follows the generator's own word on how far it has got.
//   the snow, the forest, the lifts
//                 `WorldRenderer.load`, one ASYNCHRONOUS build read stage by
//                 stage (`WorldRenderer.building`): the ground and its trail
//                 maps; the trees, planted a slice a breath and COUNTED on
//                 the card; then the gates, the lifts, the wildlife, the
//                 people and the machines. Each step says "more to do" every
//                 frame until the build has passed its stage, so the card
//                 keeps drawing while it builds.
//   the piste     every shader in the new world compiled, then its first
//                 draw — paid for under the card rather than out of the
//                 player's first second.

import {
  createGame,
  error,
  loadRealFace,
  realFaceLoaded,
  type GameMode,
  type GameState,
  type CreateGameOptions,
  type Level,
} from "@engine";

import type { MapJob, MapOrder } from "./map-order.ts";

import type { PinnedSkier } from "./pinned.ts";
import { withJumpContest } from "./ski-jump-run.ts";
import type { BuildStage, WorldRenderer } from "./renderer-api.ts";
import type { Cameras } from "./settings.ts";
import {
  advanceLoad,
  createLoad,
  loadBudgetMs,
  loadPhase,
  loadTimes,
  type LoadJob,
  type LoadPhase,
  type LoadStep,
} from "./run-loader.ts";
import { STRINGS } from "./strings.ts";
// What is drawn on the snow is solid (`drawn-solids.ts`), registered
// before any run is stood up.
import "./drawn-solids.ts";

/** The renderer's stages, in the order a load passes them. */
const STAGES: readonly BuildStage[] = ["snow", "forest", "lifts", "groom"];

/** One thing a load is asked to stand up. */
export type LoadPlan = {
  /** The race to stand up. THROWS on a seed the generator refuses, which is
   * what ends the load and puts the refusal on the card (`advanceLoad`) — a
   * race somebody asked for must never quietly fall back to another map. */
  build: (level?: Level) => GameState;
  /** THE MAP `build` RIDES, where it has to be generated: built first, off
   * the page's thread (`LoadWorld.buildMap`), and handed to `build` as
   * `level`. Null where the map is standing already, and `build` is then
   * called with none. */
  map?: () => MapOrder | null;
  /** Whether `build` may run yet — false while the map it builds on is
   * still coming from elsewhere (a free ride's, from the start card's
   * worker: `seed-maps.ts`). Always, when left off. */
  ready?: () => boolean;
  /** ...and how far that map has got meanwhile, 0–1. */
  readyShare?: () => number;
  /** The REAL FACE the map stands on, if any: its heights and hints are a
   * chunk of their own, fetched on this thread before the race is stood
   * up (the run reads its real houses). */
  face?: string;
  /** The rungs the camera opens on once the card lifts: his own and his
   * machines'. */
  camera: Cameras;
  /** Run on the frame the card lifts. */
  done: () => void;
  /** Steps paid for under the card after the ones every load makes — the
   * benchmark's warm-up (`bench-run.ts`), and nothing else today. */
  after?: LoadStep[];
};

export type LoadWorld = {
  renderer: WorldRenderer;
  /** Take the race the first step built: it becomes the engine state the
   * app draws, and everything that belonged to the race before it — the news
   * column, the beds, the motor — is cleared with it. */
  adopt: (state: GameState) => void;
  /** ...and read it back. */
  current: () => GameState;
  /** Generate a map off the page's thread (`map-build.ts`'s `buildMap`). */
  buildMap: (order: MapOrder) => MapJob;
};

/** THE STEPS EVERY LOAD IS MADE OF. */
export function loadPlanSteps(world: LoadWorld, plan: LoadPlan): LoadStep[] {
  const { renderer } = world;
  let built: GameState | null = null;
  /** The map being generated for `build`, once one is asked for. */
  let map: MapJob | null = null;
  const waitingOnMap = (): boolean =>
    map !== null && map.level() === undefined && map.failed() === null;
  /** The renderer's build in flight: pending, done, or the reason it threw. */
  let scene: "pending" | "done" | { failed: string } | null = null;
  /** The real face's fetch: in flight, or the reason it failed. */
  let face: "pending" | { failed: string } | null = null;
  /** Whether the plan's real face is still being fetched; THROWS if the
   * fetch failed. */
  const fetchingFace = (): boolean => {
    if (!plan.face || realFaceLoaded(plan.face)) return false;
    if (face === null) {
      face = "pending";
      loadRealFace(plan.face).then(
        (known) => {
          face = known ? null : { failed: `no real face ${plan.face}` };
        },
        (why: unknown) => {
          face = { failed: why instanceof Error ? why.message : String(why) };
        },
      );
    }
    if (typeof face === "object") throw new Error(face.failed);
    return true;
  };
  /** Whether the renderer's build is still at `stage` (or short of it);
   * THROWS if the build failed. A build that resolved has passed them all. */
  const building = (stage: BuildStage): boolean => {
    if (typeof scene === "object" && scene !== null) throw new Error(scene.failed);
    if (scene !== "pending") return false;
    const at = renderer.building()?.stage ?? "snow";
    return STAGES.indexOf(at) <= STAGES.indexOf(stage);
  };
  return [
    {
      id: "level",
      label: STRINGS.loadLevel,
      run: () => {
        if (fetchingFace()) return true;
        if (plan.ready && !plan.ready()) return true;
        if (map === null) {
          const order = plan.map?.() ?? null;
          if (order === null) {
            built = plan.build();
            return false;
          }
          map = world.buildMap(order);
        }
        const failed = map.failed();
        if (failed !== null) throw new Error(failed);
        const level = map.level();
        if (level === undefined) return true;
        built = plan.build(level);
        return false;
      },
      // How far the generator says it has got: the map's own worker, or the
      // one the plan is waiting on.
      progress: () => (map !== null ? map.share() : (plan.readyShare?.() ?? 0)),
      waiting: () =>
        face === "pending" || (plan.ready !== undefined && !plan.ready()) || waitingOnMap(),
    },
    {
      id: "scene",
      label: STRINGS.loadSnow,
      run: () => {
        if (scene === null) {
          if (built) world.adopt(built);
          scene = "pending";
          renderer.load(world.current()).then(
            () => {
              scene = "done";
            },
            (why: unknown) => {
              scene = { failed: why instanceof Error ? why.message : String(why) };
            },
          );
        }
        return building("snow");
      },
      waiting: () => scene === "pending",
    },
    {
      id: "forest",
      label: STRINGS.loadScene,
      run: () => building("forest"),
      // The trees planted of the forest's, counted by the renderer itself.
      progress: () => {
        const at = renderer.building();
        return at === null || at.trees === 0 ? 1 : at.planted / at.trees;
      },
      count: () => {
        const at = renderer.building();
        return at === null ? null : STRINGS.loadTrees(at.planted, at.trees);
      },
      waiting: () => scene === "pending",
    },
    {
      id: "lifts",
      label: STRINGS.loadLifts,
      run: () => building("lifts"),
      waiting: () => scene === "pending",
    },
    {
      id: "groom",
      label: STRINGS.loadWarm,
      run: () => building("groom"),
      waiting: () => scene === "pending",
    },
    {
      id: "warm",
      label: STRINGS.loadWarm,
      run: () => {
        renderer.setCamera(plan.camera.rider, false, undefined, plan.camera.craft);
        renderer.draw(world.current(), 0, 0);
        return false;
      },
    },
    ...(plan.after ?? []),
  ];
}

/** A load in flight, and everything about one that is bookkeeping. */
export type Loader = {
  /** Put a load up. Refused while one is already running — a second press
   * on RACE must not throw away a map that is half built. */
  begin: (plan: LoadPlan) => void;
  /** Spend this frame's slice of the load. `frameMs` is how long the frames
   * are actually coming, which is what the budget is a share of. */
  frame: (frameMs: number) => void;
  /** Take a load off that will not finish — the player pressing out of a
   * refused seed. */
  abandon: () => void;
  busy: () => boolean;
};

export function createLoader(
  world: LoadWorld,
  on: {
    /** Where the load has got to, every frame it is running. */
    phase: (phase: LoadPhase) => void;
    /** A load has just gone up. */
    start: () => void;
    /** ...and one has just been ABANDONED. The card stays up and says so,
     * and the race the menu was over is still standing, so there is a game
     * to go back to. */
    failed: (why: string | null) => void;
  },
): Loader {
  let job: LoadJob | null = null;
  /** What each step cost last time on this machine, ms — the next card's
   * `expectedMs`. Kept in memory: it is a fact about this session. */
  let expected: Record<string, number> = {};
  let loaded: () => void = () => {};

  return {
    begin: (plan) => {
      if (job) return;
      job = createLoad(loadPlanSteps(world, plan), expected);
      loaded = plan.done;
      on.failed(null);
      on.phase(loadPhase(job));
      on.start();
    },
    frame: (frameMs) => {
      if (!job) return;
      const until = performance.now() + loadBudgetMs(frameMs);
      const more = advanceLoad(
        job,
        () => performance.now() < until,
        () => performance.now(),
      );
      on.phase(loadPhase(job));
      if (job.failed !== null) {
        error(`the race could not be stood up: ${job.failed}`);
        on.failed(job.failed);
        job = null;
      } else if (!more) {
        expected = { ...expected, ...loadTimes(job) };
        job = null;
        loaded();
      }
    },
    abandon: () => {
      job = null;
      on.failed(null);
    },
    busy: () => job !== null,
  };
}

export { withJumpContest };

/** A whole race on `seed` — or, where the generator refuses it, the map the
 * game falls back on, so the page ALWAYS mounts over something. `skier` is
 * the player's help, pair and switches for a race a link boots into; the race under
 * the front door is the bot's, on the default pair with every hand on. */
export function raceOrFallback(
  seed: number,
  skier: (PinnedSkier & { mode: GameMode }) | null,
  world: Pick<CreateGameOptions, "sky" | "region" | "grade"> & { round?: "first" } = {},
): GameState {
  const { round, ...asked } = world;
  const help = {
    ...(skier
      ? {
          assist: skier.assist,
          spec: skier.spec,
          damage: skier.damage,
          ...(skier.gore ? { gore: true } : {}),
          ...(skier.sfw ? { sfw: true } : {}),
          poles: skier.poles,
          mode: skier.mode,
          // A downhill is stood up as its training run (`downhill-run.ts`).
          training: skier.mode === "downhill" ? true : undefined,
        }
      : {}),
    ...asked,
  };
  // A SKI JUMP is a contest's jump: dealt on the hill set over the map.
  try {
    return createGame(withJumpContest({ seed, ...help }, round));
  } catch (e) {
    error(`seed ${seed} would not build (${e instanceof Error ? e.message : String(e)})`);
    return createGame(withJumpContest({ seed: 1, ...help }, round));
  }
}
