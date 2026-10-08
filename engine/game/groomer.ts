// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE MACHINES — the big tracked snow groomers that work a ski
// area's runs at night (`RunRules.groomer`, `docs/piste-machine.md`). On a
// free ride after dark (`groomersOut`) a fleet sized to the ski area is
// out (`groomerCount`: one to every few runs, three to six), each on a run
// of its own dealt off the machines' own stream as the ride starts, working it in LANES: down one the width of the tiller, a pivot on
// the tracks at the bottom onto the next, up that one, a pivot at the top,
// and so across the run and back. Behind the tiller the snow is milled,
// pressed and combed — the swath it lays (`GroomerState.swath`) is what
// the renderer stamps fresh corduroy along and what the physics packs
// (`groomed.ts`) — and ahead of the blade is the day's skied-up piste. When
// the ride starts each has already worked a part of its night.
//
// TAKEN: a skier stood beside one gives the machine press (ENTER, a double
// tap on touch) and he is up in its cab and driving it — the tuck forward,
// the back key in reverse, the edge pivots it on its tracks — up the run or
// down it or anywhere, the tiller laying corduroy wherever it goes forward.
// The same press puts him back down on his skis beside the cab; the machine
// stands where he left it, engine running and lamps lit.
//
// RIDDEN INTO — or met by its blade — it is twelve tonnes of steel: a
// skier closing on it faster than a shuffle is knocked down (the `groomer`
// crash cause) and the body takes the blow (`body.ts`); slower, he is held
// off it as off a wall.
//
// Deterministic: every draw is off the machines' own stream
// (`GROOMER_SALT`), never `state.rng`, and only as the ride starts. A run
// without them never comes in here.

import { clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import type { Level } from "../mapgen/types.ts";
import { sunAtRun } from "./clock.ts";
import { standSkier } from "./course.ts";
import { crowdNet, sampleRun, type Along, type NetRun } from "./crowd.ts";
import { GROOMER } from "./defs/groomer.ts";
import { TUNING } from "./defs/tuning.ts";
import { freshGroomed, groomSegment } from "./groomed.ts";
import type { GroomerState } from "./groomer-state.ts";
import { solidsNear, solidsOf } from "./posts.ts";
import { derive } from "./skier.ts";
import type { GameEvent, GameState, SkierInput } from "./state.ts";

const K = GROOMER;
const dt = TUNING.dt;

/** The machines' stream's salt off the run's seed — no other shares it. */
const GROOMER_SALT = 0x9a2c7e31;

/** Whether a free ride's machines are out: `night` after dark only (the
 * app's ordinary ask), `on` whatever the hour (a lab, a link), `off` never. */
export type GroomerAsk = "night" | "on" | "off";

/** WHETHER THE MACHINES WORK THIS RIDE: asked for, and — on the ordinary
 * ask — the sun under `GROOMER.night` at the map's hour. */
export function groomersOut(level: Pick<Level, "sun">, ask: GroomerAsk | undefined): boolean {
  if (!ask || ask === "off") return false;
  return ask === "on" || sunAtRun(level).elevation < K.night;
}

const along: Along = { x: 0, z: 0, heading: 0, width: 0, pitch: 0, bend: 0 };

/** How far right of the run's line lane `lane` of `lanes` runs where the
 * run is `width` wide, m. */
function laneOffset(lane: number, lanes: number, width: number): number {
  return ((lane + 0.5) / lanes - 0.5) * Math.max(0, width - K.swath * 0.6);
}

/** Where on lane `lane` of its run a machine stands at arc `s`. */
function lanePoint(g: GroomerState, r: NetRun, s: number, lane: number): { x: number; z: number } {
  sampleRun(r, s, along);
  const d = laneOffset(lane, g.lanes, along.width);
  return { x: along.x + Math.cos(along.heading) * d, z: along.z - Math.sin(along.heading) * d };
}

/** HOW MANY MACHINES a ski area with `runs` runs long enough to groom puts
 * out: one to every `GROOMER.count.perRuns` of them, at least `least` and
 * at most `most`, and never more than there are runs. A pure function of
 * the map, so it draws nothing off the machines' stream. */
export function groomerCount(runs: number): number {
  const C = K.count;
  return Math.min(runs, clamp(Math.round(runs / C.perRuns), C.least, C.most));
}

/** THE MACHINES a night's free ride starts with: each on a run of its own,
 * dealt off their stream, part of its night's work done. */
export function freshGroomers(state: GameState): GroomerState[] {
  const rng = createRng((state.seed ^ GROOMER_SALT) >>> 0);
  const net = crowdNet(state.level);
  const pool: number[] = [];
  net.runs.forEach((r, i) => {
    if (r.grade !== "road" && r.length >= K.shortest && r.pts.length > 4) pool.push(i);
  });
  const out: GroomerState[] = [];
  state.groomed = freshGroomed();
  const count = groomerCount(pool.length);
  while (out.length < count && pool.length > 0) {
    const run = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
    const r = net.runs[run];
    let width = 0;
    for (const p of r.pts) width += p.width;
    width /= r.pts.length;
    const lanes = Math.max(1, Math.round(width / (K.swath - K.overlap)));
    const g: GroomerState = {
      id: out.length,
      mode: "groom",
      run,
      lanes,
      lane: Math.floor(rng.next() * lanes),
      step: rng.next() < 0.5 ? 1 : -1,
      dir: 1,
      s: K.margin,
      x: 0,
      y: 0,
      z: 0,
      heading: 0,
      pitch: 0,
      roll: 0,
      speed: K.work,
      tiller: true,
      swath: [],
      lastX: Number.NaN,
      lastZ: Number.NaN,
      turn: { x0: 0, z0: 0, h0: 0, x1: 0, z1: 0, h1: 0, k: 0 },
      rider: false,
      drive: 0,
      steer: 0,
      t: 0,
    };
    place(state, g, r);
    // THE NIGHT SO FAR: worked from the top of a lane, in coarse steps,
    // through a share of a few lanes and the pivots between them.
    const pass = Math.max(1, r.length - 2 * K.margin) / K.work;
    const worked = rng.range(0.25, Math.min(K.doneLanes, lanes) + 0.85) * pass;
    const coarse = 0.25;
    for (let t = 0; t < worked; t += coarse) work(state, g, r, coarse);
    g.speed = g.mode === "groom" ? (g.dir > 0 ? K.work : K.climb) : 0;
    out.push(g);
  }
  return out;
}

/** Stand a working machine on its lane at its arc, facing its way. */
function place(state: GameState, g: GroomerState, r: NetRun): void {
  const p = lanePoint(g, r, g.s, g.lane);
  g.x = p.x;
  g.z = p.z;
  g.heading = along.heading + (g.dir < 0 ? Math.PI : 0);
  settle(state, g);
}

/** Sit the machine on the snow under it: on its tracks' run and across
 * them. */
function settle(state: GameState, g: GroomerState): void {
  const level = state.level;
  const fx = Math.sin(g.heading);
  const fz = Math.cos(g.heading);
  const L = K.tracks.length / 2;
  const W = K.tracks.span / 2 - K.tracks.width / 2;
  g.y = level.groundAt(g.x, g.z);
  g.pitch = Math.atan2(
    level.groundAt(g.x + fx * L, g.z + fz * L) - level.groundAt(g.x - fx * L, g.z - fz * L),
    2 * L,
  );
  g.roll = Math.atan2(
    level.groundAt(g.x - fz * W, g.z + fx * W) - level.groundAt(g.x + fz * W, g.z - fx * W),
    2 * W,
  );
}

/** THE SWATH: with the tiller down, a segment laid from the last point to
 * where the tiller's end is now, once it is `GROOMER.step` m on — and the
 * snow under it groomed. */
function lay(state: GameState, g: GroomerState): void {
  if (!g.tiller) {
    g.lastX = Number.NaN;
    return;
  }
  const back = K.tiller.behind - 0.4;
  const tx = g.x - Math.sin(g.heading) * back;
  const tz = g.z - Math.cos(g.heading) * back;
  if (Number.isNaN(g.lastX)) {
    g.lastX = tx;
    g.lastZ = tz;
    return;
  }
  if (hypot(tx - g.lastX, tz - g.lastZ) < K.step) return;
  g.swath.push(g.lastX, g.lastZ, tx, tz);
  if (state.groomed) {
    groomSegment(state.groomed, g.lastX, g.lastZ, tx, tz, K.tiller.width / 2, state.fresh);
  }
  g.lastX = tx;
  g.lastZ = tz;
}

const smooth = (k: number): number => k * k * (3 - 2 * k);

/** ONE STEP OF A MACHINE AT WORK, `h` s long: down or up its lane at its
 * pace, or pivoting round onto the next at a lane's end. */
function work(state: GameState, g: GroomerState, r: NetRun, h: number): void {
  g.t += h;
  if (g.mode === "turn") {
    const T = g.turn;
    T.k = Math.min(1, T.k + (h * K.turn) / Math.PI);
    const e = smooth(T.k);
    g.x = T.x0 + (T.x1 - T.x0) * e;
    g.z = T.z0 + (T.z1 - T.z0) * e;
    g.heading = T.h0 + (T.h1 - T.h0) * e;
    g.speed = 0;
    settle(state, g);
    if (T.k >= 1) {
      g.mode = "groom";
      g.t = 0;
      g.tiller = true;
    }
    return;
  }
  const want = g.dir > 0 ? K.work : K.climb;
  g.speed += clamp(want - g.speed, -K.accel * h, K.accel * h);
  g.s += g.dir * g.speed * h;
  const top = K.margin;
  const bottom = Math.max(top + 1, r.length - K.margin);
  if ((g.dir > 0 && g.s >= bottom) || (g.dir < 0 && g.s <= top)) {
    g.s = clamp(g.s, top, bottom);
    place(state, g, r);
    lay(state, g);
    pivot(g, r);
    return;
  }
  place(state, g, r);
  lay(state, g);
}

/** AT A LANE'S END: the tiller lifted, a pivot on the tracks onto the next
 * lane — across the run and back — swung toward it, the way reversed. */
function pivot(g: GroomerState, r: NetRun): void {
  let next = g.lane + g.step;
  if (next < 0 || next >= g.lanes) {
    g.step = -g.step;
    next = g.lanes > 1 ? g.lane + g.step : g.lane;
  }
  const to = lanePoint(g, r, g.s, next);
  const dx = to.x - g.x;
  const dz = to.z - g.z;
  // Swung toward the new lane: the half-way heading faces it.
  const right = Math.sin(g.heading + Math.PI / 2) * dx + Math.cos(g.heading + Math.PI / 2) * dz;
  const sign = right >= 0 ? 1 : -1;
  g.turn = {
    x0: g.x,
    z0: g.z,
    h0: g.heading,
    x1: to.x,
    z1: to.z,
    h1: g.heading + sign * Math.PI,
    k: 0,
  };
  g.lane = next;
  g.dir = -g.dir;
  g.mode = "turn";
  g.t = 0;
  g.tiller = false;
  g.lastX = Number.NaN;
}

/** The player's skier is out on his own skis: not thrown, not carried by a
 * lift, a tunnel's wind, a rail or another machine. */
export function onSkis(state: GameState): boolean {
  const c = state.skier;
  if (c.thrown || c.lift || c.tunnel || c.jib) return false;
  if (state.heli?.rider || state.sled?.rider) return false;
  // Under a paramotor's wing the press releases the rig (`para.ts`).
  if (state.para && state.para.mode !== "dropped") return false;
  return !state.groomers?.some((g) => g.rider);
}

/** A point against a machine's footprint: how far along it (forward of the
 * middle) and right of it, m, and how far outside it (0 inside). */
function footprintOf(g: GroomerState, x: number, z: number): { u: number; v: number; out: number } {
  const fx = Math.sin(g.heading);
  const fz = Math.cos(g.heading);
  const dx = x - g.x;
  const dz = z - g.z;
  const u = dx * fx + dz * fz;
  const v = dx * fz - dz * fx;
  const ou = Math.max(0, u - K.front, -K.back - u);
  const ov = Math.max(0, Math.abs(v) - K.half);
  return { u, v, out: hypot(ou, ov) };
}

/** WHICH MACHINE THE PRESS PUTS HIM IN: one within `board.reach` of his
 * skis, met slower than `board.fastest` — the nearest — or null. What the
 * HUD offers the press on is this same question. */
export function groomerWithin(state: GameState): GroomerState | null {
  const gs = state.groomers;
  if (!gs || !onSkis(state)) return null;
  const c = state.skier;
  let best: GroomerState | null = null;
  let near = Infinity;
  for (const g of gs) {
    const f = footprintOf(g, c.x, c.z);
    if (f.out > K.board.reach || f.out >= near) continue;
    const fx = Math.sin(g.heading) * g.speed;
    const fz = Math.cos(g.heading) * g.speed;
    if (hypot3(c.vx - fx, c.vy, c.vz - fz) > K.board.fastest) continue;
    best = g;
    near = f.out;
  }
  return best;
}

const near: number[] = [];

/** A DRIVEN MACHINE AGAINST THE TRUNKS: pushed back out of any its
 * footprint has gone into, and stopped. */
function trees(state: GameState, g: GroomerState): void {
  const level = state.level;
  const solids = solidsOf(level);
  if (solids.length === 0) return;
  solidsNear(level, g.x, g.z, K.back + K.half + 1, near);
  const fx = Math.sin(g.heading);
  const fz = Math.cos(g.heading);
  for (const i of near) {
    const t = solids[i];
    const f = footprintOf(g, t.x, t.z);
    if (f.out >= t.radius) continue;
    // Out along whichever face is nearest, and the way into it stopped.
    const dFront = K.front + t.radius - f.u;
    const dBack = f.u + K.back + t.radius;
    const dSide = K.half + t.radius - Math.abs(f.v);
    if (dSide < Math.min(dFront, dBack)) {
      const s = f.v >= 0 ? 1 : -1;
      g.x -= fz * s * dSide;
      g.z += fx * s * dSide;
    } else if (dFront < dBack) {
      g.x -= fx * dFront;
      g.z -= fz * dFront;
      if (g.speed > 0) g.speed = 0;
    } else {
      g.x += fx * dBack;
      g.z += fz * dBack;
      if (g.speed < 0) g.speed = 0;
    }
  }
}

/** DRIVEN by the player: the tuck forward, the back key in reverse, the
 * edge pivots it — the tiller down whenever it goes forward. */
function drive(state: GameState, g: GroomerState, input: SkierInput): void {
  g.drive = clamp(input.tuck, 0, 1) - clamp(input.brake, 0, 1);
  g.steer = clamp(input.steer, -1, 1);
  const want = g.drive >= 0 ? g.drive * K.most : g.drive * K.reverse;
  g.speed += clamp(want - g.speed, -K.accel * 2 * dt, K.accel * dt);
  // A crawler going backward turns the same way on the same track.
  g.heading += g.steer * K.turn * dt;
  g.x += Math.sin(g.heading) * g.speed * dt;
  g.z += Math.cos(g.heading) * g.speed * dt;
  trees(state, g);
  const lo = TUNING.bounds.margin + K.back;
  const hi = state.level.size - lo;
  g.x = clamp(g.x, lo, hi);
  g.z = clamp(g.z, lo, hi);
  settle(state, g);
  g.tiller = g.speed > 0.3;
  lay(state, g);
}

/** Where the driver sits in the cab, world. */
export function seatOf(g: GroomerState): { x: number; y: number; z: number } {
  return {
    x: g.x + Math.sin(g.heading) * K.seat.z,
    y: g.y + K.seat.y,
    z: g.z + Math.cos(g.heading) * K.seat.z,
  };
}

/** THE SKIER IN THE CAB: where the machine has him, facing its way,
 * moving with it — his skis off the snow. */
function hold(state: GameState, g: GroomerState): void {
  const c = state.skier;
  const at = seatOf(g);
  const first = g.t <= dt;
  c.vx = first ? 0 : (at.x - c.x) / dt;
  c.vy = first ? 0 : (at.y - c.y) / dt;
  c.vz = first ? 0 : (at.z - c.z) / dt;
  c.x = at.x;
  c.y = at.y;
  c.z = at.z;
  const h = g.heading / 2;
  c.q = { x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) };
  c.wx = c.wy = c.wz = 0;
  c.airborne = false;
  c.airTime = 0;
  for (const contact of c.contacts) {
    contact.touching = false;
    contact.load = 0;
  }
  derive(c, state.level);
  c.incline = 0;
  c.edge = 0;
  c.skid = 0;
  c.skiAngle = 0;
  c.tuck = 0;
  c.overFor = 0;
  c.stuckFor = 0;
}

/** Down out of the cab onto his skis, out to its left, with its way. */
function hop(state: GameState, g: GroomerState, events: GameEvent[]): void {
  const c = state.skier;
  const fx = Math.sin(g.heading);
  const fz = Math.cos(g.heading);
  const out = K.half + K.hop;
  const x = g.x + fx * K.seat.z - fz * out;
  const z = g.z + fz * K.seat.z + fx * out;
  standSkier(state, x, z, g.heading);
  c.vx = fx * g.speed;
  c.vz = fz * g.speed;
  derive(c, state.level);
  g.rider = false;
  g.mode = "parked";
  g.t = 0;
  g.drive = 0;
  g.steer = 0;
  events.push({ kind: "groomer", t: state.t, phase: "hop", id: g.id, x, z, speed: g.speed });
}

/** ONE STEP OF EVERY MACHINE, before the skier is stepped: each at its
 * work, standing where it was left, or driven — the skier taken into a
 * cab on the machine press, or let down out of it. True while he drives
 * one: the step is the machine's, and the snow and his clock wait. */
export function stepGroomers(state: GameState, input: SkierInput, events: GameEvent[]): boolean {
  const gs = state.groomers;
  if (!gs) return false;
  const net = crowdNet(state.level);
  const c = state.skier;
  let riding = false;
  // Taken: the press is spent on it, never read again as the step off.
  let pressed = input.machine === true;
  const taken = pressed ? groomerWithin(state) : null;
  if (taken) {
    pressed = false;
    taken.rider = true;
    taken.mode = "ridden";
    taken.t = 0;
    c.lift = null;
    c.tunnel = null;
    events.push({
      kind: "groomer",
      t: state.t,
      phase: "board",
      id: taken.id,
      x: taken.x,
      z: taken.z,
      speed: 0,
    });
  }
  for (const g of gs) {
    if (g.rider && (pressed || c.thrown)) {
      hop(state, g, events);
      pressed = false;
    }
    if (g.rider) {
      g.t += dt;
      drive(state, g, input);
      hold(state, g);
      riding = true;
    } else if (g.mode === "parked") {
      g.t += dt;
      g.speed += clamp(-g.speed, -K.accel * 2 * dt, K.accel * 2 * dt);
      g.tiller = false;
      g.lastX = Number.NaN;
    } else {
      const r = net.runs[g.run];
      if (r) work(state, g, r, dt);
    }
  }
  return riding;
}

/** RIDDEN INTO: the skier on his skis against any machine's footprint —
 * held off it when he meets it gently, his way into it taken off; met
 * harder (his closing speed or its blade's), knocked down. Returns the
 * velocity he is thrown with, or null. After the skier's own step. */
export function groomerStrike(
  state: GameState,
  events: GameEvent[],
): { x: number; y: number; z: number } | null {
  const gs = state.groomers;
  if (!gs || !onSkis(state)) return null;
  const c = state.skier;
  const R = 0.35;
  for (const g of gs) {
    if (c.y > g.y + K.roof + 0.5 || c.y < g.y - 1.5) continue;
    const f = footprintOf(g, c.x, c.z);
    if (f.out >= R) continue;
    const fx = Math.sin(g.heading);
    const fz = Math.cos(g.heading);
    // Out through the nearest face.
    const dFront = K.front + R - f.u;
    const dBack = f.u + K.back + R;
    const dSide = K.half + R - Math.abs(f.v);
    let nx: number;
    let nz: number;
    let depth: number;
    if (dSide < Math.min(dFront, dBack)) {
      const s = f.v >= 0 ? 1 : -1;
      nx = fz * s;
      nz = -fx * s;
      depth = dSide;
    } else if (dFront < dBack) {
      nx = fx;
      nz = fz;
      depth = dFront;
    } else {
      nx = -fx;
      nz = -fz;
      depth = dBack;
    }
    c.x += nx * depth;
    c.z += nz * depth;
    const mx = fx * g.speed;
    const mz = fz * g.speed;
    const rel = (c.vx - mx) * nx + (c.vz - mz) * nz;
    if (rel >= 0) {
      derive(c, state.level);
      continue;
    }
    const closing = -rel;
    if (closing <= K.strike.push) {
      c.vx -= rel * nx;
      c.vz -= rel * nz;
      derive(c, state.level);
      continue;
    }
    events.push({
      kind: "groomer",
      t: state.t,
      phase: "strike",
      id: g.id,
      x: c.x,
      z: c.z,
      speed: closing,
    });
    const k = (1 + K.strike.bounce) * rel;
    return { x: c.vx - k * nx, y: c.vy, z: c.vz - k * nz };
  }
  return null;
}
