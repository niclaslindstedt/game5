// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A BIG AIR CONTEST (R37), pure: the format the freestyle rules give it,
// carried between the runs of one contest as `GameState.bigAir`
// (`CreateGameOptions.bigAir`) the way a ski cross carries its bracket.
//
// THE FORMAT. A QUALIFICATION of `BIG_AIR.qualification` jumps, each
// skier's best one counting; the best `BIG_AIR.finalists` go to the FINAL
// of `BIG_AIR.final` jumps, ranked on the sum of the best `BIG_AIR.counting`
// — and those two DIFFERENT TRICKS (`trickKind`: spun the other way, or
// flipped where the other spun), so a skier cannot win on the same trick
// twice. Each jump is one run: the drop-in from the start gate, the flight
// off the kicker, the landing and the run-out to the finish line. The jump
// a run is judged on is its longest flight (`jumpOf`); a skier who went out
// is scored as a fall, and one who never left the snow scores nothing.
//
// THE FIELD is dealt, never skied, as a slalom's board is (`field.ts`): each
// rival's every jump a pure function of the contest's seed, his number, the
// phase and the jump — his level, whether he falls, the score the panel
// gives a jump he lands, the way he spins — off a stream of its own, so
// nothing here draws from `state.rng` and no digest can see it.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { BIG_AIR } from "./defs/modes.ts";
import { impressionOf, panelScore, readTrick, trickKind } from "./judge.ts";
import type { FlightRecord, GameState } from "./state.ts";

/** A contest's two phases. */
export type BigAirPhase = "qualification" | "final";

/** ONE JUMP JUDGED: the panel's score (0 for a skier who never jumped), its
 * kind (`trickKind`, null for no jump) and whether it was a fall. */
export type BigAirJump = { score: number; kind: string | null; fell: boolean };

/** THE CONTEST SO FAR — the player's jumps in each phase, the final null
 * until he is through to it. The field's are dealt off `seed` on demand. */
export type BigAirContest = {
  seed: number;
  qualification: BigAirJump[];
  final: BigAirJump[] | null;
};

/** A row of a phase's board: the player (`id` −1) or a rival, his jumps so
 * far and his total. */
export type BigAirRow = { id: number; jumps: BigAirJump[]; total: number };

/** The salt a contest's field is dealt off. */
const FIELD_SALT = 0x2b16a1;

/** THE DEALT FIELD's knobs: the spread of the field's level, how often a
 * jump ends in a fall, and the scores a landed one draws. */
export const BIG_AIR_FIELD = {
  /** A rival's level, 0 … 1: the field's weakest to its best. */
  fallMost: 0.32,
  fallLeast: 0.12,
  /** A landed jump: `floor` + `span` × level, give or take `wobble`. */
  floor: 52,
  span: 38,
  wobble: 7,
} as const;

/** A new contest, before the first jump. */
export function freshBigAir(seed: number): BigAirContest {
  return { seed, qualification: [], final: null };
}

/** The phase the contest's NEXT jump is in, or null when the player's
 * contest is over. */
export function nextPhase(c: BigAirContest): BigAirPhase | null {
  if (c.final) return c.final.length < BIG_AIR.final ? "final" : null;
  return c.qualification.length < BIG_AIR.qualification ? "qualification" : null;
}

/** How many jumps a phase has. */
export function jumpsIn(phase: BigAirPhase): number {
  return phase === "final" ? BIG_AIR.final : BIG_AIR.qualification;
}

/** A rival's level, 0 … 1, off the contest's seed. */
function levelOf(seed: number, id: number): number {
  return createRng((seed ^ FIELD_SALT) + id * 7919).next();
}

/** RIVAL `id`'s jump `jump` of a phase, dealt. */
export function rivalJump(seed: number, id: number, phase: BigAirPhase, jump: number): BigAirJump {
  const F = BIG_AIR_FIELD;
  const level = levelOf(seed, id);
  const rng = createRng(
    (seed ^ FIELD_SALT) + id * 7919 + (phase === "final" ? 104729 : 0) + jump * 31 + 1,
  );
  const fell = rng.chance(F.fallMost - (F.fallMost - F.fallLeast) * level);
  const kind = rng.chance(0.5) ? "left" : "right";
  const impression = fell
    ? rng.range(6, 15)
    : F.floor + F.span * level + rng.range(-F.wobble, F.wobble);
  const score = panelScore(
    Math.min(99, impression),
    seed,
    1000 + id * 8 + jump + (phase === "final" ? 4 : 0),
  );
  return { score, kind, fell };
}

/** A phase's TOTAL off its jumps: the qualification's best one; the
 * final's best `counting`, of different kinds. */
export function totalOf(phase: BigAirPhase, jumps: readonly BigAirJump[]): number {
  if (phase === "qualification") return jumps.reduce((m, j) => Math.max(m, j.score), 0);
  const sorted = jumps.slice().sort((a, b) => b.score - a.score);
  let best = 0;
  for (let i = 0; i < sorted.length; i++) {
    for (let k = i + 1; k < sorted.length; k++) {
      if (sorted[i].kind !== null && sorted[i].kind === sorted[k].kind) continue;
      best = Math.max(best, sorted[i].score + sorted[k].score);
    }
  }
  // Fewer than two different tricks: the best one alone counts.
  return Math.max(best, sorted[0]?.score ?? 0);
}

/** The rivals in a phase: the whole field in the qualification, the
 * finalists in the final (bar the player's place). */
function rivalsIn(c: BigAirContest, phase: BigAirPhase): number[] {
  const all = Array.from({ length: BIG_AIR.field }, (_, i) => i);
  if (phase === "qualification") return all;
  const board = boardOf(c, "qualification", BIG_AIR.qualification);
  return board
    .slice(0, BIG_AIR.finalists)
    .map((r) => r.id)
    .filter((id) => id >= 0);
}

/** A PHASE'S BOARD after `shown` jumps of the field's (every rival's first
 * `shown`, the player's as many as he has taken), best first. A tie keeps
 * the order the skiers were listed in, the player first. */
export function boardOf(c: BigAirContest, phase: BigAirPhase, shown: number): BigAirRow[] {
  const mine = phase === "final" ? c.final : c.qualification;
  const rows: BigAirRow[] = [];
  if (mine) rows.push({ id: -1, jumps: mine, total: totalOf(phase, mine) });
  for (const id of rivalsIn(c, phase).slice(0, phase === "final" ? BIG_AIR.finalists : undefined)) {
    const jumps: BigAirJump[] = [];
    for (let j = 0; j < Math.min(shown, jumpsIn(phase)); j++)
      jumps.push(rivalJump(c.seed, id, phase, j));
    rows.push({ id, jumps, total: totalOf(phase, jumps) });
  }
  return rows.sort((a, b) => b.total - a.total);
}

/** The player's place on a phase's board, 1-based, after the field's jumps
 * as far as his. */
export function placeOf(c: BigAirContest, phase: BigAirPhase): number {
  const mine = phase === "final" ? c.final : c.qualification;
  const board = boardOf(c, phase, mine?.length ?? 0);
  return board.findIndex((r) => r.id === -1) + 1;
}

/** THE JUMP A RUN IS JUDGED ON: its longest flight, or null for none. */
export function jumpOf(flights: readonly FlightRecord[]): FlightRecord | null {
  let best: FlightRecord | null = null;
  for (const f of flights) if (!best || f.air > best.air) best = f;
  return best;
}

/** THE RUN ON THE SNOW JUDGED: its jump read and scored by the panel, or
 * nothing for a run that never left the snow. Null while the run is on. */
export function judgeRun(state: GameState): BigAirJump | null {
  const c = state.bigAir;
  const course = state.level.bigAir;
  if (!c || !course) return null;
  if (!state.progress.finished && !state.progress.out) return null;
  const f = jumpOf(state.tricks.flights);
  if (!f) return { score: 0, kind: null, fell: state.progress.out !== null };
  const table = course.knuckle - course.lip;
  const out = state.progress.out !== null;
  const phase = nextPhase(c) ?? "final";
  const n =
    (phase === "final" ? 4 : 0) +
    (phase === "final" ? (c.final?.length ?? 0) : c.qualification.length);
  const score = panelScore(impressionOf(f, table, out), c.seed, n);
  return { score, kind: trickKind(readTrick(f)), fell: out || f.outcome === "fell" };
}

/** THE CONTEST AFTER THE RUN ON THE SNOW: its jump filed in its phase, and
 * — the qualification done — the final opened if the player is in the
 * best `finalists`. Null while the run is on, or on a run with no
 * contest. */
export function contestAfter(state: GameState): BigAirContest | null {
  const c = state.bigAir;
  const jump = judgeRun(state);
  if (!c || !jump) return null;
  if (c.final) return { ...c, final: [...c.final, jump] };
  const next: BigAirContest = { ...c, qualification: [...c.qualification, jump] };
  if (next.qualification.length >= BIG_AIR.qualification) {
    const place = placeOf(next, "qualification");
    if (place <= BIG_AIR.finalists) next.final = [];
  }
  return next;
}
