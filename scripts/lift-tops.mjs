#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFT TOPS LAB — every lift's top on a seed (or a sweep of seeds),
// ridden by a skier who FOLLOWS THE SIGN: a free ride begun on the lift up
// to each run a top serves, stood off it with nothing leading him, then
// steered — as a player would — off a chair down its lane to the parting,
// for the ramp's head on the pad's rim and down the ramp until he is on the
// run's snow. One row a run: the lift, the run, whether a ramp comes down
// to it, how far its start lies under the top and how far from it, how far
// the rider ever CLIMBED over the lowest he had come down to, whether he
// reached the run, and what threw him or stood him back up. Pure Node over
// the engine: no build, no browser, seconds a seed.
//
// It exists because the lift tops broke the same way twice, quietly: a lead
// that steered the rider off the top hid every run that started level with
// or above it — he was skated across and nobody saw the climb. A top is
// right when a rider who does nothing but aim at the sign gets there
// downhill, and this is that rider (`docs/summit-stations.md`).
//
//   node scripts/lift-tops.mjs --seed=38
//   node scripts/lift-tops.mjs --count=12 --region=fell
//   node scripts/lift-tops.mjs --seed=40622 --run=7
//   node scripts/lift-tops.mjs --seed=2 --region=maritime --weather=storm

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const E = await import(join(root, "engine/index.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", help: "ride every top of this one seed" },
    from: { kind: "number", default: 1, help: "first seed of a sweep" },
    count: { kind: "number", help: "sweep this many seeds instead of riding one" },
    region: {
      kind: "string",
      default: "alpine",
      help: "the kind of snow country (R21): alpine, fell, continental, maritime",
    },
    weather: {
      kind: "string",
      help: "ride under this sky (R19): clear, fair, flurries, high, overcast, snow, storm, fog",
    },
    hour: { kind: "number", help: "the solar hour the ride starts at" },
    run: { kind: "string", help: "ride only the run with this id" },
    climb: {
      kind: "number",
      default: 0.6,
      help: "the climb, m, over which a row is a fault (a roll of the snow is not one)",
    },
    trace: {
      kind: "flag",
      help: "print the rider every half second: the mark he makes for, his speed, his height under the top, the snow under him",
    },
  },
  "usage: npm run lift-tops -- (--seed n | --count k [--from n]) [--region id] [--weather kind] [--hour h] [--run id]",
);

/** How near a mark the rider counts as there, m; the speed he checks to,
 * m/s; how long he is given, s. */
const REACHED = 4;
const CHECK = 12;
const SECONDS = 90;

/** One run ridden off its lift's top by a rider who follows its sign. */
function ride(level, plans, r) {
  const run = E.createGame({ level, mode: "free", byLift: true, run: r.id, quiet: true });
  const plan = plans[run.skier.lift.index];
  const ramp = plan.lift.ramps?.find((q) => q.run === r.id);
  const lane = plan.lift.kind === "chair" ? E.chairLane(plan) : null;
  const way = [
    ...(lane
      ? [
          {
            x: plan.lift.bottom.x + plan.dx * (lane.exit + 2) + plan.dz * lane.v,
            z: plan.lift.bottom.z + plan.dz * (lane.exit + 2) - plan.dx * lane.v,
          },
        ]
      : []),
    ...(ramp ? [ramp.from, ramp.to] : [r.points[0]]),
  ];
  // On the run's snow, once making for where the ramp meets it.
  const onRun = (x, z) => r.points.some((p) => Math.hypot(p.x - x, p.z - z) < p.width / 2);
  let k = 0;
  let low = Infinity;
  let climbed = 0;
  const events = [];
  for (let i = 0; i < SECONDS * 120 && k < way.length; i++) {
    const c = run.skier;
    if (!c.lift) {
      low = Math.min(low, c.y);
      climbed = Math.max(climbed, c.y - low);
    }
    const aim = way[k];
    if (!c.lift && k === way.length - 1 && i % 12 === 0 && onRun(c.x, c.z)) {
      k = way.length;
      break;
    }
    if (Math.hypot(aim.x - c.x, aim.z - c.z) < REACHED) {
      k++;
      continue;
    }
    const off = E.angleDiff(c.heading, Math.atan2(aim.x - c.x, aim.z - c.z));
    if (args.trace && !c.lift && i % 60 === 0) {
      const top = plan.lift.top;
      console.log(
        `    t ${run.t.toFixed(1).padStart(5)}  mark ${k}/${way.length}  ${c.speed.toFixed(1).padStart(4)} m/s  under ${(top.y - c.y).toFixed(1).padStart(5)} m  from top ${Math.hypot(
          c.x - top.x,
          c.z - top.z,
        )
          .toFixed(0)
          .padStart(4)} m  to mark ${Math.hypot(aim.x - c.x, aim.z - c.z)
          .toFixed(0)
          .padStart(
            4,
          )} m  packed ${level.packedAt(c.x, c.z).toFixed(2)}  air ${c.airborne ? "yes" : "no"}`,
      );
    }
    E.step(run, {
      ...E.NEUTRAL_INPUT,
      steer: c.lift ? 0 : Math.max(-1, Math.min(1, off * 2.2)),
      tuck: c.lift ? 0 : c.speed < 5 ? 1 : 0.25,
      brake: c.lift ? 0 : Math.max(0, Math.min(1, c.speed - CHECK)),
    });
    for (const e of run.events) {
      if (e.kind === "wipeout") events.push(`wipeout:${e.cause}`);
      else if (e.kind === "reset") events.push("reset");
      // Ridden into another lift's load zone on the way: it takes him.
      else if (e.kind === "lift" && e.phase === "board") events.push(`boarded:${e.id}`);
    }
    if (events.some((e) => e.startsWith("boarded"))) break;
  }
  const head = r.points[0];
  return {
    lift: plan.lift.id,
    kind: plan.lift.kind,
    run: r.id,
    grade: r.grade,
    ramp: !!ramp,
    under: plan.lift.top.y - head.y,
    away: Math.hypot(head.x - plan.lift.top.x, head.z - plan.lift.top.z),
    climbed,
    reached: k >= way.length,
    events,
  };
}

const seeds =
  args.count !== undefined
    ? Array.from({ length: args.count }, (_, i) => args.from + i)
    : [args.seed ?? 38];
const f = (v, d = 1) => v.toFixed(d).padStart(6);
console.log("seed  lift   kind     run  grade   ramp  under   away  climb  reached  what");
let rows = 0;
let faults = 0;
for (const seed of seeds) {
  let level;
  try {
    const sky =
      args.weather !== undefined || args.hour !== undefined
        ? {
            ...(args.weather !== undefined ? { weather: args.weather } : {}),
            ...(args.hour !== undefined ? { hour: args.hour } : {}),
          }
        : undefined;
    level = E.generateLevel(seed, { region: args.region, ...(sky ? { sky } : {}) });
  } catch (err) {
    console.log(
      `${String(seed).padStart(4)}  refused: ${err instanceof Error ? err.message : err}`,
    );
    continue;
  }
  const plans = E.liftPlans(level);
  for (const r of E.freeRuns(level)) {
    if (args.run !== undefined && r.id !== args.run) continue;
    const row = ride(level, plans, r);
    const fault = row.climbed > args.climb || !row.reached || row.events.length > 0;
    rows++;
    if (fault) faults++;
    console.log(
      `${String(seed).padStart(4)}  ${row.lift.padEnd(5)}  ${row.kind.padEnd(7)}  ${row.run.padStart(3)}  ${row.grade.padEnd(6)}  ${row.ramp ? " yes" : "  no"}  ${f(row.under)} ${f(row.away, 0)} ${f(row.climbed, 2)}  ${row.reached ? "    yes" : "     no"}  ${row.events.slice(0, 3).join(" ")}${fault ? "  ← FAULT" : ""}`,
    );
  }
}
console.log(
  `\n${rows} runs ridden off their tops, ${faults} at fault (climb over ${args.climb} m, short of the run, thrown or reset)`,
);
