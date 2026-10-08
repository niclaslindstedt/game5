#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DIFFICULTY SCHEMATIC: one map from above with what makes it HARD drawn
// over the plan, so a pinned map can be judged by eye as well as by
// `make rate`'s row. Pure Node — the engine and the level painter, no build,
// no browser, seconds.
//
//   make difficulty SEED=38                       previews/difficulty-38.png
//   make difficulty SEED=38 ARGS="--hour 20 --weather fog"
//   make difficulty SEED=38 ARGS=--sim            ...the bot's run as the length axis
//   make difficulty RACE=slalom                   one sheet per race map of a discipline
//
// Over `level-draw.mjs`'s map it lays, in this order:
//
//   THE LINE BY ITS BENDS — the piste re-stroked in a ladder from green
//   (straight) through amber to red (a bend at R6's least radius), so the
//   tight half of a map stands out from the sweeping half before a number
//   has been read; the tightest point of every corner under twice the floor
//   gets its radius written beside it.
//   THE STEEPS — every ten-metre stretch of the piste falling steeper than
//   `STEEP` ticked across the line in blue, which is where the steepness axis's
//   metres come from.
//   THE POWDER — every drift (R17) laid over the line as a violet band, the
//   longest labelled with its length.
//   THE WALLS — every station walled by trunks on BOTH sides dotted in dark
//   red on the centreline: the woods axis's tightest half.
//   THE PANEL — the eight axes as bars with their raw readings, the
//   difficulty index, the axis it leads on and its digest.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { MARGIN, TITLE_H, label, renderLevelMap } from "./lib/level-draw.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
aliasEngine(root);
const {
  LEVEL_RULES,
  RATING_AXES,
  WALL_REACH,
  WEATHER_KINDS,
  cornerRadius,
  generateLevel,
  leadingAxis,
  levelDigest,
  rateLevel,
  simulateRun,
  treesNear,
  withSky,
} = await import(join(root, "engine/index.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the seed to draw" },
    hour: { kind: "number", help: "rate under this start hour instead of the map's own" },
    weather: { kind: "string", help: "…this sky (clear, fair, high, overcast, snow, fog)" },
    sim: { kind: "flag", help: "ride the map with the bot and rate its run as the length axis" },
    scale: { kind: "number", default: 0.6, help: "pixels per metre" },
    race: { kind: "string", help: "draw a discipline's nine race maps instead (race-maps.ts)" },
    out: { kind: "string", help: "file name under previews/ (one map only)" },
  },
  "usage: npm run difficulty -- [--seed n] [--hour h] [--weather w] [--sim] [--scale px/m] [--race id] [--out name]",
);

if (args.weather !== undefined && !WEATHER_KINDS.includes(args.weather)) {
  console.error(`unknown weather "${args.weather}" (${WEATHER_KINDS.join(", ")})`);
  process.exit(2);
}

const INK = [24, 24, 28];
const RED = [200, 40, 40];
const CLIMB_INK = [30, 90, 200];
const POWDER_INK = [150, 70, 210];
const WALL_INK = [130, 20, 30];
const PANEL_W = 300;
/** A ten-metre stretch falling steeper than this is ticked: a red's pitch. */
const STEEP = LEVEL_RULES.grade.bands.red;

/** The corner ladder: green for a straight, amber halfway, red at the floor.
 * `t` is 0 straight … 1 at the floor. */
function cornerInk(t) {
  const k = Math.max(0, Math.min(1, t));
  if (k < 0.5) return [60 + (230 - 60) * (k * 2), 160, 60];
  return [230, 160 - (160 - 40) * ((k - 0.5) * 2), 40];
}

/** Draw one map's sheet and write it. */
function drawSheet({ level, opts, name, title }) {
  const rating = rateLevel(level, opts);
  const shown = opts.sky ? withSky(level, opts.sky) : level;
  const scale = args.scale;
  const canvas = renderLevelMap({ level: shown, scale, title, lines: [] });
  const px = (x) => MARGIN + x * scale;
  const py = (z) => TITLE_H + (level.size - z) * scale;
  const pts = level.track.points;
  const n = pts.length;

  // ── The line by its corners ────────────────────────────────────────────
  const floor = LEVEL_RULES.track.minRadius;
  const radii = pts.map((_p, i) => cornerRadius(pts, i));
  for (let i = 0; i < n; i++) {
    const r = radii[i];
    const t = r === Infinity ? 0 : 1 - Math.min(1, Math.max(0, (r - floor) / (3 * floor)));
    if (i + 1 >= n) break;
    const next = pts[i + 1];
    canvas.line(px(pts[i].x), py(pts[i].z), px(next.x), py(next.z), cornerInk(t), 3);
  }
  let best = { r: Infinity, i: -1 };
  const closeCorner = () => {
    if (best.i >= 0) {
      label(
        canvas,
        px(pts[best.i].x) + 6,
        py(pts[best.i].z) - 10,
        `R${Math.round(best.r)}`,
        RED,
        1,
      );
    }
    best = { r: Infinity, i: -1 };
  };
  for (let i = 0; i < n; i++) {
    if (radii[i] < 2 * floor) {
      if (radii[i] < best.r) best = { r: radii[i], i };
    } else closeCorner();
  }
  closeCorner();

  // ── The climbs ─────────────────────────────────────────────────────────
  const stride = 5;
  for (let i = 0; i < n; i += stride) {
    const a = pts[i];
    const b = pts[(i + stride) % n];
    const run = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    if ((b.y - a.y) / run < STEEP) continue;
    const rx = Math.cos(a.heading) * 5;
    const rz = -Math.sin(a.heading) * 5;
    canvas.line(px(a.x - rx), py(a.z - rz), px(a.x + rx), py(a.z + rz), CLIMB_INK, 2);
  }

  // ── The powder ─────────────────────────────────────────────────────────
  const step = level.track.length / n;
  let longest = { length: 0, i: 0 };
  for (const d of level.drifts ?? []) {
    const i0 = Math.floor(d.from / step);
    const i1 = Math.ceil(d.to / step);
    for (let i = i0; i + 1 < Math.min(n, i1 + 1); i++) {
      const a = pts[i];
      const b = pts[i + 1];
      canvas.line(px(a.x), py(a.z), px(b.x), py(b.z), [...POWDER_INK, 170], 7);
    }
    if (d.to - d.from > longest.length) {
      longest = { length: d.to - d.from, i: Math.min(n - 1, Math.floor((i0 + i1) / 2)) };
    }
  }
  if (longest.length > 0) {
    const p = pts[longest.i];
    label(canvas, px(p.x) + 8, py(p.z) + 6, `DRIFT ${Math.round(longest.length)} M`, POWDER_INK, 1);
  }

  // ── The walls ──────────────────────────────────────────────────────────
  const near = [];
  for (let i = 0; i < n; i += stride) {
    const p = pts[i];
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    let left = false;
    let right = false;
    for (const t of treesNear(level, p.x, p.z, p.width / 2 + WALL_REACH, near)) {
      const tree = level.trees[t];
      if ((tree.x - p.x) * rx + (tree.z - p.z) * rz > 0) right = true;
      else left = true;
    }
    if (left && right) canvas.disk(px(p.x), py(p.z), 2, WALL_INK);
  }

  // ── The panel, over the map's own key column ───────────────────────────
  const panelX = canvas.width - PANEL_W + 8;
  let y = TITLE_H + 8;
  canvas.fillRect(
    canvas.width - PANEL_W,
    TITLE_H,
    PANEL_W,
    canvas.height - TITLE_H,
    [246, 244, 238],
  );
  const s = rating.stats;
  label(canvas, panelX, y, `DIFFICULTY ${rating.difficulty.toFixed(3)}`, INK, 2);
  y += 24;
  label(canvas, panelX, y, `LEADS ON ${leadingAxis(rating.axes).toUpperCase()}`, INK, 1);
  y += 18;
  const readings = {
    steepness: `MEAN ${(s.meanGrade * 100).toFixed(0)}%, STEEPEST 100 M ${(s.steepest * 100).toFixed(0)}%`,
    bends: `TIGHTEST R${Math.round(s.tightest)}, ${s.sweepPerKm.toFixed(1)} RAD/KM`,
    air: `${s.kickers} KICKERS, ${s.lips.toFixed(1)} M OF LIP`,
    woods: `${(s.walled * 100).toFixed(0)}% OF THE PISTE WALLED`,
    traverses: `${(s.traversed * 100).toFixed(0)}% ACROSS THE FACE, LONGEST ${Math.round(s.longestTraverse)} M`,
    powder: `${(s.drifted * 100).toFixed(0)}% DRIFTED, LONGEST ${Math.round(s.longestDrift)} M`,
    weather: `SUN ${s.sunDeg.toFixed(0)}° AT THE START, ${s.weather.toUpperCase()}`,
    length: `${s.runSeconds.toFixed(0)} S TOP TO BOTTOM${s.measured ? " (THE BOT)" : " (ESTIMATED)"}, ${(s.length / 1000).toFixed(2)} KM`,
  };
  for (const axis of RATING_AXES) {
    const v = rating.axes[axis];
    label(canvas, panelX, y, axis.toUpperCase(), INK, 1);
    canvas.rect(panelX + 64, y - 1, 120, 9, [180, 180, 180]);
    canvas.fillRect(panelX + 65, y, Math.round(118 * v), 7, cornerInk(v));
    label(canvas, panelX + 190, y, v.toFixed(2), INK, 1);
    y += 12;
    label(canvas, panelX + 8, y, readings[axis], [90, 90, 96], 1);
    y += 16;
  }
  y += 6;
  label(canvas, panelX, y, `DIGEST ${levelDigest(level)}  V${level.version}`, INK, 1);
  y += 12;
  label(canvas, panelX, y, `${args.scale} PX/M`, [90, 90, 96], 1);
  y += 20;
  label(canvas, panelX, y, "LINE: GREEN STRAIGHT, RED AT R6", [90, 90, 96], 1);
  y += 10;
  label(canvas, panelX, y, `BLUE TICKS: FALLING PAST ${STEEP * 100}% (A BLACK)`, CLIMB_INK, 1);
  y += 10;
  label(canvas, panelX, y, "VIOLET BAND: A DRIFT (R17)", POWDER_INK, 1);
  y += 10;
  label(canvas, panelX, y, "DARK RED DOTS: WOODS BOTH SIDES", WALL_INK, 1);

  const outDir = join(root, "previews");
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${name}.png`);
  writeFileSync(file, canvas.toPng());
  console.log(
    `wrote ${file} (${canvas.width}×${canvas.height}) — difficulty ${rating.difficulty.toFixed(3)}, leads on ${leadingAxis(rating.axes)}`,
  );
}

/** The bot's run on a built map, s — or nothing. */
function botRun(level) {
  const run = simulateRun(level.seed, { level });
  return run.finished ? run.time : undefined;
}

if (args.race !== undefined) {
  const { RACE_MAPS } = await import(join(root, "pwa/src/game/race-maps.ts"));
  const { buildPinnedLevel, pinnedSky } = await import(join(root, "pwa/src/game/pinned.ts"));
  const maps = RACE_MAPS[args.race];
  if (!maps) {
    console.error(`no race maps for "${args.race}" (${Object.keys(RACE_MAPS).join(", ")})`);
    process.exit(2);
  }
  for (const pinned of maps) {
    const level = buildPinnedLevel(pinned);
    drawSheet({
      level,
      opts: { sky: pinnedSky(pinned), runSeconds: botRun(level) },
      name: `difficulty-${pinned.id}`,
      title: `${pinned.id.toUpperCase()}  ${pinned.name.toUpperCase()}  SEED ${pinned.seed} COURSE ${pinned.course} ${pinned.grade.toUpperCase()}  ${pinned.mode.toUpperCase()}  V${pinned.version}`,
    });
  }
} else {
  const level = generateLevel(args.seed);
  const sky = {};
  if (args.hour !== undefined) sky.hour = args.hour;
  if (args.weather !== undefined) sky.weather = args.weather;
  drawSheet({
    level,
    opts: {
      sky: Object.keys(sky).length > 0 ? sky : undefined,
      runSeconds: args.sim ? botRun(level) : undefined,
    },
    name: args.out ?? `difficulty-${args.seed}`,
    title: `SEED ${args.seed}  DIFFICULTY`,
  });
}
