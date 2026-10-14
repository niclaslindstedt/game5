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
//   knee   each knee's flexion, deg — 30–80 riding straight (deeper in a
//          carve: 65–100 on the toe edge, 85–120 cut hard, 70–105 on the
//          heels, 90–125 cut hard; 90–130 absorbing in the air; deeper in
//          the tuck and a landing; straighter stood still)
//   hips   the pelvis's line against the board's, deg — square to the
//          board, inside ~20° (the duck stance opens it a little)
//   chest  the shoulders' line against the board's, deg — inside ~30°
//          riding, opened part way to the nose (20–70°) in the one-foot
//          skate, the body kept side-on
//   head   the eyes off his travel, deg — along it, inside ~45°, once he
//          is moving
//   hand   the lower hand's height over the snow, m — in a carve cut hard
//          the toeside front hand reaches toward it and the heelside rear
//          one trails low
//   over   the hips across the board toward the edge he stands on, seen
//          from above the snow, m — over or beyond the toe edge on a
//          toeside turn (0.1–0.8), inside the heel edge on a heelside one
//          (−0.1 to −0.8)
//   torso  the spine (hips to neck) off the line he inclines along, deg —
//          a carve is carried by the whole body laid into the turn as one
//          line, not by folding at the waist: inside ~30° riding
//   snow   the hands on the snow (within 8 cm of it): never both, and
//          none at all but in a carve cut hard
//   hipsH  the hips' height over the deck as a share of their height on
//          straight legs — tall ~0.8, a chair ~0.65, under ~0.6 only in a
//          tuck or a landing
//   shin   the shins' least angle to the snow (in the air, to the level),
//          deg — a shin laid flat along it is a rider KNEELING on his
//          board: never under ~25° (a method's shins rise from the knees
//          to the board kicked up behind him)
//   deck   the shins' least angle to the DECK, deg — a soft boot and its
//          highback let a shin lean ~45° off the deck's normal at the most
//          (42–90; 50–90 on the toe edge): a shin past that is a rider
//          kneeling on his board
//   kneeGap  on the toe edge, the two knees' flexion apart, deg — both bent
//          down the edge, the rear one never left straight (0–20)
//   grab   in a grab (`board-grab.ts`), the grabbing hand's gap to the
//          board's edge or end it closes on, m — a fist round it: 0–0.05
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
import { bandsOf, deg, faultsOf, figuresOf } from "./lib/board-measure.mjs";

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
const BG = await import(join(root, "pwa/src/game/board-grab.ts"));

const spec = E.pairById(args.skis);
if (!E.isBoard(spec)) {
  console.error(`"${args.skis}" is not a board`);
  process.exit(2);
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
  let grab = { grab: null, share: 0 };
  while (state.t - t0 < m.t) {
    E.step(state, move.input(state.t - t0, state, E));
    const c = state.skier;
    const held = state.tricks.pose;
    grab = BG.easeGrab(grab, BG.isBoardGrab(held) ? held : null, dt);
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
  input.grab = grab.grab;
  input.grabShare = grab.share;
  return { c, input, bp: BP.boardPose(input) };
}

function measure(m) {
  const { c, input, bp } = rideTo(m);
  const f = figuresOf(c, input, bp, BP);
  const grab = input.grab ? BP.grabGap(bp, input) : null;
  const faults = faultsOf(f, bandsOf(m.id), grab);
  return {
    id: m.id,
    say: m.say,
    speed: c.speed * 3.6,
    edge: deg(input.edge),
    incline: deg(input.incline),
    knee: f.knee,
    hips: f.hips,
    chest: f.chest,
    head: f.head,
    hand: f.hand,
    across: f.across,
    torso: f.torso,
    hipsH: f.hipsH,
    shin: f.shin,
    shinDeck: f.shinDeck,
    onSnow: f.onSnow,
    grab,
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
  `${"moment".padEnd(10)}${pad("km/h", 6)}${pad("edge°", 7)}${pad("incl°", 7)}${pad("knee F/B°", 11)}${pad("hips°", 7)}${pad("chest°", 8)}${pad("head°", 7)}${pad("hand m", 8)}${pad("snow", 5)}${pad("torso°", 8)}${pad("hipsH", 7)}${pad("shin°", 7)}${pad("deck°", 7)}${pad("over m", 8)}${pad("grab cm", 9)}  faults`,
);
for (const r of rows) {
  const was = before?.find((b) => b.id === r.id);
  const delta = was ? `  (was ${was.faults.length})` : "";
  console.log(
    `${r.id.padEnd(10)}${pad(num(r.speed), 6)}${pad(num(r.edge), 7)}${pad(num(r.incline), 7)}${pad(`${num(r.knee[0])}/${num(r.knee[1])}`, 11)}${pad(num(r.hips), 7)}${pad(num(r.chest), 8)}${pad(num(r.head), 7)}${pad(num(r.hand, 2), 8)}${pad(r.onSnow, 5)}${pad(num(r.torso), 8)}${pad(num(r.hipsH, 2), 7)}${pad(num(r.shin), 7)}${pad(num(r.shinDeck ?? null), 7)}${pad(num(r.across, 2), 8)}${pad(r.grab === null ? "—" : num(r.grab * 100, 1), 9)}  ${r.faults.length ? r.faults.join("; ") : "ok"}${delta}`,
  );
}
const total = rows.reduce((n, r) => n + r.faults.length, 0);
console.log(`\n${total} fault(s) over ${rows.length} moment(s)`);
if (args.json) writeFileSync(args.json, JSON.stringify(rows, null, 2));
