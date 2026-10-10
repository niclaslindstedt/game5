#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GENERATOR'S SCOREBOARD over a range of seeds: every map built, every
// finding its analysis names, one row of numbers a map, and a tally at the
// foot — how many came out clean, how many took more than one attempt, and
// the spread of the numbers the rules are written in.
//
//   npm run analyze                       # seeds 1..20
//   npm run analyze -- --seed 38          # one map, every finding
//   npm run analyze -- --from 1 --count 100
//   npm run analyze -- --count 24 --grade black   # every map a black (R23)
//
// A finding names its rule (`R8`, `R12`…), so a fix is pointed at one
// paragraph of `engine/mapgen/rules.ts`. Exits non-zero when any seed
// could not be built at all.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { generateLevel } = await import(join(root, "engine/mapgen/index.ts"));
const { analyzeLevel } = await import(join(root, "engine/analysis/index.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", help: "analyze this one seed only" },
    from: { kind: "number", default: 1, help: "first seed of the sweep" },
    count: { kind: "number", default: 20, help: "how many seeds to sweep" },
    face: {
      kind: "string",
      help: "raise the mountain on a REAL face (R25, real-face.ts): alpine-1 … fell-2; its region is the face's",
    },
    region: {
      kind: "string",
      default: "alpine",
      help: "the kind of snow country (R21): alpine, fell, continental, maritime",
    },
    grade: {
      kind: "string",
      help: "the piste grade to build to (R23): green, blue, red, black — the seed's own when left out",
    },
  },
  "usage: npm run analyze -- [--seed n | --from n --count k] [--region id] [--grade id]",
);
// A real face is fetched before a map is raised on it (`loadRealFace`).
if (args.face) await (await import(join(root, "engine/mapgen/index.ts"))).loadRealFace(args.face);

const seeds =
  args.seed !== undefined
    ? [args.seed]
    : Array.from({ length: args.count }, (_, i) => args.from + i);
const f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "inf");

console.log(
  "seed   ms  try  length  width      turn  grade  steep  built colour  mean   drop  vert  kick  off  clf drop  cps    gap  trees  sun   findings",
);
const rows = [];
let broken = 0;
for (const seed of seeds) {
  const t0 = performance.now();
  let level;
  try {
    level = generateLevel(seed, { region: args.region, face: args.face, grade: args.grade });
  } catch (e) {
    broken++;
    console.log(`${String(seed).padStart(4)}  FAILED  ${String(e.message ?? e).slice(0, 300)}`);
    continue;
  }
  const ms = performance.now() - t0;
  const a = analyzeLevel(level);
  const s = a.stats;
  rows.push({ seed, ms, ...s, findings: a.findings.length, ok: a.ok });
  const findings = a.findings
    .map((x) => `${x.severity === "error" ? "E" : "w"}:${x.rule} ${x.message}`)
    .join("; ");
  console.log(
    `${String(seed).padStart(4)} ${f(ms, 0).padStart(4)} ${String(s.attempt).padStart(4)} ${f(s.length, 0).padStart(7)} ` +
      `${f(s.widthMin)}-${f(s.widthMax)} ${f(s.minRadius, 0).padStart(6)} ${f(s.maxGrade * 100).padStart(6)} ` +
      `${f(s.steepestSpan * 100).padStart(6)} ${(s.grade ?? "-").padStart(6)} ${s.colour.padStart(6)} ${f(s.meanGrade * 100).padStart(5)} ` +
      `${f(s.drop, 0).padStart(6)} ${f(s.vertical, 0).padStart(5)} ${String(s.trackKickers).padStart(5)} ${String(s.offKickers).padStart(4)} ${String(s.cliffs - s.drops).padStart(4)} ${String(s.drops).padStart(4)} ` +
      `${String(s.checkpoints).padStart(4)} ${f(s.treeGap, 1).padStart(6)} ${String(s.trees).padStart(6)} ` +
      `${f(s.sunElevation, 0).padStart(4)}°  ${findings || "clean"}`,
  );
}

if (rows.length > 1) {
  const spread = (key, d = 1, k = 1) => {
    const v = rows.map((r) => r[key] * k).sort((a, b) => a - b);
    return `${f(v[0], d)} / ${f(v[Math.floor(v.length / 2)], d)} / ${f(v[v.length - 1], d)}`;
  };
  const most = Math.max(0, ...rows.map((r) => r.trackKickers));
  const kick = Array.from({ length: most + 1 }, (_, k) => k)
    .map((k) => `${k}:${rows.filter((r) => r.trackKickers === k).length}`)
    .join(" ");
  console.log("");
  console.log(
    `${rows.length} built, ${broken} failed, ${rows.filter((r) => r.findings === 0).length} with no findings, ${rows.filter((r) => r.attempt > 0).length} needed a retry`,
  );
  console.log(
    `min / median / max — build ms ${spread("ms", 0)}, length ${spread("length", 0)} m, tightest turn ${spread("minRadius", 0)} m`,
  );
  console.log(
    `  grade ${spread("maxGrade", 1, 100)} %, drop ${spread("drop", 0)} m, vertical ${spread("vertical", 0)} m, trees ${spread("trees", 0)}, tree gap ${spread("treeGap", 1)} m, cliffs ${spread("cliffs", 0)}`,
  );
  const colours = ["green", "blue", "red", "black"]
    .map((c) => `${c}:${rows.filter((r) => r.colour === c).length}`)
    .join(" ");
  console.log(`piste kickers per map — ${kick} · colours — ${colours}`);
}
process.exit(broken > 0 ? 1 : 0);
