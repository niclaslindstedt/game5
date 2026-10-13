// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEARCH AND THE PATROL — what comes after a slide (`avalanche.ts`) has
// buried someone, on a free ride that asked for avalanches.
//
// THE OTHERS IT TAKES. A running slide takes the crowd's amateurs
// (`crowd.ts`) and the night's keen skiers (`enthusiasts.ts`) as it takes
// the player: a running parcel near one, coming on faster than he is going
// its way, throws him onto his ragdoll (`crowd-down.ts`' `throwAmateur`, or
// his own run's `throwRider`), carries him in it and puts him down where
// it stops — his head out, or BURIED with a time to live off the survival
// curve. Cheaply: the running parcels' box is found once a step and only
// the few skiers inside it are measured against them.
//
// THE PLAYER'S TRANSCEIVER. Every skier wears one sending. When somebody
// is buried within sight of him and he is free, his switches itself to
// SEARCH (the `beacon` press switches it either way); what it reads — the
// signal search, the direction and distance along the field's flux line,
// the fine search's number — is the app's to draw off where the burials
// are (`beacon-read.ts`). The RESCUE key's press, stopped on the debris, is
// a PROBE pushed in where he stands: it STRIKES a body within
// `probe.reach` of it no deeper than the probe is long. Held beside a
// strike, it DIGS: the debris cleared at a lone rescuer's rate (strategic
// shovelling, 13–25 cm a minute at the clock's 30 ×) until he is out — alive
// if his air has not run out, dead if it has.
//
// THE PATROL. Whoever is buried — the player above all — the patrol is
// called for: two patrollers ski in after a dealt response time, search
// with their transceivers, probe and dig on a conveyor at a team's rate,
// and pull him out. The player dug out alive is stood up where he lay;
// left too long, his air runs out (`avalanche.ts`: the death flow on a run
// that carries its injuries, the run taking him back on one that does
// not). Where each patroller is is a pure function of the patrol's phase
// (`patrolMan`), for the picture.
//
// Every draw is off the avalanches' own stream; nothing touches
// `state.rng`, and a run without avalanches never comes here.

import { clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { AVALANCHE } from "./defs/avalanche.ts";
import { AVALANCHE_RESCUE } from "./defs/avalanche-rescue.ts";
import { TUNING } from "./defs/tuning.ts";
import { standSkier } from "./course.ts";
import { throwRider } from "./crash.ts";
import { throwAmateur } from "./crowd-down.ts";
import { holdsHim } from "./gore.ts";
import { carryBody, debrisDepth, holdBody, survivalMinutes } from "./avalanche.ts";
import {
  CELL,
  type AvalancheState,
  type AvalancheVictim,
  type Beacon,
  type Burial,
  type BuriedWho,
  type Patrol,
  type PatrolAct,
  type Slide,
} from "./avalanche-state.ts";
import type { GameEvent, GameState, SkierInput, Thrown } from "./state.ts";

const K = AVALANCHE;
const R = AVALANCHE_RESCUE;
const dt = TUNING.dt;
const S = CELL.stride;

/** A transceiver sending, nothing probed. */
export function freshBeacon(): Beacon {
  return { search: false, auto: 0, held: false, wait: 0, holes: [], digging: 0 };
}

/** The burial with id `id`, or undefined. */
export function burialOf(a: AvalancheState, id: number): Burial | undefined {
  for (const b of a.burials) if (b.id === id) return b;
  return undefined;
}

/** A NEW BURIAL in the list — the oldest dug out dropped to make room; null
 * when every place is taken by somebody still under (nobody more is
 * taken). */
export function addBurial(
  a: AvalancheState,
  who: BuriedWho,
  ref: number,
  s: Slide | null,
  parcel: number,
  x: number,
  z: number,
): Burial | null {
  if (a.burials.length >= R.burials) {
    const k = a.burials.findIndex((b) => b.phase === "out");
    if (k < 0) return null;
    a.burials.splice(k, 1);
  }
  a.ids += 1;
  const b: Burial = {
    id: a.ids,
    who,
    ref,
    slide: s ? s.id : 0,
    parcel,
    phase: "carried",
    t: 0,
    clear: 0,
    x,
    z,
    depth: 0,
    air: 0,
    dug: 0,
    struck: false,
    found: null,
    alive: true,
    aerial: a.rng.range(0, Math.PI),
  };
  a.burials.push(b);
  return b;
}

/** The running parcels' plan box this step, grown by the near reach. */
const box = { x0: 0, z0: 0, x1: 0, z1: 0 };
function runningBox(s: Slide): boolean {
  const c = s.cells;
  box.x0 = box.z0 = Infinity;
  box.x1 = box.z1 = -Infinity;
  for (let k = 0; k < s.count * S; k += S) {
    if (c[k + CELL.run] === 0) continue;
    const x = c[k + CELL.x];
    const z = c[k + CELL.z];
    if (x < box.x0) box.x0 = x;
    if (x > box.x1) box.x1 = x;
    if (z < box.z0) box.z0 = z;
    if (z > box.z1) box.z1 = z;
  }
  box.x0 -= K.reach;
  box.z0 -= K.reach;
  box.x1 += K.reach;
  box.z1 += K.reach;
  return box.x0 <= box.x1;
}

/** The running parcel that takes a skier at (`x`, `z`) going (`vx`, `vz`),
 * or −1: within `reach`, coming on at him faster than `catchSpeed`. */
function takes(s: Slide, x: number, z: number, vx: number, vz: number): number {
  if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1) return -1;
  const c = s.cells;
  const r2 = K.reach * K.reach;
  for (let k = 0; k < s.count * S; k += S) {
    if (c[k + CELL.run] === 0) continue;
    const dx = c[k + CELL.x] - x;
    const dz = c[k + CELL.z] - z;
    if (dx * dx + dz * dz > r2) continue;
    const fx = c[k + CELL.vx];
    const fz = c[k + CELL.vz];
    const sp = hypot(fx, fz);
    if (sp < K.catchSpeed) continue;
    if (sp - (vx * fx + vz * fz) / sp < K.catchSpeed) continue;
    return k / S;
  }
  return -1;
}

/**
 * THE OTHERS THE RUNNING FLOW TAKES this step: every amateur out on the
 * snow and every keen skier on his skis that a running parcel comes on at
 * — thrown, and carried from the next step.
 */
export function catchOthers(
  state: GameState,
  a: AvalancheState,
  s: Slide,
  events: GameEvent[],
): void {
  if (!runningBox(s)) return;
  const crowd = state.crowd;
  if (crowd) {
    const list = crowd.amateurs;
    for (let i = 0; i < list.length; i++) {
      const am = list[i];
      if (am.buried !== undefined || am.dead) continue;
      if (am.mode === "ride" || am.mode === "lift" || am.mode === "queue") continue;
      const k = takes(s, am.x, am.z, am.vx, am.vz);
      if (k < 0) continue;
      const b = addBurial(a, "amateur", i, s, k, am.x, am.z);
      if (!b) return;
      const c = s.cells;
      const vx = (am.vx + c[k * S + CELL.vx]) / 2;
      const vz = (am.vz + c[k * S + CELL.vz]) / 2;
      // Down already, his body is taken where it lies.
      if (!am.thrown) throwAmateur(am, a.rng.chance(0.5) ? 1 : -1, "avalanche", vx, vz);
      am.mode = "down";
      am.buried = b.id;
      push(state, events, "caught", s, am.x, am.z, 0, "amateur");
    }
  }
  for (let i = 0; i < state.rivals.length; i++) {
    const rival = state.rivals[i];
    if (!rival.free) continue;
    const run = rival.run;
    const c = run.skier;
    if (c.thrown || c.lift || run.avalanche) continue;
    const k = takes(s, c.x, c.z, c.vx, c.vz);
    if (k < 0) continue;
    const b = addBurial(a, "keen", i, s, k, c.x, c.z);
    if (!b) return;
    const cells = s.cells;
    throwRider(
      run,
      "avalanche",
      { x: (c.vx + cells[k * S + CELL.vx]) / 2, y: c.vy, z: (c.vz + cells[k * S + CELL.vz]) / 2 },
      run.events,
    );
    // His own run holds him down while the avalanche has him
    // (`avalancheHolds`): the flow's victim, as the player's.
    run.avalanche = keenHold(a, b);
    push(state, events, "caught", s, c.x, c.z, 0, "keen");
  }
}

/** What a keen skier's own run carries while an avalanche holds him: its
 * victim, so his run's reset waits on it (`avalancheHolds`). */
function keenHold(a: AvalancheState, b: Burial): AvalancheState {
  const victim: AvalancheVictim = {
    slide: b.slide,
    parcel: b.parcel,
    phase: "carried",
    t: 0,
    depth: 0,
    air: Infinity,
    clear: 0,
    x: b.x,
    z: b.z,
  };
  return {
    rng: a.rng,
    load: 0,
    travel: 0,
    quiet: 0,
    slide: null,
    beds: [],
    victim,
    count: 0,
    burials: [],
    ids: 0,
    beacon: freshBeacon(),
    patrol: null,
  };
}

/** The body a burial holds: the amateur's ragdoll, the keen skier's or the
 * player's; null when it has gone (got up, the run moved on). */
function bodyOf(state: GameState, b: Burial): Thrown | null {
  if (b.who === "player") return state.skier.thrown;
  if (b.who === "amateur") return state.crowd?.amateurs[b.ref]?.thrown ?? null;
  return state.rivals[b.ref]?.run.skier.thrown ?? null;
}

/** One step of the OTHERS a slide took: carried while their parcel runs,
 * put down where it stops, their air running out under the debris. */
function stepOthers(state: GameState, a: AvalancheState, events: GameEvent[]): void {
  for (const b of a.burials) {
    if (b.who === "player" || b.phase === "out") continue;
    const body = bodyOf(state, b);
    if (!body) {
      b.phase = "out";
      continue;
    }
    b.t += dt;
    if (b.phase === "carried") {
      b.x = body.x;
      b.z = body.z;
      const s = a.slide;
      const k = b.parcel * S;
      if (s && s.id === b.slide && s.cells[k + CELL.run] === 1) {
        const c = s.cells;
        b.clear = 0;
        carryBody(
          body.points,
          body.last,
          c[k + CELL.vx] + (c[k + CELL.x] - body.x) * K.hold,
          c[k + CELL.vz] + (c[k + CELL.z] - body.z) * K.hold,
          state.level,
          debrisDepth(s, body.x, body.z),
        );
        continue;
      }
      b.clear += dt;
      if (b.clear < K.settleFor) continue;
      const lying = s && s.id === b.slide ? debrisDepth(s, b.x, b.z) : 0;
      const depth = lying * a.rng.range(K.under[0], K.under[1]);
      if (depth < K.headFree) {
        // His head out: up as from any fall.
        letGo(state, b);
        b.phase = "out";
        push(state, events, "surfaced", s, b.x, b.z, depth, b.who);
        continue;
      }
      b.phase = "buried";
      b.t = 0;
      b.depth = depth;
      b.air = (survivalMinutes(a.rng.next(), depth) * 60) / K.timeScale;
      push(state, events, "buried", s, b.x, b.z, depth, b.who);
      continue;
    }
    holdBody(body.points, body.last);
    b.alive = b.t < b.air;
  }
}

/** A body the avalanche lets go of: an amateur free to get up (or left
 * lying dead), a keen skier's run's hold taken off. */
function letGo(state: GameState, b: Burial): void {
  if (b.who === "amateur") {
    const am = state.crowd?.amateurs[b.ref];
    if (!am) return;
    am.buried = undefined;
    if (!b.alive) am.dead = true;
    else am.timer = Math.min(am.timer, 1.5);
    return;
  }
  if (b.who === "keen") {
    const run = state.rivals[b.ref]?.run;
    if (!run) return;
    if (!b.alive) {
      // Dead, his run holds him where he lies.
      if (run.avalanche?.victim) run.avalanche.victim.phase = "lost";
      return;
    }
    run.avalanche = undefined;
    stood(run, b);
  }
}

/** Stood up out of the hole, below it, facing down the fall line. */
function stood(run: GameState, b: Burial): void {
  const level = run.level;
  const n = { x: 0, y: 1, z: 0 };
  level.normalAt(b.x, b.z, n);
  const fl = hypot(n.x, n.z);
  const fx = fl > 1e-6 ? n.x / fl : 0;
  const fz = fl > 1e-6 ? n.z / fl : 1;
  standSkier(run, b.x + fx * 1.2, b.z + fz * 1.2, Math.atan2(fx, fz));
}

/** DUG OUT: alive or dead, by whoever reached him. */
function dugOut(
  state: GameState,
  a: AvalancheState,
  b: Burial,
  by: "player" | "patrol",
  events: GameEvent[],
): void {
  b.phase = "out";
  b.t = 0;
  b.dug = b.depth;
  if (b.who === "player") {
    const v = a.victim;
    b.alive = !!v && v.phase === "buried";
    if (b.alive) {
      a.victim = null;
      // Hurt past skiing on, the run's own flow holds him where he lies.
      if (!holdsHim(state)) stood(state, b);
    }
  } else letGo(state, b);
  if (a.beacon.digging === b.id) a.beacon.digging = 0;
  push(state, events, "dug", a.slide, b.x, b.z, b.depth, b.who, b.alive);
  void by;
}

/** One step of the search and the patrol, after the flow's. */
export function stepRescue(
  state: GameState,
  a: AvalancheState,
  input: SkierInput | undefined,
  events: GameEvent[],
): void {
  stepOthers(state, a, events);
  // THE PLAYER'S OWN BURIAL follows his victim: its clock, his air, gone
  // once he is out of it.
  const v = a.victim;
  for (let i = a.burials.length - 1; i >= 0; i--) {
    const b = a.burials[i];
    if (b.who !== "player" || b.phase === "out") continue;
    if (!v || v.phase === "carried") {
      a.burials.splice(i, 1);
      continue;
    }
    b.t = v.t;
    b.alive = v.phase === "buried";
  }
  stepBeacon(state, a, input, events);
  stepPatrol(state, a, events);
}

/** Whether the player is on his own feet, out on the snow and free to
 * search, probe and dig. */
function free(state: GameState): boolean {
  const c = state.skier;
  return (
    !c.thrown &&
    !c.lift &&
    !c.airborne &&
    !state.sled?.rider &&
    !state.heli?.rider &&
    !state.balloon?.aboard &&
    !state.plane?.rider
  );
}

/** Whether a burial is still under the snow. */
const under = (b: Burial): boolean => b.phase === "buried";

/** THE PLAYER'S TRANSCEIVER, PROBE AND SHOVEL. */
function stepBeacon(
  state: GameState,
  a: AvalancheState,
  input: SkierInput | undefined,
  events: GameEvent[],
): void {
  const B = a.beacon;
  const c = state.skier;
  const loose = free(state);
  if (B.wait > 0) B.wait = Math.max(0, B.wait - dt);
  // Somebody else under the snow?
  let any = false;
  let newest: Burial | null = null;
  for (const b of a.burials) {
    if (b.who === "player" || !under(b)) continue;
    any = true;
    if (b.id > B.auto && hypot(b.x - c.x, b.z - c.z) <= R.beacon.watch) newest = b;
  }
  // THE PRESS switches it either way.
  if (input?.beacon) {
    B.search = !B.search;
    push(state, events, "beacon", null, c.x, c.z, 0, undefined, B.search);
  } else if (newest && loose && !a.victim) {
    // Somebody buried in sight of him: his unit switches itself to search.
    B.auto = newest.id;
    if (!B.search) {
      B.search = true;
      push(state, events, "beacon", null, c.x, c.z, 0, undefined, true);
    }
  } else if (!any && B.search && B.auto > 0) {
    // Nobody left under: back to sending.
    B.search = false;
    B.auto = a.ids;
    push(state, events, "beacon", null, c.x, c.z, 0, undefined, false);
  }
  const down = !!input?.dig;
  const press = down && !B.held;
  B.held = down;
  B.digging = 0;
  if (!any || !loose || c.speed > R.probe.still) return;
  // A strike within his shovel's reach: the button digs, not probes.
  let struck: Burial | null = null;
  for (const b of a.burials) {
    if (b.who === "player" || !under(b) || !b.struck) continue;
    if (hypot(b.x - c.x, b.z - c.z) <= R.dig.reach) {
      struck = b;
      break;
    }
  }
  // THE PROBE, pushed in where he stands.
  if (press && !struck && B.wait <= 0) {
    let best: Burial | null = null;
    let near = Infinity;
    for (const b of a.burials) {
      if (b.who === "player" || !under(b)) continue;
      const d = hypot(b.x - c.x, b.z - c.z);
      if (d < near) {
        near = d;
        best = b;
      }
    }
    const hit = best && near <= R.probe.reach && best.depth <= R.probe.length ? best : null;
    const s = a.slide;
    const lying = s ? debrisDepth(s, c.x, c.z) : 0;
    B.holes.push({
      x: c.x,
      z: c.z,
      t: state.t,
      depth: hit ? hit.depth : Math.min(R.probe.length, lying + 0.3),
      hit: hit ? hit.id : 0,
    });
    if (B.holes.length > R.probe.most) B.holes.shift();
    B.wait = R.probe.every;
    if (hit) {
      hit.struck = true;
      hit.found ??= "player";
    }
    push(state, events, hit ? "strike" : "probe", s, c.x, c.z, hit ? hit.depth : 0, hit?.who);
    return;
  }
  // THE SHOVEL, held beside a strike.
  if (!down || !struck) return;
  B.digging = struck.id;
  // A man digging stands in his own hole: the slope does not slide him off
  // it.
  c.vx = 0;
  c.vy = 0;
  c.vz = 0;
  c.speed = 0;
  c.way = 0;
  struck.dug += R.dig.rate * dt;
  if (struck.dug >= struck.depth) dugOut(state, a, struck, "player", events);
}

/** The burial the patrol should go to next: the player's own first, then
 * the oldest still under. */
function nextTarget(a: AvalancheState): Burial | null {
  let pick: Burial | null = null;
  for (const b of a.burials) {
    if (!under(b)) continue;
    if (b.who === "player") return b;
    pick ??= b;
  }
  return pick;
}

/** THE SKI PATROL: called, on its way, at work, standing by. */
function stepPatrol(state: GameState, a: AvalancheState, events: GameEvent[]): void {
  let p = a.patrol;
  if (!p) {
    const b = nextTarget(a);
    if (!b) return;
    p = a.patrol = callPatrol(a, b);
  }
  p.t += dt;
  const b = burialOf(a, p.target);
  const P = R.patrol;
  // Their man is out already (dug by the player): on to the next, or home.
  if (p.phase !== "leave" && (!b || b.phase !== "buried")) {
    const next = nextTarget(a);
    if (next && (p.phase === "called" || p.phase === "coming")) {
      // Already on their way: re-aimed, the time left kept.
      const eta = p.phase === "called" ? p.eta : 0;
      a.patrol = callPatrol(a, next);
      a.patrol.eta = eta;
      return;
    }
    p.phase = "leave";
    p.t = 0;
    return;
  }
  switch (p.phase) {
    case "called":
      p.eta -= dt;
      if (p.eta <= 0) {
        aim(state, a, p, b!);
        p.phase = "coming";
        p.t = 0;
        push(state, events, "patrol", null, p.sx, p.sz, 0, b!.who);
      }
      return;
    case "coming":
      if (p.t >= comingFor(p)) {
        p.phase = "search";
        p.t = 0;
      }
      return;
    case "search":
      if (p.t >= P.search) {
        p.phase = "probe";
        p.t = 0;
      }
      return;
    case "probe":
      if (p.t >= P.probe) {
        b!.struck = true;
        b!.found ??= "patrol";
        p.phase = "dig";
        p.t = 0;
        push(state, events, "strike", null, b!.x, b!.z, b!.depth, b!.who);
      }
      return;
    case "dig":
      b!.dug += R.dig.team * dt;
      p.dug = b!.dug;
      if (b!.dug >= b!.depth) {
        dugOut(state, a, b!, "patrol", events);
        p.phase = "leave";
        p.t = 0;
      }
      return;
    case "leave":
      if (p.t >= P.leave) {
        const next = nextTarget(a);
        a.patrol = next ? callPatrol(a, next) : null;
        // A team already on the mountain needs no new call.
        if (a.patrol) a.patrol.eta = Math.min(a.patrol.eta, 4);
      }
      return;
  }
}

/** THE ALARM for burial `b`: a team on its way, its time dealt. */
function callPatrol(a: AvalancheState, b: Burial): Patrol {
  const P = R.patrol;
  return {
    target: b.id,
    phase: "called",
    t: 0,
    eta: a.rng.range(P.respond[0], P.respond[1]),
    ax: b.x,
    az: b.z,
    sx: b.x,
    sz: b.z,
    tx: b.x,
    tz: b.z,
    fx: 0,
    fz: 1,
    depth: b.depth,
    dug: 0,
  };
}

/** Where the team skis in from and stops short of him: up the fall line
 * off the slab's flank, inside the map. */
function aim(state: GameState, a: AvalancheState, p: Patrol, b: Burial): void {
  const level = state.level;
  const n = { x: 0, y: 1, z: 0 };
  level.normalAt(b.x, b.z, n);
  const fl = hypot(n.x, n.z);
  const s = a.slide && a.slide.id === b.slide ? a.slide.slab : null;
  const fx = s ? s.fx : fl > 1e-6 ? n.x / fl : 0;
  const fz = s ? s.fz : fl > 1e-6 ? n.z / fl : 1;
  // Across to the side of the slab with more room.
  const side = s ? (s.left >= s.right ? 1 : -1) : 1;
  const lo = 20;
  const hi = level.size - 20;
  const ax = clamp(b.x - fx * R.patrol.from + fz * side * R.patrol.from * 0.45, lo, hi);
  const az = clamp(b.z - fz * R.patrol.from - fx * side * R.patrol.from * 0.45, lo, hi);
  const dx = b.x - ax;
  const dz = b.z - az;
  const d = Math.max(1, hypot(dx, dz));
  const off = Math.min(R.patrol.standoff, d * 0.5);
  p.ax = ax;
  p.az = az;
  p.sx = b.x - (dx / d) * off;
  p.sz = b.z - (dz / d) * off;
  p.tx = b.x;
  p.tz = b.z;
  p.fx = fx;
  p.fz = fz;
  p.depth = b.depth;
}

/** How long the team takes to ski in, s. */
function comingFor(p: Patrol): number {
  return hypot(p.sx - p.ax, p.sz - p.az) / R.patrol.speed;
}

/** One patroller as drawn: where in plan, his heading, what he is doing
 * and how far through it (s, for the stroke's phase); `shown` false while
 * the team is still on its way unseen. */
export type PatrolMan = {
  shown: boolean;
  x: number;
  z: number;
  heading: number;
  act: PatrolAct;
  work: number;
};

const toward = (x: number, z: number, tx: number, tz: number): number => Math.atan2(tx - x, tz - z);

/**
 * WHERE PATROLLER `i` (0 the searcher and digger, 1 the prober and the
 * conveyor behind him) IS at the patrol's moment, written into `out` — a
 * pure function of the patrol, for the picture.
 */
export function patrolMan(p: Patrol, i: 0 | 1, out: PatrolMan): PatrolMan {
  out.shown = p.phase !== "called";
  out.work = p.t;
  // Across the fall line, to the patroller's side.
  const cx = p.fz;
  const cz = -p.fx;
  const side = i === 0 ? 1 : -1;
  const P = R.patrol;
  switch (p.phase) {
    case "called":
    case "coming": {
      const u = p.phase === "called" ? 0 : clamp(p.t / Math.max(0.1, comingFor(p)), 0, 1);
      // Skiing in one behind the other, the second a few metres off.
      const lag = i === 0 ? u : clamp(u - 0.06, 0, 1);
      out.x = p.ax + (p.sx - p.ax) * lag + cx * side * 2.5 * (1 - lag);
      out.z = p.az + (p.sz - p.az) * lag + cz * side * 2.5 * (1 - lag);
      out.heading = toward(p.ax, p.az, p.sx, p.sz);
      out.act = u >= 1 ? "stand" : "ski";
      return out;
    }
    case "search": {
      // The searcher follows the curved flux line in from the stand-off,
      // then brackets for the lowest number with his unit on the snow; the
      // second follows him with the probe.
      const span = Math.max(1, P.search - 2.5);
      const u = clamp(p.t / span, 0, 1);
      const lead = i === 0 ? u : clamp(u - 0.25, 0, 0.85);
      const mx = (p.sx + p.tx) / 2;
      const mz = (p.sz + p.tz) / 2;
      const dx = p.tx - p.sx;
      const dz = p.tz - p.sz;
      // The flux line bows out to one side of the straight way in.
      const kx = mx - dz * 0.35;
      const kz = mz + dx * 0.35;
      const q = 1 - lead;
      out.x = q * q * p.sx + 2 * q * lead * kx + lead * lead * p.tx;
      out.z = q * q * p.sz + 2 * q * lead * kz + lead * lead * p.tz;
      const tx = 2 * q * (kx - p.sx) + 2 * lead * (p.tx - kx);
      const tz = 2 * q * (kz - p.sz) + 2 * lead * (p.tz - kz);
      out.heading = Math.atan2(tx, tz);
      out.act = i === 0 ? (u < 0.55 ? "walk" : "search") : "walk";
      if (i === 0 && p.t > span) {
        // BRACKETING: a slow cross over the lowest reading.
        const w = (p.t - span) / 2.5;
        const arm = 0.9 * Math.sin(w * Math.PI * 2);
        const along = w < 0.5;
        out.x = p.tx + (along ? cx : p.fx) * arm;
        out.z = p.tz + (along ? cz : p.fz) * arm;
        out.act = "search";
      }
      if (i === 1 && u >= 0.85) out.act = "stand";
      return out;
    }
    case "probe": {
      if (i === 1) {
        // THE SPIRAL out from the lowest reading, 25 cm a stroke.
        const k = Math.floor(p.t / 0.5);
        const r = 0.25 * Math.sqrt(k);
        const a = k * 2.4;
        out.x = p.tx + Math.sin(a) * r - p.fx * 0.4;
        out.z = p.tz + Math.cos(a) * r - p.fz * 0.4;
        out.heading = toward(out.x, out.z, p.tx, p.tz) || Math.atan2(p.fx, p.fz) + Math.PI;
        out.act = "probe";
        return out;
      }
      out.x = p.tx + p.fx * 1.6 + cx * 1.2;
      out.z = p.tz + p.fz * 1.6 + cz * 1.2;
      out.heading = toward(out.x, out.z, p.tx, p.tz);
      out.act = "stand";
      return out;
    }
    case "dig": {
      // STRATEGIC SHOVELLING: in from downhill, the front digger at the
      // face of the hole, the second clearing behind him.
      const back = i === 0 ? 0.5 * p.depth + 0.7 : R.dig.downhill * p.depth + 1.8;
      out.x = p.tx + p.fx * back + cx * side * 0.3;
      out.z = p.tz + p.fz * back + cz * side * 0.3;
      out.heading = Math.atan2(-p.fx, -p.fz);
      out.act = "dig";
      out.work = p.t + i * 0.45;
      return out;
    }
    case "leave": {
      out.x = p.tx + p.fx * 1.4 + cx * side * 1.1;
      out.z = p.tz + p.fz * 1.4 + cz * side * 1.1;
      out.heading = toward(out.x, out.z, p.tx, p.tz);
      out.act = "stand";
      return out;
    }
  }
}

/** The patrol's dig share on its man, 0..1 — how near they are to him. */
export function patrolReach(a: AvalancheState): number {
  const p = a.patrol;
  if (!p || p.phase !== "dig") return p?.phase === "leave" ? 1 : 0;
  return p.depth > 0 ? clamp(p.dug / p.depth, 0, 1) : 1;
}

function push(
  state: GameState,
  events: GameEvent[],
  phase: "caught" | "buried" | "surfaced" | "beacon" | "probe" | "strike" | "dug" | "patrol",
  s: Slide | null,
  x: number,
  z: number,
  depth: number,
  who?: BuriedWho,
  alive?: boolean,
): void {
  events.push({
    kind: "avalanche",
    t: state.t,
    phase,
    id: s ? s.id : 0,
    x,
    z,
    size: s ? s.volume : 0,
    depth,
    ...(who && who !== "player" ? { who } : {}),
    ...(alive !== undefined ? { alive } : {}),
  });
}
