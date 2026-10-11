// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE'S COCKPIT, DECIDED (`plane-cockpit.ts` builds it,
// `plane-cockpit-paint.ts` paints its faces) — three-free, so the suite
// reads it.
//
// The cockpit is laid out as the class's is (`PLANE`: the single turboprop
// STOL utility plane mountain drop zones fly): the pilot in the LEFT seat,
// a second seat on the right with its own dual stick and pedals; a CONTROL
// STICK between each pilot's knees (no yoke); the rudder PEDALS on a
// footwell ramp under the panel; a grey instrument panel under a black
// glareshield — a late panel's two GLASS DISPLAYS (the primary flight
// display in front of the pilot, the multi-function display with the
// engine's page in the middle) with the three STANDBY instruments between
// them, a row of annunciators over the middle, the radios on the right,
// the switches along the foot; the three ENGINE LEVERS sliding out of a
// quadrant at the panel's lower middle — the propeller (left), the POWER
// (middle) and the condition (right) — and the FLAP lever beside them; the
// pitch TRIM WHEEL overhead between the seats; a wet compass on the
// glareshield. The long cowling runs out ahead past the
// windscreen's foot; the wing roots and struts frame the side windows.
//
// THE FRAME is the plane's body frame (`PLANE`: y up from the ground datum,
// z forward) AS THE PICTURE SHOWS IT: x to the right as seen from the seat.
// The engine's x is the mirror of that (the picture mirrors the map, as
// `cockpit-plan.ts` says of the helicopter's), so a point here is the
// engine's with x turned over (`bodyOf`), and `plane-cockpit.ts` draws the
// cockpit under a mirror — the pilot's left seat is the engine's +x, the
// jump door on his right the engine's −x. Every length in metres, every
// angle in radians.

import { PLANE, type PlaneControls, type PlaneState } from "@engine";

import { bodyOf, joint } from "./cockpit-plan.ts";

export { bodyOf, joint };

const FLOOR = PLANE.cabin.floor;
/** The cabin's roof inside the skin over the cockpit, m. */
const ROOF = 2.6;

export const PLANE_COCKPIT = {
  /** THE PILOT'S EYES in the left seat (`PLANE.pilotEye`, mirrored); how
   * far the head looks down off the fuselage line in the air and on the
   * snow (the nose high on its tail ski, he looks down over the cowling's
   * side), how far it turns into a turn per rad/s of yaw rate and per rad
   * of bank, rad, at most `turnMost`. */
  eye: { x: -PLANE.pilotEye.x, y: PLANE.pilotEye.y, z: PLANE.pilotEye.z },
  look: { air: 0.13, ground: 0.1, turn: 0.32, bank: 0.12, turnMost: 0.36 },
  /** The lens's vertical fov, deg, and the least horizontal fov a tall
   * screen is widened to, deg, up to `tallMost`. */
  fov: 70,
  wideLeast: 80,
  tallMost: 100,

  /** THE SEATS: their middles across, the cushion's back and front edge
   * along z and its top, the width; the back's lean off the vertical and
   * its height. */
  seat: { x: 0.3, back: 0.28, front: 0.72, top: FLOOR + 0.36, width: 0.44, lean: 0.14, tall: 0.7 },
  /** The floor's foot ramp: where it starts rising under the seats' front,
   * and where and how high it meets the firewall. */
  footwell: { from: 0.78, to: 1.24, rise: 0.14 },
  /** The cabin's roof over the cockpit inside, the firewall's face. */
  roof: ROOF,
  firewall: PLANE.cowling.back - 0.06,

  /** THE PANEL: its face's foot on z, its bottom and top edge, its
   * half-width, its lean back off the vertical; the glareshield over it —
   * how far it overhangs the face toward the pilot, and where its top
   * meets the windscreen's foot when the model's glass is not read. */
  panel: { z: 1.14, bottom: 1.6, top: 2.04, half: 0.5, lean: 0.18 },
  glare: { over: 0.09, foot: { z: 1.27, y: 2.2 } },
  /** THE GLASS on the panel, m across from its middle and up from its foot
   * (each rectangle's middle and its size): the primary flight display in
   * front of the pilot, the multi-function display in the middle, the
   * standby strip between them, the annunciators over the middle. */
  screens: {
    pfd: { x: -0.29, y: 0.25, w: 0.21, h: 0.158 },
    mfd: { x: 0.04, y: 0.25, w: 0.21, h: 0.158 },
    standby: { x: -0.125, y: 0.24, w: 0.07, h: 0.21 },
    lights: { x: 0.04, y: 0.375, w: 0.3, h: 0.034 },
  },

  /** THE STICKS: the pilot's pivot on the floor between his knees and the
   * second seat's, the stick's length to the grip's foot, the grip's
   * length, its aft cant at rest; the travel full stick swings it, rad. */
  stick: { x: -0.3, y: FLOOR + 0.04, z: 0.78, length: 0.6, grip: 0.12, cant: 0.06 },
  stickTravel: { pitch: 0.24, roll: 0.22 },
  /** THE ENGINE LEVERS: out of the quadrant under the panel's middle,
   * their x (the propeller, the power, the condition), their pivot low in
   * the quadrant, the lever's length to the knob, and its lean aft off the
   * vertical at flight idle and at full power, rad — pushed forward. */
  levers: {
    x: [-0.075, -0.02, 0.035],
    y: 1.36,
    z: 0.98,
    length: 0.36,
    idle: 0.9,
    full: 0.35,
    /** Where the propeller and the condition stand (both full forward in
     * flight), as a share from the back stop. */
    set: { prop: 1, condition: 1 },
    /** The quadrant's curved top the levers come out of: its radius about
     * their pivot, the lean it runs between, rad, and its half-width
     * across from its middle (`mid`). */
    face: { radius: 0.3, from: 0.3, to: 1.05, mid: 0.01, half: 0.13 },
  },
  /** THE FLAP LEVER beside them in the same quadrant: its x, its length,
   * and its lean aft at flaps up and full, rad. */
  flapLever: { x: 0.105, length: 0.33, up: 0.95, full: 0.4 },
  /** THE PEDALS: each pair's middle across (the pilot's, mirrored for the
   * second seat), the gap from it to each pedal, their height and place
   * along z; how far full pedal pushes one and draws back the other, m. */
  pedals: { x: -0.3, gap: 0.12, y: FLOOR + 0.22, z: 1.16, travel: 0.07 },
  /** THE TRIM WHEEL overhead between the seats: its middle, radius and
   * width, and how far it turns over the trim's whole travel, rad. */
  trim: { x: 0, y: ROOF - 0.13, z: 0.26, radius: 0.1, width: 0.035, turn: 5 },
  /** The overhead console forward of it: its half-width, its face's
   * height, from and to along z. */
  overhead: { half: 0.14, y: ROOF - 0.07, from: -0.05, to: 0.44 },
  /** The wet compass on the glareshield's middle. */
  compass: { y: 2.26, z: 1.2 },

  /** THE PILOT (whose eyes the lens is): where his shoulders and hips
   * are, half their spread, the limbs' lengths. */
  pilot: {
    shoulder: { y: PLANE.pilotEye.y - 0.27, z: PLANE.pilotEye.z - 0.12, half: 0.18 },
    hip: { y: FLOOR + 0.46, z: 0.4, half: 0.11 },
    upperArm: 0.31,
    forearm: 0.28,
    thigh: 0.45,
    shin: 0.46,
  },
} as const;

type V3 = { x: number; y: number; z: number };

/** WHETHER A POINT IN THE BODY FRAME is in the cabin — an eye there sees
 * the cockpit rather than the airframe from outside. */
export function inPlaneCabin(p: V3): boolean {
  const C = PLANE.cabin;
  return (
    Math.abs(p.x) < C.width / 2 &&
    p.y > C.floor &&
    p.y < ROOF &&
    p.z > C.back &&
    p.z < PLANE_COCKPIT.firewall
  );
}

/** WHERE THE CONTROLS STAND, in the cockpit's frame: the stick's swing
 * fore (+, forward) and to the right as seen (+), each pedal's push
 * forward, m, the power lever's and the flap lever's lean aft,
 * rad, and the trim wheel's turn, rad. The engine's right is the picture's
 * left, so its roll and rudder are turned over here. */
export type ControlPose = {
  stickPitch: number;
  stickRoll: number;
  pedalLeft: number;
  pedalRight: number;
  power: number;
  flap: number;
  trim: number;
};

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function controlPose(c: PlaneControls, trim = c.trim ?? 0): ControlPose {
  const C = PLANE_COCKPIT;
  const pedal = clamp(c.yaw, -1, 1) * C.pedals.travel;
  const L = C.levers;
  const F = C.flapLever;
  return {
    stickPitch: clamp(c.pitch, -1, 1) * C.stickTravel.pitch,
    stickRoll: -clamp(c.roll, -1, 1) * C.stickTravel.roll,
    pedalLeft: pedal,
    pedalRight: -pedal,
    power: L.idle + clamp(c.throttle, 0, 1) * (L.full - L.idle),
    flap: F.up + clamp(c.flaps, 0, 1) * (F.full - F.up),
    trim: clamp(trim, -1, 1) * C.trim.turn * 0.5,
  };
}

/** Where a stick's grip is (the hand's hold: its middle), cockpit frame,
 * under `pose` — the pilot's, or the second seat's (`side` +1). */
export function stickGrip(pose: ControlPose, side: -1 | 1 = -1): V3 {
  const S = PLANE_COCKPIT.stick;
  const r = S.length + S.grip * 0.5;
  const fore = -S.cant + pose.stickPitch;
  const across = pose.stickRoll;
  return {
    x: -side * S.x + Math.sin(across) * Math.cos(fore) * r,
    y: S.y + Math.cos(across) * Math.cos(fore) * r,
    z: S.z + Math.sin(fore) * r,
  };
}

/** Where an engine lever's knob is, cockpit frame, leant `angle` aft
 * (lever `k`: 0 the propeller, 1 the power, 2 the condition, −1 the flap
 * lever, its `length` its own). */
export function leverKnob(angle: number, k = 1, length: number = PLANE_COCKPIT.levers.length): V3 {
  const L = PLANE_COCKPIT.levers;
  return {
    x: k < 0 ? PLANE_COCKPIT.flapLever.x : L.x[k],
    y: L.y + Math.cos(angle) * length,
    z: L.z - Math.sin(angle) * length,
  };
}

/** The angle the propeller and the condition levers stand at. */
export function setLever(share: number): number {
  const L = PLANE_COCKPIT.levers;
  return L.idle + share * (L.full - L.idle);
}

/** WHAT THE INSTRUMENTS READ, in the units the panel is marked in:
 * the indicated airspeed and the true, kt; the altitude ft over the sea
 * and ft over the snow; the climb ft/min; the heading deg; the attitude
 * rad (pitch nose-up positive, roll right-wing-down positive as seen);
 * the turn rate deg/s and the slip (the ball, −1..1 to the right) — every
 * one AS SEEN, the engine's heading and roll turned over; the angle of
 * attack deg and the load g; the engine's torque %, the turbine's ITT °C,
 * the gas generator's Ng %, the propeller's rpm, the fuel flow kg/h, the
 * oil's pressure psi and temperature °C, the fuel kg; the flaps' share and
 * the trim's; the outside air °C — and the lights lit. */
export type PlaneGauges = {
  ias: number;
  tas: number;
  alt: number;
  agl: number;
  vsi: number;
  heading: number;
  pitch: number;
  roll: number;
  turn: number;
  slip: number;
  aoa: number;
  load: number;
  torque: number;
  itt: number;
  ng: number;
  rpm: number;
  flow: number;
  oilP: number;
  oilT: number;
  fuel: number;
  flaps: number;
  trim: number;
  power: number;
  oat: number;
  /** The warnings and cautions: the stall's horn, the door open, the
   * brakes on, the low fuel, the generator off (the engine not turning). */
  stall: boolean;
  door: boolean;
  brake: boolean;
  gen: boolean;
  /** Whether the engine runs (the screens lit), and whether it is on the
   * snow. */
  live: boolean;
  grounded: boolean;
};

const KT = 1.943844;
const FT = 3.28084;

/** THE READINGS off the plane's state: `ground` the snow's height under
 * it, m, and `clock` the run's time (the needles' tremble). */
export function planeGaugesOf(p: PlaneState, ground: number, clock: number): PlaneGauges {
  const live = p.mode !== "wreck" && p.spin > 0.05;
  const tas = p.airspeed * KT;
  const ias = tas * Math.sqrt(Math.max(0.2, p.density) / 1.225);
  const tremble = live ? 0.4 * Math.sin(clock * 21.3) + 0.3 * Math.sin(clock * 33.1) : 0;
  const spin = p.mode === "wreck" ? 0 : p.spin;
  const thrust = Math.max(0, p.thrust);
  // The torque on the shaft: the power over the propeller's turn, its
  // share of the rated torque at the rated rpm.
  const torque = live ? clamp((p.power / Math.max(0.3, spin)) * 100 + tremble, 0, 130) : 0;
  const datum = PLANE.cog.y;
  return {
    ias: ias < 20 ? 0 : ias,
    tas,
    alt: (p.y + datum) * FT,
    agl: Math.max(0, p.agl) * FT,
    vsi: p.vy * 60 * FT,
    heading: ((((-p.heading * 180) / Math.PI) % 360) + 360) % 360,
    pitch: p.pitch,
    roll: -p.roll,
    turn: (-p.wy * 180) / Math.PI,
    slip: clamp(-p.slip * 3, -1, 1),
    aoa: (p.aoa * 180) / Math.PI,
    load: p.load,
    torque,
    itt: live ? 460 + p.power * 260 + (thrust / PLANE.engine.staticThrust) * 40 + tremble * 2 : 15,
    ng: live ? clamp(64 + p.power * 34 + tremble * 0.2, 0, 104) : spin * 60,
    rpm: spin * PLANE.prop.rpm + (live ? tremble * 3 : 0),
    flow: live ? 70 + p.power * 130 : 0,
    oilP: live ? 85 + p.power * 20 : 0,
    oilT: live ? 62 + p.power * 14 : 8,
    fuel: PLANE.fuel,
    flaps: p.surfaces.flaps,
    trim: p.trim,
    power: p.power,
    oat: 8 - 0.0065 * (p.y + datum),
    stall: live && !p.grounded && p.stalled > 0.15,
    door: p.door > 0.05,
    brake: p.grounded && (p.controls.brake ?? 0) > 0.1,
    gen: !live,
    live,
    grounded: p.grounded,
  };
}

/** HOW FAR THE PILOT'S HEAD LOOKS DOWN off the fuselage line, rad, and how
 * far it turns into a turn, rad — toward the engine's +x positive, the way
 * a positive yaw rate turns the plane. */
export function planeHeadOf(p: PlaneState): { down: number; turn: number } {
  const L = PLANE_COCKPIT.look;
  const turn = p.grounded ? 0 : clamp(p.wy * L.turn + p.roll * L.bank, -L.turnMost, L.turnMost);
  return { down: p.grounded ? L.ground : L.air, turn };
}

/** The vertical fov, deg, the cockpit is seen at on a screen `aspect`
 * wide: its own, widened on a tall screen until it sees `wideLeast` deg
 * across — at most `tallMost`. */
export function planeCockpitFov(aspect: number): number {
  const C = PLANE_COCKPIT;
  const wide = (C.wideLeast * Math.PI) / 180;
  const need = (2 * Math.atan(Math.tan(wide / 2) / Math.max(0.1, aspect)) * 180) / Math.PI;
  return clamp(Math.max(C.fov, need), C.fov, C.tallMost);
}
