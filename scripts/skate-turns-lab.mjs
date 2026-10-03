#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKATE TURNS LAB (`make skate-turns`): how does a skier TURN AT A
// CRAWL — skating, walking his skis, on his poles or without them? Not on
// his sidecut: a ski's arc at a walk is fifteen metres and more, and a
// skier who waited on it would barely come round. He STEPS his skis round
// (`poles.ts`'s step turn, `SkierState.step`): the skate turn — skating
// more to one side, the V turned into the turn — and the walk's step turn,
// pushing all the way, so he comes out of the turn faster than he went in.
//
// The TABLE skis the real engine on the flat (and `--grade` a pitch) from
// each speed with the steer key held full and the tuck key held (so he
// works), with and without poles, and reads:
//
//   1s 2s 3s   the heading turned by then, °
//   to90       how long he takes to come round 90°, s
//   r90        the radius of the line he took to 90° (the way skied over
//              the angle turned), m
//   v3         his speed after 3 s, km/h — and `str` the same skied
//              straight, so `v3 − str` is what the turn cost (or paid)
//   drive      the mean of the drive he made through it (`SkierState.drive`)
//
// Then the skier lab (`scripts/skier-preview.mjs`) photographs the turning
// moves of `scripts/lib/skier-moves.mjs`: a skate turn, a turn from a
// standstill, a zig-zag, a turn at 25 km/h, and the poleless skate turn —
// `path` straight down over the line he draws (each foot's prints, his
// centre of gravity strobed) and `moves`, a column a moment.
//
//   node scripts/skate-turns-lab.mjs                   the table and the sheets
//   node scripts/skate-turns-lab.mjs --no-shots        the table alone (seconds)
//   node scripts/skate-turns-lab.mjs --grade=0.08      down an 8 % pitch
//   node scripts/skate-turns-lab.mjs --move=skate-turn --sheet=path
//   node scripts/skate-turns-lab.mjs --json=previews/turns-before.json
//   node scripts/skate-turns-lab.mjs --compare=previews/turns-before.json

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TURN_MOVES = ["skate-turn", "step-turn", "skate-zigzag", "pole-turn", "bare-turn"];
const args = parseArgs(
  process.argv.slice(2),
  {
    move: {
      kind: "string",
      default: TURN_MOVES.join(","),
      help: "the skier lab's moves to photograph",
    },
    sheet: { kind: "string", default: "path,moves", help: "the skier lab's sheets to shoot" },
    speeds: {
      kind: "string",
      default: "0,1.5,3,4.5,6,7.5",
      help: "the speeds the table starts from, m/s",
    },
    grade: { kind: "number", default: 0, help: "the pitch he turns on, rise over run" },
    skis: { kind: "string", default: "chamois", help: "the pair he skis on" },
    frames: { kind: "number", default: 10, help: "moments a move's sheet is shown at" },
    views: { kind: "string", default: "back,back3,side", help: "the rows of a move's sheet" },
    "no-shots": { kind: "flag", default: false, help: "print the table only" },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/skate-turns-lab.mjs [--speeds=a,b] [--grade=g] [--no-shots] [--json=file] [--compare=file]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));
const spec = E.skisById(args.skis);
const DEG = 180 / Math.PI;
const SECONDS = 3;

/** Skis from `v0` m/s with `steer` held and the tuck held, and reads the
 * turn off the run step by step. */
function turn(v0, steer, poles) {
  const level = S.flatLevel({ packed: 1, grade: args.grade, slopeFrom: 0, size: 4000 });
  const state = E.createGame({ level, spec, rivals: 0, countdown: 0, quiet: true, poles });
  E.placeRun(state, { x: 2000, z: 1000, heading: 0, speed: v0 });
  const c = state.skier;
  let turned = 0;
  let prev = c.heading;
  let way = 0;
  let to90 = null;
  let r90 = null;
  let drive = 0;
  const at = {};
  const steps = SECONDS * E.TUNING.physicsHz;
  for (let i = 1; i <= steps; i++) {
    E.step(state, { steer, tuck: 1, brake: 0, lean: 0, reset: false });
    turned += Math.atan2(Math.sin(c.heading - prev), Math.cos(c.heading - prev));
    prev = c.heading;
    way += c.speed * E.TUNING.dt;
    drive += c.drive / steps;
    if (to90 === null && Math.abs(turned) >= Math.PI / 2) {
      to90 = i * E.TUNING.dt;
      r90 = way / (Math.PI / 2);
    }
    if (i % E.TUNING.physicsHz === 0) at[i / E.TUNING.physicsHz] = Math.abs(turned) * DEG;
  }
  return { at, to90, r90, v3: c.speed * 3.6, drive };
}

const rows = [];
for (const poles of [true, false]) {
  for (const v0 of args.speeds.split(",").map(Number)) {
    const t = turn(v0, 1, poles);
    const straight = turn(v0, 0, poles);
    rows.push({
      id: `${poles ? "poles" : "bare"}@${v0}`,
      t1: t.at[1],
      t2: t.at[2],
      t3: t.at[3],
      to90: t.to90,
      r90: t.r90,
      v3: t.v3,
      str: straight.v3,
      drive: t.drive,
    });
  }
}

const COLS = [
  ["t1", "°", 0],
  ["t2", "°", 0],
  ["t3", "°", 0],
  ["to90", "s", 2],
  ["r90", "m", 1],
  ["v3", "km/h", 1],
  ["str", "km/h", 1],
  ["drive", "", 2],
];
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const cell = (v, d) => (v === null || v === undefined ? "—" : v.toFixed(d));
const w = before ? 16 : 9;
console.log(
  `grade ${args.grade} · steer held full, the tuck held · from v0 m/s\n` +
    `${"run".padEnd(11)}` +
    COLS.map(([id, unit]) => `${id}${unit ? `(${unit})` : ""}`.padStart(w)).join(""),
);
for (const r of rows) {
  const b = before?.find((x) => x.id === r.id);
  console.log(
    r.id.padEnd(11) +
      COLS.map(([id, , d]) =>
        (b ? `${cell(b[id], d)} → ${cell(r[id], d)}` : cell(r[id], d)).padStart(w),
      ).join(""),
  );
}
if (args.json) writeFileSync(args.json, JSON.stringify(rows, null, 1));

if (!args["no-shots"]) {
  const run = spawnSync(
    process.execPath,
    [
      join(root, "scripts/skier-preview.mjs"),
      `--move=${args.move}`,
      `--sheet=${args.sheet}`,
      `--frames=${args.frames}`,
      `--views=${args.views}`,
      `--skis=${args.skis}`,
    ],
    { stdio: "inherit", cwd: root },
  );
  process.exit(run.status ?? 1);
}
