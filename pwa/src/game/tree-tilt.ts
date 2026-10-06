// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TILT OF A TRUNK — how far off plumb every tree the forest draws
// stands, and which way it leans (three-free; `forest.ts` turns it into the
// instance's rotation about the trunk's foot).
//
// WHAT A REAL WOOD DOES. Most stems stand within a few degrees of plumb;
// on a slope nearly all that lean, lean DOWNHILL — surveys of mountain
// stands find more than nine in ten stems inclined down the slope, the
// crown reaching for the open sky over the valley (stem phototropism) and
// the young stem bent by the snowpack creeping and gliding down the face
// (the "pistol butt" a mountain conifer straightens out of). The lean grows
// with the slope and the exposure; broadleaves lean further than conifers,
// whose leader turns back to the vertical harder; stems incline more the
// higher and more exposed they stand; and arborists count a stem past about
// fifteen degrees as a pronounced lean — a tree or two in a hundred, and
// one at thirty degrees a rarity. No tree here is FALLEN: the lean never
// passes `TILT.most`.
//
// SO THE ANGLE IS NORMAL: the size of a zero-centred normal draw (a
// half-normal) whose spread is the tree's own — its form's, widened by the
// slope it stands on, and wider again on the few LEANERS (a stem bent
// young, one whose neighbour fell, one reaching into a gap). On a generated
// alpine map that deals a median of under three degrees, one tree in twenty
// past ten, one or two in a hundred past fifteen and about one in a
// thousand near thirty (`tests/trees_test.ts` holds the bands).
//
// The draw is a hash of where the trunk stands, never the engine's stream,
// so the tilt is pure presentation: the trunk the skier meets is the
// engine's upright cylinder at its foot, and no digest can see a tree lean.

import type { TreeForm } from "./tree-variants.ts";

/** The numbers the lean is dealt by. Angles in degrees. */
export const TILT = {
  /** The spread (σ) of an ordinary stem's lean on level ground, by form:
   * a conifer's leader rights itself hardest, a broadleaf's least. */
  spread: { conifer: 3, pine: 4, larch: 3.5, birch: 5.5 } as Readonly<
    Record<TreeForm["form"], number>
  >,
  /** The spread grows with the slope: × (`flat` + `steep` · sin slope). */
  flat: 0.7,
  steep: 1.6,
  /** The share of LEANERS, and how much wider their spread is. */
  leaners: 0.1,
  leanerSpread: 2.5,
  /** The most any tree leans: past this it would be falling. A draw past
   * `knee` is eased toward `most` rather than cut at it, so the rare
   * steepest trees do not all stand at one angle. */
  knee: 24,
  most: 30,
  /** The share of the lean that goes down the slope on a steep enough
   * face, the scatter about the fall line (σ) — the rest lean any way —
   * and the slope (sin) at which the fall line has taken over. */
  downhill: 0.9,
  scatter: 30,
  fallLine: 0.15,
} as const;

/** A trunk's lean: how far off plumb (radians) and toward which way in
 * plan (a unit `x`, `z`). */
export type Tilt = { readonly angle: number; readonly dx: number; readonly dz: number };

const DEG = Math.PI / 180;

/** A hash of a place and a salt, 0..1. */
function hash(x: number, z: number, salt: number): number {
  const s = Math.sin(x * 41.731 + z * 289.113 + salt * 17.371) * 43758.5453;
  return s - Math.floor(s);
}

/** A standard normal draw off two hashes (Box–Muller). */
function normal(x: number, z: number, salt: number): number {
  const u = Math.max(1e-9, hash(x, z, salt));
  const v = hash(x, z, salt + 1);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** The lean of the trunk standing at `x`, `z`, of `form`, on ground whose
 * unit normal's level part is `nx`, `nz` (pointing down the slope; its
 * length is the sine of the slope). */
export function treeTilt(
  x: number,
  z: number,
  form: TreeForm["form"],
  nx: number,
  nz: number,
): Tilt {
  const sinSlope = Math.min(1, Math.hypot(nx, nz));
  const leaner = hash(x, z, 1) < TILT.leaners;
  const spread =
    TILT.spread[form] * (TILT.flat + TILT.steep * sinSlope) * (leaner ? TILT.leanerSpread : 1);
  const drawn = Math.abs(normal(x, z, 2)) * spread;
  const room = TILT.most - TILT.knee;
  const eased =
    drawn <= TILT.knee ? drawn : TILT.knee + room * Math.tanh((drawn - TILT.knee) / room);
  const angle = eased * DEG;
  // Down the fall line, scattered about it — or, on the rest and on level
  // ground, any way at all.
  const fall = TILT.downhill * Math.min(1, sinSlope / TILT.fallLine);
  const heading =
    hash(x, z, 4) < fall
      ? Math.atan2(nx, nz) + normal(x, z, 5) * TILT.scatter * DEG
      : hash(x, z, 7) * 2 * Math.PI;
  return { angle, dx: Math.sin(heading), dz: Math.cos(heading) };
}
