#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINGSUIT'S FLIGHT LAB (`make wingsuit-flight`): what the free ride's
// wingsuit (`engine/game/wingsuit.ts`, its numbers `defs/wingsuit.ts`, the
// BASE canopy on the skydive's maths `chute.ts` / `canopy.ts`) does from the
// physics alone, flown by the REAL ENGINE in Node — the bot's hands
// (`wingsuitPilot`, `wingsuitInput`) or scripted keys, never a shortcut. Each
// row is one measurement, held to the class's band where it has one:
//
//   glide-*     hands off at 2,500 m: the glide ratio, the speed across and
//               the sink (a large suit's 3.0–3.5, 150–190 km/h, 10–14 m/s)
//   dive-top    the arms swept and the lean forward from 3,500 m: the most
//               air speed in 40 s (a dive's 250 km/h and more)
//   flare-*     an 8 s dive, then the lean back and the wings spread: the
//               height gained, the least sink (through zero: climbing) and
//               the seconds of climb; held on past its top, the sink it
//               mushes at
//   short       the attack knocked 0.1 rad off its trim: the short period's
//               frequency (a stable suit's ~0.8 Hz)
//   phugoid     the speed's long swing after a pushed start, s
//   turn-*      the full edge in the glide: the turn rate and the sink
//   exit-*      the free ride's own exit on `--seed` (a cliff, or — where the
//               map has no wall sheer enough — the hover over its steepest
//               high edge): the drop and the seconds to flying
//   plane-*     out of the jump plane's door: the seconds to flying and the
//               height it cost
//   pull-*      the pull from the glide at 600 m: the seconds to full, the
//               height lost, the peak load
//   canopy-*    the BASE canopy hands off: forward speed and sink
//   land        flown down on the bot's pattern: the touchdown's sink, on
//               his boots (no skis)
//   edge        a glide flown at the map's edge: how near it came
//   flight      the bot's whole flight from the exit on `--seed`: the
//               distance flown in the suit, the pull's height, where it
//               came down
//
// Seconds, no browser, synthetic flat maps (`tests/support/synthetic.ts`);
// the exit and the whole flight on a generated map. Deterministic.
//
//   node scripts/wingsuit-flight-lab.mjs
//   node scripts/wingsuit-flight-lab.mjs --seed=7
//   node scripts/wingsuit-flight-lab.mjs --json=previews/wingsuit-before.json
//   node scripts/wingsuit-flight-lab.mjs --compare=previews/wingsuit-before.json

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
    seed: {
      kind: "number",
      default: 38,
      help: "the generated map the exit and the bot's whole flight are flown on",
    },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/wingsuit-flight-lab.mjs [--seed=N] [--json=file] [--compare=file]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));

const dt = E.TUNING.dt;
const SIZE = 8000;
const steps = (s) => Math.round(s / dt);
const N = E.NEUTRAL_INPUT;
const KMH = 3.6;
const flat = () => S.flatLevel({ size: SIZE });
const game = (level, plane = true) =>
  E.createGame({ level, mode: "free", plane, wingsuit: true, crowd: 0, quiet: true });
/** A ride stood at `agl` m in the suit (flying its glide unless `mode`). */
function suit(agl, at = {}) {
  const s = game(flat());
  E.skydiveAt(s, { x: SIZE / 2, z: 1500, agl, suit: "wingsuit", ...at });
  return s;
}
const said = (s, phase) => s.events.some((e) => e.kind === "chute" && e.phase === phase);
const thrown = (s) => !!s.skier.thrown;

/** THE GLIDE hands off: settled 15 s, then measured over 20 s. */
function glide() {
  const s = suit(2500);
  for (let i = 0; i < steps(15); i++) E.step(s, N);
  const c = s.skier;
  const [x0, y0, z0] = [c.x, c.y, c.z];
  for (let i = 0; i < steps(20); i++) E.step(s, N);
  const across = Math.hypot(c.x - x0, c.z - z0) / 20;
  const sink = (y0 - c.y) / 20;
  return { ratio: across / sink, across, sink };
}

/** THE DIVE: the arms swept, the lean forward, from 3,500 m. */
function dive() {
  const s = suit(3500);
  let top = 0;
  for (let i = 0; i < steps(40) && s.chute.agl > 300; i++) {
    E.step(s, { ...N, tuck: 1, lean: -1 });
    top = Math.max(top, s.chute.airspeed);
  }
  return top;
}

/** THE FLARE after an 8 s dive (lean forward), held 20 s. */
function flare() {
  const s = suit(3000);
  for (let i = 0; i < steps(8); i++) E.step(s, { ...N, lean: -1 });
  const c = s.skier;
  const ys = [];
  let least = Infinity;
  let stalled = false;
  for (let i = 0; i < steps(20); i++) {
    E.step(s, { ...N, lean: 1, brake: 1 });
    ys.push(c.y);
    least = Math.min(least, -c.vy);
    stalled ||= s.chute.wing.stalled;
  }
  // The bottom of the pull-out, then the top of the climb after it.
  let iLow = 0;
  while (iLow + 1 < ys.length && ys[iLow + 1] < ys[iLow]) iLow++;
  let iApex = iLow;
  for (let i = iLow; i < ys.length; i++) if (ys[i] > ys[iApex]) iApex = i;
  const low = ys[iLow];
  const apex = ys[iApex];
  const climb = (iApex - iLow) * dt;
  return { gain: apex - low, least, climb, held: -c.vy, stalled };
}

/** THE SHORT PERIOD: the attack knocked off its trim in the steady glide;
 * the frequency off the attack's first two peaks. */
function shortPeriod() {
  const s = suit(2500);
  for (let i = 0; i < steps(15); i++) E.step(s, N);
  s.chute.wing.alpha += 0.1;
  const a = [];
  for (let i = 0; i < steps(4); i++) {
    E.step(s, N);
    a.push(s.chute.wing.alpha);
  }
  // Off the slow drift: each sample less the mean of its second around it.
  const half = steps(0.5);
  const d = a.map((v, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(a.length, i + half);
    let m = 0;
    for (let j = lo; j < hi; j++) m += a[j];
    return v - m / (hi - lo);
  });
  const cross = [];
  for (let i = 1; i < d.length; i++) if (d[i - 1] > 0 && d[i] <= 0) cross.push(i * dt);
  return cross.length >= 2 ? 1 / (cross[1] - cross[0]) : NaN;
}

/** THE PHUGOID: the speed's long swing after a pushed start; the time
 * between its first two troughs. */
function phugoid() {
  const s = suit(4500, { speed: 55, fall: 13 });
  const lows = [];
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < steps(80) && lows.length < 2; i++) {
    E.step(s, N);
    const V = s.chute.airspeed;
    if (i > 2 && p1 < p2 && p1 < V) lows.push(i * dt);
    p2 = p1;
    p1 = V;
  }
  return lows.length >= 2 ? lows[1] - lows[0] : NaN;
}

/** A TURN on the full edge in the glide, over 6 s. */
function turn() {
  const s = suit(2500);
  for (let i = 0; i < steps(12); i++) E.step(s, N);
  const y0 = s.skier.y;
  let h = s.chute.heading;
  let turned = 0;
  for (let i = 0; i < steps(6); i++) {
    E.step(s, { ...N, steer: 1 });
    if (i < steps(1)) {
      h = s.chute.heading;
      continue;
    }
    const now = s.chute.heading;
    turned += Math.atan2(Math.sin(now - h), Math.cos(now - h));
    h = now;
  }
  return { rate: (turned * 180) / Math.PI / 5, sink: (y0 - s.skier.y) / 6 };
}

/** OFF THE EXIT on the seed's map: the drop and the seconds to flying. */
function exit(level) {
  const s = game(level, false);
  const ex = E.wingsuitExitOf(level);
  const y0 = s.skier.y;
  let t = NaN;
  let drop = NaN;
  let out = false;
  for (let i = 0; i < steps(25) && Number.isNaN(t) && !thrown(s); i++) {
    E.step(s, out ? N : { ...N, machine: true });
    out ||= s.chute.mode === "exit";
    if (out && s.chute.mode === "freefall") {
      t = s.chute.since;
      drop = y0 - s.skier.y;
    }
  }
  return { t, drop, hover: ex.hover, clear: ex.clear, thrown: thrown(s) };
}

/** OUT OF THE PLANE'S DOOR at the jump run's speed: the seconds until the
 * suit is full and flying its glide, and the height it cost. */
function plane() {
  const s = game(flat());
  E.planeAloft(s, {
    x: SIZE / 2,
    y: 3000,
    z: 1500,
    heading: 0,
    speed: E.PLANE.pilot.jumpRun,
    power: 0.5,
  });
  E.step(s, { ...N, machine: true });
  const y0 = s.skier.y;
  let t = NaN;
  let lost = NaN;
  for (let i = 0; i < steps(20) && Number.isNaN(t); i++) {
    E.step(s, N);
    const w = s.chute?.wing;
    if (s.chute?.mode === "freefall" && w && w.pressure >= 0.95) {
      t = s.chute.since;
      lost = y0 - s.skier.y;
    }
  }
  return { t, lost, suit: s.chute?.suit };
}

/** THE PULL from the glide at 600 m. */
function pull() {
  const s = suit(800);
  for (let i = 0; i < steps(30) && s.chute.agl > 600; i++) E.step(s, N);
  const y0 = s.skier.y;
  E.step(s, { ...N, machine: true });
  let full = NaN;
  let peak = 0;
  for (let i = 0; i < steps(10) && Number.isNaN(full); i++) {
    E.step(s, N);
    peak = Math.max(peak, s.chute.g ?? 0);
    if (said(s, "open")) full = s.chute.deploy.t;
  }
  return { full, lost: y0 - s.skier.y, peak: Math.max(peak, s.chute.peak ?? 0) };
}

/** THE BASE CANOPY hands off, settled 8 s, measured over 20 s. */
function canopy() {
  const s = suit(1000, { mode: "open" });
  for (let i = 0; i < steps(8); i++) E.step(s, N);
  const c = s.skier;
  const [x0, y0, z0] = [c.x, c.y, c.z];
  for (let i = 0; i < steps(20); i++) E.step(s, N);
  return { forward: Math.hypot(c.x - x0, c.z - z0) / 20, sink: (y0 - c.y) / 20 };
}

/** DOWN ON THE BOT'S PATTERN under the canopy, from 300 m. */
function land() {
  const s = suit(300, { mode: "open" });
  let sink = NaN;
  for (let i = 0; i < steps(200) && Number.isNaN(sink) && !thrown(s); i++) {
    const vy = s.skier.vy;
    E.step(s, E.wingsuitInput(s));
    if (s.chute?.mode === "landed") sink = -vy;
  }
  return { sink, thrown: thrown(s), foot: s.chute?.mode === "landed" };
}

/** A GLIDE flown at the map's edge: the nearest it came, m. */
function edge() {
  const s = suit(2500, { heading: Math.PI / 2 });
  s.skier.x = SIZE - 900;
  let near = Infinity;
  for (let i = 0; i < steps(90) && s.chute.mode === "freefall"; i++) {
    E.step(s, N);
    near = Math.min(near, SIZE - s.skier.x, s.skier.x, SIZE - s.skier.z, s.skier.z);
  }
  return near;
}

/** THE BOT'S WHOLE FLIGHT from the exit on the seed's map. */
function flight(level) {
  const s = game(level, false);
  const x0 = s.skier.x;
  const z0 = s.skier.z;
  let flown = 0;
  let px = x0;
  let pz = z0;
  let pullAgl = NaN;
  let land = null;
  let crashed = "";
  for (let i = 0; i < steps(400) && !land; i++) {
    E.step(s, E.wingsuitInput(s));
    const c = s.skier;
    for (const e of s.events) if (e.kind === "wipeout" && !crashed) crashed = e.cause;
    const ch = s.chute;
    if (!ch) continue;
    if (ch.mode === "exit" || ch.mode === "freefall") flown += Math.hypot(c.x - px, c.z - pz);
    px = c.x;
    pz = c.z;
    if (said(s, "open-start") && Number.isNaN(pullAgl)) pullAgl = ch.agl;
    if (ch.mode === "landed") land = { d: Math.hypot(c.x - x0, c.z - z0), y: c.y };
  }
  return { flown, pullAgl, land, crashed };
}

const level = E.generateLevel(args.seed, { quiet: true });
const G = glide();
const DV = dive();
const F = flare();
const SP = shortPeriod();
const PH = phugoid();
const T = turn();
const X = exit(level);
const P = plane();
const PU = pull();
const C = canopy();
const L = land();
const ED = edge();
const FL = flight(level);

const f1 = (v) => (v === null || v === undefined || Number.isNaN(v) ? "—" : Number(v).toFixed(1));
const rows = [
  { id: "glide-ratio", value: G.ratio, unit: ":1", band: "3.0–3.5", note: "hands off at 2,500 m" },
  {
    id: "glide-across",
    value: G.across * KMH,
    unit: "km/h",
    band: "150–190",
    note: "over the ground, no wind",
  },
  { id: "glide-sink", value: G.sink, unit: "m/s", band: "10–14", note: "" },
  {
    id: "dive-top",
    value: DV * KMH,
    unit: "km/h",
    band: "≥250",
    note: "arms swept, lean forward: the most air speed",
  },
  { id: "flare-gain", value: F.gain, unit: "m", band: "10–40", note: "out of an 8 s dive" },
  {
    id: "flare-sink",
    value: F.least,
    unit: "m/s",
    band: "<0",
    note: `the least sink — climbing — for ${f1(F.climb)} s`,
  },
  {
    id: "flare-held",
    value: F.held,
    unit: "m/s",
    band: ">10",
    note: `held on past its top: mushing${F.stalled ? ", stalled" : ""}`,
  },
  {
    id: "short",
    value: SP,
    unit: "Hz",
    band: "0.6–1.0",
    note: "the attack knocked 0.1 rad off trim",
  },
  { id: "phugoid", value: PH, unit: "s", band: "10–30", note: "the speed's long swing" },
  {
    id: "turn-rate",
    value: T.rate,
    unit: "°/s",
    band: "15–35",
    note: "the full edge in the glide",
  },
  {
    id: "turn-sink",
    value: T.sink,
    unit: "m/s",
    band: "12–25",
    note: "...sinking harder under the bank's load",
  },
  {
    id: "exit-drop",
    value: X.drop,
    unit: "m",
    band: "60–120",
    note: `seed ${args.seed}: ${X.hover > 0 ? `a hover ${X.hover} m over the edge` : "off the cliff"}, the arc clearing by ${f1(X.clear)} m${X.thrown ? "; THROWN" : ""}`,
  },
  { id: "exit-time", value: X.t, unit: "s", band: "4–7", note: "...to flying" },
  {
    id: "plane-time",
    value: P.t,
    unit: "s",
    band: "1–4",
    note: `out of the door (${P.suit ?? "no suit"}): the suit full, flying`,
  },
  { id: "plane-lost", value: P.lost, unit: "m", band: "<100", note: "...the height it cost" },
  {
    id: "pull-full",
    value: PU.full,
    unit: "s",
    band: "3–5",
    note: "thrown from the glide at 600 m",
  },
  { id: "pull-lost", value: PU.lost, unit: "m", band: "60–150", note: "...the height to full" },
  { id: "pull-g", value: PU.peak, unit: "g", band: "2–5", note: "...the peak load" },
  {
    id: "canopy-fwd",
    value: C.forward,
    unit: "m/s",
    band: "8–10",
    note: "the BASE canopy hands off",
  },
  { id: "canopy-sink", value: C.sink, unit: "m/s", band: "3.5–5", note: "" },
  {
    id: "land",
    value: L.sink,
    unit: "m/s",
    band: "<3",
    note: L.thrown ? "THROWN" : L.foot ? "on his boots under the bot's flare" : "DID NOT LAND",
  },
  { id: "edge", value: ED, unit: "m", band: ">0", note: "a glide flown at the map's edge" },
  {
    id: "flight",
    value: FL.flown,
    unit: "m",
    band: "",
    note: FL.land
      ? `seed ${args.seed}: flown in the suit, pulled ${f1(FL.pullAgl)} m over the snow, down ${f1(FL.land.d)} m from the exit at ${f1(FL.land.y)} m`
      : `seed ${args.seed}: ${FL.crashed ? `THROWN (${FL.crashed})` : "did not land"}`,
  },
];

const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const was = new Map((before?.rows ?? []).map((r) => [r.id, r.value]));
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
console.log(
  `wingsuit flight — the flat map; seed ${args.seed} for the exit and the whole flight\n`,
);
console.log(
  `${pad("row", 14)}${lpad("value", 9)} ${pad("unit", 5)}${pad("band", 9)}${before ? lpad("was", 9) + "  " : ""}note`,
);
for (const r of rows) {
  const old = was.get(r.id);
  const then = before ? lpad(old === undefined || old === null ? "—" : f1(old), 9) + "  " : "";
  console.log(
    `${pad(r.id, 14)}${lpad(f1(r.value), 9)} ${pad(r.unit, 5)}${pad(r.band, 9)}${then}${r.note}`,
  );
}
if (args.json) {
  writeFileSync(args.json, JSON.stringify({ seed: args.seed, rows }, null, 2));
  console.log(`\nwrote ${args.json}`);
}
