// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS ON A VEHICLE HE TOOK FROM THE ARMY (`armour.ts`) — three-free,
// so the suite reads it. The ladder's rows are built round a skier a metre
// tall; on a carrier, a truck or a tank they would put the tips lens in
// its hull and the chase in its cab. So while he drives one the ladder is
// framed off THE VEHICLE — its middle `ARMOUR_CENTRE` m over the snow, its
// attitude, its way — on rows of its own a kind, as the piste machine's
// are (`camera-groomer.ts`):
//
//   TIPS    THE NOSE: a lens low on the bow, the snow coming at it;
//   HELMET  THE DRIVER'S EYE — in the carrier's cab over its wheel and
//           dashboard (`carrier-cab.ts`); his head out of the truck's roof
//           hatch and out of the tank's driver's hatch, over the hull;
//   CHASE   behind and over the hull, the whole vehicle in the frame;
//   FAR, HIGH  the same further out, and high over it.

import { ARMY_VEHICLE, fromEuler, rotate, type ArmyVehicle, type ArmyVehicleKind } from "@engine";

import { CARRIER_CAB } from "./army-cab-plan.ts";
import type { Rig, RigPose, Rung } from "./camera-rigs.ts";

/** How far over the snow the pose's centre is, m: the bolted eyes and the
 * booms' heights are over it. */
export const ARMOUR_CENTRE = 1.4;

const boom = (dist: number, height: number, fov: number, clearance: number): Rig => ({
  kind: "boom",
  dist,
  distPerSpeed: 0.15,
  height,
  aimAhead: 12,
  fov,
  fovPerSpeed: 0.25,
  fovMax: fov + 8,
  hold: 0.4,
  surge: 0.6,
  tremor: 0.7,
  yaw: { f: 0.8, zeta: 0.95, r: 0 },
  slipWeight: 0.2,
  lift: { f: 1, zeta: 0.85, r: 2 },
  liftAir: { f: 0.8, zeta: 0.9, r: 2 },
  lagMax: 4,
  incline: 0.4,
  inclineSteep: 0.5,
  ahead: 0.7,
  lean: { f: 0.5, zeta: 1, r: 0 },
  place: 0.2,
  look: { f: 1, zeta: 0.9, r: 0 },
  frame: 0.6,
  clearance,
  ride: 0,
});

/** A bolted eye at (x, y, z) of the vehicle's body frame over the snow
 * under its middle (y from the snow, lowered here onto the centre). */
const bolted = (
  x: number,
  y: number,
  z: number,
  fov: number,
  down: number,
  tremor: number,
): Rig => ({
  kind: "bolted",
  eye: { x, y: y - ARMOUR_CENTRE, z },
  look: 30,
  down,
  fov,
  fovPerSpeed: 0.12,
  rollShare: 0.75,
  tremor,
});

/** THE LADDER ON EACH KIND, every eye in its body frame (x the engine's
 * right, y up, z forward, the origin `ARMOUR_CENTRE` over the snow under
 * its middle). */
export const ARMOUR_RIGS: Record<ArmyVehicleKind, Record<Rung, Rig>> = (() => {
  const K = ARMY_VEHICLE.kinds;
  const E = CARRIER_CAB.eye;
  const rows = (
    nose: Rig,
    helmet: Rig,
    chase: [number, number],
    far: [number, number],
    high: [number, number],
  ): Record<Rung, Rig> => ({
    tips: nose,
    helmet,
    chase: boom(chase[0], chase[1], 60, 2),
    far: boom(far[0], far[1], 56, 3),
    high: boom(high[0], high[1], 56, 4),
    orbit: { kind: "orbit", radius: chase[0] * 1.5, height: chase[1], spin: 0.12, fov: 55 },
  });
  return {
    carrier: rows(
      bolted(0, 1.35, K.carrier.halfLength + 0.1, 76, 0.12, 0.8),
      bolted(E.x, E.y, E.z, CARRIER_CAB.fov, 0.16, 0.45),
      [11, 4.5],
      [20, 8],
      [26, 20],
    ),
    // Head and shoulders out of the cab's roof hatch over the windscreen.
    truck: rows(
      bolted(0, 1.5, K.truck.halfLength + 0.15, 76, 0.1, 0.8),
      bolted(0.55, 3.62, 2.75, 74, 0.2, 0.55),
      [16, 6.5],
      [26, 10],
      [32, 24],
    ),
    // His head out of the driver's hatch in the glacis, the gun over it.
    tank: rows(
      bolted(0, 1.25, K.tank.halfLength + 0.25, 76, 0.1, 0.7),
      bolted(-0.55, 2.25, 2.9, 74, 0.14, 0.5),
      [16, 6],
      [26, 10],
      [32, 24],
    ),
  };
})();

/** The vehicle he drives this frame, if he is in one. */
export function drivenArmour(state: {
  armour?: { rider: boolean; body: ArmyVehicle };
  skier: { thrown: unknown };
}): ArmyVehicle | null {
  if (state.skier.thrown) return null;
  const r = state.armour;
  return r?.rider ? r.body : null;
}

/** THE POSE THE LADDER FRAMES WHILE HE DRIVES, written over `pose`: the
 * vehicle as `at` draws it (its place on the snow, its heading, pitch and
 * roll) or as the engine has it, its way and speed. */
export function armourRigPose(
  pose: RigPose,
  v: ArmyVehicle,
  at: { x: number; y: number; z: number; heading: number; pitch: number; roll: number } | null,
): RigPose {
  const p = at ?? v;
  // The centre up the body's own axis, not the world's: the drawn body
  // turns about the snow under it, so on a slope the bolted eyes stay
  // where its cab is rather than a hand's breadth behind.
  const q = fromEuler(p.heading, p.pitch, p.roll);
  const up = rotate(q, { x: 0, y: ARMOUR_CENTRE, z: 0 });
  pose.x = p.x + up.x;
  pose.y = p.y + up.y;
  pose.z = p.z + up.z;
  pose.q = q;
  pose.heading = p.heading;
  pose.pitch = p.pitch;
  pose.roll = p.roll;
  pose.vx = Math.sin(v.heading) * v.speed;
  pose.vy = 0;
  pose.vz = Math.cos(v.heading) * v.speed;
  pose.speed = Math.abs(v.speed);
  pose.airborne = false;
  pose.switched = false;
  pose.summit = 0;
  pose.ride = null;
  return pose;
}
