#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLOUD METRICS LAB (`make cloud-metrics`): HOW MUCH snow cloud does a
// skier raise, for what he is doing and how fast? Every row is a run the
// REAL ENGINE skis on a synthetic strip (`tests/support/synthetic.ts`) — a
// kind of snow × a manoeuvre (running straight, carving, checking his
// speed, a hockey stop, skating off) × a speed — and every frame of it is
// read exactly as `snow-cloud.ts` reads it (`driveOf`, `carveOf`,
// `skidCloud`, `skiCloud` in `snow-cloud-plan.ts`): how many puffs a second
// each source throws, and what each puff is over its life. From those, the
// cloud ALIVE behind him in the steady state: its opacity-weighted AREA
// (each puff's disc times its opacity, summed over its life, times the
// rate — m² of cloud a lens sees), how many puffs, how high it climbs, how
// long a curtain it hangs over his line, and the area against his own
// silhouette (`× skier`).
//
// It answers the question a picture cannot: whether the cloud GROWS with
// speed as a real one does — next to nothing at a crawl, where the snow is
// shoved aside and falls back; a plume at speed — and by how much a change
// moved it. Pure Node, seconds; `make cloud` photographs the same rows.
//
//   node scripts/cloud-metrics.mjs                         powder and new snow, every move, the speed ladder
//   node scripts/cloud-metrics.mjs --snow=new --moves=check,stop
//   node scripts/cloud-metrics.mjs --speeds=10,20,40 --json=previews/c-before.json
//   node scripts/cloud-metrics.mjs --compare=previews/c-before.json

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MOVES = ["straight", "carve", "check", "stop", "skate"]; // `HOLD_MOVES`
const args = parseArgs(
  process.argv.slice(2),
  {
    snow: {
      kind: "string",
      default: "soft,new",
      help: "the kinds of snow (groomed,hard,soft,new,wet,ice)",
    },
    moves: {
      kind: "string",
      default: MOVES.join(","),
      help: `the manoeuvres (${MOVES.join(", ")})`,
    },
    speeds: {
      kind: "string",
      default: "8,15,25,40,60,85",
      help: "the speeds, km/h (a stop starts at it; a skate is from a standstill and has none)",
    },
    skis: { kind: "string", default: "chamois", help: "the pair" },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/cloud-metrics.mjs [--snow=a,b] [--moves=a,b] [--speeds=a,b] [--json=f] [--compare=f]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));
const C = await import(join(root, "pwa/src/game/snow-cloud-plan.ts"));
const { SNOW } = await import(join(root, "pwa/src/game/snowpack.ts"));
const H = await import(join(root, "pwa/src/game/hold-input.ts"));
const spec = E.skisById(args.skis);

/** A skier seen from behind at chase range: about 0.45 m across and 1.5 m
 * tall in his stance — the area the cloud is held against. */
const SKIER_AREA = 0.7;

/** A puff's presence over its life: the opacity-weighted area of its disc,
 * integrated, m²·s — times the rate, the steady area alive. */
function presence(r) {
  if (r.hang <= 0) return 0;
  let sum = 0;
  const n = 24;
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) / n;
    const rad = C.puffRadius(r.size, r.grow, a);
    sum += Math.PI * rad * rad * C.puffOpacity(r.opacity, r.size, r.grow, a);
  }
  return (sum / n) * r.hang;
}

/** The strip's pitch for a held speed: steep enough to keep him there in
 * a tuck, gentle enough that he is not run past it. */
const pitchFor = (kmh) =>
  Math.tan(((kmh <= 12 ? 2 : kmh <= 20 ? 4 : kmh <= 30 ? 7 : kmh <= 50 ? 10 : 14) * Math.PI) / 180);
/** A manoeuvre's run: how long it is skied and the window measured — the
 * controls are the game's own held ride (`hold-input.ts`). */
function moveOf(name) {
  switch (name) {
    case "stop":
      return { seconds: 3, window: [0.3, 3] };
    case "skate":
      return { seconds: 4, window: [0.5, 4], start: 0 };
    default:
      return { seconds: 6, window: [2, 6] };
  }
}

function measure(kind, moveName, kmh) {
  const snow = SNOW[kind];
  const packed = kind === "groomed" || kind === "hard" || kind === "ice" ? 1 : 0;
  const move = moveOf(moveName);
  const flat = moveName === "skate" || moveName === "stop";
  const level = S.flatLevel(
    flat ? { packed } : { packed, grade: pitchFor(kmh), slopeFrom: 200, size: 4000 },
  );
  const state = E.createGame({ level, spec, rivals: 0, countdown: 0, quiet: true });
  const speed = move.start ?? kmh / 3.6;
  E.placeRun(
    state,
    flat ? { x: 1500, z: 200, heading: 0, speed } : { x: 2000, z: 600, heading: 0, speed },
  );
  const t0 = state.t;
  const steps = Math.round(move.seconds * E.TUNING.physicsHz);
  const drive = { speed: 0, skid: 0, edge: 0, grounded: false };
  const wall = C.emptyRecipe();
  const ski = C.emptyRecipe();
  const acc = {
    n: 0,
    rate: 0,
    area: 0,
    alive: 0,
    lift: 0,
    hang: 0,
    length: 0,
    speed: 0,
    peak: 0,
    wallShare: 0,
  };
  for (let i = 0; i < steps; i++) {
    const t = state.t - t0;
    E.step(state, H.holdInput(state, kmh, 0, moveName, t));
    if (i % 2 === 0 || t < move.window[0] || t > move.window[1]) continue;
    const c = state.skier;
    C.driveOf(c, drive);
    C.skidCloud(drive, snow, wall);
    let rate = wall.rate;
    let area = wall.rate * presence(wall);
    let alive = wall.rate * wall.hang;
    let lift = wall.rate * wall.lift * wall.tau;
    let hang = wall.rate * wall.hang;
    const carve = C.carveOf(drive);
    for (let k = 0; k < 2; k++) {
      const tip = c.contacts[k * 3];
      const mid = c.contacts[k * 3 + 1];
      if (!mid || !mid.touching) continue;
      C.skiCloud(carve, tip?.touching ? tip.sink : 0, snow, ski, drive.speed);
      rate += ski.rate;
      area += ski.rate * presence(ski);
      alive += ski.rate * ski.hang;
      lift += ski.rate * ski.lift * ski.tau;
      hang += ski.rate * ski.hang;
    }
    acc.n++;
    acc.rate += rate;
    acc.area += area;
    acc.alive += alive;
    acc.lift += rate > 0 ? lift / rate : 0;
    acc.hang += rate > 0 ? hang / rate : 0;
    acc.length += rate > 0 ? c.speed * (hang / rate) : 0;
    acc.speed += c.speed;
    acc.peak = Math.max(acc.peak, area);
    acc.wallShare += rate > 0 ? wall.rate / rate : 0;
  }
  const m = (v) => (acc.n ? v / acc.n : 0);
  return {
    id: `${kind}/${moveName}/${moveName === "skate" ? "-" : kmh}`,
    snow: kind,
    move: moveName,
    kmh: moveName === "skate" ? null : kmh,
    ridden: m(acc.speed) * 3.6,
    rate: m(acc.rate),
    alive: m(acc.alive),
    area: m(acc.area),
    peak: acc.peak,
    ratio: m(acc.area) / SKIER_AREA,
    lift: m(acc.lift),
    hang: m(acc.hang),
    length: m(acc.length),
    wall: m(acc.wallShare),
  };
}

const kinds = args.snow.split(",");
const moves = args.moves.split(",");
for (const mv of moves) {
  if (!MOVES.includes(mv)) {
    console.error(`unknown move "${mv}" (${MOVES.join(", ")})`);
    process.exit(2);
  }
}
const speeds = args.speeds.split(",").map(Number);
const rows = [];
for (const k of kinds) {
  if (!SNOW[k]) {
    console.error(`unknown snow "${k}"`);
    process.exit(2);
  }
  for (const mv of moves) {
    for (const v of mv === "skate" ? [0] : speeds) rows.push(measure(k, mv, v));
  }
}

const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const pad = (s, n) => String(s).padStart(n);
const fmt = (v, d) => (v === null || !Number.isFinite(v) ? "—" : v.toFixed(d));
console.log(
  `cloud metrics · ${spec.id} · the steady cloud alive behind him, each frame read as snow-cloud.ts reads it · × skier against ${SKIER_AREA} m²`,
);
console.log(
  [
    "snow/move".padEnd(15),
    pad("km/h", 6),
    pad("ridden", 7),
    pad("puffs/s", 8),
    pad("alive", 7),
    pad("area m²", 8),
    pad("peak m²", 8),
    pad("× skier", 13),
    pad("high m", 7),
    pad("hang s", 7),
    pad("long m", 7),
    pad("wall", 5),
  ].join(""),
);
for (const r of rows) {
  const old = before?.find((b) => b.id === r.id);
  const ratio = old ? `${fmt(old.ratio, 1)}→${fmt(r.ratio, 1)}` : fmt(r.ratio, 1);
  console.log(
    [
      `${r.snow}/${r.move}`.padEnd(15),
      pad(r.kmh ?? "—", 6),
      pad(fmt(r.ridden, 0), 7),
      pad(fmt(r.rate, 0), 8),
      pad(fmt(r.alive, 0), 7),
      pad(fmt(r.area, 1), 8),
      pad(fmt(r.peak, 1), 8),
      pad(ratio, 13),
      pad(fmt(r.lift, 2), 7),
      pad(fmt(r.hang, 1), 7),
      pad(fmt(r.length, 0), 7),
      pad(fmt(r.wall, 2), 5),
    ].join(""),
  );
}
if (args.json) writeFileSync(args.json, JSON.stringify(rows, null, 1));
