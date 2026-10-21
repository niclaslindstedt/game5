// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CARGO TRUCK'S DRIVER'S CAB, DECIDED (`truck-cab.ts` builds it,
// `truck-paint.ts` paints its faces, `army-vehicle-shapes.ts` builds its
// shell from outside off the same numbers) — three-free, so the suite
// reads it.
//
// The truck is the six-wheel-drive cross-country cargo truck's class
// (`ARMY_VEHICLE`'s truck): a cab forward over the front axle, the engine
// under the cab between the two seats, a canvas tilt over the bed behind.
// Its cab is laid out as that class's is: the driver high in the LEFT seat
// over the front wheel, a big steering wheel laid back nearly flat on its
// column (the steering is powered; the wheel turns some three times lock
// to lock), an automatic gearbox's selector and the transfer box's lever
// on the engine's cover beside him, an accelerator and a broad brake
// pedal (the brakes are air brakes, so no clutch and no handbrake lever:
// the parking brake is the yellow push-pull knob on the dash); the dash
// across the cab under a flat two-pane windscreen, the cluster in front
// of the wheel (the speedometer, the tachometer, the twin needles of the
// two brake circuits' air pressure, the coolant, the fuel, the battery's
// volts and a row of warning lamps), the middle panel with the central
// tyre inflation's selector (the driver lets the tyres down from his seat
// for soft ground and pumps them up again for the road) and the
// differential locks, the radio on the mate's side; big mirrors out on
// arms, read through the side windows; a roof hatch over the mate (the
// class carries a ring mount there), a small window in the back wall onto
// the tilt, a rifle in its clips on the back wall, an extinguisher and a
// first-aid kit.
//
// THE FRAME is the truck's as `army-vehicle-shapes.ts` builds it and
// `army-vehicle-view.ts` draws it: y up from the snow under its middle, z
// forward, x the engine's right — which the picture shows on the LEFT from
// the seat (`input-model.ts`'s sign boundary). The driver sits on the
// picture's left, so at +x. Every length in metres, every angle in
// radians.

import { ARMOUR, ARMY_VEHICLE } from "@engine";

import { cabGauges, type CabGauges, type WheelSpec } from "./army-cab-plan.ts";

const SEAT_X = ARMOUR.cabs.truck.seat.x;
const L = ARMY_VEHICLE.kinds.truck.halfLength;
const W = ARMY_VEHICLE.kinds.truck.halfWidth;

/** The steering wheel: laid back nearly flat, a truck's. */
const WHEEL: WheelSpec = {
  x: SEAT_X,
  y: 2.12,
  z: 3.28,
  r: 0.23,
  grip: 0.018,
  rake: 1.0,
  lock: 2.6,
};

export const TRUCK_CAB = {
  /** THE DRIVER'S EYES (the HELMET rung): sat up high in the left seat.
   * The lens's vertical fov, deg. */
  eye: { x: SEAT_X, y: 2.7, z: 2.98 },
  fov: 70,

  /** THE CAB'S SHELL from outside (`army-vehicle-shapes.ts`): its back,
   * its front at the floor's height and at the roof, its floor's and its
   * roof's heights and its half-width. */
  shell: {
    back: L - 1.85,
    front: L - 0.08,
    frontTop: L - 0.3,
    low: 0.9,
    roof: 3.1,
    half: W - 0.05,
  },

  /** THE CAB INSIDE: its half-width at the walls, the floor, the
   * headliner, the back wall. */
  inner: { half: W - 0.13, floor: 1.45, roof: 3.0, back: L - 1.72 },
  /** THE WINDSCREEN: its foot and head (y, z) and its half-width; the
   * centre post's width and the frame's. */
  screen: {
    foot: { y: 2.22, z: L - 0.13 },
    head: { y: 2.93, z: L - 0.3 },
    half: W - 0.19,
    post: 0.08,
  },
  frame: 0.045,
  /** THE SIDE WINDOWS (in the doors): their sill and head and their run
   * along z — forward far enough that the mirrors out on their arms are
   * read through them. */
  side: { lo: 2.28, hi: 2.86, from: L - 1.45, to: L - 0.42 },
  /** THE DOOR's seam along z, and its step down to the snow. */
  door: { from: L - 1.62, to: L - 0.24 },
  /** THE BACK WALL'S WINDOW onto the tilt: its middle across, its half
   * width, its sill and head. */
  rear: { x: 0, half: 0.32, lo: 2.36, hi: 2.66 },

  /** THE DASHBOARD: its top under the screen's foot, its face leant back
   * to its foot. */
  dash: { top: 2.2, back: L - 0.18, foot: { y: 1.84, z: L - 0.44 }, half: W - 0.14 },
  /** THE CLUSTER's middle on the dash's face (x, and up the face from its
   * foot, m) and its size; the middle panel's, the radio's and the
   * parking brake's knob's. */
  cluster: { x: SEAT_X, up: 0.33, w: 0.5, h: 0.2 },
  middle: { x: 0.0, up: 0.27, w: 0.4, h: 0.26 },
  radio: { x: -0.66, up: 0.24, w: 0.34, h: 0.15, depth: 0.2 },
  park: { x: SEAT_X - 0.33, up: 0.12 },

  /** THE STEERING WHEEL and its column's foot in the dash. */
  wheel: WHEEL,
  column: { y: 1.82, z: L - 0.42 },

  /** THE ENGINE'S COVER between the seats (the engine is under the cab):
   * half its width, its top, from and to along z; the gear selector and
   * the transfer box's lever on its driver's side. */
  hump: { half: 0.28, top: 1.82, from: L - 1.62, to: L - 0.45 },
  selector: { x: 0.35, z: L - 0.92, lever: 0.16 },
  transfer: { x: 0.2, z: L - 0.82, lever: 0.22 },
  /** THE PEDALS: the accelerator (toward the cover) and the broad brake,
   * their middle across, their pad's height and place along z; how far
   * each goes down. */
  pedals: { gas: SEAT_X - 0.13, brake: SEAT_X + 0.06, y: 1.53, z: L - 0.52, travel: 0.06 },

  /** THE SEATS, the driver's and the mate's: the cushion's top, its
   * middle along z, its width and depth, the back's height and lean. */
  seat: { x: SEAT_X, top: 1.92, z: L - 1.24, width: 0.5, depth: 0.48, tall: 0.66, lean: 0.16 },
  mate: -SEAT_X - 0.02,

  /** THE ROOF HATCH over the mate: its middle and radius. */
  hatch: { x: -SEAT_X, z: L - 1.2, r: 0.33 },
  /** THE MIRRORS out on their arms: the glass's middle and size. */
  mirror: { x: W + 0.42, y: 2.55, z: L - 0.45, w: 0.2, h: 0.38 },

  /** THE DRIVER (whose eyes the lens is): his shoulders and hips, half
   * their spread, the limbs' lengths. */
  driver: {
    shoulder: { y: 2.53, z: L - 1.12, half: 0.19 },
    hip: { y: 1.99, z: L - 1.2, half: 0.11 },
    upperArm: 0.31,
    forearm: 0.29,
    thigh: 0.45,
    shin: 0.46,
  },
} as const;

type P3 = { x: number; y: number; z: number };

/** ONE MIRROR'S GLASS, `s` its side (+1 on the driver's): turned on its
 * arm half way between straight back and the driver's eyes, as a mirror
 * is set to show him the road behind. `n` is the way the glass faces and
 * the corners run anticlockwise seen from there. The hull's housing
 * (`army-vehicle-shapes.ts`) and the cab's glass (`truck-cab.ts`) both
 * stand on it. */
export function mirrorGlass(s: 1 | -1): { n: P3; corners: P3[] } {
  const M = TRUCK_CAB.mirror;
  const E = TRUCK_CAB.eye;
  const x = s * M.x;
  const dx = E.x - x;
  const dz = E.z - M.z;
  const d = Math.hypot(dx, dz);
  const nx = dx / d;
  const nz = dz / d - 1;
  const k = Math.hypot(nx, nz);
  const n = { x: nx / k, y: 0, z: nz / k };
  const tx = n.z * (M.w / 2);
  const tz = -n.x * (M.w / 2);
  const h = M.h / 2;
  const at = (a: number, b: number): P3 => ({ x: x + a * tx, y: M.y + b * h, z: M.z + a * tz });
  return { n, corners: [at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)] };
}

/** WHAT THE TRUCK'S CLUSTER AND MIDDLE PANEL READ: the carrier's dials
 * (`cabGauges`) and, over them, the two brake circuits' air (bar) — the
 * reservoirs drawn down as the brakes are used and pumped back up — the
 * tyres' pressure the central inflation holds (bar) and its setting, and
 * the differential locks in. */
export type TruckGauges = CabGauges & {
  air: [number, number];
  tyres: number;
  setting: TyreSetting;
  locks: boolean;
};

/** THE CENTRAL TYRE INFLATION'S SETTINGS, the road's to the lowest the
 * class runs on: the tyres' pressure each holds, bar. */
export const TYRE_SETTINGS = {
  road: 3.5,
  cross: 2.4,
  snow: 1.4,
  stuck: 0.9,
} as const;
export type TyreSetting = keyof typeof TYRE_SETTINGS;

/** THE READINGS off his truck: `speed` m/s, `drive` the eased pedal, `t`
 * the run's time, `dead` knocked out. On the snow the tyres are let down
 * to the snow's setting and the locks are in. */
export function truckGauges(speed: number, drive: number, t: number, dead: boolean): TruckGauges {
  const base = cabGauges(speed, drive, t, dead, ARMOUR.top.truck);
  // The brake pedal held against the way it rolls draws the air down.
  const braking = speed * drive < -0.05 ? Math.min(1, Math.abs(drive)) : 0;
  const air = dead ? 4.2 : 8.1 - braking * 1.1 + 0.05 * Math.sin(t * 0.7);
  return {
    ...base,
    air: [air, air - (dead ? 0.6 : 0.15)],
    tyres: TYRE_SETTINGS.snow,
    setting: "snow",
    locks: !dead,
  };
}
