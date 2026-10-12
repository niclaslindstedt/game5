#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SPRAY EVAL (`make spray-eval`): WHICH WAY OF FLYING THE SPRAY IS
// BEST — the four models `spray-sim.ts` carries (`puff`, round sprites
// drifting; `streak`, a fan of grains under a linear drag; `drag`, every
// grain a size and a fall speed of its own under a quadratic drag, clumps
// breaking where they land; `sheet`, drag's flight thrown off the edge in
// rows that leave as a curtain) — each flown through the same real runs:
// the engine skis a pair and a board through linked carves, a skidded turn
// and a hockey stop at 30, 40 and 50 km/h on the groomer and in powder, on
// the synthetic strip (`tests/support/synthetic.ts`), every frame flown at
// 60 a second as the renderer flies it.
//
// Every model is SCORED against what a real turn throws (the bands are the
// research's — the measured fall speeds of snow, and the throw a stop and a
// turn make, read off film where nothing is measured):
//
//   along    the share of the edge's throw going the way the edge slides
//            (a stop throws ahead of him, never back) — 0.9 and over
//   launch   a chip's speed over the ground over the edge's slide (the
//            snow lies still until the edge shoves it) — 0.5–1.2
//   high     the 95th percentile height of a stop's or a skid's throw, m —
//            the groomer 0.5–1.5, powder 1–2.5 (the heavy part: the fine
//            cloud that climbs on over it is `snow-cloud.ts`'s)
//   reach    its 95th percentile reach, m — the groomer 2–4, powder 3–6
//   carve    a carve's throw over a skid's — under 0.15
//   settle   how fast the slowest quarter falls once past its top, m/s —
//            the fines hang at 0.5–1.5
//   sheet    how thin the spray just thrown is against how wide (the
//            smallest spread over the largest of its first 0.15 s) — a
//            curtain is thin: under 0.3
//   steady   how much a stop's throw jitters frame to frame (the spread of
//            the grains thrown a frame over their mean) — low
//   stroke   how long a grain is drawn against how wide (`spray.ts`'s
//            streak over its shutter): a thrown thing reads as a stroke,
//            2–8 times its width; a dot reads as smoke, a needle as rain
//   hang     the share of the throw the air HOLDS UP — aloft half as long
//            again as a stone thrown as high — the groomer's few chips,
//            powder's fines hanging: 0.02–0.2 and 0.15–0.45
//   cost     the pool's milliseconds a frame for one skier — low
//
// and the AGE AND DEPTH table under it rides the game's model through a
// stop on every age of snow (`snow-age.ts`'s forced kinds) and three depths
// of it, to show how much the spray hangs on both. Pure Node, seconds.
//
//   node scripts/spray-eval.mjs
//   node scripts/spray-eval.mjs --models=drag,sheet --json=previews/spray-eval.json

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    models: { kind: "string", default: "puff,streak,drag,sheet", help: "the models scored" },
    json: { kind: "string", default: "", help: "write the scores as JSON to this file" },
    ages: { kind: "flag", help: "the age and depth table alone" },
    detail: { kind: "string", default: "", help: "every run of one model, row by row" },
  },
  "usage: node scripts/spray-eval.mjs [--models=a,b] [--json=f] [--ages]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));
const P = await import(join(root, "pwa/src/game/spray-sim.ts"));
const K = await import(join(root, "pwa/src/game/snowpack.ts"));
const A = await import(join(root, "pwa/src/game/snow-age.ts"));
const H = await import(join(root, "pwa/src/game/hold-input.ts"));

const FRAME = 1 / 60;
const pitchFor = (kmh) =>
  Math.tan(((kmh <= 20 ? 4 : kmh <= 30 ? 7 : kmh <= 50 ? 10 : 14) * Math.PI) / 180);
const pct = (xs, q) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

/** Ride `move` from `kmh` on `snow`, flying `model`; what the probe saw. */
function ride(model, pair, snow, packed, move, kmh) {
  const stop = move === "stop";
  const level = S.flatLevel(
    stop ? { packed } : { packed, grade: pitchFor(kmh), slopeFrom: 200, size: 4000 },
  );
  const state = E.createGame({
    level,
    spec: E.pairById(pair),
    rivals: 0,
    countdown: 0,
    quiet: true,
  });
  E.placeRun(
    state,
    stop
      ? { x: 1500, z: 200, heading: 0, speed: kmh / 3.6 }
      : { x: 2000, z: 600, heading: 0, speed: kmh / 3.6 },
  );
  const slips = [P.emptySlip(), P.emptySlip()];
  const seen = {
    along: 0,
    alongN: 0,
    ratio: [],
    peak: [],
    reach: [],
    fall: [],
    sheet: [],
    per: [],
    long: [],
    hung: [],
  };
  let frameSlide = 0;
  let frameAcross = { x: 1, z: 0 };
  let thrownThisFrame = 0;
  let live = false;
  let pool;
  pool = P.createSprayPool(20000, {
    spawn(i) {
      thrownThisFrame++;
      if (!live || frameSlide < 2) return;
      // In the world's frame: the snow lies still until the edge shoves it,
      // so a chip leaves the way the edge slides and no faster than it.
      const rx = pool.vel[i * 3];
      const rz = pool.vel[i * 3 + 2];
      const flat = Math.hypot(rx, rz);
      const v = Math.hypot(rx, pool.vel[i * 3 + 1], rz);
      // How long a stroke it is drawn as, over how wide (`spray.ts`).
      const streak = pool.model === "puff" ? 0 : 1;
      seen.long.push(
        (pool.size[i] + v * 0.045 * streak * (1 - 0.75 * pool.hard[i])) / pool.size[i],
      );
      seen.alongN++;
      if (rx * frameAcross.x + rz * frameAcross.z > 0) seen.along++;
      seen.ratio.push(flat / frameSlide);
    },
    retire(i, peak, reach) {
      if (!live) return;
      // Held up by the air: aloft half as long again as a stone thrown
      // as high would be.
      const stone = 2 * Math.sqrt((2 * peak) / 9);
      seen.hung.push(peak > 0.1 && pool.age[i] > 1.5 * stone + 0.15 ? 1 : 0);
      seen.peak.push(peak);
      seen.reach.push(reach);
    },
  });
  pool.model = model;
  const short = stop || move === "skid";
  const seconds = short ? 2.2 : 4;
  const from = short ? 0.3 : 1.2;
  const t0 = state.t;
  let ms = 0;
  let frames = 0;
  let thrown = 0;
  for (let i = 0; i < seconds * E.TUNING.physicsHz; i++) {
    const t = state.t - t0;
    E.step(state, H.holdInput(state, kmh, 0, move, t));
    if (i % 2 === 1) continue;
    live = t >= from;
    const s = state.skier;
    const n = P.edgeSlips(s, slips);
    let best = 0;
    for (let k = 0; k < n; k++) {
      const w = slips[k].share * slips[k].slide;
      if (w > best) {
        best = w;
        frameSlide = slips[k].slide;
        frameAcross = slips[k].across;
      }
    }
    if (best === 0) frameSlide = 0;
    thrownThisFrame = 0;
    const c0 = performance.now();
    pool.emit(s, level, FRAME, 0, snow);
    pool.step(FRAME, level);
    const c1 = performance.now();
    if (!live) continue;
    ms += c1 - c0;
    frames++;
    thrown += thrownThisFrame;
    seen.per.push(thrownThisFrame);
    // The slowest quarter of what is falling past its top, and how thin
    // what was just thrown lies.
    const young = [];
    for (let j = 0; j < pool.cap; j++) {
      if (pool.alpha[j] <= 0.004) continue;
      if (pool.age[j] > 0.35 && pool.vel[j * 3 + 1] < 0 && pool.hard[j] < 0.5) {
        seen.fall.push(-pool.vel[j * 3 + 1]);
      }
      if (pool.age[j] < 0.15) young.push(j);
    }
    if (young.length >= 12) seen.sheet.push(thinness(pool.pos, young));
  }
  const mean = seen.per.reduce((a, b) => a + b, 0) / Math.max(1, seen.per.length);
  const sd = Math.sqrt(
    seen.per.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, seen.per.length),
  );
  return {
    rate: thrown / Math.max(1e-6, frames * FRAME),
    along: seen.alongN ? seen.along / seen.alongN : null,
    launch: seen.ratio.length ? pct(seen.ratio, 0.5) : null,
    high: pct(seen.peak, 0.95),
    reach: pct(seen.reach, 0.95),
    settle: seen.fall.length ? pct(seen.fall, 0.25) : null,
    sheet: seen.sheet.length ? seen.sheet.reduce((a, b) => a + b, 0) / seen.sheet.length : null,
    steady: mean > 0 ? sd / mean : null,
    long: seen.long.length ? pct(seen.long, 0.5) : null,
    hang: seen.hung.length ? seen.hung.reduce((a, b) => a + b, 0) / seen.hung.length : null,
    ms: frames ? ms / frames : 0,
  };
}

/** The smallest spread of the points over the largest (a principal-axis
 * fit): 0 a sheet, 1 a ball. */
function thinness(pos, idx) {
  let mx = 0;
  let my = 0;
  let mz = 0;
  for (const j of idx) {
    mx += pos[j * 3];
    my += pos[j * 3 + 1];
    mz += pos[j * 3 + 2];
  }
  const n = idx.length;
  mx /= n;
  my /= n;
  mz /= n;
  const c = [0, 0, 0, 0, 0, 0]; // xx xy xz yy yz zz
  for (const j of idx) {
    const x = pos[j * 3] - mx;
    const y = pos[j * 3 + 1] - my;
    const z = pos[j * 3 + 2] - mz;
    c[0] += x * x;
    c[1] += x * y;
    c[2] += x * z;
    c[3] += y * y;
    c[4] += y * z;
    c[5] += z * z;
  }
  const ev = eigen3(c.map((v) => v / n));
  return Math.sqrt(Math.max(0, ev[0]) / Math.max(1e-9, ev[2]));
}

/** The eigenvalues of a symmetric 3×3 (xx xy xz yy yz zz), ascending. */
function eigen3([a, b, c, d, e, f]) {
  const p1 = b * b + c * c + e * e;
  if (p1 < 1e-12) return [a, d, f].sort((x, y) => x - y);
  const q = (a + d + f) / 3;
  const p2 = (a - q) ** 2 + (d - q) ** 2 + (f - q) ** 2 + 2 * p1;
  const p = Math.sqrt(p2 / 6);
  const B = [(a - q) / p, b / p, c / p, (d - q) / p, e / p, (f - q) / p];
  const det =
    B[0] * (B[3] * B[5] - B[4] * B[4]) -
    B[1] * (B[1] * B[5] - B[4] * B[2]) +
    B[2] * (B[1] * B[4] - B[3] * B[2]);
  const r = Math.min(1, Math.max(-1, det / 2));
  const phi = Math.acos(r) / 3;
  const e1 = q + 2 * p * Math.cos(phi);
  const e3 = q + 2 * p * Math.cos(phi + (2 * Math.PI) / 3);
  return [e3, 3 * q - e1 - e3, e1];
}

/** 1 inside [lo, hi], falling to 0 a whole band's width outside it. */
const band = (v, lo, hi) => {
  if (v === null || !Number.isFinite(v)) return 0;
  const w = Math.max(hi - lo, lo * 0.5, 0.1);
  return v < lo ? Math.max(0, 1 - (lo - v) / w) : v > hi ? Math.max(0, 1 - (v - hi) / w) : 1;
};
const under = (v, good, bad) =>
  v === null ? 0 : Math.max(0, Math.min(1, (bad - v) / (bad - good)));
const over = (v, good, bad) =>
  v === null ? 0 : Math.max(0, Math.min(1, (v - bad) / (good - bad)));
const avg = (xs) => {
  const ys = xs.filter((x) => x !== null && Number.isFinite(x));
  return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : null;
};

const WEIGHTS = {
  along: 2,
  launch: 1,
  high: 1.5,
  reach: 1.5,
  carve: 1,
  settle: 1,
  sheet: 1.5,
  steady: 0.5,
  stroke: 1,
  hang: 1,
  cost: 1,
};

function evaluate(model) {
  const keys = [
    "along",
    "launch",
    "high",
    "reach",
    "carve",
    "settle",
    "sheet",
    "steady",
    "stroke",
    "hang",
  ];
  const parts = Object.fromEntries([...keys, "cost"].map((k) => [k, []]));
  const raw = Object.fromEntries([...keys, "ms"].map((k) => [k, []]));
  for (const pair of ["chamois", "lynx"]) {
    for (const [kind, packed, h, r, hang] of [
      ["groomed", 1, [0.5, 1.5], [2, 4], [0.02, 0.2]],
      ["soft", 0, [1, 2.5], [3, 6], [0.15, 0.45]],
    ]) {
      const snow = K.ageSnow(K.SNOW[kind], null, K.emptyAged());
      for (const kmh of [30, 40, 50]) {
        const stop = ride(model, pair, snow, packed, "stop", kmh);
        const skid = ride(model, pair, snow, packed, "skid", kmh);
        const carve = ride(model, pair, snow, packed, "carve", kmh);
        for (const m of [stop, skid]) {
          raw.along.push(m.along);
          parts.along.push(over(m.along, 0.9, 0.6));
          raw.launch.push(m.launch);
          parts.launch.push(band(m.launch, 0.5, 1.2));
          raw.high.push(m.high);
          parts.high.push(band(m.high, h[0], h[1]));
          raw.reach.push(m.reach);
          parts.reach.push(band(m.reach, r[0], r[1]));
          raw.settle.push(m.settle);
          parts.settle.push(band(m.settle, 0.5, 1.5));
          raw.ms.push(m.ms);
          raw.stroke.push(m.long);
          parts.stroke.push(band(m.long, 2, 8));
          raw.hang.push(m.hang);
          parts.hang.push(band(m.hang, hang[0], hang[1]));
        }
        const cr = skid.rate > 0 ? carve.rate / skid.rate : null;
        raw.carve.push(cr);
        parts.carve.push(under(cr, 0.15, 0.5));
        raw.sheet.push(stop.sheet);
        parts.sheet.push(under(stop.sheet, 0.3, 0.6));
        raw.steady.push(stop.steady);
        parts.steady.push(under(stop.steady, 0.4, 1.2));
      }
    }
  }
  const ms = avg(raw.ms);
  parts.cost = [under(ms, 0.05, 0.6)];
  let total = 0;
  let weight = 0;
  const score = {};
  for (const [k, w] of Object.entries(WEIGHTS)) {
    score[k] = avg(parts[k]) ?? 0;
    total += score[k] * w;
    weight += w;
  }
  return {
    model,
    score: (100 * total) / weight,
    parts: score,
    raw: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, avg(v)])),
  };
}

const pad = (s, n) => String(s).padStart(n);
const fmt = (v, d) => (v === null || !Number.isFinite(v) ? "—" : v.toFixed(d));
const out = { models: [], ages: [] };

if (args.detail) {
  console.log(`spray eval · ${args.detail}, run by run`);
  for (const pair of ["chamois", "lynx"])
    for (const [kind, packed] of [
      ["groomed", 1],
      ["soft", 0],
    ])
      for (const move of ["carve", "skid", "stop"])
        for (const kmh of [30, 40, 50]) {
          const snow = K.ageSnow(K.SNOW[kind], null, K.emptyAged());
          const m = ride(args.detail, pair, snow, packed, move, kmh);
          console.log(
            `${pair}/${kind}/${move}/${kmh}`.padEnd(24) +
              ["rate", "along", "launch", "high", "reach", "settle", "hang"]
                .map((k) => `${k} ${fmt(m[k], k === "rate" ? 0 : 2)}`.padEnd(13))
                .join(""),
          );
        }
  process.exit(0);
}

if (!args.ages) {
  console.log(
    "spray eval · four models flown through the same runs, scored against a real turn's throw",
  );
  const cols = [
    "along",
    "launch",
    "high",
    "reach",
    "carve",
    "settle",
    "sheet",
    "steady",
    "stroke",
    "hang",
    "ms",
  ];
  console.log(["model".padEnd(8), pad("score", 6), ...cols.map((c) => pad(c, 8))].join(""));
  for (const m of args.models.split(",")) {
    if (!P.isSprayModel(m)) {
      console.error(`unknown model "${m}" (${P.SPRAY_MODELS.join(", ")})`);
      process.exit(2);
    }
    const r = evaluate(m);
    out.models.push(r);
    console.log(
      [
        m.padEnd(8),
        pad(fmt(r.score, 0), 6),
        ...cols.map((c) => pad(fmt(r.raw[c], c === "ms" ? 3 : 2), 8)),
      ].join(""),
    );
    console.log(
      ["".padEnd(14), ...Object.keys(WEIGHTS).map((k) => pad(fmt(r.parts[k], 2), 8))].join(""),
    );
  }
  console.log("(second line of each: every metric's score, 0..1, in the same order — cost last)");
  const ranked = [...out.models].sort((a, b) => b.score - a.score);
  console.log(
    `ranked: ${ranked.map((r) => `${r.model} ${r.score.toFixed(0)}`).join(" > ")}; the game flies ${P.SPRAY_MODEL}`,
  );
  console.log("");
}

// THE AGE AND DEPTH TABLE: the game's model through a hockey stop from 40
// km/h on loose snow of every age and three depths of it.
console.log(`age and depth · ${P.SPRAY_MODEL} · chamois · hockey stop from 40 km/h in loose snow`);
console.log(
  [
    "age".padEnd(9),
    pad("depth", 6),
    pad("grains/s", 9),
    pad("clumps", 7),
    pad("fines", 6),
    pad("cloud", 6),
    pad("launch", 7),
    pad("high", 6),
    pad("reach", 6),
    pad("glint", 6),
  ].join(""),
);
const level0 = S.flatLevel({ packed: 0 });
for (const kind of ["none", ...A.SNOW_AGE_KINDS]) {
  for (const depth of [0.5, 1, 2]) {
    const age =
      kind === "none"
        ? null
        : A.snowAgeOf({ seed: 1, sun: level0.sun, weather: level0.weather }, { force: kind });
    const base = { ...K.SNOW.soft, loose: K.SNOW.soft.loose * depth };
    const snow = K.ageSnow(base, age, K.emptyAged());
    const level = S.flatLevel({ packed: 0 });
    const state = E.createGame({
      level,
      spec: E.pairById("chamois"),
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
    E.placeRun(state, { x: 1500, z: 200, heading: 0, speed: 40 / 3.6 });
    let clumps = 0;
    let n = 0;
    let fines = 0;
    let glints = 0;
    let pool;
    pool = P.createSprayPool(20000, {
      spawn(i) {
        n++;
        if (pool.hard[i] > 0.5) clumps++;
        if (pool.term[i] < 1.2) fines++;
        glints += pool.glint[i];
      },
    });
    const t0 = state.t;
    let tally = { thrown: 0, launch: 0, high: 0, reach: 0, done: 0 };
    for (let i = 0; i < 2 * E.TUNING.physicsHz; i++) {
      E.step(state, H.holdInput(state, 40, 0, "stop", state.t - t0));
      if (i % 2) continue;
      pool.emit(state.skier, level, FRAME, 0, snow);
      pool.step(FRAME, level);
      const st = pool.stats();
      for (const k of Object.keys(tally)) tally[k] += st[k];
    }
    const row = {
      age: kind,
      depth,
      rate: n / 2,
      clumps: n ? clumps / n : 0,
      fines: n ? fines / n : 0,
      cloud: snow.loose * snow.fine,
      launch: tally.thrown ? tally.launch / tally.thrown : 0,
      high: tally.done ? tally.high / tally.done : 0,
      reach: tally.done ? tally.reach / tally.done : 0,
      glint: n ? glints / n : 0,
    };
    out.ages.push(row);
    console.log(
      [
        kind.padEnd(9),
        pad(depth, 6),
        pad(fmt(row.rate, 0), 9),
        pad(fmt(row.clumps, 2), 7),
        pad(fmt(row.fines, 2), 6),
        pad(fmt(row.cloud, 2), 6),
        pad(fmt(row.launch, 1), 7),
        pad(fmt(row.high, 2), 6),
        pad(fmt(row.reach, 2), 6),
        pad(fmt(row.glint, 2), 6),
      ].join(""),
    );
  }
}
if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 1));
