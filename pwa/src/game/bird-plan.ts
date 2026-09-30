// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE EVERY BIRD IS — the roster in `bird-defs.ts` laid over the map, and
// where each bird of each flock is at a moment, as plain numbers. `birds.ts`
// turns what comes back into instance matrices; nothing here has heard of
// three.js, which is what lets `tests/birds_test.ts` hold the whole model.
//
// A FLOCK IS A ROUTINE, NOT A POSITION. What is planned is a HOME (a spruce
// crown, a burrow in a meadow's powder, a crag on the ridge), a LOOP in the air
// it flies when it flies, and a CYCLE — so many seconds of rest, so many of
// flight — with a phase of its own. Where any one bird is at time `t` is
// `birdPose`, a pure function of the flock and the clock: give it the same
// arguments twice and it gives the same answer twice, so a seed flies the
// same birds on every ride and a replay puts every one of them back.
//
// THE MODEL, in four layers:
//
//   THE CYCLE. A flock rests at home for most of its cycle and flies for
//   `airShare` of it, scaled by how much DAY there is (`activityAt` — the
//   sun's elevation, so a map ridden into the night rides under birds gone
//   to roost). The flight is a blend from the roost to the loop and back: a
//   raised ramp at each end, so a flock takes off toward its beat and comes
//   back down onto its branch rather than appearing on either.
//
//   THE LOOP. A flying flock walks a closed ellipse at its own airspeed, and
//   every bird holds a station in the flock's frame (`formationOffset`: a
//   crowd, a trailing line or a vee) with a slow WEAVE of its own on top. A
//   soaring bird rises and sinks through its circle, which is a thermal —
//   or, on this ridge, the wind coming up the flank.
//
//   THE WINGS. A beat gate opens for a few strokes and shuts again by how
//   much of its flight a species spends gliding; between bursts the wings
//   sit in their dihedral and rock. At rest they are FOLDED (`fold` → 1).
//
//   THE FLUSH. The one thing here with memory, and it is the caller's: a
//   covey a skier runs at gets up off the snow in a burst and circles low
//   until the skiers have gone, then settles. `birds.ts` remembers when each
//   flock was last flushed and hands the moment in, and so does the audio's
//   `bird-bed.ts` for the whirr of it; both decide the moment with
//   `flushAt`, the rule stated once here, and the model stays pure in its
//   arguments.
//
// CROSSINGS are the other half — the skeins going north on the thaw. They
// belong to the DAY rather than to a place: each is a straight track over a
// point of the loop, backed a long way up its own bearing so it ARRIVES
// rather than appears, held over the highest ground it crosses, and every
// crossing is a pure function of its index, so the sky at any `t` is the
// same sky on every ride — including the crossings already in it on the
// first frame.
//
// The engine's sign conventions hold: heading 0 is +z and grows clockwise
// from above, pitch is NOSE-UP positive, roll right-side-down positive.

import {
  SOUTH,
  TAU,
  fromEuler,
  hash2,
  sunAtRun,
  trackPointAt,
  type GameState,
  type Level,
  type Quat,
  type TrackPoint,
} from "@engine";

import {
  birdById,
  type Band,
  type BirdId,
  type BirdSpec,
  type Formation,
  type Home,
} from "./bird-defs.ts";
import { planBirds } from "./bird-roost.ts";

/** The plan a map was dealt, kept against the level itself: the renderer
 * and the audio both ask, and the ear and the eye agree by construction. */
const plans = new WeakMap<Level, BirdPlan>();

/** THE PLAN FOR A MAP, laid once: what `birds.ts` draws and what the
 * audio's `bird-bed.ts` cries from. `planBirds` is the pure builder. */
export function birdPlanFor(level: Level): BirdPlan {
  let hit = plans.get(level);
  if (hit === undefined) {
    hit = planBirds(level);
    plans.set(level, hit);
  }
  return hit;
}

/** Where a flock lives: what it sits on and where, `y` the height of that
 * perch in the world. */
export type Roost = {
  readonly kind: Home;
  readonly x: number;
  readonly z: number;
  readonly y: number;
};

export type Flock = {
  readonly id: string;
  readonly species: BirdId;
  readonly count: number;
  readonly home: Roost;
  /** How far round the home the birds spread at rest, m. */
  readonly roost: number;
  /** The heading a resting bird faces — into the wind. */
  readonly facing: number;
  /** The beat it flies: the loop's centre, its long semi-axis (m), how
   * squashed it is across that, the heading of the long axis, which way
   * round, the height it holds in the world, and the seconds to go once
   * round at the species' own airspeed. */
  readonly loop: {
    readonly x: number;
    readonly z: number;
    readonly radius: number;
    readonly ovality: number;
    readonly heading: number;
    readonly sense: 1 | -1;
    readonly altitude: number;
    readonly period: number;
  };
  /** One rest-and-flight cycle, s, the share of it flown at full day, and
   * where in the cycle the flock stands at t = 0, 0..1. */
  readonly cycle: number;
  readonly airShare: number;
  readonly phase: number;
  /** The seed every per-bird number is hashed off. */
  readonly scatter: number;
};

/** One skein going over: what, how many, in what shape, its scatter off
 * due north, how high over the highest ground on its track, how fast; the
 * point of the loop it crosses over and the second it gets there. */
export type Crossing = {
  readonly index: number;
  readonly species: BirdId;
  readonly count: number;
  readonly shape: Formation;
  readonly bearing: number;
  readonly height: number;
  readonly speed: number;
  readonly x: number;
  readonly z: number;
  readonly at: number;
  readonly scatter: number;
};

export type BirdPlan = {
  readonly seed: number;
  readonly flocks: readonly Flock[];
  /** Seconds between one crossing and the next, or Infinity on a day
   * nothing crosses. */
  readonly interval: number;
  /** The birds crossing on this day, each repeated by its share, so a
   * hashed pick off the list is a weighted one. */
  readonly crossers: readonly BirdId[];
  /** The map, for a crossing to be pitched over the point of the loop a
   * skier will have reached, and held over the ground it crosses. */
  readonly level: Level;
};

/** Where one bird is and how it is standing. Written into a caller's own
 * object: the renderer asks for a few hundred of these a frame. */
export type BirdPose = {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  q: Quat;
  /** The shoulder's angle off level, rad, up positive. */
  flap: number;
  /** How folded the wing is, 0 open to 1 closed along the flank. */
  fold: number;
  /** 0 at rest, 1 in the air, between the two on the way. */
  airborne: number;
};

export function freshBirdPose(): BirdPose {
  return {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    q: { x: 0, y: 0, z: 0, w: 1 },
    flap: 0,
    fold: 0,
    airborne: 0,
  };
}

/** The most birds one crossing can hold — the instance buffers' ceiling. */
export const MOST_CROSSING_BIRDS = 15;

/** How far up its own bearing a crossing starts before the point it goes
 * over, m, and how far past it it is followed: a skein put down where it is
 * meant to be seen was already there; one backed a kilometre up its track
 * arrives. */
export const CROSSING_LEAD = 1200;
export const CROSSING_PAST = 900;
/** How often a crossing is pitched on a day something crosses, s. At a
 * goose's pace a crossing is two minutes in the sky, so one or two are up at
 * once through a race. */
export const CROSSING_INTERVAL = 50;

/** How fast a skier gets round the loop, m/s — the one thing about a skein
 * that has to be designed rather than dealt, because a skein over the far
 * side of the mountain is a skein nobody saw. The bot's pace, near enough. */
const RUN_PACE = 17;
/** …and how far along the loop a crossing may stray from that point, m. */
const OVER_SPREAD = 260;

/** How the flight blends off the roost and back on, s. */
const RAMP_SECONDS = 6;
/** How far the weave carries a bird off its station, in spans, and the band
 * of periods it runs at, s. */
const WEAVE = 0.35;
const WEAVE_PERIOD: Band = { min: 3, max: 7 };
/** How hard a bird banks into its loop, rad per (m/s)² of lateral
 * acceleration — enough that a wheeling raven shows its wing. */
const BANK = 0.05;
/** The most a bird pitches in level flight, rad. */
const MAX_PITCH = 0.5;
/** How high the SHOULDERS stand over what a resting bird sits on, in body
 * lengths — and how far a grouse sits DOWN in its burrow, the snow up to its
 * back. */
const STAND = 0.16;
const BURROW = -0.02;
/** How the wings sit on a bird at rest. */
const REST_FLAP = -0.3;
/** The wing angles a beat swings between, as shares of the stroke. */
const BEAT_DOWN = 1;
const BEAT_UP = 0.55;
/** A flushed flock: how long it stays up, s, how high it circles over its
 * home, m, how far out, and how close a skier has to come to put it up. */
export const FLUSH_SECONDS = 22;
const FLUSH_HEIGHT = 5;
const FLUSH_OUT = 28;
export const FLUSH_RADIUS = 34;
/** How far apart birds stand in a formation, in spans. */
const SPACING = { across: 1.15, along: 1.5 };
/** A loose flock's spiral (`formationOffset`). */
const LOOSE = { step: 1.1, across: 1.7, lead: 0.7, stagger: 0.7 };
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** The step a heading is read over, s. */
const DT = 0.08;
/** Civil twilight, and the sun a few degrees up: the ends of the ramp a
 * flock's day is read over, rad. */
const NIGHT_BELOW = (-6 * Math.PI) / 180;
const DAY_ABOVE = (4 * Math.PI) / 180;

/** The compass: the noon sun stands in the south, so this is north. */
const NORTH = SOUTH + Math.PI;

export function smooth(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/**
 * HOW MUCH DAY THERE IS for a bird on this map, 0..1: nothing below civil
 * twilight, everything with the sun a few degrees up. Read off the same sun
 * the sky is lit by (`sunAtRun`).
 */
export function activityAt(level: Pick<Level, "sun">): number {
  const sun = sunAtRun(level);
  return smooth((sun.elevation - NIGHT_BELOW) / (DAY_ABOVE - NIGHT_BELOW));
}

/** A deterministic 0..1 from a flock's scatter, a bird's index and a
 * channel — the one source of every per-bird number here. */
export function jitter(scatter: number, i: number, channel: number): number {
  return hash2(i, channel, scatter);
}

/**
 * WHERE ONE BIRD STANDS in the shape, in SPANS: `across` the track (+ is
 * the bird's own right) and `along` it (negative is behind the leader, who
 * is always bird 0 at the origin). A loose flock is laid on a golden-angle
 * spiral, which never repeats and never puts two birds in one place.
 */
export function formationOffset(shape: Formation, i: number): { across: number; along: number } {
  if (i === 0) return { across: 0, along: 0 };
  if (shape === "vee") {
    const rank = Math.ceil(i / 2);
    const side = i % 2 === 1 ? 1 : -1;
    return { across: side * rank * SPACING.across, along: -rank * SPACING.along };
  }
  if (shape === "line") {
    return { across: i * SPACING.across, along: -i * SPACING.along };
  }
  const r = Math.sqrt(i) * LOOSE.step;
  const turn = i * GOLDEN_ANGLE;
  return {
    across: r * Math.cos(turn) * LOOSE.across,
    along: -(LOOSE.lead + r + r * Math.sin(turn) * LOOSE.stagger),
  };
}

/** The beat as an angle, from a phase in strokes: a deep downstroke and a
 * shallow recovery, scaled to the species' own stroke. */
function swingAt(strokes: number, stroke: number): number {
  const beat = Math.sin(strokes * TAU);
  return (beat > 0 ? beat * beat * BEAT_UP : -(beat * beat) * BEAT_DOWN) * stroke;
}

type At = { x: number; y: number; z: number };

/** Where on its loop a flock's leader is at `t`, and the tangent. */
function loopAt(flock: Flock, t: number, out: At): { fx: number; fz: number } {
  const loop = flock.loop;
  const a = flock.phase * TAU + loop.sense * TAU * (t / loop.period);
  const ch = Math.cos(loop.heading);
  const sh = Math.sin(loop.heading);
  const along = loop.radius * Math.cos(a);
  const across = loop.radius * loop.ovality * Math.sin(a);
  out.x = loop.x + along * sh + across * ch;
  out.z = loop.z + along * ch - across * sh;
  const dAlong = -loop.radius * Math.sin(a) * loop.sense;
  const dAcross = loop.radius * loop.ovality * Math.cos(a) * loop.sense;
  const vx = dAlong * sh + dAcross * ch;
  const vz = dAlong * ch - dAcross * sh;
  const n = Math.hypot(vx, vz) || 1;
  return { fx: vx / n, fz: vz / n };
}

/** Every plan point of a flock's loop, `n` of them, to `visit` — what the
 * placer holds the loop's height over. */
export function walkLoop(
  loop: Pick<Flock["loop"], "x" | "z" | "radius" | "ovality" | "heading">,
  n: number,
  visit: (x: number, z: number) => void,
): void {
  const ch = Math.cos(loop.heading);
  const sh = Math.sin(loop.heading);
  for (let i = 0; i < n; i++) {
    const a = (TAU * i) / n;
    const along = loop.radius * Math.cos(a);
    const across = loop.radius * loop.ovality * Math.sin(a);
    visit(loop.x + along * sh + across * ch, loop.z + along * ch - across * sh);
  }
}

/** How far through its flight a flock is at `t`: 0 at rest, 1 on its loop,
 * and the ramps between. */
function flightAt(flock: Flock, t: number, activity: number): number {
  const air = flock.airShare * activity;
  if (air <= 0) return 0;
  const p = t / flock.cycle + flock.phase;
  const u = (p - Math.floor(p)) / air;
  if (u >= 1) return 0;
  const ramp = Math.min(0.45, RAMP_SECONDS / (air * flock.cycle));
  return Math.min(smooth(u / ramp), smooth((1 - u) / ramp));
}

/** How far a flock put up `since` seconds ago is in its flush, 0..1: a
 * quick rise, a long settle, and nothing for a flock already flying its
 * loop (`w`). */
function flushLift(since: number, w: number): number {
  if (!(since >= 0) || since >= FLUSH_SECONDS || w >= 1) return 0;
  const f = since / FLUSH_SECONDS;
  return Math.min(smooth(f / 0.06), smooth((1 - f) / 0.3)) * (1 - w);
}

/** Whether a skier can put a flock up at all: the grouse, which sit tight. */
export function flushable(flock: Flock): boolean {
  return birdById(flock.species).flushes;
}

/**
 * THE FLUSH RULE: when a flock last put up at `last` (or -Infinity) is put
 * up again, given every skier on the map at `state.t` — the player's and
 * the field's, because a covey does not care whose skis they were. Re-armed
 * only once the last flush is over. Returns `last` when nothing happens, so
 * a caller can tell a new flush by the change.
 *
 * Stated once, here, because two things keep this memory and neither can
 * afford to disagree: the renderer (`birds.ts`) and the audio
 * (`audio/bird-bed.ts`).
 */
export function flushAt(flock: Flock, state: GameState, last: number): number {
  if (!flushable(flock)) return last;
  const t = state.t;
  if (t - last <= FLUSH_SECONDS) return last;
  const reach = FLUSH_RADIUS + flock.roost;
  const near = (x: number, z: number): boolean =>
    Math.hypot(flock.home.x - x, flock.home.z - z) < reach;
  if (near(state.skier.x, state.skier.z)) return t;
  for (const r of state.rivals) if (near(r.run.skier.x, r.run.skier.z)) return t;
  return last;
}

/** How much of a flock is IN THE AIR at `t`, 0..1 — what the audio asks to
 * know whether a flock is calling on the wing or muttering at rest. */
export function flightShare(flock: Flock, t: number, activity = 1, flushedAt = -Infinity): number {
  const w = flightAt(flock, t, activity);
  return Math.max(w, flushLift(t - flushedAt, w));
}

/** Where bird `i` of `flock` is at `t`, position only. */
function stationAt(
  spec: BirdSpec,
  flock: Flock,
  i: number,
  t: number,
  activity: number,
  flushedAt: number,
  out: At,
): number {
  // ── At rest ───────────────────────────────────────────────────────────
  const ra = jitter(flock.scatter, i, 1) * TAU;
  const rr = Math.sqrt(jitter(flock.scatter, i, 2)) * flock.roost;
  const restX = flock.home.x + Math.sin(ra) * rr;
  const restZ = flock.home.z + Math.cos(ra) * rr;
  const restY = flock.home.y + spec.length * (flock.home.kind === "snow" ? BURROW : STAND);

  // ── In the air ────────────────────────────────────────────────────────
  const w = flightAt(flock, t, activity);
  let x = restX;
  let y = restY;
  let z = restZ;
  if (w > 0) {
    const { fx, fz } = loopAt(flock, t, out);
    const slot = formationOffset(spec.formation, i);
    const wp =
      WEAVE_PERIOD.min + jitter(flock.scatter, i, 3) * (WEAVE_PERIOD.max - WEAVE_PERIOD.min);
    const wPhase = jitter(flock.scatter, i, 4) * TAU;
    const weave = Math.sin((TAU * t) / wp + wPhase) * WEAVE;
    const across = (slot.across + weave) * spec.span;
    const along = slot.along * spec.span;
    // A soaring bird rides the air up the flank and down again; a beating
    // flock holds its height and every bird takes a little of its own.
    const lift = spec.glide > 0.5 ? Math.sin(t * 0.13 + wPhase) * 8 : 0;
    const own = (jitter(flock.scatter, i, 5) - 0.5) * 2 * spec.span * (i === 0 ? 0 : 1.5);
    const flyX = out.x + fx * along + fz * across;
    const flyY = flock.loop.altitude + own + lift + Math.sin(((TAU * t) / wp) * 0.7 + wPhase) * 0.4;
    const flyZ = out.z + fz * along - fx * across;
    x = restX + (flyX - restX) * w;
    y = restY + (flyY - restY) * w;
    z = restZ + (flyZ - restZ) * w;
  }

  // ── Put up ────────────────────────────────────────────────────────────
  const since = t - flushedAt;
  const wf = flushLift(since, w);
  if (wf > 0) {
    const r = flock.roost + FLUSH_OUT + jitter(flock.scatter, i, 7) * 8;
    const a = ra + (flock.loop.sense * spec.speed * since) / r;
    const fx = flock.home.x + Math.sin(a) * r;
    const fz = flock.home.z + Math.cos(a) * r;
    const fy = restY + FLUSH_HEIGHT + jitter(flock.scatter, i, 8) * 3;
    x += (fx - x) * wf;
    y += (fy - y) * wf;
    z += (fz - z) * wf;
  }
  out.x = x;
  out.y = y;
  out.z = z;
  return Math.max(w, wf);
}

const here: At = { x: 0, y: 0, z: 0 };
const next: At = { x: 0, y: 0, z: 0 };

function writeQuat(out: BirdPose, heading: number, pitch: number, roll: number): void {
  const q = fromEuler(heading, pitch, roll);
  out.q.x = q.x;
  out.q.y = q.y;
  out.q.z = q.z;
  out.q.w = q.w;
}

/**
 * Where bird `i` of `flock` is at time `t`, written into `out`.
 *
 * `t` is the engine's own clock (`state.t`); `activity` is `activityAt` —
 * asked once a frame rather than per bird; `flushedAt` is when the flock
 * was last put up, or -Infinity.
 */
export function birdPose(
  flock: Flock,
  i: number,
  t: number,
  out: BirdPose,
  activity = 1,
  flushedAt = -Infinity,
): BirdPose {
  const spec = birdById(flock.species);
  const w = stationAt(spec, flock, i, t, activity, flushedAt, here);
  stationAt(spec, flock, i, t + DT, activity, flushedAt, next);
  out.x = here.x;
  out.y = here.y;
  out.z = here.z;

  const dx = next.x - here.x;
  const dz = next.z - here.z;
  const dy = next.y - here.y;
  const run = Math.hypot(dx, dz);
  const heading =
    run > 0.01 ? Math.atan2(dx, dz) : flock.facing + (jitter(flock.scatter, i, 10) - 0.5) * 0.7;
  let pitch = run > 0.01 || Math.abs(dy) > 0.01 ? Math.atan2(dy, Math.max(run, 1e-6)) : 0;
  if (pitch > MAX_PITCH) pitch = MAX_PITCH;
  else if (pitch < -MAX_PITCH) pitch = -MAX_PITCH;
  const meanR = flock.loop.radius * (0.5 + 0.5 * flock.loop.ovality);
  const roll =
    w >= 1 ? -flock.loop.sense * BANK * ((spec.speed * spec.speed) / Math.max(5, meanR)) : 0;

  // ── The wings ─────────────────────────────────────────────────────────
  const phase = jitter(flock.scatter, i, 11) * TAU;
  const gateThreshold = 1 - 2 * (1 - spec.glide);
  let gate =
    spec.glide <= 0 ? 1 : smooth((Math.sin(t * 0.45 + phase) - gateThreshold + 0.15) / 0.3);
  // Getting up is all beating.
  gate = Math.max(gate, 1 - w);
  const swing = swingAt(t * spec.beatHz + phase / TAU, spec.stroke);
  const rock = spec.glide > 0.5 ? Math.sin(t * 1.3 + phase * 1.7) * 0.06 : 0;
  const flyFlap = spec.dihedral + rock * (1 - gate) + swing * gate;
  const open = smooth(w * 3);
  out.flap = REST_FLAP + (flyFlap - REST_FLAP) * open;
  out.fold = 1 - open;
  out.airborne = w;
  out.heading = heading;
  out.pitch = pitch;
  out.roll = roll;
  writeQuat(out, heading, pitch, roll);
  return out;
}

/** How long the slowest crossing is in the sky, s. */
function longestCrossing(plan: BirdPlan): number {
  let slowest = Infinity;
  for (const id of plan.crossers) slowest = Math.min(slowest, birdById(id).speed * 0.95);
  return (CROSSING_LEAD + CROSSING_PAST) / slowest;
}

const over: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };

/** The `k`-th crossing this map's day deals, or null on a day nothing
 * crosses. A pure function of the index: the crossings before t = 0 are as
 * real as the ones after it, which is what puts birds in the sky on the
 * first frame. */
export function crossingAt(plan: BirdPlan, k: number): Crossing | null {
  if (plan.crossers.length === 0 || !Number.isFinite(plan.interval)) return null;
  const r = (channel: number): number => hash2(k, channel, plan.seed);
  const species = plan.crossers[Math.floor(r(1) * plan.crossers.length)];
  const passage = birdById(species).passage;
  if (!passage) return null;
  const spec = birdById(species);
  const shape = passage.shapes[Math.floor(r(2) * passage.shapes.length)];
  const count = passage.birds.min + Math.floor(r(3) * (passage.birds.max - passage.birds.min + 1));
  const speed = spec.speed * (0.95 + r(7) * 0.15);
  const at = k * plan.interval + r(8) * plan.interval * 0.8;
  // Over the point of the loop a skier at race pace has reached by the time
  // this crossing gets there, give or take.
  const along = RUN_PACE * (at + CROSSING_LEAD / speed) + (r(4) - 0.5) * OVER_SPREAD;
  trackPointAt(plan.level, along, over);
  const bearing = NORTH + (r(5) - 0.5) * 0.5;
  // Held over the highest ground anywhere on its track, so a skein going
  // over the ridge clears it.
  const size = plan.level.size;
  const onMap = (v: number): number => Math.min(Math.max(v, 0), size);
  let ceiling = -Infinity;
  for (let d = -CROSSING_LEAD; d <= CROSSING_PAST; d += 150) {
    const x = onMap(over.x + Math.sin(bearing) * d);
    const z = onMap(over.z + Math.cos(bearing) * d);
    ceiling = Math.max(ceiling, plan.level.groundAt(x, z));
  }
  return {
    index: k,
    species,
    count: Math.min(count, MOST_CROSSING_BIRDS),
    shape,
    bearing,
    height: ceiling + passage.height.min + r(6) * (passage.height.max - passage.height.min),
    speed,
    x: over.x,
    z: over.z,
    at,
    scatter: Math.floor(r(9) * 0x7fffffff) + 1,
  };
}

/** How long a crossing is in the sky, s. */
export function crossingSeconds(crossing: Crossing): number {
  return (CROSSING_LEAD + CROSSING_PAST) / crossing.speed;
}

/** Every crossing in the sky at `t`, to `visit`. */
export function forEachCrossing(plan: BirdPlan, t: number, visit: (c: Crossing) => void): void {
  if (!Number.isFinite(plan.interval) || plan.crossers.length === 0) return;
  const from = Math.floor((t - longestCrossing(plan)) / plan.interval) - 1;
  const to = Math.floor(t / plan.interval);
  for (let k = from; k <= to; k++) {
    const c = crossingAt(plan, k);
    if (!c) continue;
    const flown = t - c.at;
    if (flown >= 0 && flown <= crossingSeconds(c)) visit(c);
  }
}

/** Where bird `i` of a crossing is at `t`, written into `out`. Straight and
 * level on its bearing, in its shape, with the wingbeat running down the
 * line as a wave rather than striking together. */
export function crossingPose(crossing: Crossing, i: number, t: number, out: BirdPose): BirdPose {
  const spec = birdById(crossing.species);
  const bearing = crossing.bearing;
  const dirX = Math.sin(bearing);
  const dirZ = Math.cos(bearing);
  const rightX = Math.cos(bearing);
  const rightZ = -Math.sin(bearing);
  const flown = (t - crossing.at) * crossing.speed;
  const lx = crossing.x + dirX * (flown - CROSSING_LEAD);
  const lz = crossing.z + dirZ * (flown - CROSSING_LEAD);
  const slot = formationOffset(crossing.shape, i);
  const age = t - crossing.at;
  const phase = jitter(crossing.scatter, 0, 12) * TAU;
  const wave = age * 1.1 - i * 0.55 + phase;
  const across = (slot.across + Math.sin(wave * 0.7) * 0.22) * spec.span;
  const along = (slot.along + Math.cos(wave * 0.5) * 0.2) * spec.span;
  const lift = Math.sin(age * 0.16 + phase) * 6;
  out.x = lx + rightX * across + dirX * along;
  out.z = lz + rightZ * across + dirZ * along;
  out.y = crossing.height + lift + Math.sin(wave * 0.9) * 0.7;
  out.heading = bearing;
  out.pitch = 0;
  out.roll = 0;
  const strokes = age * spec.beatHz - i * 0.13 + phase / TAU;
  const gate =
    spec.glide <= 0
      ? 1
      : smooth((Math.sin(age * 0.45 + phase) - (1 - 2 * (1 - spec.glide)) + 0.15) / 0.3);
  out.flap = spec.dihedral + swingAt(strokes, spec.stroke) * gate;
  out.fold = 0;
  out.airborne = 1;
  writeQuat(out, bearing, 0, 0);
  return out;
}

/** How many resident birds a plan holds of a species — an instance budget. */
export function residentCount(plan: BirdPlan, id: BirdId): number {
  let n = 0;
  for (const f of plan.flocks) if (f.species === id) n += f.count;
  return n;
}

/** The most birds of a species that can be CROSSING at once. */
export function crossingCapacity(plan: BirdPlan, id: BirdId): number {
  if (!plan.crossers.includes(id) || !Number.isFinite(plan.interval)) return 0;
  const overlap = Math.ceil(longestCrossing(plan) / plan.interval) + 2;
  return overlap * Math.min(MOST_CROSSING_BIRDS, birdById(id).passage?.birds.max ?? 0);
}
