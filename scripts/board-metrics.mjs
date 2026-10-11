#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOARD METRICS LAB (`make board-metrics`): is the snowboarder's POSE a
// real rider's? Each moment of the skier lab's board moves
// (`scripts/lib/board-figure-moves.mjs` — stood across the board, a toeside
// and a heelside carve and each cut hard, the tuck, the one-foot skate, the
// air, a landing, a sideslip, fakie) is RIDDEN BY THE REAL ENGINE here in
// Node, his legs' spring stepped every step, and the game's own pose taken
// off the state the way the game takes it (`board-input.ts`, `boardPose`)
// and MEASURED against the bands the project's snowboard research sets:
//
//   knee   each knee's flexion, deg — 30–80 riding (deeper in the tuck, a
//          heelside cut hard and a landing; straighter stood still)
//   hips   the pelvis's line against the board's, deg — square to the
//          board, inside ~20° (the duck stance opens it a little)
//   chest  the shoulders' line against the board's, deg — inside ~30°
//          riding, turned to the nose (45° and more) in the one-foot skate
//   head   the eyes off his travel, deg — along it, inside ~45°, once he
//          is moving
//   hand   the lower hand's height over the snow, m — in a carve cut hard
//          the toeside front hand reaches toward it and the heelside rear
//          one trails low
//   over   the hips across the board toward the edge he stands on, m —
//          over the toes on a toeside turn (0–0.25), back over the heel
//          edge on a heelside one (−0.05 to −0.3), never sat down behind
//          it
//   torso  the spine (hips to neck) off the line he inclines along, deg —
//          a carve is carried by the whole body laid into the turn as one
//          line, not by folding at the waist: inside ~30° riding
//   snow   the hands on the snow (within 8 cm of it): never both, and
//          none at all but in a carve cut hard
//   hipsH  the hips' height over the deck as a share of their height on
//          straight legs — tall ~0.8, a chair ~0.65, under ~0.6 only in a
//          tuck or a landing
//
//   node scripts/board-metrics.mjs                 every moment
//   node scripts/board-metrics.mjs --moment=toe,heel
//   node scripts/board-metrics.mjs --json=previews/board-metrics-before.json
//   node scripts/board-metrics.mjs --compare=previews/board-metrics-before.json

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { BOARD_MOMENTS, BOARD_MOVES } from "./lib/board-figure-moves.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    moment: {
      kind: "string",
      default: "",
      help: `the moments to measure (${BOARD_MOMENTS.map((m) => m.id).join(", ")}); every one when left out`,
    },
    skis: { kind: "string", default: "lynx", help: "the board he rides" },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/board-metrics.mjs [--moment=a,b] [--json=file] [--compare=file]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));
const P = await import(join(root, "pwa/src/game/skier-pose.ts"));
const BI = await import(join(root, "pwa/src/game/board-input.ts"));
const BP = await import(join(root, "pwa/src/game/board-pose.ts"));

const spec = E.pairById(args.skis);
if (!E.isBoard(spec)) {
  console.error(`"${args.skis}" is not a board`);
  process.exit(2);
}

/** THE BANDS, a moment's own where it differs: [least, most]. */
const BANDS = {
  knee: [30, 80],
  hips: [0, 20],
  chest: [0, 30],
  head: [0, 45],
  torso: [0, 30],
  hipsH: [0.6, 1],
  snow: 0,
};
const OWN = {
  // Cut hard, the eyes go on round to the turn's exit and one hand may
  // reach the snow.
  "toe-cut": { knee: [30, 90], head: [0, 60], snow: 1, hand: [0, 0.25] },
  // On the heels he sits as on a chair: the knees deeper, the hips lower.
  heel: { knee: [50, 95], chest: [0, 40] },
  "heel-cut": { knee: [60, 105], chest: [0, 45], head: [0, 60], snow: 1, hand: [0, 0.4] },
  tuck: { knee: [60, 125], torso: [20, 75], hipsH: [0.4, 0.8] },
  landing: { knee: [45, 120], torso: [0, 45], hipsH: [0.45, 1] },
  wait: { knee: [10, 50] },
  air: { knee: [30, 100] },
  // The pushing leg straightens through the push.
  skate: { knee: [0, 80], chest: [35, 110], hips: [0, 60] },
};

const deg = (r) => (r * 180) / Math.PI;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a) => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
/** The angle between two lines (either way along), in a plane, deg. */
function lineAngle(a, b, n) {
  const flat = (v) => norm(sub(v, { x: n.x * dot(v, n), y: n.y * dot(v, n), z: n.z * dot(v, n) }));
  return deg(Math.acos(Math.min(1, Math.abs(dot(flat(a), flat(b))))));
}

/** Ride a moment's move up to its second; the pose there and the state. */
function rideTo(m) {
  const move = BOARD_MOVES.find((x) => x.id === m.move);
  const state = E.createGame({
    level: move.level(S),
    spec,
    rivals: 0,
    countdown: 0,
    quiet: true,
    mode: move.mode,
    snowDepth: move.snow,
  });
  E.placeRun(state, move.place());
  const t0 = state.t;
  const legs = P.createSkierSpring(0);
  const dt = 1 / E.TUNING.physicsHz;
  while (state.t - t0 < m.t) {
    E.step(state, move.input(state.t - t0, state));
    const c = state.skier;
    if (c.thrown) continue;
    P.stepSkierSpring(
      legs,
      c.vy,
      c.airborne,
      dt,
      c.jumpLoad / E.TUNING.jump.full,
      c,
      false,
      undefined,
      0,
    );
  }
  const c = state.skier;
  const { input } = BI.boardInputOf(c, legs, c.q);
  return { c, input, bp: BP.boardPose(input) };
}

function measure(m) {
  const { c, input, bp } = rideTo(m);
  const p = bp.pose;
  const f = bp.board;
  const knee = [deg(BP.kneeFlex(p, 0)), deg(BP.kneeFlex(p, 1))];
  const hips = lineAngle(sub(p.hipJoints[1], p.hipJoints[0]), f.along, f.normal);
  const chest = lineAngle(sub(p.shoulders[1], p.shoulders[0]), f.along, f.normal);
  const up = norm(input.worldUp);
  const flat = (v) => sub(v, { x: up.x * dot(v, up), y: up.y * dot(v, up), z: up.z * dot(v, up) });
  const look = norm(flat(BP.headForward(p)));
  const way = flat(input.travel);
  const moving = Math.hypot(way.x, way.y, way.z) > 2;
  const head = moving ? deg(Math.acos(Math.max(-1, Math.min(1, dot(look, norm(way)))))) : null;
  // The snow's plane under the deck: its normal is the snow's (the deck's
  // low edge is on it).
  const plane = BP.snowPlane(input, f);
  const over = (q) => dot(sub(q, plane.point), plane.normal);
  const hand = Math.min(over(p.hands[0]), over(p.hands[1]));
  const onSnow = c.airborne
    ? 0
    : (over(p.hands[0]) < 0.08 ? 1 : 0) + (over(p.hands[1]) < 0.08 ? 1 : 0);
  // The spine off the inclined line: the body frame's own up is the line
  // the root is rolled onto.
  const spine = norm(sub(p.neck, p.hips));
  const torso = deg(Math.acos(Math.max(-1, Math.min(1, spine.y))));
  // The hips' height over the deck, as a share of it on straight legs.
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const straight =
    dist(p.hipJoints[0], p.knees[0]) +
    dist(p.knees[0], p.feet[0]) +
    dot(sub(p.feet[0], f.centre), f.normal);
  const hipsH = dot(sub(p.hips, f.centre), f.normal) / straight;
  // The hips across the board, toward his toes positive.
  const face = input.board.lead === "regular" ? 1 : -1;
  const across = dot(sub(p.hips, f.centre), f.right) * face;
  const toe = BP.toeShare(input.edge, input.board.lead);
  const bands = { ...BANDS, ...(OWN[m.id] ?? {}) };
  const faults = [];
  const hold = (name, v, [lo, hi]) => {
    if (v !== null && (v < lo || v > hi)) faults.push(`${name} ${v.toFixed(0)}∉[${lo},${hi}]`);
  };
  hold("knee", knee[0], bands.knee);
  hold("knee", knee[1], bands.knee);
  hold("hips", hips, bands.hips);
  hold("chest", chest, bands.chest);
  hold("head", head, bands.head);
  hold("torso", torso, bands.torso);
  hold("hipsH", hipsH, bands.hipsH);
  if (onSnow > bands.snow) faults.push(`${onSnow} hand(s) on the snow`);
  if (bands.hand) hold("hand", hand, bands.hand);
  if (toe > 0.3) hold("over", across, [0, 0.25]);
  if (toe < -0.3) hold("over", across, [-0.3, -0.05]);
  return {
    id: m.id,
    say: m.say,
    speed: c.speed * 3.6,
    edge: deg(input.edge),
    incline: deg(input.incline),
    knee,
    hips,
    chest,
    head,
    hand,
    across,
    torso,
    hipsH,
    onSnow,
    faults,
  };
}

const moments = args.moment
  ? args.moment.split(",").map((id) => {
      const m = BOARD_MOMENTS.find((x) => x.id === id);
      if (!m) {
        console.error(`unknown moment "${id}" (${BOARD_MOMENTS.map((x) => x.id).join(", ")})`);
        process.exit(2);
      }
      return m;
    })
  : BOARD_MOMENTS;
const rows = moments.map(measure);
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;

const pad = (s, n) => String(s).padStart(n);
const num = (v, d = 0) => (v === null ? "—" : v.toFixed(d));
console.log(
  `${"moment".padEnd(10)}${pad("km/h", 6)}${pad("edge°", 7)}${pad("incl°", 7)}${pad("knee F/B°", 11)}${pad("hips°", 7)}${pad("chest°", 8)}${pad("head°", 7)}${pad("hand m", 8)}${pad("snow", 5)}${pad("torso°", 8)}${pad("hipsH", 7)}${pad("over m", 8)}  faults`,
);
for (const r of rows) {
  const was = before?.find((b) => b.id === r.id);
  const delta = was ? `  (was ${was.faults.length})` : "";
  console.log(
    `${r.id.padEnd(10)}${pad(num(r.speed), 6)}${pad(num(r.edge), 7)}${pad(num(r.incline), 7)}${pad(`${num(r.knee[0])}/${num(r.knee[1])}`, 11)}${pad(num(r.hips), 7)}${pad(num(r.chest), 8)}${pad(num(r.head), 7)}${pad(num(r.hand, 2), 8)}${pad(r.onSnow, 5)}${pad(num(r.torso), 8)}${pad(num(r.hipsH, 2), 7)}${pad(num(r.across, 2), 8)}  ${r.faults.length ? r.faults.join("; ") : "ok"}${delta}`,
  );
}
const total = rows.reduce((n, r) => n + r.faults.length, 0);
console.log(`\n${total} fault(s) over ${rows.length} moment(s)`);
if (args.json) writeFileSync(args.json, JSON.stringify(rows, null, 2));
