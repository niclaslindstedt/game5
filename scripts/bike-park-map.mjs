#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE PARK LAB (R44, R45) — a summer ski area's bike park drawn and
// described from nothing but the engine, the way `make level` reasons about
// one mountain without riding it.
//
// One seed: THE PLAN (the mountain in summer, the lifts, every trail in its
// grade's colour, its features marked and labelled, the race line taped,
// the junctions ringed), THE PROFILES (every trail's tread down its length
// over the ground it is benched into), and a table a trail — its grade,
// lift, length, drop, mean and steepest grade, cut, width, woods and its
// features by kind — with the analyzer's findings under it.
//
// A sweep (`--count`): one row a seed — the trails by grade, the race
// line's length and drop, the time it took, the findings.
//
//   npm run bike-park -- --seed 7                  # previews/bike-park-7*.png + .txt
//   npm run bike-park -- --seed 7 --region fell
//   npm run bike-park -- --face alpine-1
//   npm run bike-park -- --count 24
//
// Engine only: no three.js, no browser, no build.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { renderBikePlan, renderBikeProfiles } from "./lib/bike-park-draw.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mapgen = await import(join(root, "engine/mapgen/index.ts"));
const { setBikePark, traceBikePark } = await import(join(root, "engine/mapgen/bike-park.ts"));
const { treadAt } = await import(join(root, "engine/mapgen/bike-surface.ts"));
const { analyzeBikePark } = await import(join(root, "engine/analysis/bike-park.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", help: "draw and list this one seed's park" },
    from: { kind: "number", default: 1, help: "first seed of a sweep" },
    count: { kind: "number", help: "sweep this many seeds instead of drawing one" },
    region: { kind: "string", default: "alpine", help: "alpine, fell, continental, maritime" },
    face: { kind: "string", help: "raise the mountain on a REAL face: alpine-1, fell-3, …" },
    scale: { kind: "number", default: 0.7, help: "plan pixels per metre" },
    zoom: { kind: "string", help: "also draw a close plan round x,z (m) at 4 px/m: '1900,2100'" },
    trace: { kind: "flag", help: "print every try of every slot and why it was refused" },
    out: { kind: "string", help: "file stem under previews/ (no extension)" },
  },
  "usage: npm run bike-park -- (--seed n | --count k [--from n]) [--region id] [--face id]",
);
if (args.face) await mapgen.loadRealFace(args.face);
if (args.trace) traceBikePark((line) => console.log(`  · ${line}`));

const f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "-");
const pc = (v) => `${(v * 100).toFixed(1)}%`;

function build(seed) {
  const level = mapgen.generateLevel(seed, { region: args.region, face: args.face });
  const t0 = performance.now();
  const summer = setBikePark(level);
  return { level: summer, ms: performance.now() - t0 };
}

if (args.count !== undefined) {
  console.log("seed    ms  G B R K  DH(m/drop)        findings");
  let bad = 0;
  for (let i = 0; i < args.count; i++) {
    const seed = args.from + i;
    const { level, ms } = build(seed);
    const park = level.bikePark;
    const a = analyzeBikePark(level);
    const n = { green: 0, blue: 0, red: 0, black: 0 };
    for (const t of park?.trails ?? []) if (t.kind === "trail") n[t.grade]++;
    const race = park?.trails.find((t) => t.kind === "race");
    if (!a.ok || !park) bad++;
    console.log(
      `${String(seed).padStart(4)} ${String(Math.round(ms)).padStart(5)}  ${n.green} ${n.blue} ${n.red} ${n.black}  ` +
        `${race ? `${f(race.length - race.start, 0)}/${f(race.points.find((p) => p.s >= race.start).y - race.points.at(-1).y, 0)}` : "-"}`.padEnd(
          18,
        ) +
        (park
          ? a.findings.map((x) => `${x.severity[0]}:${x.rule} ${x.message}`).join("; ")
          : "NO PARK"),
    );
  }
  process.exit(bad > 0 ? 1 : 0);
}

const seed = args.seed ?? 7;
const { level, ms } = build(seed);
const park = level.bikePark;
const stem = join(
  root,
  "previews",
  args.out ?? `bike-park-${args.face ?? seed}${args.region !== "alpine" ? `-${args.region}` : ""}`,
);
mkdirSync(dirname(stem), { recursive: true });
if (!park) {
  console.log(`seed ${seed}: no bike park (no lift carries bikes)`);
  process.exit(1);
}
const a = analyzeBikePark(level);
const lines = [];
lines.push(
  `BIKE PARK — seed ${seed}${args.face ? ` face ${args.face}` : ""} ${args.region}, laid in ${f(ms, 0)} ms`,
);
lines.push(
  `lifts carrying bikes: ${park.aprons.map((x) => `${x.lift} (${x.heads.length} heads)`).join(", ")}`,
);
lines.push("");
lines.push(
  "trail grade  lift tread   length  drop   mean  steep   cut  width      woods  features",
);
for (const m of a.trails) {
  const t = park.trails.find((x) => x.id === m.id);
  lines.push(
    `${m.id.padEnd(5)} ${(m.grade + (m.kind === "race" ? "*" : "")).padEnd(6)} ${t.lift.padEnd(4)} ${t.tread.padEnd(6)} ` +
      `${f(m.length, 0).padStart(6)} ${f(m.vertical, 0).padStart(5)} ${pc(m.mean).padStart(6)} ${pc(m.steepest).padStart(6)} ` +
      `${f(m.cut, 1).padStart(5)}  ${f(m.narrowest, 1)}–${f(m.widest, 1)}  ${pc(m.woods).padStart(6)}  ` +
      Object.entries(m.features)
        .map(([k, v]) => `${k} ${v}`)
        .join(", "),
  );
}
const race = park.trails.find((t) => t.kind === "race");
if (race) {
  const from = race.points.find((p) => p.s >= race.start);
  lines.push("");
  lines.push(
    `race line ${race.id}: start ${f(race.start, 0)} m down its line, ${f(race.length - race.start, 0)} m to the finish, ` +
      `${f(from.y - race.points.at(-1).y, 0)} m of drop`,
  );
}
lines.push("");
lines.push(`junctions: ${park.junctions.length}`);
lines.push(`findings: ${a.findings.length === 0 ? "none" : ""}`);
for (const x of a.findings) lines.push(`  ${x.severity} ${x.rule} ${x.message}`);
lines.push("");
lines.push("features (id kind from–to height):");
for (const t of park.trails) {
  const hard = t.features.filter(
    (x) => x.kind !== "berm" && x.kind !== "roller" && x.kind !== "dip",
  );
  lines.push(
    `  ${t.id}: ${hard.map((x) => `${x.id.split("-")[1]} ${x.kind} ${f(x.from, 0)}–${f(x.to, 0)} ${f(x.height, 2)}`).join("; ")}`,
  );
}
const text = lines.join("\n");
console.log(text);
writeFileSync(`${stem}.txt`, text + "\n");
const plan = renderBikePlan({
  level,
  park,
  scale: args.scale,
  title: `BIKE PARK ${args.face ?? seed}`,
  labels: args.scale >= 0.6,
});
writeFileSync(`${stem}.png`, plan.toPng());
writeFileSync(`${stem}-profiles.png`, renderBikeProfiles({ park, treadAt }).toPng());
if (args.zoom) {
  const [zx, zz] = args.zoom.split(",").map(Number);
  const box = { x0: zx - 120, z0: zz - 90, x1: zx + 120, z1: zz + 90 };
  writeFileSync(
    `${stem}-zoom.png`,
    renderBikePlan({ level, park, scale: 4, box, title: `ZOOM ${zx},${zz}` }).toPng(),
  );
}
console.log(`\nwrote ${stem}.png, ${stem}-profiles.png, ${stem}.txt`);
