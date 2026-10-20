// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S PARAMOTORS — riflemen in the harness of the game's own
// paramotor (`PARA`), flown in at the map's edge, circling the hunted man
// and firing on him through the gunfire layer.
//
// THE FLIGHT is the free ride's paramotor's, on the canopy's own maths
// (`canopy.ts`) and its own numbers: the wing a point mass flying by its
// polar on its lines, its angle of attack read off the air through it
// against the plane square to the lines plus the trim; the turn a side
// force toward the toggle pulled and the canopy righting itself as it
// banks; the engine's thrust falling with the air through the propeller;
// the swing damped against the air; the lines pulled tight on both bodies
// (they only pull). The pilot is a soldier in the harness — a point with
// his kit's weight, the motor's on his back and a seated man's drag —
// instead of the skier, so nothing of `para.ts` that reads the skier's
// body is crossed.
//
// THE HANDS. A pilot circling a man on the snow flies a ground track, not
// a heading: the way round the circle (and in or out onto it), and the
// heading that holds that track with the wind blowing him off it — the
// CRAB a pilot reads off his drift. The toggles follow that heading, damped
// against the turn already going. The throttle holds a height over the
// circle's highest snow, crowns and lift ropes and over the ground ahead;
// under the hard floor it goes to full. Two paramotors keep apart, and
// both keep off the army's helicopters' discs. A pilot does not fly in a
// wind past `most`: the roster's paramotors stay on the ground.
//
// THE RIFLE. He fires a burst at a time within `fire.range` of him with
// him in sight, through the gunfire layer under the wanted level's rules
// of fire — warning fire only with SAFE FOR WORK on.
//
// BROUGHT DOWN. A skier cannot reach him; a stolen helicopter can — its
// blades through the wing or its wash over it collapse it — and so can a
// rocket's burst near the wing (`army-burst.ts`). The soldier then rides
// his reserve down (always with SAFE FOR WORK on, and with the INJURIES on
// when he is high enough to open it) and, on the snow, fights on as a
// soldier on foot (`army-ground.ts`); or he falls under the collapsed cloth
// and lies where he lands. A paramotor flown into the snow or a crown is
// counted (`parasLost`) — it is a fault, and the labs hold it at nought.
//
// Nothing here draws from any stream: every choice is a pure function of
// the state and the paramotor's id, so a hunt replays and no digest moves.

import { angleDiff, clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { ARMY_AIR } from "./defs/army-air.ts";
import { ARMY_GROUND } from "./defs/army-ground.ts";
import { ARMY_HELI } from "./defs/army-heli.ts";
import { HELI } from "./defs/heli.ts";
import { PARA } from "./defs/para.ts";
import { TUNING } from "./defs/tuning.ts";
import { WANTED } from "./defs/wanted.ts";
import { crownAt, fallPiece, lineDir, liftDrag, pullLines, swingDamp, wayOf } from "./canopy.ts";
import { paraAirAt, type ParaAir } from "./para-air.ts";
import { armGun, disarmGun, fireAt, gunReady } from "./gunfire.ts";
import { enlist } from "./army-troop.ts";
import { liftPlans, ropeAt } from "./lift-line.ts";
import { treesNear } from "./upright-grid.ts";
import { quarryOf, raiseHeat, seesQuarry } from "./wanted.ts";
import type { ArmyAirEvent, ArmyAirState, ArmyPara, ArmyParaDown } from "./army-air-state.ts";
import type { GameEvent, GameState, ParaState } from "./state.ts";
import type { WantedState } from "./wanted-state.ts";

const dt = TUNING.dt;
const K = ARMY_AIR.para;
const W = PARA.wing;
const P = PARA.polar;
const B = PARA.brakes;
const E = PARA.engine;
/** The pilot on the lines: the soldier with his kit and the motor. */
const MASS = ARMY_GROUND.mass + PARA.motorMass;
/** How fast the toggles and the throttle follow his hands, s (the free
 * ride's own). */
const HANDS = 0.12;
/** How often the height it holds is read, s. */
const READ = 0.5;
/** The soldiers of a paramotor brought down are numbered from here. */
export const AIR_SQUAD = 60_000;

const U = { x: 0, y: 1, z: 0 };
const FW = { x: 0, y: 0, z: 1 };
const AF = { x: 0, y: 0, z: 0 };
const SD = { x: 0, y: 0, z: 0 };
const air: ParaAir = { x: 0, y: 0, z: 0, mean: 0, lift: 0, rough: 0, lee: 0 };
const trunks: number[] = [];

type V = { x: number; y: number; z: number };

function say(
  state: GameState,
  events: GameEvent[],
  change: ArmyAirEvent["change"],
  p: ArmyPara,
): void {
  events.push({
    kind: "army-air",
    t: state.t,
    change,
    craft: "paramotor",
    id: p.id,
    x: p.x,
    y: p.y,
    z: p.z,
  });
}

const gunOf = (p: ArmyPara): number => ARMY_AIR.ids.gun + p.id;

/** A WING flying over a pilot at (x, y, z) heading `h` at `speed` — the
 * free ride's paramotor's state, so its drawing hangs off it. */
function wingOver(x: number, y: number, z: number, h: number, speed: number): ParaState {
  const fx = Math.sin(h);
  const fz = Math.cos(h);
  return {
    mode: "flown",
    x,
    y: y + W.lines,
    z,
    vx: fx * speed,
    vy: 0,
    vz: fz * speed,
    heading: h,
    bank: 0,
    pitch: 0,
    airspeed: speed,
    alpha: 0,
    stalled: false,
    fold: 0,
    foldSide: 0,
    wind: 0,
    lift: 0,
    rough: 0,
    tension: 0,
    g: 1,
    way: { x: fx, y: 0, z: fz },
    swing: 0,
    loops: 0,
    slack: 0,
    rears: 0,
    hold: { x: 0, y: 0, z: 0, at: -1 },
    controls: { throttle: K.hands.trim, brake: 0, steer: 0, bar: 0 },
    rpm: E.idle + (E.full - E.idle) * K.hands.trim,
    thrust: 0,
    prop: 0,
    flying: true,
    agl: 0,
    climb: 0,
    t: 0,
    airTime: 0,
    start: { x, z, heading: h },
    canopy: null,
    motor: null,
  };
}

/** A paramotor called in on bearing `bearing` from the map's middle, at
 * run time `due`. */
export function freshPara(id: number, due: number, bearing: number): ArmyPara {
  return {
    id,
    mode: "due",
    due,
    t: 0,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    wing: wingOver(0, 0, 0, 0, 0),
    dir: id % 2 === 0 ? 1 : -1,
    bearing,
    want: 0,
    read: -Infinity,
    rate: 0,
    aimH: 0,
    aimP: 0,
    next: 0,
    saw: -Infinity,
    fired: -Infinity,
    firing: false,
    why: null,
    reserve: false,
  };
}

/** ON THE MAP at the edge, `enter` m over the snow, heading for him at the
 * wing's trim. */
export function launchPara(state: GameState, p: ArmyPara, events: GameEvent[]): void {
  const size = state.level.size;
  const sx = Math.sin(p.bearing);
  const sz = Math.cos(p.bearing);
  const r = (size / 2 - K.inset) / Math.max(Math.abs(sx), Math.abs(sz), 1e-6);
  p.x = size / 2 + sx * r;
  p.z = size / 2 + sz * r;
  p.y = state.level.groundAt(p.x, p.z) + K.enter;
  const q = quarryOf(state);
  const h = Math.atan2(q.x - p.x, q.z - p.z);
  const trim = 15;
  p.vx = Math.sin(h) * trim;
  p.vy = 0;
  p.vz = Math.cos(h) * trim;
  p.wing = wingOver(p.x, p.y, p.z, h, trim);
  p.want = p.y;
  p.mode = "fly";
  p.t = 0;
  say(state, events, "out", p);
}

// ─── the flight ────────────────────────────────────────────────────────

/** ONE STEP OF THE RIG under the hands `steer` (−1..1), `throttle` and
 * `brake` (0..1): the engine, the pilot, the wing on its lines. */
export function flyPara(
  state: GameState,
  p: ArmyPara,
  steer: number,
  throttle: number,
  brake: number,
): void {
  const level = state.level;
  const w = p.wing;
  const ctl = w.controls;
  const k = 1 - Math.exp(-dt / HANDS);
  ctl.steer += (clamp(steer, -1, 1) - ctl.steer) * k;
  ctl.throttle += (clamp(throttle, 0, 1) - ctl.throttle) * k;
  ctl.brake += (clamp(brake, 0, 1) - ctl.brake) * k;
  // THE ENGINE, its thrust along the way he faces, tilted up its line.
  const goal = E.idle + (E.full - E.idle) * ctl.throttle;
  w.rpm += (goal - w.rpm) * (1 - Math.exp(-dt / E.lag));
  w.prop = (w.prop + (w.rpm / 60) * 2 * Math.PI * dt) % (2 * Math.PI);
  const ax0 = Math.sin(w.heading) * Math.cos(E.tilt);
  const ay0 = Math.sin(E.tilt);
  const az0 = Math.cos(w.heading) * Math.cos(E.tilt);
  const through = Math.max(0, p.vx * ax0 + p.vy * ay0 + p.vz * az0);
  const r = w.rpm / E.full;
  w.thrust = E.thrust * r * r * Math.max(0, 1 - through / E.pitchSpeed);
  // THE AIR at the wing (`para-air.ts`): the wind, its rise, its eddies.
  paraAirAt(level, state.t, w.x, w.y, w.z, air);
  w.wind = air.mean;
  w.lift = air.lift;
  w.rough = air.rough;
  // THE PILOT: his weight, the thrust, a seated man's drag in the air.
  const px = p.vx - air.x;
  const py = p.vy - air.y;
  const pz = p.vz - air.z;
  const pv = hypot3(px, py, pz);
  const kd = (0.5 * TUNING.airDensity * K.drag * pv) / MASS;
  p.vx += (w.thrust * ax0 / MASS - kd * px) * dt;
  p.vy += (w.thrust * ay0 / MASS - kd * py - TUNING.g) * dt;
  p.vz += (w.thrust * az0 / MASS - kd * pz) * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.z += p.vz * dt;
  // THE WING: the polar off the air through it, square to its lines.
  lineDir(w, p, U);
  const ax = w.vx - air.x;
  const ay = w.vy - air.y;
  const az = w.vz - air.z;
  const V = hypot3(ax, ay, az);
  const down = ax * U.x + ay * U.y + az * U.z;
  wayOf(ax, ay, az, down, U, w.heading, FW);
  const alpha =
    PARA.rig + B.rig * ctl.brake + Math.atan2(-down, Math.max(1e-3, ax * FW.x + ay * FW.y + az * FW.z));
  w.stalled = alpha > P.stall - B.stall * ctl.brake;
  const base = clamp(P.slope * (alpha - P.zero) + B.lift * ctl.brake, 0, P.most);
  const lift = w.stalled ? P.stalled : base;
  const drag =
    P.drag0 +
    P.induced * lift * lift +
    B.drag * ctl.brake * ctl.brake +
    PARA.turn.drag * Math.abs(ctl.steer) +
    (w.stalled ? P.stallDrag : 0);
  const qS = 0.5 * TUNING.airDensity * V * V * W.area;
  liftDrag(ax, ay, az, V, U, qS, lift, drag, AF);
  // THE TURN: the toggle and his weight, the engine's torque, the canopy
  // righting itself as it banks — along the canopy's right, u × f.
  const rx = U.y * FW.z - U.z * FW.y;
  const ry = U.z * FW.x - U.x * FW.z;
  const rz = U.x * FW.y - U.y * FW.x;
  const T = PARA.turn;
  const wh = hypot(FW.x, FW.z);
  const banked = wh > 0.2 ? (U.x * FW.z - U.z * FW.x) / wh : 0;
  const side =
    qS * ((T.side + T.weight) * ctl.steer + T.torque * (w.thrust / E.thrust) - T.righting * banked);
  swingDamp(w, p, U, PARA.damping, MASS, SD);
  w.vx += ((AF.x + side * rx + SD.x) / W.mass) * dt;
  w.vy += ((AF.y + side * ry + SD.y) / W.mass - TUNING.g) * dt;
  w.vz += ((AF.z + side * rz + SD.z) / W.mass) * dt;
  w.x += w.vx * dt;
  w.y += w.vy * dt;
  w.z += w.vz * dt;
  w.tension = pullLines(w, p, W.lines, W.mass, MASS);
  w.way.x = FW.x;
  w.way.y = FW.y;
  w.way.z = FW.z;
  // What it is drawn by.
  const was = w.heading;
  w.heading = Math.atan2(FW.x, FW.z);
  p.rate += (angleDiff(was, w.heading) / dt - p.rate) * (1 - Math.exp(-dt / 0.4));
  const hx = Math.cos(w.heading);
  const hz = -Math.sin(w.heading);
  w.bank = Math.atan2(U.x * hx + U.z * hz, U.y);
  w.pitch = alpha - PARA.rig;
  w.airspeed = V;
  w.alpha = alpha;
  const ground = level.groundAt(p.x, p.z);
  w.agl = Math.max(0, p.y - ground);
  w.climb = p.vy;
  w.t += dt;
  w.airTime += dt;
}

// ─── the hands ─────────────────────────────────────────────────────────

/** THE HIGHEST a paramotor must clear at (x, z), m: the snow, the crowns
 * near it and any lift's rope across it, each with its own clearance. */
function clearAt(state: GameState, x: number, z: number): number {
  const level = state.level;
  const C = K.clear;
  let top = level.groundAt(x, z) + C.snow;
  for (const i of treesNear(level, x, z, 14, trunks)) {
    const t = level.trees[i];
    top = Math.max(top, t.y + t.height + C.crowns);
  }
  for (const plan of liftPlans(level)) {
    const ox = x - plan.lift.bottom.x;
    const oz = z - plan.lift.bottom.z;
    const u = ox * plan.dx + oz * plan.dz;
    if (u < -20 || u > plan.length + 20) continue;
    if (Math.abs(ox * plan.dz - oz * plan.dx) > 30) continue;
    top = Math.max(top, ropeAt(plan, clamp(u, 0, plan.length)) + C.rope);
  }
  return top;
}

/** THE HEIGHT TO HOLD flying round (cx, cz) at radius `R` and `over` m over
 * `cy`: that, or the highest the circle and the way ahead must clear. */
function heightFor(state: GameState, p: ArmyPara, cx: number, cy: number, cz: number, R: number, over: number): number {
  let want = cy + over;
  const n = K.clear.ring;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    want = Math.max(want, clearAt(state, cx + Math.sin(a) * R, cz + Math.cos(a) * R));
  }
  const look = K.clear.look;
  for (let s = 0; s <= look; s += 1.5)
    want = Math.max(want, clearAt(state, p.x + p.vx * s, p.z + p.vz * s));
  return want;
}

/** THE HEADING THAT HOLDS THE TRACK `track` (rad) against the wind (`wx`,
 * `wz`) at airspeed `va` — the crab a pilot reads off his drift. */
export function crabFor(track: number, wx: number, wz: number, va: number): number {
  const right = wx * Math.cos(track) - wz * Math.sin(track);
  return track + Math.asin(clamp(-right / Math.max(5, va), -0.9, 0.9));
}

/** The hands to fly the ground track `gx, gz` (unit) and hold height
 * `want`: the steer and the throttle. */
function handsFor(state: GameState, p: ArmyPara, gx: number, gz: number): { steer: number; throttle: number } {
  const w = p.wing;
  const h = crabFor(Math.atan2(gx, gz), air.x, air.z, w.airspeed);
  const H = K.hands;
  const err = angleDiff(w.heading, h);
  const steer = clamp(H.steer * err - 0.6 * p.rate, -H.most, H.most);
  const ground = state.level.groundAt(p.x, p.z);
  const low = p.y < ground + K.clear.floor || p.y < clearAt(state, p.x, p.z) - K.clear.snow + K.clear.floor;
  const throttle = low ? 1 : clamp(H.trim + H.perMetre * (p.want - p.y) - H.perClimb * p.vy, 0, 1);
  return { steer, throttle };
}

/** THE TRACK round the circle at (cx, cz), radius `R`: round it, in or out
 * onto it, and off the others' tracks and the helicopters' discs. */
function trackRound(state: GameState, air2: ArmyAirState, p: ArmyPara, cx: number, cz: number, R: number): V {
  let rx = p.x - cx;
  let rz = p.z - cz;
  const d = Math.max(1, hypot(rx, rz));
  rx /= d;
  rz /= d;
  const tx = p.dir * rz;
  const tz = -p.dir * rx;
  const O = K.orbit;
  const inward = d > O.far * R ? 3 : clamp((R - d) * O.close * 3, -2, 2);
  let gx = tx + rx * inward;
  let gz = tz + rz * inward;
  // Kept off the others and the helicopters.
  for (const o of air2.paras) {
    if (o === p || o.mode !== "fly") continue;
    const ox = p.x - o.x;
    const oz = p.z - o.z;
    const od = hypot(ox, oz);
    if (od < K.separate && od > 0.1 && Math.abs(p.y - o.y) < 30) {
      const push = (1 - od / K.separate) * 2;
      gx += (ox / od) * push;
      gz += (oz / od) * push;
    }
  }
  for (const h of state.army?.helis ?? []) {
    if (h.phase === "due" || h.phase === "gone") continue;
    const ox = p.x - h.x;
    const oz = p.z - h.z;
    const od = hypot(ox, oz);
    const keep = K.heli + ARMY_HELI.rotor.radius;
    if (od < keep && od > 0.1 && Math.abs(p.y - h.y) < 40) {
      const push = (1 - od / keep) * 3;
      gx += (ox / od) * push;
      gz += (oz / od) * push;
    }
  }
  const g = Math.max(1e-6, hypot(gx, gz));
  return { x: gx / g, y: 0, z: gz / g };
}

// ─── the hunt ──────────────────────────────────────────────────────────

/** FLY ONE PARAMOTOR ON THE HUNT: round him where he is seen, round where
 * he was last seen where he is not; the rifle fired when it may. */
export function huntPara(
  state: GameState,
  air2: ArmyAirState,
  p: ArmyPara,
  w: WantedState,
  events: GameEvent[],
): void {
  const q = quarryOf(state);
  const seen = w.seen;
  const c = seen ? q : w.lastSeen;
  const size = state.level.size;
  const R = K.orbit.radius * (seen ? 1 : K.search.wider);
  const cx = clamp(c.x, R + 60, size - R - 60);
  const cz = clamp(c.z, R + 60, size - R - 60);
  if (state.t - p.read >= READ) {
    p.read = state.t;
    p.want = heightFor(state, p, cx, c.y, cz, R, seen ? K.orbit.height : K.search.height);
  }
  // The air at the wing as it last read, for the crab.
  paraAirAt(state.level, state.t, p.wing.x, p.wing.y, p.wing.z, air);
  const g = trackRound(state, air2, p, cx, cz, R);
  const hands = handsFor(state, p, g.x, g.z);
  flyPara(state, p, hands.steer, hands.throttle, 0);
  fireRifle(state, p, w, q, events);
}

/** FLY ONE HOME: out over the edge on its bearing, climbing. */
export function leavePara(state: GameState, p: ArmyPara, events: GameEvent[]): void {
  p.firing = false;
  disarmGun(state, gunOf(p));
  const size = state.level.size;
  const gx = Math.sin(p.bearing);
  const gz = Math.cos(p.bearing);
  if (state.t - p.read >= READ) {
    p.read = state.t;
    p.want = Math.max(state.level.groundAt(p.x, p.z) + K.leave.height, heightFor(state, p, p.x, p.y, p.z, 0, 0));
  }
  paraAirAt(state.level, state.t, p.wing.x, p.wing.y, p.wing.z, air);
  const hands = handsFor(state, p, gx, gz);
  flyPara(state, p, hands.steer, hands.throttle, 0);
  const past = K.leave.past;
  if (p.x < -past || p.z < -past || p.x > size + past || p.z > size + past) {
    p.mode = "gone";
    say(state, events, "gone", p);
  }
}

/** THE RIFLE FROM THE HARNESS: turned onto him, and a burst whenever he is
 * in reach and in sight and the last one is far enough behind. */
function fireRifle(state: GameState, p: ArmyPara, w: WantedState, q: V, events: GameEvent[]): void {
  const ty = q.y + WANTED.line.chest;
  const dx = q.x - p.x;
  const dz = q.z - p.z;
  const flat = hypot(dx, dz);
  p.aimH = Math.atan2(dx, dz);
  p.aimP = Math.atan2(ty - p.y, flat);
  p.firing = state.t - p.fired < 1.5;
  if (w.ended !== null || hypot3(dx, ty - p.y, dz) > K.fire.range) return;
  const eye = { kind: "paramotor" as const, x: p.x, y: p.y + 0.6, z: p.z };
  if (!seesQuarry(state.level, eye, q)) return;
  p.saw = state.t;
  if (state.t < p.next) return;
  const mx = p.x + Math.sin(p.aimH) * 0.6;
  const mz = p.z + Math.cos(p.aimH) * 0.6;
  const gun = armGun(state, gunOf(p), "rifle", mx, p.y + 0.3, mz);
  gun.x = mx;
  gun.y = p.y + 0.3;
  gun.z = mz;
  gun.vx = p.vx;
  gun.vy = p.vy;
  gun.vz = p.vz;
  if (!gunReady(gun)) return;
  if (fireAt(state, gun, { kind: "quarry" })) {
    // Each man's rhythm his own, off his id.
    p.next = state.t + K.fire.every * (1 + 0.3 * ((p.id * 0.618) % 1));
    p.fired = state.t;
    say(state, events, "fire", p);
  }
}

// ─── brought down ──────────────────────────────────────────────────────

/** THE WING GONE: the soldier falling under the cloth or his reserve. */
export function downPara(
  state: GameState,
  air2: ArmyAirState,
  p: ArmyPara,
  why: ArmyParaDown,
  events: GameEvent[],
): void {
  if (p.mode !== "fly" && p.mode !== "leave") return;
  p.mode = "fall";
  p.t = 0;
  p.why = why;
  p.firing = false;
  disarmGun(state, gunOf(p));
  // The reserve: always SAFE FOR WORK; with the INJURIES on, if he is
  // high enough to open it.
  p.reserve = state.rules.sfw === true || p.wing.agl > 60;
  const w = p.wing;
  w.mode = "dropped";
  w.flying = false;
  w.thrust = 0;
  w.canopy = { x: w.x, y: w.y, z: w.z, vx: w.vx, vy: w.vy, vz: w.vz, heading: w.heading, down: false };
  w.motor = null;
  if (why === "terrain") {
    air2.parasLost++;
    say(state, events, "crash", p);
  } else {
    air2.parasDowned++;
    say(state, events, "downed", p);
    if (why !== "burst") raiseHeat(state, "hit-soldier");
  }
}

/** FALLING, and on the snow. */
export function fallPara(state: GameState, p: ArmyPara, events: GameEvent[]): void {
  const level = state.level;
  const w = p.wing;
  w.rpm *= Math.exp(-dt / 1.2);
  w.prop = (w.prop + (w.rpm / 60) * 2 * Math.PI * dt) % (2 * Math.PI);
  if (w.canopy) fallPiece(level, w.canopy, W.mass, PARA.dropped.canopyDrag, air.x, air.z);
  if (p.mode === "down") {
    if (p.t > K.downed.lie) p.mode = "gone";
    return;
  }
  if (p.reserve) {
    // Under the reserve: sinking at its rate, carried by the wind.
    paraAirAt(level, state.t, p.x, p.y, p.z, air);
    const k = 1 - Math.exp(-dt / 1.5);
    p.vx += (air.x - p.vx) * k;
    p.vz += (air.z - p.vz) * k;
    p.vy += (-K.downed.reserve - p.vy) * k;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
  } else {
    const piece = { x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz, down: false };
    fallPiece(level, piece, MASS, PARA.acro.tangle.drag);
    p.x = piece.x;
    p.y = piece.y;
    p.z = piece.z;
    p.vx = piece.vx;
    p.vy = piece.vy;
    p.vz = piece.vz;
  }
  w.x = p.x;
  w.y = p.y + 0.6;
  w.z = p.z;
  const ground = level.groundAt(p.x, p.z);
  if (p.y <= ground) {
    p.y = ground;
    p.vx = p.vy = p.vz = 0;
    p.t = 0;
    say(state, events, "landed", p);
    if (p.reserve && state.army) {
      // ON HIS FEET: a soldier on the ground from here (`army-ground.ts`).
      const s = enlist(state, state.army, "foot", "air", AIR_SQUAD + p.id, "chase", p.x, p.z, p.wing.heading);
      s.next = state.t + 3;
      p.mode = "gone";
    } else p.mode = "down";
  }
}

/** WHAT CAN BRING ONE DOWN IN THE AIR: his stolen helicopter's blades or
 * its wash over the wing — and, a fault the labs count, the snow or a crown
 * it was flown into. */
export function meetPara(
  state: GameState,
  air2: ArmyAirState,
  p: ArmyPara,
  events: GameEvent[],
): void {
  const level = state.level;
  const w = p.wing;
  if (p.y <= level.groundAt(p.x, p.z) + 0.3 || crownAt(level, w.x, w.y, w.z, 0.5) >= 0) {
    downPara(state, air2, p, "terrain", events);
    return;
  }
  const h = state.heli;
  if (!h || !h.rider || h.mode === "wreck") return;
  const R = HELI.rotor.radius;
  const hub = h.y + HELI.rotor.hub;
  const flat = hypot(w.x - h.x, w.z - h.z);
  const D = K.downed;
  if (flat < R + D.disc && Math.abs(w.y - hub) < D.disc) downPara(state, air2, p, "ram", events);
  else if (flat < R * D.wash && w.y < hub && hub - w.y < D.under)
    downPara(state, air2, p, "wash", events);
}
