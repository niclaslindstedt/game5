// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY HELICOPTER'S FLIGHT DECK, DECIDED (`army-heli-cockpit.ts` builds
// it, `army-heli-paint.ts` paints its faces) — three-free, so the suite
// reads it.
//
// The machine is the twin-engined military utility helicopter (`ARMY_HELI`,
// `scripts/blender/army.py`), and its flight deck is laid out as that
// class's is: two pilots side by side in ARMOURED SEATS, the pilot in
// command on the RIGHT, each with his own cyclic between his knees, his
// own collective on his left and his own pedals; one wide instrument panel
// under a glareshield, each pilot's flight instruments in front of him —
// the airspeed, the attitude and the barometric altimeter over the radar
// altimeter, the horizontal situation and the climb — and between them the
// ENGINE INSTRUMENTS AS VERTICAL TAPES (the fuel, the oils, the turbine
// gas temperatures, the gas generators', the rotor's and the power
// turbines' speeds, the torques, a pair a tape), the caution and advisory
// panel over them; on the glareshield's middle the engines' emergency-off
// T-handles and the fire extinguisher's switch, a master caution light
// before each pilot; the LOWER CONSOLE running aft between the seats with
// the radios, the navigation and the flight control computer's panels; the
// UPPER CONSOLE over the pilots' heads with the engines' power levers and
// fuel levers in their quadrant, the rotor brake, the switches and the
// breakers. The chin windows are under the panel, the roof windows over
// their heads.
//
// THE FRAME is the machine's body frame (`ARMY_HELI`: y up from the skid
// datum, z forward) AS THE PICTURE SHOWS IT: x to the right as seen from
// the seat — the engine's x turned over (`bodyOf`), as the light
// helicopter's cockpit is (`cockpit-plan.ts`). Every length in metres,
// every angle in radians.

import { ARMY_HELI, type HeliControls } from "@engine";

const B = ARMY_HELI.body;
const FLOOR = B.floor;

type V3 = { x: number; y: number; z: number };

/** The two seats' sides, as a sign of x as seen: the pilot's (right) and
 * the co-pilot's (left). */
export const PILOT = 1;
export const COPILOT = -1;

export const ARMY_COCKPIT = {
  /** THE PILOT'S EYES: in the right seat, sat up with a helmet on. */
  eye: { x: 0.56, y: 1.86, z: 2.6 },
  /** THE ROOM the model's own cabin is copied in from (`cockpit-shroud.ts`'s
   * `cabinOf`): the floor and the roof, the bulkhead behind the seats, the
   * panel's face. */
  room: { floor: FLOOR, roof: B.roof, bulkhead: ARMY_HELI.cabin.front, panelZ: 3.7, half: 1.3 },

  /** THE SEATS: each one's middle across, the pan's back and front edge
   * along z, its top, its width; the back's lean and its height; the side
   * armour's height over the pan and how far forward it reaches. */
  seat: { x: 0.56, back: 2.2, front: 2.68, top: FLOOR + 0.43, width: 0.52, lean: 0.2, tall: 0.86 },
  armour: { up: 0.42, ahead: 0.32 },

  /** THE PANEL: its face's foot along z, its bottom and top edge, its
   * half-width, its lean back off the vertical; the glareshield's hood over
   * it — how far it overhangs toward the pilots, and its top. */
  panel: { z: 3.72, bottom: 1.1, top: 1.44, half: 0.98, lean: 0.24 },
  glare: { over: 0.14, top: 1.5, reach: 4.08 },

  /** THE LOWER CONSOLE between the seats: its half-width, its top, from
   * the bulkhead to the panel's foot. */
  console: { half: 0.19, top: FLOOR + 0.5, from: 1.95, to: 3.66 },
  /** THE UPPER CONSOLE: its half-width, its face's height, from and to. */
  overhead: { half: 0.3, y: B.roof - 0.14, from: 2.1, to: 3.15 },

  /** THE CYCLIC: its pivot on the floor between each pilot's knees, the
   * stick's length to the grip's foot, the grip's length, its forward cant
   * at rest; the travel full cyclic swings it, rad. */
  cyclic: { y: FLOOR + 0.06, z: 3.02, length: 0.52, grip: 0.15, cant: 0.06 },
  cyclicTravel: { pitch: 0.2, roll: 0.16 },
  /** THE COLLECTIVE: on each pilot's left, its pivot's offset from his
   * seat's middle, its height and place, its length to the grip, the
   * lever's angle over the floor down and up, rad. */
  collective: { off: -0.32, y: FLOOR + 0.36, z: 2.24, length: 0.66, down: 0.1, up: 0.42 },
  /** THE PEDALS: the gap from each pair's middle to each pedal, their
   * height and place along z; how far full pedal pushes one. */
  pedals: { gap: 0.16, y: FLOOR + 0.14, z: 3.55, travel: 0.06 },

  /** THE PILOT (whose eyes the lens is): where his shoulders and hips are,
   * half their spread, the limbs' lengths. */
  pilot: {
    shoulder: { y: 1.6, z: 2.5, half: 0.2 },
    hip: { y: FLOOR + 0.52, z: 2.42, half: 0.11 },
    upperArm: 0.33,
    forearm: 0.3,
    thigh: 0.47,
    shin: 0.48,
  },
} as const;

/** WHETHER A POINT OF THE ENGINE'S BODY FRAME is in the flight deck — an
 * eye there sees the cockpit rather than the airframe from outside. */
export function inDeck(p: V3): boolean {
  return (
    Math.abs(p.x) < B.width / 2 - 0.05 &&
    p.y > FLOOR &&
    p.y < B.roof - 0.05 &&
    p.z > ARMY_HELI.cabin.front &&
    p.z < B.nose - 0.5
  );
}

/** WHERE THE CONTROLS STAND (the light helicopter's reading of them,
 * `cockpit-plan.ts`'s `ControlPose`, on this deck's travel). */
export type DeckPose = {
  cyclicPitch: number;
  cyclicRoll: number;
  collective: number;
  pedalLeft: number;
  pedalRight: number;
};

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function deckPose(c: HeliControls): DeckPose {
  const C = ARMY_COCKPIT;
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

/** The seat's middle across for a side (`PILOT`, `COPILOT`). */
export const seatX = (side: number): number => side * ARMY_COCKPIT.seat.x;

/** Where a side's cyclic grip is (its middle), under `pose`. */
export function deckCyclic(pose: DeckPose, side: number): V3 {
  const C = ARMY_COCKPIT.cyclic;
  const r = C.length + C.grip * 0.5;
  const fore = C.cant + pose.cyclicPitch;
  const across = pose.cyclicRoll;
  return {
    x: seatX(side) + Math.sin(across) * Math.cos(fore) * r,
    y: C.y + Math.cos(across) * Math.cos(fore) * r,
    z: C.z + Math.sin(fore) * r,
  };
}

/** Where a side's collective grip is. */
export function deckCollective(pose: DeckPose, side: number): V3 {
  const C = ARMY_COCKPIT.collective;
  const r = C.length - 0.06;
  return {
    x: seatX(side) + C.off,
    y: C.y + Math.sin(pose.collective) * r,
    z: C.z + Math.cos(pose.collective) * r,
  };
}

/** A side's pedals (left, right), pushed as `pose` has them. */
export function deckPedals(pose: DeckPose, side: number): [V3, V3] {
  const P = ARMY_COCKPIT.pedals;
  const x = seatX(side);
  return [
    { x: x - P.gap, y: P.y, z: P.z + pose.pedalLeft },
    { x: x + P.gap, y: P.y, z: P.z + pose.pedalRight },
  ];
}
