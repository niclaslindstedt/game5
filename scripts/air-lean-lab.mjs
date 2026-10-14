#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR-LEAN LAB (`make air-lean`): what a skier's body does in the air
// with the lean held FORWARD (`skier-flight.ts`'s `AIR_FORE`), measured
// against what real skiers do and drawn as wireframes, so a shape is
// chosen by measurement and by eye rather than typed in.
//
// Each move of `scripts/lib/air-lean-moves.mjs` (a kicker flown fully and
// half forward, a cliff dropped forward, the same kicker unleaned as the
// control) is SKIED BY THE REAL ENGINE here in Node and the game's own pose
// taken off every other step, the body's spring stepped as the game steps
// it (as `make skier-metrics` does). Each CANDIDATE is a set of `AIR_FORE`
// numbers laid over the module before its run; the frames read are the
// settled flight — leaned forward, a while in the air, before the reach
// for the snow — and each is measured IN THE WORLD, side on to his line:
//
//   trunk   the trunk forward of the vertical, deg
//   ski     the angle between the spine and the skis, deg (90 the body
//           square to them; under it he has gone over with them, over it
//           he holds himself back against the tips going down)
//   knee    the knees' flexion, deg (0 straight)
//   hip     the hips' flexion, deg (0 straight)
//   over    the hips over the boots along the skis, m (forward +)
//   ahead   the hands ahead of the hips along his line, m
//   high    the hands' height from the hips (0) to the shoulders (1)
//   apart   the hands apart, m
//   even    the hands' difference fore and aft, m (both arms alike)
//   gaze    the eyes below the horizon, deg
//
// THE BANDS are what a skier riding a drop or a kicker pressed forward
// does — from freeride coaching ("hands forward, knees up, stay tight",
// "hands to knees"), the cliff-drop photographs studied for this lab
// (kept local, never committed) and the existing spot shape's research in
// `skier-flight.ts`: the trunk 15–40° forward of the vertical, the body
// square or held back against the skis (65–120°: square is the stance's
// own lean over them, about 70°), the knees bent 55–100°,
// the hips 60–110°, the hips over the boots or the feet shoved out ahead
// of them (−0.25–0.15 m: in the air nothing holds him over them, and the
// knees drawn up put the feet ahead), the
// hands forward of the hips 0.2–0.55 m between the hips and the shoulders,
// shoulder-wide or more, alike, the eyes down the hill 5–40°.
//
// A candidate's SCORE is the share of (frame, band) pairs inside their
// bands, % — and beside it how far outside the misses are. The sheet
// previews/air-lean.png draws every candidate (a column) at three moments
// of each move (a row): the figure side on in the world, its skis, the
// vertical and the snow's line, the frame's misses in red under it.
//
//   node scripts/air-lean-lab.mjs                  every candidate, the table and the sheet
//   node scripts/air-lean-lab.mjs --only=before    one candidate
//   node scripts/air-lean-lab.mjs --json=FILE      the table as JSON
//   node scripts/air-lean-lab.mjs --compare=FILE   the change against one
//   node scripts/air-lean-lab.mjs --detail         every move's readings
//   node scripts/air-lean-lab.mjs --search --only=folded
//                                                  walk the knobs from a candidate to its best score
//   node scripts/air-lean-lab.mjs --only=folded --row='{"bow":0.4}'
//                                                  a candidate changed by hand
//
// The winner is `folded`, shipped as `AIR_FORE`; `before` is the shape
// before this lab (the stance's lean and the spot's arms alone).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";
import { AIR_LEAN_MOVES } from "./lib/air-lean-moves.mjs";
import { measurePose } from "./lib/skier-measure.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    only: {
      kind: "string",
      default: "",
      help: "the candidates to run (comma list); all when left out",
    },
    skis: { kind: "string", default: "chamois", help: "the pair he skis on" },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
    out: { kind: "string", default: "previews", help: "where the sheet is written" },
    detail: { kind: "flag", default: false, help: "every move's readings, a candidate a block" },
    row: {
      kind: "string",
      default: "",
      help: "JSON laid over the first --only candidate's row (to try a shape by hand)",
    },
    search: {
      kind: "flag",
      default: false,
      help: "search the knobs round the best candidate and print the top rows",
    },
  },
  "usage: node scripts/air-lean-lab.mjs [--only=a,b] [--json=file] [--compare=file]",
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
const spec = E.skisById(args.skis);
const mounts = G.mountsOf(spec);
const SHIPPED = structuredClone(FL.AIR_FORE);

/** THE CANDIDATES: `AIR_FORE` rows laid over the module's own. */
const NONE = {
  hold: 0,
  fold: 0,
  back: 0,
  raise: 0,
  pitch: 0,
  keep: 1,
  hips: 0,
  gather: 0,
  nod: 0,
  bow: 0,
  arms: { a: 1.0, out: 0.3, span: 0.8 },
  armShare: 0,
};
const CANDIDATES = [
  { id: "before", say: "before this lab: the stance's lean and the spot's arms alone", row: NONE },
  {
    id: "pressed",
    say: "gone over with the skis: the chest driven down at the tips, the hands reaching for them",
    row: {
      pitch: 0.3,
      keep: 1,
      hips: 0.08,
      gather: 0.02,
      nod: 0.1,
      arms: { a: 1.15, out: 0.2, span: 0.86 },
      armShare: 1,
    },
  },
  {
    id: "upright",
    say: "held upright in the world as the tips go down: the knees drawn up, the hands forward and wide",
    row: {
      pitch: -0.4,
      keep: 0,
      hips: 0.05,
      gather: 0.06,
      nod: 0.25,
      arms: { a: 1.25, out: 0.45, span: 0.82 },
      armShare: 1,
    },
  },
  {
    id: "compact",
    say: "tight: the knees up, the chest over them, the hands to the knees",
    row: {
      pitch: -0.15,
      keep: 0.5,
      hips: 0.06,
      gather: 0.12,
      nod: 0.3,
      arms: { a: 0.95, out: 0.32, span: 0.74 },
      armShare: 1,
    },
  },
  {
    id: "superman",
    say: "laid out flying: the legs long, the chest flat over the skis, the arms reaching ahead",
    row: {
      pitch: 0.5,
      keep: 1,
      hips: 0.0,
      gather: -0.04,
      nod: -0.2,
      arms: { a: 1.9, out: 0.2, span: 0.9 },
      armShare: 1,
    },
  },
  {
    id: "driven",
    say: "driven forward: the hips over the toes, the chest over the knees, the hands forward at the chest",
    row: {
      pitch: -0.1,
      keep: 0.6,
      hips: 0.1,
      gather: 0.08,
      nod: 0.25,
      arms: { a: 1.15, out: 0.38, span: 0.82 },
      armShare: 1,
    },
  },
  {
    id: "searched",
    say: "the held row walked by the search to its best score",
    row: {
      hold: 1,
      fold: 0.04,
      pitch: -0.25,
      keep: 0.3,
      hips: -0.04,
      gather: -0.02,
      nod: 0.25,
      arms: { a: 1.0, out: 0.55, span: 0.71 },
      armShare: 1,
    },
  },
  {
    id: "folded",
    say: "SHIPPED: held back with the knees drawn up to the chest and the hands kept up in front of it",
    row: {
      hold: 0.95,
      fold: 0.27,
      back: 0.58,
      raise: 0.95,
      pitch: -0.275,
      keep: 0.3,
      hips: -0.1,
      gather: 0.01,
      nod: 0.4,
      bow: 0.325,
      arms: { a: 0.975, out: 0.55, span: 0.71 },
      armShare: 1,
    },
  },
  {
    id: "held",
    say: "the trunk held back in the world as the legs turn the skis down: the knees up, the hands forward",
    row: {
      hold: 0.8,
      pitch: 0.05,
      keep: 0.5,
      hips: 0.05,
      gather: 0.08,
      nod: 0.25,
      arms: { a: 1.2, out: 0.4, span: 0.8 },
      armShare: 1,
    },
  },
];

const BANDS = [
  { id: "trunk", lo: 15, hi: 40, unit: "°" },
  { id: "ski", lo: 65, hi: 120, unit: "°" },
  { id: "knee", lo: 55, hi: 100, unit: "°" },
  { id: "hip", lo: 60, hi: 110, unit: "°" },
  { id: "over", lo: -0.25, hi: 0.15, unit: "m" },
  { id: "ahead", lo: 0.2, hi: 0.55, unit: "m" },
  { id: "high", lo: 0.15, hi: 0.95, unit: "" },
  { id: "apart", lo: 0.45, hi: 0.95, unit: "m" },
  { id: "even", lo: 0, hi: 0.12, unit: "m" },
  { id: "gaze", lo: 5, hi: 40, unit: "°" },
];

const DEG = 180 / Math.PI;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => scale(a, 1 / (len(a) || 1));
const mid = (a, b) => scale(add(a, b), 0.5);
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))) * DEG;

/** A body-frame vector turned by the quaternion `q`. */
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

/** The frame's readings, in the world side on to his line. */
function read(pose, c, head) {
  const W = (v) => rot(c.q, v);
  const line = norm({ x: c.vx, y: 0, z: c.vz });
  const hips = W(pose.hips);
  const neck = W(pose.neck);
  const spine = sub(neck, hips);
  const skiF = W({ x: 0, y: 0, z: 1 });
  const m = measurePose(pose, { hipHalf: P.BODY.hip });
  const hands = pose.hands.map(W);
  const sh = mid(W(pose.shoulders[0]), W(pose.shoulders[1]));
  const handMid = mid(hands[0], hands[1]);
  const feetMid = mid(pose.feet[0], pose.feet[1]);
  const gazeDir = W(head.z);
  return {
    trunk: Math.atan2(dot(spine, line), spine.y) * DEG,
    ski: angle(spine, skiF),
    knee: (m.knee[0] + m.knee[1]) / 2,
    hip: (m.hip[0] + m.hip[1]) / 2,
    over: pose.hips.z - feetMid.z,
    ahead: dot(sub(handMid, hips), line),
    high: (handMid.y - hips.y) / Math.max(0.05, sh.y - hips.y),
    apart: Math.abs(pose.hands[1].x - pose.hands[0].x),
    even: Math.abs(pose.hands[1].z - pose.hands[0].z),
    gaze: -Math.asin(Math.max(-1, Math.min(1, gazeDir.y))) * DEG,
    skiPitch: Math.asin(Math.max(-1, Math.min(1, skiF.y))) * DEG,
  };
}

/** One move skied with the candidate laid over `AIR_FORE`. */
function ski(move, row) {
  Object.assign(FL.AIR_FORE, structuredClone(SHIPPED), structuredClone(NONE), structuredClone(row));
  const state = E.createGame({
    level: move.level(S),
    spec,
    rivals: 0,
    countdown: 0,
    quiet: true,
    mode: move.mode,
  });
  E.placeRun(state, move.place());
  const t0 = state.t;
  const steps = Math.round(move.seconds * E.TUNING.physicsHz);
  const legs = P.createSkierSpring();
  const frames = [];
  let lastT = 0;
  let first = true;
  for (let i = 0; i < steps; i++) {
    E.step(state, move.input(state.t - t0, state, E));
    if (i % 2 === 0) continue;
    const c = state.skier;
    const now = state.t - t0;
    P.stepSkierSpring(
      legs,
      c.vy,
      c.airborne,
      first ? 0 : now - lastT,
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
    first = false;
    lastT = now;
    if (c.thrown) continue;
    const stand = ST.standOf(
      c,
      G.groundOf(c, legs),
      undefined,
      undefined,
      P.drawnSkiAngle(legs, c),
    );
    const riding = TP.ridingOf(state, c);
    TP.widenStand(stand, riding.style.stance, P.drawnSkiAngle(legs, c), c.skid, c.speed);
    const input = G.poseInputOf(c, legs, mounts, null, P.inStartGate(state), stand, riding);
    const pose = P.skierPose(input);
    const head = RIG.skierBones(pose).head;
    const f = legs.flight;
    // THE SETTLED FLIGHT: well into the air, the lean's shape come in, the
    // reach for the snow not yet begun.
    const settled = c.airborne && c.airTime > 0.4 && f.reach < 0.25;
    frames.push({
      t: now,
      c: { ...c, q: { ...c.q } },
      pose,
      head,
      settled,
      fore: f.fore,
      m: read(pose, c, head),
    });
  }
  return frames;
}

const spread = (b) => b.hi - b.lo;
const miss = (b, v) =>
  !Number.isFinite(v) ? spread(b) : v < b.lo ? b.lo - v : v > b.hi ? v - b.hi : 0;

function score(runs) {
  let hit = 0;
  let all = 0;
  let off = 0;
  const per = {};
  const means = {};
  for (const b of BANDS) {
    per[b.id] = { hit: 0, all: 0 };
    means[b.id] = [];
  }
  for (const run of runs) {
    if (run.move.id === "air-neutral" || run.move.id === "air-back") continue;
    for (const fr of run.frames.filter((f) => f.settled)) {
      for (const b of BANDS) {
        const v = fr.m[b.id];
        means[b.id].push(v);
        const d = miss(b, v);
        all++;
        per[b.id].all++;
        if (d === 0) {
          hit++;
          per[b.id].hit++;
        } else off += d / spread(b);
      }
    }
  }
  const mean = Object.fromEntries(
    Object.entries(means).map(([k, v]) => [
      k,
      v.reduce((a, x) => a + x, 0) / Math.max(1, v.length),
    ]),
  );
  return { score: (100 * hit) / Math.max(1, all), off: off / Math.max(1, all - hit), per, mean };
}

/** THE SEARCH: each knob stepped either way from the best candidate's
 * row, kept where the score rises, until no step helps. */
const KNOBS = [
  ["hold", 0.1, 0, 1.2],
  ["fold", 0.04, 0, 0.4],
  ["back", 0.04, 0, 0.6],
  ["raise", 0.1, 0, 1],
  ["pitch", 0.05, -0.4, 0.4],
  ["keep", 0.1, 0, 1],
  ["hips", 0.02, -0.1, 0.12],
  ["gather", 0.02, -0.05, 0.15],
  ["nod", 0.05, 0, 0.9],
  ["bow", 0.05, 0, 0.5],
  // The arms within what a skier does with them in the air: forward of
  // hanging and short of overhead, out from his sides no further than a
  // spot's spread and wider, the fists most of an arm's length out.
  ["arms.a", 0.05, 0.8, 1.9],
  ["arms.out", 0.05, 0.2, 0.55],
  ["arms.span", 0.03, 0.7, 0.9],
];
const setKnob = (row, k, v) => {
  const [a, b] = k.split(".");
  if (b) row[a][b] = v;
  else row[a] = v;
};
const getKnob = (row, k) => {
  const [a, b] = k.split(".");
  return b ? row[a][b] : row[a];
};
const judge = (row) => score(AIR_LEAN_MOVES.map((move) => ({ move, frames: ski(move, row) })));
if (args.search) {
  const from = CANDIDATES.find((c) => c.id === (args.only || "held")) ?? CANDIDATES.at(-1);
  let row = structuredClone({ ...NONE, ...from.row });
  let at = judge(row);
  const better = (a, b) =>
    a.score > b.score + 1e-9 || (Math.abs(a.score - b.score) < 1e-9 && a.off < b.off);
  for (const size of [4, 2, 1, 1, 0.5]) {
    let moved = false;
    for (const [k, unit, lo, hi] of KNOBS) {
      const step = unit * size;
      for (const dir of [1, -1]) {
        const next = structuredClone(row);
        const v = +(getKnob(row, k) + dir * step).toFixed(3);
        if (v < lo - 1e-9 || v > hi + 1e-9) continue;
        setKnob(next, k, v);
        const got = judge(next);
        if (better(got, at)) {
          row = next;
          at = got;
          moved = true;
          console.log(
            `  ${k} → ${getKnob(row, k)}  ${at.score.toFixed(1)} %  off ${at.off.toFixed(2)}`,
          );
          break;
        }
      }
    }
    if (!moved && size <= 1) break;
  }
  console.log(JSON.stringify(row));
  Object.assign(FL.AIR_FORE, SHIPPED);
  process.exit(0);
}

if (args.row) {
  const c = CANDIDATES.find((x) => x.id === args.only.split(",")[0]);
  const over = JSON.parse(args.row);
  c.row = {
    ...structuredClone({ ...NONE, ...c.row }),
    ...over,
    arms: { ...(c.row.arms ?? NONE.arms), ...(over.arms ?? {}) },
  };
}
const chosen = args.only ? args.only.split(",") : CANDIDATES.map((c) => c.id);
const results = [];
for (const cand of CANDIDATES.filter((c) => chosen.includes(c.id))) {
  const runs = AIR_LEAN_MOVES.map((move) => ({ move, frames: ski(move, cand.row) }));
  results.push({ cand, runs, ...score(runs) });
}
Object.assign(FL.AIR_FORE, SHIPPED);

// THE TABLE.
const fmt = (v, b) =>
  b && b.unit === "m" ? v.toFixed(2) : b && b.unit === "" ? v.toFixed(2) : v.toFixed(0);
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const cols = ["candidate", "score %", "off", ...BANDS.map((b) => `${b.id} [${b.lo}..${b.hi}]`)];
console.log(cols.join(" | "));
for (const r of results) {
  const was = before?.find((x) => x.id === r.cand.id);
  const row = [
    r.cand.id.padEnd(9),
    r.score.toFixed(0).padStart(3) + (was ? ` (${was.score.toFixed(0)})` : ""),
    r.off.toFixed(2),
    ...BANDS.map(
      (b) =>
        `${fmt(r.mean[b.id], b)} ${((100 * r.per[b.id].hit) / Math.max(1, r.per[b.id].all)).toFixed(0)}%`,
    ),
  ];
  console.log(row.join(" | "));
}
const best = [...results].sort((a, b) => b.score - a.score || a.off - b.off)[0];
if (args.detail)
  for (const r of results)
    for (const run of r.runs) {
      if (run.move.id === "air-neutral" || run.move.id === "air-back") continue;
      const fr = run.frames.filter((f) => f.settled);
      const cells = BANDS.map((b) => {
        const v = fr.map((f) => f.m[b.id]);
        const m = v.reduce((a, x) => a + x, 0) / Math.max(1, v.length);
        const hit = v.filter((x) => miss(b, x) === 0).length;
        return `${b.id} ${fmt(m, b)} ${((100 * hit) / Math.max(1, v.length)).toFixed(0)}%`;
      });
      const tip = fr.map((f) => f.m.skiPitch);
      console.log(
        `${r.cand.id.padEnd(9)} ${run.move.id.padEnd(13)} n=${fr.length} tips ${Math.min(...tip).toFixed(0)}..${Math.max(...tip).toFixed(0)}° | ${cells.join(" | ")}`,
      );
    }
if (best) console.log(`\nbest: ${best.cand.id} — ${best.cand.say} (${best.score.toFixed(0)} %)`);
if (args.json)
  writeFileSync(
    args.json,
    JSON.stringify(
      results.map((r) => ({ id: r.cand.id, score: r.score, off: r.off, mean: r.mean })),
      null,
      2,
    ),
  );

// THE SHEET: a column a candidate, a row a move, three moments a cell.
const INK = {
  bg: [18, 22, 30],
  panel: [28, 33, 44],
  text: [220, 226, 236],
  dim: [120, 128, 142],
  body: [235, 90, 70],
  limbs: [240, 200, 120],
  skis: [120, 170, 250],
  snow: [200, 215, 235],
  vertical: [70, 76, 90],
  miss: [240, 80, 70],
  good: [120, 210, 130],
};
const CW = 300;
const CH = 230;
const HEAD = 46;
const LEFT = 110;
const moves = AIR_LEAN_MOVES;
const d = createDrawing(LEFT + CW * results.length, HEAD + CH * moves.length, INK.bg);
d.text(
  "AIR LEANED FORWARD - CANDIDATES (COLUMNS) BY MOVE (ROWS), SIDE ON IN THE WORLD",
  8,
  8,
  INK.text,
  1,
);
for (let ci = 0; ci < results.length; ci++) {
  const r = results[ci];
  const x0 = LEFT + ci * CW;
  d.text(`${r.cand.id}  ${r.score.toFixed(0)}%`, x0 + 6, 26, r === best ? INK.good : INK.text, 1);
  for (let mi = 0; mi < moves.length; mi++) {
    const y0 = HEAD + mi * CH;
    if (ci === 0) {
      const words = moves[mi].id.split("-");
      words.forEach((w, k) => d.text(w, 8, y0 + 20 + 12 * k, INK.dim, 1));
    }
    d.fillRect(x0 + 2, y0 + 2, CW - 4, CH - 4, INK.panel);
    const fr = r.runs[mi].frames;
    const air = fr.filter((f) => f.c.airborne);
    if (!air.length) continue;
    const picks = [0.3, 0.55, 0.8].map(
      (k) => air[Math.min(air.length - 1, Math.floor(k * air.length))],
    );
    picks.forEach((f, k) => drawFigure(d, f, x0 + 50 + k * 95, y0 + 115, 52));
    const settled = fr.filter((f) => f.settled);
    const s = settled[Math.floor(settled.length / 2)] ?? picks[1];
    const bad = BANDS.filter((b) => miss(b, s.m[b.id]) > 0)
      .map((b) => `${b.id} ${fmt(s.m[b.id], b)}`)
      .join(" ");
    d.text(bad || "all in band", x0 + 6, y0 + CH - 16, bad ? INK.miss : INK.good, 1);
  }
}
mkdirSync(join(root, args.out), { recursive: true });
writeFileSync(join(root, args.out, "air-lean.png"), d.toPng());
console.log(`${args.out}/air-lean.png`);

/** The figure side on to his line in the world, its hips at (cx, cy), `px`
 * pixels a metre: x along his line, y up. */
function drawFigure(dr, f, cx, cy, px) {
  const c = f.c;
  const line = norm({ x: c.vx, y: 0, z: c.vz });
  const hip0 = rot(c.q, f.pose.hips);
  const at = (v) => {
    const w = sub(rot(c.q, v), hip0);
    return [cx + dot(w, line) * px, cy - w.y * px];
  };
  const seg = (a, b, col, st = 2) => {
    const [x0, y0] = at(a);
    const [x1, y1] = at(b);
    dr.line(Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), col, st);
  };
  dr.line(cx, cy - 2.0 * px, cx, cy + 1.4 * px, INK.vertical, 1);
  const p = f.pose;
  for (const i of [0, 1]) {
    const b = p.boots[i];
    const sole = sub(p.feet[i], scale(b.n, mounts.foot.y - mounts.ground));
    seg(add(sole, scale(b.f, -0.8)), add(sole, scale(b.f, 0.95)), INK.skis, 2);
    seg(sole, p.feet[i], INK.dim, 2);
    seg(p.feet[i], p.knees[i], INK.limbs);
    seg(p.knees[i], p.hipJoints ? p.hipJoints[i] : p.hips, INK.limbs);
    seg(p.shoulders[i], p.elbows[i], INK.limbs);
    seg(p.elbows[i], p.hands[i], INK.limbs);
  }
  seg(p.hips, p.waist ?? p.hips, INK.body, 3);
  seg(p.waist ?? p.hips, p.neck, INK.body, 3);
  seg(p.neck, p.head, INK.body, 2);
  const [hx, hy] = at(p.head);
  dr.circle(Math.round(hx), Math.round(hy), 6, INK.body, 2);
  // The eyes' line.
  const g = add(p.head, scale(f.head.z, 0.3));
  seg(p.head, g, INK.dim, 1);
}
