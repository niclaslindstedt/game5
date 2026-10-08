// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHO IS OUT THERE ON FOOT — the roles of the free ride's CIVILIANS, the
// people about a ski area who are not skiing: its staff at their posts and
// its guests off their skis. A table, stated once; `civilian-plan.ts` deals
// it over the places `civilian-spots.ts` finds, and `docs/civilians.md`
// carries the research every number here comes off.
//
// A ROLE is where a person is dealt (the kinds of place, how likely a place
// is to have any, how many), who he can be (the crowd's eight bodies,
// `CROWD_BODIES`), what he wears (a staff colour or a guest's own), what he
// does (a ROUTINE of activities, each held a dealt while, repeated), how he
// stands or moves (at a post, anywhere about the place, on a seat, or
// walking a leg between two places) and WHEN he is out — a share by the
// hour, so the early morning is the staff's, midday the busiest, the
// afternoon the terrace's and the night the partiers', a few staff and the
// odd walker.
//
// Three-free and DOM-free: the suite reads it.

import type { CrowdBody } from "@engine";

import type { SpotKind } from "./civilian-spots.ts";

/** What a civilian is doing — the pose the figure is drawn in.
 *   * `stand`: stood idle, weight shifting; `talk` the same turned to
 *     someone, a hand going; `wave` an arm up and over.
 *   * `walk`: walking in ski boots (`BOOT_GAIT`).
 *   * `sit`: sat — on a bench (the pose's `seat` > 0) or in the snow (0).
 *   * `lounge`: laid back in a deck chair, face to the sun.
 *   * `drink`: the cup or glass raised to the mouth (stood or sat).
 *   * `cheer`: a beer held up high.
 *   * `dance`: dancing on the terrace, on the lodge's shared beat (the
 *     pose's `clock` is the run's own clock there, so the whole terrace
 *     keeps one time).
 *   * `shovel`: a scoop of snow lifted and thrown aside, over and over.
 *   * `sweep`: a broom worked across the load line's boards.
 *   * `throw`: a snowball scooped, packed and thrown.
 *   * `build`: crouched packing a snowman. */
export type Activity =
  | "stand"
  | "talk"
  | "wave"
  | "walk"
  | "sit"
  | "lounge"
  | "drink"
  | "cheer"
  | "dance"
  | "shovel"
  | "sweep"
  | "throw"
  | "build";

/** What a civilian has in his hands. `skis`: a pair on one shoulder, tips
 * forward and down, a hand in front on them, the bindings behind the
 * shoulder (the poles in the other hand). */
export type Carry = "none" | "skis" | "mug" | "beer" | "shovel" | "broom";

/** What he wears: a staff uniform (`STAFF_DRESS`) or a guest's own kit. */
export type Dress = "lift" | "patrol" | "school" | "worker" | "host" | "guest";

export type RoleId =
  | "liftAttendant"
  | "topAttendant"
  | "patrol"
  | "worker"
  | "instructor"
  | "student"
  | "host"
  | "partier"
  | "terraceSitter"
  | "lounger"
  | "cocoa"
  | "rester"
  | "walker"
  | "child"
  | "snowballer"
  | "builder";

/** One step of a routine: the activity, how long it is held (dealt between
 * the two, s), what is in his hands meanwhile (the role's own if unsaid). */
export type Step = {
  readonly act: Activity;
  readonly seconds: readonly [number, number];
  readonly carry?: Carry;
};

/** How a role stands or moves:
 *   * `post`: at the place's own post (a booth's door, the operator's spot)
 *     and nowhere else;
 *   * `area`: anywhere clear about the place;
 *   * `seat`: on one of the place's seats (a terrace bench), else about it;
 *   * `chair`: in a deck chair set out for him on the snow (a prop);
 *   * `walk`: walking a leg to another place and back, pausing at each end;
 *   * `ring`: about the place in a ring of his own party, facing in (a
 *     knot of people with mugs; a class round its instructor). */
export type Moves = "post" | "area" | "seat" | "chair" | "walk" | "ring";

/** A party a role brings with him: who, how likely, how many. */
export type Party = {
  readonly role: RoleId;
  readonly chance: number;
  readonly count: readonly [number, number];
};

/** A share of a role out at each hour, 0..1: points (hour, share) from 0
 * to 24, the share read between them. */
export type Hours = readonly (readonly [number, number])[];

export type Role = {
  readonly id: RoleId;
  /** The places dealt at — none for a role that only comes in a party. */
  readonly at: readonly SpotKind[];
  /** The share of those places with any, and how many at each. */
  readonly chance: number;
  readonly count: readonly [number, number];
  readonly bodies: readonly CrowdBody[];
  readonly dress: Dress;
  readonly carry: Carry;
  readonly moves: Moves;
  readonly routine: readonly Step[];
  readonly hours: Hours;
  /** Staff: the first at a post is out whenever his post is manned at all. */
  readonly staff: boolean;
  readonly party?: Party;
};

/** THE STAFF COLOURS, sRGB. A ski area dresses its staff so a guest finds
 * them across a base area: the lift crew in the area's dark shell under a
 * high-visibility bib, the patrol in RED with a white CROSS front and back
 * over black pants (red and white read against the snow from a long way
 * off), the ski school in a colour of its own, the workers on the decks
 * and paths in high-visibility orange, the guest service desk in the
 * area's green. `mark` is the cross or the bib's band, `pants` the pants. */
export const STAFF_DRESS: Readonly<
  Record<Exclude<Dress, "guest">, { jacket: number; mark: number; pants: number; bib?: number }>
> = {
  lift: { jacket: 0x1f3550, mark: 0xd9e021, pants: 0x1c1f24, bib: 0xd9e021 },
  patrol: { jacket: 0xc4161c, mark: 0xffffff, pants: 0x151515 },
  school: { jacket: 0x1b7fa8, mark: 0xffffff, pants: 0x1c2430 },
  worker: { jacket: 0xf26a1b, mark: 0xe8e8e0, pants: 0x2a2e33, bib: 0xf2d21b },
  host: { jacket: 0x2e5e3a, mark: 0xf1ece0, pants: 0x1c1f24 },
};

/** HOW PEOPLE WALK IN SKI BOOTS: the stiff shell holds the ankle, so the
 * knee bends less and the hip more; the step is short and the pace slow,
 * the foot set down flat with a heel-and-roll clump; the arms swing little
 * (one is on the skis). `speed` the pace dealt, m/s (a family at the
 * child's end, the old at the slow end); `step` one step, m — a stride is
 * two; `cadence` steps a second at the middle of the pace. */
export const BOOT_GAIT = { speed: [0.8, 1.1] as const, step: 0.55, cadence: 1.7 } as const;

const ADULTS: readonly CrowdBody[] = ["man", "woman", "man", "woman", "freerider"];
const GUESTS: readonly CrowdBody[] = [
  "man",
  "woman",
  "man",
  "woman",
  "teen",
  "oldMan",
  "oldWoman",
  "freerider",
  "retro",
];
const PARTY: readonly CrowdBody[] = ["man", "woman", "man", "woman", "teen", "freerider", "retro"];
const KIDS: readonly CrowdBody[] = ["child"];

/** THE HOURS each kind of person is out (share by the hour). The lifts
 * turn from about half past eight to half past four, and here always run,
 * so half the lift crew is still on after dark; the patrol sweeps the
 * runs at the close and is mostly gone; the workers clear the decks and
 * paths before the first chair; the ski school runs a morning and an
 * afternoon class; lunch on the snow is late morning to early afternoon;
 * the terrace starts as the lifts close and runs into the night. */
const H = {
  lift: [
    [0, 0.5],
    [7, 0.5],
    [8.3, 1],
    [16.8, 1],
    [17.5, 0.5],
    [24, 0.5],
  ],
  patrol: [
    [0, 0.1],
    [7.5, 0.1],
    [8.3, 1],
    [16.5, 1],
    [17.5, 0.1],
    [24, 0.1],
  ],
  worker: [
    [0, 0.2],
    [6, 0.3],
    [7.5, 1],
    [10, 0.6],
    [15, 0.5],
    [17, 0.2],
    [24, 0.2],
  ],
  school: [
    [0, 0],
    [9, 0],
    [9.5, 1],
    [12, 1],
    [12.5, 0.2],
    [13.5, 0.2],
    [14, 1],
    [16, 1],
    [16.5, 0],
    [24, 0],
  ],
  desk: [
    [0, 0],
    [8, 0],
    [8.5, 1],
    [16.5, 1],
    [17, 0],
    [24, 0],
  ],
  afterski: [
    [0, 0.5],
    [3, 0],
    [11, 0],
    [13, 0.2],
    [15, 0.6],
    [16.5, 1],
    [21, 1],
    [24, 0.5],
  ],
  sun: [
    [0, 0],
    [9.5, 0],
    [11, 0.5],
    [12, 1],
    [15, 1],
    [16.5, 0.2],
    [17.5, 0],
    [24, 0],
  ],
  lunch: [
    [0, 0],
    [8, 0],
    [9, 0.3],
    [10.5, 0.8],
    [12, 1],
    [15.5, 1],
    [17, 0.4],
    [19, 0.1],
    [20.5, 0],
    [24, 0],
  ],
  guests: [
    [0, 0.05],
    [7, 0.05],
    [8.5, 0.6],
    [10, 1],
    [16, 1],
    [17, 0.7],
    [19, 0.2],
    [22, 0.08],
    [24, 0.05],
  ],
  kids: [
    [0, 0],
    [9, 0],
    [10, 0.7],
    [12, 1],
    [16, 1],
    [17, 0.2],
    [18, 0],
    [24, 0],
  ],
} as const satisfies Readonly<Record<string, Hours>>;

/** THE ROLES, the staff first and the walkers next: dealt in this order,
 * so a full map's cap is met by a knot at a porch rather than by an
 * unmanned lift or an empty base area. */
export const CIVILIAN_ROLES: readonly Role[] = [
  // THE LIFT CREW at every foot: by the booth over the load line, watching
  // each chair in, sweeping the snow off the boards, shovelling the ramp
  // and waving a rider on.
  {
    id: "liftAttendant",
    at: ["liftFoot"],
    chance: 1,
    count: [1, 2],
    bodies: ADULTS,
    dress: "lift",
    carry: "none",
    moves: "post",
    routine: [
      { act: "stand", seconds: [14, 30] },
      { act: "sweep", seconds: [8, 16], carry: "broom" },
      { act: "stand", seconds: [10, 20] },
      { act: "wave", seconds: [2, 4] },
      { act: "shovel", seconds: [6, 12], carry: "shovel" },
    ],
    hours: H.lift,
    staff: true,
  },
  // THE TOP OPERATOR at a chair's or a gondola's top, by his booth.
  {
    id: "topAttendant",
    at: ["liftTop"],
    chance: 1,
    count: [1, 1],
    bodies: ADULTS,
    dress: "lift",
    carry: "none",
    moves: "post",
    routine: [
      { act: "stand", seconds: [20, 40] },
      { act: "wave", seconds: [2, 3] },
      { act: "sweep", seconds: [6, 12], carry: "broom" },
    ],
    hours: H.lift,
    staff: true,
  },
  // THE PATROL at a top, beside the station, looking over the runs.
  {
    id: "patrol",
    at: ["summit"],
    chance: 0.7,
    count: [1, 2],
    bodies: ADULTS,
    dress: "patrol",
    carry: "none",
    moves: "ring",
    routine: [
      { act: "stand", seconds: [20, 40] },
      { act: "talk", seconds: [10, 20] },
      { act: "wave", seconds: [2, 3] },
    ],
    hours: H.patrol,
    staff: true,
  },
  // THE WORKERS: a deck, a porch or a path shovelled clear.
  {
    id: "worker",
    at: ["yard", "porch", "base"],
    chance: 0.22,
    count: [1, 1],
    bodies: ["man", "man", "woman"],
    dress: "worker",
    carry: "shovel",
    moves: "area",
    routine: [
      { act: "shovel", seconds: [20, 40] },
      { act: "stand", seconds: [4, 8] },
      { act: "shovel", seconds: [15, 30] },
      { act: "stand", seconds: [6, 12] },
    ],
    hours: H.worker,
    staff: true,
  },
  // THE SKI SCHOOL gathering its class at the base: the instructor talking
  // and pointing, the children in a ring before him with their skis.
  {
    id: "instructor",
    at: ["base"],
    chance: 0.25,
    count: [1, 1],
    bodies: ["man", "woman"],
    dress: "school",
    carry: "none",
    moves: "area",
    routine: [
      { act: "talk", seconds: [8, 15] },
      { act: "wave", seconds: [3, 5] },
      { act: "stand", seconds: [6, 10] },
    ],
    hours: H.school,
    staff: true,
    party: { role: "student", chance: 1, count: [3, 5] },
  },
  {
    id: "student",
    at: [],
    chance: 0,
    count: [0, 0],
    bodies: KIDS,
    dress: "guest",
    carry: "skis",
    moves: "ring",
    routine: [
      { act: "stand", seconds: [10, 20] },
      { act: "talk", seconds: [3, 6] },
      { act: "stand", seconds: [8, 16] },
      { act: "wave", seconds: [1, 2] },
    ],
    hours: H.school,
    staff: false,
  },
  // THE GUEST DESK at the base: where tickets and the way are asked for.
  {
    id: "host",
    at: ["base"],
    chance: 0.12,
    count: [1, 1],
    bodies: ADULTS,
    dress: "host",
    carry: "none",
    moves: "area",
    routine: [
      { act: "stand", seconds: [12, 25] },
      { act: "talk", seconds: [8, 16] },
      { act: "wave", seconds: [2, 3] },
    ],
    hours: H.desk,
    staff: true,
  },
  // Walking between the lifts and the buildings: skis on a shoulder or
  // empty-handed, now and then a family with the children alongside.
  {
    id: "walker",
    at: ["base", "yard", "porch"],
    chance: 0.8,
    count: [1, 2],
    bodies: GUESTS,
    dress: "guest",
    carry: "skis",
    moves: "walk",
    routine: [
      { act: "stand", seconds: [6, 20] },
      { act: "talk", seconds: [4, 10] },
    ],
    hours: H.guests,
    staff: false,
    party: { role: "child", chance: 0.25, count: [1, 2] },
  },
  {
    id: "child",
    at: [],
    chance: 0,
    count: [0, 0],
    bodies: KIDS,
    dress: "guest",
    carry: "none",
    moves: "walk",
    routine: [
      { act: "stand", seconds: [4, 10] },
      { act: "wave", seconds: [1, 2] },
    ],
    hours: H.guests,
    staff: false,
  },
  // THE TERRACE: dancing, a beer held up, a word shouted over the music.
  {
    id: "partier",
    at: ["terrace"],
    chance: 1,
    count: [8, 14],
    bodies: PARTY,
    dress: "guest",
    carry: "beer",
    moves: "area",
    routine: [
      { act: "dance", seconds: [20, 60] },
      { act: "drink", seconds: [3, 6] },
      { act: "cheer", seconds: [2, 4] },
      { act: "dance", seconds: [15, 40] },
      { act: "talk", seconds: [8, 15] },
    ],
    hours: H.afterski,
    staff: false,
  },
  // At the terrace's tables, sat with a glass.
  {
    id: "terraceSitter",
    at: ["terrace"],
    chance: 1,
    count: [4, 8],
    bodies: GUESTS,
    dress: "guest",
    carry: "beer",
    moves: "seat",
    routine: [
      { act: "sit", seconds: [20, 50] },
      { act: "drink", seconds: [3, 6] },
      { act: "sit", seconds: [15, 30] },
      { act: "talk", seconds: [8, 15] },
    ],
    hours: H.afterski,
    staff: false,
  },
  // Deck chairs on the snow before a lodge, faces to the sun.
  {
    id: "lounger",
    at: ["yard"],
    chance: 0.8,
    count: [2, 5],
    bodies: GUESTS,
    dress: "guest",
    carry: "none",
    moves: "chair",
    routine: [
      { act: "lounge", seconds: [60, 180] },
      { act: "drink", seconds: [3, 6], carry: "mug" },
      { act: "lounge", seconds: [40, 120] },
    ],
    hours: H.sun,
    staff: false,
  },
  // A knot of people stood with mugs of cocoa, sipping and talking.
  {
    id: "cocoa",
    at: ["yard", "porch", "base"],
    chance: 0.35,
    count: [2, 3],
    bodies: GUESTS,
    dress: "guest",
    carry: "mug",
    moves: "ring",
    routine: [
      { act: "stand", seconds: [6, 12] },
      { act: "drink", seconds: [3, 5] },
      { act: "talk", seconds: [6, 12] },
      { act: "drink", seconds: [2, 4] },
    ],
    hours: H.lunch,
    staff: false,
  },
  // Sat down in the snow for a rest, boots out in front.
  {
    id: "rester",
    at: ["yard", "porch", "base"],
    chance: 0.3,
    count: [1, 2],
    bodies: GUESTS,
    dress: "guest",
    carry: "none",
    moves: "area",
    routine: [
      { act: "sit", seconds: [40, 120] },
      { act: "talk", seconds: [6, 12] },
      { act: "sit", seconds: [30, 90] },
    ],
    hours: H.lunch,
    staff: false,
  },
  // Children at play: a snowball fight across the yard, a snowman built.
  {
    id: "snowballer",
    at: ["yard", "base"],
    chance: 0.3,
    count: [1, 1],
    bodies: KIDS,
    dress: "guest",
    carry: "none",
    moves: "ring",
    routine: [
      { act: "throw", seconds: [2, 3] },
      { act: "stand", seconds: [1, 3] },
      { act: "throw", seconds: [2, 3] },
      { act: "wave", seconds: [1, 2] },
    ],
    hours: H.kids,
    staff: false,
    party: { role: "snowballer", chance: 1, count: [1, 2] },
  },
  {
    id: "builder",
    at: ["yard", "porch", "base"],
    chance: 0.12,
    count: [1, 2],
    bodies: KIDS,
    dress: "guest",
    carry: "none",
    moves: "ring",
    routine: [
      { act: "build", seconds: [10, 20] },
      { act: "stand", seconds: [2, 5] },
      { act: "build", seconds: [8, 16] },
    ],
    hours: H.kids,
    staff: false,
  },
];

/** A role by its id. */
export function roleOf(id: RoleId): Role {
  const role = CIVILIAN_ROLES.find((r) => r.id === id);
  if (!role) throw new Error(`no civilian role ${id}`);
  return role;
}

/** The share of a role out at `hour` (0..24, wrapped). */
export function shareAt(hours: Hours, hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  for (let k = 0; k + 1 < hours.length; k++) {
    const [h0, s0] = hours[k];
    const [h1, s1] = hours[k + 1];
    if (h >= h0 && h <= h1) return h1 > h0 ? s0 + ((s1 - s0) * (h - h0)) / (h1 - h0) : s1;
  }
  return 0;
}
