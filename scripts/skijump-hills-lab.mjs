#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMPING HILLS LAB (`make skijump-hills`): what the jumping hill
// R43 cuts (`setSkiJump`) makes of a map, measured on the REAL ENGINE in
// Node — the lab ski jumping's own pinned hills (`jump-hills.ts`) were
// chosen with, and the audit they are held to.
//
// A row a map and a hill: the seed in its country, built on today's
// generator (or the pinned row's), the hill set over it, and the ground the
// hill was laid on read against the map's own under it:
//
//   build   the map's build, s (cold: the first build of the seed)
//   tower   how far the start tower's deck stands over the map's ground at
//           the top gate, m — the in-run a structure the higher it is
//   raised  the most the in-run stands over the map's ground anywhere
//           between the top gate and the edge, m — a hollow under the deck
//   dig     the deepest the map's ground is cut down under the raised
//           in-run to the 8° slope it is laid at (`SKI_JUMP_RULE.raised`),
//           m — a hillside the tower is sunk into
//   fill    the most the landing hill (the edge to U) is built up over the
//           map's ground, m, and `cut` the most it is dug into it
//   rms     the landing hill's and out-run's root-mean-square cut and fill,
//           m — how much earth the hill moved
//   arena   the most the ground beside the out-run (where the stadium's
//           stands go, 20–40 m off the axis) lies off its level, m
//   drop    the drop from the top gate to the fall line, m
//   bot     the bot's jump in the contest's first round on the hill's own
//           air, m (`--bot`; a few seconds a row), and `pts` its points
//
// THE SWEEP is `--seeds` × `--regions` (`--hill` the class); `--pinned`
// audits the committed hills instead (each on its own version, hill and
// country, the map's digest and the hill's it builds beside the row's). Rows are sorted by the
// earth moved (rms, then the arena, then the trestles). Deterministic.
//
//   node scripts/skijump-hills-lab.mjs --seeds=1-40 --regions=alpine,fell
//   node scripts/skijump-hills-lab.mjs --seeds=41-60 --hill=normal --bot
//   node scripts/skijump-hills-lab.mjs --pinned --bot
//   node scripts/skijump-hills-lab.mjs --pinned --json=previews/hills.json

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = parseArgs(
  process.argv.slice(2),
  {
    seeds: {
      kind: "string",
      default: "1-12",
      help: "the seeds swept: a list (3,7) or a range (1-40)",
    },
    regions: {
      kind: "string",
      default: "alpine",
      help: "the countries swept (alpine, fell, continental, maritime), comma-separated",
    },
    hill: { kind: "string", default: "large", help: "the hill swept (large, normal)" },
    pinned: { kind: "flag", help: "audit the committed hills (jump-hills.ts) instead of a sweep" },
    bot: { kind: "flag", help: "jump each hill with the bot in a contest's first round" },
    json: { kind: "string", default: "", help: "write the rows as JSON to this file" },
  },
  "usage: node scripts/skijump-hills-lab.mjs [--seeds=1-12] [--regions=alpine] [--hill=large] [--pinned] [--bot] [--json=file]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const { JUMP_HILLS, buildJumpHill } = await import(join(root, "pwa/src/game/jump-hills.ts"));

if (args.hill !== "large" && args.hill !== "normal") {
  console.error(`unknown hill "${args.hill}" (large, normal)`);
  process.exit(2);
}

function seedList(text) {
  const out = [];
  for (const part of text.split(",")) {
    const [a, b] = part.split("-").map(Number);
    if (!Number.isInteger(a) || (b !== undefined && !Number.isInteger(b))) {
      console.error(`bad seeds "${text}"`);
      process.exit(2);
    }
    for (let s = a; s <= (b ?? a); s++) out.push(s);
  }
  return out;
}

/** The candidates: the sweep's, or the pinned rows'. */
const candidates = args.pinned
  ? JUMP_HILLS.map((row) => ({
      id: row.id,
      seed: row.seed,
      region: row.region ?? "alpine",
      hill: row.hill,
      build: () => buildJumpHill(row),
      digest: row.digest,
      hillDigest: row.hillDigest,
    }))
  : seedList(args.seeds).flatMap((seed) =>
      args.regions.split(",").map((region) => {
        if (!E.REGION_IDS.includes(region)) {
          console.error(`unknown region "${region}"`);
          process.exit(2);
        }
        return {
          id: "",
          seed,
          region,
          hill: args.hill,
          build: () =>
            E.generateLevel(seed, {
              version: E.CURRENT_GENERATOR_VERSION,
              region: region === "alpine" ? undefined : region,
            }),
        };
      }),
    );

const R = E.SKI_JUMP_RULE;

/** What the hill set over `map` did to its ground. */
function measure(map, hillId) {
  const level = E.setSkiJump(map, hillId);
  const hill = level.skiJump;
  const base = hill.base;
  const pts = level.track.points;
  const p0 = pts[0];
  const p1 = pts[pts.length - 1];
  const len = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  const fx = (p1.x - p0.x) / len;
  const fz = (p1.z - p0.z) / len;
  const at = (d, across = 0) => ({
    x: p0.x + fx * (d - p0.s) + fz * across,
    z: p0.z + fz * (d - p0.s) - fx * across,
  });
  const over = (d) => {
    const q = at(d);
    return hill.yAt(d) - base.groundAt(q.x, q.z);
  };
  let raised = 0;
  let dig = 0;
  const rise = Math.tan((R.raised.slope * Math.PI) / 180);
  for (let d = hill.from; d <= hill.edge; d += 1) {
    raised = Math.max(raised, over(d));
    const q = at(d);
    const under = hill.yAt(hill.edge) - hill.lip + (hill.edge - d) * rise;
    dig = Math.max(dig, base.groundAt(q.x, q.z) - under);
  }
  let fill = 0;
  let cut = 0;
  let sq = 0;
  let n = 0;
  for (let d = hill.edge + 1; d <= hill.outrun; d += 1) {
    const e = over(d);
    if (d <= hill.u) {
      fill = Math.max(fill, e);
      cut = Math.max(cut, -e);
    }
    sq += e * e;
    n += 1;
  }
  let arena = 0;
  const half = R.width / 2;
  for (let d = hill.u; d <= hill.outrun; d += 4) {
    for (const off of [half + 20, half + 30, half + 40]) {
      for (const side of [-1, 1]) {
        const q = at(d, side * off);
        arena = Math.max(arena, Math.abs(base.groundAt(q.x, q.z) - hill.yAt(hill.outrun)));
      }
    }
  }
  return {
    level,
    tower: over(hill.from),
    raised,
    dig,
    fill,
    cut,
    rms: Math.sqrt(sq / Math.max(1, n)),
    arena,
    drop: hill.vertical,
  };
}

/** The bot's jump in the first round of a contest dealt off the seed. */
function botJump(map, seed, hillId) {
  const report = E.simulateRun(seed, {
    level: map,
    mode: "skiJump",
    hill: hillId,
    spec: E.SKI_CATALOG.find((s) => s.id === "albatross"),
    keepEvents: true,
  });
  const touch = report.events.find((e) => e.kind === "skiJump" && e.stage === "touch");
  return { dist: touch?.distance ?? 0, pts: report.score ?? 0, out: report.out };
}

const rows = [];
for (const c of candidates) {
  const t0 = performance.now();
  let map;
  try {
    map = c.build();
  } catch (err) {
    console.error(`seed ${c.seed} ${c.region}: ${err.message}`);
    continue;
  }
  const build = (performance.now() - t0) / 1000;
  const m = measure(map, c.hill);
  const row = {
    id: c.id,
    seed: c.seed,
    region: c.region,
    hill: c.hill,
    build,
    attempt: map.attempt ?? 0,
    digest: E.levelDigest(map),
    pinned: c.digest ?? null,
    hillDigest: E.levelDigest(m.level),
    hillPinned: c.hillDigest ?? null,
    tower: m.tower,
    raised: m.raised,
    dig: m.dig,
    fill: m.fill,
    cut: m.cut,
    rms: m.rms,
    arena: m.arena,
    drop: m.drop,
    weather: E.weatherOf(map).kind,
    hour: map.sun.hour,
  };
  if (args.bot) Object.assign(row, botJump(map, c.seed, c.hill));
  rows.push(row);
  // Each row as it comes, so a long sweep cut short keeps what it measured.
  process.stderr.write(`${JSON.stringify(row)}\n`);
}

rows.sort((a, b) => a.rms - b.rms || a.arena - b.arena || a.raised - b.raised);
const f = (v, w, d = 1) => (typeof v === "number" ? v.toFixed(d) : String(v)).padStart(w);
const head = [
  "id".padEnd(10),
  "seed".padStart(4),
  "country".padEnd(11),
  "hill".padEnd(6),
  "build".padStart(5),
  "att".padStart(3),
  "tower".padStart(6),
  "raised".padStart(6),
  "dig".padStart(5),
  "fill".padStart(5),
  "cut".padStart(5),
  "rms".padStart(5),
  "arena".padStart(5),
  "drop".padStart(5),
  "sky".padEnd(9),
  args.bot ? "bot".padStart(6) + "pts".padStart(7) : "",
  "digest  hill",
].join(" ");
console.log(`ski jumping hills — ${args.pinned ? "the pinned hills" : "the sweep"}`);
console.log(head);
for (const r of rows) {
  console.log(
    [
      r.id.padEnd(10),
      f(r.seed, 4, 0),
      r.region.padEnd(11),
      r.hill.padEnd(6),
      f(r.build, 5),
      f(r.attempt, 3, 0),
      f(r.tower, 6),
      f(r.raised, 6),
      f(r.dig, 5),
      f(r.fill, 5),
      f(r.cut, 5),
      f(r.rms, 5),
      f(r.arena, 5),
      f(r.drop, 5, 0),
      `${r.weather}@${r.hour.toFixed(0)}`.padEnd(9),
      args.bot ? f(r.dist, 6) + f(r.pts, 7) + (r.out ? ` ${r.out}` : "") : "",
      r.pinned && r.pinned !== r.digest ? `${r.digest} (pinned ${r.pinned})` : r.digest,
      r.hillPinned && r.hillPinned !== r.hillDigest
        ? `${r.hillDigest} (pinned ${r.hillPinned})`
        : r.hillDigest,
    ].join(" "),
  );
}
if (args.json) {
  writeFileSync(args.json, JSON.stringify(rows, null, 2));
  console.log(`wrote ${args.json}`);
}
if (args.pinned && rows.some((r) => r.pinned !== r.digest || r.hillPinned !== r.hillDigest)) {
  process.exit(1);
}
