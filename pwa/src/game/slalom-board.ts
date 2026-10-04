// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLALOM'S BOARD, as the HUD reads it: the results table of an
// interval start (`GameState.field`, the engine's `field.ts`) and the clock
// at the course's intermediate timing points against the leader's.
//
// THE BOARD is every racer of the run in the engine's own order
// (`fieldOrderOf`: home by combined time, then the racers out of it in start
// order, the player among them), each billed by his START NUMBER (the bib —
// his place in the first run's order, kept for the second, `startNumbers`),
// his time on this run, on the second run the first run's time and the
// total, and the gap to the leader; a racer out of it is billed by how
// (`RunOut`) and has no place. On a second run the racers who start after
// the player have not come down while he is on the course — they come down
// once he is home — so until then they are billed as waiting.
//
// THE TIMING POINTS are the gates nearest a third and two thirds of the
// course's length, as a slalom is timed: two intermediates and the finish.
// The gap there is against the LEADER — the best combined time among the
// racers already down — at the same gate, as television shows it: negative
// is ahead.
//
// DOM-free: `tests/slalom_hud_test.ts` reads it. Nothing in it decides an
// outcome; every figure is the engine's.

import {
  fieldOrderOf,
  startNumbers,
  type Field,
  type FieldRun,
  type GameState,
  type Level,
} from "@engine";

import type { Standing } from "./snapshot.ts";

/** How long the intermediate time stays up after its gate, s of run clock. */
export const TIMING_HOLD = 5;

/** The bibs of each field, worked out once a field. */
const BIBS = new WeakMap<Field, number[]>();
function bibsOf(state: GameState, field: Field): number[] {
  let bibs = BIBS.get(field);
  if (!bibs) {
    bibs = startNumbers(state.seed, state.rules.rivals);
    BIBS.set(field, bibs);
  }
  return bibs;
}

/** The player's start number: last of the first run's order. */
export function playerBib(state: GameState): number {
  return state.rules.rivals + 1;
}

const TIMING = new WeakMap<Level, number[]>();

/** THE INTERMEDIATE TIMING POINTS: the checkpoint indices of the gates
 * nearest a third and two thirds of the way from the start gate to the
 * finish, by length along the piste — never the start or the finish, never
 * the same gate twice. Empty on a map too short to have two. */
export function timingGates(level: Level): number[] {
  const hit = TIMING.get(level);
  if (hit) return hit;
  const cps = level.checkpoints;
  const n = cps.length;
  const out: number[] = [];
  if (n >= 5) {
    const from = cps[0].s;
    const to = cps[n - 1].s;
    for (const share of [1 / 3, 2 / 3]) {
      const want = from + (to - from) * share;
      let best = -1;
      for (let i = 1; i < n - 1; i++) {
        if (out.includes(i)) continue;
        if (best < 0 || Math.abs(cps[i].s - want) < Math.abs(cps[best].s - want)) best = i;
      }
      if (best > 0) out.push(best);
    }
    out.sort((a, b) => a - b);
  }
  TIMING.set(level, out);
  return out;
}

/** The racers already down when the player is on the course: on the first
 * run the whole field (he starts last), on the second those before his slot. */
function downBefore(field: Field): FieldRun[] {
  return field.runs.slice(0, field.slot);
}

/** A racer's combined time, or null when he is out. */
function totalOf(r: FieldRun): number | null {
  return r.time === null ? null : r.before + r.time;
}

/** THE LEADER as the player stands in the start: the racer already down
 * with the best combined time, or null with nobody home. */
export function leaderOf(field: Field): FieldRun | null {
  let best: FieldRun | null = null;
  for (const r of downBefore(field)) {
    const t = totalOf(r);
    if (t !== null && (best === null || t < (totalOf(best) ?? Infinity))) best = r;
  }
  return best;
}

/** THE GAP AT A GATE: the player's combined clock at checkpoint `gate`
 * less the leader's there, s — negative is ahead; null with no leader or
 * either clock not yet a number. */
export function gapAt(state: GameState, gate: number): number | null {
  const f = state.field;
  if (!f) return null;
  const leader = leaderOf(f);
  const mine = state.progress.splits[gate];
  const theirs = leader?.splits[gate];
  if (!leader || theirs === undefined || !Number.isFinite(mine) || !Number.isFinite(theirs)) {
    return null;
  }
  return f.before + mine - (leader.before + theirs);
}

/** THE INTERMEDIATE as the HUD shows it: which timing point (1, 2), the run
 * clock there and the gap to the leader — while it is fresh (`TIMING_HOLD`)
 * and the run is still on; null otherwise. */
export function timingSplit(
  state: GameState,
): { point: number; time: number; gap: number | null } | null {
  const p = state.progress;
  if (!state.field || p.finished) return null;
  const gates = timingGates(state.level);
  for (let k = gates.length - 1; k >= 0; k--) {
    const at = p.splits[gates[k]];
    if (!Number.isFinite(at)) continue;
    return p.time - at < TIMING_HOLD
      ? { point: k + 1, time: at, gap: gapAt(state, gates[k]) }
      : null;
  }
  return null;
}

/** THE BOARD: every racer of the run, in the engine's order (see the
 * header). Empty off an interval start. */
export function boardOf(state: GameState): Standing[] {
  const f = state.field;
  if (!f) return [];
  const p = state.progress;
  const gates = state.level.checkpoints.length;
  const bibs = bibsOf(state, f);
  const second = f.run === 2;
  const over = p.finished;
  const byId = new Map(f.runs.map((r, i) => [r.id, { run: r, order: i }]));
  const mine = p.out || !over ? null : p.time;
  const totals: number[] = [];
  for (const r of f.runs) {
    const t = totalOf(r);
    if (t !== null && (over || byId.get(r.id)!.order < f.slot)) totals.push(t);
  }
  if (mine !== null) totals.push(f.before + mine);
  const lead = totals.length > 0 ? Math.min(...totals) : null;
  const rows = fieldOrderOf(state).map((id): Standing => {
    if (id === null) {
      const total = mine === null ? null : f.before + mine;
      return {
        place: null,
        slot: playerBib(state),
        bib: playerBib(state),
        you: true,
        time: mine,
        taken: 0,
        before: second ? f.before : null,
        total,
        gap: total !== null && lead !== null ? total - lead : null,
        out: p.out,
        waiting: false,
      };
    }
    const { run: r, order } = byId.get(id)!;
    const waiting = !over && order >= f.slot;
    const total = waiting ? null : totalOf(r);
    return {
      place: null,
      slot: bibs[id] ?? id + 1,
      bib: bibs[id] ?? id + 1,
      you: false,
      time: waiting ? null : r.time,
      taken: waiting ? 0 : gates,
      before: second ? r.before : null,
      total,
      gap: total !== null && lead !== null ? total - lead : null,
      out: waiting ? null : r.out,
      waiting,
    };
  });
  // Home first (already in order), then the player still on the course,
  // then the racers out of it, then the racers still to come down.
  const rank = (s: Standing): number =>
    s.total !== null && s.total !== undefined ? 0 : s.out ? 2 : s.waiting ? 3 : 1;
  const sorted = rows.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i);
  let place = 0;
  return sorted.map(({ s }) => (rank(s) === 0 ? { ...s, place: ++place } : s));
}
