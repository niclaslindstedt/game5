// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIS UNDER THE SNOW — the snow eval lab's `under` sheet
// (`make snow-eval ARGS=--under`): a ski must never sink out of sight under
// the snow drawn round it. Each scene is ridden through the game's own
// renderer at every TERRAIN and TRAILS stop, and at moments of the ride the
// player's own chase lens measures how far each ski's tip, middle and tail
// stand under the drawn snow (`snow-under.ts`), at the bottom and the top
// RESOLUTION stop (the rows differ only in the pixels the depth is read
// at: the geometry is the same). A table of the worst and mean gaps and a
// sheet of the chase frames come back.

import {
  createGame,
  pairById,
  placeRun,
  step,
  type GameState,
  type Level,
  type SkierInput,
} from "@engine";

import { holdInput, type HoldMove } from "../game/hold-input.ts";
import type { WorldRendererExt as WorldRenderer } from "../game/renderer.ts";
import type { UnderPoint } from "../game/snow-under.ts";
import {
  DEFAULT_VIDEO,
  TIERS,
  TRAIL_LEVELS,
  withPreset,
  type ResolutionLevel,
  type Tier,
  type TrailLevel,
} from "../game/settings-video.ts";
import { meadow, pisteSpot } from "./stage.ts";

const FRAME = 1 / 60;

export type UnderScene = {
  id: string;
  title: string;
  skis: string;
  depth: number;
  kmh: number;
  move: HoldMove;
  /** Where: a fraction down the piste, the meadow, or a spot of the map's. */
  spot: (level: Level) => { x: number; z: number; heading: number };
};

/** Down the fall line from a spot of the map. */
function fallFrom(x: number, z: number) {
  return (level: Level) => {
    const n = { x: 0, y: 1, z: 0 };
    level.normalAt(x, z, n);
    return { x, z, heading: Math.hypot(n.x, n.z) > 0.02 ? Math.atan2(n.x, n.z) : 0 };
  };
}

export const UNDER_SCENES: UnderScene[] = [
  {
    id: "groomer",
    title: "GROOMER · 130 km/h",
    skis: "chamois",
    depth: 1,
    kmh: 130,
    move: "straight",
    spot: (level) => pisteSpot(level, 0.3),
  },
  {
    // The spot of the report this lab was built for: seed 38's fall line
    // past the chair at 132 km/h.
    id: "report",
    title: "x 1700 z 852 · 132 km/h",
    skis: "chamois",
    depth: 1,
    kmh: 132,
    move: "straight",
    spot: fallFrom(1700, 852),
  },
  {
    id: "carve",
    title: "CARVE · GROOMER · 50",
    skis: "chamois",
    depth: 1,
    kmh: 50,
    move: "carve",
    spot: (level) => pisteSpot(level, 0.45),
  },
  {
    id: "powder",
    title: "POWDER · 60 km/h",
    skis: "chamois",
    depth: 2,
    kmh: 60,
    move: "straight",
    spot: (level) => {
      const m = meadow(level);
      return fallFrom(m.x, m.z)(level);
    },
  },
  {
    id: "powder-carve",
    title: "POWDER CARVE · 40",
    skis: "chamois",
    depth: 2,
    kmh: 40,
    move: "carve",
    spot: (level) => {
      const m = meadow(level);
      const f = fallFrom(m.x, m.z)(level);
      return { ...f, x: f.x + Math.cos(f.heading) * 25, z: f.z - Math.sin(f.heading) * 25 };
    },
  },
];

/** The moments measured, s into the ride. */
const MOMENTS = [0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0];
const RESOLUTIONS: ResolutionLevel[] = ["low", "high"];

export type UnderStat = { worst: number; mean: number; n: number };
export type UnderRow = {
  scene: string;
  terrain: Tier;
  trails: TrailLevel;
  resolution: ResolutionLevel;
  /** Per station (tip, mid, tail): the worst and the mean gap, m (positive
   * under the snow), over both skis and every moment read. */
  tip: UnderStat;
  mid: UnderStat;
  tail: UnderStat;
  /** The share of readings more than 2 cm under the drawn snow. */
  hidden: number;
};

export type UnderLab = {
  renderer: WorldRenderer;
  level: Level;
  stage: HTMLCanvasElement;
  sheet: HTMLCanvasElement;
  cellW: number;
  cellH: number;
  loaded(state: GameState): Promise<void>;
};

function stat(values: number[]): UnderStat {
  if (values.length === 0) return { worst: Number.NaN, mean: Number.NaN, n: 0 };
  let worst = -Infinity;
  let sum = 0;
  for (const v of values) {
    worst = Math.max(worst, v);
    sum += v;
  }
  return { worst, mean: sum / values.length, n: values.length };
}

/** Ride every scene at every TERRAIN × TRAILS stop, measuring at both
 * RESOLUTION ends; one chase frame a scene and TRAILS stop at TERRAIN HIGH
 * for the sheet. */
export async function underSheet(
  lab: UnderLab,
  only: readonly string[],
): Promise<{ w: number; h: number; rows: UnderRow[] }> {
  const { renderer, level, stage, sheet, cellW, cellH } = lab;
  const scenes = UNDER_SCENES.filter((s) => only.length === 0 || only.includes(s.id));
  const labelW = 170;
  const headH = 34;
  sheet.width = labelW + cellW * TRAIL_LEVELS.length;
  sheet.height = headH + cellH * scenes.length;
  const ctx = sheet.getContext("2d")!;
  ctx.fillStyle = "#0b1116";
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.font = "12px monospace";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e8eef4";
  ctx.fillText(
    "SKIS UNDER THE DRAWN SNOW · chase lens · TERRAIN HIGH · worst cm (tip/mid/tail)",
    8,
    10,
  );
  TRAIL_LEVELS.forEach((t, c) =>
    ctx.fillText(`TRAILS ${t.toUpperCase()}`, labelW + c * cellW + 6, 26),
  );
  const rows: UnderRow[] = [];
  const top = withPreset(DEFAULT_VIDEO, "high");
  for (let r = 0; r < scenes.length; r++) {
    const scene = scenes[r];
    const y0 = headH + r * cellH;
    ctx.fillStyle = "#e8eef4";
    ctx.fillText(scene.title, 8, y0 + cellH / 2 - 8);
    ctx.fillText(`${scene.skis} · snow ${scene.depth}`, 8, y0 + cellH / 2 + 8);
    for (const terrain of TIERS) {
      for (const trails of TRAIL_LEVELS) {
        const got = new Map<ResolutionLevel, UnderPoint[]>();
        for (const res of RESOLUTIONS) got.set(res, []);
        const shoot = terrain === "high";
        const state = createGame({
          level,
          mode: "free",
          rivals: 0,
          quiet: true,
          crowd: 0,
          enthusiasts: 0,
          spec: pairById(scene.skis),
          snowDepth: scene.depth,
        });
        renderer.setVideo({ ...top, terrain, trails, resolution: "high" });
        await lab.loaded(state);
        const spot = scene.spot(level);
        placeRun(state, { x: spot.x, z: spot.z, heading: spot.heading, speed: scene.kmh / 3.6 });
        renderer.setOverride(null);
        renderer.setCamera("chase", true);
        renderer.draw(state, 0, FRAME, false);
        const t0 = state.t;
        const input = (): SkierInput =>
          holdInput(state, scene.kmh, spot.heading, scene.move, state.t - t0);
        let k = 0;
        let last: UnderPoint[] = [];
        // The sheet's frame: the first moment measured from the second-last
        // on (a moment in the air is skipped, and the frame with it).
        let shot = false;
        while (k < MOMENTS.length && state.t - t0 < 10) {
          step(state, input());
          step(state, input());
          renderer.draw(state, 0, FRAME, false);
          if (state.t - t0 < MOMENTS[k]) continue;
          k++;
          if (state.skier.thrown || state.skier.airborne) continue;
          for (const res of RESOLUTIONS) {
            renderer.setVideo({ ...top, terrain, trails, resolution: res });
            renderer.draw(state, 0, 0, true);
            const pts = await renderer.skisUnder();
            got.get(res)!.push(...pts);
            if (res === "high") last = pts;
          }
          if (shoot && !shot && k >= MOMENTS.length - 2) {
            shot = true;
            renderer.draw(state, 0, 0, true);
            const x0 = labelW + TRAIL_LEVELS.indexOf(trails) * cellW;
            ctx.drawImage(stage, x0, y0, cellW, cellH);
            const w = (at: string) => {
              const v = last.filter((p) => p.at === at && Number.isFinite(p.under));
              return v.length ? (Math.max(...v.map((p) => p.under)) * 100).toFixed(1) : "–";
            };
            ctx.fillStyle = "rgba(11,17,22,0.7)";
            ctx.fillRect(x0, y0 + cellH - 20, cellW, 20);
            ctx.fillStyle = "#e8eef4";
            ctx.fillText(
              `under ${w("tip")}/${w("mid")}/${w("tail")} cm · ${(state.skier.speed * 3.6).toFixed(0)} km/h`,
              x0 + 6,
              y0 + cellH - 10,
            );
          }
        }
        for (const res of RESOLUTIONS) {
          const pts = got.get(res)!.filter((p) => Number.isFinite(p.under));
          const by = (at: string) => stat(pts.filter((p) => p.at === at).map((p) => p.under));
          rows.push({
            scene: scene.id,
            terrain,
            trails,
            resolution: res,
            tip: by("tip"),
            mid: by("mid"),
            tail: by("tail"),
            hidden: pts.length ? pts.filter((p) => p.under > 0.02).length / pts.length : 0,
          });
        }
        await new Promise((done) => setTimeout(done, 0));
      }
    }
  }
  renderer.setVideo(top);
  return { w: sheet.width, h: sheet.height, rows };
}
