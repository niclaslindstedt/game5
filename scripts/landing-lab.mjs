#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LANDING LAB — does a skier ride away the landings the mountain hands
// him? The ride lab drops one skier off one synthetic kicker; this one
// skis the GENERATED mountains the way a player does: stood on the piste
// (and off it, on the open face) at a run's speed, the tuck HELD the whole
// way — the W key kept down over every crest — and, on half the runs, the
// jump sprung off the slope. Every flight that comes down is a row: the
// load it put on him (`landingLoad`), its equivalent fall height, how far
// off true the skis met the snow, the pitch he flew at, and whether he was
// thrown inside 0.6 s of it and by what. The table is the
// share of landings that ended on the body, by how hard they were — a
// landing on the slope a skier should ride away belongs in the first rows,
// with no wipeouts in them.
//
//   make landing                        8 seeds, the table
//   make landing ARGS="--seeds 16 --json"   a baseline to keep
//   make landing ARGS="--compare previews/landing.json"
//   make landing ARGS=--attitudes        the attitude sweep (below)
//
// THE ATTITUDE SWEEP (`--attitudes`, `lib/landing-attitudes.mjs`) is the
// other half: what a player who MEANS to land badly gets. Drops staged on
// the bench (the groomer, a 24° landing, powder) at three heights and two
// speeds, the skis held off true — tips down, tails down, rolled, sideways —
// with the air's hands off so the attitude set is the attitude that lands,
// each cell whether he rode it away. `--json` / `--compare` keep a baseline.
//
// Pure Node: the engine at 120 Hz, no renderer.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    seeds: { kind: "number", default: 8, help: "how many mountains (seeds 1..N)" },
    every: { kind: "number", default: 60, help: "metres of piste between two starts" },
    face: { kind: "number", default: 48, help: "starts off the piste on each mountain" },
    json: { kind: "flag", help: "write previews/landing.json (the baseline)" },
    compare: { kind: "string", help: "a baseline to print beside this run" },
    stand: { kind: "flag", help: "ski stood up instead of tucked (W never held)" },
    lean: {
      kind: "number",
      default: 0,
      help: "the lean held in the air, -1..1 (back positive, as the input): a player MEANING to land on his tips (-1) or his tails (1)",
    },
    list: { kind: "flag", help: "print every landing that threw him" },
    attitudes: {
      kind: "flag",
      help: "the ATTITUDE SWEEP: drops staged on the bench, the skis held off true (tips down, tails down, rolled, sideways) — which he rides away",
    },
    trace: {
      kind: "string",
      help: "ski one start step by step: seed:x:z:heading:kmh:pop:piste (as --list prints it)",
    },
  },
  "usage: make landing ARGS='[--seeds n] [--every m] [--face n] [--json] [--compare file] [--list]'",
);

const HZ = E.TUNING.physicsHz;
const RUN = 6;
const AFTER = 0.6;
const SPEEDS = [55, 80, 105, 130];

/** A run's inputs: the tuck held throughout, and on the `pop` runs the
 * jump loaded from 1 s and let go at 1.7 s — sprung off the slope. */
function inputAt(t, pop, state, steered) {
  // On the piste the bot's hands steer him down it (a player follows the
  // piste); everything else is the held tuck. On the face he runs the fall
  // line straight.
  const steer = steered ? E.botInput(state).steer : 0;
  return {
    steer,
    tuck: args.stand ? 0 : 1,
    brake: 0,
    lean: state.skier.airborne ? args.lean : 0,
    reset: false,
    jump: pop && t >= 1 && t < 1.7,
  };
}

/** The starts on one mountain: down the piste every `every` m at each
 * speed, and `face` points scattered over the open face down its fall
 * line — a cheap hash, never a stream, so a start is the same every run. */
function startsOf(level) {
  const out = [];
  for (const p of level.track.points) {
    if (p.s % args.every > 2 || p.s < 20 || p.s > level.track.length - 60) continue;
    for (const kmh of SPEEDS) out.push({ x: p.x, z: p.z, heading: p.heading, kmh, where: "piste" });
  }
  const n = { x: 0, y: 1, z: 0 };
  let h = level.seed * 2654435761;
  const next = () => {
    h = (Math.imul(h ^ (h >>> 15), 2246822519) + 0x6d2b79f5) >>> 0;
    return h / 2 ** 32;
  };
  for (let i = 0; i < args.face; i++) {
    // The map runs from 0 to `size` on both axes; its margins are left out.
    const x = (0.15 + 0.7 * next()) * level.size;
    const z = (0.15 + 0.7 * next()) * level.size;
    level.normalAt(x, z, n);
    if (Math.hypot(n.x, n.z) < 0.15) continue;
    for (const kmh of [50, 90]) {
      out.push({ x, z, heading: Math.atan2(n.x, n.z), kmh, where: "face" });
    }
  }
  return out;
}

if (args.attitudes) {
  const { attitudeSweep } = await import("./lib/landing-attitudes.mjs");
  attitudeSweep(E, await import(join(root, "tests/support/synthetic.ts")), args, root);
  process.exit(0);
}

if (args.trace) {
  const [seed, x, z, heading, kmh, pop, steered] = args.trace.split(":").map(Number);
  const { level } = E.createGame({
    seed,
    mode: "free",
    rivals: 0,
    countdown: 0,
    crowd: 0,
    quiet: true,
  });
  const state = E.createGame({
    level,
    mode: "free",
    rivals: 0,
    countdown: 0,
    crowd: 0,
    grimbear: false,
    quiet: true,
  });
  E.placeRun(state, { x, z, heading, speed: kmh / 3.6 });
  const c = state.skier;
  const t0 = state.t;
  for (let i = 0; i < RUN * HZ && c.thrown === null; i++) {
    const t = state.t - t0;
    E.step(state, inputAt(t, pop === 1, state, steered === 1));
    const said = state.events
      .filter((e) => e.kind !== "checkpoint")
      .map(
        (e) =>
          e.kind +
          (e.cause
            ? `:${e.cause}`
            : e.kind === "land"
              ? `(${e.g.toFixed(1)}g off ${e.off.toFixed(2)})`
              : e.kind === "save"
                ? `:${e.save}`
                : ""),
      )
      .join(" ");
    if (i % 6 === 0 || said) {
      console.log(
        `${t.toFixed(3)} ${c.airborne ? "AIR" : "   "} v ${(c.speed * 3.6).toFixed(0)} pitch ${((c.pitch * 180) / Math.PI).toFixed(0)} roll ${((c.roll * 180) / Math.PI).toFixed(0)} wx ${c.wx.toFixed(2)} wy ${c.wy.toFixed(2)} st ${c.steer.toFixed(2)} crouch ${c.crouch.toFixed(2)} comp ${c.skiCompression.map((v) => v.toFixed(2)).join("/")} body ${c.bodyHit.toFixed(2)} nose ${((E.noseDown(state) * 180) / Math.PI).toFixed(0)} ${said}`,
      );
    }
  }
  process.exit(0);
}

const rows = [];
for (let seed = 1; seed <= args.seeds; seed++) {
  const base = E.createGame({ seed, mode: "free", rivals: 0, countdown: 0, crowd: 0, quiet: true });
  const level = base.level;
  for (const start of startsOf(level)) {
    for (const pop of [false, true]) {
      const state = E.createGame({
        level,
        mode: "free",
        rivals: 0,
        countdown: 0,
        crowd: 0,
        grimbear: false,
        quiet: true,
      });
      E.placeRun(state, { x: start.x, z: start.z, heading: start.heading, speed: start.kmh / 3.6 });
      const c = state.skier;
      let open = null;
      let rate = 0;
      let flying = false;
      const t0 = state.t;
      for (let i = 0; i < RUN * HZ; i++) {
        const t = state.t - t0;
        // Down before the step: a landing that throws him on the step it
        // touches down is still that landing's row.
        const wasDown = c.thrown !== null;
        E.step(state, inputAt(t, pop, state, start.where === "piste"));
        // The pitch rate he left the snow with, rad/s, tips DOWN positive.
        if (c.airborne && !flying) rate = c.wx;
        flying = c.airborne;
        for (const e of state.events) {
          if (e.kind === "land" && e.airTime >= E.TUNING.landing.air && !wasDown) {
            open = {
              seed,
              start: `${seed}:${start.x.toFixed(1)}:${start.z.toFixed(1)}:${start.heading.toFixed(3)}:${start.kmh}:${pop ? 1 : 0}:${start.where === "piste" ? 1 : 0}`,
              where: start.where,
              pop,
              kmh: start.kmh,
              t,
              air: e.airTime,
              g: e.g,
              efh: (e.impact * e.impact) / (2 * E.TUNING.g),
              off: e.off,
              nose: E.noseDown(state),
              rate,
              thrown: null,
            };
            rows.push(open);
          }
          // A trunk is the piste's edge run off with the skis straight, not
          // the landing: kept apart.
          if (e.kind === "wipeout" && open && t - open.t <= AFTER) open.thrown = e.cause;
        }
        if (c.thrown !== null) break;
      }
    }
  }
}

const BANDS = [
  ["under 4 g", 0, 4],
  ["4–6 g", 4, 6],
  ["6–9 g", 6, 9],
  ["9–14 g", 9, 14],
  ["14–20 g", 14, 20],
  ["20 g +", 20, 1e9],
];

function tableOf(list) {
  return BANDS.map(([label, lo, hi]) => {
    const band = list.filter((r) => r.g >= lo && r.g < hi && r.thrown !== "tree");
    const down = band.filter((r) => r.thrown);
    const causes = {};
    for (const r of down) causes[r.thrown] = (causes[r.thrown] ?? 0) + 1;
    // How far off true the landings of the band came down — the share of
    // a clean landing's tolerance (`landingOff`), the 95th percentile and
    // the worst — what a rule on the attitude must leave ridden.
    const offs = band.map((r) => r.off).sort((a, b) => a - b);
    const p95 = offs.length ? offs[Math.floor(0.95 * (offs.length - 1))] : 0;
    const worst = offs.length ? offs[offs.length - 1] : 0;
    return { label, n: band.length, down: down.length, causes, p95, worst };
  });
}

const all = tableOf(rows);
const piste = tableOf(rows.filter((r) => r.where === "piste"));
const mean = (list, f) => list.reduce((a, r) => a + f(r), 0) / Math.max(1, list.length);
const deg = (r) => (r * 180) / Math.PI;
const summary = {
  // How he flies a held tuck: the pitch rate he left the snow with (tips
  // down positive, °/s) and how far the tips came down into the slope he
  // landed on (°) — a held W must not pitch him over his tips.
  rate: deg(mean(rows, (r) => r.rate)),
  nose: deg(mean(rows, (r) => r.nose)),
  noseWorst: deg(Math.max(...rows.map((r) => r.nose))),
  landings: rows.length,
  thrown: rows.filter((r) => r.thrown).length,
  all,
  piste,
};

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : "—");
let before = null;
if (args.compare) before = JSON.parse(readFileSync(args.compare, "utf8"));

console.log(
  `landing lab — engine ${E.engineVersion} · seeds 1..${args.seeds} · the tuck held` +
    ` · ${rows.length} landings, ${summary.thrown} thrown (${pct(summary.thrown, rows.length)})` +
    (before
      ? ` · before ${before.thrown}/${before.landings} (${pct(before.thrown, before.landings)})`
      : ""),
);
console.log(
  `  take-off pitch rate ${summary.rate.toFixed(1)}°/s tips-down · tips into the landing ${summary.nose.toFixed(1)}° mean, ${summary.noseWorst.toFixed(0)}° worst` +
    (before
      ? ` · before ${before.rate.toFixed(1)}°/s, ${before.nose.toFixed(1)}°, ${before.noseWorst.toFixed(0)}°`
      : ""),
);
for (const [name, table, old] of [
  ["every landing", all, before?.all],
  ["the piste only", piste, before?.piste],
]) {
  console.log(`\n  ${name}`);
  console.log(
    "    load        landings  thrown        causes              off p95/worst" +
      (old ? "  before" : ""),
  );
  table.forEach((b, i) => {
    const causes = Object.entries(b.causes)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    const was = old ? `${old[i].down}/${old[i].n} (${pct(old[i].down, old[i].n)})` : "";
    console.log(
      `    ${b.label.padEnd(11)} ${String(b.n).padStart(8)}  ${`${b.down} (${pct(b.down, b.n)})`.padEnd(13)} ${causes.padEnd(19)} off ${b.p95.toFixed(2)}/${b.worst.toFixed(2)}  ${was}`,
    );
  });
}
if (args.list) {
  console.log("\n  thrown:");
  for (const r of rows.filter((r) => r.thrown && r.thrown !== "tree")) {
    console.log(
      `    seed ${r.seed} ${r.where} ${r.pop ? "pop " : "hold"} ${r.kmh} km/h · air ${r.air.toFixed(2)} s · ${r.g.toFixed(1)} g · EFH ${r.efh.toFixed(2)} m · off ${r.off.toFixed(2)} · nose ${((r.nose * 180) / Math.PI).toFixed(0)}° · rate ${r.rate.toFixed(2)} · ${r.thrown} · --trace ${r.start}`,
    );
  }
}
if (args.json) {
  mkdirSync(join(root, "previews"), { recursive: true });
  writeFileSync(join(root, "previews/landing.json"), JSON.stringify(summary, null, 2));
  console.log("\nwrote previews/landing.json");
}
