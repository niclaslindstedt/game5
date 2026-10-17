// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT IS STOOD UP AHEAD OF RIDE, off the card that is up. The cards walk
// one way to the snow — the level card or the trick map card, or the free
// ride's start card, then the rider card and the gear card — and each
// already knows the map RIDE will stand up, so it is built while the
// player picks rather than under the loading card:
//
//   * A FREE RIDE's world (`free-stage.ts`): staged from the rider and gear
//     cards, never from the START CARD. Building a world is seconds of the
//     page's own thread on a phone, and every row there changes it (the
//     season, the start, the run) — a stage behind it was thrown away and
//     begun again on nearly every press, and the rows answered seconds
//     late. The start card keeps only its map (its own worker's) and its
//     chart; the rider card's stage covers the screen while the world is
//     built behind it.
//   * QUICK START's map, from the front door: its next ride is dealt
//     before it is pressed (`App.tsx`), so its mountain is raised on a
//     worker while the door is up and the press finds it built.
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
import { FIRST_FREE_SEED, freeGameOptions } from "./free-ride.ts";
import { cardPick } from "./jump-hills.ts";
import { gameOrder } from "./map-order.ts";
import { pinnedPress, type PinnedSkier } from "./pinned.ts";
import type { Settings } from "./settings.ts";
import type { Shell } from "./shell.ts";
import { isTrickRun } from "./trick-maps.ts";
import { useQuickRide, type QuickRide } from "./use-quick.ts";
import type { MenuPage } from "./url-params.ts";

export function useAhead(p: {
  page: MenuPage;
  shell: Shell;
  settings: Settings;
  /** The mode the cards are for. */
  mode: { current: GameMode };
  /** A link's pinned seed, or null. */
  linkSeed: number | null;
  /** The skier a free ride is stood up with: the cards' rider and pair. */
  skier: () => PinnedSkier;
  presses: { current: Presses };
  /** Whether the presses are wired yet: the render stack is fetched after
   * the first frame, and an order handed over before it is lost. */
  live: boolean;
}): QuickRide {
  const { page, shell, settings } = p;
  const quick = useQuickRide(settings.ride);
  /** The free ride the start card has stood up so far, on its map. */
  const freeOptions = (): CreateGameOptions =>
    freeGameOptions(settings.ride, settings.ride.seed ?? FIRST_FREE_SEED, p.skier());
  useEffect(() => {
    const free = p.mode.current === "free" && shell === "menu";
    const cards = page === "dress" || page === "skis";
    // The start card neither stages nor throws a stage away: back from the
    // rider card to change nothing, the world built is still the ride's.
    if (page === "start") return;
    p.presses.current.stageFree(free && cards ? freeOptions() : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the ride's own fields
  }, [page, shell, settings.ride, settings.outfit, p.live]);
  useEffect(() => {
    const m = p.mode.current;
    const cards =
      shell === "menu" &&
      (page === "levels" || page === "tricks" || page === "dress" || page === "skis");
    const pin = cards && m !== "free" ? pinnedPress(settings, m, p.linkSeed) : null;
    const trick = cards && !pin && isTrickRun(m) && p.linkSeed === null;
    const door = shell === "menu" && page === "root";
    p.presses.current.mapAhead(
      pin
        ? { pin: pin[0], mode: pin[1] }
        : trick
          ? { map: cardPick(m, settings) }
          : door
            ? { order: gameOrder(quick.options(p.skier())) }
            : null,
      page === "dress" || page === "skis",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the picks are the settings' own
  }, [page, shell, settings.raceMap, settings.trickMap, settings.jumpHill, quick.dealt, p.live]);
  return quick;
}
