#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CHALLENGES LAB — what a free ride map deals (`engine/game/challenges/`)
// and how the bot does at its timed lines. One map (a seed, or a real face)
// or a sweep of seeds: every challenge listed, and every LINE skied by the
// bot from above its start gate, judged by the challenges' own judge. One
// row a line: its run and colour, its length and drop, its par, its bronze,
// silver and gold times, the bot's time, the share of par it took and the
// medal it earned. The medals are shares of par (`CHALLENGES.medals`); this
// is the table they are calibrated by — a competent bot lands mostly silver,
// sometimes gold, never off the table. Pure Node over the engine.
//
//   node scripts/challenges-lab.mjs --seed=38
//   node scripts/challenges-lab.mjs --count=8
//   node scripts/challenges-lab.mjs --face=alpine-1
//   node scripts/challenges-lab.mjs --seed=38 --no-ski

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const E = await import(join(root, "engine/index.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", help: "deal and ski this one seed" },
    from: { kind: "number", default: 1, help: "first seed of a sweep" },
    count: { kind: "number", help: "sweep this many seeds instead of one" },
    region: {
      kind: "string",
      help: "the kind of snow country (R21): alpine, fell, continental, maritime",
    },
    face: { kind: "string", help: "raise the map on this real face (e.g. alpine-1)" },
    grade: { kind: "string", help: "the course the map is stood up on (the plan must not care)" },
    "no-ski": { kind: "flag", help: "list the challenges only; ski no line" },
    json: { kind: "string", help: "write every row to this JSON file" },
  },
  "challenges-lab — what a free ride map deals, and the bot down its timed lines",
);

const seeds =
  args.count !== undefined
    ? Array.from({ length: args.count }, (_, i) => args.from + i)
    : [args.seed ?? 38];

const pad = (v, n) => String(v).padStart(n);
const padR = (v, n) => String(v).padEnd(n);
const f1 = (v) => (v === null || v === undefined ? "—" : v.toFixed(1));

const rows = [];
for (const seed of seeds) {
  if (args.face) await E.loadRealFace(args.face);
  const level = E.generateLevel(seed, {
    ...(args.region ? { region: args.region } : {}),
    ...(args.face ? { face: args.face } : {}),
    ...(args.grade ? { grade: args.grade } : {}),
  });
  const plan = E.dealChallenges(level);
  console.log(
    `\n${plan.key} — ${plan.challenges.length} challenges (course ${level.resort?.course}, ${level.grade})`,
  );
  for (const c of plan.challenges) {
    if (E.isTrick(c)) {
      const g = c.goals;
      const w = (t) => `${t.spin}${t.flips ? `+${t.flips}F` : ""}${t.grab ? "+grab" : ""}`;
      console.log(
        `  ${padR(c.id, 22)} ${c.size} h${c.kicker.height.toFixed(1)} run ${c.run ?? "off"}: air / ${w(g.silver)} / ${w(g.gold)}`,
      );
    } else if (E.isSpots(c)) {
      console.log(
        `  ${padR(c.id, 22)} ${c.spots.map((s) => `${s.what}@${Math.round(s.x)},${Math.round(s.z)}`).join(" ")}  medals ${c.medals.bronze}/${c.medals.silver}/${c.medals.gold}`,
      );
    } else if (E.isSummits(c)) {
      console.log(
        `  ${padR(c.id, 22)} ${c.tops.map((t) => t.lift).join(" ")}  medals ${c.medals.bronze}/${c.medals.silver}/${c.medals.gold}`,
      );
    }
  }
  console.log(
    `  ${padR("line", 16)} ${padR("grade", 7)} ${pad("len", 5)} ${pad("drop", 5)} ${pad("par", 6)} ${pad("gold", 6)} ${pad("silv", 6)} ${pad("brnz", 6)} ${pad("bot", 6)} ${pad("/par", 5)} medal`,
  );
  for (const c of plan.challenges) {
    if (!E.isLine(c)) continue;
    const skied = args["no-ski"] ? null : E.skiLine(level, c);
    const row = {
      seed,
      key: plan.key,
      id: c.id,
      grade: c.grade,
      length: c.length,
      drop: c.drop,
      par: c.par,
      medals: c.medals,
      bot: skied?.time ?? null,
      medal: skied?.medal ?? null,
      why: skied?.why ?? null,
    };
    rows.push(row);
    console.log(
      `  ${padR(c.id, 16)} ${padR(c.grade, 7)} ${pad(Math.round(c.length), 5)} ${pad(Math.round(c.drop), 5)} ${pad(f1(c.par), 6)} ${pad(f1(c.medals.gold), 6)} ${pad(f1(c.medals.silver), 6)} ${pad(f1(c.medals.bronze), 6)} ${pad(f1(row.bot), 6)} ${pad(row.bot ? (row.bot / c.par).toFixed(2) : "—", 5)} ${row.medal ?? (skied ? (row.why ?? "none") : "")}`,
    );
  }
}

const skied = rows.filter((r) => r.bot !== null);
if (skied.length > 0) {
  const ratios = skied.map((r) => r.bot / r.par).sort((a, b) => a - b);
  const count = (m) => rows.filter((r) => r.medal === m).length;
  console.log(
    `\n${rows.length} lines: gold ${count("gold")}, silver ${count("silver")}, bronze ${count("bronze")}, none ${rows.filter((r) => r.bot !== null && r.medal === null).length}, void ${rows.length - skied.length}` +
      ` — bot/par ${ratios[0].toFixed(2)}…${ratios[ratios.length - 1].toFixed(2)}, median ${ratios[Math.floor(ratios.length / 2)].toFixed(2)}`,
  );
}
if (args.json) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(args.json, JSON.stringify(rows, null, 2));
}
