#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVE'S FLIGHT LAB (`make skydive-flight`): what the free ride's
// jump out of the plane's door (`engine/game/chute.ts`, the canopy's maths
// `canopy.ts`) does from the physics alone, flown by the REAL ENGINE in
// Node — the bot's hands (`chutePilot`, `skydiveInput`) or scripted keys,
// never a shortcut. Each row is one measurement, held to the class's band
// where it has one:
//
//   exit        out of the door at the jump run's speed: the seconds until
//               the air comes from under him (freefall)
//   v50, v95    from a standstill high up: the seconds to half and to 95 %
//               of the belly terminal speed
//   terminal    the belly-to-earth terminal speed near the snow and high up,
//               the head-down dive's (the tuck), and the track's (the lean
//               forward) glide and speed across
//   ff-time     the seconds of freefall from 4,000 m to the 1,000 m pull
//   open-*      the opening from the throw: line stretch, full inflation,
//               the height it cost and the peak load on the harness, g
//   canopy-*    hands off under the canopy: forward speed, sink and glide
//   turn-*      a toggle all the way down: a whole turn's seconds and the
//               sink in it; half way down, the rate
//   flare       the touchdown's sink under the bot's progressive flare, and
//               with the hands off
//   land        down on his skis under it: let go of, and skiing on
//   cutaway     cut away 400 m up: the canopy falling free to the snow, and
//               the jump begun again in the plane's door after his fall
//   snag-*      flown into a crown and onto a lift's rope: caught, hanging
//               over the snow; swung into the trunk; and the restart
//   edge-*      at the map's edge: a track toward it and a canopy flown at
//               it, how near either came
//   jump        on a generated map (`--seed`): the bot's whole jump — the
//               climb, the exit's height, the opening, where it landed
//
// The bands are the class's (the research the numbers came from): terminal
// 54–56 m/s low and 62–67 high, head down 85–90, a track's glide 0.5–1.0,
// the opening 3–4 s and 150–250 m at 3–6 g, line stretch 1–1.5 s, the
// canopy 10–13 m/s forward and 4–5 down, a glide of 2.5–3.
//
// Seconds, no browser, synthetic flat maps (`tests/support/synthetic.ts`);
// the jump and the lift snag on a generated map. Deterministic.
//
//   node scripts/skydive-flight-lab.mjs
//   node scripts/skydive-flight-lab.mjs --seed=38
//   node scripts/skydive-flight-lab.mjs --json=previews/skydive-before.json
//   node scripts/skydive-flight-lab.mjs --compare=previews/skydive-before.json

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
      help: "the generated map the whole jump and the lift snag are flown on",
    },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/skydive-flight-lab.mjs [--seed=N] [--json=file] [--compare=file]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));

const dt = E.TUNING.dt;
const SIZE = 4000;
const steps = (s) => Math.round(s / dt);
const N = E.NEUTRAL_INPUT;
const flat = () => S.flatLevel({ size: SIZE });
const game = (level) => E.createGame({ level, mode: "free", plane: true, crowd: 0, quiet: true });
/** A ride stood at `agl` m in freefall (or `mode`) over the flat map. */
function dive(agl, at = {}) {
  const s = game(flat());
  E.skydiveAt(s, { x: SIZE / 2, z: SIZE / 2 - 1000, agl, ...at });
  return s;
}
/** Every chute event of the step. */
const said = (s, phase) => s.events.some((e) => e.kind === "chute" && e.phase === phase);

/** THE EXIT: out of the door at the jump run's speed, 2,500 m up. */
function exit() {
  const s = game(flat());
  E.planeAloft(s, {
    x: SIZE / 2,
    y: 2500,
    z: 800,
    heading: 0,
    speed: E.PLANE.pilot.jumpRun,
    power: 0.5,
  });
  E.step(s, { ...N, machine: true });
  let t = NaN;
  for (let i = 0; i < steps(15) && Number.isNaN(t); i++) {
    E.step(s, N);
    if (s.chute?.mode === "freefall") t = s.chute.since;
  }
  return t;
}

/** From a standstill 4,000 m up, belly to earth: the seconds to half and
 * 95 % of the terminal speed, the freefall to 1,000 m, the terminal there. */
function fall() {
  const s = dive(4000);
  let v50 = NaN;
  let v95 = NaN;
  let to1000 = NaN;
  let low = 0;
  // The terminal speed it settles at, read once it has: the speed at 1,000 m.
  for (let i = 0; i < steps(120) && Number.isNaN(to1000); i++) {
    E.step(s, N);
    const v = s.chute.fall;
    if (Number.isNaN(v50) && v >= 0.5 * 62) v50 = s.chute.since;
    if (Number.isNaN(v95) && v >= 0.95 * 62) v95 = s.chute.since;
    if (s.chute.agl <= 1000) {
      to1000 = s.chute.since;
      low = v;
    }
  }
  return { v50, v95, to1000, low };
}

/** The steady fall at `agl` m in a body held by `input` (and its glide). */
function terminal(agl, input = N) {
  const s = dive(agl + 900, { fall: 50 });
  for (let i = 0; i < steps(60) && s.chute.agl > agl; i++) E.step(s, input);
  const c = s.skier;
  const across = Math.hypot(c.vx, c.vz);
  return { fall: -c.vy, across, glide: across / Math.max(0.1, -c.vy) };
}

/** THE OPENING thrown at 1,000 m from terminal. */
function opening() {
  const s = dive(1150, { fall: 55 });
  for (let i = 0; i < steps(10) && s.chute.agl > 1000; i++) E.step(s, N);
  const y0 = s.skier.y;
  E.step(s, { ...N, machine: true });
  let stretch = NaN;
  let full = NaN;
  for (let i = 0; i < steps(10) && Number.isNaN(full); i++) {
    E.step(s, N);
    if (said(s, "line-stretch")) stretch = s.chute.deploy.t;
    if (said(s, "open")) full = s.chute.deploy.t;
  }
  const lost = y0 - s.skier.y;
  // The peak read through the canopy's first moments flying.
  for (let i = 0; i < steps(1.5); i++) E.step(s, N);
  return { stretch, full, lost, peak: s.chute.peak };
}

/** The canopy flown hands off (or on `input`) for `seconds` after 8 s to
 * settle: its forward speed, sink and glide; and its turn, rad. */
function canopy(input = N, seconds = 20) {
  const s = dive(1500, { mode: "open" });
  for (let i = 0; i < steps(8); i++) E.step(s, N);
  const c = s.skier;
  const x0 = c.x;
  const z0 = c.z;
  const y0 = c.y;
  let turned = 0;
  let h = s.chute.canopyHeading;
  let whole = NaN;
  for (let i = 0; i < steps(seconds); i++) {
    E.step(s, input);
    const now = s.chute.canopyHeading;
    turned += Math.atan2(Math.sin(now - h), Math.cos(now - h));
    h = now;
    if (Number.isNaN(whole) && Math.abs(turned) >= 2 * Math.PI) whole = i * dt;
  }
  const across = Math.hypot(c.x - x0, c.z - z0);
  const sink = (y0 - c.y) / seconds;
  return {
    forward: Math.hypot(c.vx, c.vz),
    sink,
    glide: across / Math.max(0.01, y0 - c.y),
    rate: ((turned / seconds) * 180) / Math.PI,
    whole,
  };
}

/** Flown down to the snow on the bot's hands (or with the hands off): the
 * sink as the skis met it, and how he went on. */
function landing(flare) {
  const s = dive(300, { mode: "open" });
  let sink = NaN;
  let land = false;
  for (let i = 0; i < steps(120) && !land; i++) {
    const before = -s.skier.vy;
    const hands = flare ? E.chutePilot(s) : N;
    E.step(s, { ...hands, steer: 0 });
    if (said(s, "land")) {
      land = true;
      sink = before;
    }
  }
  for (let i = 0; i < steps(2); i++) E.step(s, N);
  return {
    sink,
    land,
    on: !s.skier.thrown && s.chute.done && s.skier.speed > 0.5 && !!s.chute.piece,
    speed: s.skier.speed,
  };
}

/** CUT AWAY 400 m up: the canopy free to the snow; he, falling on, is
 * thrown at the bottom, and begun again in the door. */
function cutaway() {
  const s = dive(400, { mode: "open" });
  for (let i = 0; i < steps(2); i++) E.step(s, N);
  E.step(s, { ...N, machine: true });
  const piece = s.chute.piece;
  const p0 = { x: piece.x, z: piece.z };
  let sink = NaN;
  let back = NaN;
  for (let i = 0; i < steps(120) && Number.isNaN(back); i++) {
    E.step(s, N);
    if (i === steps(8)) sink = -piece.vy;
    if (s.plane?.rider) back = (i + 1) * dt;
  }
  return { sink, drift: Math.hypot(piece.x - p0.x, piece.z - p0.z), back };
}

/** INTO A CROWN: a canopy flown at a lone tree, caught, hanging, swung,
 * and begun again. */
function snagTree() {
  const tree = { x: SIZE / 2, z: 700, y: 0, height: 18, radius: 0.4, crown: 3 };
  const level = S.shapedLevel(() => 0, { size: SIZE, cell: 10, trees: [tree] });
  const s = game(level);
  E.skydiveAt(s, { x: tree.x, z: tree.z - 70, agl: 30, heading: 0, mode: "open" });
  let caught = false;
  let hits = 0;
  let low = Infinity;
  for (let i = 0; i < steps(25); i++) {
    E.step(s, N);
    if (said(s, "snag")) caught = true;
    hits += s.events.filter((e) => e.kind === "hit").length;
    if (caught) low = Math.min(low, s.chute.agl);
  }
  const on = s.chute.snag?.on ?? "—";
  E.step(s, { ...N, reset: true });
  return { caught, on, low, hits, back: !!s.plane?.rider && !s.chute };
}

/** ONTO A LIFT'S ROPE on the generated map: the canopy flown down across its
 * longest lift's up rope, mid-way along the line. */
function snagLift() {
  const level = E.generateLevel(args.seed);
  const s = game(level);
  const plans = E.liftPlans(level).filter((p) => p.lift.kind !== "drag");
  if (!plans.length) return { caught: false, on: "no lift" };
  const plan = plans.reduce((a, b) => (b.length > a.length ? b : a));
  const u = plan.length * 0.5;
  const r = E.upRope(plan);
  const rx = plan.lift.bottom.x + plan.dx * u + plan.dz * r;
  const rz = plan.lift.bottom.z + plan.dz * u - plan.dx * r;
  const rope = E.ropeAt(plan, u);
  // Flown square across the line toward the rope, the canopy at its height.
  const across = Math.atan2(-plan.dz, plan.dx);
  // Started 12 m over the rope and back along the glide, so the canopy comes
  // down onto it.
  const over = 12;
  const back = over * (E.CHUTE.flies.forward / E.CHUTE.flies.sink);
  const x = rx - Math.sin(across) * back;
  const z = rz - Math.cos(across) * back;
  const agl = rope + over - E.CHUTE.canopy.lines - level.groundAt(x, z) - s.skier.spec.cogHeight;
  E.skydiveAt(s, { x, z, agl, heading: across, mode: "open" });
  let caught = false;
  for (let i = 0; i < steps(12) && !caught; i++) {
    E.step(s, N);
    if (said(s, "snag")) caught = true;
  }
  return { caught, on: s.chute?.snag?.on ?? "—", agl: s.chute?.agl ?? NaN };
}

/** AT THE MAP'S EDGE: tracking at it from 2,500 m, and a canopy flown at it
 * from 800 m: how near either came. */
function edge() {
  const s = dive(2500, { x: SIZE - 300, heading: Math.PI / 2, fall: 50 });
  let track = SIZE;
  for (let i = 0; i < steps(40) && s.chute.mode !== "deploying"; i++) {
    E.step(s, { ...N, lean: -1 });
    track = Math.min(track, SIZE - s.skier.x);
  }
  const t = dive(800, { x: SIZE - 300, heading: Math.PI / 2, mode: "open" });
  let fly = SIZE;
  for (let i = 0; i < steps(120) && !t.chute.done; i++) {
    E.step(t, N);
    fly = Math.min(fly, SIZE - t.skier.x);
  }
  return { track, fly };
}

/** THE BOT'S WHOLE JUMP on the generated map. */
function jump() {
  const level = E.generateLevel(args.seed);
  const s = game(level);
  const strip = E.airstripOf(level);
  let out = NaN;
  let open = NaN;
  let land = null;
  for (let i = 0; i < steps(1500) && !land; i++) {
    E.step(s, E.skydiveInput(s));
    if (said(s, "exit")) out = s.chute.agl || s.skier.y - level.groundAt(s.skier.x, s.skier.z);
    if (said(s, "open")) open = s.chute.agl;
    if (said(s, "land")) land = { t: s.t, d: Math.hypot(s.skier.x - strip.x, s.skier.z - strip.z) };
    if (s.skier.thrown) break;
  }
  return { out, open, land, thrown: !!s.skier.thrown };
}

const X = exit();
const FALL = fall();
const LOW = terminal(300);
const HIGH = terminal(3800);
const HEAD = terminal(1500, { ...N, tuck: 1 });
const TRACK = terminal(1500, { ...N, lean: -1 });
const O = opening();
const C = canopy();
const T1 = canopy({ ...N, steer: 1 }, 12);
const T5 = canopy({ ...N, steer: 0.5 }, 12);
const FL = landing(true);
const NF = landing(false);
const CUT = cutaway();
const TREE = snagTree();
const LIFT = snagLift();
const EDGE = edge();
const J = jump();

const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");
const rows = [
  { id: "exit", value: X, unit: "s", band: "8–10", note: "out of the door to the air from below" },
  { id: "v50", value: FALL.v50, unit: "s", band: "≈3", note: "from a standstill, 4,000 m up" },
  { id: "v95", value: FALL.v95, unit: "s", band: "≈10", note: "...to 95 % of 62 m/s" },
  { id: "terminal", value: LOW.fall, unit: "m/s", band: "54–56", note: "belly, 300 m up" },
  { id: "terminal-high", value: HIGH.fall, unit: "m/s", band: "62–67", note: "belly, 3,800 m up" },
  { id: "head-down", value: HEAD.fall, unit: "m/s", band: "85–90", note: "the tuck, 1,500 m up" },
  {
    id: "track",
    value: TRACK.glide,
    unit: ":1",
    band: "0.5–1",
    note: `the lean forward: ${f1(TRACK.across)} m/s across, ${f1(TRACK.fall)} down`,
  },
  {
    id: "ff-time",
    value: FALL.to1000,
    unit: "s",
    band: "50–60",
    note: "4,000 m to 1,000 m (the research's estimate 55–60)",
  },
  { id: "open-stretch", value: O.stretch, unit: "s", band: "1–1.5", note: "throw to line stretch" },
  { id: "open-full", value: O.full, unit: "s", band: "3–4", note: "throw to full inflation" },
  { id: "open-lost", value: O.lost, unit: "m", band: "150–250", note: "height the opening cost" },
  { id: "open-g", value: O.peak, unit: "g", band: "3–6", note: "the opening shock, peak" },
  { id: "canopy-fwd", value: C.forward, unit: "m/s", band: "10–13", note: "hands off" },
  { id: "canopy-sink", value: C.sink, unit: "m/s", band: "4–5", note: "hands off" },
  { id: "canopy-glide", value: C.glide, unit: ":1", band: "2.5–3", note: "hands off" },
  {
    id: "turn-full",
    value: T1.whole,
    unit: "s",
    band: "",
    note: `a whole turn, one toggle down; ${f1(T1.sink)} m/s sink`,
  },
  { id: "turn-half", value: Math.abs(T5.rate), unit: "°/s", band: "", note: "half a toggle" },
  {
    id: "flare",
    value: FL.sink,
    unit: "m/s",
    band: "<2",
    note: `the bot's flare; hands off ${f1(NF.sink)} m/s`,
  },
  {
    id: "land",
    value: FL.speed,
    unit: "m/s",
    band: "",
    note: FL.on ? "let go of on the skis, skiing on" : "DID NOT ski on",
  },
  {
    id: "cutaway",
    value: CUT.back,
    unit: "s",
    band: "",
    note: `cut away 400 m up: thrown at the snow, in the door again; the canopy falls ${f1(CUT.sink)} m/s, drifted ${f1(CUT.drift)} m`,
  },
  {
    id: "snag-tree",
    value: TREE.low,
    unit: "m",
    band: ">0",
    note: `${TREE.caught ? `caught on a ${TREE.on}` : "NOT caught"}, the trunk met ${TREE.hits}×; reset ${TREE.back ? "to the door" : "DID NOT restart"}`,
  },
  {
    id: "snag-lift",
    value: LIFT.agl ?? NaN,
    unit: "m",
    band: ">0",
    note: LIFT.caught ? `caught on a ${LIFT.on}` : `NOT caught (${LIFT.on})`,
  },
  { id: "edge-track", value: EDGE.track, unit: "m", band: ">0", note: "tracking at the edge" },
  { id: "edge-canopy", value: EDGE.fly, unit: "m", band: ">0", note: "a canopy flown at it" },
  {
    id: "jump",
    value: J.land ? J.land.d : NaN,
    unit: "m",
    band: "",
    note: J.land
      ? `seed ${args.seed}: out ${f1(J.out)} m up, open ${f1(J.open)} m, down ${f1(J.land.d)} m from the strip's middle`
      : `seed ${args.seed}: ${J.thrown ? "THROWN" : "did not land"}`,
  },
];

const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const was = new Map((before?.rows ?? []).map((r) => [r.id, r.value]));
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
console.log(`skydive flight — the flat map; seed ${args.seed} for the jump and the lift\n`);
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
