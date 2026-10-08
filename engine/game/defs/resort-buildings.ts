// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI AREA'S OWN BUILDINGS — what a real resort stands at the foot of
// its lifts and up on its mountain beside the log cabins: what each KIND
// measures (in `CabinDef`'s terms: the walls a skier meets, the roof's and
// the terrace's reach a tree and a neighbour keep clear of, the fall a
// footprint is terraced over) and the numbers the placer
// (`resort-buildings.ts`) stands them by. Measured off how such buildings
// are really built and sized, at the modest end of each band so a
// mid-sized ski area's foot holds them; every number is metres, in the
// building's own frame (`defs/cabins.ts`: x across its front, z from its
// back to its front, y up from its floor).
//
// THE VILLAGE, round the hub at the foot of the runs, facing the open snow
// the lifts leave from:
//   * RESTAURANT — the base lodge: a self-service food hall for a few
//     hundred, two storeys over a ground floor half dug into the bank, a
//     broad low gable with its ridge along the long side and deep eaves,
//     the upper storey glazed along the face, a TERRACE of boards 8 m deep
//     the whole length of its front with tables on it and the ski racks at
//     its foot. The middle of the village, looking up the runs.
//   * TICKET — the pass office: a one-storey kiosk under a mono-pitch,
//     a row of serving windows under a deep awning along its front and the
//     queue's barriers before it. Beside the main lift's bottom station, on
//     the walk to it.
//   * RENTAL — the hire and sports shop: two storeys, a glazed shop front
//     along the ground floor with the skis showing, a shallow gable, a long
//     rack of hire skis before it. Near the lodge.
//   * SCHOOL — the ski school's hut: one storey under a gable, painted in
//     the school's colour, the meeting flags on poles in the snow before it.
//     Near the lodge, toward the gentle slopes.
//   * FIRST AID — the patrol's base station: one storey, plain, the cross on
//     white over a wide door with a sled bay beside it, a radio mast on the
//     roof. Near the main lift, an ambulance's drive from the road.
//   * HOTEL — an apartment or hotel block of four storeys over a stone
//     ground floor, a balcony on every floor along the long face, a big
//     gable over it. Several, a step back and along from the public ones.
//   * GARAGE — the piste machines' garage and the lift mechanics' shop: one
//     tall storey of ribbed steel over three roller doors a groomer's blade
//     and tiller pass through, a concrete apron before them. Off at one end.
//   * PUMP HOUSE — the snowmaking pumps and compressors: a low concrete box,
//     a steel double door, louvres, pipes on the wall. Off at one end.
// THE MOUNTAIN:
//   * MOUNTAIN HUT — the mountain restaurant beside a top station: one
//     storey over a storey dug into the slope, a broad low gable heavy with
//     snow, a sun TERRACE 10 m deep along its face turned to the view.
//   * PATROL — the patrol's hut at the highest top: a small red hut on
//     stilts, a big window over the runs, toboggans racked on its wall, a
//     radio mast.

import type { CabinDef } from "./cabins.ts";

/** The ski area's buildings by kind: the village's and the mountain's. */
export type VillageKind =
  "restaurant" | "ticket" | "rental" | "school" | "firstAid" | "hotel" | "garage" | "pumpHouse";
export type MountainKind = "mountainHut" | "patrol";
export type ResortKind = VillageKind | MountainKind;

/** The village's kinds in the order the placer stands them — the ones a
 * skier walks into first, the hotels after, the service buildings last. */
export const VILLAGE_KINDS: readonly VillageKind[] = [
  "restaurant",
  "ticket",
  "rental",
  "school",
  "firstAid",
  "hotel",
  "garage",
  "pumpHouse",
];

/** The mountain's kinds. */
export const MOUNTAIN_KINDS: readonly MountainKind[] = ["mountainHut", "patrol"];

/** Each kind's measure (`CabinDef`; `share` 0 — the cabins' placer never
 * deals one). `cut` is how far the uphill side may be dug in under the
 * floor where the kind is built into its bank. */
export const RESORT_BUILDINGS: Readonly<Record<ResortKind, CabinDef>> = {
  // 32 × 16 m, two storeys of 3.4 m over the floor, a 22° gable to 11.5 m;
  // eaves 1.8 m deep, the terrace 7 m out over the snow before it.
  restaurant: {
    width: 32,
    depth: 16,
    walls: 7,
    ridge: 11.5,
    reach: { side: 1.8, back: 1.8, front: 7 },
    terrace: 3.2,
    share: 0,
    plinth: 2.2,
    cut: 2.4,
  },
  // A kiosk of 10 × 5 m, 3.4 m to the eaves, a mono-pitch to 4.2 m, its
  // awning and the queue's barriers 3 m out before the windows.
  ticket: {
    width: 10,
    depth: 5,
    walls: 3.4,
    ridge: 4.2,
    reach: { side: 0.5, back: 0.4, front: 3 },
    terrace: 1.3,
    share: 0,
    plinth: 0.9,
  },
  // 16 × 11 m, two storeys to the eaves at 6 m, a 25° gable to 8.6 m; the
  // hire skis' rack 2.5 m out before the shop front.
  rental: {
    width: 16,
    depth: 11,
    walls: 6,
    ridge: 8.6,
    reach: { side: 1.2, back: 1, front: 2.5 },
    terrace: 1.8,
    share: 0,
    plinth: 1.2,
    cut: 0.8,
  },
  // 10 × 6 m, 3.2 m to the eaves, a 30° gable to 5 m; the meeting flags'
  // yard 3 m out before the door.
  school: {
    width: 10,
    depth: 6,
    walls: 3.2,
    ridge: 5,
    reach: { side: 0.8, back: 0.8, front: 3 },
    terrace: 1.4,
    share: 0,
    plinth: 1,
  },
  // 12 × 8 m, one storey of 3.6 m, a shallow gable to 5.6 m; the sled bay
  // and the ambulance's door 2.5 m out before it.
  firstAid: {
    width: 12,
    depth: 8,
    walls: 3.6,
    ridge: 5.6,
    reach: { side: 0.8, back: 0.8, front: 2.5 },
    terrace: 1.4,
    share: 0,
    plinth: 1,
  },
  // 24 × 13 m: a 3.5 m ground floor and three storeys of 2.9 m to the eaves
  // at 12.2 m, a 30° gable to 16 m; eaves and balconies 2 m out before it.
  hotel: {
    width: 24,
    depth: 13,
    walls: 12.2,
    ridge: 16,
    reach: { side: 1.8, back: 1.6, front: 2.2 },
    terrace: 3.2,
    share: 0,
    plinth: 2.4,
    cut: 2.4,
  },
  // 26 × 16 m: three bays of 6.5 m doors, one tall storey to the eaves at
  // 7 m, a 15° gable to 9.1 m; the apron 8 m out before the doors.
  garage: {
    width: 26,
    depth: 16,
    walls: 7,
    ridge: 9.1,
    reach: { side: 0.6, back: 0.6, front: 8 },
    terrace: 1.6,
    share: 0,
    plinth: 1.2,
    cut: 0.8,
  },
  // 10 × 8 m of concrete, 4.4 m to a flat roof's parapet at 4.8 m; the
  // cooling towers' slab 2.5 m out before the door.
  pumpHouse: {
    width: 10,
    depth: 8,
    walls: 4.4,
    ridge: 4.8,
    reach: { side: 0.4, back: 0.4, front: 2.5 },
    terrace: 1.8,
    share: 0,
    plinth: 1.2,
    cut: 1.2,
  },
  // 20 × 12 m: a storey dug into the slope under the floor, one storey of
  // 3.8 m over it, a 20° gable to 7.6 m with 1.8 m eaves; the sun terrace
  // 9 m deep before it, out over the snow.
  mountainHut: {
    width: 20,
    depth: 12,
    walls: 3.8,
    ridge: 7.6,
    reach: { side: 1.8, back: 1.6, front: 9 },
    terrace: 5,
    share: 0,
    plinth: 3,
    cut: 3,
  },
  // 5 × 4 m on stilts: its floor up to 3 m over the snow, 3 m to the
  // eaves, a mono-pitch to 3.8 m; the stair and the toboggans' rack 1.5 m
  // out before the door.
  patrol: {
    width: 5,
    depth: 4,
    walls: 3,
    ridge: 3.8,
    reach: { side: 0.5, back: 0.5, front: 1.5 },
    terrace: 3,
    share: 0,
    plinth: 3,
  },
};

/** Where the ski area's buildings stand, m and shares (`resort-buildings.ts`).
 *   * `hotels`: how many hotel blocks a village is dealt, the least and the
 *     most.
 *   * `gap`: the setbacks a village building is tried at, m off the hub's
 *     edge to its terrace's front (so out of the groomed band and its fade,
 *     where the crowd skates to the lifts); `along` how far either way of
 *     its target along the edge, and `step` how often between.
 *   * `fit`: what a village building keeps away from, m, measured from its
 *     roof's rectangle rather than the circle round it — a lift's station,
 *     its queue's lane and corral, a wind tunnel's edge, a run's edge, a
 *     summit's ramp, the hub, the helicopter's pad and the parked
 *     snowmobile, a gate, the start, the finish arena, another building's
 *     roof. Every one of them may take a site with trunks standing inside
 *     its walls — the site cleared for it, those trees not drawn
 *     (`fellsTree`); the rest of its roof and terrace keeps every crown off
 *     as a cabin's does.
 *   * `hut`: a mountain restaurant's rings round its top station, m — its
 *     walls' middle from the nearest (`near` and half its roof's reach) to
 *     the furthest (`far` and all of it) — and the share of maps with a
 *     second one at the top of a lower lift; `patrol` the patrol hut's,
 *     tried at the highest top first and then the next (`tops` of them). A
 *     top's pad and the heads of its runs are wide packed snow, so a ring
 *     reaches well past them. */
export const RESORT_LAYOUT = {
  hotels: { least: 3, most: 5 },
  gap: [10, 18, 28, 40, 55],
  along: 600,
  step: 12,
  fit: {
    station: 18,
    queue: 6,
    tunnel: 6,
    line: 4,
    ramp: 8,
    hub: 2,
    pad: 30,
    gate: 20,
    start: 35,
    finish: 75,
    roof: 4,
  },
  hut: { near: 22, far: 110, second: 0.5 },
  patrol: { near: 10, far: 80, tops: 3 },
} as const;
