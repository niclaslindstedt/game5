#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RATE generated maps — how HARD each one is, and what KIND of hard — which
// is the question a CAMPAIGN is built out of. `make analyze` says whether a
// map is broken; this says, of the ones that are not, which asks more of the
// skier, on eight axes (the steepness, the bends, the air, the woods, the
// traverses, the powder, the weather, the length — `engine/rating/`) folded into one
// difficulty index. Pure Node: the engine and nothing else, about a second a
// seed (two with `--sim`).
//
//   make rate                            the four usual seeds
//   make rate COUNT=48                   a sweep to shortlist from
//   make rate SEEDS=7,38 ARGS=--sim      ...with the bot's run as the length axis
//   make rate ARGS="--weather snow --hour 17"   under a pinned sky
//   make rate COUNT=96 ARGS=--stats      the POPULATION per axis: where the
//                                        scales in `RATING` sit against it
//   make rate CAMPAIGN=1                 the committed ladder, audited as a
//                                        set: every map rebuilt on its own
//                                        version and held to its digest, the
//                                        bot's time on it (and a trial's
//                                        medals against it), does every
//                                        rung ask more than the one before,
//                                        is any pair the same map twice
//   make rate RACE=superG                a discipline's nine race maps (slalom,
//                                        giantSlalom, superG, downhill,
//                                        speedSki, skiCross)
//                                        (race-maps.ts), audited the same
//                                        way: the digest, the rating, the
//                                        course's figures, the bot's time
//                                        down it against par, its trap
//
// The table prints a row per seed: the analyzer's error count (a map the
// generator would not hand out is not a candidate whatever it rates), the
// piste, the pitch, the bends, the kickers, the woods, the traverses, the drifts, the sky, the length,
// the sun, the eight axes and the index — and the axis the map LEADS on,
// which is what tells six candidates apart before the index has.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
aliasEngine(root);
const {
  RATING,
  RATING_AXES,
  WEATHER_KINDS,
  analyzeLevel,
  engineVersion,
  generateLevel,
  leadingAxis,
  levelDigest,
  rateLadder,
  rateLevel,
  simulateRun,
  RACE_SKIS,
  createGame,
  raceCourseOf,
  raceParOf,
  skisById,
  speedCourseOf,
} = await import(join(root, "engine/index.ts"));

const DEFAULT_SEEDS = [1, 7, 38, 123];

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", help: "one seed" },
    seeds: { kind: "list", help: "several seeds, comma-separated" },
    count: { kind: "number", help: "seeds from..from+N-1 — the sweep" },
    from: { kind: "number", default: 1, help: "the sweep's first seed" },
    hour: { kind: "number", help: "rate under this start hour instead of the map's own" },
    weather: { kind: "string", help: `…this sky (${"clear, fair, high, overcast, snow, fog"})` },
    sim: { kind: "flag", help: "ski each map with the bot and rate its run as the time axis" },
    stats: { kind: "flag", help: "print the population per axis instead of the rows" },
    campaign: { kind: "flag", help: "audit the committed campaign ladder (campaign-levels.ts)" },
    race: {
      kind: "string",
      help: "audit a discipline's nine race maps (race-maps.ts): slalom, giantSlalom, superG, downhill, speedSki, skiCross",
    },
    region: {
      kind: "string",
      default: "alpine",
      help: "the kind of snow country the sweep is built in (R21: alpine, fell, continental, maritime)",
    },
    grade: {
      kind: "string",
      help: "the piste grade the sweep is built to (R23: green, blue, red, black) — each seed's own when left out",
    },
    json: { kind: "string", help: "write every rating to this file" },
  },
  "usage: npm run rate -- [--seed n | --seeds a,b,c | --count n [--from n]] [--hour h] [--weather w] [--sim] [--stats] [--campaign] [--race id] [--region id] [--grade id] [--json path]",
);

const pad = (v, n) => String(v).padStart(n);
const padEnd = (v, n) => String(v).padEnd(n);
const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—");

/** The bot's run on a built map, s — from the start line to the finish, alone. */
function botRun(level) {
  const run = simulateRun(level.seed, { level });
  return run.finished ? run.time : undefined;
}

/** One row of the table, from a built map under its conditions. */
function rowOf(label, level, opts) {
  const analysis = analyzeLevel(level);
  const rating = rateLevel(level, opts);
  const errors = analysis.findings.filter((x) => x.severity === "error").length;
  return { label, level, rating, errors };
}

function printHeader() {
  console.log(
    [
      padEnd("map", 12),
      pad("err", 3),
      pad("km", 5),
      pad("run s", 6),
      pad("r min", 5),
      pad("tight", 5),
      pad("rad/km", 6),
      pad("piste", 5),
      pad("grade", 5),
      pad("steep", 5),
      pad("kick", 4),
      pad("drop", 4),
      pad("lips", 5),
      pad("wall", 5),
      pad("drift", 5),
      pad("sun°", 5),
      pad("sky", 8),
      ...RATING_AXES.map((a) => pad(a.slice(0, 5), 5)),
      pad("index", 6),
      "  leads  ",
      "digest",
    ].join(" "),
  );
}

function printRow(row) {
  const { rating: r, errors } = row;
  const s = r.stats;
  console.log(
    [
      padEnd(row.label, 12),
      pad(errors, 3),
      pad(f(s.length / 1000, 2), 5),
      pad(f(s.runSeconds, 1) + (s.measured ? "" : "~"), 6),
      pad(f(s.tightest, 0), 5),
      pad(f(s.tight, 2), 5),
      pad(f(s.sweepPerKm, 1), 6),
      pad(s.grade, 5),
      pad(f(s.meanGrade, 2), 5),
      pad(f(s.steepest, 2), 5),
      pad(s.kickers, 4),
      pad(s.drops, 4),
      pad(f(s.lips, 1), 5),
      pad(f(s.walled, 2), 5),
      pad(f(s.drifted, 2), 5),
      pad(f(s.sunDeg, 0), 5),
      pad(s.weather, 8),
      ...RATING_AXES.map((a) => pad(f(r.axes[a], 2), 5)),
      pad(f(r.difficulty, 3), 6),
      "  " + padEnd(leadingAxis(r.axes), 7),
      levelDigest(row.level),
    ].join(" "),
  );
}

function printStats(rows) {
  console.log(`\npopulation — ${rows.length} maps`);
  console.log(
    [
      padEnd("axis", 10),
      pad("min", 6),
      pad("q1", 6),
      pad("median", 7),
      pad("q3", 6),
      pad("max", 6),
      pad("at 1", 6),
      pad("at 0", 6),
    ].join(" "),
  );
  const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  for (const axis of [...RATING_AXES, "difficulty"]) {
    const values = rows
      .map((row) => (axis === "difficulty" ? row.rating.difficulty : row.rating.axes[axis]))
      .sort((a, b) => a - b);
    const saturated = values.filter((v) => v >= 0.999).length / values.length;
    const floored = values.filter((v) => v <= 0.001).length / values.length;
    console.log(
      [
        padEnd(axis, 10),
        pad(f(values[0]), 6),
        pad(f(q(values, 0.25)), 6),
        pad(f(q(values, 0.5)), 7),
        pad(f(q(values, 0.75)), 6),
        pad(f(values[values.length - 1]), 6),
        pad(`${Math.round(saturated * 100)}%`, 6),
        pad(`${Math.round(floored * 100)}%`, 6),
      ].join(" "),
    );
  }
  console.log(
    "\nan axis pinned at 1 for most of the sweep measures nothing — raise its scale in " +
      "engine/rating/index.ts; one at 0 for most of it is a wish, not a measurement",
  );
}

/** The committed ladder: every shelf's maps, built the way the campaign
 * builds them, timed by the bot and rated under the day they pin. */
async function auditCampaign() {
  const { SHELVES } = await import(join(root, "pwa/src/game/campaign-levels.ts"));
  const { buildCampaignLevel, campaignSky } = await import(join(root, "pwa/src/game/campaign.ts"));
  const all = [];
  let moved = 0;
  for (const shelf of SHELVES) {
    const mix = shelf.levels.map((l) => l.grade).join(" ");
    console.log(
      `\n${shelf.name.toUpperCase()} — seed ${shelf.seed} in the ${shelf.region}, ${shelf.levels.length} courses: ${mix}`,
    );
    printHeader();
    const rungs = [];
    for (const pinned of shelf.levels) {
      const level = buildCampaignLevel(pinned);
      const run = simulateRun(level.seed, { level });
      const runSeconds = run.finished ? run.time : undefined;
      const row = rowOf(pinned.id, level, { sky: campaignSky(pinned), runSeconds });
      printRow(row);
      const bot = run.finished ? `${f(run.time, 1)} s top to bottom` : "DID NOT FINISH";
      const medals = pinned.medals
        ? ` · medals gold ${pinned.medals.gold} / silver ${pinned.medals.silver} / bronze ${pinned.medals.bronze} s`
        : "";
      console.log(
        `  ${pinned.mode} "${pinned.name}" — course ${pinned.course} (${pinned.grade}), the bot ${bot}${medals}`,
      );
      if (pinned.medals && run.finished && run.time > pinned.medals.bronze) {
        console.log(`  !! the bot is slower than ${pinned.id}'s bronze — the door would be shut`);
      }
      if (row.rating.stats.grade !== pinned.grade) {
        console.log(
          `  !! ${pinned.id} pins a ${pinned.grade} and measures ${row.rating.stats.grade}`,
        );
      }
      if (levelDigest(level) !== pinned.digest) {
        moved += 1;
        console.log(
          `  !! ${pinned.id} builds to ${levelDigest(level)} and pins ${pinned.digest} — the generator moved under it`,
        );
      }
      rungs.push({ name: pinned.id, rating: row.rating });
      all.push({ ...row, pinned });
    }
    const ladder = rateLadder(rungs);
    console.log(
      `  ladder: asks ${ladder.asks.map((a) => a.toFixed(3)).join(" → ")} · ` +
        `smallest step ${ladder.climb.toFixed(3)} · biggest ${ladder.wall.toFixed(3)} · ` +
        `closest pair ${ladder.apart.toFixed(2)}`,
    );
    for (const note of ladder.notes) console.log(`  !  ${note}`);
    if (ladder.notes.length === 0)
      console.log("  ok — every rung asks more, and none is another twice");
  }
  const whole = rateLadder(all.map((row) => ({ name: row.pinned.id, rating: row.rating })));
  console.log(
    `\nthe whole ladder: ${all.length} maps, index ${f(whole.asks[0], 3)} → ${f(whole.asks[whole.asks.length - 1], 3)}` +
      (moved > 0 ? ` · ${moved} digest(s) moved` : " · every digest holds"),
  );
  return all;
}

/** A discipline's nine race maps, built the way the app builds them, rated
 * and laddered, the course each sets and the bot's run down it against
 * the discipline's par. */
async function auditRace(discipline) {
  const { RACE_MAPS } = await import(join(root, "pwa/src/game/race-maps.ts"));
  const { buildCampaignLevel, campaignSky } = await import(join(root, "pwa/src/game/campaign.ts"));
  const rowsOf = RACE_MAPS[discipline];
  if (!rowsOf) {
    console.error(`no race maps for "${discipline}" (${Object.keys(RACE_MAPS).join(", ")})`);
    process.exit(2);
  }
  const all = [];
  let moved = 0;
  printHeader();
  for (const pinned of rowsOf) {
    const level = buildCampaignLevel(pinned);
    // Each discipline on its field's own pair.
    const skis = RACE_SKIS[pinned.mode];
    const run = simulateRun(level.seed, { level, mode: pinned.mode, spec: skisById(skis) });
    const raced = createGame({
      seed: level.seed,
      level,
      mode: pinned.mode,
      sky: campaignSky(pinned),
      quiet: true,
    });
    const course = speedCourseOf(raced.level) ?? raceCourseOf(raced.level);
    const par = raceParOf(raced.level);
    const row = rowOf(pinned.id, level, {
      sky: campaignSky(pinned),
      runSeconds: run.finished ? run.time : undefined,
    });
    printRow(row);
    const bot = run.out
      ? `OUT (${run.out})`
      : run.finished
        ? `${f(run.time, 1)} s`
        : "DID NOT FINISH";
    console.log(
      `  "${pinned.name}" — ${pinned.region ?? "alpine"} ${pinned.grade}, course ${pinned.course}: ` +
        `${f(course?.vertical ?? 0, 0)} m over ${f((course?.to ?? 0) - (course?.from ?? 0), 0)} m, ` +
        `${raced.level.checkpoints.length - 2} gates · the bot ${bot} against par ${f(par?.time ?? NaN, 1)} s` +
        (run.trap
          ? raced.level.speedSki
            ? ` · timed ${f(run.trap * 3.6, 2)} km/h against par's ${f((par?.trap ?? 0) * 3.6, 2)}`
            : ` · trap ${f(run.trap * 3.6, 0)} km/h`
          : ""),
    );
    if (levelDigest(level) !== pinned.digest) {
      moved += 1;
      console.log(`  !! ${pinned.id} builds to ${levelDigest(level)} and pins ${pinned.digest}`);
    }
    all.push({ ...row, pinned });
  }
  const ladder = rateLadder(all.map((r) => ({ name: r.pinned.id, rating: r.rating })));
  console.log(
    `\n${discipline}: ${all.length} maps, asks ${ladder.asks.map((a) => a.toFixed(3)).join(" → ")}` +
      (moved > 0 ? ` · ${moved} digest(s) moved` : " · every digest holds"),
  );
  for (const note of ladder.notes) console.log(`  !  ${note}`);
  return all;
}

if (args.weather !== undefined && !WEATHER_KINDS.includes(args.weather)) {
  console.error(`unknown weather "${args.weather}" (${WEATHER_KINDS.join(", ")})`);
  process.exit(2);
}

const S = RATING.scale;
const band = (b) => `${b.min}–${b.max}`;
console.log(
  `rate — engine ${engineVersion} · bands: run ${band(S.run)} s (pace ${S.pace} m/s), ` +
    `tight ${band(S.tight)}, sweep ${band(S.sweepPerKm)} rad/km, grade ${band(S.meanGrade)}, steepest ${band(S.steepest)}, ` +
    `lips ${band(S.lipsPerKm)} m/km, walled ${band(S.walled)}, drifted ${band(S.drifted)} + ${band(S.longestDrift)} m, ` +
    `sun ${S.sunHigh}°`,
);

let rows;
if (args.campaign) {
  rows = await auditCampaign();
} else if (args.race !== undefined) {
  rows = await auditRace(args.race);
} else {
  const seeds = args.seeds
    ? args.seeds.map(Number)
    : args.seed !== undefined
      ? [args.seed]
      : args.count !== undefined
        ? Array.from({ length: args.count }, (_, i) => args.from + i)
        : DEFAULT_SEEDS;
  const sky = {};
  if (args.hour !== undefined) sky.hour = args.hour;
  if (args.weather !== undefined) sky.weather = args.weather;
  const pinned = Object.keys(sky).length > 0;
  console.log(
    `seeds ${seeds.length > 12 ? `${seeds[0]}..${seeds[seeds.length - 1]}` : seeds.join(",")}` +
      (pinned ? ` · under ${JSON.stringify(sky)}` : "") +
      (args.sim ? " · the bot's run" : " · the run estimated (~)"),
  );
  rows = [];
  if (!args.stats) printHeader();
  for (const seed of seeds) {
    let level;
    try {
      level = generateLevel(seed, { region: args.region, grade: args.grade });
    } catch (error) {
      console.log(`${padEnd(String(seed), 12)} the generator gave up: ${error.message}`);
      continue;
    }
    const opts = {
      sky: pinned ? sky : undefined,
      runSeconds: args.sim ? botRun(level) : undefined,
    };
    const row = rowOf(String(seed), level, opts);
    rows.push(row);
    if (!args.stats) printRow(row);
  }
  if (args.stats) printStats(rows);
}

if (args.json) {
  mkdirSync(dirname(args.json), { recursive: true });
  writeFileSync(
    args.json,
    JSON.stringify(
      rows.map((row) => ({
        map: row.label,
        seed: row.level.seed,
        errors: row.errors,
        digest: levelDigest(row.level),
        rating: row.rating,
      })),
      null,
      2,
    ),
  );
  console.log(`wrote ${args.json}`);
}
