#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DEVELOPER ▸ BENCHMARK, from the command line: the BUILT site (`make build`
// first) opened on `?bench=1` in headless Chromium, the pinned race run to
// its end, and the report COPY DEBUG REPORT would put on the clipboard
// printed here (`window.__SH_BENCH__`, `benchmark-report.ts`).
//
// It is the same run a person starts on a phone from the developer page —
// the same plan, the same pump, the same report — so a score from here and
// one pasted off a device are two readings of one instrument. What differs
// is the machine: headless Chromium draws through a SOFTWARE rasteriser
// (SwiftShader) unless `--gpu` asks for the host's own, so a score from here
// is a statement about this build's CPU cost and a regression's shape, and
// never a figure to hold a phone to.
//
// ON THE HOST'S GPU the report carries the card's own timer, pass by pass
// (`gpu-timer.ts`); `--split` cuts the scene's pass by subsystem as well, and
// `--hide` draws the race WITHOUT some subsystems. `--ab` hides each
// subsystem a frame in turn inside the one run and bills what each one cost
// the card as the difference — the reading a tiled GPU's split cannot give,
// and immune to the machine drifting between two runs.
//
// `--sweep` PRICES EVERY PICTURE ROW IN ONE LONG RUN a view: a picture dealt
// at random every block of frames, every stop's cost fitted off the lot
// (`picture-sweep.ts`), the table for `picture-fit.ts` printed and the
// whole of it written to `previews/picture-sweep.json` for an agent to read.
//
// `--renderer` draws it on another back end (`?renderer=`, `docs/webgpu.md`):
// webgpu or webgpu-gl, or `both` (webgl, then webgpu) and `all`, the same
// plan on each in a browser of its own and a table of the two side by side
// after the reports — the ledger's row (`docs/webgpu.md`) is read off it.

import process from "node:process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

import { assertBackend, rendererArgs, rendererFlag, renderersOf } from "./lib/backend-flag.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    width: { kind: "number", default: 1280, help: "viewport width, CSS px" },
    height: { kind: "number", default: 720, help: "viewport height, CSS px" },
    video: { kind: "string", help: "picture preset for the visit (low, medium, high)" },
    gpu: { kind: "flag", help: "draw on the host's GPU rather than SwiftShader" },
    split: { kind: "flag", help: "cut the GPU timer's scene pass by subsystem too" },
    hide: { kind: "string", help: "draw without these subsystems, comma-separated (HIDEABLE)" },
    ab: { kind: "flag", help: "hide each subsystem a frame in turn and time each on the GPU" },
    picture: {
      kind: "string",
      help: "picture rows over the preset, row:stop by commas (?picture=)",
    },
    costs: {
      kind: "flag",
      help: "price every stop of every picture row against the top picture (writes previews/picture-costs.json)",
    },
    sweep: {
      kind: "flag",
      help: "price every picture row in one long run of random pictures a view (writes previews/picture-sweep.json)",
    },
    blocks: {
      kind: "number",
      default: 240,
      help: "--sweep: random pictures a view, a block of frames each (60 up)",
    },
    views: {
      kind: "string",
      help: "the scenes priced, comma-separated (race, vista, sunset, night, snow — bench-scenes.ts); --sweep runs all five unless told, --costs the race and the vista, a plain run the one scene named",
    },
    rows: {
      kind: "string",
      help: "--costs: price only these picture rows, comma-separated (lamps from the night: --views night --rows lamps)",
    },
    report: {
      kind: "string",
      help: "--sweep: read the sweeps out of a saved report (a device's COPY DEBUG REPORT), running nothing",
    },
    reprice: {
      kind: "flag",
      help: "print the cost table from the last --costs (or --sweep) run's JSON, running nothing",
    },
    timeout: { kind: "number", default: 3600, help: "seconds to wait for the run to finish" },
    frames: {
      kind: "number",
      help: "time this many frames, not the plan's (?frames=, 60 up); --costs: each stop's stretch, 600 unless told",
    },
    cheapest: {
      kind: "flag",
      help: "--costs: price only each row's cheapest stop against the top (each row's whole span, in fewer runs)",
    },
    rounds: {
      kind: "number",
      default: 3,
      help: "--costs: runs of each stop beside the top picture, the median kept (fewer for a software device)",
    },
    renderer: rendererFlag(true),
    out: { kind: "string", default: "previews/benchmark.txt", help: "where the report is written" },
    dist: {
      kind: "string",
      default: "pwa/dist",
      help: "the built site to run (a second build, for A-against-B)",
    },
  },
  "make bench [ARGS=...] — run DEVELOPER ▸ BENCHMARK on the built site and print its report",
);

if (args.sweep && (args.reprice || args.report)) {
  const { aliasEngine } = await import("@niclaslindstedt/oss-game-framework/tooling/alias");
  aliasEngine(root);
  const { readSweeps, sweepTable } = await import("../pwa/src/game/picture-sweep.ts");
  const results = args.report
    ? readSweeps(readFileSync(args.report, "utf8"))
    : JSON.parse(readFileSync(join(root, "previews", "picture-sweep.json"), "utf8")).views;
  if (results.length === 0) {
    console.error("no picture sweep in it");
    process.exit(1);
  }
  console.log(sweepTable(results));
  process.exit(0);
}

if (args.reprice) {
  const priced = JSON.parse(readFileSync(join(root, "previews", "picture-costs.json"), "utf8"));
  console.log(costTable(await ladders(), priced));
  process.exit(0);
}

const dist = join(root, args.dist);
if (!existsSync(join(dist, "index.html"))) {
  console.error(`no built site at ${dist} — run \`make build\` first`);
  process.exit(2);
}
const found = await findChromium();
if (!found) process.exit(2);

const renderers = renderersOf(args.renderer, true);
if (renderers.length > 1 && (args.costs || args.sweep)) {
  console.error("--costs and --sweep price one back end at a time: name one --renderer");
  process.exit(2);
}
const site = await serveDir(dist);
/** A browser for back end `renderer`: SwiftShader (or the host's GPU), and
 * what WebGPU needs here beside it (`scripts/lib/backend-flag.mjs`). */
const launch = (renderer) =>
  found.chromium.launch({
    executablePath: found.executablePath,
    args: [
      ...(args.gpu
        ? ["--enable-gpu", "--ignore-gpu-blocklist"]
        : ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]),
      ...rendererArgs(renderer, args.gpu),
    ],
  });
let renderer = renderers[0];
let browser = await launch(renderer);

/** One whole benchmark in a fresh page, drawn without `hide`; its report. */
async function run(hide, picture = args.picture, extra = {}) {
  const page = await browser.newPage({ viewport: { width: args.width, height: args.height } });
  page.on("pageerror", (err) => console.error(`pageerror: ${err.message}`));
  const query = new URLSearchParams({ bench: "1", splash: "0", probe: "0" });
  if (args.video) query.set("video", args.video);
  if (args.split) query.set("gpu", "split");
  if (args.ab) query.set("ab", "1");
  if (hide) query.set("hide", hide);
  if (picture) query.set("picture", picture);
  if (args.frames !== undefined) query.set("frames", String(args.frames));
  query.set("renderer", renderer); // named even for WebGL: the game's own default is `auto`
  for (const [key, value] of Object.entries(extra)) query.set(key, value);
  const url = `${site.url}?${query}`;
  if (!args.costs && !args.sweep) {
    console.log(`benchmark — ${url} at ${args.width}×${args.height}${args.gpu ? " (gpu)" : ""}`);
  }
  try {
    await page.goto(url);
    await assertBackend(page, renderer, args.timeout * 1000);
    await page.waitForFunction(() => typeof globalThis.__SH_BENCH__ === "string", null, {
      timeout: args.timeout * 1000,
      polling: 1000,
    });
    return await page.evaluate(() => globalThis.__SH_BENCH__);
  } catch (e) {
    console.error(`the benchmark did not finish: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  } finally {
    await page.close();
  }
}

/** The picture rows and their ladders, cheapest first — `PICTURE_LADDERS`
 * in `settings-video.ts`, which a script on plain Node reads through the
 * alias rather than restating. */
async function ladders() {
  const { aliasEngine } = await import("@niclaslindstedt/oss-game-framework/tooling/alias");
  aliasEngine(root);
  return (await import("../pwa/src/game/settings-video.ts")).PICTURE_LADDERS;
}

/** The frame end to end and the card's own, ms, off a report. */
function times(report) {
  const wall = /^\s+wall\s+([\d.]+) ms/m.exec(report ?? "");
  const card = /^\s+card\s+([\d.]+) ms/m.exec(report ?? "");
  return { wall: wall ? Number(wall[1]) : NaN, card: card ? Number(card[1]) : NaN };
}

/** THE PRICE LIST — what every stop of every picture row costs, for
 * `picture-fit.ts`. Each stop is run with the other rows at the top, a
 * short stretch (`?frames=`), three times, the top picture run beside it
 * each time; its price is its frame as a SHARE of the top picture's read
 * around it, so a machine warming up and slowing through the list (a
 * laptop does, over half an hour) scales both and the share survives. And
 * from TWO VIEWS: the race's own, and the VISTA across the whole basin —
 * DISTANCE is nearly free in the woods and dear from a hilltop, and a
 * picture has to hold on its dearest view. */
async function priceList() {
  const ladder = await ladders();
  const { isBenchScene } = await import("../pwa/src/game/bench-scenes.ts");
  const asked = args.rows?.split(",") ?? Object.keys(ladder);
  const scenes = (args.views ?? "race,vista").split(",");
  const unknown = [
    ...asked.filter((row) => !(row in ladder)).map((row) => `row ${row}`),
    ...scenes.filter((view) => !isBenchScene(view)).map((view) => `scene ${view}`),
  ];
  if (unknown.length > 0) {
    console.error(`no ${unknown.join(", no ")}`);
    return null;
  }
  // Every row is drawn at its top but the stop being priced; only the rows
  // asked for are lowered. A run of some rows, or from other scenes, is
  // written beside the whole list rather than over it.
  const all = Object.fromEntries(asked.map((row) => [row, ladder[row]]));
  const top = Object.fromEntries(Object.entries(ladder).map(([row, l]) => [row, l[l.length - 1]]));
  const pic = (over) =>
    Object.entries({ ...top, ...over })
      .map(([row, stop]) => `${row}:${stop}`)
      .join(",");
  const FRAMES = args.frames ?? 600;
  // Every stop under the top, or (`--cheapest`) the cheapest alone.
  const priced = (stops) => (args.cheapest ? stops.slice(0, 1) : stops.slice(0, -1));
  const ROUNDS = Math.max(1, Math.round(args.rounds));
  const bench = async (view, over) => {
    const extra = { frames: String(FRAMES) };
    if (view !== "race") extra.view = view;
    return times(await run("", pic(over), extra));
  };
  const views = {};
  for (const view of scenes) {
    const rows = {};
    const topRuns = [];
    // Each stop's last top run is the next stop's first.
    let before = await bench(view, {});
    topRuns.push(before);
    for (const [row, stops] of Object.entries(all)) {
      rows[row] = {};
      for (const stop of priced(stops)) {
        const shares = { wall: [], card: [] };
        for (let r = 0; r < ROUNDS; r++) {
          const t = await bench(view, { [row]: stop });
          const after = await bench(view, {});
          topRuns.push(after);
          for (const k of ["wall", "card"]) shares[k].push(t[k] / ((before[k] + after[k]) / 2));
          before = after;
        }
        const mid = (v) => [...v].sort((a, b) => a - b)[v.length >> 1];
        rows[row][stop] = { wall: mid(shares.wall), card: mid(shares.card) };
        console.log(
          `  ${view.padEnd(6)} ${`${row} ${stop}`.padEnd(20)} ${(rows[row][stop].wall * 100).toFixed(1)}% of the top frame  (card ${(rows[row][stop].card * 100).toFixed(1)}%)`,
        );
      }
    }
    const low = Object.fromEntries(Object.entries(ladder).map(([row, l]) => [row, l[0]]));
    const floor = await bench(view, low);
    const after = await bench(view, {});
    topRuns.push(after);
    const floorShare = {
      wall: floor.wall / ((before.wall + after.wall) / 2),
      card: floor.card / ((before.card + after.card) / 2),
    };
    const topWall = topRuns.map((t) => t.wall).sort((a, b) => a - b)[topRuns.length >> 1];
    const topCard = topRuns.map((t) => t.card).sort((a, b) => a - b)[topRuns.length >> 1];
    views[view] = {
      top: { wall: topWall, card: topCard },
      floor: floorShare,
      rows,
    };
  }
  const lines = [
    `PICTURE PRICE LIST — ${args.width}×${args.height}, the benchmark race, ${FRAMES}-frame runs`,
    `  each stop's frame as a share of the top picture's around it, from ${scenes.join(", ")}`,
    `  row          stop    ${scenes.map((view) => view.padStart(7)).join(" ")}`,
  ];
  for (const [row, stops] of Object.entries(all)) {
    for (const stop of priced(stops)) {
      const shares = scenes.map((view) =>
        `${(views[view].rows[row][stop].wall * 100).toFixed(1)}%`.padStart(7),
      );
      lines.push(`  ${row.padEnd(12)} ${stop.padEnd(7)} ${shares.join(" ")}`);
    }
  }
  for (const view of scenes) {
    lines.push(
      `  top picture, ${view}: wall ${views[view].top.wall.toFixed(2)} ms  card ${views[view].top.card.toFixed(3)} ms; ` +
        `every row at its cheapest: ${(views[view].floor.wall * 100).toFixed(1)}%`,
    );
  }
  const whole = !args.rows && !args.views && !args.cheapest;
  const name = whole
    ? "picture-costs.json"
    : `picture-costs-${scenes.join("-")}${args.rows ? `-${asked.join("-")}` : ""}${args.cheapest ? "-cheapest" : ""}.json`;
  const list = { width: args.width, height: args.height, frames: FRAMES, views };
  writeFileSync(join(root, "previews", name), JSON.stringify(list, null, 2));
  lines.push(`  (the numbers: previews/${name})`, "", costTable(all, list));
  return lines.join("\n");
}

/** THE TABLE `PICTURE_PRICES` takes: each stop's ms over its row's cheapest,
 * off the view where it is dearest — the share of the top frame it saves
 * there, times that view's top frame — levelled so no stop is priced under
 * the one below it (that is noise, not a stop paying for itself). */
function costTable(all, priced) {
  const views = Object.values(priced.views);
  const out = ["COSTS FOR picture-fit.ts, ms over each row's cheapest stop (the dearer view's)"];
  let floor = Infinity;
  for (const v of views) floor = Math.min(floor, v.floor.wall * v.top.wall);
  out.push(`  FLOOR_MS = ${floor.toFixed(2)}`);
  for (const [row, ladder] of Object.entries(all)) {
    const saved = (v, stop) =>
      stop === ladder[ladder.length - 1] ? 0 : (1 - v.rows[row][stop].wall) * v.top.wall;
    let last = 0;
    const cells = ladder.map((stop, i) => {
      // A stop `--cheapest` did not run has no reading.
      if (i < ladder.length - 1 && views.some((v) => !v.rows[row][stop])) return `${stop} —`;
      const cost =
        i === 0 ? 0 : Math.max(...views.map((v) => saved(v, ladder[0]) - saved(v, stop)));
      last = Math.max(last, cost);
      return `${stop} ${last.toFixed(2)}`;
    });
    out.push(`  ${row.padEnd(12)} ${cells.join("  ")}`);
  }
  return out.join("\n");
}

/** THE SWEEP: one long run of random pictures from each view, read back off
 * its report (`readSweeps`), and the costs for `picture-fit.ts` off them. */
async function sweepList() {
  const { aliasEngine } = await import("@niclaslindstedt/oss-game-framework/tooling/alias");
  aliasEngine(root);
  const { readSweeps, sweepCosts, sweepTable } = await import("../pwa/src/game/picture-sweep.ts");
  const { isBenchScene } = await import("../pwa/src/game/bench-scenes.ts");
  const views = (args.views ?? "race,vista,sunset,night,snow").split(",").filter(isBenchScene);
  const results = [];
  const reports = [];
  for (const view of views) {
    console.log(`  sweeping the ${view} scene: ${args.blocks} random pictures…`);
    const extra = { sweep: String(args.blocks) };
    if (view !== "race") extra.view = view;
    const report = await run("", args.picture, extra);
    if (report === null) return null;
    reports.push(report);
    const [result] = readSweeps(report);
    if (!result) {
      console.error(`the ${view}'s report carried no sweep`);
      return null;
    }
    results.push(result);
  }
  const { floorMs, costs } = sweepCosts(results);
  const json = join(root, "previews", "picture-sweep.json");
  mkdirSync(dirname(json), { recursive: true });
  writeFileSync(
    json,
    JSON.stringify(
      { width: args.width, height: args.height, floorMs, costs, views: results },
      null,
      2,
    ),
  );
  return [...reports, "", sweepTable(results), "  (the numbers: previews/picture-sweep.json)"].join(
    "\n",
  );
}

/** THE BACK ENDS SIDE BY SIDE, off their reports: the frame, the draws, the
 * pipelines and what each drew without — the ledger's row (`docs/webgpu.md`). */
function sideBySide(reports) {
  const num = (re, text) => {
    const m = re.exec(text);
    return m ? Number(m[1].replace(/[^\d.]/g, "")) : NaN;
  };
  const rows = [
    ["wall ms", (t) => num(/^\s+wall\s+([\d.]+) ms/m, t).toFixed(2)],
    ["render ms (cpu)", (t) => num(/^\s+render\s+([\d.]+) ms/m, t).toFixed(2)],
    ["submit ms", (t) => num(/^\s+submit\s+([\d.]+) ms/m, t).toFixed(2)],
    [
      "card ms",
      (t) => (/^\s+card\s/m.test(t) ? num(/^\s+card\s+([\d.]+) ms/m, t).toFixed(3) : "—"),
    ],
    ["draw calls", (t) => String(num(/^\s+draw calls\s+([\d\s\u2009]+)$/m, t))],
    ["triangles", (t) => String(num(/^\s+triangles\s+([\d\s\u2009]+)$/m, t))],
    ["programs", (t) => String(num(/^\s+programs\s+([\d\s\u2009]+)$/m, t))],
    ["pipelines", (t) => String(num(/ (\d+) pipelines/, t) || "—")],
    ["passes skipped", (t) => String(/^\s+SKIPPED (.*)$/m.exec(t)?.[1].split(" · ").length ?? 0)],
    [
      "meshes hidden",
      (t) =>
        String(
          (/^\s+QUARANTINED (.*)$/m.exec(t)?.[1] ?? "")
            .split(" · ")
            .reduce((a, part) => a + (Number(/×(\d+)$/.exec(part)?.[1]) || 0), 0),
        ),
    ],
  ];
  const width = 18;
  const out = [
    `THE BACK ENDS SIDE BY SIDE — ${args.width}×${args.height}${args.video ? `, ${args.video}` : ""}${args.gpu ? ", the host's GPU" : ", SwiftShader: structure, not a phone's ms"}`,
    `  ${"".padEnd(width)}${reports.map(([r]) => r.padStart(12)).join("")}`,
  ];
  for (const [label, read] of rows) {
    out.push(`  ${label.padEnd(width)}${reports.map(([, t]) => read(t).padStart(12)).join("")}`);
  }
  for (const [r, t] of reports) {
    for (const line of t.split("\n").filter((l) => /^\s+(SKIPPED|QUARANTINED) /.test(l)))
      out.push(`  ${r}: ${line.trim()}`);
  }
  return out.join("\n");
}

let text;
if (args.sweep) text = await sweepList();
else if (args.costs) text = await priceList();
else {
  const reports = [];
  for (const r of renderers) {
    if (r !== renderer) {
      await browser.close();
      renderer = r;
      browser = await launch(r);
    }
    const report = await run(args.hide ?? "", args.picture, args.views ? { view: args.views } : {});
    if (report === null) break;
    reports.push([r, report]);
  }
  text =
    reports.length < renderers.length
      ? null
      : renderers.length === 1
        ? reports[0][1]
        : [...reports.map(([r, t]) => `── ${r} ──\n${t}`), "", sideBySide(reports)].join("\n\n");
}
await browser.close();
site.close();
if (text === null) process.exit(1);

console.log(text);
const out = join(root, args.out);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${text}\n`);
console.log(`\nwrote ${args.out}`);
