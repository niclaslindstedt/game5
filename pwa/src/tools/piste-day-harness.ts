// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE THROUGH THE DAY LAB's page (`scripts/piste-day-preview.mjs`):
// one spot of a free ride's piste (`engine/game/piste-day.ts`) under one
// sky at the hours of a day — the night's corduroy at the first chair, the
// skied-up noon, the afternoon and the evening, and the new snow a snowing
// sky lays on it meanwhile — through the game's OWN renderer.
//
// Every frame is a free ride stood up with that sky and hour (`createGame`'s
// `sky`), so the runs it is dealt are the engine's own; the picture is drawn
// over the map the page loaded once, under the same sky (`setSky`) — the
// renderer is never rebuilt for an hour. The skier stands still at the spot,
// for scale.
//
// It exposes `window.__piste.sheet(group, views)`, which shoots the views of
// one group, lays them out as a contact sheet for the driver to photograph,
// and hands back every frame at full size.

import {
  createGame,
  generateLevel,
  NEUTRAL_INPUT,
  placeRun,
  step,
  trackPointAt,
  TUNING,
  withDay,
  type GameState,
  type RegionId,
  type WeatherKind,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";

type Frame = { view: string; label: string; caption: string; png: string };

declare global {
  interface Window {
    __piste?: {
      ready: Promise<string>;
      groups: Record<string, readonly string[]>;
      sheet(group: string, views: string[]): Promise<{ frames: Frame[] }>;
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
/** How far down the piste the spot is, as a share of its length. */
const at = Number(params.get("at") ?? 0.3);
const day = Number(params.get("day"));
const hours = (params.get("hours") ?? "9,12,15,18")
  .split(",")
  .map(Number)
  .filter((h) => Number.isFinite(h));

/** Each sheet: one sky through the day's hours. */
const SKIES: Record<string, WeatherKind> = {
  clear: "clear",
  fair: "fair",
  overcast: "overcast",
  flurries: "flurries",
  snow: "snow",
  storm: "storm",
};
/** Each view: a lens at the spot. */
const LENSES = ["down", "near"] as const;
type LensId = (typeof LENSES)[number];
const GROUPS: Record<string, readonly string[]> = Object.fromEntries(
  Object.keys(SKIES).map((g) => [g, LENSES.map((l) => `${g}-${l}`)]),
);

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

const built = generateLevel(seed, { region });
const level =
  Number.isFinite(day) && params.get("day") !== null ? withDay(built, { dayOfYear: day }) : built;
const spot = trackPointAt(level, level.track.length * at);
const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);

/** A free ride on the map under `weather` at `hour`: the engine's own deal
 * of the runs, drawn over the map the page loaded (the sky the renderer's). */
function ride(weather: WeatherKind, hour: number): GameState {
  const s = createGame({
    level,
    seed,
    region,
    mode: "free",
    sky: { weather, hour },
    groomer: "off",
    crowd: 0,
    quiet: true,
  });
  s.level = level;
  // The skier at the spot, a few metres down it and off its middle.
  const ahead = trackPointAt(level, spot.s + 9);
  const across = ahead.width * 0.18;
  placeRun(s, {
    x: ahead.x + Math.cos(ahead.heading) * across,
    z: ahead.z - Math.sin(ahead.heading) * across,
    heading: ahead.heading,
  });
  for (let i = 0; i < STEPS * 3; i++) step(s, NEUTRAL_INPUT);
  return s;
}

/** The lens at the spot: down the piste from eye height, or close in on
 * the snow at the skier's feet. */
function lensOf(id: LensId): LensPose {
  const p = spot;
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  const g = level.groundAt;
  if (id === "down") {
    const tx = p.x + fx * 26;
    const tz = p.z + fz * 26;
    return {
      eye: { x: p.x, y: g(p.x, p.z) + 3, z: p.z },
      target: { x: tx, y: g(tx, tz), z: tz },
      fov: 55,
      roll: 0,
    };
  }
  const ex = p.x - fz * 1.5;
  const ez = p.z + fx * 1.5;
  const tx = p.x + fx * 3.5;
  const tz = p.z + fz * 3.5;
  return {
    eye: { x: ex, y: g(ex, ez) + 1.2, z: ez },
    target: { x: tx, y: g(tx, tz), z: tz },
    fov: 50,
    roll: 0,
  };
}

const ready = (async () => {
  const first = createGame({
    level,
    seed,
    region,
    mode: "free",
    groomer: "off",
    crowd: 0,
    quiet: true,
  });
  await renderer.load(first);
  renderer.draw(first, 1, FRAME);
  await renderer.shadeSettled();
  return `the spot ${Math.round(spot.s)} m down a ${Math.round(level.track.length)} m piste, day ${level.sun.dayOfYear}, lat ${level.sun.latitude.toFixed(1)}`;
})();

function line(s: GameState): string {
  const p = s.piste;
  if (!p) return "no piste day";
  const ahead = trackPointAt(level, spot.s + 12);
  const on = `packed ${level.packedAt(ahead.x, ahead.z).toFixed(2)}  `;
  return (
    on +
    `worn ${p.worn.toFixed(2)}  new ${(s.fresh * 100).toFixed(1)} cm  ` +
    `soft ${p.soft.toFixed(2)}  hard ${p.hard.toFixed(2)}  loose ${p.loose.toFixed(2)}`
  );
}

async function sheet(group: string, views: string[]): Promise<{ frames: Frame[] }> {
  const note = await ready;
  const weather = SKIES[group];
  if (!weather) throw new Error(`no sheet "${group}"`);
  const frames: Frame[] = [];
  for (const view of views) {
    const lens = view.slice(group.length + 1) as LensId;
    if (!LENSES.includes(lens)) throw new Error(`no view "${view}"`);
    for (const hour of hours) {
      renderer.setSky({ weather, hour });
      await renderer.shadeSettled();
      const s = ride(weather, hour);
      renderer.setOverride(lensOf(lens));
      renderer.draw(s, 1, FRAME, true);
      renderer.draw(s, 1, FRAME, true);
      renderer.setOverride(null);
      const label = `${String(Math.floor(hour)).padStart(2, "0")}h${String(Math.round((hour % 1) * 60)).padStart(2, "0")}`;
      frames.push({
        view,
        label,
        caption: `${weather} ${label} [${lens}]\n${line(s)}`,
        png: canvas.toDataURL("image/png"),
      });
    }
  }
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent = `PISTE THROUGH THE DAY — ${group} — seed ${seed}${region ? ` ${region}` : ""} — ${tier}\n${note}`;
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

window.__piste = { ready, groups: GROUPS, sheet };
