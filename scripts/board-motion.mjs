#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOARD MOTION LAB (`make board-motion`): the snowboarder's pose as
// MOTION, not as a still. `make board-metrics` judges one moment of each
// move; this lab rides each move of the skier lab's board moves
// (`scripts/lib/board-figure-moves.mjs`) through the real engine in Node,
// his legs' spring stepped every step as the game steps it, takes the
// game's own pose off the state every frame (`board-input.ts`,
// `boardPose`) and PLOTS it over the move's whole time against the bands
// the metrics hold a moment of it to (`scripts/lib/board-measure.mjs`):
//
//   knee   each knee's flexion, deg (the left leg orange — a regular rider's
//          front — the right blue)
//   hips   the pelvis's line against the board's, deg
//   chest  the shoulders' turn against the board's line, deg
//   head   the eyes' yaw off his travel, deg (blank while he is all but
//          still)
//   shin   the shins' least angle to the snow, deg — flat is kneeling
//
// The band each figure should keep to is shaded behind it, the band of the
// moment of the move the frame is nearest after (a carve's, then the same
// carve cut hard). A line that leaves its band is a pose a still could
// miss: a pop, a sag, a knee driven down through a transition. The table
// beside it is each move's share of frames outside each band.
//
// `--film` photographs the same moves as filmstrips beside it, through the
// skier lab (`make skier ARGS="--skis=lynx --sheet=moves --views=chase,side"`):
// a column a moment, at the game's chase range and from the side.
//
//   node scripts/board-motion.mjs                     every move
//   node scripts/board-motion.mjs --move=skate,toe    those moves
//   node scripts/board-motion.mjs --json=previews/board-motion-before.json
//   node scripts/board-motion.mjs --compare=previews/board-motion-before.json
//   node scripts/board-motion.mjs --move=skate --film the strips too

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";
import { BOARD_MOMENTS, BOARD_MOVES } from "./lib/board-figure-moves.mjs";
import { GRAB_ASKS } from "./lib/board-trick-moves.mjs";
import { bandsOf, figuresOf } from "./lib/board-measure.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    move: {
      kind: "string",
      default: "",
      help: `the moves to ride (${BOARD_MOVES.map((m) => m.id).join(", ")}); every one when left out`,
    },
    skis: { kind: "string", default: "lynx", help: "the board he rides" },
    every: { kind: "number", default: 1 / 30, help: "s between the samples" },
    out: { kind: "string", default: "previews/board-motion.png", help: "the graph's PNG" },
    json: { kind: "string", default: "", help: "write the shares out of band as JSON" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
    film: {
      kind: "flag",
      default: false,
      help: "photograph the moves as filmstrips too (chase and side), through the skier lab",
    },
  },
  "usage: node scripts/board-motion.mjs [--move=a,b] [--every=s] [--out=file] [--json=file] [--compare=file] [--film]",
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

const moves = args.move
  ? args.move.split(",").map((id) => {
      const m = BOARD_MOVES.find((x) => x.id === id);
      if (!m) {
        console.error(`unknown move "${id}" (${BOARD_MOVES.map((x) => x.id).join(", ")})`);
        process.exit(2);
      }
      return m;
    })
  : BOARD_MOVES;

/** The figures plotted, each with its range on the chart, deg. */
const CHARTS = [
  { id: "knee", say: "knee F/B", top: 180, of: (f) => f.knee },
  { id: "hips", say: "hips v board", top: 90, of: (f) => [f.hips] },
  { id: "chest", say: "shoulders v board", top: 90, of: (f) => [f.chest] },
  { id: "head", say: "head yaw", top: 180, of: (f) => [f.head] },
  { id: "shin", say: "shin v snow", top: 90, of: (f) => [f.shin] },
];

/** The moments photographed in the air. */
const AIRBORNE = new Set(["air", "spin", ...GRAB_ASKS.map(([g]) => g)]);

/** The moment of `move` whose bands hold a frame `t` s into it, its
 * figures `f`: the last of its own at or before `t` (from where its input
 * starts — `from` — or its photograph's second), or its first; a move with
 * none of its own is held on a carve to a carve's bands (`f.toe`, the
 * toeside share, past a half), else to its own; and any frame with the
 * rear foot out of its binding (skating at a crawl) to the skate's, and
 * any frame in the air (a jump's flight, a pop's) to the air's — where a
 * move's own moment is not itself in the air (a grab, a spin). */
function momentAt(move, t, f, free = false, airborne = false, air = 0, held = 1) {
  if (free) return "skate";
  const carve = f.toe > 0.5 ? "toe" : f.toe < -0.5 ? "heel" : null;
  const own = BOARD_MOMENTS.filter((m) => m.move === move.id).sort((a, b) => a.t - b.t);
  if (own.length === 0) return carve ?? move.id;
  let at = own[0];
  for (const m of own) if ((m.from ?? m.t) <= t + 1e-6) at = m;
  // The air and a spin hold only the frames in the air — those on the
  // snow are the jump loaded and landed, and while the legs are still
  // drawing up into the air (its eased share), the take-off's. (A grab's
  // own bands are wide enough for its whole move.)
  const grab = GRAB_ASKS.some(([g]) => g === at.id);
  // A grab's frames with no hand on the board are the jump's own: the
  // flight before and after it, and the snow.
  if (grab && held < 0.05) return airborne ? (air < 0.7 ? "rising" : "air") : "landing";
  // A carve's moment holds its carve: the frames before he is on the edge
  // are ridden straight.
  if (/^(toe|heel)/.test(at.id) && Math.abs(f.toe) < 0.5) return "stance";
  if (AIRBORNE.has(at.id) && !grab && !airborne) return carve ?? "landing";
  if (airborne && air < 0.7 && !grab) return "rising";
  if (airborne && !AIRBORNE.has(at.id)) return "air";
  return at.id;
}

/** Ride `move` its whole time, the figures every `every` s. */
function ride(move) {
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
  let next = 0;
  const samples = [];
  while (state.t - t0 < move.seconds) {
    E.step(state, move.input(state.t - t0, state));
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
    const t = state.t - t0;
    if (t + 1e-9 < next) continue;
    next += args.every;
    const { input } = BI.boardInputOf(c, legs, c.q);
    input.grab = grab.grab;
    input.grabShare = grab.share;
    const bp = BP.boardPose(input);
    const f = figuresOf(c, input, bp, BP);
    samples.push({
      t,
      moment: momentAt(move, t, f, input.free, c.airborne, input.air, grab.share),
      f,
    });
  }
  return samples;
}

/** The share of `samples` outside each chart's band, 0..1 (head only where
 * it is read). */
function outShares(samples) {
  const out = {};
  for (const ch of CHARTS) {
    let n = 0;
    let bad = 0;
    for (const s of samples) {
      const band = bandsOf(s.moment)[ch.id];
      for (const v of ch.of(s.f)) {
        if (v === null || !band) continue;
        n++;
        if (v < band[0] || v > band[1]) bad++;
      }
    }
    out[ch.id] = n ? bad / n : 0;
  }
  return out;
}

const rows = moves.map((m) => {
  const samples = ride(m);
  return { id: m.id, title: m.title, seconds: m.seconds, samples, out: outShares(samples) };
});

// THE TABLE: each move's share of frames outside each band.
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const pad = (s, n) => String(s).padStart(n);
const pct = (v) => `${Math.round(v * 100)}%`;
console.log(`${"move".padEnd(14)}${CHARTS.map((c) => pad(c.id, 9)).join("")}`);
for (const r of rows) {
  const was = before?.find((b) => b.id === r.id);
  const cells = CHARTS.map((c) => {
    const now = pct(r.out[c.id]);
    const then = was ? pct(was.out[c.id] ?? 0) : null;
    return pad(then !== null && then !== now ? `${then}>${now}` : now, 9);
  });
  console.log(`${r.id.padEnd(14)}${cells.join("")}`);
}
if (args.json) {
  writeFileSync(
    join(root, args.json),
    JSON.stringify(
      rows.map((r) => ({ id: r.id, out: r.out })),
      null,
      2,
    ),
  );
}

// THE GRAPH: a row a move, a chart a figure, time across.
const INK = {
  bg: [14, 18, 24],
  frame: [52, 60, 74],
  text: [220, 226, 236],
  dim: [130, 140, 156],
  band: [60, 150, 90, 70],
  front: [244, 150, 60],
  rear: [90, 170, 250],
  one: [236, 236, 120],
  grid: [34, 40, 52],
};
const CW = 230;
const CH = 96;
const GAP = 34;
const LEFT = 140;
const ROW = CH + 34;
const W = LEFT + CHARTS.length * (CW + GAP);
const d = createDrawing(W, 46 + rows.length * ROW, INK.bg);
d.text("board motion: the pose over each move against its bands", 10, 10, INK.text, 2);
d.text(
  "shaded: the band  orange: left leg (front, regular)  blue: right leg  yellow: the one figure  x: time",
  10,
  30,
  INK.dim,
);
rows.forEach((r, i) => {
  const y0 = 46 + i * ROW;
  d.text(r.id, 10, y0 + 16, INK.text, 2);
  d.text(`${r.seconds.toFixed(1)} s`, 10, y0 + 40, INK.dim);
  CHARTS.forEach((ch, j) => {
    const x0 = LEFT + j * (CW + GAP);
    const top = y0 + 14;
    const px = (t) => x0 + (t / r.seconds) * CW;
    const py = (v) => top + CH - (Math.max(0, Math.min(ch.top, v)) / ch.top) * CH;
    d.text(`${ch.say}  out ${pct(r.out[ch.id])}`, x0, y0 + 2, INK.dim);
    for (let g = 0; g <= ch.top; g += 30) d.line(x0, py(g), x0 + CW, py(g), INK.grid);
    // The band, shaded frame by frame (it steps where the moment does).
    for (let k = 0; k < r.samples.length; k++) {
      const s = r.samples[k];
      const band = bandsOf(s.moment)[ch.id];
      if (!band) continue;
      const xa = px(s.t);
      const xb = k + 1 < r.samples.length ? px(r.samples[k + 1].t) : x0 + CW;
      d.fillRect(xa, py(band[1]), Math.max(1, xb - xa), py(band[0]) - py(band[1]), INK.band);
    }
    const lines = ch.of(r.samples[0]?.f ?? { knee: [0, 0] }).length;
    for (let l = 0; l < lines; l++) {
      const colour = lines === 1 ? INK.one : l === 0 ? INK.front : INK.rear;
      // Broken where the figure is not read (the head while still).
      let run = [];
      const flush = () => {
        if (run.length > 1) d.polyline(run, colour, 2);
        run = [];
      };
      for (const s of r.samples) {
        // The knees by side, the left first.
        const v = ch.of(s.f)[l];
        if (v === null || v === undefined) flush();
        else run.push([px(s.t), py(v)]);
      }
      flush();
    }
    d.rect(x0, top, CW, CH, INK.frame);
    d.text(String(ch.top), x0 - 20, top - 3, INK.dim);
    d.text("0", x0 - 10, top + CH - 6, INK.dim);
  });
});

mkdirSync(dirname(join(root, args.out)), { recursive: true });
writeFileSync(join(root, args.out), d.toPng());
console.log(`\n${args.out}`);

// THE FILMSTRIPS: the same moves through the skier lab, at chase range and
// from the side.
if (args.film) {
  const film = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      join(root, "scripts/skier-preview.mjs"),
      `--skis=${args.skis}`,
      "--sheet=moves",
      "--views=chase,side",
      ...(args.move ? [`--move=${args.move}`] : []),
    ],
    { stdio: "inherit", cwd: root },
  );
  if (film.status !== 0) process.exit(film.status ?? 1);
}
