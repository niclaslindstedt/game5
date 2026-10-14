// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE AS BODIES (`docs/downhill-bike.md`): a rigid FRAME, the
// BARS and fork turning on the steer axis, two massless WHEELS on their
// suspension, and the RIDER — four-fifths of the mass — a second body on his
// legs and arms. Stepped in `BIKE.substeps` substeps a game step:
//
//   * each wheel finds the ground under it as a plane read once a step (the
//     map's `groundAt` and `normalAt` are the dear part), and the disc's
//     lowest point against it sets the compression; the spring (rising-rate,
//     a bump stop at its end, the tyre and the rim past it) and the damper
//     (rebound and compression, digressive) give the load, carried onto the
//     ground's normal;
//   * the tyre (`bike-tyre.ts`) gives the patch's force along the wheel and
//     across it inside one grip budget, the side force a little behind the
//     patch (the pneumatic trail);
//   * the front's force about the steer axis — its trail — turns the bars,
//     with the spinning wheel's gyroscope, against the rider's hands;
//   * the rider's legs and arms push the frame where he stands on it: his
//     weight shared between the axles by where he stands, his lean back the
//     endo held off, his crouch and its release the pop, his landings
//     absorbed up to what his legs give;
//   * the air drags on him; in the air his body English pitches and yaws
//     the bike, the brakes stop a spinning wheel and pitch it, and the
//     spinning wheels hold it.
//
// Pure over its inputs: the world it rides on is an interface
// (`BikeWorld`), so the labs ride it on synthetic ground; nothing draws from
// any stream.

import { clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { integrate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { BIKE } from "./defs/bike.ts";
import {
  BB,
  REAR_AXLE,
  REAR_PATH,
  STEER_AT,
  STEER_AXIS,
  WHEELBASE,
  frontAxleAt,
  frontSpindle,
  springForce,
  springsFor,
  type EndSpring,
  type V3,
} from "./bike-geometry.ts";
import { tyreForce, type TyreAsk, type TyreForce } from "./bike-tyre.ts";
import {
  cross,
  derive,
  dot,
  m3,
  massCentre,
  matrixOf,
  rollOf,
  stanceOf,
  toBody,
  toWorld,
  v3,
} from "./bike-frame.ts";
import type { BikeControls, BikeState, BikeWheel } from "./bike-state.ts";

const G = 9.81;
const R = BIKE.rider;
const H = BIKE.hands;

/** THE GROUND A BIKE RIDES ON: the height and normal at a point, what the
 * ground there is to a tyre, the wind at 10 m, m/s, and the air's density,
 * kg/m³. A summer map answers it (`bike.ts`'s `worldOf`); a lab answers it
 * with a synthetic ground. */
export interface BikeWorld {
  groundAt(x: number, z: number): number;
  normalAt(x: number, z: number, out: { x: number; y: number; z: number }): void;
  surfaceAt(x: number, z: number): { grip: number; slide: number; roll: number };
  wind: { x: number; z: number };
  rho: number;
}

/** HOW THE BIKE IS RIDDEN beyond its controls: how much the assist's hands
 * help (`Assist`: `yaw` the balance at a crawl and the brakes' feel, `air`
 * the bike levelled in the air), whether the rider's hands are on the bars
 * at all (off, nobody balances it — the weave and capsize rows), and
 * whether he takes a landing stiff (a lab's row). */
export type BikeRide = {
  yaw: number;
  air: number;
  hands: boolean;
  stiff?: boolean;
};

/** What one step of the body reports to the game (`bike.ts`): the hardest
 * tyre loads, the landing it touched down on, the ground the bike stands
 * on under the rider's middle. */
export type BikeStepReport = {
  /** True on the step a flight ended. */
  touchdown: boolean;
  /** The speed into the ground at touchdown, m/s. */
  impact: number;
  /** Whether the front wheel met the ground first on it. */
  frontFirst: boolean;
};

// ---- scratch ---------------------------------------------------------

const nF = v3();
const nR = v3();
const pF = v3();
const pR = v3();
const ask: TyreAsk = {
  load: 0,
  along: 0,
  across: 0,
  camber: 0,
  grip: 0,
  slide: 0,
  roll: 0,
  brake: 0,
  drive: 0,
};
const gripF = { grip: 1, slide: 0.8, roll: 0.03 };
const gripR = { grip: 1, slide: 0.8, roll: 0.03 };
const force: TyreForce = { along: 0, across: 0 };
const tmp = v3();
const tmp2 = v3();
const axle = v3();
const spindle = v3();

// ---- the bike's own derived numbers ------------------------------------

// ---- one end ------------------------------------------------------------

type End = {
  w: BikeWheel;
  spring: EndSpring;
  radius: number;
  inertia: number;
  plane: V3;
  at: V3;
  grip: { grip: number; slide: number; roll: number };
};

/** Where under a wheel the ground is searched, × its radius, along its way. */
const LOOK = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
const heights = new Float64Array(LOOK.length + 2);
const tn = v3();

/** THE GROUND UNDER EACH WHEEL, read once a step: the ground is searched
 * along the wheel's way under the whole of it, and the point the disc
 * meets deepest kept as a plane — its height and the ground's slope there,
 * along the way off its neighbours (a ledge's lip or a rock's flank met by
 * the front of the tyre, not the ground straight under the axle) and across
 * it off the map's own normal. `A` is the axle where it stands, world. */
function readGround(world: BikeWorld, end: End, A: V3, fx: number, fz: number): void {
  const R = end.radius;
  const step = 0.25 * R;
  world.normalAt(A.x, A.z, tn);
  const ny = Math.max(tn.y, 0.2);
  // The map's gradient, its share along the way taken out.
  const gx = -tn.x / ny;
  const gz = -tn.z / ny;
  const along = gx * fx + gz * fz;
  const lx = gx - along * fx;
  const lz = gz - along * fz;
  for (let i = 0; i < heights.length; i++) {
    const d = (i - 1) * step - R;
    heights[i] = world.groundAt(A.x + fx * d, A.z + fz * d);
  }
  // The sample nearest the axle is where the disc meets the ground.
  let best = Infinity;
  let k = 0;
  for (let i = 0; i < LOOK.length; i++) {
    const gap = hypot(LOOK[i] * R, A.y - heights[i + 1]) - R;
    if (gap < best) {
      best = gap;
      k = i;
    }
  }
  const d = LOOK[k] * R;
  const h = heights[k + 1];
  end.at.x = A.x + fx * d;
  end.at.y = h;
  end.at.z = A.z + fz * d;
  // Its plane: the ground's own slope there where that plane agrees with
  // the point (smooth ground); else an EDGE — a ledge's lip, a rock's
  // shoulder — and the disc is pushed straight off it.
  const s = (heights[k + 2] - heights[k]) / (2 * step);
  const ex = lx + s * fx;
  const ez = lz + s * fz;
  const l = hypot3(ex, 1, ez);
  const nx = -ex / l;
  const nY = 1 / l;
  const nz = -ez / l;
  const planeGap = nx * (A.x - end.at.x) + nY * (A.y - h) + nz * (A.z - end.at.z) - R;
  if (Math.abs(planeGap - best) < 0.02) {
    end.plane.x = nx;
    end.plane.y = nY;
    end.plane.z = nz;
  } else {
    // Off the edge along the way, the ground's tilt across kept.
    const dist = best + R || 1;
    const af = -d / dist;
    const ay = (A.y - h) / dist;
    const ex2 = af * fx - ay * lx;
    const ez2 = af * fz - ay * lz;
    const l2 = hypot3(ex2, ay, ez2) || 1;
    end.plane.x = ex2 / l2;
    end.plane.y = ay / l2;
    end.plane.z = ez2 / l2;
  }
  const ground = world.surfaceAt(end.at.x, end.at.z);
  end.grip.grip = ground.grip;
  end.grip.slide = ground.slide;
  end.grip.roll = ground.roll;
}

// ---- the step -------------------------------------------------------------

/** ONE GAME STEP OF THE BIKE, `dt` s: the bodies stepped under `ctl` on
 * `world`, ridden `ride`. Writes the state; returns what the game judges. */
export function rideBike(
  b: BikeState,
  ctl: BikeControls,
  world: BikeWorld,
  ride: BikeRide,
  dt: number,
  report: BikeStepReport,
): BikeStepReport {
  const springs = springsFor(b.riderMass);
  const ends: [End, End] = [
    {
      w: b.front,
      spring: springs.front,
      radius: BIKE.front.radius,
      inertia: BIKE.front.inertia,
      plane: nF,
      at: pF,
      grip: gripF,
    },
    {
      w: b.rear,
      spring: springs.rear,
      radius: BIKE.rear.radius,
      inertia: BIKE.rear.inertia,
      plane: nR,
      at: pR,
      grip: gripR,
    },
  ];
  // The ground under each wheel, as the step begins, searched along the
  // bike's way from where each axle stands.
  matrixOf(b.q);
  const fl = hypot(m3[6], m3[8]) || 1;
  const fx = m3[6] / fl;
  const fz = m3[8] / fl;
  frontAxleAt(b.steer, b.front.comp, axle);
  toWorld(axle, tmp);
  tmp.x += b.x;
  tmp.y += b.y;
  tmp.z += b.z;
  readGround(world, ends[0], tmp, fx, fz);
  axle.x = REAR_AXLE.x + REAR_PATH.x * b.rear.comp;
  axle.y = REAR_AXLE.y + REAR_PATH.y * b.rear.comp;
  axle.z = REAR_AXLE.z + REAR_PATH.z * b.rear.comp;
  toWorld(axle, tmp);
  tmp.x += b.x;
  tmp.y += b.y;
  tmp.z += b.z;
  readGround(world, ends[1], tmp, fx, fz);

  const wasAir = b.airborne;
  report.touchdown = false;
  report.impact = 0;
  report.frontFirst = false;
  // THE POP: the legs folded while the crouch is held, sprung on its
  // release with the wheels on the ground.
  // His weight moved toward the lean asked.
  b.shift += clamp(ctl.lean - b.shift, -dt / R.shift, dt / R.shift);
  if (ctl.crouch > 0.5) b.loaded = Math.min(1, b.loaded + dt / 0.25);
  else if (b.loaded > 0 && b.pop === 0) {
    if (b.front.touching || b.rear.touching) b.pop = R.pop.time;
    else b.loaded = 0;
  }
  const aim = handsAim(b, ctl, ride, dt);
  const n = BIKE.substeps;
  const h = dt / n;
  for (let i = 0; i < n; i++) substep(b, ctl, ends, world, ride, aim, h, report);
  derive(b);
  // THE CRANKS: turned while the legs pedal, at the cadence of the gear
  // the speed asks (never under a low gear's 50 rpm); left where they
  // stand, freewheeling, on a coast — and there turned LEVEL, the lead
  // foot forward, the outside pedal let down into a hard lean
  // (`BIKE.coast`).
  const P = BIKE.pedal;
  if (ctl.pedal > 0.05 && b.way > 0) {
    b.cadence = clamp((b.way / P.rollout) * 60, 50, P.cadence);
    b.crank = (b.crank + (b.cadence / 60) * 2 * Math.PI * dt) % (2 * Math.PI);
  } else {
    b.cadence = 0;
    b.crank = coastCrank(b.crank, b.roll, dt);
  }
  const touching = b.front.touching || b.rear.touching;
  b.airborne = !touching;
  if (b.airborne) b.airTime += dt;
  if (wasAir && touching) report.touchdown = true;
  return report;
}

/** THE CRANKS ON A COAST, turned a step toward level (0, the left crank
 * forward) and, into a lean, the outside pedal down: a right lean (roll +)
 * lets the left pedal down (+π/2), a left lean the right (−π/2). */
export function coastCrank(crank: number, roll: number, dt: number): number {
  const C = BIKE.coast;
  const lean = clamp(roll / C.drop, -1, 1);
  const aim = (Math.PI / 2) * C.share * lean * Math.abs(lean);
  // The short way round to it, never more than half a turn.
  let gap = (aim - crank) % (2 * Math.PI);
  if (gap > Math.PI) gap -= 2 * Math.PI;
  if (gap < -Math.PI) gap += 2 * Math.PI;
  const turn = clamp(gap * Math.min(1, C.settle * dt), -C.rate * dt, C.rate * dt);
  const next = (crank + turn) % (2 * Math.PI);
  return next < 0 ? next + 2 * Math.PI : next;
}

/** The steer the hands aim the bars at this step, rad: the turn asked, made
 * by leaning the bike into it — the bars steered into any fall away from
 * the lean the turn wants (Åström's and Schwab's proportional steer into
 * the fall, stated as a pole placement on the leaning bike). */
function handsAim(b: BikeState, ctl: BikeControls, ride: BikeRide, dt: number): number {
  if (!ride.hands) return 0;
  if (b.airborne) {
    return 0.3 * ctl.steer;
  }
  matrixOf(b.q);
  const v = Math.max(Math.abs(b.way), 0.1);
  const cosE = STEER_AXIS.y; // sin of the head angle: the steer's share on the ground
  const mu = Math.min(b.front.touching ? gripF.grip : 1, b.rear.touching ? gripR.grip : 1);
  // A bank across the way (a berm) holds a turn into it tighter than the
  // flat's grip: its angle, right side up positive.
  const fl = hypot(m3[6], m3[8]) || 1;
  const across = (-(nF.x + nR.x) * (m3[8] / fl) + (nF.z + nR.z) * (m3[6] / fl)) / 2;
  const bank = Math.asin(clamp(across, -1, 1));
  // Past the knee the throw goes on only once held there: a quick stab of
  // full bars is a turn at the grip, a hold lays it past and down.
  const a = Math.abs(ctl.steer);
  b.pastKnee = a > H.knee ? b.pastKnee + dt : 0;
  const P = H.past;
  const on = clamp((b.pastKnee - P.after) / P.over, 0, 1);
  const throwOf = Math.sign(ctl.steer) * (a > H.knee ? H.knee + (a - H.knee) * on : a);
  const ask = bikeTurnAsked(throwOf, v, mu, ride.yaw, bank);
  // The turn eased in over a blink: the bars answer the hands at once.
  b.turn += (ask - b.turn) * Math.min(1, dt / H.ease);
  const kappa = b.turn;
  const want = Math.atan((v * v * kappa) / G);
  b.aimLean = want;
  const phi = rollOf();
  // The roll rate off the world frame's forward axis.
  const fx = m3[6];
  const fy = m3[7];
  const fz = m3[8];
  const wwx = m3[0] * b.wx + m3[3] * b.wy + m3[6] * b.wz;
  const wwy = m3[1] * b.wx + m3[4] * b.wy + m3[7] * b.wz;
  const wwz = m3[2] * b.wx + m3[5] * b.wy + m3[8] * b.wz;
  const phiRate = -(wwx * fx + wwy * fy + wwz * fz);
  const ve = Math.max(v, 1.5);
  const h = Math.max(0.5, massCentre(b, tmp2).y - groundUnder());
  const L = WHEELBASE;
  const kp = ((H.omega * H.omega * h + G) * L) / (ve * ve * cosE);
  const kd = (2 * H.zeta * H.omega * h * L) / (ve * ve * cosE);
  const kin = (Math.atan(kappa * L) * Math.cos(phi)) / cosE;
  const sign = b.way >= 0 ? 1 : -1;
  // A front already pushing past its grip is not steered harder: the
  // assist's hands ease the correction by how far past it is.
  let fix = kp * (phi - want) + kd * phiRate;
  if (b.front.over > 1) fix /= 1 + (b.front.over - 1) * ride.yaw;
  // At a crawl his knees, hips and a dabbed foot hold it up (`substep`'s
  // own help), so his hands no longer steer it upright: the bars are held
  // to the turn asked. Steered to balance there, a gain that grows as the
  // speed's square falls swings them to the lock off any lean — a cross
  // slope, a rut — and turns a bike rolled into a load zone off its line.
  // Laid over past what a knee holds (`hands.crawlLean`, a slow turn's
  // lean), the hands steer it up again as at speed.
  const upright = clamp(1 - Math.abs(phi) / H.crawlLean, 0, 1);
  fix *= 1 - crawlHeld(Math.abs(b.way), ride) * upright;
  return clamp(sign * (kin + fix), -BIKE.steer.lock, BIKE.steer.lock);
}

/** THE TURN THE BARS ASK, 1/m, for a throw `steer` (-1..1) at `v` m/s on a
 * ground of grip `mu`, the assist's hands at `assist` (0..1), on a bank of
 * `bank` rad across the way (right side up positive): up to `hands.knee`
 * of the throw the lean asked stays inside `hands.grip` of what the tyres
 * hold — the whole of a ridden turn — and past it the lean reaches on to
 * `hands.over` of it (`hands.reach` with the assist off): more than the
 * tyres hold, so a turn asked that tight slides them out from under him and
 * puts him down. At a crawl the knee turns the `hands.tightest` radius
 * and the full lock tighter still. */
export function bikeTurnAsked(
  steer: number,
  v: number,
  mu: number,
  assist: number,
  bank = 0,
): number {
  const a = Math.abs(steer);
  if (a === 0) return 0;
  const over = H.over * assist + H.reach * (1 - assist);
  const share =
    a <= H.knee ? (H.grip * a) / H.knee : H.grip + ((over - H.grip) * (a - H.knee)) / (1 - H.knee);
  const lean = clamp(Math.atan(share * mu) - Math.sign(steer) * bank, 0.02, 1.2);
  const vv = Math.max(v, 0.1) ** 2;
  // At a crawl the bars' own reach: the knee turns `hands.tightest`, a full
  // lock tighter still.
  const tight = a / (H.knee * H.tightest);
  return Math.sign(steer) * Math.min(tight, (G * Math.tan(lean)) / vv);
}

/** THE THROW THAT ASKS a turn of `kappa` 1/m at `v` m/s (`bikeTurnAsked`
 * turned round, on the flat), held inside the knee: the bot rides inside
 * what the tyres hold. */
export function bikeSteerFor(kappa: number, v: number, mu: number, assist: number): number {
  const most = bikeTurnAsked(H.knee, v, mu, assist);
  return clamp((kappa / Math.max(most, 1e-6)) * H.knee, -H.knee, H.knee);
}

/** HOW MUCH OF HIS BALANCE HIS KNEES, HIPS AND A FOOT TAKE at `speed` m/s,
 * 0..1: the assist's share under `hands.slow`, faded out by `hands.fast`,
 * and all of it once a foot is down under `hands.dab`. */
function crawlHeld(speed: number, ride: BikeRide): number {
  if (!ride.hands) return 0;
  return Math.min(
    1,
    ride.yaw * clamp((H.fast - speed) / (H.fast - H.slow), 0, 1) + (speed < H.dab ? 1 : 0),
  );
}

/** The height of the ground under the bike, m, off the wheels' planes. */
function groundUnder(): number {
  return (pF.y + pR.y) / 2;
}

function substep(
  b: BikeState,
  ctl: BikeControls,
  ends: [End, End],
  world: BikeWorld,
  ride: BikeRide,
  aim: number,
  h: number,
  report: BikeStepReport,
): void {
  matrixOf(b.q);
  const mb = BIKE.mass;
  const mr = b.riderMass;
  let fx = 0;
  let fy = -mb * G;
  let fz = 0;
  let tx = 0;
  let ty = 0;
  let tz = 0;
  // The frame's angular velocity in the world.
  const ww: V3 = toWorld({ x: b.wx, y: b.wy, z: b.wz }, v3());
  // The steer axis and its point in the world.
  const axis = toWorld(STEER_AXIS, v3());
  const sAt = toWorld(STEER_AT, v3());
  let steerTorque = 0;
  let gyroAxis = 0;

  // ---- THE RIDER on his legs and arms ----
  const stance = stanceOf(b, ctl, v3());
  const target = toWorld(stance, v3());
  const rx = b.rider.x - b.x;
  const ry = b.rider.y - b.y;
  const rz = b.rider.z - b.z;
  // Where he stands on the frame, body frame, and how fast he moves on it.
  const rb = toBody({ x: rx, y: ry, z: rz }, v3());
  const rel = { x: rb.x - stance.x, y: rb.y - stance.y, z: rb.z - stance.z };
  // The frame's velocity at his place.
  const at = { x: rx, y: ry, z: rz };
  const spin = cross(ww, at, v3());
  const dv = toBody(
    {
      x: b.rider.vx - (b.vx + spin.x),
      y: b.rider.vy - (b.vy + spin.y),
      z: b.rider.vz - (b.vz + spin.z),
    },
    v3(),
  );
  void target;
  const legsOn = !ride.stiff ? b.legs : R.legs.taut;
  let fu = -R.rate.up * rel.y - R.damping.up * dv.y;
  // The legs push at most what they give, and pull a little (a hop's lift).
  // Meeting a landing his muscles push at once at what he planned to stop
  // it with, not only as far as the legs are bent.
  if (dv.y < -0.3 && b.legs < R.legs.most) fu = Math.max(fu, 0.85 * legsOn * mr * G);
  fu = clamp(fu, -1.5 * mr * G, legsOn * mr * G);
  let ff = -R.rate.fore * rel.z - R.damping.fore * dv.z;
  let fs = -R.rate.side * rel.x - R.damping.side * dv.x;
  // The room's ends: the body on the bike, the limbs straight.
  const under = rb.y - (BB.y + R.stand.y - R.stroke.down);
  if (under < 0) fu += -R.stop.rate * under - (dv.y < 0 ? R.stop.damping * dv.y : 0);
  const over = rb.y - (BB.y + R.stand.y + R.stroke.up);
  if (over > 0) fu += -R.stop.rate * over - (dv.y > 0 ? R.stop.damping * dv.y : 0);
  const fore = rb.z - (BB.z + R.stroke.fore);
  if (fore > 0) ff += -R.stop.rate * fore - (dv.z > 0 ? R.stop.damping * dv.z : 0);
  const aft = rb.z - (BB.z - R.stroke.aft);
  if (aft < 0) ff += -R.stop.rate * aft - (dv.z < 0 ? R.stop.damping * dv.z : 0);
  if (Math.abs(rb.x) > R.stroke.side) {
    const e = rb.x - Math.sign(rb.x) * R.stroke.side;
    fs += -R.stop.rate * e - R.stop.damping * dv.x;
  }
  // THE POP: the legs straightened hard after the crouch.
  if (b.pop > 0) fu += R.pop.force * b.loaded;
  const legs = toWorld({ x: fs, y: fu, z: ff }, v3());
  // The air on him, against the wind.
  const ax = b.rider.vx - world.wind.x;
  const ay = b.rider.vy;
  const az = b.rider.vz - world.wind.z;
  const va = Math.sqrt(ax * ax + ay * ay + az * az);
  const cda = R.cda + (R.cdaLow - R.cda) * Math.max(ctl.crouch, Math.max(0, b.shift) * 0.5);
  const drag = 0.5 * world.rho * cda * va;
  b.rider.vx += ((legs.x - drag * ax) / mr) * h;
  b.rider.vy += ((legs.y - drag * ay) / mr - G) * h;
  b.rider.vz += ((legs.z - drag * az) / mr) * h;
  b.rider.x += b.rider.vx * h;
  b.rider.y += b.rider.vy * h;
  b.rider.z += b.rider.vz * h;
  // The frame feels his legs where he stands.
  fx -= legs.x;
  fy -= legs.y;
  fz -= legs.z;
  tx -= ry * legs.z - rz * legs.y;
  ty -= rz * legs.x - rx * legs.z;
  tz -= rx * legs.y - ry * legs.x;
  b.g = b.g + (h / (BIKE.landing.smooth + h)) * (fu / (mr * G) - b.g);

  // ---- THE WHEELS ----
  let anyTouch = false;
  for (let k = 0; k < 2; k++) {
    const e = ends[k];
    const w = e.w;
    const front = k === 0;
    // The axle fully extended, the spindle, and the path it compresses on.
    if (front) {
      frontAxleAt(b.steer, 0, axle);
      frontSpindle(b.steer, spindle);
    } else {
      axle.x = REAR_AXLE.x;
      axle.y = REAR_AXLE.y;
      axle.z = REAR_AXLE.z;
      spindle.x = 1;
      spindle.y = 0;
      spindle.z = 0;
    }
    const A = toWorld(axle, v3());
    const aw = toWorld(spindle, v3());
    const u = toWorld(front ? STEER_AXIS : REAR_PATH, v3());
    const n = e.plane;
    const nu = dot(n, u);
    const na = clamp(dot(n, aw), -1, 1);
    const reach = e.radius * Math.sqrt(1 - na * na);
    const h0 = n.x * (A.x + b.x - e.at.x) + n.y * (A.y + b.y - e.at.y) + n.z * (A.z + b.z - e.at.z);
    const gap = h0 - reach;
    // A wheel laid flat on the ground (its path along it) carries nothing:
    // the bike is down, and the game has thrown its rider.
    const s = nu > 0.2 ? -gap / nu : 0;
    const wasTouching = w.touching;
    if (s <= 0) {
      // IN THE AIR: the end extends, the wheel spins on (a brake stops it,
      // and its stop pitches the frame).
      w.touching = false;
      w.load = 0;
      w.comp = Math.max(0, w.comp - h * 2);
      w.compRate = 0;
      const brake =
        (front ? ctl.front * BIKE.brakes.front : ctl.rear * BIKE.brakes.rear) / e.inertia;
      const was = w.spin;
      w.spin = Math.abs(w.spin) <= brake * h ? 0 : w.spin - Math.sign(w.spin) * brake * h;
      w.spin *= 1 - 0.05 * h;
      const stopped = ((was - w.spin) * e.inertia) / h;
      tx += aw.x * stopped;
      ty += aw.y * stopped;
      tz += aw.z * stopped;
      w.turn += w.spin * h;
      w.locked = false;
      continue;
    }
    anyTouch = true;
    if (!wasTouching && !report.touchdown) {
      if (!b.front.touching && !b.rear.touching && b.airborne) {
        report.frontFirst = front;
        report.impact = -(b.vx * n.x + b.vy * n.y + b.vz * n.z);
        b.legs = absorbOf(report.impact);
      }
    }
    w.touching = true;
    const T = e.spring.travel;
    // The axle's velocity along the ground's normal, and the stroke's rate.
    const vA = cross(ww, A, v3());
    vA.x += b.vx;
    vA.y += b.vy;
    vA.z += b.vz;
    const sRate = nu > 0.2 ? -dot(vA, n) / nu : 0;
    const sSpring = Math.min(s, T);
    let fsu = springForce(e.spring, sSpring);
    const stop = sSpring - (T - BIKE.bumpStop.reach);
    if (stop > 0) fsu += BIKE.bumpStop.rate * stop;
    const end = e.spring.end;
    const c = e.spring.damping * (sRate > 0 ? end.bump : end.rebound);
    const knee = end.knee;
    const damp =
      Math.abs(sRate) <= knee
        ? c * sRate
        : Math.sign(sRate) * c * (knee + 0.3 * (Math.abs(sRate) - knee));
    fsu = Math.max(0, fsu + damp);
    let N = nu > 0.2 ? fsu / nu : 0;
    // Past its travel: the tyre and the rim, along the normal.
    if (s > T) {
      const pinch = (s - T) * Math.max(nu, 0.2);
      N += BIKE.pinch.rate * pinch + Math.max(0, BIKE.pinch.damping * sRate * nu);
    }
    w.comp = sSpring;
    w.compRate = sRate;
    w.load = N;
    w.peak = Math.max(w.peak, N);
    // The patch: the disc's lowest point toward the ground.
    const dx = -n.x + na * aw.x;
    const dy = -n.y + na * aw.y;
    const dz = -n.z + na * aw.z;
    const dl = hypot3(dx, dy, dz) || 1;
    const Px = A.x + u.x * s + (dx / dl) * e.radius;
    const Py = A.y + u.y * s + (dy / dl) * e.radius;
    const Pz = A.z + u.z * s + (dz / dl) * e.radius;
    w.x = b.x + Px;
    w.y = b.y + Py;
    w.z = b.z + Pz;
    // The wheel's way along the ground and across it.
    const tl = cross(aw, n, v3());
    const tll = hypot3(tl.x, tl.y, tl.z) || 1;
    tl.x /= tll;
    tl.y /= tll;
    tl.z /= tll;
    const ty_ = cross(n, tl, v3());
    // The patch's velocity: the frame's at that point, and the bars' swing.
    const vP = cross(ww, { x: Px, y: Py, z: Pz }, v3());
    vP.x += b.vx;
    vP.y += b.vy;
    vP.z += b.vz;
    if (front) {
      const off = { x: Px - sAt.x, y: Py - sAt.y, z: Pz - sAt.z };
      const sw = cross(axis, off, v3());
      vP.x += sw.x * b.steerRate;
      vP.y += sw.y * b.steerRate;
      vP.z += sw.z * b.steerRate;
    }
    const along = dot(vP, tl);
    const across = dot(vP, ty_);
    // The pedals push the rear patch.
    let drive = 0;
    if (!front && ctl.pedal > 0) drive = pedalForce(b, ctl.pedal, along, h);
    ask.load = N;
    ask.along = along;
    ask.across = across;
    ask.camber = -Math.asin(na);
    ask.grip = e.grip.grip;
    ask.slide = e.grip.slide;
    ask.roll = e.grip.roll;
    // The side force the patch was last asked: what a brake must leave it.
    const side = N * (BIKE.tyre.camber * ask.camber + BIKE.tyre.cornering * w.slip);
    ask.brake = brakeOf(b, ctl, front, ride, N, side, e) / e.radius;
    ask.drive = drive;
    tyreForce(w, ask, h, force);
    // The force on the frame at the patch, the side force a little behind.
    const Fx = N * n.x + force.along * tl.x + force.across * ty_.x;
    const Fy = N * n.y + force.along * tl.y + force.across * ty_.y;
    const Fz = N * n.z + force.along * tl.z + force.across * ty_.z;
    const back = BIKE.tyre.pneumatic;
    const Qx = Px - tl.x * back;
    const Qy = Py - tl.y * back;
    const Qz = Pz - tl.z * back;
    fx += Fx;
    fy += Fy;
    fz += Fz;
    tx += Qy * Fz - Qz * Fy;
    ty += Qz * Fx - Qx * Fz;
    tz += Qx * Fy - Qy * Fx;
    if (front) {
      const ox = Qx - sAt.x;
      const oy = Qy - sAt.y;
      const oz = Qz - sAt.z;
      steerTorque =
        (oy * Fz - oz * Fy) * axis.x + (oz * Fx - ox * Fz) * axis.y + (ox * Fy - oy * Fx) * axis.z;
    }
    // The wheel rolls with the ground, or stands locked.
    w.spin = w.locked ? 0 : along / e.radius;
    w.turn += w.spin * h;
  }

  // ---- THE SPINNING WHEELS' GYROSCOPE ----
  for (let k = 0; k < 2; k++) {
    const front = k === 0;
    if (front) frontSpindle(b.steer, spindle);
    else {
      spindle.x = 1;
      spindle.y = 0;
      spindle.z = 0;
    }
    const aw = toWorld(spindle, tmp2);
    const L =
      (front ? BIKE.front.inertia : BIKE.rear.inertia) * (front ? b.front.spin : b.rear.spin);
    // −Ω × L on the carrier.
    const gx = -(ww.y * aw.z - ww.z * aw.y) * L;
    const gy = -(ww.z * aw.x - ww.x * aw.z) * L;
    const gz = -(ww.x * aw.y - ww.y * aw.x) * L;
    tx += gx;
    ty += gy;
    tz += gz;
    if (front) gyroAxis = gx * axis.x + gy * axis.y + gz * axis.z;
  }

  // ---- THE BARS ----
  let hands = 0;
  if (ride.hands) {
    hands = H.hold * (aim - b.steer) - H.still * b.steerRate - H.feel * b.feel;
    hands = clamp(hands, -H.most, H.most);
  }
  b.feel = steerTorque + gyroAxis;
  let lock = 0;
  const L = BIKE.steer.lock;
  if (Math.abs(b.steer) > L) lock = -2000 * (b.steer - Math.sign(b.steer) * L) - 20 * b.steerRate;
  const steerAcc =
    (steerTorque + gyroAxis + hands - BIKE.steer.damping * b.steerRate + lock) / BIKE.steer.inertia;
  b.steerRate += steerAcc * h;
  b.steer += b.steerRate * h;
  // What turned the bars came out of the frame.
  tx -= BIKE.steer.inertia * steerAcc * axis.x;
  ty -= BIKE.steer.inertia * steerAcc * axis.y;
  tz -= BIKE.steer.inertia * steerAcc * axis.z;

  // ---- THE RIDER'S OWN HELP ----
  const fwd = { x: m3[6], y: m3[7], z: m3[8] };
  const speed = Math.max(Math.abs(b.way), 0);
  if (anyTouch && ride.hands) {
    // At a crawl his knees and hips hold it up, the assist's share of it —
    // and under `dab` a foot goes down.
    const share = crawlHeld(speed, ride);
    const phi = rollOf();
    const rate = -(ww.x * fwd.x + ww.y * fwd.y + ww.z * fwd.z);
    let t = 0;
    if (share > 0) t += share * (H.knees.rate * (phi - b.aimLean) + H.knees.damping * rate);
    // At any speed he lays the bike over with his body too — the outside
    // foot weighted, the inside bar pressed down, the bike tipped under him
    // — so the lean a turn wants comes with less of a countersteer's swing
    // the wrong way first (`docs/downhill-bike.md`, the turn-in).
    // A front already pushing at its grip he stops shoving over, and a bike
    // laid past `body.save` is past what his body levers back up.
    const push =
      clamp((H.body.easeOff - b.front.over) / (H.body.easeOff - 0.7), 0, 1) *
      clamp((H.body.save - Math.abs(phi)) / 0.15, 0, 1);
    t += push * (H.body.rate * (phi - b.aimLean) + H.body.damping * rate);
    tx += fwd.x * t;
    ty += fwd.y * t;
    tz += fwd.z * t;
  }
  if (!anyTouch)
    airControl(b, ctl, ride, ww, fwd, (t) => {
      tx += t.x;
      ty += t.y;
      tz += t.z;
    });

  // ---- INTEGRATE THE FRAME ----
  b.vx += (fx / mb) * h;
  b.vy += (fy / mb) * h;
  b.vz += (fz / mb) * h;
  b.x += b.vx * h;
  b.y += b.vy * h;
  b.z += b.vz * h;
  const tb = toBody({ x: tx, y: ty, z: tz }, v3());
  const Ix = BIKE.inertia.pitch;
  const Iy = BIKE.inertia.yaw;
  const Iz = BIKE.inertia.roll;
  // Euler's equations in the body: I ω̇ = τ − ω × I ω.
  const wx = b.wx;
  const wy = b.wy;
  const wz = b.wz;
  b.wx += ((tb.x - (wy * Iz * wz - wz * Iy * wy)) / Ix) * h;
  b.wy += ((tb.y - (wz * Ix * wx - wx * Iz * wz)) / Iy) * h;
  b.wz += ((tb.z - (wx * Iy * wy - wy * Ix * wx)) / Iz) * h;
  b.q = integrate(b.q, b.wx, b.wy, b.wz, h);
  if (b.tuck > 0) b.tuck = Math.max(0, b.tuck - h);
  if (b.pop > 0) {
    b.pop = Math.max(0, b.pop - h);
    if (b.pop === 0) {
      b.loaded = 0;
      b.tuck = R.pop.tuck;
    }
  }
}

/** HOW MUCH HIS LEGS GIVE on a landing met at `impact` m/s into the
 * ground, x his weight: stiff on a small one, early and long on a big one. */
export function absorbOf(impact: number): number {
  const L = R.legs;
  return clamp(1 + (impact * impact) / (2 * G * L.stroke), L.least, L.most);
}

/** THE AIR: his body English pitches the bike (nose up on the lean back),
 * a twist of the bars yaws it, and the assist's hand levels it to the
 * ground under it — every torque through his body, capped. */
function airControl(
  b: BikeState,
  ctl: BikeControls,
  ride: BikeRide,
  ww: V3,
  fwd: V3,
  add: (t: V3) => void,
): void {
  const A = BIKE.air;
  const n = { x: (nF.x + nR.x) / 2, y: (nF.y + nR.y) / 2, z: (nF.z + nR.z) / 2 };
  const right = { x: m3[0], y: m3[1], z: m3[2] };
  const Ix = BIKE.inertia.pitch;
  const Iy = BIKE.inertia.yaw;
  const Iz = BIKE.inertia.roll;
  const gain = 8;
  // Body rates asked: nose up is a negative x rate, a right-side-down roll
  // a negative z rate. On a bike his body English is strong all the way
  // through the flight (the bike is light under him)...
  let wantX = -ctl.lean * A.pitch;
  let wantZ = 0;
  const wantY = ctl.steer * A.yaw;
  // ...but the assist's hands square it up for the landing only within
  // `reach` of the ground's line: further off, he comes down on whatever
  // is there.
  const pitchOff = dot(fwd, n);
  const rollOff = dot(right, n);
  const near = Math.abs(pitchOff) < A.reach && Math.abs(rollOff) < A.reach;
  const level = ride.air > 0 && near ? ride.air : 0;
  wantX += level * A.level * pitchOff;
  wantZ += -level * A.level * rollOff;
  const t = {
    x: clamp(Ix * gain * (wantX - b.wx), -A.torque, A.torque),
    y: clamp(Iy * gain * (wantY - b.wy), -A.torque, A.torque),
    z: level > 0 ? clamp(Iz * gain * (wantZ - b.wz), -A.torque, A.torque) * level : 0,
  };
  void ww;
  add(toWorld(t, v3()));
}

/** THE PEDALS' PUSH at the rear patch, N: the power the legs hold (the
 * reserve above critical power spent and banked again), limited at a crawl
 * by the push through the low gear and faded as the top gear spins out. */
function pedalForce(b: BikeState, pedal: number, along: number, h: number): number {
  const P = BIKE.pedal;
  const v = Math.max(along, 0.5);
  const most = b.reserve > 0 ? P.power : P.critical;
  const top = (P.rollout * P.cadence) / 60;
  const fade = clamp((top - along) / (0.12 * top), 0, 1);
  const f = pedal * Math.min(P.push, most / v) * fade;
  const power = f * Math.max(along, 0);
  b.reserve = clamp(b.reserve - (power - P.critical) * h, 0, P.reserve);
  return f;
}

/** THE BRAKE'S TORQUE on one wheel, N·m: the lever's share of its most —
 * the assist's fingers (`ride.yaw`) easing a brake that would lock its
 * wheel, or take the grip a turn's `side` force (N) needs (the friction
 * circle), and a front that would lift the rear. */
function brakeOf(
  b: BikeState,
  ctl: BikeControls,
  front: boolean,
  ride: BikeRide,
  N: number,
  side: number,
  e: { radius: number; grip: { grip: number } },
): number {
  const lever = front ? ctl.front : ctl.rear;
  if (lever <= 0) return 0;
  const torque = lever * (front ? BIKE.brakes.front : BIKE.brakes.rear);
  if (ride.yaw <= 0 || !ride.hands) return torque;
  // The most the patch holds before it locks.
  const peak = 0.95 * e.grip.grip * N;
  const left = Math.sqrt(Math.max(0, peak * peak - Math.min(side * side, 0.85 * peak * peak)));
  let eased = Math.min(torque, left * e.radius);
  if (front) {
    // The rear's share of the weight: under a tenth, the front eased off.
    const share = b.rear.load / Math.max(1, (b.riderMass + BIKE.mass) * G);
    eased *= clamp((share - 0.03) / 0.07, 0, 1);
  }
  return torque + (eased - torque) * ride.yaw;
}
