// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIELD OF AN INTERVAL START — a slalom's start list (R31), or a
// downhill's (R32). Only one racer is ever on the course, so the field is
// never skied: by the
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
//
// A DOWNHILL is one run, its field closer together than a slalom's — the
// thirtieth some 1.5–2.5 s off the winner over two minutes, the last 6–10 s
// — and rarely out of it (none to a tenth of a field), almost always by a
// fall (`DOWNHILL_FIELD`); every racer's speed through the trap is dealt
// about par's there. Its TRAINING run is the same course and the same
// order, slower and further apart — a racer in training learns the line and
// stands up before the finish — and counts for nothing.
//
// A SUPER-G is one run with no training: further apart than a downhill —
// the thirtieth some 2.5–5 s off the winner over a minute and a half — and
// far more often out of it, a sixth to a quarter of a field on most days,
// as often by a gate missed as by a fall (`SUPER_G_FIELD`); its trap as
// the downhill's.
//
// SPEED SKIING (R34) is timed through its zone, and its board is the time
// there as a SPEED: tight at the top — the first four within some 1.3 km/h
// of 180, the tenth 2 % off the winner, the twentieth 6 % and the last 15
// % — and hardly ever out of it, a fall the only way (four in 450 runs at
// one event); its start list run 1 in the ranking's order, the best
// fifteen drawn among themselves (`SPEED_SKI_FIELD`). Its FINAL is the
// qualification's best `SPEED_SKI.qualify`, in increasing order of their
// speed — the fastest last — and ranked on the FINAL alone, never combined.
//
// A SKI CROSS's QUALIFICATION (R35) is one timed run alone out of the start
// gate, its field close — the thirtieth some 4–5 % off the best — and
// seldom out of it (`SKI_CROSS_FIELD`); its racers go on to the heats
// (`cross-bracket.ts`) with the skill and the grit dealt here.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { speedCourseOf } from "../mapgen/index.ts";
import { DOWNHILL, SKI_CROSS, SLALOM, SPEED_SKI, SUPER_G } from "./defs/modes.ts";
import { raceParOf } from "./par.ts";
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

/** A DOWNHILL'S FIELD (R32), over `FIELD`'s shape: a speed event's tight
 * spread and its rare outs — a fall nearly always, a gate missed now and
 * then, no straddle on a gate eight metres wide — and how far a racer's
 * trap speed strays. */
export const DOWNHILL_FIELD = {
  spread: 0.025,
  noise: 0.004,
  best: -0.004,
  out: { best: 0.01, worst: 0.1 },
  why: { missed: 0.15, straddle: 0, fall: 0.85 },
  /** The trap: the weakest racer's speed under par's there, as a share,
   * and how much it strays either way. */
  trap: { spread: 0.06, noise: 0.015 },
  /** TRAINING: every run this much slower again as a share of par, and
   * this much more scattered — a racer learning the line, standing up
   * early — and its outs a fall only. */
  training: { slower: 0.025, noise: 0.012 },
} as const;

/** A SUPER-G'S FIELD (R33), over `FIELD`'s shape: one run unseen, so a
 * wider spread than the downhill's (top-level sheets: tenth 0.5–1.7 s and
 * thirtieth 2.5–5 s off a winner's 80–95 s) and the most outs of any
 * speed event (a tenth to a third of the starters, 10–30 % the common
 * case) — half of them a gate missed on a line skied blind, half a fall;
 * no straddle on a gate seven metres wide. Its trap as the downhill's. */
export const SUPER_G_FIELD = {
  spread: 0.045,
  noise: 0.008,
  best: -0.006,
  out: { best: 0.05, worst: 0.33 },
  why: { missed: 0.5, straddle: 0, fall: 0.5 },
  trap: DOWNHILL_FIELD.trap,
} as const;

/** SPEED SKIING'S FIELD (R34), over `FIELD`'s shape: a share of par's
 * time through the zone — a speed's share the other way up. Its best
 * racers come through a hair under a clean run held in a full tuck from
 * the top (`best`), so a perfect run wins and anything less is places
 * behind; it is out only by a fall; the best `seeds` of the list are drawn
 * among themselves at the head of the first run. */
export const SPEED_SKI_FIELD = {
  spread: 0.09,
  noise: 0.004,
  best: 0.003,
  out: { best: 0.005, worst: 0.03 },
  why: { missed: 0, straddle: 0, fall: 1 },
  seeds: 15,
} as const;

/** A SKI CROSS'S QUALIFICATION (R35), over `FIELD`'s shape: one timed run
 * alone, a field some 4–5 % deep over a minute (est.), out of it now and
 * then — a fall far oftener than a gate missed. */
export const SKI_CROSS_FIELD = {
  spread: 0.045,
  noise: 0.006,
  best: -0.004,
  out: { best: 0.02, worst: 0.1 },
  why: { missed: 0.3, straddle: 0, fall: 0.7 },
} as const;

/** THE FIRST RUN, carried into the second: the player's time and the
 * field as it finished. */
export type Heat = { run: 2; player: number; field: readonly FieldRun[] };

/** One racer of the start list: his slot (a rival's id), his skill and his
 * grit. */
export type Racer = { id: number; skill: number; grit: number };

/** THE START LIST: `count` racers, each dealt off the field's stream — the
 * same list on both runs of a race, and through a ski cross's heats. */
export function startList(seed: number, count: number): Racer[] {
  const rng = createRng((seed ^ FIELD_SALT) >>> 0);
  const out: Racer[] = [];
  for (let id = 0; id < count; id++) out.push({ id, skill: rng.next(), grit: rng.next() });
  return out;
}

/** THE FIRST RUN'S START ORDER of a field of `count` off `seed`: the best
 * `seeds` drawn among themselves, then the rest by skill. */
function firstRun(seed: number, count: number, seeded: number = FIELD.seeds): Racer[] {
  const order = createRng((seed ^ FIELD_SALT ^ 0x51) >>> 0);
  const ranked = startList(seed, count).sort((a, b) => b.skill - a.skill || a.id - b.id);
  const seeds = ranked.slice(0, seeded);
  for (let i = seeds.length - 1; i > 0; i--) {
    const j = order.int(0, i);
    [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
  }
  return [...seeds, ...ranked.slice(seeded)];
}

/** EVERY RACER'S START NUMBER — his place in the first run's order, from 1,
 * kept for the second — by his id; the player's is `count + 1`, the last
 * of the first run. A speed race's first run draws its best fifteen. */
export function startNumbers(seed: number, count: number, speedSki = false): number[] {
  const bibs: number[] = [];
  const seeded = speedSki ? SPEED_SKI_FIELD.seeds : FIELD.seeds;
  firstRun(seed, count, seeded).forEach((r, i) => (bibs[r.id] = i + 1));
  return bibs;
}

/** WHETHER A RACE IS RANKED ON THE RUNS COMBINED — a slalom's two — or on
 * the run alone: a speed race's final. */
function combined(state: GameState): boolean {
  return state.level.speedSki === undefined;
}

/** DEAL THE FIELD: the start list, the order it goes in, and every run of
 * it about the course's par — the field put on the state. Called once,
 * from `createGame`, before the player's run has taken a step. */
export function createField(state: GameState, count: number, heat?: Heat, training = false): void {
  const run = heat ? 2 : 1;
  const speedSki = state.level.speedSki !== undefined;
  const list = startList(state.seed, count);
  let starters: Racer[];
  let slot: number;
  if (!heat) {
    starters = firstRun(state.seed, count, speedSki ? SPEED_SKI_FIELD.seeds : FIELD.seeds);
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
    // A slalom's second run: the best thirty in reverse, the rest after
    // them; a speed race's final: its best alone, the slowest first.
    const go = speedSki
      ? home.slice(0, SPEED_SKI.qualify).reverse()
      : [...home.slice(0, SLALOM.qualify).reverse(), ...home.slice(SLALOM.qualify)];
    slot = go.findIndex((r) => r.racer === null);
    starters = go.flatMap((r) => (r.racer ? [r.racer] : []));
  }
  const before = new Map((heat?.field ?? []).map((r) => [r.id, r.time ?? 0]));
  state.field = {
    run,
    runs: starters.map((r) => dealRun(state, r, run, before.get(r.id) ?? 0, training)),
    before: heat?.player ?? 0,
    slot,
    training,
  };
}

/** One racer's run about par: home in his time with the clock at every
 * gate, or out at a gate. */
function dealRun(
  state: GameState,
  racer: Racer,
  run: 1 | 2,
  before: number,
  training: boolean,
): FieldRun {
  const rng = createRng(
    (state.seed ^
      FIELD_SALT ^
      Math.imul(run, 0x9e3779b1) ^
      Math.imul(racer.id + 1, 0x85ebca6b) ^
      (training ? 0x7a1e : 0)) >>>
      0,
  );
  const level = state.level;
  const downhill = level.downhill !== undefined;
  const speed = speedCourseOf(level);
  const F = downhill
    ? DOWNHILL_FIELD
    : level.superG
      ? SUPER_G_FIELD
      : level.speedSki
        ? SPEED_SKI_FIELD
        : level.skiCross
          ? SKI_CROSS_FIELD
          : FIELD;
  const par = raceParOf(level);
  const n = level.checkpoints.length;
  const weak = 1 - racer.skill;
  const learn = training ? DOWNHILL_FIELD.training : { slower: 0, noise: 0 };
  const share =
    1 +
    F.best +
    learn.slower +
    (F.spread - F.best) * weak +
    (F.noise + learn.noise) * (rng.next() + rng.next() - 1);
  const parSplits = par?.splits ?? level.checkpoints.map((_, i) => i * 1.2);
  const splits = parSplits.map((t) => t * share);
  const risk = F.out.best + (F.out.worst - F.out.best) * (0.6 * weak + 0.4 * (1 - racer.grit));
  let out: RunOut | null = null;
  if (rng.next() < risk) {
    const pick = rng.next();
    const why: RunOut["why"] =
      training || pick >= F.why.missed + F.why.straddle
        ? "fall"
        : pick < F.why.missed
          ? "missed"
          : "straddle";
    const gate = 1 + Math.min(n - 3, Math.floor(rng.next() * (n - 2)));
    out = { status: why === "fall" ? "dnf" : "dsq", why, gate };
    for (let i = gate; i < n; i++) splits[i] = Number.NaN;
  }
  // THE TRAP, about par's speed there — a stronger racer a little faster.
  const D = DOWNHILL_FIELD.trap;
  const trapGate = speed ? level.checkpoints.findIndex((c) => c.s >= speed.trap.s) : -1;
  // ...and on a speed track the trap IS the zone: its length over his time.
  const zone = level.speedSki?.zone;
  const trap = zone
    ? out
      ? null
      : zone.length / splits[n - 1]
    : par && par.trap > 0 && !(out && trapGate >= out.gate)
      ? par.trap * (1 - D.spread * weak + D.noise * (rng.next() + rng.next() - 1))
      : null;
  return {
    id: racer.id,
    skis: downhill
      ? DOWNHILL.skis
      : level.superG
        ? SUPER_G.skis
        : level.speedSki
          ? SPEED_SKI.skis
          : level.skiCross
            ? SKI_CROSS.skis
            : SLALOM.skis,
    time: out ? null : splits[n - 1],
    out,
    splits,
    before,
    trap,
  };
}

/** A racer's standing: the combined time — on a speed race's final the
 * run's alone — or none when he is out. */
export function fieldTimeOf(state: GameState, r: FieldRun): number | null {
  return r.time === null ? null : (combined(state) ? r.before : 0) + r.time;
}

/** THE PLAYER'S PLACE against the field: one more than the racers whose
 * combined time beats his — his clock so far while he is still on the
 * course. */
export function fieldPlace(state: GameState): number {
  const f = state.field;
  if (!f) return 1;
  const mine = (combined(state) ? f.before : 0) + state.progress.time;
  let ahead = 0;
  for (const r of f.runs) {
    const total = fieldTimeOf(state, r);
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
    total: fieldTimeOf(state, r),
    order: i,
  }));
  const before = combined(state) ? f.before : 0;
  rows.push({ id: null, total: p.out ? null : before + p.time, order: f.runs.length });
  rows.sort((a, b) => {
    if (a.total === null || b.total === null) {
      return a.total === null && b.total === null ? a.order - b.order : a.total === null ? 1 : -1;
    }
    return a.total - b.total || a.order - b.order;
  });
  return rows.map((r) => r.id);
}
