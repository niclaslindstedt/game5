// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIELD — the other skiers in a race, from the start line they push off
// to the shoulder they lean on you with.
//
// A RIVAL IS A RUN. Each one is a whole `GameState` of its own — its skier,
// its progress, its input and its events — over the SAME world, sharing the
// player's level, rules and random stream by reference. So a rival is
// stepped by the very function the player is (`run.ts`), skied by the very
// bot the sim skis (`sim/bot.ts`), and meets a tree, a kicker and a gate
// exactly as the player would. What tells one from the next is two draws
// off the run's own stream at the start line, so the same seed deals the
// same field: the tuck its bot is allowed (`Rival.pace`), and the skis it
// is on — any of the catalog's (`SKI_CATALOG`), so a powder map has a
// powder ski in the field as often as a groomed one has a race ski.
//
// THE START IS NOT IN STEP. Four skiers let go on one step, every one
// starting his stride cycle at its first push, skate out of the gate as one
// figure four times over. So each rival is dealt — off a stream of the
// start's own (`START_SALT`), which leaves the run's stream and so the
// field above exactly as it was — how late he reacts to GO (`Rival.react`,
// `RACE.reactBand`: held in the gate with his skis across until then, his
// clock running like everyone's), and where in the stride cycle his first
// push lands, and on which leg (`SkierState.stride`).
//
// THE START LINE is the level's (`Level.grid`): four slots abreast a few
// metres above the start gate, the player in the first. A field bigger than
// the level's line stands its extra skiers a row behind. A rival HOLDS THE
// LINE HE STARTED ON (`Rival.lane`: his slot's offset from the piste's
// centreline, handed to his bot) — four skiers all aiming at one
// centreline funnelled into a single file on top of the player within ten
// seconds of the gate; a field that holds its lanes spreads across the
// piste at once and along it by pace.
//
// SKIER AGAINST SKIER is two plan circles down each one's skis, pushed
// apart along the line between their centres with the closing speed traded
// at `RACE.bump.restitution` — a shoulder, not a solver: skiers race side
// by side, and what matters is that they cannot pass through each other.

import { botInput, RIDER_BOT } from "../sim/bot.ts";
import type { Spawn } from "../mapgen/types.ts";
import { freshProgress, laneAcross, standSkier } from "./course.ts";
import { FULL_ASSIST, RACE } from "./defs/modes.ts";
import { SKI_CATALOG } from "./defs/skis.ts";
import {
  NEUTRAL_INPUT,
  type GameEvent,
  type GameState,
  type SkierInput,
  type SkierState,
} from "./state.ts";
import { stepRun } from "./run.ts";
import { freshSkier } from "./skier.ts";
import { freshTricks } from "./tricks.ts";
import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import {
  fieldOrder as orderField,
  legProgress,
  placeAmong,
  type Standing,
} from "@niclaslindstedt/oss-game-framework/racing/standings";

/** How far behind the level's start line an extra row stands, m. */
const ROW_BACK = 5;

/** What the start's own stream is seeded with beside the run's seed — a
 * stream apart, so dealing the start draws nothing off `state.rng`. */
const START_SALT = 0x5a17e5;

/** What a rival does in the gate after GO until he reacts: the skis held
 * across the slope, as under the lights. */
const IN_GATE: SkierInput = { ...NEUTRAL_INPUT, brake: 1 };

/** How far right of the piste's centreline slot `slot` stands, m — the
 * lane its skier holds down the piste. */
export function laneOf(state: GameState, slot: number): number {
  const at = gridSlot(state, slot);
  return laneAcross(state.level, at.x, at.z);
}

/** Where slot `slot` of the start line stands. */
export function gridSlot(state: GameState, slot: number): Spawn {
  const grid = state.level.grid;
  if (slot < grid.length) return grid[slot];
  const base = grid[slot % grid.length];
  const row = Math.floor(slot / grid.length);
  return {
    x: base.x - Math.sin(base.heading) * ROW_BACK * row,
    z: base.z - Math.cos(base.heading) * ROW_BACK * row,
    heading: base.heading,
  };
}

/** STAND THE FIELD: `count` rivals, each on its slot with its pace, its
 * skis and its start dealt. Called once, from `createGame`, and only for a
 * run with rivals in it. */
export function createRivals(state: GameState, count: number): void {
  state.rivals = [];
  const start = createRng((state.seed ^ START_SALT) >>> 0);
  for (let i = 0; i < count; i++) {
    const pace = state.rng.range(RACE.paceBand.min, RACE.paceBand.max);
    const run: GameState = {
      ...state,
      skier: freshSkier(state.rng.pick(SKI_CATALOG)),
      input: { ...NEUTRAL_INPUT },
      // The player's help is the player's: the bot skis every rival with
      // every hand on, so a harder setting is harder skiing, not a slower
      // field.
      assist: { ...FULL_ASSIST },
      // ...and so is his damage: a rival's edges are never dulled.
      damage: false,
      progress: freshProgress(state.level),
      tricks: freshTricks(),
      rivals: [],
      events: [],
    };
    const at = gridSlot(state, i + 1);
    standSkier(run, at.x, at.z, at.heading);
    // The stride count's whole part is the leg, its fraction the phase.
    run.skier.stride = start.range(0, 2);
    state.rivals.push({
      id: i,
      run,
      pace,
      react: start.range(RACE.reactBand.min, RACE.reactBand.max),
      lane: laneOf(state, i + 1),
    });
  }
}

/** Step every rival by the step the world has just taken: the bot skis
 * each one's own run, its tuck held to its pace, under the player's lights
 * — and from his own reaction after GO. */
export function stepRivals(state: GameState): void {
  const sinceGo = state.t - state.rules.countdown;
  for (const rival of state.rivals) {
    const run = rival.run;
    run.t = state.t;
    run.tick = state.tick;
    // The same new snow under every skier on the mountain.
    run.fresh = state.fresh;
    run.countdown = state.countdown;
    run.phase = run.progress.finished
      ? "finished"
      : state.phase === "countdown"
        ? "countdown"
        : "racing";
    run.events.length = 0;
    const input =
      run.phase !== "racing"
        ? NEUTRAL_INPUT
        : sinceGo < rival.react
          ? IN_GATE
          : botInput(run, RIDER_BOT, rival.lane);
    run.input.steer = input.steer;
    run.input.tuck = Math.min(input.tuck, rival.pace);
    run.input.brake = input.brake;
    run.input.lean = input.lean;
    run.input.reset = input.reset;
    stepRun(run, run.input, run.events);
  }
}

/** Push two skiers apart if they overlap; returns the closing speed, m/s. */
function clipPair(a: SkierState, b: SkierState): number {
  const B = RACE.bump;
  let worst = 0;
  const af = { x: Math.sin(a.heading), z: Math.cos(a.heading) };
  const bf = { x: Math.sin(b.heading), z: Math.cos(b.heading) };
  for (const sa of [-1, 1]) {
    for (const sb of [-1, 1]) {
      const ax = a.x + af.x * B.offset * sa;
      const az = a.z + af.z * B.offset * sa;
      const bx = b.x + bf.x * B.offset * sb;
      const bz = b.z + bf.z * B.offset * sb;
      const dx = bx - ax;
      const dz = bz - az;
      const d = hypot(dx, dz);
      if (d >= 2 * B.radius || Math.abs(a.y - b.y) > 1.5) continue;
      const nx = d > 1e-6 ? dx / d : 1;
      const nz = d > 1e-6 ? dz / d : 0;
      const pen = 2 * B.radius - d;
      a.x -= (nx * pen) / 2;
      a.z -= (nz * pen) / 2;
      b.x += (nx * pen) / 2;
      b.z += (nz * pen) / 2;
      const closing = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      if (closing <= 0) continue;
      // Equal masses: each takes half the exchange.
      const j = ((1 + B.restitution) * closing) / 2;
      a.vx -= j * nx;
      a.vz -= j * nz;
      b.vx += j * nx;
      b.vz += j * nz;
      if (closing > worst) worst = closing;
    }
  }
  return worst;
}

/** Every skier against every other, once a step, after all have moved.
 * The player's own contacts are reported (`bump`). */
export function clipRiders(state: GameState, events: GameEvent[]): void {
  const n = state.rivals.length;
  if (n === 0) return;
  const me = state.skier;
  for (let i = 0; i < n; i++) {
    const r = state.rivals[i];
    const closing = clipPair(me, r.run.skier);
    if (closing >= RACE.bump.speed && me.bumpCooldown <= 0) {
      me.bumpCooldown = RACE.bump.cooldown;
      events.push({ kind: "bump", t: state.t, rival: r.id, speed: closing });
    }
    for (let k = i + 1; k < n; k++) clipPair(r.run.skier, state.rivals[k].run.skier);
  }
}

/** HOW FAR DOWN THE RUN A SKIER IS: gates credited, plus a share of the way
 * to the next gate (`legProgress`). The share is NOT floored at zero, so a
 * skier further back on the approach reads behind one nearer it. */
export function raceProgress(run: GameState): number {
  const p = run.progress;
  const cps = run.level.checkpoints;
  const from = p.lastCheckpoint >= 0 ? cps[p.lastCheckpoint] : run.level.spawn;
  const to = cps[Math.min(p.nextCheckpoint, cps.length - 1)];
  return legProgress(p.passed, from, to, run.skier.x, run.skier.z);
}

/** A run reduced to where it stands: home first, by the clock; then further
 * down. A run home is never asked how far down it is. */
function standing(run: GameState): Standing {
  const p = run.progress;
  return { finished: p.finished, time: p.time, progress: p.finished ? 0 : raceProgress(run) };
}

/** THE WHOLE FIELD IN ORDER, best first: every rival's id, and `null`
 * where the player stands among them. */
export function fieldOrder(state: GameState): (number | null)[] {
  const runs: { id: number | null; run: GameState }[] = [
    { id: null, run: state },
    ...state.rivals.map((r) => ({ id: r.id, run: r.run })),
  ];
  return orderField(runs, (r) => standing(r.run)).map((r) => r.id);
}

/** THE PLAYER'S PLACE, 1-based: one more than the rivals ahead of him. */
export function racePlace(state: GameState): number {
  return placeAmong(
    standing(state),
    state.rivals.map((r) => standing(r.run)),
  );
}
