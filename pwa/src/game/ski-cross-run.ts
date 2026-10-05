// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI CROSS FROM THE APP'S SIDE (R35): the qualification, then the heats,
// one run at a time — what the HUD reads of a heat (its round, the start
// gate's commands, who goes through), what the finish plate offers next, and
// the BRACKET the next run is stood up with (`CreateGameOptions.bracket`).
//
// THE BRACKET RIDES THE RUN: each run on the snow carries the bracket as it
// stood before it (`GameState.bracket`), so a restart and a replay stand the
// same heat up again, and the bracket after it is that one with this run's
// result filed (`bracketAfter`) — the qualification ranked against its
// board, or this heat raced and the round's other heats dealt
// (`cross-bracket.ts`). Nothing here deals or ranks: the engine does both.
//
// DOM-free and storage-free: `tests/ski_cross_hud_test.ts` reads it.

import {
  SKI_CROSS,
  advance,
  bracketDone,
  crossStandings,
  finalPlace,
  heatResult,
  nextHeat,
  qualified,
  qualify,
  type Bracket,
  type CrossResult,
  type CrossRound,
  type GameState,
} from "@engine";

/** WHAT THE PLATE OFFERS after a ski-cross run: the next HEAT (`heat`, its
 * round), or the race over for him — out of it at `place` in the final
 * ranking (`out`), or the big final raced (`done`). */
export type CrossNext =
  | { kind: "heat"; round: CrossRound }
  | { kind: "out"; place: number }
  | { kind: "done"; place: number };

/** A SKI-CROSS RUN AS THE HUD READS IT. */
export type CrossHud = {
  /** The qualification, or a heat's round and its number in it (from 1). */
  round: "qualify" | CrossRound;
  heat: number;
  /** THE START GATE'S COMMANDS on a heat: "skiers ready", "attention" —
   * then nothing: the doors drop without a word — and GO's moment shown a
   * beat after it; null otherwise. */
  word: "ready" | "attention" | "go" | null;
  /** The heat as it stands, best first: each racer's start-list id (null
   * the player) and qualification rank, his time home or how he went out;
   * the first `through` go on. Empty on the qualification. */
  order: { id: number | null; rank: number; time: number | null; out: boolean }[];
  through: number;
  /** What the plate offers once he is home or out — null before. */
  next: CrossNext | null;
  /** THE PODIUM once the race is over for him — the big final's four, the
   * rest of the bracket dealt to its end, each by his start-list id (null
   * the player) and his qualification rank — null before. */
  podium: { id: number | null; rank: number }[] | null;
  /** THE ROUND'S OTHER HEATS once his is over — the bracket between the
   * heats: each one's number and the first two through, by start-list id
   * and qualification rank — empty before. */
  others: { heat: number; through: { id: number | null; rank: number }[] }[];
};

/** How long GO stays up after the doors drop, s. */
const GO_HOLD = 1;

/** THE BRACKET AFTER THIS RUN: the qualification ranked, or this heat
 * filed with the rest of its round dealt — null before the run is over and
 * on any run that is not a ski cross. */
export function bracketAfter(state: GameState): Bracket | null {
  if (!state.level.skiCross || !state.progress.finished) return null;
  const heat = heatResult(state);
  if (heat && state.bracket) return advance(state.bracket, heat);
  if (!state.field) return null;
  const p = state.progress;
  return qualify(
    state.seed,
    { time: p.out ? null : p.time, out: p.out, gates: p.passed },
    state.field.runs,
  );
}

/** WHAT COMES NEXT, off the bracket after this run. */
export function crossNextOf(state: GameState): CrossNext | null {
  const b = bracketAfter(state);
  if (!b) return null;
  const heat = nextHeat(b);
  if (heat) return { kind: "heat", round: heat.round };
  const done = advance(b, null);
  return qualified(done) && bracketDone(done) && finalPlace(done) <= SKI_CROSS.heat
    ? { kind: "done", place: finalPlace(done) }
    : { kind: "out", place: finalPlace(done) };
}

/** THE NEXT RUN'S BRACKET — what the plate's press stands the next heat
 * up with — or null where the race is over for him. */
export function nextBracket(state: GameState): Bracket | null {
  const b = bracketAfter(state);
  return b && nextHeat(b) ? b : null;
}

/** THE WHOLE RACE'S RANKING once it is over for him — every heat after his
 * dealt to the end: the final ranking's first `count`, and his own place. */
export function crossPodium(
  state: GameState,
  count: number = SKI_CROSS.heat,
): { top: { id: number | null; rank: number }[]; place: number } | null {
  const b = bracketAfter(state);
  if (!b || nextHeat(b)) return null;
  const done = advance(b, null);
  return { top: crossStandings(done).slice(0, count), place: finalPlace(done) };
}

/** The ski cross's readouts at this step, or null off a ski cross. */
export function crossOf(state: GameState): CrossHud | null {
  if (!state.level.skiCross) return null;
  const heat = state.cross;
  const p = state.progress;
  const sinceGo = state.t - state.rules.countdown;
  const word = !heat
    ? null
    : state.phase === "countdown"
      ? state.t < SKI_CROSS.ready
        ? "ready"
        : "attention"
      : sinceGo < GO_HOLD && !p.finished
        ? "go"
        : null;
  const result: CrossResult | null = heat ? heatResult(state) : null;
  return {
    round: heat?.round ?? "qualify",
    heat: (heat?.index ?? 0) + 1,
    word,
    order:
      result?.order.map((r) => ({
        id: r.entry.id,
        rank: r.entry.rank,
        time: r.time,
        out: r.out !== null,
      })) ?? [],
    through: SKI_CROSS.through,
    next: p.finished ? crossNextOf(state) : null,
    podium: p.finished ? (crossPodium(state)?.top ?? null) : null,
    others: heat && p.finished ? roundOf(state, heat.round, heat.index) : [],
  };
}

/** The other heats of `round` as the bracket after this run has them. */
function roundOf(state: GameState, round: CrossRound, mine: number): CrossHud["others"] {
  const b = bracketAfter(state);
  if (!b) return [];
  return b.results
    .filter((r) => r.heat.round === round && r.heat.index !== mine)
    .map((r) => ({
      heat: r.heat.index + 1,
      through: r.order.slice(0, SKI_CROSS.through).map((p) => p.entry),
    }));
}
