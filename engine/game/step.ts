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
// grimbear, on a free ride he was dealt to (`grimbear.ts`), and the
// avalanches, on one that asked for them (`avalanche.ts`).

import { drySummer, summerOf } from "./summer.ts";
import { setBikePark } from "../mapgen/bike-park.ts";
import { nearestBikeHead } from "../mapgen/bike-park-query.ts";
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
  setHalfpipe,
  setMoguls,
  setAerials,
  setSkiJump,
  setSlopestyle,
  releaseResort,
  withDay,
  withPlace,
  realFacePlace,
  withFront,
  withSky,
} from "../mapgen/index.ts";
import type { RunGrade } from "../mapgen/grades.ts";
import type { SkiJumpHillId } from "../mapgen/trick-rules.ts";
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
  showcaseRules,
  skiCrossHeatRules,
  clampResilience,
  clampSnowDepth,
  SNOW_DIAL,
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
import { freshSlopestyle, type SlopeContest } from "./slopestyle-contest.ts";
import { freshHalfpipe, type PipeContest } from "./halfpipe-contest.ts";
import { freshMoguls, type MogulsContest } from "./moguls-contest.ts";
import { freshAerials, type AerialsContest } from "./aerials-contest.ts";
import { freshAerial } from "./aerial-flight.ts";
import { freshJump, seatOnBar } from "./jump-inrun.ts";
import { skiJumpSetup, type SkiJumpContest } from "./ski-jump-contest.ts";
import { AERIALS } from "./defs/aerials.ts";
import { SKI_JUMP } from "./defs/ski-jump.ts";
import { isAerialCode, kickerOf } from "./defs/aerial-jumps.ts";
import { freshTurns, stepMogulTurns } from "./mogul-turns.ts";
import { createHeat, crossCountdown, stepDrafts } from "./cross-heat.ts";
import { freshGatePoles } from "./gate-poles.ts";
import { clipCrowd, createCrowd, stepCrowd } from "./crowd.ts";
import { dealEnthusiasts, nightOver, stepEnthusiasts } from "./enthusiasts.ts";
import { ENTHUSIASTS } from "./defs/enthusiasts.ts";
import { arriveByLift, freeRunOf } from "./lift-ride.ts";
import { freshGrimbear, stepGrimbear, type GrimbearAsk } from "./grimbear.ts";
import { freshWild, stepWild } from "./beast-hit.ts";
import { freshAvalanche, stepAvalanche } from "./avalanche.ts";
import { freshMishaps, type MishapAsk } from "./mishaps.ts";
import { freshGroomers, groomersOut, type GroomerAsk } from "./groomer.ts";
import { machineSnowOf, snowGunsRun } from "./snow-guns.ts";
import { freshHeli, startAgain } from "./heli.ts";
import { freshSled, startSled } from "./sled.ts";
import { freshBikeRide, startBike } from "./bike.ts";
import { startPara } from "./para.ts";
import { startBalloon } from "./balloon.ts";
import { freshPlane, startPlane } from "./plane.ts";
import { skydiveAt } from "./chute.ts";
import { standOnExit } from "./wingsuit-start.ts";
import { jumpSpotOf } from "./plane-pilot.ts";
import { juryDay } from "./jury.ts";
import { wellShareOf, withWells } from "./tree-well.ts";
import { bedrockOf, withRock } from "./rock-ground.ts";
import { stepRun } from "./run.ts";
import { noteMachine, onMachine } from "./machine-grace.ts";
import { enterLodge, freshAfterski, lodgesOf } from "./afterski.ts";
import { feelBumps, markFall } from "./body.ts";
import { freshGore } from "./gore-state.ts";
import { copyCall, type RescueCall } from "./rescue-call.ts";
import { freshSkier } from "./skier.ts";
import { freshStep } from "./snowfall.ts";
import { pisteDayOf } from "./piste-day.ts";
import { freshTricks, stepTricks } from "./tricks.ts";
import { NEUTRAL_INPUT, type GameState, type SkierInput } from "./state.ts";

export type CreateGameOptions = {
  /** The map's seed; ignored for the map when `level` is given, but still
   * the run's own random stream. Defaults to the level's seed, or 1. */
  seed?: number;
  /** A map to ride instead of the one the seed generates (tests, labs, and
   * a map built apart by `levelFor`). */
  level?: Level;
  /** Told how far the generator has got building the seed's map, 0–1
   * (`GenerateOptions.progress`). Never called when `level` is given. */
  progress?: (share: number) => void;
  /** Build ONE attempt of the map's search alone (`GenerateOptions.only`),
   * throwing its refusal — a host running the attempts side by side. */
  only?: number;
  /** HOW THE SKIER WORKS THE SKI (`technique.ts`), over the mode's own —
   * so a lab can ski one course with every technique. */
  technique?: TechniqueId;
  /** The kind of snow country the seed's map is built in (R21); the boreal
   * when left out. Ignored when `level` is given. */
  region?: RegionId;
  /** The REAL FACE the seed's resort is raised on (R25, `real-face.ts`):
   * its region the face's own. A dealt massif when left out. Ignored when
   * `level` is given. */
  face?: string;
  /** The piste grade the seed's map is built to (R23); the one the seed
   * deals when left out — ORANGE (R42) the hardest piste's, and a free
   * ride by lift up to the map's ski route. Ignored when `level` is given. */
  grade?: RunGrade;
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
  /** A SLOPESTYLE CONTEST so far (R38, `slopestyle-contest.ts`): the runs
   * the player has skied, carried between the runs of one contest — a
   * fresh one off the seed when a slopestyle run leaves it out. */
  slopestyle?: SlopeContest;
  /** A HALFPIPE CONTEST so far (R39, `halfpipe-contest.ts`), as a
   * slopestyle's. */
  halfpipe?: PipeContest;
  /** A MOGULS CONTEST so far (R40, `moguls-contest.ts`), as a halfpipe's. */
  moguls?: MogulsContest;
  /** AN AERIALS CONTEST so far (R41, `aerials-contest.ts`): the jumps
   * scored and the one DECLARED next (`AerialsContest.plan`) — a fresh one
   * off the seed when an aerials run leaves it out. */
  aerials?: AerialsContest;
  /** THE JUMP DECLARED for an aerials run, over the contest's: a code of
   * the DD chart (`defs/aerial-jumps.ts`); its kicker is built (R41). */
  plan?: string;
  /** THE SKI JUMPING HILL a ski jump is jumped on (R43): the large hill
   * when left out. */
  hill?: SkiJumpHillId;
  /** A SKI JUMPING CONTEST so far (R43, `ski-jump-contest.ts`): the
   * jumps the player has taken. The run jumps his next — from the gate the
   * jury has for him, in the hill's air at his moment of the contest's day
   * (`skiJumpSetup`). A jump with no contest is jumped from the calm-air
   * jury gate in the map's own hill's air, and scored by nobody. */
  skiJumpContest?: SkiJumpContest;
  /** THE GATE a ski jumper sits on (an index into `Level.skiJump.gates`, 0
   * the lowest): the jury's — the lowest that brings him to the edge at
   * the hill's design speed in calm air — when left out. */
  gate?: number;
  /** A DOWNHILL'S TRAINING RUN (R32): the course and the rules the race's,
   * the board the field's training times — slower and further apart than
   * a race's, and counted for nothing. The race when left out. */
  training?: boolean;
  /** How many rivals stand on the start line (`RACE.rivals` when left out;
   * 0 is a solo run — what the sim and the labs ski). */
  rivals?: number;
  /** THE SHOWCASE (`showcaseRules`): the menu's backdrop run, the whole
   * mountain the daring bot's to roam and trick on, nobody else out — its
   * TAKE, how many times it has been stood up on this map before
   * (`GameState.showcase`). Read only when no `mode` is asked; the field on
   * the start line when left out. */
  showcase?: number;
  /** Runs to the finish; the level's own (one) when left out. */
  laps?: number;
  /** Seconds of lights before GO (`RACE.countdown`; 0 for none). */
  countdown?: number;
  /** Whether skiers lean on each other. */
  contact?: boolean;
  /** How many amateurs are out on the ski area (`crowd.ts`); the mode's
   * own when left out — the free ride's crowd, nobody on any other. */
  crowd?: number;
  /** How many ENTHUSIASTS are out on a free ride (`enthusiasts.ts`):
   * `ENTHUSIASTS.count` after dark with the crowd left to the hour, none
   * otherwise, when left out. */
  enthusiasts?: number;
  /** The skis; the all-mountain pair when left out. */
  spec?: SkiSpec;
  /** The arcade's help for the player's own skiing (`Assist`); every hand on
   * when left out. The field rides with every hand on whatever this says. */
  assist?: Assist;
  /** Whether blows dull the player's edges (`damage.ts`); off when left
   * out. */
  damage?: boolean;
  /** Whether the player's run is MORTAL (`gore.ts`): a blow past what a
   * body survives tears a limb off, opens him or kills him, a body thrown
   * onto a tree's top is run through, and a mortal wound is never stood
   * back up — the app's to end. Off when left out, and then nothing of it
   * runs: the INJURIES switch's (`settings.ts`). */
  gore?: boolean;
  /** THE AIR AMBULANCES still on the mountain from earlier runs that ended
   * injured (`rescue-call.ts`): their landed machines are solid to this
   * run's skier. The app's (`rescue-book.ts`); none when left out. */
  rescue?: RescueCall[];
  /** SAFE FOR WORK (`RunRules.sfw`): no collisions between skiers, no
   * afterski, no grimbear, a helicopter and a balloon that cannot crash or
   * burn. The app asks for it when the INJURIES switch is off. Off when left out. */
  sfw?: boolean;
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
  /** THE PLAYER'S CHAIRS LEFT ONLY BY HAND (`chair-hands.ts`): sat on until
   * forward is pressed with the safety bar up — stood up over the unload,
   * thrown off anywhere else — and ridden round and back down untouched.
   * Left out, a chair stands him up at the top as ever. */
  chairHands?: boolean;
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
  /** A FREE RIDE begun IN A HOT AIR BALLOON (`balloon.ts`): stood in its
   * basket on the valley floor, the envelope inflated over him and held on
   * its tether. Wins over every other start but the lodge's. Ignored by
   * every mode but the free ride. */
  balloon?: boolean;
  /** A FREE RIDE begun IN THE DOOR OF THE JUMP PLANE (`plane.ts`): crouched
   * on his skis in its open door on its strip below the town, the engine
   * running, the controls the plane's. Wins over `byLift`, `spawn`, the
   * helicopter and the snowmobile (never over the balloon or the
   * paramotor). Ignored by every mode but the free ride. */
  plane?: boolean;
  /** A FREE RIDE begun IN FREEFALL (`chute.ts`'s `skydiveAt`): this many
   * metres over the snow under the plane's jump run, belly to earth, the
   * plane parked on its strip for the restart — a lab's and a test's way in
   * without the climb. Ignored where the balloon, the paramotor or the
   * lodge start, and by every mode but the free ride. */
  chute?: number;
  /** A FREE RIDE IN A WINGSUIT (`wingsuit.ts`): every jump of it in the
   * suit over a one-canopy BASE rig, NO SKIS on — up a craft with it
   * (`plane` crouched in its door, `heli` on its skid, `balloon` in its
   * basket, `para` under its wing), every way off it the suit's start arc
   * (`chute.ts`'s `craftFreefall`); with `chute`, flying the suit's glide
   * that high; else STOOD ON THE CLIFF EXIT high on the mountain
   * (`wingsuitExitOf`), facing out over the drop, the press the jump.
   * Ignored where the lodge starts, and by every mode but the free ride. */
  wingsuit?: boolean;
  /** A FREE RIDE begun INSIDE the valley's afterski lodge (`afterski.ts`),
   * the party under way and his skis in the rack. Wins over every other
   * start. Ignored by every mode without lodges. */
  inLodge?: boolean;
  /** The BUZZ he starts with, 0..1 (`buzz.ts`) — as though he had been to
   * the afterski already. Left out, sober. */
  buzz?: number;
  /** The run of the ski area (R27, `Run.id`) a free ride by lift starts
   * down (`freeRunOf`) — or, by neither lift nor spot, the piste whose HEAD
   * it is stood at (`pisteHead`: the restart's top of the slope); ignored
   * with a `spawn`. */
  run?: string;
  /** THE SNOW DIAL (`SNOW_DIAL`): the powder's sink as a multiple of the
   * ordinary snow's. 1 when left out. */
  snowDepth?: number;
  /** THE SUMMER SEASON (`summer.ts`): the mountain in midsummer, its snow
   * gone, its sky never snowing, its drags stopped and no machine, gun,
   * avalanche or crowd of skiers on it. A free ride's alone. */
  summer?: boolean;
  /** A SUMMER FREE RIDE begun ON THE DOWNHILL BIKE (`bike.ts`): at rest on
   * the head of the bike park's trail `bikeTrail` (else its easiest), the
   * rider on it. Ignored off a summer free ride, and where an aircraft or
   * the lodge starts it. */
  bike?: boolean;
  bikeTrail?: string;
  /** New snow already lying when the run is stood up, m (`GameState.fresh`)
   * — a lab's or a test's; when left out, the loose snow the day has left
   * on the runs (`piste`), or 0. */
  fresh?: number;
  /** THE PISTE THROUGH THE DAY (`piste-day.ts`, `GameState.piste`): deal
   * the runs as the map's hour and sky have left them since the night's
   * grooming. Left out, a run whose rules have the ski area's machines
   * (`RunRules.groomer` — the free ride) is dealt it and every other is
   * not. */
  piste?: boolean;
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
   * him to one ride in a few. Ignored by every other mode and SAFE FOR
   * WORK. */
  grimbear?: GrimbearAsk;
  /** THINGS THAT GO WRONG ON THEIR OWN (`mishaps.ts`) on a FREE RIDE: a
   * canopy's malfunctions, an engine's stoppage — how often, and the app's
   * salt. None when left out. Ignored by every other mode. */
  mishaps?: MishapAsk;
  /** THE PISTE MACHINES (`groomer.ts`) on a FREE RIDE: out after dark
   * (`night`, the app's ask), whatever the hour (`on`), or never (`off`).
   * None when left out. Ignored by every other mode. */
  groomer?: GroomerAsk;
  /** THE AVALANCHES (`avalanche.ts`) on a FREE RIDE: its loaded slopes off
   * the groomed runs may slide under the skier. None when left out.
   * Ignored by every other mode. */
  avalanche?: boolean;
  /** THE WEATHER OVER THE RUN (`mapgen/front.ts`) on a FREE RIDE: the
   * dealt sky (or the one picked) turning into others over the sky's clock.
   * The dealt sky holds when left out. Ignored by every other mode and in
   * summer. */
  front?: boolean;
};

/** The ski-cross heat a run asks for: named, or its bracket's next. */
function crossOf(options: CreateGameOptions): CrossHeat | undefined {
  return options.cross ?? (options.bracket ? (nextHeat(options.bracket) ?? undefined) : undefined);
}

/** The jump an aerials run declares: the one asked for, the contest's
 * next, or the default — always a jump of the chart. */
function planOf(options: CreateGameOptions): string {
  const asked = options.plan ?? options.aerials?.plan;
  return isAerialCode(asked) ? asked : AERIALS.plan;
}

/** The rules a run is dealt from what it asked for. */
export function rulesFor(options: CreateGameOptions, level: Level): RunRules {
  const laps = options.laps ?? level.laps;
  // IN SUMMER no skier, machine, gun or slab is out on the snow (`summer.ts`).
  const summer = summerOf(options);
  const cross = crossOf(options);
  const base =
    options.mode === "skiCross" && cross
      ? skiCrossHeatRules(laps, crossCountdown(options.seed ?? level.seed, cross))
      : options.mode
        ? MODE_RULES[options.mode](laps)
        : options.showcase !== undefined
          ? showcaseRules(laps)
          : fieldRules(laps);
  return {
    rivals: options.rivals ?? base.rivals,
    laps: base.laps,
    countdown: options.countdown ?? base.countdown,
    // SAFE FOR WORK: nobody shoulders anybody.
    contact: options.sfw ? false : (options.contact ?? base.contact),
    course: base.course,
    tricks: base.tricks,
    stunts: base.stunts,
    ...(base.revert ? { revert: true } : {}),
    limit: base.limit,
    airGravity: base.airGravity,
    // AFTER DARK the crowd has gone in (`enthusiasts.ts`); asked for, it
    // is out whatever the hour.
    crowd: summer
      ? 0
      : Math.max(0, Math.round(options.crowd ?? (nightOver(level) ? 0 : base.crowd))),
    lifts: base.lifts,
    heli: base.heli,
    sled: summer ? false : base.sled,
    afterski: options.sfw ? false : base.afterski,
    ...(base.doors ? { doors: true } : {}),
    // ...and its lifts' ropes ground (`cable.ts`): the free ride's alone.
    ...(base.cables ? { cables: true } : {}),
    groomer: summer ? false : base.groomer,
    // THE VILLAGE'S TRAFFIC met (`traffic-contact.ts`): the free ride's alone.
    ...(base.traffic ? { traffic: true } : {}),
    // ...and its skis off in the village (`town.ts`): the free ride's alone.
    ...(base.town ? { town: true } : {}),
    // ...and its fires ridden into (`fire-burn.ts`): the same.
    ...(base.fires ? { fires: true } : {}),
    // ...and its slopes' avalanches (`avalanche.ts`): the free ride's alone,
    // and only when asked for.
    ...(base.avalanche && options.avalanche && !summer ? { avalanche: true } : {}),
    // ...and its weather moving over the ride (`front.ts`): the same.
    ...(base.front && options.front && !summer ? { front: true } : {}),
    // ...and its edges held at speed (`speedHoldOf`): the free ride's alone.
    ...(base.freeCarve ? { freeCarve: true } : {}),
    start: base.start,
    dealt: base.dealt,
    knock: base.knock,
    gates: base.gates,
    window: base.window,
    // A BOARD is ridden as a board whatever the run (`BOARD_TECHNIQUE`).
    technique: options.spec?.board ? "board" : (options.technique ?? base.technique),
    jury: base.jury,
    spinMost: base.spinMost,
    flipMost: base.flipMost,
    inRun: base.inRun,
    ...(options.sfw ? { sfw: true } : {}),
    aerials: base.aerials,
    ...(base.skiJump ? { skiJump: true } : {}),
    hockeyStop: base.hockeyStop,
  };
}

/** THE MAP A RUN IS SKIED ON, before any course is set over it: `level`
 * where one is given, else the seed's — a tricks run's with its park, a
 * slalom's built to a red, a speed race's on the ski area's course it is
 * raced on. The whole of what `createGame` asks of the generator, so a page
 * can pay for it apart from the run (on a worker, with `progress` told how
 * far the search has got) and hand the map back in as `level`. */
export function levelFor(options: CreateGameOptions = {}): Level {
  if (options.level) return options.level;
  // A tricks run is ridden on the seed's map with its trick field laid (R20)
  // — a map of one piste (`PARK_VERSION`): a resort (R25) lays no park.
  const tricks = options.mode === "tricks";
  const downhill = options.mode === "downhill";
  const superG = options.mode === "superG";
  const giant = options.mode === "giantSlalom";
  const ask = {
    tricks,
    region: options.region,
    face: options.face,
    // A slalom is never set on an easy hill: a seed of its own is built
    // to a RED piste unless a grade is asked for — a red's steepest
    // pitch (R23) is a slalom hill's 33–45 %, and a black's drops across
    // the piste are what no slalom may cross.
    grade: options.grade ?? (options.mode === "slalom" ? "red" : undefined),
    version: tricks ? PARK_VERSION : undefined,
    progress: options.progress,
    only: options.only,
  };
  const built = generateLevel(options.seed ?? 1, ask);
  // A DOWNHILL off a seed of its own is raced on the ski area's course with
  // the most vertical (R32) — the same resort, built once (`buildResort`).
  // A SUPER-G the same hill's, its start lowered into its band (R33), and
  // a GIANT SLALOM's into its own (R36); a SKI CROSS on the course a ski
  // cross is built on best (R35).
  const cross = options.mode === "skiCross";
  if ((downhill || superG || giant || cross) && options.grade === undefined) {
    const id = downhill
      ? downhillCourseOf(built)
      : superG
        ? superGCourseOf(built)
        : giant
          ? giantSlalomCourseOf(built)
          : skiCrossCourseOf(built);
    if (id !== null && id !== built.resort?.course) {
      return generateLevel(options.seed ?? 1, { ...ask, course: id });
    }
  }
  return built;
}

export function createGame(options: CreateGameOptions = {}): GameState {
  const downhill = options.mode === "downhill";
  const superG = options.mode === "superG";
  const giant = options.mode === "giantSlalom";
  // (A map handed back off a run is taken under its rock skin, laid again below.)
  const built = bedrockOf(levelFor(options));
  // A run on another mountain lets go of the ski area kept for the last one.
  releaseResort(built.seed);
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
    built.slopestyle?.base ??
    built.halfpipe?.base ??
    built.moguls?.base ??
    built.aerials?.base ??
    built.skiJump?.base ??
    // A SUMMER ride handed back the map it was stood on keeps it whole:
    // under the park lie the day, the place and the dry sky the first ride
    // laid, and unwinding past them builds a copy the renderer never built.
    (summerOf(options) ? undefined : built.bikePark?.base) ??
    built;
  // SPEED SKIING cuts a track of its own down the face (R34): the
  // qualification's, or the final's; a FREESTYLE VENUE builds one of its own (R37).
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
                : options.mode === "slopestyle"
                  ? setSlopestyle(built)
                  : options.mode === "halfpipe"
                    ? setHalfpipe(built)
                    : options.mode === "moguls"
                      ? setMoguls(built)
                      : options.mode === "aerials"
                        ? setAerials(built, kickerOf(planOf(options)))
                        : options.mode === "skiJump"
                          ? setSkiJump(built, options.hill ?? SKI_JUMP.hill)
                          : original;
  // A REAL FACE is skied at its own place on the globe (`withPlace`): its
  // real latitude and longitude, its true north — the sky only; the
  // mountain is the one the seed built.
  // IN SUMMER the ski area is a BIKE PARK (R44, R45): its trails laid over
  // the map off a stream of their own, so the map itself is not moved.
  const parked = summerOf(options) ? setBikePark(course) : course;
  const placed = withPlace(parked, parked.face ? realFacePlace(parked.face) : null);
  const dayed = options.day ? withDay(placed, options.day) : placed;
  const sky = options.sky ? withSky(dayed, options.sky) : dayed;
  const summer = summerOf(options);
  const skied = summer ? drySummer(sky) : sky;
  const rules = rulesFor(options, skied);
  // A RACE is run only in the weather its jury allows (`jury.ts`) — a sky
  // picked by hand included.
  const judged = rules.jury ? juryDay(skied, rules.jury) : skied;
  // THE TREE WELLS the run's powder has left round the trunks
  // (`tree-well.ts`): none at the ordinary snow, where this is the map.
  // ...and THE ROCK on its walls the surface a body meets (`rock-ground.ts`).
  // In SUMMER the dial stands at its least and lays no wells.
  const depth = summer ? SNOW_DIAL.min : clampSnowDepth(options.snowDepth);
  const welled = withRock(withWells(judged, wellShareOf(depth)));
  // THE WEATHER OVER THE RUN (`front.ts`): laid on last, once a map, so a
  // ride started again on the map it built keeps the very same map.
  const level = rules.front ? withFront(welled) : welled;
  const seed = options.seed ?? level.seed;
  // THE PISTE THROUGH THE DAY (`piste-day.ts`): where the ski area's
  // machines work its runs, the runs are as the hour and the sky have left
  // them since the night's pass — and the loose snow on them is the new
  // snow the run starts with.
  const piste = !summer && (options.piste ?? rules.groomer) ? pisteDayOf(level) : undefined;
  const state: GameState = {
    seed,
    rng: createRng(seed),
    t: 0,
    tick: 0,
    level,
    skier: {
      ...freshSkier(options.spec ?? SKIS),
      resilience: clampResilience(options.resilience),
      // A board's rider carries no poles, whatever is asked.
      poles: (options.poles ?? true) && options.spec?.board === undefined,
    },
    input: { ...NEUTRAL_INPUT },
    progress: freshProgress(level),
    rules,
    assist: { ...(options.assist ?? FULL_ASSIST) },
    damage: options.damage ?? false,
    ...(options.gore && !options.sfw ? { gore: freshGore() } : {}),
    ...(options.rescue?.length ? { rescue: options.rescue.map(copyCall) } : {}),
    snowDepth: depth,
    fresh: summer ? 0 : Math.max(0, options.fresh ?? piste?.fresh ?? 0),
    rivals: [],
    tricks: freshTricks(),
    countdown: rules.countdown,
    phase: rules.countdown > 0 ? "countdown" : "racing",
    events: [],
    gatePoles: freshGatePoles(level),
  };
  if (piste) state.piste = piste;
  if (summer) state.summer = true;
  if (options.showcase !== undefined && !options.mode) state.showcase = options.showcase;
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
  if (options.chairHands) state.chairHands = true;
  if (rules.heli) state.heli = freshHeli(state);
  if (rules.sled) state.sled = freshSled(state);
  if (rules.afterski) state.afterski = freshAfterski();
  const balloon = free && options.balloon === true && !options.inLodge;
  const para = free && options.para === true && !balloon;
  const plane = free && options.plane === true && !balloon && !para && !options.inLodge;
  const chute =
    free && options.chute !== undefined && !balloon && !para && !options.inLodge
      ? options.chute
      : -1;
  const wingsuit = free && options.wingsuit === true && !options.inLodge;
  // In the suit up a craft, or — asked for no craft — off its own exit.
  const craft = para || balloon || plane || chute >= 0 || !!(state.heli && options.heli);
  const other = para || balloon || plane || chute >= 0 || (wingsuit && !craft);
  if (state.heli && options.heli && !other) startAgain(state, []);
  if (state.sled && options.sled && !(state.heli && options.heli) && !other) {
    startSled(state, []);
  }
  // THE DOWNHILL BIKE (`bike.ts`): a summer free ride begun on it at its
  // trail head — absent on every other run, so no digest moves.
  const bike =
    summer && options.bike === true && !other && !options.inLodge && !(state.heli && options.heli);
  if (bike) {
    // On the trail asked for, else the one whose head is nearest the spot
    // picked, else the park's easiest.
    const near = options.spawn
      ? nearestBikeHead(state.level, options.spawn.x, options.spawn.z)
      : null;
    state.bike = freshBikeRide(state, options.bikeTrail ?? near);
    startBike(state, []);
  }
  if (wingsuit) state.wingsuit = { from: craft ? "craft" : "cliff" };
  if (para) startPara(state, []);
  if (plane) startPlane(state, []);
  if (balloon) startBalloon(state, []);
  if (chute >= 0) {
    if (!state.plane) state.plane = freshPlane(state);
    const spot = jumpSpotOf(state);
    skydiveAt(state, { x: spot.x, z: spot.z, agl: chute, suit: wingsuit ? "wingsuit" : "box" });
  } else if (wingsuit && !craft) standOnExit(state, []);
  // Up a lift: to the chair whose run passes nearest the spot, or with no
  // spot to the top of the run picked — the one the start card marks —
  // whatever kind of lift serves it.
  const lifted =
    free &&
    options.byLift &&
    !(options.inLodge && state.afterski && lodgesOf(level).length > 0) &&
    !other &&
    !(state.heli && options.heli) &&
    !(state.sled && options.sled) &&
    !bike
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
  if (level.slopestyle) state.slopestyle = options.slopestyle ?? freshSlopestyle(state.seed);
  if (level.halfpipe) state.halfpipe = options.halfpipe ?? freshHalfpipe(state.seed);
  if (level.moguls) {
    state.moguls = options.moguls ?? freshMoguls(state.seed);
    state.mogulTurns = freshTurns();
  }
  if (level.aerials) {
    state.aerials = { ...(options.aerials ?? freshAerials(state.seed)), plan: planOf(options) };
    state.aerial = freshAerial(planOf(options));
  }
  // A SKI JUMP (R43): sat on the bar of his gate.
  if (level.skiJump && rules.skiJump) {
    const contest = options.skiJumpContest;
    const setup = contest ? skiJumpSetup(contest) : null;
    if (contest) state.skiJumpContest = contest;
    state.jump = freshJump(state, options.gate ?? setup?.gate, setup?.air);
    seatOnBar(state);
  }
  if (rules.crowd > 0) createCrowd(state, rules.crowd);
  // ...and the few keen skiers still lapping the lit runs instead.
  const keen =
    options.enthusiasts ??
    (free && options.crowd === undefined && nightOver(level) && !summer ? ENTHUSIASTS.count : 0);
  if (free && keen > 0) dealEnthusiasts(state, keen);
  // SAFE FOR WORK the woods are empty: no grimbear, whatever is asked.
  if (free && options.grimbear && !options.sfw)
    state.grimbear = freshGrimbear(seed, options.grimbear);
  // THE WILDLIFE AS BODIES (`beast-hit.ts`): a free ride's animals put up
  // by the player and met by him — safe for work too, where nothing dies.
  if (free) state.wild = freshWild();
  // THE AVALANCHES (`avalanche.ts`), on a free ride that asked for them.
  if (rules.avalanche) state.avalanche = freshAvalanche(state);
  if (free && options.mishaps) state.mishaps = freshMishaps(seed, options.mishaps);
  // THE PISTE MACHINES (`groomer.ts`), out working the runs after dark.
  if (free && rules.groomer && groomersOut(level, options.groomer)) {
    state.groomers = freshGroomers(state);
  }
  // THE SNOW GUNS (`snow-guns.ts`), running in a thin season's cold.
  if (free && rules.groomer && snowGunsRun(level)) state.machineSnow = machineSnowOf(level);
  // A run begun with a buzz, or inside the valley's lodge.
  if (options.buzz) state.skier.buzz = Math.max(0, Math.min(1, options.buzz));
  const lodge = free && options.inLodge && state.afterski ? lodgesOf(level)[0] : undefined;
  if (lodge) enterLodge(state, lodge, []);
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
  // THE GRACE after stepping off a machine (`machine-grace.ts`).
  const aboard = onMachine(state);
  stepRun(state, input, events, true);
  noteMachine(state, aboard);
  // THE SCORE is the player's, kept on every run (`tricks.ts`).
  stepTricks(state, events);
  // A MOGULS RUN'S TURNS as the judges watch them (`mogul-turns.ts`).
  if (state.mogulTurns) stepMogulTurns(state, TUNING.dt);
  stepRivals(state);
  stepEnthusiasts(state);
  if (state.rules.contact) clipRiders(state, events);
  // THE CROWD (`crowd.ts`), on a run that has one.
  if (state.crowd) {
    stepCrowd(state);
    if (state.rules.contact) clipCrowd(state, events);
  }
  // THE GRIMBEAR (`grimbear.ts`), on a free ride he was dealt to.
  if (state.grimbear) stepGrimbear(state, events);
  // THE WILDLIFE (`beast-hit.ts`): the groups he puts up.
  if (state.wild) stepWild(state);
  // THE AVALANCHES (`avalanche.ts`), on a free ride that asked for them.
  if (state.avalanche) stepAvalanche(state, events, input);
  // THE BODY (`body.ts`): what a shoulder into a rival or an amateur did.
  if (state.rules.contact) feelBumps(state, events);
  // THE G METER bills a blow only once someone went down on it.
  markFall(state);
  return state;
}

/** The race's field size, for a caller that wants to say so. */
export const FIELD_SIZE = RACE.rivals + 1;
