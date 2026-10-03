#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POLELESS LAB (`make poleless`): what does a skier WITHOUT POLES do
// with his hands? The hard mode (`SkierState.poles` off) leaves the arms
// nothing to push on, so every hand is placed by `skier-bare.ts` — and a
// pair of empty hands is the first thing a player reads as wrong: arms
// bobbing like jelly, swung the wrong way round to the legs, thrown about.
//
// Each poleless move of the skier lab (`scripts/lib/skier-moves.mjs`: away
// from a standstill, a skate at 15 km/h, a skate turn, a ride down a pitch
// with a turn each way) is SKIED BY THE REAL ENGINE and posed as the game
// poses it (`scripts/lib/skier-trace.mjs`), and each fist is measured off
// the hips and in the world:
//
//   swing   how far each fist travels fore and aft, cm (the arm's swing)
//   bob     how far it travels up and down, cm — a free skate's relaxed
//           arms go up a little at either end of the swing and no more
//   wave    up-and-down cycles a fist makes a stride: one is an arm swung
//           as a pendulum (high at either end, low past the hip); more is
//           the jelly the eye reads as a jiggle
//   jolt    the 95th percentile of a fist's vertical acceleration in the
//           world, m/s² — what the chase camera shows bouncing — and `arm`
//           the same off the hips: the arm's own share of it; `head` the
//           head's in the world, for scale (the body's share)
//   snap    the most a fist's motion changes between two frames, cm — a
//           twitch (the suite fails 3)
//   contra  the share of each glide the arm on the side of the leg that
//           just PUSHED is the one forward, % — the free skate's arms swing
//           opposite the legs, as in the diagonal stride: gliding on the
//           left ski, the right arm forward over it and the left back
//   cross   how far the forward fist crosses toward the gliding ski off
//           its own shoulder's line, cm
//   ahead / behind   the forward fist's reach ahead of its shoulder and the
//           back fist's behind the hips at the ends of the swing, cm
//
// Then the moves are photographed through the skier lab
// (`scripts/skier-preview.mjs`): previews/skier-<move>.png, a column a
// moment and a row a side.
//
//   node scripts/poleless-lab.mjs                      the table and the sheets
//   node scripts/poleless-lab.mjs --no-shots           the table alone (seconds)
//   node scripts/poleless-lab.mjs --move=bare-skate --frames=16
//   node scripts/poleless-lab.mjs --json=previews/poleless-before.json
//   node scripts/poleless-lab.mjs --compare=previews/poleless-before.json

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { MOVES } from "./lib/skier-moves.mjs";
import { traceMove } from "./lib/skier-trace.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BARE = MOVES.filter((m) => m.poles === false).map((m) => m.id);
const args = parseArgs(
  process.argv.slice(2),
  {
    move: {
      kind: "string",
      default: "",
      help: `the moves (${BARE.join(", ")}); every poleless one when left out`,
    },
    skis: { kind: "string", default: "chamois", help: "the pair he skis on" },
    frames: { kind: "number", default: 12, help: "moments a move's sheet is shown at" },
    views: {
      kind: "string",
      default: "back,back3,side,front",
      help: "the rows of a move's sheet (back, back3, side, front3, front, chase)",
    },
    sheet: {
      kind: "string",
      default: "moves",
      help: "the skier lab's sheets to shoot (moves, path, …)",
    },
    "no-shots": { kind: "flag", default: false, help: "print the table only" },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/poleless-lab.mjs [--move=a,b] [--no-shots] [--json=file] [--compare=file]",
);

// Any move of the skier lab may be measured (one with poles beside them,
// for scale); the sheets are the poleless ones'.
const ids = args.move ? args.move.split(",") : BARE;
for (const id of ids) {
  if (!MOVES.some((m) => m.id === id)) {
    console.error(`unknown move "${id}" (${BARE.join(", ")})`);
    process.exit(2);
  }
}

aliasEngine(root);
const mods = {
  E: await import(join(root, "engine/index.ts")),
  S: await import(join(root, "tests/support/synthetic.ts")),
  P: await import(join(root, "pwa/src/game/skier-pose.ts")),
  G: await import(join(root, "pwa/src/game/skis-body.ts")),
  ST: await import(join(root, "pwa/src/game/ski-stand.ts")),
  FL: await import(join(root, "pwa/src/game/skier-flight.ts")),
};
const spec = mods.E.skisById(args.skis);

const range = (v) => (v.length ? Math.max(...v) - Math.min(...v) : 0);
const pct = (v, q) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
};

/** Up-and-down turnarounds of `ys`, ignoring any smaller than `hold` m. */
function turnarounds(ys, hold = 0.008) {
  let n = 0;
  let dir = 0;
  let hi = ys[0];
  let lo = ys[0];
  for (const y of ys) {
    hi = Math.max(hi, y);
    lo = Math.min(lo, y);
    if (dir >= 0 && y < hi - hold) {
      if (dir > 0) n++;
      dir = -1;
      hi = lo = y;
    } else if (dir <= 0 && y > lo + hold) {
      if (dir < 0) n++;
      dir = 1;
      hi = lo = y;
    }
  }
  return n;
}

function measure(move) {
  const frames = traceMove(mods, move, spec);
  const dt = frames.length > 1 ? frames[1].t - frames[0].t : 1 / 60;
  const rel = (f, i) => {
    const h = f.pose.hands[i];
    return { x: h.x - f.pose.hips.x, y: h.y - f.pose.hips.y, z: h.z - f.pose.hips.z };
  };
  const strides = Math.max(1e-6, frames.at(-1).c.stride - frames[0].c.stride);
  const out = { id: move.id, frames: frames.length, strides };
  const per = [0, 1].map((i) => {
    const r = frames.map((f) => rel(f, i));
    const w = frames.map((f) => f.world.hands[i]);
    const acc = [];
    const arm = [];
    let snap = 0;
    for (let k = 2; k < w.length; k++) {
      const ay = (w[k].y - 2 * w[k - 1].y + w[k - 2].y) / (dt * dt);
      acc.push(Math.abs(ay));
      arm.push(Math.abs((r[k].y - 2 * r[k - 1].y + r[k - 2].y) / (dt * dt)));
      const d = Math.hypot(
        w[k].x - 2 * w[k - 1].x + w[k - 2].x,
        w[k].y - 2 * w[k - 1].y + w[k - 2].y,
        w[k].z - 2 * w[k - 1].z + w[k - 2].z,
      );
      snap = Math.max(snap, d);
    }
    const side = i ? 1 : -1;
    const sh = frames.map((f) => f.pose.shoulders[i]);
    return {
      swing: range(r.map((v) => v.z)),
      bob: range(r.map((v) => v.y)),
      wave: strides > 0.5 ? turnarounds(r.map((v) => v.y)) / 2 / strides : null,
      jolt: pct(acc, 0.95),
      arm: pct(arm, 0.95),
      snap,
      cross: Math.max(...frames.map((f, k) => -side * (f.pose.hands[i].x - sh[k].x))),
      ahead: Math.max(...frames.map((f, k) => f.pose.hands[i].z - sh[k].z)),
      behind: Math.max(...frames.map((f) => f.pose.hips.z - f.pose.hands[i].z)),
    };
  });
  for (const k of Object.keys(per[0]))
    out[k] = per[0][k] === null ? null : (per[0][k] + per[1][k]) / 2;
  out.snap = Math.max(per[0].snap, per[1].snap);
  // ...and the HEAD's, for scale: what of the fists' jolt is the body's.
  const hd = frames.map((f) => f.world.head.y);
  const ha = [];
  for (let k = 2; k < hd.length; k++)
    ha.push(Math.abs((hd[k] - 2 * hd[k - 1] + hd[k - 2]) / (dt * dt)));
  out.head = pct(ha, 0.95);
  // THE ARMS AGAINST THE LEGS: through the glide that follows each push,
  // which arm is forward — the free skate's is the one on the side of the
  // leg that pushed, its forearm over the ski he now glides on.
  let n = 0;
  let opposite = 0;
  for (const f of frames) {
    const g = f.input.gait;
    if (!g || g.skate < 0.5 || g.phase < g.duty + 0.1) continue;
    n++;
    const pushing = g.push;
    if (f.pose.hands[pushing].z > f.pose.hands[1 - pushing].z) opposite++;
  }
  out.contra = n ? opposite / n : null;
  return out;
}

const COLS = [
  ["swing", "cm", 100],
  ["bob", "cm", 100],
  ["wave", "/str", 1],
  ["jolt", "m/s²", 1],
  ["arm", "m/s²", 1],
  ["head", "m/s²", 1],
  ["snap", "cm", 100],
  ["contra", "%", 100],
  ["cross", "cm", 100],
  ["ahead", "cm", 100],
  ["behind", "cm", 100],
];
const rows = ids.map((id) => measure(MOVES.find((m) => m.id === id)));
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const cell = (v, k) => (v === null || v === undefined ? "—" : (v * k).toFixed(k === 1 ? 2 : 0));
console.log(
  `${"move".padEnd(12)}${"strides".padStart(8)}` +
    COLS.map(([id, unit]) => `${id}(${unit})`.padStart(before ? 20 : 13)).join(""),
);
for (const r of rows) {
  const b = before?.find((x) => x.id === r.id);
  console.log(
    `${r.id.padEnd(12)}${r.strides.toFixed(1).padStart(8)}` +
      COLS.map(([id, , k]) =>
        (b ? `${cell(b[id], k)} → ${cell(r[id], k)}` : cell(r[id], k)).padStart(before ? 20 : 13),
      ).join(""),
  );
}
if (args.json) writeFileSync(args.json, JSON.stringify(rows, null, 1));

if (!args["no-shots"]) {
  const run = spawnSync(
    process.execPath,
    [
      join(root, "scripts/skier-preview.mjs"),
      `--move=${ids.join(",")}`,
      `--sheet=${args.sheet}`,
      `--frames=${args.frames}`,
      `--views=${args.views}`,
      `--skis=${args.skis}`,
    ],
    { stdio: "inherit", cwd: root },
  );
  process.exit(run.status ?? 1);
}
