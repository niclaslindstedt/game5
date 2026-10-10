#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SAG LAB (`make sag`): when the body is PULLED DOWN onto his legs —
// a landing, the snow running out of a pitch onto the flat, the climb
// taken out of him by a stop, a roller, a fast run down a real mountain —
// how far does the upper body go over? The view carries his upper body as
// a mass on his legs (`skier-spring.ts`'s `LEGS`: the fold `bump`) and holds
// his trunk off the skis' rocking (`pitchHeld`), and the pose lays both on
// the trunk's pitch (`skier-pose.ts`). This lab skis each moment through
// the REAL ENGINE in Node, steps the body's spring at 60 Hz as the game
// does, poses him off every frame (`poseInputOf`, `skierPose`) — and poses
// him AGAIN off the same frame with the spring taken out (no fold, no held
// pitch), so what the spring ADDS to his forward lean is read apart from
// what his stance, his tuck and his technique already give him.
//
// Each frame is held to bands a skier's body keeps when it is pulled down:
//   bow     the trunk past level with the slope (> 90° off the skis' normal):
//           his head below his hips, his face going down to his skis
//   waist   the spring bowing him at the waist: the trunk's added pitch more
//           than 10° past what the shins add — a skier absorbs in his
//           ankles, knees and hips together, the trunk following the shins
//           (the coach's "torso parallel to the shins"), never folded at
//           the waist over legs that stay put
//   tipsy   the centre of mass ahead of the toes (> 16 cm past the boots)
//
// The table is a moment a row: the deepest fold (cm), the most the spring
// adds to the trunk's pitch (°) and its split between the fold and the
// held pitch, what the shins add then, the trunk's pitch at its most with
// the spring and without it, the head's least height over the hips and the
// knees along the skis' normal (cm), how long the added pitch takes to fall
// back under 3° after its peak (s), and the share of frames at fault. The
// RUN rows ski generated maps with the bot (`--seed`, the tuck on its
// straights) — the fast riding the game is played at.
//
// A picture (previews/sag.png): each moment's figure in the side view at
// its worst frame, the spring's in colour over the spring-free one in grey,
// on the snow he stands on; and its trace — the trunk's pitch with the
// spring (white) and without (grey), the fold (yellow).
//
//   node scripts/sag-lab.mjs                       every moment and seed 38's run
//   node scripts/sag-lab.mjs --moment=drop-1,runout
//   node scripts/sag-lab.mjs --seed=7,38 --seconds=40
//   node scripts/sag-lab.mjs --technique=downhill  stood as a downhill racer
//   node scripts/sag-lab.mjs --worst               the worst frames of each, listed
//   node scripts/sag-lab.mjs --json=previews/sag-before.json
//   node scripts/sag-lab.mjs --compare=previews/sag-before.json

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";
import { measurePose } from "./lib/skier-measure.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const IDLE = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };
const PITCH = Math.tan(Math.PI / 9);

/** THE MOMENTS the body is pulled down in, each skied by the engine on a
 * synthetic strip (`tests/support/synthetic.ts`): the map, the moment
 * (`RunMoment`), how long, and the controls at run time t. */
const MOMENTS = [
  {
    id: "cruise",
    say: "straight down the 20° pitch at 60 km/h — a steady line, nothing to take",
    level: (S) => S.flatLevel({ packed: 1, grade: PITCH, slopeFrom: 200, size: 4000 }),
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 60 / 3.6 }),
    seconds: 2.5,
    input: () => IDLE,
  },
  {
    id: "tuck",
    say: "tucked down the 20° pitch from 90 km/h — the fast run, nothing to take",
    level: (S) => S.flatLevel({ packed: 1, grade: PITCH, slopeFrom: 200, size: 4000 }),
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 90 / 3.6 }),
    seconds: 2.5,
    input: () => ({ ...IDLE, tuck: 1 }),
  },
  {
    id: "runout",
    say: "the 20° pitch run out onto the flat over 25 m at 70 km/h — a compression",
    level: (S) =>
      S.flatLevel({
        packed: 1,
        grade: PITCH,
        slopeFrom: 200,
        size: 3000,
        runOut: { at: 700, bend: 25 },
      }),
    place: () => ({ x: 1500, z: 670, heading: 0, speed: 70 / 3.6 }),
    seconds: 4,
    input: () => IDLE,
  },
  {
    id: "runout-tuck",
    say: "the same compression in a tuck at 100 km/h",
    level: (S) =>
      S.flatLevel({
        packed: 1,
        grade: PITCH,
        slopeFrom: 200,
        size: 3000,
        runOut: { at: 700, bend: 25 },
      }),
    place: () => ({ x: 1500, z: 660, heading: 0, speed: 100 / 3.6 }),
    seconds: 4,
    input: () => ({ ...IDLE, tuck: 1 }),
  },
  ...[0.5, 1, 1.5, 2.5].map((h) => ({
    id: `drop-${h}`,
    say: `dropped ${h} m at 50 km/h onto the flat groomer — a landing taken in the legs`,
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 50 / 3.6, height: h + 1 }),
    seconds: 2.4,
    input: () => IDLE,
  })),
  {
    id: "drop-tuck",
    say: "dropped 1 m at 80 km/h onto the flat in a full tuck",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 80 / 3.6, height: 2 }),
    seconds: 2.4,
    input: () => ({ ...IDLE, tuck: 1 }),
  },
  {
    id: "ledge",
    say: "a 3 m drop at 45 km/h onto the 20° pitch",
    level: (S) => S.flatLevel({ packed: 1, grade: PITCH, slopeFrom: 200, size: 4000 }),
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 45 / 3.6, height: 4 }),
    seconds: 2.2,
    input: () => IDLE,
  },
  {
    id: "stop",
    say: "a hockey stop from 50 km/h down the 20° pitch — the fall taken out of him",
    level: (S) => S.flatLevel({ packed: 1, grade: PITCH, slopeFrom: 200, size: 4000 }),
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 50 / 3.6 }),
    seconds: 5,
    input: (t) => ({ ...IDLE, brake: t >= 0.3 ? 1 : 0, steer: t >= 0.5 ? 1 : 0 }),
  },
  {
    id: "rollers",
    say: "straight over rollers 30 cm high every 8 m at 60 km/h, tucked",
    level: (S) =>
      S.flatLevel({
        packed: 1,
        grade: 0.12,
        slopeFrom: 0,
        size: 1200,
        bumps: { height: 0.3, length: 8, from: 300, to: 900 },
      }),
    place: () => ({ x: 600, z: 290, heading: 0, speed: 60 / 3.6 }),
    seconds: 4,
    input: () => ({ ...IDLE, tuck: 1 }),
  },
];
const MOMENT_IDS = MOMENTS.map((m) => m.id);

const args = parseArgs(
  process.argv.slice(2),
  {
    moment: {
      kind: "string",
      default: "",
      help: `the staged moments (${MOMENT_IDS.join(", ")}); every one when left out, none with --moment=none`,
    },
    seed: {
      kind: "string",
      default: "38",
      help: "the generated maps the bot skis fast, comma separated; none with --seed=none",
    },
    seconds: { kind: "number", default: 60, help: "how long each seed's run is skied, s" },
    skis: { kind: "string", default: "chamois", help: "the pair he skis on" },
    technique: {
      kind: "string",
      default: "",
      help: "the riding technique he is stood as (free, slalom, giantSlalom, superG, downhill)",
    },
    worst: { kind: "flag", default: false, help: "list each row's worst frames" },
    out: { kind: "string", default: "previews/sag.png", help: "the picture" },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/sag-lab.mjs [--moment=a,b] [--seed=38,7] [--seconds=60] [--technique=id] [--worst] [--json=file] [--compare=file]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));
const P = await import(join(root, "pwa/src/game/skier-pose.ts"));
const G = await import(join(root, "pwa/src/game/skis-body.ts"));
const ST = await import(join(root, "pwa/src/game/ski-stand.ts"));
const FL = await import(join(root, "pwa/src/game/skier-flight.ts"));
const TP = await import(join(root, "pwa/src/game/technique-pose.ts"));
if (args.technique && !(args.technique in TP.TECHNIQUE_POSES)) {
  console.error(
    `unknown technique "${args.technique}" (${Object.keys(TP.TECHNIQUE_POSES).join(", ")})`,
  );
  process.exit(2);
}
const spec = E.pairById(args.skis);
const mounts = G.mountsOf(spec);

const moments =
  args.moment === "none"
    ? []
    : args.moment
      ? args.moment.split(",").map((id) => {
          const m = MOMENTS.find((x) => x.id === id);
          if (!m) {
            console.error(`unknown moment "${id}" (${MOMENT_IDS.join(", ")})`);
            process.exit(2);
          }
          return m;
        })
      : MOMENTS;
const seeds =
  args.seed === "none"
    ? []
    : args.seed
        .split(",")
        .filter(Boolean)
        .map((s) => Number(s));

/** THE BANDS: when a frame is at fault. Every number is a skier's. */
const BANDS = [
  {
    id: "bow",
    say: "the trunk past level with the slope (> 90° off the skis' normal): the head below the hips, the face down to the skis",
    bad: (f) => f.trunk > 90,
  },
  {
    id: "waist",
    say: "the spring bowing him at the waist: the trunk's added pitch more than 10° past what the shins add",
    bad: (f) => f.sag > 3 && f.sag - Math.max(0, f.shinAdd) > 10,
  },
  {
    id: "tipsy",
    say: "the centre of mass more than 16 cm ahead of the boots",
    bad: (f) => f.com > 0.16,
  },
];

const meanShin = (m) => (m.shinLean[0] + m.shinLean[1]) / 2;

/** One frame posed three ways: as the game poses it, with the held pitch
 * taken out, and with the whole spring taken out — and read. */
function frameOf(state, legs, t) {
  const c = state.skier;
  const stand = ST.standOf(c, G.groundOf(c, legs), undefined, undefined, P.drawnSkiAngle(legs, c));
  const riding = TP.ridingOf(state, c);
  TP.widenStand(stand, riding.style.stance, P.drawnSkiAngle(legs, c), c.skid, c.speed);
  const input = G.poseInputOf(
    c,
    legs,
    mounts,
    state.tricks?.pose ?? null,
    P.inStartGate(state),
    stand,
    riding,
  );
  const read = (pose) =>
    measurePose(pose, {
      tilt: [0, 1].map((k) => (input.edge ?? 0) + (input.gait?.tilt?.[k] ?? 0)),
      turns: [0, 1].map((i) => (input.skiAngle ?? 0) + (input.gait?.splay[i] ?? 0)),
      hipHalf: P.BODY.hip,
      incline: stand.incline,
    });
  const pose = P.skierPose(input);
  const folded = P.skierPose({ ...input, pitchHeld: 0 });
  const bare = P.skierPose({ ...input, pitchHeld: 0, bump: 0 });
  const m = read(pose);
  const mf = read(folded);
  const m0 = read(bare);
  const kneeY = Math.max(pose.knees[0].y, pose.knees[1].y);
  return {
    t,
    speed: c.speed,
    crouch: c.crouch,
    bump: legs.bump,
    trunk: m.trunkPitch,
    trunk0: m0.trunkPitch,
    sag: m.trunkPitch - m0.trunkPitch,
    fold: mf.trunkPitch - m0.trunkPitch,
    held: m.trunkPitch - mf.trunkPitch,
    shinAdd: meanShin(m) - meanShin(m0),
    headHips: pose.head.y - pose.hips.y,
    headKnees: pose.head.y - kneeY,
    com: m.comAhead,
    pose,
    bare,
    q: { ...c.q },
    heading: c.heading,
  };
}

/** How long a ride is left to settle before it is read, s. */
const SETTLE = 0.3;

/** A run skied step by step by `inputOf`, the body's spring stepped at
 * 60 Hz as the game steps it (`skis-body.ts`), and a frame read off every
 * other step on the snow, on his skis. */
function ride(state, inputOf, seconds) {
  const t0 = state.t;
  const steps = Math.round(seconds * E.TUNING.physicsHz);
  const legs = P.createSkierSpring();
  const frames = [];
  let lastT = null;
  for (let i = 0; i < steps; i++) {
    E.step(state, inputOf(state.t - t0, state));
    if (i % 2 === 0) continue;
    const c = state.skier;
    const now = state.t - t0;
    P.stepSkierSpring(
      legs,
      c.vy,
      c.airborne,
      lastT === null ? 0 : now - lastT,
      c.jumpLoad / E.TUNING.jump.full,
      c,
      P.inStartGate(state),
      {
        read: c.airborne
          ? FL.flightRead(state.level, c, c.spec.cogHeight, E.flightGravity(state.rules))
          : null,
        gravity: E.flightGravity(state.rules),
      },
      G.legsLift(c),
    );
    lastT = now;
    if (c.thrown) {
      P.restSkierSpring(legs);
      continue;
    }
    if (c.airborne || c.lift || state.heli?.rider || state.sled?.rider) continue;
    // The first moments are the staging's own settle (`placeRun` stands
    // him at rest and the engine's crouch and the spring take him up).
    if (now < SETTLE) continue;
    frames.push(frameOf(state, legs, now));
  }
  return frames;
}

/** A row's frames read down to the table's numbers. */
function summarize(id, say, frames) {
  const faults = {};
  let bad = 0;
  for (const f of frames) {
    let any = false;
    for (const b of BANDS) {
      if (!b.bad(f)) continue;
      faults[b.id] = (faults[b.id] ?? 0) + 1;
      any = true;
    }
    if (any) bad++;
  }
  const most = (get) =>
    frames.reduce((best, f) => (best === null || get(f) > get(best) ? f : best), null);
  const peak = most((f) => f.sag);
  const deepest = most((f) => f.bump);
  // How long after its peak the added pitch takes to fall back under 3°.
  let recover = null;
  if (peak && peak.sag > 3) {
    const after = frames.find((f) => f.t > peak.t && f.sag < 3);
    recover = after ? after.t - peak.t : Infinity;
  }
  const worst = most((f) => f.trunk);
  const sorted = (get) => frames.map(get).sort((a, b) => a - b);
  const pct = (get, p) => {
    const v = sorted(get);
    return v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : null;
  };
  return {
    id,
    say,
    frames: frames.length,
    faulty: frames.length ? bad / frames.length : 0,
    faults,
    at: {
      bump: deepest ? deepest.bump * 100 : null,
      sag: peak ? peak.sag : null,
      fold: peak ? peak.fold : null,
      held: peak ? peak.held : null,
      shin: peak ? peak.shinAdd : null,
      sag95: pct((f) => f.sag, 0.95),
      trunk: worst ? worst.trunk : null,
      trunk0: frames.length ? Math.max(...frames.map((f) => f.trunk0)) : null,
      headHips: frames.length ? Math.min(...frames.map((f) => f.headHips)) * 100 : null,
      headKnees: frames.length ? Math.min(...frames.map((f) => f.headKnees)) * 100 : null,
      recover,
    },
    worst,
    peak,
    trace: frames.map((f) => ({ t: f.t, trunk: f.trunk, trunk0: f.trunk0, bump: f.bump })),
    list: [...frames].sort((a, b) => b.trunk - a.trunk).slice(0, 5),
  };
}

const rows = [];
for (const m of moments) {
  const state = E.createGame({
    level: m.level(S),
    spec,
    rivals: 0,
    countdown: 0,
    quiet: true,
    technique: args.technique || undefined,
  });
  E.placeRun(state, m.place());
  rows.push(summarize(m.id, m.say, ride(state, m.input, m.seconds)));
}
for (const seed of seeds) {
  const state = E.createGame({
    seed,
    spec,
    rivals: 0,
    countdown: 0,
    quiet: true,
    technique: args.technique || undefined,
  });
  const frames = ride(state, (_t, st) => E.botInput(st), args.seconds);
  rows.push(
    summarize(`run-${seed}`, `seed ${seed} skied by the bot for ${args.seconds} s`, frames),
  );
}

// THE TABLE.
const COLS = [
  ["bump", "fold cm", 1],
  ["sag", "sag°", 1],
  ["fold", "·fold°", 1],
  ["held", "·held°", 1],
  ["shin", "shin+°", 1],
  ["sag95", "sag95°", 1],
  ["trunk", "trunk°", 0],
  ["trunk0", "bare°", 0],
  ["headHips", "hd/hip", 0],
  ["headKnees", "hd/kn", 0],
  ["recover", "back s", 2],
];
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const fmt = (v, d) =>
  v === null || v === undefined ? "—" : v === Infinity ? "never" : v.toFixed(d);
const pad = (s, n) => String(s).padStart(n);
const label = `${spec.id}${args.technique ? ` · ${args.technique}` : ""}`;
console.log(
  `sag lab · ${label} · sag = what the body's spring adds to the trunk's pitch (fold + held), at its peak`,
);
console.log(
  [
    "moment".padEnd(12),
    ...COLS.map(([, h]) => pad(h, before ? 13 : 8)),
    pad("fault", 10),
    "  faults",
  ].join(""),
);
for (const r of rows) {
  const old = before?.find((b) => b.id === r.id);
  const cells = COLS.map(([k, , d]) => {
    const now = fmt(r.at[k], d);
    const was = old ? fmt(old.at[k], d) : null;
    return pad(was !== null && was !== now ? `${was}→${now}` : now, before ? 13 : 8);
  });
  const share = `${Math.round(r.faulty * 100)}%`;
  const was = old ? `${Math.round(old.faulty * 100)}%→` : "";
  const why = Object.entries(r.faults)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k}×${n}`)
    .join(" ");
  console.log([r.id.padEnd(12), ...cells, pad(was + share, 10), "  ", why].join(""));
}
console.log("columns: fold cm the deepest fold of the legs' spring; sag° its added trunk pitch at");
console.log(
  "  the peak, split ·fold° (the fold's) and ·held° (the trunk held off the skis' pitch);",
);
console.log(
  "  shin+° what the shins add then; sag95° the 95th percentile; trunk° the trunk's most off",
);
console.log(
  "  the skis' normal, bare° the most without the spring; hd/hip and hd/kn the head's least",
);
console.log(
  "  height over the hips and the knees along the normal, cm; back s from the peak to < 3°.",
);
console.log("bands:");
for (const b of BANDS) console.log(`  ${b.id.padEnd(6)} ${b.say}`);
if (args.worst) {
  for (const r of rows) {
    for (const f of r.list) {
      console.log(
        `${r.id} ${f.t.toFixed(2)}s ${(f.speed * 3.6).toFixed(0)} km/h crouch ${f.crouch.toFixed(2)}: trunk ${f.trunk.toFixed(0)}° (bare ${f.trunk0.toFixed(0)}°, fold +${f.fold.toFixed(1)}°, held +${f.held.toFixed(1)}°) fold ${(f.bump * 100).toFixed(1)} cm shin +${f.shinAdd.toFixed(1)}° head/hips ${(f.headHips * 100).toFixed(0)} cm head/knees ${(f.headKnees * 100).toFixed(0)} cm com ${f.com.toFixed(2)}`,
      );
    }
  }
}

// THE PICTURE: a row a moment — the figure at its worst frame in the side
// view (the spring's in colour over the spring-free one in grey, on his
// snow), and its trace.
const INK = {
  bg: [18, 22, 30],
  text: [220, 226, 236],
  dim: [120, 128, 142],
  snow: [200, 215, 235],
  ski: [90, 150, 230],
  body: [250, 120, 90],
  bare: [140, 146, 160, 200],
  trunk: [240, 240, 245],
  trunk0: [130, 136, 150],
  bump: [240, 200, 80],
  limit: [200, 70, 70, 160],
};
const ROW = 200;
const W = 960;
const d = createDrawing(W, 40 + rows.length * ROW, INK.bg);
d.text(
  `SAG LAB  ${label.toUpperCase()}  WORST FRAME: SPRING (COLOUR) OVER NO SPRING (GREY)`,
  10,
  8,
  INK.text,
);
d.text(
  "TRACE: TRUNK OFF THE SKIS' NORMAL WITH THE SPRING (WHITE), WITHOUT (GREY), 0-120 DEG; THE FOLD (YELLOW), 0-40 CM",
  10,
  22,
  INK.dim,
);
const rot = (q, v) => {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
};
function figure(f, pose, ox, oy, k, color, stroke) {
  // The side view: the way he heads along the snow to the right, up up.
  const hx = Math.sin(f.heading);
  const hz = Math.cos(f.heading);
  const at = (v) => {
    const w = rot(f.q, v);
    return [ox + (w.x * hx + w.z * hz) * k, oy - w.y * k];
  };
  const chain = (pts) => d.polyline(pts.map(at), color, stroke);
  const side = 0;
  chain([
    pose.feet[side],
    pose.knees[side],
    pose.hips,
    ...(pose.waist ? [pose.waist] : []),
    pose.neck,
    pose.head,
  ]);
  chain([pose.shoulders[side], pose.elbows[side], pose.hands[side]]);
  const [hx0, hy0] = at(pose.head);
  d.circle(hx0, hy0, 0.11 * k, color, stroke);
}
rows.forEach((r, i) => {
  const y0 = 40 + i * ROW;
  d.line(0, y0, W, y0, [40, 46, 58]);
  d.text(`${r.id}`, 10, y0 + 8, INK.text, 2);
  d.text(r.say.slice(0, 48), 10, y0 + 28, INK.dim);
  const f = r.worst;
  if (f) {
    const ox = 150;
    const oy = y0 + 118;
    const k = 62;
    // His snow and his skis, along the pair's own length.
    const hx = Math.sin(f.heading);
    const hz = Math.cos(f.heading);
    const at = (v) => {
      const w = rot(f.q, v);
      return [ox + (w.x * hx + w.z * hz) * k, oy - w.y * k];
    };
    const fz = (f.pose.feet[0].z + f.pose.feet[1].z) / 2;
    // His skis drawn under his boots, along the pair.
    const fy = Math.min(f.pose.feet[0].y, f.pose.feet[1].y);
    const [s0, s1] = [
      at({ x: 0, y: fy - 0.06, z: fz - 1.1 }),
      at({ x: 0, y: fy - 0.06, z: fz + 1.1 }),
    ];
    d.line(s0[0], s0[1], s1[0], s1[1], INK.snow, 2);
    const [k0, k1] = [
      at({ x: 0, y: fy - 0.03, z: fz - 0.8 }),
      at({ x: 0, y: fy - 0.03, z: fz + 0.9 }),
    ];
    d.line(k0[0], k0[1], k1[0], k1[1], INK.ski, 3);
    figure(f, f.bare, ox, oy, k, INK.bare, 2);
    figure(f, f.pose, ox, oy, k, INK.body, 2);
    d.text(
      `T ${f.t.toFixed(2)}S  ${(f.speed * 3.6).toFixed(0)} KM/H  TRUNK ${f.trunk.toFixed(0)} (BARE ${f.trunk0.toFixed(0)})  FOLD ${(f.bump * 100).toFixed(0)} CM`,
      10,
      y0 + 44,
      INK.text,
    );
  }
  // The trace: the trunk's pitch 0..120° and the fold 0..40 cm over the row's time.
  const tx = 300;
  const tw = W - tx - 20;
  const ty = y0 + 60;
  const th = ROW - 72;
  d.rect(tx, ty, tw, th, [50, 56, 70]);
  const span = r.trace.length ? r.trace[r.trace.length - 1].t : 1;
  const px = (t) => tx + (t / Math.max(span, 1e-6)) * tw;
  const py = (deg) => ty + th - (Math.max(0, Math.min(120, deg)) / 120) * th;
  d.line(tx, py(90), tx + tw, py(90), INK.limit);
  d.text("90", tx - 16, py(90) - 3, INK.dim);
  const pick = (get) => r.trace.map((p) => [px(p.t), get(p)]);
  d.polyline(
    pick((p) => py(p.trunk0)),
    INK.trunk0,
    1,
  );
  d.polyline(
    pick((p) => py(p.trunk)),
    INK.trunk,
    1,
  );
  d.polyline(
    pick((p) => ty + th - (Math.max(0, Math.min(0.4, p.bump)) / 0.4) * th),
    INK.bump,
    1,
  );
  d.text(`${span.toFixed(1)} S`, tx + tw - 30, ty + th + 2, INK.dim);
});
mkdirSync(dirname(join(root, args.out)), { recursive: true });
writeFileSync(join(root, args.out), d.toPng());
console.log(`picture: ${args.out}`);

if (args.json) {
  writeFileSync(
    args.json,
    JSON.stringify(
      rows.map((r) => ({
        id: r.id,
        frames: r.frames,
        faulty: r.faulty,
        faults: r.faults,
        at: r.at,
      })),
      null,
      1,
    ),
  );
}
