// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHO IS ROUND THE FIRES — the roles of the skiers stopped at a ski area's
// CAMP FIRES and BONFIRES (`engine/game/fires.ts`) to warm up and grill a
// sausage, in their ski clothes and boots: sat on the log benches, stood
// with a sausage on a long stick held over the embers, eating one in
// bread, holding their hands out to the heat. A table beside
// `civilian-roles.ts`' (which reads it into `roleOf`), dealt round each fire
// by `civilian-fires.ts`, never at a place of the main table (`at` is empty).
//
// WHEN: a camp fire is lunch on the snow — busiest from late morning into
// the early afternoon, a few still at it into the evening; a bonfire is the
// end of the day's — some company at lunch, filling as the lifts close and
// burning on into the night. Every number here is the research in
// `docs/fires.md` and `docs/civilians.md`.
//
// Three-free and DOM-free; it imports nothing but types, so the main table
// can read it without a cycle.

import type { CrowdBody } from "@engine";

import type { Hours, Role } from "./civilian-roles.ts";

/** Who stops at a fire: the guests, a few children among them. */
const FIRESIDE: readonly CrowdBody[] = [
  "man",
  "woman",
  "man",
  "woman",
  "teen",
  "oldMan",
  "oldWoman",
  "freerider",
  "retro",
  "child",
];

/** THE HOURS round a fire (share by the hour). */
export const FIRE_HOURS = {
  // Lunch on the snow, and a few lingering after dark.
  camp: [
    [0, 0],
    [8.5, 0],
    [10, 0.4],
    [11, 0.9],
    [11.5, 1],
    [14, 1],
    [15.5, 0.6],
    [17, 0.45],
    [19, 0.4],
    [22, 0.3],
    [24, 0],
  ],
  // The end of the day's: company at lunch, full as the lifts close.
  bonfire: [
    [0, 0.25],
    [2, 0],
    [10, 0],
    [11.5, 0.4],
    [14, 0.4],
    [15.5, 0.8],
    [16.5, 1],
    [22, 1],
    [24, 0.25],
  ],
} as const satisfies Readonly<Record<string, Hours>>;

const role = (r: Omit<Role, "at" | "chance" | "count" | "staff" | "dress">): Role => ({
  at: [],
  chance: 0,
  count: [0, 0],
  staff: false,
  dress: "guest",
  ...r,
});

/** THE ROLES at the fires. A sitter is dealt a bench and a stander a place
 * on the ring; whoever grills holds his stick from either. */
export const FIRE_ROLES: readonly Role[] = [
  // Sat on a bench by a camp fire: warming up, a word, a mug of cocoa.
  role({
    id: "campSitter",
    bodies: FIRESIDE,
    carry: "none",
    moves: "seat",
    routine: [
      { act: "sit", seconds: [15, 40] },
      { act: "warm", seconds: [10, 25] },
      { act: "talk", seconds: [8, 16] },
      { act: "drink", seconds: [3, 6], carry: "mug" },
      { act: "sit", seconds: [10, 25] },
    ],
    hours: FIRE_HOURS.camp,
  }),
  // A SAUSAGE ON A STICK over the embers, turned — then eaten in bread.
  role({
    id: "campGriller",
    bodies: FIRESIDE,
    carry: "none",
    moves: "area",
    routine: [
      { act: "grill", seconds: [70, 160] },
      { act: "eat", seconds: [25, 45] },
      { act: "talk", seconds: [6, 12] },
    ],
    hours: FIRE_HOURS.camp,
  }),
  // Stood eating one, a bite now and then.
  role({
    id: "campEater",
    bodies: FIRESIDE,
    carry: "none",
    moves: "area",
    routine: [
      { act: "eat", seconds: [40, 80] },
      { act: "warm", seconds: [10, 20] },
      { act: "talk", seconds: [6, 12] },
    ],
    hours: FIRE_HOURS.camp,
  }),
  // Stood with both hands held out to the fire.
  role({
    id: "campWarmer",
    bodies: FIRESIDE,
    carry: "none",
    moves: "area",
    routine: [
      { act: "warm", seconds: [25, 60] },
      { act: "talk", seconds: [6, 14] },
      { act: "warm", seconds: [15, 40] },
      { act: "stand", seconds: [5, 10] },
    ],
    hours: FIRE_HOURS.camp,
  }),
  // Sat on a bonfire's bench at the end of the day, a mug or a beer.
  role({
    id: "bonfireSitter",
    bodies: FIRESIDE,
    carry: "none",
    moves: "seat",
    routine: [
      { act: "sit", seconds: [20, 50] },
      { act: "warm", seconds: [10, 20] },
      { act: "talk", seconds: [8, 16] },
      { act: "drink", seconds: [3, 6], carry: "beer" },
    ],
    hours: FIRE_HOURS.bonfire,
  }),
  role({
    id: "bonfireGriller",
    bodies: FIRESIDE,
    carry: "none",
    moves: "area",
    routine: [
      { act: "grill", seconds: [80, 180] },
      { act: "eat", seconds: [25, 45] },
    ],
    hours: FIRE_HOURS.bonfire,
  }),
  // Stood in the ring round a bonfire, warming up and talking.
  role({
    id: "bonfireGuest",
    bodies: FIRESIDE,
    carry: "none",
    moves: "area",
    routine: [
      { act: "warm", seconds: [20, 45] },
      { act: "talk", seconds: [8, 16] },
      { act: "drink", seconds: [3, 6], carry: "mug" },
      { act: "stand", seconds: [6, 14] },
      { act: "warm", seconds: [15, 30] },
    ],
    hours: FIRE_HOURS.bonfire,
  }),
];
