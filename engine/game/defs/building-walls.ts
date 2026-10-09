// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WALLS A SKIER MEETS — every building's solid as it is drawn: where
// each kind's DOOR is (the doorway left in its walls, shut by the door
// itself), the TERRACES whose railing stands round a deck before a front,
// and the numbers the walls are met by (`building-walls.ts`). Every number
// is metres, in the building's own frame (`defs/cabins.ts`: x across its
// front, z from its back to its front, +z the way it faces, y up from its
// floor).
//
// THE DOORS are measured off the drawn doors (`cabin-shapes.ts`'s holes,
// `lodge-shapes.ts`'s pair, `village-build.ts`, `village-town.ts` and
// `mountain-build.ts`'s door insets): the one a walker goes in at — the
// main entrance, the ground floor's door on a chalet, the middle of a
// garage's three roller doors, the patrol hut's on its right flank at the
// head of its stair. A woodshed is open to its front and stacked full of
// firewood: it has none.

import type { CabinKind } from "./cabins.ts";

/** Which wall a door is in: the front (+z), the back, or a flank (left −x,
 * right +x). */
export type DoorSide = "front" | "back" | "left" | "right";

/** One kind's door.
 *   * `side`: the wall it is in.
 *   * `at`: its middle along that wall from the wall's middle, m — along x
 *     on the front or the back, along z on a flank.
 *   * `width`: the doorway's clear width, m; `height` the leaf's, m over
 *     the floor.
 *   * `dealt`: when given, the door stands at `at` or at `−at`, the side
 *     dealt off a hash of the building's id with this salt (a house's door
 *     at one end of its street front, as `village-town.ts` draws it).
 *   * HOW IT OPENS (`doorway.ts`, `docs/buildings.md` § Doors): `swing`
 *     into the room (`in`, a home's door, clear of the snow piled against
 *     it), out of it (`out`, a public building's, the way its crowd leaves)
 *     or rolled up overhead (`roll`, a garage's); `leaves` one or a pair,
 *     each `leaf` m wide, the rest of the doorway fixed side lights either
 *     side of them; `hinge`, a single leaf's hinged jamb as seen from
 *     outside (toward the nearer corner when left out, the left on a door
 *     in the middle); `stuff` what the leaf is made of — what it sounds
 *     like. */
export type DoorDef = {
  side: DoorSide;
  at: number;
  width: number;
  height: number;
  dealt?: number;
  swing: DoorSwingWay;
  leaves: 1 | 2;
  leaf: number;
  hinge?: "left" | "right";
  stuff: DoorStuff;
};

/** Which way a door opens: into the room, out of it, or rolled up. */
export type DoorSwingWay = "in" | "out" | "roll";

/** What a door's leaf is made of. */
export type DoorStuff = "timber" | "glass" | "steel";

export const BUILDING_DOORS: Readonly<Record<CabinKind, DoorDef | null>> = {
  // THE LOG BUILDINGS' plank doors, into the room as a home's are.
  hut: {
    side: "front",
    at: 0,
    width: 0.9,
    height: 1.9,
    swing: "in",
    leaves: 1,
    leaf: 0.9,
    stuff: "timber",
  },
  cabin: {
    side: "front",
    at: 0,
    width: 0.95,
    height: 2.0,
    swing: "in",
    leaves: 1,
    leaf: 0.95,
    stuff: "timber",
  },
  chalet: {
    side: "front",
    at: -1.6,
    width: 0.95,
    height: 2.05,
    swing: "in",
    leaves: 1,
    leaf: 0.95,
    stuff: "timber",
  },
  shed: null,
  // The double door: two leaves of 0.93 m either side of the middle, out
  // the way a full room leaves.
  afterski: {
    side: "front",
    at: 0,
    width: 1.86,
    height: 2.3,
    swing: "out",
    leaves: 2,
    leaf: 0.93,
    stuff: "timber",
  },
  // THE PUBLIC BUILDINGS' glazed doors, out: a pair in the middle of a
  // glazed front, the rest of it side lights.
  restaurant: {
    side: "front",
    at: 0,
    width: 4.8,
    height: 2.5,
    swing: "out",
    leaves: 2,
    leaf: 1.0,
    stuff: "glass",
  },
  ticket: {
    side: "front",
    at: 3.75,
    width: 1.5,
    height: 2.3,
    swing: "out",
    leaves: 1,
    leaf: 1.0,
    stuff: "glass",
  },
  rental: {
    side: "front",
    at: 6.1,
    width: 2.0,
    height: 2.5,
    swing: "out",
    leaves: 2,
    leaf: 1.0,
    stuff: "glass",
  },
  school: {
    side: "front",
    at: 0,
    width: 1.6,
    height: 2.2,
    swing: "out",
    leaves: 2,
    leaf: 0.8,
    stuff: "glass",
  },
  firstAid: {
    side: "front",
    at: 4.35,
    width: 1.1,
    height: 2.5,
    swing: "out",
    leaves: 1,
    leaf: 1.1,
    stuff: "glass",
  },
  hotel: {
    side: "front",
    at: 0,
    width: 3.2,
    height: 2.6,
    swing: "out",
    leaves: 2,
    leaf: 1.0,
    stuff: "glass",
  },
  // The middle of the three roller doors, rolled up on its drum.
  garage: {
    side: "front",
    at: -0.05,
    width: 6.5,
    height: 5.2,
    swing: "roll",
    leaves: 1,
    leaf: 6.5,
    stuff: "steel",
  },
  pumpHouse: {
    side: "front",
    at: 0,
    width: 2.4,
    height: 2.6,
    swing: "out",
    leaves: 2,
    leaf: 1.2,
    stuff: "steel",
  },
  house: {
    side: "front",
    at: 4,
    width: 1.1,
    height: 2.3,
    dealt: 5,
    swing: "in",
    leaves: 1,
    leaf: 1.1,
    stuff: "timber",
  },
  apartments: {
    side: "front",
    at: 0,
    width: 2.4,
    height: 2.6,
    swing: "out",
    leaves: 2,
    leaf: 1.0,
    stuff: "glass",
  },
  shop: {
    side: "front",
    at: 0,
    width: 2.0,
    height: 2.7,
    swing: "out",
    leaves: 2,
    leaf: 1.0,
    stuff: "glass",
  },
  // The church's tall plank pair, out.
  church: {
    side: "front",
    at: 0,
    width: 1.8,
    height: 3.4,
    swing: "out",
    leaves: 2,
    leaf: 0.9,
    stuff: "timber",
  },
  mountainHut: {
    side: "front",
    at: 0,
    width: 2.0,
    height: 2.3,
    swing: "out",
    leaves: 2,
    leaf: 1.0,
    stuff: "glass",
  },
  patrol: {
    side: "right",
    at: 0.5,
    width: 1.2,
    height: 2.1,
    swing: "out",
    leaves: 1,
    leaf: 1.2,
    stuff: "timber",
  },
};

/** A TERRACE before a front: a deck from `from` m past the front wall to
 * its railing `out` m past it, running `end` m past either flank, the deck
 * `deck` m under the floor and the rail `rail` m over the deck; the rail
 * round its two ends and along its front is broken in the middle by the
 * steps, `gap` m either side. The drawing builds the terrace off this row
 * (`village-build.ts`'s lodge, `mountain-build.ts`'s hut, `lodge-measure.ts`),
 * the collision rings it with its rail. */
export type TerraceDef = {
  from: number;
  out: number;
  end: number;
  gap: number;
  deck: number;
  rail: number;
};

export const TERRACES: Readonly<Partial<Record<CabinKind, TerraceDef>>> = {
  // 7 m out over the snow, its rail 0.2 m short of the roof's reach.
  restaurant: { from: 0.3, out: 6.8, end: 1.5, gap: 2, deck: -0.25, rail: 1.0 },
  // The deck across the hut's face, the snow terrace of deck chairs past it.
  mountainHut: { from: 0, out: 5, end: 0.5, gap: 3, deck: -0.2, rail: 1.02 },
  // The afterski's deck, a little short of the roof's reach.
  afterski: { from: 0, out: 6.6, end: 0.6, gap: 1.3, deck: -0.22, rail: 1.02 },
};

/** How a building's walls are met (`building-walls.ts`).
 *   * `wall`: the walls' thickness, m — a wall is met as a slab this thick
 *     standing inside its footprint, its outer face the footprint's edge.
 *   * `rail`: a terrace rail's or a woodpile's face, m thick.
 *   * `cell`: the hash the wall segments are kept on, m.
 *   * `post`: the posts a wall is ALSO stood as, for everything that meets
 *     a solid as a cylinder (the body thrown, the skis let go, the
 *     snowmobile, the piste machine, the bots): their radius and the most
 *     gap between two, centre to centre, m — close enough that no body
 *     slips between them.
 *   * `over`: how far over the ridge the solid stands (the snow on the
 *     roof, a chimney's foot), m. */
export const BUILDING_WALLS = {
  wall: 0.3,
  rail: 0.12,
  cell: 16,
  post: { radius: 0.3, gap: 0.4 },
  over: 0.5,
} as const;
