// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S VEHICLES TAKEN AND DRIVEN (`armour.ts`): a carrier, a truck
// or a tank of the ground waves (`ARMY_VEHICLE`) that a wanted skier walks
// up to and takes with the machine press, and drives on the vehicle's own
// body and drive (`army-vehicle-body.ts`' `moveVehicle`) — its grade, its
// turn and what stops it are the waves' numbers, never a second copy. What
// is HIS here is how he works it: the pace he gets out of it on the snow,
// where he sits in it and where its door is, how fast he lays a tank's gun,
// and what it takes to knock it out under him. Every number carries its
// unit; `docs/army.md` § *Taken* gives the reasoning beside each block.
//
// THE FRAME of every place is the vehicle's body frame as the engine
// keeps it: y up from the snow under its middle (the front unit's, for the
// carrier), z forward, and x toward its heading's right — which the picture
// shows on the LEFT as seen from the seat (`input-model.ts` owns the
// mirror). The carrier's and the truck's drivers sit on the picture's
// left (x positive here); the tank's on its right, under the hatch the
// hull is built with (`army-vehicle-shapes.ts`).

import type { ArmyVehicleKind } from "./army-vehicle.ts";

type P3 = { x: number; y: number; z: number };

/** One kind's seat and door: where the skier's body is held in the
 * driver's seat (`seat`, his hips), and where its door is on the snow —
 * the side of the hull it opens on (±1, x's sign) and how far along it
 * (`along`, z), m. */
type Cab = { seat: P3; door: { side: 1 | -1; along: number } };

export const ARMOUR = {
  /** TAKING ONE: he must stand within `reach` m of its door, slower than
   * `fastest` m/s; and the vehicle must be standing (slower than `still`
   * m/s) with nobody left to put down out of the back. */
  board: { reach: 2.6, fastest: 2.5, still: 0.6 },
  /** OUT OF IT: on the machine press once it is slower than `fastest` m/s,
   * set down `out` m clear of its side by the door. */
  hop: { fastest: 2, out: 0.9 },

  /** HIS PACE on the snow, m/s — faster than the waves' crews drive up a
   * way they are reading (`ARMY_VEHICLE.kinds[k].cruise`), short of each
   * class's road speed (the carrier some 50 km/h, the truck 85, the tank
   * 70): the articulated carrier on its wide tracks 13 (47 km/h), the
   * truck on its chains 15 (54 km/h), the tank across country 12
   * (43 km/h). Backing, `reverse` of it. */
  top: { carrier: 13, truck: 15, tank: 12 } as Record<ArmyVehicleKind, number>,
  reverse: 0.3,
  /** THE STEER: how far off the heading the full edge asks the way to be,
   * rad — the vehicle's own turn rate (`turn`, and the truck's radius)
   * decides how fast it gets there. */
  steer: 0.9,
  /** How fast his hands come onto the controls, 1/s (a lever's travel). */
  hands: 5,

  /** THE CABS. The carrier's driver sits in the front unit's cab behind
   * its engine nose, the door in its side beside him; the truck's high in
   * the cab-forward cab over the front wheels, a step up to the door; the
   * tank's in the hull's front, in under his hatch, which he climbs onto
   * the glacis to reach. */
  cabs: {
    carrier: { seat: { x: 0.42, y: 0.95, z: -0.3 }, door: { side: 1, along: -0.3 } },
    truck: { seat: { x: 0.6, y: 1.9, z: 2.95 }, door: { side: 1, along: 2.9 } },
    tank: { seat: { x: -0.55, y: 0.7, z: 2.95 }, door: { side: -1, along: 2.6 } },
  } satisfies Record<ArmyVehicleKind, Cab>,

  /** THE TANK'S GUN in his hands: the turret traversed at `traverse`
   * rad/s (the class's 40°/s power traverse, eased: the hand on the
   * controls), the gun elevated at `elevate` rad/s between the waves'
   * `low` and `high`; THE SIGHT'S LINE read out along the bore every
   * `step` m to `sight` m for the first snow or machine it meets (the
   * laser's range), a machine taken within `lock` rad of the line — which
   * the fire control lays the shell onto (`aimPoint`'s superelevation).
   * Its gun is gunfire gun `gun`; its crew of `crew` bail out onto the
   * snow when it is taken at a halt. */
  tank: {
    traverse: 0.55,
    elevate: 0.1,
    sight: 2000,
    step: 8,
    lock: 0.035,
    gun: 97_000,
    crew: 3,
  },

  /** WHAT KNOCKS IT OUT under him (`gunfire-machine.ts`): the rounds'
   * energy that brings each down, J — the carrier's and the truck's thin
   * skins a few belts of a machine gun, the tank's armour never — and the
   * share of it one rocket's or shell's burst is. */
  damage: {
    rounds: { carrier: 140_000, truck: 90_000, tank: Infinity } as Record<ArmyVehicleKind, number>,
    burst: { carrier: 1.2, truck: 1.2, tank: 0.35 } as Record<ArmyVehicleKind, number>,
  },
} as const;
