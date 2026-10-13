// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMER'S PEOPLE ON FOOT — who is about a ski area in July
// (`GameState.summer`): a table of roles beside the winter's
// (`civilian-roles.ts`), dealt by the same planner (`civilian-plan.ts`) off a
// salt of its own. `docs/civilians.md` § *Summer* carries the research.
//
// FAR FEWER, and none of them skiing. A ski area in summer carries a
// fraction of its winter's guests (`SUMMER_GUESTS`): the lifts that run
// keep their crew, but the base, the terraces and the meeting points thin
// to about a quarter of a winter's day. No skis, boards or ski boots, no
// ski school, no snowball fights or snowmen, no ski patrol on every top. In
// their place: HIKERS with packs and walking poles (a party resting at a
// top, a few groups walking the cat tracks — `civilian-hikers.ts`), riders
// in their kit standing about at a lift's foot, people picnicking on the
// grass, deck chairs out, the terrace's lunch.
//
// Three-free and DOM-free: the suite reads it.

import {
  ADULTS,
  CIVILIAN_HOURS as H,
  CIVILIAN_ROLES,
  GUESTS,
  KIDS,
  type Role,
  type RoleId,
} from "./civilian-roles.ts";

/** HOW BUSY SUMMER IS, as a share of a winter's day's guests on foot. The
 * evidence (`docs/civilians.md` § *Summer*): a country's cable cars carry
 * about a tenth of their year's passengers in summer; another's summer is
 * about a quarter of its traffic revenue; single ski areas' summer visits
 * run from a few per cent to two thirds of their winter's, a typical one
 * near a sixth, over a season of about as many days. A quarter is the
 * busy end of the typical ski area, the game's people being where it is
 * busiest (the base, the tops, the terraces). */
export const SUMMER_GUESTS = 0.25;

/** A winter role restated for summer: its numbers, its kit. */
const winter = (id: RoleId): Role => {
  const r = CIVILIAN_ROLES.find((x) => x.id === id);
  if (!r) throw new Error(`no civilian role ${id}`);
  return r;
};

/** A guest budget `most` scaled to the summer's share, at least one. */
const thin = (most: number): number => Math.max(1, Math.round(most * SUMMER_GUESTS));

/**
 * THE SUMMER ROLES, the staff first: the lift crew at every lift that runs
 * (the drags stand still in summer, so `civilian-plan.ts` mans none of
 * theirs), the top operators, a patrol on a few tops, the trail crew; then
 * the guests, each a quarter of the winter's budget.
 */
export const SUMMER_ROLES: readonly Role[] = [
  { ...winter("liftAttendant"), count: [1, 1] },
  winter("topAttendant"),
  // The patrol in summer: a pair on one top in four or five.
  { ...winter("patrol"), chance: 0.22, count: [2, 2] },
  // THE TRAIL CREW, a spade and a hi-vis shirt, here and there.
  { ...winter("worker"), chance: 0.08 },
  { ...winter("host"), chance: 0.1 },
  // A short line at the ticket window, nothing on a shoulder.
  { ...winter("queuer"), count: [1, 3], carry: "none" },
  // A HIKING PARTY resting at a top: packs on, poles in hand, looking out,
  // a drink, a word.
  {
    id: "hiker",
    at: ["summit"],
    chance: 0.5,
    count: [2, 4],
    bodies: GUESTS,
    dress: "guest",
    carry: "poles",
    moves: "ring",
    routine: [
      { act: "stand", seconds: [8, 20] },
      { act: "talk", seconds: [6, 12] },
      { act: "drink", seconds: [3, 5], carry: "mug" },
      { act: "wave", seconds: [1, 2] },
    ],
    hours: H.guests,
    staff: false,
  },
  // RIDERS in their kit at a running lift's foot (`civilian-plan.ts` keeps
  // them off the shops' fronts), waiting for the rest.
  {
    id: "biker",
    at: ["base"],
    chance: 0.5,
    count: [2, 4],
    most: 8,
    bodies: ["man", "man", "teen", "woman", "freerider", "man"],
    dress: "guest",
    carry: "none",
    moves: "ring",
    routine: [
      { act: "talk", seconds: [6, 12] },
      { act: "stand", seconds: [4, 10] },
      { act: "drink", seconds: [3, 5], carry: "mug" },
      { act: "talk", seconds: [5, 10] },
    ],
    hours: H.meet,
    staff: false,
  },
  // Walking between the lifts and the buildings, the family's children at
  // their side — a few, poles in hand or not.
  {
    ...winter("walker"),
    most: thin(30),
    chance: 0.5,
    count: [1, 1],
    carry: "poles",
    party: { role: "child", chance: 0.3, count: [1, 2] },
  },
  { ...winter("stroller"), most: thin(50), count: [1, 3], carry: "none" },
  // A drink stood in a knot, as the cocoa was.
  { ...winter("cocoa"), most: thin(30), chance: 0.2, carry: "beer" },
  // A PICNIC on the grass: a ring sat on a blanket.
  {
    id: "picnic",
    at: ["yard", "base"],
    chance: 0.2,
    count: [2, 4],
    most: 8,
    bodies: GUESTS,
    dress: "guest",
    carry: "none",
    moves: "ring",
    routine: [
      { act: "sit", seconds: [30, 80] },
      { act: "drink", seconds: [3, 6], carry: "mug" },
      { act: "talk", seconds: [8, 16] },
      { act: "sit", seconds: [20, 50] },
    ],
    hours: H.lunch,
    staff: false,
  },
  { ...winter("terraceSitter"), count: [3, 5] },
  { ...winter("terraceKnot"), chance: 0.5, count: [2, 3] },
  { ...winter("partier"), chance: 0.4, count: [2, 4] },
  { ...winter("lounger"), chance: 0.6, count: [1, 3] },
  // Those only in a party, and the dog walks' own.
  winter("child"),
  winter("dogWalker"),
  winter("dogChild"),
];

/** The ids a summer never deals: the skiing, the snow and the ski school. */
export const WINTER_ONLY: readonly RoleId[] = [
  "instructor",
  "student",
  "snowballer",
  "builder",
  "roller",
  "baseSkier",
  "meetup",
  "rester",
];

/** A HIKER on a cat track (`civilian-hikers.ts`): walked through the
 * track's bends out and back, poles in hand. */
export const TRACK_HIKER: Role = {
  id: "hiker",
  at: [],
  chance: 0,
  count: [0, 0],
  bodies: ADULTS,
  dress: "guest",
  carry: "poles",
  moves: "route",
  routine: [
    { act: "stand", seconds: [6, 14] },
    { act: "drink", seconds: [3, 5], carry: "mug" },
    { act: "talk", seconds: [4, 8] },
  ],
  hours: H.guests,
  staff: false,
};

/** A child out hiking with the family. */
export const TRACK_CHILD: Role = { ...TRACK_HIKER, bodies: KIDS, carry: "none" };

let byId: Map<RoleId, Role> | null = null;

/** A summer role by its id (a hiker the summit party's). */
export function summerRoleOf(id: RoleId): Role {
  if (!byId) {
    byId = new Map();
    for (const r of SUMMER_ROLES) if (!byId.has(r.id)) byId.set(r.id, r);
  }
  const role = byId.get(id);
  if (!role) throw new Error(`no summer civilian role ${id}`);
  return role;
}

/** HOW A SUMMER GUEST WALKS: not clumping in ski boots but in shoes or
 * light boots, a free step at an ordinary walking pace, m/s (a family at
 * the child's end, the old at the slow end). */
export const SUMMER_GAIT = { speed: [1.1, 1.4] as const } as const;

/** WHAT A SUMMER'S PEOPLE WEAR, sRGB: the shirts (a t-shirt's bright and
 * pale colours, a rider's jersey among them), the bottoms (khaki, olive,
 * denim, black, grey, stone, navy, brown — shorts or walking trousers),
 * the hats (straw, khaki, white, navy, red, black) and the day packs. */
export const SUMMER_COLOURS = {
  shirts: [
    0xf4f4f0, 0x9aa3ad, 0x1f2f55, 0xc8302e, 0x6aa9d8, 0x3f8f4c, 0xf0c83a, 0xe68bb0, 0xe8762a,
    0x1c1d21, 0x2a9d8f, 0x7b4fa6,
  ],
  bottoms: [0xb8a27a, 0x5d6640, 0x40608c, 0x1d1e22, 0x6b6f75, 0xd2c6a8, 0x232c45, 0x6a4a32],
  hats: [0xd8c08a, 0xa8986c, 0xf2f0ea, 0x1f2a48, 0xc23028, 0x1a1b1f],
  packs: [0xc8352c, 0x2b5ea8, 0x1d1f24, 0x3c7a45, 0xe0782a, 0x7d8188],
} as const;
