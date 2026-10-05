// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODES, and the rules a run is played by. A mode is a named bundle of
// rules (`MODE_RULES`): a RACE in one of the real disciplines — the SLALOM
// (R31), the field skiing the course one at a time out of the start hut
// under the international rules, two runs on combined time, and the
// DOWNHILL (R32), the whole piste in one run after a training run, and the
// SUPER-G (R33), one run unseen on the downhill's hill from a lower start,
// its gates turning him — the TIME
// TRIAL, the map's piste alone against the clock, the FREE RIDE, the whole
// mountain to explore with no course counted at all, and TRICKS. The rules
// are a plain record on the state (`GameState.rules`) read by every system
// that answers to one, and nothing below the app branches on a mode's
// name. `openRules` is what a measurement skis: no lights and nobody else
// out there, so a simulated run's digest carries the skier and nothing in
// front of him; `fieldRules` what a run that names no mode is dealt — the
// field four abreast on the start line under the lights, the suite's and
// the labs' and the benchmark's run.
//
// THE DISCIPLINES (`DISCIPLINES`) are the races the game names: the slalom,
// the giant slalom, the super-G, the downhill, the ski cross and the speed
// run. The slalom, the super-G and the downhill are BUILT; the others are named so the
// app can bill them as coming, and each becomes a mode — its own rules here
// and its own course rule (R31 onward) — when it is.

import { CROWD } from "./crowd.ts";
import type { TechniqueId } from "./technique.ts";
import type { SkiId } from "./skis.ts";
import { TUNING } from "./tuning.ts";

export type RunRules = {
  /** How many OTHER skiers start beside the player (`rivals.ts`). */
  rivals: number;
  /** Runs to the finish — one: the piste is skied top to bottom. */
  laps: number;
  /** Seconds the lights hold the field before the clock starts; 0 is no
   * lights at all, and the run is racing from its first step. */
  countdown: number;
  /** Whether one skier can lean on another (`rivals.ts`'s `clipRiders`). */
  contact: boolean;
  /** WHETHER THE COURSE COUNTS: the gates and the finish (`course.ts`).
   * Off on a FREE RIDE, where the piste is only a groomed way down the
   * mountain, nothing is owed and a reset stands the skier on the nearest
   * point of it rather than at a gate. */
  course: boolean;
  /** WHETHER THE TRICKS COUNT: the strokes and the trick button are read
   * (`strokes.ts`) and the combo is the run's to work for. The score is
   * kept on every run (`tricks.ts`), but only a run with this on can turn
   * anything. */
  tricks: boolean;
  /** THE BUZZER, s of run clock: the run ends there, whatever it was doing;
   * 0 is no buzzer at all. */
  limit: number;
  /** THE PULL ON A SKIER IN FLIGHT, as a multiple of `TUNING.g`: the arcade's
   * heavier air (`TUNING.air.gravity`) on a race, and the real g on a tricks
   * run, whose strokes and combos are timed to a real hang (`limits.ts`'s
   * `flightGravity`). */
  airGravity: number;
  /** THE CROWD: how many amateurs are out on the ski area (`crowd.ts`) —
   * the free ride's resort full of people; 0 on every measured run, which
   * has the snow to itself. */
  crowd: number;
  /** WHETHER THE LIFTS TAKE HIM UP (`lift-ride.ts`): a skier who rides into
   * a lift's load zone is carried to its top. On a FREE RIDE only — a race
   * is one run down, and a lift ridden would be a run off the course. */
  lifts: boolean;
  /** WHETHER A HELICOPTER WAITS ON ITS PAD (`heli.ts`): ridden into, it is
   * the player's to fly anywhere on the mountain and push off. On a FREE
   * RIDE only. */
  heli: boolean;
  /** WHETHER A SNOWMOBILE WAITS AT THE BOTTOM (`sled.ts`): ridden into, it
   * is the player's to ride anywhere on the mountain and hop off. On a FREE
   * RIDE only. */
  sled: boolean;
  /** HOW THE FIELD STARTS: `"line"` — every skier on the start line at once,
   * the lights, GO; `"interval"` — ONE RACER ON THE COURSE AT A TIME, out of
   * the start hut: the field has skied it before the player, and its times
   * are what he races (`field.ts`). On an interval start the run clock
   * waits for the racer to open the wand. */
  start: "line" | "interval";
  /** THE GATES' LAW: `"arcade"` — a gate skied past is owed again (or, a
   * slalom gate of R28, charged on the clock) and the reset stands him
   * back on the course; `"strict"` — the international rules (R31): a gate
   * missed or straddled DISQUALIFIES, a racer stopped by a fall is out, and
   * he must be away within `window` seconds of GO. */
  gates: "arcade" | "strict";
  /** THE START WINDOW, s after GO: a racer not through the start gate by
   * then is disqualified; 0 is no window. */
  window: number;
  /** HOW THE SKIER WORKS THE SKI (`technique.ts`): the slalom racer's on
   * a slalom, the downhiller's on a downhill, the super-G racer's on a
   * super-G; left out, the free skier's —
   * the shared model as it is. */
  technique?: TechniqueId;
  /** THE JURY'S WEATHER (`jury.ts`): the most wind and the heaviest fall
   * the race is run in. A race's jury holds, lowers or calls off a start
   * the weather makes unsafe or unfair, so a race is only ever run on a
   * day inside its discipline's `JURY` row; left out, the run is skied in
   * whatever the sky deals. */
  jury?: Jury;
};

/** WHAT A RACE'S JURY RUNS IN — the weather a discipline is raced under,
 * stated at the course's START, where the jury's anemometer stands. */
export type Jury = {
  /** The strongest GUST, m/s at the standard 10 m over the start, the race
   * is run in: a mean wind whose gusts would pass it is a race held for a
   * calmer hour, and the race is skied in that calmer wind. */
  wind: number;
  /** The heaviest fall it is run in (`Weather.snowfall`, 0..1): past it the
   * course is unfit to race on — a speed race is not run in a blizzard. */
  fall: number;
};

/** THE JURY, discipline by discipline. The alpine rule book sets NO wind
 * speed: the jury interrupts, lowers the start or calls the race off when
 * the weather makes it unsafe or unfair (the international rules' jury
 * powers and their interruption and termination articles), and lists heavy
 * snowfall and storm among what makes a downhill course unfit on the day.
 * What it does in practice is on the record: top-level speed races have
 * been held, their starts lowered and then called off at gusts of some
 * 65–72 km/h at the top, so the game's jury runs a SPEED race (the
 * downhill, the super-G, the ski cross over its jumps) in gusts under
 * 50 km/h, and a TECHNICAL one (the slalom, the giant slalom — slower,
 * barely off the snow) under 60 km/h. SPEED SKIING is the one discipline
 * with a number in its rules: a run is stopped at 15 km/h of wind at the
 * timing zone (10 km/h where the expected speed is 200 km/h and more, 20
 * km/h for a steady wind straight down the track) — its strictest reading
 * is its row. A slalom is raced in falling snow (its rules have the course
 * crew pack or clear what falls during the race); a speed race is not run
 * in a storm, so its heaviest fall is the top of a steady fall's band
 * (R19's `snow`), and a speed-skiing run, whose racers must see the track
 * to its end, no more than flurries. */
export const JURY: Readonly<Record<Discipline, Jury>> = {
  slalom: { wind: 60 / 3.6, fall: 1 },
  giantSlalom: { wind: 60 / 3.6, fall: 1 },
  superG: { wind: 50 / 3.6, fall: 0.75 },
  downhill: { wind: 50 / 3.6, fall: 0.75 },
  skiCross: { wind: 50 / 3.6, fall: 0.75 },
  speedSki: { wind: 10 / 3.6, fall: 0.3 },
};

/** HOW MUCH HELP THE SKIER IS GIVEN — the arcade's two hands on him, each
 * 0..1 and read, never written, during a run. `yaw` scales the hold that
 * keeps the body on the arc the edges ask for (`TUNING.steer.yawHold` and
 * its kin); `air` scales his body levelling the roll in flight
 * (`TUNING.air.rollLevel`). Neither draws from the stream, so a run replays
 * the same at any setting, and `{ yaw: 0, air: 0 }` is the bare physics. A
 * difficulty setting moves these two numbers and nothing else. */
export type Assist = {
  yaw: number;
  air: number;
};

/** Every hand on: what the field rides, what the sim and the labs ride, and
 * what a run asks for when it names nothing. */
export const FULL_ASSIST: Readonly<Assist> = { yaw: 1, air: 1 };

/** THE FIELD'S NUMBERS — every race's, however it starts. */
export const RACE = {
  /** Three rivals: four on the start line with the player. */
  rivals: 3,
  /** THE LIGHTS, s — three, a second each, then GO. */
  countdown: 3,
  /** The tuck each rival's bot is allowed, dealt off the run's stream once
   * at the start line: what tells one rival from the next. */
  paceBand: { min: 0.8, max: 1 },
  /** HOW MUCH EACH RIVAL CAN TAKE before he goes down
   * (`SkierState.resilience`: 0 a club skier, 1 a professional), dealt
   * once at the start line off a stream of its own — so a field has a
   * rival who rides out what throws another, and dealing it moves nothing
   * else the start deals. */
  resilienceBand: { min: 0.35, max: 1 },
  /** HOW LATE EACH RIVAL GOES, s after GO: the eye's reaction to the
   * lights and the moment a body takes to come off the skid held across the
   * slope — a human's 0.15 s at the sharpest, half a second and more on a
   * slow start. Dealt per rival with the phase his first stride lands on,
   * so a field does not push off on one step and skate out of the gate in
   * step. */
  reactBand: { min: 0.15, max: 0.7 },
  /** THE PAIRS A RIVAL IS DEALT, one off the run's stream: the catalog as
   * the start line was first dealt from — every class but the super-G ski,
   * which joined it later. A pair added to the catalog is not added here,
   * because the field on this line is the suite's, the labs' and the
   * benchmark's race (`benchmark-plan.ts`): a longer list deals every seed a
   * different field, and the benchmark's history and every lab's digests
   * would stop comparing with the runs before it. */
  skis: ["chamois", "swift", "chough", "eagle", "marmot", "hare"] as readonly SkiId[],
  /** HOW ONE SKIER LEANS ON ANOTHER: each is two circles down his skis'
   * length of `radius` m, `offset` m ahead and behind the CoG — the radius
   * is the skier's own half-width with his arms and his poles out, so two
   * are held 1.2 m apart and their bodies never overlap; the share of the
   * closing speed that comes back; and the speed at which the player's own
   * contact is reported, m/s, at most once per `cooldown` s. */
  bump: { radius: 0.6, offset: 0.5, restitution: 0.3, speed: 1.5, cooldown: 0.5 },
} as const;

/** THE FIELD ON THE START LINE: four abreast, the lights, contact on —
 * what a run that names no mode is dealt (the suite, the labs, the
 * benchmark), and no mode the player picks. The run count is the level's
 * own (one) and is filled in by `createGame`. */
export function fieldRules(laps: number): RunRules {
  return {
    rivals: RACE.rivals,
    laps,
    countdown: RACE.countdown,
    contact: true,
    course: true,
    tricks: false,
    limit: 0,
    airGravity: TUNING.air.gravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    start: "line",
    gates: "arcade",
    window: 0,
  };
}

/** THE SLALOM'S NUMBERS (R31 sets its course). */
export const SLALOM = {
  /** The start list: the racers on the board beside the player. */
  field: 29,
  /** "READY" … "GO": the starter's two words, s apart. */
  countdown: 4,
  /** Away within this of GO, s, or disqualified. */
  window: 10,
  /** Two runs, on combined time. */
  runs: 2,
  /** The best of the first run start the second, in reverse order. */
  qualify: 30,
  /** The pair the field races on: the slalom ski — every racer in a
   * slalom skis one, by rule as by sense. */
  skis: "swift",
} as const;

/** THE SLALOM as a skier is dealt it (R31): the start list skied before
 * him one at a time, the starter's word, the strict gates, the window. */
export function slalomRules(laps: number): RunRules {
  return {
    rivals: SLALOM.field,
    laps,
    countdown: SLALOM.countdown,
    contact: false,
    course: true,
    tricks: false,
    limit: 0,
    airGravity: TUNING.air.gravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    start: "interval",
    gates: "strict",
    window: SLALOM.window,
    technique: "slalom",
    jury: JURY.slalom,
  };
}

/** THE DOWNHILL'S NUMBERS (R32 sets its course). */
export const DOWNHILL = {
  /** The start list: the racers on the board beside the player. */
  field: 29,
  /** The start clock's last five seconds, beeped, then GO. */
  countdown: 5,
  /** A start is valid until this long after GO, s, or disqualified. */
  window: 5,
  /** One race run — after a training run on the same course. */
  runs: 1,
  /** The pair the field races on: the downhill ski. */
  skis: "eagle",
} as const;

/** THE DOWNHILL as a skier is dealt it (R32): the start list skied before
 * him one at a time, the start clock, the strict gates, the window. A
 * TRAINING run is the same rules over a board of its own
 * (`CreateGameOptions.training`). */
export function downhillRules(laps: number): RunRules {
  return {
    rivals: DOWNHILL.field,
    laps,
    countdown: DOWNHILL.countdown,
    contact: false,
    course: true,
    tricks: false,
    limit: 0,
    airGravity: TUNING.air.gravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    start: "interval",
    gates: "strict",
    window: DOWNHILL.window,
    technique: "downhill",
    jury: JURY.downhill,
  };
}

/** THE SUPER-G'S NUMBERS (R33 sets its course). */
export const SUPER_G = {
  /** The start list: the racers on the board beside the player. */
  field: 29,
  /** The start clock's last five seconds, beeped, then GO. */
  countdown: 5,
  /** A start is valid until this long after GO, s, or disqualified. */
  window: 5,
  /** One run, and no training: the course is inspected, never skied
   * before the race. */
  runs: 1,
  /** The pair the field races on: the super-G ski, built to the rule
   * (at least 2.10 m and 45 m of sidecut). */
  skis: "falcon",
} as const;

/** THE SUPER-G as a skier is dealt it (R33): the start list skied before
 * him one at a time, the start clock, the strict gates, the window — one
 * run, never seen before it. */
export function superGRules(laps: number): RunRules {
  return {
    rivals: SUPER_G.field,
    laps,
    countdown: SUPER_G.countdown,
    contact: false,
    course: true,
    tricks: false,
    limit: 0,
    airGravity: TUNING.air.gravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    start: "interval",
    gates: "strict",
    window: SUPER_G.window,
    technique: "superG",
    jury: JURY.superG,
  };
}

/** What a measurement skis: the level's run, no lights, nobody else. */
export function openRules(laps: number): RunRules {
  return {
    rivals: 0,
    laps,
    countdown: 0,
    contact: true,
    course: true,
    tricks: false,
    limit: 0,
    airGravity: TUNING.air.gravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    start: "line",
    gates: "arcade",
    window: 0,
  };
}

/** THE FREE RIDE: no field, no lights, and no course — the whole mountain
 * to ski, the clock running only as a record of the outing, and the ski
 * area full of other people skiing it (`CROWD.count` of them). */
export function freeRules(laps: number): RunRules {
  return {
    rivals: 0,
    laps,
    countdown: 0,
    contact: true,
    course: false,
    tricks: false,
    limit: 0,
    airGravity: TUNING.air.gravity,
    crowd: CROWD.count,
    lifts: true,
    heli: true,
    sled: true,
    start: "line",
    gates: "arcade",
    window: 0,
  };
}

/** THE SNOW'S DEPTH, a RUN DIAL: how deep the loose snow lies, as a
 * multiple of the ordinary snow's — `TUNING.snow.cover` of it, which a
 * standing skier sinks `TUNING.snow.powderSink` into (`snow.ts`). One is
 * the snow every race is skied on; a free ride may ask for a dusting over a
 * crust or a metre of bottomless fresh snow (2.5, `snow.deep.full`). It is
 * read, never written, during a run and draws nothing from the stream, so a
 * run replays the same at any depth and a run that names none moves no
 * digest. */
export const SNOW_DIAL = { min: 0.25, max: 2.5, step: 0.25 } as const;

/** A depth held inside {@link SNOW_DIAL}; anything that is not a number is
 * the ordinary snow. */
export function clampSnowDepth(depth: number | undefined): number {
  if (depth === undefined || !Number.isFinite(depth)) return 1;
  return Math.min(SNOW_DIAL.max, Math.max(SNOW_DIAL.min, depth));
}

/** A resilience held to 0..1 (`SkierState.resilience`); anything that is
 * not a number is the professional's. */
export function clampResilience(r: number | undefined): number {
  if (r === undefined || !Number.isFinite(r)) return 1;
  return Math.min(1, Math.max(0, r));
}

/** THE WAYS ONTO THE SNOW. A mode is a NAME for a bundle of `RunRules`
 * (`MODE_RULES`) and nothing below the app branches on it: the engine reads
 * the rules, and the app reads the name to decide which card is up and which
 * row of the record book a run is filed under. */
export type GameMode = "slalom" | "downhill" | "superG" | "timeTrial" | "free" | "tricks";

export const GAME_MODES: readonly GameMode[] = [
  "slalom",
  "downhill",
  "superG",
  "timeTrial",
  "free",
  "tricks",
];

export function isGameMode(value: unknown): value is GameMode {
  return typeof value === "string" && (GAME_MODES as readonly string[]).includes(value);
}

/** THE TIME TRIAL'S NUMBERS: the race's lights, nobody else on the snow,
 * and the one length it is offered at — the piste, once. */
export const TIME_TRIAL = {
  countdown: RACE.countdown,
  laps: [1] as readonly number[],
} as const;

/** The time trial as a skier is dealt it: the lights and the piste, alone. */
export function timeTrialRules(laps: number): RunRules {
  return {
    rivals: 0,
    laps,
    countdown: TIME_TRIAL.countdown,
    contact: true,
    course: true,
    tricks: false,
    limit: 0,
    airGravity: TUNING.air.gravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    start: "line",
    gates: "arcade",
    window: 0,
  };
}

/** THE TRICKS RUN'S NUMBERS: the lights, then two minutes on the map's
 * terrain park (R20) with nobody else out there and the course counting
 * nothing — the score is the run. */
export const TRICKS_RUN = {
  countdown: RACE.countdown,
  /** The buzzer, s. */
  limit: 120,
  /** The real g in flight: every stroke, pose and combo (`tricks.ts`) is
   * sized to the hang a kicker gives at it, and the arcade's heavier air
   * would land a backflip before it had come round. */
  airGravity: 1,
  lifts: false,
  heli: false,
  sled: false,
} as const;

/** A tricks run as a skier is dealt it: the lights, the strokes read, the
 * buzzer, and no course owed. */
export function tricksRules(laps: number): RunRules {
  return {
    rivals: 0,
    laps,
    countdown: TRICKS_RUN.countdown,
    contact: true,
    course: false,
    tricks: true,
    limit: TRICKS_RUN.limit,
    airGravity: TRICKS_RUN.airGravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    start: "line",
    gates: "arcade",
    window: 0,
  };
}

/** EVERY MODE'S RULES by its name — the one place a name becomes a bundle. */
export const MODE_RULES: Readonly<Record<GameMode, (laps: number) => RunRules>> = {
  slalom: slalomRules,
  downhill: downhillRules,
  superG: superGRules,
  timeTrial: timeTrialRules,
  free: freeRules,
  tricks: tricksRules,
};

/** THE RACE DISCIPLINES the game names, in the order a race card lists
 * them. */
export type Discipline = "slalom" | "giantSlalom" | "superG" | "downhill" | "skiCross" | "speedSki";

/** Each discipline, and the mode that races it where it is BUILT — null
 * where it is named and not built yet. */
export const DISCIPLINES: readonly { id: Discipline; mode: GameMode | null }[] = [
  { id: "slalom", mode: "slalom" },
  { id: "giantSlalom", mode: null },
  { id: "superG", mode: "superG" },
  { id: "downhill", mode: "downhill" },
  { id: "skiCross", mode: null },
  { id: "speedSki", mode: null },
];
