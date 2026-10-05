#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE PROCESSOR PAYS A FRAME, measured in plain Node — no build, no
// browser, no GPU. Two halves of a frame never need a canvas to be timed:
//
//   ENGINE  one engine step (`step`) and the bot's decision (`botInput`),
//           per step, on the runs a player actually takes: the benchmark's
//           pinned race (four whole runs), a free ride (the crowd), a
//           slalom and a downhill. The app takes two steps a frame at 60 Hz.
//   VIEWS   the three.js side of the renderer that is CPU work — a view's
//           per-frame `update`, which fills instance buffers and needs no
//           WebGL: the FOREST's band refill along the benchmark race behind
//           a chase lens (the FOREST and DISTANCE rows' processor half), the
//           LIFTS' carriers and the free ride's CROWD; the GROUND's cull to
//           the lens (`terrain.ts`'s `follow`), with the triangles it leaves
//           drawn beside the whole clipmap's; and the POSE — every
//           rider of the benchmark race posed off his run, the renderer's
//           `pose` phase (`skis-body.ts`'s `pose` and the merge it drives).
//
// A view prints a HASH of what it filled (every drawn instance's bytes at
// the last frame), so a speed-up that must change nothing is proved to
// change nothing: run the lab before and after, and the hashes must match.
// Anything that reads the wall clock (the forest's dissolve) is handed a
// clock pinned to the frame here, or two runs could not be compared.
//
//   npm run cpu-cost                          every suite
//   npm run cpu-cost -- --suite forest        one (engine, forest, lifts, crowd)
//   npm run cpu-cost -- --forest medium --distance low --shadows off
//   npm run cpu-cost -- --json previews/cpu-before.json
//   npm run cpu-cost -- --compare previews/cpu-before.json
//
// READ IT AS A RATIO. A container's timings move with whatever else the
// machine is doing (a browser lab running beside it doubles them), so run
// the before and the after back to back on a quiet machine, and trust a
// change only when it is well outside the p50's spread across two runs.
// The `perf-optimization` skill says where this sits among the other meters.

import { writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
aliasEngine(root);

const SUITES = ["engine", "pose", "forest", "terrain", "lifts", "crowd"];
const args = parseArgs(
  process.argv.slice(2),
  {
    suite: { kind: "list", help: `suites to run (${SUITES.join(", ")}); all when left out` },
    frames: {
      kind: "number",
      default: 1200,
      help: "frames timed per view suite (after a warm-up)",
    },
    steps: { kind: "number", default: 2400, help: "steps timed per engine run" },
    forest: { kind: "string", default: "high", help: "the FOREST row (low, medium, high)" },
    terrain: { kind: "string", default: "high", help: "the TERRAIN row (low, medium, high)" },
    distance: {
      kind: "string",
      default: "high",
      help: "the DISTANCE row (low, medium, high, max)",
    },
    shadows: {
      kind: "string",
      default: "high",
      help: "the SHADOWS row (off, skiers, medium, high)",
    },
    json: { kind: "string", help: "write the table as JSON here" },
    compare: { kind: "string", help: "a --json file from an earlier run, printed beside this one" },
  },
  "usage: npm run cpu-cost -- [--suite a,b] [--frames n] [--json out] [--compare before.json]",
);
const suites = args.suite ?? SUITES;
for (const s of suites) {
  if (!SUITES.includes(s)) {
    console.error(`unknown suite ${s} (${SUITES.join(", ")})`);
    process.exit(2);
  }
}

const E = await import(join(root, "engine/index.ts"));
const THREE = await import("three");
const { BENCHMARK, benchmarkLevel } = await import(join(root, "pwa/src/game/benchmark-plan.ts"));
const { createHazeUniforms } = await import(join(root, "pwa/src/game/haze.ts"));
const V = await import(join(root, "pwa/src/game/settings-video.ts"));

const wall = () => Number(process.hrtime.bigint()) / 1e6;
/** The views' clock: `performance.now()` pinned to the frame being drawn. */
let frameClock = 0;
performance.now = () => frameClock;

function stats(times) {
  const s = [...times].sort((a, b) => a - b);
  const at = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return {
    mean: s.reduce((a, b) => a + b, 0) / s.length,
    p50: at(0.5),
    p95: at(0.95),
    max: s[s.length - 1],
  };
}

/** Every instanced mesh's drawn bytes and every skinned mesh's bones under
 * `group`, hashed. */
function hashInstances(group) {
  const h = createHash("sha1");
  group.traverse((o) => {
    if (o.isSkinnedMesh) {
      // A posed figure is its bones: what the GPU lays every vertex by.
      o.skeleton.update();
      h.update(new Uint8Array(o.skeleton.boneMatrices.buffer));
      return;
    }
    if (!o.isInstancedMesh) return;
    h.update(`${o.name}:${o.visible}:${o.count};`);
    if (!o.visible) return;
    const bytes = (a, per) =>
      new Uint8Array(a.array.buffer, a.array.byteOffset, o.count * per * a.array.BYTES_PER_ELEMENT);
    h.update(bytes(o.instanceMatrix, 16));
    if (o.instanceColor) h.update(bytes(o.instanceColor, 3));
    for (const [name, a] of Object.entries(o.geometry.attributes)) {
      if (a.isInstancedBufferAttribute) h.update(`${name}`).update(bytes(a, a.itemSize));
    }
  });
  return h.digest("hex").slice(0, 12);
}

const rows = [];

function engineRun(name, make) {
  const state = make();
  // A warm-up the JIT settles in, untimed.
  for (let i = 0; i < 240; i++) E.step(state, E.botInput(state));
  const bot = [];
  const step = [];
  for (let i = 0; i < args.steps; i++) {
    const a = wall();
    const input = E.botInput(state);
    const b = wall();
    E.step(state, input);
    step.push(wall() - b);
    bot.push(b - a);
  }
  rows.push({ suite: "engine", name: `${name} step`, unit: "ms/step", ...stats(step) });
  rows.push({ suite: "engine", name: `${name} bot`, unit: "ms/step", ...stats(bot) });
}

/** Ride `state` with the bot and time `update` a frame (two steps a frame). */
function viewRun(name, state, update, group) {
  const times = [];
  for (let f = 0; f < args.frames + 240; f++) {
    frameClock = f * (1000 / 60);
    for (let k = 0; k < 2; k++) E.step(state, E.botInput(state));
    const a = wall();
    update();
    const t = wall() - a;
    if (f >= 240) times.push(t);
  }
  rows.push({ suite: name, name, unit: "ms/frame", ...stats(times), hash: hashInstances(group) });
}

function chaseLens(cam, s) {
  const hx = Math.sin(s.heading);
  const hz = Math.cos(s.heading);
  cam.position.set(s.x - hx * 6, s.y + 2.5, s.z - hz * 6);
  cam.lookAt(s.x + hx * 4, s.y + 0.5, s.z + hz * 4);
  cam.updateMatrixWorld();
}

if (suites.includes("engine")) {
  const bench = () =>
    E.createGame({
      seed: BENCHMARK.seed,
      level: benchmarkLevel(),
      sky: BENCHMARK.sky,
      quiet: true,
    });
  engineRun("benchmark race", bench);
  engineRun("free ride", () => E.createGame({ seed: 7, mode: "free", quiet: true }));
  engineRun("slalom", () => E.createGame({ seed: 38, mode: "slalom", quiet: true }));
  engineRun("downhill", () => E.createGame({ seed: 38, mode: "downhill", quiet: true }));
}

if (suites.includes("pose")) {
  const { createSkisModel, pairStyle, SLOT_DRESS } = await import(
    join(root, "pwa/src/game/skis-body.ts")
  );
  const { createTrack, observe, sample } = await import(join(root, "pwa/src/game/interp.ts"));
  const state = E.createGame({
    seed: BENCHMARK.seed,
    level: benchmarkLevel(),
    sky: BENCHMARK.sky,
    quiet: true,
  });
  const runs = [state, ...state.rivals.map((r) => r.run)];
  const riders = runs.map((run, i) => {
    const model = createSkisModel(
      run.skier.spec,
      pairStyle(run.skier.spec, SLOT_DRESS[i % SLOT_DRESS.length]),
      (m) => m,
    );
    return {
      model,
      track: createTrack(),
      drawn: { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } },
    };
  });
  const group = new THREE.Group();
  for (const r of riders) group.add(r.model.root);
  viewRun(
    "pose",
    state,
    () => {
      for (let i = 0; i < runs.length; i++) {
        const r = riders[i];
        const run = runs[i];
        observe(r.track, run.skier, run.tick);
        sample(r.track, 0.5, r.drawn);
        r.model.setRun(run);
        r.model.pose(run.skier, r.drawn, 0, run.tricks.pose, 1 / 60, run.skier.thrown, false);
        r.model.root.updateMatrixWorld();
      }
    },
    group,
  );
  rows.at(-1).name = `pose (${runs.length} riders)`;
}

if (suites.includes("forest")) {
  const { createForest } = await import(join(root, "pwa/src/game/forest.ts"));
  const level = benchmarkLevel();
  const state = E.createGame({ seed: BENCHMARK.seed, level, sky: BENCHMARK.sky, quiet: true });
  const look = V.FOREST_LOOK[args.forest];
  const casts = V.SHADOW_LOOK[args.shadows].trees;
  const forest = createForest(level, createHazeUniforms(), {
    ...look,
    far: V.DISTANCE_LOOK[args.distance].trees,
    casters: casts ? look.casters : "none",
  });
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 4000);
  const dir = new THREE.Vector3();
  // A late-morning sun, as the benchmark's sky has it.
  const sun = new THREE.Vector3(0.4, 0.5, 0.3).normalize();
  const reach = V.SHADOW_LOOK[args.shadows].reach;
  viewRun(
    "forest",
    state,
    () => {
      chaseLens(cam, state.skier);
      cam.getWorldDirection(dir);
      const box = {
        x: cam.position.x + dir.x * reach * 0.5,
        y: state.skier.y,
        z: cam.position.z + dir.z * reach * 0.5,
        reach,
        sx: sun.x,
        sy: sun.y,
        sz: sun.z,
      };
      forest.update(cam, casts ? box : null);
    },
    forest.group,
  );
  rows.at(-1).name =
    `forest ${args.forest}/${args.distance}/${args.shadows} (${level.trees.length} trees)`;
}

if (suites.includes("terrain")) {
  const { createTerrain } = await import(join(root, "pwa/src/game/terrain.ts"));
  const { createTrailMap } = await import(join(root, "pwa/src/game/trail-map.ts"));
  const level = benchmarkLevel();
  const state = E.createGame({ seed: BENCHMARK.seed, level, sky: BENCHMARK.sky, quiet: true });
  const look = V.terrainLook(args.terrain, V.DISTANCE_LOOK[args.distance].view);
  const trail = createTrailMap(level.size, V.TRAIL_LOOK.high);
  const ground = createTerrain(level, createHazeUniforms(), trail.uniforms, look);
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 4000);
  let drawn = 0;
  let frames = 0;
  viewRun(
    "terrain",
    state,
    () => {
      chaseLens(cam, state.skier);
      ground.follow(cam.position.x, cam.position.z, cam);
      for (const m of ground.group.children) {
        if (m.visible) drawn += Math.min(m.geometry.drawRange.count, m.geometry.index.count) / 3;
      }
      frames += 1;
    },
    ground.group,
  );
  const row = rows.at(-1);
  row.name = `terrain ${args.terrain}/${args.distance}: ${Math.round(drawn / frames)} of ${V.terrainTriangles(look)} tris`;
  delete row.hash;
}

if (suites.includes("lifts") || suites.includes("crowd")) {
  const state = E.createGame({ seed: 7, mode: "free", quiet: true });
  const eye = new THREE.Vector3();
  const at = () => eye.set(state.skier.x, state.skier.y + 2, state.skier.z);
  if (suites.includes("lifts")) {
    const { createLifts } = await import(join(root, "pwa/src/game/lifts.ts"));
    const lifts = createLifts(state.level, createHazeUniforms(), 1);
    viewRun("lifts", state, () => lifts.update(state.t, state.skier.lift, null, at()), lifts.group);
  }
  if (suites.includes("crowd")) {
    const { createCrowdView } = await import(join(root, "pwa/src/game/crowd-view.ts"));
    const crowd = createCrowdView(state.level, createHazeUniforms());
    viewRun("crowd", state, () => crowd.update(state, at()), crowd.group);
  }
}

const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const was = (row) => before?.rows.find((r) => r.name === row.name);
console.log(
  `CPU COST — node ${process.version}, ${args.frames} frames a view, ${args.steps} steps an engine run`,
);
console.log(
  `  ${"what".padEnd(44)} ${"mean".padStart(7)} ${"p50".padStart(7)} ${"p95".padStart(7)} ${"max".padStart(7)}  ${before ? "  was p50  " : ""}hash`,
);
for (const r of rows) {
  const b = was(r);
  const f = (v) => v.toFixed(3).padStart(7);
  const then = b ? `${f(b.p50)} ${(((r.p50 - b.p50) / b.p50) * 100).toFixed(0).padStart(4)}%` : "";
  const same = b?.hash && r.hash ? (b.hash === r.hash ? " (same)" : " (CHANGED)") : "";
  console.log(
    `  ${r.name.padEnd(44)} ${f(r.mean)} ${f(r.p50)} ${f(r.p95)} ${f(r.max)}  ${then.padEnd(before ? 15 : 0)}${r.hash ?? ""}${same}  ${r.unit}`,
  );
}
if (args.json) {
  writeFileSync(args.json, JSON.stringify({ node: process.version, args, rows }, null, 2));
  console.log(`\nwrote ${args.json}`);
}
