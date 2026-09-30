// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RUN'S BOOKKEEPING — the rig the app drives beside every run the player
// rides: the record book it is filed in (`records.ts`), the tape it leaves
// (`ghost.ts`) and the ghost it is ridden against.
//
// WHICH RUNS HAVE A GHOST, and why only those. A ghost is somebody to ride
// against where there is nobody else out there, so it belongs to the TIME
// TRIAL (`GHOST_MODES`). A race already has a field to be measured against,
// and a ghost's run is stepped beside the player's, so a field would have to
// be stepped twice to put one on the snow beside it. A race is still FILED:
// its time is written in the book under its own mode.
//
// WHAT THE GHOST IS is one more `GameState` over the SAME `Level` object,
// stepped from the tape a step at a time beside the player's own, with the
// recording's own skis and its own help. Not a rival: nothing steers it,
// nothing may touch it, it is on no standings. It is a picture of a run that
// already happened, and the renderer draws it see-through and leaves its
// furrows out of the snow — a picture may not mark the thing it is a picture
// of.
//
// WHAT THE TAPE IS WORTH KEEPING FOR is decided at the flag: the run that
// BEAT the row on file, or any run at all where there is no readable tape
// for this map — so a device whose tapes an older build wrote is not left
// with a time and nothing to race until the time itself falls.
//
// A TAPE IS CUT FROM THE ENGINE'S FIRST STEP. `arm` is called on a run the
// player is about to ride before it has taken one; a run armed any later
// (a link's pre-roll) is filed in the book but keeps no tape and gets no
// ghost, because step 0 would not mean the same moment in both runs. Nor does
// a run with DAMAGE on (`GameState.damage`): a tape carries the controls and
// not what the blows cost, and a ghost replayed on a sound skier would
// ride off the recording's line at its first bent ski. It is still filed.
//
// Everything this module needs from the app is handed in (the renderer's
// one call, and the book's storage through `records.ts`); the app decides
// WHEN a run is armed, stepped and dropped.

import {
  createGame,
  skisById,
  step,
  type Assist,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";

import {
  createControlRecorder,
  ghostStage,
  loadGhost,
  readControls,
  saveGhost,
  sealGhost,
  type ControlRecorder,
  type GhostRun,
  type GhostStage,
  type GhostTape,
} from "./ghost.ts";
import {
  bestFor,
  loadRecords,
  noteRecord,
  saveRecords,
  type RecordBook,
  type RecordKey,
  type RunLedger,
  type RunRecord,
} from "./records.ts";

/** What a player's run is filed under, and the help it is ridden with. */
export type RunTicket = { key: RecordKey; assist: Assist };

/** What the rig asks of the app. */
export type GhostWorld = {
  /** Put the ghost's run on the renderer, or take it off. */
  show: (ghost: GameState | null) => void;
  /** The wall clock a row is dated with, unix ms. */
  now?: () => number;
  /** The book and the tapes, stored; `localStorage` when left out — a lab or
   * a test hands its own. */
  store?: {
    loadBook: () => RecordBook;
    saveBook: (book: RecordBook) => void;
    loadGhost: (stage: GhostStage) => GhostRun | null;
    saveGhost: (run: GhostRun) => void;
  };
};

/** How a finished run was filed. */
export type Settled = { time: number; record: boolean };

export type RunBook = {
  /** Arm a run: filed under `ticket`, or nothing at all (the bot's run under
   * a card). Takes the last one off first. */
  arm: (state: GameState, ticket: RunTicket | null) => void;
  /** One step of the engine: the controls it ACTUALLY received written
   * down, the crossings it raised collected, the ghost advanced one step of
   * its tape — and the run filed on the step it takes the flag. */
  step: (driven: SkierInput, events: readonly GameEvent[]) => void;
  /** What the HUD measures the run against. */
  ledger: () => RunLedger;
  /** The row standing under `key` — what the front door's tile shows. */
  standing: (key: RecordKey) => RunRecord | null;
  /** How the finished run was filed; null until the flag. */
  settled: () => Settled | null;
  /** The ghost's own run, while there is one. */
  ghost: () => GameState | null;
  /** Take the ghost off the snow and drop the tape being written. */
  clear: () => void;
  /** Read the book off the store again — after the cloud save merged
   * another device's rows into it (`use-cloud-sync.ts`), so the next finish
   * is filed against the union rather than written over it. */
  reload: () => void;
};

const STORAGE = { loadBook: loadRecords, saveBook: saveRecords, loadGhost, saveGhost };

export function createRunBook(world: GhostWorld): RunBook {
  const store = world.store ?? STORAGE;
  const now = world.now ?? Date.now;
  let book: RecordBook = store.loadBook();
  let ticket: RunTicket | null = null;
  let ledger: RunLedger = { mode: "race", standing: null };
  let crossings: number[] = [];
  let settled: Settled | null = null;
  let recorder: ControlRecorder | null = null;
  let stage: GhostStage | null = null;
  /** Whether a readable tape for this map was on file at the start. */
  let hadTape = false;
  let ghost: GameState | null = null;
  let tape: GhostTape | null = null;
  let at = 0;

  const clear = (): void => {
    ticket = null;
    ledger = { mode: "race", standing: null };
    crossings = [];
    settled = null;
    recorder = null;
    stage = null;
    hadTape = false;
    ghost = null;
    tape = null;
    at = 0;
    world.show(null);
  };

  const settle = (time: number): void => {
    if (!ticket || settled) return;
    const { key, assist } = ticket;
    const noted = noteRecord(book, key, {
      value: time,
      skis: key.skis,
      at: now(),
      splits: crossings,
    });
    if (noted.record) {
      book = noted.book;
      store.saveBook(book);
    }
    settled = { time, record: noted.record };
    if (recorder && stage && (noted.record || !hadTape)) {
      store.saveGhost(sealGhost(recorder.seal(), stage, key, assist, time));
    }
    recorder = null;
  };

  return {
    arm: (state, next) => {
      clear();
      if (!next) return;
      ticket = next;
      ledger = { mode: next.key.mode, standing: bestFor(book, next.key) };
      if (state.tick !== 0 || state.damage) return;
      stage = ghostStage(next.key, state.level);
      if (!stage) return;
      recorder = createControlRecorder();
      const saved = store.loadGhost(stage);
      if (!saved) return;
      hadTape = true;
      // The recording's OWN skis and help, on the very map object the run
      // beside it stands on — building a map is the dearest thing the engine
      // does, and this one is paid for.
      ghost = createGame({
        level: state.level,
        seed: state.seed,
        mode: saved.mode,
        laps: saved.laps,
        spec: skisById(saved.skis),
        assist: saved.assist,
        quiet: true,
      });
      tape = readControls(saved);
      at = 0;
      world.show(ghost);
    },
    step: (driven, events) => {
      if (!ticket) return;
      recorder?.record(driven);
      if (ghost && tape) step(ghost, tape.at(at++));
      for (const e of events) {
        if (e.kind === "checkpoint") crossings.push(e.split);
        else if (e.kind === "finish") settle(e.time);
      }
    },
    ledger: () => ledger,
    standing: (key) => bestFor(book, key),
    settled: () => settled,
    ghost: () => ghost,
    clear,
    reload: () => {
      book = store.loadBook();
    },
  };
}
