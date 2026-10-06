// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODES, and the rules a run is played by. A mode is a named bundle of
// rules (`MODE_RULES`): a RACE in one of the real disciplines — the SLALOM
// (R31), the field skiing the course one at a time out of the start hut
// under the international rules, two runs on combined time, and the
// DOWNHILL (R32), the whole piste in one run after a training run, and the
// SUPER-G (R33), one run unseen on the downhill's hill from a lower start,
// its gates turning him, SPEED SKIING (R34), a straight track of its
// own, a qualification and a final timed through a 100 m zone, and the SKI
// CROSS (R35), a course built in the snow raced four abreast — a timed
// qualification, then heats of four out of one start gate — the TIME
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
// run — every one BUILT, each a mode with its own rules here and its own
// course rule (R31–R36).

import { CROWD } from "./crowd.ts";
import type { RiderId } from "./riders.ts";
import type { SkiId } from "./skis.ts";
import { TUNING } from "./tuning.ts";
import { SLOPESTYLE, slopestyleRules } from "./slopestyle.ts";

export { JIBS, SLOPESTYLE, slopestyleRules } from "./slopestyle.ts";
import { RAIL_JAM, railJamRules } from "./rail-jam.ts";
export { RAIL_JAM, railJamRules } from "./rail-jam.ts";
import { HALFPIPE, halfpipeRules } from "./halfpipe.ts";
export { HALFPIPE, halfpipeRules } from "./halfpipe.ts";
import { MOGULS, mogulsRules } from "./moguls.ts";
import type { Discipline } from "./formats.ts";
export { MOGULS, mogulsRules } from "./moguls.ts";
import { DUAL_MOGULS, dualMogulsRules } from "./dual-moguls.ts";
export { DUAL_MOGULS, dualMogulsRules, duelRules } from "./dual-moguls.ts";
import { AERIALS, aerialsRules } from "./aerials.ts";
export { AERIALS, aerialsRules } from "./aerials.ts";

export type { Jury, RunRules } from "./run-rules.ts";
import type { Jury, RunRules } from "./run-rules.ts";

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
    stunts: false,
    limit: 0,
    airGravity: TUNING.air.gravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    groomer: false,
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
    stunts: false,
    limit: 0,
    airGravity: TUNING.air.gravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    groomer: false,
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
    stunts: false,
    limit: 0,
    airGravity: TUNING.air.gravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    groomer: false,
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
    stunts: false,
    limit: 0,
    airGravity: TUNING.air.gravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    groomer: false,
    start: "interval",
    gates: "strict",
    window: SUPER_G.window,
    technique: "superG",
    jury: JURY.superG,
  };
}

/** THE GIANT SLALOM'S NUMBERS (R36 sets its course). */
export const GIANT_SLALOM = {
  /** The start list: the racers on the board beside the player. */
  field: 29,
  /** The start clock's last five seconds, beeped, then GO. */
  countdown: 5,
  /** A start is valid until this long after GO, s, or disqualified. */
  window: 5,
  /** Two runs, on combined time. */
  runs: 2,
  /** The best of the first run start the second, in reverse order. */
  qualify: 30,
  /** The pair the field races on: the giant slalom ski, built to the rule
   * (at least 1.93 m and 30 m of sidecut). */
  skis: "chough",
} as const;

/** THE GIANT SLALOM as a skier is dealt it (R36): the start list skied
 * before him one at a time, the start clock, the strict gates, the window
 * — two runs on two courses set on the same hill. */
export function giantSlalomRules(laps: number): RunRules {
  return {
    rivals: GIANT_SLALOM.field,
    laps,
    countdown: GIANT_SLALOM.countdown,
    contact: false,
    course: true,
    tricks: false,
    stunts: false,
    limit: 0,
    airGravity: TUNING.air.gravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    groomer: false,
    start: "interval",
    gates: "strict",
    window: GIANT_SLALOM.window,
    technique: "giantSlalom",
    jury: JURY.giantSlalom,
  };
}

/** SPEED SKIING'S NUMBERS (R34 sets its track). */
export const SPEED_SKI = {
  /** The start list: the racers on the board beside the player — a top
   * class's tour field of 25–35. */
  field: 29,
  /** The start clock's last five seconds, beeped, then GO. */
  countdown: 5,
  /** A racer has this long after GO to start, s. */
  window: 60,
  /** Two runs: the QUALIFICATION from a lowered start, and the FINAL from
   * the top — the sport's programme of qualifying runs, a semi-final and a
   * final folded to its two ends. */
  runs: 2,
  /** The best of the qualification start the final, in increasing order of
   * their speed — on a tour event some twenty of thirty reach it. */
  qualify: 20,
  /** The pair the field races on: the speed ski, the top class's. */
  skis: "peregrine",
} as const;

/** SPEED SKIING as a skier is dealt it (R34): the start list down the
 * track before him one at a time, the start clock, the window, the timing
 * zone's two lines — the clock runs between them — and a fall a run out. */
export function speedSkiRules(laps: number): RunRules {
  return {
    rivals: SPEED_SKI.field,
    laps,
    countdown: SPEED_SKI.countdown,
    contact: false,
    course: true,
    tricks: false,
    stunts: false,
    limit: 0,
    airGravity: TUNING.air.gravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    groomer: false,
    start: "interval",
    gates: "strict",
    window: SPEED_SKI.window,
    technique: "speedSki",
    jury: JURY.speedSki,
  };
}

/** THE SKI CROSS'S NUMBERS (R35 builds its course). */
export const SKI_CROSS = {
  /** The qualification's start list: the racers on its board beside the
   * player. */
  field: 29,
  /** The qualification's start: "10 seconds", 5 to 1, GO. */
  countdown: 5,
  /** THE BRACKET: the best `qualify` of the qualification go into it, in
   * heats of `heat`, the first `through` of each going on to the next
   * round. */
  qualify: 16,
  heat: 4,
  through: 2,
  /** A HEAT'S START COMMANDS, s: "skiers ready", "attention" `ready` s
   * later, and the doors dropping at a moment dealt `release` s after it —
   * the rule's random 1–4 s, with no word. */
  ready: 1.6,
  release: { min: 1, max: 4 },
  /** The pair the field races on: the ski-cross ski. */
  skis: "wolverine",
} as const;

/** THE SKI CROSS'S QUALIFICATION as a skier is dealt it (R35): one timed
 * run alone out of the start gate, the start list's times a board dealt
 * about par, the strict gates. */
export function skiCrossRules(laps: number): RunRules {
  return {
    rivals: SKI_CROSS.field,
    laps,
    countdown: SKI_CROSS.countdown,
    contact: false,
    course: true,
    tricks: false,
    stunts: false,
    limit: 0,
    airGravity: TUNING.air.gravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    groomer: false,
    start: "gate",
    dealt: true,
    gates: "strict",
    window: 0,
    technique: "skiCross",
    jury: JURY.skiCross,
  };
}

/** A SKI-CROSS HEAT as a skier is dealt it (R35): four out of the start
 * gate together, the doors dropping after "attention" (`countdown` the
 * whole sequence, dealt per heat by `createGame`), the field SKIED beside
 * him, contact on and judged, the strict gates. */
export function skiCrossHeatRules(laps: number, countdown: number): RunRules {
  return {
    ...skiCrossRules(laps),
    rivals: SKI_CROSS.heat - 1,
    countdown,
    contact: true,
    dealt: false,
    knock: true,
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
    stunts: false,
    limit: 0,
    airGravity: TUNING.air.gravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    groomer: false,
    start: "line",
    gates: "arcade",
    window: 0,
  };
}

/** THE FREE RIDE: no field, no lights, and no course — the whole mountain
 * to ski, the clock running only as a record of the outing, the ski area
 * full of other people skiing it (`CROWD.count` of them), and the mountain
 * his to trick: the strokes in the air and riding switch, under the real g
 * a tricks run flies in, so the jump key's own pop holds him up long
 * enough to come round. */
export function freeRules(laps: number): RunRules {
  return {
    rivals: 0,
    laps,
    countdown: 0,
    contact: true,
    course: false,
    tricks: false,
    stunts: true,
    limit: 0,
    airGravity: TRICKS_RUN.airGravity,
    crowd: CROWD.count,
    lifts: true,
    heli: true,
    sled: true,
    afterski: true,
    groomer: true,
    start: "line",
    gates: "arcade",
    window: 0,
  };
}

// The run dials (the snow's depth, the resilience) are `dials.ts`'s.
export { SNOW_DIAL, clampResilience, clampSnowDepth } from "./dials.ts";

/** THE WAYS ONTO THE SNOW. A mode is a NAME for a bundle of `RunRules`
 * (`MODE_RULES`) and nothing below the app branches on it: the engine reads
 * the rules, and the app reads the name to decide which card is up and which
 * row of the record book a run is filed under. */
export type GameMode =
  | "slalom"
  | "giantSlalom"
  | "downhill"
  | "superG"
  | "speedSki"
  | "skiCross"
  | "timeTrial"
  | "free"
  | "tricks"
  | "bigAir"
  | "knuckleHuck"
  | "slopestyle"
  | "railJam"
  | "halfpipe"
  | "moguls"
  | "dualMoguls"
  | "aerials";

export const GAME_MODES: readonly GameMode[] = [
  "slalom",
  "giantSlalom",
  "downhill",
  "superG",
  "speedSki",
  "skiCross",
  "timeTrial",
  "free",
  "tricks",
  "bigAir",
  "knuckleHuck",
  "slopestyle",
  "railJam",
  "halfpipe",
  "moguls",
  "dualMoguls",
  "aerials",
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
    stunts: false,
    limit: 0,
    airGravity: TUNING.air.gravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    groomer: false,
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
  groomer: false,
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
    stunts: true,
    limit: TRICKS_RUN.limit,
    airGravity: TRICKS_RUN.airGravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    groomer: false,
    start: "line",
    gates: "arcade",
    window: 0,
  };
}

/** BIG AIR'S NUMBERS (R37 builds its jump; the format is `big-air.ts`'s,
 * from `docs/freestyle.md` § *Big air*). */
export const BIG_AIR = {
  /** The qualification's start list beside the player — a top series'
   * field of two dozen — and how many of the whole go to the final. */
  field: 23,
  finalists: 12,
  /** The jumps a skier takes in each phase, and how many of the final's
   * count: the qualification's best one, the final's best TWO, and those
   * two DIFFERENT tricks. */
  qualification: 2,
  final: 3,
  counting: 2,
  /** The starter's count, s, and the time after it to drop in, s — a
   * skier not away is not judged. */
  countdown: 3,
  window: 30,
  /** THE STROKES' CEILINGS: a 2160 (six turns, the most men throw) and a
   * quad (four inversions), where the arcade stops at a 720 and a double. */
  spinMost: 12 * Math.PI,
  flipMost: 8 * Math.PI,
  /** The pair the field rides: the big-air ski. */
  skis: "raven",
  /** THE JURY'S WEATHER (est.): the freestyle rules set no wind speed and
   * leave a hold or a postponement to the jury, and contests have been
   * postponed at gusts of 60 km/h and more off a pipe's deck and for a
   * whiteout. A flight of two or three seconds is blown off its landing
   * long before a racer is blown off his line, so the jump is held under
   * 40 km/h of gust, and in no more than a steady fall. */
  jury: { wind: 40 / 3.6, fall: 0.75 } as Jury,
} as const;

/** BIG AIR as a skier is dealt it (R37): one skier on the jump, the
 * starter's count, the window to drop in, a fall the end of the jump (the
 * strict gates: nobody is stood back on it), the real g in flight, every
 * flight a trick, and the strokes' ceilings raised to the format's. The
 * field is the contest's (`big-air.ts`), dealt, never skied. */
export function bigAirRules(laps: number): RunRules {
  return {
    rivals: 0,
    laps,
    countdown: BIG_AIR.countdown,
    contact: false,
    course: true,
    tricks: true,
    stunts: true,
    limit: 0,
    airGravity: TRICKS_RUN.airGravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    groomer: false,
    start: "line",
    gates: "strict",
    window: BIG_AIR.window,
    jury: BIG_AIR.jury,
    spinMost: BIG_AIR.spinMost,
    flipMost: BIG_AIR.flipMost,
    inRun: true,
  };
}

/** THE KNUCKLE HUCK'S NUMBERS (R38 builds its knuckle; the jam is
 * `jam.ts`'s, from `docs/freestyle.md` § *Knuckle huck*). */
export const KNUCKLE_HUCK = {
  /** The riders beside the player: a session of eight. */
  field: 7,
  /** THE JAM, s: the sport's twenty minutes cut to three — some dozen
   * hits off the knuckle, where the sport's riders get as many in its
   * twenty. */
  jam: 180,
  /** The starter's count, s. */
  countdown: 3,
  /** THE STROKES' CEILINGS: a 1620 (the most a butter has been wound into
   * off a knuckle) and a double. */
  spinMost: 9 * Math.PI,
  flipMost: 4 * Math.PI,
  /** The pair the field rides: the soft park twin-tip, for the presses. */
  skis: "hare",
  /** THE JURY'S WEATHER (est.): no rule is published; the session is run in
   * the evening under the lights, and has gone ahead on a cold night after
   * a day's delay — held, as big air is, under 40 km/h of gust and no more
   * than a steady fall. */
  jury: { wind: 40 / 3.6, fall: 0.75 } as Jury,
} as const;

/** THE KNUCKLE HUCK as a skier is dealt it (R38): one rider on the
 * knuckle, the starter's count, no course owed — a JAM of hits off the
 * platform until the buzzer, a fall only the end of its hit — the real g,
 * the strokes' ceilings raised, and BUTTERS on the snow. The field is the
 * jam's (`jam.ts`), dealt, never skied. */
export function knuckleHuckRules(laps: number): RunRules {
  return {
    rivals: 0,
    laps,
    countdown: KNUCKLE_HUCK.countdown,
    contact: false,
    course: false,
    tricks: true,
    stunts: true,
    limit: KNUCKLE_HUCK.jam,
    airGravity: TRICKS_RUN.airGravity,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    groomer: false,
    start: "line",
    gates: "arcade",
    window: 0,
    jury: KNUCKLE_HUCK.jury,
    spinMost: KNUCKLE_HUCK.spinMost,
    flipMost: KNUCKLE_HUCK.flipMost,
    jam: true,
    butters: true,
  };
}

/** EVERY MODE'S RULES by its name — the one place a name becomes a bundle. */
export const MODE_RULES: Readonly<Record<GameMode, (laps: number) => RunRules>> = {
  slalom: slalomRules,
  downhill: downhillRules,
  superG: superGRules,
  giantSlalom: giantSlalomRules,
  speedSki: speedSkiRules,
  skiCross: skiCrossRules,
  timeTrial: timeTrialRules,
  free: freeRules,
  tricks: tricksRules,
  bigAir: bigAirRules,
  knuckleHuck: knuckleHuckRules,
  slopestyle: slopestyleRules,
  railJam: railJamRules,
  halfpipe: halfpipeRules,
  moguls: mogulsRules,
  dualMoguls: dualMogulsRules,
  aerials: aerialsRules,
};

/** THE PAIR A RACE IS RACED ON: its discipline's own, the one its field
 * skis — what the ski card is opened on for that race — and a trick
 * format's (big air's, slopestyle's and the halfpipe's the Raven; moguls'
 * the Ibex; aerials' the Kestrel; the knuckle huck's and the rail jam's the Hare — a jam is
 * ridden on the soft park twin-tip, its tips and tails giving under a
 * press where the Raven's competition core holds them straight; the two
 * classes share a shape, 118–133/90–100 mm, and differ in the flex), or
 * null for a mode that is neither (the time trial, the free ride, the
 * tricks run). */
export const RACE_SKIS: Readonly<Partial<Record<GameMode, SkiId>>> = {
  slalom: SLALOM.skis,
  superG: SUPER_G.skis,
  giantSlalom: GIANT_SLALOM.skis,
  downhill: DOWNHILL.skis,
  skiCross: SKI_CROSS.skis,
  speedSki: SPEED_SKI.skis,
  bigAir: BIG_AIR.skis,
  knuckleHuck: KNUCKLE_HUCK.skis,
  slopestyle: SLOPESTYLE.skis,
  railJam: RAIL_JAM.skis,
  halfpipe: HALFPIPE.skis,
  moguls: MOGULS.skis,
  dualMoguls: DUAL_MOGULS.skis,
  aerials: AERIALS.skis,
};

export function raceSkisOf(mode: GameMode): SkiId | null {
  return RACE_SKIS[mode] ?? null;
}

/** THE BUILD A RACE IS RACED AT: the weight (`defs/riders.ts`) that suits
 * its discipline — what the dress card is opened on for that race — or null
 * for a mode that is no race. The slalom asks for quickness from gate to
 * gate, the reference build's; the super-G and the downhill pay a heavier
 * skier's speed in a tuck (the terminal speed climbs as the fourth root of
 * his weight) and still jump, so the SOLID build's legs; speed skiing is
 * the tuck alone, straight down with nothing to land, so the HEAVY one. A
 * ski cross is the solid build's too: the shoulder in the pack and the
 * glide down the straights pay weight, the jumps and the berms the legs. A
 * giant slalom's too: its racers are the heaviest of the technical events
 * (est.), its long turns at 70 km/h paying a heavier skier's glide and the
 * 3 body weights at the apex the solid build's legs. BIG AIR's athletes
 * are lighter than any racer — a study of top male freeskiers put them at
 * ~72.5 kg on 179 cm, the medium build in his kit — and what it pays for is
 * the legs under a landing from ten metres up and a body light enough to
 * spin: the MEDIUM build (`docs/freestyle.md` § *Big air*, "The skier").
 * THE KNUCKLE HUCK's field is the same freeski field — a national team
 * measured ~70 kg on 176 cm for the men, ~60 kg for the women — and
 * nothing a jam pays for favours weight: the MEDIUM build too
 * (`docs/freestyle.md` § *Knuckle huck*). SLOPESTYLE's are the same
 * skiers again, and its course pays the big air's landings and spins and a
 * rail section's balance — none of it weight: the MEDIUM build
 * (`docs/freestyle.md` § *Slopestyle*). The RAIL JAM's are the same park
 * field, and a rail pays balance and a press, never weight: the MEDIUM
 * build (`docs/freestyle.md` § *Rail jam*). The HALFPIPE's are the same
 * freeski field, and a pipe pays the legs under five or six landings and
 * a body light enough to spin a 1620 — the MEDIUM build
 * (`docs/freestyle.md` § *Halfpipe*). MOGULS' athletes weigh ~73 kg on
 * 178 cm (men) and ~60 kg (women) in a national team's measurements, and
 * a mogul line pays legs that fold and extend three times a second, never
 * weight: the MEDIUM build (`docs/freestyle.md` § *Moguls*); DUAL MOGULS'
 * are the same skiers on the same pair, and the same build. AERIALS is the
 * one format that pays for LIGHTNESS: three flips and five twists turn
 * faster the less there is to turn, and a landing from fourteen metres
 * down a 37° hill loads the legs at seven to eight body weights. Its
 * athletes are the lightest of the freestyle fields measured — a national
 * team's men ~69 kg on 175 cm, its women ~56 kg on 160 cm, and a squad
 * ~58 kg — jumping without poles in light kit; the mixed team pairs the
 * two, and the field's middle sits near 62 kg: the LIGHT build
 * (`docs/freestyle.md` § *Aerials*, "The skier"). */
export const RACE_RIDERS: Readonly<Partial<Record<GameMode, RiderId>>> = {
  slalom: "medium",
  superG: "solid",
  giantSlalom: "solid",
  downhill: "solid",
  skiCross: "solid",
  speedSki: "heavy",
  bigAir: "medium",
  knuckleHuck: "medium",
  slopestyle: "medium",
  railJam: "medium",
  halfpipe: "medium",
  moguls: "medium",
  dualMoguls: "medium",
  aerials: "light",
};

export function raceRiderOf(mode: GameMode): RiderId | null {
  return RACE_RIDERS[mode] ?? null;
}

// THE RACE DISCIPLINES AND THE TRICK FORMATS the game names are stated
// next door (`formats.ts`), so this file stays under its cap.
export { DISCIPLINES, FREESTYLE, type Discipline, type Freestyle } from "./formats.ts";
