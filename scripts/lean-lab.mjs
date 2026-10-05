#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LEAN LAB (`make lean`): HOW SMOOTHLY THE SLALOM RACER LEANS. A slalom
// is a lean from one side to the other every turn — the body laid into
// one, swung across under the skis' crossing and laid into the next — and
// the eye reads every frame of it from the chase lens. This lab skis a
// slalom through the REAL ENGINE in Node and draws every frame the way the
// renderer draws it (`renderer.ts` → `skis-body.ts`'s `pose`): the app's
// run clock fed `--fps` frames (the framework's `loop/run-clock`), the
// body drawn between two steps (`interp.ts`), the legs' spring stepped a
// frame at a time, the pair laid on the snow (`standOf` at the drawn
// orientation's inclination, the chatter, the start's kick, the
// technique's stance), the pose (`poseInputOf`, `skierPose`) stood in the
// world on the drawn pivot. Pure Node, no build, no browser, seconds.
//
// Every frame is read as CHANNELS — one lean each, in degrees, seen from
// behind along the way he is going (+ toward his right) — in the order the
// motion is made, so a roughness that appears at one layer and not the one
// before it is that layer's:
//
//   ENGINE   incline  the body's roll against the snow (`SkierState.incline`)
//            balance  the lean the turn's forces ask for (`.balance`)
//            edge     the skis' edge (`.edge`)
//   SPRING   s.roll   the roll as the view's body carries it (`SkierSpring.roll`)
//            s.edge   the edge as it carries it
//            lead     the upper body's lead into the turn, × 45° (`leadOf`)
//   DRAWN    pair     the drawn pair's own up, in the world
//            legs     the boots' middle to the hips
//            body     the boots' middle to the centre of mass
//            trunk    the hips to the neck
//            head     the head's own up (its roll against the horizon)
//            angul    legs − trunk: the hinge at the hips
//
// Each channel is read for how a motion reads (`scripts/lib/lean-signal.mjs`):
//
//   amp      how far it swings, the 95th percentile of |lean|, °
//   rate     how fast, the 95th percentile of |rate|, °/s
//   acc      the 99th percentile of |acceleration|, °/s²
//   rough    the share of the rate's power above 5 Hz, % — a slalom's swing
//            and crossing are slow; a shiver, a kink or a snap is not
//   tp/turn  turning points (prominence 2°) a turn the engine's incline
//            makes: 1.00 is one swing a turn, more is a bump inside a turn
//   lag      how far the channel runs behind the engine's incline, ms, where
//            their rates line up best (and how well, `match`)
//
// and the whole run by `off`: how far the drawn body's lean stands from
// the lean the turn's forces ask for (`balance` eased over 0.1 s, both against the snow),
// RMS — a body leaning where no force holds him reads as posed.
//
// THE PICTURES: previews/lean.png, a row a run as the sag lab lays its rows
// — the figure from behind at the run's WORST frame (where a drawn part
// stands furthest off its own smoothed line), its neighbours 50 ms either
// side as ghosts, and the run's leans traced beside it; and
// previews/lean-<row>.png over a window (`--from`, `--window`; round the
// worst frame unless asked): the channels as strips with every gate passed
// marked, their rates, and what is left of each after the shiver's
// smoothing ×5 (a ripple shows there before anywhere); a STROBE of the
// figure from behind; and the PHASE PORTRAITS of the run — each drawn lean
// against its rate, which a smooth swing draws as a clean loop and a kink
// as a spike off it (`scripts/lib/lean-draw.mjs`).
//
// THE ROWS: `course-<seed>`, the seed's slalom (R31) skied by the bot under
// the slalom's own rules, from just after the start house's push to the
// finish — the run the player watches; and the STAGED MOMENTS on the open
// 20° pitch, the same turn every turn with no gate and no bot to stir it:
// `rhythm` (the ride lab's `slalom-rhythm`: full edge one way, then the
// other, every 0.9 s), `rhythm-fast` (0.7 s), `rhythm-slow` (1.2 s), and
// `cut` (one edge laid in and held: one ramp, then still).
//
// FINDING THE SOURCE: `--without=<stage>` draws without one thing the view
// lays on the pose (the chatter, the stance, the kick, the lead, the plant,
// the block, the transition, the spring, the interpolation); `--inputs`
// ranks every number the pose is handed (`SkierPoseInput`) by its own
// roughness; `--ease=<input>` puts named inputs through a 70 ms critically
// damped follower before he is posed — the input whose easing takes the
// shiver away is the one carrying it.
//
//   node scripts/lean-lab.mjs                          seed 38's slalom and every moment
//   node scripts/lean-lab.mjs --seed=38,7 --row=course
//   node scripts/lean-lab.mjs --fps=144                drawn at 144 Hz (between steps)
//   node scripts/lean-lab.mjs --technique=free         stood as the free skier
//   node scripts/lean-lab.mjs --row=rhythm --inputs    the pose's inputs, roughest first
//   node scripts/lean-lab.mjs --without=chatter --ease=roll
//   node scripts/lean-lab.mjs --from=12 --window=4     the detail's window
//   node scripts/lean-lab.mjs --turns                  every turn, a line each
//   node scripts/lean-lab.mjs --worst                  the frames that jerk hardest
//   node scripts/lean-lab.mjs --json=previews/lean-before.json
//   node scripts/lean-lab.mjs --compare=previews/lean-before.json

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { createRunClock } from "@niclaslindstedt/oss-game-framework/loop/run-clock";

import { leanDetail, leanSheet } from "./lib/lean-draw.mjs";
import { measurePose } from "./lib/skier-measure.mjs";
import {
  lagOf,
  percentile,
  rate,
  rms,
  roughness,
  smoothed,
  turningPoints,
} from "./lib/lean-signal.mjs";
import { TUCK, onPitch, schussStrip } from "./lib/ride-helpers.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = parseArgs(
  process.argv.slice(2),
  {
    row: {
      kind: "string",
      default: "all",
      help: "the rows: course (each --seed's slalom, the bot), the staged moments (rhythm, rhythm-fast, rhythm-slow, cut), or all",
    },
    seed: { kind: "string", default: "38", help: "the slalom maps, comma separated" },
    seconds: { kind: "number", default: 60, help: "the most of a course measured, s" },
    skis: { kind: "string", default: "swift", help: "the pair he skis on" },
    technique: {
      kind: "string",
      default: "slalom",
      help: "the riding technique he skis and is stood as (free, slalom, giantSlalom, …)",
    },
    fps: { kind: "number", default: 60, help: "the frame rate the run is drawn at" },
    from: {
      kind: "number",
      default: -1,
      help: "the detail's window starts here, s into the measured run (−1: round the run's worst frame)",
    },
    window: { kind: "number", default: 4, help: "the detail's window and a course row's trace, s" },
    without: {
      kind: "string",
      default: "",
      help: `stages of the drawing taken out, to find which one a roughness is (${"chatter, stance, kick, lead, plant, block, transit, spring, interp"})`,
    },
    ease: {
      kind: "string",
      default: "",
      help: "pose inputs (dotted, as --inputs names them: edge, roll, body.tilt, lift.0 …) eased by a 70 ms critically damped follower before he is posed — to prove an input carries a roughness",
    },
    inputs: {
      kind: "flag",
      default: false,
      help: "list the pose's own inputs by how rough each is",
    },
    turns: { kind: "flag", default: false, help: "list every turn, a line each" },
    worst: { kind: "flag", default: false, help: "list the frames that jerk hardest" },
    out: { kind: "string", default: "previews", help: "the directory the pictures go in" },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/lean-lab.mjs [--row=course,rhythm] [--seed=38,7] [--fps=60] [--technique=id] [--turns] [--worst] [--json=file] [--compare=file]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));
const P = await import(join(root, "pwa/src/game/skier-pose.ts"));
const G = await import(join(root, "pwa/src/game/skis-body.ts"));
const RIG = await import(join(root, "pwa/src/game/skier-rig.ts"));
const ST = await import(join(root, "pwa/src/game/ski-stand.ts"));
const FL = await import(join(root, "pwa/src/game/skier-flight.ts"));
const TP = await import(join(root, "pwa/src/game/technique-pose.ts"));
const I = await import(join(root, "pwa/src/game/interp.ts"));
const CH = await import(join(root, "pwa/src/game/ski-chatter.ts"));
const SS = await import(join(root, "pwa/src/game/slalom-start.ts"));

if (!(args.technique in TP.TECHNIQUE_POSES)) {
  console.error(
    `unknown technique "${args.technique}" (${Object.keys(TP.TECHNIQUE_POSES).join(", ")})`,
  );
  process.exit(2);
}
const spec = E.SKI_CATALOG.find((s) => s.id === args.skis);
if (!spec) {
  console.error(`unknown skis "${args.skis}" (${E.SKI_CATALOG.map((s) => s.id).join(", ")})`);
  process.exit(2);
}
/** THE STAGED MOMENTS, each skied by the engine on the synthetic 20°
 * groomed pitch (`ride-helpers.mjs`'s `schussStrip`) and read from `from`
 * s on: a slalom's linked turns at three tempos (the ride lab's own
 * `slalom-rhythm` at 0.9 s a turn — full edge one way, then the other, and
 * back toward the fall line past 50° off it), and one cut laid in and HELD,
 * whose lean is one ramp and then still. */
const rhythm = (period) => (t, st) => {
  const side = Math.floor(t / period) % 2 === 0 ? 1 : -1;
  const h = st.skier.heading;
  return { ...TUCK, tuck: 0.3, steer: Math.abs(h) > 0.9 ? -Math.sign(h) : side, carve: true };
};
const MOMENTS = [
  ...[
    ["rhythm", 0.9, 40],
    ["rhythm-fast", 0.7, 40],
    ["rhythm-slow", 1.2, 45],
  ].map(([id, period, kmh]) => ({
    id,
    say: `a turn every ${period} s cut hard from ${kmh} km/h down the 20° pitch`,
    level: (S) => schussStrip(S),
    place: () => onPitch(kmh),
    seconds: 9,
    from: 2,
    input: rhythm(period),
  })),
  {
    id: "cut",
    say: "full edge laid in at 45 km/h down the 20° pitch and held",
    level: (S) => schussStrip(S),
    place: () => onPitch(45),
    seconds: 2.5,
    from: 0.1,
    input: (t) => ({ ...TUCK, tuck: 0.3, steer: t >= 0.3 ? 1 : 0, carve: t >= 0.3 }),
  },
];
const MOMENT_IDS = MOMENTS.map((m) => m.id);
const rowIds = args.row === "all" ? ["course", ...MOMENT_IDS] : args.row.split(",").filter(Boolean);
for (const k of rowIds) {
  if (k !== "course" && !MOMENT_IDS.includes(k)) {
    console.error(`unknown row "${k}" (course, ${MOMENT_IDS.join(", ")}, all)`);
    process.exit(2);
  }
}
const moments = MOMENTS.filter((m) => rowIds.includes(m.id));
/** THE STAGES the drawing can be read without (`--without`), each one
 * thing `skis-body.ts` lays on the pose, so a roughness that goes when one
 * is taken out is that stage's. */
const STAGES = {
  chatter: "the skis' shake at speed (`ski-chatter.ts`)",
  stance: "the technique's stance (`widenStand`)",
  kick: "the start's kick (`kickStand`)",
  lead: "the upper body's lead into a turn (`leadOf`)",
  plant: "the turn's pole plant (`SkierSpring.plantT`)",
  block: "the cross-block at a gate (`gateBlock`)",
  transit: "the edge change's retraction and levelled trunk (`transitOf`)",
  spring:
    "the body's eased edge, roll and hips (`SkierPoseInput.body`, `.hipRight`): the engine's own instead",
  interp: "the drawing between two steps (`interp.ts`): the step's own orientation",
};
const without = new Set(args.without.split(",").filter(Boolean));
for (const k of without) {
  if (!(k in STAGES)) {
    console.error(`unknown stage "${k}" (${Object.keys(STAGES).join(", ")})`);
    process.exit(2);
  }
}
const eased = args.ease.split(",").filter(Boolean);
const mounts = G.mountsOf(spec);

/** THE POSE'S INPUTS as numbers: every number in `SkierPoseInput` one
 * level down (`body.tilt`, `lift.0`, `gait.splay.1` …), by dotted name. */
function inputNumbers(input, out = {}, at = "", depth = 0) {
  for (const [k, v] of Object.entries(input)) {
    if (k === "mounts" || k === "style" || k === "trick") continue;
    const name = at ? `${at}.${k}` : k;
    if (typeof v === "number") out[name] = v;
    else if (typeof v === "boolean") out[name] = v ? 1 : 0;
    else if (v && typeof v === "object" && depth < 2) inputNumbers(v, out, name, depth + 1);
  }
  return out;
}
/** A pose input by dotted name, read and written. */
function inputAt(input, name) {
  return name.split(".").reduce((o, k) => (o == null ? undefined : o[k]), input);
}
function setInput(input, name, value) {
  const keys = name.split(".");
  let o = input;
  for (let i = 0; i < keys.length - 1; i++) {
    // The input's arrays and objects may be shared with the state: copy.
    const v = o[keys[i]];
    if (v == null) return;
    o[keys[i]] = Array.isArray(v) ? [...v] : { ...v };
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = value;
}
/** How quickly an eased input follows, rad/s — the body's own spring's
 * (`skier-spring.ts`'s `HIP_FOLLOW`, some 70 ms). */
const EASE_FOLLOW = 30;
const DEG = 180 / Math.PI;
const HZ = E.TUNING.physicsHz;
const H = 1 / args.fps;

/** How wide the smoothing a SHIVER is read against is, s: a quarter of a
 * slalom's quickest crossing — what a body cannot do in less. */
const SHIVER = 0.025;

/** THE CHANNELS in the order the motion is made, each its layer, its ink
 * and how it is read off a frame (`f`). */
const CHANNELS = [
  { id: "incline", layer: "engine", ink: [90, 150, 240], get: (f) => f.incline },
  { id: "balance", layer: "engine", ink: [240, 210, 90], get: (f) => f.balance },
  { id: "edge", layer: "engine", ink: [120, 120, 200], get: (f) => f.edge },
  { id: "s.roll", layer: "spring", ink: [110, 180, 255], get: (f) => f.sRoll },
  { id: "s.edge", layer: "spring", ink: [150, 150, 230], get: (f) => f.sEdge },
  { id: "lead", layer: "spring", ink: [200, 120, 220], get: (f) => f.lead },
  { id: "pair", layer: "drawn", ink: [150, 156, 170], get: (f) => f.pair },
  { id: "legs", layer: "drawn", ink: [110, 220, 130], get: (f) => f.legs },
  { id: "body", layer: "drawn", ink: [250, 150, 90], get: (f) => f.body },
  { id: "trunk", layer: "drawn", ink: [255, 110, 90], get: (f) => f.trunk },
  { id: "head", layer: "drawn", ink: [240, 240, 245], get: (f) => f.head },
  { id: "angul", layer: "drawn", ink: [90, 220, 220], get: (f) => f.angul },
];

/** Vector arithmetic over plain `{ x, y, z }`. */
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
function rot(q, v) {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

/** THE RUN DRAWN, frame by frame: `state` stepped by the app's clock at
 * `--fps`, `inputOf(t, state)` its controls, and every frame laid and posed
 * as `skis-body.ts` lays and poses it. `measured(state)` says whether a
 * frame is read; `done(state)` ends the run. */
function drawRun(state, inputOf, { measured, done, seconds }) {
  const clock = createRunClock(HZ);
  const track = I.createTrack();
  const at = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
  const legs = P.createSkierSpring();
  const chatter = CH.createChatter();
  const stand = ST.emptyStand();
  const c = state.skier;
  const t0 = state.t;
  const frames = [];
  const gates = [];
  let owed = state.progress.nextCheckpoint;
  let first = null;
  const ease = new Map();
  for (let shown = 0; shown < seconds && !done(state); shown += H) {
    const steps = clock.frame(H);
    for (let i = 0; i < steps; i++) E.step(state, inputOf(state.t - t0, state));
    const alpha = clock.alpha();
    I.observe(track, c, state.tick);
    I.sample(track, without.has("interp") ? 1 : alpha, at);
    const waiting = P.inStartGate(state);
    const gravity = E.flightGravity(state.rules);
    // ...as `skis-body.ts`'s `pose` does it, line for line.
    P.stepSkierSpring(
      legs,
      c.vy,
      c.airborne,
      H,
      c.jumpLoad / E.TUNING.jump.full,
      c,
      waiting !== false,
      {
        read: c.airborne ? FL.flightRead(state.level, c, c.spec.cogHeight, gravity) : null,
        gravity,
      },
      G.legsLift(c),
    );
    if (c.thrown) {
      P.restSkierSpring(legs);
      continue;
    }
    const angle = P.drawnSkiAngle(legs, c);
    const ground = G.groundOf(c, legs);
    ST.standOf(c, ground, stand, ST.inclineAt(c, at.q), angle);
    CH.stepChatter(chatter, c, H);
    if (!without.has("chatter")) CH.shakeStand(stand, c, ground, chatter);
    if (!without.has("kick")) SS.kickStand(stand, c.launch);
    const ridden = TP.ridingOf(state, c);
    const riding = without.has("block") ? { ...ridden, block: TP.NO_BLOCK } : ridden;
    if (!without.has("stance")) TP.widenStand(stand, riding.style.stance, angle, c.skid, c.speed);
    const input = G.poseInputOf(c, legs, mounts, null, waiting, stand, riding);
    if (without.has("lead")) input.lead = 0;
    if (without.has("plant")) input.plantAt = undefined;
    if (without.has("transit")) input.swing = 0;
    if (without.has("spring")) {
      input.body = undefined;
      input.hipRight = c.hipRight;
    }
    for (const name of eased) {
      const to = inputAt(input, name);
      if (typeof to !== "number") continue;
      const e = ease.get(name) ?? { v: to, r: 0 };
      // Critically damped, sub-stepped as the body's own spring is.
      for (let n = 0, sub = Math.ceil(H * 240); n < sub; n++) {
        const h = H / sub;
        e.r += (EASE_FOLLOW * EASE_FOLLOW * (to - e.v) - 2 * EASE_FOLLOW * e.r) * h;
        e.v += e.r * h;
      }
      ease.set(name, e);
      setInput(input, name, e.v);
    }
    const pose = P.skierPose(input);
    // A gate taken since the last frame.
    const now = state.t - t0;
    if (state.progress.nextCheckpoint !== owed) {
      const k = state.progress.nextCheckpoint - 1;
      const cp = state.level.checkpoints[k];
      if (first !== null && cp) gates.push({ t: now - first, k, turn: cp.turn ?? 0 });
      owed = state.progress.nextCheckpoint;
    }
    if (!measured(state, now) || c.airborne) continue;
    first ??= now;
    const frame = readFrame(state, c, at, legs, stand, input, pose, riding, now - first);
    frame.inputs = inputNumbers(input);
    frames.push(frame);
  }
  return { frames, gates };
}

/** One drawn frame read: every channel, and what the worst list prints. */
function readFrame(state, c, at, legs, stand, input, pose, riding, t) {
  // The drawn body in the world: the root at the drawn place moved by the
  // pivot about the feet, turned by the drawn orientation.
  const pivot = rot(at.q, { x: stand.pivot.x, y: stand.pivot.y, z: 0 });
  const origin = add(at, pivot);
  const W = (v) => add(origin, rot(at.q, v));
  const m = measurePose(pose, {
    tilt: [0, 1].map((k) => (input.edge ?? 0) + (input.gait?.tilt?.[k] ?? 0)),
    turns: [0, 1].map((i) => (input.skiAngle ?? 0) + (input.gait?.splay[i] ?? 0)),
    hipHalf: P.BODY.hip,
    incline: stand.incline,
  });
  const head = RIG.skierBones(pose).head;
  // The view from behind: along the way he is going, flat; + to his right.
  const v = Math.hypot(c.vx, c.vz);
  const fwd =
    v > 0.2 ? { x: c.vx / v, y: 0, z: c.vz / v } : flatOf(rot(at.q, { x: 0, y: 0, z: 1 }));
  const bodyRight = rot(at.q, { x: 1, y: 0, z: 0 });
  let right = { x: fwd.z, y: 0, z: -fwd.x };
  if (dot(right, bodyRight) < 0) right = { x: -right.x, y: 0, z: -right.z };
  const lean = (d) => Math.atan2(dot(d, right), d.y) * DEG;
  const feet = W(mid(pose.feet[0], pose.feet[1]));
  const hips = W(pose.hips);
  const neck = W(pose.neck);
  const com = W(m.com);
  const legsLean = lean(sub(hips, feet));
  const trunkLean = lean(sub(neck, hips));
  // The snow's own lean across his way: its normal seen from behind.
  const n = { x: 0, y: 1, z: 0 };
  state.level.normalAt(c.x, c.z, n);
  const world = (k) => [0, 1].map((i) => W(pose[k][i]));
  return {
    t,
    incline: c.incline * DEG,
    balance: c.balance * DEG,
    edge: c.edge * DEG,
    sRoll: legs.roll * DEG,
    sEdge: legs.edge * DEG,
    lead: P.leadOf(legs) * 45,
    pair: lean(rot(at.q, { x: 0, y: 1, z: 0 })),
    legs: legsLean,
    body: lean(sub(com, feet)),
    trunk: trunkLean,
    head: lean(rot(at.q, head.y)),
    angul: legsLean - trunkLean,
    snow: lean(n),
    // What the worst list and the strobe read.
    speed: c.speed,
    transit: TP.transitOf(input.edge + (input.body?.roll ?? input.roll ?? 0), input.swing ?? 0),
    block: riding.block.w,
    plant: input.plantAt ? input.plantAt.t : null,
    skid: c.skid,
    gate: state.progress.nextCheckpoint,
    fig: {
      feet: world("feet"),
      knees: world("knees"),
      hips,
      waist: pose.waist ? W(pose.waist) : null,
      neck,
      head: W(pose.head),
      shoulders: world("shoulders"),
      elbows: world("elbows"),
      hands: world("hands"),
      poles: pose.poles ? world("poles") : null,
      com,
      right,
    },
  };
}

function flatOf(v) {
  const n = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / n, y: 0, z: v.z / n };
}

/** The rows asked for, each skied and drawn. */
const rows = [];
if (rowIds.includes("course")) {
  for (const seed of args.seed.split(",").filter(Boolean).map(Number)) {
    const state = E.createGame({
      seed,
      mode: "slalom",
      rivals: 0,
      countdown: 0,
      spec,
      technique: args.technique,
      quiet: true,
    });
    if (!state.level.slalom) {
      console.error(`seed ${seed} sets no slalom`);
      process.exit(2);
    }
    // Read from a moment after the start push (the clip's own) to the finish.
    const run = drawRun(state, (_t, st) => E.botInput(st, E.RIDER_BOT), {
      measured: (st) => st.progress.started && st.skier.launch > 1,
      done: (st) => st.progress.finished,
      seconds: args.seconds + 20,
    });
    const out = state.progress.out;
    rows.push({
      id: `course-${seed}`,
      say: `seed ${seed}'s slalom, the bot${out ? `, ${out.status} at gate ${out.gate} (${out.why})` : ""}`,
      ...run,
    });
  }
}
for (const m of moments) {
  const state = E.createGame({
    level: m.level(S),
    spec,
    rivals: 0,
    countdown: 0,
    technique: args.technique,
    quiet: true,
  });
  E.placeRun(state, m.place());
  const run = drawRun(state, m.input, {
    measured: (_st, now) => now >= m.from,
    done: () => false,
    seconds: m.seconds,
  });
  rows.push({ id: m.id, say: m.say, ...run });
}

/** A row's channels read. */
function readRow(r) {
  const f = r.frames;
  const ref = turningPoints(
    f.map((x) => x.incline),
    5,
  );
  const turns = Math.max(1, ref.length);
  const incline = f.map((x) => x.incline);
  const out = {};
  for (const ch of CHANNELS) {
    const x = f.map(ch.get);
    const v = rate(x, H);
    const a = rate(v, H);
    const lag = lagOf(incline, x, H);
    const sm = smoothed(x, H, SHIVER);
    out[ch.id] = {
      amp: percentile(x.map(Math.abs), 0.95),
      shiver: rms(x.map((v, i) => v - sm[i])),
      rate: percentile(v.map(Math.abs), 0.95),
      acc: percentile(a.map(Math.abs), 0.99),
      rough: roughness(x, H),
      tp: turningPoints(x, 2).length / turns,
      lag: lag.lag * 1000,
      match: lag.match,
    };
  }
  // The balance eased over a tenth of a second: the grip under the skis
  // flickers faster than any body could follow it.
  const balance = smoothed(
    f.map((x) => x.balance),
    H,
    0.1,
  );
  const off = rms(f.map((x, i) => x.body - x.snow - balance[i]));
  // THE WORST FRAME: where a drawn part stands furthest off its own
  // smoothed line — the shiver at its biggest.
  let worst = { i: 0, id: "trunk", by: 0 };
  for (const id of ["legs", "trunk", "head"]) {
    const ch = CHANNELS.find((c) => c.id === id);
    const x = f.map(ch.get);
    const sm = smoothed(x, H, SHIVER);
    x.forEach((v, i) => {
      if (Math.abs(v - sm[i]) > Math.abs(worst.by)) worst = { i, id, by: v - sm[i] };
    });
  }
  return {
    channels: out,
    off,
    turns: ref.length,
    frames: f.length,
    seconds: f.length * H,
    worst: { t: f[worst.i]?.t ?? 0, id: worst.id, by: worst.by, i: worst.i },
  };
}

for (const r of rows) r.read = readRow(r);

// THE TABLE: a block a row, a line a channel.
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const COLS = [
  ["amp", "amp°", 1],
  ["shiver", "shiver°", 2],
  ["rate", "rate°/s", 0],
  ["acc", "acc°/s²", 0],
  ["rough", "rough%", 1],
  ["tp", "tp/turn", 2],
  ["lag", "lag ms", 0],
  ["match", "match", 2],
];
const fmt = (v, d) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(d));
const w = before ? 16 : 9;
const pad = (s, n) => String(s).padStart(n);
console.log(
  `lean lab · ${spec.id} · ${args.technique} · drawn at ${args.fps} Hz · leans seen from behind, + to his right`,
);
for (const k of without) console.log(`  without ${k}: ${STAGES[k]}`);
for (const k of eased)
  console.log(`  eased: ${k} (critically damped at ${EASE_FOLLOW} rad/s, some 70 ms)`);
for (const r of rows) {
  const old = before?.find((b) => b.id === r.id);
  const R = r.read;
  const offWas = old ? `${fmt(old.off, 1)}→` : "";
  console.log(
    `\n${r.id}: ${r.say} — ${R.seconds.toFixed(1)} s, ${R.turns} turns, off ${offWas}${fmt(R.off, 1)}°, worst ${R.worst.id} ${fmt(R.worst.by, 1)}° at ${fmt(R.worst.t, 2)} s`,
  );
  console.log(["channel".padEnd(14), ...COLS.map(([, h]) => pad(h, w))].join(""));
  let layer = "";
  for (const ch of CHANNELS) {
    const now = R.channels[ch.id];
    const was = old?.channels?.[ch.id];
    const cells = COLS.map(([k, , d]) => {
      const a = fmt(now[k], d);
      const b = was ? fmt(was[k], d) : null;
      return pad(b !== null && b !== a ? `${b}→${a}` : a, w);
    });
    const tag = ch.layer !== layer ? ch.layer : "";
    layer = ch.layer;
    console.log([`${tag.padEnd(7)}${ch.id.padEnd(7)}`, ...cells].join(""));
  }
}
console.log(
  "\ncolumns: amp the 95th percentile of |lean|; shiver what is left after a 25 ms smoothing, RMS; rate and acc the 95th and 99th of its rate and",
);
console.log(
  "  acceleration; rough the share of the rate's power above 5 Hz; tp/turn turning points (2°) a",
);
console.log(
  "  turn of the engine's incline (1.00 one swing a turn); lag behind the engine's incline, ms,",
);
console.log(
  "  where the rates line up best (match −1..1); off the drawn body's lean (boots to the centre of mass)",
);
console.log(
  "  against the turn's balance eased over 0.1 s, both against the snow, RMS; worst the frame a drawn part shivers most.",
);

// THE POSE'S INPUTS, roughest first: a drawn part that shivers where its
// stage does not is fed the shiver by one of these.
if (args.inputs) {
  for (const r of rows) {
    console.log(`\n${r.id}: the pose's inputs, roughest first (shiver in the input's own unit)`);
    console.log(`${"input".padEnd(20)}${pad("amp", 9)}${pad("shiver", 9)}${pad("rough%", 9)}`);
    const names = new Set(r.frames.flatMap((f) => Object.keys(f.inputs)));
    const list = [];
    for (const name of names) {
      const x = r.frames.map((f) => f.inputs[name] ?? 0);
      const amp = percentile(x.map(Math.abs), 0.95);
      if (!(amp > 1e-4)) continue;
      const sm = smoothed(x, H, SHIVER);
      list.push({ name, amp, shiver: rms(x.map((v, i) => v - sm[i])), rough: roughness(x, H) });
    }
    list.sort((a, b) => b.rough - a.rough);
    for (const e of list) {
      console.log(
        `${e.name.padEnd(20)}${pad(e.amp.toFixed(3), 9)}${pad(e.shiver.toFixed(4), 9)}${pad(e.rough.toFixed(1), 9)}`,
      );
    }
  }
}

// EVERY TURN: a half swing of the engine's incline, a line — the gate, the
// peaks, when each part crosses the vertical against the legs, and the
// bumps inside it.
if (args.turns) {
  for (const r of rows) {
    console.log(`\n${r.id}: every turn`);
    console.log(
      "   t s  gate  incl°  legs°  trunk°  head°  bal°   trunk vs legs ms  head vs legs ms  bumps trunk/head",
    );
    const f = r.frames;
    const ref = turningPoints(
      f.map((x) => x.incline),
      5,
    );
    const crossing = (get, a, b) => {
      // Where the channel passes its turn's middle, s (between samples).
      const lo = get(f[a]);
      const hi = get(f[b]);
      const half = (lo + hi) / 2;
      for (let i = a; i < b; i++) {
        const u = get(f[i]) - half;
        const v = get(f[i + 1]) - half;
        if (u === 0 || u * v < 0) return f[i].t + (H * u) / (u - v || 1);
      }
      return null;
    };
    for (let k = 1; k < ref.length; k++) {
      const a = ref[k - 1].i;
      const b = ref[k].i;
      const span = f.slice(a, b + 1);
      const peak = (get) => {
        const v = span.map(get);
        return ref[k].kind > 0 ? Math.max(...v) : Math.min(...v);
      };
      const legsX = crossing((x) => x.legs, a, b);
      const trunkX = crossing((x) => x.trunk, a, b);
      const headX = crossing((x) => x.head, a, b);
      const bumps = (get) => Math.max(0, turningPoints(span.map(get), 2).length);
      const d = (x) => (x === null || legsX === null ? "—" : ((x - legsX) * 1000).toFixed(0));
      console.log(
        [
          pad(f[b].t.toFixed(2), 6),
          pad(f[b].gate, 6),
          pad(peak((x) => x.incline).toFixed(0), 7),
          pad(peak((x) => x.legs).toFixed(0), 7),
          pad(peak((x) => x.trunk).toFixed(0), 8),
          pad(peak((x) => x.head).toFixed(0), 7),
          pad(peak((x) => x.balance).toFixed(0), 6),
          pad(d(trunkX), 18),
          pad(d(headX), 17),
          pad(`${bumps((x) => x.trunk)}/${bumps((x) => x.head)}`, 19),
        ].join(""),
      );
    }
  }
}

// THE WORST FRAMES: where a drawn channel's acceleration jumps hardest —
// its jerk, the third difference — with what the run was doing then.
if (args.worst) {
  for (const r of rows) {
    console.log(`\n${r.id}: the hardest jerks (°/s³)`);
    const list = [];
    for (const id of ["legs", "trunk", "head", "body"]) {
      const ch = CHANNELS.find((c) => c.id === id);
      const x = r.frames.map(ch.get);
      const j = rate(rate(rate(x, H), H), H);
      j.forEach((v, i) => list.push({ id, i, v }));
    }
    list.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    const seen = new Set();
    for (const e of list) {
      const key = Math.round(e.i / 6);
      if (seen.has(key)) continue;
      seen.add(key);
      const f = r.frames[e.i];
      console.log(
        `  ${f.t.toFixed(2)} s gate ${f.gate} ${e.id.padEnd(5)} ${(e.v / 1000).toFixed(0)}k  ${(f.speed * 3.6).toFixed(0)} km/h  edge ${f.edge.toFixed(0)}°  incl ${f.incline.toFixed(0)}°  legs ${f.legs.toFixed(0)}° trunk ${f.trunk.toFixed(0)}° head ${f.head.toFixed(0)}°  transit ${f.transit.toFixed(2)}  block ${f.block.toFixed(2)}  plant ${f.plant === null ? "—" : f.plant.toFixed(2)}  skid ${f.skid.toFixed(2)}`,
      );
      if (seen.size >= 12) break;
    }
  }
}

// THE PICTURES: the sheet, a row a run, and each run's detail.
mkdirSync(join(root, args.out), { recursive: true });
const label =
  `${spec.id} · ${args.technique} · ${args.fps} Hz${without.size ? ` · without ${[...without].join(", ")}` : ""}${eased.length ? ` · eased ${eased.join(", ")}` : ""}`.toUpperCase();
const picture = (name, png) => {
  writeFileSync(join(root, args.out, name), png);
  console.log(`picture: ${join(args.out, name)}`);
};
picture(
  "lean.png",
  leanSheet({ rows, channels: CHANNELS, h: H, window: args.window, title: `LEAN LAB  ${label}` }),
);
for (const r of rows) {
  const f = r.frames;
  if (f.length < 4) continue;
  const span = f[f.length - 1].t;
  // The window: asked for, or round the run's worst frame.
  const from = Math.max(
    0,
    Math.min(span - args.window, args.from >= 0 ? args.from : r.read.worst.t - args.window / 2),
  );
  picture(
    `lean-${r.id}.png`,
    leanDetail({
      r,
      channels: CHANNELS,
      h: H,
      from,
      to: Math.min(span, from + args.window),
      shiver: SHIVER,
      title: `LEAN LAB  ${r.id.toUpperCase()}  ${label}`,
    }),
  );
}
if (args.json) {
  writeFileSync(
    args.json,
    JSON.stringify(
      rows.map((r) => ({ id: r.id, ...r.read })),
      null,
      1,
    ),
  );
}
