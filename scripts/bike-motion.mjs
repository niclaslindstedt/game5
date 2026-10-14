#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE MOTION LAB (`make bike-motion`): the downhill rider and his bike
// as MOTION, not as stills. Every clip of `pwa/src/tools/bike-clips.ts` —
// the pedal from a standstill, a linked pair of turns, the hardest lean, a
// pump, the longest jump, the whip, the table, the hardest landing, the
// brake to a stop, the foot out, the crash, the push afoot and the lift —
// is ridden on the real engine in Node, and every frame (60 a second) the
// game's own pose of him on the bike is taken (`skier-bike.ts`'s
// `riderPoints`, the joints `riderPose` hangs the figure on) and measured:
//
//   knee     each knee's inside angle, deg (left orange, right blue)
//   elbow    each elbow's inside angle, deg
//   trunk    the trunk's bend forward of the bike's up, deg
//   hips     the hips' middle over the bottom bracket, cm — how far he
//            rises and sinks: a rider who absorbs moves here, a stiff one
//            draws a flat line
//   hands    each hand's gap to its grip, cm (the grip where the drawn bike
//            has it — turned under him in a whip or a table)
//   feet     each ankle's gap to its pedal's middle, cm (a foot on its
//            pedal stands its ankle 6–14 cm off it)
//   head     the head's height in the world against the bike's middle, cm,
//            less its own mean over the clip: a QUIET head is a rider
//            riding the bike under him
//
// Shaded behind each line is the band an attack stance keeps to (from the
// coaching guides and riders' photographs: `docs/downhill-bike.md`); the
// table is each clip's share of frames out of each band, its RANGE of hip
// travel, and its SNAPS — frames a joint is flung further between two
// frames than a body moves (the jolt lab's measure, `jolt-measure.mjs`):
// SNAP read in the bike's own frame (the drawing's own pops), WORLD in the
// world (the bike's landings and chatter in it too).
//
// Where a clip's window lies is printed with it: `make bike-film` (the
// browser lab) photographs the same windows as filmstrips.
//
//   node scripts/bike-motion.mjs                        every clip
//   node scripts/bike-motion.mjs --clip=jump,whip       those clips
//   node scripts/bike-motion.mjs --look=trail           the trail look's rider
//   node scripts/bike-motion.mjs --json=previews/bike-motion-before.json
//   node scripts/bike-motion.mjs --compare=previews/bike-motion-before.json

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";
import { joltVerdict, SNAP_MOST } from "./lib/jolt-measure.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    clip: {
      kind: "string",
      default: "",
      help: "the clips to ride, by id; every one when left out",
    },
    look: { kind: "string", default: "freeride", help: "the rider's look: freeride or trail" },
    out: { kind: "string", default: "previews/bike-motion.png", help: "the graph's PNG" },
    json: { kind: "string", default: "", help: "write the table out as JSON" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
    most: { kind: "number", default: SNAP_MOST, help: "the jolt a frame snaps past, m/s²" },
  },
  "usage: node scripts/bike-motion.mjs [--clip=a,b] [--look=freeride|trail] [--json=file] [--compare=file]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const C = await import(join(root, "pwa/src/tools/bike-clips.ts"));
const SB = {
  ...(await import(join(root, "pwa/src/game/skier-bike.ts"))),
  ...(await import(join(root, "pwa/src/game/bike-ik.ts"))),
};
const BL = await import(join(root, "pwa/src/game/bike-look.ts"));
const ST = await import(join(root, "pwa/src/game/bike-ride-style.ts"));
const Q = await import("@niclaslindstedt/oss-game-framework/core/quat");

const R = E.RAGDOLL;
const styled = args.look === "freeride";
const want = args.clip
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
for (const id of want)
  if (!C.CLIPS.some((c) => c.id === id)) {
    console.error(`unknown clip "${id}" (${C.CLIPS.map((c) => c.id).join(", ")})`);
    process.exit(2);
  }
const clips = want.length ? C.CLIPS.filter((c) => want.includes(c.id)) : C.CLIPS;

// ── THE MEASURES ──────────────────────────────────────────────────────────
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const len = (a) => Math.hypot(a.x, a.y, a.z);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const DEG = 180 / Math.PI;
/** The inside angle at `b` between `a` and `c`, deg. */
const angle = (a, b, c) => {
  const u = sub(a, b);
  const w = sub(c, b);
  return Math.acos(Math.max(-1, Math.min(1, dot(u, w) / (len(u) * len(w) || 1)))) * DEG;
};

/** THE BANDS an attack stance keeps to (null: not held to one). */
const BANDS = {
  knee: [90, 170],
  elbow: [70, 160],
  trunk: [20, 70],
  hips: [40, 85],
  hands: [0, 2],
  feet: [5, 14],
  head: [-12, 12],
};
/** The figures charted: each its id, its words, its chart's range. */
const CHARTS = [
  { id: "knee", say: "knee L/R deg", lo: 40, hi: 180 },
  { id: "elbow", say: "elbow L/R deg", lo: 40, hi: 180 },
  { id: "trunk", say: "trunk fwd deg", lo: 0, hi: 90 },
  { id: "hips", say: "hips over BB cm", lo: 20, hi: 110 },
  { id: "hands", say: "hand gap cm", lo: 0, hi: 20 },
  { id: "feet", say: "foot gap cm", lo: 0, hi: 40 },
  { id: "head", say: "head bob cm", lo: -40, hi: 40 },
];

/** One frame measured: the figures, and the joints in the world. */
function measure(s, t, memory) {
  const b = s.bike;
  const pose = E.bikePose(b);
  const style = styled ? ST.rideStyleOf(b, s.level, s.t) : undefined;
  const on = b.onIt && !s.skier.thrown && b.mode !== "lift";
  // Off it (thrown, afoot, on the chair) he is not measured against the
  // bike: a gap in every line.
  if (!on) return { t, on: false };
  const pts = SB.riderPoints(pose, style, memory, s.t);
  const at = (i) => ({ x: pts[3 * i], y: pts[3 * i + 1], z: pts[3 * i + 2] });
  const bb = BL.bracketFromRider(pose);
  const turn = (p) =>
    style && (style.yaw !== 0 || style.roll !== 0) ? SB.underHim(p, style.yaw, style.roll) : p;
  const grips = BL.gripsAt(pose.steer).map((g) => turn(add(bb, g)));
  // The pedals where the drawn cranks have them (stood level while he
  // coasts, `bike-ik.ts`' `drawnCrank`) where the rider is solved so.
  const crank = memory && SB.drawnCrank ? SB.drawnCrank(memory, pose, s.t) : pose.crank;
  const pedals = BL.pedalsAt(crank).map((p) => turn(add(bb, p)));
  const hipMid = {
    x: (at(R.hipL).x + at(R.hipR).x) / 2,
    y: (at(R.hipL).y + at(R.hipR).y) / 2,
    z: (at(R.hipL).z + at(R.hipR).z) / 2,
  };
  const neck = {
    x: (at(R.shoulderL).x + at(R.shoulderR).x) / 2,
    y: (at(R.shoulderL).y + at(R.shoulderR).y) / 2,
    z: (at(R.shoulderL).z + at(R.shoulderR).z) / 2,
  };
  const spine = sub(neck, hipMid);
  const trunk = Math.atan2(spine.z, spine.y) * DEG;
  const sides = [
    [R.hipL, R.kneeL, R.footL, R.shoulderL, R.elbowL, R.handL],
    [R.hipR, R.kneeR, R.footR, R.shoulderR, R.elbowR, R.handR],
  ];
  const knee = sides.map(([h, k, f]) => angle(at(h), at(k), at(f)));
  const elbow = sides.map(([, , , sh, e, hd]) => angle(at(sh), at(e), at(hd)));
  const hands = sides.map(([, , , , , hd], i) => len(sub(at(hd), grips[i])) * 100);
  const feet = sides.map(([, , f], i) => len(sub(at(f), pedals[i])) * 100);
  // The world: his centre of mass on the bike's attitude.
  const o = { x: s.skier.x, y: s.skier.y, z: s.skier.z };
  const world = (p) => add(o, Q.rotate(pose.q, p));
  const joints = {};
  const local = {};
  const names = Object.keys(R).filter((k) => k !== "count");
  for (const n of names) {
    joints[n] = world(at(R[n]));
    local[n] = at(R[n]);
  }
  return {
    t,
    on: true,
    knee,
    elbow,
    trunk: [trunk],
    hips: [(hipMid.y - bb.y) * 100],
    hands,
    feet,
    headY: joints.head.y - pose.y,
    joints,
    local,
    foot: style?.footOut > 0.2 ? style.foot : -1,
  };
}

/** The share of frames out of each band (a foot put down off its pedal on
 * purpose — the foot out — is not counted against the feet). */
function outShares(frames) {
  const out = {};
  for (const ch of CHARTS) {
    const band = BANDS[ch.id];
    let n = 0;
    let bad = 0;
    for (const f of frames) {
      if (!f.on) continue;
      f[ch.id].forEach((v, i) => {
        if (ch.id === "feet" && f.foot === i) return;
        n++;
        if (v < band[0] || v > band[1]) bad++;
      });
    }
    out[ch.id] = n ? bad / n : 0;
  }
  return out;
}

// ── THE RIDES ─────────────────────────────────────────────────────────────
const rows = [];
for (const clip of clips) {
  const win = C.clipWindow(clip);
  if (!win) {
    rows.push({ id: clip.id, about: clip.about, missing: true });
    continue;
  }
  const frames = [];
  const memory = SB.ikMemory ? SB.ikMemory() : undefined;
  await C.rideClip(clip, win, (s, t) => frames.push(measure(s, t, memory)));
  const on = frames.filter((f) => f.on);
  if (on.length) {
    const mean = on.reduce((a, f) => a + f.headY, 0) / on.length;
    for (const f of on) f.head = [(f.headY - mean) * 100];
  }
  // SNAP is read in the bike's own frame (the drawing's pops, the bike's
  // motion taken out); WORLD with it (what the lens sees: a landing's stop
  // and the bike's chatter are in it).
  const verdict = joltVerdict(
    on.map((f) => ({ t: f.t, joints: f.local })),
    args.most,
  );
  const inWorld = joltVerdict(
    on.map((f) => ({ t: f.t, joints: f.joints })),
    args.most,
  );
  const hips = on.map((f) => f.hips[0]);
  rows.push({
    id: clip.id,
    about: clip.about,
    window: win,
    frames,
    on: on.length,
    out: { ...outShares(frames), snap: verdict.share, world: inWorld.share },
    travel: hips.length ? Math.max(...hips) - Math.min(...hips) : 0,
    worst: { a: verdict.worst.a, joint: verdict.worst.joint, t: verdict.worst.t },
    pops: verdict.pops,
    snaps: verdict.jolts.filter((j) => j.a > args.most).map((j) => j.t),
  });
}

if (process.env.BIKE_MOTION_MEDIANS)
  for (const r of rows.filter((x) => !x.missing)) {
    const med = (xs) => xs.sort((a, b) => a - b)[xs.length >> 1]?.toFixed(0);
    const on = r.frames.filter((f) => f.on);
    console.log(r.id, CHARTS.map((c) => `${c.id} ${med(on.flatMap((f) => f[c.id]))}`).join("  "));
  }

// ── THE TABLE ─────────────────────────────────────────────────────────────
const before = args.compare ? JSON.parse(readFileSync(resolve(root, args.compare), "utf8")) : null;
const pad = (s, n) => String(s).padStart(n);
const pct = (v) => `${Math.round(v * 100)}%`;
const COLUMNS = [...CHARTS.map((c) => c.id), "snap", "world"];
console.log(
  `bike motion · seed ${C.CLIP_MAP.seed} (the table seed 4) · look ${args.look} · ${C.CLIP_HZ} Hz\n`,
);
console.log(
  `${"clip".padEnd(9)}${"window s".padEnd(13)}${COLUMNS.map((c) => pad(c, 9)).join("")}${pad("travel", 11)}   worst snap`,
);
for (const r of rows) {
  if (r.missing) {
    console.log(`${r.id.padEnd(9)}— not ridden: ${r.about}`);
    continue;
  }
  const was = before?.find((b) => b.id === r.id);
  const cells = COLUMNS.map((c) => {
    const now = pct(r.out[c]);
    const then = was?.out ? pct(was.out[c] ?? 0) : null;
    return pad(then !== null && then !== now ? `${then}>${now}` : now, 9);
  });
  const tv = `${r.travel.toFixed(0)} cm`;
  const tvWas = was?.travel !== undefined ? `${was.travel.toFixed(0)}>` : "";
  const w = r.worst;
  const worst = w.a > 0 ? `${Math.round(w.a)} m/s² ${w.joint} @${w.t.toFixed(2)}s` : "—";
  const span = `${r.window[0].toFixed(1)}–${r.window[1].toFixed(1)}`;
  console.log(
    `${r.id.padEnd(9)}${span.padEnd(13)}${cells.join("")}${pad(tvWas && tvWas !== `${r.travel.toFixed(0)}>` ? tvWas + tv : tv, 11)}   ${worst}${r.on < r.frames.length ? `  (${r.frames.length - r.on} frames off the bike)` : ""}`,
  );
}
console.log(
  `\nbands: ${Object.entries(BANDS)
    .map(([k, [a, b]]) => `${k} ${a}..${b}`)
    .join("  ")}  · snap past ${args.most} m/s²`,
);
if (args.json) {
  mkdirSync(dirname(resolve(root, args.json)), { recursive: true });
  writeFileSync(
    resolve(root, args.json),
    JSON.stringify(
      rows.map((r) =>
        r.missing
          ? { id: r.id, missing: true }
          : {
              id: r.id,
              window: r.window,
              out: r.out,
              travel: r.travel,
              worst: r.worst,
              pops: r.pops,
            },
      ),
      null,
      2,
    ),
  );
}

// ── THE GRAPH: a row a clip, a chart a figure, time across ────────────────
const INK = {
  bg: [14, 18, 24],
  frame: [52, 60, 74],
  text: [220, 226, 236],
  dim: [130, 140, 156],
  band: [60, 150, 90, 70],
  left: [244, 150, 60],
  right: [90, 170, 250],
  one: [236, 236, 120],
  grid: [34, 40, 52],
  snap: [240, 70, 70],
};
const CW = 190;
const CH = 80;
const GAP = 30;
const LEFT = 120;
const ROW = CH + 34;
const drawn = rows.filter((r) => !r.missing);
const W = LEFT + CHARTS.length * (CW + GAP);
const d = createDrawing(W, 46 + drawn.length * ROW, INK.bg);
d.text(`bike motion: the rider on the bike, frame by frame (${args.look})`, 10, 10, INK.text, 2);
d.text(
  "shaded: the attack stance's band  orange: left  blue: right  yellow: the one figure  red tick: a snap",
  10,
  30,
  INK.dim,
);
drawn.forEach((r, i) => {
  const y0 = 46 + i * ROW;
  const [a, b] = r.window;
  d.text(r.id, 10, y0 + 16, INK.text, 2);
  d.text(`${(b - a).toFixed(1)} s`, 10, y0 + 40, INK.dim);
  d.text(`travel ${r.travel.toFixed(0)}cm`, 10, y0 + 54, INK.dim);
  CHARTS.forEach((ch, j) => {
    const x0 = LEFT + j * (CW + GAP);
    const top = y0 + 14;
    const px = (t) => x0 + ((t - a) / Math.max(1e-6, b - a)) * CW;
    const py = (v) =>
      top + CH - ((Math.max(ch.lo, Math.min(ch.hi, v)) - ch.lo) / (ch.hi - ch.lo)) * CH;
    d.text(`${ch.say}  out ${pct(r.out[ch.id])}`, x0, y0 + 2, INK.dim);
    const band = BANDS[ch.id];
    d.fillRect(x0, py(band[1]), CW, Math.max(1, py(band[0]) - py(band[1])), INK.band);
    const lines = ch.id === "trunk" || ch.id === "hips" || ch.id === "head" ? 1 : 2;
    for (let l = 0; l < lines; l++) {
      const colour = lines === 1 ? INK.one : l === 0 ? INK.left : INK.right;
      let run = [];
      const flush = () => {
        if (run.length > 1) d.polyline(run, colour, 2);
        run = [];
      };
      for (const f of r.frames) {
        if (!f.on) flush();
        else run.push([px(f.t), py(f[ch.id][l])]);
      }
      flush();
    }
    // The snaps, ticked along the top of every chart.
    for (const t of r.snaps) d.line(px(t), top, px(t), top + 6, INK.snap);
    d.rect(x0, top, CW, CH, INK.frame);
    d.text(String(ch.hi), x0 - 22, top - 3, INK.dim);
    d.text(String(ch.lo), x0 - 22, top + CH - 6, INK.dim);
  });
});
mkdirSync(dirname(resolve(root, args.out)), { recursive: true });
writeFileSync(resolve(root, args.out), d.toPng());
console.log(`\n${args.out}`);
