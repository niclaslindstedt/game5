// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HALFPIPE'S JUDGES (R39's contest): a RUN read hit by hit and scored
// as a panel scores it.
//
// THE READING. A pipe run is five or six HITS, a wall each, alternating.
// Each hit is a flight off a wall (`FlightRecord.pipe`, filed by
// `tricks.ts` off `pipe-air.ts`'s `pipeHit`) read as the trick it was
// (`judge.ts`'s `readTrick`) — and one thing more, the pipe's own: an
// ALLEY-OOP, a spin of 180 or more turned UPHILL, against the way he is
// travelling down the pipe. Off the right-hand wall (the pipe's line
// facing down it) the way down is a turn to the left, so a right-hand turn
// there is the alley-oop, and the other way round off the left-hand wall.
//
// THE SCORE. A halfpipe run is judged on its OVERALL IMPRESSION, 0–100 —
// amplitude, difficulty, execution, variety, progression, and the pipe's
// own PIPE USE: the height kept from the first hit to the last, landing
// high on the wall, every hit used (`docs/freestyle.md` § *What every
// judged park format shares*). `runImpression` puts that on one number:
// each criterion read to a share, weighted, a landing on the flat or the
// deck taken off as the snowboard scale's minor mistake, a sketchy landing
// as a medium one. A FALL ends the run and is scored low whatever came
// before it. Six judges each mark the run whole, a little apart (each
// judge's eye dealt off a hash of the contest's seed, the run and the
// judge — never the run's stream), the highest and the lowest dropped and
// the four left averaged, CUT to two decimals (`judge.ts`'s `panelScore`).

import { difficultyOf, panelScore, readTrick, type TrickRead } from "./judge.ts";
import type { FlightRecord, GameState } from "./state.ts";

/** How the halfpipe's panel weighs a run. */
export const PIPE_JUDGING = {
  /** Hits a full run is read over: a top run's five or six. */
  hits: 6,
  /** THE DIFFICULTY, in `judge.ts`'s steps: an alley-oop adds `oop`; a hit
   * of `top` steps (a double-cork 1440 thrown switch, say) is the most. */
  oop: 1.5,
  top: 13,
  /** THE AMPLITUDE: the feet's height over the coping, m, a hit is given
   * the whole of it at (a good hit's 4–6 m, the record just over 8). */
  amplitude: 5,
  /** The weights of difficulty, amplitude, execution, variety and pipe
   * use (they sum to one). */
  weights: { difficulty: 0.34, amplitude: 0.22, execution: 0.16, variety: 0.13, use: 0.15 },
  /** A run that does everything scores `floor` + `span`. */
  floor: 10,
  span: 88,
  /** MISTAKES, points off: a landing on the flat or the deck, a sketchy
   * landing (harsh, or still in a grab). */
  flat: 6,
  sketchy: 10,
  /** A FALL: the most such a run scores, and the share of what came
   * before it that it keeps. */
  fallMost: 30,
  fallKeeps: 0.4,
} as const;

/** ONE HIT AS THE PANEL READS IT. */
export type HitRead = {
  read: TrickRead;
  alleyOop: boolean;
  /** The feet's height over the coping, m. */
  over: number;
  on: "wall" | "flat" | "deck";
  side: number;
  outcome: FlightRecord["outcome"];
  /** The hit's difficulty, in steps. */
  difficulty: number;
};

/** THE PANEL'S SHEET for a run: every hit read, each criterion's share
 * (0..1), the impression and the score — and whether it was a fall. */
export type PipeScore = {
  hits: HitRead[];
  parts: { difficulty: number; amplitude: number; execution: number; variety: number; use: number };
  impression: number;
  total: number;
  fell: boolean;
};

/** Whether a hit turned uphill: a spin of 180 or more the way that turns
 * him toward the pipe's top off the wall `side` (`PipeHit.side`). */
export function isAlleyOop(f: FlightRecord): boolean {
  if (!f.pipe) return false;
  const halves = Math.round(Math.abs(f.spin) / Math.PI);
  return halves >= 1 && Math.sign(f.spin) === f.pipe.side;
}

/** A hit read: its trick, the alley-oop, its height and where it came down. */
export function readHit(f: FlightRecord): HitRead {
  const read = readTrick(f);
  const alleyOop = isAlleyOop(f);
  return {
    read,
    alleyOop,
    over: f.pipe?.over ?? 0,
    on: f.pipe?.on ?? "wall",
    side: f.pipe?.side ?? 1,
    outcome: f.outcome,
    difficulty: difficultyOf(read) + (alleyOop ? PIPE_JUDGING.oop : 0),
  };
}

/** The run's hits: every flight off a wall. */
export function hitsOf(state: GameState): HitRead[] {
  return state.tricks.flights.filter((f) => f.pipe).map(readHit);
}

/** THE OVERALL IMPRESSION of a run's hits, 0–100, before the panel's eyes;
 * `fell` when the run went down. */
export function runImpression(
  hits: readonly HitRead[],
  fell: boolean,
): {
  impression: number;
  parts: PipeScore["parts"];
} {
  const J = PIPE_JUDGING;
  const n = J.hits;
  const mean = (f: (h: HitRead) => number): number =>
    hits.slice(0, n).reduce((s, h) => s + f(h), 0) / n;
  const difficulty = mean((h) => Math.min(1, h.difficulty / J.top));
  const amplitude = mean((h) => Math.min(1, h.over / J.amplitude));
  // Execution: the landings — whole and clean, or sketchy, or down.
  const execution = mean((h) => (h.outcome === "landed" ? 1 : h.outcome === "sketchy" ? 0.4 : 0));
  // Variety: both directions, the alley-oop, more than one size of spin,
  // a flip, a grab, a switch take-off — each a sixth.
  const dirs = new Set(hits.map((h) => h.read.dir).filter((d) => d !== null));
  const sizes = new Set(hits.map((h) => h.read.spin).filter((s) => s > 0));
  const variety =
    (Math.min(2, dirs.size) / 2 +
      (hits.some((h) => h.alleyOop) ? 1 : 0) +
      Math.min(3, sizes.size) / 3 +
      (hits.some((h) => h.read.flips > 0) ? 1 : 0) +
      Math.min(2, new Set(hits.flatMap((h) => h.read.grabs)).size) / 2 +
      (hits.some((h) => h.read.switchIn) ? 1 : 0)) /
    6;
  // Pipe use: every hit used, the height kept to the last, on the wall.
  const overs = hits.map((h) => h.over);
  const kept = overs.length > 1 ? Math.min(...overs) / Math.max(0.5, Math.max(...overs)) : 0;
  const onWall = hits.length > 0 ? hits.filter((h) => h.on === "wall").length / hits.length : 0;
  const use = 0.5 * Math.min(1, hits.length / (n - 1)) + 0.3 * kept + 0.2 * onWall;
  const W = J.weights;
  let impression =
    J.floor +
    J.span *
      (W.difficulty * difficulty +
        W.amplitude * amplitude +
        W.execution * execution +
        W.variety * variety +
        W.use * use);
  for (const h of hits) {
    if (h.on !== "wall") impression -= J.flat;
    if (h.outcome === "sketchy") impression -= J.sketchy;
  }
  if (fell) impression = Math.min(J.fallMost, impression * J.fallKeeps);
  return {
    impression: Math.max(1, Math.min(99, impression)),
    parts: { difficulty, amplitude, execution, variety, use },
  };
}

/** THE RUN ON THE SNOW JUDGED — once it is over (finished, or out) — on a
 * map with a pipe; `seed` and `run` name the run the panel's eyes are
 * dealt for. Null while it is on. */
export function judgeHalfpipe(state: GameState, seed: number, run: number): PipeScore | null {
  if (!state.level.halfpipe) return null;
  const p = state.progress;
  if (!p.finished && !p.out) return null;
  const hits = hitsOf(state);
  const fell = p.out !== null || hits.some((h) => h.outcome === "fell");
  const { impression, parts } = runImpression(hits, fell);
  return { hits, parts, impression, total: panelScore(impression, seed, run), fell };
}
