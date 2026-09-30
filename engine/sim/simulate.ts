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
import { generateLevel } from "../mapgen/generate.ts";
import type { GameEvent } from "../game/state.ts";
import { gradeOf, type PisteGrade } from "../mapgen/grades.ts";
import type { RegionId } from "../mapgen/regions.ts";
import type { Level } from "../mapgen/types.ts";
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

/** Ski one map headlessly with the bot. */
export function simulateRun(seed: number, options: SimOptions = {}): RunReport {
  const profile = options.profile ?? RIDER_BOT;
  const maxSeconds = options.maxSeconds ?? SIM_SECONDS;
  const state = createGame({
    seed,
    level:
      options.level ??
      (options.tricks || options.region || options.grade
        ? generateLevel(seed, {
            tricks: options.tricks,
            region: options.region,
            grade: options.grade,
          })
        : undefined),
    laps: options.laps,
    rivals: options.rivals ?? 0,
    countdown: 0,
    spec: options.spec,
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
    finished: p.finished,
    time: p.time,
    laps: p.lap,
    lapTimes: p.lapTimes,
    checkpoints: p.passed,
    crossings: state.level.checkpoints.length * state.rules.laps,
    trackLength: state.level.track.length,
    topSpeed,
    meanSpeed: p.time > 0 ? distance / p.time : 0,
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
    place,
    score: state.tricks.score,
    events,
    digest: hash.toString(16).padStart(8, "0"),
  };
}
