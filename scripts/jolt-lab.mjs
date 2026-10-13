#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JOLT LAB (`make jolt`): does anything the game ANIMATES snap? Every
// animated figure is driven through the game's own code in Node — the
// player on skis and on a board through every move of the skier and board
// labs and every ride (a lift, the boards of a snowmobile, a helicopter's
// skid, a balloon's basket, a skydive, a wingsuit, a ski jump, the town,
// the afterski), the crowd, the people on foot and their dogs, the
// grimbear and the wildlife — and each joint's JOLT measured frame by
// frame (`scripts/lib/jolt-measure.mjs`): its second difference read as an
// acceleration, m/s². A body moving as a body does stays under a hundred;
// a pose switched rather than blended, a limb flipping, a hand-off from
// one way of drawing to another, reads as thousands. Over the line (150 by
// default) a frame is a SNAP.
//
// The table is a family at a time, a scene a row: its frames, the share of
// them that snap, the worst jolt, the joint, when, and the phase he was
// drawn in. The graph beside it (`previews/jolt.png`) is each scene's worst
// joint frame by frame on a log scale, the line drawn across it.
//
//   node scripts/jolt-lab.mjs                          every family
//   node scripts/jolt-lab.mjs --family=skier,board     those families
//   node scripts/jolt-lab.mjs --family=skier --move=jump,wipeout
//   node scripts/jolt-lab.mjs --events                 each scene's snaps, worst first
//   node scripts/jolt-lab.mjs --json=previews/jolt-before.json
//   node scripts/jolt-lab.mjs --compare=previews/jolt-before.json

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";
import { SNAP_MOST, joltVerdict } from "./lib/jolt-measure.mjs";
import { FAMILY_IDS, familiesOf } from "./lib/jolt-families.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    family: {
      kind: "string",
      default: "",
      help: `the families to drive (${FAMILY_IDS.join(", ")}); every one when left out`,
    },
    move: {
      kind: "string",
      default: "",
      help: "the scenes to drive, by id; every one when left out",
    },
    hz: { kind: "number", default: 60, help: "frames a second the figure is drawn at" },
    world: {
      kind: "flag",
      default: false,
      help: "read the player's figure in the world rather than his body frame (the physics' own accelerations in it)",
    },
    most: { kind: "number", default: SNAP_MOST, help: "the jolt a frame snaps past, m/s²" },
    events: { kind: "flag", default: false, help: "list each scene's snaps, worst first" },
    top: { kind: "number", default: 5, help: "how many snaps --events lists a scene" },
    trace: {
      kind: "string",
      default: "",
      help: "a window of seconds (from,to) to print every frame of each scene in: its worst joint, the jolt and where that joint is",
    },
    joint: {
      kind: "string",
      default: "",
      help: "the joint --trace follows (each frame's worst when left out)",
    },
    out: { kind: "string", default: "previews/jolt.png", help: "the graph's PNG" },
    json: { kind: "string", default: "", help: "write the table as JSON" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/jolt-lab.mjs [--family=a,b] [--move=a,b] [--most=m/s²] [--events] [--json=file] [--compare=file]",
);

aliasEngine(root);
const ctx = {
  root,
  hz: args.hz,
  world: args.world,
  THREE: await import("three"),
  E: await import(join(root, "engine/index.ts")),
  S: await import(join(root, "tests/support/synthetic.ts")),
  P: await import(join(root, "pwa/src/game/skier-pose.ts")),
  G: await import(join(root, "pwa/src/game/skis-body.ts")),
};

const asked = args.family ? args.family.split(",") : FAMILY_IDS;
for (const f of asked) {
  if (!FAMILY_IDS.includes(f)) {
    console.error(`unknown family "${f}" (${FAMILY_IDS.join(", ")})`);
    process.exit(2);
  }
}
const wanted = args.move ? new Set(args.move.split(",")) : null;
const families = await familiesOf(ctx, asked);

const before = args.compare ? JSON.parse(readFileSync(join(root, args.compare), "utf8")) : null;
const pad = (s, n) => String(s).padStart(n);
const pct = (v) => `${Math.round(v * 100)}%`;
const rows = [];
for (const fam of families) {
  const scenes = fam.scenes.filter((s) => !wanted || wanted.has(s.id));
  if (scenes.length === 0) continue;
  console.log(
    `\n${fam.id} · ${fam.say}${ctx.world && !fam.say.includes("(in the world)") ? " (in the world)" : ""}`,
  );
  console.log(
    `${"scene".padEnd(18)}${pad("frames", 7)}${pad("snap", 11)}${pad("worst m/s²", 16)}  joint @ s · phase${"".padEnd(14)}${pad("pops", 6)}${pad("worst pop", 12)}  joint @ s`,
  );
  for (const scene of scenes) {
    const samples = fam.ride(scene);
    const v = joltVerdict(samples, args.most);
    const row = {
      family: fam.id,
      id: scene.id,
      title: scene.title,
      frames: v.frames,
      share: v.share,
      worst: v.worst,
      pops: v.pops,
      worstPop: v.worstPop,
      events: v.events.slice(0, args.top),
      jolts: v.jolts,
    };
    rows.push(row);
    const was = before?.find((b) => b.family === fam.id && b.id === scene.id);
    const share =
      was && pct(was.share) !== pct(v.share) ? `${pct(was.share)}>${pct(v.share)}` : pct(v.share);
    const now = Math.round(v.worst.a);
    const worst =
      was && Math.round(was.worst.a) !== now ? `${Math.round(was.worst.a)}>${now}` : `${now}`;
    const w = v.worst;
    const where = `${w.joint} @${w.t.toFixed(2)} · ${w.phase}`;
    const p = v.worstPop;
    const popWas = was?.worstPop ? Math.round(was.worstPop.a) : null;
    const popNow = Math.round(p.a);
    const popCell = popWas !== null && popWas !== popNow ? `${popWas}>${popNow}` : `${popNow}`;
    const popWhere = p.a > 0 ? `${p.joint} @${p.t.toFixed(2)} · ${p.phase}` : "";
    console.log(
      `${scene.id.padEnd(18)}${pad(v.frames, 7)}${pad(share, 11)}${pad(worst, 16)}  ${where.padEnd(31)}${pad(v.pops, 6)}${pad(popCell, 12)}  ${popWhere}`,
    );
    if (args.trace) {
      const [from, to] = args.trace.split(",").map(Number);
      for (const f of v.jolts) {
        if (f.t < from || f.t > to) continue;
        const j = args.joint || f.joint;
        const k = samples.findIndex((x) => x.t === f.t);
        const p = samples[k]?.joints[j];
        const a = args.joint
          ? (() => {
              const [u, w] = [samples[k - 1]?.joints[j], samples[k + 1]?.joints[j]];
              if (!u || !p || !w) return 0;
              const h = (samples[k + 1].t - samples[k - 1].t) / 2;
              return (
                Math.hypot(u.x - 2 * p.x + w.x, u.y - 2 * p.y + w.y, u.z - 2 * p.z + w.z) / (h * h)
              );
            })()
          : f.a;
        const at = p ? `(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})` : "";
        console.log(
          `${"".padEnd(20)}${f.t.toFixed(3)} ${pad(Math.round(a), 7)} ${j.padEnd(12)} ${at} · ${f.phase}`,
        );
      }
    }
    if (args.events) {
      for (const e of v.events.slice(0, args.top)) {
        console.log(
          `${"".padEnd(20)}${pad(Math.round(e.a), 7)} ${e.joint} @${e.t.toFixed(3)} (${e.start.toFixed(2)}–${e.end.toFixed(2)} s, ${e.frames} f) · ${e.phase}`,
        );
      }
    }
  }
}
if (rows.length === 0) {
  console.error("no scene matched");
  process.exit(2);
}
const snapping = rows.filter((r) => r.worst.a > args.most).length;
const popping = rows.filter((r) => r.pops > 0).length;
console.log(
  `\n${snapping} of ${rows.length} scenes snap past ${args.most} m/s²; ${popping} pop (a joint flung out of line and back)`,
);

if (args.json) {
  mkdirSync(dirname(join(root, args.json)), { recursive: true });
  writeFileSync(
    join(root, args.json),
    JSON.stringify(
      rows.map((r) => ({ ...r, jolts: undefined })),
      null,
      1,
    ),
  );
}

// THE GRAPH: a scene a row, its worst joint frame by frame on a log scale
// from 1 to 10⁵ m/s², the line across it; red past the line.
const INK = {
  bg: [14, 18, 24],
  frame: [52, 60, 74],
  text: [220, 226, 236],
  dim: [130, 140, 156],
  grid: [34, 40, 52],
  line: [236, 90, 80],
  ok: [110, 200, 140],
  bad: [244, 110, 90],
};
const LEFT = 200;
const CW = 820;
const CH = 44;
const ROW = CH + 14;
const W = LEFT + CW + 20;
let y = 46;
const blocks = [];
for (const r of rows) {
  if (!blocks.length || blocks.at(-1).family !== r.family) {
    blocks.push({ family: r.family, rows: [] });
  }
  blocks.at(-1).rows.push(r);
}
const H = 46 + blocks.reduce((a, b) => a + 24 + b.rows.length * ROW, 0);
const d = createDrawing(W, H, INK.bg);
d.text(
  "jolt: each scene's worst joint, frame by frame (log, 1 to 100000 m/s²)",
  10,
  10,
  INK.text,
  2,
);
d.text(`red: past ${args.most} m/s²  x: the scene's time`, 10, 30, INK.dim);
const LOG_TOP = 5;
for (const b of blocks) {
  d.text(b.family, 10, y + 4, INK.text, 2);
  y += 24;
  for (const r of b.rows) {
    const top = y;
    const span = Math.max(1e-6, r.jolts.at(-1)?.t ?? 1);
    const px = (t) => LEFT + (t / span) * CW;
    const py = (a) =>
      top + CH - (Math.max(0, Math.min(LOG_TOP, Math.log10(Math.max(1, a)))) / LOG_TOP) * CH;
    d.text(r.id, 10, top + 6, INK.text);
    d.text(
      `${Math.round(r.worst.a)} ${r.worst.joint}`,
      10,
      top + 22,
      r.worst.a > args.most ? INK.bad : INK.dim,
    );
    for (let g = 1; g < LOG_TOP; g++) d.line(LEFT, py(10 ** g), LEFT + CW, py(10 ** g), INK.grid);
    for (const f of r.jolts) {
      const x = px(f.t);
      d.line(x, py(1), x, py(f.a), f.a > args.most ? INK.bad : INK.ok);
    }
    d.line(LEFT, py(args.most), LEFT + CW, py(args.most), INK.line);
    d.rect(LEFT, top, CW, CH, INK.frame);
    y += ROW;
  }
}
mkdirSync(dirname(join(root, args.out)), { recursive: true });
writeFileSync(join(root, args.out), d.toPng());
console.log(`\n${args.out}`);
