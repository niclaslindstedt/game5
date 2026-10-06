// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The headless simulation harness: run the REAL engine — createGame, step,
// the bot skier — with no renderer attached, and report what happened.
// This is how handling and generator changes are measured (scripts/
// simulate-run.mjs renders the tables) and how the sim tests assert that
// the bot finishes what the generator builds. Runs are deterministic: the
// same seed and level always produce the same digest.

import { SKIS, type SkiSpec } from "../game/defs/skis.ts";
import { TUNING } from "../game/defs/tuning.ts";
import { createGame, step } from "../game/step.ts";
import type { GameMode } from "../game/defs/modes.ts";
import type { CrossHeat } from "../game/cross-bracket.ts";
import { generateLevel } from "../mapgen/generate.ts";
import { PARK_VERSION } from "../mapgen/trick-field.ts";
import type { GameEvent } from "../game/state.ts";
import { gradeOf, type PisteGrade } from "../mapgen/grades.ts";
import type { RegionId } from "../mapgen/regions.ts";
import type { Level, WeatherKind } from "../mapgen/types.ts";
import { botInput, RIDER_BOT, type BotProfile } from "./bot.ts";
import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";

export type SimOptions = {
  /** A map to ride instead of the seed's own. */
  level?: Level;
  /** Runs to the finish (the level's one when left out). */
  laps?: number;
  /** Rivals on the start line beside the bot (0 when left out: a solo run
   * is the measurement; a field is the race). */
  rivals?: number;
  /** The skis the bot is on (the all-mountain pair when left out). */
  spec?: SkiSpec;
  profile?: BotProfile;
  /** Give up after this much simulated time, s. */
  maxSeconds?: number;
  /** Keep every event in the report. */
  keepEvents?: boolean;
  /** Ski the seed's map with its TERRAIN PARK laid (R20) — the same race,
   * on the map a tricks run is skied on. Ignored when `level` is given. */
  tricks?: boolean;
  /** Ski the seed's map as built in this kind of snow country (R21); the
   * alpine when left out. Ignored when `level` is given. */
  region?: RegionId;
  /** Ski the seed's map as built to this piste grade (R23); the one the
   * seed deals when left out. Ignored when `level` is given. */
  grade?: PisteGrade;
  /** Ski the map under this sky (`withSky`) rather than the one R19 dealt
   * it — the bot in a storm's wind, say. */
  weather?: WeatherKind;
  /** Ski WITHOUT POLES (`SkierState.poles` — the player's hard mode); with
   * them when left out. */
  poles?: boolean;
  /** RACE A DISCIPLINE (`MODE_RULES`): the seed's map with its course set
   * over it — a slalom's stretch (R31), a downhill's whole piste on the ski
   * area's biggest course (R32), a super-G down the same from its lowered
   * start (R33), a giant slalom from its own, its first run (R36), a speed
   * track cut down the face, its qualification (R34)
   * — skied out of the start house under the
   * strict gates, against the field's board. The open rules when left out.
   * Ignored with `tricks`. */
  mode?: Extract<
    GameMode,
    "slalom" | "giantSlalom" | "downhill" | "superG" | "speedSki" | "skiCross" | "bigAir"
  >;
  /** On a ski cross, ski a HEAT (R35) rather than the qualification: the
   * bot in the first seed's lane beside three of the start list, skied. */
  heat?: boolean;
};

export type RunReport = {
  seed: number;
  /** The skis skied. */
  skis: string;
  /** How much of the piste's centreline is not groomed — its share lying
   * under a drift (R17) — 0..1. What a catalog's rows are read against. */
  powder: number;
  /** The colour on the map's signs (R23, `gradeOf`). */
  grade: PisteGrade;
  finished: boolean;
  /** Race clock at the finish (or the timeout), s. */
  time: number;
  laps: number;
  lapTimes: number[];
  /** Gates credited, of the run's total crossings. */
  checkpoints: number;
  crossings: number;
  trackLength: number;
  /** m/s. */
  topSpeed: number;
  /** Mean speed over the race clock, m/s. */
  meanSpeed: number;
  /** Seconds of air — the flights that counted, summed — the longest one,
   * and how many there were. */
  airTime: number;
  bestAir: number;
  jumps: number;
  harshLandings: number;
  treeHits: number;
  bumps: number;
  resets: number;
  autoResets: number;
  /** Times the skier was thrown (`crash.ts`) — 0 on every clean run. */
  wipeouts: number;
  missed: number;
  /** OUT OF THE RACE under the strict gates (a discipline's run): how —
   * `dsq` or `dnf` and why — or null. */
  out: string | null;
  /** His speed through a speed course's trap (R32, R33) — on a speed
   * track (R34) through its timing zone — m/s, or null. */
  trap: number | null;
  /** Where the bot finished against the field (1 on a solo run). */
  place: number;
  /** THE SCORE the run banked (`tricks.ts`). The bot turns nothing, so this
   * is its air and the ground its flights covered, combo by combo — what a
   * map's kickers are worth to a skier who only skis them. */
  score: number;
  events: GameEvent[];
  /** FNV-1a over sampled positions and speeds — the determinism fingerprint. */
  digest: string;
};

/** How long a run is given before the harness gives up, s: a four-kilometre
 * piste at a crawl. It catches a skier who has STOPPED. */
export const SIM_SECONDS = 600;

/** THE HEAT the sim skis a ski cross's bot in (`SimOptions.heat`): the
 * first seed's, three of the start list beside him. */
const SIM_HEAT: CrossHeat = {
  round: "quarter",
  index: 0,
  racers: [
    { id: null, rank: 1 },
    { id: 0, rank: 8 },
    { id: 1, rank: 9 },
    { id: 2, rank: 16 },
  ],
};

/** Ski one map headlessly with the bot. */
export function simulateRun(seed: number, options: SimOptions = {}): RunReport {
  const profile = options.profile ?? RIDER_BOT;
  const maxSeconds = options.maxSeconds ?? SIM_SECONDS;
  const race = options.tricks ? undefined : options.mode;
  const state = createGame({
    seed,
    mode: race,
    region: race ? options.region : undefined,
    grade: race ? options.grade : undefined,
    level:
      options.level ??
      (!race && (options.tricks || options.region || options.grade)
        ? generateLevel(seed, {
            tricks: options.tricks,
            region: options.region,
            grade: options.grade,
            // The park is laid on a map of one piste (R20).
            version: options.tricks ? PARK_VERSION : undefined,
          })
        : undefined),
    laps: options.laps,
    cross: race === "skiCross" && options.heat ? SIM_HEAT : undefined,
    rivals: race ? undefined : (options.rivals ?? 0),
    countdown: 0,
    spec: options.spec,
    poles: options.poles,
    sky: options.weather ? { weather: options.weather } : undefined,
    quiet: true,
  });
  const events: GameEvent[] = [];
  let hash = 0x811c9dc5;
  const mix = (v: number): void => {
    hash ^= Math.round(v * 100) & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  };
  let topSpeed = 0;
  let airTime = 0;
  let jumps = 0;
  let harsh = 0;
  let treeHits = 0;
  let bumps = 0;
  let resets = 0;
  let autoResets = 0;
  let wipeouts = 0;
  let missed = 0;
  let place = 1;
  let distance = 0;
  const maxSteps = Math.ceil(maxSeconds / TUNING.dt);
  let steps = 0;
  while (state.phase !== "finished" && steps < maxSteps) {
    step(state, botInput(state, profile));
    for (const e of state.events) {
      if (options.keepEvents) events.push(e);
      if (e.kind === "land") {
        if (e.airTime > 0.3) {
          airTime += e.airTime;
          jumps += 1;
        }
        if (e.harsh) harsh += 1;
      } else if (e.kind === "hit") treeHits += 1;
      else if (e.kind === "bump") bumps += 1;
      else if (e.kind === "reset") {
        resets += 1;
        if (e.auto) autoResets += 1;
      } else if (e.kind === "missed") missed += 1;
      else if (e.kind === "wipeout") wipeouts += 1;
      else if (e.kind === "finish") place = e.place;
    }
    const c = state.skier;
    if (c.speed > topSpeed) topSpeed = c.speed;
    distance += hypot(c.vx, c.vz) * TUNING.dt;
    steps += 1;
    if (steps % 30 === 0) {
      mix(c.x);
      mix(c.z);
      mix(c.speed);
    }
  }
  mix(state.skier.x);
  mix(state.skier.y);
  mix(state.skier.z);
  const p = state.progress;
  const pts = state.level.track.points;
  let soft = 0;
  for (const pt of pts) soft += 1 - state.level.packedAt(pt.x, pt.z);
  return {
    seed,
    skis: (options.spec ?? SKIS).id,
    powder: soft / pts.length,
    grade: gradeOf(state.level),
    finished: p.finished && p.out === null,
    time: p.time,
    laps: p.lap,
    lapTimes: p.lapTimes,
    checkpoints: p.passed,
    crossings: state.level.checkpoints.length * state.rules.laps,
    trackLength: state.level.track.length,
    topSpeed,
    // A speed track's clock runs only through its timing zone: its mean is
    // the zone's, the speed through it.
    meanSpeed: state.level.speedSki ? (p.trap ?? 0) : p.time > 0 ? distance / p.time : 0,
    airTime,
    bestAir: p.bestAir,
    jumps,
    harshLandings: harsh,
    treeHits,
    bumps,
    resets,
    autoResets,
    wipeouts,
    missed,
    out: p.out ? `${p.out.status} ${p.out.why}@${p.out.gate}` : null,
    trap: p.trap,
    place,
    score: state.tricks.score,
    events,
    digest: hash.toString(16).padStart(8, "0"),
  };
}
