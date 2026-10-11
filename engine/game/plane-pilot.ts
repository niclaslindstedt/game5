// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT'S HANDS ON THE JUMP PLANE — the same controls the player has
// (`PlaneControls`: the throttle, the stick, the rudder, the flaps, the
// brakes and the trim) and nothing more, flown by a pilot who knows the
// machine: what a link's pre-roll and the labs fly the player's plane with
// (`planeFlight`: off the strip, up the valley in a climbing circuit, then
// in over the mountain to the jump run's orbit), what flies the plane home
// and lands it after the jump (`homeControls`), and the hand that turns any
// plane back from the map's edge (`boundsHand`). That it flies the bare
// physics at all is the proof the player can.
//
// A CASCADE, as a pilot flies: where it is to go → the heading → the bank
// that turns it there → the ailerons against the roll's rate; the height
// (held over the snow ahead) → the climb → the flight path → the pitch →
// the elevator against the pitch's rate, its steady share wound into the
// TRIM so the stick comes back to the middle; the speed → the throttle (or,
// climbing on full power, the pitch); the sideslip → the rudder. On the
// snow the rudder and the tail ski hold the strip's line, the stick raises
// the tail and then rotates, and on the roll-out the brakes stop it.
//
// Pure over the state; draws nothing from the stream.

import { angleDiff, clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { PLANE } from "./defs/plane.ts";
import { TUNING } from "./defs/tuning.ts";
import { airstripOf, type Airstrip } from "./airstrip.ts";
import { NEUTRAL_INPUT, type GameState, type SkierInput } from "./state.ts";
import type { PlaneControls, PlaneState } from "./plane-state.ts";

const P = PLANE.pilot;
const dt = TUNING.dt;
/** THE HANDS' GAINS (kept out of `PLANE`, which the model is built off):
 * the bank per rad of heading off and the most bank, rad; the ailerons per
 * rad of bank off and per rad/s of roll rate; the stick per rad of pitch
 * off and per rad/s of pitch rate, and the trim wound in a second per unit
 * of stick; the pitch per rad of flight path off; the climb per metre of
 * height off, 1/s (and down the glide path), and the most climb and
 * sink, m/s; the throttle per m/s of speed off; the rudder per rad of
 * sideslip; the climb's flight path, rad, and how much steeper a m/s over
 * the climb speed; the most angle of attack it pulls to, rad, and the
 * flaps' more, the stick forward a rad past it and the seconds of the
 * pitch's rate read ahead into it, and the bank past which the stick is
 * never pulled, rad; the climbing circuit's radius and how far along the
 * strip either way its legs reach, m; how far ahead the snow is read, s;
 * the height kept over it, m. */
export const HANDS = {
  heading: 1.3,
  bank: 0.55,
  roll: 2.2,
  rollRate: 0.9,
  pitch: 3.2,
  pitchRate: 1.4,
  trim: 0.6,
  path: 1.6,
  height: 0.2,
  glideHeight: 0.4,
  climb: 6,
  sink: 8,
  speed: 0.09,
  slip: 3.5,
  climbPath: 0.12,
  aoaMost: 0.17,
  aoaFlaps: 0.05,
  guard: 6,
  lead: 0.25,
  steep: 1.0,
  climbSpeed: 0.03,
  circuit: 300,
  reach: 700,
  look: 20,
  over: 120,
} as const;
const H = HANDS;

/** WHAT THE HANDS FLY TO: a heading, rad; either a height, m (held by the
 * throttle on the speed), or `climb` on full power (the speed held by the
 * pitch); the speed, m/s; the flaps' share. */
export type PlaneWant = {
  heading: number;
  height: number;
  speed: number;
  flaps: number;
  climb?: boolean;
  /** The shallowest path flown climbing, rad (just off the snow: up). */
  floor?: number;
  /** The climb asked a metre of height off, 1/s (`HANDS.height` else). */
  gain?: number;
  /** With `climb`, the throttle held (full else) — at idle, a glide flown
   * at `speed` on the pitch. */
  throttle?: number;
};
type Want = PlaneWant;

/** The flight path's angle, rad, and the speed over the ground's and the
 * air's mean, m/s. */
function pathOf(p: PlaneState): number {
  const v = Math.max(1, hypot3(p.vx, p.vy, p.vz));
  return Math.asin(clamp(p.vy / v, -1, 1));
}

/** The highest snow under the way it is going over the next `H.look` s. */
function snowAhead(run: GameState, p: PlaneState): number {
  const level = run.level;
  let top = level.groundAt(p.x, p.z);
  const v = Math.max(20, hypot(p.vx, p.vz));
  const ux = p.vx / Math.max(1, hypot(p.vx, p.vz));
  const uz = p.vz / Math.max(1, hypot(p.vx, p.vz));
  for (let i = 1; i <= 8; i++) {
    const d = (i / 8) * H.look * v;
    top = Math.max(top, level.groundAt(p.x + ux * d, p.z + uz * d));
  }
  return top;
}

/** THE STICK AND THE AILERONS to a bank and a pitch, and the trim wound
 * after the stick — gains scaled by the air's push on the surfaces. */
function attitude(
  p: PlaneState,
  bank: number,
  pitch: number,
): { roll: number; pitch: number; trim: number } {
  const v = Math.max(18, p.airspeed);
  const f = clamp((42 / v) ** 2, 0.35, 3);
  const rollRate = -p.wz;
  const pitchRate = -p.wx;
  const roll = clamp(f * (H.roll * angleDiff(p.roll, bank) - H.rollRate * rollRate), -1, 1);
  let stick = clamp(-f * (H.pitch * (pitch - p.pitch) - H.pitchRate * pitchRate), -1, 1);
  // Never pulled past the wing's angle (a pilot's feel for the buffet):
  // the stick eased forward of it, the flaps' share of stall added.
  const most = H.aoaMost + H.aoaFlaps * p.surfaces.flaps;
  // Read ahead on the pitch's rate, so a nose coming up fast is checked
  // before the wing gets there.
  const ahead = p.aoa + H.lead * pitchRate;
  if (!p.grounded && ahead > most) stick = Math.max(stick, clamp(H.guard * (ahead - most), 0, 1));
  // Steeply banked, the wings come level before the stick comes back.
  if (Math.abs(p.roll) > H.steep) stick = Math.max(stick, 0);
  const trim = clamp(p.trim + H.trim * stick * dt, -1, 1);
  return { roll, pitch: stick, trim };
}

/** THE WHOLE HAND IN THE AIR to `w` — what the labs and the suite fly a
 * plane steadily with too (`planeHold`). */
export function planeHold(run: GameState, w: PlaneWant): PlaneControls {
  return flyTo(run, run.plane!, w);
}

function flyTo(run: GameState, p: PlaneState, w: Want): PlaneControls {
  // STALLED (or spinning): the power off, the stick forward, the ailerons
  // centred and the rudder against the turn, until the wing flies again.
  if (p.stalled > 0.4 && !p.grounded) {
    return {
      throttle: 0,
      pitch: 0.6,
      roll: 0,
      yaw: clamp(-3 * p.wy, -1, 1),
      flaps: w.flaps,
      brake: 0,
      trim: clamp(p.trim + 0.5 * dt, -1, 1),
    };
  }
  // The way it is going over the snow (the wind's drift in it), not where
  // its nose points.
  const flat = hypot(p.vx, p.vz);
  const track = flat > 10 ? Math.atan2(p.vx, p.vz) : p.heading;
  const turn = angleDiff(track, w.heading);
  const bank = clamp(H.heading * turn, -H.bank, H.bank);
  const v = Math.max(15, p.airspeed);
  const gamma = pathOf(p);
  let throttle: number;
  let path: number;
  const now = clamp((p.power - PLANE.engine.idle) / (1 - PLANE.engine.idle), 0, 1);
  if (w.climb) {
    throttle = w.throttle ?? 1;
    // The climb's own path, steeper faster than the climb speed and
    // shallower slower (the speed held on the pitch).
    path = clamp(
      (w.throttle ?? 1) * H.climbPath + H.climbSpeed * (v - w.speed),
      w.floor ?? (w.throttle !== undefined ? -0.4 : -0.05),
      0.3,
    );
  } else {
    const vs = clamp((w.gain ?? H.height) * (w.height - p.y), -H.sink, H.climb);
    path = Math.asin(clamp(vs / v, -0.6, 0.6));
    throttle = clamp(now + H.speed * (w.speed - v), 0, 1);
  }
  const pitch = clamp(p.pitch + H.path * (path - gamma), -0.35, 0.45);
  const hand = attitude(p, bank, pitch);
  return {
    throttle,
    pitch: hand.pitch,
    roll: hand.roll,
    yaw: clamp(H.slip * p.slip, -1, 1),
    flaps: w.flaps,
    brake: 0,
    trim: hand.trim,
  };
}

/** THE HAND THAT TURNS A PLANE BACK FROM THE EDGE (`airBounds`): banked
 * toward the map's middle, its flight path held level or climbing, the
 * power kept on — blended over whoever flies it by how deep in the band it
 * is (`plane.ts`). */
export function boundsHand(
  p: PlaneState,
  heading: number,
): { roll: number; yaw: number; pitch: number; throttle: number } {
  const bank = clamp(H.heading * angleDiff(p.heading, heading), -0.6, 0.6);
  const gamma = pathOf(p);
  const pitch = clamp(p.pitch + H.path * (Math.max(0, gamma) - gamma), -0.35, 0.45);
  const hand = attitude(p, bank, pitch);
  return { roll: hand.roll, yaw: clamp(H.slip * p.slip, -1, 1), pitch: hand.pitch, throttle: 0.75 };
}

/** ON THE SNOW: the strip's line held on the rudder and the tail ski;
 * taking off, the tail raised and then rotated; stopping, the brakes on
 * and the stick back. */
function onSnow(
  p: PlaneState,
  heading: number,
  go: boolean,
  line: { x: number; z: number },
): PlaneControls {
  // The strip's centre line held: steered back onto it from either side.
  const right = (p.x - line.x) * Math.cos(heading) - (p.z - line.z) * Math.sin(heading);
  const turn = angleDiff(p.heading, heading - clamp(0.06 * right, -0.25, 0.25));
  const yaw = clamp(3 * turn - 1.2 * p.wy, -1, 1);
  const v = p.airspeed;
  if (!go) {
    // The stick held back to keep the tail ski down only once it is too
    // slow to fly off again.
    const back = clamp((P.tailUp - v) / 5, 0, 1);
    return { throttle: 0, pitch: -back, roll: 0, yaw, flaps: 0, brake: 1, trim: 0 };
  }
  // Sat on its tail ski until the tail flies, then the tail eased up to a
  // few degrees (never shoved — the mains are just ahead of the CoG and it
  // noses over), and at the rotation speed lifted off just short of the
  // stall.
  const pitch = v < P.rotate ? (v > P.tailUp ? P.tailPitch : p.pitch) : P.liftPitch;
  const hand = attitude(p, 0, pitch);
  return {
    throttle: 1,
    pitch: clamp(hand.pitch, -1, P.shove),
    roll: hand.roll,
    yaw,
    flaps: P.flapsOff,
    brake: 0,
    trim: 0,
  };
}

/** A STADIUM to fly round: its near leg from `lo` to `hi` along (tx, tz)
 * from the origin (ox, oz), flown that way; its far leg `2R` off it along
 * (nx, nz), flown back; half circles of radius `R` joining them. The
 * heading that holds it from wherever the plane is (pulled onto the
 * nearer leg from off it). */
function stadium(
  p: PlaneState,
  ox: number,
  oz: number,
  tx: number,
  tz: number,
  nx: number,
  nz: number,
  lo: number,
  hi: number,
  R: number,
): number {
  const t = (p.x - ox) * tx + (p.z - oz) * tz;
  const n = (p.x - ox) * nx + (p.z - oz) * nz;
  let dt_ = 0;
  let dn = 0;
  const k = 1 / 150;
  if (t > hi || t < lo) {
    const ot = t > hi ? hi : lo;
    const rt = t - ot;
    const rn = n - R;
    const r = Math.max(1, hypot(rt, rn));
    const ut = rt / r;
    const un = rn / r;
    const pull = clamp(k * (r - R), -1.5, 1.5);
    dt_ = -un - pull * ut;
    dn = ut - pull * un;
  } else if (n < R) {
    dt_ = 1;
    dn = -clamp(k * n, -1.5, 1.5);
  } else {
    dt_ = -1;
    dn = -clamp(k * (n - 2 * R), -1.5, 1.5);
  }
  return Math.atan2(dt_ * tx + dn * nx, dt_ * tz + dn * nz);
}

/** The circuit flown up the valley while it climbs (a stadium along the
 * strip, its far leg toward the mountain): the heading that holds it. */
function circuitHeading(run: GameState, p: PlaneState, strip: Airstrip): number {
  const level = run.level;
  const tx = Math.sin(strip.heading);
  const tz = Math.cos(strip.heading);
  const top = level.mountain?.summit ?? { x: level.size / 2, z: 0 };
  let nx = tz;
  let nz = -tx;
  if ((top.x - strip.x) * nx + (top.z - strip.z) * nz < 0) {
    nx = -nx;
    nz = -nz;
  }
  const R = H.circuit;
  const band = P.edge;
  // The ends along the strip's line, held inside the map.
  const reach = (dir: number): number => {
    let d = 0;
    while (d < level.size) {
      const x = strip.x + tx * dir * (d + 50);
      const z = strip.z + tz * dir * (d + 50);
      if (x < band + R || x > level.size - band - R || z < band + R || z > level.size - band - R)
        break;
      d += 50;
    }
    return d;
  };
  // Over the valley floor near the strip, never far along it.
  const hi = Math.max(R, Math.min(H.reach, reach(1)));
  const lo = -Math.max(R, Math.min(H.reach, reach(-1)));
  return stadium(p, strip.x, strip.z, tx, tz, nx, nz, lo, hi, R);
}

/** THE JUMP RUN: over the mountain's upper face, `pilot.jumpHeight` m over
 * the summit — the spot the player's stand-in flies to and orbits. */
export function jumpSpotOf(run: GameState): { x: number; y: number; z: number } {
  const level = run.level;
  const strip = airstripOf(level);
  const top = level.mountain?.summit ?? { x: level.size / 2, y: 600, z: level.size / 4 };
  const band = TUNING.bounds.air.plane / 2 + 300;
  const x = clamp(top.x + (strip.x - top.x) * 0.3, band, level.size - band);
  const z = clamp(top.z + (strip.z - top.z) * 0.3, band, level.size - band);
  return { x, y: top.y + P.jumpHeight, z };
}

/** Whether the straight way from where it is to (x, z) clears the snow by
 * `H.over` at the climb it can make. */
function clearWay(run: GameState, p: PlaneState, x: number, z: number): boolean {
  const level = run.level;
  const d = hypot(x - p.x, z - p.z);
  for (let i = 1; i <= 24; i++) {
    const s = (i / 24) * d;
    const gx = p.x + ((x - p.x) * s) / d;
    const gz = p.z + ((z - p.z) * s) / d;
    if (level.groundAt(gx, gz) + 2 * H.over > p.y + 0.08 * s) return false;
  }
  return true;
}

/** THE PLAYER'S STAND-IN (a pre-roll, the labs): off the strip, climbing
 * up the valley's circuit until the way in over the mountain is clear,
 * then to the jump run and round it. Never jumps. */
export function planeFlight(run: GameState): PlaneControls {
  const p = run.plane;
  if (!p) return { throttle: 0, pitch: 0, roll: 0, yaw: 0, flaps: 0 };
  const strip = airstripOf(run.level);
  if (p.grounded && p.agl < 2) return onSnow(p, strip.heading, true, strip);
  const spot = jumpSpotOf(run);
  const ground = run.level.groundAt(p.x, p.z);
  // Straight ahead off the strip until it is clear of it — over the snow
  // AND over the strip, so snow rising ahead never sends it back.
  const low = p.y - ground < P.clear && p.y - strip.y < P.clear;
  if (low) {
    return flyTo(run, p, {
      heading: strip.heading,
      height: 0,
      speed: P.climb,
      flaps: P.flapsOff,
      climb: true,
      floor: p.y - ground < 15 ? 0.03 : -0.05,
    });
  }
  const d = hypot(spot.x - p.x, spot.z - p.z);
  if (d < 900 && p.y > spot.y - 80) {
    // ROUND THE SPOT, clockwise, at the jump run's speed.
    const r = Math.max(1, d);
    const ux = (p.x - spot.x) / r;
    const uz = (p.z - spot.z) / r;
    const pull = clamp((r - 600) / 150, -1.2, 1.2);
    const heading = Math.atan2(-uz - pull * ux, ux - pull * uz);
    return flyTo(run, p, { heading, height: spot.y, speed: P.jumpRun, flaps: P.flapsRun });
  }
  // Snow rising ahead as high as it is flying: back over the strip.
  const boxed = snowAhead(run, p) + H.over / 3 > p.y;
  const heading = boxed
    ? Math.atan2(strip.x - p.x, strip.z - p.z)
    : clearWay(run, p, spot.x, spot.z)
      ? Math.atan2(spot.x - p.x, spot.z - p.z)
      : circuitHeading(run, p, strip);
  if (p.y < spot.y - 40) {
    return flyTo(run, p, { heading, height: spot.y, speed: P.climb, flaps: 0, climb: true });
  }
  return flyTo(run, p, {
    heading,
    height: Math.max(spot.y, snowAhead(run, p) + H.over),
    speed: P.cruise,
    flaps: 0,
  });
}

/** The player's stand-in as a skier's input (`sim/bot.ts`). */
export function planeInput(run: GameState): SkierInput {
  return { ...NEUTRAL_INPUT, plane: planeFlight(run) };
}

/** THE PILOT FLYING HOME after the jump: round the landing circuit (a
 * stadium beside the strip — the downwind leg out, the base turn, and the
 * final down the centre line), down the glide path to the threshold, the
 * flare, and the roll-out stopped with the brakes on the strip's line. */
export function homeControls(run: GameState, p: PlaneState): PlaneControls {
  const strip = airstripOf(run.level);
  const L = strip.land;
  const lx = Math.sin(L.heading);
  const lz = Math.cos(L.heading);
  if (p.grounded && p.agl < 1.5) return onSnow(p, L.heading, false, L.threshold);
  const T = L.threshold;
  // How far past the threshold along the landing (negative before it) and
  // to the side of the centre line (the circuit's side positive).
  const nx = lz * L.side;
  const nz = -lx * L.side;
  const u = (p.x - T.x) * lx + (p.z - T.z) * lz;
  const e = (p.x - T.x) * nx + (p.z - T.z) * nz;
  const off = Math.abs(angleDiff(p.heading, L.heading));
  const glideAt = (out: number): number => T.y + Math.max(0, out - P.aim) * Math.tan(P.glide);
  const gate = glideAt(L.final);
  if (u > -L.final - 150 && u < strip.length && Math.abs(e) < 150 && off < 0.7) {
    // ON FINAL: the centre line and the glide path, then the flare.
    const heading = L.heading - clamp(0.012 * e * L.side, -0.4, 0.4);
    if (p.agl < P.flare && u > -400) {
      const vs = -Math.max(1.1, 0.35 * p.agl);
      const v = Math.max(15, p.airspeed);
      const gamma = pathOf(p);
      const pitch = clamp(p.pitch + H.path * (Math.asin(vs / v) - gamma), -0.05, 0.2);
      const hand = attitude(p, 0, pitch);
      return {
        throttle: 0,
        pitch: hand.pitch,
        roll: hand.roll,
        yaw: clamp(3 * angleDiff(p.heading, L.heading) + H.slip * p.slip, -1, 1),
        flaps: P.flapsLand,
        brake: 0,
        trim: hand.trim,
      };
    }
    return flyTo(run, p, {
      heading,
      height: glideAt(-u),
      speed: P.approach,
      flaps: P.flapsLand,
      gain: H.glideHeight,
    });
  }
  const R = P.circuit;
  const heading = stadium(p, T.x, T.z, lx, lz, nx, nz, -L.final, 0, R);
  const far = Math.abs(e - R) > 3 * R || u < -L.final - 3 * R || u > 3 * R;
  const height = Math.max(gate, snowAhead(run, p) + (far ? H.over : 60));
  return flyTo(run, p, {
    heading,
    height: far ? Math.max(height, gate + 100) : height,
    speed: far ? 45 : 38,
    flaps: far ? 0 : P.flapsRun,
  });
}
