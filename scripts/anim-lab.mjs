#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ANIMATION LAB (`make anim`): every animation of the player's rider —
// on skis, on a snowboard and on the downhill bike — driven through the
// game's own code in pure Node and laid out so a bug in it can be SEEN and
// MEASURED. Each scene is ridden by the real engine step by step and the
// real model posed off every step exactly as the renderer poses it (the
// jolt lab's reader, `scripts/lib/jolt-rider.mjs`), and out of it come:
//
//   a SHEET a scene (`previews/anim/<family>-<scene>.png`,
//   `scripts/lib/anim-draw.mjs`): the posed model rasterized in Node
//   (`anim-raster.mjs`) as filmstrips — shaded, its hidden-line wireframe,
//   and its bones coloured by each joint's jolt — from the side, behind and
//   the front three-quarter; the onion skins (every frame's bones laid over
//   the others, the head's, hands' and boots' paths traced by speed); and
//   the charts against its clock: every joint angle, the angles'
//   acceleration, each joint's jolt as a heatmap, each limb's stretch, the
//   tips' speeds and the clips, the phases banded along the top and every
//   snap marked down them.
//
//   a TABLE (here, and `previews/anim/index.html`, a page of every sheet
//   with its row): each scene's frames, the share that SNAP (a joint's
//   jolt past the line), the worst jolt and where, the POPS (a joint flung
//   out of line and back), the ANGLE SNAPS (a joint angle's acceleration
//   past its line), the worst STRETCH of a limb, the CLIPS (a limb through
//   another or the trunk) and the jerk — `anim-measure.mjs` — and the
//   verdict: clean or not.
//
//   node scripts/anim-lab.mjs                          the rider's three families
//   node scripts/anim-lab.mjs --family=bike            one family
//   node scripts/anim-lab.mjs --family=skier --move=carve,jump
//   node scripts/anim-lab.mjs --family=ride            the machines and seats too
//   node scripts/anim-lab.mjs --no-render              the bones and charts alone (fast)
//   node scripts/anim-lab.mjs --json=previews/anim-before.json
//   node scripts/anim-lab.mjs --compare=previews/anim-before.json

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";
import { SNAP_MOST } from "./lib/jolt-measure.mjs";
import { createRiderReader } from "./lib/jolt-rider.mjs";
import { ANGLE_SNAP, STRETCH_MOST, cleanOf, measure, verdictOf } from "./lib/anim-measure.mjs";
import { captureModel } from "./lib/anim-raster.mjs";
import { DEFAULT_FAMILIES, FAMILY_IDS, bikeSticks, familiesOf } from "./lib/anim-families.mjs";
import { INK, drawSheet } from "./lib/anim-draw.mjs";
import { writeReport } from "./lib/anim-report.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    family: {
      kind: "string",
      default: "",
      help: `the families to drive (${FAMILY_IDS.join(", ")}); ${DEFAULT_FAMILIES.join(", ")} when left out`,
    },
    move: {
      kind: "string",
      default: "",
      help: "the scenes to drive, by id; every one when left out",
    },
    frames: { kind: "number", default: 8, help: "frames a filmstrip shows" },
    hz: { kind: "number", default: 60, help: "frames a second the figure is drawn and read at" },
    most: { kind: "number", default: SNAP_MOST, help: "the jolt a frame snaps past, m/s²" },
    "angle-most": {
      kind: "number",
      default: ANGLE_SNAP,
      help: "the angular acceleration an angle snaps past, deg/s²",
    },
    "stretch-most": {
      kind: "number",
      default: STRETCH_MOST,
      help: "the share a limb's length may wander off its middle",
    },
    "no-render": {
      kind: "flag",
      default: false,
      help: "leave the shaded and wire filmstrips out (the bones, onion skins and charts alone; much faster)",
    },
    "no-sheets": { kind: "flag", default: false, help: "the table alone, no pictures" },
    "out-dir": {
      kind: "string",
      default: "previews/anim",
      help: "where the sheets and the page go",
    },
    json: { kind: "string", default: "", help: "write the table as JSON" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/anim-lab.mjs [--family=a,b] [--move=a,b] [--no-render] [--json=file] [--compare=file]",
);

aliasEngine(root);
const ctx = {
  root,
  hz: args.hz,
  world: false,
  THREE: await import("three"),
  E: await import(join(root, "engine/index.ts")),
  S: await import(join(root, "tests/support/synthetic.ts")),
  P: await import(join(root, "pwa/src/game/skier-pose.ts")),
  G: await import(join(root, "pwa/src/game/skis-body.ts")),
  BIKE: await import(join(root, "pwa/src/game/skier-bike.ts")),
  LOOK: await import(join(root, "pwa/src/game/bike-look.ts")),
};

const asked = args.family ? args.family.split(",") : DEFAULT_FAMILIES;
for (const f of asked) {
  if (!FAMILY_IDS.includes(f)) {
    console.error(`unknown family "${f}" (${FAMILY_IDS.join(", ")})`);
    process.exit(2);
  }
}
const wanted = args.move ? new Set(args.move.split(",")) : null;
const families = await familiesOf(ctx, asked);
const outDir = join(root, args["out-dir"]);
mkdirSync(outDir, { recursive: true });

// What each frame hands the lab beyond the jolt reader's joints: the head's
// and the chest's facing (for the head's and the twist's angles) every
// frame, and at the filmstrip's moments the posed model's triangles and the
// bike beside him.
const v3 = new ctx.THREE.Vector3();
const qi = new ctx.THREE.Quaternion();
let film = null;
ctx.onFrame = (model, state, sample, at) => {
  const sk = model.skin();
  sk.group.updateWorldMatrix(true, false);
  qi.set(at.q.x, at.q.y, at.q.z, at.q.w).invert();
  sample.axes = {};
  for (const name of ["head", "chest", "pelvis"]) {
    const f = sk.frames[name];
    if (!f) continue;
    v3.set(f.z.x, f.z.y, f.z.z).transformDirection(sk.group.matrixWorld).applyQuaternion(qi);
    sample.axes[name] = { x: v3.x, y: v3.y, z: v3.z };
  }
  if (!film || film.next >= film.at.length || sample.t < film.at[film.next] - 1e-6) return;
  film.next++;
  film.caps.push({
    t: sample.t,
    k: -1,
    phase: sample.phase,
    joints: sample.joints,
    cap: film.render ? captureModel(ctx.THREE, model, at) : null,
    bike: film.bike ? bikeSticks(ctx, state, at) : null,
  });
};
const ride = createRiderReader(ctx);

const before = args.compare ? JSON.parse(readFileSync(join(root, args.compare), "utf8")) : null;
const pad = (s, n) => String(s).padStart(n);
const pct = (v) => `${Math.round(v * 100)}%`;
const rows = [];
for (const fam of families) {
  const scenes = fam.scenes.filter((s) => !wanted || wanted.has(s.id));
  if (!scenes.length) continue;
  console.log(`\n${fam.id} · ${fam.say}`);
  console.log(
    `${"scene".padEnd(20)}${pad("frames", 7)}${pad("snap", 6)}${pad("worst m/s²", 12)}  ${"joint @ s".padEnd(22)}${pad("pops", 5)}${pad("∠snaps", 7)}${pad("worst °/s²", 11)}  ${"angle".padEnd(13)}${pad("stretch", 8)}  ${"bone".padEnd(11)}${pad("clips", 6)}${pad("jerk", 8)}  verdict`,
  );
  for (const scene of scenes) {
    const t0 = Date.now();
    const [from, to] = scene.window ?? [0.15, scene.seconds];
    const n = args.frames;
    film = {
      at: Array.from({ length: n }, (_, k) => from + ((to - from) * k) / Math.max(1, n - 1)),
      next: 0,
      caps: [],
      render: !args["no-render"] && !args["no-sheets"],
      bike: !!scene.bike,
    };
    const samples = ride(scene);
    // Each capture's index in the samples (the reader counts nothing).
    for (const c of film.caps) c.k = samples.findIndex((s) => s.t === c.t);
    const m = measure(samples, {
      most: args.most,
      angleMost: args["angle-most"],
      stretchMost: args["stretch-most"],
    });
    const v = verdictOf(m);
    const clean = cleanOf(v, m);
    const row = { family: fam.id, id: scene.id, title: scene.title, ...v, clean };
    if (!args["no-sheets"]) {
      const png = drawSheet({
        scene,
        family: fam.id,
        m,
        samples,
        caps: film.caps,
        verdict: v,
        render: film.render,
      });
      const file = join(outDir, `${fam.id}-${scene.id}.png`);
      writeFileSync(file, png);
      row.sheet = relative(outDir, file);
    }
    rows.push(row);
    const was = before?.find((r) => r.family === fam.id && r.id === scene.id);
    const change = was
      ? `  (was snap ${pct(was.snapShare)}, ${was.worstJolt}, pops ${was.pops}, ∠ ${was.angleSnaps}, stretch ${was.stretch}%, clips ${was.clips})`
      : "";
    console.log(
      `${scene.id.padEnd(20)}${pad(v.frames, 7)}${pad(pct(v.snapShare), 6)}${pad(v.worstJolt, 12)}  ${`${v.worstJoint} @${v.worstAt}`.padEnd(22)}${pad(v.pops, 5)}${pad(v.angleSnaps, 7)}${pad(v.worstAngle, 11)}  ${v.worstAngleId.padEnd(13)}${pad(`${v.stretch}%`, 8)}  ${v.stretchBone.padEnd(11)}${pad(v.clips, 6)}${pad(v.jerkRms, 8)}  ${clean ? "clean" : "LOOK"}${change}  ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
  }
}
film = null;

const cleanCount = rows.filter((r) => r.clean).length;
console.log(`\n${cleanCount} of ${rows.length} scenes clean`);

if (args.json) {
  mkdirSync(dirname(join(root, args.json)), { recursive: true });
  writeFileSync(join(root, args.json), JSON.stringify(rows, null, 2));
  console.log(args.json);
}
if (!args["no-sheets"]) {
  writeSummary(rows);
  writeReport(outDir, rows, { most: args.most, angleMost: args["angle-most"] });
  console.log(`${relative(root, join(outDir, "index.html"))}  (every sheet, with its row)`);
}

/** THE SUMMARY: a row a scene, its numbers in colour — the first picture
 * to read. */
function writeSummary(all) {
  const W = 1500;
  const ROW = 14;
  const H = 60 + all.length * ROW + 20 * new Set(all.map((r) => r.family)).size;
  const d = createDrawing(W, H, INK.bg);
  d.text(`animation lab: ${cleanCount} of ${all.length} scenes clean`, 10, 10, INK.text, 2);
  const cols = [
    ["scene", 10],
    ["snap", 220],
    ["worst m/s2", 280],
    ["joint", 370],
    ["pops", 520],
    ["angle snaps", 570],
    ["worst angle", 660],
    ["stretch", 850],
    ["bone", 920],
    ["clips", 1030],
    ["jerk", 1090],
    ["verdict", 1170],
  ];
  let y = 36;
  for (const [s, x] of cols) d.text(s, x, y, INK.dim, 1);
  y += 14;
  let fam = "";
  for (const r of all) {
    if (r.family !== fam) {
      fam = r.family;
      d.text(fam, 10, y + 4, INK.text, 1);
      y += 20;
    }
    const red = (b) => (b ? INK.snap : INK.ok);
    d.text(r.id, 10, y, INK.text, 1);
    d.text(pct(r.snapShare), 220, y, red(r.snapShare > 0), 1);
    d.text(String(r.worstJolt), 280, y, red(r.worstJolt > args.most), 1);
    d.text(`${r.worstJoint} ${r.worstAt}`, 370, y, INK.dim, 1);
    d.text(String(r.pops), 520, y, red(r.pops > 0), 1);
    d.text(String(r.angleSnaps), 570, y, red(r.angleSnaps > 0), 1);
    d.text(`${r.worstAngle} ${r.worstAngleId}`, 660, y, INK.dim, 1);
    d.text(`${r.stretch}%`, 850, y, red(r.stretch > args["stretch-most"] * 100), 1);
    d.text(r.stretchBone, 920, y, INK.dim, 1);
    d.text(String(r.clips), 1030, y, red(r.clips > 0), 1);
    d.text(String(r.jerkRms), 1090, y, INK.dim, 1);
    d.text(r.clean ? "clean" : "look", 1170, y, red(!r.clean), 1);
    y += ROW;
  }
  writeFileSync(join(outDir, "summary.png"), d.toPng());
}
