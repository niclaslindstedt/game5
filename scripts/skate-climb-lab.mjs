#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKATE CLIMB LAB (`make skate-climb`): how does a skater's stride
// change UP A RISE? On the flat a push sends him off on a long glide; up
// a rise gravity's pull along his skis, g·sin θ, slows the gliding ski
// on top of the snow's own drag, so the glide is cut short and he must
// push again sooner — quicker strides, shorter ones, the push filling
// more of each and the poles in the snow for more of it
// (`poles.ts`'s `skateCadence`, `skateDuty`, `poleDuty`).
//
// The TABLE skis the real engine up each grade off 3 m/s with the tuck
// key held (so he works) for `--seconds`, and reads the last `--settle`
// seconds of it:
//
//   km/h       his speed
//   hill       the hill's pull along his way, m/s² (`SkierState.hill`)
//   str/s      strides a second (a leg's push each), off the engine's count
//   m/str      the snow covered a stride, m — the glide's length
//   push       the share of a stride he pushes (`pushDuty`)
//   pole       the share of a stride the poles are in the snow (`poleDuty`)
//   drive      the mean of the drive he made (`SkierState.drive`)
//
// Then the skier lab (`scripts/skier-preview.mjs`) photographs the climb's
// moves (`scripts/lib/climb-moves.mjs`): on the flat and up 8, 16 and 24 %,
// each over the SAME two seconds, so the sheets set side by side show the
// strides quickening up the hill.
//
//   node scripts/skate-climb-lab.mjs                       the table and the sheets
//   node scripts/skate-climb-lab.mjs --no-shots            the table alone (seconds)
//   node scripts/skate-climb-lab.mjs --json=previews/climb-before.json
//   node scripts/skate-climb-lab.mjs --compare=previews/climb-before.json

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

import { CLIMB_MOVES } from "./lib/climb-moves.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    grades: {
      kind: "string",
      default: "0,0.04,0.08,0.12,0.16,0.2,0.24",
      help: "the rises he skates up, rise over run",
    },
    speed: { kind: "number", default: 3, help: "the speed he starts from, m/s" },
    seconds: { kind: "number", default: 12, help: "how long each climb is skied, s" },
    settle: { kind: "number", default: 5, help: "the last seconds the table reads, s" },
    skis: { kind: "string", default: "chamois", help: "the pair he skis on" },
    move: {
      kind: "string",
      default: CLIMB_MOVES.map((m) => m.id).join(","),
      help: "the skier lab's moves to photograph",
    },
    sheet: { kind: "string", default: "moves", help: "the skier lab's sheets to shoot" },
    frames: { kind: "number", default: 12, help: "moments a move's sheet is shown at" },
    views: { kind: "string", default: "side,back3,back", help: "the rows of a move's sheet" },
    "no-shots": { kind: "flag", default: false, help: "print the table only" },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/skate-climb-lab.mjs [--grades=a,b] [--no-shots] [--json=file] [--compare=file]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));
const P = await import(join(root, "engine/game/poles.ts"));
const spec = E.skisById(args.skis);

/** Skates up `grade` off the start speed and reads its settled pace. */
function climb(grade) {
  const level = S.flatLevel({ packed: 1, grade, slopeFrom: 100, size: 4000 });
  const state = E.createGame({ level, spec, rivals: 0, countdown: 0, quiet: true });
  E.placeRun(state, { x: 2000, z: 3800, heading: Math.PI, speed: args.speed });
  const c = state.skier;
  const steps = Math.round(args.seconds * E.TUNING.physicsHz);
  const from = steps - Math.round(args.settle * E.TUNING.physicsHz);
  let stride0 = 0;
  let way = 0;
  const sum = { speed: 0, hill: 0, push: 0, pole: 0, drive: 0 };
  let n = 0;
  for (let i = 1; i <= steps; i++) {
    E.step(state, { steer: 0, tuck: 1, brake: 0, lean: 0, reset: false });
    if (i === from) stride0 = c.stride;
    if (i <= from) continue;
    n++;
    way += c.speed * E.TUNING.dt;
    sum.speed += c.speed;
    // Read off the ground as the engine reads it (`hillPull`), so the lab
    // runs on a tree from before the climb was kept too.
    const hill = P.hillPull(level, c.x, c.z, c.heading, c.way);
    sum.hill += hill;
    sum.push += P.pushDuty(c.speed, c.poles, c.step, hill);
    sum.pole += P.poleDuty(c.speed, c.step, hill);
    sum.drive += c.drive;
  }
  const strides = c.stride - stride0;
  return {
    id: `${Math.round(grade * 100)}%`,
    kmh: (sum.speed / n) * 3.6,
    hill: sum.hill / n,
    rate: strides / args.settle,
    length: strides > 0 ? way / strides : null,
    push: sum.push / n,
    pole: sum.pole / n,
    drive: sum.drive / n,
  };
}

const rows = args.grades.split(",").map(Number).map(climb);
const COLS = [
  ["kmh", "km/h", 1],
  ["hill", "m/s²", 2],
  ["rate", "str/s", 2],
  ["length", "m/str", 2],
  ["push", "", 2],
  ["pole", "", 2],
  ["drive", "", 2],
];
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const cell = (v, d) => (v === null || v === undefined ? "—" : v.toFixed(d));
const w = before ? 16 : 10;
console.log(
  `skating up each rise off ${args.speed} m/s, the tuck held · the last ${args.settle} s of ${args.seconds}\n` +
    `${"rise".padEnd(6)}` +
    COLS.map(([id, unit]) => (unit ? unit : id).padStart(w)).join(""),
);
for (const r of rows) {
  const b = before?.find((x) => x.id === r.id);
  console.log(
    r.id.padEnd(6) +
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
