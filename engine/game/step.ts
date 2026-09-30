// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The game orchestrator: `createGame` builds a run (a map, a skier on the
// start line, the field beside him — or, on a free ride, the skier alone
// wherever he asked to start), `step` advances it exactly one fixed
// timestep and leaves the events that step emitted on the state. The app's
// render loop and the headless simulator drive this same function — there
// is no other way to advance a run.
//
// THE STEP ORDER: the clock; the lights; the player's run (`run.ts`: the
// skier, the trees, the edge, the clock, the course, the reset); the score
// (`tricks.ts`); every rival's run by the same function; then every skier
// against every other.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { generateLevel, withDay, withSky } from "../mapgen/index.ts";
import type { PisteGrade } from "../mapgen/grades.ts";
import type { RegionId } from "../mapgen/regions.ts";
import type { TimeOfDay } from "../mapgen/sun.ts";
import type { Level, SkyOverride } from "../mapgen/types.ts";
import { status } from "@niclaslindstedt/oss-game-framework/core/output";
import { freeSpawn, freshProgress, standSkier } from "./course.ts";
import {
  FULL_ASSIST,
  MODE_RULES,
  RACE,
  clampSnowDepth,
  type Assist,
  type GameMode,
  type RunRules,
} from "./defs/modes.ts";
import { SKIS, type SkiSpec } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import { clipRiders, createRivals, gridSlot, stepRivals } from "./rivals.ts";
import { stepRun } from "./run.ts";
import { freshSkier } from "./skier.ts";
import { freshStep } from "./snowfall.ts";
import { freshTricks, stepTricks } from "./tricks.ts";
import { NEUTRAL_INPUT, type GameState, type SkierInput } from "./state.ts";

export type CreateGameOptions = {
  /** The map's seed; ignored for the map when `level` is given, but still
   * the run's own random stream. Defaults to the level's seed, or 1. */
  seed?: number;
  /** A map to ride instead of the one the seed generates (tests, labs). */
  level?: Level;
  /** The kind of snow country the seed's map is built in (R21); the boreal
   * when left out. Ignored when `level` is given. */
  region?: RegionId;
  /** The piste grade the seed's map is built to (R23); the one the seed
   * deals when left out. Ignored when `level` is given. */
  grade?: PisteGrade;
  /** The mode whose rules the run is dealt (`MODE_RULES`); a race when left
   * out. Each option below still overrides its own rule. */
  mode?: GameMode;
  /** How many rivals stand on the start line (`RACE.rivals` when left out;
   * 0 is a solo run — what the sim and the labs ski). */
  rivals?: number;
  /** Runs to the finish; the level's own (one) when left out. */
  laps?: number;
  /** Seconds of lights before GO (`RACE.countdown`; 0 for none). */
  countdown?: number;
  /** Whether skiers lean on each other. */
  contact?: boolean;
  /** The skis; the all-mountain pair when left out. */
  spec?: SkiSpec;
  /** The arcade's help for the player's own skiing (`Assist`); every hand on
   * when left out. The field rides with every hand on whatever this says. */
  assist?: Assist;
  /** Whether blows dull the player's edges (`damage.ts`); off when left
   * out. */
  damage?: boolean;
  /** Build without announcing the map (the sim's sweeps). */
  quiet?: boolean;
  /** Where a FREE RIDE (`mode: "free"`) starts, a plan point on the map
   * (`freeSpawn` holds it inside the edge and out of the trees); the start
   * line's first slot when left out. Ignored by every other mode, which
   * starts on the line. */
  spawn?: { x: number; z: number };
  /** THE SNOW DIAL (`SNOW_DIAL`): the powder's sink as a multiple of the
   * ordinary snow's. 1 when left out. */
  snowDepth?: number;
  /** New snow already lying when the run is stood up, m (`GameState.fresh`)
   * — a lab's or a test's; 0 when left out. */
  fresh?: number;
  /** The day to ride the map on instead of the one R15 dealt: an hour of
   * solar time or a named time of day (`hourOfTime`), and a day of the
   * year, any of them (`withDay`). */
  day?: { hour?: number | null; dayOfYear?: number | null; time?: TimeOfDay | null };
  /** Ride the map under this sky instead of the one R19 dealt it
   * (`withSky`). Applied AFTER `day`: the day owns the date and the
   * daylight hour a skier picks; `sky.hour` is a lab's or a link's, never
   * held to daylight, and wins over `day.hour` when both are given — so a
   * race can be stood in the dark. The map itself — the ground, the loop,
   * the trees — is the seed's either way; what the physics feels of a sky
   * is only the new snow a fall lays over the run (`snowfall.ts`). */
  sky?: SkyOverride;
};

/** The rules a run is dealt from what it asked for. */
export function rulesFor(options: CreateGameOptions, level: Level): RunRules {
  const base = MODE_RULES[options.mode ?? "race"](options.laps ?? level.laps);
  return {
    rivals: options.rivals ?? base.rivals,
    laps: base.laps,
    countdown: options.countdown ?? base.countdown,
    contact: options.contact ?? base.contact,
    course: base.course,
    tricks: base.tricks,
    limit: base.limit,
    airGravity: base.airGravity,
  };
}

export function createGame(options: CreateGameOptions = {}): GameState {
  // A tricks run is ridden on the seed's map with its trick field laid (R20).
  const built =
    options.level ??
    generateLevel(options.seed ?? 1, {
      tricks: options.mode === "tricks",
      region: options.region,
      grade: options.grade,
    });
  const dayed = options.day ? withDay(built, options.day) : built;
  const level = options.sky ? withSky(dayed, options.sky) : dayed;
  const seed = options.seed ?? level.seed;
  const rules = rulesFor(options, level);
  const state: GameState = {
    seed,
    rng: createRng(seed),
    t: 0,
    tick: 0,
    level,
    skier: freshSkier(options.spec ?? SKIS),
    input: { ...NEUTRAL_INPUT },
    progress: freshProgress(level),
    rules,
    assist: { ...(options.assist ?? FULL_ASSIST) },
    damage: options.damage ?? false,
    snowDepth: clampSnowDepth(options.snowDepth),
    fresh: Math.max(0, options.fresh ?? 0),
    rivals: [],
    tricks: freshTricks(),
    countdown: rules.countdown,
    phase: rules.countdown > 0 ? "countdown" : "racing",
    events: [],
  };
  const at =
    options.mode === "free" && options.spawn
      ? freeSpawn(level, options.spawn.x, options.spawn.z)
      : gridSlot(state, 0);
  standSkier(state, at.x, at.z, at.heading);
  if (rules.rivals > 0) createRivals(state, rules.rivals);
  if (!options.quiet) {
    status(
      `Map ${level.seed}: ${level.checkpoints.length} gates over ${Math.round(
        level.track.length,
      )} m of piste, ${level.trees.length} trees, ${rules.rivals} rivals`,
    );
  }
  return state;
}

/** Advance the run by exactly one fixed step. */
export function step(state: GameState, input: SkierInput): GameState {
  const events = state.events;
  events.length = 0;
  state.t += TUNING.dt;
  state.tick += 1;
  state.input.steer = input.steer;
  state.input.tuck = input.tuck;
  state.input.brake = input.brake;
  state.input.lean = input.lean;
  state.input.reset = input.reset;
  // THE NEW SNOW the fall lays this step, grid or no grid.
  state.fresh += freshStep(state.level, state.t, TUNING.dt);

  // THE LIGHTS: each one as it begins, then GO on the step the count runs
  // out — the first step the skier is let go.
  if (state.phase === "countdown") {
    const was = state.countdown;
    state.countdown = Math.max(0, was - TUNING.dt);
    if (was === state.rules.countdown || Math.ceil(state.countdown) < Math.ceil(was)) {
      if (state.countdown > 0)
        events.push({ kind: "count", t: state.t, left: Math.ceil(state.countdown) });
    }
    if (state.countdown <= 0) {
      state.phase = "racing";
      events.push({ kind: "go", t: state.t });
    }
  }

  stepRun(state, input, events);
  // THE SCORE is the player's, kept on every run (`tricks.ts`).
  stepTricks(state, events);
  stepRivals(state);
  if (state.rules.contact) clipRiders(state, events);
  return state;
}

/** The race's field size, for a caller that wants to say so. */
export const FIELD_SIZE = RACE.rivals + 1;
