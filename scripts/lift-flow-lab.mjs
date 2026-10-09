#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFT FLOW LAB (`make lift-flow`): is getting on and off a lift ONE
// UNBROKEN MOTION? A skier boarding a chair, a T-bar or a gondola's cabin,
// and stood off one at its top, is handed between the engine's phases
// (skating up the lane, waiting, carried, let go) and the view's poses
// (stood, sat, towed) — and every hand-over is a place a body can SNAP:
// teleport a metre, swivel on the spot, pop from stood to sat in a frame,
// sink its skis into the snow or float them over it. A picture shows one
// frame of that; this lab NUMBERS it.
//
// Each of the six stages (`pwa/src/tools/lift-stage.ts`: chair-load,
// chair-unload, tbar-pick, tbar-release, gondola-in, gondola-out) is ridden
// on the REAL ENGINE in Node at 120 Hz with neutral hands, and posed every
// other step as the game poses him at 60 fps — the body's spring
// (`stepSkierSpring`), the pair on the snow (`standOf`), the pose input
// (`poseInputOf`), the seat eased as the view eases it (`easeSeat`) and the
// seated pose (`seatedPose`) — his joints carried into the world. Per stage:
//
// The speed, pop, swivel, sink and float are read over the lift's own
// moment: while it has him (skating up to it included), while he is drawn
// sat or towed, and `AFTER` s past its letting him go.
//
//   speed   the fastest his origin moves between two frames, m/s — a jump
//           there is a teleport (a lift runs at 5 m/s, a skater at 3)
//   pop     the largest second difference of any joint between frames, cm —
//           what a still frame cannot show: a joint flicked across in one
//           frame (a smooth 1 g swing is under 0.3 cm)
//   swivel  the fastest his heading turns between frames, °/s
//   sink    the deepest his boots go under their rest over the snow, cm
//           (a ski buried) — the rest the median of his frames off the lift
//   float   the highest his boots hang over that rest while he stands on
//           his skis off the lift, cm
//   dark    how long the picture is faded black (`liftFade`), s — the
//           moment hidden instead of shown
//   wait / rack / sit / stand / out  how long each part takes, s, against
//           the bands the research gives (`docs/lifts.md`); `rack` is a
//           gondola's rider standing his pair in his cabin's rack
//
// A picture (previews/lift-flow.png): a row a stage — the line he rides
// from above with his figure strobed every quarter second (feet, hips,
// head, the way he faces), the same from the side in the lift line's frame
// (u up the line, the height) over the snow's profile, and the traces —
// the speed, the heading, the hips over the snow, how sat he is, the fade —
// the frame of the worst pop marked.
//
//   node scripts/lift-flow-lab.mjs                    every stage, seed 38
//   node scripts/lift-flow-lab.mjs --stage=chair-load,chair-unload
//   node scripts/lift-flow-lab.mjs --seed=4 --region=maritime
//   node scripts/lift-flow-lab.mjs --list             the worst frames named
//   node scripts/lift-flow-lab.mjs --json=previews/lift-flow-before.json
//   node scripts/lift-flow-lab.mjs --compare=previews/lift-flow-before.json

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";
import { inWorld, rot } from "./lib/skier-trace.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed" },
    region: { kind: "string", default: "", help: "the kind of snow country (R21)" },
    stage: { kind: "string", default: "", help: "the stages, comma-separated (all when left out)" },
    list: { kind: "flag", help: "name the worst frame of each column" },
    dump: {
      kind: "string",
      default: "",
      help: "t0,t1: print each frame of the first stage between them — a joint and every pose input that moved",
    },
    joint: {
      kind: "string",
      default: "head",
      help: "the joint --dump follows (head, hips, handsL, feetR…)",
    },
    out: { kind: "string", default: "previews/lift-flow.png", help: "the picture" },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/lift-flow-lab.mjs [--seed=n] [--region=id] [--stage=a,b] [--list] [--json=file] [--compare=file]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const P = await import(join(root, "pwa/src/game/skier-pose.ts"));
const G = await import(join(root, "pwa/src/game/skis-body.ts"));
const ST = await import(join(root, "pwa/src/game/ski-stand.ts"));
const FL = await import(join(root, "pwa/src/game/skier-flight.ts"));
const SEAT = await import(join(root, "pwa/src/game/skier-seat.ts"));
const CAM = await import(join(root, "pwa/src/game/camera-lift.ts"));
const STAGE = await import(join(root, "pwa/src/tools/lift-stage.ts"));

const region = args.region || undefined;
const stages = args.stage ? args.stage.split(",") : STAGE.STAGES;

/** The research's bands, s (`docs/lifts.md`): how long each part may take. */
const BANDS = {
  wait: [0, 12],
  rack: [0.5, 4],
  sit: [0.4, 3],
  stand: [0.3, 2],
  out: [1, 20],
};

const JOINTS = ["hips", "neck", "head"];
const PAIRS = ["knees", "feet", "hands", "elbows", "shoulders"];

/** One stage ridden and posed: every frame of its window. */
function rideStage(id) {
  const win = STAGE.stageWindow(id, args.seed, region, {
    crowd: 0,
    whole: true,
    before: 2,
    // Out of a gondola he walks off with the pair on his shoulder, lays it
    // down and clicks in before he skis.
    after: id === "gondola-out" ? 16 : 5,
  });
  const state = STAGE.stageState(id, args.seed, region, 0);
  if (!win || !state) return null;
  const c = state.skier;
  const mounts = G.mountsOf(c.spec);
  const legs = P.createSkierSpring();
  const seatEase = SEAT.createSeatEase();
  const frames = [];
  let lastT = null;
  const gravity = E.flightGravity(state.rules);
  // The body's spring settled a moment before the first frame is read.
  const from = Math.max(0.6, win.from - 0.5);
  // Walked out of a gondola, he clicks back in standing on the level pad:
  // from there the hands skate him off (the tuck), as a player's would.
  const skate = { ...E.NEUTRAL_INPUT, tuck: 1 };
  let walked = false;
  for (let i = 0; state.t < win.to; i++) {
    if (c.town) walked = true;
    E.step(state, walked && !c.town && !c.lift ? skate : E.NEUTRAL_INPUT);
    if (i % 2 === 0) continue;
    const dt = lastT === null ? 0 : state.t - lastT;
    P.stepSkierSpring(
      legs,
      c.vy,
      c.airborne,
      dt,
      c.jumpLoad / E.TUNING.jump.full,
      c,
      false,
      {
        read: c.airborne ? FL.flightRead(state.level, c, c.spec.cogHeight, gravity) : null,
        gravity,
      },
      G.legsLift(c),
    );
    const { sat } = SEAT.easeSeat(seatEase, c.lift, false, dt);
    lastT = state.t;
    if (state.t < from || c.thrown) continue;
    const stand = ST.standOf(
      c,
      G.groundOf(c, legs),
      undefined,
      undefined,
      P.drawnSkiAngle(legs, c),
    );
    const input = G.poseInputOf(c, legs, mounts, null, false, stand);
    const cabin = c.lift?.kind === "gondola" && c.lift.phase === "ride";
    const seat =
      seatEase.seated > 0
        ? {
            share: seatEase.seated,
            y: E.TUNING.lift.seat - SEAT.CHAIR_SEAT,
            ...(cabin ? { floor: SEAT.CABIN_FLOOR } : {}),
          }
        : seatEase.towing > 0
          ? { share: seatEase.towing, y: 0, tow: true }
          : null;
    const pose = SEAT.seatedPose(input, seat);
    // The drawn origin: the pair's pivot under him turned with him.
    const pv = rot(c.q, { x: stand.pivot.x, y: stand.pivot.y, z: 0 });
    const at = { ...c, x: c.x + pv.x, y: c.y + pv.y, z: c.z + pv.z, q: { ...c.q } };
    const world = inWorld(pose, at);
    const ground = state.level.groundAt;
    frames.push({
      input,
      t: state.t,
      phase: c.lift ? `${c.lift.phase}${c.lift.faded ? "*" : ""}` : "ski",
      lift: c.lift ? { ...c.lift, from: { ...c.lift.from } } : null,
      sat,
      seated: seatEase.seated,
      towing: seatEase.towing,
      fade: CAM.liftFade(c.lift, togoOf(state, c.lift)),
      x: at.x,
      y: at.y,
      z: at.z,
      heading: c.heading,
      speed: c.speed,
      world,
      snow: world.feet.map((f) => ground(f.x, f.z)),
      under: ground(c.x, c.z),
    });
  }
  return {
    id,
    win,
    frames,
    plan: E.liftPlans(state.level).find((p) => p.lift.kind === STAGE.stageOf(id).kind),
    level: state.level,
  };
}

/** How far his carrier has still to carry him to where it lets him go, m. */
function togoOf(state, lift) {
  const plan = lift && E.liftPlans(state.level)[lift.index];
  return plan ? plan.length - plan.look.off - lift.u : Infinity;
}

/** How long after the lift lets him go his motion is still the lift's, s. */
const AFTER = 0.75;

const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** The stage's numbers, and the frame each worst one is at. */
function measure(r) {
  const f = r.frames;
  const at = { speed: 0, pop: 0, swivel: 0, sink: 0, float: 0, dark: 0 };
  const where = {};
  const worst = (k, v, i, say) => {
    if (v > at[k]) {
      at[k] = v;
      where[k] = { t: f[i].t, phase: f[i].phase, say };
    }
  };
  // His boots' rest over the snow stood on his skis — the median of every
  // frame off the lift — what a sink or a float is read against.
  const gaps = f
    .filter((x) => !x.lift && x.seated < 0.01 && x.towing < 0.01)
    .flatMap((x) => x.world.feet.map((p, s) => p.y - x.snow[s]))
    .sort((a, b) => a - b);
  const rest = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
  // The lift's own moment: while it has him, while he is drawn sat or
  // towed, and the first `AFTER` s on his own — the skating he does after
  // is the gait's, not the lift's.
  let freed = -Infinity;
  const ours = (x) => {
    if (x.lift || x.seated > 0.01 || x.towing > 0.01) {
      freed = Infinity;
      return true;
    }
    if (freed === Infinity) freed = x.t;
    return x.t - freed <= AFTER;
  };
  for (let i = 0; i < f.length; i++) {
    const dt = i > 0 ? f[i].t - f[i - 1].t : 1 / 60;
    at.dark += f[i].fade >= 0.99 ? dt : 0;
    if (!ours(f[i])) continue;
    // A cut behind the black is not seen: no speed or turn read across it.
    if (i > 0 && f[i].fade < 0.99 && f[i - 1].fade < 0.99) {
      worst("speed", d3(f[i], f[i - 1]) / dt, i, "");
      worst(
        "swivel",
        (Math.abs(wrap(f[i].heading - f[i - 1].heading)) * 180) / Math.PI / dt,
        i,
        "",
      );
    }
    if (i > 1 && f[i].fade < 0.99 && f[i - 1].fade < 0.99 && f[i - 2].fade < 0.99) {
      const pts = (fr) => [
        ...JOINTS.map((j) => [j, fr.world[j]]),
        ...PAIRS.flatMap((j) => fr.world[j].map((p, s) => [`${j}${s ? "R" : "L"}`, p])),
      ];
      const a = pts(f[i - 2]);
      const b = pts(f[i - 1]);
      const c = pts(f[i]);
      for (let k = 0; k < a.length; k++) {
        const ax = a[k][1];
        const bx = b[k][1];
        const cx = c[k][1];
        const p = Math.hypot(
          cx.x - 2 * bx.x + ax.x,
          cx.y - 2 * bx.y + ax.y,
          cx.z - 2 * bx.z + ax.z,
        );
        worst("pop", p * 100, i - 1, a[k][0]);
      }
    }
    if (f[i].fade < 0.99) {
      const inCabin = f[i].lift?.kind === "gondola" && f[i].lift.phase === "ride";
      if (!inCabin) {
        for (let s = 0; s < 2; s++) {
          const gap = f[i].world.feet[s].y - f[i].snow[s] - rest;
          worst("sink", -gap * 100, i, s ? "right boot" : "left boot");
          if (!f[i].lift && f[i].seated < 0.01)
            worst("float", gap * 100, i, s ? "right boot" : "left boot");
        }
      }
    }
  }
  // How long each part took, off the lift's events.
  const ev = r.win.events;
  const tOf = (phase) => ev.find((e) => e.phase === phase)?.t;
  const top = STAGE.stageOf(r.id).top;
  const parts = {};
  if (!top) {
    const waitFrom = f.find((x) => x.lift?.phase === "wait")?.t;
    const take = tOf("take");
    parts.wait = waitFrom !== undefined && take !== undefined ? take - waitFrom : 0;
    // A gondola's rider, walked aboard, stands his pair in the cabin's
    // rack first: from the take to the rack let go.
    const racks = f.some((x) => x.t >= (take ?? 0) && x.lift?.rack !== undefined);
    const racked = racks
      ? f.find((x) => x.t >= take && x.lift && x.lift.rack === undefined)?.t
      : undefined;
    if (racks) parts.rack = racked !== undefined ? racked - take : NaN;
    // From the carrier's take (or the rack) to sat (or towed) in full.
    const t0 = racked ?? take ?? f[0].t;
    const sat = f.find((x) => x.t >= t0 && Math.max(x.seated, x.towing) >= 0.99)?.t;
    parts.sit = sat !== undefined ? sat - t0 : NaN;
  } else {
    const off = tOf("off");
    // Out of a cabin's door he is stood behind the fade: up is seen once
    // the picture is back.
    const up = f.find(
      (x) => x.t >= off && x.seated <= 0.01 && x.towing <= 0.01 && x.fade <= 0.01,
    )?.t;
    parts.stand = up !== undefined ? up - off : NaN;
    // From stood off to skiing on his own, past the lift's ground (3 m).
    const away = f.find(
      (x) =>
        x.t >= off &&
        d3(
          x,
          f.find((y) => y.t >= off),
        ) > 3,
    )?.t;
    parts.out = away !== undefined ? away - off : NaN;
  }
  return { at, where, parts };
}

const rows = [];
for (const id of stages) {
  const r = rideStage(id);
  if (!r) {
    console.log(`${id}: no such lift on seed ${args.seed}`);
    continue;
  }
  rows.push({ ...r, ...measure(r) });
}

// A DUMP: what moved between frames, input by input.
if (args.dump && rows[0]) {
  const [d0, d1] = args.dump.split(",").map(Number);
  const flat = (o, pre = "", out = {}) => {
    for (const [k, v] of Object.entries(o ?? {})) {
      if (typeof v === "number") out[pre + k] = v;
      else if (typeof v === "boolean") out[pre + k] = v ? 1 : 0;
      else if (Array.isArray(v))
        v.forEach((x, i) =>
          typeof x === "number" ? (out[`${pre}${k}${i}`] = x) : flat(x, `${pre}${k}${i}.`, out),
        );
      else if (v && typeof v === "object" && k !== "mounts") flat(v, `${pre}${k}.`, out);
    }
    return out;
  };
  // The joint the dump follows (`--joint=head`, `handsL`, `feetR`…).
  const joint = args.joint || "head";
  const pair = /^(\w+)([LR])$/.exec(joint);
  const jointOf = (fr) => (pair ? fr.world[pair[1]][pair[2] === "R" ? 1 : 0] : fr.world[joint]);
  let was = null;
  for (const fr of rows[0].frames) {
    if (fr.t < d0 || fr.t > d1) continue;
    const now = flat(fr.input);
    const moved = was
      ? Object.keys(now)
          .filter((k) => Math.abs(now[k] - (was[k] ?? now[k])) > 0.02)
          .map((k) => `${k} ${was[k]?.toFixed(2)}→${now[k].toFixed(2)}`)
      : [];
    console.log(
      `${fr.t.toFixed(3)} ${fr.phase.padEnd(6)} ${joint} ${["x", "y", "z"].map((a) => jointOf(fr)[a].toFixed(3)).join(",")}  seat ${fr.seated.toFixed(2)} tow ${fr.towing.toFixed(2)}  ${moved.join("  ")}`,
    );
    was = now;
  }
}

// THE TABLE.
const COLS = [
  ["speed", "speed m/s", 1],
  ["pop", "pop cm", 1],
  ["swivel", "swivel°/s", 0],
  ["sink", "sink cm", 1],
  ["float", "float cm", 1],
  ["dark", "dark s", 2],
];
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const fmt = (v, dp) => (v === undefined || v === null || Number.isNaN(v) ? "—" : v.toFixed(dp));
const pad = (s, n) => String(s).padStart(n);
const W0 = before ? 16 : 11;
console.log(
  `lift flow lab · seed ${args.seed}${region ? ` ${region}` : ""} · 60 fps posed off the 120 Hz engine`,
);
console.log(["stage".padEnd(14), ...COLS.map(([, h]) => pad(h, W0)), "   parts (s)"].join(""));
for (const r of rows) {
  const old = before?.find((b) => b.id === r.id);
  const cells = COLS.map(([k, , dp]) => {
    const now = fmt(Math.max(0, r.at[k]), dp);
    const was = old ? fmt(Math.max(0, old.at[k]), dp) : null;
    return pad(was !== null && was !== now ? `${was}→${now}` : now, W0);
  });
  const parts = Object.entries(r.parts)
    .map(([k, v]) => {
      const was = old?.parts?.[k];
      const band = BANDS[k];
      const bad = band && !(v >= band[0] && v <= band[1]) ? "!" : "";
      return `${k} ${was !== undefined && fmt(was, 2) !== fmt(v, 2) ? `${fmt(was, 2)}→` : ""}${fmt(v, 2)}${bad}`;
    })
    .join("  ");
  console.log([r.id.padEnd(14), ...cells, "   ", parts].join(""));
}
console.log(
  "columns: speed the origin's fastest move between frames; pop a joint's largest second",
);
console.log(
  "  difference; swivel the heading's fastest turn; sink the boots' deepest under the snow;",
);
console.log("  float the boots' highest over it stood on his skis; dark the seconds faded black.");
console.log(
  `bands (s): ${Object.entries(BANDS)
    .map(([k, [a, b]]) => `${k} ${a}–${b}`)
    .join(", ")} — "!" outside its band`,
);
if (args.list) {
  for (const r of rows)
    for (const [k, w] of Object.entries(r.where))
      console.log(
        `  ${r.id} ${k.padEnd(7)} ${fmt(r.at[k], 2).padStart(8)} at ${w.t.toFixed(2)} s (${w.phase})${w.say ? ` ${w.say}` : ""}`,
      );
}

// THE PICTURE.
const INK = {
  bg: [18, 22, 30],
  panel: [26, 31, 42],
  text: [220, 226, 236],
  dim: [120, 128, 142],
  snow: [200, 215, 235],
  rope: [110, 110, 120],
  feet: [90, 150, 230],
  hips: [250, 120, 90],
  head: [240, 220, 120],
  heading: [160, 220, 160],
  speed: [120, 200, 250],
  turn: [160, 220, 160],
  hipsY: [250, 120, 90],
  seated: [240, 200, 80],
  fade: [150, 150, 160],
  worst: [255, 70, 70],
  phase: {
    ski: [200, 200, 200],
    board: [120, 200, 250],
    wait: [240, 200, 80],
    ride: [250, 120, 90],
  },
};
const ROW = 240;
const W = 1500;
const d = createDrawing(W, 30 + rows.length * ROW, INK.bg);
d.text(
  `LIFT FLOW  SEED ${args.seed}${region ? ` ${region}` : ""}  - PLAN, SIDE (U UP THE LINE), TRACES`,
  10,
  10,
  INK.text,
  2,
);
rows.forEach((r, n) => {
  const y0 = 30 + n * ROW;
  const f = r.frames;
  const plan = r.plan;
  const lineFrame = (p) => {
    const rx = p.x - plan.lift.bottom.x;
    const rz = p.z - plan.lift.bottom.z;
    return { u: rx * plan.dx + rz * plan.dz, v: rx * plan.dz - rz * plan.dx };
  };
  d.text(`${r.id}`, 10, y0 + 6, INK.text, 2);
  // PLAN: the line's frame from above (u up the page, v right).
  const px = 10;
  const pw = 360;
  const py = y0 + 26;
  const ph = ROW - 34;
  d.fillRect(px, py, pw, ph, INK.panel);
  const uv = f.map((fr) => lineFrame(fr));
  const uMin = Math.min(...uv.map((p) => p.u)) - 3;
  const uMax = Math.max(...uv.map((p) => p.u)) + 3;
  const vMin = Math.min(...uv.map((p) => p.v)) - 3;
  const vMax = Math.max(...uv.map((p) => p.v)) + 3;
  const ps = Math.min(pw / (vMax - vMin), ph / (uMax - uMin));
  const toP = (p) => {
    const q = lineFrame(p);
    return [
      px + pw / 2 + (q.v - (vMin + vMax) / 2) * ps,
      py + ph / 2 - (q.u - (uMin + uMax) / 2) * ps,
    ];
  };
  // The ropes.
  for (const side of plan.lift.kind === "drag"
    ? [E.DRAG_ARM]
    : [plan.look.gauge / 2, -plan.look.gauge / 2]) {
    const a = toP({
      x: plan.lift.bottom.x + plan.dx * uMin + plan.dz * side,
      z: plan.lift.bottom.z + plan.dz * uMin - plan.dx * side,
    });
    const b = toP({
      x: plan.lift.bottom.x + plan.dx * uMax + plan.dz * side,
      z: plan.lift.bottom.z + plan.dz * uMax - plan.dx * side,
    });
    d.line(a[0], a[1], b[0], b[1], INK.rope);
  }
  let lastS = -1;
  f.forEach((fr) => {
    const [x, y] = toP(fr);
    d.set(Math.round(x), Math.round(y), INK.phase[fr.phase.replace("*", "")] ?? INK.dim);
    if (fr.t - lastS < 0.25) return;
    lastS = fr.t;
    for (const ft of fr.world.feet) {
      const [a, b] = toP(ft);
      d.disk(a, b, 1.5, INK.feet);
    }
    const [hx, hy] = toP(fr.world.hips);
    d.disk(hx, hy, 2, INK.hips);
    const [ex, ey] = toP(fr.world.head);
    d.disk(ex, ey, 2, INK.head);
    const tip = toP({ x: fr.x + Math.sin(fr.heading) * 1.2, z: fr.z + Math.cos(fr.heading) * 1.2 });
    d.line(x, y, tip[0], tip[1], INK.heading);
  });
  // SIDE: u along the line, the height.
  const sx = px + pw + 10;
  const sw = 520;
  d.fillRect(sx, py, sw, ph, INK.panel);
  const ys = f.flatMap((fr) => [fr.world.head.y, ...fr.snow, fr.under]);
  const yMin = Math.min(...ys) - 0.5;
  const yMax = Math.max(...ys) + 0.5;
  const ss = Math.min(sw / (uMax - uMin), ph / (yMax - yMin));
  const toS = (p) => [sx + (lineFrame(p).u - uMin) * ss, py + ph - (p.y - yMin) * ss];
  // The snow under his line.
  let prev = null;
  for (const fr of f) {
    const q = toS({ x: fr.x, z: fr.z, y: fr.under });
    if (prev) d.line(prev[0], prev[1], q[0], q[1], INK.snow);
    prev = q;
  }
  lastS = -1;
  f.forEach((fr) => {
    if (fr.t - lastS < 0.25) return;
    lastS = fr.t;
    const w = fr.world;
    const seg = (a, b, col) => {
      const p = toS(a);
      const q = toS(b);
      d.line(p[0], p[1], q[0], q[1], col);
    };
    const col = INK.phase[fr.phase.replace("*", "")] ?? INK.dim;
    for (let s = 0; s < 2; s++) {
      seg(w.hips, w.knees[s], col);
      seg(w.knees[s], w.feet[s], col);
    }
    seg(w.hips, w.neck, col);
    seg(w.neck, w.head, INK.head);
  });
  // TRACES.
  const tx = sx + sw + 10;
  const tw = W - tx - 10;
  d.fillRect(tx, py, tw, ph, INK.panel);
  const t0 = f[0].t;
  const t1 = f[f.length - 1].t;
  const toT = (t) => tx + ((t - t0) / Math.max(1e-6, t1 - t0)) * tw;
  const trace = (vals, lo, hi, col) => {
    let p = null;
    f.forEach((fr, i) => {
      const v = Math.max(lo, Math.min(hi, vals[i]));
      const q = [toT(fr.t), py + ph - ((v - lo) / (hi - lo)) * ph];
      if (p) d.line(p[0], p[1], q[0], q[1], col);
      p = q;
    });
  };
  const speeds = f.map((fr, i) => (i ? d3(fr, f[i - 1]) / (fr.t - f[i - 1].t) : 0));
  trace(speeds, 0, 8, INK.speed);
  trace(
    f.map((fr) => fr.heading),
    -Math.PI,
    Math.PI,
    INK.turn,
  );
  trace(
    f.map((fr) => fr.world.hips.y - fr.under),
    0,
    3,
    INK.hipsY,
  );
  trace(
    f.map((fr) => Math.max(fr.seated, fr.towing)),
    0,
    1.05,
    INK.seated,
  );
  trace(
    f.map((fr) => fr.fade),
    0,
    1.05,
    INK.fade,
  );
  for (const e of r.win.events) {
    if (e.t < t0 || e.t > t1) continue;
    const x = toT(e.t);
    d.line(x, py, x, py + ph, INK.dim);
    d.text(e.phase, x + 2, py + 2, INK.dim);
  }
  if (r.where.pop) {
    const x = toT(r.where.pop.t);
    d.line(x, py, x, py + ph, INK.worst);
  }
  d.text(
    `SPEED BLUE 0-8  HEADING GREEN  HIPS ORANGE 0-3 M  SAT YELLOW  FADE GREY  POP ${fmt(r.at.pop, 1)} CM`,
    tx + 4,
    py + ph - 10,
    INK.dim,
  );
});
mkdirSync(dirname(join(root, args.out)), { recursive: true });
writeFileSync(join(root, args.out), d.toPng());
console.log(`picture: ${args.out}`);

if (args.json)
  writeFileSync(
    args.json,
    JSON.stringify(
      rows.map((r) => ({ id: r.id, at: r.at, parts: r.parts, where: r.where })),
      null,
      1,
    ),
  );
