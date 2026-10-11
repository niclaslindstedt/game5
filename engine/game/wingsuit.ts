// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINGSUIT IN FLIGHT — a skydive (`chute.ts`) flown in another suit:
// everything from the cliff's edge or the door to the pull is here, and the
// opening, the canopy, the snag and the restart are the skydive's own over
// the BASE rig's one canopy (`CHUTE.base`). The flyer is the skier himself
// with NO SKIS (`ChuteState.suit`), on his own keys:
//
//   * STOOD ON THE EDGE (`ready`): held where he stands until the press (or
//     the tuck) — the JUMP, a running exit's push out and up (`exitJump`).
//   * THE START ARC (`exit`): off a cliff with no air through him, the body
//     led head first into the relative wind at a flying attack, the suit
//     filling as the air comes (`WINGSUIT.pressure`) and the lift turning
//     his fall out into a glide; off a door, already flying, the wings held
//     half closed until the tail is past.
//   * FLYING (`freefall`): a body of 90 kg on the suit's lift and drag, at
//     the air's real density for the height and in the map's wind, its
//     ATTACK on a short period of its own — the moment off the trim the
//     flyer's body asks, damped — so a pull-up overshoots and settles and the
//     long swing of speed for height (the phugoid) is the physics' own; the
//     edge ROLLS him and the lift tilted with him TURNS him; the lean is the
//     pitch (forward the dive, back the flare), the tuck sweeps the arms
//     back (the delta dive) and the back key spreads the wings full.
//   * THE SNOW OR A CROWN MET IN FLIGHT is the crash code's: thrown
//     (`metSnow`), at a wingsuit's speed nearly always the end of him.
//   * LANDED under the canopy ON HIS BOOTS (`landOnFoot`), run out and
//     walked on (`walkOnFoot`) until the press begins the jump again.
//
// Pure over the level, the state and the clock: nothing here draws from the
// stream, and a ride with no wingsuit never comes in here.

import { angleDiff, clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { airDensity, airKelvin, airPressure, seaAltitude } from "./balloon-air.ts";
import { clearOfSolids, onFoot } from "./buzz.ts";
import { airPose, crownAt } from "./canopy.ts";
import { airBoundsAt, type AirBounds } from "./collision.ts";
import { throwRider } from "./crash.ts";
import { CHUTE } from "./defs/chute.ts";
import { TUNING } from "./defs/tuning.ts";
import { WINGSUIT as W, wingsuitMass } from "./defs/wingsuit.ts";
import { paraAirAt, type ParaAir } from "./para-air.ts";
import { derive } from "./skier.ts";
import type { ChutePhaseEvent, ChuteState, WingsuitFlight } from "./chute-state.ts";
import type { GameEvent, GameState, SkierInput } from "./state.ts";

const dt = TUNING.dt;
const g = TUNING.g;
const air: ParaAir = { x: 0, y: 0, z: 0, mean: 0, lift: 0, rough: 0, lee: 0 };
const edge: AirBounds = { depth: 0, wx: 0, wz: 0, heading: 0 };

/** The flyer's mass, kg: no skis, the suit and the BASE rig. */
export function flyerMass(state: GameState): number {
  return wingsuitMass(state.skier.spec.skierMass, CHUTE.base.container.mass);
}

/** A suit's flight begun at attack `alpha`, its air `pressure` 0..1. */
export function freshWing(alpha: number, pressure: number): WingsuitFlight {
  return {
    alpha,
    q: 0,
    pitch: 0,
    path: 0,
    bank: 0,
    lean: 0,
    sweep: 0,
    spread: 0,
    pressure,
    lift: 0,
    drag: 0,
    glide: 0,
    stalled: false,
  };
}

/** THE AIR ON THE SUIT: the lift factor cL, the parasitic cp and the
 * induced ci, m², at attack `alpha`, rad, as full of air as `pressure`,
 * the arms swept `sweep` and the wings spread `spread` (each 0..1). */
export type SuitAero = { cL: number; cp: number; ci: number; stalled: boolean };

export function suitAero(
  alpha: number,
  pressure: number,
  sweep: number,
  spread: number,
  out: SuitAero,
): SuitAero {
  const L = W.lift;
  const D = W.drag;
  const shape = (swept: number, spreadOut: number): number =>
    (1 + (swept - 1) * sweep) * (1 + (spreadOut - 1) * spread);
  const slope = L.slope * shape(W.sweep.lift, W.spread.lift);
  const most = slope * (L.stall - L.zero);
  let cL: number;
  if (alpha <= L.stall) cL = slope * (alpha - L.zero);
  else cL = Math.max(most * L.floor, most - (L.post * slope * (alpha - L.stall)) / L.slope);
  // Unfilled, the wings flap: the lift is the share of a full suit's its
  // air gives it, and the body flaps a drag of its own on top.
  out.cL = cL * pressure;
  const off = alpha - D.design;
  out.cp =
    D.parasite * shape(W.sweep.parasite, W.spread.parasite) +
    D.alpha * off * off +
    (alpha > L.stall ? D.stall * (alpha - L.stall) : 0) +
    (1 - pressure) * 0.1;
  out.ci = D.induced * shape(W.sweep.induced, W.spread.induced);
  out.stalled = alpha > L.stall;
  return out;
}

const aero: SuitAero = { cL: 0, cp: 0, ci: 1, stalled: false };

/** The lift and the drag, N, of `a` (the factors) at `rhoV2` = ρV². */
export function liftAndDrag(a: SuitAero, rhoV2: number): { L: number; D: number } {
  const L = rhoV2 * a.cL;
  const D = a.cp * rhoV2 + (rhoV2 > 1 ? (L * L) / (a.ci * rhoV2) : 0);
  return { L, D };
}

/** The air's density at height `y` on the map, kg/m³. */
export function densityAt(state: GameState, y: number): number {
  const alt = seaAltitude(state.level, y);
  return airDensity(airPressure(alt), airKelvin(alt));
}

/** His body's height over the snow under him, m (lying on the wind). */
export function bodyUp(
  state: GameState,
  x = state.skier.x,
  y = state.skier.y,
  z = state.skier.z,
): number {
  return y - W.body - state.level.groundAt(x, z);
}

const tell = (state: GameState, events: GameEvent[], phase: ChutePhaseEvent): void => {
  const c = state.skier;
  events.push({ kind: "chute", t: state.t, phase, x: c.x, y: c.y, z: c.z, speed: c.speed });
};

/** STOOD ON THE EDGE: held where he stands, facing out over the drop, until
 * the press or the tuck — then off it (`exitJump`). */
export function onLedge(
  state: GameState,
  ch: ChuteState,
  input: SkierInput,
  events: GameEvent[],
): void {
  const c = state.skier;
  if ((state.wingsuit?.hover ?? 0) > 0) hoverHold(state, ch);
  else onFoot(state, c.x, c.z, ch.heading, 0, 0);
  ch.agl = state.wingsuit?.hover ?? 0;
  ch.airspeed = 0;
  ch.fall = 0;
  if (ch.t >= 0.5 && (input.machine || input.tuck > 0.5)) exitJump(state, ch, events);
}

/** HELD IN THE HOVER (`WingsuitExit.hover`): on the skid of a helicopter
 * standing still that height over the snow, his feet on it, not moving. */
export function hoverHold(state: GameState, ch: ChuteState): void {
  const c = state.skier;
  const hover = state.wingsuit?.hover ?? 0;
  c.y = state.level.groundAt(c.x, c.z) + W.search.stand + hover;
  c.vx = 0;
  c.vy = 0;
  c.vz = 0;
  c.airborne = true;
  c.heading = ch.heading;
  derive(c, state.level);
}

/** THE JUMP off the edge: a running exit's push out and up, the body led
 * into the air at the exit's attack, the suit empty — or, off a hover, the
 * step off the skid. */
export function exitJump(state: GameState, ch: ChuteState, events: GameEvent[]): void {
  const c = state.skier;
  const E = W.exit;
  const hover = (state.wingsuit?.hover ?? 0) > 0;
  const push = hover ? E.step : E.push;
  c.vx = Math.sin(ch.heading) * push;
  c.vz = Math.cos(ch.heading) * push;
  c.vy = hover ? 0 : E.up;
  c.airborne = true;
  ch.mode = "exit";
  ch.t = 0;
  ch.since = 0;
  ch.wing = freshWing(E.alpha, 0);
  tell(state, events, "exit");
}

/** Into the suit for a jump out of a door or off a craft already moving:
 * the attack the exit leads with, the suit filling at once in the air
 * through him. */
export function suitUp(ch: ChuteState): void {
  ch.wing = freshWing(W.exit.alpha, 0);
}

/** ONE STEP OF THE WINGSUIT IN THE AIR (the start arc and the flight). */
export function flyWingsuit(state: GameState, ch: ChuteState, input: SkierInput): void {
  const c = state.skier;
  const w = ch.wing ?? (ch.wing = freshWing(W.trim.glide, 1));
  const M = flyerMass(state);
  const level = state.level;
  // THE AIR: the map's, the edge's wind blowing him back in, its density.
  paraAirAt(level, state.t, c.x, c.y, c.z, air);
  ch.agl = Math.max(0, bodyUp(state));
  airBoundsAt(level, c.x, c.z, ch.agl, TUNING.bounds.air.wingsuit, edge);
  air.x += edge.wx;
  air.z += edge.wz;
  const rho = densityAt(state, c.y);
  ch.density = rho;
  const ax = c.vx - air.x;
  const ay = c.vy - air.y;
  const az = c.vz - air.z;
  const V = Math.max(0.5, hypot3(ax, ay, az));
  // THE HANDS: nothing asked in the exit's first moments, the wings held
  // half closed out of a door until its tail is past.
  const out = ch.mode === "exit";
  const free = !out || ch.t >= W.exit.clear;
  const k = 1 - Math.exp(-dt / W.hands);
  const lean = free ? clamp(input.lean, -1, 1) : 0;
  const sweep = free ? clamp(input.tuck, 0, 1) : out && V > W.exit.held ? 0.5 : 0;
  const spread = free ? clamp(input.brake, 0, 1) : 0;
  w.lean += (lean - w.lean) * k;
  w.sweep += (sweep - w.sweep) * k;
  w.spread += (spread - w.spread) * k;
  // THE SUIT FILLING with the air through him.
  const P = W.pressure;
  const full = clamp((V - P.from) / (P.full - P.from), 0, 1);
  w.pressure += (full - w.pressure) * (1 - Math.exp(-dt / P.time));
  // THE HEADING: the way through the air; straight down, where it has none,
  // the edge turns him flat.
  const flat = hypot(ax, az);
  let steer = free ? clamp(input.steer, -1, 1) : 0;
  const deep = clamp(edge.depth * 1.5, 0, 1);
  steer += (clamp(1.5 * angleDiff(ch.heading, edge.heading), -1, 1) - steer) * deep;
  if (flat > 3) ch.heading = Math.atan2(ax, az);
  else ch.heading += steer * W.roll.flat * dt;
  // THE ROLL: the bank the edge asks, rolled to.
  w.bank += (steer * W.roll.bank - w.bank) * (1 - Math.exp(-dt / W.roll.time));
  // THE TRIM the body asks: the lean (back the flare, forward the dive),
  // the sweep, the spread, a turn pulled.
  const T = W.trim;
  let trim =
    w.lean >= 0 ? T.glide + (T.flare - T.glide) * w.lean : T.glide + (T.glide - T.dive) * w.lean;
  trim += T.sweep * w.sweep + T.spread * w.spread + (T.turn * Math.abs(w.bank)) / W.roll.bank;
  if (out) trim = Math.max(trim, W.exit.alpha);
  // THE FORCES: lift square to the air through him, tilted by the bank;
  // drag down it; gravity.
  suitAero(w.alpha, w.pressure, w.sweep, w.spread, aero);
  const rhoV2 = rho * V * V;
  const { L, D } = liftAndDrag(aero, rhoV2);
  const vx = ax / V;
  const vy = ay / V;
  const vz = az / V;
  // The lift's way: square to the air, in the plane through it and his
  // right (level: up; diving straight down: ahead), rolled by the bank.
  const rx = Math.cos(ch.heading);
  const rz = -Math.sin(ch.heading);
  let lx = vy * rz;
  let ly = vz * rx - vx * rz;
  let lz = -vy * rx;
  const ln = hypot3(lx, ly, lz) || 1;
  lx /= ln;
  ly /= ln;
  lz /= ln;
  const sx = ly * vz - lz * vy;
  const sy = lz * vx - lx * vz;
  const sz = lx * vy - ly * vx;
  const cb = Math.cos(w.bank);
  const sb = Math.sin(w.bank);
  const ux = lx * cb + sx * sb;
  const uy = ly * cb + sy * sb;
  const uz = lz * cb + sz * sb;
  const fx = L * ux - D * vx;
  const fy = L * uy - D * vy;
  const fz = L * uz - D * vz;
  // THE ATTACK: the path turned by the lift and gravity across it, the body
  // pitched by the moment off the trim, damped — or, the air too thin
  // through him yet off a cliff, held into the wind by his own body.
  const turnPath = (L - M * g * uy) / (M * V);
  const Pt = W.pitch;
  if (out && V < W.exit.held) {
    w.alpha += (W.exit.alpha - w.alpha) * (1 - Math.exp(-dt / 0.2));
    w.q = 0;
  } else {
    const qDot = (-rhoV2 * Pt.moment * (w.alpha - trim) - rho * V * Pt.damping * w.q) / Pt.inertia;
    w.q += qDot * dt;
    w.alpha = clamp(w.alpha + (w.q - turnPath) * dt, Pt.least, Pt.most);
  }
  c.vx += (fx / M) * dt;
  c.vy += (fy / M - g) * dt;
  c.vz += (fz / M) * dt;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  c.z += c.vz * dt;
  // WHAT IS READ OFF IT.
  w.path = Math.asin(clamp(vy, -1, 1));
  w.pitch = w.path + w.alpha * Math.cos(w.bank);
  w.lift = L;
  w.drag = D;
  w.glide = flat / Math.max(0.1, -ay);
  w.stalled = aero.stalled;
  ch.g = hypot3(fx, fy, fz) / (M * g);
  ch.airspeed = V;
  ch.fall = -c.vy;
  ch.attitude = clamp(Math.PI / 2 - w.pitch, 0, Math.PI);
  ch.turn = 0;
  // Out of the start arc: his path no steeper than a glide of `flying`.
  if (out && ch.t >= W.exit.clear && (-ay <= flat / W.exit.flying || ch.t >= W.exit.most)) {
    ch.mode = "freefall";
    ch.t = 0;
  }
  airPose(state, ch.heading, ch.attitude);
}

/** THE SUIT'S LIFT through the first of the opening (the flyer still on
 * his wings until the canopy leaves the container and the lines stretch):
 * `share` of it, 1 at the throw, 0 at line stretch — after the opening's
 * own drag, on his velocity. */
export function suitLift(state: GameState, ch: ChuteState, share: number): void {
  const w = ch.wing;
  if (!w || share <= 0) return;
  const c = state.skier;
  const V = Math.max(0.5, ch.airspeed);
  suitAero(w.alpha, w.pressure, w.sweep, w.spread, aero);
  const { L } = liftAndDrag(aero, ch.density * V * V);
  const M = flyerMass(state);
  // Square to his way, up the plane through it and his right.
  const rx = Math.cos(ch.heading);
  const rz = -Math.sin(ch.heading);
  const v = Math.max(0.5, hypot3(c.vx, c.vy, c.vz));
  const vx = c.vx / v;
  const vy = c.vy / v;
  const vz = c.vz / v;
  let lx = vy * rz;
  let ly = vz * rx - vx * rz;
  let lz = -vy * rx;
  const ln = hypot3(lx, ly, lz) || 1;
  lx /= ln;
  ly /= ln;
  lz /= ln;
  const a = (L * share) / M;
  c.vx += lx * a * dt;
  c.vy += ly * a * dt;
  c.vz += lz * a * dt;
  w.lift = L * share;
}

/** THE SNOW OR A CROWN MET IN FLIGHT — now or where he will be the next
 * step: thrown, the crash code's from here (true). */
export function metSnow(state: GameState, ch: ChuteState, events: GameEvent[]): boolean {
  const c = state.skier;
  const level = state.level;
  const nx = c.x + c.vx * dt;
  const ny = c.y + c.vy * dt;
  const nz = c.z + c.vz * dt;
  const ground = bodyUp(state) < 0 || bodyUp(state, nx, ny, nz) < 0;
  const tree = !ground && crownAt(level, c.x, c.y, c.z, W.crown) >= 0;
  if (!ground && !tree) return false;
  // Kept out of the snow he meets: the ragdoll starts on it.
  const floor = level.groundAt(c.x, c.z) + W.body;
  if (c.y < floor) c.y = floor;
  ch.fell = true;
  const v = { x: c.vx, y: c.vy, z: c.vz };
  throwRider(state, tree ? "tree" : "wingsuit", v, events, { keepSkis: true });
  return true;
}

/** DOWN UNDER THE CANOPY ON HIS BOOTS (the canopy already let go of): run
 * out on his feet — or, too hard a sink or too fast across, thrown. */
export function landOnFoot(state: GameState, ch: ChuteState, events: GameEvent[]): void {
  const c = state.skier;
  const Ld = W.land;
  const sink = Math.max(0, -c.vy);
  const run = hypot(c.vx, c.vz);
  ch.mode = "landed";
  ch.t = 0;
  ch.agl = 0;
  if (sink > Ld.sink || run > Ld.run) {
    ch.fell = true;
    const floor = state.level.groundAt(c.x, c.z) + 0.6;
    if (c.y < floor) c.y = floor;
    throwRider(state, "landing", { x: c.vx, y: c.vy, z: c.vz }, events, { keepSkis: true });
    return;
  }
  const heading = run > 0.5 ? Math.atan2(c.vx, c.vz) : ch.heading;
  ch.heading = heading;
  onFoot(state, c.x, c.z, heading, c.vx, c.vz);
  tell(state, events, "land");
}

/** ON FOOT, landed: the run-out slowed to a walk, then walked on his keys
 * — the tuck walks him on, the edge turns him, the back key stands him. */
export function walkOnFoot(state: GameState, ch: ChuteState, input: SkierInput): void {
  const c = state.skier;
  const Ld = W.land;
  let heading = ch.heading;
  const was = hypot(c.vx, c.vz);
  let pace: number;
  if (was > Ld.walk + 0.05) pace = Math.max(Ld.walk, was - Ld.stop * dt);
  else {
    heading += clamp(input.steer, -1, 1) * Ld.turn * dt;
    pace = input.brake > 0.15 ? 0 : Ld.walk * clamp(input.tuck * 2, 0, 1);
  }
  ch.heading = heading;
  const vx = Math.sin(heading) * pace;
  const vz = Math.cos(heading) * pace;
  const at = clearOfSolids(state, c.x + vx * dt, c.z + vz * dt);
  const lo = TUNING.bounds.margin;
  const hi = state.level.size - lo;
  onFoot(state, clamp(at.x, lo, hi), clamp(at.z, lo, hi), heading, vx, vz);
  ch.airspeed = pace;
  ch.fall = 0;
}
