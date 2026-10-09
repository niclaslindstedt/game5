// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PRESSES THE CARDS MAKE — the shape of the box `App.tsx`'s effect fills
// with the game's own buttons, and the box it starts as. Stated here rather
// than at the top of `App.tsx` because it is not the app's decision about
// WHEN one surface gives way to the next, which is what that file is for.

import type { CreateGameOptions, GameMode } from "@engine";

import type { PinnedLevel } from "./pinned.ts";
import type { ReplayFrom } from "./replay.ts";
import type { TrickMap, TrickRun } from "./trick-maps.ts";

/** The presses the cards make, boxed so a card re-rendering is never a
 * reason to rebuild the loop that owns the race. */
export type Presses = {
  race: (seed: number, mode: GameMode) => void;
  free: (options: CreateGameOptions) => void;
  /** A TRICKS run on a trick map (`trick-maps.ts`), or a BIG AIR contest
   * built over one. */
  tricks: (map: TrickMap, mode?: TrickRun) => void;
  /** A pinned map off the level card. */
  pinned: (pin: PinnedLevel, mode: PinnedLevel["mode"]) => void;
  restart: () => void;
  /** A slalom's SECOND RUN, off the first run's plate (`pinned-run.ts`). */
  second: () => void;
  pause: () => void;
  resume: () => void;
  toMenu: () => void;
  abandonLoad: () => void;
  camera: () => void;
  /** Watch the run so far (`replay-run.ts`), and hand it back. */
  watch: (from?: ReplayFrom) => void;
  unwatch: () => void;
  shot: () => void;
};

export const NO_PRESSES: Presses = {
  race: () => {},
  free: () => {},
  tricks: () => {},
  pinned: () => {},
  restart: () => {},
  second: () => {},
  pause: () => {},
  resume: () => {},
  toMenu: () => {},
  abandonLoad: () => {},
  camera: () => {},
  watch: () => {},
  unwatch: () => {},
  shot: () => {},
};
