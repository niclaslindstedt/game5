#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER METRICS LAB (`make skier-metrics`): is the skier's POSE a real
// skier's? Every move of the skier lab (`scripts/lib/skier-moves.mjs` — a
// skate, a double pole, a jump, a hockey stop, a carve cut hard, the tuck,
// a landing) is SKIED BY THE REAL ENGINE here in Node, the game's own pose
// taken off every state the way the game takes it (`poseInputOf`, the
// body's spring stepped at 60 Hz), and the pose MEASURED
// (`scripts/lib/skier-measure.mjs`): the knees', the hips' and the ankles'
// angles, where his centre of mass stands over his boots, the trunk's
// pitch, the angulation and the inclination in a turn, the shoulders'
// counter-rotation, the head against the horizon, the hands, any limb
// through another, any joint that jumps between two frames — and THE SKIS
// ON THE SNOW: each drawn ski's gap to the snow under it in the world, as
// the game lays the pair (`ski-stand.ts`), and the outside ski's share of
// the load in a turn.
//
// Each reading is held to a BAND — what a skier doing that move does, from
// coaching and biomechanics (the boot's cuff holds the shin at its own
// forward lean or more; balanced, the centre of mass stands over the
// middle of the foot; a racer's tuck has the back near level and the hands
// ahead of the knees) — and a frame outside one is a FAULT. The table is a
// move a row, the mean of each reading over the move's window, and the
// share of frames at fault: the lab's answer is that share going down.
// Beside the means, two readings of the LEGS AS SPRINGS: `kneeR` the knees'
// range over the window, and `ride` how much of the boots' bounce the head
// keeps (% — near 100 a body bolted to its skis, near 0 a head riding on
// level while the knees work); and every joint's SNAP is judged in the
// world, where the eye sees it.
//
//   node scripts/skier-metrics.mjs                    every move, the table
//   node scripts/skier-metrics.mjs --move=carve,tuck  those moves
//   node scripts/skier-metrics.mjs --faults           every fault, frame by frame
//   node scripts/skier-metrics.mjs --json=previews/metrics-before.json
//   node scripts/skier-metrics.mjs --compare=previews/metrics-before.json

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { MOVES, MOVE_IDS } from "./lib/skier-moves.mjs";
import { measurePose, poseTravel } from "./lib/skier-measure.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    move: {
      kind: "string",
      default: "",
      help: `the moves to measure (${MOVE_IDS.join(", ")}); every one but the wipeout when left out`,
    },
    skis: { kind: "string", default: "chamois", help: "the pair he skis on" },
    faults: { kind: "flag", default: false, help: "list every fault, frame by frame" },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/skier-metrics.mjs [--move=a,b] [--faults] [--json=file] [--compare=file]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));
const P = await import(join(root, "pwa/src/game/skier-pose.ts"));
const G = await import(join(root, "pwa/src/game/skis-body.ts"));
const RIG = await import(join(root, "pwa/src/game/skier-rig.ts"));
const ST = await import(join(root, "pwa/src/game/ski-stand.ts"));
const FL = await import(join(root, "pwa/src/game/skier-flight.ts"));
const spec = E.skisById(args.skis);
const mounts = G.mountsOf(spec);

const moves = args.move
  ? args.move.split(",").map((id) => {
      const m = MOVES.find((x) => x.id === id);
      if (!m) {
        console.error(`unknown move "${id}" (${MOVE_IDS.join(", ")})`);
        process.exit(2);
      }
      return m;
    })
  : MOVES.filter((m) => m.id !== "wipeout");

/** THE BANDS: a reading's name, what it means, and when a frame is at
 * fault — `when` picks the frames it applies to. Every number is a
 * skier's, not the model's. */
const CUFF_LEAN = (0.22 * 180) / Math.PI;
const grounded = (f) => !f.skier.airborne && !f.skier.thrown;
/** Carving: the hips hung into a turn on the snow, upright out of no
 * tuck or skid — and the body inclined into it (a body still inclined into
 * the last turn while the edges and the hips have changed is crossing over,
 * not carving). */
const carving = (f) =>
  grounded(f) &&
  Math.abs(f.skier.hipRight) > 0.12 &&
  f.skier.incline * Math.sign(f.skier.hipRight) > 0 &&
  f.skier.crouch < 0.5 &&
  f.skier.skid < 0.3;
const stopping = (f) =>
  grounded(f) && f.skier.skid >= 0.3 && f.skier.crouch < 0.5 && Math.abs(f.skier.edge) > 0.3;
/** Upright on the snow: inclined into no turn (an edge change still
 * inclined is not a stance, and a tucked turn folds its inside leg). */
const upright = (f) => Math.abs(f.skier.incline) < 0.15;
/** Well into a turn on the snow (`ski-stand.ts`'s `turnOf`). */
const turning = (f) => grounded(f) && Math.abs(ST.turnOf(f.skier)) > 0.5;
const tucked = (f) => grounded(f) && f.skier.crouch > 0.85 && f.skier.skid < 0.3 && upright(f);
const standing = (f) =>
  grounded(f) &&
  upright(f) &&
  f.skier.crouch < 0.5 &&
  Math.abs(f.skier.hipRight) < 0.08 &&
  f.skier.drive < 0.05 &&
  f.skier.jumpLoad <= 0 &&
  f.skier.skid < 0.3 &&
  f.skier.landing > 0.6;
/** Working for his speed: the drive well on, on the snow, the gait drawn
 * (`gaitOf`) a whole one. */
const working = (f) => grounded(f) && f.skier.drive > 0.3 && f.m.work > 0.5;
const BANDS = [
  {
    id: "onsnow",
    say: "on the snow: each ski resting on the snow — its lowest station within 4 cm of it, never floating, never buried",
    when: (f) => grounded(f) && f.skier.trench <= 0,
    bad: (m) => Math.max(...m.skiGap.map(Math.abs)) > 0.04,
  },
  {
    id: "outside",
    say: "turning: the outside ski carries 60–97 % of the load (measured under racers' and learners' bindings)",
    when: turning,
    bad: (m) => m.outside < 0.6 || m.outside > 0.97,
  },
  {
    id: "shin",
    say: "a shin behind its boot's cuff (the cuff holds it ≥ its own lean)",
    when: grounded,
    bad: (m) => Math.min(...m.shinLean) < CUFF_LEAN - 2,
  },
  {
    id: "kneeup",
    say: "a knee folded up higher than its hip (more than 2 cm over it)",
    when: (f) => !f.skier.thrown,
    bad: (m) => m.kneeRise > 0.02,
  },
  {
    id: "boot",
    say: "a shin tipped more than 12° off its ski's tilt (the boot holds it)",
    when: grounded,
    bad: (m) => m.bootOff > 12,
  },
  {
    id: "leanout",
    say: "carving: the trunk leaning OUT of the turn past the vertical (> 5°)",
    when: carving,
    bad: (m, f) => m.trunkLean !== null && Math.sign(f.skier.hipRight) * m.trunkLean < -5,
  },
  {
    id: "backseat",
    say: "the centre of mass behind the boots' heels (in the back seat)",
    when: (f) => grounded(f) && f.skier.lean < 0.3 && f.skier.skid < 0.3,
    bad: (m) => m.comAhead < -0.1,
  },
  {
    id: "tipsy",
    say: "the centre of mass ahead of the toes (unless the poles carry him: working them, or leant on them in the gate)",
    when: (f) => grounded(f) && f.skier.drive < 0.3 && !f.waiting,
    bad: (m) => m.comAhead > 0.16,
  },
  {
    id: "stand",
    say: "standing: knees bent 20–55° (a ski stepped off the snow aside), hips 25–70°",
    when: standing,
    bad: (m) => {
      const planted = m.knee.filter((_, i) => m.lifted[i] < 0.005);
      return (
        (planted.length > 0 && (Math.max(...planted) > 55 || Math.min(...planted) < 20)) ||
        m.hip[0] < 25 ||
        m.hip[0] > 70
      );
    },
  },
  {
    id: "angulate",
    say: "carving: angulated 12–40° at the hips",
    when: carving,
    bad: (m) => m.angulation < 12 || m.angulation > 40,
  },
  {
    id: "stop",
    say: "skidding to a stop: angulated 15–55° across the skis, the hips uphill of the boots",
    when: stopping,
    bad: (m) => m.angulation < 15 || m.angulation > 55,
  },
  {
    id: "inside",
    say: "carving: the inside knee folded at least as far as the outside",
    when: carving,
    bad: (m, f) => {
      const inside = f.skier.hipRight > 0 ? 1 : 0;
      return m.knee[inside] < m.knee[1 - inside] - 2;
    },
  },
  {
    id: "tuck",
    say: "tucked: the back 55–85° over and rounded ≥ 15°, the knees 75–125°, the hands 0.35 m ahead of the hips",
    when: tucked,
    bad: (m) =>
      m.trunkPitch < 55 ||
      m.backRound < 15 ||
      m.trunkPitch > 85 ||
      Math.max(...m.knee) > 125 ||
      Math.min(...m.knee) < 75 ||
      m.handsAhead < 0.35,
  },
  {
    id: "horizon",
    say: "the eyes within 15° of the horizon",
    when: (f) => !f.skier.thrown,
    bad: (m) => m.headRoll !== null && Math.abs(m.headRoll) > 15,
  },
  {
    id: "gaze",
    say: "looking −10–35° below the line of the slope, not at his skis or the sky",
    when: (f) => !f.skier.thrown,
    bad: (m) => m.gaze !== null && (m.gaze < -10 || m.gaze > 35),
  },
  {
    id: "hands",
    say: "the hands ahead of the hips and apart (≥ 0.05 m ahead, ≥ 0.2 m apart)",
    when: (f) => grounded(f) && f.skier.drive < 0.05,
    bad: (m) => m.handsAhead < 0.05 || m.handsApart < 0.2,
  },
  {
    id: "gate",
    say: "in the start gate: the poles planted on the snow ahead of the boots, the trunk ≥ 25° over and the knees ≥ 35°",
    when: (f) => grounded(f) && f.waiting,
    bad: (m) =>
      m.planted > 0.06 || m.plantedAhead < 0.3 || m.trunkPitch < 25 || Math.min(...m.knee) < 35,
  },
  {
    id: "setoff",
    say: "working at a crawl on the flat or down a pitch: over his skis — the trunk ≥ 25° over, the knees ≥ 35° (skating, the gliding knee: the push leg drives out long)",
    when: (f) => working(f) && f.skier.pitch < 0.04,
    bad: (m) => m.trunkPitch < 25 || (m.skating > 0.5 ? Math.max : Math.min)(...m.knee) < 35,
  },
  {
    id: "push",
    say: "working: in the middle of a push a pole BITES — its basket on the snow (≤ 6 cm) behind its fist (a skier with poles)",
    when: (f) => working(f) && f.m.pushing && f.skier.poles !== false,
    bad: (m) => m.bite > 0.06,
  },
  {
    id: "through",
    say: "a limb through the trunk, the knees through each other or an arm through a thigh",
    when: (f) => !f.skier.thrown,
    bad: (m) =>
      m.clear.trunk < -0.02 ||
      m.clear.knees < -0.02 ||
      m.clear.thighs < -0.03 ||
      m.clear.armLeg < -0.03,
  },
  {
    id: "snap",
    say: "a joint SNAPPING: its motion changed by more than 3 cm between two frames at 60 Hz (100 m/s²)",
    when: (f) => !f.skier.thrown,
    bad: (m) => m.snap > 0.03,
  },
];

/** A body-frame point turned by the body's quaternion `q`. */
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

/** The joints `poseTravel` reads, stood in the world off the skier `c`. */
function inWorld(pose, c) {
  const at = (v) => {
    const r = rot(c.q, v);
    return { x: c.x + r.x, y: c.y + r.y, z: c.z + r.z };
  };
  const out = { hips: at(pose.hips), neck: at(pose.neck), head: at(pose.head) };
  for (const k of ["knees", "feet", "shoulders", "elbows", "hands"]) out[k] = pose[k].map(at);
  return out;
}

const mid3 = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });

/** HOW MUCH OF THE SKIS' BOUNCE THE BODY TAKES: the head's world height
 * and the boots', each less its own running mean over half a second (the
 * slope he rides, and the rollers slow enough for the body to follow),
 * and the head's left-over motion as a share of the boots', % — near 100
 * a body bolted to its skis, near 0 a head riding level while the legs
 * work. Null with too little bounce under him to read. */
function rideShare(frames) {
  const hp = (get) =>
    frames.map((f, i) => {
      const w = frames.slice(Math.max(0, i - 15), i + 16);
      return get(f.m) - w.reduce((a, x) => a + get(x.m), 0) / w.length;
    });
  const rms = (v) => Math.sqrt(v.reduce((a, x) => a + x * x, 0) / Math.max(1, v.length));
  const feet = rms(hp((m) => m.feetY));
  return feet < 0.02 ? null : (100 * rms(hp((m) => m.headY))) / feet;
}

/** One move skied through the real engine and the game's pose taken off
 * every other step, its body's spring stepped as the game steps it. */
function measure(move) {
  const state = E.createGame({
    level: move.level(S),
    spec,
    rivals: 0,
    countdown: 0,
    quiet: true,
    mode: move.mode,
    snowDepth: move.snow,
    poles: move.poles !== false,
  });
  E.placeRun(state, move.place());
  const t0 = state.t;
  const steps = Math.round(move.seconds * E.TUNING.physicsHz);
  const legs = P.createSkierSpring();
  const frames = [];
  let last = null;
  let prev = null;
  let lastT = 0;
  for (let i = 0; i < steps; i++) {
    const t = state.t - t0;
    E.step(state, move.input(t, state));
    if (i % 2 === 0) continue;
    const c = state.skier;
    const now = state.t - t0;
    P.stepSkierSpring(
      legs,
      c.vy,
      c.airborne,
      last ? now - lastT : 0,
      c.jumpLoad / E.TUNING.jump.full,
      c,
      P.inStartGate(state),
      // THE FALL read over the map, as the game reads it (`skis-body.ts`).
      {
        read: c.airborne
          ? FL.flightRead(state.level, c, c.spec.cogHeight, E.flightGravity(state.rules))
          : null,
        gravity: E.flightGravity(state.rules),
      },
      G.legsLift(c),
    );
    lastT = now;
    if (c.thrown) continue;
    const trick = state.tricks?.pose ?? null;
    // THE PAIR ON THE SNOW as the game lays it (`skis-body.ts`): the body
    // turned about its feet, each ski where the stance puts it.
    const stand = ST.standOf(
      c,
      G.groundOf(c, legs),
      undefined,
      undefined,
      P.drawnSkiAngle(legs, c),
    );
    const input = G.poseInputOf(c, legs, mounts, trick, P.inStartGate(state), stand);
    const pose = P.skierPose(input);
    const head = RIG.skierBones(pose).head;
    const m = measurePose(pose, {
      q: c.q,
      head,
      tilt: [0, 1].map((k) => (input.edge ?? 0) + (input.gait?.tilt?.[k] ?? 0)),
      turns: [0, 1].map((i) => (input.skiAngle ?? 0) + (input.gait?.splay[i] ?? 0)),
      hipHalf: P.BODY.hip,
      incline: stand.incline,
    });
    // THE POLES' BITE: how high over the snow the lower basket of a pole
    // angled back from its fist stands (the one pushing), m — and whether
    // the gait is in the middle of a push, where one must be in the snow.
    const snow = mounts.ground + (input.drop ?? 0);
    const behind = [0, 1].filter((k) => pose.poles && pose.poles[k].z < pose.hands[k].z - 0.05);
    // THE SKIS ON THE SNOW: each drawn ski's base under its boot over the
    // snow beneath it, m — less what the gait lifts on purpose (a skate's
    // recovering ski) — and the outside ski's share of the load.
    const gaitS = input.gait ?? P.STILL_GAIT;
    // A rigid ski rests on whichever of its stations stands lowest (a
    // skier sat back into a stop rides his tails): the gap is that one's
    // (`skiGaps`, the pair laid as the game lays it).
    m.skiGap = ST.skiGaps(c, stand, state.level, input.skiAngle ?? 0, {
      out: gaitS.out,
      fore: gaitS.fore,
      splay: gaitS.splay,
    });
    const side = ST.turnOf(c);
    m.outside = side > 0 ? stand.share[0] : side < 0 ? stand.share[1] : 0.5;
    m.bite = behind.length ? Math.min(...behind.map((k) => pose.poles[k].y - snow)) : Infinity;
    const gait = input.gait ?? P.STILL_GAIT;
    // The arms' work: the stride's, and the poles' as far as he works them.
    m.work = gait.stride + (gait.skate + gait.pole) * (gait.keep ?? 1);
    m.skating = gait.skate;
    // Each ski lifted off the snow by the gait (a step), m.
    m.lifted = gait.lift;
    // …and in the gate, the higher basket over the snow and the nearer
    // basket's distance ahead of the boots, m.
    const feetZ = (pose.feet[0].z + pose.feet[1].z) / 2;
    m.planted = pose.poles ? Math.max(...pose.poles.map((b) => b.y - snow)) : Infinity;
    m.plantedAhead = pose.poles ? Math.min(...pose.poles.map((b) => b.z - feetZ)) : -Infinity;
    // The middle of a push: the poles' bite (`Gait.duty`), or the
    // stride's, each arm's two strides long.
    const duty = gait.duty ?? E.TUNING.poles.duty;
    const ph = gait.stride > 0.5 ? (gait.phase + (gait.push ? 1 : 0)) / 2 : gait.phase;
    const mid = gait.stride > 0.5 ? [0.08, 0.18] : [0.27 * duty, 0.73 * duty];
    m.pushing = ph % 1 >= mid[0] && ph % 1 <= mid[1] && duty > 0;
    // THE BODY ON ITS LEGS, in the world: how high the head and the boots
    // stand, m — what the `ride` column high-passes and sets side by side.
    m.headY = c.y + rot(c.q, pose.head).y;
    m.feetY = c.y + rot(c.q, mid3(pose.feet[0], pose.feet[1])).y;
    // A JOINT'S MOTION IS JUDGED IN THE WORLD, where the eye sees it — the
    // lens's height rides a spring of its own (`camera-rigs.ts`) — not in
    // the body frame, which the engine's centre of gravity jolts: a head
    // held level while the legs take a bump stands still on the screen.
    const seen = inWorld(pose, c);
    const moved = last ? poseTravel(last, seen, prev) : { travel: 0, joint: "", snap: 0 };
    m.travel = moved.travel;
    m.snap = moved.snap;
    m.joint = moved.snap > 0.03 ? moved.snapped : moved.joint;
    prev = last;
    last = seen;
    if (now < move.window[0] || now > move.window[1]) continue;
    frames.push({ t: now, skier: { ...c }, waiting: P.inStartGate(state), m });
  }
  const mean = (get) => {
    const v = frames.map((f) => get(f.m)).filter((x) => x !== null && Number.isFinite(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const faults = {};
  const list = [];
  let bad = 0;
  for (const f of frames) {
    let any = false;
    for (const b of BANDS) {
      if (!b.when(f) || !b.bad(f.m, f)) continue;
      faults[b.id] = (faults[b.id] ?? 0) + 1;
      list.push({ t: f.t, band: b.id, m: f.m, skier: f.skier });
      any = true;
    }
    if (any) bad++;
  }
  return {
    id: move.id,
    frames: frames.length,
    faulty: frames.length ? bad / frames.length : 0,
    faults,
    list,
    mean: {
      knee: mean((m) => (m.knee[0] + m.knee[1]) / 2),
      shin: mean((m) => Math.min(...m.shinLean)),
      hip: mean((m) => (m.hip[0] + m.hip[1]) / 2),
      trunk: mean((m) => m.trunkPitch),
      round: mean((m) => m.backRound),
      com: mean((m) => m.comAhead),
      angul: mean((m) => m.angulation),
      boot: mean((m) => m.bootOff),
      trunkW: mean((m) => (m.trunkLean === null ? null : m.trunkLean)),
      incl: mean((m) => Math.abs(m.inclination)),
      twist: mean((m) => m.twist),
      head: mean((m) => (m.headRoll === null ? null : Math.abs(m.headRoll))),
      gaze: mean((m) => m.gaze),
      ahead: mean((m) => m.handsAhead),
      clear: Math.min(...frames.map((f) => Math.min(...Object.values(f.m.clear)))),
      gap: Math.max(
        ...frames.filter(grounded).map((f) => Math.max(...f.m.skiGap.map(Math.abs))),
        0,
      ),
      outside: mean((m) => (m.outside === 0.5 ? null : m.outside * 100)),
      snap: Math.max(...frames.map((f) => f.m.snap)),
      kneeR: frames.length
        ? Math.max(...frames.map((f) => Math.max(...f.m.knee))) -
          Math.min(...frames.map((f) => Math.min(...f.m.knee)))
        : null,
      ride: rideShare(frames.filter((f) => !f.skier.thrown)),
    },
  };
}

const rows = moves.map(measure);
const COLS = [
  ["knee", "knee°", 0],
  ["shin", "shin°", 0],
  ["hip", "hip°", 0],
  ["trunk", "trunk°", 0],
  ["round", "round°", 0],
  ["com", "com m", 2],
  ["angul", "angul°", 0],
  ["boot", "boot°", 0],
  ["trunkW", "trunkW°", 0],
  ["incl", "incl°", 0],
  ["twist", "twist°", 0],
  ["head", "head°", 0],
  ["gaze", "gaze°", 0],
  ["ahead", "hands m", 2],
  ["clear", "clear m", 2],
  ["gap", "gap m", 2],
  ["outside", "out %", 0],
  ["snap", "snap m", 3],
  ["kneeR", "kneeR°", 0],
  ["ride", "ride %", 0],
];
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const fmt = (v, d) => (v === null || !Number.isFinite(v) ? "—" : v.toFixed(d));
const pad = (s, n) => String(s).padStart(n);

console.log(
  `skier metrics · ${spec.id} · ${rows.length} moves · readings the mean over each move's window`,
);
console.log(
  ["move".padEnd(8), ...COLS.map(([, h]) => pad(h, 8)), pad("fault", 10), "  faults"].join(""),
);
for (const r of rows) {
  const old = before?.find((b) => b.id === r.id);
  const cells = COLS.map(([k, , d]) => pad(fmt(r.mean[k], d), 8));
  const share = `${Math.round(r.faulty * 100)}%`;
  const was = old ? `${Math.round(old.faulty * 100)}%→` : "";
  const why = Object.entries(r.faults)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k}×${n}`)
    .join(" ");
  console.log([r.id.padEnd(8), ...cells, pad(was + share, 10), "  ", why].join(""));
}
const total =
  rows.reduce((a, r) => a + r.faulty * r.frames, 0) / rows.reduce((a, r) => a + r.frames, 0);
const oldTotal = before
  ? before.reduce((a, r) => a + r.faulty * r.frames, 0) / before.reduce((a, r) => a + r.frames, 0)
  : null;
console.log(
  `frames at fault: ${Math.round(total * 100)}%${oldTotal !== null ? ` (was ${Math.round(oldTotal * 100)}%)` : ""}`,
);
console.log("bands:");
for (const b of BANDS) console.log(`  ${b.id.padEnd(9)} ${b.say}`);
if (args.faults) {
  for (const r of rows) {
    for (const f of r.list) {
      const m = f.m;
      console.log(
        `${r.id} ${f.t.toFixed(2)}s [hipR ${f.skier.hipRight.toFixed(2)} skiA ${f.skier.skiAngle.toFixed(2)} skid ${f.skier.skid.toFixed(2)} roll ${f.skier.roll.toFixed(2)} edge ${f.skier.edge.toFixed(2)} crouch ${f.skier.crouch.toFixed(2)} air ${f.skier.airborne ? 1 : 0}] ${f.band}: knee ${m.knee.map((v) => v.toFixed(0))} shin ${m.shinLean.map((v) => v.toFixed(0))} hip ${m.hip.map((v) => v.toFixed(0))} trunk ${m.trunkPitch.toFixed(0)} com ${m.comAhead.toFixed(2)} angul ${m.angulation.toFixed(0)} boot ${m.bootOff.toFixed(0)} trunkW ${fmt(m.trunkLean, 0)} legW ${fmt(m.legLean, 0)} head ${fmt(m.headRoll, 0)} gaze ${fmt(m.gaze, 0)} hands ${m.handsAhead.toFixed(2)}/${m.handsApart.toFixed(2)} clear ${Object.values(m.clear).map((v) => v.toFixed(2))} travel ${m.travel.toFixed(3)} snap ${m.snap.toFixed(3)} ${m.joint}`,
      );
    }
  }
}
if (args.json) {
  writeFileSync(
    args.json,
    JSON.stringify(
      rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "list"))),
      null,
      1,
    ),
  );
}
