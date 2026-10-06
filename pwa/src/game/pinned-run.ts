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
// A SKI CROSS stands up as its QUALIFICATION, and the plate over each of its
// runs stands up the player's NEXT HEAT (`ski-cross-run.ts`'s
// `nextBracket`): the run read back off its first step with the bracket as
// it now stands handed over — the heat it names his. A heat books no rung.
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
  NO_PICKS,
  pinnedFor,
  pinnedRun,
  type CampaignLevel,
  type PinnedSkier,
} from "./campaign.ts";
import type { CampaignRig } from "./campaign-run.ts";
import { recipeOf } from "./replay.ts";
import type { Settings } from "./settings.ts";
import { trainingOf } from "./downhill-run.ts";
import { heatAfter, heatOf, secondRunOf, twoRunMode } from "./slalom-heat.ts";
import { nextBracket } from "./ski-cross-run.ts";
import { trickGameOptions, type TrickMap } from "./trick-maps.ts";
import { nextContest } from "./big-air-run.ts";
import { nextSlopeContest } from "./slopestyle-run.ts";
import { nextPipeContest } from "./halfpipe-run.ts";
import { nextMogulsContest } from "./moguls-run.ts";
import { nextAerialsContest } from "./aerials-run.ts";
import { nextDualContest } from "./dual-moguls-run.ts";
import type { MenuPage } from "./url-params.ts";

export type PinnedRuns = {
  /** Stand `pin` up as `mode` — a rung of the campaign when `rung`. */
  press: (pin: CampaignLevel, mode: CampaignLevel["mode"], rung: boolean) => void;
  /** Stand a TRICKS run up on a trick map (`trick-maps.ts`) — or, as
   * `bigAir`, a BIG AIR contest's first jump with its jump built over it
   * (R37), as `knuckleHuck`, a KNUCKLE HUCK's jam on its knuckle (R38),
   * as `slopestyle`, a SLOPESTYLE contest's first run on its course
   * (R39), as `railJam`, a RAIL JAM on its set (R40), as `halfpipe`, a
   * HALFPIPE contest's first run down its pipe (R41), as `moguls`, a
   * MOGULS contest's qualification run (R42), or as `dualMoguls`, a DUAL
   * MOGULS contest's qualification run (R43). */
  tricks: (
    map: TrickMap,
    mode?:
      | "tricks"
      | "bigAir"
      | "knuckleHuck"
      | "slopestyle"
      | "railJam"
      | "halfpipe"
      | "moguls"
      | "dualMoguls"
      | "aerials",
  ) => void;
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
    tricks: (map, mode = "tricks") => {
      world.setMode(mode);
      last = null;
      world.rig.arm(null);
      const s = world.settings();
      const skier = world.skier(s);
      world.loader.begin({
        build: () => {
          const now = world.current();
          const same =
            now.rules.tricks && now.level.seed === map.seed && now.level.version === map.version;
          const opts = trickGameOptions(map, skier, same ? now.level : undefined);
          // An aerials contest's first jump declares the jump the card picked.
          const plan = mode === "aerials" ? s.aerialPlan : undefined;
          return createGame(mode === "tricks" ? opts : { ...opts, mode, plan });
        },
        camera: s.camera,
        done: world.done,
      });
    },
    again: () => {
      const now = world.current();
      if (heatOf(now)) return secondRunAgain(now);
      // A big air jump again: the same jump of the same contest.
      if (now.bigAir) {
        world.rig.arm(null);
        return createGame(recipeOf(now, "bigAir"));
      }
      // A slopestyle run again: the same run of the same contest.
      if (now.slopestyle) {
        world.rig.arm(null);
        return createGame(recipeOf(now, "slopestyle"));
      }
      // A dual moguls run again: the same run — the same dual — of the
      // same contest.
      if (now.dualMoguls) {
        world.rig.arm(null);
        return createGame(recipeOf(now, "dualMoguls"));
      }
      // An aerials jump again: the same jump of the same contest.
      if (now.aerials) {
        world.rig.arm(null);
        return createGame(recipeOf(now, "aerials"));
      }
      // A moguls run again: the same run of the same contest.
      if (now.moguls) {
        world.rig.arm(null);
        return createGame(recipeOf(now, "moguls"));
      }
      // A halfpipe run again: the same run of the same contest.
      if (now.halfpipe) {
        world.rig.arm(null);
        return createGame(recipeOf(now, "halfpipe"));
      }
      // A knuckle huck or a rail jam again: a fresh jam on the same feature.
      if (now.jam) {
        world.rig.arm(null);
        return createGame(recipeOf(now, now.level.railJam ? "railJam" : "knuckleHuck"));
      }
      // A ski-cross heat again: the same heat of the same bracket.
      if (now.cross) {
        world.rig.arm(null);
        return createGame(recipeOf(now, "skiCross"));
      }
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
      // A BIG AIR contest's next jump, off the contest as this one left it.
      const contest = nextContest(now);
      if (contest) {
        world.setMode("bigAir");
        world.loader.begin({
          build: () => {
            world.rig.arm(null);
            return createGame({ ...recipeOf(now, "bigAir"), bigAir: contest });
          },
          camera: world.settings().camera,
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
            world.rig.arm(null);
            return createGame({ ...recipeOf(now, "slopestyle"), slopestyle: slope });
          },
          camera: world.settings().camera,
          done: world.done,
        });
        return;
      }
      // A DUAL MOGULS contest's next dual, off the contest as this one
      // left it.
      const dual = nextDualContest(now);
      if (dual) {
        world.setMode("dualMoguls");
        world.loader.begin({
          build: () => {
            world.rig.arm(null);
            return createGame({ ...recipeOf(now, "dualMoguls"), dualMoguls: dual });
          },
          camera: world.settings().camera,
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
            world.rig.arm(null);
            return createGame({ ...recipeOf(now, "aerials"), aerials: jumps });
          },
          camera: world.settings().camera,
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
            world.rig.arm(null);
            return createGame({ ...recipeOf(now, "moguls"), moguls: bumps });
          },
          camera: world.settings().camera,
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
            world.rig.arm(null);
            return createGame({ ...recipeOf(now, "halfpipe"), halfpipe: pipe });
          },
          camera: world.settings().camera,
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
            world.rig.arm(null);
            return createGame({
              ...recipeOf(now, "skiCross"),
              cross: undefined,
              bracket,
              rivals: undefined,
              countdown: undefined,
            });
          },
          camera: world.settings().camera,
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
          world.rig.arm(null);
          return createGame({ ...recipeOf(now, mode), heat });
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
 * downhill, its RACE off its training; on a ski cross, its first HEAT off
 * its qualification; on a big air contest, its next jump. */
export function secondRunOff(first: GameState): GameState {
  // A downhill's: its race, off its training — nothing skied first.
  if (trainingOf(first) === true) {
    return createGame({ ...recipeOf(first, "downhill"), training: false });
  }
  // A BIG AIR contest's next jump, off the first jumped by the bot.
  if (first.bigAir) {
    for (let i = 0; i < FIRST_RUN_CAP * TUNING.physicsHz; i++) {
      if (first.progress.finished || first.progress.out) break;
      step(first, botInput(first));
    }
    const contest = nextContest(first);
    return contest ? createGame({ ...recipeOf(first, "bigAir"), bigAir: contest }) : first;
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
  // A DUAL MOGULS contest's first dual, off the qualification skied by
  // the bot.
  if (first.dualMoguls) {
    for (let i = 0; i < FIRST_RUN_CAP * TUNING.physicsHz; i++) {
      if (first.progress.finished || first.progress.out) break;
      step(first, botInput(first));
    }
    const contest = nextDualContest(first);
    return contest ? createGame({ ...recipeOf(first, "dualMoguls"), dualMoguls: contest }) : first;
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
  if (
    mode === "tricks" ||
    mode === "bigAir" ||
    mode === "knuckleHuck" ||
    mode === "slopestyle" ||
    mode === "railJam"
  )
    return linkSeed === null ? "tricks" : "root";
  return pinnedFor(NO_PICKS, mode, linkSeed) ? "levels" : "root";
}
