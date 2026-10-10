// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WATER LAB's page (`scripts/water-preview.mjs`): the lakes and the
// streams (`water-view.ts`, `water-glsl.ts`, decided by `water-plan.ts`
// off `lake-ice.ts`) through the game's OWN renderer, on a map with the
// lab's placeholder water laid on it (`water-placeholder.ts`) until a real
// face's own comes in:
//
//   * SEASONS — the valley lake and the tarn on the free ride's four
//     season stops and on two days past them (the ice going out, open);
//   * STATES — open water still and in a wind, the shore ice reaching out,
//     new black ice, the snow on it scoured by the wind, rotten ice with
//     its moat and its pools, each found by the real height its climate
//     gives that state on the day;
//   * LIGHT — open water under a low sun, at noon, under a lid and at night;
//   * GAME — the valley from the air, a skier coming down to the shore on
//     the chase, the tarn and its stream from above;
//   * COST — open water at its dearest (in a wind, the whole lake in the
//     frame) drawn with the water and without it, frames interleaved and
//     each finished on the GPU, the median of each written on the frame.
//
// It exposes `window.__water.sheet(group, views)`, which shoots the views of
// one group, lays them out as a contact sheet and hands back every frame.

import {
  createGame,
  generateLevel,
  placeRun,
  waterOn,
  withDay,
  type GameState,
  type Level,
  type RegionId,
  type WaterBody,
  type WaterState,
  type WeatherKind,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { ringMiddle } from "../game/water-plan.ts";
import { withPlaceholderWater } from "./water-placeholder.ts";

type Frame = { view: string; label: string; caption: string; png: string };

const GROUPS = {
  seasons: ["early", "mid", "late", "spring", "thaw", "summer"],
  states: ["open-calm", "open-wind", "forming", "black", "scoured", "rotten"],
  light: ["low-sun", "noon", "overcast", "night"],
  game: ["aerial", "chase", "tarn-air"],
  cost: ["cost-across", "cost-down", "cost-air"],
} as const;

declare global {
  interface Window {
    __water?: {
      ready: Promise<string>;
      groups: Record<string, readonly string[]>;
      sheet(group: string, views: string[]): Promise<{ frames: Frame[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const face = params.get("face") || undefined;
const region = (params.get("region") || undefined) as RegionId | undefined;
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);
const cols = Number(params.get("cols") ?? 3);
const scale = Number(params.get("scale") ?? 0.5);
const hour = params.get("hour") !== null ? Number(params.get("hour")) : 11;
const size = Number(params.get("size") ?? 1);

const canvas = document.getElementById("stage") as HTMLCanvasElement;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
const sheetEl = document.getElementById("sheet") as HTMLDivElement;

await loadModels();
const renderer = createWorldRenderer(canvas, {
  video: withPreset(DEFAULT_VIDEO, tier),
  preserveDrawingBuffer: true,
});
renderer.resize(width, height, 1);

const placed = withPlaceholderWater(generateLevel(seed, { region, face }), size);
const base = placed.level;
const valley = placed.valley;
const STILL = 1e-4;

/** A map on `day` (a count off 1 January), its valley lake's real height
 * moved to `real` m when given (what puts it in another state that day). */
function mapOn(day: number, real?: number): Level {
  const lv = withDay(base, { dayOfYear: day, hour });
  if (real === undefined) return lv;
  const water = (lv.water ?? []).map((b): WaterBody =>
    b === valley ? { ...b, realLevel: real } : b,
  );
  return { ...lv, water };
}

/** The real height that puts the valley lake in `want` on `day`. */
function realFor(day: number, want: (s: WaterState) => boolean): number | undefined {
  const lv = withDay(base, { dayOfYear: day });
  for (let h = -200; h < 3500; h += 20) {
    const s = waterOn(day, lv.sun.latitude, h, valley.area, false, lv.region ?? "alpine");
    if (want(s)) return h;
  }
  return undefined;
}

let state: GameState | null = null;
let level: Level = base;
async function stand(lv: Level, weather: WeatherKind = "clear", at = hour): Promise<GameState> {
  level = lv;
  state = createGame({ level: lv, seed, region, mode: "free", crowd: 0, quiet: true });
  await renderer.load(state);
  renderer.setSky({ hour: at, weather });
  renderer.draw(state, 1, 1 / 60);
  await renderer.shadeSettled();
  return state;
}

let frames: Frame[] = [];
let view = "";
let note = "";

function shoot(label: string, lens: LensPose | "chase"): void {
  if (!state) return;
  if (lens === "chase") {
    if (renderer.camera() !== "chase") renderer.setCamera("chase", true);
    renderer.setOverride(null);
  } else renderer.setOverride(lens);
  // A second's waves: the clock run on so the surface is not at t = 0.
  state.t = Math.max(state.t, 7.3);
  renderer.draw(state, 1, STILL, true);
  renderer.setOverride(null);
  const v = (level.water ?? []).find((b) => b.rings === valley.rings) ?? valley;
  const s = waterOn(
    level.sun.dayOfYear,
    level.sun.latitude,
    v.realLevel ?? v.y,
    v.area,
    false,
    level.region ?? "alpine",
  );
  frames.push({
    view,
    label,
    caption: `${view} ${label}\nday ${level.sun.dayOfYear} — valley ${Math.round(v.realLevel ?? v.y)} m: ${s.phase} ice ${Math.round(s.ice * 100)} cm snow ${s.snow.toFixed(2)} rot ${s.rot.toFixed(2)}${note}`,
    png: canvas.toDataURL("image/png"),
  });
}

/** A lens on a lake's shore: from its downhill shore across it toward the
 * mountain, `up` m over the snow, `back` m off the water. */
function acrossLake(body: WaterBody, up = 3, back = 4, fov = 55): LensPose {
  const r = body.rings[0];
  const mid = ringMiddle(r);
  let sx = r[0];
  let sz = r[1];
  for (let i = 0; i < r.length; i += 2) {
    if (r[i + 1] > sz) {
      sx = r[i];
      sz = r[i + 1];
    }
  }
  const ex = sx;
  const ez = Math.min(level.size - 5, sz + back);
  return {
    eye: { x: ex, y: level.groundAt(ex, ez) + up, z: ez },
    target: { x: mid.x, y: body.y + up * 0.6, z: mid.z - 200 },
    fov,
    roll: 0,
  };
}

/** A lens looking down onto the water near the downhill shore. */
function downOn(body: WaterBody, out: number, up: number): LensPose {
  const r = body.rings[0];
  const mid = ringMiddle(r);
  let sx = r[0];
  let sz = r[1];
  for (let i = 0; i < r.length; i += 2) {
    if (r[i + 1] > sz) {
      sx = r[i];
      sz = r[i + 1];
    }
  }
  const ez = Math.min(level.size - 5, sz + 10);
  return {
    eye: { x: sx, y: body.y + up, z: ez },
    target: { x: sx + (mid.x - sx) * 0.1, y: body.y, z: sz - out },
    fov: 50,
    roll: 0,
  };
}

/** A lens high over a lake, `dist` m off its middle toward the valley. */
function overLake(body: WaterBody, dist: number, up: number, fov = 50): LensPose {
  const mid = ringMiddle(body.rings[0]);
  const ex = mid.x + dist * 0.35;
  const ez = mid.z + dist;
  return {
    eye: { x: ex, y: Math.max(level.groundAt(ex, ez), body.y) + up, z: ez },
    target: { x: mid.x, y: body.y, z: mid.z },
    fov,
    roll: 0,
  };
}

const SEASON_DAYS: Record<string, number> = {
  early: -16,
  mid: 20,
  late: 56,
  spring: 91,
  thaw: 125,
  summer: 160,
};

async function season(day: number): Promise<void> {
  await stand(mapOn(day));
  shoot("valley", acrossLake(valley));
  if (placed.tarn) shoot("tarn", overLake(placed.tarn, 160, 70, 45));
}

async function forced(
  day: number,
  label: string,
  want: (s: WaterState) => boolean,
  weather?: WeatherKind,
) {
  const real = realFor(day, want);
  note = real === undefined ? " (no height gives it)" : "";
  await stand(mapOn(day, real), weather);
  shoot(label, acrossLake(valley));
  shoot(`${label}-down`, downOn(valley, 40, 25));
  note = "";
}

/** The median of a frame drawn through `lens`, ms, finished on the GPU. */
function frameMs(lens: LensPose, n: number, shown: boolean): number[] {
  if (!state) return [];
  const gl = canvas.getContext("webgl2") as WebGL2RenderingContext;
  renderer.setHidden(shown ? [] : ["water"]);
  renderer.setOverride(lens);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    state.t += 1 / 60;
    const t0 = performance.now();
    renderer.draw(state, 1, STILL);
    gl.finish();
    out.push(performance.now() - t0);
  }
  renderer.setOverride(null);
  renderer.setHidden([]);
  return out;
}

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[xs.length >> 1] ?? 0;

/** Open water in a wind through `lens`, with and without the water. */
async function cost(label: string, lens: () => LensPose): Promise<void> {
  const real = realFor(56, (s) => s.phase === "open");
  await stand(mapOn(56, real), "overcast");
  const l = lens();
  frameMs(l, 3, true);
  const on: number[] = [];
  const off: number[] = [];
  for (let k = 0; k < 4; k++) {
    on.push(...frameMs(l, 5, true));
    off.push(...frameMs(l, 5, false));
  }
  const a = median(on);
  const b = median(off);
  note = `\nwater ${a.toFixed(2)} ms, without ${b.toFixed(2)} ms: +${(a - b).toFixed(2)} ms (${(((a - b) / b) * 100).toFixed(1)}%)`;
  shoot(label, l);
  note = "";
}

const VIEWS: Record<string, () => Promise<void>> = {
  "cost-across": () => cost("across", () => acrossLake(valley)),
  "cost-down": () => cost("down", () => downOn(valley, 40, 25)),
  "cost-air": () => cost("air", () => overLake(valley, 700, 260, 50)),
  ...Object.fromEntries(Object.entries(SEASON_DAYS).map(([k, d]) => [k, () => season(d)] as const)),
  "open-calm": () => forced(56, "open", (s) => s.phase === "open"),
  "open-wind": () => forced(56, "open", (s) => s.phase === "open", "overcast"),
  forming: () => forced(-16, "rim", (s) => s.phase === "forming" && s.rim > 20),
  black: () => forced(-16, "black", (s) => s.phase === "frozen" && s.age < 4),
  scoured: () => forced(-10, "dusted", (s) => s.phase === "frozen" && s.snow > 0.3 && s.snow < 0.9),
  rotten: () => forced(125, "rotten", (s) => s.phase === "thawing" && s.moat > 10),
  "low-sun": async () => {
    const real = realFor(56, (s) => s.phase === "open");
    await stand(mapOn(56, real), "clear", 8.5);
    shoot("8.5h", acrossLake(valley));
  },
  noon: async () => {
    const real = realFor(56, (s) => s.phase === "open");
    await stand(mapOn(56, real), "clear", 12.5);
    shoot("12.5h", acrossLake(valley));
  },
  overcast: async () => {
    const real = realFor(56, (s) => s.phase === "open");
    await stand(mapOn(56, real), "overcast", 12);
    shoot("lid", acrossLake(valley));
  },
  night: async () => {
    const real = realFor(56, (s) => s.phase === "open");
    await stand(mapOn(56, real), "clear", 21);
    shoot("21h", acrossLake(valley));
  },
  aerial: async () => {
    await stand(mapOn(SEASON_DAYS.spring));
    shoot("valley", overLake(valley, 700, 260, 50));
    const real = realFor(91, (s) => s.phase === "open");
    await stand(mapOn(91, real));
    shoot("valley-open", overLake(valley, 700, 260, 50));
  },
  chase: async () => {
    const real = realFor(91, (s) => s.phase === "thawing" && s.moat > 6);
    const s = await stand(mapOn(91, real));
    const mid = ringMiddle(valley.rings[0]);
    placeRun(s, { x: mid.x, z: mid.z - 260 * size, heading: 0, speed: 0 });
    renderer.draw(s, 1, 1 / 60);
    shoot("shore", "chase");
  },
  "tarn-air": async () => {
    if (!placed.tarn) return;
    await stand(mapOn(SEASON_DAYS.thaw));
    shoot("thaw", overLake(placed.tarn, 260, 140, 50));
  },
};

const ready = (async () => {
  await stand(mapOn(SEASON_DAYS.mid));
  const lv = level;
  return `${face ?? `seed ${seed}`} ${lv.region ?? "alpine"} lat ${lv.sun.latitude.toFixed(1)} — valley ${Math.round(valley.area / 1e4)} ha at ${Math.round(valley.realLevel ?? 0)} m${placed.tarn ? `, tarn at ${Math.round(placed.tarn.realLevel ?? 0)} m` : ""}${placed.stream ? `, stream ${placed.stream.line.length / 2} pts` : ""}`;
})();

async function sheet(group: string, views: string[]): Promise<{ frames: Frame[] }> {
  const head = await ready;
  frames = [];
  for (const v of views) {
    const scene = VIEWS[v];
    if (!scene) throw new Error(`no view "${v}"`);
    view = v;
    await scene();
  }
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent = `WATER — ${group} — ${tier}\n${head}`;
  header.style.whiteSpace = "pre-wrap";
  const cells: HTMLElement[] = [header];
  for (const f of frames) {
    const cell = document.createElement("figure");
    const img = document.createElement("img");
    img.src = f.png;
    img.width = tw;
    img.height = th;
    await img.decode();
    const caption = document.createElement("figcaption");
    caption.textContent = f.caption;
    cell.append(img, caption);
    cells.push(cell);
  }
  sheetEl.replaceChildren(...cells);
  return { frames };
}

window.__water = { ready, groups: GROUPS, sheet };
