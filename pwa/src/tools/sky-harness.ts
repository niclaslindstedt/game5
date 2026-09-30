// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY LAB's page (driven by `scripts/sky-preview.mjs`): one seed stood
// up and drawn through the game's own renderer from ONE place, under every
// weather R19 deals at every few hours of the clock, laid out as a single
// labelled contact sheet — rows the weathers, columns the hours.
//
// It exists because a map is dealt ONE sky at ONE hour, so a screenshot of a
// race can only say whether that one sky is wrong; the sky is a ladder, and
// a ladder is judged side by side or not at all. The map, the day and the
// latitude stay the seed's; only the weather and the start hour move
// (`renderer.setSky`, the engine's `withSky`), so every cell is the same
// ground under a different sky.

import { botInput, createGame, step, type GameState, type SkyOverride } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";

/** One row of the sheet: a label, the sky it asks for, and the new snow
 * lying under it, m (`GameState.fresh`; none when left out). */
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

declare global {
  interface Window {
    __sky?: {
      ready: Promise<void>;
      /** Draw the sheet; resolves to what it drew. */
      sheet(): Promise<{ rows: number; cols: number; note: string }>;
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
const hours = (params.get("hours") ?? "0,3,6,9,12,15,18,21").split(",").map(Number);
const only = (params.get("weathers") ?? "").split(",").filter(Boolean);
const view = params.get("view") ?? "chase";
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

/** Over the mountain from the summit ridge, looking down to the base. */
function vista(): LensPose {
  const m = level.mountain ?? {
    summit: {
      x: level.size / 2,
      z: level.size * 0.08,
      y: level.groundAt(level.size / 2, level.size * 0.08),
    },
    base: {
      x: level.size / 2,
      z: level.size * 0.92,
      y: level.groundAt(level.size / 2, level.size * 0.92),
    },
    vertical: 600,
  };
  const c = { x: m.base.x, z: m.base.z };
  let best = { x: m.summit.x, z: m.summit.z, y: -Infinity };
  for (let f = -0.25; f <= 0.25; f += 0.01) {
    const x = m.summit.x + level.size * f;
    const z = m.summit.z;
    const y = level.groundAt(x, z);
    if (y > best.y) best = { x, z, y };
  }
  return {
    eye: { x: best.x, y: best.y + 8, z: best.z },
    target: { x: c.x, y: level.groundAt(c.x, c.z) + 30, z: c.z },
    fov: 68,
    roll: 0,
  };
}

const FRAME = 1 / 60;

window.__sky = {
  ready: (async () => {
    await renderer.load(state);
    // Onto the grid and a moment into the lights, so the field is standing.
    for (let i = 0; i < 180; i++) step(state, botInput(state));
    renderer.setCamera("chase", true);
  })(),
  async sheet() {
    const labelW = 96;
    const headH = 34;
    sheet.width = labelW + cellW * hours.length;
    sheet.height = headH + cellH * rows.length;
    const ctx = sheet.getContext("2d")!;
    ctx.fillStyle = "#0b1116";
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.fillStyle = "#e8eef4";
    ctx.font = "12px monospace";
    ctx.textBaseline = "middle";
    const sun = level.sun;
    ctx.fillText(
      `SKY · seed ${seed} · day ${sun.dayOfYear} at ${sun.latitude.toFixed(1)}°N · ${view} · ${tier}`,
      8,
      10,
    );
    hours.forEach((h, c) =>
      ctx.fillText(`${String(h).padStart(2, "0")}:00`, labelW + c * cellW + 6, 26),
    );
    renderer.setOverride(view === "vista" ? vista() : chase());
    for (let r = 0; r < rows.length; r++) {
      ctx.fillStyle = "#e8eef4";
      ctx.fillText(rows[r].label, 8, headH + r * cellH + cellH / 2);
      state.fresh = rows[r].fresh ?? 0;
      for (let c = 0; c < hours.length; c++) {
        renderer.setSky({ weather: rows[r].sky, hour: hours[c] });
        // A few frames unseen, so the spindrift is up and the lens settled.
        for (let i = 0; i < 20; i++) renderer.draw(state, 0, FRAME, false);
        renderer.draw(state, 0, FRAME, true);
        ctx.drawImage(stage, labelW + c * cellW, headH + r * cellH, cellW, cellH);
        // Let the page breathe between cells: a long sheet is minutes of
        // software rasterizing.
        await new Promise((done) => setTimeout(done, 0));
      }
    }
    renderer.setSky(null);
    renderer.setOverride(null);
    return {
      rows: rows.length,
      cols: hours.length,
      note: `${rows.map((r) => r.label).join(", ")} × ${hours.join(", ")} h`,
    };
  },
};
