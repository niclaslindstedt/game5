// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RESUME (DOM-free): the run the player left for the menu, kept while the
// bot rides it under the cards (`backdrop-run.ts`), and taken back from
// wherever the bot has got to. A free ride the bot rides to its end is
// stood up again at the top of its last piste and kept (`backdropNext`'s
// `again`); a race is kept until its flag. Anything else that takes the
// backdrop — a showcase, a new run — lets it go, and RESUME with it.

import type { CreateGameOptions, GameMode, GameState } from "@engine";

import { backdropNext } from "./backdrop-run.ts";
import { dying } from "./xray-run.ts";

export type ResumeRun = {
  /** The player has left `state`, ridden in `mode`, for the menu. */
  leave: (state: GameState, mode: GameMode) => void;
  /** The backdrop's next run once `state` is over (`backdropNext`), the
   * ride left kept through it. */
  next: (state: GameState, again: CreateGameOptions | null) => GameState | null;
  /** Whether `state`, the backdrop now, can be taken back. */
  can: (state: GameState) => boolean;
  /** The mode `state` was ridden in, letting it go — or null where it is
   * not the run left. */
  take: (state: GameState) => GameMode | null;
};

export function createResumeRun(): ResumeRun {
  let left: GameState | null = null;
  let mode: GameMode = "free";
  const can = (state: GameState): boolean =>
    state === left && !state.progress.finished && !dying(state);
  return {
    leave: (state, asked) => {
      left = state;
      mode = asked;
    },
    next: (state, again) => {
      const mine = state === left;
      const next = backdropNext(state, mine ? again : null);
      if (next) left = mine && next.showcase === undefined ? next : null;
      return next;
    },
    can,
    take: (state) => {
      if (!can(state)) return null;
      left = null;
      return mode;
    },
  };
}
