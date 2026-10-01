// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH RUN THE SKIER IS ON, and the news column that greets each one — so
// the run the sign at its head names (`run-signs.ts`) is named again as the
// skier goes past it, and a free ride that drops onto a run part-way down
// learns which one it is. DOM-free and three-free, so the suite reads it.
//
// A RUN IS ENTERED, NOT TOUCHED: the skier is ON a run while he stands
// within its width (and a couple of metres) of its line. He stays on the
// one he is on for as long as it holds him — a lane crossing it, a run
// lying beside it, is not news — and is only put on another when the one
// he was on lets him go and another has him; off every run (in the trees,
// in the air over a gap) he is still on the last. A run named in the last
// half-minute is not named again, so a skier along the seam of two runs is
// not greeted at every turn.

import type { GameState, Level, Run } from "@engine";

import { runNewsText } from "./run-names.ts";
import { newsFor, type NewsLine } from "./run-news.ts";

/** How often the run under the skier is asked, s; how far outside a run's
 * edge he is still on it, m; how long a run named is not named again, s;
 * the bucket grid's side, m. */
const WATCH = { every: 0.2, pad: 2, quiet: 30, cell: 50 };

type Station = { run: number; x: number; z: number; half: number };

const grids = new WeakMap<Level, Map<number, Station[]>>();

function gridOf(level: Level): Map<number, Station[]> {
  const hit = grids.get(level);
  if (hit) return hit;
  const grid = new Map<number, Station[]>();
  (level.resort?.runs ?? []).forEach((run, i) => {
    for (const p of run.points) {
      const key = Math.floor(p.x / WATCH.cell) * 4096 + Math.floor(p.z / WATCH.cell);
      let list = grid.get(key);
      if (!list) grid.set(key, (list = []));
      list.push({ run: i, x: p.x, z: p.z, half: p.width / 2 });
    }
  });
  grids.set(level, grid);
  return grid;
}

/** Every run holding (x, z), by index into `level.resort.runs`, with how
 * deep inside it the point is (its half-width less the distance, m). */
export function runsAt(level: Level, x: number, z: number): Map<number, number> {
  const out = new Map<number, number>();
  const grid = gridOf(level);
  const bx = Math.floor(x / WATCH.cell);
  const bz = Math.floor(z / WATCH.cell);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      for (const s of grid.get((bx + dx) * 4096 + bz + dz) ?? []) {
        const inside = s.half + WATCH.pad - Math.hypot(s.x - x, s.z - z);
        if (inside > 0 && inside > (out.get(s.run) ?? -1)) out.set(s.run, inside);
      }
    }
  }
  return out;
}

export type RunWatch = {
  /** After a step: the run the skier has just been put on, or null. A new
   * state (a restart, a replay) starts the watch over. */
  step(state: GameState): Run | null;
};

export function createRunWatch(): RunWatch {
  let seen: GameState | null = null;
  let asked = -Infinity;
  let on = -1;
  const named = new Map<number, number>();
  return {
    step(state) {
      const runs = state.level.resort?.runs;
      if (!runs) return null;
      if (state !== seen || state.t < asked) {
        seen = state;
        asked = -Infinity;
        on = -1;
        named.clear();
      }
      if (state.t - asked < WATCH.every) return null;
      asked = state.t;
      const held = runsAt(state.level, state.skier.x, state.skier.z);
      if (held.size === 0 || held.has(on)) return null;
      let best = -1;
      let deepest = -Infinity;
      for (const [i, inside] of held) {
        if (inside > deepest) {
          deepest = inside;
          best = i;
        }
      }
      on = best;
      const last = named.get(best);
      if (last !== undefined && state.t - last < WATCH.quiet) return null;
      named.set(best, state.t);
      return runs[best];
    },
  };
}

export type NewsFeed = {
  /** After a step: every line it earned — its events', and the run the
   * skier was put on. */
  step(state: GameState): NewsLine[];
};

export function createNewsFeed(): NewsFeed {
  const watch = createRunWatch();
  return {
    step(state) {
      const out: NewsLine[] = [];
      for (const e of state.events) {
        const line = newsFor(e, state);
        if (line) out.push(line);
      }
      const run = watch.step(state);
      if (run) out.push({ text: runNewsText(state.level, run), tone: "info" });
      return out;
    },
  };
}
