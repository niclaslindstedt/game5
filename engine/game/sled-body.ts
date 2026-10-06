// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE AS A RIGID BODY — one step of it, the sibling sled game's
// model restated for the one mountain machine over this game's snow. Every
// force is summed in the world frame, the torques taken about the centre of
// gravity and turned into the body frame, and the whole integrated once,
// semi-implicitly: velocity first, then position; body rates first, then
// the orientation quaternion.
//
// The forces, and where each is modelled:
//   - THE SUSPENSION: every probe (`SLED_PROBES` — a ski each side, three
//     stations down each edge of the belt) a spring-damper along the body's
//     down axis against the snow's SUPPORT, which is the surface less the
//     sink the speed allows (`snow.ts`'s `sinkTarget`, at the belt's and the
//     sled skis' own scale — a belt at rest sinks deeper than a skier and
//     planes later), with a bump stop past its travel. The snow answers
//     along its own normal;
//   - THE GRIP at each probe, in the snow's tangent plane: the belt driving
//     along its length off its slip and holding sideways — one budget spent
//     along the combined slip (the friction ellipse), so a belt spinning
//     under full throttle has little left to hold the tail and the tail
//     walks out — and the skis holding along their own steered line;
//     every probe's rolling resistance, plough and powder drag against the
//     way it goes (`snowDrag`);
//   - THE DRIVE, through the belt as a mass of its own (`sled-drive.ts`);
//   - THE RIDER: his weight moved across by the bars and fore and aft by
//     the lean — on the groomer as far as the bend needs, in powder where
//     the bars send it — the roll he holds the machine at into a turn, and
//     in powder THE CARVE: a sled rolled onto its belt's edge turns toward
//     its low side, and deep snow gives under the loaded side, so a
//     sidehill is the rider's balance;
//   - THE AIR against the machine and its standing rider, and in flight
//     the rider's levers and the belt's gyro (throttle lifts the nose, the
//     brake drops it);
//   - THE HULL: unsprung points that meet the snow when the suspension has
//     run out — how it lies on its side and how it rolls over — resolved as
//     impulses after the forces;
//   - GRAVITY.
// The trees and the map's edge are `sled.ts`'s, applied after.

import {
  angleDiff,
  approach,
  clamp,
  hypot,
  hypot3,
} from "@niclaslindstedt/oss-game-framework/core/math";
import {
  integrate,
  rotate,
  toEuler,
  unrotate,
  type Vec3,
} from "@niclaslindstedt/oss-game-framework/core/quat";
import type { Level } from "../mapgen/types.ts";
import type { Assist } from "./defs/modes.ts";
import type { PisteDay } from "./piste-day.ts";
import { SLED, SLED_PROBES, sledInertia } from "./defs/sled.ts";
import { TUNING } from "./defs/tuning.ts";
import { stepBelt, stepRpm } from "./sled-drive.ts";
import {
  bottomlessOf,
  depthUnder,
  looseOf,
  packedUnder,
  powderFloor,
  settleShare,
  sinkTarget,
  snowDrag,
} from "./snow.ts";
import type { SledContact, SledControls, SledState } from "./sled-state.ts";

const dt = TUNING.dt;
const G = SLED.grip;
const R = SLED.roll;
const A = SLED.air;
const S = SLED.steer;

/** The bump stop's rate and damping as multiples of the spring's own, the
 * share of it a stop gives back on the way out (a bumper, not a spring),
 * and the most any probe may push, as a multiple of its rest load — the
 * physics' fuse on a strut bottomed on a steep face. */
const STOP_RATE = 12;
const STOP_DAMP = 4;
const STOP_RELEASE = 0.2;
const MAX_LOAD = 15;
/** Bottoming control: the compression damping rises over the last share
 * of the stroke, to (1 + this) times its own at the end. */
const BOTTOM_ZONE = 0.3;
const BOTTOM_DAMP = 2;
/** The fastest the body may turn about any axis, rad/s. */
const MAX_SPIN = 25;
/** The body's down axis must point at least this far down for a probe to
 * be read: a sled on its side has no suspension. */
const PROBE_MIN_DOWN = 0.25;
/** Below this speed along its line a probe's resistance fades out, m/s. */
const DRAG_FADE = 0.3;
/** The least cosine between a strut and the snow's normal the load is
 * resolved through. */
const TILT_MIN = 0.5;
/** The hull against the snow: its restitution, and the friction it slides
 * on — plastic on snow. */
const HULL_BOUNCE = 0.1;
const HULL_FRICTION = 0.35;
/** The rider's thumb on the brake: the belt held just short of lock, still
 * turning at the way less this slip, m/s — a locked belt has no sideways
 * hold left (the sibling game's `arcade.brakeSlip`). */
const BRAKE_SLIP = 2.8;
/** THE ARCADE'S GRAVITY in flight, as the skier's (`air.gravity`): only a
 * sled genuinely flying feels it. */
const FLY_G = TUNING.air.gravity;

/** What a step reports back to `sled.ts`: the hardest closing speed into
 * the snow, m/s, and whether it landed this step after a flight that
 * counts. */
export type SledStepReport = { impact: number; landed: number };

/** A fresh contact list, one per probe. */
export function freshContacts(): SledContact[] {
  return SLED_PROBES.map((p) => ({
    kind: p.kind,
    station: p.station,
    side: p.side,
    x: 0,
    y: 0,
    z: 0,
    sink: 0,
    width: p.width,
    load: 0,
    touching: false,
  }));
}

/** The full ski lock at `speed` m/s, rad: full at a standstill, halved by
 * `steer.fadeSpeed`. */
export function sledLockAt(speed: number): number {
  return SLED.skiLock / (1 + Math.abs(speed) / S.fadeSpeed);
}

function cross(ax: number, ay: number, az: number, bx: number, by: number, bz: number): Vec3 {
  return { x: ay * bz - az * by, y: az * bx - ax * bz, z: ax * by - ay * bx };
}

const normal: Vec3 = { x: 0, y: 1, z: 0 };
const torque: Vec3 = { x: 0, y: 0, z: 0 };

/** The snow the run is on: the map, its dial and the new fall. */
export type SledSnow = {
  level: Level;
  snowDepth: number;
  fresh: number;
  /** The day's piste (`GameState.piste`), on a run dealt it. */
  piste?: PisteDay;
  /** How much the machine helps (the run's `assist`): its `air` sets the
   * nose for the landing. Every hand on when it is not given. */
  assist?: Assist;
};

/** ONE STEP OF THE BODY under `ctl` — the controls as the rider asks, eased
 * through their lags here — for a machine carrying `mass` kg in all. */
export function rideSled(
  c: SledState,
  ctl: SledControls,
  mass: number,
  snow: SledSnow,
  airSpeed: { x: number; z: number },
): SledStepReport {
  const level = snow.level;
  const m = mass;
  const I = sledInertia(m);
  const g = TUNING.g;
  const k = c.controls;

  // ── The controls, through their lags ──────────────────────────────────
  k.throttle = approach(k.throttle, clamp(ctl.throttle, 0, 1), SLED.belt.throttleRate * dt);
  k.brake = approach(k.brake, clamp(ctl.brake, 0, 1), SLED.belt.throttleRate * dt);
  k.steer = clamp(ctl.steer, -1, 1);
  k.lean = approach(k.lean, clamp(ctl.lean, -1, 1), dt / SLED.riderLag);
  const speed0 = hypot3(c.vx, c.vy, c.vz);
  c.skiAngle = approach(c.skiAngle, k.steer * sledLockAt(speed0), S.rate * dt);
  // THE HANG FOLLOWS THE TURN: on the groomer as far as the bend asks for
  // (its cornering load over 0.4 g is all of it), in powder where the
  // bars send it at any pace — there his weight is how the sled is carved.
  const bend = (c.way * c.way * Math.tan(Math.abs(c.skiAngle))) / S.base;
  const across = c.packed * clamp(bend / (0.4 * g), 0, 1) + (1 - c.packed);
  const lag = Math.min(1, dt / SLED.riderLag);
  c.riderRight += (k.steer * SLED.riderReach * across - c.riderRight) * lag;
  c.riderAft += (k.lean * SLED.aftReach - c.riderAft) * lag;

  // ── The frame ─────────────────────────────────────────────────────────
  const q = c.q;
  const up = rotate(q, { x: 0, y: 1, z: 0 });
  const fwd = rotate(q, { x: 0, y: 0, z: 1 });
  const right = rotate(q, { x: 1, y: 0, z: 0 });
  const w = rotate(q, { x: c.wx, y: c.wy, z: c.wz });
  const vx0 = c.vx;
  const vy0 = c.vy;
  const vz0 = c.vz;

  let fx = 0;
  let fy = -m * g;
  let fz = 0;
  torque.x = torque.y = torque.z = 0;
  const push = (px: number, py: number, pz: number, Fx: number, Fy: number, Fz: number): void => {
    fx += Fx;
    fy += Fy;
    fz += Fz;
    const t = cross(px - c.x, py - c.y, pz - c.z, Fx, Fy, Fz);
    torque.x += t.x;
    torque.y += t.y;
    torque.z += t.z;
  };

  level.normalAt(c.x, c.z, normal);
  const rollRel = Math.asin(
    clamp(-(right.x * normal.x + right.y * normal.y + right.z * normal.z), -1, 1),
  );

  // ── The suspension and the grip, probe by probe ───────────────────────
  const depth = depthUnder(snow.snowDepth, snow.fresh);
  const deep = bottomlessOf(snow.snowDepth);
  let touching = 0;
  let beltReaction = 0;
  let loadSum = 0;
  let packedLoad = 0;
  let impact = 0;
  let treadComp = 0;
  let treadN = 0;
  let slipSum = 0;
  let treadSink = 0;
  c.skiComp[0] = c.skiComp[1] = 0;
  const skiDir = rotate(q, { x: Math.sin(c.skiAngle), y: 0, z: Math.cos(c.skiAngle) });
  const W = m * g;
  for (let i = 0; i < SLED_PROBES.length; i++) {
    const p = SLED_PROBES[i];
    const contact = c.contacts[i];
    const rest = p.share * W;
    const carried = contact.load / rest;
    contact.touching = false;
    contact.load = 0;
    const a = rotate(q, { x: p.bx, y: p.by, z: p.bz });
    const ax = c.x + a.x;
    const ay = c.y + a.y;
    const az = c.z + a.z;
    const dy = -up.y;
    if (dy > -PROBE_MIN_DOWN) {
      c.comps[i] = 0;
      continue;
    }
    const dx = -up.x;
    const dz = -up.z;
    const packed = packedUnder(level.packedAt(ax, az), snow.fresh, looseOf(snow));
    const ice = level.iceAt ? level.iceAt(ax, az) : 0;
    const tread = p.kind === "tread";
    const scale = tread ? SLED.sink.tread : SLED.sink.ski;
    const target = sinkTarget(packed, speed0, scale, SLED.sink.plane, depth, carried, deep);
    // Deep snow a footprint has pressed stays pressed.
    const settle = target < c.sinks[i] ? settleShare(deep, speed0) : 1;
    c.sinks[i] += (target - c.sinks[i]) * Math.min(1, (dt / TUNING.snow.sinkLag) * settle);
    const sink = c.sinks[i];
    if (tread) treadSink += sink;
    // Where the ray meets the support: along the body's down axis, off the
    // ground's height under the attachment (the strut is short, and a
    // vertical guess along it is near enough).
    const support = level.groundAt(ax, az) - sink;
    const t = (ay - support) / -dy;
    const cx = ax + dx * t;
    const cz = az + dz * t;
    const cy = ay + dy * t;
    const comp = p.susp.travel - t;
    if (comp <= 0) {
      c.comps[i] = 0;
      continue;
    }
    if (tread) {
      treadComp += comp;
      treadN++;
    } else c.skiComp[p.side < 0 ? 0 : 1] = comp;
    level.normalAt(cx, cz, normal);
    const rx = cx - c.x;
    const ry = cy - c.y;
    const rz = cz - c.z;
    const wv = cross(w.x, w.y, w.z, rx, ry, rz);
    const pvx = c.vx + wv.x;
    const pvy = c.vy + wv.y;
    const pvz = c.vz + wv.z;
    const was = c.comps[i];
    const rate =
      was > 0
        ? (comp - was) / dt
        : Math.max(0, -(pvx * normal.x + pvy * normal.y + pvz * normal.z)) /
          Math.max(0.3, up.x * normal.x + up.y * normal.y + up.z * normal.z);
    c.comps[i] = comp;
    const zone = clamp((comp / p.susp.travel - (1 - BOTTOM_ZONE)) / BOTTOM_ZONE, 0, 1);
    const damp = rate > 0 ? p.susp.bump * (1 + BOTTOM_DAMP * zone) : p.susp.rebound;
    let spring = p.susp.rate * comp + damp * rate;
    if (comp > p.susp.travel) {
      spring +=
        STOP_RATE * p.susp.rate * (comp - p.susp.travel) * (rate > 0 ? 1 : STOP_RELEASE) +
        STOP_DAMP * p.susp.bump * Math.max(0, rate);
    }
    if (spring <= 0) continue;
    touching++;
    const vn = pvx * normal.x + pvy * normal.y + pvz * normal.z;
    if (-vn > impact) impact = -vn;
    const tilt = up.x * normal.x + up.y * normal.y + up.z * normal.z;
    const load = Math.min(spring / Math.max(TILT_MIN, tilt), MAX_LOAD * rest);
    push(ax, ay, az, normal.x * load, normal.y * load, normal.z * load);
    contact.touching = true;
    contact.load = load;
    loadSum += load;
    packedLoad += load * packed;

    // The tangent frame along this probe's line of travel.
    const dir = tread ? fwd : skiDir;
    const dn = dir.x * normal.x + dir.y * normal.y + dir.z * normal.z;
    let tx = dir.x - dn * normal.x;
    let ty = dir.y - dn * normal.y;
    let tz = dir.z - dn * normal.z;
    const tl = hypot3(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    const side = cross(normal.x, normal.y, normal.z, tx, ty, tz);
    const vf = pvx * tx + pvy * ty + pvz * tz;
    const vl = pvx * side.x + pvy * side.y + pvz * side.z;
    const iced = 1 - ice * (1 - G.ice);
    let along = 0;
    let acrossF = 0;
    if (tread) {
      // COMBINED SLIP: the belt slipping along its length and the snow
      // sliding across it spend one grip budget (Janosi and Hanamoto's
      // shear saturating with how far it is sheared, in velocity form).
      const drive = (G.treadPacked * packed + G.treadPowder * (1 - packed)) * iced;
      const hold = (G.sidePacked * packed + G.sidePowder * (1 - packed)) * iced;
      const slip = c.treadSpeed - vf;
      const sx = slip / G.slipRef;
      const sy = vl / G.sideRef;
      const sheared = hypot(sx, sy);
      const share = sheared > 1e-6 ? Math.tanh(sheared) / sheared : 1;
      // ...and the snow's own COHESION sheared by the paddles over the
      // belt's area (Janosi and Hanamoto's c·A), in powder alone.
      const bite = drive * load + (G.cohesion / 6) * (1 - packed) * iced;
      const f = bite * sx * share;
      beltReaction += f;
      slipSum += slip;
      along += f;
      acrossF -= hold * load * sy * share;
      // THE CARVE: a belt rolled onto its edge in powder bites toward its
      // low side, once there is way on to carve with.
      acrossF +=
        load *
        R.carve *
        (1 - packed) *
        Math.sin(rollRel) *
        clamp(Math.abs(vf) / R.carveSpeed, 0, 1);
    } else {
      const hold = (G.skiPacked * packed + G.skiPowder * (1 - packed)) * iced;
      acrossF -= hold * load * Math.tanh(vl / G.sideRef);
    }
    // Only the belt's FRONT cuts fresh snow: the middle and the rear run in
    // the trench it has cut, and pay the compaction alone.
    const cuts = !tread || p.station === "front" ? p.width : 0;
    const drag = snowDrag(packed, sink, cuts, load, vf, (tread ? SLED.sink.drag : 1) * depth);
    along -= drag * Math.tanh(vf / DRAG_FADE);
    push(
      cx,
      cy,
      cz,
      tx * along + side.x * acrossF,
      ty * along + side.y * acrossF,
      tz * along + side.z * acrossF,
    );
    contact.x = cx;
    contact.z = cz;
    contact.y = level.groundAt(cx, cz);
    contact.sink = sink;
  }
  treadSink /= 6;
  c.treadComp = treadN > 0 ? treadComp / treadN : 0;
  c.packed =
    loadSum > 0
      ? packedLoad / loadSum
      : packedUnder(level.packedAt(c.x, c.z), snow.fresh, looseOf(snow));
  const grounded = touching > 0;
  if (!grounded && c.airborne) fy -= m * g * (FLY_G - 1);

  // ── The belt and the engine ───────────────────────────────────────────
  const floor = grounded ? Math.max(0, c.way - BRAKE_SLIP) : 0;
  if (c.running) {
    c.treadSpeed = stepBelt(c.treadSpeed, c.rpm, k.throttle, k.brake, beltReaction, dt, floor);
    c.rpm = stepRpm(c.rpm, k.throttle, c.treadSpeed, dt);
  } else {
    // Shut off: no drive, the belt run along by the snow alone (the brake
    // holding it), the crank winding down.
    c.treadSpeed = stepBelt(c.treadSpeed, 0, 0, k.brake, beltReaction, dt, floor);
    c.rpm = Math.max(0, c.rpm - 4000 * dt);
  }
  c.slip = grounded ? slipSum / 6 : 0;

  // ── The rider's weight, off-centre ────────────────────────────────────
  const rider = m - SLED.dryMass - SLED.fuel;
  const shift = rotate(q, { x: c.riderRight, y: 0, z: -c.riderAft });
  const riderW = rider * g;
  torque.x += shift.z * riderW;
  torque.z += -shift.x * riderW;

  // ── The air ───────────────────────────────────────────────────────────
  const ax = c.vx - airSpeed.x;
  const az = c.vz - airSpeed.z;
  const va = hypot3(ax, c.vy, az);
  const drag = 0.5 * TUNING.airDensity * SLED.cdA * va;
  fx -= drag * ax;
  fy -= drag * c.vy;
  fz -= drag * az;

  // ── Into the body frame, with the rider's own torques ─────────────────
  const tb = unrotate(q, torque);
  if (grounded) {
    const packed = c.packed;
    const target = k.steer * (R.packed * packed + R.powder * (1 - packed));
    const hold = clamp((1.3 - Math.abs(rollRel)) / 0.4, 0, 1);
    // RIDE IT LIKE A BIKE: in deep powder the buried skis hold nothing and
    // the soft side gives — a sled rolled off the snow's plane sinks on its
    // low side and rolls further — most of it down in the snow, half of it
    // planing on top; none on the groomer, none at a crawl.
    const restTread = TUNING.snow.powderSink * depth * SLED.sink.tread;
    const loose =
      Math.max(deep, 0.35) *
      (1 - packed) *
      (R.deepPlaning + (1 - R.deepPlaning) * clamp(treadSink / Math.max(1e-6, restTread), 0, 1));
    const firm = 1 - R.deepHold * loose;
    const moving = clamp((speed0 - 1.5) / 2.5, 0, 1);
    if (loose > 0 && moving > 0) {
      tb.z -= R.deepTip * loose * moving * m * g * SLED.cogHeight * Math.sin(rollRel) * hold;
    }
    tb.z += clamp(R.stiff * (rollRel - target) - R.damp * c.wz, -R.most, R.most) * hold * firm;
    // THE YAW HELD (the arcade's hand): toward the rate the skis ask, no
    // faster than the grip turns the way, and the nose to the way it goes.
    const way = c.way;
    const flat = hypot(c.vx, c.vz);
    const grip = (G.skiPacked * packed + G.sidePowder * (1 - packed)) * g;
    const reach = Math.abs(way) > 1 ? (grip * S.pathShare) / Math.abs(way) : 0;
    const asked = clamp((way * Math.tan(c.skiAngle)) / S.base, -reach, reach);
    const slide = flat > S.slipFrom && way > 0 ? angleDiff(Math.atan2(c.vx, c.vz), c.heading) : 0;
    if (flat > 1) {
      const scrub = S.scrub * packed * m * Math.abs(asked * way);
      fx -= (scrub * c.vx) / flat;
      fz -= (scrub * c.vz) / flat;
    }
    tb.y += clamp(-S.yawHold * (c.wy - asked) - S.slipHold * slide, -S.yawHoldMax, S.yawHoldMax);
  } else {
    // IN THE AIR: the lean pitches it, the belt's gyro lifts the nose on
    // the throttle and drops it on the brake, the bars give a little yaw,
    // and the rider levels the roll with his body.
    tb.x += -A.lean * k.lean - A.throttle * k.throttle + A.brake * k.brake;
    tb.y += A.steer * k.steer;
    const reach = clamp((1.2 - Math.abs(c.roll)) / 0.3, 0, 1);
    tb.z += clamp(A.rollLevel * c.roll - A.rollDamp * c.wz, -A.rollMost, A.rollMost) * reach;
    // THE NOSE SET FOR THE LANDING (the arcade's hand, `assist.air`): the
    // machine pitched toward the snow it will come down on, a little nose
    // high — let go to the rider the moment he leans or brakes, so a nose
    // he drops or throws back is his own.
    const set = (snow.assist?.air ?? 1) * (1 - Math.max(Math.abs(k.lean), k.brake)) * reach;
    if (set > 0) {
      const err = landingPitch(c, level) - c.pitch;
      tb.x += clamp(-A.setStiff * err - A.setDamp * c.wx, -A.setMost, A.setMost) * set;
    }
    tb.x -= A.damping * c.wx;
    tb.y -= A.damping * c.wy;
    tb.z -= A.damping * c.wz;
  }
  // Euler's equations with a diagonal inertia: τ − ω × Iω.
  const gx = (I.z - I.y) * c.wy * c.wz;
  const gy = (I.x - I.z) * c.wz * c.wx;
  const gz = (I.y - I.x) * c.wx * c.wy;
  c.wx += ((tb.x - gx) / I.x) * dt;
  c.wy += ((tb.y - gy) / I.y) * dt;
  c.wz += ((tb.z - gz) / I.z) * dt;
  const spin = hypot3(c.wx, c.wy, c.wz);
  if (spin > MAX_SPIN) {
    c.wx *= MAX_SPIN / spin;
    c.wy *= MAX_SPIN / spin;
    c.wz *= MAX_SPIN / spin;
  }

  // ── Integrate: velocities, then the hull's impulses, then position ────
  c.vx += (fx / m) * dt;
  c.vy += (fy / m) * dt;
  c.vz += (fz / m) * dt;
  const hull = hullContacts(c, m, I, snow, depth);
  if (hull > impact) impact = hull;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  c.z += c.vz * dt;
  c.q = integrate(c.q, c.wx, c.wy, c.wz, dt);

  // ── Air and landing ───────────────────────────────────────────────────
  let landed = 0;
  if (!grounded && hull === 0) {
    if (!c.airborne) {
      c.airborne = true;
      c.airTime = 0;
    }
    c.airTime += dt;
  } else if (c.airborne) {
    landed = c.airTime;
    c.airborne = false;
    c.airTime = 0;
  }
  void vx0;
  void vy0;
  void vz0;
  deriveSled(c);
  return { impact, landed };
}

const under: Vec3 = { x: 0, y: 1, z: 0 };

/** The pitch of the snow the machine will come down on, along its heading,
 * plus `air.setNose` — where its flight meets the ground, read off its
 * fall at the flight's gravity. Rad, tips-up positive. */
function landingPitch(c: SledState, level: Level): number {
  const gy = TUNING.g * FLY_G;
  const high = Math.max(0, c.y - SLED.cogHeight - level.groundAt(c.x, c.z));
  const t = (c.vy + Math.sqrt(c.vy * c.vy + 2 * gy * high)) / gy;
  level.normalAt(c.x + c.vx * t, c.z + c.vz * t, under);
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const rise = -(under.x * fx + under.z * fz) / Math.max(0.2, under.y);
  return Math.atan(rise) + A.setNose;
}

/** THE HULL ON THE SNOW: every hull point under the snow's floor (the
 * powder's, `powderFloor` — deep snow does not hold a hull up, it is
 * shoved aside by it, down to what the belt has pressed) pushed out with an
 * impulse along the snow's normal, and the slide along it rubbed by the
 * plastic's friction. Returns the hardest closing speed met, m/s. */
function hullContacts(
  c: SledState,
  m: number,
  I: { x: number; y: number; z: number },
  snow: SledSnow,
  depth: number,
): number {
  const level = snow.level;
  let worst = 0;
  for (const h of SLED.hull) {
    const r = rotate(c.q, h);
    const px = c.x + r.x;
    const py = c.y + r.y;
    const pz = c.z + r.z;
    const packed = packedUnder(level.packedAt(px, pz), snow.fresh, looseOf(snow));
    const floor = level.groundAt(px, pz) - powderFloor(packed, SLED.sink.tread, depth);
    const pen = floor - py;
    if (pen <= 0) continue;
    level.normalAt(px, pz, normal);
    const w = rotate(c.q, { x: c.wx, y: c.wy, z: c.wz });
    const wv = cross(w.x, w.y, w.z, r.x, r.y, r.z);
    const vx = c.vx + wv.x;
    const vy = c.vy + wv.y;
    const vz = c.vz + wv.z;
    const vn = vx * normal.x + vy * normal.y + vz * normal.z;
    // Out of the snow by the depth it went in.
    c.x += normal.x * pen * normal.y;
    c.y += pen * normal.y * normal.y;
    c.z += normal.z * pen * normal.y;
    if (vn >= 0) continue;
    if (-vn > worst) worst = -vn;
    // The impulse along the normal through this point: −(1+e)·vn over the
    // effective mass of a rigid body struck there.
    const rn = unrotate(c.q, cross(r.x, r.y, r.z, normal.x, normal.y, normal.z));
    const eff = 1 / m + (rn.x * rn.x) / I.x + (rn.y * rn.y) / I.y + (rn.z * rn.z) / I.z;
    const j = (-(1 + HULL_BOUNCE) * vn) / eff;
    // The slide along the snow, rubbed: friction up to the normal impulse.
    const tx = vx - vn * normal.x;
    const ty = vy - vn * normal.y;
    const tz = vz - vn * normal.z;
    const ts = hypot3(tx, ty, tz);
    const jt = ts > 1e-4 ? Math.min(HULL_FRICTION * j, ts / eff) / ts : 0;
    const Jx = normal.x * j - tx * jt;
    const Jy = normal.y * j - ty * jt;
    const Jz = normal.z * j - tz * jt;
    c.vx += Jx / m;
    c.vy += Jy / m;
    c.vz += Jz / m;
    const L = unrotate(c.q, cross(r.x, r.y, r.z, Jx, Jy, Jz));
    c.wx += L.x / I.x;
    c.wy += L.y / I.y;
    c.wz += L.z / I.z;
  }
  return worst;
}

/** The readouts derived from the body's state — written once at the end
 * of a step, and by anything that stands the sled somewhere. */
export function deriveSled(c: SledState): void {
  const e = toEuler(c.q);
  c.heading = e.heading;
  c.pitch = e.pitch;
  c.roll = e.roll;
  c.speed = hypot3(c.vx, c.vy, c.vz);
  const f = rotate(c.q, { x: 0, y: 0, z: 1 });
  const fl = hypot(f.x, f.z) || 1;
  c.way = (c.vx * f.x + c.vz * f.z) / fl;
}
