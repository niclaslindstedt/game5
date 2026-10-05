// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// STANDING A RUN UP ON A PINNED MAP — a campaign rung, a RACE or a TIME
// TRIAL off the level card, or a TRICKS run off the trick map card — and
// standing the same one up again.
//
// A FACTORY over the app's own closures, the shape `app-load.ts` is built
// in and for the same reason: the loader, the engine state and the campaign
// rig are `App.tsx`'s, built once on mount and outliving every card, and
// this is what a press on a pinned map DOES with them.
//
// THE RIG IS ARMED IN THE BUILD, not at the press, so a run is a rung from
// its first step and a load given up on arms nothing. The map under the menu
// is REUSED when it is the very one pinned (`isPinnedMap` — the same seed on
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
// a racer back into the first. The second run books no campaign rung: the
// rung is booked at the first run's flag.
//
// A DOWNHILL stands up as its TRAINING run (every racer starts one before
// he may race, `downhill-run.ts`), and the plate over it — home or out —
// stands up its RACE through the same press. A campaign rung is booked at
// the RACE's flag, never the training's: the rig is armed for the rung only
// when the race is stood up.

import { TUNING, botInput, createGame, step, type GameMode, type GameState } from "@engine";

import type { Loader } from "./app-load.ts";
import {
  isPinnedMap,
  pinnedFor,
  pinnedRun,
  type CampaignLevel,
  type PinnedSkier,
} from "./campaign.ts";
import type { CampaignRig } from "./campaign-run.ts";
import { recipeOf } from "./replay.ts";
import type { Settings } from "./settings.ts";
import { trainingOf } from "./downhill-run.ts";
import { heatAfter, heatOf, secondRunOf } from "./slalom-heat.ts";
import { trickGameOptions, type TrickMap } from "./trick-maps.ts";
import type { MenuPage } from "./url-params.ts";

export type PinnedRuns = {
  /** Stand `pin` up as `mode` — a rung of the campaign when `rung`. */
  press: (pin: CampaignLevel, mode: CampaignLevel["mode"], rung: boolean) => void;
  /** Stand a TRICKS run up on a trick map (`trick-maps.ts`). */
  tricks: (map: TrickMap) => void;
  /** The last pinned run stood up, again from the start line — or a
   * slalom's second run again, its heat kept; null where the run on the
   * snow is neither. */
  again: () => GameState | null;
  /** A slalom's SECOND RUN, behind the loading card, off the first run on
   * the snow — nothing where it earned none (`secondRunOf`). */
  second: () => void;
  /** The run on the snow is no longer a pinned one: the rig disarmed and
   * nothing to stand up again. */
  clear: () => void;
};

export function createPinnedRuns(world: {
  rig: CampaignRig;
  loader: Loader;
  /** The run on the snow now. */
  current: () => GameState;
  /** What the game remembers — the help, the damage switch, the trial's
   * length, the lens — read at the press. */
  settings: () => Settings;
  /** Who skis, and with what: the pair (a link's `?skis=` over the stored
   * one), the help and the switches (a link's `?poles=` over the stored
   * row). */
  skier: (settings: Settings) => PinnedSkier;
  /** The app's own note of which mode the player's runs are in. */
  setMode: (mode: GameMode) => void;
  /** Run on the frame the loading card lifts. */
  done: () => void;
}): PinnedRuns {
  let last: ReturnType<typeof pinnedRun> | null = null;
  /** The campaign rung a downhill's training was stood up for — armed when
   * its race is. */
  let rungOf: CampaignLevel | null = null;
  return {
    press: (pin, mode, rung) => {
      world.setMode(mode);
      const s = world.settings();
      const skier = world.skier(s);
      world.loader.begin({
        build: () => {
          // A downhill's training books nothing: the rung waits for its race.
          const training = mode === "downhill";
          rungOf = rung ? pin : null;
          world.rig.arm(training ? null : rungOf);
          const now = world.current();
          const built = now.rules.course && isPinnedMap(now.level, pin) ? now.level : undefined;
          const opts = { ...pinnedRun(pin, mode, rung, skier, s.trialLaps, built), training };
          const game = createGame(opts);
          last = { ...opts, level: game.level };
          return game;
        },
        camera: s.camera,
        done: world.done,
      });
    },
    tricks: (map) => {
      world.setMode("tricks");
      last = null;
      world.rig.arm(null);
      const s = world.settings();
      const skier = world.skier(s);
      world.loader.begin({
        build: () => {
          const now = world.current();
          const same =
            now.rules.tricks && now.level.seed === map.seed && now.level.version === map.version;
          return createGame(trickGameOptions(map, skier, same ? now.level : undefined));
        },
        camera: s.camera,
        done: world.done,
      });
    },
    again: () => {
      const now = world.current();
      if (heatOf(now)) return secondRunAgain(now);
      // A downhill again as the run it is: its training, or its race.
      const training = trainingOf(now);
      if (training !== undefined) {
        world.rig.arm(training ? null : world.rig.riding());
        return createGame(recipeOf(now, "downhill"));
      }
      if (!last) return null;
      world.rig.arm(world.rig.riding());
      return createGame(last);
    },
    second: () => {
      const now = world.current();
      // A DOWNHILL'S RACE, after its training: the same course, the rung
      // armed now.
      if (secondRunOf(now)?.kind === "race") {
        world.setMode("downhill");
        world.loader.begin({
          build: () => {
            world.rig.arm(rungOf);
            return createGame({ ...recipeOf(now, "downhill"), training: false });
          },
          camera: world.settings().camera,
          done: world.done,
        });
        return;
      }
      const heat = heatAfter(now);
      if (!heat) return;
      world.setMode("slalom");
      world.loader.begin({
        build: () => {
          world.rig.arm(null);
          return createGame({ ...recipeOf(now, "slalom"), heat });
        },
        camera: world.settings().camera,
        done: world.done,
      });
    },
    clear: () => {
      last = null;
      rungOf = null;
      world.rig.arm(null);
    },
  };
}

/** The longest a first run is skied for a link's second run, s. */
const FIRST_RUN_CAP = 600;

/** A LINK'S SECOND RUN (`?run=2`): `first` skied by the bot to its flag
 * in place, then the second run off it — or `first` as it stands where the
 * bot went out of it and there is no second run to stand up. On a
 * downhill, its RACE off its training. */
export function secondRunOff(first: GameState): GameState {
  // A downhill's: its race, off its training — nothing skied first.
  if (trainingOf(first) === true) {
    return createGame({ ...recipeOf(first, "downhill"), training: false });
  }
  if (first.field?.run !== 1 || first.level.downhill) return first;
  for (let i = 0; i < FIRST_RUN_CAP * TUNING.physicsHz && !first.progress.finished; i++) {
    step(first, botInput(first));
  }
  const heat = heatAfter(first);
  return heat ? createGame({ ...recipeOf(first, "slalom"), heat }) : first;
}

/** A SLALOM'S SECOND RUN AGAIN from the start house: the same course, the
 * same board, the same heat — or null on a run that is not a second run. */
export function secondRunAgain(state: GameState): GameState | null {
  return heatOf(state) ? createGame(recipeOf(state, "slalom")) : null;
}

/** Where BACK on the skis card goes: the card that opened it — the free
 * ride's start card, the campaign card for a rung, the level card for a
 * pinned map, the trick map card for a tricks run — or the front door,
 * where a link pinned a seed instead. */
export function skisBack(
  rung: CampaignLevel | null,
  mode: GameMode,
  linkSeed: number | null,
): MenuPage {
  if (mode === "free") return "start";
  if (rung) return "campaign";
  if (mode === "tricks") return linkSeed === null ? "tricks" : "root";
  return pinnedFor(null, mode, linkSeed) ? "levels" : "root";
}
