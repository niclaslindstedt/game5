// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWFALL LAB's page (driven by `scripts/snowfall-preview.mjs`): the
// falling snow (`snowfall.ts`) as a skier sees it at speed, photographed as
// one labelled contact sheet — each ROW a weather and the way the ride runs
// to its wind (INTO it, WITH it, ACROSS it), each COLUMN a speed held.
//
// Why a sheet: what the fall looks like is the sum of three motions — the
// wind carrying it, its own fall, and the lens running through it — and a
// still of one race shows one of each. Two sheets:
//
//   * FRAME — the game's own picture of the moment, through its own lens.
//   * FLOW — the flakes ALONE over black (`setHidden`), several frames in a
//     row laid over each other, so each flake's way across the picture
//     shows as a track: at speed every track should run out of the point
//     the skier is heading for and past the lens, and lengthen with speed.
//
// Beside the pictures, every cell's numbers off the plan the shader is
// drawn by (`snowfall-plan.ts`): the lens's own velocity measured off the
// lens as the shader measures it, the wind, the air past the lens and how
// much of it comes AT the lens.
//
// THE STAGE (`stage.ts`): the seed's open meadow, ridden straight on held
// controls (`hold-input.ts`) at the column's speed, the sky set by hand
// (`renderer.setSky`) at midday.

import {
  createGame,
  placeRun,
  step,
  windAt,
  withSky,
  type GameState,
  type SkyOverride,
  type Wind,
} from "@engine";

import { HIDEABLE } from "../game/benchmark-report.ts";
import { holdInput } from "../game/hold-input.ts";
import { createWorldRenderer } from "../game/renderer.ts";
import type { CameraRung } from "../game/renderer-api.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { skyLookAt } from "../game/sky.ts";
import {
  BOX,
  airPast,
  createLensTrack,
  flakeDrift,
  shutterOf,
  type Vec3,
} from "../game/snowfall-plan.ts";
import { meadow } from "./stage.ts";

/** One cell's numbers: the ride, the wind, and the air past the lens. */
export type SnowfallCell = {
  weather: string;
  ride: string;
  kmh: number;
  /** The skier's speed and the lens's when the picture was taken, km/h. */
  skier: number;
  lens: number;
  wind: number;
  /** The air past the lens, m/s, and how much of it comes AT the lens. */
  air: number;
  toward: number;
  /** How long a smear is at sixty frames a second, m. */
  smear: number;
  /** Seconds a flake at the box's edge ahead takes to reach the lens. */
  cross: number;
};

declare global {
  interface Window {
    __snowfall?: {
      ready: Promise<void>;
      /** Draw a sheet; resolves to what it drew. */
      sheet(kind: "frame" | "flow"): Promise<{ rows: number; cols: number; note: string }>;
      /** Every cell's numbers, filled by the last sheet drawn. */
      cells(): SnowfallCell[];
    };
  }
}

const params = new URLSearchParams(location.search);
const list = (name: string, fallback: string) =>
  (params.get(name) || fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const seed = Number(params.get("seed") ?? 38);
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const cellW = Number(params.get("w") ?? 320);
const cellH = Number(params.get("h") ?? 180);
const weathers = list("weathers", "flurries,snow,storm");
const rides = list("rides", "into,with,across");
const speeds = list("speeds", "0,30,60,100,140").map(Number);
const rung = (params.get("camera") ?? "chase") as CameraRung;
const strobe = Math.max(1, Number(params.get("strobe") ?? 8));
const warm = Number(params.get("ride") ?? 1);

/** A WEATHER: the sky set for it, a fall in the middle of its band (CLEAR
 * is the air's crystals alone). */
const SKIES: Record<string, SkyOverride["weather"]> = {
  clear: "clear",
  flurries: { kind: "flurries", snowfall: 0.25 },
  snow: { kind: "snow", snowfall: 0.5 },
  storm: { kind: "storm", snowfall: 0.9 },
};

/** The ride's heading off the way the wind blows: INTO it, WITH it, or
 * ACROSS it (the wind from the left). */
const TURN: Record<string, number> = { into: Math.PI, with: 0, across: Math.PI / 2 };

const FRAME = 1 / 60;

const stage = document.getElementById("stage") as HTMLCanvasElement;
const sheet = document.getElementById("sheet") as HTMLCanvasElement;
const renderer = createWorldRenderer(stage, {
  video: withPreset(DEFAULT_VIDEO, tier),
  preserveDrawingBuffer: true,
});
renderer.resize(cellW, cellH, 1);
const first: GameState = createGame({ seed, mode: "free", rivals: 0, quiet: true });
const level = first.level;
let spot = { x: 0, z: 0, room: 0 };
let filled: SnowfallCell[] = [];

window.__snowfall = {
  ready: (async () => {
    await renderer.load(first);
    spot = meadow(level);
  })(),
  cells: () => filled,
  async sheet(kind) {
    const labelW = 150;
    const headH = 34;
    const rows = weathers.flatMap((w) => rides.map((r) => ({ weather: w, ride: r })));
    sheet.width = labelW + cellW * speeds.length;
    sheet.height = headH + cellH * rows.length;
    const ctx = sheet.getContext("2d")!;
    ctx.fillStyle = "#0b1116";
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.fillStyle = "#e8eef4";
    ctx.font = "12px monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `SNOWFALL ${kind.toUpperCase()} · seed ${seed} · meadow ${spot.x.toFixed(0)},${spot.z.toFixed(0)} · ${rung} · ${tier}` +
        (kind === "flow" ? ` · ${strobe} frames laid over each other, the flakes alone` : ""),
      8,
      10,
    );
    speeds.forEach((v, c) => ctx.fillText(`${v} KM/H`, labelW + c * cellW + 6, 26));
    filled = [];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const y0 = headH + r * cellH;
      const sky: SkyOverride = { weather: SKIES[row.weather] ?? "clear", hour: 12 };
      renderer.setSky(sky);
      const skied = withSky(level, sky);
      const label: string[] = [row.weather.toUpperCase(), `${row.ride.toUpperCase()} THE WIND`];
      for (let c = 0; c < speeds.length; c++) {
        const kmh = speeds[c];
        const wind: Wind = windAt(skied, 0);
        const heading = Math.atan2(wind.x, wind.z) + (TURN[row.ride] ?? 0);
        const state = createGame({ level, mode: "free", rivals: 0, quiet: true });
        // From the meadow's far side, so the ride crosses its middle.
        const lead = Math.min(40, (kmh / 3.6) * warm * 0.6);
        placeRun(state, {
          x: spot.x - Math.sin(heading) * lead,
          z: spot.z - Math.cos(heading) * lead,
          heading,
          speed: kmh / 3.6,
        });
        renderer.setHidden([]);
        renderer.setOverride(null);
        renderer.setCamera(rung, true);
        renderer.draw(state, 0, FRAME, false);
        await renderer.shadeSettled();
        const track = createLensTrack();
        const lensV: Vec3 = { x: 0, y: 0, z: 0 };
        const frame = (present: boolean) => {
          for (let i = 0; i < 2; i++) step(state, holdInput(state, kmh, heading));
          renderer.draw(state, 0, FRAME, present);
          const p = renderer.lensPose();
          Object.assign(lensV, track.step(p, FRAME));
        };
        const t0 = state.t;
        while (state.t - t0 < warm) frame(false);
        const x0 = labelW + c * cellW;
        if (kind === "frame") {
          frame(true);
          ctx.drawImage(stage, x0, y0, cellW, cellH);
        } else {
          renderer.setHidden(HIDEABLE.filter((h) => h !== "snowfall"));
          ctx.fillStyle = "#000";
          ctx.fillRect(x0, y0, cellW, cellH);
          ctx.globalCompositeOperation = "lighten";
          for (let f = 0; f < strobe; f++) {
            frame(true);
            ctx.drawImage(stage, x0, y0, cellW, cellH);
          }
          ctx.globalCompositeOperation = "source-over";
          renderer.setHidden([]);
        }
        // The numbers, off the plan the shader draws by.
        const look = skyLookAt(skied, state.t);
        const now = windAt(skied, state.t);
        const air = airPast(flakeDrift(now, look.snowfall), lensV);
        const pose = renderer.lensPose();
        const fwd = {
          x: Math.sin(pose.yaw) * Math.cos(pose.pitch),
          y: Math.sin(pose.pitch),
          z: Math.cos(pose.yaw) * Math.cos(pose.pitch),
        };
        const toward = -(air.x * fwd.x + air.y * fwd.y + air.z * fwd.z);
        const speed = Math.hypot(air.x, air.y, air.z);
        const cell: SnowfallCell = {
          weather: row.weather,
          ride: row.ride,
          kmh,
          skier: state.skier.speed * 3.6,
          lens: Math.hypot(lensV.x, lensV.y, lensV.z) * 3.6,
          wind: now.speed,
          air: speed,
          toward,
          smear: speed * shutterOf(FRAME),
          cross: toward > 0.05 ? BOX / 2 / toward : Infinity,
        };
        filled.push(cell);
        ctx.fillStyle = "rgba(11,17,22,0.72)";
        ctx.fillRect(x0, y0 + cellH - 18, cellW, 18);
        ctx.fillStyle = "#e8eef4";
        ctx.fillText(
          `lens ${cell.lens.toFixed(0)} km/h · air ${cell.air.toFixed(1)} m/s, ${cell.toward.toFixed(1)} at the lens`,
          x0 + 6,
          y0 + cellH - 9,
        );
        if (c === 0) label.push(`WIND ${now.speed.toFixed(1)} M/S`);
        await new Promise((done) => setTimeout(done, 0));
      }
      ctx.fillStyle = "#e8eef4";
      label.forEach((l, i) => ctx.fillText(l, 8, y0 + cellH / 2 - 16 + i * 16));
    }
    renderer.setSky(null);
    renderer.setOverride(null);
    renderer.setHidden([]);
    return {
      rows: rows.length,
      cols: speeds.length,
      note: `${weathers.join("/")} × ${rides.join("/")} the wind × ${speeds.join("/")} km/h`,
    };
  },
};
