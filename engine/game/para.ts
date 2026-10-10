// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARAMOTOR — a free ride begun on the SUMMIT under a powered speed wing
// (`CreateGameOptions.para`, `docs/paramotor.md`). The skier stands at the
// top of the mountain, his skis on, a paramotor on his back and the wing
// inflated over him; he skis off down the fall line and the wing lifts him
// off the snow — the speed rider's launch — and then the PLAYER FLIES IT:
// the throttle climbs him, the brakes slow and flare him, the toggles and
// his weight turn him, the risers speed him up. He may put his skis back on
// the snow under the flying wing and ski with it (speed riding), and THE
// RELEASE PRESS (`SkierInput.machine`: ENTER, a double tap on touch) drops
// the whole rig — the canopy streams away and the motor falls — and he is a
// skier again, landing on his skis wherever he let go. Let go high, it is
// a long way down.
//
// THE FLIGHT is two bodies on an inextensible line, solved after the skier's
// own step (`stepSkier` keeps the snow, his drag and the landing):
//   * THE WING, a point mass with the air in its cells, flies by a polar —
//     its angle of attack read off the air through it against the plane
//     square to its lines plus the trim, so its pitch is the pendulum's own
//     and nothing sets it: a surge, a dive after a stall, the swing under a
//     hard turn all fall out of it. Past the stall angle its lift falls
//     away; pulled under the plane (a dive), it unloads.
//   * THE TURN is a side force on the canopy toward the toggle pulled (the
//     braked tip dragging it round) and the pilot's weight shifted: it
//     swings the wing out over him, the lines bank, the lift is tilted into
//     the turn and the path comes round — a spiral if it is held.
//   * THE ENGINE pushes the pilot along his way (on the snow) or along the
//     wing's (in the air), its thrust falling with the air through the
//     propeller to nothing at its pitch speed; the wing swings back behind
//     him under power and the rig climbs.
//   * THE LINES only pull: their tension is the constraint's impulse, so a
//     wing that falls toward him leaves them slack.
//   * THE SWING is damped against the air as it swings about him.
// Brought down onto the snow or into a crown the wing COLLAPSES and the rig
// is cut away; a pilot thrown off his skis cuts it away too.
//
// Pure over the level, the state and the clock: nothing here draws from the
// stream, and a run with no paramotor never comes in here.

import { angleDiff, clamp, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { airBoundsAt, type AirBounds } from "./collision.ts";
import { rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { standSkier } from "./course.ts";
import { PARA, pilotMass } from "./defs/para.ts";
import { totalMass } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import { mendBody } from "./body.ts";
import { freeRuns } from "./lift-ride.ts";
import { derive } from "./skier.ts";
import {
  crownAt,
  fallPiece,
  hangUnder,
  lineDir,
  liftDrag,
  pullLines,
  swingDamp,
  wayOf,
} from "./canopy.ts";
import { eddyUp, paraAirAt, type ParaAir } from "./para-air.ts";
import type { Level } from "../mapgen/types.ts";
import type {
  GameEvent,
  GameState,
  ParaControls,
  ParaPhaseEvent,
  ParaPiece,
  ParaState,
  SkierInput,
} from "./state.ts";

const dt = TUNING.dt;
const W = PARA.wing;
const P = PARA.polar;
/** A flight counted as one (reported, the pilot hung in the harness) after
 * this long off the snow, s. */
const FLIGHT = 0.6;
/** How fast the toggles and the throttle follow the hands, s. */
const HANDS = 0.12;
const IDLE: ParaControls = { throttle: 0, brake: 0, steer: 0, bar: 0 };
const U = { x: 0, y: 1, z: 0 };
const FW = { x: 0, y: 0, z: 1 };
const AF = { x: 0, y: 0, z: 0 };
const air: ParaAir = { x: 0, y: 0, z: 0, mean: 0, lift: 0, rough: 0, lee: 0 };
const F = PARA.fold;

/** WHERE THE RIDE BEGINS: the highest head of the ski area's runs — the top
 * of the mountain a skier can ski off — or, off a resort, the piste's own
 * start; facing down it. */
export function paraStartOf(level: Level): { x: number; z: number; heading: number } {
  let best = level.track.points[0];
  for (const r of freeRuns(level)) {
    const top = r.points[0];
    if (top && top.y > best.y) best = top;
  }
  return { x: best.x, z: best.z, heading: best.heading };
}

/** The controls the skier's own input asks of the rig. */
export function paraControls(input: SkierInput): ParaControls {
  return {
    throttle: clamp(input.tuck, 0, 1),
    brake: clamp(input.brake, 0, 1),
    steer: clamp(input.steer, -1, 1),
    bar: clamp(-input.lean, -1, 1),
  };
}

/** A rig ready on the summit: the skier stood there (the caller stands
 * him), the wing inflated over him. */
export function freshPara(state: GameState): ParaState {
  const start = paraStartOf(state.level);
  const p: ParaState = {
    mode: "ready",
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    heading: start.heading,
    bank: 0,
    pitch: 0,
    airspeed: 0,
    alpha: 0,
    stalled: false,
    fold: 0,
    foldSide: 0,
    wind: 0,
    lift: 0,
    rough: 0,
    tension: 0,
    controls: { ...IDLE },
    rpm: PARA.engine.idle,
    thrust: 0,
    prop: 0,
    flying: false,
    agl: 0,
    climb: 0,
    t: 0,
    airTime: 0,
    start,
    canopy: null,
    motor: null,
  };
  holdOverhead(state, p);
  return p;
}

/** BEGIN THE RIDE (again): the skier stood on the summit, mended, the rig
 * ready on his back and the wing over him. */
export function startPara(state: GameState, events: GameEvent[]): void {
  const start = paraStartOf(state.level);
  standSkier(state, start.x, start.z, start.heading);
  const c = state.skier;
  mendBody(c.body);
  c.thrown = null;
  state.para = freshPara(state);
  say(state, events, "restart");
}

/** Whether the rig is on him — the wing ready or flying. */
export function paraRigged(state: GameState): boolean {
  const m = state.para?.mode;
  return m === "ready" || m === "flown";
}

/** WHAT THE SKIER IS STEPPED ON while the rig is on him: in the air he
 * hangs in the harness and his own axes are the wing's — his skis do
 * nothing; on the snow he skis as ever. */
export function paraHeld(state: GameState, input: SkierInput): SkierInput {
  const p = state.para;
  if (!p || p.mode !== "flown" || !p.flying) return input;
  return HANGING;
}
const HANGING: SkierInput = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };

/** BEFORE THE SKIER'S STEP: the release press drops the rig, and a reset
 * while it is on him starts the ride again on the summit — true when that
 * took the step. */
export function paraPress(state: GameState, input: SkierInput, events: GameEvent[]): boolean {
  const p = state.para;
  if (!p || !paraRigged(state) || state.skier.thrown) return false;
  if (input.reset) {
    startPara(state, events);
    return true;
  }
  if (input.machine) release(state, events, "drop");
  return false;
}

/** AFTER THE SKIER'S STEP: the rig flown on him, or its pieces falling and
 * lying where they came down. */
/** How quickly a released motor's propeller runs down, s. */
const SPIN_DOWN = 1.2;

export function stepPara(state: GameState, input: SkierInput, events: GameEvent[]): void {
  const p = state.para;
  if (!p) return;
  p.t += dt;
  if (p.mode === "dropped") {
    // The kill switch let go with the throttle: the propeller runs down.
    p.rpm *= Math.exp(-dt / SPIN_DOWN);
    if (p.rpm < 30) p.rpm = 0;
    p.prop = (p.prop + (p.rpm / 60) * 2 * Math.PI * dt) % (2 * Math.PI);
    if (p.canopy) fall(state, p.canopy, PARA.wing.mass, PARA.dropped.canopyDrag);
    if (p.motor) fall(state, p.motor, PARA.motorMass, PARA.dropped.motorDrag);
    return;
  }
  const c = state.skier;
  if (c.thrown) {
    release(state, events, "collapse");
    return;
  }
  const level = state.level;
  const M = pilotMass(totalMass(c.spec));
  // THE HANDS: the toggles and the throttle follow them.
  const want = paraControls(input);
  // NEAR THE MAP'S EDGE in the air (`airBoundsAt`): the toggles turned
  // toward its middle, by how deep into the band it is.
  if (p.flying) {
    airBoundsAt(level, p.x, p.z, p.agl, TUNING.bounds.air.para, edge);
    const w = clamp(edge.depth * 1.5, 0, 1);
    const back = clamp(1.5 * angleDiff(p.heading, edge.heading), -1, 1);
    want.steer += (back - want.steer) * w;
  }
  const k = 1 - Math.exp(-dt / HANDS);
  const ctl = p.controls;
  ctl.throttle += (want.throttle - ctl.throttle) * k;
  ctl.brake += (want.brake - ctl.brake) * k;
  ctl.steer += (want.steer - ctl.steer) * k;
  ctl.bar += (want.bar - ctl.bar) * k;

  // THE ENGINE: the rpm after the throttle, the thrust off it — the square
  // of the rpm, falling with the air through the propeller.
  const E = PARA.engine;
  const goal = E.idle + (E.full - E.idle) * ctl.throttle;
  p.rpm += (goal - p.rpm) * (1 - Math.exp(-dt / E.lag));
  p.prop = (p.prop + (p.rpm / 60) * 2 * Math.PI * dt) % (2 * Math.PI);
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  // In the air the thrust line tilts with the pilot's lean in the harness.
  const tilt = E.tilt - ctl.bar * PARA.lean.pitch * PARA.lean.thrust;
  const along = c.airborne
    ? { x: fx * Math.cos(tilt), y: Math.sin(tilt), z: fz * Math.cos(tilt) }
    : rotate(c.q, { x: 0, y: 0, z: 1 });
  const through = Math.max(0, c.vx * along.x + c.vy * along.y + c.vz * along.z);
  const r = p.rpm / E.full;
  p.thrust = E.thrust * r * r * Math.max(0, 1 - through / E.pitchSpeed);
  const push = (p.thrust / M) * dt;
  c.vx += along.x * push;
  c.vy += along.y * push;
  c.vz += along.z * push;

  if (p.mode === "ready") {
    // HELD OVERHEAD, inflated, until he has skied off fast enough for it
    // to fly.
    holdOverhead(state, p);
    // Let fly once the AIR meeting it from ahead is enough to fly it: a
    // headwind on the summit lifts it with him barely moving, a tailwind
    // makes him ski faster than the wind first — the air from behind would
    // only blow it down over him.
    readAir(state, p);
    const hx = Math.sin(p.heading);
    const hz = Math.cos(p.heading);
    const through = (c.vx - air.x) * hx + (c.vz - air.z) * hz;
    if (through >= PARA.launch.release || c.airborne) {
      p.mode = "flown";
      p.t = 0;
      say(state, events, "launch");
    }
    readPilot(state, p);
    return;
  }

  fly(state, p, M, events);
  readPilot(state, p);
  // THE FLIGHT, counted and reported.
  if (c.airborne) {
    p.airTime += dt;
    if (!p.flying && p.airTime >= FLIGHT) {
      p.flying = true;
      say(state, events, "takeoff");
    }
  } else {
    if (p.flying) say(state, events, "touch");
    p.flying = false;
    p.airTime = 0;
  }
  if (p.flying) hang(state, p);
  // THE WING BROUGHT DOWN: onto the snow, or into a crown.
  if (p.y - 0.5 <= level.groundAt(p.x, p.z) + PARA.ground || inACrown(level, p)) {
    release(state, events, "collapse");
  }
}

/** THE WING ON ITS LINES for one step: the air on it, the swing damped, its
 * weight, the line pulled tight on both bodies. */
function fly(state: GameState, p: ParaState, M: number, events: GameEvent[]): void {
  const c = state.skier;
  const level = state.level;
  const ctl = p.controls;
  const B = PARA.brakes;
  // The lines' direction, pilot to wing.
  lineDir(p, c, U);
  const ux = U.x;
  const uy = U.y;
  const uz = U.z;
  // The air through the wing: the wind, its rise off the slopes and its
  // eddies (`para-air.ts`).
  readAir(state, p);
  const ax = p.vx - air.x;
  const ay = p.vy - air.y;
  const az = p.vz - air.z;
  const V = hypot3(ax, ay, az);
  const down = ax * ux + ay * uy + az * uz;
  // Its way: the air's direction square to the lines (the canopy noses into
  // the flow), else where it last pointed.
  wayOf(ax, ay, az, down, U, p.heading, FW);
  const fwx = FW.x;
  const fwy = FW.y;
  const fwz = FW.z;
  // THE POLAR: the angle of attack off the trim, the brakes and the risers.
  const bar = ctl.bar >= 0 ? ctl.bar * PARA.speedBar.rig : -ctl.bar * PARA.speedBar.trimmers;
  const rig = PARA.rig + B.rig * ctl.brake + bar;
  const alpha = rig + Math.atan2(-down, Math.max(1e-3, ax * fwx + ay * fwy + az * fwz));
  const stall = P.stall - B.stall * ctl.brake;
  p.stalled = alpha > stall;
  // THE TIPS: the eddies across the span meet each tip at its own angle.
  const rx0 = uy * fwz - uz * fwy;
  const ry0 = uz * fwx - ux * fwz;
  const rz0 = ux * fwy - uy * fwx;
  const half = F.span / 2;
  const t = state.t;
  const upR = eddyUp(level, t, p.x + rx0 * half, p.y + ry0 * half, p.z + rz0 * half, air);
  const upL = eddyUp(level, t, p.x - rx0 * half, p.y - ry0 * half, p.z - rz0 * half, air);
  const upC = air.y - air.lift;
  const Vs = Math.max(4, V);
  const alphaR = alpha + (upR - upC) / Vs;
  const alphaL = alpha + (upL - upC) / Vs;
  foldIn(state, p, alpha, alphaL, alphaR, V, events);
  const frontal = p.foldSide === 0 ? 1 : F.sideLift;
  const lift =
    (p.stalled ? P.stalled : Math.max(0, P.slope * (alpha - P.zero) + B.lift * ctl.brake)) *
    (1 - F.lift * frontal * p.fold);
  const drag =
    P.drag0 +
    P.induced * lift * lift +
    B.drag * ctl.brake * ctl.brake +
    PARA.turn.drag * Math.abs(ctl.steer) +
    F.drag * p.fold +
    (p.stalled ? P.stallDrag : 0);
  const qS = 0.5 * TUNING.airDensity * V * V * W.area;
  // Lift square to the air, on the lines' side; drag down the air.
  liftDrag(ax, ay, az, V, U, qS, lift, drag, AF);
  let fx = AF.x;
  let fy = AF.y;
  let fz = AF.z;
  // THE TURN: toward the toggle pulled and the weight shifted, and the
  // engine's torque — along the canopy's right, u × f.
  const rx = rx0;
  const ry = ry0;
  const rz = rz0;
  const T = PARA.turn;
  const hx0 = Math.cos(p.heading);
  const hz0 = -Math.sin(p.heading);
  const banked = ux * hx0 + uz * hz0;
  const side =
    qS *
    ((T.side + T.weight) * ctl.steer +
      T.torque * (p.thrust / PARA.engine.thrust) -
      T.righting * banked +
      // The tip lifted the more rolls the canopy toward the other side; a
      // folded side drags the wing round toward it.
      F.roll * (alphaL - alphaR) +
      F.turn * p.foldSide * p.fold);
  fx += side * rx;
  fy += side * ry;
  fz += side * rz;
  // THE SURGE: stalled and the brakes let up, the canopy refills and
  // shoots forward over him.
  if (p.stalled) {
    const surge = qS * P.surge * (1 - ctl.brake);
    fx += surge * fwx;
    fy += surge * fwy;
    fz += surge * fwz;
  }
  // THE SWING DAMPED: the wing's motion about the pilot, square to the
  // lines, against the air — on both, equal and opposite.
  swingDamp(p, c, U, PARA.damping, M, AF);
  fx += AF.x;
  fy += AF.y;
  fz += AF.z;
  // The wing stepped.
  p.vx += (fx / W.mass) * dt;
  p.vy += (fy / W.mass - TUNING.g) * dt;
  p.vz += (fz / W.mass) * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.z += p.vz * dt;
  // THE LINES, pulled tight: the stretch past their length taken out of
  // both by their masses, and the speed apart along them.
  p.tension = pullLines(p, c, W.lines, W.mass, M);
  // What it is drawn by: its heading, its bank over him, its pitch.
  p.heading = Math.atan2(fwx, fwz);
  const hx = Math.cos(p.heading);
  const hz = -Math.sin(p.heading);
  p.bank = Math.atan2(ux * hx + uz * hz, uy);
  p.pitch = alpha - PARA.rig;
  p.airspeed = V;
  p.alpha = alpha;
  derive(c, level);
}

const edge: AirBounds = { depth: 0, wx: 0, wz: 0, heading: 0 };

/** The air at the wing into `air`, and what the rig reads of it. */
function readAir(state: GameState, p: ParaState): void {
  paraAirAt(state.level, state.t, p.x, p.y, p.z, air);
  // ...and near the map's edge, the bounds' wind blowing it back in.
  airBoundsAt(state.level, p.x, p.z, p.agl, TUNING.bounds.air.para, edge);
  air.x += edge.wx;
  air.z += edge.wz;
  p.wind = air.mean;
  p.lift = air.lift;
  p.rough = air.rough;
}

/** A FOLD (`PARA.fold`): the leading edge pushed under its angle tucks —
 * all of it, or the tip pushed under alone — and the wing refills on its
 * own, the faster with the brakes pumped; one fold at a time, the deeper
 * taking over. Only once he flies: on the snow the pilot holds it up. */
function foldIn(
  state: GameState,
  p: ParaState,
  alpha: number,
  alphaL: number,
  alphaR: number,
  V: number,
  events: GameEvent[],
): void {
  if (p.fold > 0) {
    const rate = (1 + F.pump * p.controls.brake) * (V > F.slow ? 1 : 0.3);
    p.fold = Math.max(0, p.fold - (rate * dt) / F.refill);
    if (p.fold < 0.02) p.fold = 0;
  }
  if (!p.flying) return;
  const deepest = Math.min(alpha, alphaL, alphaR);
  if (deepest >= F.alpha) return;
  const depth = clamp(F.least + (F.alpha - deepest) * F.deep, F.least, F.most);
  if (depth <= p.fold) return;
  const onset = p.fold === 0;
  p.fold = depth;
  // A frontal when the middle went under; else the side that did.
  p.foldSide = alpha < F.alpha ? 0 : alphaL < alphaR ? -1 : 1;
  if (onset) say(state, events, "fold");
}

/** THE PILOT IN THE HARNESS, off the snow: turned to the wing's heading,
 * hung under its bank — and, near the snow, stood up with his skis
 * squared to the slope under him to land. */
function hang(state: GameState, p: ParaState): void {
  // Aloft he leans in the harness as the bar asks (forward over it, back
  // reclined); stood up to land, squared to the slope.
  const F = PARA.flare;
  hangUnder(state, p.heading, p.bank, p.agl, -p.controls.bar * PARA.lean.pitch, F.stand, F.square);
}

/** The pilot's height over the snow and his climb. */
function readPilot(state: GameState, p: ParaState): void {
  const c = state.skier;
  p.agl = Math.max(0, c.y - c.spec.cogHeight - state.level.groundAt(c.x, c.z));
  p.climb = c.vy;
}

/** THE WING HELD OVERHEAD on the summit: inflated over him, a little back
 * of plumb, moving with him. */
function holdOverhead(state: GameState, p: ParaState): void {
  const c = state.skier;
  const lean = PARA.launch.lean;
  const h = c.speed > 1 ? Math.atan2(c.vx, c.vz) : c.heading;
  p.heading = h;
  p.x = c.x - Math.sin(h) * Math.sin(lean) * W.lines;
  p.y = c.y + Math.cos(lean) * W.lines;
  p.z = c.z - Math.cos(h) * Math.sin(lean) * W.lines;
  p.vx = c.vx;
  p.vy = c.vy;
  p.vz = c.vz;
  p.bank = 0;
  p.pitch = 0;
  p.airspeed = c.speed;
  p.tension = 0;
}

/** Whether the canopy is tangled in a crown. */
function inACrown(level: Level, p: ParaState): boolean {
  return crownAt(level, p.x, p.y, p.z, 1.5) >= 0;
}

/** THE RIG LET GO — by the pilot's press, or cut away as the wing came
 * down or he did: the canopy and the motor each fall free of him. */
function release(state: GameState, events: GameEvent[], phase: ParaPhaseEvent): void {
  const p = state.para!;
  const c = state.skier;
  p.mode = "dropped";
  p.t = 0;
  p.flying = false;
  p.tension = 0;
  p.thrust = 0;
  p.controls = { ...IDLE };
  p.canopy = {
    x: p.x,
    y: p.y,
    z: p.z,
    vx: p.vx,
    vy: p.vy,
    vz: p.vz,
    heading: p.heading,
    down: false,
  };
  const back = rotate(c.q, { x: 0, y: 0.1, z: -0.35 });
  p.motor = {
    x: c.x + back.x,
    y: c.y + back.y,
    z: c.z + back.z,
    vx: c.vx,
    vy: c.vy,
    vz: c.vz,
    heading: c.heading,
    down: false,
  };
  say(state, events, phase);
}

/** A released piece falling under its drag, and lying where it lands. */
function fall(state: GameState, b: ParaPiece, mass: number, area: number): void {
  fallPiece(state.level, b, mass, area);
}

const say = (state: GameState, events: GameEvent[], phase: ParaPhaseEvent): void => {
  const c = state.skier;
  events.push({ kind: "para", t: state.t, phase, x: c.x, y: c.y, z: c.z, speed: c.speed });
};
