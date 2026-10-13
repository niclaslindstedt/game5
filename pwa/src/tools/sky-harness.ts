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
//              night coming on. With `clock` it is the RUN'S OWN CLOCK
//              that moves the sun (`sky-clock.ts`): the sky stood at the
//              first hour once, then `state.t` walked on a few run seconds
//              a frame at the game's rate (or `rate`), every frame between
//              two cells drawn — the mountain's shadow baked ahead and
//              blended as in a run, never re-cut cell by cell.
//   tiers      every picture preset (rows) at a few hours (columns): what
//              LOW, MEDIUM and HIGH each draw of the same sky.
//   skytier    the SKY's own tiers alone (rows; `sky-gpu.ts`'s
//              `forceSkyTier`, the rest of the picture the asked preset's)
//              at dawn, noon, a low sun, sunset, the anti-solar sky and the
//              blue hour, each cell's difference from the LOW cell over it
//              in ΔE, a last row the HIGH − LOW difference ×4; and the GPU
//              passes timed (the tables once, a sky-view at each tier, the
//              aerial-perspective volume).
//   far        THE FAR RANGES (`far-ranges.ts`): a map a row (`maps`: a
//              region's dealt country, or `face:<id>` a real face's) at
//              dawn, noon, a low sun, sunset and dusk, each from its own
//              view; every cell drawn with the ranges and timed without
//              them, and each row's rings built and counted at every tier.
//   moon       THE MOON through the year (`sky-night-sheet.ts`): a
//              lunation on a long lens, the perigee's and apogee's full
//              moons at one zoom, the full moon rising, and the snow and
//              the sky under a full, a quarter and no moon.
//
// Any sheet with `far=0` draws without the far ranges (the before).
//
// The map, the day and the latitude stay the seed's; the sky moves through
// `renderer.setSky` (the engine's `withSky`): the hour and the weather.
// The page holds the sky's clock still (its default) except in the clock
// time-lapse.

import {
  SKY_CLOCK,
  botInput,
  createGame,
  isRegionId,
  loadRealFace,
  step,
  sunAtRun,
  withSky,
  type GameState,
  type RegionId,
  type SkyOverride,
} from "@engine";

import * as THREE from "three";

import type { LensPose } from "../game/camera-rigs.ts";
import { createFarRanges, forceFar } from "../game/far-ranges.ts";
import { farFaceGrid } from "../game/far-faces.ts";
import { FAR_RINGS } from "../game/far-ranges-plan.ts";
import { createHazeUniforms } from "../game/haze.ts";
import { volumeNoise } from "../game/cloud-volume.ts";
import { timeClouds } from "./sky-cloud-cost.ts";
import { lowdeckSheet } from "./sky-deck-sheet.ts";
import { moonSheet } from "./sky-night-sheet.ts";
import { createWorldRenderer } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { skyLookAt } from "../game/sky.ts";
import { createSkyGpu, forceSkyTier } from "../game/sky-gpu.ts";
import { setSkyClock, skyHourNow } from "../game/sky-clock.ts";
import {
  cloudlapseSheet,
  cloudsSheet,
  cloudshadowSheet,
  cloudmotionSheet,
  suncloudsSheet,
  type CloudSheetHost,
} from "./sky-cloud-sheets.ts";
import { evalFrame, frameDiff, type CloudEval, type FrameDiff, type SkyEval } from "./sky-eval.ts";

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

/** One measured cell — on the sky-tier sheet with its difference from the
 * LOW sky's cell over it. */
export type SkyCell = { id: string } & SkyEval & Partial<FrameDiff> & Partial<CloudEval>;

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
/** The time-lapse walks the run's own clock at this rate (0: hour by hour). */
const clockRate =
  params.get("clock") === "1" ? Number(params.get("rate") ?? SKY_CLOCK.rate) || SKY_CLOCK.rate : 0;
/** The most run seconds a frame between two clock cells moves the clock. */
const CLOCK_TICK = 2;
const rows = only.length ? ROWS.filter((r) => only.includes(r.label.toLowerCase())) : ROWS;

const stage = document.getElementById("stage") as HTMLCanvasElement;
const sheet = document.getElementById("sheet") as HTMLCanvasElement;
const renderer = createWorldRenderer(stage, {
  video: withPreset(DEFAULT_VIDEO, tier),
  preserveDrawingBuffer: true,
});
renderer.resize(cellW, cellH, 1);
let state: GameState = createGame({ seed, quiet: true });
let level = state.level;
if (params.get("far") === "0") forceFar(false);
/** The far sheet's maps: a region, or `face:<id>`. */
const maps = (params.get("maps") ?? "alpine,fell,continental,maritime,face:alpine-1")
  .split(",")
  .filter(Boolean);

/** Stand the lab on another map: a region's at the seed, or a real face. */
async function standOnMap(name: string): Promise<void> {
  const face = name.startsWith("face:") ? name.slice(5) : undefined;
  const region = !face && isRegionId(name) ? (name as RegionId) : undefined;
  if (face && !(await loadRealFace(face))) throw new Error(`no real face ${face}`);
  state = createGame({
    seed,
    quiet: true,
    ...(region ? { region } : {}),
    ...(face ? { face } : {}),
  });
  level = state.level;
  await renderer.load(state);
  // HIGH's cloud volume draws the slab until its noise lands: wait for it.
  await volumeNoise();
  for (let i = 0; i < 180; i++) step(state, botInput(state));
  renderer.setCamera("chase", true);
}

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

/** From the valley floor at the map's foot, looking out along the valley
 * (+x) a little over the level — the ranges across and along it. */
function valley(): LensPose {
  const m = level.mountain;
  const z = m ? m.base.z : level.size * 0.92;
  const x = level.size * 0.06;
  const y = level.groundAt(x, z);
  return {
    eye: { x, y: y + 40, z },
    target: { x: x - 400, y: y + 70, z: z + 60 },
    fov: 68,
    roll: 0,
  };
}

/** From the summit ridge along it (+x), level — the ranges behind and
 * across. */
function ridge(): LensPose {
  const top = ridgeTop();
  return {
    eye: { x: top.x, y: top.y + 8, z: top.z },
    target: { x: top.x + 400, y: top.y - 4, z: top.z - 150 },
    fov: 68,
    roll: 0,
  };
}

function lensFor(name: string): LensPose {
  if (name === "vista") return vista();
  if (name === "valley") return valley();
  if (name === "ridge") return ridge();
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

/** Stand the sky at `sky` and let the scene settle under it. */
async function standSky(sky: SkyOverride): Promise<void> {
  renderer.setSky(sky);
  // The mountain's shadow is baked again off the thread for a new
  // bearing of the sun: one frame to ask, then wait for it.
  renderer.draw(state, 0, FRAME, false);
  await renderer.shadeSettled();
  // A few frames unseen, so the spindrift is up and the lens settled.
  for (let i = 0; i < 20; i++) renderer.draw(state, 0, FRAME, false);
}

/** Draw one cell under `sky` into the sheet at (x, y) and measure it — or,
 * `sky` null, under the sky the clock has walked to. */
async function cell(
  ctx: CanvasRenderingContext2D,
  sky: SkyOverride | null,
  x: number,
  y: number,
  id: string,
  under: SkyOverride = sky ?? {},
): Promise<SkyCell> {
  if (sky !== null) await standSky(sky);
  else {
    // The clock's own walk: a bake still in flight lands before the cell is
    // measured, as it would a few frames on in a run.
    await renderer.shadeSettled();
    renderer.draw(state, 0, FRAME, false);
  }
  const gl = renderer.gl.getContext();
  gl.finish();
  const t0 = performance.now();
  renderer.draw(state, 0, FRAME, true);
  gl.finish();
  const ms = performance.now() - t0;
  ctx.drawImage(stage, x, y, cellW, cellH);
  const bytes = ctx.getImageData(x, y, cellW, cellH).data;
  const look = skyLookAt(withSky(level, under), state.t);
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
    `${row.label} · ${view} · ${tier} · sunrise ${fmtHour(rise)} sunset ${fmtHour(set)} · every ${stepMin} min` +
      (clockRate > 0 ? ` · the run's clock ×${clockRate}` : ""),
  );
  renderer.setOverride(lensFor(view));
  state.fresh = row.fresh ?? 0;
  const cells: SkyCell[] = [];
  // THE RUN'S CLOCK: the sky stood at the first hour at run time `t0`, then
  // walked on with `state.t` (`clockRate`).
  const start = { weather: row.sky, hour: hours[0] };
  const t0 = state.t;
  if (clockRate > 0) {
    setSkyClock(clockRate);
    await standSky(start);
  }
  for (let i = 0; i < hours.length; i++) {
    const x = (i % cols) * cellW;
    const y = headH + Math.floor(i / cols) * (cellH + 16);
    if (clockRate > 0) {
      const due = t0 + ((hours[i] - hours[0]) * 3600) / clockRate;
      while (state.t < due) {
        state.t = Math.min(due, state.t + CLOCK_TICK);
        renderer.draw(state, 0, FRAME, false);
        // Let the worker's bakes land as a run's would, a frame at a time.
        await new Promise((done) => setTimeout(done, 0));
      }
    }
    const at = clockRate > 0 ? skyHourNow(withSky(level, start), state.t) : hours[i];
    const c = await cell(
      ctx,
      clockRate > 0 ? null : { weather: row.sky, hour: hours[i] },
      x,
      y + 16,
      fmtHour(at),
      clockRate > 0 ? start : undefined,
    );
    ctx.fillStyle = "#e8eef4";
    ctx.fillText(`${fmtHour(at)}  ${c.elev.toFixed(1)}°`, x + 6, y + 8);
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

/** The GPU sky's passes timed on this context, ms each (software GL here:
 * comparable only with itself). */
function timePasses(): string {
  forceSkyTier(null);
  const gl = renderer.gl;
  const ctx = gl.getContext();
  const sky = createSkyGpu(gl, createHazeUniforms());
  sky.setGround(level.ground);
  const lens = new THREE.PerspectiveCamera(68, cellW / cellH, 0.5, 60000);
  const top = ridgeTop();
  lens.position.set(top.x, top.y + 8, top.z);
  lens.lookAt(top.x + 400, top.y - 25, top.z);
  const look = skyLookAt(withSky(level, { weather: "clear", hour: horizonHour(false) - 1 }), 0);
  const timed = (n: number, body: (i: number) => void): number => {
    ctx.finish();
    const t0 = performance.now();
    for (let i = 0; i < n; i++) body(i);
    ctx.finish();
    return (performance.now() - t0) / n;
  };
  const e0 = look.elevation;
  const jiggle = (i: number): void => {
    look.elevation = e0 + (i % 2 ? 3e-4 : -3e-4);
    sky.update(look, lens);
  };
  sky.setTier("medium");
  const first = timed(1, () => sky.update(look, lens));
  const mediumView = timed(8, jiggle);
  sky.setTier("high");
  look.sun.y = -1; // the volume off: the sky-view alone
  const highView = timed(6, jiggle);
  look.sun.y = Math.sin(e0);
  look.elevation = e0;
  sky.update(look, lens);
  const froxels = timed(8, () => sky.update(look, lens));
  sky.dispose();
  const r = (x: number): string => x.toFixed(1);
  return `tables+first ${r(first)} ms · sky-view MEDIUM ${r(mediumView)} ms · HIGH ${r(highView)} ms · froxels ${r(froxels)} ms`;
}

async function skytier(): Promise<{ note: string; r: number; c: number; cells: SkyCell[] }> {
  const row = rows[0];
  const rise = horizonHour(true);
  const set = horizonHour(false);
  const shots = [
    { label: "dawn", hour: rise + 0.3, view: "sunrise" },
    { label: "noon", hour: 12, view: "ridge" },
    { label: "low sun", hour: set - 1, view: "sunset" },
    { label: "sunset", hour: set, view: "sunset" },
    { label: "antisun", hour: set + 0.15, view: "antisun" },
    { label: "blue hour", hour: set + 0.5, view: "antisun" },
  ];
  const sheetRows = TIERS.length + 1;
  const ctx = frame(
    labelW + cellW * shots.length,
    headH + cellH * sheetRows,
    `${row.label} · the sky's tiers · the rest ${tier}`,
  );
  shots.forEach((s, c) =>
    ctx.fillText(`${s.label} ${fmtHour(s.hour)}`, labelW + c * cellW + 6, 26),
  );
  state.fresh = row.fresh ?? 0;
  const cells: SkyCell[] = [];
  const low: Uint8ClampedArray[] = [];
  for (let t = 0; t < TIERS.length; t++) {
    forceSkyTier(TIERS[t]);
    ctx.fillStyle = "#e8eef4";
    ctx.fillText(`SKY ${TIERS[t].toUpperCase()}`, 8, headH + t * cellH + cellH / 2);
    for (let c = 0; c < shots.length; c++) {
      renderer.setOverride(lensFor(shots[c].view));
      const x = labelW + c * cellW;
      const y = headH + t * cellH;
      const id = `${TIERS[t]}@${shots[c].label.replace(/ /g, "-")}`;
      const got = await cell(ctx, { weather: row.sky, hour: shots[c].hour }, x, y, id);
      const bytes = ctx.getImageData(x, y, cellW, cellH).data;
      if (t === 0) low[c] = bytes;
      else {
        Object.assign(got, frameDiff(low[c], bytes, cellW, cellH));
        if (t === TIERS.length - 1) {
          // THE DIFFERENCE, ×4 about mid-grey.
          const img = ctx.createImageData(cellW, cellH);
          for (let i = 0; i < bytes.length; i += 4) {
            for (let k = 0; k < 3; k++)
              img.data[i + k] = Math.max(
                0,
                Math.min(255, 128 + 4 * (bytes[i + k] - low[c][i + k])),
              );
            img.data[i + 3] = 255;
          }
          ctx.putImageData(img, x, headH + TIERS.length * cellH);
        }
        ctx.fillStyle = "#0b1116";
        ctx.fillRect(x + 2, y + cellH - 16, 132, 14);
        ctx.fillStyle = "#e8eef4";
        ctx.fillText(`ΔE ${got.dE} sky ${got.dSky} p95 ${got.dE95}`, x + 6, y + cellH - 9);
      }
      cells.push(got);
    }
  }
  ctx.fillStyle = "#e8eef4";
  ctx.fillText("HIGH−LOW ×4", 8, headH + TIERS.length * cellH + cellH / 2);
  forceSkyTier(null);
  renderer.setVideo(withPreset(DEFAULT_VIDEO, tier));
  const cost = timePasses();
  ctx.fillText(cost, 420, 10);
  return {
    note: `${TIERS.join(", ")} skies × ${shots.length} · ${cost}`,
    r: sheetRows,
    c: shots.length,
    cells,
  };
}

/** THE FAR RANGES' SHEET: a map a row, five moments, each cell timed with
 * the ranges and without; every row's build timed and counted by tier. */
async function far(): Promise<{ note: string; r: number; c: number; cells: SkyCell[] }> {
  const shots = (rise: number, set: number) => [
    { label: "dawn", hour: rise + 0.3, view: "sunrise" },
    { label: "noon", hour: 12, view: "vista" },
    { label: "valley", hour: 13, view: "valley" },
    { label: "sunset", hour: set - 0.05, view: "sunset" },
    { label: "dusk", hour: set + 0.2, view: "antisun" },
  ];
  const ctx = frame(
    labelW + cellW * 5,
    headH + (cellH + 16) * maps.length,
    `THE FAR RANGES · ${tier}`,
  );
  ["dawn", "noon (along the ridge)", "valley 13:00", "sunset", "dusk (away)"].forEach((l, c) =>
    ctx.fillText(l, labelW + c * cellW + 6, 26),
  );
  const cells: SkyCell[] = [];
  const notes: string[] = [];
  for (let r = 0; r < maps.length; r++) {
    await standOnMap(maps[r]);
    const y = headH + r * (cellH + 16);
    // The rings built apart from the picture, timed and counted per tier.
    const counts = TIERS.map((t) => {
      const ranges = createFarRanges(createHazeUniforms());
      ranges.setTier(t);
      return { t, ranges };
    });
    const grid = await farFaceGrid(level);
    const key = skyLookAt(level, 0).key;
    const built = counts.map(({ t, ranges }) => {
      const t0 = performance.now();
      ranges.setLevel(level, key, grid);
      const ms = performance.now() - t0;
      const { triangles } = ranges.stats();
      ranges.dispose();
      return `${t[0].toUpperCase()} ${(triangles / 1000).toFixed(1)}k ${ms.toFixed(0)}ms`;
    });
    const name = maps[r].toUpperCase();
    ctx.fillStyle = "#e8eef4";
    ctx.fillText(name, 8, y + 16 + cellH / 2);
    ctx.fillText(
      `${grid ? "real country" : "dealt"} · tris/build ${built.join(" · ")} · rings ${FAR_RINGS[tier].bearings}×${FAR_RINGS[tier].rows}`,
      labelW + 6,
      y + 8,
    );
    notes.push(`${name}: ${built.join(", ")}`);
    const list = shots(horizonHour(true), horizonHour(false));
    for (let c = 0; c < list.length; c++) {
      renderer.setOverride(lensFor(list[c].view));
      const x = labelW + c * cellW;
      const sky = { weather: "clear" as const, hour: list[c].hour };
      const got = await cell(ctx, sky, x, y + 16, `${maps[r]}@${list[c].label.replace(/ /g, "-")}`);
      // The same frame without the ranges, timed.
      forceFar(false);
      renderer.draw(state, 0, FRAME, false);
      const gl = renderer.gl.getContext();
      gl.finish();
      const t0 = performance.now();
      renderer.draw(state, 0, FRAME, true);
      gl.finish();
      const off = performance.now() - t0;
      forceFar(null);
      ctx.fillStyle = "#0b1116";
      ctx.fillRect(x + 2, y + 16 + cellH - 16, 150, 14);
      ctx.fillStyle = "#e8eef4";
      ctx.fillText(
        `${fmtHour(list[c].hour)} ${got.ms.toFixed(0)} ms (off ${off.toFixed(0)})`,
        x + 6,
        y + 16 + cellH - 9,
      );
      cells.push({ ...got, msOff: Math.round(off * 10) / 10 } as SkyCell);
    }
  }
  return { note: notes.join(" | "), r: maps.length, c: 5, cells };
}

/** What the cloud sheets (`sky-cloud-sheets.ts`) are lent. */
const host: CloudSheetHost = {
  level: () => level,
  state: () => state,
  setT: (t) => void (state.t = t),
  cellW,
  cellH,
  stepMin,
  rate: Number(params.get("rate") ?? SKY_CLOCK.rate) || SKY_CLOCK.rate,
  cols,
  only,
  hoursAsked,
  frame,
  cell,
  standSky,
  tick: () => renderer.draw(state, 0, FRAME, false),
  grab() {
    const gl = renderer.gl.getContext();
    renderer.draw(state, 0, FRAME, true);
    gl.finish();
    const c = document.createElement("canvas");
    c.width = cellW;
    c.height = cellH;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(stage, 0, 0, cellW, cellH);
    return g.getImageData(0, 0, cellW, cellH).data;
  },
  setOverride: (v) => renderer.setOverride(v),
  timeClouds: () =>
    timeClouds(renderer.gl, level, ridgeTop(), [
      [cellW, cellH],
      [1280, 720],
    ]),
  ridgeTop,
  horizonHour,
  fmtHour,
};

/** Every sheet by its name; the weathers sheet is the default. */
const SHEETS: Record<
  string,
  () => Promise<{ note: string; r: number; c: number; cells: SkyCell[] }>
> = {
  timelapse,
  tiers,
  skytier,
  far,
  clouds: () => cloudsSheet(host),
  cloudlapse: () => cloudlapseSheet(host),
  sunclouds: () => suncloudsSheet(host),
  cloudshadow: () => cloudshadowSheet(host),
  cloudmotion: () => cloudmotionSheet(host),
  lowdeck: () => lowdeckSheet(host),
  moon: () => moonSheet(host),
};

window.__sky = {
  ready: (async () => {
    await renderer.load(state);
    await volumeNoise();
    // Onto the grid and a moment into the lights, so the field is standing.
    for (let i = 0; i < 180; i++) step(state, botInput(state));
    renderer.setCamera("chase", true);
  })(),
  async sheet() {
    const done = await (SHEETS[kind] ?? weathers)();
    renderer.setSky(null);
    renderer.setOverride(null);
    return { rows: done.r, cols: done.c, note: done.note, cells: done.cells };
  },
};
