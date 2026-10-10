// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDE LAB'S BOARD SCENARIOS — the snowboard (`defs/boards.ts`) on the
// bench, on the board whatever pair the lab is asked for: a straight run
// tucked down the 20° pitch, a carve held at a speed its 7.8 m sidecut can
// hold (the radius against the one the edge asks for, `carveCurvature`, and
// the sidecut's own geometry, R·cos edge, which nothing carves tighter
// than), riding FAKIE down a groomer and steered (a board never turns round
// out of it — `switch.ts`), the slope's kicker, and powder, where one wide
// deck floats a rider a pair of skis sinks; the TOE EDGE against the HEEL
// EDGE, the same full edge held either way at 50 km/h (the heel edge the
// weaker — `BoardFit.heel`) and cut hard at 80; and the EDGE CAUGHT — slid
// sideways with its leading edge stood down — beside the SIDESLIP, the
// same slide led by the raised edge, which a rider rides
// (`crash.ts`'s `edgeCatching`). Listed in `ride-scenarios.mjs`;
// `--skis lynx` rides every other scenario on it too.

import {
  TUCK,
  IDLE,
  fmt,
  schuss,
  flight,
  hold,
  schussStrip,
  onPitch,
  atKicker,
  TOP,
  turn,
  wipeout,
} from "./ride-helpers.mjs";

/** The board every scenario here is ridden on. */
const BOARD = "lynx";

/** A CARVE'S NUMBERS from the path itself, over the second and a half after
 * it settles (t = 1.5..3 s): the radius the line bends at (the way's
 * heading turned over the distance — what the snow would show), the edge
 * he stood on, the radius that edge asks of the sidecut (R / tan edge) and
 * the sidecut's geometric least (R · cos edge), the lateral g and the
 * worst slip across the board. */
function carved(run, spec) {
  const fs = run.frames.filter((f) => f.t >= 1.5);
  let turned = 0;
  let dist = 0;
  for (let i = 1; i < fs.length; i++) {
    const a = Math.atan2(fs[i].vx, fs[i].vz);
    const b = Math.atan2(fs[i - 1].vx, fs[i - 1].vz);
    turned += Math.atan2(Math.sin(a - b), Math.cos(a - b));
    dist += Math.hypot(fs[i].x - fs[i - 1].x, fs[i].z - fs[i - 1].z);
  }
  const radius = Math.abs(turned) > 1e-6 ? dist / Math.abs(turned) : Infinity;
  const edge = fs.reduce((s, f) => s + Math.abs(f.edge), 0) / Math.max(1, fs.length);
  const v = fs.reduce((s, f) => s + f.speed, 0) / Math.max(1, fs.length);
  return [
    ["radius m", fmt(radius, 1)],
    ["edge deg", fmt(edge * 57.3, 1)],
    ["R/tan edge m", fmt(spec.sidecut / Math.tan(edge), 1)],
    ["R·cos edge m", fmt(spec.sidecut * Math.cos(edge), 2)],
    ["speed km/h", fmt(v * 3.6, 1)],
    ["lateral g", fmt((v * v) / radius / 9.81, 2)],
    ["worst slip m/s", fmt(Math.max(...fs.map((f) => f.sideSlip)), 2)],
    ["thrown", run.frames.some((f) => f.thrown) ? "yes" : "no"],
  ];
}

/** THE TOE EDGE is the board's right under its regular rider: steered
 * right he stands on his toes, left on his heels. */
const TOE = 1;

/** A carve on one edge: full edge held (cut hard where `cut`) at `kmh`
 * down the 20° pitch, toward the toes (`side` 1) or the heels (-1). */
function edgeCarve(id, side, kmh, cut) {
  const which = side === TOE ? "toe" : "heel";
  return {
    id,
    title: `full edge on the ${which}s at ${kmh} km/h down the 20° pitch${cut ? ", cut hard" : ""}`,
    skis: BOARD,
    level: (S) => schussStrip(S),
    place: () => onPitch(kmh),
    seconds: 3,
    view: "plan",
    input: (t, st) => ({ ...TUCK, steer: side, carve: cut, ...hold(st, kmh) }),
    measure: (run) => [
      ...turn(run),
      ["worst slip m/s", fmt(Math.max(...run.frames.map((f) => f.sideSlip)), 1)],
      ["thrown", run.frames.some((f) => f.thrown) ? "yes" : "no"],
    ],
  };
}

/** Slid sideways across the flat at 45 km/h, the board stood `edge` rad
 * over (right side down positive): facing +x and sliding +z, toward the
 * rider's left, so a NEGATIVE edge has the leading edge down. */
function slidAcross(id, title, edge) {
  return {
    id,
    title,
    skis: BOARD,
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 300, heading: Math.PI / 2, speed: 0 }),
    prepare: (st) => {
      st.skier.vx = 0;
      st.skier.vz = 45 / 3.6;
      st.skier.edge = edge;
    },
    seconds: 4,
    view: "plan",
    input: () => ({ ...IDLE, steer: Math.sign(edge) }),
    measure: (run) => [
      ["worst side slip m/s", fmt(Math.max(...run.frames.map((f) => f.sideSlip)), 1)],
      ...wipeout(run),
    ],
  };
}

/** The board scenarios, in the ride lab's order. */
export const BOARD_SCENARIOS = [
  {
    id: "board-straight",
    title: "the board straight-lined in a crouch down the 20° groomed pitch from a push-off",
    skis: BOARD,
    level: (S) => schussStrip(S, 1),
    place: () => TOP,
    seconds: 30,
    view: "profile",
    input: () => TUCK,
    measure: schuss,
  },
  {
    id: "board-carve",
    title: "the board on half its edge at 30 km/h down the 20° groomed pitch",
    skis: BOARD,
    level: (S) => schussStrip(S),
    place: () => onPitch(30),
    seconds: 3,
    view: "plan",
    input: (t, st) => ({ ...TUCK, steer: 0.5, ...hold(st, 30) }),
    measure: (run) => carved(run, run.spec),
  },
  {
    id: "board-carve-fast",
    title: "the board on half its edge at 60 km/h — more bend asked than the edge holds",
    skis: BOARD,
    level: (S) => schussStrip(S),
    place: () => onPitch(60),
    seconds: 3,
    view: "plan",
    input: (t, st) => ({ ...TUCK, steer: 0.5, ...hold(st, 60) }),
    measure: (run) => carved(run, run.spec),
  },
  {
    // Stood facing UP a 14° groomer and let go: he runs backward — FAKIE —
    // and is steered right from 3 s to 4 s. A pair of skis turns round
    // under 15 km/h (`switch.revert`); a board rides on tail first.
    id: "board-fakie",
    title: "the board let go facing up a 14° groomer: ridden fakie 8 s, steered right at 3 s",
    skis: BOARD,
    mode: "free",
    level: (S) => S.flatLevel({ packed: 1, grade: 0.25, slopeFrom: 0 }),
    place: () => ({ x: 1500, z: 200, heading: Math.PI, pitch: Math.atan(0.25) }),
    seconds: 8,
    view: "plan",
    input: (t) => ({ ...IDLE, steer: t > 3 && t < 4 ? 1 : 0 }),
    measure: (run) => {
      const last = run.frames[run.frames.length - 1];
      const out = run.events.find((e) => e.kind === "wipeout");
      return [
        ["way km/h", fmt(last.way * 3.6, 1)],
        ["went right m", fmt(last.x - 1500, 2)],
        ["fakie at end", last.switched ? "yes" : "no"],
        ["reverted", run.frames.some((f) => f.reverting) ? "yes" : "no"],
        ["wipeout", out ? `${out.cause} at ${fmt(out.t, 2)} s` : "none"],
      ];
    },
  },
  {
    id: "board-kicker",
    title: "the board off the slope's kicker at 60 km/h",
    skis: BOARD,
    level: (S) => S.syntheticLevel(),
    place: (S) => atKicker(S, 60, 60),
    seconds: 6,
    view: "profile",
    input: (t, st) => ({ ...TUCK, ...hold(st, 60) }),
    measure: flight,
  },
  edgeCarve("board-toe", TOE, 50, false),
  edgeCarve("board-heel", -TOE, 50, false),
  edgeCarve("board-toe-cut", TOE, 80, true),
  edgeCarve("board-heel-cut", -TOE, 80, true),
  slidAcross(
    "board-catch",
    "slid sideways at 45 km/h on the flat, the leading edge down: caught",
    -1,
  ),
  slidAcross(
    "board-sideslip",
    "slid sideways at 45 km/h on the flat, the leading edge raised: the sideslip",
    1,
  ),
  {
    id: "board-powder",
    title: "the board straight-lined down the 20° pitch in powder",
    skis: BOARD,
    level: (S) => schussStrip(S, 0),
    place: () => TOP,
    seconds: 30,
    view: "profile",
    input: () => TUCK,
    measure: (run) => {
      const rows = schuss(run);
      const planed = run.frames.find((f) => f.sink < 0.05);
      rows.push(["planed at km/h", planed ? fmt(planed.speed * 3.6, 0) : "—"]);
      return rows;
    },
  },
];
