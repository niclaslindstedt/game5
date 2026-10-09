// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOT AIR BALLOON — a free ride begun in the basket of a sport balloon
// stood up inflated on the valley floor (`CreateGameOptions.balloon`,
// `docs/hot-air-balloon.md`). The day's up-valley wind (`balloon-air.ts`)
// blows toward the summit, so a pilot who climbs drifts up the mountain;
// he steers by nothing but his height.
//
// THE CONTROLS are the skier's own: the TUCK holds the BLAST VALVE open
// (the burner roars), the BACK KEY pulls the PARACHUTE VALVE's cord (hot air
// out of the crown), the EDGE and the LEAN WALK him about the basket's
// floor, and THE MACHINE PRESS (`SkierInput.machine`: ENTER, a double tap on
// touch) takes him OVER THE SIDE — or, the basket stood still on the snow,
// steps him out onto it. A RESET starts the ride again at the bottom.
//
// THE FLIGHT, every step:
//   * THE ENVELOPE'S AIR is one temperature (a lumped model): the burner's
//     heat in (its gross output times the share the air keeps), the fabric's
//     loss out — radiation to a sky colder than the air, and convection off
//     both faces that grows with the air past it — and the parachute
//     valve's dump. The air in it weighs what the gas law says at the
//     outside pressure and its own temperature.
//   * THE LIFT is the weight of the outside air it displaces less its own,
//     against the whole weight (the balloon, the fuel left, the skier);
//     the outside air thinner and colder with altitude (the standard
//     atmosphere). Against the climb or the sink is the envelope's drag on
//     its plan; the mass that must be moved is the balloon's, the air
//     inside it and the air it drags along — which is why a burn takes tens
//     of seconds to become a climb.
//   * ACROSS THE GROUND it is carried by the wind at its envelope, the drag
//     on its side area relaxing its way toward the wind's over the same
//     great mass: climb into a faster layer and the air rushes past the
//     envelope until it has caught up.
//   * THE FIRE: burning while that air pushes the mouth in over the burner
//     (past the skirt's `fire.shear`), or cooking the fabric past its
//     temperature, scorches it alight; burning, it pours its hot air out and
//     the balloon falls.
//   * THE SNOW: met too fast along its normal the basket is a CRASH (the
//     `balloon` crash cause — he is thrown out onto his ragdoll); met
//     softly it settles, and with the envelope still pulling it is dragged,
//     friction holding it back — dragged too fast, it goes over. A crown
//     met slowly snags it; met fast, it is a crash too.
//   * SAFE FOR WORK (`RunRules.sfw`): none of that — it never catches
//     fire, and the snow and the crowns only stop it.
//
// Pure over the level, the state and the clock: nothing here draws from the
// stream, and a run with no balloon never comes in here.

import { clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler, rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import {
  BALLOON,
  BALLOON_CENTRE,
  BALLOON_EMPTY,
  BALLOON_PLAN,
  BALLOON_SIDE,
} from "./defs/balloon.ts";
import { totalMass } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import {
  airDensity,
  airKelvin,
  airPressure,
  balloonRiseAt,
  balloonWindAt,
  seaAltitude,
} from "./balloon-air.ts";
import { mendBody } from "./body.ts";
import { standSkier } from "./course.ts";
import { mayGetUp, throwRider } from "./crash.ts";
import { helipadOf, openSpotNear, type Helipad } from "./heli-pad.ts";
import { sledSpotOf } from "./sled-pad.ts";
import { derive } from "./skier.ts";
import { treesNear } from "./upright-grid.ts";
import type { Wind } from "./wind.ts";
import type { Level } from "../mapgen/types.ts";
import type { BalloonPhaseEvent, BalloonState, GameEvent, GameState, SkierInput } from "./state.ts";

const dt = TUNING.dt;
const B = BALLOON;
const E = BALLOON.envelope;
const SIGMA = 5.670374e-8;
const KELVIN = 273.15;
/** How far up the snow he must be, m, before the basket is off it. */
const CLEAR = 0.02;
/** The largest crown a basket is looked for in, m. */
const CROWNS = 9;

const sites = new WeakMap<Level, Helipad>();
const wind: Wind = { x: 0, z: 0, speed: 0, gust: 0 };
const normal = { x: 0, y: 1, z: 0 };
const near: number[] = [];

/** WHERE THE BALLOON IS STOOD UP: open, level snow on the valley floor near
 * the village (or the finish) — room for the envelope's sweep, clear of
 * trunks, lifts and tunnels, and kept off the helicopter's pad and the
 * snowmobile's spot — faced to the summit. Worked out once a map. */
export function balloonSiteOf(level: Level): Helipad {
  let site = sites.get(level);
  if (!site) {
    const pad = helipadOf(level);
    const sled = sledSpotOf(level);
    site = openSpotNear(level, B.site.room, B.site.slope, [
      { x: pad.x, z: pad.z, r: B.site.fromPad },
      { x: sled.x, z: sled.z, r: B.site.fromPad },
    ]);
    sites.set(level, site);
  }
  return site;
}

/** The whole weight's mass, kg: the balloon, the fuel left and the skier
 * aboard. */
function massOf(state: GameState, b: BalloonState): number {
  return BALLOON_EMPTY + b.fuel + (b.aboard ? totalMass(state.skier.spec) : 0);
}

/** THE TRIM: the envelope's temperature, °C, at which the balloon `b`
 * weighs nothing where it is — what a pilot reads his burns against, and
 * what the bot flies by (`balloon-pilot.ts`). */
export function balloonTrim(state: GameState, b: BalloonState, share = 1): number {
  const alt = seaAltitude(state.level, b.y + BALLOON_CENTRE);
  const p = airPressure(alt);
  const rhoA = airDensity(p, airKelvin(alt));
  const V = E.volume * Math.max(0.05, 1 - b.burnt);
  const rhoI = rhoA - (share * massOf(state, b)) / V;
  return rhoI > 0.05 ? p / (B.air.gas * rhoI) - KELVIN : 400;
}

/** A balloon stood up on its site, inflated and tethered, `tether.heavy`
 * short of flying, the skier in its basket. */
export function freshBalloon(state: GameState): BalloonState {
  const site = balloonSiteOf(state.level);
  const b: BalloonState = {
    mode: "tethered",
    aboard: true,
    x: site.x,
    y: state.level.groundAt(site.x, site.z),
    z: site.z,
    vx: 0,
    vy: 0,
    vz: 0,
    heading: site.heading,
    pitch: 0,
    roll: 0,
    lean: 0,
    leanTo: site.heading,
    ambient: 0,
    temp: 0,
    density: 1,
    valve: false,
    flame: 0,
    pilot: true,
    fuel: B.mass.fuel,
    vent: 0,
    windX: 0,
    windZ: 0,
    wind: 0,
    shear: 0,
    rise: 0,
    lift: 0,
    climb: 0,
    agl: 0,
    grounded: true,
    dragging: false,
    scorch: 0,
    burning: false,
    burnt: 0,
    deflate: 0,
    walkX: 0,
    walkZ: 0,
    face: 0,
    t: 0,
    airTime: 0,
    wreck: false,
    start: { x: site.x, z: site.z, heading: site.heading },
  };
  b.temp = balloonTrim(state, b, 1 - B.tether.heavy);
  b.ambient = airKelvin(seaAltitude(state.level, b.y)) - KELVIN;
  return b;
}

/** BEGIN THE RIDE (again): the skier stood in the basket of a balloon
 * inflated on its site, mended. */
export function startBalloon(state: GameState, events: GameEvent[]): void {
  const site = balloonSiteOf(state.level);
  standSkier(state, site.x, site.z, site.heading);
  const c = state.skier;
  mendBody(c.body);
  c.thrown = null;
  c.lift = null;
  c.tunnel = null;
  const b = freshBalloon(state);
  state.balloon = b;
  hold(state, b);
  say(state, events, "restart", 0);
}

/** Whether the skier is in the basket. */
export function balloonAboard(state: GameState): boolean {
  return !!state.balloon?.aboard;
}

/** WHETHER THE SKIER IS LYING WHERE A CRASHED BALLOON THREW HIM: he is not
 * stood back up on the mountain — the ride starts again at the bottom
 * once he has lain `crash.lieFor` (`stepBalloon`). */
export function balloonDown(state: GameState): boolean {
  const b = state.balloon;
  return !!b && b.wreck && b.mode === "down" && !!state.skier.thrown;
}

function say(state: GameState, events: GameEvent[], phase: BalloonPhaseEvent, speed: number) {
  const b = state.balloon!;
  events.push({ kind: "balloon", t: state.t, phase, x: b.x, y: b.y, z: b.z, speed });
}

/** ONE STEP OF THE BALLOON, before the skier is stepped: flown, tethered,
 * adrift without him or lying on the snow — and the skier in its basket
 * held there, walking about it, over the side or out. True while he is in
 * the basket: the step is the balloon's, and the snow, the trees and his
 * clock wait. `events` is the run's own list. */
export function stepBalloon(run: GameState, input: SkierInput, events: GameEvent[]): boolean {
  const b = run.balloon;
  if (!b) return false;
  b.t += dt;
  if (b.mode === "down") {
    b.deflate = Math.min(1, b.deflate + dt / B.land.deflate);
    b.flame = 0;
    b.valve = false;
    b.burnt = b.burning ? Math.min(1, b.burnt + dt / B.fire.burnFor) : b.burnt;
    const c = run.skier;
    if (b.wreck && c.thrown) {
      // Thrown out by the crash: lain long enough — or the player's own
      // press, once it is his — and the ride starts again at the bottom.
      const up = input.reset && mayGetUp(c.thrown);
      if (b.t >= B.crash.lieFor || up) {
        startBalloon(run, events);
        return true;
      }
    }
    return false;
  }
  if (b.aboard && input.reset) {
    startBalloon(run, events);
    return true;
  }
  const valve = b.aboard && input.tuck >= B.burner.open;
  const vent = b.aboard ? clamp(input.brake, 0, 1) : 0;
  fly(run, b, valve, vent, events);
  if (!b.aboard) return false;
  if (input.machine) {
    if (b.grounded && hypot3(b.vx, b.vy, b.vz) <= B.land.stepOut) {
      stepOut(run, b, events);
      return false;
    }
    jump(run, b, events);
    return false;
  }
  walk(b, input);
  hold(run, b);
  return true;
}

/** THE FLIGHT: the burner, the valve, the envelope's heat, the forces, the
 * snow and the crowns, the fire. */
function fly(
  run: GameState,
  b: BalloonState,
  valve: boolean,
  ventAsk: number,
  events: GameEvent[],
): void {
  const level = run.level;
  const g = TUNING.g;
  // THE BURNER: the flame after the blast valve, while there is propane.
  b.pilot = b.fuel > 0;
  b.valve = valve && b.pilot;
  b.flame += ((b.valve ? 1 : 0) - b.flame) * (1 - Math.exp(-dt / B.burner.lag));
  const burn = b.pilot ? b.flame * B.burner.power : 0;
  b.fuel = Math.max(0, b.fuel - (burn / B.burner.heating) * dt);
  b.vent += (ventAsk - b.vent) * (1 - Math.exp(-dt / B.vent.lag));
  // THE AIR at the envelope.
  const alt = seaAltitude(level, b.y + BALLOON_CENTRE);
  const Ta = airKelvin(alt);
  const p = airPressure(alt);
  const rhoA = airDensity(p, Ta);
  b.ambient = airKelvin(seaAltitude(level, b.y)) - KELVIN;
  let Ti = b.temp + KELVIN;
  const sound = Math.max(0.05, 1 - b.burnt);
  const V = E.volume * sound;
  const rhoI = airDensity(p, Ti);
  b.density = rhoI / rhoA;
  balloonWindAt(level, run.t, b.x, b.y + BALLOON_CENTRE, b.z, wind);
  b.windX = wind.x;
  b.windZ = wind.z;
  b.wind = wind.speed;
  const rx = wind.x - b.vx;
  const rz = wind.z - b.vz;
  const rel = hypot(rx, rz);
  // The air's own rise up the slope it flows over (none on the snow).
  b.rise = b.grounded || b.mode === "tethered" ? 0 : balloonRiseAt(level, b.x, b.y, b.z, wind);
  const ry = b.rise - b.vy;
  const past = hypot(rel, ry);
  b.shear = rel;
  // THE HEAT: in from the burner, out through the fabric (radiation to the
  // sky, convection to the air past it), the valve and any holes burnt.
  const C = rhoI * V * B.air.cp;
  const Tsky = Ta - B.air.sky;
  const L = B.loss;
  const fabric =
    E.surface *
    sound *
    ((L.still + L.forced * past) * (Ti - Ta) + L.emissivity * SIGMA * (Ti ** 4 - Tsky ** 4));
  const dump = (B.vent.most * b.vent + B.fire.leak * b.burnt) * (Ti - Ta);
  Ti += ((burn * B.burner.efficiency - fabric - dump) / C) * dt;
  Ti = Math.max(Ti, Ta - 2);
  const hot = Ti - KELVIN > B.temp.limit && b.temp <= B.temp.limit;
  b.temp = Ti - KELVIN;
  if (hot) say(run, events, "hot", 0);
  // THE FORCES: the lift less the weight, the drag on the climb, the drag of
  // the air past the envelope's side.
  const mass = massOf(run, b);
  const buoy = V * g * (rhoA - airDensity(p, Ti));
  b.lift = buoy - mass * g;
  const mEff = mass + rhoI * V + B.drag.added * rhoA * V;
  const cloth = b.burnt > 0 ? 1 - (1 - B.fire.streamer) * b.burnt : 1;
  const kv = 0.5 * rhoA * B.drag.vertical * BALLOON_PLAN * cloth;
  const kh = 0.5 * rhoA * B.drag.horizontal * BALLOON_SIDE * cloth;
  const push = kh * rel * rel;
  b.lean = Math.atan2(push, Math.max(1, buoy));
  if (rel > 0.05) b.leanTo = Math.atan2(rx, rz);
  // THE FIRE — never, SAFE FOR WORK (`RunRules.sfw`).
  const sfw = run.rules.sfw === true;
  if (sfw) b.scorch = 0;
  else if (!b.burning) {
    if (rel > B.fire.shear) b.scorch += (b.flame * (rel - B.fire.shear) * dt) / B.fire.scorch;
    if (b.temp > B.temp.fails) b.scorch += ((b.temp - B.temp.fails) * dt) / B.fire.cook;
    if (b.scorch >= 1) {
      b.scorch = 1;
      b.burning = true;
      say(run, events, "fire", rel);
    }
  } else b.burnt = Math.min(1, b.burnt + dt / B.fire.burnFor);
  // TETHERED: held on the snow until it is light, then let go.
  if (b.mode === "tethered") {
    b.vx = b.vy = b.vz = 0;
    b.y = level.groundAt(b.x, b.z);
    b.agl = 0;
    b.climb = 0;
    tilt(run, b);
    if (b.lift > B.tether.release) {
      b.mode = "flown";
      b.t = 0;
      say(run, events, "launch", 0);
    }
    return;
  }
  b.vx += ((kh * rel * rx) / mEff) * dt;
  b.vz += ((kh * rel * rz) / mEff) * dt;
  b.vy += ((b.lift + kv * Math.abs(ry) * ry) / mEff) * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  keepOnMap(level, b);
  // THE CROWNS: a basket in a tree's crown, snagged — or, fast, a crash.
  if (snagged(level, b)) {
    const speed = hypot3(b.vx, b.vy, b.vz);
    if (speed > B.land.tree && !sfw) return crash(run, b, events, speed);
    b.vx = 0;
    b.vz = 0;
  }
  // THE SNOW.
  const ground = level.groundAt(b.x, b.z);
  if (b.y <= ground) {
    level.normalAt(b.x, b.z, normal);
    const vn = b.vx * normal.x + b.vy * normal.y + b.vz * normal.z;
    if (!b.grounded && -vn > B.land.hard && !sfw) return crash(run, b, events, -vn);
    b.y = ground;
    if (vn < 0) {
      b.vx -= normal.x * vn;
      b.vy -= normal.y * vn;
      b.vz -= normal.z * vn;
    }
    // The wicker on the snow, pressed by what the lift leaves of the weight.
    const press = Math.max(0, -b.lift) * normal.y;
    const along = hypot3(b.vx, b.vy, b.vz);
    const stop = ((B.land.friction * press) / mEff) * dt;
    const keep = along > stop ? 1 - stop / along : 0;
    b.vx *= keep;
    b.vy *= keep;
    b.vz *= keep;
    const slide = along * keep;
    if (!b.grounded) {
      b.grounded = true;
      say(run, events, "touch", -vn);
      if (b.mode === "adrift") {
        b.mode = "down";
        b.t = 0;
        say(run, events, "down", -vn);
      }
    }
    b.dragging = slide > 0.3;
    if (slide > B.land.dragMost && !sfw) return crash(run, b, events, slide);
  } else if (b.y > ground + CLEAR) {
    if (b.grounded) say(run, events, "liftoff", 0);
    b.grounded = false;
    b.dragging = false;
  }
  b.agl = b.y - ground;
  b.climb = b.vy;
  if (!b.grounded) b.airTime += dt;
  tilt(run, b);
}

/** Inside the map's edge: the wind leans it on the edge and no further. */
function keepOnMap(level: Level, b: BalloonState): void {
  const m = 20;
  const hi = level.size - m;
  if (b.x < m || b.x > hi) {
    b.x = clamp(b.x, m, hi);
    b.vx = 0;
  }
  if (b.z < m || b.z > hi) {
    b.z = clamp(b.z, m, hi);
    b.vz = 0;
  }
}

/** Whether the basket is inside a tree's crown — a cone from its widest at
 * the crown's foot to its top. */
function snagged(level: Level, b: BalloonState): boolean {
  const half = B.basket.length / 2;
  for (const i of treesNear(level, b.x, b.z, CROWNS, near)) {
    const t = level.trees[i];
    const up = b.y - t.y;
    if (up < 0 || up > t.height) continue;
    const reach = t.crown * Math.min(1, 1.4 * (1 - up / t.height)) + half;
    if (hypot(b.x - t.x, b.z - t.z) < reach) return true;
  }
  return false;
}

/** THE BASKET'S LEAN: his weight off the floor's middle, against the
 * hanging load about the load ring; and dragged on the snow, its leading
 * edge dug in. */
function tilt(run: GameState, b: BalloonState): void {
  const me = b.aboard ? totalMass(run.skier.spec) : 0;
  const load = B.mass.basket + B.mass.burner + B.mass.cylinders + b.fuel + me;
  const arm = load * (B.hang.pivot - B.hang.cog);
  b.roll = Math.atan2(me * b.walkX, arm);
  b.pitch = -Math.atan2(me * b.walkZ, arm);
  if (b.grounded && b.dragging) {
    const speed = hypot(b.vx, b.vz);
    const dig = Math.min(0.5, 0.08 * speed);
    const way = Math.atan2(b.vx, b.vz) - b.heading;
    b.pitch -= dig * Math.cos(way);
    b.roll += dig * Math.sin(way);
  }
}

/** WALKING IN THE BASKET: the edge across it, the lean along it (forward
 * the lean's −1), at a shuffle, never through the wicker; he turns to face
 * the way he walks. */
function walk(b: BalloonState, input: SkierInput): void {
  const sx = clamp(input.steer, -1, 1);
  const sz = clamp(-input.lean, -1, 1);
  const n = hypot(sx, sz);
  if (n < 0.1) return;
  const k = (B.walk.speed * dt) / Math.max(1, n);
  b.walkX = clamp(b.walkX + sx * k, -walkMostX(), walkMostX());
  b.walkZ = clamp(b.walkZ + sz * k, -walkMostZ(), walkMostZ());
  let off = Math.atan2(sx, sz) - b.face;
  off = Math.atan2(Math.sin(off), Math.cos(off));
  b.face += off * Math.min(1, 6 * dt);
}

/** How far off the floor's middle his boots may go, m, across and along. */
export function walkMostX(): number {
  return B.basket.width / 2 - B.walk.wall;
}
export function walkMostZ(): number {
  return B.basket.length / 2 - B.walk.wall;
}

/** Where his boots stand in the world: the floor's point under them. */
export function standingPoint(b: BalloonState): { x: number; y: number; z: number } {
  const q = fromEuler(b.heading, b.pitch, b.roll);
  const o = rotate(q, { x: b.walkX, y: 0, z: b.walkZ });
  return { x: b.x + o.x, y: b.y + o.y, z: b.z + o.z };
}

/** THE SKIER IN THE BASKET: stood where he has walked to, upright, moving
 * with it — off the snow, which is not under his skis. */
function hold(run: GameState, b: BalloonState): void {
  const c = run.skier;
  const at = standingPoint(b);
  const y = at.y + c.spec.cogHeight;
  const first = b.t <= dt;
  c.vx = first ? b.vx : (at.x - c.x) / dt;
  c.vy = first ? b.vy : (y - c.y) / dt;
  c.vz = first ? b.vz : (at.z - c.z) / dt;
  c.x = at.x;
  c.y = y;
  c.z = at.z;
  c.q = fromEuler(b.heading + b.face, 0, 0);
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

/** OVER THE SIDE: he climbs onto the rim on the side he stands nearest (the
 * way he faces, stood in the middle) and jumps, with the balloon's way and
 * his push; the balloon, his weight gone, flies on alone. */
function jump(run: GameState, b: BalloonState, events: GameEvent[]): void {
  const c = run.skier;
  const off = hypot(b.walkX, b.walkZ);
  const local =
    off > 0.1
      ? { x: b.walkX / off, z: b.walkZ / off }
      : { x: Math.sin(b.face), z: Math.cos(b.face) };
  const out = b.heading + Math.atan2(local.x, local.z);
  const ox = Math.sin(out);
  const oz = Math.cos(out);
  const rim = Math.max(B.basket.width, B.basket.length) / 2 + 0.3;
  standSkier(run, b.x + ox * rim, b.z + oz * rim, out);
  c.x = b.x + ox * rim;
  c.z = b.z + oz * rim;
  c.y = b.y + B.basket.wall + c.spec.cogHeight;
  c.q = fromEuler(out, 0, 0);
  c.vx = b.vx + ox * B.jump.out;
  c.vy = b.vy + B.jump.up;
  c.vz = b.vz + oz * B.jump.out;
  c.airborne = !b.grounded || b.y - run.level.groundAt(c.x, c.z) > 0.2;
  derive(c, run.level);
  b.aboard = false;
  b.mode = b.grounded ? "down" : "adrift";
  b.t = 0;
  say(run, events, "jump", hypot3(b.vx, b.vy, b.vz));
}

/** OUT ONTO THE SNOW: the basket stood still, he steps over the side on
 * the side he stands nearest, and the envelope is let down. */
function stepOut(run: GameState, b: BalloonState, events: GameEvent[]): void {
  const off = hypot(b.walkX, b.walkZ);
  const local = off > 0.1 ? { x: b.walkX / off, z: b.walkZ / off } : { x: 1, z: 0 };
  const out = b.heading + Math.atan2(local.x, local.z);
  const rim = Math.max(B.basket.width, B.basket.length) / 2 + 0.8;
  standSkier(run, b.x + Math.sin(out) * rim, b.z + Math.cos(out) * rim, b.heading);
  b.aboard = false;
  b.mode = "down";
  b.t = 0;
  b.vent = 1;
  b.vx = b.vy = b.vz = 0;
  say(run, events, "step", 0);
}

/** THE CRASH: the basket into the snow or a crown too fast — it goes over,
 * and the skier in it is thrown out with its way. Empty, it lies there. */
function crash(run: GameState, b: BalloonState, events: GameEvent[], speed: number): void {
  const v = { x: b.vx, y: b.vy, z: b.vz };
  b.y = Math.max(b.y, run.level.groundAt(b.x, b.z));
  say(run, events, "crash", speed);
  b.mode = "down";
  b.t = 0;
  b.grounded = true;
  b.dragging = false;
  b.valve = false;
  b.flame = 0;
  b.agl = 0;
  if (b.aboard) {
    hold(run, b);
    const c = run.skier;
    c.vx = v.x;
    c.vy = v.y;
    c.vz = v.z;
    b.aboard = false;
    b.wreck = true;
    throwRider(run, "balloon", v, events);
  }
  b.vx = b.vy = b.vz = 0;
}
