// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CABINS — the log buildings a ski area keeps beside its runs and its
// transport lanes: what each KIND measures (the walls a skier meets, the
// roof's reach a tree and a neighbour keep clear of, how far it may be
// terraced into a slope) and the numbers the placer (`cabins.ts`) stands
// them by. The drawing (`pwa/src/game/cabin-shapes.ts`) is built to the
// same table, never to numbers of its own.
//
// THE BUILDINGS are the mountain log cabin as it is built where the snow is
// deep: walls of round logs 22–30 cm thick laid in courses, SADDLE-NOTCHED
// at the corners (the notch cut in the under side of the upper log so the
// water drains out of the joint) with the log ends run on 30–60 cm past the
// corner, the gaps between the courses chinked; a steep gable roof (35–45°
// on a cabin that sheds its snow, a shallow 22–28° on the stone-footed
// two-storey kind that keeps its snow for warmth) with deep eaves; a stone
// plinth under the sill log, terraced out on the downhill side; small
// windows; a stone chimney. Four kinds:
//   * HUT — a one-room cabin, the door in its gable end under the roof run
//     on over a covered entry;
//   * CABIN — a storey and a half, the door in its long side under a porch
//     across the front;
//   * CHALET — a stone ground floor under a log upper floor, the gable to
//     the front with a balcony across it, a shallow roof heavy with snow;
//   * SHED — a woodshed of boards under a lean-to roof, open to the front
//     and stacked with firewood: the companion beside a cabin.
//   * AFTERSKI — the lodge a ski area keeps its afterski in: a long log hall
//     of a storey and a half under a shallow snow-heavy roof, a TERRACE of
//     boards out across its front with benches and tables on it, SKI RACKS
//     along the terrace's foot and its door in the middle of the long side
//     (`afterski.ts`: the skier skis up to the racks and goes in).
// A kind is a name the placer and the drawing both read. Beside these the
// ski area's OWN buildings — the village's lodge, ticket office, rental,
// ski school, first aid, hotels, garage and pump house, and the mountain's
// restaurant and patrol hut — are kinds of the same table, measured in
// `defs/resort-buildings.ts` and stood by `resort-buildings.ts`.
//
// THE FRAME is the building's own: x across its front (`width`), z from its
// back to its front (`depth`, +z the way it faces), y up from its FLOOR —
// the top of the plinth. Every number is metres.

import { RESORT_BUILDINGS, type ResortKind } from "./resort-buildings.ts";

/** The log buildings' kinds. */
export type LogKind = "hut" | "cabin" | "chalet" | "shed" | "afterski";
export type CabinKind = LogKind | ResortKind;

/** One kind's measure.
 *   * `width`, `depth`: the walls' footprint, outside to outside.
 *   * `walls`: the walls' height from the floor to the eaves (a shed's
 *     front, its high side).
 *   * `ridge`: the roof's top over the floor.
 *   * `reach`: how far the roof (and a porch, a balcony, a chimney) stands
 *     out past the walls at the sides, the back and the front — what a
 *     trunk and a neighbour keep clear of.
 *   * `terrace`: the most the ground may fall across the footprint, m —
 *     at most `CABIN_LAYOUT.plinth.most` of stone showing on the downhill
 *     side and `plinth.cut` of the back dug into the slope.
 *   * `share`: how often the placer stands this kind as the first of a
 *     group (the shed is only ever a companion, the afterski placed apart
 *     by `cabins.ts`'s `placeLodges`).
 *   * `plinth`: the most stone shown on the downhill side, m, where the
 *     kind has its own (`CABIN_LAYOUT.plinth.most` otherwise).
 *   * `cut`: how far the uphill side may be dug in under the floor, m,
 *     where the kind has its own (`CABIN_LAYOUT.plinth.cut` otherwise). */
export type CabinDef = {
  width: number;
  depth: number;
  walls: number;
  ridge: number;
  reach: { side: number; back: number; front: number };
  terrace: number;
  share: number;
  plinth?: number;
  cut?: number;
};

export const CABINS: Readonly<Record<CabinKind, CabinDef>> = {
  hut: {
    width: 4.6,
    depth: 5.2,
    walls: 2.3,
    ridge: 4.35,
    reach: { side: 0.65, back: 1.4, front: 1.6 },
    terrace: 1.4,
    share: 0.3,
  },
  cabin: {
    width: 7.8,
    depth: 5.8,
    walls: 3.0,
    ridge: 5.5,
    reach: { side: 1.6, back: 0.8, front: 2.1 },
    terrace: 1.5,
    share: 0.48,
  },
  chalet: {
    width: 7.2,
    depth: 8.4,
    walls: 5.1,
    ridge: 7.0,
    reach: { side: 1.2, back: 1.1, front: 2.0 },
    terrace: 1.5,
    share: 0.22,
  },
  shed: {
    width: 3.4,
    depth: 2.4,
    walls: 2.15,
    ridge: 2.25,
    reach: { side: 0.4, back: 0.45, front: 0.6 },
    terrace: 1.1,
    share: 0,
  },
  // THE AFTERSKI LODGE: a hall 14 m along its front and 9 m deep, its eaves
  // over a storey and a half of logs, a shallow roof; the terrace runs
  // 7 m out over the snow before it (`reach.front`), so a tree, a run and a
  // neighbour keep clear of the terrace as of the roof. Built only where a
  // valley floor or a shelf is near level: no more than 2.6 m of fall
  // under the walls, the stone under the downhill side up to 1.8 m.
  afterski: {
    width: 14,
    depth: 9,
    walls: 3.6,
    ridge: 7.4,
    reach: { side: 1.4, back: 1.2, front: 7 },
    terrace: 2.6,
    share: 0,
    plinth: 1.8,
  },
  ...RESORT_BUILDINGS,
};

/** Where the cabins stand, m and shares.
 *   * `every`, `head`, `tail`: a station every `every` m down a run, from
 *     `head` m below its top to `tail` m above its end.
 *   * `chance`: the share of stations a group stands at — beside a piste,
 *     beside a transport lane — and `high` the share of that kept above
 *     the tree line, where few are built.
 *   * `setback`: the walls' nearest corner past the run's edge, m, dealt
 *     between the two; `lean` how far a cabin is turned off square to the
 *     run, radians, either way.
 *   * `downhill`: how far a cabin is turned from facing its run toward
 *     facing down the fall line, radians at most — built looking down its
 *     slope, its back dug in and its porch out over the snow.
 *   * `apart`: the gap from one group to the next, m; `most` the most a
 *     map carries.
 *   * `companion`: the share of groups with a woodshed beside the first
 *     building, and with a second cabin (a hamlet).
 *   * `clear`: what a cabin keeps away from, m — a trunk's crown past its
 *     roof (as a share of the crown, and never nearer than `trunk`), the
 *     YARD before its door, kept open `yard` m past the porch, a lift's station, a kicker, a gate, the
 *     start, the finish, a venue's course past its edge, a wind tunnel, the
 *     hub, a mast, the helicopter's pad and the parked snowmobile, another
 *     building's roof.
 *   * `plinth`: how the floor is set into a slope, m — the stone shown
 *     above the snow on the downhill side, `least` on the flat and `most`
 *     on the steepest site taken; `cut` how far the uphill side is dug in
 *     under the floor (the snow banked up the back wall), so a cabin sits
 *     IN its slope rather than up on a pedestal; `door` how far the floor
 *     stands over the snow before the porch, so no doorstep is buried. */
export const CABIN_LAYOUT = {
  every: 105,
  head: 70,
  tail: 45,
  chance: { piste: 0.4, road: 0.5, high: 0.35 },
  setback: { min: 8, max: 22 },
  lean: 0.18,
  downhill: 1.25,
  apart: 120,
  most: 32,
  companion: { shed: 0.55, hamlet: 0.2 },
  clear: {
    crown: 0.35,
    trunk: 1.5,
    yard: 4,
    station: 45,
    kicker: 30,
    gate: 30,
    start: 55,
    finish: 100,
    venue: 30,
    tunnel: 15,
    hub: 18,
    mast: 3,
    pad: 40,
    roof: 2.5,
  },
  plinth: { least: 0.3, most: 1.0, cut: 0.45, door: 0.3 },
} as const;
