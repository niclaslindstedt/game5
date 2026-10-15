// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MAP'S ATTEMPTS RUN SIDE BY SIDE — which attempt to start next, and
// when the race is decided. DOM-free and worker-free, so the rule is held
// by a test (`tests/attempt_race_test.ts`) and the pool that drives it
// (`attempt-pool.ts`) only starts and ends workers.
//
// The generator searches a seed's map attempt by attempt and keeps the
// first one its rule book passes (`generateLevel`). An attempt is a pure
// function of the seed and its number, so they need not be tried in turn:
// several are built at once, and the map is the LOWEST-NUMBERED attempt
// accepted — the very one the search in turn would have kept. An accepted
// attempt wins only once every attempt below it is known refused; until
// then the lower ones run on and nothing above it is started.

/** Where a race stands. */
export type RaceVerdict =
  /** Still running. */
  | { kind: "open" }
  /** Decided: this attempt is the map. */
  | { kind: "won"; attempt: number }
  /** Every attempt refused. */
  | { kind: "lost" };

export type AttemptRace = {
  /** The next attempt to start, or null: none left, or none worth it (one
   * is accepted and only lower ones are still owed an answer). */
  next: () => number | null;
  /** An attempt's answer: accepted or refused. */
  settle: (attempt: number, accepted: boolean) => RaceVerdict;
  /** The attempts started and not yet answered. */
  running: () => number[];
  /** Attempts running that can no longer win (above an accepted one). */
  moot: () => number[];
};

/** A race over `total` attempts, numbered from 0. */
export function createAttemptRace(total: number): AttemptRace {
  let started = 0;
  const running = new Set<number>();
  const refused = new Set<number>();
  /** The lowest accepted so far. */
  let best = Infinity;

  const verdict = (): RaceVerdict => {
    if (best < Infinity) {
      for (let a = 0; a < best; a++) if (!refused.has(a)) return { kind: "open" };
      return { kind: "won", attempt: best };
    }
    return refused.size >= total ? { kind: "lost" } : { kind: "open" };
  };

  return {
    next: () => {
      if (started >= total || started > best) return null;
      running.add(started);
      return started++;
    },
    settle: (attempt, accepted) => {
      running.delete(attempt);
      if (accepted) best = Math.min(best, attempt);
      else refused.add(attempt);
      return verdict();
    },
    running: () => [...running],
    moot: () => [...running].filter((a) => a > best),
  };
}

/** How many attempts to build at once on a machine of `cores`: one core
 * left to the page, and no more than four — each attempt holds a whole ski
 * area's grids, tens of megabytes, and a phone has no heap to spare. */
export function poolWidth(cores: number): number {
  return Math.max(2, Math.min(4, Math.floor(cores || 4) - 1));
}
