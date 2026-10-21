// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRACKED CARRIER'S DRIVER'S CAB, DECIDED (`carrier-cab.ts` builds it,
// `cab-paint.ts` paints its faces) — three-free, so the suite reads it.
//
// The carrier is the articulated over-snow carrier's class (`ARMY_VEHICLE`'s
// carrier; `army-vehicle-shapes.ts` its hull): two tracked units on a
// steered hitch, the driver and his mates in the front unit's cab. Its cab
// is laid out as that class's is: the driver in the LEFT seat, a car's
// steering wheel on a raked column (the wheel works the hitch's steering
// rams), the automatic gearbox's selector on the engine's cover — the
// engine sits forward between the two front seats under a padded hump —
// and an accelerator and a brake pedal; the dashboard across the cab under
// a flat windscreen split by a centre post, the instrument cluster in front
// of the wheel (the speedometer, the tachometer, the coolant's temperature,
// the oil's pressure, the fuel, the battery's volts and a row of warning
// lamps), the switch panel in the middle, a radio set on the mate's side;
// a heater and its ducts, the wipers parked on the screen's foot, a roof
// hatch over the mate, a grab handle, a fire extinguisher by the door.
//
// THE FRAME is the carrier's front unit as `army-vehicle-shapes.ts` builds
// it and `army-vehicle-view.ts` draws it: y up from the snow under its
// middle, z forward, x the engine's right — which the picture shows on the
// LEFT from the seat (`input-model.ts`'s sign boundary). The driver sits on
// the picture's left, so at +x. Every length in metres, every angle in
// radians.

import { ARMOUR, ARMY_VEHICLE } from "@engine";

type V3 = { x: number; y: number; z: number };

/** The side the driver sits on, as a sign of x (the picture's left). */
export const DRIVER_SIDE = 1;

const SEAT_X = ARMOUR.cabs.carrier.seat.x;
const W = ARMY_VEHICLE.kinds.carrier.halfWidth;

export const CARRIER_CAB = {
  /** THE DRIVER'S EYES (the HELMET rung): sat up in the left seat. The
   * lens's vertical fov, deg. */
  eye: { x: SEAT_X, y: 2.02, z: -0.5 },
  fov: 70,

  /** THE CAB INSIDE: its half-width at the walls, the floor, the
   * headliner, the wall behind the front seats (the passengers' bay is
   * behind it, open to the cab above the seat backs). */
  inner: { half: W - 0.16, floor: 1.0, roof: 2.17, back: -1.5 },
  /** THE WINDSCREEN: its foot and head (y, z) and its half-width; the
   * centre post's width and the frame's. */
  screen: { foot: { y: 1.5, z: 0.43 }, head: { y: 2.12, z: 0.08 }, half: W - 0.2, post: 0.05 },
  frame: 0.045,
  /** THE SIDE WINDOWS: their sill and head and their run along z. */
  side: { lo: 1.57, hi: 1.99, from: -0.9, to: 0.0 },

  /** THE DASHBOARD: its top at the screen's foot, its face leant back to
   * `face` at its foot; the cluster's face in front of the wheel. */
  dash: { top: 1.5, back: 0.33, foot: { y: 1.16, z: 0.22 }, half: W - 0.17 },
  /** THE CLUSTER's middle on the dash's face (x, and up the face from its
   * foot, m) and its size; the switch panel's and the radio's. */
  cluster: { x: SEAT_X, up: 0.17, w: 0.5, h: 0.22 },
  switches: { x: 0.02, up: 0.14, w: 0.3, h: 0.2 },
  radio: { x: -0.42, up: 0.15, w: 0.34, h: 0.15, depth: 0.2 },

  /** THE STEERING WHEEL: its hub, its rim's radius and grip, the column's
   * rake off the vertical (the wheel leant back at the top), its foot in
   * the dash; how far a full lock turns it. */
  wheel: { x: SEAT_X, y: 1.55, z: -0.1, r: 0.2, grip: 0.016, rake: 0.55, lock: 2.4 },
  column: { y: 1.3, z: 0.16 },

  /** THE ENGINE'S COVER between the front seats: half its width, its top,
   * from and to along z; the gear selector on its driver's side. */
  hump: { half: 0.19, top: 1.42, from: -0.85, to: 0.3 },
  selector: { x: 0.24, y: 1.42, z: -0.34, lever: 0.15 },
  /** THE PEDALS: the accelerator (on his right, toward the hump) and the
   * brake, their middle across, their pad's height and place along z;
   * how far each goes down. */
  pedals: { gas: SEAT_X - 0.1, brake: SEAT_X + 0.08, y: 1.08, z: 0.2, travel: 0.06 },

  /** THE SEATS: the driver's and the mate's — the cushion's middle across,
   * its top, its middle along z, its width and depth, the back's height
   * and lean. */
  seat: { x: SEAT_X, top: 1.32, z: -0.72, width: 0.48, depth: 0.46, tall: 0.62, lean: 0.2 },
  mate: -SEAT_X,

  /** THE DRIVER (whose eyes the lens is): his shoulders and hips, half
   * their spread, the limbs' lengths. */
  driver: {
    shoulder: { y: 1.86, z: -0.62, half: 0.19 },
    hip: { y: 1.4, z: -0.7, half: 0.11 },
    upperArm: 0.31,
    forearm: 0.29,
    thigh: 0.45,
    shin: 0.46,
  },
} as const;

/** WHERE THE CONTROLS STAND as he drives: the wheel turned (rad, toward
 * the engine's right positive), the accelerator and the brake pressed,
 * 0..1 — off his vehicle's eased controls (`ArmourRide`). */
export type CabPose = { wheel: number; gas: number; brake: number; reverse: boolean };

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function cabPose(r: { steer: number; drive: number }, speed: number): CabPose {
  const C = CARRIER_CAB;
  const d = clamp(r.drive, -1, 1);
  // Driving against the way it rolls is the brake; with it, the gas.
  const against = speed * d < -0.05;
  return {
    wheel: clamp(r.steer, -1, 1) * C.wheel.lock,
    gas: against ? 0 : Math.abs(d),
    brake: against ? Math.abs(d) : 0,
    reverse: d < -0.05 && speed < 0.3,
  };
}

/** The wheel's frame: its hub, the axis it turns about (toward the
 * driver), and the rim's up and across at rest. */
export function wheelFrame(): { hub: V3; axis: V3; up: V3; across: V3 } {
  const C = CARRIER_CAB.wheel;
  const s = Math.sin(C.rake);
  const c = Math.cos(C.rake);
  return {
    hub: { x: C.x, y: C.y, z: C.z },
    // The column runs down and forward; the wheel's face looks up and back.
    axis: { x: 0, y: s, z: -c },
    up: { x: 0, y: c, z: s },
    across: { x: 1, y: 0, z: 0 },
  };
}

/** A point on the rim at `clock` rad round from its top (toward +x, the
 * driver's left, positive), the wheel turned `turn` rad toward the
 * engine's right — its rim's top carried toward +x with it. */
export function rimAt(clock: number, turn: number, inset = 0): V3 {
  const f = wheelFrame();
  const a = clock + turn;
  const r = CARRIER_CAB.wheel.r - inset;
  const u = Math.cos(a) * r;
  const v = Math.sin(a) * r;
  return {
    x: f.hub.x + f.up.x * u + f.across.x * v,
    y: f.hub.y + f.up.y * u + f.across.y * v,
    z: f.hub.z + f.up.z * u + f.across.z * v,
  };
}

/** HIS HANDS ON THE WHEEL: at ten to two, turned with it, and back to
 * ten to two past a quarter turn — a driver shuffles the rim through his
 * hands rather than crossing his arms. His left hand (+x) and his right. */
export function handsOnWheel(turn: number): { left: V3; right: V3 } {
  const held = clamp(turn, -1.1, 1.1);
  return { left: rimAt(1.05, held, 0.005), right: rimAt(-1.05, held, 0.005) };
}

/** WHAT THE CLUSTER READS: the speed, km/h; the engine's turn, rpm; the
 * coolant, °C; the oil's pressure, bar; the fuel, a share; the battery,
 * V; the lamps lit; whether the engine runs. */
export type CabGauges = {
  kmh: number;
  rpm: number;
  coolant: number;
  oil: number;
  fuel: number;
  volts: number;
  reverse: boolean;
  park: boolean;
  dead: boolean;
};

/** THE READINGS off his vehicle: `speed` m/s, `drive` the eased pedal,
 * `t` the run's time (the needles' tremble), `dead` knocked out. */
export function cabGauges(
  speed: number,
  drive: number,
  t: number,
  dead: boolean,
  top: number,
): CabGauges {
  const kmh = Math.abs(speed) * 3.6;
  const load = Math.abs(drive);
  const tremble = dead ? 0 : 18 * Math.sin(t * 29.3) + 11 * Math.sin(t * 47.1);
  // An automatic: the engine's turn climbs through each gear with the
  // speed and the pedal, and drops back as it shifts up.
  const share = clamp(Math.abs(speed) / Math.max(1, top), 0, 1);
  const gears = 4;
  const inGear = (share * gears) % 1;
  const rpm = dead ? 0 : 800 + load * 900 + inGear * 1500 * (0.4 + 0.6 * load) + tremble;
  return {
    kmh: kmh < 0.4 ? 0 : kmh,
    rpm: clamp(rpm, 0, 4200),
    coolant: dead ? 40 : 84 + load * 6,
    oil: dead ? 0 : 2.2 + (rpm / 4000) * 2.6,
    fuel: 0.68,
    volts: dead ? 23.6 : 27.8,
    reverse: drive < -0.05 && Math.abs(speed) < 0.3,
    park: Math.abs(speed) < 0.05 && load < 0.05,
    dead,
  };
}
