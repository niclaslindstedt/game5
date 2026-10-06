#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BALANCE TABLE: the bot skis generated maps through the REAL engine —
// createGame, step, botInput — with no renderer attached, and prints what
// happened per seed. This is the measuring stick for every ski, snow, bot
// and generator change: run it before and after, read the diff, paste both
// tables in the PR (docs/simulation.md says what every column means and
// which movements are regressions).
//
//   npm run sim                          seeds 1..8, solo, top to bottom
//   npm run sim -- --count 20            seeds 1..20
//   npm run sim -- --seeds 3,7,38        specific seeds
//   npm run sim -- --rivals 3            a whole race, the bot on the grid's first slot
//   npm run sim -- --skis eagle          one pair of the catalog
//   npm run sim -- --rider heavy         the skier of another build (defs/riders.ts)
//   npm run sim -- --skis all            the whole catalog, seed by seed, and who won each
//   npm run sim -- --tricks              the maps with their trick field laid (R20)
//   npm run sim -- --laps 1 --json out.json
//
// Exits non-zero when the bot finishes NO seed at all — a skier that cannot
// get down any map is broken, not slow — and prints the
// digests, which are where a determinism regression shows first.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const {
  simulateRun,
  SIM_SECONDS,
  engineVersion,
  TUNING,
  SKI_CATALOG,
  isSkiId,
  RIDERS,
  isRiderId,
  riderById,
  withRider,
  isRegionId,
  REGION_IDS,
  isPisteGrade,
  PISTE_GRADES,
  WEATHER_KINDS,
} = await import(join(root, "engine/index.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    count: { kind: "number", default: 8, help: "ride seeds 1..count" },
    seeds: { kind: "list", help: "seeds to ride instead, comma-separated" },
    laps: { kind: "number", help: "runs to the finish (the map's one when left out)" },
    rivals: { kind: "number", default: 0, help: "rivals on the grid beside the bot" },
    max: { kind: "number", default: SIM_SECONDS, help: "give up after this much race time, s" },
    skis: {
      kind: "string",
      default: SKI_CATALOG[0].id,
      help: `the pair (${SKI_CATALOG.map((s) => s.id).join(", ")}), or all for the catalog`,
    },
    rider: {
      kind: "string",
      default: "medium",
      help: `the skier's build (${RIDERS.map((r) => r.id).join(", ")})`,
    },
    tricks: { kind: "flag", help: "ride each seed's map with its trick field laid (R20)" },
    "no-poles": { kind: "flag", help: "the bot skis without poles (the player's hard mode)" },
    region: {
      kind: "string",
      default: "alpine",
      help: `the kind of snow country each map is built in (R21: ${REGION_IDS.join(", ")})`,
    },
    grade: {
      kind: "string",
      help: `the piste grade each map is built to (R23: ${PISTE_GRADES.join(", ")}); the seed's own when left out`,
    },
    weather: {
      kind: "string",
      help: `ski every map under this sky (R19: ${WEATHER_KINDS.join(", ")}); the seed's own when left out`,
    },
    mode: {
      kind: "string",
      help: "race a discipline: slalom (R31), downhill (R32), superG (R33), giantSlalom (R36, its first run), speedSki (R34, its qualification; time is through the timing zone) or skiCross (R35, its qualification; --heat for a heat of four), bigAir (R37, a contest's first jump), knuckleHuck (R38, a whole jam to the buzzer), slopestyle (R39, a contest's first run), railJam (R40, a whole jam to the buzzer) or halfpipe (R41, a contest's first run) — its course set over each seed's map under the strict gates; the open rules when left out",
    },
    heat: {
      kind: "flag",
      help: "on --mode skiCross, ski a heat of four out of the start gate, the field skied beside the bot (R35)",
    },
    json: { kind: "string", help: "also write the rows (events dropped) to this file" },
  },
  "usage: npm run sim -- [--count n | --seeds a,b,c] [--skis id|all] [--rider id] [--laps n] [--rivals n] [--max s] [--tricks] [--no-poles] [--region id] [--grade id] [--weather kind] [--mode slalom|giantSlalom|downhill|superG|speedSki|skiCross|bigAir|knuckleHuck|slopestyle|railJam|halfpipe] [--heat] [--json path]",
);

if (args.grade !== undefined && !isPisteGrade(args.grade)) {
  console.error(`unknown grade "${args.grade}" (${PISTE_GRADES.join(", ")})`);
  process.exit(2);
}

if (
  args.mode !== undefined &&
  ![
    "slalom",
    "giantSlalom",
    "downhill",
    "superG",
    "speedSki",
    "skiCross",
    "bigAir",
    "knuckleHuck",
    "slopestyle",
    "railJam",
    "halfpipe",
  ].includes(args.mode)
) {
  console.error(
    `unknown mode "${args.mode}" (slalom, giantSlalom, downhill, superG, speedSki, skiCross, bigAir, knuckleHuck, slopestyle, railJam, halfpipe)`,
  );
  process.exit(2);
}

if (args.weather !== undefined && !WEATHER_KINDS.includes(args.weather)) {
  console.error(`unknown weather "${args.weather}" (${WEATHER_KINDS.join(", ")})`);
  process.exit(2);
}

if (!isRegionId(args.region)) {
  console.error(`unknown region "${args.region}" (${REGION_IDS.join(", ")})`);
  process.exit(2);
}

if (args.skis !== "all" && !isSkiId(args.skis)) {
  console.error(`unknown skis "${args.skis}" (${SKI_CATALOG.map((s) => s.id).join(", ")}, all)`);
  process.exit(2);
}
if (!isRiderId(args.rider)) {
  console.error(`unknown rider "${args.rider}" (${RIDERS.map((r) => r.id).join(", ")})`);
  process.exit(2);
}
const roster = (
  args.skis === "all" ? SKI_CATALOG : SKI_CATALOG.filter((s) => s.id === args.skis)
).map((s) => withRider(s, riderById(args.rider)));

const seeds = args.seeds
  ? args.seeds.map(Number)
  : Array.from({ length: Math.max(1, args.count) }, (_, i) => i + 1);
if (seeds.some((s) => !Number.isInteger(s))) {
  console.error(`--seeds wants integers, got ${args.seeds.join(",")}`);
  process.exit(2);
}

const pad = (v, n) => String(v).padStart(n);
const kmh = (ms) => (ms * 3.6).toFixed(0);

console.log(
  `sim — engine ${engineVersion} at ${TUNING.physicsHz} Hz · skis ${args.skis} · seeds ${seeds.join(",")} · ` +
    `laps ${args.laps ?? "map"} · rivals ${args.rivals} · max ${args.max} s` +
    (args.rider !== "medium" ? ` · rider ${args.rider}` : "") +
    (args.tricks ? " · trick field" : "") +
    (args["no-poles"] ? " · no poles" : "") +
    (args.region !== "alpine" ? ` · ${args.region}` : "") +
    (args.grade ? ` · ${args.grade}` : "") +
    (args.weather ? ` · ${args.weather}` : "") +
    (args.mode ? ` · ${args.mode}` : ""),
);
const header = [
  pad("seed", 5),
  pad("fin", 4),
  pad("time", 7),
  pad("splits", 17),
  pad("cps", 7),
  pad("len", 6),
  pad("pow", 4),
  pad("grade", 6),
  pad("mean", 5),
  pad("top", 5),
  pad("air", 5),
  pad("best", 5),
  pad("jmp", 4),
  pad("hrsh", 4),
  pad("tree", 4),
  pad("wipe", 4),
  pad("rst", 4),
  pad("auto", 4),
  pad("miss", 4),
  pad("plc", 4),
  pad("score", 6),
  pad("digest", 9),
  // A discipline's run: the speed trap and how it went out of the race.
  ...(args.mode ? [pad("trap", 5), " out"] : []),
].join(" ");

const rows = [];
for (const spec of roster) {
  if (roster.length > 1) console.log(`\n${spec.name}`);
  console.log(header);
  for (const seed of seeds) {
    const r = simulateRun(seed, {
      laps: args.laps,
      rivals: args.rivals,
      maxSeconds: args.max,
      spec,
      tricks: args.tricks,
      poles: !args["no-poles"],
      region: args.region === "alpine" ? undefined : args.region,
      grade: args.grade,
      weather: args.weather,
      mode: args.mode,
      heat: args.heat,
    });
    rows.push(r);
    console.log(
      [
        pad(seed, 5),
        pad(r.finished ? "yes" : "NO", 4),
        pad(r.time.toFixed(1), 7),
        pad(r.lapTimes.map((t) => t.toFixed(0)).join("/") || "-", 17),
        pad(`${r.checkpoints}/${r.crossings}`, 7),
        pad(r.trackLength.toFixed(0), 6),
        pad(`${Math.round(r.powder * 100)}%`, 4),
        pad(r.grade, 6),
        pad(kmh(r.meanSpeed), 5),
        pad(kmh(r.topSpeed), 5),
        pad(r.airTime.toFixed(1), 5),
        pad(r.bestAir.toFixed(1), 5),
        pad(r.jumps, 4),
        pad(r.harshLandings, 4),
        pad(r.treeHits, 4),
        pad(r.wipeouts, 4),
        pad(r.resets, 4),
        pad(r.autoResets, 4),
        pad(r.missed, 4),
        pad(r.place, 4),
        pad(r.score, 6),
        pad(r.digest, 9),
        ...(args.mode ? [pad(r.trap === null ? "-" : kmh(r.trap), 5), ` ${r.out ?? "-"}`] : []),
      ].join(" "),
    );
  }
}

// THE CATALOG, SEED BY SEED: every pair's time on each map and which one
// was quickest — the table that says whether any pair is best everywhere.
if (roster.length > 1) {
  console.log(`\ncatalog — run time, s (* the quickest on the seed)`);
  console.log([pad("seed", 5), pad("pow", 4), ...roster.map((s) => pad(s.id, 10))].join(" "));
  const wins = new Map(roster.map((s) => [s.id, 0]));
  for (const seed of seeds) {
    const mine = rows.filter((r) => r.seed === seed);
    const best = Math.min(...mine.filter((r) => r.finished).map((r) => r.time));
    const cells = roster.map((s) => {
      const r = mine.find((m) => m.skis === s.id);
      if (!r.finished) return pad("DNF", 10);
      if (r.time === best) wins.set(s.id, wins.get(s.id) + 1);
      return pad(`${r.time.toFixed(1)}${r.time === best ? "*" : " "}`, 10);
    });
    console.log([pad(seed, 5), pad(`${Math.round(mine[0].powder * 100)}%`, 4), ...cells].join(" "));
  }
  console.log(
    [pad("wins", 5), pad("", 4), ...roster.map((s) => pad(`${wins.get(s.id)} `, 10))].join(" "),
  );
}

const done = rows.filter((r) => r.finished);
const sum = (f) => rows.reduce((a, r) => a + f(r), 0);
const mean = done.length ? done.reduce((a, r) => a + r.meanSpeed, 0) / done.length : 0;
console.log(
  `\n${done.length}/${rows.length} finished · mean ${kmh(mean)} km/h · top ${kmh(
    Math.max(...rows.map((r) => r.topSpeed)),
  )} km/h · air ${(sum((r) => r.airTime) / rows.length).toFixed(1)} s/run · ` +
    `jumps ${sum((r) => r.jumps)} · harsh ${sum((r) => r.harshLandings)} · trees ${sum((r) => r.treeHits)} · ` +
    `wipeouts ${sum((r) => r.wipeouts)} · ` +
    `resets ${sum((r) => r.resets)} (auto ${sum((r) => r.autoResets)}) · missed ${sum((r) => r.missed)} · ` +
    `score ${Math.round(sum((r) => r.score) / rows.length)}/run`,
);

if (args.json) {
  const withoutEvents = rows.map((r) => {
    const copy = { ...r };
    delete copy.events;
    return copy;
  });
  writeFileSync(args.json, `${JSON.stringify(withoutEvents, null, 2)}\n`);
  console.log(`wrote ${args.json}`);
}

if (done.length === 0) {
  console.error("\n!! the bot finished no seed at all");
  process.exit(1);
}
