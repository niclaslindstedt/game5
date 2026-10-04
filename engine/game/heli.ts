// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER — a free ride's way up the mountain with no lift at all
// (`RunRules.heli`, `docs/helicopter.md`). It stands on its pad on the
// valley floor (`heli-pad.ts`); a skier who rides in beside its right skid
// is sat on the skid, and then the PLAYER FLIES IT, anywhere and as high as
// he likes — there is no ceiling, by design — until he pushes off the skid
// (the jump), when the skis are his again and the pilot flies the machine
// home to its pad. Flown into the snow, a crown or a slope too steep to set
// down on, it CRASHES: it burns where it came down, the skier on it is
// thrown, and a few seconds later the ride starts again from the pad.
//
// THE FLIGHT IS MOMENTUM THEORY UNDER AN ARCADE PILOT. The physics is a
// rigid airframe hung under a thrust along its own up axis:
//   * the THRUST the rotor can give is what the engine's power buys through
//     the induced flow (`thrustMost`): P = T·(v_c + v_i), the induced
//     velocity off Glauert's forward-flight relation v_i = v_h² / √(V² +
//     (v_c + v_i)²), v_h = √(T / 2ρA) — so it gives more in forward flight
//     (the translational lift) and less climbing — less the parasite power
//     ½ρfV³ at speed, and more again in GROUND EFFECT (Cheeseman & Bennett,
//     1 / (1 − (R / 4z)²));
//   * the AIR drags on the airframe's front, side and plan areas, against
//     the weather's wind where it flies (`windAt`, brought to its height by
//     the log law, `profileAt`), and turns its nose into a crosswind (the
//     fin's weathervane), so a gust moves it and the pilot holds it;
//   * THE SKIER on the right skid is weight off the centre line: a rolling
//     moment the stabilisation trims against with a hang of a few degrees
//     to that side, and an extra mass that leaves it the moment he jumps —
//     the helicopter lurches up and away from him;
//   * the ATTITUDE is flown by a stability augmentation — a damped spring
//     onto the attitude the controls ask (`HELI.pilot.attitude`) — and the
//     COLLECTIVE holds the vertical speed asked, within what the rotor
//     can give.
// The controls ask what an arcade pilot asks (`controlsOf`): the tuck noses
// it down and away, the back key noses it up to stop, the steer turns it
// (banked into a coordinated turn), and the lean climbs (forward) or sinks
// (back) — and the arcade's hand takes the side slip out, so it goes where
// it points.
//
// Pure over the level, the state and the clock: nothing here draws from the
// stream, and a run whose rules carry no helicopter never comes in here.

import {
  angleDiff,
  clamp,
  hypot,
  hypot3,
  smoothstep,
} from "@niclaslindstedt/oss-game-framework/core/math";
import {
  fromEuler,
  multiply,
  fromAxisAngle,
  rotate,
} from "@niclaslindstedt/oss-game-framework/core/quat";
import { treesNear } from "./collision.ts";
import { standSkier } from "./course.ts";
import { throwRider } from "./crash.ts";
import { HELI } from "./defs/heli.ts";
import { totalMass } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import { helipadOf } from "./heli-pad.ts";
import { mendBody } from "./body.ts";
import { derive } from "./skier.ts";
import { profileAt, windAt, type Wind } from "./wind.ts";
import type { GameEvent, GameState, HeliPhaseEvent, HeliState, SkierInput } from "./state.ts";

const K = HELI;
const P = HELI.pilot;
/** THE SEAT IN THE BODY FRAME. `HELI` states the machine as it is built
 * and drawn — x to its own right as a pilot sits in it, the side its tail
 * rotor is on and the skid opposite its ski basket. The engine's body x
 * runs the other way round on the screen (the renderer's frame mirrors the
 * map — `input-model.ts`'s `SCREEN_TO_ENGINE`), so a point off `HELI`
 * comes into the body frame with its x turned. */
const SEAT = { x: -K.seat.x, y: K.seat.y, z: K.seat.z };
/** The way out over the seat's skid, body frame (unit), and the turn from
 * the machine's heading to the way he faces sat there, rad. */
const OUT = { x: Math.sign(SEAT.x), y: 0, z: 0 };
const FACE = (Math.sign(SEAT.x) * Math.PI) / 2;
const AREA = Math.PI * K.rotor.radius ** 2;
/** The rotor's turn a second at full rpm, rad/s; the tail's. */
const OMEGA = (K.rotor.rpm / 60) * 2 * Math.PI;
const TAIL_OMEGA = (K.tail.rpm / 60) * 2 * Math.PI;
/** How far the seated skier's body origin stands over the skid's top, m:
 * up off it with his skis on the snow under a grounded helicopter, his
 * knees high, and down to his skis hanging under his knees in the air —
 * what the seated pose reads back (`seatHang`). */
export const HANG_GROUND = 0.92;
export const HANG_AIR = 0.55;

/** A helicopter parked on `level`'s pad, the rotor still. */
export function freshHeli(state: GameState): HeliState {
  const pad = helipadOf(state.level);
  return {
    mode: "parked",
    x: pad.x,
    y: pad.y,
    z: pad.z,
    vx: 0,
    vy: 0,
    vz: 0,
    heading: pad.heading,
    aim: pad.heading,
    pitch: 0,
    roll: 0,
    yawRate: 0,
    pitchRate: 0,
    rollRate: 0,
    spool: 0,
    rotor: 0,
    tailRotor: 0,
    thrust: 0,
    collective: 0,
    grounded: true,
    agl: K.rotor.hub,
    rider: false,
    t: 0,
    jumpWas: false,
    wreck: null,
    hang: HANG_GROUND,
  };
}

/** The helicopter's orientation, body to world. */
export function heliQuat(h: HeliState) {
  return fromEuler(h.heading, h.pitch, h.roll);
}

/** A point of the airframe, body frame (x right, y up, z forward, off the
 * skid datum), in the world. */
export function heliPoint(
  h: HeliState,
  p: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const w = rotate(heliQuat(h), p);
  return { x: h.x + w.x, y: h.y + w.y, z: h.z + w.z };
}

/** THE SEAT on the right skid, in the world, and the way he faces — out
 * over the skid — as an orientation. */
function seatFrame(h: HeliState) {
  const q = heliQuat(h);
  const top = heliPoint(h, SEAT);
  const up = rotate(q, { x: 0, y: 1, z: 0 });
  return {
    x: top.x + up.x * h.hang,
    y: top.y + up.y * h.hang,
    z: top.z + up.z * h.hang,
    q: multiply(q, fromAxisAngle(0, 1, 0, FACE)),
  };
}

const say = (run: GameState, events: GameEvent[], phase: HeliPhaseEvent, speed = 0): void => {
  const h = run.heli!;
  events.push({ kind: "heli", t: run.t, phase, x: h.x, y: h.y, z: h.z, speed });
};

/** ONE STEP OF THE HELICOPTER, before the skier is stepped: flown, flying
 * home, parked or burning — and the skier on it held on its skid, taken on
 * at the pad, or let go. True while the skier is sat on it — the step is
 * the helicopter's, and the snow, the trees and his clock wait. `events`
 * is the run's own list. */
export function stepHeli(run: GameState, input: SkierInput, events: GameEvent[]): boolean {
  const h = run.heli;
  if (!h) return false;
  const dt = TUNING.dt;
  h.t += dt;
  if (h.mode === "wreck") {
    if (h.t < K.crash.wreck) return false;
    if (h.wreck?.aboard) startAgain(run, events);
    else {
      // Dropped off before it went down: a fresh machine waits on the pad.
      Object.assign(h, freshHeli(run));
      say(run, events, "restart");
    }
    return h.rider;
  }
  if (h.rider && input.reset) {
    // A rider who wants out of the sky is set back on the pad.
    startAgain(run, events);
    return true;
  }
  if (!h.rider && h.mode === "parked") boardAt(run, events);
  // The rotor up to speed with a rider on, down without.
  const spoolTo = h.rider || h.mode === "home" ? 1 : 0;
  h.spool = clamp(h.spool + Math.sign(spoolTo - h.spool) * K.spool * dt, 0, 1);
  const ask = h.mode === "flown" ? controlsOf(h, input) : h.mode === "home" ? homeward(run) : PARK;
  fly(run, h, ask, events);
  h.rotor = (h.rotor + OMEGA * h.spool * dt) % (2 * Math.PI);
  h.tailRotor = (h.tailRotor + TAIL_OMEGA * h.spool * dt) % (2 * Math.PI);
  if (h.mode === "flown") strike(run, h, events);
  if (!h.rider) {
    h.jumpWas = !!input.jump;
    return false;
  }
  // THE DROP: the jump's press pushes him off the skid.
  const press = !!input.jump && !h.jumpWas;
  h.jumpWas = !!input.jump;
  if (press && h.mode === "flown") {
    drop(run, h, events);
    return false;
  }
  hold(run, h);
  return true;
}

/** What the controls ask of the airframe: the pitch and roll to hold, rad,
 * the yaw rate, rad/s, and the vertical speed, m/s. */
type Ask = { pitch: number; roll: number; yaw: number; climb: number };

const PARK: Ask = { pitch: 0, roll: 0, yaw: 0, climb: -2 };

/** THE ARCADE PILOT: the tuck noses down for speed, the back key (the
 * brake, or the edge cut harder) noses up to stop, the steer turns —
 * banked as a coordinated turn at the speed it is going, tan φ = Vω / g —
 * and the lean climbs (forward, negative) or sinks (back), the sink held
 * slow near the hover. On the snow the tuck or the steer alone lifts it
 * off into a low hover. */
function controlsOf(h: HeliState, input: SkierInput): Ask {
  const fwd = Math.sin(h.heading) * h.vx + Math.cos(h.heading) * h.vz;
  const flat = hypot(h.vx, h.vz);
  const back = Math.max(input.brake, input.carve ? 1 : 0);
  const pitch = back > 0.05 ? P.back * back : -P.pitch * input.tuck;
  const turnMost = P.turn + (P.turnFast - P.turn) * smoothstep(0, P.turnAt, flat);
  // With the steer let go the pilot's feet hold the heading it was left on
  // against the fin's weathervane in a crosswind.
  if (Math.abs(input.steer) > 0.05) h.aim = h.heading;
  const yaw =
    Math.abs(input.steer) > 0.05
      ? clamp(input.steer, -1, 1) * turnMost
      : clamp(angleDiff(h.heading, h.aim) * 2, -P.turnFast, P.turnFast);
  const roll = clamp(Math.atan((Math.max(0, fwd) * yaw) / TUNING.g), -P.bank, P.bank);
  const sinkMost = P.sinkSlow + (P.sink - P.sinkSlow) * smoothstep(5, 20, flat);
  let climb = input.lean < 0 ? -input.lean * P.climb : -input.lean * sinkMost;
  if (h.grounded && climb <= 0 && (input.tuck > 0.1 || Math.abs(input.steer) > 0.1)) climb = 2;
  return { pitch, roll, yaw, climb };
}

/** THE PILOT FLYING HOME: up to a safe height over the snow ahead, across
 * to the pad at a cruise, slowed on the approach and set down on it. */
function homeward(run: GameState): Ask {
  const h = run.heli!;
  // A beat to take the skier's weight off the controls, holding what it had.
  if (h.t < K.home.beat) return { pitch: 0, roll: 0, yaw: 0, climb: 0 };
  const pad = helipadOf(run.level);
  const dx = pad.x - h.x;
  const dz = pad.z - h.z;
  const d = hypot(dx, dz);
  const bearing = Math.atan2(dx, dz);
  const fwd = Math.sin(h.heading) * h.vx + Math.cos(h.heading) * h.vz;
  // The snow along the way, a few hundred metres out, and under it.
  let high = run.level.groundAt(h.x, h.z);
  const look = Math.min(d, 400);
  for (let s = 40; s <= look; s += 40) {
    high = Math.max(high, run.level.groundAt(h.x + (dx / d) * s, h.z + (dz / d) * s));
  }
  // Slowed in time to stop over the pad (`home.brake` m/s² of it), and
  // slowed too while it is still turned off its way.
  const off = angleDiff(h.heading, bearing);
  const want =
    Math.min(K.home.cruise, Math.sqrt(2 * K.home.brake * Math.max(0, d - 6))) *
    Math.max(0.15, Math.cos(Math.min(Math.PI / 2, Math.abs(off))));
  const flat = hypot(h.vx, h.vz);
  const final = d < 18 && flat < 6;
  const cruise = high + K.home.clear * smoothstep(20, K.home.approach, d) + 8;
  const climb = final
    ? -clamp((h.agl - K.rotor.hub) * 0.3, 1.2, P.sinkSlow)
    : clamp((cruise - h.y) * 0.4, -P.sinkSlow, P.climb);
  const turn = P.turn + (P.turnFast - P.turn) * smoothstep(0, P.turnAt, flat);
  const yaw = d > 6 ? clamp(off * 1.5, -turn, turn) : 0;
  const pitch = clamp((fwd - want) * 0.05, -P.pitch, P.back);
  return {
    pitch,
    roll: clamp(Math.atan((Math.max(0, fwd) * yaw) / TUNING.g), -0.4, 0.4),
    yaw,
    climb,
  };
}

/** WHAT THE ROTOR CAN GIVE, N, at full rpm: the thrust momentum theory
 * says the power buys going `along` m/s through the air and climbing `vc`
 * m/s (Glauert's induced velocity, the parasite power at speed taken off
 * first), in ground effect `over` m of hub height over the snow. */
export function thrustMost(along: number, vc: number, over: number): number {
  const rho = K.density;
  const avail = Math.max(K.power * 0.25, K.power - 0.5 * rho * K.flatPlate * along ** 3);
  let t = K.mass * TUNING.g * 1.3;
  for (let k = 0; k < 6; k++) {
    const vh2 = t / (2 * rho * AREA);
    // Below a descent of v_h the momentum stream reverses (the vortex ring):
    // the relation is held at its edge.
    const c = Math.max(vc, -Math.sqrt(vh2));
    let vi = Math.sqrt(vh2);
    for (let j = 0; j < 4; j++) vi = vh2 / Math.max(0.5, hypot(along, c + vi));
    const need = t * Math.max(0.5, c + vi);
    t *= (avail / need) ** (2 / 3);
  }
  const R = K.rotor.radius;
  const z = Math.max(over, (R / 4) * 1.05);
  const ground = Math.min(K.groundMost, 1 / (1 - (R / (4 * z)) ** 2));
  return t * ground;
}

const wind: Wind = { x: 0, z: 0, speed: 0, gust: 0 };

/** The mass flown: the machine and, while he is on its skid, the skier. */
function massOf(run: GameState): number {
  return K.mass + (run.heli!.rider ? totalMass(run.skier.spec) : 0);
}

/** ONE STEP OF FLIGHT: the attitude flown onto what is asked, the thrust
 * the collective holds the climb with, the air, the skids on the snow. */
function fly(run: GameState, h: HeliState, ask: Ask, events: GameEvent[]): void {
  const dt = TUNING.dt;
  const level = run.level;
  const m = massOf(run);
  const g = TUNING.g;
  const q = heliQuat(h);
  const up = rotate(q, { x: 0, y: 1, z: 0 });
  const right = rotate(q, { x: 1, y: 0, z: 0 });
  const fwd = rotate(q, { x: 0, y: 0, z: 1 });
  const hub = heliPoint(h, { x: 0, y: K.rotor.hub, z: K.rotor.at });
  const ground = level.groundAt(h.x, h.z);
  h.agl = hub.y - level.groundAt(hub.x, hub.z);
  // THE AIR it flies through: the weather's wind brought to its height.
  windAt(level, run.t, wind);
  const lift = profileAt(clamp(h.y - ground + K.cog, 1, 300));
  const ax = h.vx - wind.x * lift;
  const ay = h.vy;
  const az = h.vz - wind.z * lift;
  const af = ax * fwd.x + ay * fwd.y + az * fwd.z;
  const as = ax * right.x + ay * right.y + az * right.z;
  const au = ax * up.x + ay * up.y + az * up.z;
  const half = 0.5 * K.density;
  const df = -half * K.drag.front * Math.abs(af) * af;
  const ds = -half * K.drag.side * Math.abs(as) * as;
  const du = -half * K.drag.plan * Math.abs(au) * au;
  let fx = fwd.x * df + right.x * ds + up.x * du;
  let fy = fwd.y * df + right.y * ds + up.y * du;
  let fz = fwd.z * df + right.z * ds + up.z * du;
  // THE ARCADE'S HAND: the side slip over the snow taken out.
  const slip = h.vx * right.x + h.vz * right.z;
  fx -= m * P.coordinate * slip * right.x;
  fz -= m * P.coordinate * slip * right.z;
  // THE COLLECTIVE: the thrust that holds the climb asked, as far as the
  // rotor gives (`thrustMost`, at the rotor's speed squared).
  const along = hypot(ax, az);
  const most = thrustMost(along, Math.max(-20, ay), h.agl) * h.spool * h.spool;
  const wantAy = P.hold * (ask.climb - h.vy);
  let thrust = (m * (g + wantAy) - fy) / Math.max(0.4, up.y);
  if (h.grounded && ask.climb <= 0) thrust = Math.min(thrust, m * g * 0.5);
  // The collective and the rotor answer in a fraction of a second, not at
  // once: so a skier pushing off the skid leaves a machine lifting for his
  // weight too, and it lurches up off him before the pilot takes it out.
  thrust = clamp(h.thrust + (thrust - h.thrust) * (1 - Math.exp(-dt / P.lag)), 0, most);
  h.thrust = thrust;
  h.collective = most > 0 ? thrust / most : 0;
  fx += up.x * thrust;
  fy += up.y * thrust - m * g;
  fz += up.z * thrust;
  h.vx += (fx / m) * dt;
  h.vy += (fy / m) * dt;
  h.vz += (fz / m) * dt;
  // THE ATTITUDE: a damped spring onto what is asked, with the rider's
  // weight off the centre line rolling it to his side and the fin turning
  // the nose into the relative wind.
  const w2 = P.attitude * P.attitude;
  const damp = 2 * P.damping * P.attitude;
  const riderRoll = h.rider ? (totalMass(run.skier.spec) * g * SEAT.x) / K.inertia.roll : 0;
  let pitchTo = ask.pitch;
  let rollTo = ask.roll;
  if (h.grounded) {
    // On the snow it stands as the snow lies.
    const lie = lieOf(run, h);
    pitchTo = Math.max(lie.pitch, Math.min(lie.pitch + 0.03, pitchTo));
    rollTo = lie.roll;
  }
  h.pitchRate += (w2 * (pitchTo - h.pitch) - damp * h.pitchRate) * dt;
  h.rollRate += (w2 * (rollTo - h.roll) - damp * h.rollRate + riderRoll) * dt;
  const vane = K.vane * as * Math.min(40, Math.abs(af) + Math.abs(as));
  h.yawRate += (3 * (ask.yaw - h.yawRate) + vane) * dt;
  h.pitch += h.pitchRate * dt;
  h.roll += h.rollRate * dt;
  h.heading += h.yawRate * dt;
  if (h.heading > Math.PI) h.heading -= 2 * Math.PI;
  if (h.heading <= -Math.PI) h.heading += 2 * Math.PI;
  h.x += h.vx * dt;
  h.y += h.vy * dt;
  h.z += h.vz * dt;
  // THE SKIDS ON THE SNOW.
  const under = level.groundAt(h.x, h.z);
  const was = h.grounded;
  if (h.y <= under) {
    const sink = -h.vy;
    const slide = hypot(h.vx, h.vz);
    h.y = under;
    if (!was && h.mode === "flown" && landedHard(run, h, sink, slide)) {
      crash(run, h, events, Math.max(sink, slide));
      return;
    }
    h.vy = Math.max(0, h.vy);
    // Skids on snow under a machine sat on them: held where they stand.
    const hold = Math.exp(-6 * dt);
    h.vx *= hold;
    h.vz *= hold;
    h.grounded = true;
    if (!was) {
      h.yawRate *= 0.2;
      say(run, events, "land", sink);
      if (h.mode === "home") park(run, h, events);
    }
  } else if (h.y > under + 0.05) {
    h.grounded = false;
    if (was) say(run, events, "liftoff");
  }
  // Seated on the skid, his skis come down to hang as it lifts.
  const to = h.grounded ? HANG_GROUND : HANG_AIR;
  h.hang += clamp(to - h.hang, -dt * 0.6, dt * 0.6);
}

/** How the snow lies under the skids: the pitch and roll it stands at. */
function lieOf(run: GameState, h: HeliState): { pitch: number; roll: number; slope: number } {
  const level = run.level;
  const fx = Math.sin(h.heading);
  const fz = Math.cos(h.heading);
  const L = (K.skid.front - K.skid.back) / 2;
  const W = K.skid.track / 2;
  const pitch = Math.atan2(
    level.groundAt(h.x + fx * L, h.z + fz * L) - level.groundAt(h.x - fx * L, h.z - fz * L),
    2 * L,
  );
  const roll = Math.atan2(
    level.groundAt(h.x - fz * W, h.z + fx * W) - level.groundAt(h.x + fz * W, h.z - fx * W),
    2 * W,
  );
  return { pitch, roll, slope: Math.max(Math.abs(pitch), Math.abs(roll)) };
}

/** A touchdown the skids do not ride: too fast down or along, the airframe
 * stood too far off the snow's lean, or snow too steep to sit on. */
function landedHard(run: GameState, h: HeliState, sink: number, slide: number): boolean {
  const lie = lieOf(run, h);
  const off = Math.max(Math.abs(h.pitch - lie.pitch), Math.abs(h.roll - lie.roll));
  return (
    sink > K.crash.sink || slide > K.crash.slide || off > K.crash.tilt || lie.slope > K.crash.slope
  );
}

const trunks: number[] = [];

/** THE ROTOR AND THE AIRFRAME AGAINST THE MOUNTAIN: the disc's rim and the
 * fuselage's extremes against the snow, and the disc against every crown
 * it sweeps. */
function strike(run: GameState, h: HeliState, events: GameEvent[]): void {
  const level = run.level;
  const q = heliQuat(h);
  const R = K.rotor.radius;
  const hub = heliPoint(h, { x: 0, y: K.rotor.hub, z: K.rotor.at });
  const speed = hypot3(h.vx, h.vy, h.vz);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tip = rotate(q, { x: Math.sin(a) * R, y: 0, z: Math.cos(a) * R });
    const x = hub.x + tip.x;
    const z = hub.z + tip.z;
    if (hub.y + tip.y < level.groundAt(x, z) + K.crash.clear) {
      crash(run, h, events, speed);
      return;
    }
  }
  for (const p of K.body.strike) {
    const w = heliPoint(h, p);
    if (w.y < level.groundAt(w.x, w.z) - 0.05) {
      crash(run, h, events, speed);
      return;
    }
  }
  for (const i of treesNear(level, hub.x, hub.z, R + 6, trunks)) {
    const t = level.trees[i];
    const d = hypot(t.x - hub.x, t.z - hub.z);
    // The crown's spread at the disc's height: widest low, a point at the
    // top — a conifer's cone.
    const top = t.y + t.height;
    if (hub.y > top) continue;
    const spread = t.crown * Math.min(1, (top - hub.y) / Math.max(1, t.height * 0.8));
    if (d < R + spread * 0.7 || (d < t.radius + 1.2 && h.y < top)) {
      crash(run, h, events, speed);
      return;
    }
  }
}

/** THE CRASH: the machine burns where it came down, and the skier on its
 * skid is thrown — flung by the blast. */
function crash(run: GameState, h: HeliState, events: GameEvent[], speed: number): void {
  h.mode = "wreck";
  h.t = 0;
  h.wreck = { x: h.x, y: h.y, z: h.z, speed, aboard: h.rider };
  say(run, events, "crash", speed);
  if (h.rider) {
    const out = rotate(heliQuat(h), OUT);
    release(run, h, 7, 6);
    const c = run.skier;
    throwRider(run, "heli", { x: c.vx + out.x, y: c.vy, z: c.vz + out.z }, events);
  }
  h.vx = h.vy = h.vz = 0;
  h.yawRate = h.pitchRate = h.rollRate = 0;
  h.spool = 0;
  h.thrust = 0;
  h.collective = 0;
}

/** Set down home on the pad: the pilot shuts down. */
function park(run: GameState, h: HeliState, events: GameEvent[]): void {
  h.mode = "parked";
  h.t = 0;
  h.vx = h.vz = 0;
  say(run, events, "home");
}

/** THE SKIER SAT ON THE SKID: where the seat has him, facing out over it,
 * moving with it — and off the snow, which is not under his skis. */
function hold(run: GameState, h: HeliState): void {
  const c = run.skier;
  const s = seatFrame(h);
  const dt = TUNING.dt;
  c.vx = h.t <= dt ? h.vx : (s.x - c.x) / dt;
  c.vy = h.t <= dt ? h.vy : (s.y - c.y) / dt;
  c.vz = h.t <= dt ? h.vz : (s.z - c.z) / dt;
  c.x = s.x;
  c.y = s.y;
  c.z = s.z;
  c.q = s.q;
  c.wx = c.wy = c.wz = 0;
  c.airborne = false;
  c.airTime = 0;
  for (const contact of c.contacts) {
    contact.touching = false;
    contact.load = 0;
  }
  derive(c, run.level);
  c.incline = 0;
  c.overFor = 0;
  c.stuckFor = 0;
}

/** Off the skid at the seat, with the helicopter's way and a push `out`
 * over the skid and `up`, m/s, and turned to face the way it was flying
 * (or out over the skid, at the hover). */
function release(run: GameState, h: HeliState, out: number, up: number): void {
  const c = run.skier;
  const s = seatFrame(h);
  const q = heliQuat(h);
  const side = rotate(q, OUT);
  const flat = hypot(h.vx, h.vz);
  const heading = flat > 4 ? Math.atan2(h.vx, h.vz) : h.heading + FACE;
  standSkier(run, s.x, s.z, heading);
  c.x = s.x;
  c.y = s.y;
  c.z = s.z;
  c.q = fromEuler(heading, 0, 0);
  c.vx = h.vx + side.x * out;
  c.vy = h.vy + up;
  c.vz = h.vz + side.z * out;
  c.airborne = true;
  derive(c, run.level);
  h.rider = false;
}

/** THE DROP: pushed off the skid; the machine, a skier lighter on its right
 * side, is flown home by its pilot. */
function drop(run: GameState, h: HeliState, events: GameEvent[]): void {
  release(run, h, K.drop.out, K.drop.up);
  // Grounded, he steps off onto the snow rather than into the air.
  if (h.grounded) {
    const c = run.skier;
    standSkier(run, c.x, c.z, Math.atan2(c.vx, c.vz) || h.heading);
  }
  say(run, events, "drop", hypot3(h.vx, h.vy, h.vz));
  h.mode = "home";
  h.t = 0;
}

/** Into the boarding reach of the parked helicopter's seat, slow enough:
 * sat on the skid, the rotor spooling up, and the controls the player's. */
function boardAt(run: GameState, events: GameEvent[]): void {
  const h = run.heli!;
  const c = run.skier;
  if (c.thrown || c.lift || c.tunnel) return;
  const seat = heliPoint(h, SEAT);
  if (hypot(c.x - seat.x, c.z - seat.z) > K.board.reach || c.speed > K.board.fastest) return;
  h.rider = true;
  h.mode = "flown";
  h.t = 0;
  h.hang = HANG_GROUND;
  say(run, events, "board");
}

/** THE RIDE STARTED AGAIN FROM THE BOTTOM: a machine on the pad, the rotor
 * at speed, the skier sat on its skid and mended. */
export function startAgain(run: GameState, events: GameEvent[]): void {
  const h = run.heli!;
  Object.assign(h, freshHeli(run));
  h.mode = "flown";
  h.rider = true;
  h.spool = 1;
  const c = run.skier;
  const s = seatFrame(h);
  standSkier(run, s.x, s.z, h.heading + FACE);
  c.lift = null;
  c.tunnel = null;
  mendBody(c.body);
  hold(run, h);
  say(run, events, "restart");
}

/** THE BOT'S HANDS ON THE HELICOPTER: up off the pad to a safe height over
 * the snow, then on up the mountain (−z, the face) at a steady clip,
 * climbing with it — what a card's run behind it and a link's pre-roll
 * fly. Never the jump: that is the player's. */
export function pilotInput(run: GameState): SkierInput {
  const h = run.heli!;
  const over = h.y - run.level.groundAt(h.x, h.z);
  const ahead = run.level.groundAt(h.x, h.z - 120) - run.level.groundAt(h.x, h.z);
  const want = 45 + Math.max(0, ahead);
  return {
    steer: clamp(angleDiff(h.heading, Math.PI) * 1.5, -1, 1),
    tuck: over > 25 ? 0.6 : 0,
    brake: 0,
    lean: clamp((over - want) * 0.08, -1, 1),
    reset: false,
  };
}

/** THE SEATED SKIER'S HANG: how far his body origin stands over the skid's
 * top, m (`HeliState.hang`) — what the pose sits him at. */
export function seatHang(h: HeliState): number {
  return h.hang;
}
