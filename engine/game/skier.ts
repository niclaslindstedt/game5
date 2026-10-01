// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER AS A RIGID BODY — one step of him. Every force the body feels
// is summed here in the world frame, the torques are taken about the centre
// of gravity and turned into the body frame, and the whole is integrated
// once, semi-implicitly, at 120 Hz: velocity first, then position; body
// rates first, then the orientation quaternion.
//
// The forces, and where each is modelled:
//   - THE LEGS: every station of both skis a spring-damper cast down the
//     snow's normal from under the hips — the skis standing their stance
//     apart ON THE SNOW, so the body's roll is its inclination into a turn
//     and never a ski lifted — against the snow's SUPPORT, which is the
//     surface less the sink the speed allows (`suspension.ts`, `snow.ts`),
//     with a stop past its travel — and the TUCK folds them, so a crouched
//     skier sits lower and has less leg left for a landing;
//   - THE GRIP at each station, in the ground's tangent plane: the EDGE
//     holding sideways along the ski's own line — hard on its edge, barely
//     at all flat — and the SKID's sideways scrub against the way when the
//     skis are pivoted across it; every station's friction, plough and
//     powder drag against the way it is going (`snow.ts`);
//   - THE DRIVE, which is gravity, and at a crawl the POLES (`poles.ts`);
//   - THE SKIER: his hips moved inside the turn and fore and aft, and the
//     INCLINATION he and his legs settle at into a carve, which in powder is
//     the whole turn — a ski rolled over in powder turns toward the low
//     side;
//   - THE AIR, against the body's drag area — standing tall, or folded into
//     a tuck; and in flight the skier's levers (`flight.ts`);
//   - THE HULL: points on the body and the skis' ends that meet the snow
//     when the legs have run out, which is how a skier goes down on his hip
//     and how he tumbles — resolved as impulses after the forces
//     (`chassis.ts`);
//   - GRAVITY.
// The trees and the map's edge are `collision.ts`'s and are applied after.
//
// THE CARVE is the one piece of arithmetic that is skiing and not sledding:
// a ski tipped on its edge to `edge` rad bends its sidecut into the snow
// and runs the arc that sidecut makes — a curvature of tan(edge) over the
// sidecut radius (`limits.ts`'s `carveCurvature`) — so the yaw the skis
// ask for is the way times that, held by the same hand on the yaw the
// sibling games use, and the sideways grip that holds him on the arc is the
// edge's. Past what the edge holds, the ski SKIDS — the grip's `tanh` lets
// go progressively — and past that an edge standing well over CATCHES
// (`crash.ts` reads `sideSlip`).

import {
  angleDiff,
  approach,
  clamp,
  hypot,
  hypot3,
} from "@niclaslindstedt/oss-game-framework/core/math";
import {
  fromEuler,
  integrate,
  rotate,
  toEuler,
  unrotate,
  type Vec3,
} from "@niclaslindstedt/oss-game-framework/core/quat";
import { SKIS, inertiaOf, totalMass, type SkiSpec } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import { airTorque, landingAhead, landingLoad, landingLoss, landingOff } from "./flight.ts";
import { chassisContacts } from "./chassis.ts";
import {
  bodyPlough,
  bottomlessOf,
  depthUnder,
  gripAt,
  onIce,
  packedUnder,
  restSinkOf,
  settleShare,
  sinkTarget,
  snowDrag,
  type Grip,
} from "./snow.ts";
import { carveCurvature, cornerGrip, edgeLockAt, flightGravity, harshSpeedOf } from "./limits.ts";
import { footprintOf } from "./footprint.ts";
import { hullOf, probesOf } from "./suspension.ts";
import { driveReach, poleForce, strideRate } from "./poles.ts";
import { tunnelBlow, tunnelWind } from "./wind-tunnel.ts";
import { dampShare, harshShare, skiBite, skiPull, springShare } from "./damage.ts";
import { stepTrench, trenchGrip } from "./trench.ts";
import type { GameEvent, GameState, SkierInput, SkierState, SnowContact } from "./state.ts";

const dt = TUNING.dt;
const G = TUNING.grip;
const K = TUNING.skier;
const S = TUNING.steer;
const ARC = TUNING.arcade;
const CV = TUNING.carve;
const J = TUNING.jump;
const P = TUNING.poles;

/** The stop's rate and damping as multiples of the leg's own, and the most
 * any one station may ever push, as a multiple of the load it carries at
 * rest. The cap is the physics' fuse rather than a model: a leg folded to
 * its stop on a steep face sees its compression grow with every centimetre
 * the skier slides, and a spring that followed it would fire him off the
 * slope. */
const STOP_RATE = 12;
const STOP_DAMP = 4;
const MAX_LOAD = 15;
/** THE STOP GIVES BACK LITTLE: a knee at the end of its bend loads at its
 * full rate and hands back only this share of it on the way out — the
 * hysteresis that makes it swallow a slam rather than spring off it. */
const STOP_RELEASE = 0.2;
/** BOTTOMING CONTROL: the compression damping rises over the last
 * `BOTTOM_ZONE` of the stroke, to `1 + BOTTOM_DAMP` times its own at the
 * end — the muscle a skier braces a landing with, so a big hit is slowed
 * before the stop has to catch it. */
const BOTTOM_ZONE = 0.3;
const BOTTOM_DAMP = 2;
/** The fastest the body may turn about any axis, rad/s — a second fuse,
 * over the explicit gyroscopic term, which a tumble would otherwise feed. */
const MAX_SPIN = 25;
/** The body's down axis must point at least this far toward the ground for
 * a station to be read at all — a skier on his side has no legs under him. */
const PROBE_MIN_DOWN = 0.25;
/** Below this speed along its line a station's resistance fades out, m/s,
 * so a skier at rest is not pushed back and forth through zero. */
const DRAG_FADE = 0.3;
/** Newton steps along a station's ray, and how steeply it must meet the
 * snow (the vertical closing per metre of ray) to count as meeting it. */
const RAY_STEPS = 3;
const RAY_GRAZE = 0.15;
/** The least cosine between a leg and the snow's normal the normal force
 * is resolved through — a leg lying along the snow carries it nothing. */
const TILT_MIN = 0.5;
/** The knees: the fifth and sixth of `hullOf`'s points. */
const KNEES = [4, 5];
/** The way, m/s, past which a skier with his hands off starts working for
 * his speed (`poles.ts`) — a drift of the snow under a skier stood still is
 * not a skier setting off. */
const DRIVE_FROM = 0.4;
/** How fast the tuck and the brake follow the thumb, 1/s. */
const INPUT_RATE = 8;

/** A skier at rest with nothing read yet; `standSkier` puts him somewhere. */
export function freshSkier(spec: SkiSpec): SkierState {
  const probes = probesOf(spec);
  const contacts: SnowContact[] = probes.map((p) => ({
    kind: "ski",
    station: p.station,
    side: p.side,
    x: 0,
    y: 0,
    z: 0,
    sink: 0,
    width: p.width,
    compression: 0,
    load: 0,
    touching: false,
  }));
  return {
    spec,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    q: fromEuler(0, 0, 0),
    wx: 0,
    wy: 0,
    wz: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    way: 0,
    tuck: 0,
    brake: 0,
    steer: 0,
    lean: 0,
    edge: 0,
    skid: 0,
    skiAngle: 0,
    carve: 0,
    jumpLoad: 0,
    popped: 1e6,
    drive: 0,
    stride: 0,
    crouch: 0,
    hipRight: 0,
    hipAft: 0,
    packed: 0,
    sideSlip: 0,
    contacts,
    skiCompression: [0, 0],
    airborne: false,
    airTime: 0,
    launchVy: 0,
    airReported: false,
    landing: 1e6,
    overFor: 0,
    stuckFor: 0,
    trench: 0,
    trenchFor: 0,
    boggedFor: 0,
    rolledFor: 0,
    thrown: null,
    damage: { ski: [0, 0], legs: 0 },
    tunnel: null,
    hitCooldown: 0,
    bumpCooldown: 0,
    sinks: probes.map(() => 0),
    comps: probes.map(() => 0),
  };
}

/** THE SKID ANGLE the speed allows, rad: a snowplough's at a crawl,
 * narrowing to `steer.skidFast` by `steer.skidFadeSpeed`. */
export function skidAngleAt(speed: number): number {
  return S.skidAngle - (S.skidAngle - S.skidFast) * clamp(Math.abs(speed) / S.skidFadeSpeed, 0, 1);
}

/** The body's drag area at `crouch` 0..1, m². */
export function dragAreaOf(spec: SkiSpec, crouch: number): number {
  return spec.cdAUpright + (spec.cdATuck - spec.cdAUpright) * clamp(crouch, 0, 1);
}

// Scratch, reused every step: the engine allocates nothing per station.
const grip: Grip = { edge: 0, base: 0 };
const normal: Vec3 = { x: 0, y: 1, z: 0 };
const torque: Vec3 = { x: 0, y: 0, z: 0 };

function cross(ax: number, ay: number, az: number, bx: number, by: number, bz: number): Vec3 {
  return { x: ay * bz - az * by, y: az * bx - ax * bz, z: ax * by - ay * bx };
}

/** Advance one skier by one step under `input`. Events land on `events`. */
export function stepSkier(state: GameState, input: SkierInput, events: GameEvent[]): void {
  const c = state.skier;
  const spec = c.spec;
  const level = state.level;
  const m = totalMass(spec);
  const I = inertiaOf(spec);
  const g = TUNING.g;
  const fit = footprintOf(spec);

  // ── The controls, through their lags ──────────────────────────────────
  c.tuck = approach(c.tuck, clamp(input.tuck, 0, 1), INPUT_RATE * dt);
  c.brake = approach(c.brake, clamp(input.brake, 0, 1), INPUT_RATE * dt);
  c.carve = approach(c.carve, input.carve === true ? 1 : 0, INPUT_RATE * dt);
  c.steer = clamp(input.steer, -1, 1);
  c.lean = approach(c.lean, clamp(input.lean, -1, 1), dt / K.lag);
  const speed0 = hypot3(c.vx, c.vy, c.vz);
  // THE EDGE the skis are rolled onto: the full lock eases with speed, a
  // dulled edge (`damage.ts`) pulls the line toward its side, and a long
  // stiff ski takes longer to tip over (`Footprint.edgeRate`).
  // CUTTING HARDER (`TUNING.carve`) stands the skis further over than the
  // speed's own lock, never past the spec's own most.
  const lock = Math.min(spec.edgeMax, edgeLockAt(spec, speed0) * (1 + CV.edge * c.carve));
  c.edge = approach(c.edge, c.steer * lock + skiPull(c), S.edgeRate * fit.edgeRate * dt);
  // THE SKID: the skis pivoted across the way by the brake — toward the
  // side the edge is on for a hockey stop, and with the skis straight a
  // snowplough, which pivots nothing and only scrubs.
  c.skid = approach(c.skid, c.brake, S.skidRate * dt);
  c.skiAngle = c.skid * skidAngleAt(speed0) * clamp(c.steer * 2, -1, 1);
  // THE JUMP (`TUNING.jump`): loaded while it is held on the snow — the
  // time held, to `full` — and sprung the step it is let go, off the snow
  // if he is still on it. A load carried into the air keeps; one let go
  // there is spent on nothing.
  let pop = 0;
  let loaded = 0;
  c.popped += dt;
  if (input.jump === true && c.thrown === null) {
    if (!c.airborne) c.jumpLoad = Math.min(J.full, c.jumpLoad + dt);
  } else if (c.jumpLoad > 0) {
    loaded = c.jumpLoad;
    if (!c.airborne && c.thrown === null)
      pop = J.popMin + ((J.popMax - J.popMin) * loaded) / J.full;
    c.jumpLoad = 0;
  }
  // THE DRIVE HE MAKES (`poles.ts`): automatic at a crawl once he is
  // rolling (or the moment the tuck asks him to go — a skier standing still
  // with his hands off stays standing), and not while he is braking,
  // loading a jump, in the air or off his skis; the stride's phase runs
  // only while he is working.
  const going = c.way > DRIVE_FROM || c.tuck > 0.05;
  // ...and, once rolling, on a straight: the skis stood on edge in a bend
  // take it away. At a crawl a skier steps his skis round while he pushes.
  const bent = clamp((Math.abs(c.steer) - P.edgeFrom) / (P.edgeGone - P.edgeFrom), 0, 1);
  const straight = 1 - bent * clamp((speed0 - P.strideTo) / P.strideTo, 0, 1);
  const working =
    going && !c.airborne && c.thrown === null && c.jumpLoad === 0 ? (1 - c.brake) * straight : 0;
  c.drive = approach(c.drive, working, P.rate * dt);
  // Read off the SPEED, not the way: a skier sliding sideways at 80 km/h has
  // no way along his skis and no business pushing on them.
  if (c.drive > 0 && driveReach(speed0) > 0) c.stride += strideRate(speed0) * c.drive * dt;
  // THE CROUCH follows the tuck — or, deeper the longer it is held, the
  // jump being loaded: a body takes a moment to fold.
  const crouch0 = c.crouch;
  const load = c.jumpLoad > 0 ? J.crouch * Math.min(1, 0.35 + (0.65 * c.jumpLoad) / J.full) : 0;
  // A skier working for his speed stands up to it: a man skating or
  // double-poling is not folded into a tuck, whatever the thumb says.
  const tucked = c.tuck * (1 - c.drive * driveReach(speed0));
  c.crouch = approach(c.crouch, Math.max(tucked, load), K.crouchRate * dt);
  const drop = spec.crouchDrop * c.crouch;
  const k = Math.min(1, dt / K.lag);
  const right0 = c.hipRight;
  const aft0 = c.hipAft;
  // THE ANGULATION FOLLOWS THE TURN. His hips moved inside are a roll
  // moment on the whole (below), and on the groomer a skier moves them as
  // far as the bend needs them — against the load the carve asks for, v²κ,
  // full by `skier.hangG` — so at a crawl he stands square whatever the
  // edge says. In powder his weight is how the skis are turned and held
  // up (`snow.ts`'s deep snow), and it goes where the edge sends it at any
  // pace.
  const kappa =
    carveCurvature(spec, c.edge) * (1 - S.tipLoad * c.lean) * (1 + CV.tighten * c.carve);
  // A pressed edge holds more (`carve.grip`).
  const pressed = 1 + CV.grip * c.carve;
  const bend = c.way * c.way * Math.abs(kappa);
  const across = c.packed * clamp(bend / (K.hangG * g), 0, 1) + (1 - c.packed);
  c.hipRight += (c.steer * spec.hipReach * across - c.hipRight) * k;
  c.hipAft += (c.lean * K.aftReach - c.hipAft) * k;
  const moved = Math.abs(c.hipRight - right0) + Math.abs(c.hipAft - aft0);

  // ── The frame ─────────────────────────────────────────────────────────
  const q = c.q;
  const up = rotate(q, { x: 0, y: 1, z: 0 });
  const fwd = rotate(q, { x: 0, y: 0, z: 1 });
  const right = rotate(q, { x: 1, y: 0, z: 0 });
  const w = rotate(q, { x: c.wx, y: c.wy, z: c.wz });
  // THE CROUCH IS KINEMATIC. The stations hang `drop` higher in the body
  // frame, so a body folding would otherwise see every leg's compression
  // jump by the change and the loaded springs fling him off the snow (a
  // tuck let go at 80 km/h fired him half a metre up and over). A skier
  // folding his knees moves his own body down over skis that stay on the
  // snow — so the CoG is moved by the change along his own up, the legs
  // keep their compression and their load, and nothing is stored in a
  // spring. In the air the skis come up to the body instead (`place.ts`
  // stands him the same way).
  if (!c.airborne && c.crouch !== crouch0) {
    const shift = spec.crouchDrop * (crouch0 - c.crouch);
    c.x += shift * up.x;
    c.y += shift * up.y;
    c.z += shift * up.z;
  }
  const vx0 = c.vx;
  const vy0 = c.vy;
  const vz0 = c.vz;

  let fx = 0;
  let fy = -m * g;
  let fz = 0;
  torque.x = 0;
  torque.y = 0;
  torque.z = 0;
  const push = (px: number, py: number, pz: number, Fx: number, Fy: number, Fz: number): void => {
    fx += Fx;
    fy += Fy;
    fz += Fz;
    const t = cross(px - c.x, py - c.y, pz - c.z, Fx, Fy, Fz);
    torque.x += t.x;
    torque.y += t.y;
    torque.z += t.z;
  };

  // The ground under the CoG: the roll the skier holds is measured against
  // it, and the carve in powder reads it.
  level.normalAt(c.x, c.z, normal);
  const rollRel = Math.asin(
    clamp(-(right.x * normal.x + right.y * normal.y + right.z * normal.z), -1, 1),
  );
  // THE STANCE STANDS ON THE SNOW. A skier's legs are two, and his skis
  // stay on the snow whatever his body does above them: inclined 40° into
  // a carve, the outside leg is long and the inside one short, and both
  // skis are still loaded. So each ski's stations hang `stance / 2` to the
  // side ACROSS THE SNOW — along the ground's own across, square to the
  // skis' line — and each leg reaches down from the hips' line, not from a
  // point rolled over with the body: cast from the body's x axis, a 0.3 m
  // stance under a body laid 30° over is one ski 0.15 m off the snow and
  // a skier falling over his inside ski.
  const fdn = fwd.x * normal.x + fwd.y * normal.y + fwd.z * normal.z;
  let acrossX = normal.y * (fwd.z - fdn * normal.z) - normal.z * (fwd.y - fdn * normal.y);
  let acrossY = normal.z * (fwd.x - fdn * normal.x) - normal.x * (fwd.z - fdn * normal.z);
  let acrossZ = normal.x * (fwd.y - fdn * normal.y) - normal.y * (fwd.x - fdn * normal.x);
  const acrossL = hypot3(acrossX, acrossY, acrossZ) || 1;
  acrossX /= acrossL;
  acrossY /= acrossL;
  acrossZ /= acrossL;
  // ...and the legs' own line: the snow's normal under him.
  const legX = normal.x;
  const legY = normal.y;
  const legZ = normal.z;

  // ── The legs and the grip, station by station ─────────────────────────
  const probes = probesOf(spec);
  const depth = depthUnder(state.snowDepth, state.fresh);
  const bottomless = bottomlessOf(state.snowDepth);
  // What the legs have taken (`damage.ts`) and how bogged he is
  // (`trench.ts`) — each exactly 1 on a sound skier out of any hole.
  const soft = springShare(c);
  const dampen = dampShare(c);
  const bite = trenchGrip(c.trench);
  // How much of the edge the ski's tilt buys: a flat ski slides on a share
  // of it, a ski stood right up bites with all of it.
  const edgeShare =
    G.flatShare +
    (1 - G.flatShare) * clamp(Math.sin(Math.abs(c.edge)) / Math.sin(spec.edgeMax), 0, 1);
  let touching = 0;
  let loadSum = 0;
  let packedLoad = 0;
  let impact = 0;
  let skiL = 0;
  let skiR = 0;
  let slipWorst = 0;
  let midSink = 0;
  for (let i = 0; i < probes.length; i++) {
    const p = probes[i];
    const contact = c.contacts[i];
    // What it carried last step, which deep snow gives under (`snow.ts`).
    const carried = contact.load / p.rest;
    contact.touching = false;
    contact.load = 0;
    // THE TUCK FOLDS THE LEG: the station hangs `drop` higher in the body
    // frame, so the body settles that much nearer the snow on springs that
    // still carry all of him.
    // THE LEG REACHES FROM THE HIPS TO THE SNOW: the station hangs along
    // the ski's line (the body's forward axis, so a body pitched over its
    // tips loads them) and across the snow, and its ray is cast down the
    // SNOW'S OWN NORMAL from under the hips — not down the body's axis,
    // which a body inclined into a carve swings the attachment up and out
    // along, lifting both skis off the snow at every turn-in and slamming
    // them back. So the roll is the body's INCLINATION and nothing else: a
    // skier laid 40° over into a carve stands on two loaded legs. A skier
    // on his side has no legs under him at all.
    if (up.y < PROBE_MIN_DOWN) {
      c.comps[i] = 0;
      continue;
    }
    const dx = -legX;
    const dy = -legY;
    const dz = -legZ;
    const ax = c.x + fwd.x * p.bz + acrossX * p.bx + dx * -(p.by + drop);
    const ay = c.y + fwd.y * p.bz + acrossY * p.bx + dy * -(p.by + drop);
    const az = c.z + fwd.z * p.bz + acrossZ * p.bx + dz * -(p.by + drop);
    const packed = packedUnder(level.packedAt(ax, az), state.fresh);
    const ice = level.iceAt ? level.iceAt(ax, az) : 0;
    // A bogged skier (`trench.ts`) hangs in the hole he has sunk into.
    const target =
      sinkTarget(packed, speed0, p.sinkScale, p.planeScale, depth, carried, bottomless) + c.trench;
    // Deep snow a ski has pressed stays pressed (`settleShare`).
    const settle = target < c.sinks[i] ? settleShare(bottomless, speed0) : 1;
    c.sinks[i] += (target - c.sinks[i]) * Math.min(1, (dt / TUNING.snow.sinkLag) * settle);
    const sink = c.sinks[i];
    if (p.station === "mid") midSink += sink / 2;
    // Where the ray meets the support: Newton's method along the ray, off
    // the slope of the snow wherever the last guess landed — a ray at a
    // grazing angle to a face converges where a vertical guess would
    // overshoot it. A ray running along the snow meets nothing.
    let t = (ay - (level.groundAt(ax, az) - sink)) / -dy;
    let cx = ax + dx * t;
    let cz = az + dz * t;
    let grazing = false;
    for (let it = 0; it < RAY_STEPS; it++) {
      level.normalAt(cx, cz, normal);
      const slope = dy + (normal.x * dx + normal.z * dz) / normal.y;
      if (slope > -RAY_GRAZE) {
        grazing = true;
        break;
      }
      const gap = ay + dy * t - (level.groundAt(cx, cz) - sink);
      t -= gap / slope;
      cx = ax + dx * t;
      cz = az + dz * t;
    }
    if (grazing) {
      c.comps[i] = 0;
      continue;
    }
    const cy = ay + dy * t;
    const comp = p.susp.travel - t;
    const bent = comp;
    contact.compression = Math.max(0, comp);
    if (bent <= 0) c.comps[i] = 0;
    if (p.side < 0) skiL = Math.max(skiL, Math.max(0, comp));
    else skiR = Math.max(skiR, Math.max(0, comp));
    if (bent <= 0) continue;
    level.normalAt(cx, cz, normal);
    // The contact point's own velocity, and how fast it is closing on the
    // slope under it — what the damper reads.
    const rx = cx - c.x;
    const ry = cy - c.y;
    const rz = cz - c.z;
    const wv = cross(w.x, w.y, w.z, rx, ry, rz);
    const pvx = c.vx + wv.x;
    const pvy = c.vy + wv.y;
    const pvz = c.vz + wv.z;
    // THE DAMPER'S RATE is the compression's own change since the last step
    // — read off the very surface the spring is, so a crease in the snow is
    // a crease in both. A station just arriving has no last step: its rate
    // is the contact point's speed into the slope.
    const was = c.comps[i];
    const rate =
      was > 0
        ? (bent - was) / dt
        : Math.max(0, -(pvx * normal.x + pvy * normal.y + pvz * normal.z)) /
          Math.max(0.3, -(dx * normal.x + dy * normal.y + dz * normal.z));
    c.comps[i] = bent;
    const deep = clamp((comp / p.susp.travel - (1 - BOTTOM_ZONE)) / BOTTOM_ZONE, 0, 1);
    const damp = rate > 0 ? p.susp.bump * (1 + BOTTOM_DAMP * deep) : p.susp.rebound;
    let spring = p.susp.rate * soft * bent + damp * dampen * rate;
    if (comp > p.susp.travel) {
      spring +=
        STOP_RATE * p.susp.rate * (comp - p.susp.travel) * (rate > 0 ? 1 : STOP_RELEASE) +
        STOP_DAMP * p.susp.bump * Math.max(0, rate);
    }
    if (spring <= 0) continue;
    if (spring > MAX_LOAD * p.rest) spring = MAX_LOAD * p.rest;
    touching += 1;
    const vn = pvx * normal.x + pvy * normal.y + pvz * normal.z;
    if (-vn > impact) impact = -vn;
    // THE SNOW ANSWERS ALONG ITS OWN NORMAL. What it can push with is a
    // normal force, and what the leg carries is that force's share along
    // the leg — the rest is the body's to hold — so the normal force is the
    // spring over the cosine between the two (the leg stands on the normal
    // under the hips; a station out on a tip meets a different slope), and
    // nothing sideways: holding sideways is the grip's, below.
    const tilt = -(dx * normal.x + dy * normal.y + dz * normal.z);
    const load = Math.min(spring / Math.max(TILT_MIN, tilt), MAX_LOAD * p.rest);
    push(ax, ay, az, normal.x * load, normal.y * load, normal.z * load);
    contact.touching = true;
    contact.load = load;
    loadSum += load;
    packedLoad += load * packed;

    // THE SIDECUT AS GEOMETRY: a ski on its edge is bent into an arc of
    // curvature κ, so its tip's line points inside the boot's by κ times
    // how far ahead it stands and its tail's outside by the same — the
    // toe-in the sidecut makes, which is the whole of why an edged ski
    // turns without being turned: the tip's edge, biting on that line,
    // pulls the tip round and the tail's pushes the tail out, and the
    // three stations of both skis slide across nothing only once the body
    // is turning at exactly the curvature the edge asks for. On the
    // groomer only: in powder the edge is buried and the ski bends into
    // its float, not its sidecut. The whole ski's pivot is the skid's.
    const toe = c.skiAngle + kappa * packed * p.bz;
    const skiDir = rotate(q, { x: Math.sin(toe), y: 0, z: Math.cos(toe) });
    // The tangent frame along this station's line of travel.
    const dn = skiDir.x * normal.x + skiDir.y * normal.y + skiDir.z * normal.z;
    let tx = skiDir.x - dn * normal.x;
    let ty = skiDir.y - dn * normal.y;
    let tz = skiDir.z - dn * normal.z;
    const tl = hypot3(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    const side = cross(normal.x, normal.y, normal.z, tx, ty, tz);
    const vf = pvx * tx + pvy * ty + pvz * tz;
    const vl = pvx * side.x + pvy * side.y + pvz * side.z;
    if (Math.abs(vl) > slipWorst) slipWorst = Math.abs(vl);
    gripAt(packed, grip, fit);
    if (ice > 0) onIce(grip, ice);
    // THE EDGE holds sideways, as much as it is stood on; the BASE holds
    // in powder whatever the edge is doing; either lets go progressively.
    // A ski pivoted into a skid scrapes on its edge rather than biting
    // with it: `grip.skidHold` of the hold, by how far it is pivoted.
    const hold =
      (grip.edge * edgeShare * skiBite(c, p.side) + grip.base) *
      ARC.sideGrip *
      pressed *
      (1 - c.skid * (1 - G.skidHold));
    let across = -hold * load * Math.tanh(vl / G.sideRef);
    // THE CARVE IN POWDER: a ski rolled over in soft snow turns toward the
    // low side, once there is way on to carve with.
    across +=
      load * K.carve * (1 - packed) * Math.sin(rollRel) * clamp(Math.abs(vf) / K.carveSpeed, 0, 1);
    const drag = snowDrag(packed, sink, p.ploughs ? p.width : 0, load, vf, p.sinkScale * depth);
    // THE SKID pays for the snow it shoves sideways, over and above what
    // the pivoted edge scrubs.
    let along = -(drag + S.skidDrag * c.skid * load) * Math.tanh(vf / DRAG_FADE);
    // THE DRIVE pushes along the skis, under the boots, at a crawl.
    if (p.station === "mid")
      along += (bite * poleForce(spec, speed0, packed, c.drive, c.stride)) / 2;
    push(
      cx,
      cy,
      cz,
      tx * along + side.x * across,
      ty * along + side.y * across,
      tz * along + side.z * across,
    );
    contact.x = cx;
    contact.z = cz;
    contact.y = level.groundAt(cx, cz);
    contact.sink = sink;
  }
  // THE BODY PLOUGH (`snow.ts`): the knees, each over a shin's width,
  // shoving whatever of the untouched powder stands over them — so a skier
  // planing on top pays none of it.
  const restMid = restSinkOf(depth) * fit.sink;
  if (bottomless > 0 && speed0 > DRAG_FADE) {
    const hull = hullOf(spec);
    for (const h of KNEES) {
      const b = rotate(q, hull[h]);
      const px = c.x + b.x;
      const pz = c.z + b.z;
      const under = level.groundAt(px, pz) - (c.y + b.y);
      const packed = packedUnder(level.packedAt(px, pz), state.fresh);
      const f = bodyPlough(packed, under, 0.12, speed0, bottomless) / speed0;
      if (f > 0) push(px, c.y + b.y, pz, -f * vx0, -f * vy0, -f * vz0);
    }
  }
  c.skiCompression[0] = skiL;
  c.skiCompression[1] = skiR;
  c.packed =
    loadSum > 0 ? packedLoad / loadSum : packedUnder(level.packedAt(c.x, c.z), state.fresh);
  c.sideSlip = touching > 0 ? slipWorst : 0;
  const grounded = touching > 0;
  // THE ARCADE'S GRAVITY (`air.gravity`): a skier who was flying at the end
  // of the last step and has found no snow under a ski this one is pulled
  // down harder than the ground ever holds him — the hang shortened, never
  // where he left the snow.
  if (!grounded && c.airborne) fy -= m * (flightGravity(state.rules) - g);

  // ── The hips, off-centre ──────────────────────────────────────────────
  // A weight off-centre is a moment only against the snow's push back at
  // the skis; in the air the body falls whole and his hips turn nothing
  // (a skier who spun a 360 with his hips still hung inside the last bend
  // was rolled onto his side by his own weight). A body on its side with
  // a hip on the snow is not in the air: `airborne` is no station and no
  // body point touching, as the last step left it.
  if (!c.airborne) {
    const shift = rotate(q, { x: c.hipRight, y: 0, z: -c.hipAft });
    const skierW = spec.skierMass * g;
    // r × (0, −W, 0) = (r.z·W, 0, −r.x·W)
    torque.x += shift.z * skierW;
    torque.z += -shift.x * skierW;
  }

  // ── The air ───────────────────────────────────────────────────────────
  // ...which in a wind tunnel moves along it (R30, `wind-tunnel.ts`), and
  // the tunnel's blowers thrust him on and hold him to its line.
  const tunnels = level.resort?.tunnels;
  const wind = tunnelWind(c, tunnels);
  const ax = c.vx - wind.x;
  const az = c.vz - wind.z;
  const v = hypot3(ax, c.vy, az);
  const drag = 0.5 * TUNING.airDensity * dragAreaOf(spec, c.crouch) * v;
  const blow = tunnelBlow(c, tunnels);
  fx += m * blow.x - drag * ax;
  fy -= drag * c.vy;
  fz += m * blow.z - drag * az;

  // ── Into the body frame, with the skier's own torques ─────────────────
  const tb = unrotate(q, torque);
  if (grounded) {
    // THE INCLINATION INTO A CARVE, held by the skier and his legs together
    // against the ground: toward the lean the bend's own load asks for —
    // atan(v²κ / g), the way a bicycle leans — and no further than
    // `skier.rollPacked`; in powder toward the roll the edge asks for
    // outright, which is the whole turn there. Stiffly, and giving out past
    // a radian — a skier well over is going over and nothing holds him.
    const packed = c.packed;
    // The load the bend actually puts on him: what the edge asks for, and
    // never more than the grip can hold — a ski over-edged at speed skids,
    // and a skier does not lay himself down for a turn he is not getting.
    const lateral = Math.min(c.way * c.way * Math.abs(kappa), cornerGrip(spec, packed) * pressed);
    const incline = Math.atan2(lateral, g) * Math.sign(c.edge);
    const target =
      clamp(incline, -K.rollPacked, K.rollPacked) * packed + c.steer * K.rollPowder * (1 - packed);
    const hold = clamp((1.3 - Math.abs(rollRel)) / 0.4, 0, 1);
    // Stated on the reference pair and scaled by this one's weight times
    // its height: the moment a bend puts on a body goes as both.
    const heave = (m * spec.cogHeight) / (totalMass(SKIS) * SKIS.cogHeight);
    // TURN WITH YOUR WEIGHT: in deep powder the buried edges hold nothing
    // and the snow under the skis gives on whichever side is loaded, so the
    // hold the edges gave is gone and THE SOFT SIDE GIVES — a skier rolled
    // off the snow's own plane sinks on his low side and rolls further, a
    // moment against him of `deepTip` times his own weight at his CoG
    // height per radian. Most of it down in the snow (the skis' sink over
    // their rest sink), `deepPlaning` of it planing on top; none on the
    // groomer. What holds him up is his weight, which the edge moves.
    const loose =
      bottomless *
      (1 - packed) *
      (K.deepPlaning + (1 - K.deepPlaning) * clamp(midSink / Math.max(1e-6, restMid), 0, 1));
    const firm = 1 - K.deepHold * loose;
    // Only snow skied onto at a pace gives: a skier stopped or crawling
    // stands in snow he has already pressed to hold him.
    const moving = clamp((speed0 - K.deepTipFrom) / (K.deepTipFull - K.deepTipFrom), 0, 1);
    if (loose > 0 && moving > 0) {
      tb.z -= K.deepTip * loose * moving * m * g * spec.cogHeight * Math.sin(rollRel) * hold;
    }
    tb.z +=
      clamp(
        K.rollStiff * (rollRel - target) - K.rollDamp * c.wz,
        -K.rollMax * ARC.hangOff,
        K.rollMax * ARC.hangOff,
      ) *
      heave *
      hold *
      firm;
    // THE FORE-AFT BALANCE (`skier.pitchStiff`): the body held square to
    // the slope under him — toward the lean the thumb asks — against the
    // brake's and the snow's pull at his feet, which would otherwise fold
    // him over the tips in every skid. Tips up is a negative rate about x,
    // so a body pitched too far up is brought down by a positive torque.
    const pitchRel = Math.asin(
      clamp(fwd.x * normal.x + fwd.y * normal.y + fwd.z * normal.z, -1, 1),
    );
    tb.x +=
      (clamp(K.pitchStiff * (pitchRel - K.leanPitch * c.lean), -K.pitchMax, K.pitchMax) -
        K.pitchDamp * c.wx) *
      (I.x / inertiaOf(SKIS).x) *
      hold;
    // THE YAW HELD (`steer.yawHold`): toward the rate the carve asks for,
    // no more than the grip can turn the way at, and the body held to the
    // way it is actually going.
    const way = c.way;
    const flat = hypot(c.vx, c.vz);
    const reach =
      Math.abs(way) > 1 ? (cornerGrip(spec, packed) * pressed * S.pathShare) / Math.abs(way) : 0;
    const asked = clamp(way * kappa, -reach, reach);
    const slip = flat > S.slipFrom && way > 0 ? angleDiff(Math.atan2(c.vx, c.vz), c.heading) : 0;
    // Stated in N·m on the reference pair and scaled by this one's yaw
    // inertia: a hand on the yaw is an ACCELERATION.
    const heft = I.y / inertiaOf(SKIS).y;
    // THE SCRUB (`steer.scrub`): the bend the edges ask for on the groomer
    // is paid out of the way — the grooves they cut through it — at the
    // CoG, so it turns nothing. Powder already charges for what it is
    // shoved aside by (the plough).
    if (flat > 1) {
      const scrub = S.scrub * (1 - CV.scrubSpared * c.carve) * packed * m * Math.abs(asked * way);
      fx -= (scrub * c.vx) / flat;
      fz -= (scrub * c.vz) / flat;
    }
    tb.y +=
      clamp(-S.yawHold * (c.wy - asked) - S.slipHold * slip, -S.yawHoldMax, S.yawHoldMax) *
      heft *
      hold *
      state.assist.yaw;
  } else {
    airTorque(c, tb, state.assist.air, landingAhead(c, level, flightGravity(state.rules)));
  }
  // Euler's equations with a diagonal inertia: τ − ω × Iω. Only on the
  // snow: a skier in the air is no rigid rod — he holds his shape with his
  // limbs — and a body as thin as his (its yaw inertia a third of its
  // pitch and roll) spun for a 360 fed every wobble the levelling hands
  // made back through the coupling until the spin was a tumble. Thrown,
  // the ragdoll has its own physics and this body is the skis'. A body
  // going over on the snow is on the snow (`airborne`, as the hips above).
  const gyro = c.airborne && c.thrown === null ? 0 : 1;
  const gx = gyro * (I.z - I.y) * c.wy * c.wz;
  const gy = gyro * (I.x - I.z) * c.wz * c.wx;
  const gz = gyro * (I.y - I.x) * c.wx * c.wy;
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
  const hullHit = chassisContacts(c, level, depth, state.fresh, drop);
  const hullTouch = hullHit > 0;
  if (hullHit > impact) impact = hullHit;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  c.z += c.vz * dt;
  c.q = integrate(c.q, c.wx, c.wy, c.wz, dt);
  // THE POP: the legs straightened under him, straight off the snow's own
  // normal — an ollie, not a hop in the world's up.
  if (pop > 0) {
    level.normalAt(c.x, c.z, normal);
    c.vx += pop * normal.x;
    c.vy += pop * normal.y;
    c.vz += pop * normal.z;
    c.popped = 0;
    events.push({ kind: "jump", t: state.t, pop, held: loaded });
  }

  // ── Air and landing ───────────────────────────────────────────────────
  c.landing += dt;
  if (!grounded && !hullTouch) {
    if (!c.airborne) {
      c.airborne = true;
      c.airTime = 0;
      c.launchVy = vy0;
      c.airReported = false;
    }
    c.airTime += dt;
    if (!c.airReported && c.airTime >= TUNING.air.counts) {
      c.airReported = true;
      events.push({ kind: "air", t: state.t, vy: c.launchVy, speed: hypot3(vx0, vy0, vz0) });
    }
  } else if (c.airborne) {
    const flew = c.airTime;
    c.airborne = false;
    c.airTime = 0;
    if (flew >= TUNING.air.counts) {
      const lost = landingLoss(impact, harshSpeedOf(spec) * harshShare(c));
      if (lost > 0) {
        // The legs folded to their stop take it out of the way along the slope.
        level.normalAt(c.x, c.z, normal);
        const vn = c.vx * normal.x + c.vy * normal.y + c.vz * normal.z;
        c.vx = (c.vx - vn * normal.x) * (1 - lost) + vn * normal.x;
        c.vy = (c.vy - vn * normal.y) * (1 - lost) + vn * normal.y;
        c.vz = (c.vz - vn * normal.z) * (1 - lost) + vn * normal.z;
      }
      c.landing = 0;
      // THE LANDING'S LOAD (`landingLoad`): the fall into the slope stopped
      // over the legs and whatever loose snow lies under the skis — and how
      // true they came down to the slope, which the load decides is enough
      // or not (`crash.ts`).
      level.normalAt(c.x, c.z, normal);
      const loose = TUNING.snow.cover * depth * (1 - c.packed);
      const load = landingLoad(impact, c.crouch, loose);
      const off = landingOff(
        rotate(c.q, { x: 0, y: 0, z: 1 }),
        rotate(c.q, { x: 1, y: 0, z: 0 }),
        normal,
        c.vx,
        c.vz,
      );
      events.push({
        kind: "land",
        t: state.t,
        airTime: flew,
        impact,
        speed: hypot3(c.vx, c.vy, c.vz),
        harsh: lost > 0,
        lost,
        g: load,
        off,
      });
    }
  }

  derive(c);
  // ── The automatic reset's clocks (`run.ts` acts on them) ──────────────
  const upright = rotate(c.q, { x: 0, y: 1, z: 0 }).y;
  c.overFor = upright < TUNING.reset.overUp ? c.overFor + dt : 0;
  c.stuckFor = input.tuck > 0.5 && c.speed < TUNING.reset.stuckSpeed ? c.stuckFor + dt : 0;
  stepTrench(state, moved, events);
  if (c.hitCooldown > 0) c.hitCooldown -= dt;
  if (c.bumpCooldown > 0) c.bumpCooldown -= dt;
}

/** The readouts derived from the body's state — written once at the end
 * of a step (and by anything that stands a skier somewhere). */
export function derive(c: SkierState): void {
  const e = toEuler(c.q);
  c.heading = e.heading;
  c.pitch = e.pitch;
  c.roll = e.roll;
  c.speed = hypot3(c.vx, c.vy, c.vz);
  const f = rotate(c.q, { x: 0, y: 0, z: 1 });
  const fl = hypot(f.x, f.z) || 1;
  c.way = (c.vx * f.x + c.vz * f.z) / fl;
}
