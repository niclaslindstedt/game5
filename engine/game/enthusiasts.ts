// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ENTHUSIASTS — the few keen skiers still out on a free ride's ski area
// after dark, when the crowd (`crowd.ts`) has gone in (`ENTHUSIASTS` in
// `defs/enthusiasts.ts`).
//
// AN ENTHUSIAST IS A RIVAL WITHOUT A RACE. Each is a whole run of his own
// over the player's world (`rivals.ts`' `rivalRun`), stepped by the very
// function the player is (`run.ts`), skied by the very bot the sim skis
// (`sim/bot.ts`) — so he carves, tucks, takes air, falls and is stood up
// exactly as the player would, and the renderer draws him as it draws the
// player: the full figure, his skis, his tracks and his headlamp. What makes
// him himself is dealt once, off a stream of the enthusiasts' own: a pair of
// the six (`ENTHUSIASTS.skis`), a build (`RIDERS`), a pace, a lane, and a
// LOOK the app deals his outfit off (the engine never reads it).
//
// HE LAPS THE SKI AREA. The bot skis a piste down its line; an enthusiast
// hands it ONE RUN of the crowd's network at a time (`crowdNet`) — the bot
// reads a copy of the map whose piste is that run (`lineOf`) — and, near
// its end, the run it merges into. At the village he lets the run-out
// carry him to a stop, rests, and goes up a LIFT again (`arriveByLift`):
// carried the last stretch to the top of a run he picks off it, stood off
// down its ramp and skiing it. A skier stood still too long or lost far off
// his run goes up the same way. He is only ever MOVED where the player
// cannot see him go — from where he stands, and to where he will be — and
// otherwise waits.
//
// No draw here touches `state.rng`: the deal is a stream of its own
// (`ENTHUSIAST_SALT`) and every later pick a stream seeded off his look and
// how many laps he has skied. A run without enthusiasts — every run but a
// free ride after dark — is the run it always was.

import { createRng, type Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { nearestTrackPoint } from "../mapgen/index.ts";
import type { Level, SummitRamp, TrackHit, TrackPoint } from "../mapgen/types.ts";
import { botInput, RIDER_BOT } from "../sim/bot.ts";
import { sunAtRun } from "./clock.ts";
import { standSkier } from "./course.ts";
import { crowdNet, type CrowdNet, type NetRun } from "./crowd.ts";
import { ENTHUSIASTS } from "./defs/enthusiasts.ts";
import { RACE } from "./defs/modes.ts";
import { RIDERS, withRider } from "./defs/riders.ts";
import { skisById } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import { arriveByLift } from "./lift-ride.ts";
import { rivalRun } from "./rivals.ts";
import { noteRun } from "./skied.ts";
import { stepRun } from "./run.ts";
import { NEUTRAL_INPUT, type GameState, type Rival, type SkierInput } from "./state.ts";
import type { FreeRider } from "./enthusiast-state.ts";

const K = ENTHUSIASTS;
const dt = TUNING.dt;

/** What the enthusiasts' stream is seeded with beside the run's seed. */
const ENTHUSIAST_SALT = 0x3e7a51;

/** WHETHER IT IS NIGHT on the ski area at the map's hour: the sun under
 * `ENTHUSIASTS.night`, when the crowd has gone in. */
export function nightOver(level: Pick<Level, "sun">): boolean {
  return sunAtRun(level).elevation < K.night;
}

const lines = new WeakMap<object, Level>();
const hit: TrackHit = { index: 0, s: 0, distance: 0, lateral: 0, x: 0, z: 0 };

/** Run `r`'s line — from the head of `ramp` when he comes off a top down
 * one (`Lift.ramps`): the ramp from the pad's rim to where it joins the run,
 * then the run on from there, as one piste. */
function pointsOf(level: Level, r: NetRun, ramp: SummitRamp | undefined): TrackPoint[] {
  if (!ramp) return r.pts as TrackPoint[];
  const dx = ramp.to.x - ramp.from.x;
  const dz = ramp.to.z - ramp.from.z;
  const long = hypot(dx, dz);
  const heading = Math.atan2(dx, dz);
  const out: TrackPoint[] = [];
  for (let d = 0; d < long; d += RAMP_STEP) {
    const x = ramp.from.x + (dx * d) / long;
    const z = ramp.from.z + (dz * d) / long;
    out.push({ x, z, y: level.groundAt(x, z), s: d, heading, width: ramp.width });
  }
  for (const p of r.pts) if (p.s >= ramp.to.s) out.push({ ...p, s: long + p.s - ramp.to.s });
  return out.length >= 2 ? out : (r.pts as TrackPoint[]);
}

/** How far apart a ramp's stations are, m — the piste's own spacing. */
const RAMP_STEP = 2;

/** THE MAP AS THE BOT READS IT ON RUN `r` (down `ramp` onto it, when he
 * comes off a top): the map itself, its piste that line — its kickers and
 * drops on it read at its own arc, no course set on it, and two plain gates
 * at its two ends where the bot asks for a gate. */
function lineOf(level: Level, r: NetRun, ramp?: SummitRamp): Level {
  const key = ramp ?? r;
  const cached = lines.get(key);
  if (cached && cached.groundAt === level.groundAt) return cached;
  const points = pointsOf(level, r, ramp);
  const track = { points, length: points[points.length - 1].s, closed: false as const };
  const on = { track };
  const across = <T extends { x: number; z: number; s?: number }>(k: T): T[] => {
    nearestTrackPoint(on, k.x, k.z, hit);
    return hit.distance <= points[hit.index].width / 2 ? [{ ...k, s: hit.s }] : [];
  };
  const head = points[0];
  const foot = points[points.length - 1];
  const gate = (p: TrackPoint, colour: "red" | "blue") => ({
    x: p.x,
    z: p.z,
    y: p.y,
    heading: p.heading,
    width: p.width,
    s: p.s,
    colour,
  });
  const line: Level = {
    ...level,
    track,
    checkpoints: [gate(head, "red"), gate(foot, "blue")],
    kickers: (level.kickers ?? []).flatMap(across),
    cliffs: (level.cliffs ?? []).filter((c) => c.onTrack).flatMap(across),
    slalom: undefined,
    downhill: undefined,
    superG: undefined,
    giantSlalom: undefined,
    speedSki: undefined,
    skiCross: undefined,
    bigAir: undefined,
    slopestyle: undefined,
    halfpipe: undefined,
    moguls: undefined,
    aerials: undefined,
  };
  lines.set(key, line);
  return line;
}

/** The ramp off the top of run `r`'s lift down onto it, if it has one. */
function rampOf(level: Level, r: NetRun): SummitRamp | undefined {
  return level.resort?.lifts.find((l) => l.id === r.from)?.ramps?.find((p) => p.run === r.id);
}

/** How keen an enthusiast is on run `r` as a run to pick off a top: a run
 * that leaves one, by its colour; never a lane. */
function keenOn(r: NetRun): number {
  return r.top && r.grade !== "road" ? K.grade[r.grade] : 0;
}

/** A run picked off the network by keenness, among those `may` allows; -1
 * when there is none. */
function pickRun(rng: Rng, net: CrowdNet, may: (r: NetRun) => boolean): number {
  let total = 0;
  for (const r of net.runs) if (may(r)) total += keenOn(r);
  if (total <= 0) return -1;
  let x = rng.next() * total;
  for (let i = 0; i < net.runs.length; i++) {
    const r = net.runs[i];
    if (!may(r)) continue;
    x -= keenOn(r);
    if (x <= 0 && keenOn(r) > 0) return i;
  }
  return net.runs.findIndex((r) => may(r) && keenOn(r) > 0);
}

/** DEAL THE ENTHUSIASTS: `count` of them, each stood part-way down a run he
 * picked, on his own pair at his own build, appended to the run's rivals.
 * Called once, from `createGame`, on a free ride after dark. */
export function dealEnthusiasts(state: GameState, count: number): void {
  const net = crowdNet(state.level);
  if (net.runs.length === 0) return;
  const rng = createRng((state.seed ^ ENTHUSIAST_SALT) >>> 0);
  for (let i = 0; i < count; i++) {
    const rider = rng.pick(RIDERS);
    const spec = withRider(skisById(rng.pick(K.skis)), rider);
    // Each on a run of his own while there are runs enough.
    const taken = new Set(state.rivals.map((x) => x.free?.run));
    const fresh = pickRun(rng, net, (r) => !taken.has(net.runs.indexOf(r)));
    const pick = fresh >= 0 ? fresh : pickRun(rng, net, () => true);
    const at = pick < 0 ? 0 : pick;
    const r = net.runs[at];
    const p = r.pts[Math.floor(rng.range(0.15, 0.7) * (r.pts.length - 1))];
    const lane = rng.range(-K.lane, K.lane);
    const d = Math.max(-p.width / 3, Math.min(p.width / 3, lane));
    const spot = {
      x: p.x + Math.cos(p.heading) * d,
      z: p.z - Math.sin(p.heading) * d,
      heading: p.heading,
    };
    const resilience = rng.range(RACE.resilienceBand.min, RACE.resilienceBand.max);
    const run = rivalRun(state, spec, spot, rng.range(0, 2), resilience);
    // The world's machines and the player's own rides are stepped once, by
    // the player's run: an enthusiast skis.
    run.heli = undefined;
    run.sled = undefined;
    run.para = undefined;
    run.afterski = undefined;
    run.grimbear = undefined;
    state.rivals.push({
      id: state.rivals.length,
      run,
      pace: rng.range(K.pace[0], K.pace[1]),
      resilience,
      react: 0,
      lane,
      free: {
        look: (rng.next() * 0x7fffffff) >>> 0,
        rider: rider.id,
        run: at,
        still: 0,
        laps: 0,
        down: false,
        ramped: false,
        on: true,
        unload: 0,
      },
    });
  }
}

/** Whether (x, z) is out of the player's sight: far enough from him. */
function unseen(state: GameState, x: number, z: number): boolean {
  return hypot(x - state.skier.x, z - state.skier.z) >= K.unseen;
}

/** UP AGAIN: the enthusiast carried the last stretch up the lift serving a
 * run he picks, where neither where he stands nor the top he goes to is in
 * the player's sight; false, and nothing done, when no such run is. */
function goUp(state: GameState, rival: Rival, net: CrowdNet): boolean {
  const run = rival.run;
  const f = rival.free;
  const c = run.skier;
  if (!f || !unseen(state, c.x, c.z)) return false;
  const rng = createRng((f.look ^ Math.imul(f.laps + 1, 0x9e3779b1)) >>> 0);
  const resort = state.level.resort;
  if (!resort) {
    // A map from before the ski areas: its one piste, from its head.
    const head = state.level.track.points[0];
    if (!unseen(state, head.x, head.z)) return false;
    standSkier(run, head.x, head.z, head.heading);
  } else {
    const lifts = new Map(resort.lifts.map((l) => [l.id, l]));
    const up = (chair: boolean) => (r: NetRun) => {
      const lift = lifts.get(r.from);
      return (
        lift !== undefined &&
        (!chair || lift.kind === "chair") &&
        unseen(state, lift.top.x, lift.top.z)
      );
    };
    // A chair first: he rides it sat, as the player does.
    const chaired = pickRun(rng, net, up(true));
    const pick = chaired >= 0 ? chaired : pickRun(rng, net, up(false));
    if (pick < 0) return false;
    const id = arriveByLift(run, c.x, c.z, net.runs[pick].id);
    if (id === null) return false;
    const at = net.runs.findIndex((r) => r.id === id);
    f.run = at < 0 ? pick : at;
    f.ramped = true;
    // The runs he skied before are behind him: a fall now is stood up on
    // the one he is going to ski (`skied.ts`).
    run.progress.skied.length = 0;
    noteRun(run, id);
  }
  f.on = false;
  f.laps += 1;
  f.still = 0;
  f.down = false;
  return true;
}

const COAST: SkierInput = { ...NEUTRAL_INPUT, brake: K.brake };
const UNLOAD: SkierInput = { ...NEUTRAL_INPUT, tuck: K.brake / 2 };

/** The controls an enthusiast skis on this step: his run's line, skied by
 * the bot with his tuck held to his pace — handed on to the run it merges
 * into near its end, ridden to a stop at the village and up a lift again,
 * and up a lift too when he is lost. */
function enthusiastInput(state: GameState, rival: Rival, net: CrowdNet): SkierInput {
  const run = rival.run;
  const f = rival.free as FreeRider;
  const c = run.skier;
  const r = net.runs[f.run] ?? net.runs[0];
  const line = lineOf(state.level, r, f.ramped ? rampOf(state.level, r) : undefined);
  const L = line.track.length;
  nearestTrackPoint(line, c.x, c.z, hit);
  if (hit.distance <= line.track.points[hit.index].width / 2) f.on = true;
  if (r.into && r.into.run >= 0 && hit.s > L - K.merge) {
    f.run = r.into.run;
    f.ramped = false;
  } else if (!r.into && hit.s > L - K.stop) f.down = true;
  // Down at the village he rests from the moment the run-out has all but
  // stopped him — the skis held across, so he does not skate on. Off his
  // run he is lost only once he has been on it: off a top he is still
  // finding it.
  const still = c.speed < (f.down ? K.rested : K.still) || (f.on && hit.distance > K.lost.off);
  f.still = still ? f.still + dt : 0;
  if (f.down) {
    if (f.still > K.rest && goUp(state, rival, net)) return NEUTRAL_INPUT;
    return COAST;
  }
  if (f.still > K.lost.still && goUp(state, rival, net)) return NEUTRAL_INPUT;
  const input = botInput({ ...run, level: line }, RIDER_BOT, rival.lane);
  return { ...input, tuck: Math.min(input.tuck, rival.pace) };
}

/** Step every enthusiast by the step the world has just taken. */
export function stepEnthusiasts(state: GameState): void {
  if (state.rivals.length === 0) return;
  const net = crowdNet(state.level);
  for (const rival of state.rivals) {
    if (!rival.free) continue;
    const run = rival.run;
    run.t = state.t;
    run.tick = state.tick;
    run.fresh = state.fresh;
    run.countdown = state.countdown;
    run.phase = state.phase === "countdown" ? "countdown" : "racing";
    run.events.length = 0;
    const c = run.skier;
    const f = rival.free;
    // Stood off a chair he skis straight down the unload ramp, clear of the
    // chairs swinging round behind him, before he looks for his run.
    if (c.lift) f.unload = K.unload;
    else f.unload = Math.max(0, f.unload - dt);
    const input =
      run.phase !== "racing" || c.lift || c.thrown
        ? NEUTRAL_INPUT
        : f.unload > 0
          ? UNLOAD
          : enthusiastInput(state, rival, net);
    run.input.steer = input.steer;
    run.input.tuck = input.tuck;
    run.input.brake = input.brake;
    run.input.lean = input.lean;
    run.input.reset = input.reset;
    stepRun(run, input, run.events);
  }
}
