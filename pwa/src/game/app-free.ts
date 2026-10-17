// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A FREE RIDE STOOD UP: the press on RIDE (`free`) and the world staged
// behind the cards before it (`stageFree`, `free-stage.ts`) — the app's
// half, over its own loader and world, kept out of `App.tsx`. A PINNED
// RUN's world is staged by the same machine (`pinned`).

import { createGame, type CreateGameOptions, type GameState, type Level } from "@engine";

import type { LoadPlan, Loader } from "./app-load.ts";
import { freeAgainOptions, rideKept, standingFor, type RiddenMap } from "./free-ride.ts";
import { handsFree } from "./backdrop-hold.ts";
import { createFreeStage } from "./free-stage.ts";
import { stageSettled } from "./menu-stage.tsx";
import { aheadLevel } from "./map-build.ts";
import {
  askKey,
  freeAsk,
  freeRideLevel,
  heldLevel,
  keepRidden,
  leaveSeedCard,
  onSeedMaps,
  paintBehind,
  riddenLevel,
  type SeedAsk,
} from "./seed-maps.ts";
import type { WorldBuild } from "./world-build.ts";
// What is drawn on the snow is solid (`drawn-solids.ts`), registered
// before any run is stood up.
import "./drawn-solids.ts";

/** How long the rider card is up before its free ride's world is staged
 * behind it: its own stage comes up first. */
const STAGE_AFTER_MS = 400;
/** How often a pinned run's stage looks for its map ordered ahead, ms. */
const MAP_LOOK_MS = 300;
/** How long a free ride is on the snow before a map with no chart has one
 * painted behind it (`paintBehind`), ms: past the first frames, which
 * have work of their own. */
const PAINT_AFTER_MS = 2500;

export function createFreeRides(deps: {
  world: WorldBuild;
  loader: Loader;
  /** The race standing now (the door's, until a ride is stood up). */
  current: () => GameState;
  /** Put the door's backdrop back once a staged world is thrown away. */
  restore: () => void;
  /** The outfit worn, as `outfitKey` names it. */
  outfit: () => string;
  /** The rest of the load's plan: the camera, and the lift off the card. */
  plan: () => Pick<LoadPlan, "camera" | "done">;
  /** Take a ride stood up on the map standing onto the snow at once, with
   * no loading card (the pause card's PISTE MAP). */
  now: (game: GameState) => void;
  /** The options the ride was stood up on, for START AGAIN. */
  stood: (again: CreateGameOptions) => void;
}) {
  const { world, loader } = deps;
  /** The mountain the last free ride was stood up on, and what it asked. */
  let ridden: RiddenMap | null = null;
  const standing = (o: CreateGameOptions) => {
    const s = deps.current();
    return standingFor(s.level, s.rules, o);
  };
  const later = (run: () => void, ms = STAGE_AFTER_MS): (() => void) => {
    let live = true;
    // After the rider's stage stands (`stageSettled`: the rider, then his
    // gear, then the mountain), and never begun under a hand turning him
    // round (`handsFree`).
    const t = window.setTimeout(
      () =>
        void stageSettled()
          .then(() => handsFree())
          .then(() => live && run()),
      ms,
    );
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  };
  /** The load's plan, and once the card lifts the map's chart painted
   * behind the ride if none is held — a QUICK START never stood on the
   * start card, and the pause card's PISTE MAP would otherwise open on a
   * bar while the worker raised and painted it. */
  const plan = (ask: SeedAsk): Pick<LoadPlan, "camera" | "done"> => {
    const own = deps.plan();
    return {
      ...own,
      done: () => {
        own.done();
        window.setTimeout(() => {
          const level = riddenLevel(ask);
          if (level) paintBehind(ask, level);
        }, PAINT_AFTER_MS);
      },
    };
  };
  const stage = createFreeStage({
    held: (o) => heldLevel(freeAsk(o)) ?? riddenLevel(freeAsk(o)) ?? standing(o) ?? null,
    onMaps: onSeedMaps,
    stand: createGame,
    stage: world.stage,
    unstage: world.unstage,
    busy: loader.busy,
    restore: deps.restore,
    later,
  });
  return {
    /** A PINNED RUN'S world, staged the same way behind the rider and gear
     * cards (`pinned-run.ts`), on the map ordered ahead for it
     * (`map-build.ts`'s `aheadLevel`) — looked for until it is built. */
    pinned: createFreeStage({
      held: (o) => aheadLevel(o.seed ?? 0),
      onMaps: (listener) => {
        const t = window.setInterval(listener, MAP_LOOK_MS);
        return () => window.clearInterval(t);
      },
      stand: createGame,
      stage: world.stage,
      unstage: world.unstage,
      busy: loader.busy,
      restore: deps.restore,
      later,
    }),
    stageFree: (o: CreateGameOptions | null, after?: number): void => {
      if (o) {
        // Off the start card: its worker and the map built ahead go first.
        leaveSeedCard(freeAsk(o));
        stage.want(o, deps.outfit(), after);
      } else stage.drop();
    },
    free: (asked: CreateGameOptions): void => {
      // ANOTHER RUN ON THE MOUNTAIN BEING RIDDEN (the pause card's PISTE
      // MAP): the map standing is ridden again as it is, day, sky and all,
      // so nothing is generated or built — only the rider is moved.
      const ask = askKey(freeAsk(asked));
      const kept = rideKept(ridden, deps.current().level, ask, asked);
      // The map it stands up on is kept past the ride (`keepRidden`): the
      // main menu and PLAY again on the same mountain raise nothing.
      const stood = (game: GameState, base: Level): GameState => {
        ridden = { ask, level: game.level };
        keepRidden(freeAsk(asked), base);
        deps.stood(freeAgainOptions(asked, game.level));
        return game;
      };
      // No card goes up for it: the world standing is the one ridden on, and
      // the run is stood up in the frame, as a restart is (`now`).
      if (kept) {
        const options = freeAgainOptions(asked, kept);
        deps.now(stood(createGame(options), riddenLevel(freeAsk(asked)) ?? kept));
        return;
      }
      // The map staged behind the cards, the one standing, or the one the
      // start card's worker built or is building (`seed-maps.ts`); else
      // built on the card's own worker. The map as the generator raised it, kept rather than a staged one
      // that carries this ride's day and sky.
      const raised = heldLevel(freeAsk(asked)) ?? riddenLevel(freeAsk(asked));
      const staged = stage.take(asked, deps.outfit());
      const made = freeRideLevel(asked, () => staged?.level ?? standing(asked));
      loader.begin({
        ...made,
        build: (built) => {
          const base = built ?? made.has();
          const game = createGame({ ...(staged ?? asked), level: base });
          return stood(game, raised ?? base ?? game.level);
        },
        ...plan(freeAsk(asked)),
      });
    },
  };
}
