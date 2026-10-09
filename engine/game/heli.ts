// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER — a free ride's way up the mountain with no lift at all
// (`RunRules.heli`, `docs/helicopter.md`). It stands on its pad on the
// valley floor (`heli-pad.ts`); a skier stood beside its skid who gives THE
// MACHINE PRESS (`SkierInput.machine`: ENTER, a double tap on touch) is sat
// on the skid, and then the PLAYER FLIES IT — by hand, every control his
// and nothing between him and the rotor — anywhere and as high as he likes
// (there is no ceiling, by design). He lands it where the snow lets him and
// steps off, or pushes off the skid where it cannot land — the same press; the
// skis are his again, and the machine is flown home by its pilot. Flown
// into the snow, a crown or a slope too steep to set down on, it CRASHES:
// it burns where it came down, the skier on it is thrown, and a few
// seconds later the ride starts again from the pad.
//
// THE FLIGHT (the numbers in `HELI.flight`):
//   * THE COLLECTIVE is the thrust's share of what the rotor can give
//     (`thrustMost`: momentum theory — the power through the induced flow,
//     the translational lift, the parasite power, ground effect), answered
//     in a fraction of a second. A lever: it stays where it is left.
//   * THE CYCLIC tilts THE ROTOR DISC, and the thrust goes where the disc
//     points. It sets a rate against the rotor's damping; let go, the disc
//     stays where it was left — never levelling itself — and the air
//     through it blows it back (the flapback), nose up as the speed comes.
//   * THE FUSELAGE hangs under the hub as a damped pendulum, swinging under
//     the disc as it is thrown about, and off the centre line by the weight
//     of the skier on the skid; when he jumps it swings back, and the
//     collective — still lifting him — lurches it up.
//   * THE PEDALS turn it against the tail rotor's and the fin's damping; the
//     main rotor's TORQUE swings the nose left as the collective comes up;
//     the fin turns the nose into a crosswind.
//   * THE AIR drags on the airframe's front, side and plan areas against the
//     weather's wind where it flies — nothing takes the side slip out.
// What a skier's input means sat on the skid is the app's
// (`SkierInput.heli`); the bot's hands on the same four controls are
// `heli-pilot.ts`'s.
//
// Pure over the level, the state and the clock: nothing here draws from the
// stream, and a run whose rules carry no helicopter never comes in here.

import { angleDiff, clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  fromAxisAngle,
  fromEuler,
  multiply,
  rotate,
  unrotate,
} from "@niclaslindstedt/oss-game-framework/core/quat";
import { treesNear } from "./collision.ts";
import { standSkier } from "./course.ts";
import { mayGetUp, throwRider } from "./crash.ts";
import { HELI } from "./defs/heli.ts";
import { totalMass } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import { helipadOf } from "./heli-pad.ts";
import { carryFall, fallsIntoRotor, hangFrame, stepGrip } from "./heli-grip.ts";
import { HELI_BLADES } from "./defs/heli-grip.ts";
import { pilotControls } from "./heli-pilot.ts";
import { SEAT, discQuat, heliMass, heliPoint, heliQuat, thrustMost } from "./heli-rotor.ts";
import { mendBody } from "./body.ts";
import { derive } from "./skier.ts";
import { profileAt, windAt, type Wind } from "./wind.ts";
import type {
  GameEvent,
  GameState,
  HeliControls,
  HeliPhaseEvent,
  HeliState,
  SkierInput,
} from "./state.ts";

export { heliPoint, heliQuat, thrustMost } from "./heli-rotor.ts";
export { pilotInput, type HeliAim } from "./heli-pilot.ts";

const K = HELI;
const F = HELI.flight;
/** The way out over the seat's skid, body frame (unit), and the turn from
 * the machine's heading to the way he faces sat there, rad. */
const OUT = { x: Math.sign(SEAT.x), y: 0, z: 0 };
const FACE = (Math.sign(SEAT.x) * Math.PI) / 2;
/** The rotor's turn a second at full rpm, rad/s; the tail's. */
const OMEGA = (K.rotor.rpm / 60) * 2 * Math.PI;
const TAIL_OMEGA = (K.tail.rpm / 60) * 2 * Math.PI;
/** How far the seated skier's body origin stands over the skid's top, m:
 * up off it with his skis on the snow under a grounded helicopter, his
 * knees high, and down to his skis hanging under his knees in the air —
 * what the seated pose reads back (`seatHang`). */
export const HANG_GROUND = 0.92;
export const HANG_AIR = 0.55;
/** The controls let go: the collective down, the rest centred. */
const DOWN: HeliControls = { collective: 0, pitch: 0, roll: 0, pedal: 0 };

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
    pitch: 0,
    roll: 0,
    disc: { pitch: 0, roll: 0, pitchRate: 0, rollRate: 0 },
    controls: { ...DOWN },
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
    wreck: null,
    hang: HANG_GROUND,
    grip: 1,
    load: 0,
    hung: 0,
    sway: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
    shed: -1,
    cut: 0,
    cutSpeed: 0,
    bladed: -1,
    taken: 0,
  };
}

/** THE SEAT on the skid, in the world, and the way he faces — out over the
 * skid — as an orientation. */
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
    // The player's own press to get up, once it is his (`mayGetUp`), starts
    // the ride again rather than standing him by the fire.
    const up = !!h.wreck?.aboard && input.reset && !!run.skier.thrown && mayGetUp(run.skier.thrown);
    if (h.t < K.crash.wreck && !up) return false;
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
  // Sat on the skid: the press that did it is spent, never read again as
  // the drop on the same step.
  const boarded = !!input.machine && heliWithin(run);
  if (boarded) board(run, events);
  // The rotor up to speed with a rider on, down without.
  const spoolTo = h.rider || h.mode === "home" ? 1 : 0;
  h.spool = clamp(h.spool + Math.sign(spoolTo - h.spool) * K.spool * dt, 0, 1);
  h.controls = controlsFor(run, h, input);
  const vx0 = h.vx;
  const vy0 = h.vy;
  const vz0 = h.vz;
  fly(run, h, h.controls, events);
  // LET GO OVER ITS ROTOR, his fall is taken in the machine's own frame
  // (`heli-grip.ts`): the airframe's acceleration given to him too.
  if (h.shed >= 0) {
    const b = run.skier.thrown;
    h.shed += dt;
    if (!b || h.shed > HELI_BLADES.carry || h.wreck) h.shed = -1;
    else carryFall(b, (h.vx - vx0) / dt, (h.vy - vy0) / dt, (h.vz - vz0) / dt);
  }
  h.rotor = (h.rotor + OMEGA * h.spool * dt) % (2 * Math.PI);
  h.tailRotor = (h.tailRotor + TAIL_OMEGA * h.spool * dt) % (2 * Math.PI);
  if (h.mode === "flown" || h.mode === "home") strike(run, h, events);
  if (!h.rider) return false;
  // THE DROP: the machine press pushes him off the skid — or, landed, he
  // steps off it onto the snow.
  if (input.machine && !boarded && h.mode === "flown") {
    drop(run, h, events);
    return false;
  }
  // THE GRIP: turned too far over for his hands, he hangs from them —
  // and lets go.
  const aloft = h.mode === "flown" && !h.grounded;
  const gone = aloft && stepGrip(h, seatFrame(h).q);
  if (!aloft) h.load = h.hung = 0;
  hold(run, h);
  if (gone) {
    slip(run, h, events);
    return false;
  }
  return true;
}

/** THE CONTROLS THIS STEP: the player's, flying it; the pilot's flying it
 * home — after a beat with the controls where the skier left them, which is
 * the lurch as his weight leaves the skid; and on the pad, let go. */
function controlsFor(run: GameState, h: HeliState, input: SkierInput): HeliControls {
  if (h.mode === "flown") {
    const c = input.heli ?? DOWN;
    return {
      collective: clamp(c.collective, 0, 1),
      pitch: clamp(c.pitch, -1, 1),
      roll: clamp(c.roll, -1, 1),
      pedal: clamp(c.pedal, -1, 1),
    };
  }
  if (h.mode === "home") {
    if (h.t < K.home.beat) return h.controls;
    const pad = helipadOf(run.level);
    return pilotControls(run, {
      x: pad.x,
      z: pad.z,
      height: K.home.clear,
      land: true,
      face: pad.heading,
    });
  }
  return { ...DOWN };
}

const wind: Wind = { x: 0, z: 0, speed: 0, gust: 0 };

/** ONE STEP OF FLIGHT on `c`: the thrust off the collective along the disc,
 * the air, the disc tilted by the cyclic, the fuselage swung under it, the
 * pedals and the torque, and the skids on the snow. */
function fly(run: GameState, h: HeliState, c: HeliControls, events: GameEvent[]): void {
  const dt = TUNING.dt;
  const level = run.level;
  const m = heliMass(run);
  const g = TUNING.g;
  const q = heliQuat(h);
  const right = rotate(q, { x: 1, y: 0, z: 0 });
  const fwd = rotate(q, { x: 0, y: 0, z: 1 });
  const up = rotate(q, { x: 0, y: 1, z: 0 });
  const thrustUp = rotate(discQuat(h), { x: 0, y: 1, z: 0 });
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
  // THE COLLECTIVE: its share of what the rotor gives (at the rotor's speed
  // squared), answered in `flight.lag` — so a skier pushing off the skid
  // leaves a machine lifting for his weight too.
  const along = hypot(ax, az);
  const most = thrustMost(along, Math.max(-20, ay), h.agl) * h.spool * h.spool;
  const want = c.collective * most;
  const thrust = clamp(h.thrust + (want - h.thrust) * (1 - Math.exp(-dt / F.lag)), 0, most);
  h.thrust = thrust;
  h.collective = most > 0 ? thrust / most : 0;
  fx += thrustUp.x * thrust;
  fy += thrustUp.y * thrust - m * g;
  fz += thrustUp.z * thrust;
  h.vx += (fx / m) * dt;
  h.vy += (fy / m) * dt;
  h.vz += (fz / m) * dt;
  // ON THE SNOW, a machine sat on its skids stands as the snow lies, its
  // disc with it; light on them it turns on its pedals.
  const light = h.grounded && thrust > 0.6 * m * g;
  const sat = h.grounded && thrust < 0.5 * m * g;
  const lie = h.grounded ? lieOf(run, h) : null;
  // THE DISC, flown by the cyclic against its damping and its flapback.
  const d = h.disc;
  const spool2 = h.spool * h.spool;
  if (sat && lie) {
    d.pitch = lie.pitch;
    d.roll = lie.roll;
    d.pitchRate = d.rollRate = 0;
  } else {
    d.pitchRate +=
      (-F.cyclic.pitch * spool2 * c.pitch - F.damping.pitch * d.pitchRate + F.flapback * af) * dt;
    d.rollRate +=
      (F.cyclic.roll * spool2 * c.roll - F.damping.roll * d.rollRate - F.flapback * as) * dt;
    // NO STOP on the disc: held over it carries on past the vertical and
    // round — a roll, a loop — the angles kept to a turn either way.
    d.pitch = wrap(d.pitch + d.pitchRate * dt);
    d.roll = wrap(d.roll + d.rollRate * dt);
  }
  // THE FUSELAGE swung under the disc, hanging off the centre line by the
  // skier's weight on the skid (his share of the mass, over the hub's
  // height over the centre of gravity).
  const w = F.hang.frequency;
  const z2 = 2 * F.hang.damping * w;
  const hang = h.rider
    ? Math.atan2((totalMass(run.skier.spec) / m) * SEAT.x, K.rotor.hub - K.cog)
    : 0;
  if (lie && !light) {
    h.pitch = lie.pitch;
    h.roll = lie.roll;
    h.pitchRate = h.rollRate = 0;
  } else {
    // Swung the short way round to the disc, so it follows it over the top.
    h.pitchRate += (w * w * angleDiff(h.pitch, d.pitch) - z2 * h.pitchRate) * dt;
    h.rollRate += (w * w * angleDiff(h.roll, d.roll + hang) - z2 * h.rollRate) * dt;
    h.pitch = wrap(h.pitch + h.pitchRate * dt);
    h.roll = wrap(h.roll + h.rollRate * dt);
  }
  // THE PEDALS, the torque, the fin.
  if (h.grounded && !light) h.yawRate = 0;
  else {
    const torque = F.torque * (thrust / (m * g) - 1);
    const vane = K.vane * as * Math.min(40, Math.abs(af) + Math.abs(as));
    h.yawRate += (F.pedal * spool2 * c.pedal - F.yawDamping * h.yawRate - torque + vane) * dt;
  }
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
    if (!was && (h.mode === "flown" || h.mode === "home") && landedHard(run, h, sink, slide)) {
      crash(run, h, events, Math.max(sink, slide));
      return;
    }
    h.vy = Math.max(0, h.vy);
    // Skids on snow under a machine sat on them: held where they stand.
    const held = Math.exp(-6 * dt);
    h.vx *= held;
    h.vz *= held;
    h.grounded = true;
    if (!was) {
      h.yawRate *= 0.2;
      say(run, events, "land", sink);
      const pad = helipadOf(level);
      if (h.mode === "home" && hypot(h.x - pad.x, h.z - pad.z) < 15) park(run, h, events);
    }
  } else if (h.y > under + 0.05) {
    h.grounded = false;
    if (was) say(run, events, "liftoff");
  }
  // Seated on the skid, his skis come down to hang as it lifts.
  const to = h.grounded ? HANG_GROUND : HANG_AIR;
  h.hang += clamp(to - h.hang, -dt * 0.6, dt * 0.6);
}

/** An angle kept to (−π, π]. */
function wrap(a: number): number {
  return angleDiff(0, a);
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
  const off = Math.max(
    Math.abs(angleDiff(lie.pitch, h.pitch)),
    Math.abs(angleDiff(lie.roll, h.roll)),
  );
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
 * skid is thrown — flung off it by the blast (`crash.blast`). */
function crash(run: GameState, h: HeliState, events: GameEvent[], speed: number): void {
  h.mode = "wreck";
  h.t = 0;
  // How fast it was coming down when the snow stopped it: struck on a
  // crown or the rotor's tips, it falls the rest of the way first.
  const ground = run.level.groundAt(h.x, h.z);
  const fall = Math.max(0, h.y - ground);
  const down = Math.max(0, -h.vy);
  const sink = Math.sqrt(down * down + 2 * TUNING.g * fall);
  // That stop in the airframe's own frame: level, all of it up the skids;
  // rolled onto a side, across them; nose or tail first, along them.
  const stop = unrotate(heliQuat(h), { x: 0, y: -sink, z: 0 });
  h.wreck = {
    x: h.x,
    y: h.y,
    z: h.z,
    speed,
    sink,
    seat: Math.max(0, -stop.y),
    out: stop.x * OUT.x,
    // Facing out over his skid, his right is up × out: the nose or the
    // tail, by which skid the seat is on.
    across: -stop.z * OUT.x,
    aboard: h.rider,
  };
  say(run, events, "crash", speed);
  if (h.rider) {
    // The snow stops the machine's fall, and his with it: he leaves with
    // its way along the snow and the blast's push out and up.
    const climb = Math.max(0, h.vy);
    release(run, h, K.crash.blast.out, K.crash.blast.up);
    const c = run.skier;
    c.vy = climb + K.crash.blast.up;
    throwRider(run, "heli", { x: c.vx, y: c.vy, z: c.vz }, events);
  }
  h.vx = h.vy = h.vz = 0;
  h.yawRate = h.pitchRate = h.rollRate = 0;
  h.disc.pitchRate = h.disc.rollRate = 0;
  // Down onto the snow, whatever it struck on the way — a crown leaves no
  // machine hanging in it.
  h.y = ground;
  h.grounded = true;
  h.spool = 0;
  h.thrust = 0;
  h.collective = 0;
  h.controls = { ...DOWN };
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
  const s = hangFrame(h, seatFrame(h));
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

/** THE GRIP GONE: he is off the skid with the seat's own way, tumbling —
 * over its rotor if the machine is turned over him (`fallsIntoRotor`) —
 * and the machine, lighter on its right side, flown home by its pilot. */
function slip(run: GameState, h: HeliState, events: GameEvent[]): void {
  const c = run.skier;
  const v = { x: c.vx, y: c.vy, z: c.vz };
  h.rider = false;
  h.mode = "home";
  h.t = 0;
  h.grip = 0;
  const b = throwRider(run, "grip", v, events);
  // The throw keeps a share of a skier's way along the snow; off a skid in
  // the air he keeps all of it.
  const dt = TUNING.dt;
  const dx = (v.x - b.vx) * dt;
  const dy = (v.y - b.vy) * dt;
  const dz = (v.z - b.vz) * dt;
  for (let i = 0; i < b.last.length; i += 3) {
    b.last[i] -= dx;
    b.last[i + 1] -= dy;
    b.last[i + 2] -= dz;
  }
  b.vx = v.x;
  b.vy = v.y;
  b.vz = v.z;
  const datum = heliPoint(h, { x: 0, y: 0, z: 0 });
  const middle = unrotate(heliQuat(h), { x: c.x - datum.x, y: c.y - datum.y, z: c.z - datum.z });
  h.shed = fallsIntoRotor(h, middle) ? 0 : -1;
  say(run, events, "slip", hypot3(v.x, v.y, v.z));
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
  // Landed, the pilot shuts down where it stands — there is nobody left to
  // fly; in the air he takes the controls and flies it home.
  h.mode = h.grounded ? "parked" : "home";
  h.t = 0;
}

/** WHETHER THE MACHINE PRESS SITS HIM ON THE SKID: a skier on his skis,
 * off any lift, tunnel or snowmobile, within `HELI.board.reach` of the
 * parked helicopter's seat and slower than `HELI.board.fastest`. What the
 * HUD offers the press on (`snapshot.ts`) is this same question. */
export function heliWithin(run: GameState): boolean {
  const h = run.heli;
  const c = run.skier;
  if (!h || h.rider || h.mode !== "parked") return false;
  if (c.thrown || c.lift || c.tunnel || run.sled?.rider) return false;
  // Under a paramotor's wing the press releases the rig (`para.ts`).
  if (run.para && run.para.mode !== "dropped") return false;
  const seat = heliPoint(h, SEAT);
  return hypot(c.x - seat.x, c.z - seat.z) <= K.board.reach && c.speed <= K.board.fastest;
}

/** Sat on the skid: the rotor spooling up, and the controls the player's. */
function board(run: GameState, events: GameEvent[]): void {
  const h = run.heli!;
  h.rider = true;
  h.mode = "flown";
  h.t = 0;
  h.hang = HANG_GROUND;
  h.grip = 1;
  h.hung = 0;
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

/** WHETHER THE SKIER IS LYING WHERE A CRASHED HELICOPTER THREW HIM: the
 * wreck he rode down still burning — he is not stood back up until the
 * ride starts again from the pad. */
export function heliDown(run: GameState): boolean {
  const h = run.heli;
  return !!h && h.mode === "wreck" && !!h.wreck?.aboard;
}

/** THE SEATED SKIER'S HANG: how far his body origin stands over the skid's
 * top, m (`HeliState.hang`) — what the pose sits him at. */
export function seatHang(h: HeliState): number {
  return h.hang;
}
