// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE — a free ride begun in the door of a skydiving plane on
// its strip below the town (`CreateGameOptions.plane`, `airstrip.ts`). The
// skier stands crouched in the open sliding door on the right, on his skis,
// and the PLAYER FLIES IT — by hand, every control his and nothing between
// him and the surfaces: the throttle, the stick, the rudder, the flaps, and
// on the snow the brakes. He takes it off the strip, climbs it, throws it
// about the sky as the physics lets him — loops, rolls, a stall and the
// spin it drops into — and THE MACHINE PRESS (`SkierInput.machine`) puts
// him OUT OF THE DOOR into the air with the plane's own way and a push; its
// pilot then flies it home and lands it on the strip. On the snow, stopped,
// the same press steps him off. Flown into the snow, a crown or a slope, it
// CRASHES: it burns where it came down, the skier in its door is thrown,
// and the ride starts again on the strip once it has burnt.
//
// THE FLIGHT is a rigid body in six degrees of freedom at the engine's
// 120 Hz: the air and the propeller off `plane-aero.ts` (four wing
// sections, the tail and the fin, each meeting the air its own way, the
// body's drag, the propeller's thrust, torque and swirl), gravity, and the
// gear: two main skis and the tail ski, each a spring and a damper on the
// snow under it with the snow's friction along the ski and a ski's grip
// across it, the tail ski steered with the rudder and the brakes the skid
// key's. Integrated semi-implicitly — the forces, the velocity and the
// body's rates (with their gyroscopic coupling), then the place and the
// attitude — about the CoG; the state keeps the ground datum.
//
// Pure over the level, the state and the clock: nothing here draws from the
// stream, and a run that never asked for a plane never comes in here.

import { angleDiff, clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  fromEuler,
  integrate,
  rotate,
  toEuler,
  unrotate,
  type Quat,
  type Vec3,
} from "@niclaslindstedt/oss-game-framework/core/quat";
import { airDensity, airKelvin, airPressure, seaAltitude } from "./balloon-air.ts";
import { mendBody } from "./body.ts";
import { airBoundsAt, treesNear, type AirBounds } from "./collision.ts";
import { standSkier } from "./course.ts";
import { mayGetUp, throwRider } from "./crash.ts";
import { PLANE, planeMass } from "./defs/plane.ts";
import { totalMass } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import { airstripOf, onStrip } from "./airstrip.ts";
import { COG, planeAir, type PlaneAir } from "./plane-aero.ts";
import { boundsHand, homeControls } from "./plane-pilot.ts";
import { derive } from "./skier.ts";
import { profileAt, windAt, type Wind } from "./wind.ts";
import type { GameEvent, GameState, SkierInput } from "./state.ts";
import type { PlaneControls, PlanePhaseEvent, PlaneState } from "./plane-state.ts";

const K = PLANE;
const G = PLANE.ground;
const C = PLANE.controls;
const dt = TUNING.dt;
/** The three-point attitude on level snow, rad (the tail ski down). */
export const THREE_POINT = Math.atan2(K.gear.tail.y, -K.gear.tail.z);
/** The wing's share stalled past which it has let go of its air (the
 * `stall` event): the inner, flapped sections stall first. */
const STALLED = 0.35;
/** The controls let go: idle, the stick and pedals centred, flaps up. */
const IDLE: PlaneControls = { throttle: 0, pitch: 0, roll: 0, yaw: 0, flaps: 0, brake: 0 };
/** The gear's legs from the CoG, body frame: left main, right main, tail. */
const LEGS: readonly Vec3[] = [
  { x: -K.gear.track / 2, y: -COG.y, z: -COG.z },
  { x: K.gear.track / 2, y: -COG.y, z: -COG.z },
  { x: 0, y: K.gear.tail.y - COG.y, z: K.gear.tail.z - COG.z },
];
/** The propeller's disc rim, sampled, from the CoG. */
const PROP_RIM: readonly Vec3[] = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * 2 * Math.PI;
  const r = K.prop.diameter / 2;
  return { x: Math.sin(a) * r, y: K.prop.hub.y + Math.cos(a) * r - COG.y, z: K.prop.hub.z - COG.z };
});
/** The airframe's points the trees are asked about, from the CoG. */
const TREE_POINTS: readonly Vec3[] = [
  ...[-7.9, -5.5, -3.2, 3.2, 5.5, 7.9].map((x) => ({
    x,
    y: K.wing.root.y + Math.abs(x) * Math.tan(K.wing.dihedral) - COG.y,
    z: K.wing.root.le - K.wing.chord / 2 - COG.z,
  })),
  { x: 0, y: 1.9 - COG.y, z: 3.3 - COG.z },
  { x: 0, y: 1.8 - COG.y, z: 0 - COG.z },
  { x: 0, y: 1.9 - COG.y, z: -4 - COG.z },
  { x: 0, y: 4.5 - COG.y, z: -7.1 - COG.z },
];
const STRIKES: readonly Vec3[] = K.crash.strike.map((p) => ({
  x: p.x,
  y: p.y - COG.y,
  z: p.z - COG.z,
}));

/** The plane's attitude off its quaternion (the drawing's and the HUD's). */
function readAngles(p: PlaneState): void {
  const e = toEuler(p.q);
  p.heading = e.heading;
  p.pitch = e.pitch;
  p.roll = e.roll;
}

/** A point of the plane, body frame from the ground datum, in the world. */
export function planePoint(p: PlaneState, b: Vec3): Vec3 {
  const w = rotate(p.q, b);
  return { x: p.x + w.x, y: p.y + w.y, z: p.z + w.z };
}

/** A plane parked on the strip at its start, sat back on its tail ski,
 * the propeller still, the door slid open. */
export function freshPlane(state: GameState): PlaneState {
  const strip = airstripOf(state.level);
  const at = strip.start;
  const p: PlaneState = {
    mode: "parked",
    x: at.x,
    y: at.y,
    z: at.z,
    vx: 0,
    vy: 0,
    vz: 0,
    q: { x: 0, y: 0, z: 0, w: 1 },
    heading: strip.heading,
    pitch: 0,
    roll: 0,
    wx: 0,
    wy: 0,
    wz: 0,
    controls: { ...IDLE, brake: 1 },
    surfaces: { aileron: 0, elevator: 0, rudder: 0, flaps: 0 },
    trim: 0,
    power: 0,
    thrust: 0,
    prop: 0,
    spin: 0,
    airspeed: 0,
    aoa: 0,
    slip: 0,
    load: 1,
    cl: 0,
    stalled: 0,
    density: 1.2,
    grounded: true,
    legs: [0, 0, 0],
    agl: 0,
    bounds: 0,
    rider: false,
    door: 1,
    t: 0,
    wreck: null,
  };
  restOn(state, p, at.x, at.z, strip.heading);
  return p;
}

/** Sat on the snow at (x, z) facing `heading`: the main skis down where
 * the snow is, the tail ski on it, the plane at the snow's own lean. */
function restOn(state: GameState, p: PlaneState, x: number, z: number, heading: number): void {
  const level = state.level;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const back = -K.gear.tail.z;
  const W = K.gear.track / 2;
  const main = level.groundAt(x, z);
  const tail = level.groundAt(x - fx * back, z - fz * back);
  const slope = Math.atan2(main - tail, back);
  const roll = Math.atan2(
    level.groundAt(x - fz * W, z + fx * W) - level.groundAt(x + fz * W, z - fx * W),
    2 * W,
  );
  p.x = x;
  p.z = z;
  p.y = main;
  p.q = fromEuler(heading, THREE_POINT + slope, roll);
  readAngles(p);
  p.vx = p.vy = p.vz = 0;
  p.wx = p.wy = p.wz = 0;
  p.grounded = true;
  p.agl = 0;
}

const say = (run: GameState, events: GameEvent[], phase: PlanePhaseEvent, speed = 0): void => {
  const p = run.plane!;
  events.push({ kind: "plane", t: run.t, phase, x: p.x, y: p.y, z: p.z, speed });
};

/** BEGIN THE RIDE (again): a plane on the strip's start, the engine running
 * at idle, the door open, the skier crouched in it and mended. */
export function startPlane(state: GameState, events: GameEvent[]): void {
  const p = freshPlane(state);
  state.plane = p;
  p.mode = "flown";
  p.rider = true;
  p.spin = 1;
  p.power = K.engine.idle;
  p.controls = { ...IDLE };
  const c = state.skier;
  const door = doorFrame(p);
  standSkier(state, door.x, door.z, p.heading);
  c.thrown = null;
  c.lift = null;
  c.tunnel = null;
  mendBody(c.body);
  hold(state, p);
  say(state, events, "restart");
}

/** THE PLANE PUT IN THE AIR (a lab's, a test's, a link's moment): at
 * (x, y, z) — its ground datum — on `heading`, wings level at `pitch`, rad,
 * flying `speed`, m/s, along its nose, the engine at `power`, the flaps
 * up; the skier still in its door if he was. */
export function planeAloft(
  state: GameState,
  at: {
    x: number;
    y: number;
    z: number;
    heading: number;
    speed: number;
    pitch?: number;
    power?: number;
  },
): void {
  const p = state.plane;
  if (!p) return;
  const pitch = at.pitch ?? 0;
  p.mode = p.rider ? "flown" : "home";
  p.t = 0;
  p.x = at.x;
  p.y = at.y;
  p.z = at.z;
  p.q = fromEuler(at.heading, pitch, 0);
  readAngles(p);
  const f = rotate(p.q, { x: 0, y: 0, z: 1 });
  p.vx = f.x * at.speed;
  p.vy = f.y * at.speed;
  p.vz = f.z * at.speed;
  p.wx = p.wy = p.wz = 0;
  p.spin = 1;
  p.airspeed = at.speed;
  p.power = at.power ?? 0.7;
  p.surfaces = { aileron: 0, elevator: 0, rudder: 0, flaps: 0 };
  p.grounded = false;
  p.legs = [0, 0, 0];
  p.agl = p.y - state.level.groundAt(p.x, p.z);
  p.wreck = null;
  if (p.rider) hold(state, p);
}

/** Whether the skier is in the plane's door. */
export function planeAboard(state: GameState): boolean {
  return !!state.plane?.rider;
}

/** WHETHER THE SKIER IS LYING WHERE A CRASHED PLANE THREW HIM: the wreck he
 * rode down still burning — he is stood up in a fresh plane on the strip
 * once it has burnt (`stepPlane`). */
export function planeDown(state: GameState): boolean {
  const p = state.plane;
  return !!p && p.mode === "wreck" && !!p.wreck?.aboard;
}

/** ONE STEP OF THE PLANE, before the skier is stepped: flown, flying home,
 * parked or burning — and the skier in its door held there, taken aboard,
 * or let go. True while he is in its door: the step is the plane's. */
export function stepPlane(run: GameState, input: SkierInput, events: GameEvent[]): boolean {
  const p = run.plane;
  if (!p) return false;
  p.t += dt;
  if (p.mode === "wreck") {
    const up = !!p.wreck?.aboard && input.reset && !!run.skier.thrown && mayGetUp(run.skier.thrown);
    if (p.t < K.crash.wreck && !up) return false;
    if (p.wreck?.aboard) startPlane(run, events);
    else {
      Object.assign(p, freshPlane(run));
      say(run, events, "restart");
    }
    return p.rider;
  }
  if (p.rider && input.reset) {
    startPlane(run, events);
    return true;
  }
  const boarded = !!input.machine && planeWithin(run);
  if (boarded) board(run, events);
  const running = p.rider || p.mode === "home";
  p.spin = clamp(p.spin + (running ? 0.5 : -0.25) * dt, 0, 1);
  p.controls = controlsFor(run, p, input);
  if (p.mode !== "parked") fly(run, p, events);
  else p.power += (0 - p.power) * (1 - Math.exp(-dt / K.engine.spool));
  p.prop = (p.prop + (K.prop.rpm / 60) * 2 * Math.PI * p.spin * dt) % (2 * Math.PI);
  if (!p.rider) return false;
  if (input.machine && !boarded && p.mode === "flown") {
    // Out of the door in the air; on the snow (or a hop off it), only
    // stopped, onto it.
    if (!p.grounded && p.agl > 1.5) {
      jump(run, p, events);
      return false;
    }
    if (hypot3(p.vx, p.vy, p.vz) <= K.board.fastest) {
      stepOff(run, p, events);
      return false;
    }
  }
  hold(run, p);
  return true;
}

const bounds: AirBounds = { depth: 0, wx: 0, wz: 0, heading: 0 };

/** THE CONTROLS THIS STEP: the player's, flying it; the pilot's flying it
 * home after a beat; on the strip, idle with the brakes on — and in the air
 * near the map's edge, turned back toward its middle (`airBounds`). */
function controlsFor(run: GameState, p: PlaneState, input: SkierInput): PlaneControls {
  let c: PlaneControls;
  if (p.mode === "flown") {
    const s = input.plane ?? { ...IDLE, flaps: p.controls.flaps };
    c = {
      throttle: clamp(s.throttle, 0, 1),
      pitch: clamp(s.pitch, -1, 1),
      roll: clamp(s.roll, -1, 1),
      yaw: clamp(s.yaw, -1, 1),
      flaps: clamp(s.flaps, 0, 1),
      brake: clamp(s.brake ?? 0, 0, 1),
      ...(s.trim !== undefined ? { trim: clamp(s.trim, -1, 1) } : {}),
    };
  } else if (p.mode === "home") {
    c = p.t < K.home.beat ? { ...p.controls } : homeControls(run, p);
  } else c = { ...IDLE, brake: 1 };
  airBoundsAt(run.level, p.x, p.z, p.agl, TUNING.bounds.air.plane, bounds);
  p.bounds = bounds.depth;
  if (p.bounds > 0 && !p.grounded && p.mode === "flown") {
    // Only flown on toward the edge: along it or back in, it is let be.
    const out = Math.cos(angleDiff(p.heading, bounds.heading + Math.PI));
    const w = clamp(p.bounds * 6, 0, 1) * clamp(out + 1, 0, 1);
    const hand = boundsHand(p, bounds.heading);
    c.roll += (hand.roll - c.roll) * w;
    c.yaw += (hand.yaw - c.yaw) * w;
    c.pitch += (hand.pitch - c.pitch) * w;
    c.throttle = Math.max(c.throttle, hand.throttle * w);
  }
  return c;
}

const wind: Wind = { x: 0, z: 0, speed: 0, gust: 0 };
const air: PlaneAir = {
  fx: 0,
  fy: 0,
  fz: 0,
  tx: 0,
  ty: 0,
  tz: 0,
  cl: 0,
  stalled: 0,
  lift: 0,
  thrust: 0,
};
const normal = { x: 0, y: 1, z: 0 };

/** The surfaces after their controls, at their rates. */
function moveSurfaces(p: PlaneState): void {
  const c = p.controls;
  const s = p.surfaces;
  const toward = (now: number, want: number, rate: number): number =>
    now + clamp(want - now, -rate * dt, rate * dt);
  s.aileron = toward(s.aileron, c.roll * C.aileron, C.rate * C.aileron);
  if (c.trim !== undefined) p.trim = clamp(c.trim, -1, 1);
  const stick = clamp(c.pitch + p.trim, -1, 1);
  const e = stick > 0 ? stick * C.elevatorDown : stick * C.elevatorUp;
  s.elevator = toward(s.elevator, e, C.rate * C.elevatorUp);
  s.rudder = toward(s.rudder, c.yaw * C.rudder, C.rate * C.rudder);
  s.flaps = toward(s.flaps, c.flaps, 1 / C.flapRun);
}

/** ONE STEP OF FLIGHT: the engine, the surfaces, the air, the gear, and
 * the body moved — then the crash asked. */
function fly(run: GameState, p: PlaneState, events: GameEvent[]): void {
  const level = run.level;
  const rider = p.rider ? totalMass(run.skier.spec) : 0;
  const m = planeMass(rider);
  const g = TUNING.g;
  // THE ENGINE: the power after the lever, a turbine's spool.
  const want = K.engine.idle + (1 - K.engine.idle) * p.controls.throttle;
  p.power += (want * p.spin - p.power) * (1 - Math.exp(-dt / K.engine.spool));
  moveSurfaces(p);
  // THE CoG and the air it flies through.
  const cogW = rotate(p.q, COG);
  const cx = p.x + cogW.x;
  const cy = p.y + cogW.y;
  const cz = p.z + cogW.z;
  const ground = level.groundAt(cx, cz);
  windAt(level, run.t, wind);
  const lift = profileAt(clamp(cy - ground, 1, 300));
  const awx = wind.x * lift + bounds.wx;
  const awz = wind.z * lift + bounds.wz;
  const alt = seaAltitude(level, cy);
  p.density = airDensity(airPressure(alt), airKelvin(alt));
  const u = unrotate(p.q, { x: p.vx - awx, y: p.vy, z: p.vz - awz });
  planeAir(p, u.x, u.y, u.z, p.density, p.grounded, air);
  const fw = rotate(p.q, { x: air.fx, y: air.fy, z: air.fz });
  let Fx = fw.x;
  let Fy = fw.y - m * g;
  let Fz = fw.z;
  let tx = air.tx;
  let ty = air.ty;
  let tz = air.tz;
  // THE GEAR on the snow.
  const omega = rotate(p.q, { x: p.wx, y: p.wy, z: p.wz });
  let hardest = 0;
  let side = 0;
  let onSnow = false;
  for (let i = 0; i < 3; i++) {
    const r = rotate(p.q, LEGS[i]);
    const px = cx + r.x;
    const py = cy + r.y;
    const pz = cz + r.z;
    const pen = level.groundAt(px, pz) - py;
    if (pen <= 0) {
      p.legs[i] = 0;
      continue;
    }
    level.normalAt(px, pz, normal);
    const depth = pen * normal.y;
    const vx = p.vx + (omega.y * r.z - omega.z * r.y);
    const vy = p.vy + (omega.z * r.x - omega.x * r.z);
    const vz = p.vz + (omega.x * r.y - omega.y * r.x);
    const vn = vx * normal.x + vy * normal.y + vz * normal.z;
    if (p.legs[i] === 0 && !p.grounded) hardest = Math.max(hardest, -vn);
    onSnow = true;
    const main = i < 2;
    const Fn = Math.max(
      0,
      (main ? G.spring.main : G.spring.tail) * depth -
        (main ? G.damping.main : G.damping.tail) * vn,
    );
    // The ski's run along the snow — the tail ski's steered by the rudder.
    const steer = main ? 0 : -(p.surfaces.rudder / C.rudder) * C.tailSteer;
    const d = rotate(p.q, { x: Math.sin(steer), y: 0, z: Math.cos(steer) });
    const dn = d.x * normal.x + d.y * normal.y + d.z * normal.z;
    let ax = d.x - dn * normal.x;
    let ay = d.y - dn * normal.y;
    let az = d.z - dn * normal.z;
    const al = hypot3(ax, ay, az) || 1;
    ax /= al;
    ay /= al;
    az /= al;
    const lx = normal.y * az - normal.z * ay;
    const ly = normal.z * ax - normal.x * az;
    const lz = normal.x * ay - normal.y * ax;
    const tvx = vx - vn * normal.x;
    const tvy = vy - vn * normal.y;
    const tvz = vz - vn * normal.z;
    const vf = tvx * ax + tvy * ay + tvz * az;
    const vl = tvx * lx + tvy * ly + tvz * lz;
    const mu =
      (onStrip(level, px, pz) ? G.packed : G.soft) + G.brake * clamp(p.controls.brake ?? 0, 0, 1);
    const Ff = (-mu * Fn * vf) / (Math.abs(vf) + G.ease);
    const Fl = (-G.across * Fn * vl) / (Math.abs(vl) + G.ease);
    const fx = Fn * normal.x + Ff * ax + Fl * lx;
    const fy = Fn * normal.y + Ff * ay + Fl * ly;
    const fz = Fn * normal.z + Ff * az + Fl * lz;
    Fx += fx;
    Fy += fy;
    Fz += fz;
    const tw = unrotate(p.q, {
      x: r.y * fz - r.z * fy,
      y: r.z * fx - r.x * fz,
      z: r.x * fy - r.y * fx,
    });
    tx += tw.x;
    ty += tw.y;
    tz += tw.z;
    p.legs[i] = Math.max(1e-6, depth);
    if (main) side = Math.max(side, Math.abs(vl));
  }
  // THE BODY MOVED: the CoG's velocity and the rates, then the place and
  // the attitude.
  p.vx += (Fx / m) * dt;
  p.vy += (Fy / m) * dt;
  p.vz += (Fz / m) * dt;
  const Ix = K.inertia.pitch;
  const Iy = K.inertia.yaw;
  const Iz = K.inertia.roll;
  const gx = p.wy * Iz * p.wz - p.wz * Iy * p.wy;
  const gy = p.wz * Ix * p.wx - p.wx * Iz * p.wz;
  const gz = p.wx * Iy * p.wy - p.wy * Ix * p.wx;
  p.wx += ((tx - gx) / Ix) * dt;
  p.wy += ((ty - gy) / Iy) * dt;
  p.wz += ((tz - gz) / Iz) * dt;
  const ncx = cx + p.vx * dt;
  const ncy = cy + p.vy * dt;
  const ncz = cz + p.vz * dt;
  p.q = integrate(p.q, p.wx, p.wy, p.wz, dt);
  const back = rotate(p.q, COG);
  p.x = ncx - back.x;
  p.y = ncy - back.y;
  p.z = ncz - back.z;
  readAngles(p);
  const aglWas = p.agl;
  p.agl = p.y - level.groundAt(p.x, p.z);
  p.airspeed = hypot3(u.x, u.y, u.z);
  p.aoa = Math.atan2(-u.y, Math.max(0.1, u.z));
  p.slip = Math.atan2(u.x, Math.max(0.1, Math.abs(u.z)));
  p.load = air.lift / (m * g);
  p.cl = air.cl;
  p.thrust = air.thrust;
  if (air.stalled > STALLED && p.stalled <= STALLED && !onSnow)
    say(run, events, "stall", p.airspeed);
  p.stalled = air.stalled;
  const was = p.grounded;
  p.grounded = onSnow;
  // A touch the gear feels (not the skis' chatter on a rough strip).
  if (onSnow && !was && hardest > 1) say(run, events, "land", hardest);
  // Off the snow for good: a metre up and climbing (a hop off a bump is not).
  if (!onSnow && aglWas <= 1 && p.agl > 1 && p.vy > 0) say(run, events, "liftoff", p.airspeed);
  if (p.mode !== "flown" && p.mode !== "home") return;
  if (run.rules.sfw) return fend(run, p);
  const fell =
    hardest > K.crash.sink || side > K.crash.slide || p.legs.some((l) => l > K.crash.travel);
  if (fell || struck(run, p)) {
    crash(run, p, events, Math.max(hardest, hypot3(p.vx, p.vy, p.vz)));
    return;
  }
  if (p.mode === "home" && onSnow && hypot3(p.vx, p.vy, p.vz) < 0.8 && p.t > K.home.beat + 5) {
    park(run, p, events);
  }
}

const trunks: number[] = [];

/** Whether the airframe has met the mountain: a point of it in the snow,
 * the propeller's disc in it, or a wing or the fuselage in a crown. */
function struck(run: GameState, p: PlaneState): boolean {
  const level = run.level;
  const cog = rotate(p.q, COG);
  const cx = p.x + cog.x;
  const cy = p.y + cog.y;
  const cz = p.z + cog.z;
  const inSnow = (b: Vec3, give: number): boolean => {
    const r = rotate(p.q, b);
    return cy + r.y < level.groundAt(cx + r.x, cz + r.z) - give;
  };
  for (const s of STRIKES) if (inSnow(s, 0.05)) return true;
  for (const s of PROP_RIM) if (inSnow(s, 0.02)) return true;
  if (p.agl > 60) return false;
  for (const i of treesNear(level, cx, cz, 14, trunks)) {
    const t = level.trees[i];
    const top = t.y + t.height;
    for (const b of TREE_POINTS) {
      const r = rotate(p.q, b);
      const y = cy + r.y;
      if (y > top) continue;
      const d = hypot(cx + r.x - t.x, cz + r.z - t.z);
      const spread = t.crown * Math.min(1, (top - y) / Math.max(1, t.height * 0.8));
      if (d < spread * 0.7 || d < t.radius + 0.3) return true;
    }
  }
  return false;
}

/** SAFE FOR WORK (`RunRules.sfw`): nothing is struck; an airframe pushed
 * into the snow is lifted out of it and its speed into it taken away. */
function fend(run: GameState, p: PlaneState): void {
  const level = run.level;
  let under = 0;
  for (const s of [...STRIKES, ...PROP_RIM]) {
    const w = rotate(p.q, { x: s.x + COG.x, y: s.y + COG.y, z: s.z + COG.z });
    under = Math.max(under, level.groundAt(p.x + w.x, p.z + w.z) - (p.y + w.y));
  }
  if (under > 0) {
    p.y += under;
    p.vy = Math.max(0, p.vy);
  }
}

/** THE CRASH: the plane burns where it came down, and the skier in its
 * door is thrown — flung out by the impact. */
function crash(run: GameState, p: PlaneState, events: GameEvent[], speed: number): void {
  p.mode = "wreck";
  p.t = 0;
  p.wreck = { x: p.x, y: p.y, z: p.z, speed, aboard: p.rider };
  say(run, events, "crash", speed);
  if (p.rider) {
    release(run, p, K.crash.blast.out, K.crash.blast.up);
    const c = run.skier;
    c.vy = Math.max(0, p.vy) + K.crash.blast.up;
    throwRider(run, "plane", { x: c.vx, y: c.vy, z: c.vz }, events);
  }
  // Down onto the snow, at rest where it came down.
  const level = run.level;
  p.y = Math.min(p.y, level.groundAt(p.x, p.z));
  p.vx = p.vy = p.vz = 0;
  p.wx = p.wy = p.wz = 0;
  p.grounded = true;
  p.power = 0;
  p.thrust = 0;
  p.spin = 0;
  p.controls = { ...IDLE };
}

/** Set down home on the strip and stopped: the pilot shuts down. */
function park(run: GameState, p: PlaneState, events: GameEvent[]): void {
  p.mode = "parked";
  p.t = 0;
  p.vx = p.vy = p.vz = 0;
  p.wx = p.wy = p.wz = 0;
  say(run, events, "home");
}

/** WHERE THE SKIER STANDS in the door, in the world, and the plane's
 * orientation he stands in. */
function doorFrame(p: PlaneState): { x: number; y: number; z: number; q: Quat } {
  const J = K.jumper;
  const up = rotate(p.q, { x: 0, y: 1, z: 0 });
  const floor = planePoint(p, { x: J.x, y: J.y, z: J.z });
  return {
    x: floor.x + up.x * J.height,
    y: floor.y + up.y * J.height,
    z: floor.z + up.z * J.height,
    q: p.q,
  };
}

/** THE SKIER IN THE DOOR: where it has him, crouched on his skis on the
 * sill facing forward, moving with it — off the snow, which is not under
 * his skis. */
function hold(run: GameState, p: PlaneState): void {
  const c = run.skier;
  const s = doorFrame(p);
  const first = p.t <= dt;
  c.vx = first ? p.vx : (s.x - c.x) / dt;
  c.vy = first ? p.vy : (s.y - c.y) / dt;
  c.vz = first ? p.vz : (s.z - c.z) / dt;
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

/** Out of the door with the plane's own way at the door (its CoG's and its
 * turn's) and a push `out` of the door and `up`, m/s, facing the way it
 * flies. */
function release(run: GameState, p: PlaneState, out: number, up: number): void {
  const c = run.skier;
  const s = doorFrame(p);
  const omega = rotate(p.q, { x: p.wx, y: p.wy, z: p.wz });
  const cog = rotate(p.q, COG);
  const r = { x: s.x - (p.x + cog.x), y: s.y - (p.y + cog.y), z: s.z - (p.z + cog.z) };
  const side = rotate(p.q, { x: 1, y: 0, z: 0 });
  const lift = rotate(p.q, { x: 0, y: 1, z: 0 });
  const flat = hypot(p.vx, p.vz);
  const heading = flat > 4 ? Math.atan2(p.vx, p.vz) : p.heading;
  standSkier(run, s.x, s.z, heading);
  c.x = s.x;
  c.y = s.y;
  c.z = s.z;
  c.q = fromEuler(heading, 0, 0);
  c.vx = p.vx + (omega.y * r.z - omega.z * r.y) + side.x * out + lift.x * up;
  c.vy = p.vy + (omega.z * r.x - omega.x * r.z) + side.y * out + lift.y * up;
  c.vz = p.vz + (omega.x * r.y - omega.y * r.x) + side.z * out + lift.z * up;
  c.airborne = true;
  derive(c, run.level);
  p.rider = false;
}

/** THE JUMP: out of the door into the air. The plane, a skier lighter, is
 * flown home and landed by its pilot. The skydive takes him from here. */
function jump(run: GameState, p: PlaneState, events: GameEvent[]): void {
  release(run, p, K.jump.out, K.jump.up);
  say(run, events, "jump", p.airspeed);
  p.mode = "home";
  p.t = 0;
}

/** Stopped on the snow, he steps out of the door onto it beside the
 * plane, which the pilot shuts down where it stands. */
function stepOff(run: GameState, p: PlaneState, events: GameEvent[]): void {
  const s = doorFrame(p);
  const side = rotate(p.q, { x: 1, y: 0, z: 0 });
  const out = 1.6;
  p.rider = false;
  standSkier(run, s.x + side.x * out, s.z + side.z * out, p.heading);
  say(run, events, "stepoff");
  p.mode = "parked";
  p.t = 0;
  p.vx = p.vy = p.vz = 0;
  p.wx = p.wy = p.wz = 0;
}

/** WHETHER THE MACHINE PRESS TAKES HIM ABOARD: a skier on his skis, off
 * every lift, tunnel and other machine, within `PLANE.board.reach` of the
 * parked plane's door and slower than `PLANE.board.fastest`. */
export function planeWithin(run: GameState): boolean {
  const p = run.plane;
  const c = run.skier;
  if (!p || p.rider || p.mode !== "parked") return false;
  if (c.thrown || c.lift || c.tunnel || run.sled?.rider || run.heli?.rider) return false;
  if (run.para && run.para.mode !== "dropped") return false;
  if (run.balloon?.aboard) return false;
  const door = doorFrame(p);
  return hypot(c.x - door.x, c.z - door.z) <= K.board.reach && c.speed <= K.board.fastest;
}

/** Taken aboard: in the door, the engine started, the controls his. */
function board(run: GameState, events: GameEvent[]): void {
  const p = run.plane!;
  p.rider = true;
  p.mode = "flown";
  p.t = 0;
  p.door = 1;
  p.controls = { ...IDLE };
  say(run, events, "board");
}
