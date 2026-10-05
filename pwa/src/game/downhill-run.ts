// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A DOWNHILL FROM THE APP'S SIDE (R32): its TRAINING run and the RACE after
// it, and the SPEED TRAP as the HUD and the plate read it.
//
// The rule is the sport's: every racer starts a timed training run on the
// course before he may race it, and its times count for nothing. So a
// downhill stood up off a card is its training run, the plate over the
// training — home or out — offers the race, and the race stands up on the
// same course (`CreateGameOptions.training`). A restart and a replay keep
// whichever of the two the run on the snow is (`trainingOf`, read in
// `recipeOf`), so a restart never drops a racer back into training.
//
// THE TRAP — a downhill's, and a super-G's (R33), which has one too: the
// player's speed through it and the field's — the fastest
// of the racers already down, and where his stands among theirs. The
// field's are the engine's own (`FieldRun.trap`, dealt about par's).
//
// DOM-free and storage-free: `tests/downhill_hud_test.ts` reads it.

import { speedCourseOf, type Field, type FieldRun, type GameState } from "@engine";

/** Whether the run on the snow is a downhill's training run. */
export function isTraining(state: GameState): boolean {
  return state.level.downhill !== undefined && state.field?.training === true;
}

/** WHICH OF A DOWNHILL'S TWO RUNS a run was stood up as — `true` its
 * training, `false` its race — read back off it for a restart and a replay;
 * undefined on any other run. */
export function trainingOf(state: GameState): boolean | undefined {
  if (!state.level.downhill || !state.field) return undefined;
  return state.field.training;
}

/** The racers of the field already down while the player is on the course
 * — the whole field once he is home. */
function downAlready(field: Field, over: boolean): FieldRun[] {
  return over ? field.runs : field.runs.slice(0, field.slot);
}

/** THE SPEED TRAP as the HUD reads it: the player's speed through it, km/h
 * (null until he is through), the field's fastest so far, km/h, and his
 * place among the field's speeds — null off a course with a trap. */
export type TrapReading = { speed: number | null; best: number | null; rank: number | null };

export function trapOf(state: GameState): TrapReading | null {
  const f = state.field;
  if (!speedCourseOf(state.level) || !f) return null;
  const mine = state.progress.trap;
  const theirs = downAlready(f, state.progress.finished)
    .map((r) => r.trap)
    .filter((v): v is number => v !== null);
  const best = theirs.length > 0 ? Math.max(...theirs) * 3.6 : null;
  return {
    speed: mine === null ? null : mine * 3.6,
    best,
    rank: mine === null ? null : 1 + theirs.filter((v) => v > mine).length,
  };
}
