// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S HELICOPTERS IN FLIGHT — the machines the wanted level's roster
// asks for (`rosterOf(stars).helicopters`), called in, flown and fought.
//
// THE CALL. When the roster asks for more machines than are out, each is
// called: after the crew's scramble (`ARMY.respond`, the next `stagger` s
// after) it comes in at the MAP'S EDGE on a bearing from the map's middle
// dealt once a hunt (`ArmyState.from`), each machine called with it spread
// either side, `enter` m over the snow, already at its cruise.
//
// THE FLIGHT is a point flown with a pilot's limits rather than the
// player's rotor physics (`heli.ts`, built for one machine on one state):
// the velocity it wants (its STATION and the closing on it), the
// acceleration that asks for — no more than the disc leant `flight.tilt`
// gives, smoothed over `flight.lag` so the bank rolls in — and its
// attitude read off that acceleration as a helicopter's is: leant into it,
// the nose hung down at speed. Its height is held off the snow it reads
// ahead (`terrain.clear` over the highest of it) and a hard floor under
// the disc keeps it out of the mountain and the crowns whatever its
// station asks (`terrain.floor`).
//
// THE HUNT. Where he is seen, its station is a point on the PYLON TURN —
// a circle of `orbit.radius` round him, `orbit.height` over him, flown
// `orbit.speed` round, the gunner's door inward and the nose turned along
// the circle so the man is square out of the door. A quarry that runs (a
// stolen helicopter at speed) is held from ECHELON instead — behind him and
// out to the gun's side, flying his speed. Out of every pursuer's sight
// they SEARCH: the circle is flown round where he was last seen
// (`WantedState.lastSeen`), wide, high and slow — and until the first
// machine has reached that search, its clock does not run (the stars
// flash, but are not lost to a hunt nobody has yet flown). Two machines
// keep apart.
// Once the hunt is over — the stars lost, he dead or taken in — they turn
// for the edge and are gone.
//
// THE GUNS. The roster's door gunners are shared out a machine at a time,
// the inward door first. Each door slides open within `guns.open` m of
// him; each gun is turned onto him where its arc lets it, and fires
// whenever its door is open, he is in its range and in its gunner's sight
// (`seesQuarry`) — every burst through the one gunfire layer
// (`gunfire.ts`' `armGun` / `fireAt`), under the wanted level's rules of
// fire: none at one star, warning fire at two, aimed from three, and
// never aimed with SAFE FOR WORK on.
//
// THE PURSUERS: every machine out and every gunner in an open door is
// written into `WantedState.pursuers` each step, so the wanted level's
// sight test sees through their eyes.
//
// A RAM: his stolen machine's disc into one of theirs brings theirs down —
// spinning, its tail gone, burning where it lands — and his crashes by its
// own rules (`heli.ts`' `crashHeli`); bringing one down is an offence
// (`downed-helicopter`). With SAFE FOR WORK on nothing is struck: his
// machine is put back off theirs.
//
// Nothing here draws from `state.rng`: the bearing and the circles are
// dealt off the army's own stream, seeded off the run. `GameState.army` is
// absent until a hunt asks for a machine, so a run never hunted moves no
// digest.

import {
  angleDiff,
  clamp,
  hypot,
  hypot3,
  smoothstep,
} from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler, rotate, unrotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { ARMY } from "./defs/army.ts";
import { ARMY_GROUND } from "./defs/army-ground.ts";
import { ARMY_HELI } from "./defs/army-heli.ts";
import { HELI } from "./defs/heli.ts";
import { TUNING } from "./defs/tuning.ts";
import { WANTED } from "./defs/wanted.ts";
import { armGun, disarmGun, fireAt } from "./gunfire.ts";
import { crashHeli } from "./heli.ts";
import { treesNear } from "./upright-grid.ts";
import { quarryOf, raiseHeat, rosterOf, seesQuarry } from "./wanted.ts";
import type { ArmyEvent, ArmyHeli, ArmyState } from "./army-state.ts";
import type { GameEvent, GameState } from "./state.ts";
import type { WantedState } from "./wanted-state.ts";

const dt = TUNING.dt;
const G = TUNING.g;
const F = ARMY.flight;
const SALT = 0x51a7e3;
const DOORS = [1, -1] as const;
/** The quarry's chest over his feet, m (the gunners' point of aim). */
const CHEST = WANTED.line.chest;

// ─── the stream ────────────────────────────────────────────────────────

/** A draw off the army's own stream, 0..1 (mulberry32). */
function draw(a: ArmyState): number {
  const s = (a.stream + 0x6d2b79f5) | 0;
  a.stream = s;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** THE ARMY'S AIR at nothing out, its stream seeded off the run. */
export function freshArmy(state: GameState): ArmyState {
  const q = quarryOf(state);
  const half = state.level.size / 2;
  const a: ArmyState = {
    helis: [],
    stream: (state.seed ^ SALT) >>> 0,
    next: 0,
    from: 0,
    called: 0,
    downed: 0,
    troops: [],
    nextSoldier: 0,
    liftSquads: 0,
    liftDue: NaN,
    dropped: 0,
    picked: 0,
    sleds: [],
    nextSled: 0,
    sledsCalled: 0,
    crewsDown: 0,
    sledsTaken: 0,
    waves: 0,
    waveStar: 0,
    waveAt: 0,
    waveSleds: 0,
    routes: [],
    marched: 0,
  };
  a.from = Math.atan2(q.x - half, q.z - half) + (draw(a) - 0.5) * ARMY.drift;
  return a;
}

// ─── where things are ──────────────────────────────────────────────────

type V = { x: number; y: number; z: number };

/** How the hunted man moves, m/s: his body's way, or the machine's he
 * rides. */
function quarryVelocity(state: GameState): V {
  const m =
    (state.heli?.rider && state.heli) ||
    (state.plane?.rider && state.plane) ||
    (state.sled?.rider && state.sled) ||
    null;
  const c = m ?? state.skier.thrown ?? state.skier;
  return { x: c.vx, y: c.vy, z: c.vz };
}

/** An angle into (−π, π]. */
function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** A point on the map's edge, `inset` m inside it (negative: past it), on
 * the bearing `b` from the map's middle. */
function edgePoint(size: number, b: number, inset: number): { x: number; z: number } {
  const sx = Math.sin(b);
  const sz = Math.cos(b);
  const r = (size / 2 - inset) / Math.max(Math.abs(sx), Math.abs(sz), 1e-6);
  return { x: size / 2 + sx * r, z: size / 2 + sz * r };
}

/** The machine's attitude, body to world. */
export function armyQuat(h: Pick<ArmyHeli, "heading" | "pitch" | "roll">) {
  return fromEuler(h.heading, h.pitch, h.roll);
}

/** A point of the machine's body frame (`ARMY_HELI`'s) in the world. */
export function armyPoint(h: ArmyHeli, p: V): V {
  const w = rotate(armyQuat(h), p);
  return { x: h.x + w.x, y: h.y + w.y, z: h.z + w.z };
}

/** The door gun's pivot on `side` (1 the right door), body frame. */
function pivotOf(side: 1 | -1): V {
  const p = ARMY_HELI.gun.pivot;
  return { x: p.x * side, y: p.y, z: p.z };
}

const trunks: number[] = [];

/** THE LOWEST THE MACHINE MAY BE at (x, z): its skid datum `floor` m over
 * the highest snow under its disc, and clear over every crown the disc
 * sweeps. */
export function armyFloor(state: GameState, x: number, z: number, floor: number): number {
  const level = state.level;
  const R = ARMY_HELI.rotor.radius;
  let ground = level.groundAt(x, z);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ground = Math.max(ground, level.groundAt(x + Math.sin(a) * R, z + Math.cos(a) * R));
  }
  let low = ground + floor;
  for (const i of treesNear(level, x, z, R + 4, trunks)) {
    const t = level.trees[i];
    low = Math.max(low, t.y + t.height + 4);
  }
  return low;
}

// ─── the call ──────────────────────────────────────────────────────────

function say(
  state: GameState,
  events: GameEvent[],
  change: ArmyEvent["change"],
  h: ArmyHeli,
): void {
  events.push({ kind: "army", t: state.t, change, id: h.id, x: h.x, y: h.y, z: h.z });
}

/** CALL IN what the roster asks for; send home what it no longer does. */
function call(state: GameState, a: ArmyState, want: number, events: GameEvent[]): void {
  let live = 0;
  for (const h of a.helis) {
    if (h.phase !== "due" && h.phase !== "hunt" && !landing(h)) continue;
    if (live >= want) {
      if (h.phase === "due") h.phase = "gone";
      // On the snow or on its way down: it lifts first, then goes home.
      else if (h.task) h.task.done = true;
      else turnHome(state, h, events);
      continue;
    }
    live++;
  }
  a.helis = a.helis.filter((h) => h.phase !== "gone");
  let waiting = a.helis.filter((h) => h.phase === "due").length;
  while (live < want) {
    const k = a.called;
    // 0, +1, −1, +2, −2 … spreads either side of the army's bearing.
    const step = k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2);
    const h: ArmyHeli = {
      id: a.next++,
      phase: "due",
      due: state.t + ARMY.respond + ARMY.stagger * waiting,
      t: 0,
      bearing: a.from + step * ARMY.spread,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      ax: 0,
      az: 0,
      heading: 0,
      pitch: 0,
      roll: 0,
      yawRate: 0,
      spool: 1,
      on: false,
      dir: draw(a) < 0.5 ? 1 : -1,
      manned: { r: false, l: false },
      doors: { r: 0, l: 0 },
      guns: { r: { ...ARMY.guns.rest }, l: { ...ARMY.guns.rest } },
      bears: { r: false, l: false },
      aboard: ARMY_GROUND.section,
      task: null,
    };
    a.helis.push(h);
    a.called++;
    waiting++;
    live++;
    say(state, events, "called", h);
  }
}

/** IN AT THE EDGE: the called machine on the map, at its cruise, its nose
 * on him. */
function arrive(state: GameState, h: ArmyHeli, events: GameEvent[]): void {
  const size = state.level.size;
  const e = edgePoint(size, h.bearing, ARMY.inset);
  const q = quarryOf(state);
  h.x = e.x;
  h.z = e.z;
  h.y = Math.max(
    state.level.groundAt(e.x, e.z) + ARMY.enter,
    armyFloor(state, e.x, e.z, ARMY.terrain.floor),
  );
  h.heading = Math.atan2(q.x - e.x, q.z - e.z);
  h.vx = Math.sin(h.heading) * F.cruise;
  h.vz = Math.cos(h.heading) * F.cruise;
  h.vy = 0;
  h.phase = "hunt";
  h.t = 0;
  say(state, events, "arrived", h);
}

function turnHome(state: GameState, h: ArmyHeli, events: GameEvent[]): void {
  if (h.phase !== "hunt") return;
  h.phase = "leave";
  h.t = 0;
  say(state, events, "leaving", h);
}

// ─── the flight ────────────────────────────────────────────────────────

/** WHAT THE MACHINE WANTS: the velocity over the snow, m/s; the height of
 * its skid datum, m; the fastest it will go for it, m/s; and the heading,
 * rad — NaN for the way it is going. */
type Want = { vx: number; vz: number; y: number; most: number; face: number };

/** THE WAY ROUND A CIRCLE of `R` m about (cx, cz), itself moving at
 * (cvx, cvz): the circle's own way plus `speed` along it (the way round
 * `dir` says) and a closing on its radius — coming straight in from far
 * off at the cruise, the way round taken up as it nears. */
function circleWay(
  h: ArmyHeli,
  cx: number,
  cz: number,
  cvx: number,
  cvz: number,
  R: number,
  speed: number,
): { vx: number; vz: number } {
  const dx = h.x - cx;
  const dz = h.z - cz;
  const d = Math.max(1, hypot(dx, dz));
  const nx = dx / d;
  const nz = dz / d;
  const round = speed * (1 - smoothstep(1.5 * R, 3 * R, d));
  const close = clamp(ARMY.orbit.close * (R - d), -F.cruise, ARMY.orbit.close * R);
  return {
    vx: cvx + h.dir * nz * round + nx * close,
    vz: cvz - h.dir * nx * round + nz * close,
  };
}

/** WHAT IT WANTS while it hunts: round the pylon turn about him (or, out
 * of sight, round where he was last seen), or in echelon off his tail
 * quarter when he runs. */
function huntWant(state: GameState, h: ArmyHeli, w: WantedState): Want {
  const q = quarryOf(state);
  const seen = w.seen;
  const c = seen ? q : w.lastSeen;
  const qv = seen ? quarryVelocity(state) : { x: 0, y: 0, z: 0 };
  const R = seen ? ARMY.orbit.radius : ARMY.search.share * WANTED.searchRadius[w.stars];
  const speed = seen ? ARMY.orbit.speed : ARMY.search.speed;
  const up = seen ? ARMY.orbit.height : ARMY.search.height;
  const orbit = circleWay(h, c.x, c.z, qv.x, qv.z, R, speed);
  const run = hypot(qv.x, qv.z);
  const C = ARMY.chase;
  const k = seen ? smoothstep(0.6 * C.fast, C.fast, run) : 0;
  const near = hypot(h.x - c.x, h.z - c.z) < 1.6 * R;
  // The man square out of the gunner's door, while it circles him near.
  const face =
    seen && k < 0.5 && near ? Math.atan2(q.x - h.x, q.z - h.z) - h.dir * (Math.PI / 2) : NaN;
  if (k <= 0) return { vx: orbit.vx, vz: orbit.vz, y: c.y + up, most: F.cruise, face };
  // THE ECHELON: behind him and out to the side the gun bears on — his
  // right is (uz, −ux), and the inward door must have him on that side,
  // so the machine sits on his other side; flown at his way and closed on.
  const ux = qv.x / run;
  const uz = qv.z / run;
  const ex = q.x - ux * C.back - uz * C.aside * h.dir;
  const ez = q.z - uz * C.back + ux * C.aside * h.dir;
  const mix = (o: number, e: number) => o + (e - o) * k;
  return {
    vx: mix(orbit.vx, qv.x + F.gain * (ex - h.x)),
    vz: mix(orbit.vz, qv.z + F.gain * (ez - h.z)),
    y: mix(c.y + up, q.y + C.above),
    most: F.cruise + (F.most - F.cruise) * k,
    face: k > 0.5 ? Math.atan2(ux, uz) : face,
  };
}

/** WHAT IT WANTS on the way out: past the map's edge on its own bearing,
 * high, at its cruise. */
function homeWant(state: GameState, h: ArmyHeli): Want {
  const size = state.level.size;
  const b = Math.atan2(h.x - size / 2, h.z - size / 2);
  const e = edgePoint(size, b, -ARMY.leave.past * 2);
  const d = Math.max(1, hypot(e.x - h.x, e.z - h.z));
  return {
    vx: ((e.x - h.x) / d) * F.cruise,
    vz: ((e.z - h.z) / d) * F.cruise,
    y: state.level.groundAt(h.x, h.z) + ARMY.leave.height,
    most: F.cruise,
    face: NaN,
  };
}

/** FLY as it wants: the acceleration the velocity asks (inside the
 * disc's lean, smoothed), the height kept off the snow ahead and the floor
 * under it never broken, the attitude read off it all. */
function fly(state: GameState, a: ArmyState, h: ArmyHeli, s: Want): void {
  const level = state.level;
  let wx = s.vx;
  let wz = s.vz;
  // KEPT APART: off every other machine out.
  for (const o of a.helis) {
    if (o === h || (o.phase !== "hunt" && o.phase !== "leave")) continue;
    const dx = h.x - o.x;
    const dz = h.z - o.z;
    const d = hypot(dx, dz);
    if (d < ARMY.separate && d > 0.1) {
      const push = (ARMY.separate - d) * 0.4;
      wx += (dx / d) * push;
      wz += (dz / d) * push;
    }
  }
  const wv = hypot(wx, wz);
  if (wv > s.most) {
    wx *= s.most / wv;
    wz *= s.most / wv;
  }
  // THE ACCELERATION that asks for, inside the lean, the attitude's lag.
  const most = G * Math.tan(F.tilt);
  let ax = (wx - h.vx) / 1.2;
  let az = (wz - h.vz) / 1.2;
  const am = hypot(ax, az);
  if (am > most) {
    ax *= most / am;
    az *= most / am;
  }
  const lag = Math.min(1, dt / F.lag);
  h.ax += (ax - h.ax) * lag;
  h.az += (az - h.az) * lag;
  h.vx += h.ax * dt;
  h.vz += h.az * dt;
  // THE HEIGHT: over the station's, and clear of the snow it will meet.
  const flat = hypot(h.vx, h.vz);
  let ahead = level.groundAt(h.x, h.z);
  if (flat > 1) {
    const T = ARMY.terrain;
    for (let d = T.step; d <= flat * T.look; d += T.step)
      ahead = Math.max(ahead, level.groundAt(h.x + (h.vx / flat) * d, h.z + (h.vz / flat) * d));
  }
  const want = Math.max(s.y, ahead + ARMY.terrain.clear);
  const vy = clamp(0.5 * (want - h.y), -F.sink, F.climb);
  h.vy += clamp((vy - h.vy) * 1.5, -F.heave, F.heave) * dt;
  h.x += h.vx * dt;
  h.y += h.vy * dt;
  h.z += h.vz * dt;
  // THE FLOOR: never into the mountain or the woods.
  const low = armyFloor(state, h.x, h.z, ARMY.terrain.floor);
  if (h.y < low) {
    h.y = low;
    h.vy = Math.max(0, h.vy);
  }
  // THE ATTITUDE: the nose where it is asked, else the way it goes; leant
  // into the acceleration it pulls; the nose hung down at speed.
  const face = Number.isFinite(s.face) ? s.face : flat > 8 ? Math.atan2(h.vx, h.vz) : h.heading;
  const turn = clamp(angleDiff(h.heading, face) * 1.2, -F.yaw, F.yaw);
  h.yawRate += (turn - h.yawRate) * Math.min(1, dt / 0.5);
  h.heading = wrap(h.heading + h.yawRate * dt);
  const fx = Math.sin(h.heading);
  const fz = Math.cos(h.heading);
  const aF = h.ax * fx + h.az * fz;
  const aS = h.ax * fz - h.az * fx;
  const along = h.vx * fx + h.vz * fz;
  h.pitch = -Math.atan2(aF, G) - F.nose * along;
  h.roll = Math.atan2(aS, G);
}

/** RAMMED: spinning down, its tail rotor gone, until the snow stops it. */
function fall(state: GameState, h: ArmyHeli, events: GameEvent[]): void {
  h.vy -= G * 0.8 * dt;
  h.vx *= 1 - 0.3 * dt;
  h.vz *= 1 - 0.3 * dt;
  h.yawRate += (ARMY.ram.spin - h.yawRate) * Math.min(1, dt);
  h.heading = wrap(h.heading + h.yawRate * dt);
  h.roll += (0.5 - h.roll) * Math.min(1, dt * 0.8);
  h.pitch += (-0.2 - h.pitch) * Math.min(1, dt * 0.8);
  h.spool = Math.max(0.2, h.spool - 0.3 * dt);
  h.x += h.vx * dt;
  h.y += h.vy * dt;
  h.z += h.vz * dt;
  const ground = state.level.groundAt(h.x, h.z);
  if (h.y <= ground) {
    h.y = ground;
    h.vx = h.vy = h.vz = 0;
    h.yawRate = 0;
    h.roll = 0.35;
    h.pitch = -0.08;
    h.spool = 0;
    h.phase = "wreck";
    h.t = 0;
    say(state, events, "down", h);
  }
}

// ─── the landing ───────────────────────────────────────────────────────

/** Whether a machine is about a landing — on its way down to it, on the
 * snow, hovering for the rope, or climbing back off. */
export function landing(h: Pick<ArmyHeli, "phase">): boolean {
  return h.phase === "land" || h.phase === "set" || h.phase === "rope" || h.phase === "rise";
}

/** THE HOVER a fast rope is slid from over `task`'s spot: the rope's
 * height over the snow, never under the flight's floor over the woods. */
export function ropeHover(state: GameState, x: number, z: number, y: number): number {
  return Math.max(y + ARMY_GROUND.rope.hover, armyFloor(state, x, z, ARMY_GROUND.rope.hover));
}

/** The machine's attitude eased toward level, its nose toward `face`. */
function levelOut(h: ArmyHeli, face: number, k: number): void {
  const turn = clamp(angleDiff(h.heading, face) * 1.2, -F.yaw, F.yaw);
  h.yawRate += (turn - h.yawRate) * Math.min(1, dt / 0.5);
  h.heading = wrap(h.heading + h.yawRate * dt);
  h.pitch += (-k - h.pitch) * Math.min(1, dt / F.lag);
  h.roll += (0 - h.roll) * Math.min(1, dt / F.lag);
}

/** Both doors slid toward `open` (0 shut, 1 open). */
function slideDoors(h: ArmyHeli, open: number): void {
  for (const key of ["r", "l"] as const)
    h.doors[key] = clamp(
      h.doors[key] + Math.sign(open - h.doors[key]) * ARMY.guns.slide * dt,
      0,
      1,
    );
}

/** A LANDING, flown: in to its spot, slowing over the last of the way and
 * held `approach.over` m up until over it; then sunk onto the snow (`set`)
 * or held at the rope's hover (`rope`) while the ground's part puts the
 * men out or takes them in; then climbed straight back off it (`rise`) to
 * the hunt. A landing given up — the hunt over, the task done — climbs off
 * at once. */
function settle(state: GameState, h: ArmyHeli, w: WantedState, events: GameEvent[]): void {
  const A = ARMY_GROUND.approach;
  const task = h.task;
  if (task && w.ended !== null) task.done = true;
  if (h.phase === "land") {
    if (!task || task.done) {
      h.phase = "rise";
      h.t = 0;
      return;
    }
    const dx = task.x - h.x;
    const dz = task.z - h.z;
    const d = hypot(dx, dz);
    const hover = task.rope
      ? ropeHover(state, task.x, task.z, task.y)
      : Math.max(task.y + A.over, armyFloor(state, h.x, h.z, ARMY.terrain.floor));
    // In along the way, braked to a stop over it as a pilot flares: no
    // faster than `approach.decel` takes off by the spot.
    const sp = clamp(Math.sqrt(2 * A.decel * Math.max(0, d - 1)), A.slow, F.cruise);
    const wx = d > 0.5 ? (dx / d) * Math.min(sp, d) : 0;
    const wz = d > 0.5 ? (dz / d) * Math.min(sp, d) : 0;
    const most = G * Math.tan(F.tilt);
    const ax = clamp((wx - h.vx) / 1.2, -most, most);
    const az = clamp((wz - h.vz) / 1.2, -most, most);
    const lag = Math.min(1, dt / F.lag);
    h.ax += (ax - h.ax) * lag;
    h.az += (az - h.az) * lag;
    h.vx += h.ax * dt;
    h.vz += h.az * dt;
    h.x += h.vx * dt;
    h.z += h.vz * dt;
    const over = d < A.within && hypot(h.vx, h.vz) < 3;
    // Held up (clear of the snow ahead and the woods) until over it; then
    // down: to the snow, or to the rope's hover.
    const floor = armyFloor(state, h.x, h.z, ARMY.terrain.floor);
    const want = over ? (task.rope ? hover : task.y) : Math.max(hover, floor);
    const vy = clamp(0.6 * (want - h.y), over ? -A.sink : -F.sink, F.climb);
    h.vy += clamp((vy - h.vy) * 1.5, -F.heave, F.heave) * dt;
    h.y += h.vy * dt;
    if (!over && h.y < floor) {
      h.y = floor;
      h.vy = Math.max(0, h.vy);
    }
    const fx = Math.sin(h.heading);
    const fz = Math.cos(h.heading);
    h.pitch = -Math.atan2(h.ax * fx + h.az * fz, G) - F.nose * (h.vx * fx + h.vz * fz);
    h.roll = Math.atan2(h.ax * fz - h.az * fx, G);
    const face = d > 30 ? Math.atan2(dx, dz) : task.heading;
    const turn = clamp(angleDiff(h.heading, face) * 1.2, -F.yaw, F.yaw);
    h.yawRate += (turn - h.yawRate) * Math.min(1, dt / 0.5);
    h.heading = wrap(h.heading + h.yawRate * dt);
    if (over) slideDoors(h, 1);
    const down = task.rope ? Math.abs(h.y - hover) < 1.2 : h.y <= task.y + 0.05;
    if (over && down) {
      h.phase = task.rope ? "rope" : "set";
      h.t = 0;
      if (!task.rope) h.y = task.y;
      h.vx = h.vy = h.vz = h.ax = h.az = 0;
      say(state, events, "landed", h);
    }
    return;
  }
  if (h.phase === "set" || h.phase === "rope") {
    h.vx = h.vy = h.vz = h.ax = h.az = 0;
    if (task) {
      // Held on the spot: on the snow, or at the hover over it.
      h.x += (task.x - h.x) * Math.min(1, dt);
      h.z += (task.z - h.z) * Math.min(1, dt);
      if (h.phase === "set") h.y = task.y;
    }
    levelOut(h, task ? task.heading : h.heading, h.phase === "set" ? 0.02 : 0.03);
    slideDoors(h, 1);
    if (!task || task.done || h.t > ARMY_GROUND.dismount.wait + 30) {
      h.phase = "rise";
      h.t = 0;
    }
    return;
  }
  // RISE: straight up off it, then the hunt again.
  const top = Math.max(
    armyFloor(state, h.x, h.z, ARMY.terrain.floor),
    state.level.groundAt(h.x, h.z) + ARMY.terrain.clear,
  );
  h.vx = h.vz = h.ax = h.az = 0;
  h.vy += clamp((A.climb - h.vy) * 1.5, -F.heave, F.heave) * dt;
  h.y += h.vy * dt;
  levelOut(h, h.heading, 0.04);
  slideDoors(h, 0);
  if (h.y >= top) {
    h.phase = "hunt";
    h.t = 0;
    h.task = null;
    say(state, events, "lifted", h);
  }
}

// ─── the guns ──────────────────────────────────────────────────────────

/** The id of the gun in `side`'s door. */
const gunId = (h: ArmyHeli, side: 1 | -1): number => ARMY.ids.gun + 2 * h.id + (side === 1 ? 0 : 1);

/** SHARE OUT THE GUNNERS: the roster's across the machines out, two a
 * machine, the inward door first. */
function man(a: ArmyState, gunners: number): void {
  let left = gunners;
  for (const h of a.helis) {
    const n = h.phase === "hunt" ? Math.min(2, Math.max(0, left)) : 0;
    left -= n;
    const inward = h.dir === 1 ? "r" : "l";
    h.manned.r = n === 2 || (n === 1 && inward === "r");
    h.manned.l = n === 2 || (n === 1 && inward === "l");
  }
}

/** THE DOORS AND THE GUNS of one machine: each door slid toward open
 * within reach of him, each manned gun turned onto him inside its arc and
 * fired whenever it bears. */
function fight(state: GameState, h: ArmyHeli, w: WantedState): void {
  const q = quarryOf(state);
  const aim = { x: q.x, y: q.y + CHEST, z: q.z };
  const range = hypot3(aim.x - h.x, aim.y - h.y, aim.z - h.z);
  const hunting = h.phase === "hunt" && w.seen && w.ended === null;
  const quat = armyQuat(h);
  const Gn = ARMY_HELI.gun;
  for (const side of DOORS) {
    const key = side === 1 ? "r" : "l";
    const manned = h.manned[key];
    const open = manned && hunting && range < ARMY.guns.open ? 1 : 0;
    h.doors[key] = clamp(
      h.doors[key] + Math.sign(open - h.doors[key]) * ARMY.guns.slide * dt,
      0,
      1,
    );
    h.bears[key] = false;
    if (!manned || h.phase !== "hunt") {
      disarmGun(state, gunId(h, side));
      continue;
    }
    const pivot = armyPoint(h, pivotOf(side));
    const d = unrotate(quat, { x: aim.x - pivot.x, y: aim.y - pivot.y, z: aim.z - pivot.z });
    const yaw = Math.atan2(d.z, side * d.x);
    const pitch = Math.atan2(d.y, hypot(d.x, d.z));
    const slack = ARMY.guns.slack;
    const inArc =
      Math.abs(yaw) <= Gn.yaw + slack &&
      pitch <= Gn.pitch.up + slack &&
      pitch >= -Gn.pitch.down - slack;
    // The gun traversed onto him (or back to its rest) at a man's pace.
    const to = hunting && inArc ? { yaw, pitch } : ARMY.guns.rest;
    const g = h.guns[key];
    const turn = 2.5 * dt;
    g.yaw += clamp(angleDiff(g.yaw, to.yaw), -turn, turn);
    g.pitch += clamp(to.pitch - g.pitch, -turn, turn);
    g.yaw = clamp(g.yaw, -Gn.yaw, Gn.yaw);
    g.pitch = clamp(g.pitch, -Gn.pitch.down, Gn.pitch.up);
    // The muzzle out along the gun as it points.
    const cy = Math.cos(g.pitch);
    const ahead = rotate(quat, {
      x: side * cy * Math.cos(g.yaw),
      y: Math.sin(g.pitch),
      z: cy * Math.sin(g.yaw),
    });
    const m = Gn.muzzle.ahead;
    const gun = armGun(
      state,
      gunId(h, side),
      "doorGun",
      pivot.x + ahead.x * m,
      pivot.y + ahead.y * m,
      pivot.z + ahead.z * m,
    );
    gun.x = pivot.x + ahead.x * m;
    gun.y = pivot.y + ahead.y * m;
    gun.z = pivot.z + ahead.z * m;
    gun.vx = h.vx;
    gun.vy = h.vy;
    gun.vz = h.vz;
    const laid = Math.abs(angleDiff(g.yaw, yaw)) < 0.05 && Math.abs(g.pitch - pitch) < 0.05;
    if (!hunting || !inArc || !laid || h.doors[key] < 0.9 || range > ARMY.guns.engage) continue;
    if (!seesQuarry(state.level, { kind: "gunner", x: pivot.x, y: pivot.y, z: pivot.z }, q))
      continue;
    h.bears[key] = true;
    fireAt(state, gun, { kind: "quarry" });
  }
}

// ─── the ram ───────────────────────────────────────────────────────────

/** HIS STOLEN MACHINE INTO ONE OF THEIRS: theirs falls, his crashes —
 * or, with SAFE FOR WORK on, his is put back off theirs. */
function ram(state: GameState, a: ArmyState, events: GameEvent[]): void {
  const p = state.heli;
  if (!p || !p.rider || p.mode === "wreck") return;
  const hubP = p.y + HELI.rotor.hub;
  for (const h of a.helis) {
    if (h.phase !== "hunt" && h.phase !== "leave" && !landing(h)) continue;
    const dx = p.x - h.x;
    const dz = p.z - h.z;
    const flat = hypot(dx, dz);
    const reach = HELI.rotor.radius + ARMY_HELI.rotor.radius;
    const disc = flat < reach && Math.abs(hubP - (h.y + ARMY_HELI.rotor.hub)) < ARMY.ram.disc;
    const hull = hypot3(dx, p.y - h.y, dz) < ARMY.ram.hull;
    if (!disc && !hull) continue;
    if (state.rules.sfw) {
      // Nothing is struck: his machine is put back outside their disc.
      const nx = flat > 0.1 ? dx / flat : 1;
      const nz = flat > 0.1 ? dz / flat : 0;
      p.x = h.x + nx * reach;
      p.z = h.z + nz * reach;
      const toward = (p.vx - h.vx) * nx + (p.vz - h.vz) * nz;
      if (toward < 0) {
        p.vx -= nx * toward;
        p.vz -= nz * toward;
      }
      continue;
    }
    h.phase = "fall";
    h.t = 0;
    h.vx = 0.6 * h.vx + 0.4 * p.vx;
    h.vz = 0.6 * h.vz + 0.4 * p.vz;
    a.downed++;
    disarmGun(state, gunId(h, 1));
    disarmGun(state, gunId(h, -1));
    say(state, events, "rammed", h);
    crashHeli(state, events);
    raiseHeat(state, "downed-helicopter");
    return;
  }
}

// ─── the pursuers ──────────────────────────────────────────────────────

/** WRITE THE ARMY'S AIR into the wanted level's pursuers: every machine
 * hunting, and every gunner in an open door. */
function writePursuers(state: GameState, a: ArmyState, w: WantedState): void {
  const lo = ARMY.ids.pursuer;
  const kept = w.pursuers.filter((p) => p.id < lo || p.id >= lo + 300);
  for (const h of a.helis) {
    if (h.phase !== "hunt" && !landing(h)) continue;
    kept.push({ id: lo + h.id, kind: "helicopter", x: h.x, y: h.y + 2, z: h.z });
    for (const side of DOORS) {
      const key = side === 1 ? "r" : "l";
      if (!h.manned[key] || h.doors[key] < 0.5) continue;
      const g = armyPoint(h, pivotOf(side));
      kept.push({ id: lo + 100 + 2 * h.id + (side === 1 ? 0 : 1), kind: "gunner", ...g });
    }
  }
  w.pursuers = kept;
}

// ─── the step ──────────────────────────────────────────────────────────

/** THE ARMY'S HELICOPTERS' STEP, on a hunted run: the call, every
 * machine flown, every gun fought, a ram, the pursuers written. After the
 * wanted level, before the gunfire. */
export function stepArmy(state: GameState, events: GameEvent[]): void {
  const w = state.wanted;
  if (!w) return;
  const on = w.ended === null && w.stars > 0;
  const roster = rosterOf(on ? w.stars : 0);
  if (!state.army) {
    if (roster.helicopters === 0) return;
    state.army = freshArmy(state);
  }
  const a = state.army;
  if (a.home) return;
  call(state, a, roster.helicopters, events);
  man(a, roster.gunners);
  const size = state.level.size;
  for (const h of a.helis) {
    h.t += dt;
    if (h.phase === "due") {
      if (state.t >= h.due) arrive(state, h, events);
      continue;
    }
    if (h.phase === "hunt" && h.task && !h.task.done) {
      h.phase = "land";
      h.t = 0;
    }
    if (landing(h)) {
      settle(state, h, w, events);
    } else if (h.phase === "hunt") {
      fly(state, a, h, huntWant(state, h, w));
      fight(state, h, w);
      const reach = Math.max(WANTED.searchRadius[w.stars], ARMY.orbit.radius * 2);
      if (hypot(h.x - w.lastSeen.x, h.z - w.lastSeen.z) < reach) h.on = true;
    } else if (h.phase === "leave") {
      fly(state, a, h, homeWant(state, h));
      fight(state, h, w);
      const past = ARMY.leave.past;
      if (h.x < -past || h.z < -past || h.x > size + past || h.z > size + past) {
        h.phase = "gone";
        say(state, events, "gone", h);
      }
    } else if (h.phase === "fall") {
      fall(state, h, events);
    } else if (h.phase === "wreck" && h.t > ARMY.ram.wreck) {
      h.phase = "gone";
    }
  }
  ram(state, a, events);
  a.helis = a.helis.filter((h) => h.phase !== "gone");
  // ON THEIR WAY: the search does not run out before the first machine
  // has even reached it — the stars flash, but are not lost.
  if (on && !w.seen && a.helis.some((h) => h.phase === "due" || h.phase === "hunt")) {
    if (!a.helis.some((h) => h.on)) w.unseen = 0;
  }
  writePursuers(state, a, w);
}

/** The army's machines in the air or on the snow (not the ones called and
 * not yet in), for the drawing, the ear and the labs. */
export function armyHelis(state: GameState): readonly ArmyHeli[] {
  return state.army ? state.army.helis.filter((h) => h.phase !== "due") : [];
}
