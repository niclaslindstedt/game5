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

import { createGame, type GameMode, type GameState, type SkiSpec } from "@engine";

import type { Loader } from "./app-load.ts";
import { isPinnedMap, pinnedFor, pinnedRun, type CampaignLevel } from "./campaign.ts";
import type { CampaignRig } from "./campaign-run.ts";
import { assistOf, type Settings } from "./settings.ts";
import { trickGameOptions, type TrickMap } from "./trick-maps.ts";
import type { MenuPage } from "./url-params.ts";

export type PinnedRuns = {
  /** Stand `pin` up as `mode` — a rung of the campaign when `rung`. */
  press: (pin: CampaignLevel, mode: CampaignLevel["mode"], rung: boolean) => void;
  /** Stand a TRICKS run up on a trick map (`trick-maps.ts`). */
  tricks: (map: TrickMap) => void;
  /** The last pinned run stood up, again from the start line; null where the run
   * on the snow is not a pinned one. */
  again: () => GameState | null;
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
  /** The pair the player skis (a link's `?skis=` over the stored one). */
  spec: (settings: Settings) => SkiSpec;
  /** The app's own note of which mode the player's runs are in. */
  setMode: (mode: GameMode) => void;
  /** Run on the frame the loading card lifts. */
  done: () => void;
}): PinnedRuns {
  let last: ReturnType<typeof pinnedRun> | null = null;
  return {
    press: (pin, mode, rung) => {
      world.setMode(mode);
      const s = world.settings();
      const skier = { spec: world.spec(s), assist: assistOf(s.assist), damage: s.damage };
      world.loader.begin({
        build: () => {
          world.rig.arm(rung ? pin : null);
          const now = world.current();
          const built = now.rules.course && isPinnedMap(now.level, pin) ? now.level : undefined;
          const opts = pinnedRun(pin, mode, rung, skier, s.trialLaps, built);
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
      const skier = { spec: world.spec(s), assist: assistOf(s.assist), damage: s.damage };
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
      if (!last) return null;
      world.rig.arm(world.rig.riding());
      return createGame(last);
    },
    clear: () => {
      last = null;
      world.rig.arm(null);
    },
  };
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
