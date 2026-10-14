// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RUN READ AHEAD — how a live camera knows a jump is coming. A replay's
// director has the whole run in his hand (`replay-shots.ts`); the menu's
// film director is watching a run that has not happened yet. But the engine
// is deterministic and the backdrop is the bot's, so the future is there to
// be read: a COPY of the run (`impact-forecast.ts`'s `forkRun`) is ridden on
// ahead by the same hands (`backdrop-run.ts`'s `backdropInput`) and watched
// by the replay's own shot collector, so a flight, a crash or a pass is
// known a few seconds before the run gets there — and the film camera can
// plant its lens down by the landing BEFORE he leaves the lip, exactly as a
// broadcast does.
//
// PAID OUT OVER FRAMES: the copy is stepped only while the frame's budget
// lasts (`more`), and read from afresh off the run every `resync` s, so it
// never drifts far from what the run will do (a copy's daring bot keeps its
// memo beside the copy, not the run, and may choose its line again). What a
// read found is kept until a fresh read has passed the step it was at
// without finding it again. And where it had him — `path` — so a lens can
// be stood on the line he will ski.
//
// The copy shares nothing with the run but the map and pure functions, so
// the run itself never moves: its digests are what they were. DOM-free.

import { TUNING, step as stepRun, type GameState, type SkierInput } from "@engine";

import type { Vec3 } from "./camera-rigs.ts";
import { forkRun } from "./impact-forecast.ts";
import { createShotCollector, type ReplayShot, type ShotCollector } from "./replay-shots.ts";

const HZ = TUNING.physicsHz;

/** How far ahead, how often a fresh read is taken, s; where he is noted
 * every `sample` steps; two finds within `same` s of each other are one. */
export const AHEAD = { horizon: 4.5, resync: 2, sample: 6, same: 0.6, keep: 3 } as const;

/** A moment the read found, and whether a read since has found it again. */
type Found = ReplayShot & { sure: boolean };

export type LookAhead = {
  /** Read on while `more()` says there is time: `state` is the run. */
  frame: (state: GameState, more: () => boolean) => void;
  /** Every moment known from a little behind the run to the horizon. */
  shots: () => readonly ReplayShot[];
  /** Where the read has him at `step`, or null where it has not got there. */
  path: (step: number) => Vec3 | null;
  /** How far ahead of the run the read has got, steps. */
  reach: (state: GameState) => number;
  drop: () => void;
};

export function createLookAhead(drive: (state: GameState) => SkierInput): LookAhead {
  let run: GameState | null = null;
  let copy: GameState | null = null;
  let collector: ShotCollector | null = null;
  let seen = 0;
  let born = 0;
  let found: Found[] = [];
  const where = new Map<number, Vec3>();

  const fresh = (state: GameState): void => {
    copy = forkRun(state);
    collector = createShotCollector();
    seen = 0;
    born = state.tick;
    for (const f of found) if (f.at > state.tick) f.sure = false;
  };

  return {
    drop: () => {
      run = copy = collector = null;
      found = [];
      where.clear();
    },
    reach: (state) => (copy ? copy.tick - state.tick : 0),
    shots: () => found,
    path: (at) => {
      const k = Math.floor(at / AHEAD.sample) * AHEAD.sample;
      const a = where.get(k);
      const b = where.get(k + AHEAD.sample);
      if (!a) return null;
      if (!b) return a;
      const f = (at - k) / AHEAD.sample;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f };
    },
    frame: (state, more) => {
      // A new run under the cards (a showcase stood up again): start over.
      if (state !== run || (copy && copy.level !== state.level)) {
        run = state;
        found = [];
        where.clear();
        copy = null;
      }
      if (!copy || copy.tick < state.tick || state.tick - born >= AHEAD.resync * HZ) fresh(state);
      const c = copy!;
      const until = state.tick + Math.round(AHEAD.horizon * HZ);
      while (c.tick < until && more()) {
        stepRun(c, drive(c));
        collector!.step(c, c.tick);
        if (c.tick % AHEAD.sample === 0) {
          where.set(c.tick, { x: c.skier.x, y: c.skier.y, z: c.skier.z });
        }
      }
      // What the read found since last asked: kept, and any older find of
      // the same moment put in its place.
      const all = collector!.all();
      for (; seen < all.length; seen++) {
        const s = all[seen];
        found = found.filter((f) => f.kind !== s.kind || Math.abs(f.at - s.at) > AHEAD.same * HZ);
        found.push({ ...s, sure: true });
      }
      // A find this read has gone past without finding again was the last
      // read's guess; and anything long behind the run is history.
      const past = state.tick - AHEAD.keep * HZ;
      found = found
        .filter((f) => f.sure || c.tick <= f.at + f.runs + 0.5 * HZ)
        .filter((f) => f.at + f.runs > past)
        .sort((a, b) => a.at - b.at);
      for (const k of where.keys()) if (k < past) where.delete(k);
    },
  };
}
