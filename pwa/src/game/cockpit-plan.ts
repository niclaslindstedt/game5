// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER'S COCKPIT, DECIDED (`heli-cockpit.ts` builds it,
// `cockpit-paint.ts` paints its faces) — three-free, so the suite reads it.
//
// The cabin is the light single-engine utility helicopter's (`HELI`,
// `scripts/blender/heli.py`), and its cockpit is laid out as that class's
// is: the pilot in the RIGHT front seat; a T-shaped instrument panel — a
// wide upper panel under a black glareshield hood, the flight instruments
// in front of the pilot, the engine display in the middle where both front
// seats read it, and a centre PEDESTAL dropping from it to the floor and
// running aft between the seats, the radios on its sloping face; the
// CYCLIC standing between the pilot's knees; the COLLECTIVE lying beside
// the seat on his left, its twist-grip throttle and switch box on its end;
// the anti-torque PEDALS under the panel, seen through the chin windows;
// the OVERHEAD console with its switches and breakers, the rotor brake and
// the fuel shut-off hanging off it; a wet compass on the windscreen's
// centre strip. The left front seat is the guide's, empty here.
//
// THE FRAME is the helicopter's body frame (`HELI`: y up from the skid
// datum, z forward) AS THE PICTURE SHOWS IT: x to the right as seen from
// the seat. The engine's x is the mirror of that (`input-model.ts`'s sign
// boundary: three.js's view from behind MIRRORS the map), so a point here
// is the engine's with x turned over (`bodyOf`), and `heli-cockpit.ts`
// draws the cockpit under a mirror. The pilot sits in the right seat as he
// does in the real machine — on the far side from the skier's skid.
// Every length in metres, every angle in radians.

import { HELI, type HeliControls, type HeliState } from "@engine";

const FLOOR = HELI.body.floor;

export const COCKPIT = {
  /** THE PILOT'S EYES: in the right seat, sat up with a helmet on; how far
   * the head looks down from the airframe's level in cruise and at the
   * hover (where the pilot looks out of the chin windows), and how far it
   * turns into a turn per rad/s of yaw rate, rad·s, at most `turnMost`. */
  eye: { x: 0.44, y: 1.9, z: 1.52 },
  look: { cruise: 0.2, hover: 0.42, turn: 0.22, turnMost: 0.3 },
  /** The lens's vertical fov, deg, and the least horizontal fov a tall
   * screen is widened to, deg, up to `tallMost`. */
  fov: 70,
  wideLeast: 78,
  tallMost: 100,

  /** THE SEATS: the pilot's (right) and the guide's (left) — the cushion's
   * middle across, its back and front edge along z, its top, its width;
   * the back's lean off the vertical and its height. The rear bench's
   * front edge and its cushion's top. */
  seat: { x: 0.44, back: 1.3, front: 1.78, top: FLOOR + 0.42, width: 0.48, lean: 0.2, tall: 0.72 },
  bench: { front: 0.86, back: 0.36, top: FLOOR + 0.43 },
  /** The wall at the back of the cabin, z. */
  bulkhead: 0.3,

  /** THE UPPER PANEL: its face's foot on z, its bottom and top edge, its
   * half-width, its lean back off the vertical; the glareshield's hood
   * over it — how far it overhangs the face toward the pilot, and where
   * its top meets the windscreen's foot. */
  panel: { z: 2.36, bottom: 1.24, top: 1.58, half: 0.68, lean: 0.22 },
  glare: { over: 0.1, lip: 0.035, foot: { z: 2.7, y: 1.5 } },
  /** THE PEDESTAL: its half-width at the panel and between the seats; its
   * sloped radio face from the panel's foot down and aft to `aft` at
   * `knee`, and the floor console on aft from there to `end`. */
  pedestal: { half: 0.13, aftHalf: 0.1, aft: 1.86, knee: FLOOR + 0.36, end: 1.05 },

  /** THE CYCLIC: its pivot on the floor between the pilot's knees, the
   * stick's length to the grip's foot, the grip's length, its forward
   * cant at rest; the travel full cyclic swings it, rad. */
  cyclic: { x: 0.44, y: FLOOR + 0.08, z: 1.9, length: 0.5, grip: 0.13, cant: 0.08 },
  cyclicTravel: { pitch: 0.2, roll: 0.16 },
  /** THE COLLECTIVE: its pivot beside the seat on the pilot's left, its
   * length to the grip, the lever's angle over the floor down and up, rad. */
  collective: { x: 0.165, y: FLOOR + 0.38, z: 1.3, length: 0.6, down: 0.1, up: 0.45 },
  /** THE PEDALS: the pair's middle across and the gap from it to each
   * pedal, their height and place along z; how far full pedal pushes one
   * and draws back the other, m. */
  pedals: { x: 0.44, gap: 0.15, y: FLOOR + 0.2, z: 2.4, travel: 0.06 },

  /** THE OVERHEAD CONSOLE: its half-width, its face's height, from and to
   * along z; the two levers hanging from it. */
  overhead: { half: 0.17, y: HELI.body.roof - 0.13, from: 1.3, to: 2.22 },
  /** The wet compass on the windscreen's centre strip. */
  compass: { y: 2.12, z: 2.66 },

  /** THE PILOT (whose eyes the lens is): where his shoulders and hips
   * are, half their spread, the limbs' lengths. */
  pilot: {
    shoulder: { y: 1.67, z: 1.47, half: 0.19 },
    hip: { y: FLOOR + 0.5, z: 1.42, half: 0.11 },
    upperArm: 0.33,
    forearm: 0.29,
    thigh: 0.46,
    shin: 0.47,
  },
} as const;

/** A point of the cockpit's frame in the engine's body frame. */
export function bodyOf(p: { x: number; y: number; z: number }): {
  x: number;
  y: number;
  z: number;
} {
  return { x: -p.x, y: p.y, z: p.z };
}

/** WHETHER A POINT IN THE BODY FRAME is in the cabin — an eye there sees
 * the cockpit rather than the airframe from outside. */
export function inCabin(p: { x: number; y: number; z: number }): boolean {
  const B = HELI.body;
  return (
    Math.abs(p.x) < B.width / 2 - 0.05 &&
    p.y > B.floor &&
    p.y < B.roof - 0.05 &&
    p.z > COCKPIT.bulkhead &&
    p.z < B.nose - 0.6
  );
}

/** WHERE THE CONTROLS STAND for a hand on them, in the cockpit's frame:
 * the cyclic's swing fore (+, forward) and to the right as seen (+), the
 * collective's angle over the floor, and each pedal's push forward, m —
 * the pedal on the side the nose is turned to pushed. The engine's right
 * is the picture's left, so its roll and pedal are turned over here. */
export type ControlPose = {
  cyclicPitch: number;
  cyclicRoll: number;
  collective: number;
  pedalLeft: number;
  pedalRight: number;
};

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function controlPose(c: HeliControls): ControlPose {
  const C = COCKPIT;
  const pedal = clamp(c.pedal, -1, 1) * C.pedals.travel;
  return {
    cyclicPitch: clamp(c.pitch, -1, 1) * C.cyclicTravel.pitch,
    cyclicRoll: -clamp(c.roll, -1, 1) * C.cyclicTravel.roll,
    collective:
      C.collective.down + clamp(c.collective, 0, 1) * (C.collective.up - C.collective.down),
    pedalLeft: pedal,
    pedalRight: -pedal,
  };
}

type V3 = { x: number; y: number; z: number };

/** Where the cyclic's grip is, body frame, under `pose` (the hand's hold
 * on it: the grip's middle). */
export function cyclicGrip(pose: ControlPose): V3 {
  const C = COCKPIT.cyclic;
  const r = C.length + C.grip * 0.5;
  const fore = C.cant + pose.cyclicPitch;
  const side = pose.cyclicRoll;
  return {
    x: C.x + Math.sin(side) * Math.cos(fore) * r,
    y: C.y + Math.cos(side) * Math.cos(fore) * r,
    z: C.z + Math.sin(fore) * r,
  };
}

/** Where the collective's grip is, body frame (the twist grip's middle). */
export function collectiveGrip(pose: ControlPose): V3 {
  const C = COCKPIT.collective;
  const r = C.length - 0.06;
  return {
    x: C.x,
    y: C.y + Math.sin(pose.collective) * r,
    z: C.z + Math.cos(pose.collective) * r,
  };
}

/** THE ELBOW OR THE KNEE of a limb from `root` to `end`, `a` and `b` its
 * two lengths, bent toward `pole` (a direction) — the end pulled in to
 * reach where it cannot. */
export function joint(root: V3, end: V3, a: number, b: number, pole: V3): V3 {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const dz = end.z - root.z;
  const d = Math.min(Math.hypot(dx, dy, dz), (a + b) * 0.999);
  const len = Math.hypot(dx, dy, dz) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const uz = dz / len;
  // The share of the reach along it the joint stands at, and how far off it.
  const along = (a * a - b * b + d * d) / (2 * d);
  const off = Math.sqrt(Math.max(0, a * a - along * along));
  // The pole made square to the reach.
  const pd = pole.x * ux + pole.y * uy + pole.z * uz;
  let px = pole.x - ux * pd;
  let py = pole.y - uy * pd;
  let pz = pole.z - uz * pd;
  const pl = Math.hypot(px, py, pz) || 1;
  px /= pl;
  py /= pl;
  pz /= pl;
  return {
    x: root.x + ux * along + px * off,
    y: root.y + uy * along + py * off,
    z: root.z + uz * along + pz * off,
  };
}

/** WHAT THE INSTRUMENTS READ, in the units the panel is marked in:
 * airspeed kt, altitude ft over the sea, the radar altimeter's ft over the
 * snow, the climb ft/min, the heading deg, the attitude rad (pitch nose-up
 * positive, roll right-wing-down positive), the turn rate deg/s and the
 * slip (the ball, −1..1 to the right) — every one AS SEEN, the engine's
 * heading and roll turned over (a turn to the picture's right is a
 * heading growing on the compass); the engine's — the rotor's rpm and
 * the power turbine's %, the torque %, the gas generator's %, the turbine
 * outlet's °C, the fuel %, the outside air °C — and the lights lit. */
export type Gauges = {
  ias: number;
  alt: number;
  radar: number;
  vsi: number;
  heading: number;
  pitch: number;
  roll: number;
  turn: number;
  slip: number;
  nr: number;
  nf: number;
  torque: number;
  ng: number;
  t4: number;
  fuel: number;
  oat: number;
  /** The caution lights: the rotor's rpm low, the engine's first limit
   * reached, a skier on the skid. */
  lowRotor: boolean;
  limit: boolean;
  skid: boolean;
  /** Whether the engine runs (the screens lit). */
  live: boolean;
};

const KT = 1.943844;
const FT = 3.28084;

/** THE READINGS off the machine's state: `ground` the snow's height under
 * it, m, and `clock` the run's time (the needles' tremble). */
export function gaugesOf(h: HeliState, ground: number, clock: number): Gauges {
  const speed = Math.hypot(h.vx, h.vz);
  // The pitot reads the way along the nose; an airspeed indicator of this
  // class reads nothing below some 20 kt.
  const along = h.vx * Math.sin(h.heading) + h.vz * Math.cos(h.heading);
  const ias = Math.max(0, along) * KT;
  const across = -h.vx * Math.cos(h.heading) + h.vz * Math.sin(h.heading);
  const live = h.spool > 0.02 && h.mode !== "wreck";
  const spool = h.mode === "wreck" ? 0 : h.spool;
  const pull = clamp(h.collective, 0, 1);
  const tremble = live ? 0.4 * Math.sin(clock * 23.1) + 0.3 * Math.sin(clock * 37.7) : 0;
  return {
    ias: ias < 1 ? 0 : ias,
    alt: (h.y + HELI.skid.y) * FT,
    radar: Math.max(0, h.y - ground) * FT,
    vsi: h.vy * 60 * FT,
    heading: ((((-h.heading * 180) / Math.PI) % 360) + 360) % 360,
    pitch: h.pitch,
    roll: -h.roll,
    turn: (-h.yawRate * 180) / Math.PI,
    slip: clamp(-across / Math.max(8, speed) + h.roll * 0.3, -1, 1),
    nr: spool * 100 - pull * 1.5 * spool + tremble * 0.2,
    nf: spool * 100 + tremble * 0.15,
    torque: live ? clamp(8 + pull * 92 * spool + tremble, 0, 130) : 0,
    ng: live ? clamp(spool * 68 + pull * 30 * spool + tremble * 0.2, 0, 110) : 0,
    t4: live ? 420 + pull * 360 * spool + tremble * 3 : 15,
    fuel: 75,
    oat: 8 - 0.0065 * h.y,
    lowRotor: live && spool < 0.93,
    limit: live && pull > 0.96,
    skid: h.rider,
    live,
  };
}

/** HOW FAR THE PILOT'S HEAD LOOKS DOWN, rad: out ahead in cruise and down
 * out of the chin windows at the hover and near the snow; and how far it
 * turns into a turn, rad (to the right positive). */
export function headOf(h: HeliState): { down: number; turn: number } {
  const L = COCKPIT.look;
  const speed = Math.hypot(h.vx, h.vz);
  const slow = clamp(1 - (speed - 4) / 16, 0, 1);
  const turn = clamp(h.yawRate * L.turn, -L.turnMost, L.turnMost);
  return { down: L.cruise + (L.hover - L.cruise) * slow, turn };
}

/** The vertical fov, deg, the cockpit is seen at on a screen `aspect`
 * wide: its own, widened on a tall screen until it sees `wideLeast` deg
 * across — at most `tallMost`. */
export function cockpitFov(aspect: number): number {
  const C = COCKPIT;
  const wide = (C.wideLeast * Math.PI) / 180;
  const need = (2 * Math.atan(Math.tan(wide / 2) / Math.max(0.1, aspect)) * 180) / Math.PI;
  return clamp(Math.max(C.fov, need), C.fov, C.tallMost);
}
