// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REPLAY — the run again, from the outside.
//
// A REPLAY IS A TAPE OF THE CONTROLS AND NOTHING ELSE — the ghost's own
// `ControlTape` (`ghost.ts`), cut by the same recorder and read by the same
// reader: one tape, never two encoders. Not a recording of pixels and not a
// path the skis took: the controls the engine was handed, one step at a
// time, and the afternoon it was handed them in. The engine is
// deterministic — a fixed step, no `Math.random`, every draw off the state's
// own seeded stream — so riding those controls over the same map on the
// same skis gives the run back EXACTLY: the same kicker, the same trunk,
// the same rival passed on the same berm, the same figure on the clock.
// That is why it can be watched from any camera, the broadcast included
// (`camera-tv.ts`), instead of only the one it was ridden through.
//
// THE FIELD COMES WITH IT, which is the difference from the ghost. A race's
// rivals are whole runs ridden by the bot off the player's own state and
// stream (`rivals.ts`), so rebuilding the afternoon — the same map object,
// the same seed, the same rules, the same skis and help — deals them the
// same paces at the start line and the bot skis them to every gate on the
// step they reached it. Only the PLAYER's hands are on the tape.
//
// WHAT NAMES THE AFTERNOON is read off the run itself at its first step
// (`recipeOf`) rather than off the settings that asked for it: the `Level`
// (which already carries the day and the sky the run was stood up under),
// the seed, the rules, the pair, the help, the damage and poles switches
// and the snow dial. Nothing is written to disk — a replay lives as long as the tab does.
// And the rebuild is CHECKED before it is watched (`startPrint`): a recipe
// that stopped describing its run is a replay that quietly rides a different
// race, and a press that does nothing is the better failure.
//
// WHICH RUNS KEEP ONE: the ones the record book keeps (`keepsRecords` — the
// race and the time trial) and the TRICKS run, whose flips are the most
// worth watching back of anything the game has, armed on their very first
// step (`keepsReplay`). A free ride's
// day and snow are the skier's own and it has no flag to end on. The offer
// is made on the finish plate and the pause card; taken mid-ride it ENDS the
// run, which the row says rather than leaving to be discovered.
//
// Pure and DOM-free: `tests/replay_test.ts` rides it headless.

import {
  TUNING,
  createGame,
  isGameMode,
  type CreateGameOptions,
  type GameMode,
  type GameState,
  type SkiId,
  type SkierInput,
} from "@engine";

import { createControlRecorder, readControls, type ControlRecorder } from "./ghost.ts";
import { keepsRecords } from "./records.ts";
import { trainingOf } from "./downhill-run.ts";
import { heatOf } from "./slalom-heat.ts";
import {
  createShotCollector,
  directAt,
  type ReplayShot,
  type ShotCall,
  type ShotCollector,
} from "./replay-shots.ts";

/** How long a recording runs on past the finish, s: the skier through the
 * line and settling, and no further — the run-out is not the race. */
export const REPLAY_TAIL = 2.5;

/** WHAT NAMES THE AFTERNOON: how `createGame` stands this run up again, read
 * off the run at its first step. The mode is the app's (a name the rules
 * were dealt from); everything else is the state's own. */
export function recipeOf(state: GameState, mode: GameMode): CreateGameOptions {
  return {
    level: state.level,
    seed: state.seed,
    mode,
    laps: state.rules.laps,
    rivals: state.rules.rivals,
    countdown: state.rules.countdown,
    contact: state.rules.contact,
    spec: state.skier.spec,
    assist: { ...state.assist },
    damage: state.damage,
    poles: state.skier.poles,
    snowDepth: state.snowDepth,
    // A slalom's second run: the first run carried in again, so the course
    // and the board are the second run's.
    heat: heatOf(state),
    // A downhill's training run or its race (`downhill-run.ts`).
    training: trainingOf(state),
    // A ski cross's heat and the bracket it was raced in (`ski-cross-run.ts`).
    cross: state.cross,
    bracket: state.bracket,
    // A big air jump and the contest it was jumped in (`big-air-run.ts`).
    bigAir: state.bigAir,
    // A slopestyle run and the contest it was skied in (`slopestyle-run.ts`).
    slopestyle: state.slopestyle,
    // A halfpipe run and the contest it was skied in (`halfpipe-run.ts`).
    halfpipe: state.halfpipe,
    quiet: true,
  };
}

/** Whether a run in `mode` is recorded to be watched back. */
export function keepsReplay(mode: GameMode): boolean {
  return (
    isGameMode(mode) &&
    (keepsRecords(mode) ||
      mode === "tricks" ||
      mode === "bigAir" ||
      mode === "knuckleHuck" ||
      mode === "slopestyle" ||
      mode === "railJam" ||
      mode === "halfpipe")
  );
}

/** A FINGERPRINT OF A RUN AT ITS FIRST STEP: where every skier stands, on
 * which pair, at what pace and how late off the start — what a rebuild has to agree on before it is
 * worth watching. */
export function startPrint(state: GameState): string {
  const r = (v: number): string => v.toFixed(4);
  const s = state.skier;
  const field =
    state.rivals.map((v) => `${v.run.skier.spec.id}:${r(v.pace)}:${r(v.react)}`).join(",") +
    (state.field?.runs.map((f) => `${f.id}:${f.time === null ? "out" : r(f.time)}`).join(",") ??
      "");
  return [
    state.seed,
    state.skier.spec.id,
    r(s.x),
    r(s.z),
    r(s.heading),
    state.rules.laps,
    state.rules.course ? 1 : 0,
    field,
  ].join("|");
}

/** What the bar over a recording is given: the facts, worded by
 * `strings.ts` (§39.1). */
export type ReplayBill = {
  mode: GameMode;
  skis: SkiId;
  seed: number;
  /** The run's time, or null on a recording cut from a run nobody finished
   * — which is what the pause card's offer always is. */
  time: number | null;
  place: number | null;
};

/** WHAT A RECORDING IS WHILE IT IS BEING WATCHED. The app adopts `state`
 * as its engine state and steps it off `input`. */
export type Replay = {
  state: GameState;
  bill: ReplayBill;
  /** The controls the next step is ridden on, and the tape walked on by
   * one. The object is REUSED — the engine spends an input in its step. */
  input: () => SkierInput;
  /** Which moment holds the frame showing, and how fast the picture runs. */
  call: () => ShotCall;
  /** Whether the tape has run out. */
  over: () => boolean;
  /** How far through it is, 0..1 — the bar's gauge. */
  through: () => number;
  /** The running order it was cut with (a lab's, a test's). */
  plan: readonly ReplayShot[];
};

export type ReplayRig = {
  /** Arm a run, before its first step: a recorder and a collector on a run
   * in a mode that keeps a record, the last one dropped. `mode` null (the
   * bot's race under a card) arms nothing. */
  arm: (state: GameState, mode: GameMode | null) => void;
  /** One step of the engine, AFTER it was taken: the controls it was handed
   * and the state it left. Anything but the armed run is ignored, which is
   * what makes a tape start at that run's very first step. */
  step: (driven: SkierInput, state: GameState) => void;
  /** Whether there is anything worth offering to watch. */
  offers: () => boolean;
  /** Cut the recording where it stands and stand it up; null where there is
   * nothing to watch or the rebuild is not the same afternoon. Safe
   * mid-run. */
  open: () => Replay | null;
  clear: () => void;
};

type Cut = {
  run: GameState;
  recipe: CreateGameOptions;
  print: string;
  mode: GameMode;
  /** The step the flag fell on, its time and place, once it has. */
  finish: { at: number; time: number; place: number } | null;
};

export function createReplayRig(): ReplayRig {
  let tape: ControlRecorder | null = null;
  let shots: ShotCollector | null = null;
  let cut: Cut | null = null;

  const clear = (): void => {
    tape = null;
    shots = null;
    cut = null;
  };

  return {
    clear,
    offers: () => tape !== null && tape.steps() > 0,
    arm: (state, mode) => {
      clear();
      if (mode === null || !keepsReplay(mode)) return;
      // A tape has to start at the run's first step, or step 0 would not be
      // the same moment in the rebuild — a link's pre-rolled run is not
      // recorded at all.
      if (state.tick !== 0) return;
      tape = createControlRecorder();
      shots = createShotCollector();
      cut = {
        run: state,
        recipe: recipeOf(state, mode),
        print: startPrint(state),
        mode,
        finish: null,
      };
    },
    step: (driven, state) => {
      if (!cut || !tape || !shots || state !== cut.run) return;
      tape.record(driven);
      const at = tape.steps() - 1;
      shots.step(state, at);
      if (cut.finish) return;
      for (const e of state.events) {
        if (e.kind === "finish") cut.finish = { at, time: e.time, place: e.place };
      }
    },
    open: () => {
      if (!tape || !shots || !cut || tape.steps() === 0) return null;
      let rebuilt: GameState;
      try {
        rebuilt = createGame(cut.recipe);
      } catch {
        // A replay is never load-bearing: the run is already ridden and
        // booked, so a rebuild that will not build is a press that does
        // nothing.
        return null;
      }
      if (startPrint(rebuilt) !== cut.print) return null;
      const controls = readControls(tape.seal());
      const end = cut.finish
        ? Math.min(controls.steps, cut.finish.at + 1 + Math.round(REPLAY_TAIL * TUNING.physicsHz))
        : controls.steps;
      const plan = shots.plan();
      const bill: ReplayBill = {
        mode: cut.mode,
        skis: cut.run.skier.spec.id,
        seed: cut.run.seed,
        time: cut.finish?.time ?? null,
        place: cut.finish && cut.run.rivals.length > 0 ? cut.finish.place : null,
      };
      let at = 0;
      return {
        state: rebuilt,
        bill,
        plan,
        input: () => controls.at(at++),
        // The step SHOWING is the one just taken, the one before the cursor.
        call: () => directAt(plan, Math.max(0, at - 1)),
        over: () => at >= end,
        through: () => (end === 0 ? 1 : Math.min(1, at / end)),
      };
    },
  };
}
