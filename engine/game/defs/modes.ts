// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODES, and the rules a run is played by. A mode is a named bundle of
// rules (`MODE_RULES`): the RACE against a field down the map's piste, the
// TIME TRIAL, the same piste alone against the clock, and the FREE RIDE,
// the whole mountain to explore with no course counted at all. The rules
// are a plain record on the state (`GameState.rules`) read by every system
// that answers to one, and nothing below the app branches on a mode's
// name. `openRules` is what a measurement skis: no lights and nobody else
// out there, so a simulated run's digest carries the skier and nothing in
// front of him.

import { CROWD } from "./crowd.ts";
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

/** THE RACE'S NUMBERS. */
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
  /** HOW ONE SKIER LEANS ON ANOTHER: each is two circles down his skis'
   * length of `radius` m, `offset` m ahead and behind the CoG — the radius
   * is the skier's own half-width with his arms and his poles out, so two
   * are held 1.2 m apart and their bodies never overlap; the share of the
   * closing speed that comes back; and the speed at which the player's own
   * contact is reported, m/s, at most once per `cooldown` s. */
  bump: { radius: 0.6, offset: 0.5, restitution: 0.3, speed: 1.5, cooldown: 0.5 },
} as const;

/** The race as a skier is dealt it: the field, the lights, contact on. The
 * run count is the level's own (one) and is filled in by `createGame`. */
export function raceRules(laps: number): RunRules {
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
export type GameMode = "race" | "timeTrial" | "free" | "tricks";

export const GAME_MODES: readonly GameMode[] = ["race", "timeTrial", "free", "tricks"];

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
  };
}

/** EVERY MODE'S RULES by its name — the one place a name becomes a bundle. */
export const MODE_RULES: Readonly<Record<GameMode, (laps: number) => RunRules>> = {
  race: raceRules,
  timeTrial: timeTrialRules,
  free: freeRules,
  tricks: tricksRules,
};
