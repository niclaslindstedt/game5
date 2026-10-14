// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREERIDER'S STYLE ON THE DOWNHILL BIKE — what a big-mountain freerider
// does with the bike that the physics never asks for, read off the engine's
// own state as a PURE FUNCTION of it (no memory, no stream), so the bike as
// drawn and the rider on it read the same answer every frame and a lab's
// still shows the moment it asks for:
//
//   WHIP     off a jump long enough to be worth it, the bike thrown
//            sideways under him — the rear swung out and the bike laid
//            nearly flat — his shoulders and eyes kept down the trail, then
//            unwound straight before the wheels come back to the ground;
//   TABLE    the bike laid flat on its side under him with little yaw, the
//            knees tucked to it — the other style a long air gets;
//   FOOT OUT the inside foot off its pedal and forward, low over the dirt,
//            when the bike is laid well over and the tyres are sliding —
//            the flat-pedal rider's drift through a loose turn;
//   BRAKE    his weight driven back and down as the levers are pulled.
//
// Which trick a flight gets is dealt off its TAKE-OFF moment (the run's
// clock less the air time — the same all flight long), and how far through
// it the bike is off the share of the flight flown: the flight's length is
// the air so far plus a ballistic guess at what is left (the bike's centre
// of mass dropped onto the ground the bike rides). Presentation only: the
// engine is never told, so no digest moves.
//
// THE FRAME is the bike's body frame (x the engine's right, y up, z
// forward); the turn `whip` is about the RIDER'S centre of mass, so his
// trunk stays where the engine has him and the bike swings under him.

import { bikeWorldOf, TUNING, type BikeState, type Level } from "@engine";

export type RideTrick = "none" | "whip" | "table";

export type RideStyle = {
  /** The flight's trick, its side (+1 the nose turned to the engine's −x,
   * the rear swung out to its +x) and how far into it the bike is, 0..1. */
  trick: RideTrick;
  side: -1 | 1;
  amount: number;
  /** The bike's turn under him: about its own up axis (`yaw`, +z toward
   * +x positive), then about its own forward axis (`roll`, −y toward +x
   * positive), rad. */
  yaw: number;
  roll: number;
  /** The inside foot off its pedal, 0..1, and which (0 the −x foot). */
  footOut: number;
  foot: 0 | 1;
  /** The levers pulled, 0..1. */
  brake: number;
  /** In the air, the share of the flight flown (the air so far over the
   * air so far plus the fall left), 0..1; 0 on the ground. */
  flight: number;
};

/** THE NUMBERS, after the riders' own photographs and the coaching guides
 * (`docs/downhill-bike.md`): a whip at its peak turns the bike 50–70° off
 * the line and lays it 45–70° over; a table lays it 60–80° with little
 * yaw. A flight shorter than `least` s gets nothing, one past `full` the
 * whole trick; the trick is thrown over the first part of the flight and
 * unwound before `back` of it, and never closer to the ground than
 * `clear` s of fall. */
export const RIDE_STYLE = {
  whip: { yaw: 1.0, roll: 0.95 },
  table: { yaw: 0.25, roll: 1.25 },
  least: 0.4,
  full: 0.8,
  rise: [0.06, 0.38] as const,
  back: [0.6, 0.86] as const,
  clear: 0.16,
  /** The centre of mass over the ground at touchdown, m (a wheel's radius
   * and the bike's centre over its axles). */
  stand: 0.52,
  /** How far ahead the fall is read, s, and its step. */
  look: 4,
  step: 1 / 60,
  /** THE FOOT OUT: the lean it starts at and is whole at, rad; the tyres'
   * slide (`BikeWheel.over`, 1 at the grip's peak) it starts and is whole
   * at; the speed band it is put down in, m/s. */
  foot: { lean: [0.2, 0.36] as const, over: [0.4, 0.8] as const, speed: [2.5, 4, 14, 18] },
};

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A 0..1 hash of a moment, s. */
function dealt(t: number): number {
  let h = Math.round(t * 120) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** The seconds of fall left before the bike's centre of mass is at
 * `RIDE_STYLE.stand` over the ground under it, ballistic. */
export function fallLeft(b: BikeState, level: Level, t: number): number {
  const w = bikeWorldOf(level, t);
  const g = TUNING.g;
  const S = RIDE_STYLE;
  for (let s = 0; s <= S.look; s += S.step) {
    const x = b.x + b.vx * s;
    const z = b.z + b.vz * s;
    const y = b.y + b.vy * s - 0.5 * g * s * s;
    if (y <= w.groundAt(x, z) + S.stand) return s;
  }
  return S.look;
}

/** THE STYLE of the bike `b` on `level` at the run's time `t`. */
export function rideStyleOf(b: BikeState, level: Level, t: number): RideStyle {
  const S = RIDE_STYLE;
  const brake = b.onIt ? Math.max(b.controls.front, b.controls.rear) : 0;
  const out: RideStyle = {
    trick: "none",
    side: 1,
    amount: 0,
    yaw: 0,
    roll: 0,
    footOut: 0,
    foot: 0,
    brake,
    flight: 0,
  };
  if (!b.onIt || b.mode !== "ridden") return out;
  if (b.airborne) {
    const left = fallLeft(b, level, t);
    const flight = b.airTime + left;
    out.flight = flight > 0 ? b.airTime / flight : 0;
    const size = smooth(S.least, S.full, flight);
    if (size <= 0) return out;
    const deal = dealt(t - b.airTime);
    out.trick = deal < 0.72 ? "whip" : "table";
    out.side = deal < 0.36 || (deal >= 0.72 && deal < 0.86) ? 1 : -1;
    const p = b.airTime / flight;
    out.amount =
      size *
      smooth(S.rise[0], S.rise[1], p) *
      (1 - smooth(S.back[0], S.back[1], p)) *
      Math.min(1, left / S.clear);
    const shape = out.trick === "whip" ? S.whip : S.table;
    out.yaw = -out.side * shape.yaw * out.amount;
    out.roll = out.side * shape.roll * out.amount;
    return out;
  }
  // ON THE GROUND: the inside foot out in a slide.
  const lean = Math.abs(b.roll);
  const over = Math.max(b.rear.over, b.front.over * 0.8);
  const [s0, s1, s2, s3] = S.foot.speed;
  const pace = smooth(s0, s1, b.speed) * (1 - smooth(s2, s3, b.speed));
  out.footOut =
    smooth(S.foot.lean[0], S.foot.lean[1], lean) *
    smooth(S.foot.over[0], S.foot.over[1], over) *
    pace;
  // Roll right side down is a lean to the bike's +x: the +x foot
  // (`skier-bike.ts`' feet[1], the pedal then up) is the inside one.
  out.foot = b.roll > 0 ? 1 : 0;
  return out;
}
