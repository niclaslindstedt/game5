#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUNCTIONS LAB (`make junctions`): where the groomed snow of a ski area
// BREAKS — a lip, a step or a wall a skier meets at speed where nothing was
// built to be jumped. Every metre-pair of packed snow is read down its own
// fall line: the pitch over the next 3 m against the pitch over the 3 m
// before, and a sudden steepening past `--threshold` (a quarter: from 10 %
// to 35 % in a stride) is a STEP. The kickers and drops laid on purpose
// (R9, R24, R20) and the stations' pads and their rims (R26) are left out;
// what is left is clustered and named by where it stands — a LANE leaving
// the piste it branches off, a run (or a lane) MERGING into another, on a
// lane, or on a piste anywhere else.
//
// It exists because the runs met badly where nobody looked: a lane graded
// under the surface of the piste it left (which the stamp never touches)
// stood a lip where that piste's core ended, and a wide black merging into a
// narrower red levelled its whole width to its last station, a terrace that
// the red fell away under in a wall. Pure Node over the engine: no build,
// no browser — a few seconds a seed.
//
// The table is a seed a row: the steps on the runs by kind, the worst (its
// pitch before and after, where), and the lanes the area laid. `--versions`
// builds the same seeds by older generators beside the current one
// (`versions.ts` — a version a campaign map still names can be asked for),
// so a grading change is read before and after in one run. `--sheet` draws
// the worst steps of the first version as relief, each beside the same
// patch under every other version (previews/junctions.png).
//
//   node scripts/junctions-lab.mjs --seed=3 --region=continental --list
//   node scripts/junctions-lab.mjs --count=10 --versions=6,8 --sheet
//   node scripts/junctions-lab.mjs --count=10 --json=previews/junctions-before.json
//   node scripts/junctions-lab.mjs --count=10 --compare=previews/junctions-before.json

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const E = await import(join(root, "engine/index.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", help: "read this one seed" },
    from: { kind: "number", default: 1, help: "first seed of a sweep" },
    count: { kind: "number", default: 6, help: "how many seeds the sweep reads" },
    region: {
      kind: "string",
      default: "alpine",
      help: "the kind of snow country (R21): alpine, fell, continental, maritime",
    },
    versions: {
      kind: "string",
      help: "generator versions to build, comma-separated (the current one when left out)",
    },
    threshold: {
      kind: "number",
      default: 0.25,
      help: "the steepening over a 3 m stride, m per m, that is a step",
    },
    list: { kind: "flag", help: "list every step found, where it stands and on what" },
    sheet: { kind: "flag", help: "draw the worst steps as relief (previews/junctions.png)" },
    patches: { kind: "number", default: 6, help: "how many steps the sheet draws" },
    out: { kind: "string", default: "previews/junctions.png", help: "the sheet's file" },
    json: { kind: "string", help: "write the table as JSON here (a before for --compare)" },
    compare: { kind: "string", help: "a --json written before: print the change beside it" },
  },
  "usage: npm run junctions -- [--seed n | --count k --from n] [--region id] [--versions 6,8] [--threshold m] [--list] [--sheet] [--json f | --compare f]",
);

/** The stride a pitch is read over, m; the grid read, m; how near two steps
 * are one, m. */
const STRIDE = 3;
const GRID = 2;
const CLUSTER = 25;
/** How far from a station a step is the pad's rim, m (a top's, a bottom's). */
const TOP_CLEAR = 70;
const BOTTOM_CLEAR = 50;
/** How far down a run from a junction a step is that junction's, m. */
const NEAR_JUNCTION = 60;

const current = E.CURRENT_GENERATOR_VERSION;
const versions = args.versions
  ? String(args.versions)
      .split(",")
      .map((v) => Number(v))
  : [current];
const seeds =
  args.seed !== undefined
    ? [args.seed]
    : Array.from({ length: args.count }, (_, i) => args.from + i);

/** Where a point stands on the runs: each run within its width (and a few
 * metres), and the arc on it. */
function runsAt(level, x, z) {
  const out = [];
  for (const r of level.resort.runs) {
    let best = Infinity;
    let at = null;
    for (let i = 0; i < r.points.length; i += 2) {
      const p = r.points[i];
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < best) {
        best = d;
        at = p;
      }
    }
    if (at && best < at.width / 2 + 4) out.push({ run: r, s: at.s });
  }
  return out;
}

/** What a step on these runs is: a lane leaving its piste, a junction, on
 * a lane, or on a piste. */
function kindOf(level, on) {
  const runs = level.resort.runs;
  let kind = "piste";
  for (const { run, s } of on) {
    if (run.kind === "road" && run.branch && s < NEAR_JUNCTION) return "branch";
    if (
      runs.some(
        (o) =>
          o.branch?.run === run.id && o.kind === "road" && Math.abs(o.branch.s - s) < NEAR_JUNCTION,
      )
    )
      return "branch";
  }
  for (const { run, s } of on) {
    if (run.into && s > run.into.from - 30) return "merge";
    if (runs.some((o) => o.into?.run === run.id && Math.abs(o.into.s - s) < NEAR_JUNCTION))
      return "merge";
  }
  if (on.some(({ run }) => run.kind === "road")) kind = "lane";
  return kind;
}

/** Every step on a level's groomed snow, clustered, on its runs. */
function stepsOf(level) {
  const K = level.kickers ?? [];
  const C = level.cliffs ?? [];
  const L = level.resort?.lifts ?? [];
  const meant = (x, z) =>
    K.some((k) => Math.hypot(k.x - x, k.z - z) < k.ramp + k.landing + 8) ||
    C.some((c) => Math.hypot(c.x - x, c.z - z) < c.width + c.face + c.landing + 10) ||
    L.some(
      (l) =>
        Math.hypot(l.top.x - x, l.top.z - z) < TOP_CLEAR ||
        Math.hypot(l.bottom.x - x, l.bottom.z - z) < BOTTOM_CLEAR,
    );
  const n = { x: 0, y: 0, z: 0 };
  const hits = [];
  for (let z = 0; z < level.size; z += GRID) {
    for (let x = 0; x < level.size; x += GRID) {
      if (level.packedAt(x, z) < 0.8) continue;
      const brk = breakAt(level, x, z, n);
      if (brk && brk.brk > args.threshold && !meant(x, z)) hits.push({ x, z, ...brk });
    }
  }
  const clusters = [];
  for (const h of hits) {
    const c = clusters.find((q) => Math.hypot(q.x - h.x, q.z - h.z) < CLUSTER);
    if (!c) clusters.push({ x: h.x, z: h.z, cells: 1, worst: h });
    else {
      c.cells++;
      if (h.brk > c.worst.brk) c.worst = h;
    }
  }
  const steps = [];
  for (const c of clusters) {
    const on = runsAt(level, c.worst.x, c.worst.z);
    if (on.length === 0) continue;
    steps.push({
      ...c.worst,
      cells: c.cells,
      kind: kindOf(level, on),
      on: on.map(({ run, s }) => `${run.kind === "road" ? "lane " : ""}${run.id}@${Math.round(s)}`),
    });
  }
  return steps.sort((a, b) => b.brk - a.brk);
}

/** The pitch over the stride before and after (x, z) down its fall line,
 * and the steepening between — null on the flat. */
function breakAt(level, x, z, n) {
  level.normalAt(x, z, n);
  const across = Math.hypot(n.x, n.z);
  if (across < 0.02) return null;
  const fx = n.x / across;
  const fz = n.z / across;
  const h0 = level.groundAt(x - fx * STRIDE, z - fz * STRIDE);
  const h1 = level.groundAt(x, z);
  const h2 = level.groundAt(x + fx * STRIDE, z + fz * STRIDE);
  const before = (h0 - h1) / STRIDE;
  const after = (h1 - h2) / STRIDE;
  return { before, after, brk: after - before };
}

const KINDS = ["branch", "merge", "lane", "piste"];
const rows = [];
const levels = new Map();
for (const seed of seeds) {
  for (const version of versions) {
    const level = E.generateLevel(seed, { region: args.region, version });
    levels.set(`${seed}/${version}`, level);
    const steps = stepsOf(level);
    const by = Object.fromEntries(KINDS.map((k) => [k, steps.filter((s) => s.kind === k).length]));
    rows.push({
      seed,
      version,
      lanes: level.resort.runs.filter((r) => r.kind === "road").length,
      steps: steps.length,
      ...by,
      worst: steps[0] ?? null,
      all: steps,
    });
  }
}

const pct = (v) => `${Math.round(v * 100)}%`;
console.log(
  `junctions — ${args.region}, threshold ${pct(args.threshold)} over ${STRIDE} m, versions ${versions.join(",")}`,
);
console.log("seed  ver  lanes  steps  branch  merge  lane  piste   worst");
for (const r of rows) {
  const w = r.worst
    ? `${pct(r.worst.before)}→${pct(r.worst.after)} at X ${r.worst.x} · Z ${r.worst.z} (${r.worst.kind})`
    : "—";
  console.log(
    `${String(r.seed).padStart(4)}  ${String(r.version).padStart(3)}  ${String(r.lanes).padStart(5)}  ${String(r.steps).padStart(5)}  ${KINDS.map((k) => String(r[k]).padStart(k.length)).join("  ")}   ${w}`,
  );
  if (args.list) {
    for (const s of r.all) {
      console.log(
        `            X ${s.x} · Z ${s.z}  ${pct(s.before)}→${pct(s.after)}  ${s.kind.padEnd(6)} ${s.cells} cells  on ${s.on.join(", ")}`,
      );
    }
  }
}
const totals = (v) => {
  const of = rows.filter((r) => r.version === v);
  return Object.fromEntries(
    ["lanes", "steps", ...KINDS].map((k) => [k, of.reduce((sum, r) => sum + r[k], 0)]),
  );
};
for (const v of versions) {
  const t = totals(v);
  console.log(
    `  v${v}: ${t.steps} steps (branch ${t.branch}, merge ${t.merge}, lane ${t.lane}, piste ${t.piste}) over ${seeds.length} seeds, ${t.lanes} lanes`,
  );
}

const table = Object.fromEntries(versions.map((v) => [v, totals(v)]));
if (args.json) {
  mkdirSync(dirname(join(root, args.json)), { recursive: true });
  writeFileSync(
    join(root, args.json),
    JSON.stringify({ region: args.region, seeds, table }, null, 2),
  );
  console.log(`wrote ${args.json}`);
}
if (args.compare) {
  const before = JSON.parse(readFileSync(join(root, args.compare), "utf8"));
  const was = Object.values(before.table)[0];
  for (const v of versions) {
    const now = table[v];
    console.log(
      `  v${v} against ${args.compare}: ` +
        ["steps", ...KINDS, "lanes"].map((k) => `${k} ${was[k]} → ${now[k]}`).join(", "),
    );
  }
}

if (args.sheet) {
  const first = versions[0];
  const worst = rows
    .filter((r) => r.version === first)
    .flatMap((r) => r.all.map((s) => ({ ...s, seed: r.seed })))
    .sort((a, b) => b.brk - a.brk)
    .filter((s, i, all) =>
      all.slice(0, i).every((o) => o.seed !== s.seed || Math.hypot(o.x - s.x, o.z - s.z) > 20),
    )
    .slice(0, args.patches);
  const SPAN = 64;
  const PX = 4;
  const size = SPAN * PX;
  const pad = 8;
  const head = 28;
  const d = createDrawing(
    pad + versions.length * (size + pad),
    pad + worst.length * (size + head + pad),
    [24, 28, 34],
  );
  const n = { x: 0, y: 0, z: 0 };
  const LIGHT = [-0.45, 0.75, -0.48];
  worst.forEach((s, row) => {
    versions.forEach((v, col) => {
      const level = levels.get(`${s.seed}/${v}`);
      const ox = pad + col * (size + pad);
      const oy = pad + row * (size + head + pad);
      d.text(`SEED ${s.seed} V${v} X ${s.x} Z ${s.z}`, ox, oy + 2, [230, 230, 230], 1);
      d.text(
        `${s.kind.toUpperCase()} ${s.on.join(" ")}`.slice(0, 40),
        ox,
        oy + 14,
        [170, 180, 190],
        1,
      );
      for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
          const x = s.x - SPAN / 2 + px / PX;
          const z = s.z - SPAN / 2 + py / PX;
          level.normalAt(x, z, n);
          // Lit from up the map and to one side, low, so a step throws a
          // line across the snow.
          const lit = Math.max(0, n.x * LIGHT[0] + n.y * LIGHT[1] + n.z * LIGHT[2]);
          const packed = level.packedAt(x, z) > 0.8;
          const base = packed ? [200, 222, 250] : [236, 236, 236];
          let c = base.map((b) => Math.min(255, b * (0.35 + 0.75 * lit)));
          const brk = packed ? breakAt(level, x, z, n) : null;
          if (brk && brk.brk > args.threshold) c = [230, 60, 50];
          d.set(ox + px, oy + head + py, c);
        }
      }
      d.circle(ox + size / 2, oy + head + size / 2, 6, [255, 200, 0], 2);
    });
  });
  mkdirSync(dirname(join(root, args.out)), { recursive: true });
  writeFileSync(join(root, args.out), d.toPng());
  console.log(`wrote ${args.out}`);
}
