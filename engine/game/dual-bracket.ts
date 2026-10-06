// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DUAL MOGULS' FORMAT (R43) — what a dual moguls contest IS as a
// competition (`docs/freestyle.md` § *Dual moguls*): a QUALIFICATION of
// single moguls runs, then a knock-out DUAL_LADDER of sixteen in duals, the
// winner of each going through, to a SMALL FINAL (third and fourth) and a
// BIG FINAL. Pure: no state, no clock, nothing drawn off any stream but
// streams of its own off the contest's seed — so a dual the player is not
// in is DEALT the same every time, and the duals he skis decide only his
// own. It is the ski cross's bracket (`cross-bracket.ts`) for a heat of
// two, carried between the runs as `GameState.dualMoguls`.
//
// THE QUALIFICATION is the moguls' own: the player's run scored as a
// moguls run (`moguls-judge.ts`) against the start list's dealt off the
// contest's seed (`moguls-contest.ts`'s `mogulRivalRun`), ranked by score
// then the tie-breaks (`mogulOrder`).
//
// THE DUAL_LADDER: the best sixteen, the TOP EIGHT keeping their seeds' places
// (1 against 16, 8 against 9 … so the best two meet only in the final)
// and 9–16 DRAWN within their group into the places left. The HIGHER
// SEED takes the BLUE lane (est. — the rules let him choose; the game
// chooses for him).
//
// THE FINAL RANKING: the big final first and second, the small final third
// and fourth, then the skiers out in each round — the quarter-finals' after
// the semi-finals' — each group by the votes they took in the dual they
// lost, then their seed; then the skiers who did not make the ladder, by
// their qualification.

import { createRng, type Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { DUAL_MOGULS } from "./defs/dual-moguls.ts";
import { voteDual, type DualRead, type DualVotes } from "./dual-judge.ts";
import {
  MOGUL_FIELD,
  mogulLevelOf,
  mogulOrder,
  mogulRivalRun,
  type MogulRun,
} from "./moguls-contest.ts";

/** The rounds of the ladder, in the order they are skied. */
export type DualRound = "eighth" | "quarter" | "semi" | "small" | "final";
export const DUAL_ROUNDS: readonly DualRound[] = ["eighth", "quarter", "semi", "small", "final"];

/** A skier in the contest: his id on the start list, or `null` the
 * player, and his seed out of the qualification, from 1. */
export type DualEntry = { id: number | null; seed: number };

/** ONE DUAL: its round, its number in the round, and its two skiers by
 * lane — the BLUE first, the higher seed. */
export type DualHeat = { round: DualRound; index: number; lanes: [DualEntry, DualEntry] };

/** A DUAL DECIDED: the dual, the votes, and who went out. */
export type DualResult = { heat: DualHeat; votes: DualVotes; out: [boolean, boolean] };

/** THE CONTEST as far as it has gone: its seed, the course's pace time, s
 * (the qualification's speed score is read against it), the player's
 * qualification run once skied, and every dual decided so far. */
export type DualContest = {
  seed: number;
  pace: number;
  qualifying: MogulRun | null;
  results: DualResult[];
};

/** What the contest's draws are seeded with beside its seed: the start
 * list's runs, the ladder's draw and the duals dealt. */
const FIELD_SALT = 0x2d0a1;
const DRAW_SALT = 0x2d0a7;
const DUAL_SALT = 0x2d0b3;

/** The ladder's places, top to bottom, by the seed each holds before the
 * draw: dual `i` is places `2i` and `2i + 1`. */
export const DUAL_LADDER: readonly number[] = [
  1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15,
];

/** A new contest, before the qualification, on a course of pace time
 * `pace` s. */
export function freshDual(seed: number, pace: number): DualContest {
  return { seed, pace, qualifying: null, results: [] };
}

/** The seed the start list's runs and levels are dealt off. */
export const fieldSeed = (c: DualContest): number => (c.seed ^ FIELD_SALT) >>> 0;

/** THE QUALIFICATION'S BOARD, best first: every skier and his run (the
 * player's null until skied). */
export function qualificationBoard(c: DualContest): { id: number | null; run: MogulRun | null }[] {
  const rows: { id: number | null; run: MogulRun | null }[] = [{ id: null, run: c.qualifying }];
  for (let id = 0; id < DUAL_MOGULS.field; id++) {
    rows.push({ id, run: mogulRivalRun(fieldSeed(c), id, "qualification", c.pace) });
  }
  return rows.sort((a, b) => mogulOrder(a.run, b.run));
}

/** Everyone ranked by the qualification. */
export function ranked(c: DualContest): DualEntry[] {
  return qualificationBoard(c).map((r, i) => ({ id: r.id, seed: i + 1 }));
}

/** Whether the player made the ladder. */
export function qualified(c: DualContest): boolean {
  if (!c.qualifying || c.qualifying.fell) return false;
  const me = ranked(c).find((e) => e.id === null);
  return me !== undefined && me.seed <= DUAL_MOGULS.ladder;
}

/** THE DUAL_LADDER: its sixteen places, top to bottom — the top eight on their
 * seeds' places, 9–16 drawn into the rest. */
export function ladder(c: DualContest): DualEntry[] {
  const top = ranked(c).slice(0, DUAL_MOGULS.ladder);
  const rng = createRng((c.seed ^ DRAW_SALT) >>> 0);
  const drawn = top.slice(DUAL_MOGULS.kept);
  for (let i = drawn.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [drawn[i], drawn[j]] = [drawn[j], drawn[i]];
  }
  let k = 0;
  return DUAL_LADDER.map((s) => (s <= DUAL_MOGULS.kept ? top[s - 1] : drawn[k++]));
}

/** A dual of two: the higher seed in the blue lane. */
const pair = (round: DualRound, index: number, a: DualEntry, b: DualEntry): DualHeat => ({
  round,
  index,
  lanes: a.seed <= b.seed ? [a, b] : [b, a],
});

/** The results of `round`, by dual. */
export function resultsOf(c: DualContest, round: DualRound): DualResult[] {
  return c.results
    .filter((r) => r.heat.round === round)
    .sort((x, y) => x.heat.index - y.heat.index);
}

const winnerOf = (r: DualResult): DualEntry => r.heat.lanes[r.votes.winner];
const loserOf = (r: DualResult): DualEntry => r.heat.lanes[r.votes.winner === 0 ? 1 : 0];

/** THE DUALS OF `round`, as the rounds before it have filled them — null
 * while one they are filled from has not been skied. */
export function dualsOf(c: DualContest, round: DualRound): DualHeat[] | null {
  if (round === "eighth") {
    const l = ladder(c);
    return Array.from({ length: l.length / 2 }, (_, i) => pair(round, i, l[2 * i], l[2 * i + 1]));
  }
  const from = resultsOf(c, round === "quarter" ? "eighth" : round === "semi" ? "quarter" : "semi");
  const want = round === "quarter" ? 8 : round === "semi" ? 4 : 2;
  if (from.length < want) return null;
  const pick = round === "small" ? loserOf : winnerOf;
  return Array.from({ length: want / 2 }, (_, i) =>
    pair(round, i, pick(from[2 * i]), pick(from[2 * i + 1])),
  );
}

/** THE DUAL THE PLAYER SKIS NEXT: the first round not yet skied that has
 * him in it — null before his qualification, once he is out, or the
 * contest is done. */
export function nextDuel(c: DualContest): DualHeat | null {
  if (!qualified(c)) return null;
  for (const round of DUAL_ROUNDS) {
    if (resultsOf(c, round).length > 0) continue;
    const duals = dualsOf(c, round);
    if (!duals) return null;
    const mine = duals.find((h) => h.lanes.some((e) => e.id === null));
    if (mine) return mine;
  }
  return null;
}

/** A skier's run in a dual dealt rather than skied, off the dual's stream:
 * his turns, air and time about his level, and now and then out. */
function dealtRead(c: DualContest, e: DualEntry, rng: Rng): DualRead {
  const F = MOGUL_FIELD;
  const level = e.id === null ? 0.9 : mogulLevelOf(fieldSeed(c), e.id);
  const out = rng.chance(F.outMost - (F.outMost - F.outLeast) * level);
  const turns = Math.min(58, F.turns + F.turnSpan * level + rng.range(-F.wobble, F.wobble));
  const airRaw = Math.min(10, (F.airRaw + F.airSpan * level) / 2 + rng.range(-0.5, 0.5));
  const air = Math.min(20, 2 * airRaw * (F.dd + F.ddSpan * level));
  const at =
    c.pace *
    (out
      ? rng.range(0.2, 0.9)
      : F.slow - (F.slow - F.fast) * level + rng.range(-F.timeWobble, F.timeWobble));
  return { turns, air, codes: [], out, at };
}

/** The stream a dual's draws come off — its eyes and, dealt, its runs. */
export function dualRng(c: DualContest, heat: DualHeat): Rng {
  return createRng(
    (c.seed ^
      DUAL_SALT ^
      Math.imul(DUAL_ROUNDS.indexOf(heat.round) + 1, 0x9e3779b1) ^
      Math.imul(heat.index + 1, 0x85ebca6b)) >>>
      0,
  );
}

/** A DUAL DEALT rather than skied: both runs off the dual's stream, then
 * voted. */
export function dealDual(c: DualContest, heat: DualHeat): DualResult {
  const rng = dualRng(c, heat);
  rng.next();
  const a = dealtRead(c, heat.lanes[0], rng);
  const b = dealtRead(c, heat.lanes[1], rng);
  return { heat, votes: voteDual(a, b, rng), out: [a.out, b.out] };
}

/** THE CONTEST WITH A ROUND SKIED: the player's dual as he skied it
 * (`mine`, when he is in this round) and every other dual of it dealt. */
function skiRound(c: DualContest, round: DualRound, mine: DualResult | null): DualContest {
  const duals = dualsOf(c, round);
  if (!duals) return c;
  const results = duals.map((h) =>
    mine && mine.heat.round === h.round && mine.heat.index === h.index ? mine : dealDual(c, h),
  );
  return { ...c, results: [...c.results, ...results] };
}

/** THE CONTEST ONCE THE PLAYER'S DUAL IS DECIDED (or his qualification
 * skied, `mine` null): his result filed and its round's other duals dealt
 * — and, once he is out of it, every round after dealt to the end, so the
 * final ranking is whole. */
export function advance(c: DualContest, mine: DualResult | null): DualContest {
  let out = c;
  if (mine) out = skiRound(out, mine.heat.round, mine);
  if (nextDuel(out)) return out;
  for (const round of DUAL_ROUNDS) {
    if (resultsOf(out, round).length === 0) out = skiRound(out, round, null);
  }
  return out;
}

/** Whether every dual of the contest has been skied (or the player never
 * made the ladder). */
export function dualDone(c: DualContest): boolean {
  return c.qualifying !== null && (resultsOf(c, "final").length > 0 || !qualified(c));
}

/** THE FINAL RANKING, best first, as far as the contest has gone. */
export function dualStandings(c: DualContest): DualEntry[] {
  const out: DualEntry[] = [];
  const seen = new Set<number | null>();
  const add = (e: DualEntry): void => {
    if (seen.has(e.id)) return;
    seen.add(e.id);
    out.push(e);
  };
  for (const r of [...resultsOf(c, "final"), ...resultsOf(c, "small")]) {
    add(winnerOf(r));
    add(loserOf(r));
  }
  // Each round's losers, by the votes they took, then their seed.
  for (const round of ["quarter", "eighth"] as const) {
    resultsOf(c, round)
      .map((r) => ({ e: loserOf(r), votes: r.votes.votes[r.votes.winner === 0 ? 1 : 0] }))
      .sort((x, y) => y.votes - x.votes || x.e.seed - y.e.seed)
      .forEach((x) => add(x.e));
  }
  for (const e of ranked(c)) add(e);
  return out;
}

/** The player's place in the final ranking, from 1. */
export function dualPlace(c: DualContest): number {
  return dualStandings(c).findIndex((e) => e.id === null) + 1;
}
