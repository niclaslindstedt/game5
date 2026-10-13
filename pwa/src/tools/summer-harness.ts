// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMER LAB's page (`scripts/summer-preview.mjs`): a free ride's
// mountain in MIDSUMMER (`summer.ts`, `summer-ground.ts`, drawn by
// `summer-glsl.ts`, `summer-grass.ts`) through the game's OWN renderer, at
// named views found off the summer ground itself, at each hour asked:
//
//   meadow   eye height over open grass below the tree line, down the slope
//   grass    a hand's breadth over the meadow: the tufts, the flowers
//   piste    down a ski run in summer: the grass corridor and its scars
//   vista    from high on the face across and down to the valley
//   lift     up a lift's line from beside its foot
//   village  over the village on the valley floor
//   turf     above the tree line, up at the summit's turf, scree and rock
//   patch    a snow patch left lying in July, from forty metres off
//
// With `winter=1` the same views are drawn on the same map in its own
// winter — the before beside the after. It exposes
// `window.__summer.sheet(views)`, which shoots the views, lays them out as a
// contact sheet for the driver to photograph, and hands back every frame.

import {
  createGame,
  generateLevel,
  NEUTRAL_INPUT,
  placeRun,
  step,
  summerGroundAt,
  treeLineY,
  TUNING,
  type GameState,
  type Level,
  type RegionId,
  type SummerKind,
  type WeatherKind,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";

type Frame = { view: string; label: string; caption: string; png: string };

declare global {
  interface Window {
    __summer?: {
      ready: Promise<string>;
      views: readonly string[];
      sheet(views: string[]): Promise<{ frames: Frame[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const region = (params.get("region") || undefined) as RegionId | undefined;
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);
const cols = Number(params.get("cols") ?? 4);
const scale = Number(params.get("scale") ?? 0.5);
const weather = (params.get("weather") || "fair") as WeatherKind;
const winter = params.get("winter") === "1";
const hours = (params.get("hours") || "10,17.5").split(",").map(Number);
const SUMMER_DAY = 196;

const SPOTS = ["meadow", "grass", "piste", "vista", "lift", "village", "turf", "patch"] as const;
type SpotId = (typeof SPOTS)[number];
const VIEWS = hours.flatMap((h) => SPOTS.map((s) => `${s}-${h}`));

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

const level = generateLevel(seed, { region });
const g = level.groundAt;
const size = level.size;
const line = treeLineY(level);
const top = level.mountain?.summit.y ?? line + 400;
const base = level.mountain?.base.y ?? 0;

/** The fall line at a point, off the ground's own slope. */
function fallAt(x: number, z: number): { x: number; z: number; slope: number } {
  const e = 3;
  const gx = (g(x + e, z) - g(x - e, z)) / (2 * e);
  const gz = (g(x, z + e) - g(x, z - e)) / (2 * e);
  const l = Math.hypot(gx, gz) || 1;
  return { x: -gx / l, z: -gz / l, slope: l };
}

function clearOfTrees(x: number, z: number): number {
  let clear = Infinity;
  for (const t of level.trees) clear = Math.min(clear, Math.hypot(t.x - x, t.z - z));
  return clear;
}

/** The best point of a kind in a height band, scored by `score`. */
function find(
  kinds: readonly SummerKind[],
  lo: number,
  hi: number,
  score: (x: number, z: number) => number,
): { x: number; z: number } | null {
  let best: { x: number; z: number; v: number } | null = null;
  const cell = 24;
  for (let z = size * 0.08; z < size * 0.92; z += cell) {
    for (let x = size * 0.08; x < size * 0.92; x += cell) {
      const y = g(x, z);
      if (y < lo || y > hi) continue;
      if (!kinds.includes(summerGroundAt(level, x, z))) continue;
      const v = score(x, z);
      if (!best || v > best.v) best = { x, z, v };
    }
  }
  return best;
}

const mid = (lo: number, hi: number) => (lo + hi) / 2;
const spots: Record<SpotId, { x: number; z: number } | null> = {
  meadow: find(["meadow", "pasture"], base + 40, line - 60, (x, z) =>
    Math.min(60, clearOfTrees(x, z)),
  ),
  grass: null,
  piste: find(["piste"], mid(base, line), line - 20, (x, z) => Math.min(40, clearOfTrees(x, z))),
  vista: find(["turf", "meadow", "pasture", "heath"], line - 80, line + 120, (x, z) => {
    const f = fallAt(x, z);
    return Math.min(40, clearOfTrees(x, z)) - Math.abs(f.slope - 0.35) * 60;
  }),
  lift: null,
  village: level.resort ? { x: level.resort.village.x, z: level.resort.village.z } : null,
  turf: find(["turf", "heath"], line + 40, top - 60, (x, z) => -Math.abs(g(x, z) - mid(line, top))),
  patch: find(["snow"], line, top + 1, (x, z) => g(x, z)),
};
spots.grass = spots.meadow;
const lift = level.resort?.lifts.find((l) => l.kind !== "drag") ?? level.resort?.lifts[0] ?? null;
if (lift) spots.lift = { x: lift.bottom.x, z: lift.bottom.z };

const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);
// Out of every view's way: by the village, or the map's middle.
const stand = spots.village ?? { x: size / 2, z: size / 2 };

/** A free ride on the map — in midsummer, or its own winter — with the
 * skier stood at the meadow, for scale. The other hours are the sky's. */
function ride(hour: number): GameState {
  const s = createGame({
    level,
    seed,
    region,
    mode: "free",
    sky: { weather, hour },
    ...(winter ? {} : { summer: true, day: { dayOfYear: SUMMER_DAY, hour } }),
    groomer: "off",
    crowd: 0,
    quiet: true,
  });
  placeRun(s, { x: stand.x, z: stand.z, heading: 0 });
  for (let i = 0; i < STEPS * 3; i++) step(s, NEUTRAL_INPUT);
  return s;
}

const at = (x: number, z: number, h: number) => ({ x, y: g(x, z) + h, z });

/** The lens on a view, or null where the map has no such place. */
function lensOf(id: SpotId, lv: Level): LensPose | null {
  const p = spots[id];
  if (!p) return null;
  const f = fallAt(p.x, p.z);
  const across = { x: -f.z, z: f.x };
  switch (id) {
    case "meadow":
      return {
        eye: at(p.x, p.z, 1.7),
        target: at(p.x + f.x * 40, p.z + f.z * 40, 0),
        fov: 60,
        roll: 0,
      };
    case "grass":
      return {
        eye: at(p.x, p.z, 0.7),
        target: at(p.x + across.x * 6, p.z + across.z * 6, 0.1),
        fov: 60,
        roll: 0,
      };
    case "piste":
      return {
        eye: at(p.x, p.z, 1.8),
        target: at(p.x + f.x * 50, p.z + f.z * 50, 0),
        fov: 60,
        roll: 0,
      };
    case "vista": {
      const v = lv.resort?.village ?? { x: size / 2, z: size / 2 };
      return {
        eye: at(p.x, p.z, 4),
        target: { x: v.x, y: g(v.x, v.z) + 60, z: v.z },
        fov: 62,
        roll: 0,
      };
    }
    case "lift": {
      if (!lift) return null;
      const dx = lift.top.x - lift.bottom.x;
      const dz = lift.top.z - lift.bottom.z;
      const l = Math.hypot(dx, dz) || 1;
      const ex = lift.bottom.x + (dx / l) * 60 - (dz / l) * 25;
      const ez = lift.bottom.z + (dz / l) * 60 + (dx / l) * 25;
      const tx = lift.bottom.x + dx * 0.45;
      const tz = lift.bottom.z + dz * 0.45;
      return { eye: at(ex, ez, 2), target: at(tx, tz, 10), fov: 60, roll: 0 };
    }
    case "village": {
      const ex = p.x - f.x * 120;
      const ez = p.z - f.z * 120;
      return { eye: at(ex, ez, 70), target: at(p.x, p.z, 0), fov: 60, roll: 0 };
    }
    case "turf":
      return {
        eye: at(p.x, p.z, 1.8),
        target: at(p.x - f.x * 80, p.z - f.z * 80, 20),
        fov: 62,
        roll: 0,
      };
    case "patch": {
      const ex = p.x + f.x * 40 + across.x * 10;
      const ez = p.z + f.z * 40 + across.z * 10;
      return { eye: at(ex, ez, 8), target: at(p.x, p.z, 0), fov: 55, roll: 0 };
    }
  }
}

let state: GameState | null = null;
const ready = (async () => {
  const first = ride(hours[0]);
  state = first;
  await renderer.load(first);
  renderer.setSky({ weather, hour: hours[0] });
  renderer.draw(first, 1, FRAME);
  await renderer.shadeSettled();
  const found = SPOTS.filter((s) => spots[s]).join(" ");
  return (
    `${winter ? "WINTER (day " + level.sun.dayOfYear + ")" : "SUMMER (day " + SUMMER_DAY + ")"} ` +
    `${weather}, tree line ${line.toFixed(0)} m, summit ${top.toFixed(0)} m — found: ${found}`
  );
})();

async function sheet(views: string[]): Promise<{ frames: Frame[] }> {
  const note = await ready;
  const frames: Frame[] = [];
  let shownHour = hours[0];
  const s = state as GameState;
  for (const view of views) {
    const cut = view.lastIndexOf("-");
    const id = view.slice(0, cut) as SpotId;
    const hour = Number(view.slice(cut + 1));
    if (hour !== shownHour) {
      renderer.setSky({ weather, hour });
      renderer.draw(s, 1, FRAME);
      await renderer.shadeSettled();
      shownHour = hour;
    }
    const lens = lensOf(id, s.level);
    if (!lens) continue;
    renderer.setOverride(lens);
    for (let i = 0; i < 3; i++) renderer.draw(s, 1, FRAME, true);
    renderer.setOverride(null);
    const kind = spots[id] ? summerGroundAt(level, spots[id].x, spots[id].z) : "-";
    frames.push({
      view,
      label: id,
      caption: `${id.toUpperCase()} ${hour} h — ${kind}`,
      png: canvas.toDataURL("image/png"),
    });
  }
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent = `SUMMER — seed ${seed}${region ? ` ${region}` : ""} — ${tier}\n${note}`;
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

window.__summer = { ready, views: VIEWS, sheet };
