// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PRESSES THAT ROUTE A CARD TO THE SKIS CARD — a front-door tile (the
// mode its cards are for), a map picked on a level card, and a trick map
// picked on the trick map card — and the pair and the build a race opens
// the ski card on.
//
// What is picked is kept where the game remembers it (`Settings.raceMap`,
// `Settings.trickMap`); which mode the skis card's RIDE is for is
// `App.tsx`'s own ref, handed in.

import { raceRiderOf, raceSkisOf, type GameMode } from "@engine";

import type { PinnedLevel } from "./pinned.ts";
import { disciplineOf, findRaceMap } from "./race-maps.ts";
import type { Settings } from "./settings.ts";
import type { TrickMap } from "./trick-maps.ts";
import type { MenuPage } from "./url-params.ts";

export type MapPicks = {
  /** A front-door tile: the mode its cards are for. */
  openCard: (mode: GameMode, page: MenuPage) => void;
  /** A map picked off a level card — kept as the one its discipline rides —
   * on to the skis card. */
  choose: (level: PinnedLevel) => void;
  /** A trick map picked on the trick map card, kept as the one the TRICKS
   * run rides, on to the skis card. */
  chooseTrick: (map: TrickMap) => void;
};

export function mapPicks(world: {
  /** The mode the skis card's RIDE is for (`App.tsx`'s own ref). */
  mode: { current: GameMode };
  setPage: (page: MenuPage) => void;
  setSettings: (update: (s: Settings) => Settings) => void;
}): MapPicks {
  // A RACE opens the ski card on its discipline's pair and the dress card
  // on its build; the player may still take another, and every other mode
  // keeps the pair and the build last picked.
  const raceSkis = (mode: GameMode): void => {
    const pair = raceSkisOf(mode);
    if (pair) world.setSettings((s) => ({ ...s, skis: pair }));
    const weight = raceRiderOf(mode);
    if (weight) world.setSettings((s) => ({ ...s, outfit: { ...s.outfit, weight } }));
  };
  return {
    openCard: (mode, page) => {
      world.mode.current = mode;
      raceSkis(mode);
      world.setPage(page);
    },
    choose: (level) => {
      // A race map is kept as its discipline's pick.
      const discipline = findRaceMap(level.id) ? disciplineOf(level.mode) : null;
      if (discipline) {
        world.setSettings((s) => ({ ...s, raceMap: { ...s.raceMap, [discipline]: level.id } }));
      }
      world.setPage("skis");
    },
    chooseTrick: (map) => {
      world.setSettings((s) => ({ ...s, trickMap: map.id }));
      world.setPage("skis");
    },
  };
}
