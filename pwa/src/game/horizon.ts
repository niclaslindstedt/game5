// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRUE HORIZON — where the sky meets the ground for a lens up a
// mountain, and what lies under it.
//
// The Earth curves away under a raised eye, so the line where the sky
// stops is not the level but a little under it: the DIP, acos(R / (R + h))
// for an eye h over a sphere of radius R — √(2h/R) to well inside a
// thousandth for any height a skier or a balloon reaches: 0.10° from 10 m,
// 1.0° from 1 km, 1.6° from 2.5 km, 2.0° from 4 km. The low air bends a
// grazing ray down along the Earth's curve, which reads as a planet some
// sixth larger and lifts the horizon a few hundredths of a degree back
// toward the level: the refraction coefficient over land by day is near
// 0.13 (a cold inversion over snow can double it). So the dip used is the
// one for a sphere of R / (1 − k) — about 7 % under the geometric one.
//
// Under the true horizon is the FAR GROUND, seen through the air to it
// (`haze.ts`'s `farColour`): along a ray just under the horizon that is a
// hundred and more kilometres of low air (from 1.6 km up the horizon
// stands ~150 km off), so it is the air's own light, the horizon's colour;
// looking further down the way shortens and the ground — snow, woods,
// shaded faces, darker than the sky by day and dim at dusk — shows
// through. The ground taken is the map's valley floor carried out round
// the planet: a dealt map's floor stands within metres of the sea, a real
// face's at its real altitude.
//
// Three-free and DOM-free: the renderer writes the dip every frame, the
// shaders read `FAR_RADIUS`, and the suite reads both.

import type { Level } from "@engine";

import { altitudeAt } from "./altitude.ts";

/** The Earth's mean radius, m. */
export const EARTH_RADIUS = 6_371_000;

/** The refraction coefficient a grazing ray is bent by (the ratio of the
 * Earth's radius to the ray's): the standard figure over land by day. */
export const REFRACTION = 0.13;

/** The radius of the sphere a refracted ray sees, m: the Earth's
 * stretched by the bending. */
export const FAR_RADIUS = EARTH_RADIUS / (1 - REFRACTION);

/** How far under the level the true horizon stands for a lens `height` m
 * over the ground round the planet, rad (0 at or under it). */
export function horizonDip(height: number): number {
  if (!(height > 0)) return 0;
  return Math.acos(FAR_RADIUS / (FAR_RADIUS + height));
}

/** How far off the true horizon is, m, for a lens `height` m up. */
export function horizonDistance(height: number): number {
  if (!(height > 0)) return 0;
  return Math.sqrt(2 * FAR_RADIUS * height + height * height);
}

/** THE LENS OVER THE FAR GROUND, m: its altitude (`altitudeAt`, the real
 * one on a real face) less the valley floor's (`Mountain.altitude`), the
 * level the country round the map is taken to lie at. Nought on a map that
 * publishes no mountain. */
export function heightOverFar(
  level: Pick<Level, "mountain" | "face" | "groundAt">,
  x: number,
  y: number,
  z: number,
): number {
  const m = level.mountain;
  if (!m) return 0;
  const alt = altitudeAt(level as Level, x, y, z);
  return alt === null ? 0 : Math.max(0, alt - m.altitude);
}
