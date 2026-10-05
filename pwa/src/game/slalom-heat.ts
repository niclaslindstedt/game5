// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SLALOM'S TWO RUNS, from the app's side: whether the first run earned a
// second, the HEAT the second is stood up with (`CreateGameOptions.heat`,
// the engine's `Heat`), and the heat a second run already on the snow was
// stood up with — which a restart and a replay hand back to `createGame`, so
// the course and the board they stand up are the second run's again.
//
// The rule is the sport's (R31, `SLALOM.qualify`): the best thirty of the
// first run start the second, the leader last. A racer who went out of the
// first run has no time to rank and no second run. Nothing here decides who
// starts where — that is the engine's `createField`; this only says whether
// the player is among them and hands the first run over.
//
// A downhill has no second run; what its plate offers after its training run
// is its race (`downhill-run.ts`), and `secondRunOf` says so beside the
// slalom's offer, so the plate asks one function what comes next.
//
// DOM-free and storage-free: `tests/slalom_hud_test.ts` reads it.

import { SLALOM, fieldPlace, type GameState, type Heat } from "@engine";

/** WHAT THE FINISH PLATE OFFERS after a slalom's first run: the second run
 * (`go`), or why not — out of the first (`out`), or home outside the
 * qualifying places (`short`), at `place` — and after a DOWNHILL'S
 * TRAINING run, home or out, its race (`race`, `downhill-run.ts`). */
export type SecondRun =
  | { kind: "go"; place: number }
  | { kind: "out" }
  | { kind: "short"; place: number }
  | { kind: "race" };

/** The plate's offer, or null on any run that is not a slalom's first run
 * or a downhill's training run over — a second run, a downhill's race, any
 * other mode, a run still on the course. */
export function secondRunOf(state: GameState): SecondRun | null {
  const f = state.field;
  if (!f || !state.progress.finished) return null;
  if (state.level.downhill) return f.training ? { kind: "race" } : null;
  if (f.run !== 1) return null;
  if (state.progress.out) return { kind: "out" };
  const place = fieldPlace(state);
  return place <= SLALOM.qualify ? { kind: "go", place } : { kind: "short", place };
}

/** THE HEAT AFTER THE FIRST RUN: the player's time and the field as it
 * finished, to stand the second run up with — or null where the first run
 * earned none (`secondRunOf`). */
export function heatAfter(state: GameState): Heat | null {
  const f = state.field;
  if (!f || secondRunOf(state)?.kind !== "go") return null;
  return { run: 2, player: state.progress.time, field: f.runs };
}

/** THE HEAT A SECOND RUN WAS STOOD UP WITH, read back off it: the player's
 * first-run time and every starter's (`FieldRun.before`) — the first run's
 * finishers, which are all `createField` reads of a heat. Undefined on a
 * first run and on any other mode. */
export function heatOf(state: GameState): Heat | undefined {
  const f = state.field;
  if (f?.run !== 2) return undefined;
  return { run: 2, player: f.before, field: f.runs.map((r) => ({ ...r, time: r.before })) };
}
