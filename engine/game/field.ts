// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIELD OF AN INTERVAL START — a slalom's start list (R31). Only one
// racer is ever on a slalom course, so the field is never skied: by the
// time the player stands in the hut its racers have been down, and what he
// races is the BOARD — their times, the clock at every gate, who went out
// and where. Every figure on it is dealt here, off the map's seed on
// streams of the field's own, about the course's PAR (`par.ts`): what a
// good racer takes down this line on a slalom ski.
//
// A RACER is a SKILL (0 the weakest of the list, 1 the best) and a GRIT,
// dealt once for the race. His run is par times his skill's share of
// `FIELD.spread` over it and a little of the day's own (`FIELD.noise`);
// the weaker he is, the likelier he goes out (`FIELD.out`) — a gate missed
// or straddled, disqualified, or a fall — at a gate dealt down the course.
//
// THE START ORDER: on the first run the best seeds go first, drawn among
// themselves (`FIELD.seeds`), then the rest by skill, and the player last,
// to a full board. On the SECOND the first run's finishers start — the best
// `SLALOM.qualify` in reverse, the leader last, the rest after them in
// order — the player among them in his own place (`Field.slot`); the
// racers after him come down once he is home. The standings are the
// combined time.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { SLALOM } from "./defs/modes.ts";
import { skisById } from "./defs/skis.ts";
import { slalomPar } from "./par.ts";
import type { FieldRun, GameState, RunOut } from "./state.ts";

/** What the field's streams are seeded with beside the map's seed. */
const FIELD_SALT = 0x0f1e1d;

/** THE FIELD'S NUMBERS. */
export const FIELD = {
  /** The weakest racer's run over par, as a share of it, and the most a
   * run strays either way on the day. */
  spread: 0.09,
  noise: 0.012,
  /** The best racer's run over par — a good racer is par. */
  best: -0.01,
  /** The chance a run goes out: the best racer's, and the weakest's. */
  out: { best: 0.06, worst: 0.24 },
  /** How a run goes out, by share: a gate missed, a pole straddled, a fall. */
  why: { missed: 0.45, straddle: 0.25, fall: 0.3 },
  /** The best seeds, drawn among themselves at the head of the first run. */
  seeds: 7,
} as const;

/** THE FIRST RUN, carried into the second: the player's time and the
 * field as it finished. */
export type Heat = { run: 2; player: number; field: readonly FieldRun[] };

/** One racer of the start list: his slot (a rival's id), his skill and his
 * grit. */
type Racer = { id: number; skill: number; grit: number };

/** THE START LIST: `count` racers, each dealt off the field's stream — the
 * same list on both runs of a race. */
function startList(seed: number, count: number): Racer[] {
  const rng = createRng((seed ^ FIELD_SALT) >>> 0);
  const out: Racer[] = [];
  for (let id = 0; id < count; id++) out.push({ id, skill: rng.next(), grit: rng.next() });
  return out;
}

/** DEAL THE FIELD: the start list, the order it goes in, and every run of
 * it about the course's par — the field put on the state. Called once,
 * from `createGame`, before the player's run has taken a step. */
export function createField(state: GameState, count: number, heat?: Heat): void {
  const run = heat ? 2 : 1;
  const list = startList(state.seed, count);
  const order = createRng((state.seed ^ FIELD_SALT ^ 0x51) >>> 0);
  let starters: Racer[];
  let slot: number;
  if (!heat) {
    const ranked = [...list].sort((a, b) => b.skill - a.skill || a.id - b.id);
    const seeds = ranked.slice(0, FIELD.seeds);
    for (let i = seeds.length - 1; i > 0; i--) {
      const j = order.int(0, i);
      [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
    }
    starters = [...seeds, ...ranked.slice(FIELD.seeds)];
    slot = starters.length;
  } else {
    // The first run's finishers, the player among them.
    const carried = new Map(heat.field.map((r) => [r.id, r]));
    type Row = { racer: Racer | null; time: number };
    const home: Row[] = list
      .filter((r) => carried.get(r.id)?.time != null)
      .map((r) => ({ racer: r, time: carried.get(r.id)?.time ?? 0 }));
    home.push({ racer: null, time: heat.player });
    home.sort((a, b) => a.time - b.time || (a.racer?.id ?? -1) - (b.racer?.id ?? -1));
    const go = [...home.slice(0, SLALOM.qualify).reverse(), ...home.slice(SLALOM.qualify)];
    slot = go.findIndex((r) => r.racer === null);
    starters = go.flatMap((r) => (r.racer ? [r.racer] : []));
  }
  const before = new Map((heat?.field ?? []).map((r) => [r.id, r.time ?? 0]));
  state.field = {
    run,
    runs: starters.map((r) => dealRun(state, r, run, before.get(r.id) ?? 0)),
    before: heat?.player ?? 0,
    slot,
  };
}

/** One racer's run about par: home in his time with the clock at every
 * gate, or out at a gate. */
function dealRun(state: GameState, racer: Racer, run: 1 | 2, before: number): FieldRun {
  const rng = createRng(
    (state.seed ^ FIELD_SALT ^ Math.imul(run, 0x9e3779b1) ^ Math.imul(racer.id + 1, 0x85ebca6b)) >>>
      0,
  );
  const level = state.level;
  const par = slalomPar(level, skisById(SLALOM.skis));
  const n = level.checkpoints.length;
  const weak = 1 - racer.skill;
  const share =
    1 +
    FIELD.best +
    (FIELD.spread - FIELD.best) * weak +
    FIELD.noise * (rng.next() + rng.next() - 1);
  const parSplits = par?.splits ?? level.checkpoints.map((_, i) => i * 1.2);
  const splits = parSplits.map((t) => t * share);
  const risk =
    FIELD.out.best + (FIELD.out.worst - FIELD.out.best) * (0.6 * weak + 0.4 * (1 - racer.grit));
  let out: RunOut | null = null;
  if (rng.next() < risk) {
    const pick = rng.next();
    const why: RunOut["why"] =
      pick < FIELD.why.missed
        ? "missed"
        : pick < FIELD.why.missed + FIELD.why.straddle
          ? "straddle"
          : "fall";
    const gate = 1 + Math.min(n - 3, Math.floor(rng.next() * (n - 2)));
    out = { status: why === "fall" ? "dnf" : "dsq", why, gate };
    for (let i = gate; i < n; i++) splits[i] = Number.NaN;
  }
  return {
    id: racer.id,
    skis: SLALOM.skis,
    time: out ? null : splits[n - 1],
    out,
    splits,
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
