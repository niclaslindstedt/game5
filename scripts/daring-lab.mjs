#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DARING LAB (`make daring`): the menu's backdrop as the daring bot
// rides it — a SHOWCASE (`engine/sim/showcase.ts`: no course, no field,
// every trick his) skied for a span of seconds on each seed's mountain,
// stood up again at the top every time the restart rule says, by the REAL
// ENGINE, pure Node. Each seed is ridden twice on the same rules and pair:
// by the plain rider (`RIDER_BOT`, the before) and by the daring one
// (`DARING_BOT`, the knob on). One row a ride: the flights and their air,
// the longest and the highest, the tricks turned and the combos banked and
// lost, the wipeouts, the share of his time on the snow off the piste, the
// top speed and why each run ended.
//
//   node scripts/daring-lab.mjs [--seeds=1-8] [--seconds=180] [--only=daring] [--json=FILE] [--compare=FILE]

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    seeds: { kind: "string", default: "1-8", help: "the seeds, a range (1-8) or a list (3,7,38)" },
    seconds: { kind: "number", default: 180, help: "how long each seed is ridden, s" },
    only: { kind: "string", default: "", help: "ride one profile alone: rider or daring" },
    json: { kind: "string", default: "", help: "write the rows to this file" },
    compare: { kind: "string", default: "", help: "a kept --json to print beside this run" },
  },
  "usage: node scripts/daring-lab.mjs [--seeds=1-8] [--seconds=180] [--only=daring] [--json=FILE] [--compare=FILE]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));

function seedList(text) {
  const out = [];
  for (const part of text.split(",")) {
    const [a, b] = part.split("-").map(Number);
    for (let s = a; s <= (b ?? a); s++) out.push(s);
  }
  return out;
}

const profiles = [
  ["rider", E.RIDER_BOT],
  ["daring", E.DARING_BOT],
].filter(([id]) => !args.only || args.only === id);
const kept = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const was = new Map((kept ?? []).map((r) => [`${r.seed}:${r.bot}`, r]));

const pad = (s, n) => String(s).padStart(n);
const head =
  "seed bot     flights  air s  long s  high m  tricks flip spin grab  banked bailed  wipe  off%  top km/h  ends (bottom/stalled/long)";
console.log(head);
const rows = [];
const sums = new Map();
for (const seed of seedList(args.seeds)) {
  const level = E.levelFor({ seed, quiet: true });
  for (const [bot, profile] of profiles) {
    const r = E.rideShowcase(level, args.seconds, profile);
    const row = { seed, bot, ...r };
    rows.push(row);
    const sum = sums.get(bot) ?? { n: 0 };
    for (const k of Object.keys(r)) if (typeof r[k] === "number") sum[k] = (sum[k] ?? 0) + r[k];
    sum.longestMax = Math.max(sum.longestMax ?? 0, r.longest);
    sum.highestMax = Math.max(sum.highestMax ?? 0, r.highest);
    sum.n++;
    sums.set(bot, sum);
    const line = (x) =>
      `${pad(x.seed, 4)} ${x.bot.padEnd(7)} ${pad(x.flights, 7)} ${pad(x.airtime.toFixed(1), 6)} ${pad(x.longest.toFixed(2), 7)} ${pad(x.highest.toFixed(1), 7)} ${pad(x.tricks, 7)} ${pad(x.flips, 4)} ${pad(x.spins, 4)} ${pad(x.grabs, 4)} ${pad(x.banked, 7)} ${pad(x.bailed, 6)} ${pad(x.wipeouts, 5)} ${pad((x.offPiste * 100).toFixed(0), 5)} ${pad((x.top * 3.6).toFixed(0), 9)}  ${x.ends.bottom}/${x.ends.stalled}/${x.ends.long}`;
    console.log(line(row));
    const before = was.get(`${seed}:${bot}`);
    if (before) console.log(`${line(before)}  (kept)`);
  }
}
console.log("");
for (const [bot, s] of sums) {
  const n = s.n;
  console.log(
    `${bot.padEnd(7)} over ${n} seeds × ${args.seconds} s: ${(s.flights / n).toFixed(1)} flights, ${(s.airtime / n).toFixed(1)} s air, longest ${s.longestMax.toFixed(2)} s, highest ${s.highestMax.toFixed(1)} m, ${(s.tricks / n).toFixed(1)} tricks (${(s.flips / n).toFixed(1)} flips), ${(s.banked / n).toFixed(1)} banked / ${(s.bailed / n).toFixed(1)} lost, ${(s.wipeouts / n).toFixed(1)} wipeouts, ${((s.offPiste / n) * 100).toFixed(0)}% off piste, top ${((s.top / n) * 3.6).toFixed(0)} km/h (mean) — a seed`,
  );
}
if (args.json) writeFileSync(args.json, JSON.stringify(rows, null, 1));
