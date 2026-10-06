// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GHOST — your best run on a map, kept as the CONTROLS that rode it.
//
// The engine is deterministic: a fixed step (`TUNING.physicsHz`), no
// `Math.random`, every draw off the state's own seeded stream. So the same
// map, the same skis, the same help and the same sequence of inputs put the
// skier over the same metre of snow every time, and a ghost is a tape of
// what the skier's hands did rather than a path of where the skis went. A
// few kilobytes for a run, and a skier who jumps, lands and resets EXACTLY
// the way it did — because it is the same physics doing it rather than an
// interpolation between recorded poses.
//
// THE BARGAIN THAT BUYS IT IS ONE NUMBER PER AXIS. Every control is snapped
// onto a fixed grid at the place the player's input is produced (`snapInput`,
// applied by `input-model.ts`'s `sampleInput`) and again where the app hands
// the engine any input at all, so the figure the engine is driven on is the
// figure the tape writes down. Record anything the engine did not receive
// and the replay walks off the line a checkpoint later — and at 1/127 of
// full lock the grid is finer than a thumb or a key ramp can resolve.
//
// The OTHER half is that step 0 means the same moment in both runs. A tape
// starts at the first step of the game, the lights included (the engine
// holds every input under the lights, `run.ts`, so whoever rode those steps
// wrote nothing that moves the skis), and the two runs advance in lockstep.
//
// WHAT NAMES THE SNOW is a `GhostStage`: the record-book row the run is
// filed under (`records.ts`'s `recordId` — seed and course, skis, mode, laps) and a
// FINGERPRINT of the map that was ridden (`mapPrint`), because a generator
// that moves under a seed is exactly the case a matching seed would miss. A
// ghost riding a map that is no longer there is worse than no ghost at all.
//
// Two halves, the way `records.ts` is split: everything above the storage
// line is PURE, so `tests/ghost_test.ts` holds it without a browser, and the
// functions under it are the skin over `localStorage`. A ghost that cannot
// be kept is simply not kept — the record it was set on still stands.

import {
  NEUTRAL_INPUT,
  isGameMode,
  isRiderId,
  isSkiId,
  type Assist,
  type GameMode,
  type Level,
  type RiderId,
  type SkiId,
  type SkierInput,
} from "@engine";

import {
  createFingerprint,
  createTapeRecorder,
  isControlTape,
  readTape,
  snapAxis,
  type ControlTape as Tape,
  type TapeSchema,
} from "@niclaslindstedt/oss-game-framework/racing/tape";

import { recordId, type RecordKey } from "./records.ts";

/** THE TAPE'S LAYOUT: the axes one step is written down as, each a byte —
 * the reset's edge, the trick button, the hard cut and the jump packed
 * into `flags`. The names are
 * the stored tape's keys, so renaming one is a format change. */
const TAPE: TapeSchema<"steer" | "lean" | "tuck" | "brake" | "flags"> = {
  steer: "signed",
  lean: "signed",
  tuck: "lever",
  brake: "lever",
  flags: "flags",
};

/** Bump when the tape's LAYOUT changes, or when what the engine DOES with
 * one changes — the same controls under a retuned skis put it somewhere
 * else, and a ghost that misses every corner is worse than none. A tape
 * whose format this build does not know is dropped and rewritten by the
 * next run on that map. */
export const GHOST_FORMAT = 2;

/** THE BIGGEST TAPE WORTH KEEPING, characters of JSON. `localStorage` is a
 * few megabytes for the whole origin, shared with the record book and the
 * settings; a tape over the cap is dropped rather than risking the store. */
export const GHOST_CAP = 400_000;

/** ONE STEP'S CONTROLS, ON THE GRID THE TAPE WRITES — in place, and
 * returned. Applying it twice is free: a value on the grid snaps to itself. */
export function snapInput(input: SkierInput): SkierInput {
  input.steer = snapAxis(input.steer, TAPE.steer);
  input.lean = snapAxis(input.lean, TAPE.lean);
  input.tuck = snapAxis(input.tuck, TAPE.tuck);
  input.brake = snapAxis(input.brake, TAPE.brake);
  // A helicopter flown (`heli.ts`) on the same grid: a free ride keeps no
  // tape, but the figure the engine flies on is still the figure snapped.
  const h = input.heli;
  if (h) {
    h.collective = snapAxis(h.collective, "lever");
    h.pitch = snapAxis(h.pitch, "signed");
    h.roll = snapAxis(h.roll, "signed");
    h.pedal = snapAxis(h.pedal, "signed");
  }
  return input;
}

/** ONE RUN'S CONTROLS AND NOTHING ELSE: how many steps it runs for, and one
 * RLE'd, base64'd byte per step per axis — the reset's edge in `flags`. */
export type ControlTape = Tape<keyof typeof TAPE>;

/** WHAT NAMES THE SNOW a tape was cut on — see this file's header. */
export type GhostStage = {
  /** The record-book row, and the storage key the tape is kept at. */
  id: string;
  /** The map's fingerprint (`mapPrint`). */
  map: string;
};

/** A FINGERPRINT OF A MAP: FNV-1a over its seed, its piste's length and
 * every checkpoint's place. Cheap, and enough to tell a map the generator
 * has moved from the one a tape was ridden on. */
export function mapPrint(level: Level): string {
  const print = createFingerprint().mix(level.seed).mix(level.track.length);
  for (const cp of level.checkpoints) print.mix(cp.x).mix(cp.z);
  return print.digest();
}

/** THE MODES A TAPE IS KEPT FOR: the one ridden ALONE. A race has a field
 * to be measured against instead — and a ghost's run is stepped beside the
 * player's, so a field would have to be stepped twice. */
export const GHOST_MODES: readonly GameMode[] = ["timeTrial"];

/** Which piece of snow a run is on — null on a run that keeps no tape. */
export function ghostStage(key: RecordKey, level: Level): GhostStage | null {
  if (!GHOST_MODES.includes(key.mode)) return null;
  return { id: recordId(key), map: mapPrint(level) };
}

export type GhostRun = GhostStage &
  ControlTape & {
    format: number;
    seed: number;
    skis: SkiId;
    /** The skier's build it was ridden at — absent on a medium build's run
     * (and on every run kept before a build could be chosen). */
    rider?: RiderId;
    mode: GameMode;
    laps: number;
    /** The help the run was ridden with: the ghost rides with it too, since
     * the same hands with another hold on the yaw are another line. */
    assist: Assist;
    /** Whether it was skied on poles (`SkierState.poles`): the ghost skis
     * as it did, since the same hands with no poles are another line. Left
     * out of a tape that had them — every tape an older build wrote. */
    poles?: boolean;
    /** The time the run set, s. */
    value: number;
  };

const FLAG_RESET = 1;
/** ...and the trick button held (a tricks run's poses, `strokes.ts`). */
const FLAG_TRICK = 2;
/** ...the edge cut hard, and the jump held. */
const FLAG_CARVE = 4;
const FLAG_JUMP = 8;

export type ControlRecorder = {
  /** Write down the controls a step was ridden on — the input the engine
   * ACTUALLY received. */
  record: (input: SkierInput) => void;
  steps: () => number;
  /** The tape as it stands; callable mid-run. */
  seal: () => ControlTape;
};

export function createControlRecorder(): ControlRecorder {
  const tape = createTapeRecorder(TAPE);
  return {
    record: (input) =>
      tape.record({
        steer: input.steer,
        lean: input.lean,
        tuck: input.tuck,
        brake: input.brake,
        flags:
          (input.reset ? FLAG_RESET : 0) |
          (input.trick ? FLAG_TRICK : 0) |
          (input.carve ? FLAG_CARVE : 0) |
          (input.jump ? FLAG_JUMP : 0),
      }),
    steps: tape.steps,
    seal: tape.seal,
  };
}

export type GhostTape = {
  steps: number;
  /** The controls step `i` was ridden on — neutral once the tape runs out,
   * which is the ghost coasting where its run ended. The object is REUSED:
   * the engine spends an input inside the step it arrives in. */
  at: (step: number) => SkierInput;
};

/** Put a tape back on the snow. */
export function readControls(tape: ControlTape): GhostTape {
  const reader = readTape(tape, TAPE);
  const axes = { steer: 0, lean: 0, tuck: 0, brake: 0, flags: 0 };
  const input: SkierInput = { ...NEUTRAL_INPUT };
  return {
    steps: reader.steps,
    at: (step) => {
      if (reader.at(step, axes) === null) {
        input.trick = input.carve = input.jump = undefined;
        return Object.assign(input, NEUTRAL_INPUT);
      }
      input.steer = axes.steer;
      input.lean = axes.lean;
      input.tuck = axes.tuck;
      input.brake = axes.brake;
      input.reset = (axes.flags & FLAG_RESET) !== 0;
      // Left off when it is not held, so a tape reads back as the input it was.
      input.trick = (axes.flags & FLAG_TRICK) !== 0 ? true : undefined;
      input.carve = (axes.flags & FLAG_CARVE) !== 0 ? true : undefined;
      input.jump = (axes.flags & FLAG_JUMP) !== 0 ? true : undefined;
      return input;
    },
  };
}

/** Seal a recorder's tape into a run worth keeping. */
export function sealGhost(
  tape: ControlTape,
  stage: GhostStage,
  key: RecordKey,
  assist: Assist,
  value: number,
  poles = true,
): GhostRun {
  return {
    ...stage,
    ...tape,
    format: GHOST_FORMAT,
    seed: key.seed,
    skis: key.skis,
    ...(key.rider && key.rider !== "medium" ? { rider: key.rider } : {}),
    mode: key.mode,
    laps: key.laps,
    assist: { ...assist },
    ...(poles ? {} : { poles: false }),
    value,
  };
}

/** Whether a stored run still describes the snow about to be ridden. */
export function ghostMatches(run: GhostRun, stage: GhostStage): boolean {
  return run.format === GHOST_FORMAT && run.id === stage.id && run.map === stage.map;
}

const share = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

/** Whether a stored blob is a tape this build can put back on the snow —
 * the same rule `mergeRecords` applies: anything that is not a run somebody
 * could have ridden is dropped rather than trusted. */
export function readsAsGhost(parsed: unknown): parsed is GhostRun {
  if (typeof parsed !== "object" || parsed === null) return false;
  const run = parsed as Partial<GhostRun>;
  if (run.format !== GHOST_FORMAT) return false;
  if (typeof run.id !== "string" || typeof run.map !== "string") return false;
  if (typeof run.skis !== "string" || !isSkiId(run.skis)) return false;
  if (run.rider !== undefined && (typeof run.rider !== "string" || !isRiderId(run.rider))) {
    return false;
  }
  if (!isGameMode(run.mode)) return false;
  if (!Number.isInteger(run.seed) || !Number.isInteger(run.laps) || (run.laps as number) < 1) {
    return false;
  }
  if (!run.assist || !share(run.assist.yaw) || !share(run.assist.air)) return false;
  if (run.poles !== undefined && typeof run.poles !== "boolean") return false;
  if (typeof run.value !== "number" || !Number.isFinite(run.value) || run.value <= 0) return false;
  return isControlTape(parsed, TAPE);
}

/* ── STORAGE ──────────────────────────────────────────────────────────── */

/** ONE KEY PER STAGE: reading the ghost for the map about to be ridden must
 * not mean parsing every tape this device has kept. */
export const GHOST_PREFIX = "fall-line.ghost.v1:";

export function loadGhost(stage: GhostStage): GhostRun | null {
  try {
    const stored = localStorage.getItem(GHOST_PREFIX + stage.id);
    if (stored === null) return null;
    const parsed: unknown = JSON.parse(stored);
    if (!readsAsGhost(parsed) || !ghostMatches(parsed, stage)) return null;
    return parsed;
  } catch {
    // Storage unavailable, or not JSON — there is simply no ghost.
    return null;
  }
}

export function saveGhost(run: GhostRun): void {
  try {
    const text = JSON.stringify(run);
    if (text.length > GHOST_CAP) return;
    localStorage.setItem(GHOST_PREFIX + run.id, text);
  } catch {
    // Storage unavailable or full — the time is still in the book.
  }
}

/** EVERY TAPE ON FILE, each read the way `loadGhost` reads one — for the
 * cloud save (`cloud-save.ts`), which carries them to the skier's other
 * devices. A key that is not a readable tape is skipped, never trusted. */
export function loadGhosts(): GhostRun[] {
  const out: GhostRun[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === null || !key.startsWith(GHOST_PREFIX)) continue;
      try {
        const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
        if (readsAsGhost(parsed) && GHOST_PREFIX + parsed.id === key) out.push(parsed);
      } catch {
        // Not JSON — that key is simply not a tape.
      }
    }
  } catch {
    // Storage unavailable — there are no tapes to carry.
  }
  return out;
}
