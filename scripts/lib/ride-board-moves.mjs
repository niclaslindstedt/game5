// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDE LAB'S BOARD MOVES — a snowboarder at a crawl and stood across a
// slope (`board-moves.ts`) and his falls (`board-crash.ts`), on the board
// whatever pair the lab is asked for: the ONE-FOOT SKATE off a standstill
// across the flat and onto a gentle pitch (the rear foot out, the push, the
// foot strapped back in), the STEP ROUND ON THE SPOT about the front foot,
// the SIDESLIP down a 31° face on the uphill edge eased off and set again,
// the FALLING LEAF across a 25° one, the DOWNHILL EDGE CAUGHT both ways (slammed
// onto his back off the heel edge, thrown onto his face off the toe edge),
// a trunk ridden into with the board kept on, and BOGGED in a metre of
// fresh snow and dug and hopped out. Listed in `ride-scenarios.mjs`.

import { TUCK, IDLE, fmt, wipeout, rock, dug, trench, DEEP } from "./ride-helpers.mjs";

/** The board every scenario here is ridden on. */
const BOARD = "lynx";

/** The steep face the sideslips are ridden on: 31° (a black's pitch). */
const FACE = (S) => S.flatLevel({ packed: 1, grade: 0.6, slopeFrom: 0, size: 4000 });

/** Stood across it, the fall line down +z: facing UP the hill on the toe
 * edge (`toe`), or DOWN it on the heel edge. */
const ACROSS = (toe) => () => ({ x: 2000, z: 1000, heading: toe ? Math.PI / 2 : -Math.PI / 2 });

/** The steer AWAY from the hill, of full, for a rider stood across the
 * face facing `toe` up it — the hill on his toe side (`toe`) or his heel
 * side — as `SkierState.sidestep` reads it (the hill on his right positive,
 * a regular rider's toe edge). */
const away = (toe, share) => ({ ...IDLE, steer: (toe ? -1 : 1) * share });

/** A sideslip's numbers: how far down and across he went, how fast, how
 * far he swung the nose, and when he came to a stop on his edge again. */
function slipped(run, from = 0) {
  const fs = run.frames.filter((f) => f.t >= from);
  const first = fs[0];
  const last = fs[fs.length - 1];
  const top = fs.reduce((m, f) => Math.max(m, f.speed), 0);
  let lo = 0;
  let hi = 0;
  for (const f of fs) {
    lo = Math.min(lo, f.x - first.x);
    hi = Math.max(hi, f.x - first.x);
  }
  const leaf = fs.reduce((m, f) => Math.max(m, Math.abs(f.board?.leaf ?? 0)), 0);
  return [
    ["down m", fmt(last.z - first.z, 1)],
    ["across m", `${fmt(lo, 1)}..${fmt(hi, 1)}`],
    ["top km/h", fmt(top * 3.6, 1)],
    ["nose swung deg", fmt(leaf * 57.3, 0)],
  ];
}

/** What a fall left on his feet: the skis let go (none on a board) and how
 * far apart his feet lay, against the board's stance. */
function kept(run) {
  const lying = run.frames.filter((f) => f.thrown);
  const lone = run.frames.reduce((m, f) => Math.max(m, f.loneSkis), 0);
  const feet = lying.map((f) => f.feet);
  return [
    ["skis let go", String(lone)],
    [
      "feet apart m",
      feet.length ? `${fmt(Math.min(...feet), 2)}..${fmt(Math.max(...feet), 2)}` : "—",
    ],
  ];
}

export const BOARD_MOVES_SCENARIOS = [
  {
    id: "board-skate-flat",
    title: "the one-foot skate from rest across the flat and onto a 12% pitch",
    skis: BOARD,
    level: (S) => S.flatLevel({ packed: 1, grade: 0.12, slopeFrom: 240 }),
    place: () => ({ x: 1500, z: 200, heading: 0 }),
    seconds: 20,
    view: "profile",
    input: () => TUCK,
    measure: (run) => {
      const at = (s) => run.frames.find((f) => f.t >= s);
      const flat = run.frames.filter((f) => f.z < 240);
      const free = run.frames.filter((f) => f.board?.free);
      const out = free[0];
      const back = out ? run.frames.find((f) => f.t > out.t && !f.board?.free) : null;
      const pushes = flat.length ? flat[flat.length - 1].stride / flat[flat.length - 1].t : 0;
      return [
        ["at 2 s km/h", fmt(at(2).speed * 3.6, 1)],
        ["at 5 s km/h", fmt(at(5).speed * 3.6, 1)],
        ["top on the flat km/h", fmt(flat.reduce((m, f) => Math.max(m, f.speed), 0) * 3.6, 1)],
        ["pushes a second", fmt(pushes, 2)],
        ["foot out at s", out ? fmt(out.t) : "—"],
        ["strapped in at km/h", back ? fmt(back.speed * 3.6, 1) : "—"],
        ["at 20 s km/h", fmt(run.frames[run.frames.length - 1].speed * 3.6, 1)],
      ];
    },
  },
  {
    id: "board-pivot",
    title: "stood still, the steer held: the board stepped round about the front foot",
    skis: BOARD,
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0 }),
    seconds: 4,
    view: "plan",
    input: () => ({ ...IDLE, steer: 1 }),
    measure: (run) => {
      const half = 0.265;
      const front = (f) => [f.x + half * Math.sin(f.heading), f.z + half * Math.cos(f.heading)];
      const a = run.frames[0];
      const b = run.frames[run.frames.length - 1];
      const [ax, az] = front(a);
      const [bx, bz] = front(b);
      return [
        ["turned deg", fmt((b.heading - a.heading) * 57.3, 0)],
        ["middle moved m", fmt(Math.hypot(b.x - a.x, b.z - a.z), 2)],
        ["front foot moved m", fmt(Math.hypot(bx - ax, bz - az), 2)],
        ["foot out", run.frames.some((f) => f.board?.free) ? "yes" : "no"],
      ];
    },
  },
  {
    id: "board-sideslip-steep",
    title: "a heelside sideslip down the 31° face: the edge eased off 4 s, then set",
    skis: BOARD,
    level: FACE,
    place: ACROSS(false),
    seconds: 7,
    view: "profile",
    input: (t) => (t < 4 ? away(false, 0.5) : IDLE),
    measure: (run) => {
      const stop = run.frames.find((f) => f.t > 4 && f.speed < 0.1);
      const mid = run.frames.filter((f) => f.t > 2 && f.t < 4);
      return [
        ...slipped(run),
        ["drift km/h", fmt((mid.reduce((s, f) => s + f.speed, 0) / mid.length) * 3.6, 1)],
        ["stopped on the edge at s", stop ? fmt(stop.t) : "—"],
        ...wipeout(run).slice(0, 1),
      ];
    },
  },
  {
    id: "board-leaf",
    title: "the falling leaf down a 25° face: the lean forward 2 s, back 2 s",
    skis: BOARD,
    level: (S) => S.flatLevel({ packed: 1, grade: 0.47, slopeFrom: 0, size: 4000 }),
    place: ACROSS(false),
    seconds: 10,
    view: "plan",
    input: (t) => ({ ...away(false, 0.4), lean: Math.floor(t / 2) % 2 ? -1 : 1 }),
    measure: (run) => [...slipped(run), ...wipeout(run).slice(0, 1)],
  },
  {
    id: "board-catch-back",
    title: "a toeside sideslip let go past flat: the heel edge caught, slammed onto his back",
    skis: BOARD,
    level: FACE,
    place: ACROSS(true),
    seconds: 6,
    view: "profile",
    input: (t) => away(true, t < 1 ? 0.75 : 1),
    measure: (run) => [...wipeout(run), ...kept(run)],
  },
  {
    id: "board-catch-face",
    title: "a heelside sideslip let go past flat: the toe edge caught, onto his face",
    skis: BOARD,
    level: FACE,
    place: ACROSS(false),
    seconds: 6,
    view: "profile",
    input: (t) => away(false, t < 1 ? 0.75 : 1),
    measure: (run) => [...wipeout(run), ...kept(run)],
  },
  {
    id: "board-wipeout-tree",
    title: "a trunk met at 50 km/h on the board: no binding lets go",
    skis: BOARD,
    level: (S) => S.syntheticLevel(),
    place: (S) => ({ x: S.LONE_TREE.x + 0.4, z: S.LONE_TREE.z - 40, heading: 0, speed: 50 / 3.6 }),
    seconds: 7,
    view: "plan",
    input: () => TUCK,
    measure: (run) => [...wipeout(run), ...kept(run)],
  },
  {
    id: "board-bog",
    title: "hopping from rest in a metre of fresh snow, bogged, then rocked and dug out",
    skis: BOARD,
    level: (S) => S.flatLevel({ packed: 0 }),
    snow: DEEP,
    place: () => ({ x: 1500, z: 300, heading: 0 }),
    seconds: 16,
    view: "profile",
    // Hopped until he has sunk 15 cm in, then the board rocked until the
    // hole is packed back, then hopped off.
    input: (t, st) => {
      const c = st.skier;
      if (!dug.has(st) && c.trench >= 0.15) dug.set(st, "rock");
      if (dug.get(st) === "rock" && c.trench === 0) dug.set(st, "away");
      return dug.get(st) === "rock" ? rock(t, 1.2, 0.35) : TUCK;
    },
    measure: (run) => [
      ...trench(run),
      [
        "hopping share",
        fmt(
          run.frames.reduce((m, f) => Math.max(m, f.board?.hop ?? 0), 0),
          2,
        ),
      ],
    ],
  },
];
