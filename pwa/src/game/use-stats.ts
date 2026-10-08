// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STATISTICS' RIG — the app's half of `stats.ts`: one tracker over the
// run the player rides, the book it is folded into, and the store under
// both. `App.tsx` arms it on every run stood up, steps it on every step the
// player rides (never the bot's, a pre-roll's or a replay's), and has it
// fold at the moments a run is worth keeping (see `stats.ts`'s header): the
// flag or the run out (the rig sees those itself), the next run, the menu,
// the page hidden, the card opened.

import { useMemo, useRef, useState } from "preact/hooks";

import type { GameMode, GameState } from "@engine";

import {
  createStatsTracker,
  emptyStats,
  foldRun,
  loadStats,
  saveStats,
  type StatsBook,
} from "./stats.ts";

export type StatsRig = {
  /** A new run stood up: the last one folded, this one armed. */
  arm: (state: GameState, mode: GameMode) => void;
  step: (state: GameState) => void;
  /** Fold what the run has done so far. */
  flush: () => void;
  /** Clear the book, on disk too. */
  reset: () => void;
};

export function useStats(): {
  book: StatsBook;
  rig: StatsRig;
  /** The front door's tile: runs, metres skied, the top speed in km/h. */
  face: { runs: number; distance: number; kmh: number | null };
} {
  const [book, setBook] = useState<StatsBook>(loadStats);
  const held = useRef(book);
  const rig = useMemo<StatsRig>(() => {
    const tracker = createStatsTracker();
    const flush = (): void => {
      const taken = tracker.take();
      if (!taken) return;
      held.current = foldRun(held.current, taken);
      saveStats(held.current);
      setBook(held.current);
    };
    return {
      arm: (state, mode) => {
        flush();
        tracker.arm(state, mode, Date.now());
      },
      step: (state) => {
        tracker.step(state);
        if (state.events.some((e) => e.kind === "finish" || e.kind === "out" || e.kind === "death"))
          flush();
      },
      flush,
      reset: () => {
        held.current = emptyStats();
        saveStats(held.current);
        setBook(held.current);
      },
    };
  }, []);
  const top = book.bests.top;
  return {
    book,
    rig,
    face: { runs: book.runs, distance: book.sums.distance, kmh: top ? top.value * 3.6 : null },
  };
}
