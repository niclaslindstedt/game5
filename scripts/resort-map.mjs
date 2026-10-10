#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RESORT LAB — a whole ski area drawn and described, from nothing but
// the engine: the tool for judging whether a generated mountain reads as a
// ski area somebody laid out (R25–R28), and how its runs are spread.
//
// One seed: the piste-map PLAN (summit up, every run in its colour, the
// lifts, the course raced), the PANORAMA from out over the valley, the
// CHARTS (every course's profile coloured by its pitch, the woods by
// height), and a listing — every lift, every run (colour, length, drop,
// steepest hundred metres, where it ends), every course, the kilometres of
// each colour, every piste's ACCESS (R29: whether it can be skied again
// without a harder run, or why not), the hub and the wind tunnels, and the
// resort's findings by rule.
//
// A sweep (`--count`): one row a seed and the tallies a generator change
// is read by — how many built, the attempts, the runs and lanes, the
// colours of the runs and of the courses, the kilometres, the pistes R29
// finds stranded and the drag lifts laid for it, the wind tunnels, the
// findings.
//
//   npm run resort -- --seed 7                       # previews/resort-7*.png + .txt
//   npm run resort -- --seed 7 --region fell --course 4
//   npm run resort -- --count 24 --region continental
//
// Engine only: no three.js, no browser, no build.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { renderResortCharts, renderResortPanorama, renderResortPlan } from "./lib/resort-draw.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { generateLevel, steepestSpan, hubAt } = await import(join(root, "engine/mapgen/index.ts"));
const { analyzeLevel } = await import(join(root, "engine/analysis/index.ts"));
const { analyzeResort, accessReport } = await import(join(root, "engine/analysis/resort.ts"));
const { lastResort } = await import(join(root, "engine/mapgen/resort-build.ts"));
const { cabinsOf } = await import(join(root, "engine/game/cabins.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", help: "draw and list this one seed's resort" },
    from: { kind: "number", default: 1, help: "first seed of a sweep" },
    count: { kind: "number", help: "sweep this many seeds instead of drawing one" },
    face: {
      kind: "string",
      help: "raise the mountain on a REAL face (R25, real-face.ts): alpine-1 … fell-2; its region is the face's",
    },
    hints: {
      kind: "flag",
      help: "draw a real face's hints over the plan (real-hints.ts): its real lifts, pistes and houses",
    },
    region: {
      kind: "string",
      default: "alpine",
      help: "the kind of snow country (R21): alpine, fell, continental, maritime",
    },
    course: { kind: "string", help: "the course to trace on the plan (R28): a run's number" },
    grade: { kind: "string", help: "trace a course of this colour instead" },
    version: {
      kind: "number",
      help: "build on this generator version (a pinned map's), not the current",
    },
    scale: { kind: "number", default: 0.4, help: "plan pixels per metre" },
    out: { kind: "string", help: "file stem under previews/ (no extension)" },
    debug: { kind: "flag", help: "print why every run slot that failed to walk failed" },
    walks: { kind: "flag", help: "draw every walk the accepted attempt refused, and why" },
  },
  "usage: npm run resort -- (--seed n | --count k [--from n]) [--region id] [--course id | --grade id]",
);

if (args.debug) {
  const out = await import("@niclaslindstedt/oss-game-framework/core/output");
  out.setDebugEnabled(true);
  out.setOutputSink((level, message) => console.log(`[${level}] ${message}`));
}

const f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "-");
const pct = (v) => `${(v * 100).toFixed(0)}%`;

function build(seed) {
  const t0 = performance.now();
  const level = generateLevel(seed, {
    region: args.region,
    face: args.face,
    course: args.course,
    grade: args.grade,
    ...(args.version === undefined ? {} : { version: args.version }),
  });
  return { level, ms: performance.now() - t0 };
}

if (args.count !== undefined) {
  // ── THE SWEEP ──────────────────────────────────────────────────────────
  const colours = { green: 0, blue: 0, red: 0, black: 0 };
  const courseColours = { green: 0, blue: 0, red: 0, black: 0 };
  const km = { green: 0, blue: 0, red: 0, black: 0, road: 0 };
  const tally = new Map();
  let ok = 0;
  let failed = 0;
  let attempts = 0;
  let msSum = 0;
  let stranded = 0;
  let drags = 0;
  const cures = { turned: 0, lanes: 0, drags: 0, dropped: 0, homeLanes: 0, homeDrags: 0 };
  const tunnels = [];
  console.log(
    "seed     ms try runs lanes courses  G  B  R  K  |  cG cB cR cK  km  fail drag  findings",
  );
  for (let i = 0; i < args.count; i++) {
    const seed = args.from + i;
    let built;
    try {
      built = build(seed);
    } catch (e) {
      failed++;
      console.log(`${String(seed).padStart(4)}  FAILED  ${String(e.message).slice(0, 200)}`);
      continue;
    }
    const { level, ms } = built;
    const a = analyzeResort(level);
    const s = a.stats;
    ok++;
    attempts += level.attempt;
    msSum += ms;
    for (const c of Object.keys(colours)) {
      colours[c] += s.colours[c];
      courseColours[c] += s.courseColours[c];
      km[c] += s.km[c];
    }
    km.road += s.km.road;
    stranded += s.stranded;
    drags += s.drags;
    const area = lastResort();
    if (area) for (const k of Object.keys(cures)) cures[k] += area.cures[k];
    for (const tun of level.resort.tunnels ?? []) tunnels.push(tun);
    for (const fd of a.findings)
      tally.set(`${fd.rule} ${fd.severity}`, (tally.get(`${fd.rule} ${fd.severity}`) ?? 0) + 1);
    const total = Object.values(s.km).reduce((p, v) => p + v, 0);
    console.log(
      `${String(seed).padStart(4)} ${String(Math.round(ms)).padStart(6)} ${String(level.attempt).padStart(3)} ${String(s.runs).padStart(4)} ${String(s.roads).padStart(5)} ${String(s.courses).padStart(7)} ` +
        `${String(s.colours.green).padStart(2)} ${String(s.colours.blue).padStart(2)} ${String(s.colours.red).padStart(2)} ${String(s.colours.black).padStart(2)}  | ` +
        `${String(s.courseColours.green).padStart(3)} ${String(s.courseColours.blue).padStart(2)} ${String(s.courseColours.red).padStart(2)} ${String(s.courseColours.black).padStart(2)} ${f(total, 1).padStart(4)} ` +
        `${String(s.stranded).padStart(5)} ${String(s.drags).padStart(4)}  ` +
        a.findings.map((x) => `${x.severity[0]}:${x.rule} ${x.message}`).join("; "),
    );
  }
  const totalKm = Object.values(km).reduce((p, v) => p + v, 0) || 1;
  console.log("");
  console.log(
    `${ok} built, ${failed} failed, mean ${f(msSum / Math.max(1, ok), 0)} ms, ${attempts} retries`,
  );
  console.log(
    `runs by colour — green ${colours.green} blue ${colours.blue} red ${colours.red} black ${colours.black}; ` +
      `courses — green ${courseColours.green} blue ${courseColours.blue} red ${courseColours.red} black ${courseColours.black}`,
  );
  console.log(
    `km — green ${f(km.green)} (${pct(km.green / totalKm)}) blue ${f(km.blue)} (${pct(km.blue / totalKm)}) ` +
      `red ${f(km.red)} (${pct(km.red / totalKm)}) black ${f(km.black)} (${pct(km.black / totalKm)}) lane ${f(km.road)} (${pct(km.road / totalKm)})`,
  );
  const mean = (xs) => xs.reduce((p, v) => p + v, 0) / Math.max(1, xs.length);
  console.log(
    `access — ${stranded} piste(s) stranded, ${drags} drag lift(s) laid for R29 (${f(drags / Math.max(1, ok), 1)} a resort)`,
  );
  console.log(
    `cures — walks turned off a harder run ${cures.turned}, link lanes ${cures.lanes}, drag lifts ${cures.drags}, ` +
      `pistes left out ${cures.dropped}; the long way home: link lanes ${cures.homeLanes}, drag lifts ${cures.homeDrags}`,
  );
  console.log(
    `wind tunnels — ${tunnels.length}, mean ${f(mean(tunnels.map((x) => x.length)), 0)} m ` +
      `(${f(Math.min(...tunnels.map((x) => x.length)), 0)}–${f(Math.max(...tunnels.map((x) => x.length)), 0)}), ` +
      `${f(mean(tunnels.map((x) => x.speed)), 0)} m/s, ${f(mean(tunnels.map((x) => x.length / x.speed)), 0)} s to cross`,
  );
  console.log(`findings — ${[...tally].map(([k, v]) => `${k}: ${v}`).join(", ") || "none"}`);
  process.exit(failed > 0 ? 1 : 0);
}

// ── ONE RESORT ───────────────────────────────────────────────────────────
const seed = args.seed ?? 1;
const { level, ms } = build(seed);
const resort = analyzeResort(level);
const course = analyzeLevel(level, { network: false });
// The refused walks: the accepted attempt run again with the trace on.
const refused = [];
if (args.walks) {
  const { traceWalks } = await import(join(root, "engine/mapgen/network.ts"));
  const { attemptResort } = await import(join(root, "engine/mapgen/resort-build.ts"));
  const { subSeed } = await import(join(root, "engine/mapgen/generate.ts"));
  const { regionRow } = await import(join(root, "engine/mapgen/regions.ts"));
  const { realFace } = await import(join(root, "engine/mapgen/real-face.ts"));
  traceWalks((spec, points, why) =>
    refused.push({ spec, points: points.map((p) => ({ x: p.x, z: p.z })), why }),
  );
  attemptResort(
    seed,
    level.attempt,
    subSeed(seed, level.attempt),
    regionRow(level.region),
    level.version,
    args.face ? realFace(args.face) : null,
  );
  traceWalks(null);
}
const { realHints } = await import(join(root, "engine/mapgen/real-hints.ts"));
const R = level.resort;
const access = new Map(accessReport(level).runs.map((a) => [a.id, a]));
const out = [];
out.push(
  `resort ${seed} (${args.region}) — built in ${f(ms, 0)} ms (attempt ${level.attempt}), ${level.trees.length} trees, ` +
    `${f(level.mountain.vertical, 0)} m of vertical over a village at ${f(level.mountain.altitude, 0)} m, tree line ${f(level.mountain.treeLine, 0)} m`,
);
out.push("");
out.push("lift  kind      bottom (x, z, y)        top (x, z, y)          rise   length");
for (const l of R.lifts) {
  const len = Math.hypot(l.top.x - l.bottom.x, l.top.z - l.bottom.z, l.top.y - l.bottom.y);
  out.push(
    `${l.id.padEnd(5)} ${l.kind.padEnd(8)} ${f(l.bottom.x, 0).padStart(5)} ${f(l.bottom.z, 0).padStart(5)} ${f(l.bottom.y, 0).padStart(5)}    ` +
      `${f(l.top.x, 0).padStart(5)} ${f(l.top.z, 0).padStart(5)} ${f(l.top.y, 0).padStart(5)}   ${f(l.top.y - l.bottom.y, 0).padStart(5)}  ${f(len, 0).padStart(6)}`,
  );
}
out.push("");
out.push("run  kind   colour  from  length   drop  steepest100  mean  access  ends");
for (const run of R.runs) {
  const p = run.points;
  const drop = p[0].y - p[p.length - 1].y;
  const steep = steepestSpan({ track: run });
  out.push(
    `${run.id.padStart(3)}  ${run.kind.padEnd(5)}  ${run.grade.padEnd(6)}  ${run.from.padEnd(4)}  ${f(run.length, 0).padStart(6)}  ${f(drop, 0).padStart(5)}  ` +
      `${pct(steep).padStart(11)}  ${pct(drop / run.length).padStart(4)}  ${(run.kind === "road" ? "-" : access.get(run.id)?.ok ? "OK" : "NO").padEnd(6)}  ${run.into ? `into ${run.into.run} at ${f(run.into.s, 0)} m` : run.to !== undefined ? `${run.to}'s bottom station` : "the village"}` +
      (run.branch ? `  (off ${run.branch.run} at ${f(run.branch.s, 0)} m)` : "") +
      (access.get(run.id)?.ok === false
        ? `  — ${access.get(run.id).why}`
        : access.get(run.id)?.home > 0
          ? `  (${f(access.get(run.id).home, 0)} m on to a lift)`
          : ""),
  );
}
out.push("");
const hub = R.hub;
if (hub) {
  const depths = hub.top.map((t, i) => hub.bottom[i] - t);
  out.push(
    `hub: x ${f(hub.x0, 0)}–${f(hub.x0 + hub.step * (hub.top.length - 1), 0)}, ` +
      `${f(Math.min(...depths), 0)}–${f(Math.max(...depths), 0)} m deep`,
  );
}
for (const tun of R.tunnels ?? []) {
  const a = tun.points[0];
  const b = tun.points[tun.points.length - 1];
  out.push(
    `tunnel ${tun.id}: ${f(a.x, 0)},${f(a.z, 0)} -> ${f(b.x, 0)},${f(b.z, 0)}  ${f(tun.length, 0)} m, ` +
      `${f(tun.width, 0)} m wide, ${f(tun.speed, 0)} m/s, ${f(tun.length / tun.speed, 0)} s to cross`,
  );
}
out.push("");
out.push("course  colour  length   drop  runs");
for (const c of R.courses) {
  out.push(
    `${c.id.padStart(6)}  ${c.grade.padEnd(6)}  ${f(c.length, 0).padStart(6)}  ${f(c.drop, 0).padStart(5)}  ${c.runs.join(" > ")}${c.id === R.course ? "   <- traced" : ""}`,
  );
}
const s = resort.stats;
out.push("");
out.push(
  `km: green ${f(s.km.green)} blue ${f(s.km.blue)} red ${f(s.km.red)} black ${f(s.km.black)} lane ${f(s.km.road)} · ` +
    `${s.junctions} junction(s), least gap between runs ${f(s.leastGap)} m, steepest lane ${pct(s.roadSteepest)}`,
);
out.push("");
out.push(
  `resort findings: ${resort.findings.map((x) => `${x.severity} ${x.rule} ${x.message}`).join("; ") || "clean"}`,
);
out.push(
  `course ${R.course} findings: ${course.findings.map((x) => `${x.severity} ${x.rule} ${x.message}`).join("; ") || "clean"}`,
);
const text = out.join("\n");
console.log(text);

const stem =
  args.out ??
  `resort-${seed}${args.face ? `-${args.face}` : args.region === "alpine" ? "" : `-${args.region}`}`;
const dir = join(root, "previews");
mkdirSync(dir, { recursive: true });
const title = `RESORT ${seed} ${(args.face ?? args.region).toUpperCase()}  ${R.runs.length} RUNS  ${R.lifts.length} LIFTS  ${R.courses.length} COURSES  COURSE ${R.course} (${level.grade.toUpperCase()})`;
writeFileSync(
  join(dir, `${stem}.png`),
  renderResortPlan({
    level,
    scale: args.scale,
    title,
    refused,
    hubAt,
    failing: new Set([...access.values()].filter((a) => !a.ok).map((a) => a.id)),
    cabins: cabinsOf(level),
    hints: args.hints && level.face ? realHints(level.face) : null,
  }).toPng(),
);
if (refused.length > 0) {
  const tally = new Map();
  for (const r of refused)
    tally.set(
      `${r.spec.id} ${r.why.replace(/[0-9.]+ m/g, "N m")}`,
      (tally.get(`${r.spec.id} ${r.why.replace(/[0-9.]+ m/g, "N m")}`) ?? 0) + 1,
    );
  console.log(
    `\nrefused walks (slot, why, times):\n${[...tally].map(([k, v]) => `  ${k} ×${v}`).join("\n")}`,
  );
}
writeFileSync(join(dir, `${stem}-panorama.png`), renderResortPanorama({ level, title }).toPng());
writeFileSync(
  join(dir, `${stem}-charts.png`),
  renderResortCharts({ level, analysis: resort }).toPng(),
);
writeFileSync(join(dir, `${stem}.txt`), `${text}\n`);
console.log(
  `\nwrote previews/${stem}.png, ${stem}-panorama.png, ${stem}-charts.png and ${stem}.txt`,
);
