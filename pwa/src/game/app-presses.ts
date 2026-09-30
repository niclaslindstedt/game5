// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PRESSES THE CARDS MAKE — the shape of the box `App.tsx`'s effect fills
// with the game's own buttons, and the box it starts as. Stated here rather
// than at the top of `App.tsx` because it is not the app's decision about
// WHEN one surface gives way to the next, which is what that file is for.

import type { CreateGameOptions, GameMode } from "@engine";

import type { CampaignLevel } from "./campaign.ts";
import type { TrickMap } from "./trick-maps.ts";

/** The presses the cards make, boxed so a card re-rendering is never a
 * reason to rebuild the loop that owns the race. */
export type Presses = {
  race: (seed: number, mode: GameMode) => void;
  free: (options: CreateGameOptions) => void;
  /** A TRICKS run on a trick map (`trick-maps.ts`). */
  tricks: (map: TrickMap) => void;
  /** A pinned map: a campaign rung (`rung`), or a map off the level card. */
  pinned: (pin: CampaignLevel, mode: CampaignLevel["mode"], rung: boolean) => void;
  restart: () => void;
  pause: () => void;
  resume: () => void;
  toMenu: () => void;
  abandonLoad: () => void;
  camera: () => void;
  watch: () => void;
  shot: () => void;
};

export const NO_PRESSES: Presses = {
  race: () => {},
  free: () => {},
  tricks: () => {},
  pinned: () => {},
  restart: () => {},
  pause: () => {},
  resume: () => {},
  toMenu: () => {},
  abandonLoad: () => {},
  camera: () => {},
  watch: () => {},
  shot: () => {},
};
