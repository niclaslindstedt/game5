// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE WANTED LEVEL (`engine/game/wanted.ts`) — a block of the
// one strings table (`strings.ts`, §39.1), stated next door and spread into
// `STRINGS` under the same names: the stars' label, the survival timer, the
// news a hunt makes, and the arrest's card.

import { formatTime } from "@niclaslindstedt/oss-game-framework/hud/format";

export const WANTED_STRINGS = {
  /** The stars, as a screen reader says them. */
  wantedLabel: (stars: number, searching: boolean): string =>
    `Wanted: ${stars} of 5 stars${searching ? ", searching" : ""}`,
  /** THE SURVIVAL TIMER beside the stars, and the best under it. */
  wantedSurvived: (seconds: number): string => formatTime(seconds),
  wantedBest: (seconds: number): string => `BEST ${formatTime(seconds)}`,
  /** Under the stars while they search: how he is losing them. */
  wantedHidden: "HIDDEN",
  wantedSearch: "OUT OF SIGHT",
  /** The news a hunt makes (`run-news.ts`). */
  newsWanted: (stars: number): string => `WANTED ${"★".repeat(stars)}`,
  newsWantedLost: "LOST THEM",
  newsArrested: "ARRESTED",
  /** THE ARREST'S CARD (SAFE FOR WORK): the word and what happened. */
  arrestedWord: "ARRESTED",
  arrestedLine: "THE ARMY TOOK HIM IN",
  /** On an ended run's card, how long the hunt lasted against the best. */
  survivedLine: (seconds: number, best: number): string =>
    `SURVIVED ${formatTime(seconds)} · BEST ${formatTime(best)}`,
};
