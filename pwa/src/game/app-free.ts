// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A FREE RIDE STOOD UP: the press on RIDE (`free`) and the world staged
// behind the cards before it (`stageFree`, `free-stage.ts`) — the app's
// half, over its own loader and world, kept out of `App.tsx`.

import { createGame, type CreateGameOptions, type GameState } from "@engine";

import type { LoadPlan, Loader } from "./app-load.ts";
import { freeAgainOptions, rideKept, standingFor, type RiddenMap } from "./free-ride.ts";
import { createFreeStage } from "./free-stage.ts";
import { askKey, freeAsk, freeRideLevel, heldLevel, onSeedMaps } from "./seed-maps.ts";
import type { WorldBuild } from "./world-build.ts";

/** How long the rider card is up before its free ride's world is staged
 * behind it: its own stage comes up first. */
const STAGE_AFTER_MS = 400;

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
  const stage = createFreeStage({
    held: (o) => heldLevel(freeAsk(o)) ?? standing(o) ?? null,
    onMaps: onSeedMaps,
    stand: createGame,
    stage: world.stage,
    unstage: world.unstage,
    busy: loader.busy,
    restore: deps.restore,
    later: (run) => {
      const t = window.setTimeout(run, STAGE_AFTER_MS);
      return () => window.clearTimeout(t);
    },
  });
  return {
    stageFree: (o: CreateGameOptions | "keep" | null): void => {
      if (o === "keep") return;
      if (o) stage.want(o, deps.outfit());
      else stage.drop();
    },
    free: (asked: CreateGameOptions): void => {
      // ANOTHER RUN ON THE MOUNTAIN BEING RIDDEN (the pause card's PISTE
      // MAP): the map standing is ridden again as it is, day, sky and all,
      // so nothing is generated or built — only the rider is moved.
      const ask = askKey(freeAsk(asked));
      const kept = rideKept(ridden, deps.current().level, ask);
      const stood = (game: GameState): GameState => {
        ridden = { ask, level: game.level };
        deps.stood(freeAgainOptions(asked, game.level));
        return game;
      };
      if (kept) {
        const options = freeAgainOptions(asked, kept);
        loader.begin({ build: () => stood(createGame(options)), ...deps.plan() });
        return;
      }
      // The map staged behind the cards, the one standing, or the one the
      // start card's worker built or is building (`seed-maps.ts`); else
      // built on the card's own worker.
      const staged = stage.take(asked, deps.outfit());
      const made = freeRideLevel(asked, () => staged?.level ?? standing(asked));
      loader.begin({
        ...made,
        build: (built) => stood(createGame({ ...(staged ?? asked), level: built ?? made.has() })),
        ...deps.plan(),
      });
    },
  };
}
