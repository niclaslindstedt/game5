// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER'S WEIGHT — four builds the skier can be, stated as data, and
// the one function that stands a pair of skis under one of them.
//
// A pair's row (`defs/skis.ts`) carries its skier as well as its skis: an
// 80 kg skier in his kit, the man every shared number in `TUNING` was
// tuned on. A rider of another build is the same pair with THAT skier on
// it — `withRider` restates the row's skier and nothing else, and the
// model reads the row as it always has, so a heavier skier is felt
// everywhere mass already is:
//
//   DOWNHILL he runs faster. The slope's pull and the base's friction both
//     scale with the mass and cancel, but the air's drag scales with his
//     frontal area — at one height, a body's breadth and depth grow
//     together with its mass, so the area as √(mass) — and the terminal
//     speed √(m / cdA) climbs as the fourth root of his weight: about 7 %
//     faster heavy than medium, 7 % slower light.
//   ON THE FLAT he is slower to wind up. The skate and the double pole are
//     a man's own push (`poles.ts`), and a push spent on more mass buys
//     less speed: `strength` is how much of the reference skier's push
//     this one has — more on a solid rider, a little more on a heavy one,
//     less on a light one, never in step with the mass.
//   IN THE AIR he lands harder. His legs are scaled to carry his weight
//     standing (the same sag, the same pose), but stopping a falling body
//     takes force in step with its mass, and a muscle's force grows only as
//     its cross-section: `hold` is the share of the reference legs' stroke
//     his legs stop a landing over (`flight.ts`' `landingLoad`, and the
//     landing they take whole, `harshSpeedOf`) — so the same drop is more
//     g to a heavy skier and he folds and goes over sooner.
//   AGAINST ANOTHER SKIER he hits harder and is moved less: a shoulder
//     trades momentum by the riders' weights (`rivals.ts`, `crowd.ts`).
//   IN POWDER he sinks deeper (`footprint.ts` prices the pressure).
//   AND HE TURNS AND FLIPS a little heavier — the inertia is his.
//
// Which build rides a pair is carried on the spec `withRider` hands back
// (`RiddenSpec.rider`), never on the catalog's rows — the skis' data
// (`defs/skis.ts`) is a source the modelled skis are stamped against, and a
// rider is not a property of a ski. `riderOf` reads it, a row with none the
// medium rider.
//
// The MEDIUM rider IS the reference: `withRider` hands that row back
// untouched, so every map, every digest and every pinned run skied before
// the rider could be chosen skis exactly as it did.

import type { SkiSpec } from "./skis.ts";

export type RiderId = "light" | "medium" | "solid" | "heavy";

export type RiderSpec = {
  id: RiderId;
  /** The rider in his kit, kg. */
  mass: number;
  /** His push on the flat (the skate, the pole plant), as a share of the
   * reference skier's. */
  strength: number;
  /** The stroke his legs stop a landing over, as a share of the reference
   * skier's at the same sag. */
  hold: number;
};

/** THE FOUR BUILDS, lightest first. The reference (medium) is the 80 kg
 * skier the catalog was tuned on; the others are a slight adult, an
 * athletic one and an overweight one — whose push is no better than the
 * medium rider's by much, and whose legs, carrying a third more than the
 * reference's, stop a landing over the least of his stroke. */
export const RIDERS: readonly RiderSpec[] = [
  { id: "light", mass: 60, strength: 0.85, hold: 1.08 },
  { id: "medium", mass: 80, strength: 1, hold: 1 },
  { id: "solid", mass: 95, strength: 1.12, hold: 0.94 },
  { id: "heavy", mass: 115, strength: 1.05, hold: 0.8 },
];

/** The reference rider — the skier every pair's row carries. */
export const MEDIUM_RIDER: RiderSpec = RIDERS[1];

/** A pair as `withRider` stands it under a build: the row restated, and
 * which build it was. */
export type RiddenSpec = SkiSpec & { readonly rider?: RiderId };

/** Whether `id` names one of the builds. */
export function isRiderId(id: string): id is RiderId {
  return RIDERS.some((r) => r.id === id);
}

/** The build with this id, or the medium rider for one this build does
 * not know. */
export function riderById(id: string): RiderSpec {
  return RIDERS.find((r) => r.id === id) ?? MEDIUM_RIDER;
}

/** WHO RIDES THIS PAIR: the build `withRider` stood it under, the medium
 * rider for a catalog row. */
export function riderOf(spec: SkiSpec): RiderSpec {
  const id = (spec as RiddenSpec).rider;
  return id === undefined ? MEDIUM_RIDER : riderById(id);
}

/** THE SHARE OF A SHOULDER'S EXCHANGE that falls on a body of `on` kg
 * against one of `against` kg — the momentum traded is shared by the
 * weights. A rule read beside a contact's closing speed: the share with the
 * player as he is over the share with him the medium rider (exactly 1 when
 * he is) is how much harder that contact lands. */
export function shoulderShare(on: number, against: number): number {
  return against / (on + against);
}

/** THE PAIR UNDER THIS RIDER: the row with its skier restated — his mass,
 * his drag area (as √ of the mass), the top speed expected of him, his legs' spring and damping (in step
 * with the whole's mass, so he stands on them at the same sag and bobs at
 * the same rate), his push and his legs' hold. The medium rider hands the
 * row itself back, to the bit. */
export function withRider(spec: SkiSpec, rider: RiderSpec): RiddenSpec {
  const was = riderOf(spec);
  if (rider.id === was.id) return spec;
  const body = rider.mass / was.mass;
  const whole = (rider.mass + spec.gearMass) / (spec.skierMass + spec.gearMass);
  const area = Math.sqrt(body);
  return {
    ...spec,
    rider: rider.id,
    skierMass: spec.skierMass * body,
    cdAUpright: spec.cdAUpright * area,
    cdATuck: spec.cdATuck * area,
    legs: {
      rate: spec.legs.rate * whole,
      bump: spec.legs.bump * whole,
      rebound: spec.legs.rebound * whole,
      travel: spec.legs.travel,
    },
    polePush: (spec.polePush / was.strength) * rider.strength,
    // The expectation moves as the terminal speed does: √(m / cdA).
    topSpeed: spec.topSpeed * Math.sqrt(whole / area),
  };
}
