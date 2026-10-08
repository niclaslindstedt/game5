// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S STREETS — the numbers the street plan (`village-streets.ts`)
// lays a ski area's village by, below the hub on the valley floor, and the
// lots its buildings stand on (`village-place.ts`). Measured off how a
// mountain village's streets are really built and kept in winter
// (`docs/buildings.md`, "The village and its streets"); every number is
// metres unless it says otherwise.
//
// A street's CROSS-SECTION is stated side by side out from its centreline:
// the carriageway (two lanes of `lane`, one each way, traffic on the
// right), then on each side a parking strip along the kerb (`park`, 0 for
// none), the plough's windrow (`bank` wide and `heap` tall — the snow the
// plough throws off the carriageway, broken at every junction, crossing
// and driveway), and a sidewalk (`walk`, 0 for none) raised a kerb over
// the road. Side 0 is the street's left in map terms (`besidePoint`'s
// negative side, going from its first junction to its last) — which, the
// map view mirroring the world as the eye sees it, is the RIGHT a driver
// keeps to — and side 1 the other.

/** One side of a street, out from the carriageway's edge. */
export type StreetSide = {
  park: number;
  bank: number;
  heap: number;
  walk: number;
};

/** A street's cross-section: one lane's width and its two sides. */
export type Section = {
  lane: number;
  sides: readonly [StreetSide, StreetSide];
};

/** The kinds of street a village has. */
export type StreetKind = "main" | "back" | "cross" | "road" | "aisle";

/** THE SECTIONS, by kind of street.
 *   * MAIN — the village's main street along the hub, its shops and the
 *     base's buildings either side: two lanes of 3.5 m, a sidewalk of
 *     2.2 m each side behind a low granite kerb, the windrow kept low
 *     (the loaders lift it away along a shopping street).
 *   * BACK — the residential street behind it: two lanes of 2.9 m, cars
 *     parked along the kerb on one side, one sidewalk, the windrows tall
 *     where nobody carts them off.
 *   * CROSS — the short streets between them: as the back street, no
 *     parking.
 *   * ROAD — the valley road out: two lanes of 3.25 m, no sidewalks, the
 *     plough's banks a metre tall either side and the snow poles in them.
 *   * AISLE — the car park's aisles: 6 m between the bays, no banks. */
export const SECTIONS: Readonly<Record<StreetKind, Section>> = {
  main: {
    lane: 3.5,
    sides: [
      { park: 0, bank: 0.7, heap: 0.35, walk: 2.2 },
      { park: 0, bank: 0.7, heap: 0.35, walk: 2.2 },
    ],
  },
  back: {
    lane: 2.9,
    sides: [
      { park: 2.2, bank: 1.0, heap: 0.7, walk: 1.6 },
      { park: 0, bank: 1.4, heap: 0.9, walk: 0 },
    ],
  },
  cross: {
    lane: 2.9,
    sides: [
      { park: 0, bank: 0.9, heap: 0.6, walk: 1.6 },
      { park: 0, bank: 1.3, heap: 0.85, walk: 0 },
    ],
  },
  road: {
    lane: 3.25,
    sides: [
      { park: 0, bank: 1.6, heap: 1.0, walk: 0 },
      { park: 0, bank: 1.6, heap: 1.0, walk: 0 },
    ],
  },
  aisle: {
    lane: 3,
    sides: [
      { park: 0, bank: 0, heap: 0, walk: 0 },
      { park: 0, bank: 0, heap: 0, walk: 0 },
    ],
  },
};

/** A street's half-width on one side, from its centreline to the back of
 * its sidewalk (or its bank where it has none). */
export function sideReach(section: Section, side: 0 | 1): number {
  const s = section.sides[side];
  return section.lane + s.park + s.bank + s.walk;
}

/** Where the streets are laid, m off the hub's valley edge (`v`) and along
 * it, and what they keep clear of.
 *   * `span`: the main street's length, dealt between the two.
 *   * `main`: the main street's line off the hub's edge, dealt; `back` how
 *     far behind it the back street runs, dealt; `bend` the most either
 *     street bows off straight (a street follows its ground, not a rule).
 *   * `crosses`: how many cross streets join them between the two ends,
 *     the least and the most, and the least gap between two junctions.
 *   * `roads`: the share of villages with a second road out.
 *   * `step`: how often a street's line is sampled.
 *   * `grade`: the steepest a street may climb along it and lean across it.
 *   * `tries`: the centres tried either way of the village's point, m, and
 *     the shares of the span tried at each.
 *   * `clear`: what a street (to the back of its sidewalks) keeps away
 *     from — a lift's station, its queue's lane, a wind tunnel, a run's
 *     edge, the hub, a floodlight mast, the machines' pads, a gate, the
 *     start, the finish arena, a log building's roof, a kicker. */
export const VILLAGE_STREETS = {
  span: { least: 330, most: 400 },
  main: { least: 47, most: 53 },
  back: { least: 54, most: 62 },
  bend: 5,
  crosses: { least: 1, most: 2, apart: 80 },
  roads: 0.5,
  step: 4,
  grade: { along: 0.09, across: 0.07 },
  tries: {
    centre: [0, -40, 40, -80, 80, -130, 130, -190, 190, -260, 260],
    span: [1, 0.85, 0.7],
  },
  clear: {
    station: 20,
    queue: 8,
    tunnel: 8,
    line: 8,
    hub: 3,
    mast: 4,
    pad: 30,
    gate: 20,
    start: 35,
    finish: 75,
    cabin: 5,
    kicker: 30,
  },
} as const;

/** The base's open places, along the main street on the hub's side.
 *   * `square`: the village square at the main lift — a stretch of the
 *     main street's hub side, `along` long, open from the street to the
 *     hub, where the walk from the street to the lifts goes.
 *   * `carpark`: the day car park beside it, `gap` along from the square
 *     (room for the ticket office and first aid between): two aisles
 *     (`SECTIONS.aisle`) in from the street with a row of bays either side
 *     of each, joined at the far end; a bay `bay.width` across and
 *     `bay.length` deep, square to its aisle. */
export const VILLAGE_AREAS = {
  square: { along: 36 },
  carpark: { gap: 34, bay: { width: 2.5, length: 5 }, back: 3 },
} as const;

/** The street's furniture.
 *   * `lamp`: the lamps — every `every` m along a lit street, dealt a
 *     little either way, on the side with the sidewalk; `height` the
 *     lantern over the road (a village lantern on a 5–6 m column, a main
 *     street's a little taller); the lamp's flux, lm (a 40–60 W LED
 *     lantern), and how far out over the road its head reaches.
 *   * `crossing`: a crossing's stripes: their width along the street, the
 *     gap between them, how far from a junction's middle it is painted.
 *   * `kerb`: a kerbside bay's length along the street and its width.
 *   * `bus`: the stop's shelter (along, deep), how far along the main
 *     street from the square.
 *   * `pole`: the snow poles down a road out: every `every` m each side. */
export const STREET_FURNITURE = {
  lamp: { every: 30, jitter: 3, height: { main: 6.5, other: 5.5 }, lumens: 6000, arm: 0.9 },
  crossing: { stripe: 0.5, gap: 0.5, width: 3, off: 1.5 },
  kerb: { length: 6, width: 2.2 },
  bus: { along: 4, deep: 1.6, from: 6 },
  pole: { every: 25, height: 2 },
} as const;

/** The lots the village's buildings stand on.
 *   * `setback`: the walls' front off the back of the sidewalk — a shop
 *     or the base's buildings at the back of the walk, a house behind its
 *     yard, dealt between the two.
 *   * `gap`: the gap from one roof to the next along a street, dealt.
 *   * `garden`: the share of lots left open (a garden, a yard), and how
 *     long one runs along the street.
 *   * `most`: the most buildings a village carries.
 *   * `fell`: how far past a building's roof, a street's reach or an open
 *     place the trees are felled, m; `thin` how far past that they are
 *     thinned, and `keep` the share kept there (the trees left standing in
 *     the gardens). */
export const VILLAGE_LOTS = {
  setback: { core: 0.8, house: { least: 3, most: 6 } },
  gap: { least: 3, most: 8 },
  garden: { share: 0.18, along: { least: 8, most: 16 } },
  most: 40,
  fell: 3,
  thin: 30,
  keep: 0.25,
} as const;
