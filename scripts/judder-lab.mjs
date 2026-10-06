#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUDDER LAB — how smoothly a free ride's MACHINE (the snowmobile or the
// helicopter) and its RIDER are drawn from frame to frame. The engine steps
// at 120 Hz and the display draws at whatever it draws at, so every frame is
// drawn part of the way between two steps (`interp.ts`, `alpha`); the rider
// and the machine he stands on are each drawn that way, and if they are not
// drawn on the SAME line between the SAME two steps they part between frames
// — the machine shakes under him at the frame rate, a flicker, while the
// engine's own pose is as smooth as a rail. This lab is that renderer's
// clock without the picture: the bot rides the machine up the mountain
// (`sledPilot`, `pilotInput`), the app's run clock (the framework's
// `loop/run-clock`, as `App.tsx` drives it) is fed frame times at each
// `--fps` with a wobble a real display has, and each frame both bodies are
// drawn by the game's own `observe` / `sample` (`pwa/src/game/interp.ts`,
// which `sled-view.ts` and `heli-view.ts` draw the machines by). Pure Node,
// no build, no browser, seconds.
//
// What a frame is measured by, against the IDEAL frame — the engine's own
// poses on each side of it, blended by its `alpha`:
//
//   err    how far the machine is drawn from where it was, cm
//   slide  how far the rider is drawn off his place ON the machine (his
//          drawn position in the drawn machine's frame, against the same in
//          the ideal frame), cm — the shake seen between the two
//   judder how much `err` changes from one frame to the next, cm — a steady
//          lag is no shake; a lag that jumps every frame is
//
// One row an `--fps`, and a picture (previews/judder-<machine>-<seed>.png):
// a band a frame rate, the machine's error along its way, the rider's slide
// and the steps each frame took, frame by frame over the window.
//
//   node scripts/judder-lab.mjs                       # the snowmobile on 38
//   node scripts/judder-lab.mjs --machine=heli --fps=60,45
//   node scripts/judder-lab.mjs --json=a.json         # before a change
//   node scripts/judder-lab.mjs --compare=a.json      # after it

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";
import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { createRunClock } from "@niclaslindstedt/oss-game-framework/loop/run-clock";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const I = await import(join(root, "pwa/src/game/interp.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map" },
    machine: { kind: "string", default: "sled", help: "sled (the snowmobile) or heli" },
    at: { kind: "number", default: 12, help: "seconds ridden by the bot before the window" },
    seconds: { kind: "number", default: 1.5, help: "the window measured and drawn, s" },
    fps: {
      kind: "list",
      default: [60, 50, 45, 30, 144],
      help: "the frame rates drawn at, one row each",
    },
    wobble: {
      kind: "number",
      default: 0.15,
      help: "how far a frame's time strays from 1/fps, as a share (a display's delivery)",
    },
    json: { kind: "string", help: "write the rows here (a before)" },
    compare: { kind: "string", help: "print each row beside the one in this file (an after)" },
  },
  "usage: npm run judder -- [--seed n] [--machine sled|heli] [--fps 60,45] [--json f | --compare f]",
);

if (args.machine !== "sled" && args.machine !== "heli") {
  console.error(`--machine is sled or heli, got "${args.machine}"`);
  process.exit(2);
}
const HZ = E.TUNING.physicsHz;
/** The frames drawn before the window opens, s. */
const LEAD = 0.25;
const level = E.generateLevel(args.seed);

/** The machine's pose as the views draw it. */
function machinePose(s) {
  if (args.machine === "sled") {
    const k = s.sled;
    return { x: k.x, y: k.y, z: k.z, q: { ...k.q } };
  }
  const h = s.heli;
  return { x: h.x, y: h.y, z: h.z, q: E.heliQuat(h) };
}
const riderPose = (s) => ({ x: s.skier.x, y: s.skier.y, z: s.skier.z, q: { ...s.skier.q } });
const input = (s) => (args.machine === "sled" ? E.sledPilot(s) : E.pilotInput(s));

/** The rider's place on the machine: his position in its frame. */
function onMachine(rider, machine) {
  return E.unrotate(machine.q, {
    x: rider.x - machine.x,
    y: rider.y - machine.y,
    z: rider.z - machine.z,
  });
}
const lerp = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
  q: I.nlerp(a.q, b.q, t, { x: 0, y: 0, z: 0, w: 1 }),
});
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** A fixed stream for the frames' wobble, so a row is the same row twice. */
function wobbler(seed) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return (x / 4294967296) * 2 - 1;
  };
}

/** One frame rate: the bot's ride, the window drawn frame by frame. */
function measure(fps) {
  const s = E.createGame({
    level,
    mode: "free",
    [args.machine]: true,
    crowd: 0,
    quiet: true,
  });
  for (let i = 0; i < Math.round((args.at - LEAD) * HZ); i++) E.step(s, input(s));
  if (args.machine === "sled" ? !s.sled?.rider : !s.heli?.rider) {
    throw new Error(`nobody is on the ${args.machine} ${args.at} s in on seed ${args.seed}`);
  }
  // Every step's true poses, by tick: the ideal frame is blended from them.
  const truth = new Map();
  const keep = () => truth.set(s.tick, { m: machinePose(s), r: riderPose(s) });
  keep();
  const clock = createRunClock(HZ);
  const wobble = wobbler(fps * 977 + 13);
  const riderTrack = I.createTrack();
  const machineTrack = I.createTrack();
  const drawnRider = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
  const drawnMachine = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
  const frames = [];
  // A lead-in drawn and not counted: the app has been drawing all along,
  // so the window opens on tracks that have seen frames before it.
  let shown = -LEAD;
  while (shown < args.seconds) {
    const dt = (1 / fps) * (1 + args.wobble * wobble());
    shown += dt;
    const steps = clock.frame(dt);
    for (let i = 0; i < steps; i++) {
      E.step(s, input(s));
      keep();
    }
    const alpha = clock.alpha();
    I.observe(riderTrack, riderPose(s), s.tick);
    I.sample(riderTrack, alpha, drawnRider);
    I.observe(machineTrack, machinePose(s), s.tick);
    I.sample(machineTrack, alpha, drawnMachine);
    const was = truth.get(s.tick - 1);
    const now = truth.get(s.tick);
    if (!was || shown <= 0) continue;
    const ideal = { m: lerp(was.m, now.m, alpha), r: lerp(was.r, now.r, alpha) };
    // The error along the machine's way, signed: behind is negative.
    const v = { x: now.m.x - was.m.x, y: now.m.y - was.m.y, z: now.m.z - was.m.z };
    const vn = Math.hypot(v.x, v.y, v.z) || 1;
    const along =
      ((drawnMachine.x - ideal.m.x) * v.x +
        (drawnMachine.y - ideal.m.y) * v.y +
        (drawnMachine.z - ideal.m.z) * v.z) /
      vn;
    frames.push({
      steps,
      err: dist(drawnMachine, ideal.m) * 100,
      along: along * 100,
      slide: dist(onMachine(drawnRider, drawnMachine), onMachine(ideal.r, ideal.m)) * 100,
      speed: vn * HZ,
    });
  }
  return frames;
}

const rms = (xs) => Math.sqrt(xs.reduce((a, x) => a + x * x, 0) / Math.max(1, xs.length));
const most = (xs) => xs.reduce((a, x) => Math.max(a, x), 0);

function summarise(fps, frames) {
  const errs = frames.map((f) => f.err);
  const slides = frames.map((f) => f.slide);
  const jumps = frames.slice(1).map((f, i) => Math.abs(f.along - frames[i].along));
  const steps = {};
  for (const f of frames) steps[f.steps] = (steps[f.steps] ?? 0) + 1;
  return {
    fps,
    frames: frames.length,
    speed: frames.reduce((a, f) => a + f.speed, 0) / Math.max(1, frames.length),
    steps,
    errRms: rms(errs),
    errMax: most(errs),
    slideRms: rms(slides),
    slideMax: most(slides),
    judder: rms(jumps),
  };
}

// THE PICTURE: a band a frame rate — the error along the way (blue), the
// rider's slide on the machine (red), and under them the steps each frame
// took (grey bars), on one shared centimetre scale.
const INK = {
  bg: [246, 249, 252],
  panel: [255, 255, 255],
  grid: [214, 224, 234],
  text: [30, 46, 64],
  dim: [120, 138, 156],
  along: [30, 90, 200],
  slide: [220, 50, 40],
  steps: [180, 190, 200],
};

function draw(results) {
  const W = 1200;
  const band = 170;
  const pad = 12;
  const head = 34;
  const d = createDrawing(W, head + results.length * (band + pad) + pad, INK.bg);
  d.text(
    `JUDDER  ${args.machine.toUpperCase()}  SEED ${args.seed}  AT ${args.at} S  WOBBLE ${args.wobble}`,
    pad,
    10,
    INK.text,
    2,
  );
  const key = W - pad - 330;
  d.text("MACHINE ALONG ITS WAY", key, 8, INK.along);
  d.text("RIDER OFF HIS PLACE ON IT", key, 18, INK.slide);
  d.text("STEPS A FRAME", key + 200, 8, INK.steps);
  const scale = Math.max(
    5,
    ...results.flatMap((r) => r.frames.map((f) => Math.max(Math.abs(f.along), f.slide))),
  );
  results.forEach((r, k) => {
    const y0 = head + k * (band + pad);
    const x0 = pad;
    const w = W - pad * 2;
    d.fillRect(x0, y0, w, band, INK.panel);
    d.rect(x0, y0, w, band, INK.grid);
    const s = r.summary;
    d.text(
      `${r.fps} FPS   ERR RMS ${s.errRms.toFixed(1)} CM   SLIDE RMS ${s.slideRms.toFixed(1)} CM   JUDDER ${s.judder.toFixed(1)} CM   ${s.speed.toFixed(1)} M/S`,
      x0 + 6,
      y0 + 6,
      INK.text,
    );
    d.text(`+-${scale.toFixed(0)} CM`, x0 + w - 80, y0 + 6, INK.dim);
    const top = y0 + 20;
    const plot = band - 52;
    const mid = top + plot / 2;
    const bars = y0 + band - 28;
    d.line(x0, mid, x0 + w, mid, INK.grid);
    const n = r.frames.length;
    const xAt = (i) => x0 + 4 + ((w - 8) * i) / Math.max(1, n - 1);
    const yAt = (cm) => mid - (cm / scale) * (plot / 2);
    for (let i = 0; i < n; i++) {
      const h = Math.min(4, r.frames[i].steps) * 6;
      d.fillRect(xAt(i) - 1, bars + 24 - h, 2, h, INK.steps);
    }
    d.text("STEPS", x0 + 6, bars + 2, INK.dim);
    d.polyline(
      r.frames.map((f, i) => [xAt(i), yAt(f.along)]),
      INK.along,
    );
    d.polyline(
      r.frames.map((f, i) => [xAt(i), yAt(f.slide)]),
      INK.slide,
    );
    for (let i = 0; i < n; i++) {
      d.disk(xAt(i), yAt(r.frames[i].along), 1.5, INK.along);
      d.disk(xAt(i), yAt(r.frames[i].slide), 1.5, INK.slide);
    }
  });
  return d;
}

const results = args.fps.map((fps) => {
  const frames = measure(fps);
  return { fps, frames, summary: summarise(fps, frames) };
});

const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const was = (fps) => before?.rows.find((r) => r.fps === fps);
const cell = (now, then) =>
  then === undefined ? now.toFixed(1) : `${then.toFixed(1)}→${now.toFixed(1)}`;
console.log(
  `judder: ${args.machine} on seed ${args.seed}, ${args.at} s in, ${args.seconds} s window, wobble ${args.wobble}`,
);
console.log(
  "fps   frames  m/s    steps/frame          err rms  err max  slide rms  slide max  judder (cm)",
);
for (const { summary: s } of results) {
  const b = was(s.fps);
  const steps = Object.entries(s.steps)
    .map(([k, v]) => `${k}:${v}`)
    .join(" ");
  console.log(
    [
      String(s.fps).padEnd(5),
      String(s.frames).padEnd(7),
      s.speed.toFixed(1).padEnd(6),
      steps.padEnd(20),
      cell(s.errRms, b?.errRms).padEnd(8),
      cell(s.errMax, b?.errMax).padEnd(8),
      cell(s.slideRms, b?.slideRms).padEnd(10),
      cell(s.slideMax, b?.slideMax).padEnd(10),
      cell(s.judder, b?.judder),
    ].join(" "),
  );
}

mkdirSync(join(root, "previews"), { recursive: true });
const file = join(root, "previews", `judder-${args.machine}-${args.seed}.png`);
writeFileSync(file, draw(results).toPng());
console.log(`wrote ${file}`);
if (args.json) {
  const out = {
    seed: args.seed,
    machine: args.machine,
    at: args.at,
    seconds: args.seconds,
    wobble: args.wobble,
    rows: results.map((r) => r.summary),
  };
  writeFileSync(args.json, JSON.stringify(out, null, 2));
  console.log(`wrote ${args.json}`);
}
