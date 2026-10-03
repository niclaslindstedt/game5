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
// THREE PHASES, and the card counts them (`loading-screen.tsx`):
//
//   the mountain  `generateLevel` and `createGame` — the map raised off its
//                 seed, the piste laid and graded into it, the field stood
//                 on the start line. One indivisible call.
//   the forest    `WorldRenderer.load` — the terrain mesh, the trees, the
//                 trail map, the checkpoints. ASYNCHRONOUS: the step kicks
//                 it off and then says "more to do" every frame until the
//                 promise has settled, so the card keeps drawing while it
//                 builds.
//   the track     the first draw of the new world, which is where the
//                 driver compiles every shader in it — paid for under the
//                 card rather than out of the player's first second.

import { createGame, error, type GameMode, type GameState, type CreateGameOptions } from "@engine";

import type { PinnedSkier } from "./campaign.ts";
import type { CameraRung, WorldRenderer } from "./renderer-api.ts";
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

/** One thing a load is asked to stand up. */
export type LoadPlan = {
  /** The race to stand up. THROWS on a seed the generator refuses, which is
   * what ends the load and puts the refusal on the card (`advanceLoad`) — a
   * race somebody asked for must never quietly fall back to another map. */
  build: () => GameState;
  /** The rung the camera opens on once the card lifts. */
  camera: CameraRung;
  /** Run on the frame the card lifts. */
  done: () => void;
  /** Steps paid for under the card after the three every load makes — the
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
};

/** THE THREE STEPS EVERY LOAD IS MADE OF. */
export function loadPlanSteps(world: LoadWorld, plan: LoadPlan): LoadStep[] {
  const { renderer } = world;
  let built: GameState | null = null;
  /** The renderer's build in flight: pending, done, or the reason it threw. */
  let scene: "pending" | "done" | { failed: string } | null = null;
  return [
    {
      id: "level",
      label: STRINGS.loadLevel,
      run: () => {
        built = plan.build();
        return false;
      },
    },
    {
      id: "scene",
      label: STRINGS.loadScene,
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
        if (typeof scene === "object") throw new Error(scene.failed);
        return scene === "pending";
      },
      waiting: () => scene === "pending",
    },
    {
      id: "warm",
      label: STRINGS.loadWarm,
      run: () => {
        renderer.setCamera(plan.camera);
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

/** A whole race on `seed` — or, where the generator refuses it, the map the
 * game falls back on, so the page ALWAYS mounts over something. `skier` is
 * the player's help, pair and switches for a race a link boots into; the race under
 * the front door is the bot's, on the default pair with every hand on. */
export function raceOrFallback(
  seed: number,
  skier: (PinnedSkier & { mode: GameMode; laps: number }) | null,
  world: Pick<CreateGameOptions, "sky" | "region" | "grade"> = {},
): GameState {
  const help = {
    ...(skier
      ? {
          assist: skier.assist,
          spec: skier.spec,
          damage: skier.damage,
          poles: skier.poles,
          mode: skier.mode,
          laps: skier.mode === "timeTrial" ? skier.laps : undefined,
        }
      : {}),
    ...world,
  };
  try {
    return createGame({ seed, ...help });
  } catch (e) {
    error(`seed ${seed} would not build (${e instanceof Error ? e.message : String(e)})`);
    return createGame({ seed: 1, ...help });
  }
}
