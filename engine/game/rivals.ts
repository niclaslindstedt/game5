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
// is on — any of the start line's (`RACE.skis`, the catalog as the line
// was first dealt from), so a powder map has a powder ski in the field as
// often as a groomed one has a race ski. And
// how much each can take before he goes down (`Rival.resilience`,
// `RACE.resilienceBand`), off a stream of its own (`GRIT_SALT`) so that
// neither the run's stream nor the start's moves for it.
//
// THE START IS NOT IN STEP. Four skiers let go on one step, every one
// starting his stride cycle at its first push, skate out of the gate as one
// figure four times over. So each rival is dealt — off a stream of the
// start's own (`START_SALT`), which leaves the run's stream and so the
// field above exactly as it was — how late he reacts to GO (`Rival.react`,
// `RACE.reactBand`: held in the gate with his skis across until then, his
// clock running like everyone's), and where in his first push he goes —
// somewhere in it, never waiting through a glide for it — and on which
// leg (`SkierState.stride`).
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

import { botInput, RIDER_BOT, type BotProfile } from "../sim/bot.ts";
import { MOGUL_STEER } from "../sim/moguls-steer.ts";
import type { Spawn } from "../mapgen/types.ts";
import { freshProgress, laneAcross, standSkier } from "./course.ts";
import { FULL_ASSIST, RACE } from "./defs/modes.ts";
import { skisById, type SkiSpec } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import {
  NEUTRAL_INPUT,
  type GameEvent,
  type GameState,
  type Rival,
  type SkierInput,
  type SkierState,
} from "./state.ts";
import { fieldOrderOf, fieldPlace } from "./field.ts";
import { freshGatePoles } from "./gate-poles.ts";
import { stepRun } from "./run.ts";
import { crossLane, judgeContact } from "./cross-heat.ts";
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
/** ...and what each rival's resilience is dealt off — a third stream. */
const GRIT_SALT = 0x6e5111;

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
 * run with rivals on its start line. */
export function createRivals(state: GameState, count: number): void {
  state.rivals = dealRivals(state, count, (i) => gridSlot(state, i + 1));
}

/** DEAL THE START LINE: `count` rivals, each stood where `at` says, his pace
 * and his skis off the run's stream, his resilience off a stream of its own
 * and his start off the start's. */
export function dealRivals(state: GameState, count: number, at: (i: number) => Spawn): Rival[] {
  const out: Rival[] = [];
  const start = createRng((state.seed ^ START_SALT) >>> 0);
  const grit = createRng((state.seed ^ GRIT_SALT) >>> 0);
  for (let i = 0; i < count; i++) {
    const resilience = grit.range(RACE.resilienceBand.min, RACE.resilienceBand.max);
    const pace = state.rng.range(RACE.paceBand.min, RACE.paceBand.max);
    const spec = skisById(state.rng.pick(RACE.skis));
    const spot = at(i);
    const run = rivalRun(state, spec, spot, start.range(0, 2), resilience);
    out.push({
      id: i,
      run,
      pace,
      resilience,
      react: start.range(RACE.reactBand.min, RACE.reactBand.max),
      lane: laneAcross(state.level, spot.x, spot.z),
    });
  }
  return out;
}

/** A RIVAL'S RUN: a whole run of its own over the player's world, on
 * `spec`, stood at `spot`, his first stride `dealt` (its whole part the
 * leg, its fraction the phase) and his `resilience` his own. */
export function rivalRun(
  state: GameState,
  spec: SkiSpec,
  spot: Spawn,
  dealt: number,
  resilience: number,
): GameState {
  const run: GameState = {
    ...state,
    skier: freshSkier(spec),
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
    // The crowd is the world's, stepped once, never a rival's own.
    crowd: undefined,
    // ...and so are the piste machines.
    groomers: undefined,
    field: undefined,
    // Every racer knocks his own poles, and his own stakes.
    gatePoles: freshGatePoles(state.level),
    stakes: undefined,
    events: [],
  };
  standSkier(run, spot.x, spot.z, spot.heading);
  // The stride count's whole part is the leg, its fraction the phase —
  // somewhere in the PUSH: a racer goes on his reaction, and a skate
  // stride is long enough that one dealt into its glide stood a second
  // after GO before he moved.
  run.skier.stride = Math.floor(dealt) + (dealt - Math.floor(dealt)) * TUNING.poles.duty;
  run.skier.resilience = resilience;
  return run;
}

const duelProfiles = new Map<number, BotProfile>();

/** A DUAL'S RIVAL'S BOT (`duel.ts`): the rider's, skiing the mogul line at
 * `share` of the bot's own pace. */
function duelProfile(share: number): BotProfile {
  let p = duelProfiles.get(share);
  if (!p) {
    p = { ...RIDER_BOT, mogulPace: MOGUL_STEER.pace * share };
    duelProfiles.set(share, p);
  }
  return p;
}

/** The controls a rival's bot gives him this step: nothing under the
 * lights or past the flag, the skis held across in the gate until he
 * reacts to GO, then the bot's, its tuck held to his pace. */
export function rivalInput(
  run: GameState,
  rival: Rival,
  sinceGo: number,
  lane: number = rival.lane,
): SkierInput {
  const input =
    run.phase !== "racing"
      ? NEUTRAL_INPUT
      : sinceGo < rival.react
        ? IN_GATE
        : botInput(run, run.level.dualMoguls ? duelProfile(rival.pace) : RIDER_BOT, lane);
  run.input.steer = input.steer;
  run.input.tuck = Math.min(input.tuck, rival.pace);
  run.input.brake = input.brake;
  run.input.lean = input.lean;
  run.input.reset = input.reset;
  return run.input;
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
    // In a ski-cross heat the lane is the pack's to read (`crossLane`).
    const lane = state.cross ? crossLane(state, rival) : rival.lane;
    stepRun(run, rivalInput(run, rival, sinceGo, lane), run.events);
  }
}

/** Push two skiers apart if they overlap; returns the closing speed, m/s.
 * The overlap and the exchange are shared by the RIDERS' weights
 * (`SkiSpec.skierMass` — the skis' few kilos left out, so two riders of a
 * build share them evenly whatever pairs they are on): a heavy rider
 * shoulders a light one off his line and is barely moved himself. */
function clipPair(a: SkierState, b: SkierState): number {
  const B = RACE.bump;
  let worst = 0;
  // Each one's share of what is shared — a half each, to the bit, between
  // two riders of one build.
  const toA = b.spec.skierMass / (a.spec.skierMass + b.spec.skierMass);
  const toB = a.spec.skierMass / (a.spec.skierMass + b.spec.skierMass);
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
      a.x -= nx * pen * toA;
      a.z -= nz * pen * toA;
      b.x += nx * pen * toB;
      b.z += nz * pen * toB;
      const closing = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      if (closing <= 0) continue;
      // The exchange, each rider's change of way by the other's weight.
      const j = (1 + B.restitution) * closing;
      a.vx -= j * toA * nx;
      a.vz -= j * toA * nz;
      b.vx += j * toB * nx;
      b.vz += j * toB * nz;
      if (closing > worst) worst = closing;
    }
  }
  return worst;
}

/** Every skier against every other, once a step, after all have moved.
 * The player's own contacts are reported (`bump`); in a ski-cross heat
 * (`RunRules.knock`) each one is judged as well (`judgeContact`). */
export function clipRiders(state: GameState, events: GameEvent[]): void {
  const n = state.rivals.length;
  if (n === 0) return;
  const me = state.skier;
  const knock = state.rules.knock === true;
  const mine = { run: state, events };
  for (let i = 0; i < n; i++) {
    const r = state.rivals[i];
    const va = knock ? velocityOf(me) : null;
    const vb = knock ? velocityOf(r.run.skier) : null;
    const closing = clipPair(me, r.run.skier);
    if (closing >= RACE.bump.speed && me.bumpCooldown <= 0) {
      me.bumpCooldown = RACE.bump.cooldown;
      events.push({ kind: "bump", t: state.t, rival: r.id, speed: closing });
    }
    const theirs = { run: r.run, events: r.run.events };
    if (va && vb) judgeContact(mine, theirs, closing, va, vb);
    for (let k = i + 1; k < n; k++) {
      const o = state.rivals[k];
      const v1 = knock ? velocityOf(r.run.skier) : null;
      const v2 = knock ? velocityOf(o.run.skier) : null;
      const shoulder = clipPair(r.run.skier, o.run.skier);
      if (v1 && v2) judgeContact(theirs, { run: o.run, events: o.run.events }, shoulder, v1, v2);
    }
  }
}

function velocityOf(c: SkierState): { x: number; y: number; z: number } {
  return { x: c.vx, y: c.vy, z: c.vz };
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
  if (p.out) return { finished: false, time: p.time, progress: -Infinity };
  return { finished: p.finished, time: p.time, progress: p.finished ? 0 : raceProgress(run) };
}

/** THE WHOLE FIELD IN ORDER, best first: every rival's id, and `null`
 * where the player stands among them. */
export function fieldOrder(state: GameState): (number | null)[] {
  if (state.field) return fieldOrderOf(state);
  const runs: { id: number | null; run: GameState }[] = [
    { id: null, run: state },
    ...state.rivals.map((r) => ({ id: r.id, run: r.run })),
  ];
  return orderField(runs, (r) => standing(r.run)).map((r) => r.id);
}

/** THE PLAYER'S PLACE, 1-based: one more than the rivals ahead of him. */
export function racePlace(state: GameState): number {
  if (state.field) return fieldPlace(state);
  return placeAmong(
    standing(state),
    state.rivals.map((r) => standing(r.run)),
  );
}
