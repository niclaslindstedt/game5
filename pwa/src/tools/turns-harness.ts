// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TURNS LAB's page (driven by `scripts/turns-preview.mjs`): the skier
// TURNING AND STOPPING as the game draws him — through the game's own
// renderer, on a real map's snow, the tracks his skis cut and the spray
// and the cloud they throw — photographed as one labelled contact sheet.
// Each ROW is a move at a speed (`hold-input.ts`'s held moves: ONE TURN
// held, linked CARVED turns, a SKIDDED turn, a HOCKEY STOP, a check), each
// COLUMN a moment of it, all from one lens: the game's CHASE camera, LOW
// behind him at the snow (where a ski off the snow shows against the
// light), BEHIND, SIDE, FRONT or HIGH.
//
// Every cell prints what the picture should show and the game's own
// statement of it (`ski-stand.ts`): the speed, the inclination, each
// ski's share of the load — the OUTSIDE ski carries him and throws the
// snow — and each ski's gap to the snow under it, which on the snow is
// a centimetre or two and never the quarter metre a ski rolled up off it
// with the body was.
//
// THE STAGE (`stage.ts`): a spot on the piste (`at` of the way down it),
// ridden along the piste's heading there; or, with `where=meadow`, the open
// meadow's powder. A clear day, the sun at 16° up.

import {
  createGame,
  isRegionId,
  placeRun,
  step,
  type GameState,
  type RegionId,
  type SkyOverride,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { holdInput, isHoldMove, type HoldMove } from "../game/hold-input.ts";
import { createWorldRenderer } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { skiGaps, standOf } from "../game/ski-stand.ts";
import { hourAt, meadow, pisteSpot } from "./stage.ts";

declare global {
  interface Window {
    __turns?: {
      ready: Promise<void>;
      /** Draw the sheet; resolves to what it drew and how big it is. */
      sheet(): Promise<{ rows: number; cols: number; note: string; w: number; h: number }>;
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
const cellW = Number(params.get("w") ?? 360);
const cellH = Number(params.get("h") ?? 240);
const moves = list("moves", "turn,carve,skid,stop").filter(isHoldMove);
const speeds = list("speeds", "25,50,75").map(Number);
const times = list("times", "0.4,0.8,1.2,1.6,2,2.4").map(Number);
const view = params.get("view") ?? "chase";
const onMeadow = params.get("where") === "meadow";
const along = Number(params.get("at") ?? 1 / 3);

const stage = document.getElementById("stage") as HTMLCanvasElement;
const sheet = document.getElementById("sheet") as HTMLCanvasElement;
const renderer = createWorldRenderer(stage, {
  video: withPreset(DEFAULT_VIDEO, tier),
  preserveDrawingBuffer: true,
});
renderer.resize(cellW, cellH, 1);
const first: GameState = createGame({ seed, region, mode: "free", rivals: 0, quiet: true });
const level = first.level;
const DEG = Math.PI / 180;
const FRAME = 1 / 60;

/** Where the lens stands for `name`, in the skier's own heading frame (x
 * to his right, ahead, up off the snow under the point); null is the
 * game's own chase camera. */
function viewOf(name: string, state: GameState): LensPose | null {
  const s = state.skier;
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  const at = (f: number, r: number, up: number) => {
    const x = s.x + fx * f + fz * r;
    const z = s.z + fz * f - fx * r;
    return { x, y: level.groundAt(x, z) + up, z };
  };
  switch (name) {
    case "low":
      return { eye: at(-4.2, 1.1, 0.45), target: at(0.4, 0, 0.45), fov: 42, roll: 0 };
    case "behind":
      return { eye: at(-5.5, 0, 1.7), target: at(0, 0, 0.8), fov: 38, roll: 0 };
    case "side":
      return { eye: at(0, 6, 0.9), target: at(0, 0, 0.8), fov: 38, roll: 0 };
    case "front":
      return { eye: at(6, 1.6, 1.2), target: at(0, 0, 0.8), fov: 38, roll: 0 };
    case "high":
      return { eye: at(-3, 4, 7), target: at(0.5, 0, 0.3), fov: 42, roll: 0 };
    default:
      return null;
  }
}

type Row = { move: HoldMove; kmh: number };
const rows: Row[] = [];
for (const move of moves) for (const kmh of speeds) rows.push({ move, kmh });

const TITLES: Partial<Record<HoldMove, string>> = {
  turn: "ONE TURN",
  carve: "LINKED CARVES",
  skid: "SKIDDED TURN",
  stop: "HOCKEY STOP",
  check: "CHECKS",
  straight: "STRAIGHT",
};

/** What a cell says: the moment, the speed, the inclination, each ski's
 * share of the load and its gap to the snow (`ski-stand.ts`). */
function readout(state: GameState, t: number): string[] {
  const s = state.skier;
  const ground = s.airborne ? 0 : 1;
  const stand = standOf(s, ground);
  const gap = skiGaps(s, stand, level);
  const pc = (v: number) => `${Math.round(v * 100)}`;
  const cm = (v: number) => `${Math.round(v * 100)}`;
  return [
    `${t.toFixed(1)} s · ${(s.speed * 3.6).toFixed(0)} km/h · incl ${(s.incline / DEG).toFixed(0)}°`,
    `load L ${pc(stand.share[0])}% R ${pc(stand.share[1])}% · gap L ${cm(gap[0])} R ${cm(gap[1])} cm`,
  ];
}

let spot = { x: 0, z: 0, heading: 0 };

window.__turns = {
  ready: (async () => {
    await renderer.load(first);
    const m = onMeadow ? meadow(level) : null;
    // On the meadow, down its fall line where it has one.
    const n = { x: 0, y: 1, z: 0 };
    if (m) level.normalAt(m.x, m.z, n);
    const fall = Math.hypot(n.x, n.z) > 0.05 ? Math.atan2(n.x, n.z) : 0;
    spot = m ? { x: m.x, z: m.z, heading: fall } : pisteSpot(level, along);
  })(),
  async sheet() {
    const labelW = 150;
    const headH = 34;
    sheet.width = labelW + cellW * times.length;
    sheet.height = headH + cellH * rows.length;
    const ctx = sheet.getContext("2d")!;
    ctx.fillStyle = "#0b1116";
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.fillStyle = "#e8eef4";
    ctx.font = "12px monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `TURNS · seed ${seed}${region ? ` ${region}` : ""} · ${onMeadow ? "meadow" : `piste ${(along * 100).toFixed(0)}% down`} at ${spot.x.toFixed(0)},${spot.z.toFixed(0)} · ${view.toUpperCase()} · ${tier}`,
      8,
      10,
    );
    times.forEach((t, c) => ctx.fillText(`${t} s`, labelW + c * cellW + 6, 26));
    const sky: SkyOverride = { weather: "clear", hour: hourAt(level, 16 * DEG) };
    renderer.setSky(sky);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const y0 = headH + r * cellH;
      const state = createGame({ level, mode: "free", rivals: 0, quiet: true });
      placeRun(state, { x: spot.x, z: spot.z, heading: spot.heading, speed: row.kmh / 3.6 });
      const t0 = state.t;
      renderer.setOverride(null);
      renderer.setCamera("chase", true);
      renderer.draw(state, 0, FRAME, false);
      await renderer.shadeSettled();
      for (let c = 0; c < times.length; c++) {
        while (state.t - t0 < times[c]) {
          for (let i = 0; i < 2; i++) {
            step(state, holdInput(state, row.kmh, spot.heading, row.move, state.t - t0));
          }
          renderer.draw(state, 0, FRAME, false);
        }
        renderer.setOverride(viewOf(view, state));
        renderer.draw(state, 0, 0, true);
        const x0 = labelW + c * cellW;
        ctx.drawImage(stage, x0, y0, cellW, cellH);
        renderer.setOverride(null);
        // The readout over the foot of the cell.
        ctx.fillStyle = "rgba(11,17,22,0.72)";
        ctx.fillRect(x0, y0 + cellH - 36, cellW, 36);
        ctx.fillStyle = "#e8eef4";
        readout(state, state.t - t0).forEach((l, i) =>
          ctx.fillText(l, x0 + 6, y0 + cellH - 26 + i * 15),
        );
      }
      ctx.fillStyle = "#e8eef4";
      [TITLES[row.move] ?? row.move.toUpperCase(), `FROM ${row.kmh} KM/H`].forEach((l, i) =>
        ctx.fillText(l, 8, y0 + cellH / 2 - 8 + i * 16),
      );
      await new Promise((done) => setTimeout(done, 0));
    }
    renderer.setSky(null);
    renderer.setOverride(null);
    return {
      rows: rows.length,
      cols: times.length,
      note: `${moves.join("/")} × ${speeds.join("/")} km/h from ${view}`,
      w: sheet.width,
      h: sheet.height,
    };
  },
};
