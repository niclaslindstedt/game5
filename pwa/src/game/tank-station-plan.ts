// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TANK'S CREW STATIONS, DECIDED (`tank-driver.ts` and `tank-gunner.ts`
// build them, `tank-paint.ts` paints their faces) — three-free, so the
// suite reads it.
//
// The tank is a main battle tank's class (`ARMY_VEHICLE`'s tank). Two of
// its four stations are his:
//
//   * THE DRIVER'S, in the hull's front under his own hatch in the deck
//     (`army-vehicle-shapes.ts`' hull has it on the picture's right). Hatch
//     down he lies back in a reclined seat with his head under the hatch
//     and sees out through VISION BLOCKS: three periscopes in an arc in the
//     hatch's forward rim, the middle one ahead and one each way. He steers
//     with a T-BAR — a handlebar on a column, its grips twisted for the
//     throttle — and brakes with one broad pedal; the transmission's
//     selector is on the bar's middle. His instruments are on his left: a
//     display of the speed, the engine, the gear, the fuel and what is
//     wrong, and a panel of switches and lamps; on his right the hull's
//     wall and its stowage.
//   * THE GUNNER'S, in the turret beside the gun, on the same side as the
//     commander's cupola behind him. He sits on a seat with a chest pad,
//     his face in the brow pad of the PRIMARY SIGHT's eyepiece — the sight
//     looks out of a head on the turret's roof, its line slaved to the gun
//     — his hands on the CONTROL HANDLES (turned for the traverse, tipped
//     for the elevation, a palm switch to power them, a thumb's button for
//     the laser's range and an index finger's trigger), the fire control's
//     panel by his knee (the round chosen, the range, the gun ready), the
//     manual handwheels under the sight, the auxiliary telescope along the
//     gun beside him, the breech and its guard at his shoulder.
//
// LOOKING THROUGH THE SIGHT is a lens of its own: from the sight's head on
// the roof along the gun's line, magnified, the reticle over it — the
// aiming mark, the stadia, the laser's range and the round in a red
// readout under it, the field of view a black circle's edge.
//
// THE FRAMES are the vehicle's body frame (the driver's: y up from the snow
// under its middle, z forward, x the engine's right — the picture's LEFT
// from a seat, `input-model.ts`) and the TURRET's (the same, turned about
// y by the turret's traverse: the drawn turret's frame). Every length in
// metres, every angle in radians.

import { ARMY_VEHICLE, fromEuler, multiply, rotate, type ArmourRide } from "@engine";

import type { LensPose } from "./camera-rigs.ts";
import { rollFor } from "./camera-roll.ts";
import type { Rung } from "./camera-rigs.ts";

type V3 = { x: number; y: number; z: number };

const L = ARMY_VEHICLE.kinds.tank.halfLength;
/** The driver's hatch's middle across (the hull's numbers). */
const HATCH_X = -0.55;

export const TANK_DRIVER = {
  /** HIS EYES, hatch down, at the vision blocks; the lens's fov, deg. */
  eye: { x: HATCH_X, y: 1.34, z: L - 1.02 },
  fov: 74,
  /** THE COMPARTMENT: its sides across (`left` toward the hull's middle,
   * +x), its floor, its roof (the deck's underside), its back, and its
   * front's top and foot along the glacis (y, z). */
  room: {
    left: 0.12,
    right: -1.18,
    floor: 0.48,
    roof: 1.5,
    back: L - 1.75,
    brow: { y: 1.5, z: L - 0.6 },
    toe: { y: 0.55, z: L - 0.2 },
  },
  /** THE VISION BLOCKS: the band of their lower windows (y) and each one's
   * middle across, its place along z and its yaw off the nose (positive
   * toward +x); each window's width. */
  blocks: {
    lo: 1.3,
    hi: 1.46,
    w: 0.2,
    at: [
      { x: HATCH_X + 0.27, z: L - 0.7, yaw: 0.45 },
      { x: HATCH_X, z: L - 0.64, yaw: 0 },
      { x: HATCH_X - 0.27, z: L - 0.7, yaw: -0.45 },
    ],
  },
  /** THE HATCH over his head in the roof: its middle and radius. */
  hatch: { x: HATCH_X, z: L - 0.95, r: 0.3 },
  /** THE T-BAR: the column's foot on the floor, the bar's middle, half
   * its span to the grips; how far it turns at full lock. */
  yoke: { foot: { y: 0.55, z: L - 0.38 }, mid: { y: 1.08, z: L - 0.72 }, half: 0.24, lock: 0.5 },
  /** THE BRAKE PEDAL and the left foot's rest: across, height, along z. */
  pedal: { x: HATCH_X - 0.1, y: 0.6, z: L - 0.42, travel: 0.06 },
  rest: { x: HATCH_X + 0.14, y: 0.56, z: L - 0.4 },
  /** THE SEAT, reclined: the cushion's middle and top, its back's lean. */
  seat: { x: HATCH_X, top: 0.68, z: L - 1.35, width: 0.46, depth: 0.42, tall: 0.6, lean: 0.75 },
  /** THE DISPLAY on his left front, turned to face him: its middle and
   * size; the switch panel under it. */
  display: { x: HATCH_X + 0.48, y: 1.18, z: L - 0.8, w: 0.26, h: 0.18 },
  panel: { x: HATCH_X + 0.52, y: 0.9, z: L - 0.95, w: 0.3, h: 0.2 },
  /** HIS BODY (`seated-figure.ts`): reclined, his head under the hatch. */
  body: {
    shoulder: { y: 1.12, z: L - 1.18, half: 0.19 },
    hip: { y: 0.76, z: L - 1.45, half: 0.11 },
    upperArm: 0.31,
    forearm: 0.29,
    thigh: 0.45,
    shin: 0.46,
  },
} as const;

/** THE PRIMARY SIGHT's head on the turret's roof (turret frame), the lens
 * through it (vertical fov, deg — a day channel's magnification of some
 * five times) and how near the reticle hangs in front of it. */
export const TANK_SIGHT = {
  head: { x: 0.9, y: 2.86, z: 0.72 },
  fov: 13,
  reticle: 0.3,
} as const;

export const TANK_GUNNER = {
  /** HIS EYES, sat back from the eyepiece (the TIPS rung): looking at the
   * sight and his handles, the lens's fov, deg, and its tilt down. */
  eye: { x: 0.92, y: 2.18, z: -0.12 },
  fov: 76,
  down: 0.2,
  /** THE ROOM he sits in, the turret's inside on his side: its sides
   * across (`wall` the turret's, `gun` the breech's guard), its floor
   * (the basket's), its roof, its back and its front. */
  room: { wall: 1.48, gun: 0.32, floor: 1.02, roof: 2.5, back: -1.1, front: 0.9 },
  /** THE SIGHT's body down from the roof to the eyepiece: its middle
   * across and along z, the eyepiece's height and the brow pad's. */
  sight: { x: 0.9, z: 0.5, eyepiece: 2.12, half: 0.12 },
  /** THE CONTROL HANDLES' housing: its middle, the grips' half span. */
  handles: { x: 0.9, y: 1.76, z: 0.28, half: 0.16 },
  /** THE FIRE CONTROL'S PANEL by his left knee, turned to face him. */
  panel: { x: 1.28, y: 1.78, z: 0.42, w: 0.32, h: 0.24 },
  /** THE TURRET'S INDICATOR on the front wall, its middle and radius. */
  azimuth: { x: 1.22, y: 2.22, z: 0.86, r: 0.07 },
  /** THE SEAT and the chest pad. */
  seat: { x: 0.92, top: 1.5, z: -0.38, width: 0.4, depth: 0.36, tall: 0.42, lean: 0.12 },
  chest: { x: 0.92, y: 1.86, z: 0.12 },
  /** THE BREECH (its own frame, about the gun's trunnion): its block's
   * half size and its reach back from the trunnion. */
  breech: { half: 0.26, back: 1.75 },
  /** HIS BODY, leant to the eyepiece. */
  body: {
    shoulder: { y: 1.95, z: -0.18, half: 0.19 },
    hip: { y: 1.58, z: -0.38, half: 0.11 },
    upperArm: 0.31,
    forearm: 0.29,
    thigh: 0.45,
    shin: 0.46,
  },
} as const;

/** WHICH OF THE TANK'S STATIONS THE LENS IS IN: the driver's (HELMET),
 * the gunner's (TIPS), through the sight — or none. */
export type TankStation = "driver" | "gunner" | "sight" | null;

/** How long the lens stays in the sight once his hands come off the
 * gun's controls or it has fired, s. */
export const SIGHT_HOLD = 1.2;
/** How hard the turret must be worked to bring his eye to the sight. */
const WORKED = 0.08;

/** The memory the choice is made with: the seconds since he last worked
 * the gun. */
export type SightMemory = { since: number };

export function createSightMemory(): SightMemory {
  return { since: Infinity };
}

/** THE STATION THE LENS IS IN this frame: on TIPS the gunner's, and
 * through his sight while he lays the gun (the turret traversed, the gun
 * elevated, the trick key held) and `SIGHT_HOLD` s after, or after a shot;
 * on HELMET the driver's, and the sight only while the trick key lays the
 * gun. `t` the run's time, `dt` the frame's. */
export function tankStation(
  m: SightMemory,
  rung: Rung,
  r:
    | (Pick<ArmourRide, "laying" | "traverse" | "elevate" | "rider"> & {
        body: { kind: string; fired: number };
      })
    | null,
  t: number,
  dt: number,
): TankStation {
  if (!r || !r.rider || r.body.kind !== "tank") {
    m.since = Infinity;
    return null;
  }
  const worked =
    r.laying ||
    Math.abs(r.traverse) > WORKED ||
    Math.abs(r.elevate) > WORKED ||
    (t >= r.body.fired && t - r.body.fired < SIGHT_HOLD);
  m.since = worked ? 0 : m.since + dt;
  if (rung === "tips") return m.since < SIGHT_HOLD ? "sight" : "gunner";
  if (rung === "helmet") return r.laying ? "sight" : "driver";
  return null;
}

/** The tank as drawn: its place on the snow, its heading, pitch and roll. */
export type Hull = {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
};

/** A LENS IN THE TURRET: the eye at `eye` of the turret's frame (turned
 * `turret` rad off the hull's nose), looking along the turret's nose
 * raised `el` rad — stood up for the turret's own up, so the horizon tips
 * as the hull leans. */
export function turretLens(h: Hull, turret: number, eye: V3, el: number, fov: number): LensPose {
  const q = multiply(fromEuler(h.heading, h.pitch, h.roll), fromEuler(turret, 0, 0));
  const off = rotate(q, eye);
  const at = { x: h.x + off.x, y: h.y + off.y, z: h.z + off.z };
  const c = Math.cos(el);
  const s = Math.sin(el);
  const fwd = rotate(q, { x: 0, y: s * 30, z: c * 30 });
  const up = rotate(q, { x: 0, y: c, z: -s });
  return {
    eye: at,
    target: { x: at.x + fwd.x, y: at.y + fwd.y, z: at.z + fwd.z },
    fov,
    roll: rollFor(fwd, up),
  };
}

/** THE GUNNER'S EYE (TIPS): sat back from his sight, looking down at it. */
export function gunnerLens(h: Hull, turret: number): LensPose {
  const G = TANK_GUNNER;
  return turretLens(h, turret, G.eye, -G.down, G.fov);
}

/** THROUGH THE SIGHT: from its head on the roof along the gun's line. */
export function sightLens(h: Hull, turret: number, gun: number): LensPose {
  return turretLens(h, turret, TANK_SIGHT.head, gun, TANK_SIGHT.fov);
}

/** WHERE THE T-BAR STANDS as he drives: turned with the steering (rad,
 * toward the engine's right positive), its grips twisted with the drive. */
export function yokePose(r: { steer: number; drive: number }): { turn: number; twist: number } {
  const clamp = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);
  return { turn: clamp(r.steer) * TANK_DRIVER.yoke.lock, twist: Math.max(0, clamp(r.drive)) * 0.6 };
}

/** HIS HANDS ON THE T-BAR'S GRIPS, turned with it: his left (+x) and his
 * right. */
export function handsOnYoke(turn: number): { left: V3; right: V3 } {
  const Y = TANK_DRIVER.yoke;
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  // The bar turns about the column, which is near enough upright at the
  // grips: the left grip comes back as the bar is turned to the right.
  const grip = (side: number): V3 => ({
    x: TANK_DRIVER.eye.x + side * Y.half * c,
    y: Y.mid.y,
    z: Y.mid.z - side * Y.half * s,
  });
  return { left: grip(1), right: grip(-1) };
}

/** WHAT THE DRIVER'S DISPLAY READS: the speed, km/h; the engine, rpm; the
 * gear (R, N, 1–4); the fuel, a share; the coolant, °C; the oil, bar; the
 * battery, V; the turret off the hull's nose, rad; whether it is knocked
 * out. */
export type TankGauges = {
  kmh: number;
  rpm: number;
  gear: string;
  fuel: number;
  coolant: number;
  oil: number;
  volts: number;
  turret: number;
  dead: boolean;
};

export function tankGauges(
  speed: number,
  drive: number,
  turret: number,
  t: number,
  dead: boolean,
  top: number,
): TankGauges {
  const kmh = Math.abs(speed) * 3.6;
  const load = Math.abs(drive);
  const share = Math.min(1, Math.abs(speed) / Math.max(1, top));
  const gears = 4;
  const g = Math.min(gears, 1 + Math.floor(share * gears));
  const inGear = (share * gears) % 1;
  const rpm = dead
    ? 0
    : 700 + load * 600 + inGear * 1500 * (0.4 + 0.6 * load) + 14 * Math.sin(t * 31.7);
  return {
    kmh: kmh < 0.4 ? 0 : kmh,
    rpm,
    gear: dead
      ? "-"
      : speed < -0.1 || drive < -0.05
        ? "R"
        : kmh < 0.4 && load < 0.05
          ? "N"
          : String(g),
    fuel: 0.72,
    coolant: dead ? 40 : 88 + load * 8,
    oil: dead ? 0 : 3 + (rpm / 3000) * 2,
    volts: dead ? 23.4 : 27.9,
    turret,
    dead,
  };
}
