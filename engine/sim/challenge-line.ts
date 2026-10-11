// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A TIMED LINE SKIED BY THE BOT — the measurement the line challenges'
// medals are calibrated against (`make challenges-table`, the suite). A
// free ride is stood up on the map, the skier set on the run some way above
// the line's start gate and moving, and the bot skis the run (reading a copy
// of the map whose piste is that run, as an enthusiast's does —
// `enthusiasts.ts`) while the challenges' own judge watches; what comes back
// is what the judge said of the line.

import { nearestTrackPoint, trackPointAt } from "../mapgen/index.ts";
import type { Level, TrackHit, TrackPoint } from "../mapgen/types.ts";
import { dealtRuns, type DealtRun } from "../game/challenges/common.ts";
import { createChallengeRun } from "../game/challenges/registry.ts";
import type { LineChallenge } from "../game/challenges/line.ts";
import type { Medal, VoidCause } from "../game/challenges/types.ts";
import type { SkiSpec } from "../game/defs/skis.ts";
import { TUNING } from "../game/defs/tuning.ts";
import { placeRun } from "../game/place.ts";
import { createGame, step } from "../game/step.ts";
import { botInput, RIDER_BOT } from "./bot.ts";

/** How far above the start gate the bot is set down, m, and the speed he
 * is set down at, m/s: he crosses the gate skiing, as a player does. */
const LEAD = 50;
const ENTRY = 6;
/** How far past the finish the copy's piste runs on, m. */
const TAIL = 40;

/** What the bot made of a line: its time, s (null when the attempt went
 * void or never finished), the medal and why it went void. */
export type LineSkied = {
  time: number | null;
  medal: Medal | null;
  why: VoidCause | "timeout" | "unstarted" | null;
};

const hit: TrackHit = { index: 0, s: 0, distance: Infinity, lateral: 0, x: 0, z: 0 };

/** The map as the bot reads it on `run` from arc `from` to `to`: its piste
 * that stretch, two plain gates at its ends, its kickers and drops on it
 * read at its own arc, and no course set on it. */
export function lineLevel(level: Level, run: DealtRun, from: number, to: number): Level {
  const points: TrackPoint[] = [];
  const at = (s: number) => ({ ...trackPointAt(run, s), s: s - from });
  points.push(at(from));
  for (const p of run.track.points)
    if (p.s > from && p.s < to) points.push({ ...p, s: p.s - from });
  points.push(at(to));
  const track = { points, length: to - from, closed: false as const };
  const on = { track };
  const across = <T extends { x: number; z: number; s?: number }>(k: T): T[] => {
    nearestTrackPoint(on, k.x, k.z, hit);
    return hit.distance <= points[hit.index].width / 2 ? [{ ...k, s: hit.s }] : [];
  };
  const gate = (p: TrackPoint, colour: "red" | "blue") => ({
    x: p.x,
    z: p.z,
    y: p.y,
    heading: p.heading,
    width: p.width,
    s: p.s,
    colour,
  });
  return {
    ...level,
    track,
    checkpoints: [gate(points[0], "red"), gate(points[points.length - 1], "blue")],
    kickers: (level.kickers ?? []).flatMap(across),
    cliffs: (level.cliffs ?? []).filter((c) => c.onTrack).flatMap(across),
    slalom: undefined,
    downhill: undefined,
    superG: undefined,
    giantSlalom: undefined,
    speedSki: undefined,
    skiCross: undefined,
    skiJump: undefined,
    slopestyle: undefined,
    halfpipe: undefined,
    moguls: undefined,
    aerials: undefined,
  };
}

/** SKI LINE `line` of `level` with the bot on `spec` (the reference pair
 * when left out), judged by the challenges' own judge. */
export function skiLine(level: Level, line: LineChallenge, spec?: SkiSpec): LineSkied {
  const run = dealtRuns(level).find((r) => r.id === line.run);
  if (!run) return { time: null, medal: null, why: "unstarted" };
  const from = Math.max(0, line.start.s - LEAD);
  const to = Math.min(run.track.length, line.finish.s + TAIL);
  const read = lineLevel(level, run, from, to);
  const state = createGame({
    level,
    mode: "free",
    crowd: 0,
    enthusiasts: 0,
    countdown: 0,
    quiet: true,
    ...(spec ? { spec } : {}),
  });
  const head = trackPointAt(run, from);
  placeRun(state, { x: head.x, z: head.z, heading: head.heading, speed: ENTRY });
  const judge = createChallengeRun(level);
  judge.step(state);
  const most = (line.medals.bronze * 3 + 60) / TUNING.dt;
  let started = false;
  for (let i = 0; i < most; i++) {
    step(state, botInput({ ...state, level: read }, RIDER_BOT));
    for (const e of judge.step(state)) {
      if (e.id !== line.id) continue;
      if (e.kind === "start") started = true;
      if (e.kind === "done") return { time: e.value ?? null, medal: e.medal ?? null, why: null };
      if (e.kind === "void") return { time: null, medal: null, why: e.why ?? null };
    }
  }
  return { time: null, medal: null, why: started ? "timeout" : "unstarted" };
}
