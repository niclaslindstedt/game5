#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LEVEL MAP — a map drawn from above and described, from nothing but
// the engine.
//
// This is the tool for reasoning about a map WITHOUT skiing it: "the second
// kicker on seed 38" is a claim, and this turns it into a picture with `K2`
// on it and a row in a table saying where K2 stands, how far down the
// piste, how high its lip and how long its ramp and landing; and every gate
// with the grade of the piste from the last one. It loads the
// engine and nothing else — no three.js, no browser, no build — so it runs
// in a couple of seconds on any seed.
//
//   npm run level -- --seed 38               # previews/level-38.png + .txt
//   npm run level -- --seed 38 --scale 1     # one pixel a metre
//   npm run level -- --seed 38 --json        # the listing as data, too
//   npm run level -- --seed 38 --out plan    # previews/plan.png
//   npm run level -- --seed 38 --tricks      # the trick field laid (R20)
//
// Writes previews/level-<seed>.png and previews/level-<seed>.txt (the same
// table the run prints).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { renderLevelMap } from "./lib/level-draw.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// The generator's own surface rather than `engine/index.ts`: this lab needs
// the map and its scoreboard and nothing of the rest of the engine.
const { generateLevel, trackPointAt } = await import(join(root, "engine/mapgen/index.ts"));
const { analyzeLevel } = await import(join(root, "engine/analysis/index.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 1, help: "the map's seed" },
    scale: { kind: "number", default: 0.6, help: "pixels per metre" },
    out: { kind: "string", help: "file name under previews/ (no extension)" },
    json: { kind: "flag", help: "also print the listing as JSON" },
    tricks: { kind: "flag", help: "build the map a tricks run skis: its terrain park laid (R20)" },
    region: {
      kind: "string",
      default: "alpine",
      help: "the kind of snow country (R21): alpine, fell, continental, maritime",
    },
  },
  "usage: npm run level -- --seed n [--scale px/m] [--out name] [--json] [--tricks] [--region id]",
);

// ── Build it ────────────────────────────────────────────────────────────
const t0 = performance.now();
const level = generateLevel(args.seed, { tricks: args.tricks, region: args.region });
const built = performance.now() - t0;
const analysis = analyzeLevel(level);
const st = analysis.stats;
const deg = (rad) => ((((rad * 180) / Math.PI) % 360) + 360) % 360;
const f = (v, d = 1) => v.toFixed(d);

// ── The listing ─────────────────────────────────────────────────────────
const out = [];
out.push(
  `level ${level.seed} — built in ${f(built, 0)} ms (attempt ${level.attempt}), ${level.size} m square, cell ${level.cell} m`,
);
const M = level.mountain;
out.push(
  `mountain: ${f(M.vertical, 0)} m of vertical from the summit ridge (${f(M.summit.x, 0)}, ${f(M.summit.z, 0)}) to the base at the finish, ` +
    `the valley floor at ${f(M.altitude, 0)} m, the tree line at ${f(M.treeLine, 0)} m`,
);
out.push(
  `piste: ${f(st.length, 0)} m open descent, ${st.points} stations, width ${f(st.widthMin)}–${f(st.widthMax)} m, ` +
    `tightest bend ${f(st.minRadius, 0)} m, drop ${f(st.drop, 0)} m, steepest ${f(st.maxGrade * 100, 1)} % off the kickers, ` +
    `a ${st.colour.toUpperCase()} (steepest hundred metres ${f(st.steepestSpan * 100, 0)} %), ${f(st.traverse * 100, 0)} % of it traversing`,
);
out.push(
  `start line: (${f(level.spawn.x, 0)}, ${f(level.spawn.z, 0)}) facing ${f(deg(level.spawn.heading), 0)}°, ` +
    `${level.grid.length} abreast, the start gate ${f(level.checkpoints[0].s, 0)} m down the piste`,
);
out.push(
  `region: ${level.region}; forest: ${level.trees.length} trees; kickers: ${st.trackKickers} on the piste, ${st.offKickers} off it; cliffs: ${st.cliffs}`,
);
out.push(
  `sun: ${f(level.sun.hour, 2)} h solar on day ${level.sun.dayOfYear} at ${f(level.sun.latitude)}°N — ${f(st.sunElevation)}° up`,
);
out.push(
  `weather: ${level.weather.kind}${level.weather.evening ? " (evening)" : ""}, wind ${f(level.weather.wind)} m/s` +
    `${level.weather.snowfall > 0 ? `, fall ${f(level.weather.snowfall, 2)}` : ""}` +
    `${level.weather.fog > 0 ? `, fog ${f(level.weather.fog, 2)}` : ""}`,
);
out.push("");
out.push("   gate colour     s(m)      x      z      y   width  from last  grade  steepest");
level.checkpoints.forEach((c, i) => {
  const last = i === level.checkpoints.length - 1;
  const prev = i === 0 ? 0 : level.checkpoints[i - 1].s;
  // The grade of the piste from the last gate to this one: the mean fall,
  // and the steepest ten-metre window of it.
  const from = i === 0 ? level.track.points[0] : level.checkpoints[i - 1];
  const mean = c.s > prev ? (from.y - c.y) / (c.s - prev) : 0;
  let steepest = 0;
  for (let u = prev; u + 10 <= c.s; u += 2) {
    const a = trackPointAt(level, u);
    const b = trackPointAt(level, u + 10);
    steepest = Math.max(steepest, (a.y - b.y) / 10);
  }
  out.push(
    `  ${String(i === 0 ? "START" : last ? "FIN" : i).padStart(5)} ${c.colour.padStart(6)} ${f(c.s, 0).padStart(8)} ${f(c.x, 0).padStart(6)} ${f(c.z, 0).padStart(6)} ` +
      `${f(c.y).padStart(6)} ${f(c.width).padStart(7)} ${f(c.s - prev, 0).padStart(10)} ${f(mean * 100, 0).padStart(5)} % ${f(steepest * 100, 0).padStart(7)} %`,
  );
});
out.push("");
out.push("  kicker   s(m)      x      z   lip(m)  ramp  landing  width  heading");
for (const k of level.kickers) {
  out.push(
    `  ${k.id.padEnd(6)} ${(k.s === undefined ? "-" : f(k.s, 0)).padStart(6)} ${f(k.x, 0).padStart(6)} ${f(k.z, 0).padStart(6)} ` +
      `${f(k.height).padStart(8)} ${f(k.ramp, 0).padStart(5)} ${f(k.landing, 0).padStart(8)} ${f(k.width, 0).padStart(6)} ${f(deg(k.heading), 0).padStart(7)}°`,
  );
}
if (level.cliffs.length > 0) {
  out.push("");
  out.push("  cliff       x      z  top(m)  drop  face  shelf  width  heading");
  for (const c of level.cliffs) {
    out.push(
      `  ${c.id.padEnd(6)} ${f(c.x, 0).padStart(6)} ${f(c.z, 0).padStart(6)} ${f(c.y).padStart(7)} ` +
        `${f(c.drop).padStart(5)} ${f(c.face).padStart(5)} ${f(c.shelf, 0).padStart(6)} ${f(c.width, 0).padStart(6)} ${f(deg(c.heading), 0).padStart(7)}°`,
    );
  }
}
out.push("");
if (analysis.findings.length === 0) out.push("analysis: clean");
for (const fd of analysis.findings) out.push(`analysis: ${fd.severity} ${fd.rule} ${fd.message}`);
const text = out.join("\n");
console.log(text);
if (args.json) {
  console.log(
    JSON.stringify(
      {
        seed: level.seed,
        stats: st,
        checkpoints: level.checkpoints,
        kickers: level.kickers,
        cliffs: level.cliffs,
        spawn: level.spawn,
        grid: level.grid,
        sun: level.sun,
      },
      null,
      2,
    ),
  );
}

// ── The picture ─────────────────────────────────────────────────────────
const canvas = renderLevelMap({
  level,
  scale: args.scale,
  title: `LEVEL ${level.seed}${args.region !== "alpine" ? ` ${args.region.toUpperCase()}` : ""}  ${f(st.length / 1000, 2)} KM ${st.colour.toUpperCase()} PISTE  ${f(M.vertical, 0)} M VERTICAL  ${level.checkpoints.length} GATES  ${st.trackKickers}+${st.offKickers} KICKERS  ${st.cliffs} CLIFFS`,
  lines: [
    `WIDTH ${f(st.widthMin)}-${f(st.widthMax)} M`,
    `TIGHTEST BEND ${f(st.minRadius, 0)} M`,
    `MAX GRADE ${f(st.maxGrade * 100)} %`,
    `DROP ${f(st.drop, 0)} M`,
    `TREE LINE ${f(M.treeLine, 0)} M`,
    `TREES ${level.trees.length}`,
    `TREE GAP ${f(st.treeGap, 1)} M`,
    `SUN ${f(level.sun.hour, 1)} H DAY ${level.sun.dayOfYear}`,
    `LAT ${f(level.sun.latitude)} ELEV ${f(st.sunElevation)}`,
    analysis.ok ? "ANALYSIS CLEAN" : "ANALYSIS: ERRORS",
  ],
});
const dir = join(root, "previews");
mkdirSync(dir, { recursive: true });
const name =
  args.out ??
  `level-${level.seed}${args.region !== "alpine" ? `-${args.region}` : ""}${args.tricks ? "-tricks" : ""}`;
writeFileSync(join(dir, `${name}.png`), canvas.toPng());
writeFileSync(join(dir, `${name}.txt`), text + "\n");
console.log(`\nwrote previews/${name}.png and previews/${name}.txt`);
