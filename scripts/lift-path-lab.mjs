#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFT PATH LAB (`make lift-path`): WHERE DOES A RIDER GO through a
// gondola's stations, and does anything of him pass through a wall while
// the picture shows him? A gondola is the one lift a rider goes INTO: in
// at its foot station's door, out onto the platform, into his cabin, and
// out of the top station's door onto the pad — and every one of those is a
// place his body or the skis on his feet can run through a station house's
// wall or his cabin's.
//
// Each approach is ridden on the REAL ENGINE in Node at 120 Hz with neutral
// hands (`pwa/src/tools/lift-stage.ts`: rolled into the boarding ring up
// the queue's lane, from the corral's wrong side and across it; and a ride
// begun in a cabin carried to the top), and every frame is traced in PLAN,
// in the lift line's frame (up the line is up the picture):
//
//   the station houses (`stationHouses`), the furniture the view lays
//   (`layStations`: the booth, the canopy, the corral's ropes), the rail
//   his cabin comes round on (`railAt`), the platform he waits on
//   (`platformOf`), the crowd's way in at the door
//
//   his path, coloured by the lift's phase (skating to the door, on the
//   platform, carried), drawn faint where the picture is faded black
//   (`liftFade`) — and his skis every quarter second: on his feet the
//   pair along his heading; shouldered or laid on the snow the two skis
//   themselves (`town.ts`'s `LoneSki`s); racked, none
//
//   every cabin box while it carries him in the station
//
//   a red cross where something of him SHOWS through a wall
//
// Per approach, the table:
//
//   house   seconds a visible point of him (the body or a ski's end) is
//           inside a station house, and how deep, m
//   wall    seconds his body (a disc of a trunk's girth) passes through
//           his cabin's walls rather than its door, and how deep, m
//   skis    seconds a ski he has with him passes through his cabin — into
//           it from its rack or on his feet — and how deep, m
//   dark    seconds the picture is faded black
//   door    how far short of the house's back wall the fade is complete, m
//           (negative: he is through the wall before the picture is black)
//
//   node scripts/lift-path-lab.mjs                 seed 38, every approach
//   node scripts/lift-path-lab.mjs --seed=4 --region=maritime
//   node scripts/lift-path-lab.mjs --list           every frame through a wall
//   node scripts/lift-path-lab.mjs --json=previews/lift-path-before.json
//   node scripts/lift-path-lab.mjs --compare=previews/lift-path-before.json

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed" },
    region: { kind: "string", default: "", help: "the kind of snow country (R21)" },
    list: { kind: "flag", help: "name every frame something of him shows through a wall" },
    out: { kind: "string", default: "previews/lift-path.png", help: "the picture" },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/lift-path-lab.mjs [--seed=n] [--region=id] [--list] [--json=file] [--compare=file]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const CAM = await import(join(root, "pwa/src/game/camera-lift.ts"));
const SP = await import(join(root, "pwa/src/game/station-plan.ts"));
const STAGE = await import(join(root, "pwa/src/tools/lift-stage.ts"));

const region = args.region || undefined;
const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—");

/** A cabin's half-width across the line and half-length along it, m —
 * `lift-carriers.ts`'s `CABIN_HALF`. */
const CABIN = { w: E.CABIN_HALF, l: 1.08 };
/** `u` m up a lift's line from its bottom wheel and `side` m to its right. */
function along(plan, u, side) {
  return {
    x: plan.lift.bottom.x + plan.dx * u + plan.dz * side,
    z: plan.lift.bottom.z + plan.dz * u - plan.dx * side,
  };
}
/** The fade past which the picture counts as black. */
const BLACK = 0.95;

const RIDES = [
  { id: "foot-lane", top: false, approach: "lane" },
  { id: "foot-wrong", top: false, approach: "wrong" },
  { id: "foot-side", top: false, approach: "side" },
  { id: "top", top: true },
];

function togoOf(state, lift) {
  const plan = lift && E.liftPlans(state.level)[lift.index];
  return plan ? plan.length - plan.look.off - lift.u : Infinity;
}

/** The ends of the skis he has with him, world x z pairs: on his feet the
 * pair along his heading, his own (`LoneSki`s) shouldered or laid down,
 * none racked. */
function skiEnds(state) {
  const c = state.skier;
  if (c.thrown) return [];
  const loose = c.town?.skis ?? c.fetch?.skis;
  if (loose)
    return loose.flatMap((s) => [
      [s.ends[0], s.ends[2]],
      [s.ends[3], s.ends[5]],
    ]);
  // In a gondola's cabin his skis are in its rack — the pair itself where
  // it is placed there, or out of sight.
  if (c.lift?.kind === "gondola" && c.lift.phase === "ride") {
    const r = c.lift.skis;
    return r
      ? r.flatMap((s) => [
          [s.ends[0], s.ends[2]],
          [s.ends[3], s.ends[5]],
        ])
      : [];
  }
  const half = (c.spec.length ?? 1.8) / 2;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  return [-0.12, 0.12].flatMap((o) => {
    const ox = c.x + fz * o;
    const oz = c.z - fx * o;
    return [
      [ox + fx * half, oz + fz * half],
      [ox - fx * half, oz - fz * half],
    ];
  });
}

/** Where a cabin carrying him stands, and the way it faces: on the
 * station's rail while it comes round to him, on the line once it has him. */
function cabinOf(plan, lift) {
  if (!lift || lift.kind !== "gondola") return null;
  if (lift.phase === "wait") return E.railAt(plan, lift.u);
  if (lift.phase === "ride") {
    // Swung on its hanger: its body, where he sits, out along the line
    // (`lift-ride.ts`'s `hold`).
    const swung = E.TUNING.lift.cabin * Math.sin(lift.swing);
    return { ...along(plan, lift.u + swung, E.upRope(plan)), heading: plan.heading };
  }
  return null;
}

/** How deep (x, z) is inside a box at `at` facing `heading`, half `hw`
 * across and `hl` along, m — 0 outside it. */
function inside(x, z, at, heading, hw, hl) {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const dx = x - at.x;
  const dz = z - at.z;
  const u = dx * fx + dz * fz;
  const v = dx * fz - dz * fx;
  return Math.max(0, Math.min(hl - Math.abs(u), hw - Math.abs(v)));
}

/** How deep a body at (x, z) — a disc of `BODY` m — is in his cabin's
 * walls, m, anywhere but the door in the middle of its right flank
 * (`own-cabin.ts`'s `DOOR`): what of him passes through a wall. */
const BODY = 0.22;
const DOOR_HALF = 0.5;
function throughWall(x, z, cab) {
  const fx = Math.sin(cab.heading);
  const fz = Math.cos(cab.heading);
  const dx = x - cab.x;
  const dz = z - cab.z;
  const u = dx * fx + dz * fz;
  const v = dx * fz - dz * fx;
  let deep = 0;
  // The flanks, the right one's door left open.
  if (Math.abs(u) < CABIN.l + BODY) {
    const off = Math.abs(Math.abs(v) - CABIN.w);
    const door = v > 0 && Math.abs(u) < DOOR_HALF - BODY;
    if (off < BODY && !door) deep = Math.max(deep, BODY - off);
  }
  // The ends.
  if (Math.abs(v) < CABIN.w + BODY) {
    const off = Math.abs(Math.abs(u) - CABIN.l);
    if (off < BODY) deep = Math.max(deep, BODY - off);
  }
  return deep;
}

/** One approach ridden: every other step as a frame. */
function ride(r) {
  const state = r.top
    ? STAGE.onLift(args.seed, region, "gondola", 0)
    : STAGE.atFoot(args.seed, region, "gondola", r.approach, 0);
  if (!state) return null;
  const plans = E.liftPlans(state.level);
  const plan = plans.find((p) => p.lift.kind === "gondola");
  const houses = E.stationHouses(state.level, plan);
  const c = state.skier;
  const frames = [];
  let had = false;
  let after = Infinity;
  for (let i = 0; state.t < 120 && after > 0; i++) {
    E.step(state, E.NEUTRAL_INPUT);
    if (c.lift) had = true;
    // On past the lift's letting go until he is on his skis and away.
    if (had && !c.lift && !c.town) after = Math.min(after, 2);
    // ...and off the foot, once carried out of the station and up the line.
    if (!r.top && c.lift?.phase === "ride" && c.lift.u > 40) after = 0;
    if (after < Infinity) after -= E.TUNING.dt;
    if (i % 2) continue;
    const lift = c.lift;
    const fade = CAM.liftFade(lift ?? null, togoOf(state, lift));
    const ends = skiEnds(state);
    const cab = cabinOf(plan, lift);
    let house = 0;
    if (fade < BLACK) {
      for (const h of houses) {
        for (const p of [[c.x, c.z], ...ends]) {
          house = Math.max(house, inside(p[0], p[1], h, plan.heading, h.halfWidth, h.halfLength));
        }
      }
    }
    let wall = 0;
    let skis = 0;
    if (cab && fade < BLACK) {
      wall = throughWall(c.x, c.z, cab);
      for (let s = 0; s + 1 < ends.length; s += 2) {
        for (let j = 1; j < 8; j++) {
          const x = ends[s][0] + ((ends[s + 1][0] - ends[s][0]) * j) / 8;
          const z = ends[s][1] + ((ends[s + 1][1] - ends[s][1]) * j) / 8;
          skis = Math.max(skis, inside(x, z, cab, cab.heading, CABIN.w - 0.05, CABIN.l - 0.05));
        }
      }
    }
    frames.push({
      t: state.t,
      x: c.x,
      z: c.z,
      heading: c.heading,
      phase: lift?.phase ?? (c.town ? `town-${c.town.phase}` : "ski"),
      fade,
      ends,
      cab,
      house,
      wall,
      skis,
    });
  }
  return { r, plan, houses, frames, level: state.level, plans };
}

/** The table's row off a ridden approach. */
function measure(run) {
  if (args.list) {
    for (const q of run.frames) {
      if (q.house <= 0.02 && q.wall <= 0.02 && q.skis <= 0.02) continue;
      const what = `house ${fmt(q.house)} wall ${fmt(q.wall)} skis ${fmt(q.skis)}`;
      console.log(`  ${run.r.id} ${q.t.toFixed(2)} s ${q.phase} fade ${fmt(q.fade)} ${what}`);
    }
  }
  const step = 2 * E.TUNING.dt;
  const f = run.frames;
  const row = {
    house: 0,
    houseDeep: 0,
    wall: 0,
    wallDeep: 0,
    skis: 0,
    skisDeep: 0,
    dark: 0,
    door: NaN,
  };
  for (const q of f) {
    if (q.house > 0.02) row.house += step;
    row.houseDeep = Math.max(row.houseDeep, q.house);
    if (q.wall > 0.02) row.wall += step;
    row.wallDeep = Math.max(row.wallDeep, q.wall);
    if (q.skis > 0.02) row.skis += step;
    row.skisDeep = Math.max(row.skisDeep, q.skis);
    if (q.fade >= BLACK) row.dark += step;
  }
  // The back wall of the house the door is in, in the line's frame.
  const back = run.r.top ? null : run.houses[0];
  if (back) {
    const wall = (q) => {
      const dx = q.x - back.x;
      const dz = q.z - back.z;
      return -(dx * run.plan.dx + dz * run.plan.dz) - back.halfLength;
    };
    const black = f.find((q) => q.fade >= BLACK);
    if (black) row.door = wall(black);
  }
  return row;
}

const runs = RIDES.map(ride).filter(Boolean);
const rows = runs.map((run) => ({ id: run.r.id, ...measure(run) }));

// THE TABLE.
const before = args.compare ? JSON.parse(readFileSync(join(root, args.compare), "utf8")) : null;
console.log(`lift path — seed ${args.seed}${region ? ` ${region}` : ""}, the gondola`);
console.log("approach      house s  deep m   wall s   deep m   skis s   deep m   dark s   door m");
for (const row of rows) {
  const was = before?.find((b) => b.id === row.id);
  const cell = (k, d = 2) => {
    const now = fmt(row[k], d);
    return was ? `${now}${was[k] !== row[k] ? `(${fmt(was[k], d)})` : ""}` : now;
  };
  console.log(
    [
      row.id.padEnd(13),
      cell("house").padEnd(8),
      cell("houseDeep").padEnd(8),
      cell("wall").padEnd(8),
      cell("wallDeep").padEnd(8),
      cell("skis").padEnd(8),
      cell("skisDeep").padEnd(8),
      cell("dark").padEnd(8),
      cell("door"),
    ].join(" "),
  );
}
if (args.json) {
  mkdirSync(dirname(join(root, args.json)), { recursive: true });
  writeFileSync(join(root, args.json), JSON.stringify(rows, null, 2));
}

// THE PICTURE: a panel an approach, in plan, the line up the panel.
const INK = {
  bg: [24, 26, 30],
  panel: [34, 37, 42],
  grid: [44, 48, 54],
  text: [220, 222, 226],
  dim: [130, 134, 140],
  house: [110, 116, 124, 200],
  wall: [170, 176, 184],
  rope: [160, 140, 90],
  part: [150, 170, 190],
  rail: [90, 110, 140],
  platform: [240, 220, 140],
  crowd: [120, 220, 140],
  cabin: [230, 80, 80, 140],
  skis: [240, 240, 255],
  worst: [255, 60, 60],
  phase: {
    ski: [200, 200, 200],
    board: [120, 200, 250],
    wait: [240, 200, 80],
    ride: [250, 120, 90],
    town: [180, 140, 240],
  },
};
const PX = 13;
const PW = 560;
const PH = 640;
// A panel an approach, and the platform close up off the first.
const panels = runs.map((run, k) => ({
  run,
  k,
  px: PX,
  cu: run.r.top ? -2 : -6,
  cv: 0,
  title: run.r.id,
}));
if (runs[0] && !runs[0].r.top) {
  const plan = runs[0].plan;
  const pf = E.platformOf(plan);
  const w0 = plan.supports[0];
  const du = (pf.x - w0.x) * plan.dx + (pf.z - w0.z) * plan.dz;
  const dv = (pf.x - w0.x) * plan.dz - (pf.z - w0.z) * plan.dx;
  panels.push({
    run: runs[0],
    k: 0,
    px: 60,
    cu: du + 1,
    cv: dv - 1.4,
    title: `${runs[0].r.id}: the step in`,
  });
}
const d = createDrawing(PW * panels.length + 10 * (panels.length + 1), PH + 60, INK.bg);
d.text(
  `LIFT PATH  seed ${args.seed}  the gondola, in plan (up the line is up)  ${PX} px/m, the close-up 60`,
  10,
  8,
  INK.text,
  2,
);
panels.forEach(({ run, k, px: PX, cu, cv, title }, n) => {
  // Drawn on a canvas of its own, so nothing spills into its neighbours.
  const ox = 0;
  const oy = 0;
  const pd = createDrawing(PW, PH, INK.panel);
  const { plan } = run;
  // The panel's centre: the station the approach is about.
  const wheel = run.r.top ? plan.supports[plan.supports.length - 1] : plan.supports[0];
  const toPx = (x, z) => {
    const dx = x - wheel.x;
    const dz = z - wheel.z;
    const u = dx * plan.dx + dz * plan.dz;
    const v = dx * plan.dz - dz * plan.dx;
    return [ox + PW / 2 + (v - cv) * PX, oy + PH / 2 - (u - cu) * PX];
  };
  const box = (at, heading, hw, hl) => {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    return [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ].map(([a, b]) => toPx(at.x + fx * a * hl + fz * b * hw, at.z + fz * a * hl - fx * b * hw));
  };
  // A grid a 5 m.
  for (let m = -40; m <= 40; m += 5) {
    const a = toPx(wheel.x + plan.dz * m - plan.dx * 40, wheel.z - plan.dx * m - plan.dz * 40);
    const b = toPx(wheel.x + plan.dz * m + plan.dx * 40, wheel.z - plan.dx * m + plan.dz * 40);
    pd.line(a[0], a[1], b[0], b[1], INK.grid);
    const c0 = toPx(wheel.x + plan.dx * m - plan.dz * 40, wheel.z + plan.dz * m + plan.dx * 40);
    const c1 = toPx(wheel.x + plan.dx * m + plan.dz * 40, wheel.z + plan.dz * m - plan.dx * 40);
    pd.line(c0[0], c0[1], c1[0], c1[1], INK.grid);
  }
  // The houses.
  for (const h of run.houses) {
    const pts = box(h, plan.heading, h.halfWidth, h.halfLength);
    pd.poly(pts, INK.house);
    pd.polyline(pts, INK.wall, 2, true);
  }
  // The furniture the view lays and the corral's ropes.
  const lay = SP.layStations(run.level, [plan]);
  for (const f of lay.fences) {
    const a = toPx(f.a.x, f.a.z);
    const b = toPx(f.b.x, f.b.z);
    pd.line(a[0], a[1], b[0], b[1], INK.rope);
  }
  for (const p of lay.parts) {
    const [x, y] = toPx(p.x, p.z);
    pd.disk(x, y, 3, INK.part);
    pd.text(p.kind, x + 4, y - 3, INK.part);
  }
  // The rail round the foot's wheel, and the line.
  if (!run.r.top) {
    let last = null;
    for (let r = -E.upRope(plan) * Math.PI; r <= 10; r += 0.25) {
      const q = E.railAt(plan, r);
      const p = toPx(q.x, q.z);
      if (last) pd.line(last[0], last[1], p[0], p[1], INK.rail);
      last = p;
    }
    const pf = E.platformOf(plan);
    const [px, py] = toPx(pf.x, pf.z);
    pd.circle(px, py, 6, INK.platform, 2);
    pd.text("platform", px + 8, py - 3, INK.platform);
    // The crowd's way in: through the door, INSIDE m on into the house.
    const door = along(plan, plan.look.entry.at, 0);
    const deep = along(plan, plan.look.entry.at + 2.5, 0);
    const a = toPx(door.x, door.z);
    const b = toPx(deep.x, deep.z);
    pd.line(a[0], a[1], b[0], b[1], INK.crowd, 3);
    pd.text("crowd's door", a[0] + 6, a[1] + 4, INK.crowd);
  }
  // The cabins carrying him, every quarter second while near the station
  // (every tenth close up), the door in its right flank.
  const near = (q) => Math.hypot(q.x - wheel.x, q.z - wheel.z) < 9;
  const every = 30;
  run.frames.forEach((q, i) => {
    if (!q.cab || i % every || !near(q.cab)) return;
    pd.polyline(box(q.cab, q.cab.heading, CABIN.w, CABIN.l), INK.cabin, 1, true);
    const fx = Math.sin(q.cab.heading);
    const fz = Math.cos(q.cab.heading);
    const a = toPx(
      q.cab.x + fz * CABIN.w - fx * DOOR_HALF,
      q.cab.z - fx * CABIN.w - fz * DOOR_HALF,
    );
    const b = toPx(
      q.cab.x + fz * CABIN.w + fx * DOOR_HALF,
      q.cab.z - fx * CABIN.w + fz * DOOR_HALF,
    );
    pd.line(a[0], a[1], b[0], b[1], INK.crowd, 2);
  });
  // His path, coloured by phase, faint where the picture is black.
  for (let i = 1; i < run.frames.length; i++) {
    const a = run.frames[i - 1];
    const b = run.frames[i];
    const col = INK.phase[b.phase.startsWith("town") ? "town" : b.phase] ?? INK.phase.ski;
    const pa = toPx(a.x, a.z);
    const pb = toPx(b.x, b.z);
    if (Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) > 3 * PX) {
      // A jump of more than three metres: the hand-over in the dark.
      pd.line(pa[0], pa[1], pb[0], pb[1], [...col, 60]);
      continue;
    }
    pd.line(
      pa[0],
      pa[1],
      pb[0],
      pb[1],
      b.fade >= BLACK ? [...col, 70] : col,
      b.fade >= BLACK ? 1 : 2,
    );
  }
  // The skis every quarter second while seen (every tenth close up).
  run.frames.forEach((q, i) => {
    if (i % (PX > 30 ? 6 : 15) || q.fade >= BLACK) return;
    for (let s = 0; s + 1 < q.ends.length; s += 2) {
      const a = toPx(q.ends[s][0], q.ends[s][1]);
      const b = toPx(q.ends[s + 1][0], q.ends[s + 1][1]);
      pd.line(a[0], a[1], b[0], b[1], INK.skis);
    }
  });
  // Where he shows through a wall.
  run.frames.forEach((q) => {
    if (q.house <= 0.02 && q.wall <= 0.02 && q.skis <= 0.02) return;
    const [x, y] = toPx(q.x, q.z);
    pd.line(x - 3, y - 3, x + 3, y + 3, INK.worst);
    pd.line(x - 3, y + 3, x + 3, y - 3, INK.worst);
  });
  const row = rows[k];
  pd.text(title, ox + 6, oy + 6, INK.text, 2);
  pd.text(
    `house ${fmt(row.house)} s ${fmt(row.houseDeep)} m  wall ${fmt(row.wall)} s ${fmt(row.wallDeep)} m  skis ${fmt(row.skis)} s  dark ${fmt(row.dark)} s`,
    ox + 6,
    oy + PH - 14,
    row.house > 0 || row.wall > 0 || row.skis > 0 ? INK.worst : INK.dim,
  );
  for (let y = 0; y < PH; y++) {
    for (let x = 0; x < PW; x++) d.set(10 + n * (PW + 10) + x, 40 + y, pd.get(x, y));
  }
});

// The key.
let kx = 10;
for (const [name, col] of Object.entries(INK.phase)) {
  d.fillRect(kx, PH + 48, 10, 6, col);
  d.text(name, kx + 14, PH + 47, INK.dim);
  kx += 80;
}
d.text(
  "faint: the picture faded black   red x: something of him through a wall",
  kx + 10,
  PH + 47,
  INK.dim,
);
mkdirSync(dirname(join(root, args.out)), { recursive: true });
writeFileSync(join(root, args.out), d.toPng());
console.log(args.out);
