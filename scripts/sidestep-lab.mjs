#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SIDESTEP LAB (`make sidestep`): a skier stood across a steep slope
// stepping up it a ski at a time (`engine/game/sidestep.ts`), measured two
// ways, pure Node, no build, seconds:
//
//   CLIMB   every slope from 10° to 55°, on the groomer and in powder,
//           skied by the REAL ENGINE: whether he gets onto his platforms
//           at all (`on`: stood across the face as a skier who has
//           stopped on it, his legs settled), how fast he climbs (vertical
//           metres a minute), the pairs of steps a second, each pair's
//           step along the snow, and how far he slid back down while he
//           climbed (`slip`, which a platform owes none of).
//
//   SMOOTH  the drawn skier through three pairs of steps, every frame laid
//           and posed as `skis-body.ts` does it (the legs' spring, the
//           body stood over the hill, the stand, the pose) at `--fps`:
//           per joint, its fastest frame-to-frame move (cm) and its worst
//           SNAP (the second difference of its place, cm — a smooth motion
//           draws a curve, a kink a spike); and the planted feet and pole
//           baskets against the snow (`foot`: how far a planted foot
//           wanders over the snow under it, cm, the most less the least of
//           its height off it — a foot stood on a ledge stays on it;
//           `basket`: the worst gap of a planted basket, cm, + over the
//           snow, − into it).
//
// `--json=FILE` keeps the tables; `--compare=FILE` prints a kept one beside
// this run's. `--sheets` then photographs the skier lab's sidestep moves
// (`make skier MOVE=sidestep,sidestep-steep,sidestep-powder`), every
// frame of each from five sides: previews/skier-sidestep*.png.
//
//   node scripts/sidestep-lab.mjs
//   node scripts/sidestep-lab.mjs --json=previews/sidestep-before.json
//   node scripts/sidestep-lab.mjs --compare=previews/sidestep-before.json --sheets

import { spawnSync } from "node:child_process";
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
    skis: { kind: "string", default: "chamois", help: "the pair he climbs on" },
    fps: { kind: "number", default: 60, help: "frames a second the drawing is read at" },
    json: { kind: "string", default: "", help: "write the tables to this file" },
    compare: { kind: "string", default: "", help: "a kept --json to print beside this run" },
    sheets: { kind: "flag", default: false, help: "photograph the skier lab's sidestep moves" },
  },
  "usage: node scripts/sidestep-lab.mjs [--json=FILE] [--compare=FILE] [--sheets]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));
const P = await import(join(root, "pwa/src/game/skier-pose.ts"));
const G = await import(join(root, "pwa/src/game/skis-body.ts"));
const ST = await import(join(root, "pwa/src/game/ski-stand.ts"));

const spec = E.skisById(args.skis);
const HZ = E.TUNING.physicsHz;
const DEG = Math.PI / 180;
const IDLE = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };

/** A face of `deg`° falling along +z, the skier stood across it with the
 * hill on his right as a skier who has stopped there stands: his way over
 * the snow held for `SETTLE` s while his legs settle and his skis are set
 * into the hill. `on` is whether he then stands on his platforms. */
const SETTLE = 1;
function stage(deg, packed) {
  const level = S.flatLevel({ packed, grade: Math.tan(deg * DEG), slopeFrom: 200, size: 3000 });
  const state = E.createGame({ level, spec, rivals: 0, countdown: 0, quiet: true });
  E.placeRun(state, { x: 1500, z: 800, heading: Math.PI / 2 });
  const c = state.skier;
  for (let i = 0; i < SETTLE * HZ; i++) {
    c.vx = c.vy = c.vz = 0;
    E.step(state, IDLE);
  }
  return state;
}

// ── CLIMB ─────────────────────────────────────────────────────────────────
const SLOPES = [10, 15, 20, 25, 30, 35, 40, 43, 45, 48, 50, 55];
const CLIMB_S = 15;
const climb = [];
for (const [snow, packed] of [
  ["groomed", 1],
  ["powder", 0],
]) {
  for (const deg of SLOPES) {
    const state = stage(deg, packed);
    const c = state.skier;
    const on = c.sidestep !== 0;
    const y0 = c.y;
    const s0 = c.stride;
    let low = c.y;
    for (let i = 0; i < CLIMB_S * HZ; i++) {
      E.step(state, { ...IDLE, steer: 1 });
      low = Math.min(low, c.y);
    }
    const rise = c.y - y0;
    const pairs = c.stride - s0;
    climb.push({
      id: `${snow} ${deg}°`,
      on: on && c.sidestep !== 0,
      vpm: on ? (rise / CLIMB_S) * 60 : 0,
      pairs: on ? pairs / CLIMB_S : 0,
      step: on && pairs > 0 ? (100 * rise) / Math.sin(deg * DEG) / pairs : 0,
      slip: 100 * (y0 - low),
    });
  }
}

// ── SMOOTH ────────────────────────────────────────────────────────────────
const H = 1 / args.fps;
const JOINTS = ["hips", "neck", "head", "knees", "feet", "hands", "elbows", "poles"];
const mounts = G.mountsOf(spec);
const turnZ = (q, a) => {
  // q × (a about the body's own z).
  const s = Math.sin(a / 2);
  const w = Math.cos(a / 2);
  return {
    x: q.x * w + q.y * s,
    y: q.y * w - q.x * s,
    z: q.z * w + q.w * s,
    w: q.w * w - q.z * s,
  };
};
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

/** Every joint of the drawn pose in the world, at one frame. */
function drawn(state, legs, stand) {
  const c = state.skier;
  P.stepSkierSpring(legs, c.vy, c.airborne, H, 0, c, false, undefined, G.legsLift(c));
  const angle = P.drawnSkiAngle(legs, c);
  const ground = G.groundOf(c, legs);
  // ...as `skis-body.ts`'s `pose` does it: stood over the hill.
  const q = turnZ(c.q, -legs.hill);
  ST.standOf(c, ground, stand, c.incline + legs.hill, angle);
  const input = G.poseInputOf(c, legs, mounts, null, false, stand);
  const pose = P.skierPose(input);
  const origin = { x: c.x, y: c.y, z: c.z };
  const pv = rot(q, { x: stand.pivot.x, y: stand.pivot.y, z: 0 });
  const world = (p) => {
    const r = rot(q, p);
    return { x: origin.x + pv.x + r.x, y: origin.y + pv.y + r.y, z: origin.z + pv.z + r.z };
  };
  const out = {};
  for (const j of JOINTS) {
    const v = pose[j];
    if (!v) continue;
    if (Array.isArray(v)) v.forEach((p, i) => (out[`${j}${i ? "R" : "L"}`] = world(p)));
    else out[j] = world(v);
  }
  return { out, gait: input.gait, platform: legs.platform };
}

function smooth(deg, packed) {
  const state = stage(deg, packed);
  const legs = P.createSkierSpring();
  const stand = ST.emptyStand();
  // A second stood on his platforms, then three pairs of steps.
  const frames = [];
  let acc = 0;
  const seconds = 1 + 3 / E.sidestepPace(deg * DEG, packed).rate;
  for (let t = 0; t < seconds; t += H) {
    acc += H * HZ;
    while (acc >= 1) {
      E.step(state, { ...IDLE, steer: t >= 1 ? 1 : 0 });
      acc -= 1;
    }
    frames.push(drawn(state, legs, stand));
  }
  const worst = { move: { v: 0, j: "" }, snap: { v: 0, j: "" }, foot: 0, basket: 0 };
  const planted = [
    [Infinity, -Infinity],
    [Infinity, -Infinity],
  ];
  const gapOf = (p) => p.y - state.level.groundAt(p.x, p.z);
  // The frames after the body has been stood over the hill.
  const from = Math.ceil(0.6 / H);
  for (let k = from; k < frames.length; k++) {
    const f = frames[k].out;
    const a = frames[k - 1].out;
    const b = k + 1 < frames.length ? frames[k + 1].out : null;
    for (const j of Object.keys(f)) {
      const m = Math.hypot(f[j].x - a[j].x, f[j].y - a[j].y, f[j].z - a[j].z) * 100;
      if (m > worst.move.v) worst.move = { v: m, j };
      if (b) {
        const s =
          Math.hypot(
            b[j].x - 2 * f[j].x + a[j].x,
            b[j].y - 2 * f[j].y + a[j].y,
            b[j].z - 2 * f[j].z + a[j].z,
          ) * 100;
        if (s > worst.snap.v) worst.snap = { v: s, j };
      }
    }
    // What stands on the snow: a foot not lifted, a basket not carried.
    const g = frames[k].gait;
    for (const i of [0, 1]) {
      const side = i ? "R" : "L";
      if (g.lift[i] === 0) {
        const gap = gapOf(f[`feet${side}`]) * 100;
        planted[i][0] = Math.min(planted[i][0], gap);
        planted[i][1] = Math.max(planted[i][1], gap);
        if (f[`poles${side}`] && frames[k].platform > 0.95) {
          const gb = gapOf(f[`poles${side}`]) * 100;
          if (Math.abs(gb) > Math.abs(worst.basket)) worst.basket = gb;
        }
      }
    }
  }
  worst.foot = Math.max(planted[0][1] - planted[0][0], planted[1][1] - planted[1][0]);
  return {
    id: `${packed ? "groomed" : "powder"} ${deg}°`,
    move: worst.move.v,
    moveJ: worst.move.j,
    snap: worst.snap.v,
    snapJ: worst.snap.j,
    foot: worst.foot,
    basket: worst.basket,
  };
}
const smoothRows = [smooth(15, 1), smooth(25, 1), smooth(40, 1), smooth(45, 1), smooth(35, 0)];

// ── Print ─────────────────────────────────────────────────────────────────
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const fmt = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : "—");
const pair = (now, was, d) => (was === undefined ? fmt(now, d) : `${fmt(was, d)}→${fmt(now, d)}`);
const pad = (s, n) => String(s).padStart(n);
const w = before ? 13 : 7;
console.log("CLIMB — stood across the face, the key toward the hill held");
console.log(
  `${"slope".padEnd(14)}${pad("on", 4)}${pad("m/min", w)}${pad("pairs/s", w + 2)}${pad("step cm", w + 2)}${pad("slip cm", w + 2)}`,
);
for (const r of climb) {
  const b = before?.climb.find((x) => x.id === r.id);
  console.log(
    `${r.id.padEnd(14)}${pad(r.on ? "yes" : "no", 4)}${pad(pair(r.vpm, b?.vpm, 1), w)}${pad(pair(r.pairs, b?.pairs, 2), w + 2)}${pad(pair(r.step, b?.step, 0), w + 2)}${pad(pair(r.slip, b?.slip, 0), w + 2)}`,
  );
}
console.log("");
console.log(`SMOOTH — the drawn skier at ${args.fps} fps through three pairs of steps`);
console.log(
  `${"slope".padEnd(14)}${pad("move cm", w + 2)}  ${"(joint)".padEnd(8)}${pad("snap cm", w + 2)}  ${"(joint)".padEnd(8)}${pad("foot cm", w + 2)}${pad("basket cm", w + 2)}`,
);
for (const r of smoothRows) {
  const b = before?.smooth.find((x) => x.id === r.id);
  console.log(
    `${r.id.padEnd(14)}${pad(pair(r.move, b?.move, 2), w + 2)}  ${r.moveJ.padEnd(8)}${pad(pair(r.snap, b?.snap, 2), w + 2)}  ${r.snapJ.padEnd(8)}${pad(pair(r.foot, b?.foot, 1), w + 2)}${pad(pair(r.basket, b?.basket, 1), w + 2)}`,
  );
}
if (args.json) {
  writeFileSync(args.json, JSON.stringify({ climb, smooth: smoothRows }, null, 2));
  console.log(`\nwrote ${args.json}`);
}
if (args.sheets) {
  const run = spawnSync(
    process.execPath,
    [
      join(root, "scripts/skier-preview.mjs"),
      "--move=sidestep,sidestep-steep,sidestep-powder",
      "--sheet=moves,path",
      `--skis=${args.skis}`,
    ],
    { stdio: "inherit", cwd: root },
  );
  process.exit(run.status ?? 1);
}
