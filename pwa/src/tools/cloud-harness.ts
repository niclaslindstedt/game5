// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLOUD LAB's page (driven by `scripts/cloud-preview.mjs`): the snow a
// skier rips up (`snow-cloud.ts`, `spray.ts`), and the furrow it leaves,
// photographed as one labelled contact sheet — each ROW one ride (a kind of
// snow × a light × a speed), each COLUMN the same moment of it from another
// angle (or, with `cols=times`, one angle at several moments of the ride).
//
// Why a sheet: a cloud is a moving, lit volume, and one screenshot is one
// camera at one moment under one sun. What makes it read — how it stalls
// behind the skis, how it swells, the silver edge against a low sun, the
// blue in its shaded side, the glow of a taillight in it at night, how much
// less a wet or crusted snow throws — only shows side by side.
//
// THE STAGE: one open meadow on the seed's own map — the flattest spot with
// no tree near it and the track well away — or, with `where=piste`, the
// piste itself (its own groomer, unless a snow is laid over it), ridden at
// a held speed in one of the MOVES: running straight, carving, checking the
// speed with the brake's skid, a hockey stop from the speed, skating off
// from a standstill. The SUN is turned to the ride rather than the ride to the
// sun: a light is a sky (`renderer.setSky`) and a heading chosen off the
// sun's azimuth, so FRONT is the sun behind the chase camera, BACK is the
// chase camera looking into it through the cloud, SIDE is across. The kind
// of snow is laid over the whole map for the picture (`renderer.setSnow`);
// the physics rides the meadow's own powder under it, at the run's dial.

import {
  createGame,
  isRegionId,
  nearestTrackPoint,
  placeRun,
  step,
  sunAtRun,
  withSky,
  type GameState,
  type RegionId,
  type SkyOverride,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { holdInput, isHoldMove, type HoldMove } from "../game/hold-input.ts";
import { isSnowKind, type SnowKind } from "../game/snowpack.ts";

declare global {
  interface Window {
    __cloud?: {
      ready: Promise<void>;
      /** Draw the sheet; resolves to what it drew. */
      sheet(): Promise<{ rows: number; cols: number; note: string }>;
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
const region = isRegionId(params.get("region")) ? (params.get("region") as RegionId) : undefined;
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const cellW = Number(params.get("w") ?? 400);
const cellH = Number(params.get("h") ?? 225);
const snows = list("snow", "soft,new").map((s) => (s === "map" ? null : s));
const lights = list("light", "front,back,night");
const speeds = list("speeds", "40,80").map(Number);
const views = list("views", "chase,side,front,trail,under");
const ride = Number(params.get("ride") ?? 2.5);
const coast = Number(params.get("coast") ?? 0);
const dial = Number(params.get("dial") ?? 1);
const byTimes = params.get("cols") === "times";
const moves = list("moves", "straight").filter(isHoldMove);
const onPiste = params.get("where") === "piste";
const times = list("times", "0.4,1,2,3.5").map(Number);

const stage = document.getElementById("stage") as HTMLCanvasElement;
const sheet = document.getElementById("sheet") as HTMLCanvasElement;
const renderer = createWorldRenderer(stage, {
  video: withPreset(DEFAULT_VIDEO, tier),
  preserveDrawingBuffer: true,
});
renderer.resize(cellW, cellH, 1);
const first: GameState = createGame({ seed, region, mode: "free", rivals: 0, quiet: true });
const level = first.level;

/** THE STAGE: the open meadow — the most room from the nearest tree, flat,
 * off the piste, on the mountain's face. */
function meadow(): { x: number; z: number; room: number } {
  const c = { x: level.size / 2, z: level.size * 0.5, rim: level.size * 0.4 };
  let best = { x: c.x, z: c.z, room: -Infinity };
  for (let x = c.x - c.rim * 0.8; x <= c.x + c.rim * 0.8; x += 16) {
    for (let z = c.z - c.rim * 0.8; z <= c.z + c.rim * 0.8; z += 16) {
      if (Math.hypot(x - c.x, z - c.z) > c.rim * 0.8) continue;
      const near = nearestTrackPoint(level, x, z);
      if (Math.hypot(near.x - x, near.z - z) < 45 || level.packedAt(x, z) > 0.05) continue;
      let tree = 90;
      for (const t of level.trees) tree = Math.min(tree, Math.hypot(t.x - x, t.z - z));
      let lo = Infinity;
      let hi = -Infinity;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        for (const r of [0, 20, 40]) {
          const y = level.groundAt(x + Math.sin(a) * r, z + Math.cos(a) * r);
          lo = Math.min(lo, y);
          hi = Math.max(hi, y);
        }
      }
      const room = tree - (hi - lo) * 6;
      if (room > best.room) best = { x, z, room };
    }
  }
  return best;
}

/** A LIGHT: the sky it rides under and where the sun stands to the ride —
 * the ride's heading off the sun's azimuth (0 rides at the sun). */
type Light = { label: string; sky: SkyOverride; turn: number };

/** The hour (solar) the sun stands nearest `elevation` rad, before noon. */
function hourAt(elevation: number): number {
  let best = 12;
  let gap = Infinity;
  for (let h = 5; h <= 12; h += 0.25) {
    const e = sunAtRun(withSky(level, { hour: h })).elevation;
    if (Math.abs(e - elevation) < gap) {
      gap = Math.abs(e - elevation);
      best = h;
    }
  }
  return best;
}

const DEG = Math.PI / 180;
function lightOf(name: string): Light {
  const day = hourAt(16 * DEG);
  switch (name) {
    case "back":
      return { label: "INTO THE SUN", sky: { weather: "clear", hour: day }, turn: 0 };
    case "side":
      return { label: "SUN ACROSS", sky: { weather: "clear", hour: day }, turn: Math.PI / 2 };
    case "low":
      return { label: "LOW SUN, BACK", sky: { weather: "clear", hour: hourAt(4 * DEG) }, turn: 0 };
    case "overcast":
      return { label: "OVERCAST", sky: { weather: "overcast", hour: 12 }, turn: 0 };
    case "snowing":
      return {
        label: "SNOWING",
        sky: { weather: { kind: "snow", snowfall: 0.5 }, hour: 12 },
        turn: 0,
      };
    case "night":
      return { label: "NIGHT", sky: { weather: "clear", hour: 22 }, turn: Math.PI };
    default:
      return { label: "SUN BEHIND", sky: { weather: "clear", hour: day }, turn: Math.PI };
  }
}

const FRAME = 1 / 60;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Where to stand for a view of the skier at his pose now; `start` is where
 * the ride began. Null is the game's own chase camera. */
function viewOf(name: string, state: GameState, start: { x: number; z: number }): LensPose | null {
  const s = state.skier;
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  const rx = fz;
  const rz = -fx;
  const g = (x: number, z: number) => level.groundAt(x, z);
  const at = (f: number, r: number, up: number) => {
    const x = s.x + fx * f + rx * r;
    const z = s.z + fz * f + rz * r;
    return { x, y: g(x, z) + up, z };
  };
  switch (name) {
    case "side":
      return { eye: at(-3, 14, 1.6), target: at(-4, 0, 1.4), fov: 55, roll: 0 };
    case "front":
      return { eye: at(15, 5, 2.2), target: at(-3, 0, 1.3), fov: 55, roll: 0 };
    case "high":
      return { eye: at(-8, 16, 13), target: at(-10, 0, 0.5), fov: 55, roll: 0 };
    case "furrow":
      return { eye: at(-2.5, 1.6, 2.4), target: at(-11, 0, 0), fov: 50, roll: 0 };
    case "under":
      return { eye: at(-4, 6, 0.5), target: at(-13, 0, 2.4), fov: 62, roll: 0 };
    case "trail": {
      const x = start.x + rx * 9;
      const z = start.z + rz * 9;
      return {
        eye: { x, y: g(x, z) + 1.8, z },
        target: { x: s.x, y: g(s.x, s.z) + 1.5, z: s.z },
        fov: 50,
        roll: 0,
      };
    }
    default:
      return null;
  }
}

type Row = { snow: SnowKind | null; light: Light; kmh: number; move: HoldMove };
const rows: Row[] = [];
for (const snow of snows) {
  for (const light of lights) {
    for (const move of moves) {
      for (const kmh of move === "skate" ? [0] : speeds) {
        rows.push({ snow: isSnowKind(snow) ? snow : null, light: lightOf(light), kmh, move });
      }
    }
  }
}

/** THE PISTE as a stage: a point a third of the way down it and its
 * heading there. */
function pisteSpot(): { x: number; z: number; heading: number } {
  const p = level.track.points[Math.floor(level.track.points.length / 3)];
  return { x: p.x, z: p.z, heading: p.heading };
}

let spot = { x: 0, z: 0, room: 0 };

window.__cloud = {
  ready: (async () => {
    await renderer.load(first);
    spot = meadow();
  })(),
  async sheet() {
    const cols = byTimes ? times.length : views.length;
    const labelW = 150;
    const headH = 34;
    sheet.width = labelW + cellW * cols;
    sheet.height = headH + cellH * rows.length;
    const ctx = sheet.getContext("2d")!;
    ctx.fillStyle = "#0b1116";
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.fillStyle = "#e8eef4";
    ctx.font = "12px monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `CLOUD · seed ${seed}${region ? ` ${region}` : ""} · meadow ${spot.x.toFixed(0)},${spot.z.toFixed(0)} (${spot.room.toFixed(0)} m clear) · dial ${dial} · ${tier}` +
        (byTimes
          ? ` · ${views[0]} at t s`
          : ` · ${ride} s ridden${coast ? `, ${coast} s coasted` : ""}`),
      8,
      10,
    );
    const heads = byTimes ? times.map((t) => `${t} s`) : views;
    heads.forEach((h, c) => ctx.fillText(h.toUpperCase(), labelW + c * cellW + 6, 26));
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const y0 = headH + r * cellH;
      renderer.setSky(row.light.sky);
      renderer.setSnow(row.snow);
      const sun = sunAtRun(withSky(level, row.light.sky));
      const piste = onPiste ? pisteSpot() : null;
      const heading = piste ? piste.heading : wrap(sun.azimuth + row.light.turn);
      const state = createGame({
        level,
        mode: "free",
        rivals: 0,
        quiet: true,
        snowDepth: dial,
      });
      // Onto the meadow's far side, so the ride crosses its middle.
      const lead = piste ? 0 : Math.min(40, (row.kmh / 3.6) * ride * 0.6);
      const from = piste ?? spot;
      const start = {
        x: from.x - Math.sin(heading) * lead,
        z: from.z - Math.cos(heading) * lead,
      };
      placeRun(state, { x: start.x, z: start.z, heading, speed: row.kmh / 3.6 });
      const t0 = state.t;
      renderer.setOverride(null);
      renderer.setCamera("chase", true);
      renderer.draw(state, 0, FRAME, false);
      // The mountain's shadow under this row's light, baked off the thread.
      await renderer.shadeSettled();
      const frame = (on: boolean) => {
        for (let i = 0; i < 2; i++) {
          step(state, holdInput(state, row.kmh, heading, row.move, state.t - t0, on));
        }
        renderer.draw(state, 0, FRAME, false);
      };
      const shoot = (view: string, c: number) => {
        renderer.setOverride(viewOf(view, state, start));
        renderer.draw(state, 0, 0, true);
        ctx.drawImage(stage, labelW + c * cellW, y0, cellW, cellH);
      };
      if (byTimes) {
        let c = 0;
        for (const t of times) {
          while (state.t < t) frame(true);
          shoot(views[0], c++);
          renderer.setOverride(null);
        }
      } else {
        while (state.t < ride) frame(true);
        while (state.t < ride + coast) frame(false);
        views.forEach((v, c) => shoot(v, c));
      }
      ctx.fillStyle = "#e8eef4";
      const label = [
        `${(row.snow ?? "map").toUpperCase()}${onPiste ? " · PISTE" : ""}`,
        row.light.label,
        `${row.move.toUpperCase()} ${row.move === "skate" ? "OFF" : `${row.kmh} KM/H`}`,
        `(${(state.skier.speed * 3.6).toFixed(0)} now)`,
      ];
      label.forEach((l, i) => ctx.fillText(l, 8, y0 + cellH / 2 - 24 + i * 16));
      await new Promise((done) => setTimeout(done, 0));
    }
    renderer.setSky(null);
    renderer.setSnow(null);
    renderer.setOverride(null);
    return {
      rows: rows.length,
      cols,
      note: `${snows.join("/")} × ${lights.join("/")} × ${moves.join("/")} × ${speeds.join("/")} km/h${onPiste ? " on the piste" : ""}`,
    };
  },
};
