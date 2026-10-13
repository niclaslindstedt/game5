// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY LAB's page (driven by `scripts/sky-preview.mjs`): one seed stood
// up and drawn through the game's own renderer from ONE place, laid out as a
// labelled contact sheet, and every cell MEASURED (`sky-eval.ts`). Three
// sheets:
//
//   weathers   every weather R19 deals (rows) at every few hours (columns)
//              — the ladder judged side by side.
//   timelapse  ONE weather and ONE view, the sun swept from before sunrise
//              through the day to after sunset and into the night at a
//              fixed step of the clock (`--step`, game minutes) — the
//              sunrise, the golden hour, the sunset, the blue hour, the
//              night coming on.
//   tiers      every picture preset (rows) at a few hours (columns): what
//              LOW, MEDIUM and HIGH each draw of the same sky.
//
// The map, the day and the latitude stay the seed's; the sky moves through
// `renderer.setSky` (the engine's `withSky`): the hour and the weather. The
// sun stands still over a run today, so the time-lapse sets the hour cell
// by cell; once the clock moves the sun it walks the run's own clock
// instead.

import {
  botInput,
  createGame,
  step,
  sunAtRun,
  withSky,
  type GameState,
  type SkyOverride,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { skyLookAt } from "../game/sky.ts";
import { evalFrame, type SkyEval } from "./sky-eval.ts";

/** One row of the weathers sheet: a label, the sky it asks for, and the
 * new snow lying under it, m (`GameState.fresh`; none when left out). */
type Row = { label: string; sky: SkyOverride["weather"]; fresh?: number };

/** Every weather, lightest first, with a fall at both ends of its band. */
const ROWS: Row[] = [
  { label: "CLEAR", sky: "clear" },
  { label: "FAIR", sky: "fair" },
  { label: "FLURRIES", sky: { kind: "flurries", snowfall: 0.25 } },
  { label: "HIGH", sky: "high" },
  { label: "OVERCAST", sky: "overcast" },
  { label: "SNOW 0.4", sky: { kind: "snow", snowfall: 0.4 } },
  { label: "STORM", sky: { kind: "storm", snowfall: 0.85 } },
  { label: "BLIZZARD", sky: { kind: "storm", snowfall: 1 } },
  { label: "FOG", sky: "fog" },
  // An hour of storm lying on a fair day: the groomer buried, the trails
  // filled. Last, because a trail filled stays filled.
  { label: "FAIR +8CM", sky: "fair", fresh: 0.08 },
];

/** One measured cell. */
export type SkyCell = { id: string } & SkyEval;

declare global {
  interface Window {
    __sky?: {
      ready: Promise<void>;
      /** Draw the sheet; resolves to what it drew and every cell's numbers. */
      sheet(): Promise<{ rows: number; cols: number; note: string; cells: SkyCell[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const cellW = Number(params.get("w") ?? 320);
const cellH = Number(params.get("h") ?? 180);
const kind = params.get("sheet") ?? "weathers";
const hoursAsked = (params.get("hours") ?? "").split(",").filter(Boolean).map(Number);
const only = (params.get("weathers") ?? "").split(",").filter(Boolean);
const view = params.get("view") ?? "chase";
const stepMin = Number(params.get("step") ?? 20);
const cols = Number(params.get("cols") ?? 8);
const rows = only.length ? ROWS.filter((r) => only.includes(r.label.toLowerCase())) : ROWS;

const stage = document.getElementById("stage") as HTMLCanvasElement;
const sheet = document.getElementById("sheet") as HTMLCanvasElement;
const renderer = createWorldRenderer(stage, {
  video: withPreset(DEFAULT_VIDEO, tier),
  preserveDrawingBuffer: true,
});
renderer.resize(cellW, cellH, 1);
const state: GameState = createGame({ seed, quiet: true });
const level = state.level;

/** The sun's elevation on this map's day at `hour`, rad. */
const elevationAt = (hour: number): number => sunAtRun(withSky(level, { hour })).elevation;
/** The sun's world heading on this map's day at `hour`, rad. */
const azimuthAt = (hour: number): number => sunAtRun(withSky(level, { hour })).azimuth;

/** The hour the sun crosses the horizon on this map's day — on its way up
 * (`rising`) or down — scanned a minute at a time; noon's neighbour when it
 * never does. */
function horizonHour(rising: boolean): number {
  const from = rising ? 0 : 12;
  let was = elevationAt(from);
  for (let h = from + 1 / 60; h <= from + 12; h += 1 / 60) {
    const now = elevationAt(h);
    if (rising ? was < 0 && now >= 0 : was > 0 && now <= 0) return h;
    was = now;
  }
  return rising ? 9 : 15;
}

/** Behind the player on the grid, raised, looking down the track — the
 * ground, the woods, the sky and a skier with its lamps in one frame. */
function chase(): LensPose {
  const s = state.skier;
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  const ex = s.x - fx * 10;
  const ez = s.z - fz * 10;
  return {
    eye: { x: ex, y: Math.max(level.groundAt(ex, ez), s.y) + 3.6, z: ez },
    target: { x: s.x + fx * 30, y: s.y + 2.5, z: s.z + fz * 30 },
    fov: 68,
    roll: 0,
  };
}

/** The highest point of the summit ridge, where the far views stand. */
function ridgeTop(): { x: number; y: number; z: number } {
  const m = level.mountain;
  const sx = m ? m.summit.x : level.size / 2;
  const sz = m ? m.summit.z : level.size * 0.08;
  let best = { x: sx, z: sz, y: -Infinity };
  for (let f = -0.25; f <= 0.25; f += 0.01) {
    const x = sx + level.size * f;
    const y = level.groundAt(x, sz);
    if (y > best.y) best = { x, z: sz, y };
  }
  return best;
}

/** Over the mountain from the summit ridge, looking down to the base. */
function vista(): LensPose {
  const top = ridgeTop();
  const m = level.mountain;
  const c = m ? { x: m.base.x, z: m.base.z } : { x: level.size / 2, z: level.size * 0.92 };
  return {
    eye: { x: top.x, y: top.y + 8, z: top.z },
    target: { x: c.x, y: level.groundAt(c.x, c.z) + 30, z: c.z },
    fov: 68,
    roll: 0,
  };
}

/** From the summit ridge, a little over the horizon along world heading
 * `heading` — toward the sun where it sets (`sunset`) or straight away
 * from it (`antisun`: the Earth's shadow, the Belt of Venus, the last light
 * on the peaks). */
function bearing(heading: number): LensPose {
  const top = ridgeTop();
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  return {
    eye: { x: top.x, y: top.y + 8, z: top.z },
    target: { x: top.x + fx * 400, y: top.y - 25, z: top.z + fz * 400 },
    fov: 68,
    roll: 0,
  };
}

function lensFor(name: string): LensPose {
  if (name === "vista") return vista();
  if (name === "sunset") return bearing(azimuthAt(horizonHour(false)));
  if (name === "sunrise") return bearing(azimuthAt(horizonHour(true)));
  if (name === "antisun") return bearing(azimuthAt(horizonHour(false)) + Math.PI);
  return chase();
}

const FRAME = 1 / 60;
const fmtHour = (h: number): string => {
  const m = Math.round((((h % 24) + 24) % 24) * 60);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Draw one cell under `sky` into the sheet at (x, y) and measure it. */
async function cell(
  ctx: CanvasRenderingContext2D,
  sky: SkyOverride,
  x: number,
  y: number,
  id: string,
): Promise<SkyCell> {
  renderer.setSky(sky);
  // The mountain's shadow is baked again off the thread for a new
  // bearing of the sun: one frame to ask, then wait for it.
  renderer.draw(state, 0, FRAME, false);
  await renderer.shadeSettled();
  // A few frames unseen, so the spindrift is up and the lens settled.
  for (let i = 0; i < 20; i++) renderer.draw(state, 0, FRAME, false);
  const gl = renderer.gl.getContext();
  gl.finish();
  const t0 = performance.now();
  renderer.draw(state, 0, FRAME, true);
  gl.finish();
  const ms = performance.now() - t0;
  ctx.drawImage(stage, x, y, cellW, cellH);
  const bytes = ctx.getImageData(x, y, cellW, cellH).data;
  const look = skyLookAt(withSky(level, sky), state.t);
  // Let the page breathe between cells: a long sheet is minutes of
  // software rasterizing.
  await new Promise((done) => setTimeout(done, 0));
  return { id, ...evalFrame(look, bytes, cellW, cellH, ms) };
}

/** The sheet's frame: its size, background and title. */
function frame(w: number, h: number, title: string): CanvasRenderingContext2D {
  sheet.width = w;
  sheet.height = h;
  const ctx = sheet.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#0b1116";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#e8eef4";
  ctx.font = "12px monospace";
  ctx.textBaseline = "middle";
  const sun = level.sun;
  ctx.fillText(
    `SKY · seed ${seed} · day ${sun.dayOfYear} at ${sun.latitude.toFixed(1)}°N · ${title}`,
    8,
    10,
  );
  return ctx;
}

const labelW = 96;
const headH = 34;

async function weathers(): Promise<{ note: string; r: number; c: number; cells: SkyCell[] }> {
  const hours = hoursAsked.length ? hoursAsked : [0, 3, 6, 9, 12, 15, 18, 21];
  const ctx = frame(
    labelW + cellW * hours.length,
    headH + cellH * rows.length,
    `${view} · ${tier}`,
  );
  hours.forEach((h, c) => ctx.fillText(fmtHour(h), labelW + c * cellW + 6, 26));
  renderer.setOverride(lensFor(view));
  const cells: SkyCell[] = [];
  for (let r = 0; r < rows.length; r++) {
    ctx.fillStyle = "#e8eef4";
    ctx.fillText(rows[r].label, 8, headH + r * cellH + cellH / 2);
    state.fresh = rows[r].fresh ?? 0;
    for (let c = 0; c < hours.length; c++) {
      const id = `${rows[r].label.toLowerCase().replace(/ /g, "-")}@${fmtHour(hours[c])}`;
      cells.push(
        await cell(
          ctx,
          { weather: rows[r].sky, hour: hours[c] },
          labelW + c * cellW,
          headH + r * cellH,
          id,
        ),
      );
    }
  }
  return {
    note: `${rows.map((r) => r.label).join(", ")} × ${hours.join(", ")} h`,
    r: rows.length,
    c: hours.length,
    cells,
  };
}

async function timelapse(): Promise<{ note: string; r: number; c: number; cells: SkyCell[] }> {
  const row = rows[0];
  const rise = horizonHour(true);
  const set = horizonHour(false);
  // From an hour and a half before sunrise to two and a half after sunset.
  const hours: number[] = [];
  if (hoursAsked.length) hours.push(...hoursAsked);
  else for (let h = rise - 1.5; h <= set + 2.5 + 1e-9; h += stepMin / 60) hours.push(h);
  const r = Math.ceil(hours.length / cols);
  const ctx = frame(
    cols * cellW,
    headH + r * (cellH + 16),
    `${row.label} · ${view} · ${tier} · sunrise ${fmtHour(rise)} sunset ${fmtHour(set)} · every ${stepMin} min`,
  );
  renderer.setOverride(lensFor(view));
  state.fresh = row.fresh ?? 0;
  const cells: SkyCell[] = [];
  for (let i = 0; i < hours.length; i++) {
    const x = (i % cols) * cellW;
    const y = headH + Math.floor(i / cols) * (cellH + 16);
    const c = await cell(ctx, { weather: row.sky, hour: hours[i] }, x, y + 16, fmtHour(hours[i]));
    ctx.fillStyle = "#e8eef4";
    ctx.fillText(`${fmtHour(hours[i])}  ${c.elev.toFixed(1)}°`, x + 6, y + 8);
    cells.push(c);
  }
  return {
    note: `${row.label}, ${hours.length} frames ${fmtHour(hours[0])}–${fmtHour(hours[hours.length - 1])}`,
    r,
    c: cols,
    cells,
  };
}

async function tiers(): Promise<{ note: string; r: number; c: number; cells: SkyCell[] }> {
  const row = rows[0];
  const rise = horizonHour(true);
  const set = horizonHour(false);
  // Dawn, the golden hour, noon, the low sun, sunset, the blue hour, night.
  const hours = hoursAsked.length
    ? hoursAsked
    : [rise - 0.5, rise + 0.5, 12, set - 1, set, set + 0.5, set + 2.5];
  const ctx = frame(
    labelW + cellW * hours.length,
    headH + cellH * TIERS.length,
    `${row.label} · ${view} · every preset`,
  );
  hours.forEach((h, c) => ctx.fillText(fmtHour(h), labelW + c * cellW + 6, 26));
  renderer.setOverride(lensFor(view));
  state.fresh = row.fresh ?? 0;
  const cells: SkyCell[] = [];
  for (let t = 0; t < TIERS.length; t++) {
    renderer.setVideo(withPreset(DEFAULT_VIDEO, TIERS[t]));
    ctx.fillStyle = "#e8eef4";
    ctx.fillText(TIERS[t].toUpperCase(), 8, headH + t * cellH + cellH / 2);
    for (let c = 0; c < hours.length; c++) {
      const id = `${TIERS[t]}@${fmtHour(hours[c])}`;
      cells.push(
        await cell(
          ctx,
          { weather: row.sky, hour: hours[c] },
          labelW + c * cellW,
          headH + t * cellH,
          id,
        ),
      );
    }
  }
  renderer.setVideo(withPreset(DEFAULT_VIDEO, tier));
  return {
    note: `${TIERS.join(", ")} × ${hours.length} hours`,
    r: TIERS.length,
    c: hours.length,
    cells,
  };
}

window.__sky = {
  ready: (async () => {
    await renderer.load(state);
    // Onto the grid and a moment into the lights, so the field is standing.
    for (let i = 0; i < 180; i++) step(state, botInput(state));
    renderer.setCamera("chase", true);
  })(),
  async sheet() {
    const done =
      kind === "timelapse"
        ? await timelapse()
        : kind === "tiers"
          ? await tiers()
          : await weathers();
    renderer.setSky(null);
    renderer.setOverride(null);
    return { rows: done.r, cols: done.c, note: done.note, cells: done.cells };
  },
};
