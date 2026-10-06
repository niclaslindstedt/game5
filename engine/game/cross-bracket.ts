// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI CROSS'S FORMAT (R35) — what a ski cross IS as a competition: a
// timed QUALIFICATION, then a knock-out BRACKET of heats of four, the first
// two of each going through, to a SMALL FINAL (fifth to eighth) and a BIG
// FINAL (the podium). Pure: no state, no clock, nothing drawn off any
// stream but streams of its own off the race's seed — so a heat the player
// is not in is DEALT the same every time, and the heats he skis decide only
// his own.
//
// THE QUALIFICATION ranks the start list by time: every racer home by his
// time (a tie to the one who started later — the player, who starts last),
// then the racers who went out, by how far down the course they got. The
// best `SKI_CROSS.qualify` (sixteen) are seeded into the QUARTER-FINALS the
// standard way — 1, 8, 9, 16 in one heat, 4, 5, 12, 13 in the next, so the
// best two seeds can meet only in the final — and the rest are ranked by
// their qualification.
//
// A HEAT is ranked by the order over the line; a racer who did not finish
// by how far down the course his correct passage went (`CrossPlace.gates`),
// still going through if that is in the first two; a racer disqualified
// last; every tie to the better qualifier. The quarter-finals' and the
// semi-finals' first two go on; the semi-finals' third and fourth race the
// small final. THE FINAL RANKING: the big final first to fourth, the small
// final fifth to eighth, the quarter-finals' thirds ninth to twelfth and
// their fourths thirteenth to sixteenth, each group by qualification, and
// the racers who did not qualify after them by theirs.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { SKI_CROSS } from "./defs/modes.ts";
import { startList } from "./field.ts";
import type { FieldRun, RunOut } from "./state.ts";

/** The rounds of the bracket, in the order they are raced. */
export type CrossRound = "quarter" | "semi" | "small" | "final";
export const CROSS_ROUNDS: readonly CrossRound[] = ["quarter", "semi", "small", "final"];

/** A racer in the bracket: his id on the qualification's start list, or
 * `null` the player, and his rank out of the qualification, from 1. */
export type CrossEntry = { id: number | null; rank: number };

/** ONE HEAT: its round, its number in the round, and its racers in SEED
 * ORDER — the best qualifier first, who chooses his lane first. */
export type CrossHeat = { round: CrossRound; index: number; racers: CrossEntry[] };

/** A racer as a heat finished: his time over the line (null where he did
 * not cross it), how he went out if he did, and the gates he took. */
export type CrossPlace = {
  entry: CrossEntry;
  time: number | null;
  out: RunOut | null;
  gates: number;
};

/** A HEAT RACED: the heat, and its racers in finishing order. */
export type CrossResult = { heat: CrossHeat; order: CrossPlace[] };

/** THE COMPETITION as far as it has gone: every racer of the start list
 * and the player in qualification order, and every heat raced so far. */
export type Bracket = {
  seed: number;
  ranked: CrossEntry[];
  /** The player's qualification: his time, or how he went out. */
  qualifying: { time: number | null; out: RunOut | null };
  results: CrossResult[];
};

/** The quarter-finals' seeds, heat by heat: the best two seeds in opposite
 * halves of the bracket, the first and the eighth's half meeting the
 * fourth and fifth's in a semi-final. */
export const QUARTERS: readonly (readonly number[])[] = [
  [1, 8, 9, 16],
  [4, 5, 12, 13],
  [3, 6, 11, 14],
  [2, 7, 10, 15],
];

/** What a dealt heat is drawn off beside the race's seed. */
const HEAT_SALT = 0x5c4ea7;

/** A DEALT HEAT'S NUMBERS: each racer's run over the course a share of the
 * best one's — `spread` from the strongest to the weakest of the start
 * list, and `noise` either way on the day, which in a pack of four is
 * most of it — and how often a racer goes out of a heat: falls and the
 * like (`out`, the best's and the weakest's), a red card now and then
 * (`card`). */
export const CROSS_DEAL = {
  spread: 0.035,
  noise: 0.03,
  out: { best: 0.06, worst: 0.14 },
  card: 0.015,
} as const;

/** THE QUALIFICATION RANKED: the player's run — his time, or how he went
 * out and where — against the field's board. */
export function qualify(
  seed: number,
  player: { time: number | null; out: RunOut | null; gates: number },
  field: readonly FieldRun[],
): Bracket {
  type Row = { id: number | null; time: number | null; gates: number; order: number };
  const rows: Row[] = field.map((r, i) => ({
    id: r.id,
    time: r.time,
    gates: r.out ? r.out.gate : Infinity,
    order: i,
  }));
  rows.push({
    id: null,
    time: player.out ? null : player.time,
    gates: player.out ? player.gates : Infinity,
    order: field.length,
  });
  rows.sort((a, b) => {
    if (a.time !== null && b.time !== null) return a.time - b.time || b.order - a.order;
    if (a.time !== null) return -1;
    if (b.time !== null) return 1;
    return b.gates - a.gates || b.order - a.order;
  });
  return {
    seed,
    ranked: rows.map((r, i) => ({ id: r.id, rank: i + 1 })),
    qualifying: { time: player.out ? null : player.time, out: player.out },
    results: [],
  };
}

/** Whether the player made the bracket. */
export function qualified(b: Bracket): boolean {
  const me = b.ranked.find((r) => r.id === null);
  return me !== undefined && me.rank <= SKI_CROSS.qualify;
}

/** The results of `round`, by heat — none until it has been raced. */
function resultsOf(b: Bracket, round: CrossRound): CrossResult[] {
  return b.results
    .filter((r) => r.heat.round === round)
    .sort((x, y) => x.heat.index - y.heat.index);
}

const bySeed = (a: CrossEntry, b: CrossEntry): number => a.rank - b.rank;

/** THE HEATS OF `round`, as the rounds before it have filled them — null
 * while one they are filled from has not been raced. */
export function heatsOf(b: Bracket, round: CrossRound): CrossHeat[] | null {
  if (round === "quarter") {
    return QUARTERS.map((seeds, index) => ({
      round,
      index,
      racers: seeds.map((r) => b.ranked[r - 1]).filter((e) => e !== undefined),
    }));
  }
  const from = round === "semi" ? resultsOf(b, "quarter") : resultsOf(b, "semi");
  const want = round === "semi" ? 4 : 2;
  if (from.length < want) return null;
  const T = SKI_CROSS.through;
  const pick = (r: CrossResult): CrossEntry[] =>
    (round === "small" ? r.order.slice(T, 2 * T) : r.order.slice(0, T)).map((p) => p.entry);
  if (round === "semi") {
    return [0, 1].map((index) => ({
      round,
      index,
      racers: [...pick(from[2 * index]), ...pick(from[2 * index + 1])].sort(bySeed),
    }));
  }
  return [{ round, index: 0, racers: [...pick(from[0]), ...pick(from[1])].sort(bySeed) }];
}

/** THE HEAT THE PLAYER RACES NEXT: the first round not yet raced that has
 * him in it — null once he is out, or the bracket is done. */
export function nextHeat(b: Bracket): CrossHeat | null {
  if (!qualified(b)) return null;
  for (const round of CROSS_ROUNDS) {
    if (resultsOf(b, round).length > 0) continue;
    const heats = heatsOf(b, round);
    if (!heats) return null;
    const mine = heats.find((h) => h.racers.some((e) => e.id === null));
    if (mine) return mine;
  }
  return null;
}

/** A HEAT DEALT rather than skied: each racer's run a share of a good one's
 * by his skill and the day, and now and then one of them out of it — off
 * a stream of the heat's own, so the same heat is dealt the same every
 * time. */
export function dealHeat(seed: number, heat: CrossHeat): CrossResult {
  const rng = createRng(
    (seed ^
      HEAT_SALT ^
      Math.imul(CROSS_ROUNDS.indexOf(heat.round) + 1, 0x9e3779b1) ^
      Math.imul(heat.index + 1, 0x85ebca6b)) >>>
      0,
  );
  const skills = startList(seed, SKI_CROSS.field);
  const D = CROSS_DEAL;
  const places: (CrossPlace & { score: number })[] = heat.racers.map((entry) => {
    const racer = entry.id === null ? null : skills[entry.id];
    const skill = racer?.skill ?? 1;
    const grit = racer?.grit ?? 1;
    const weak = 1 - skill;
    const score = 1 + D.spread * weak + D.noise * (rng.next() + rng.next() - 1);
    const risk = D.out.best + (D.out.worst - D.out.best) * (0.5 * weak + 0.5 * (1 - grit));
    const fall = rng.next() < risk;
    const card = !fall && rng.next() < D.card;
    const gates = fall ? rng.int(1, 8) : Infinity;
    const out: RunOut | null = fall
      ? { status: "dnf", why: "fall", gate: gates }
      : card
        ? { status: "dsq", why: "contact", gate: 0 }
        : null;
    return { entry, time: out ? null : score, out, gates: out ? gates : Infinity, score };
  });
  return { heat, order: placeOrder(places) };
}

/** A heat's racers in their finishing order: home by time, then the out by
 * the gates they took, the disqualified last — every tie to the better
 * qualifier. */
export function placeOrder<T extends CrossPlace>(places: readonly T[]): T[] {
  const tier = (p: CrossPlace): number =>
    p.out === null && p.time !== null ? 0 : p.out?.status === "dsq" ? 2 : 1;
  return [...places].sort((a, b) => {
    const ta = tier(a);
    const tb = tier(b);
    if (ta !== tb) return ta - tb;
    if (ta === 0) return (a.time ?? 0) - (b.time ?? 0) || a.entry.rank - b.entry.rank;
    if (ta === 1) return b.gates - a.gates || a.entry.rank - b.entry.rank;
    return a.entry.rank - b.entry.rank;
  });
}

/** THE BRACKET WITH THE NEXT ROUND RACED: the player's heat as he raced it
 * (`mine`, when he is in this round) and every other heat of it dealt. */
function raceRound(b: Bracket, round: CrossRound, mine: CrossResult | null): Bracket {
  const heats = heatsOf(b, round);
  if (!heats) return b;
  const results = heats.map((h) =>
    mine && mine.heat.round === h.round && mine.heat.index === h.index ? mine : dealHeat(b.seed, h),
  );
  return { ...b, results: [...b.results, ...results] };
}

/** THE BRACKET ONCE THE PLAYER'S HEAT IS RACED: his result filed and the
 * round's other heats dealt — and, once he is out of it, every round after
 * dealt to the end, so the final ranking is whole. */
export function advance(b: Bracket, mine: CrossResult | null): Bracket {
  let out = b;
  if (mine) out = raceRound(out, mine.heat.round, mine);
  if (nextHeat(out)) return out;
  for (const round of CROSS_ROUNDS) {
    if (resultsOf(out, round).length === 0) out = raceRound(out, round, null);
  }
  return out;
}

/** Whether every heat of the bracket has been raced. */
export function bracketDone(b: Bracket): boolean {
  return resultsOf(b, "final").length > 0 || !qualified(b);
}

/** THE FINAL RANKING, best first, as far as the bracket has gone: the
 * finals' places, then the rounds' eliminated by the place they went out
 * in and their qualification, then the racers who did not qualify. */
export function standings(b: Bracket): CrossEntry[] {
  const T = SKI_CROSS.through;
  const out: CrossEntry[] = [];
  const seen = new Set<number | null>();
  const add = (e: CrossEntry): void => {
    if (seen.has(e.id)) return;
    seen.add(e.id);
    out.push(e);
  };
  for (const r of resultsOf(b, "final")) r.order.forEach((p) => add(p.entry));
  for (const r of resultsOf(b, "small")) r.order.forEach((p) => add(p.entry));
  // The quarter-finals' thirds, then their fourths, each by qualification.
  const quarters = resultsOf(b, "quarter");
  for (let place = T; place < SKI_CROSS.heat; place++) {
    quarters
      .map((r) => r.order[place]?.entry)
      .filter((e): e is CrossEntry => e !== undefined)
      .sort(bySeed)
      .forEach(add);
  }
  for (const e of b.ranked) add(e);
  return out;
}

/** The player's place in the final ranking, from 1. */
export function finalPlace(b: Bracket): number {
  return standings(b).findIndex((e) => e.id === null) + 1;
}
