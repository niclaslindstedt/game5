#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE'S FLIGHT LAB (`make plane-flight`): what the free ride's
// plane (`engine/game/plane.ts`, the air on it `plane-aero.ts`) does from
// the physics alone, flown by the REAL ENGINE in Node — the bot's hands
// (`planeInput`, `planeHold`) or a scripted stick, never a shortcut. Each
// row is one measurement, held to the class's band where it has one:
//
//   roll      the take-off roll on the strip, m, flown by the bot (half
//             flap, full power), against the strip laid for it
//             (`STRIP_LENGTH`) — and the speed it flies off at, kt
//   climb     the climb at the best-climb speed on full power, m/s
//   top       the level speed on full power near the valley floor, kt
//   stall     the speed the wing lets go at, slowed a knot a second in
//             level flight on idle, kt — clean, and with full flap
//   recover   the stall flown out: the stick let forward, the height it
//             cost, m, and the seconds back to flying
//   loop      a loop on full power and the stick held back from a dive's
//             speed: the entry speed, kt, the height gained over the top,
//             m, the slowest over the top, kt, and whether it came round
//   roll-rate the steadiest roll rate on full aileron at the jump run's
//             cruise, °/s, and the seconds to roll all the way round
//   glide     the glide on idle at the best-glide speed: the ratio
//   bounds    flown at the map's edge and held toward it: how near the
//             edge it came, m, and whether the bounds turned it back
//
// The bands (the class's figures): the stall 52–58 kt, the climb ≈5 m/s,
// the top speed 115–125 kt, the roll 200–300 m on packed snow.
//
// Seconds, no browser, a synthetic flat map (`tests/support/synthetic.ts`'s
// `flatLevel`, 4 km, packed); `--seed` flies the roll on a generated map's
// own strip instead. Deterministic: the same flags print the same table.
//
//   node scripts/plane-flight-lab.mjs
//   node scripts/plane-flight-lab.mjs --seed=38
//   node scripts/plane-flight-lab.mjs --json=previews/plane-before.json
//   node scripts/plane-flight-lab.mjs --compare=previews/plane-before.json

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
      default: 0,
      help: "fly the take-off on this generated map's strip (0: the flat map)",
    },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/plane-flight-lab.mjs [--seed=N] [--json=file] [--compare=file]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));

const dt = E.TUNING.dt;
const KT = 1.943844;
const SIZE = 4000;
const flat = () => S.flatLevel({ size: SIZE });
const game = (level) => E.createGame({ level, mode: "free", plane: true, crowd: 0, quiet: true });
const steps = (s) => Math.round(s / dt);
/** One step with the plane flown on `controls`. */
const fly = (state, controls) => E.step(state, { ...E.NEUTRAL_INPUT, plane: controls });
const up = (state, y = 800, speed = 45, heading = 0, power = 0.7) =>
  E.planeAloft(state, { x: SIZE / 2, y, z: SIZE / 2 - 1200, heading, speed, power });

/** THE TAKE-OFF ROLL: the bot off the strip, the distance from the start
 * to the step the last ski left the snow for good. */
function takeoff() {
  const level = args.seed ? E.generateLevel(args.seed) : flat();
  const strip = E.airstripOf(level);
  const state = game(level);
  let off = null;
  let speed = 0;
  for (let i = 0; i < steps(40) && !off; i++) {
    E.step(state, E.planeInput(state));
    const p = state.plane;
    for (const e of state.events) {
      if (e.kind === "plane" && e.phase === "liftoff") {
        off = Math.hypot(p.x - strip.start.x, p.z - strip.start.z);
        speed = e.speed;
      }
    }
  }
  return { roll: off ?? NaN, off: speed * KT, strip: E.STRIP_LENGTH };
}

/** THE CLIMB at the best-climb speed, full power, from 200 m. */
function climb() {
  const state = game(flat());
  up(state, 200, E.PLANE.pilot.climb, 0, 1);
  const want = { heading: 0, height: 0, speed: E.PLANE.pilot.climb, flaps: 0, climb: true };
  for (let i = 0; i < steps(20); i++) fly(state, E.planeHold(state, want));
  const y0 = state.plane.y;
  for (let i = 0; i < steps(30); i++) fly(state, E.planeHold(state, want));
  return (state.plane.y - y0) / 30;
}

/** THE TOP SPEED, level on full power at `height` m. */
function top(height) {
  const state = game(flat());
  up(state, height, 55, Math.PI / 2, 1);
  const p = state.plane;
  let heading = Math.PI / 2;
  for (let i = 0; i < steps(150); i++) {
    // To and fro across the map, so it never meets the edge.
    if (p.x > SIZE - 900) heading = -Math.PI / 2;
    if (p.x < 900) heading = Math.PI / 2;
    fly(state, E.planeHold(state, { heading, height, speed: 200, flaps: 0 }));
  }
  return p.airspeed * KT;
}

/** THE STALL: level at 800 m on idle, slowed until the wing lets go; then
 * the stick let forward, the power on, and the flight back. */
function stall(flaps) {
  const state = game(flat());
  up(state, 800, 40, 0, E.PLANE.engine.idle);
  const p = state.plane;
  let at = NaN;
  // Trimmed level at 38 m/s on the bot's hand, then the power off and the
  // stick eased back a share a second on its own (no hand easing it off the
  // stall), the wings on the bot's ailerons: it slows to the break. The
  // stall speed is the slowest it flew before the wing let go.
  let stick = 0;
  for (let i = 0; i < steps(12); i++) {
    const c = E.planeHold(state, { heading: 0, height: 800, speed: 38, flaps });
    stick = c.pitch;
    fly(state, c);
  }
  let slowest = p.airspeed;
  for (let i = 0; i < steps(90) && Number.isNaN(at); i++) {
    stick = Math.max(-1, stick - 0.02 * dt);
    const c = E.planeHold(state, { heading: 0, height: 800, speed: 30, flaps });
    fly(state, { throttle: 0, pitch: stick, roll: c.roll, yaw: c.yaw, flaps });
    slowest = Math.min(slowest, p.airspeed);
    for (const e of state.events) if (e.kind === "plane" && e.phase === "stall") at = slowest;
  }
  // Held in the stall a second, then flown out.
  for (let i = 0; i < steps(1); i++) fly(state, { throttle: 0, pitch: -1, roll: 0, yaw: 0, flaps });
  const y0 = p.y;
  let back = NaN;
  let lowest = p.y;
  for (let i = 0; i < steps(30) && Number.isNaN(back); i++) {
    // The bot's hand: the stall flown out (`planeHold`), then level.
    fly(state, E.planeHold(state, { heading: p.heading, height: p.y + 30, speed: 40, flaps }));
    lowest = Math.min(lowest, p.y);
    if (p.stalled < 0.05 && p.vy > 0) back = i * dt;
  }
  return { at: at * KT, lost: y0 - lowest, back };
}

/** THE LOOP: at a dive's entry speed, full power and a pilot's pull — the
 * stick back to hold the wing just under its stall (a pull to the buffet,
 * never through it), the wings held level; came round once the nose has
 * turned all the way over. */
function loop() {
  const state = game(flat());
  const entry = 62;
  up(state, 900, entry, 0, 1);
  const p = state.plane;
  const y0 = p.y;
  let turned = 0;
  let high = p.y;
  let slow = p.airspeed;
  for (let i = 0; i < steps(25) && turned < 2 * Math.PI; i++) {
    const pull = Math.max(-1, Math.min(1, 6 * (p.aoa - 0.19)));
    const level = Math.max(-1, Math.min(1, 1.5 * p.wz));
    fly(state, { throttle: 1, pitch: pull, roll: level, yaw: 0, flaps: 0, trim: 0 });
    turned += -p.wx * dt;
    high = Math.max(high, p.y);
    slow = Math.min(slow, p.airspeed);
  }
  return { entry: entry * KT, gained: high - y0, slow: slow * KT, done: turned >= 2 * Math.PI };
}

/** THE ROLL RATE on full aileron at the jump run's cruise. */
function rollRate() {
  const state = game(flat());
  up(state, 900, 58, 0, 1);
  const p = state.plane;
  let most = 0;
  let turned = 0;
  let round = NaN;
  // Nose up 20° first (an aileron roll's pull), then the stick let to the
  // middle and the aileron full over.
  for (let i = 0; i < steps(3) && p.pitch < 0.35; i++) {
    fly(state, {
      throttle: 1,
      pitch: Math.max(-1, 6 * (p.aoa - 0.16)),
      roll: 0,
      yaw: 0,
      flaps: 0,
      trim: 0,
    });
  }
  for (let i = 0; i < steps(12) && Number.isNaN(round); i++) {
    fly(state, { throttle: 1, pitch: 0, roll: 1, yaw: 0.3, flaps: 0, trim: 0 });
    most = Math.max(most, -p.wz);
    turned += -p.wz * dt;
    if (turned >= 2 * Math.PI) round = i * dt;
  }
  return { rate: (most * 180) / Math.PI, round };
}

/** THE GLIDE on idle at the best-glide speed, clean. */
function glide() {
  const state = game(flat());
  up(state, 1500, 36, 0, E.PLANE.engine.idle);
  const p = state.plane;
  const want = { heading: 0, height: 0, speed: 34, flaps: 0, climb: true, throttle: 0 };
  for (let i = 0; i < steps(15); i++) fly(state, E.planeHold(state, want));
  const x0 = p.x;
  const z0 = p.z;
  const y0 = p.y;
  for (let i = 0; i < steps(30); i++) fly(state, E.planeHold(state, want));
  return Math.hypot(p.x - x0, p.z - z0) / Math.max(0.01, y0 - p.y);
}

/** THE BOUNDS: flown straight at the map's edge and held toward it. */
function bounds() {
  const state = game(flat());
  up(state, 300, 50, Math.PI / 2, 0.8);
  const p = state.plane;
  let nearest = SIZE;
  let back = false;
  for (let i = 0; i < steps(120); i++) {
    fly(state, E.planeHold(state, { heading: Math.PI / 2, height: 300, speed: 50, flaps: 0 }));
    nearest = Math.min(nearest, SIZE - p.x, p.x, SIZE - p.z, p.z);
    if (p.x > SIZE - 600 && p.vx < 0) back = true;
  }
  return { nearest, back };
}

const R = takeoff();
const C = climb();
const T = top(300);
const T2 = top(2500);
const clean = stall(0);
const full = stall(1);
const L = loop();
const RR = rollRate();
const G = glide();
const B = bounds();

const rows = [
  {
    id: "roll",
    value: R.roll,
    unit: "m",
    band: "200–300",
    note: `strip ${R.strip} m, off at ${R.off.toFixed(0)} kt`,
  },
  { id: "climb", value: C, unit: "m/s", band: "≈5", note: `at ${E.PLANE.pilot.climb} m/s` },
  { id: "top", value: T, unit: "kt", band: "", note: "level, full power, 300 m" },
  {
    id: "top-high",
    value: T2,
    unit: "kt",
    band: "115–125",
    note: "level, full power, 2500 m (true)",
  },
  { id: "stall-clean", value: clean.at, unit: "kt", band: "52–58", note: "idle, flaps up" },
  { id: "stall-flaps", value: full.at, unit: "kt", band: "<52", note: "idle, full flap" },
  {
    id: "recover",
    value: clean.lost,
    unit: "m",
    band: "",
    note: `back to flying in ${clean.back.toFixed(1)} s`,
  },
  {
    id: "loop",
    value: L.gained,
    unit: "m",
    band: "",
    note: `entry ${L.entry.toFixed(0)} kt, top ${L.slow.toFixed(0)} kt, ${L.done ? "came round" : "DID NOT come round"}`,
  },
  {
    id: "roll-rate",
    value: RR.rate,
    unit: "°/s",
    band: "",
    note: `all the way round in ${RR.round.toFixed(1)} s`,
  },
  { id: "glide", value: G, unit: ":1", band: "", note: "idle, clean, 34 m/s" },
  {
    id: "bounds",
    value: B.nearest,
    unit: "m",
    band: ">0",
    note: B.back ? "turned back" : "DID NOT turn back",
  },
];

const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const was = new Map((before?.rows ?? []).map((r) => [r.id, r.value]));
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
console.log(`plane flight — ${args.seed ? `seed ${args.seed}'s strip` : "the flat map"}\n`);
console.log(
  `${pad("row", 12)}${lpad("value", 9)} ${pad("unit", 5)}${pad("band", 9)}${before ? lpad("was", 9) + "  " : ""}note`,
);
for (const r of rows) {
  const old = was.get(r.id);
  const then = before ? lpad(old === undefined ? "—" : old.toFixed(1), 9) + "  " : "";
  console.log(
    `${pad(r.id, 12)}${lpad(r.value.toFixed(1), 9)} ${pad(r.unit, 5)}${pad(r.band, 9)}${then}${r.note}`,
  );
}
if (args.json) {
  writeFileSync(args.json, JSON.stringify({ seed: args.seed, rows }, null, 2));
  console.log(`\nwrote ${args.json}`);
}
