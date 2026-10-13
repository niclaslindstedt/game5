// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE PARK'S PICTURE LAB page (`scripts/bike-park-preview.mjs`): a
// summer free ride's bike park (R44, R45) through the game's OWN renderer,
// at named views found off the park itself:
//
//   berm     a bermed turn on a flow trail, from just up the trail
//   table    a tabletop from the side, its take-off, deck and landing
//   flow     a flow trail from above, zig-zagging across the fall line
//   rocks    a rock garden on a technical trail, from up the trail
//   drop     a drop or a step-down from the side
//   race     the downhill race line between its tapes
//   head     the trail heads on a lift's staging apron and their signs
//
// It exposes `window.__bike.sheet(views)`, which shoots the views, lays them
// out as a contact sheet for the driver to photograph, and hands back every
// frame.

import {
  createGame,
  generateLevel,
  loadRealFace,
  NEUTRAL_INPUT,
  placeRun,
  step,
  summerGroundAt,
  TUNING,
  type BikeFeature,
  type BikeTrail,
  type GameState,
  type Level,
  type RegionId,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";

type Frame = { view: string; label: string; caption: string; png: string };

declare global {
  interface Window {
    __bike?: {
      ready: Promise<string>;
      views: readonly string[];
      sheet(views: string[]): Promise<{ frames: Frame[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const region = (params.get("region") || undefined) as RegionId | undefined;
const face = params.get("face") || undefined;
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);
const cols = Number(params.get("cols") ?? 4);
const scale = Number(params.get("scale") ?? 0.5);
const hour = Number(params.get("hour") ?? 11);
const SUMMER_DAY = 196;

const VIEWS = ["berm", "table", "flow", "rocks", "drop", "race", "head"] as const;
type ViewId = (typeof VIEWS)[number];

const canvas = document.getElementById("stage") as HTMLCanvasElement;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
const sheetEl = document.getElementById("sheet") as HTMLDivElement;

await loadModels();
if (face) await loadRealFace(face);
const renderer = createWorldRenderer(canvas, {
  video: withPreset(DEFAULT_VIDEO, tier),
  preserveDrawingBuffer: true,
});
renderer.resize(width, height, 1);

const base = generateLevel(seed, { region, face });
const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);

function ride(): GameState {
  const s = createGame({
    level: base,
    seed,
    region,
    mode: "free",
    sky: { weather: "fair", hour },
    summer: true,
    day: { dayOfYear: SUMMER_DAY, hour },
    groomer: "off",
    crowd: 0,
    quiet: true,
  });
  const v = base.resort?.village ?? { x: base.size / 2, z: base.size / 2 };
  placeRun(s, { x: v.x, z: v.z, heading: 0 });
  for (let i = 0; i < STEPS * 3; i++) step(s, NEUTRAL_INPUT);
  return s;
}

/** Where a trail is at arc `s`: its point and its way. */
function along(t: BikeTrail, s: number) {
  const p = t.points[Math.max(0, Math.min(t.points.length - 1, Math.round(s)))];
  return { x: p.x, z: p.z, h: p.heading, y: p.y };
}

/** A feature of one of `kinds` on a trail of one of `grades`, its middle
 * nearest the trail's. */
function featureOf(
  level: Level,
  kinds: readonly BikeFeature["kind"][],
  grades: readonly string[],
): { t: BikeTrail; f: BikeFeature } | null {
  for (const t of level.bikePark?.trails ?? []) {
    if (!grades.includes(t.kind === "race" ? "race" : t.grade)) continue;
    const list = t.features.filter((f) => kinds.includes(f.kind));
    if (list.length === 0) continue;
    const f = list[Math.floor(list.length / 2)];
    return { t, f };
  }
  return null;
}

function lensOf(id: ViewId, lv: Level): { lens: LensPose; caption: string } | null {
  const g = lv.groundAt;
  const at = (x: number, z: number, up: number) => ({ x, y: g(x, z) + up, z });
  const side = (p: { x: number; z: number; h: number }, d: number) => ({
    x: p.x + Math.cos(p.h) * d,
    z: p.z - Math.sin(p.h) * d,
  });
  const park = lv.bikePark;
  if (!park) return null;
  switch (id) {
    case "berm": {
      const hit = featureOf(lv, ["berm"], ["blue", "green"]);
      if (!hit) return null;
      const mid = along(hit.t, (hit.f.from + hit.f.to) / 2);
      const e = along(hit.t, hit.f.from - 10);
      return {
        lens: { eye: at(e.x, e.z, 1.5), target: at(mid.x, mid.z, 0.6), fov: 60, roll: 0 },
        caption: `${hit.t.id} ${hit.t.grade} berm ${hit.f.height.toFixed(2)} m`,
      };
    }
    case "table":
    case "drop": {
      const hit =
        id === "table"
          ? featureOf(lv, ["table", "gap"], ["blue", "red", "black", "race"])
          : featureOf(lv, ["drop", "stepdown"], ["red", "black", "race"]);
      if (!hit) return null;
      const mid = along(hit.t, (hit.f.from + hit.f.to) / 2);
      const e = side(mid, 12);
      return {
        lens: { eye: at(e.x, e.z, 1.6), target: at(mid.x, mid.z, 0.8), fov: 55, roll: 0 },
        caption: `${hit.t.id} ${hit.t.grade} ${hit.f.kind} ${hit.f.height.toFixed(2)} m, ${(hit.f.to - hit.f.from).toFixed(0)} m long`,
      };
    }
    case "flow": {
      const t = park.trails.find((x) => x.grade === "blue" && x.kind === "trail") ?? park.trails[0];
      const mid = along(t, t.length * 0.4);
      const back = along(t, t.length * 0.4 - 60);
      return {
        lens: {
          eye: { x: back.x, y: g(back.x, back.z) + 45, z: back.z },
          target: at(mid.x, mid.z, 0),
          fov: 60,
          roll: 0,
        },
        caption: `${t.id} ${t.grade} from above`,
      };
    }
    case "rocks": {
      const hit = featureOf(lv, ["rocks", "roots"], ["red", "black", "race"]);
      if (!hit) return null;
      const mid = along(hit.t, (hit.f.from + hit.f.to) / 2);
      const e = along(hit.t, hit.f.from - 6);
      return {
        lens: { eye: at(e.x, e.z, 1.4), target: at(mid.x, mid.z, 0), fov: 55, roll: 0 },
        caption: `${hit.t.id} ${hit.t.grade} ${hit.f.kind} ${hit.f.height.toFixed(2)} m`,
      };
    }
    case "race": {
      const t = park.trails.find((x) => x.kind === "race");
      if (!t) return null;
      const s = t.start + (t.length - t.start) * 0.5;
      const e = along(t, s);
      const tgt = along(t, s + 35);
      return {
        lens: { eye: at(e.x, e.z, 1.7), target: at(tgt.x, tgt.z, 0), fov: 62, roll: 0 },
        caption: `${t.id} race line ${(t.length - t.start).toFixed(0)} m`,
      };
    }
    case "head": {
      const apron = park.aprons.find((a) => a.heads.length >= 2) ?? park.aprons[0];
      if (!apron) return null;
      const h = apron.heads[0];
      // Stood on the apron behind the head, looking out along it.
      const ex = h.x - Math.sin(h.heading) * 7;
      const ez = h.z - Math.cos(h.heading) * 7;
      const tx = h.x + Math.sin(h.heading) * 12;
      const tz = h.z + Math.cos(h.heading) * 12;
      return {
        lens: { eye: at(ex, ez, 1.8), target: at(tx, tz, 0.4), fov: 62, roll: 0 },
        caption: `apron of ${apron.lift}: ${apron.heads.map((x) => `${x.trail} ${x.grade}`).join(", ")}`,
      };
    }
  }
}

let state: GameState | null = null;
const ready = (async () => {
  const s = ride();
  state = s;
  await renderer.load(s);
  renderer.setSky({ weather: "fair", hour });
  renderer.draw(s, 1, FRAME);
  await renderer.shadeSettled();
  const park = s.level.bikePark;
  return park
    ? `BIKE PARK — ${park.trails.map((t) => `${t.id} ${t.kind === "race" ? "race" : t.grade}`).join(", ")}`
    : "NO BIKE PARK";
})();

async function sheet(views: string[]): Promise<{ frames: Frame[] }> {
  const note = await ready;
  const frames: Frame[] = [];
  const s = state as GameState;
  for (const view of views) {
    const got = lensOf(view as ViewId, s.level);
    if (!got) continue;
    renderer.setOverride(got.lens);
    for (let i = 0; i < 3; i++) renderer.draw(s, 1, FRAME, true);
    renderer.setOverride(null);
    const t = got.lens.target;
    frames.push({
      view,
      label: view,
      caption: `${view.toUpperCase()} — ${got.caption} (${summerGroundAt(s.level, t.x, t.z)})`,
      png: canvas.toDataURL("image/png"),
    });
  }
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent = `BIKE PARK — seed ${seed}${face ? ` ${face}` : region ? ` ${region}` : ""} — ${tier}\n${note}`;
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

window.__bike = { ready, views: VIEWS, sheet };
