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
// against every other; then the crowd on a free ride (`crowd.ts`) — its
// amateurs down their runs, and the player against them — and the
// grimbear, on a free ride he was dealt to (`grimbear.ts`).

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import {
  PARK_VERSION,
  downhillCourseOf,
  superGCourseOf,
  giantSlalomCourseOf,
  setGiantSlalom,
  skiCrossCourseOf,
  setSuperG,
  generateLevel,
  setDownhill,
  setSkiCross,
  setSpeedSki,
  setSlalom,
  setBigAir,
  setKnuckleHuck,
  setRailJam,
  setHalfpipe,
  setSlopestyle,
  withDay,
  withSky,
} from "../mapgen/index.ts";
import type { PisteGrade } from "../mapgen/grades.ts";
import type { RegionId } from "../mapgen/regions.ts";
import type { TimeOfDay } from "../mapgen/sun.ts";
import type { Level, SkyOverride } from "../mapgen/types.ts";
import { status } from "@niclaslindstedt/oss-game-framework/core/output";
import { freeSpawn, freshProgress, standSkier } from "./course.ts";
import { nearestPiste, noteRun, pisteHead } from "./skied.ts";
import {
  FULL_ASSIST,
  MODE_RULES,
  RACE,
  fieldRules,
  skiCrossHeatRules,
  clampResilience,
  clampSnowDepth,
  type Assist,
  type GameMode,
  type RunRules,
} from "./defs/modes.ts";
import { SKIS, type SkiSpec } from "./defs/skis.ts";
import type { TechniqueId } from "./defs/technique.ts";
import { TUNING } from "./defs/tuning.ts";
import { clipRiders, createRivals, gridSlot, stepRivals } from "./rivals.ts";
import { createField, type Heat } from "./field.ts";
import { nextHeat, type Bracket, type CrossHeat } from "./cross-bracket.ts";
import { freshBigAir, type BigAirContest } from "./big-air-contest.ts";
import { freshJam, stepJam } from "./jam.ts";
import { freshSlopestyle, type SlopeContest } from "./slopestyle-contest.ts";
import { freshHalfpipe, type PipeContest } from "./halfpipe-contest.ts";
import { createHeat, crossCountdown, stepDrafts } from "./cross-heat.ts";
import { freshGatePoles } from "./gate-poles.ts";
import { clipCrowd, createCrowd, stepCrowd } from "./crowd.ts";
import { arriveByLift, freeRunOf } from "./lift-ride.ts";
import { freshGrimbear, stepGrimbear, type GrimbearAsk } from "./grimbear.ts";
import { freshHeli, startAgain } from "./heli.ts";
import { freshSled, startSled } from "./sled.ts";
import { startPara } from "./para.ts";
import { juryDay } from "./jury.ts";
import { stepRun } from "./run.ts";
import { freshAfterski } from "./afterski.ts";
import { feelBumps, markFall } from "./body.ts";
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
  /** HOW THE SKIER WORKS THE SKI (`technique.ts`), over the mode's own —
   * so a lab can ski one course with every technique. */
  technique?: TechniqueId;
  /** The kind of snow country the seed's map is built in (R21); the boreal
   * when left out. Ignored when `level` is given. */
  region?: RegionId;
  /** The piste grade the seed's map is built to (R23); the one the seed
   * deals when left out. Ignored when `level` is given. */
  grade?: PisteGrade;
  /** The mode whose rules the run is dealt (`MODE_RULES`); the field on
   * the start line (`fieldRules`) when left out. Each option below still
   * overrides its own rule. */
  mode?: GameMode;
  /** A SLALOM's SECOND RUN (`field.ts`): the first run carried in — the
   * course set afresh (R31), only the first run's finishers starting, the
   * standings on combined time. The first run when left out. On SPEED
   * SKIING the FINAL (R34): the qualification carried in, its best
   * starting from the top of the track, the standings the final's speed. */
  heat?: Heat;
  /** A SKI-CROSS HEAT (R35, `cross-bracket.ts`): its round and its four
   * racers in seed order, the player among them — raced four abreast out
   * of the start gate under the heat's rules. The QUALIFICATION, one timed
   * run alone against the start list's board, when left out. */
  cross?: CrossHeat;
  /** THE SKI CROSS SO FAR (R35, `cross-bracket.ts`): the qualification
   * ranked and every heat raced before this run — carried between the runs
   * of one race, its heat the player's next (`nextHeat`) where `cross` asks
   * for none. The engine never reads it otherwise. */
  bracket?: Bracket;
  /** A BIG AIR CONTEST so far (R37, `big-air-contest.ts`): the jumps the
   * player has taken, carried between the runs of one contest — a fresh
   * one off the seed when a big air run leaves it out. */
  bigAir?: BigAirContest;
  /** A SLOPESTYLE CONTEST so far (R39, `slopestyle-contest.ts`): the runs
   * the player has skied, carried between the runs of one contest — a
   * fresh one off the seed when a slopestyle run leaves it out. */
  slopestyle?: SlopeContest;
  /** A HALFPIPE CONTEST so far (R41, `halfpipe-contest.ts`), as a
   * slopestyle's. */
  halfpipe?: PipeContest;
  /** A DOWNHILL'S TRAINING RUN (R32): the course and the rules the race's,
   * the board the field's training times — slower and further apart than
   * a race's, and counted for nothing. The race when left out. */
  training?: boolean;
  /** How many rivals stand on the start line (`RACE.rivals` when left out;
   * 0 is a solo run — what the sim and the labs ski). */
  rivals?: number;
  /** Runs to the finish; the level's own (one) when left out. */
  laps?: number;
  /** Seconds of lights before GO (`RACE.countdown`; 0 for none). */
  countdown?: number;
  /** Whether skiers lean on each other. */
  contact?: boolean;
  /** How many amateurs are out on the ski area (`crowd.ts`); the mode's
   * own when left out — the free ride's crowd, nobody on any other. */
  crowd?: number;
  /** The skis; the all-mountain pair when left out. */
  spec?: SkiSpec;
  /** The arcade's help for the player's own skiing (`Assist`); every hand on
   * when left out. The field rides with every hand on whatever this says. */
  assist?: Assist;
  /** Whether blows dull the player's edges (`damage.ts`); off when left
   * out. */
  damage?: boolean;
  /** How much the player can take before he goes down, 0 a club skier …
   * 1 a professional (`SkierState.resilience`); 1 when left out. The
   * field's is its own, dealt at the start line. */
  resilience?: number;
  /** Whether the player skis with his poles (`SkierState.poles`); with
   * them when left out. Going without is the hard mode — every rival has
   * his. */
  poles?: boolean;
  /** Build without announcing the map (the sim's sweeps). */
  quiet?: boolean;
  /** Where a FREE RIDE (`mode: "free"`) starts, a plan point on the map
   * (`freeSpawn` holds it inside the edge and out of the trees); the start
   * line's first slot when left out. Ignored by every other mode, which
   * starts on the line. */
  spawn?: { x: number; z: number };
  /** A FREE RIDE begun ON A LIFT (`arriveByLift`): carried up the lift to
   * the top of the run `freeRunOf` reads off `run` and `grade` (the run
   * named, else the first of the colour asked, else the course's first —
   * on whatever lift serves it), or, with a `spawn`, seated on the chair whose
   * run passes nearest it, and led off the top toward that run. A map with
   * no lift to ride starts at `spawn` as ever. Ignored by every other mode
   * (the app asks for it only without a spot: a spot picked is where the
   * ride starts). */
  byLift?: boolean;
  /** A FREE RIDE begun ON THE HELICOPTER (`heli.ts`): sat on its skid on
   * its pad on the valley floor, the rotor turning, the controls the
   * helicopter's. Wins over `byLift` and `spawn`. Ignored by every mode
   * without a helicopter. */
  heli?: boolean;
  /** A FREE RIDE begun ON THE SNOWMOBILE (`sled.ts`): stood on its boards
   * on its spot at the bottom, the engine running, the controls the
   * sled's. Wins over `byLift` and `spawn` (never over `heli`). Ignored by
   * every mode without a snowmobile. */
  sled?: boolean;
  /** A FREE RIDE begun ON THE SUMMIT UNDER A PARAMOTOR (`para.ts`): stood
   * at the top of the mountain on his skis, the motor on his back and the
   * wing inflated over him. Wins over `byLift`, `spawn` and the machines.
   * Ignored by every mode but the free ride. */
  para?: boolean;
  /** The run of the ski area (R27, `Run.id`) a free ride by lift starts
   * down (`freeRunOf`) — or, by neither lift nor spot, the piste whose HEAD
   * it is stood at (`pisteHead`: the restart's top of the slope); ignored
   * with a `spawn`. */
  run?: string;
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
   * is the new snow a fall lays over the run (`snowfall.ts`) and its wind
   * (`air.ts`). */
  sky?: SkyOverride;
  /** THE GRIMBEAR (`grimbear.ts`) on a FREE RIDE: one that catches the
   * skier once (`hunt`), or one that only chases him (`roam` — a ride
   * started again after he was caught). None when left out; the app deals
   * him to one ride in a few. Ignored by every other mode. */
  grimbear?: GrimbearAsk;
};

/** The ski-cross heat a run asks for: named, or its bracket's next. */
function crossOf(options: CreateGameOptions): CrossHeat | undefined {
  return options.cross ?? (options.bracket ? (nextHeat(options.bracket) ?? undefined) : undefined);
}

/** The rules a run is dealt from what it asked for. */
export function rulesFor(options: CreateGameOptions, level: Level): RunRules {
  const laps = options.laps ?? level.laps;
  const cross = crossOf(options);
  const base =
    options.mode === "skiCross" && cross
      ? skiCrossHeatRules(laps, crossCountdown(options.seed ?? level.seed, cross))
      : options.mode
        ? MODE_RULES[options.mode](laps)
        : fieldRules(laps);
  return {
    rivals: options.rivals ?? base.rivals,
    laps: base.laps,
    countdown: options.countdown ?? base.countdown,
    contact: options.contact ?? base.contact,
    course: base.course,
    tricks: base.tricks,
    stunts: base.stunts,
    limit: base.limit,
    airGravity: base.airGravity,
    crowd: Math.max(0, Math.round(options.crowd ?? base.crowd)),
    lifts: base.lifts,
    heli: base.heli,
    sled: base.sled,
    afterski: base.afterski,
    start: base.start,
    dealt: base.dealt,
    knock: base.knock,
    gates: base.gates,
    window: base.window,
    technique: options.technique ?? base.technique,
    jury: base.jury,
    spinMost: base.spinMost,
    flipMost: base.flipMost,
    jam: base.jam,
    butters: base.butters,
    inRun: base.inRun,
  };
}

export function createGame(options: CreateGameOptions = {}): GameState {
  // A tricks run is ridden on the seed's map with its trick field laid (R20)
  // — a map of one piste (`PARK_VERSION`): a resort (R25) lays no park.
  const tricks = options.mode === "tricks";
  const downhill = options.mode === "downhill";
  const superG = options.mode === "superG";
  const giant = options.mode === "giantSlalom";
  const ask = {
    tricks,
    region: options.region,
    // A slalom is never set on an easy hill: a seed of its own is built
    // to a RED piste unless a grade is asked for — a red's steepest
    // pitch (R23) is a slalom hill's 33–45 %, and a black's drops across
    // the piste are what no slalom may cross.
    grade: options.grade ?? (options.mode === "slalom" ? "red" : undefined),
    version: tricks ? PARK_VERSION : undefined,
  };
  let built = options.level ?? generateLevel(options.seed ?? 1, ask);
  // A DOWNHILL off a seed of its own is raced on the ski area's course with
  // the most vertical (R32) — the same resort, built once (`buildResort`).
  // A SUPER-G the same hill's, its start lowered into its band (R33), and
  // a GIANT SLALOM's into its own (R36); a SKI CROSS on the course a ski
  // cross is built on best (R35).
  const cross = options.mode === "skiCross";
  if ((downhill || superG || giant || cross) && !options.level && options.grade === undefined) {
    const id = downhill
      ? downhillCourseOf(built)
      : superG
        ? superGCourseOf(built)
        : giant
          ? giantSlalomCourseOf(built)
          : skiCrossCourseOf(built);
    if (id !== null && id !== built.resort?.course) {
      built = generateLevel(options.seed ?? 1, { ...ask, course: id });
    }
  }
  // A SLALOM is set over the map (R31) — run one's course, or the second
  // run's — a DOWNHILL down its whole piste (R32), a SUPER-G from its
  // lowered start (R33), a GIANT SLALOM from its own — either run's — (R36),
  // SPEED SKIING down its own track (R34), a SKI CROSS
  // on the course built for it (R35), and any other mode skis the map
  // under any course set over it.
  const original =
    built.slalom?.base ??
    built.downhill?.base ??
    built.superG?.base ??
    built.giantSlalom?.base ??
    built.speedSki?.base ??
    built.skiCross?.base ??
    built.bigAir?.base ??
    built.knuckleHuck?.base ??
    built.slopestyle?.base ??
    built.railJam?.base ??
    built.halfpipe?.base ??
    built;
  // SPEED SKIING cuts a track of its own down the face (R34): the
  // qualification's, or the final's; BIG AIR builds a jump of its own (R37).
  const course =
    options.mode === "slalom"
      ? setSlalom(built, options.heat?.run ?? 1)
      : downhill
        ? setDownhill(built)
        : superG
          ? setSuperG(built)
          : giant
            ? setGiantSlalom(built, options.heat?.run ?? 1)
            : options.mode === "speedSki"
              ? setSpeedSki(built, options.heat?.run ?? 1)
              : options.mode === "skiCross"
                ? setSkiCross(built)
                : options.mode === "bigAir"
                  ? setBigAir(built)
                  : options.mode === "knuckleHuck"
                    ? setKnuckleHuck(built)
                    : options.mode === "slopestyle"
                      ? setSlopestyle(built)
                      : options.mode === "railJam"
                        ? setRailJam(built)
                        : options.mode === "halfpipe"
                          ? setHalfpipe(built)
                          : original;
  const dayed = options.day ? withDay(course, options.day) : course;
  const skied = options.sky ? withSky(dayed, options.sky) : dayed;
  const rules = rulesFor(options, skied);
  // A RACE is run only in the weather its jury allows (`jury.ts`) — a sky
  // picked by hand included.
  const level = rules.jury ? juryDay(skied, rules.jury) : skied;
  const seed = options.seed ?? level.seed;
  const state: GameState = {
    seed,
    rng: createRng(seed),
    t: 0,
    tick: 0,
    level,
    skier: {
      ...freshSkier(options.spec ?? SKIS),
      resilience: clampResilience(options.resilience),
      poles: options.poles ?? true,
    },
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
    gatePoles: freshGatePoles(level),
  };
  const free = options.mode === "free";
  // A FREE RIDE STARTED AGAIN stands at the top of the run named.
  const head =
    free && !options.spawn && !options.byLift && options.run !== undefined
      ? pisteHead(level, options.run)
      : null;
  const at =
    free && options.spawn
      ? freeSpawn(level, options.spawn.x, options.spawn.z)
      : (head ?? gridSlot(state, 0));
  standSkier(state, at.x, at.z, at.heading);
  if (rules.heli) state.heli = freshHeli(state);
  if (rules.sled) state.sled = freshSled(state);
  if (rules.afterski) state.afterski = freshAfterski();
  const para = free && options.para === true;
  if (state.heli && options.heli && !para) startAgain(state, []);
  if (state.sled && options.sled && !(state.heli && options.heli) && !para) startSled(state, []);
  if (para) startPara(state, []);
  // Up a lift: to the chair whose run passes nearest the spot, or with no
  // spot to the top of the run picked — the one the start card marks —
  // whatever kind of lift serves it.
  const lifted =
    free &&
    options.byLift &&
    !para &&
    !(state.heli && options.heli) &&
    !(state.sled && options.sled)
      ? options.spawn
        ? arriveByLift(state, options.spawn.x, options.spawn.z)
        : arriveByLift(
            state,
            level.spawn.x,
            level.spawn.z,
            freeRunOf(level, { run: options.run, grade: options.grade }),
          )
      : null;
  // ...and the run it is stood up on is the first it has skied: the one the
  // lift carries him to the top of, the one he stands at the top of, or the
  // piste nearest where he stands — so a reset before he has skied anything
  // has somewhere to go.
  if (free) {
    const onto = lifted ?? (head ? options.run : undefined);
    noteRun(state, onto ?? nearestPiste(level, state.skier.x, state.skier.z));
  }
  if (rules.rivals > 0) {
    if (rules.start === "interval" || rules.dealt) {
      createField(state, rules.rivals, options.heat, options.training === true);
    } else if (rules.knock && crossOf(options)) createHeat(state, crossOf(options) as CrossHeat);
    else createRivals(state, rules.rivals);
  }
  if (options.bracket) state.bracket = options.bracket;
  if (level.bigAir) state.bigAir = options.bigAir ?? freshBigAir(state.seed);
  if ((level.knuckleHuck || level.railJam) && rules.jam) state.jam = freshJam();
  if (level.slopestyle) state.slopestyle = options.slopestyle ?? freshSlopestyle(state.seed);
  if (level.halfpipe) state.halfpipe = options.halfpipe ?? freshHalfpipe(state.seed);
  if (rules.crowd > 0) createCrowd(state, rules.crowd);
  if (free && options.grimbear) state.grimbear = freshGrimbear(seed, options.grimbear);
  if (!options.quiet) {
    status(
      `Map ${level.seed}: ${level.checkpoints.length} gates over ${Math.round(
        level.track.length,
      )} m of piste, ${level.trees.length} trees, ${rules.rivals} rivals` +
        (rules.crowd > 0 ? `, ${rules.crowd} out skiing` : ""),
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
  state.input.carve = input.carve;
  state.input.jump = input.jump;
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

  // THE DRAFT in a ski-cross heat (`cross-heat.ts`), off where the four are.
  if (state.cross) stepDrafts(state);
  stepRun(state, input, events, true);
  // THE SCORE is the player's, kept on every run (`tricks.ts`).
  stepTricks(state, events);
  // A KNUCKLE HUCK'S JAM (`jam.ts`): a hit over, and back to the platform.
  if (state.jam) stepJam(state, events);
  stepRivals(state);
  if (state.rules.contact) clipRiders(state, events);
  // THE CROWD (`crowd.ts`), on a run that has one.
  if (state.crowd) {
    stepCrowd(state);
    if (state.rules.contact) clipCrowd(state, events);
  }
  // THE GRIMBEAR (`grimbear.ts`), on a free ride he was dealt to.
  if (state.grimbear) stepGrimbear(state, events);
  // THE BODY (`body.ts`): what a shoulder into a rival or an amateur did.
  if (state.rules.contact) feelBumps(state, events);
  // THE G METER bills a blow only once someone went down on it.
  markFall(state);
  return state;
}

/** The race's field size, for a caller that wants to say so. */
export const FIELD_SIZE = RACE.rivals + 1;
