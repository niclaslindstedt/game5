// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIELD OF AN INTERVAL START — a slalom's start list (R31), skied one
// racer at a time out of the start hut BEFORE the player, as a real race
// is: by the time he stands in the hut, the times are on the board and the
// leader's splits are what his own are read against.
//
// The start list is dealt exactly as a start line's field is
// (`dealRivals`: the same draws in the same order off the same streams),
// every racer stood in the hut, and each is then skied to the finish — or
// out of the race — by the very bot and the very step a rival on the line
// is (`rivalInput`, `stepRun`), alone on the course, off a random stream
// of his own so the player's run draws nothing from the field's.
//
// THE SECOND RUN: the first run's field is carried in (`Heat`), and only
// its finishers start — the best `SLALOM.qualify` in reverse order, the
// leader last, the rest after them in order — each carrying his first-run
// time; the standings are the combined time.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { SLALOM } from "./defs/modes.ts";
import { TUNING } from "./defs/tuning.ts";
import { dealRivals, rivalInput } from "./rivals.ts";
import { stepRun } from "./run.ts";
import { freshStep } from "./snowfall.ts";
import type { FieldRun, GameState, Rival } from "./state.ts";

/** What each racer's own stream is seeded with beside the run's seed. */
const FIELD_SALT = 0x0f1e1d;

/** THE FIRST RUN, carried into the second: the player's time and the
 * field as it finished. */
export type Heat = { run: 2; player: number; field: readonly FieldRun[] };

/** SKI THE FIELD: `count` racers dealt, the starters among them (all of
 * them on the first run; the first run's finishers on the second) skied
 * alone, and the field put on the state. Called once, from `createGame`,
 * before the player's run has taken a step. */
export function createField(state: GameState, count: number, heat?: Heat): void {
  const hut = state.level.grid[0] ?? state.level.spawn;
  const dealt = dealRivals(state, count, () => hut);
  const carried = new Map((heat?.field ?? []).map((r) => [r.id, r]));
  let starters: Rival[] = dealt;
  if (heat) {
    const home = dealt
      .filter((r) => carried.get(r.id)?.time != null)
      .sort((a, b) => (carried.get(a.id)?.time ?? 0) - (carried.get(b.id)?.time ?? 0));
    const top = home.slice(0, SLALOM.qualify).reverse();
    starters = [...top, ...home.slice(SLALOM.qualify)];
  }
  state.field = {
    run: heat ? 2 : 1,
    runs: starters.map((r) => skiAlone(state, r, carried.get(r.id)?.time ?? 0)),
    before: heat?.player ?? 0,
  };
}

/** One racer's run, skied from the hut to the finish — or out of the race,
 * or to `SLALOM.limit` seconds of trying — on his own. */
function skiAlone(state: GameState, rival: Rival, before: number): FieldRun {
  const run = rival.run;
  run.rng = createRng((state.seed ^ FIELD_SALT ^ Math.imul(rival.id + 1, 0x9e3779b1)) >>> 0);
  const dt = TUNING.dt;
  const end = run.rules.countdown + SLALOM.limit;
  while (!run.progress.finished && run.t < end) {
    run.t += dt;
    run.tick += 1;
    run.fresh += freshStep(run.level, run.t, dt);
    if (run.phase === "countdown") {
      run.countdown = Math.max(0, run.countdown - dt);
      if (run.countdown <= 0) run.phase = "racing";
    }
    run.events.length = 0;
    stepRun(run, rivalInput(run, rival, run.t - run.rules.countdown), run.events);
  }
  const p = run.progress;
  const out = p.out ?? (p.finished ? null : { status: "dnf", why: "fall", gate: p.nextCheckpoint });
  return {
    id: rival.id,
    skis: run.skier.spec.id,
    time: out ? null : p.time,
    out,
    splits: p.splits.slice(),
    before,
  };
}

/** A racer's standing: the combined time, or none when he is out. */
function totalOf(r: FieldRun): number | null {
  return r.time === null ? null : r.before + r.time;
}

/** THE PLAYER'S PLACE against the field: one more than the racers whose
 * combined time beats his — his clock so far while he is still on the
 * course. */
export function fieldPlace(state: GameState): number {
  const f = state.field;
  if (!f) return 1;
  const mine = f.before + state.progress.time;
  let ahead = 0;
  for (const r of f.runs) {
    const total = totalOf(r);
    if (total !== null && total < mine) ahead += 1;
  }
  return ahead + 1;
}

/** THE WHOLE FIELD IN ORDER, best first, by combined time: every racer's
 * id, `null` where the player stands — the racers out of the race after
 * everyone home, in start order, and the player among them when he is. */
export function fieldOrderOf(state: GameState): (number | null)[] {
  const f = state.field;
  if (!f) return [null];
  const p = state.progress;
  const rows: { id: number | null; total: number | null; order: number }[] = f.runs.map((r, i) => ({
    id: r.id,
    total: totalOf(r),
    order: i,
  }));
  rows.push({ id: null, total: p.out ? null : f.before + p.time, order: f.runs.length });
  rows.sort((a, b) => {
    if (a.total === null || b.total === null) {
      return a.total === null && b.total === null ? a.order - b.order : a.total === null ? 1 : -1;
    }
    return a.total - b.total || a.order - b.order;
  });
  return rows.map((r) => r.id);
}
