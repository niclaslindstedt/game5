// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// STANDING A RUN UP ON A PINNED MAP — a RACE off the level card, or a
// TRICKS run off the trick map card — and standing the same one up again.
//
// A FACTORY over the app's own closures, the shape `app-load.ts` is built
// in and for the same reason: the loader and the engine state are
// `App.tsx`'s, built once on mount and outliving every card, and this is
// what a press on a pinned map DOES with them.
//
// The map under the menu is REUSED when it is the very one pinned (`isPinnedMap` — the same seed on
// the same generator): building a map is the dearest thing the engine does,
// and a RACE pressed over the map just ridden is a race on that map. A free
// ride's map is never reused, because it is the seed's map on another day;
// a trick map's is, when the run on the snow is a tricks run on its ground
// (its field and all), and it needs nothing to stand up again — the level
// it stands on already carries the map's day and sky.
//
// A SLALOM'S SECOND RUN is stood up here too, off whichever slalom is on the
// snow, pinned or not: the run read back off its first step's afternoon
// (`recipeOf`) with the first run handed over as its heat (`heatAfter`). A
// run already in its second run stands up again as its second run — the
// heat read back off it (`heatOf`, in `recipeOf`) — so a restart never drops
// a racer back into the first.
//
// A SKI CROSS stands up as its QUALIFICATION, and the plate over each of its
// runs stands up the player's NEXT HEAT (`ski-cross-run.ts`'s
// `nextBracket`): the run read back off its first step with the bracket as
// it now stands handed over — the heat it names his.
//
// A DOWNHILL stands up as its TRAINING run (every racer starts one before
// he may race, `downhill-run.ts`), and the plate over it — home or out —
// stands up its RACE through the same press.

import {
  TUNING,
  botInput,
  createGame,
  step,
  type GameMode,
  type GameState,
  type Level,
} from "@engine";

import type { Loader } from "./app-load.ts";
import type { FreeStage } from "./free-stage.ts";
import { buildAhead } from "./map-build.ts";
import type { MapOrder } from "./map-order.ts";
import {
  isPinnedMap,
  pinnedAsk,
  NO_PICKS,
  pinnedFor,
  pinnedGameOptions,
  type PinnedLevel,
  type PinnedSkier,
} from "./pinned.ts";
import { recipeOf } from "./replay.ts";
import { camerasOf, type Settings } from "./settings.ts";
import { trainingOf } from "./downhill-run.ts";
import { heatAfter, heatOf, secondRunOf, twoRunMode } from "./slalom-heat.ts";
import { nextBracket } from "./ski-cross-run.ts";
import { trickAsk, trickGameOptions, type TrickMap, type TrickRun } from "./trick-maps.ts";
import { nextSkiJumpContest, withJumpContest } from "./ski-jump-run.ts";
import { nextSlopeContest } from "./slopestyle-run.ts";
import { nextPipeContest } from "./halfpipe-run.ts";
import { nextMogulsContest } from "./moguls-run.ts";
import { nextAerialsContest } from "./aerials-run.ts";
import type { MenuPage } from "./url-params.ts";

export type PinnedRuns = {
  /** Stand `pin` up as `mode`. */
  press: (pin: PinnedLevel, mode: PinnedLevel["mode"]) => void;
  /** Stand a TRICKS run up on a trick map (`trick-maps.ts`) — or, as
   * `skiJump`, a SKI JUMPING contest's first jump off the hill built over
   * it (R43), as `slopestyle`, a SLOPESTYLE contest's first run on its
   * course (R38), as `halfpipe`, a HALFPIPE contest's first run down its
   * pipe (R39), as `moguls`, a MOGULS contest's qualification run (R40),
   * or as `aerials`, an AERIALS contest's qualification jump (R41). */
  tricks: (map: TrickMap, mode?: TrickRun) => void;
  /** The last pinned run stood up, again from the start line — or a
   * slalom's second run again, its heat kept; null where the run on the
   * snow is neither. */
  again: () => GameState | null;
  /** A slalom's SECOND RUN, behind the loading card, off the first run on
   * the snow — nothing where it earned none (`secondRunOf`). */
  second: () => void;
  /** The cards before RIDE are up on this pinned map (or trick map) — its
   * map is ordered ahead on a worker unless it is standing already — or,
   * with null, they are down and nothing is held (`map-build.ts`). */
  ahead: (
    pick: { pin: PinnedLevel; mode: PinnedLevel["mode"] } | { map: TrickMap } | null,
    covered: boolean,
  ) => void;
  /** The run on the snow is no longer a pinned one: nothing to stand up
   * again. */
  clear: () => void;
};

/** The order a pinned map's load asks its worker for. */
const pinOrder = (pin: PinnedLevel): MapOrder => ({ seed: pin.seed, generate: pinnedAsk(pin) });
/** ...and a trick map's. */
const trickOrder = (map: TrickMap): MapOrder => ({ seed: map.seed, generate: trickAsk(map) });

export function createPinnedRuns(world: {
  loader: Loader;
  /** The run on the snow now. */
  current: () => GameState;
  /** What the game remembers — the help, the damage switch, the lens —
   * read at the press. */
  settings: () => Settings;
  /** Who skis, and with what: the pair (a link's `?skis=` over the stored
   * one), the help and the switches (a link's `?poles=` over the stored
   * row). */
  skier: (settings: Settings) => PinnedSkier;
  /** The app's own note of which mode the player's runs are in. */
  setMode: (mode: GameMode) => void;
  /** Run on the frame the loading card lifts. */
  done: () => void;
  /** A race's world staged behind the rider and gear cards on its map
   * ordered ahead (`app-free.ts`'s `pinned`). */
  stage: FreeStage;
}): PinnedRuns {
  let last: ReturnType<typeof pinnedGameOptions> | null = null;
  /** A race's options on `pin` in `mode`, on `level` (built on this thread
   * when left out, `buildPinnedLevel`). `null` only NAMES the race — the
   * stage's `want` and `take` key it without its level and hand back the
   * map staged — and the map under the menu stands in for it. */
  const raceOptions = (pin: PinnedLevel, mode: PinnedLevel["mode"], level?: Level | null) => ({
    ...pinnedGameOptions(
      pin,
      mode,
      world.skier(world.settings()),
      level === null ? world.current().level : level,
    ),
    // A downhill stands up as its training.
    training: mode === "downhill",
  });
  /** The pinned map standing under the menu, where it is `pin`'s. */
  const pinStanding = (pin: PinnedLevel): Level | undefined => {
    const now = world.current();
    return now.rules.course && isPinnedMap(now.level, pin) ? now.level : undefined;
  };
  /** The trick map standing under the menu, where it is `map`'s. A tricks
   * run's map carries its park; a jump hill's is built without. */
  const trickStanding = (map: TrickMap): Level | undefined => {
    const now = world.current();
    const same =
      map.hill === undefined &&
      now.rules.tricks &&
      now.level.seed === map.seed &&
      now.level.version === map.version;
    return same ? now.level : undefined;
  };
  return {
    ahead: (pick, covered) => {
      const pin = pick && "pin" in pick && !pinStanding(pick.pin) ? pick : null;
      // Its world too, while a card covering the whole screen is up: the
      // race behind it is not drawn meanwhile (`world-build.ts`).
      if (pin && covered) world.stage.want(raceOptions(pin.pin, pin.mode, null), "");
      else world.stage.drop();
      if (!pick) return buildAhead(null);
      if ("pin" in pick) return buildAhead(pin ? pinOrder(pick.pin) : null);
      buildAhead(trickStanding(pick.map) ? null : trickOrder(pick.map));
    },
    press: (pin, mode) => {
      world.setMode(mode);
      const s = world.settings();
      const standing = () => pinStanding(pin);
      // The world staged behind the cards, where it is this race's: its map
      // and every mesh are built, and only its shaders are left.
      const staged = world.stage.take(raceOptions(pin, mode, null), "");
      world.loader.begin({
        // Generated on the card's worker unless it is standing already.
        map: () => (staged || standing() ? null : pinOrder(pin)),
        build: (level) => {
          const built = level ?? staged?.level ?? standing();
          const opts = staged ?? raceOptions(pin, mode, built);
          const game = createGame(opts);
          last = { ...opts, level: game.level };
          return game;
        },
        camera: camerasOf(s),
        done: world.done,
      });
    },
    tricks: (map, mode = "tricks") => {
      world.setMode(mode);
      last = null;
      const s = world.settings();
      const skier = world.skier(s);
      const standing = () => trickStanding(map);
      world.loader.begin({
        map: () => (standing() ? null : trickOrder(map)),
        build: (level) => {
          const opts = trickGameOptions(map, skier, level ?? standing());
          // An aerials contest's first jump declares the jump the card picked.
          const plan = mode === "aerials" ? s.aerialPlan : undefined;
          // A ski jump's contest is dealt on the hill set over the map.
          return createGame(mode === "tricks" ? opts : withJumpContest({ ...opts, mode, plan }));
        },
        camera: camerasOf(s),
        done: world.done,
      });
    },
    again: () => {
      const now = world.current();
      if (heatOf(now)) return secondRunAgain(now);
      // A ski jump again: the same jump of the same contest.
      if (now.skiJumpContest) {
        return createGame(recipeOf(now, "skiJump"));
      }
      // A slopestyle run again: the same run of the same contest.
      if (now.slopestyle) {
        return createGame(recipeOf(now, "slopestyle"));
      }
      // An aerials jump again: the same jump of the same contest.
      if (now.aerials) {
        return createGame(recipeOf(now, "aerials"));
      }
      // A moguls run again: the same run of the same contest.
      if (now.moguls) {
        return createGame(recipeOf(now, "moguls"));
      }
      // A halfpipe run again: the same run of the same contest.
      if (now.halfpipe) {
        return createGame(recipeOf(now, "halfpipe"));
      }
      // A ski-cross heat again: the same heat of the same bracket.
      if (now.cross) {
        return createGame(recipeOf(now, "skiCross"));
      }
      // A downhill again as the run it is: its training, or its race.
      const training = trainingOf(now);
      if (training !== undefined) {
        return createGame(recipeOf(now, "downhill"));
      }
      if (!last) return null;
      return createGame(last);
    },
    second: () => {
      const now = world.current();
      // A DOWNHILL'S RACE, after its training: the same course.
      if (secondRunOf(now)?.kind === "race") {
        world.setMode("downhill");
        world.loader.begin({
          build: () => createGame({ ...recipeOf(now, "downhill"), training: false }),
          camera: camerasOf(world.settings()),
          done: world.done,
        });
        return;
      }
      // A SKI JUMPING contest's next round, off the contest as this jump left it.
      const contest = nextSkiJumpContest(now);
      if (contest) {
        world.setMode("skiJump");
        world.loader.begin({
          build: () => {
            return createGame({
              ...recipeOf(now, "skiJump"),
              gate: undefined,
              skiJumpContest: contest,
            });
          },
          camera: camerasOf(world.settings()),
          done: world.done,
        });
        return;
      }
      // A SLOPESTYLE contest's next run, off the contest as this one left it.
      const slope = nextSlopeContest(now);
      if (slope) {
        world.setMode("slopestyle");
        world.loader.begin({
          build: () => {
            return createGame({ ...recipeOf(now, "slopestyle"), slopestyle: slope });
          },
          camera: camerasOf(world.settings()),
          done: world.done,
        });
        return;
      }
      // An AERIALS contest's next final, off the contest as this one left it.
      const jumps = nextAerialsContest(now);
      if (jumps) {
        world.setMode("aerials");
        world.loader.begin({
          build: () => {
            return createGame({ ...recipeOf(now, "aerials"), aerials: jumps });
          },
          camera: camerasOf(world.settings()),
          done: world.done,
        });
        return;
      }
      // A MOGULS contest's next final, off the contest as this one left it.
      const bumps = nextMogulsContest(now);
      if (bumps) {
        world.setMode("moguls");
        world.loader.begin({
          build: () => {
            return createGame({ ...recipeOf(now, "moguls"), moguls: bumps });
          },
          camera: camerasOf(world.settings()),
          done: world.done,
        });
        return;
      }
      // A HALFPIPE contest's next run, off the contest as this one left it.
      const pipe = nextPipeContest(now);
      if (pipe) {
        world.setMode("halfpipe");
        world.loader.begin({
          build: () => {
            return createGame({ ...recipeOf(now, "halfpipe"), halfpipe: pipe });
          },
          camera: camerasOf(world.settings()),
          done: world.done,
        });
        return;
      }
      // A SKI CROSS's next heat, off the bracket as this run left it.
      const bracket = nextBracket(now);
      if (bracket) {
        world.setMode("skiCross");
        world.loader.begin({
          build: () => {
            return createGame({
              ...recipeOf(now, "skiCross"),
              cross: undefined,
              bracket,
              rivals: undefined,
              countdown: undefined,
            });
          },
          camera: camerasOf(world.settings()),
          done: world.done,
        });
        return;
      }
      const heat = heatAfter(now);
      if (!heat) return;
      // A slalom's or a giant slalom's second run, or a speed race's final.
      const mode = twoRunMode(now);
      world.setMode(mode);
      world.loader.begin({
        build: () => {
          return createGame({ ...recipeOf(now, mode), heat });
        },
        camera: camerasOf(world.settings()),
        done: world.done,
      });
    },
    clear: () => {
      last = null;
    },
  };
}

/** The longest a first run is skied for a link's second run, s. */
const FIRST_RUN_CAP = 600;

/** A LINK'S SECOND RUN (`?run=2`): `first` skied by the bot to its flag
 * in place, then the second run off it — or `first` as it stands where the
 * bot went out of it and there is no second run to stand up. On a
 * downhill, its RACE off its training; on a ski cross, its first HEAT off
 * its qualification; on a ski jumping contest, its next round. */
export function secondRunOff(first: GameState): GameState {
  // A downhill's: its race, off its training — nothing skied first.
  if (trainingOf(first) === true) {
    return createGame({ ...recipeOf(first, "downhill"), training: false });
  }
  // A SKI JUMPING contest's next round, off the jump the bot jumped.
  if (first.skiJumpContest) {
    for (let i = 0; i < FIRST_RUN_CAP * TUNING.physicsHz; i++) {
      if (first.progress.finished || first.progress.out || nextSkiJumpContest(first)) break;
      step(first, botInput(first));
    }
    const contest = nextSkiJumpContest(first);
    return contest
      ? createGame({ ...recipeOf(first, "skiJump"), gate: undefined, skiJumpContest: contest })
      : first;
  }
  // A SLOPESTYLE contest's next run, off the first skied by the bot.
  if (first.slopestyle) {
    for (let i = 0; i < FIRST_RUN_CAP * TUNING.physicsHz; i++) {
      if (first.progress.finished || first.progress.out) break;
      step(first, botInput(first));
    }
    const contest = nextSlopeContest(first);
    return contest ? createGame({ ...recipeOf(first, "slopestyle"), slopestyle: contest }) : first;
  }
  // An AERIALS contest's next jump, off the first jumped by the bot.
  if (first.aerials) {
    for (let i = 0; i < FIRST_RUN_CAP * TUNING.physicsHz; i++) {
      if (first.progress.finished || first.progress.out) break;
      step(first, botInput(first));
    }
    const contest = nextAerialsContest(first);
    return contest ? createGame({ ...recipeOf(first, "aerials"), aerials: contest }) : first;
  }
  // A MOGULS contest's next run, off the first skied by the bot.
  if (first.moguls) {
    for (let i = 0; i < FIRST_RUN_CAP * TUNING.physicsHz; i++) {
      if (first.progress.finished || first.progress.out) break;
      step(first, botInput(first));
    }
    const contest = nextMogulsContest(first);
    return contest ? createGame({ ...recipeOf(first, "moguls"), moguls: contest }) : first;
  }
  // A HALFPIPE contest's next run, off the first skied by the bot.
  if (first.halfpipe) {
    for (let i = 0; i < FIRST_RUN_CAP * TUNING.physicsHz; i++) {
      if (first.progress.finished || first.progress.out) break;
      step(first, botInput(first));
    }
    const contest = nextPipeContest(first);
    return contest ? createGame({ ...recipeOf(first, "halfpipe"), halfpipe: contest }) : first;
  }
  if (first.field?.run !== 1 || first.level.downhill || first.level.superG) return first;
  for (let i = 0; i < FIRST_RUN_CAP * TUNING.physicsHz && !first.progress.finished; i++) {
    step(first, botInput(first));
  }
  // A SKI CROSS: its first heat, off the qualification the bot skied.
  if (first.level.skiCross) {
    const bracket = nextBracket(first);
    return bracket
      ? createGame({
          ...recipeOf(first, "skiCross"),
          cross: undefined,
          bracket,
          rivals: undefined,
          countdown: undefined,
        })
      : first;
  }
  const heat = heatAfter(first);
  return heat ? createGame({ ...recipeOf(first, twoRunMode(first)), heat }) : first;
}

/** A SLALOM'S SECOND RUN AGAIN from the start house: the same course, the
 * same board, the same heat — or null on a run that is not a second run. */
export function secondRunAgain(state: GameState): GameState | null {
  return heatOf(state) ? createGame(recipeOf(state, twoRunMode(state))) : null;
}

/** Where BACK on the skis card goes: the card that opened it — the free
 * ride's start card, the level card for a pinned map, the trick map card for a tricks run — or the front door,
 * where a link pinned a seed instead. */
export function skisBack(mode: GameMode, linkSeed: number | null): MenuPage {
  if (mode === "free") return "start";
  if (mode === "tricks" || mode === "skiJump" || mode === "slopestyle")
    return linkSeed === null ? "tricks" : "root";
  return pinnedFor(NO_PICKS, mode, linkSeed) ? "levels" : "root";
}
