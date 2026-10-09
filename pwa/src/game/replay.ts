// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REPLAY — the run again, from the outside, from any moment of it.
//
// A REPLAY IS A TAPE OF THE CONTROLS AND NOTHING ELSE: the controls the
// engine was handed, one step at a time — not a recording of pixels and not
// a path the skis took. The engine is deterministic — a fixed step, no
// `Math.random`, every draw off the state's own seeded stream — so riding
// those controls from the same state gives the run back EXACTLY: the same
// kicker, the same trunk, the same rival passed on the same berm, the same
// figure on the clock. That is why it can be watched from any camera, the
// broadcast included (`camera-tv.ts`), instead of only the one it was ridden
// through.
//
// THE FIELD COMES WITH IT. A race's rivals, a free ride's crowd, its
// machines and its beast are all part of the state the run is stood up
// from, and the engine steps them off it as it did; only the PLAYER's hands
// are on the tape — the helicopter's four controls and the machine press
// with them.
//
// FROM ANY MOMENT: the run is copied as it goes (`replay-keep.ts`), so a
// recording opens on the start, or a few seconds before the crash just
// taken, and seeks anywhere in it — the nearest copy at or before the mark,
// stepped forward to it off the tape. The first copy is the run as it stood
// when it was armed, so nothing about the afternoon has to be read off the
// settings that asked for it — the free ride's day, snow, machines and
// beast included — and a run already under way when it was armed (a link's
// pre-roll) is as watchable as one armed on the start line.
//
// THE LIVE RUN SURVIVES IT. A recording is stood up from copies and never
// touches the run it was cut from: watching from the pause card, or off the
// offer after a crash, hands the run back exactly where it was held.
//
// EVERY RUN THE PLAYER RIDES KEEPS ONE (`keepsReplay`); what a recording is
// cut to is the run thus far, up to `KEEP.window` back. Nothing is written
// to disk — a replay lives as long as the run it was cut from.
//
// `recipeOf` beside it is how a run is stood up AGAIN from the start (a
// restart, a second run, the next jump of a contest — `pinned-run.ts`).
//
// Pure and DOM-free: `tests/replay_test.ts` rides it headless.

import {
  NEUTRAL_INPUT,
  TUNING,
  isGameMode,
  step,
  type CreateGameOptions,
  type GameMode,
  type GameState,
  type SkiId,
  type SkierInput,
} from "@engine";
import {
  axisToByte,
  byteToAxis,
  type AxisKind,
} from "@niclaslindstedt/oss-game-framework/racing/tape";

import { trainingOf } from "./downhill-run.ts";
import { createKeyframes, standUp, type Keyframes } from "./replay-keep.ts";
import { heatOf } from "./slalom-heat.ts";
import {
  createShotCollector,
  directAt,
  type ReplayShot,
  type ShotCall,
  type ShotCollector,
} from "./replay-shots.ts";

const HZ = TUNING.physicsHz;

/** How long a recording runs on past the finish, s: the skier through the
 * line and settling, and no further — the run-out is not the race. */
export const REPLAY_TAIL = 2.5;

/** THE CRASH JUST TAKEN, as the recording offers it: how far before the
 * moment the instant replay opens, s — the skier arriving into it, as a
 * broadcast cuts back to the turn before the fall — and how long after the
 * moment the offer stands, s. A wipeout, an injury and a death within
 * `merge` seconds of each other are one moment. With no crash to offer,
 * the instant replay is the last `recent` seconds. */
export const CRASH = { lead: 4, offer: 9, merge: 3, recent: 10 } as const;

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
    gore: state.gore !== undefined,
    sfw: state.rules.sfw === true,
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
    // A moguls run and the contest it was skied in (`moguls-run.ts`).
    moguls: state.moguls,
    // An aerials jump and the contest it was jumped in (`aerials-run.ts`).
    aerials: state.aerials,
    quiet: true,
  };
}

/** Whether a run in `mode` is recorded to be watched back: every mode a
 * player rides. */
export function keepsReplay(mode: GameMode): boolean {
  return isGameMode(mode);
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
   * — which is what the pause card's offer usually is. */
  time: number | null;
  place: number | null;
};

/* ── THE TAPE ─────────────────────────────────────────────────────────────
   The ghost's axes (`ghost.ts`) and the ones a free ride adds: the
   helicopter's four controls and the machine press. Kept in memory as the
   framework's bytes (`racing/tape`'s `axisToByte`), one row a step, never
   stored, so it owes no format of its own. */

const AXES = [
  ["steer", "signed"],
  ["lean", "signed"],
  ["tuck", "lever"],
  ["brake", "lever"],
  ["flags", "flags"],
  ["collective", "lever"],
  ["pitch", "signed"],
  ["roll", "signed"],
  ["pedal", "signed"],
] as const satisfies readonly (readonly [string, AxisKind])[];

const ROW = AXES.length;
const RESET = 1;
const TRICK = 2;
const CARVE = 4;
const JUMP = 8;
const MACHINE = 16;
const HELI = 32;

type Tape = {
  record: (input: SkierInput) => void;
  steps: () => number;
  /** The controls step `i` was ridden on, into one reused input. */
  at: (i: number) => SkierInput;
};

function createTape(): Tape {
  let bytes = new Uint8Array(ROW * HZ * 60);
  let steps = 0;
  const input: SkierInput = { ...NEUTRAL_INPUT };
  const heli = { collective: 0, pitch: 0, roll: 0, pedal: 0 };
  const values = new Array<number>(ROW).fill(0);
  return {
    steps: () => steps,
    record: (c) => {
      if ((steps + 1) * ROW > bytes.length) {
        const grown = new Uint8Array(bytes.length * 2);
        grown.set(bytes);
        bytes = grown;
      }
      const h = c.heli;
      values[0] = c.steer;
      values[1] = c.lean;
      values[2] = c.tuck;
      values[3] = c.brake;
      values[4] =
        (c.reset ? RESET : 0) |
        (c.trick ? TRICK : 0) |
        (c.carve ? CARVE : 0) |
        (c.jump ? JUMP : 0) |
        (c.machine ? MACHINE : 0) |
        (h ? HELI : 0);
      values[5] = h?.collective ?? 0;
      values[6] = h?.pitch ?? 0;
      values[7] = h?.roll ?? 0;
      values[8] = h?.pedal ?? 0;
      const base = steps * ROW;
      for (let a = 0; a < ROW; a++) bytes[base + a] = axisToByte(values[a], AXES[a][1]);
      steps++;
    },
    at: (i) => {
      if (i < 0 || i >= steps) {
        input.trick = input.carve = input.jump = input.machine = input.heli = undefined;
        return Object.assign(input, NEUTRAL_INPUT);
      }
      const base = i * ROW;
      const read = (a: number): number => byteToAxis(bytes[base + a], AXES[a][1]);
      const flags = bytes[base + 4];
      input.steer = read(0);
      input.lean = read(1);
      input.tuck = read(2);
      input.brake = read(3);
      input.reset = (flags & RESET) !== 0;
      // Left off when not held, so a tape reads back as the input it was.
      input.trick = (flags & TRICK) !== 0 ? true : undefined;
      input.carve = (flags & CARVE) !== 0 ? true : undefined;
      input.jump = (flags & JUMP) !== 0 ? true : undefined;
      input.machine = (flags & MACHINE) !== 0 ? true : undefined;
      if ((flags & HELI) !== 0) {
        heli.collective = read(5);
        heli.pitch = read(6);
        heli.roll = read(7);
        heli.pedal = read(8);
        input.heli = heli;
      } else input.heli = undefined;
      return input;
    },
  };
}

/** WHAT A RECORDING IS WHILE IT IS BEING WATCHED. The app shows `state` and
 * steps it off `input`; a seek stands a NEW state up, which the app is
 * told to show in its place (the trails start again from it). */
export type Replay = {
  /** The run as it stands in the recording — a new object after a seek. */
  readonly state: GameState;
  bill: ReplayBill;
  /** The running order it was cut with — the director's, and the marks
   * along the bar. */
  plan: readonly ReplayShot[];
  /** The first step the recording reaches back to, and the step it ends
   * on — steps since the run was armed. */
  first: number;
  end: number;
  /** The crash just taken, where the recording was opened on one. */
  moment: number | null;
  /** How many steps of the recording the state has taken. */
  at: () => number;
  /** The controls the next step is ridden on, the tape walked on by one.
   * The object is REUSED — the engine spends an input in its step. */
  input: () => SkierInput;
  /** Which moment holds the frame showing, and how fast the director runs
   * the picture. */
  call: () => ShotCall;
  /** Whether the tape has run out. */
  over: () => boolean;
  /** How far through it is, 0..1 — the bar's gauge. */
  through: () => number;
  /** Ask for the frame after step `to` (clamped into the recording): the
   * nearest copy at or before it is stood up at once, and `pump` steps it
   * the rest of the way. */
  seek: (to: number) => void;
  /** Where a seek is headed, or null when the picture is where it was
   * asked to be. */
  seeking: () => number | null;
  /** Step a seek on while `more()` says there is time. */
  pump: (more: () => boolean) => void;
};

/** Where a recording opens: its first step, the crash just taken
 * (`CRASH.lead` before it), or the last `CRASH.recent` seconds. */
export type ReplayFrom = "start" | "crash" | "recent";

export type ReplayRig = {
  /** Arm a run: a recorder, a collector and the run's first copy, the last
   * recording dropped. `mode` null (the bot's race under a card) arms
   * nothing. */
  arm: (state: GameState, mode: GameMode | null) => void;
  /** One step of the engine, AFTER it was taken: the controls it was handed
   * and the state it left. Anything but the armed run is ignored. */
  step: (driven: SkierInput, state: GameState) => void;
  /** Whether there is anything worth offering to watch. */
  offers: () => boolean;
  /** The step of the latest crash still worth offering (`CRASH.offer`), or
   * null. */
  crash: () => number | null;
  /** Cut the recording where it stands and stand it up — on its first step,
   * a few seconds before the crash just taken, or the last few seconds.
   * Null where there is nothing to watch. Never touches the run it was cut
   * from. */
  open: (from?: ReplayFrom) => Replay | null;
  clear: () => void;
};

type Cut = {
  run: GameState;
  mode: GameMode;
  tape: Tape;
  shots: ShotCollector;
  keys: Keyframes;
  /** The step the flag fell on, its time and place, once it has. */
  finish: { at: number; time: number; place: number } | null;
  /** The latest crash's step. */
  crash: number | null;
};

const CRASHES = new Set(["wipeout", "injury", "death"]);

export function createReplayRig(): ReplayRig {
  let cut: Cut | null = null;

  const open = (from: ReplayFrom = "start"): Replay | null => {
    if (!cut || cut.tape.steps() === 0) return null;
    const { tape, keys, run } = cut;
    const end = cut.finish
      ? Math.min(tape.steps(), cut.finish.at + 1 + Math.round(REPLAY_TAIL * HZ))
      : tape.steps();
    const first = keys.first().step;
    const plan = cut.shots.plan().filter((s) => s.at >= first);
    const bill: ReplayBill = {
      mode: cut.mode,
      skis: run.skier.spec.id,
      seed: run.seed,
      time: cut.finish?.time ?? null,
      place: cut.finish && run.rivals.length > 0 ? cut.finish.place : null,
    };
    const moment = from === "crash" ? cut.crash : null;
    let state = standUp(keys.first());
    let at = first;
    let target: number | null = null;
    const clampTo = (i: number): number => Math.min(end, Math.max(first, Math.round(i)));
    const replay: Replay = {
      get state() {
        return state;
      },
      bill,
      plan,
      first,
      end,
      moment,
      at: () => at,
      input: () => tape.at(at++),
      // The step SHOWING is the one just taken, the one before the cursor.
      call: () => directAt(plan, Math.max(0, at - 1)),
      over: () => at >= end,
      through: () => (end === first ? 1 : Math.min(1, (at - first) / (end - first))),
      seek: (to) => {
        const want = clampTo(to);
        const key = keys.before(want);
        // Forward from where the picture stands when that is nearer than
        // the copy: the same run carries on, its trails with it.
        if (want < at || key.step > at) {
          state = standUp(key);
          at = key.step;
        }
        target = want === at ? null : want;
      },
      seeking: () => target,
      pump: (more) => {
        while (target !== null && at < target && more()) step(state, tape.at(at++));
        if (target !== null && at >= target) target = null;
      },
    };
    const opens =
      moment !== null
        ? moment - Math.round(CRASH.lead * HZ)
        : from === "recent"
          ? end - Math.round(CRASH.recent * HZ)
          : first;
    if (opens > first) {
      replay.seek(opens);
      replay.pump(() => true);
    }
    return replay;
  };

  return {
    clear: () => {
      cut = null;
    },
    offers: () => cut !== null && cut.tape.steps() > 0,
    crash: () => {
      if (!cut || cut.crash === null) return null;
      return cut.tape.steps() - cut.crash <= CRASH.offer * HZ ? cut.crash : null;
    },
    arm: (state, mode) => {
      cut = null;
      if (mode === null || !keepsReplay(mode)) return;
      cut = {
        run: state,
        mode,
        tape: createTape(),
        shots: createShotCollector(),
        keys: createKeyframes(state),
        finish: null,
        crash: null,
      };
    },
    step: (driven, state) => {
      if (!cut || state !== cut.run) return;
      cut.tape.record(driven);
      const at = cut.tape.steps() - 1;
      cut.shots.step(state, at);
      cut.keys.step(state, at + 1);
      for (const e of state.events) {
        if (e.kind === "finish" && !cut.finish) {
          cut.finish = { at, time: e.time, place: e.place };
        } else if (CRASHES.has(e.kind)) {
          if (cut.crash === null || at - cut.crash > CRASH.merge * HZ) cut.crash = at;
        }
      }
    },
    open,
  };
}
