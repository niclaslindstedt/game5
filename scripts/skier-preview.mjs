// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER LAB (`make skier`): the skier in MOTION, as the game draws him.
// Each move (`scripts/lib/skier-moves.mjs` — a skate stride, a double pole,
// a jump loaded and sprung and landed, a hockey stop, a carve cut hard, the
// tuck, a landing, a wipeout) is SKIED BY THE REAL ENGINE here in Node on a
// synthetic strip, every step's `SkierState` kept; then a harness page
// (`pwa/skier-preview.html`) poses the game's own skier — the committed
// Blender models, as every build draws them, or the code's figure with
// `--code` — through every one of those states in turn (his spring on his
// legs stepped as the game steps it) and photographs chosen frames from
// several sides at once: previews/skier-<move>.png, a column a moment and
// a row a view. `--sheet=turntable` stands him in his stance, a tuck and a
// skate stride and walks the lens round him every 45°:
// previews/skier-turntable.png.
//
// Three sheets judge him closer, each at the MOMENTS of
// `scripts/lib/skier-moves.mjs` (the stance, a carve, the edge cut hard,
// the tuck, a pole push, a skate, the air, a landing, a hockey stop):
// `--sheet=closeup`, a moment a row from behind, the rear three-quarter,
// the side and the front three-quarter in big cells — the cloth, the
// folds; `--sheet=detail`, each hand on its grip, the boots in the
// bindings and the head, framed close off the model's own bones; `--sheet=game`, the same moments as the
// game's chase and far cameras see them, rendered at the pixels a
// 1280×720 frame gives him and enlarged without smoothing — what a player
// actually reads; and `--sheet=stretch`, the model's skin coloured by how
// far each triangle is stretched (red) or crushed (blue) from the pose it
// was bound in, with the share of the suit outside a band printed per
// region — where the skinning tears or collapses.
//
// `--sheet=path` draws WHERE EACH MOVE TAKES HIM: straight down and from
// behind, the skier strobed every quarter second over the line his centre
// of gravity draws on the snow and each foot's prints, with the numbers
// that say whether he goes the way his skis point (the drift off his
// heading, the glide off the gliding ski's line, the sway, the V, the
// strides a second): previews/skier-path-<move>.png
// (`pwa/src/tools/skier-path.ts`).
//
// It exists because a pose that reads in one still can be a twitch, a
// boot leaving its ski or an arm through the body a frame later — and the
// game's cameras, the world lab and the skis lab all show one moment.
//
//   node scripts/skier-preview.mjs                          every move and the turntable
//   node scripts/skier-preview.mjs --move=skate,jump        those moves
//   node scripts/skier-preview.mjs --sheet=turntable
//   node scripts/skier-preview.mjs --code                   the code's figure, no models
//   node scripts/skier-preview.mjs --frames=12 --views=back,side
//   node scripts/skier-preview.mjs --sheet=closeup,game,stretch
//   node scripts/skier-preview.mjs --sheet=closeup --moment=carve,tuck
//   node scripts/skier-preview.mjs --sheet=path --move=skate,pole,start

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";
import { MOMENTS, MOMENT_IDS, MOVES, MOVE_IDS } from "./lib/skier-moves.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".skier-preview");
const outDir = join(root, "previews");
const VIEWS = ["back", "back3", "side", "front3", "front", "chase"];

const args = parseArgs(
  process.argv.slice(2),
  {
    move: {
      kind: "string",
      default: "",
      help: `the moves to photograph (${MOVE_IDS.join(", ")}); every one when left out`,
    },
    sheet: {
      kind: "string",
      default: "",
      help: "moves (the frame strips), path (each move from above, the line he takes), turntable (every 45°), closeup, detail (the hands, the boots, the head), game (the chase and far cameras at the game's pixels), stretch (the skin's stretch); moves and turntable when left out",
    },
    moment: {
      kind: "string",
      default: "",
      help: `the moments of the closeup, detail, game and stretch sheets (${MOMENT_IDS.join(", ")}); every one when left out`,
    },
    skis: { kind: "string", default: "chamois", help: "the pair he skis on" },
    slot: { kind: "number", default: 0, help: "the start-line slot's kit, 0..3" },
    frames: { kind: "number", default: 9, help: "moments a move is shown at" },
    views: {
      kind: "string",
      default: "back,back3,side,front3,front",
      help: `the rows of a move's sheet (${VIEWS.join(", ")})`,
    },
    cell: { kind: "number", default: 260, help: "a cell's width, px" },
    code: { kind: "flag", default: false, help: "draw the code's figure, not the models" },
    "no-poles": {
      kind: "flag",
      default: false,
      help: "ski every move without poles (the hard mode)",
    },
    "skip-build": { kind: "flag", default: false, help: "reuse the last bundle" },
    timeout: { kind: "number", default: 240, help: "seconds a sheet may take" },
  },
  "usage: node scripts/skier-preview.mjs [--move=a,b] [--sheet=moves|path|turntable|closeup|detail|game|stretch] [--moment=a,b] [--code] [--frames=n] [--views=a,b]",
);

const moves = args.move
  ? args.move.split(",").map((id) => {
      const m = MOVES.find((x) => x.id === id);
      if (!m) {
        console.error(`unknown move "${id}" (${MOVE_IDS.join(", ")})`);
        process.exit(2);
      }
      return m;
    })
  : MOVES;
const sheets = args.sheet ? args.sheet.split(",") : ["moves", "turntable"];
const moments = args.moment
  ? args.moment.split(",").map((id) => {
      const m = MOMENTS.find((x) => x.id === id);
      if (!m) {
        console.error(`unknown moment "${id}" (${MOMENT_IDS.join(", ")})`);
        process.exit(2);
      }
      return m;
    })
  : MOMENTS;

// ── Ski every move through the real engine ────────────────────────────────
aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));
const SPRING = await import(join(root, "pwa/src/game/skier-spring.ts"));
const spec = E.skisById(args.skis);
const n = { x: 0, y: 1, z: 0 };

/** One step's record: the whole skier as the engine left him, and the
 * snow under him (its height and its normal) for the lab's ground. */
function frameOf(state) {
  const c = state.skier;
  const at = c.thrown ? c.thrown : c;
  state.level.normalAt(at.x, at.z, n);
  return {
    t: state.t,
    skier: JSON.parse(JSON.stringify(c)),
    trick: state.tricks?.pose ?? null,
    waiting: SPRING.inStartGate(state),
    ground: [state.level.groundAt(at.x, at.z), n.x, n.y, n.z],
  };
}

function ski(move) {
  const level = move.level(S);
  const state = E.createGame({
    level,
    spec,
    rivals: 0,
    countdown: 0,
    quiet: true,
    mode: move.mode,
    snowDepth: move.snow,
    poles: !args["no-poles"],
  });
  E.placeRun(state, move.place());
  const t0 = state.t;
  const steps = Math.round(move.seconds * E.TUNING.physicsHz);
  const frames = [];
  // Every other step: the page steps his legs' spring at 60 Hz through it.
  for (let i = 0; i < steps; i++) {
    const t = state.t - t0;
    E.step(state, move.input(t, state));
    if (i % 2 === 1) frames.push({ ...frameOf(state), t: state.t - t0 });
  }
  const [from, to] = move.window;
  const shots = [];
  for (let k = 0; k < args.frames; k++) {
    const t = from + ((to - from) * k) / Math.max(1, args.frames - 1);
    let best = 0;
    frames.forEach((f, i) => {
      if (Math.abs(f.t - t) < Math.abs(frames[best].t - t)) best = i;
    });
    shots.push(best);
  }
  return { id: move.id, title: move.title, frames, shots };
}

/** THE TURNTABLE's three moments: the stance at rest, a full tuck and a
 * skate stride at its push — each a state the engine settled into. */
function turntable() {
  const pick = (move, t) => {
    const run = ski({ ...move, window: [t, t] });
    return run.frames.slice(0, run.shots[0] + 1);
  };
  const stand = MOVES.find((m) => m.id === "tuck");
  const still = { ...stand, input: () => ({ steer: 0, tuck: 0, brake: 0, lean: 0, reset: false }) };
  return [
    { name: "stance", frames: pick(still, 1.2) },
    { name: "tuck", frames: pick(stand, 1.3) },
    { name: "skate", frames: pick(MOVES[0], 2.0) },
  ];
}

/** THE MOMENTS: each move skied up to its second, every state on the way
 * kept so the page steps his legs' spring through them as the game does. */
function momentFrames() {
  return moments.map((m) => {
    const move = MOVES.find((x) => x.id === m.move);
    const run = ski({ ...move, window: [m.t, m.t] });
    return { name: m.id, say: m.say, frames: run.frames.slice(0, run.shots[0] + 1) };
  });
}

const CLOSE = ["closeup", "detail", "game", "stretch"];
const data = {
  skis: spec.id,
  slot: args.slot,
  // The flight's gravity, m/s² — what the page reads his falls by.
  gravity: E.flightGravity(E.MODE_RULES.race),
  moves: sheets.includes("moves") || sheets.includes("path") ? moves.map(ski) : [],
  turntable: sheets.includes("turntable") ? turntable() : [],
  moments: sheets.some((s) => CLOSE.includes(s)) ? momentFrames() : [],
};

// ── Build the page, serve it with the models and the frames, photograph ──
mkdirSync(outDir, { recursive: true });
// The model switches are the build's (`model-switch.ts`), read off the
// environment like every build's.
if (args.code) process.env.VITE_MODEL_SKIS = "0";
if (!args["skip-build"] || !existsSync(join(buildDir, "skier-preview.html"))) {
  const { build } = await import("vite");
  await build({
    configFile: false,
    logLevel: "warn",
    root: join(root, "pwa"),
    base: "./",
    resolve: { alias: { "@engine": join(root, "engine", "index.ts") } },
    build: {
      outDir: buildDir,
      emptyOutDir: true,
      chunkSizeWarningLimit: 4000,
      rollupOptions: { input: join(root, "pwa", "skier-preview.html") },
    },
  });
}
// The committed models go beside the page, where the game's loader fetches
// them from (`loadModels`), so the lab draws what the game draws.
cpSync(join(root, "pwa", "models"), join(buildDir, "models"), { recursive: true });
writeFileSync(join(buildDir, "frames.json"), JSON.stringify(data));

const found = await findChromium();
if (!found) process.exit(1);
const server = await serveDir(buildDir);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

let crashed = null;
const jobs = [
  ...(sheets.includes("moves") ? data.moves.map((m) => ({ sheet: "moves", id: m.id })) : []),
  ...(sheets.includes("path")
    ? data.moves.map((m) => ({ sheet: "path", id: `path-${m.id}`, move: m.id }))
    : []),
  ...(data.turntable.length ? [{ sheet: "turntable", id: "turntable" }] : []),
  ...CLOSE.filter((s) => sheets.includes(s)).map((s) => ({ sheet: s, id: s })),
];
for (const job of jobs) {
  const page = await browser.newPage({
    viewport: { width: 3400, height: CLOSE.includes(job.sheet) ? 4400 : 2600 },
  });
  page.on("pageerror", (err) => {
    crashed ??= err;
    console.error(`[pageerror] ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error(`[console] ${msg.text()}`);
  });
  page.setDefaultTimeout(args.timeout * 1000);
  const query = new URLSearchParams({
    sheet: job.sheet,
    move: job.move ?? job.id,
    views: args.views,
    cell: String(args.cell),
  }).toString();
  const t0 = Date.now();
  await page.goto(`${server.url}skier-preview.html?${query}`);
  await page.waitForFunction("window.__skier !== undefined");
  await page.evaluate("window.__skier.ready");
  if (crashed) process.exit(1);
  const drawn = await page.evaluate(() => globalThis.__skier.sheet());
  if (crashed) process.exit(1);
  const out = join(outDir, `skier-${job.id}.png`);
  await page.locator("#sheet").screenshot({ path: out });
  console.log(
    `${out.replace(`${root}/`, "")}  ${drawn.rows}×${drawn.cols}: ${drawn.note}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
  );
  // The stretch sheet's numbers, a moment a line.
  for (const line of drawn.table ?? []) console.log(`  ${line}`);
  await page.close();
}
await browser.close();
await server.close();
