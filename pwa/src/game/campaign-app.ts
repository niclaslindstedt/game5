// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMPAIGN AS THE APP HOLDS IT — the board, the rig that books a rung
// into it, the rung the skis card's RIDE is for, and the two presses that
// route a card to the skis card: a front-door tile, and a map picked on the
// campaign card or the level card.
//
// A HOOK, because the board is render state — the front door's tile and both
// cards read it — while the rig and the rung belong to the loop `App.tsx`'s
// effect builds once: the rig is made once and never replaced, so the loop
// may hold it from its first frame and every booking it makes is the board
// the next render draws. The board is written down on every change
// (`saveProgress`), which is the one place it is.

import { raceRiderOf, raceSkisOf, type GameMode } from "@engine";
import { useEffect, useRef, useState } from "preact/hooks";

import {
  loadProgress,
  saveProgress,
  type CampaignLevel,
  type CampaignProgress,
} from "./campaign.ts";
import { createCampaignRig, type CampaignRig } from "./campaign-run.ts";
import { disciplineOf, findRaceMap } from "./race-maps.ts";
import type { Settings } from "./settings.ts";
import type { TrickMap } from "./trick-maps.ts";
import type { MenuPage } from "./url-params.ts";

export type CampaignApp = {
  progress: CampaignProgress;
  rig: CampaignRig;
  /** The rung the skis card's RIDE is for, when the campaign card opened it. */
  rung: { current: CampaignLevel | null };
  /** A front-door tile: the mode its cards are for, and no rung. */
  openCard: (mode: GameMode, page: MenuPage) => void;
  /** A map picked, on to the skis card: a campaign RUNG, or a map off a
   * level card — kept as the one its discipline, or the TIME TRIAL, rides. */
  choose: (level: CampaignLevel, rung: boolean) => void;
  /** A trick map picked on the trick map card, kept as the one the TRICKS
   * run rides, on to the skis card. */
  chooseTrick: (map: TrickMap) => void;
  /** A board merged in from the skier's other devices (`use-cloud-sync.ts`)
   * becomes the one this device renders and books into. */
  adopt: (progress: CampaignProgress) => void;
  /** The board SET rather than earned — DEVELOPER ▸ UNLOCKS. */
  setProgress: (progress: CampaignProgress) => void;
};

export function useCampaign(world: {
  /** The mode the skis card's RIDE is for (`App.tsx`'s own ref). */
  mode: { current: GameMode };
  setPage: (page: MenuPage) => void;
  setSettings: (update: (s: Settings) => Settings) => void;
}): CampaignApp {
  const [progress, setProgress] = useState(loadProgress);
  const held = useRef(progress);
  held.current = progress;
  const rung = useRef<CampaignLevel | null>(null);
  const [rig] = useState(() =>
    createCampaignRig({
      progress: () => held.current,
      setProgress: (next) => setProgress((held.current = next)),
    }),
  );
  useEffect(() => saveProgress(progress), [progress]);
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
    progress,
    rig,
    rung,
    setProgress: (next) => setProgress((held.current = next)),
    openCard: (mode, page) => {
      world.mode.current = mode;
      rung.current = null;
      raceSkis(mode);
      world.setPage(page);
    },
    choose: (level, isRung) => {
      rung.current = isRung ? level : null;
      // A rung is opened off the campaign card, not a race's own: its race
      // is known only now.
      if (isRung) raceSkis(level.mode);
      // A race map is kept as its discipline's pick, a campaign map as the
      // time trial's.
      const discipline = findRaceMap(level.id) ? disciplineOf(level.mode) : null;
      if (discipline) {
        world.setSettings((s) => ({ ...s, raceMap: { ...s.raceMap, [discipline]: level.id } }));
      } else if (!isRung) world.setSettings((s) => ({ ...s, level: level.id }));
      world.setPage("skis");
    },
    chooseTrick: (map) => {
      rung.current = null;
      world.setSettings((s) => ({ ...s, trickMap: map.id }));
      world.setPage("skis");
    },
    adopt: (next) => setProgress((held.current = next)),
  };
}
