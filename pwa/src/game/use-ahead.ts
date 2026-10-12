// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT IS STOOD UP AHEAD OF RIDE, off the card that is up. The cards walk
// one way to the snow — the level card or the trick map card, or the free
// ride's start card, then the rider card and the gear card — and each
// already knows the map RIDE will stand up, so it is built while the
// player picks rather than under the loading card:
//
//   * A FREE RIDE's world (`free-stage.ts`): staged from the START CARD once
//     its rows have been still a moment (a row changed starts the wait
//     again), and from the rider and gear cards at once.
//   * A PINNED RUN's map (a race's, a trick map's): ordered on a worker of
//     its own from the level card or the trick map card on, the rider and
//     gear cards keeping it (`map-build.ts`'s `buildAhead`) — and a race's
//     world staged on it behind those two, as a free ride's is
//     (`pinned-run.ts`).
//
// Any other card lets both go.

import type { CreateGameOptions, GameMode } from "@engine";
import { useEffect } from "preact/hooks";

import type { Presses } from "./app-presses.ts";
import { cardPick } from "./jump-hills.ts";
import { pinnedPress } from "./pinned.ts";
import type { Settings } from "./settings.ts";
import type { Shell } from "./shell.ts";
import { isTrickRun } from "./trick-maps.ts";
import type { MenuPage } from "./url-params.ts";

/** How long the start card's rows must be still before its world is staged
 * behind it, ms: a skier rowing through the hours stages none of them. */
export const START_STILL_MS = 1500;

export function useAhead(p: {
  page: MenuPage;
  shell: Shell;
  settings: Settings;
  /** The mode the cards are for. */
  mode: { current: GameMode };
  /** A link's pinned seed, or null. */
  linkSeed: number | null;
  /** The free ride the start card has stood up so far, on its map. */
  freeOptions: () => CreateGameOptions;
  presses: { current: Presses };
}): void {
  const { page, shell, settings } = p;
  useEffect(() => {
    const free = p.mode.current === "free" && shell === "menu";
    const cards = page === "dress" || page === "skis";
    p.presses.current.stageFree(
      free && (cards || page === "start") ? p.freeOptions() : null,
      page === "start" ? START_STILL_MS : undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the ride's own fields
  }, [page, shell, settings.ride, settings.outfit]);
  useEffect(() => {
    const m = p.mode.current;
    const cards =
      shell === "menu" &&
      (page === "levels" || page === "tricks" || page === "dress" || page === "skis");
    const pin = cards && m !== "free" ? pinnedPress(settings, m, p.linkSeed) : null;
    const trick = cards && !pin && isTrickRun(m) && p.linkSeed === null;
    p.presses.current.mapAhead(
      pin ? { pin: pin[0], mode: pin[1] } : trick ? { map: cardPick(m, settings) } : null,
      page === "dress" || page === "skis",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the picks are the settings' own
  }, [page, shell, settings.raceMap, settings.trickMap, settings.jumpHill]);
}
