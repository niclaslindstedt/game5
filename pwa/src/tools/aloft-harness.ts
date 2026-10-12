// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ALOFT LAB's page (driven by `scripts/aloft-preview.mjs`): how much of
// the map a lens HIGH OVER THE SNOW sees at each DISTANCE stop, and what
// that costs a frame. A grid of lenses — a row a height over the snow, a
// column a DISTANCE stop — each stood over the ski area's base and looking
// up its mountain to the summit, as a craft climbing out of the valley
// would, drawn through the game's own renderer (`renderer.setOverride`).
//
// Beside each frame its numbers: the draw calls and triangles (the shadow
// pass's included), the ground's and the woods' triangles out of the scene
// walked (`sceneTally`), and the processor's milliseconds for the frame's
// WORLD phase (the ground re-centred, the woods culled — the half the reach
// costs the CPU) off the renderer's own counters (`cost()`). A software
// rasterizer prices nothing on the card, so those are structure, not a GPU
// price.

import { createGame, loadRealFace, type GameState } from "@engine";

import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import type { LensPose } from "../game/camera-rigs.ts";
import {
  DEFAULT_VIDEO,
  DISTANCE_LEVELS,
  TIERS,
  withPreset,
  type DistanceLevel,
  type Tier,
} from "../game/settings-video.ts";

/** One frame's numbers. */
export type AloftRow = {
  distance: DistanceLevel;
  /** The lens's height over the snow under it, m. */
  over: number;
  calls: number;
  triangles: number;
  /** The ground's triangles and the woods', thousands. */
  terrain: number;
  forest: number;
  /** The processor's ms for the frame's world phase, the median of the timed frames. */
  worldMs: number;
  /** The processor's ms for the whole of `draw`, its median. */
  frameMs: number;
};

declare global {
  interface Window {
    __aloft?: {
      ready: Promise<void>;
      sheet(): Promise<{ cells: number }>;
      rows(): AloftRow[];
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const face = params.get("face") ?? undefined;
if (face && !(await loadRealFace(face))) throw new Error(`no real face ${face}`);
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "low";
const cellW = Number(params.get("w") ?? 480);
const cellH = Number(params.get("h") ?? 270);
const timed = Math.max(1, Number(params.get("frames") ?? 5));
const distances = (params.get("distances") || DISTANCE_LEVELS.join(","))
  .split(",")
  .filter((d): d is DistanceLevel => (DISTANCE_LEVELS as readonly string[]).includes(d));
const heights = (params.get("heights") || "2,60,200,600,1500").split(",").map(Number);

const FRAME = 1 / 60;
const stage = document.getElementById("stage") as HTMLCanvasElement;
const sheet = document.getElementById("sheet") as HTMLCanvasElement;
await loadModels();
const video = withPreset(DEFAULT_VIDEO, tier);
const renderer = createWorldRenderer(stage, { video, preserveDrawingBuffer: true });
renderer.resize(cellW, cellH, 1);
const state: GameState = createGame({
  seed,
  ...(face ? { face } : {}),
  mode: "free",
  rivals: 0,
  quiet: true,
});
const level = state.level;
let filled: AloftRow[] = [];

/** THE LENS: `over` m above the snow at the ski area's base, pulled a
 * little down the valley, looking at the summit — the climb out of the
 * valley a craft makes. */
function lensAt(over: number): LensPose {
  const m = level.mountain ?? {
    summit: { x: level.size / 2, z: level.size * 0.1, y: 0 },
    base: { x: level.size / 2, z: level.size * 0.9, y: 0 },
  };
  const dx = m.base.x - m.summit.x;
  const dz = m.base.z - m.summit.z;
  const run = Math.hypot(dx, dz) || 1;
  const x = Math.min(level.size, Math.max(0, m.base.x + (dx / run) * 160));
  const z = Math.min(level.size, Math.max(0, m.base.z + (dz / run) * 160));
  const y = level.groundAt(x, z) + over;
  const target = { x: m.summit.x, z: m.summit.z, y: level.groundAt(m.summit.x, m.summit.z) };
  // A lens on the snow looks up the hill over the snow ahead of it.
  if (over < 20) target.y = Math.max(target.y, y);
  return { eye: { x, y, z }, target, fov: 60, roll: 0 };
}

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[xs.length >> 1] ?? 0;

window.__aloft = {
  ready: renderer.load(state),
  async sheet() {
    const labelW = 0;
    const headH = 22;
    sheet.width = labelW + cellW * distances.length;
    sheet.height = headH + cellH * heights.length;
    const ctx = sheet.getContext("2d")!;
    ctx.fillStyle = "#0b1116";
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.font = "13px monospace";
    ctx.fillStyle = "#e8eef2";
    distances.forEach((d, i) => ctx.fillText(`DISTANCE ${d.toUpperCase()}`, i * cellW + 8, 16));
    filled = [];
    for (let i = 0; i < distances.length; i++) {
      const distance = distances[i];
      renderer.setVideo({ ...video, distance });
      for (let j = 0; j < heights.length; j++) {
        const over = heights[j];
        renderer.setOverride(lensAt(over));
        // Settle: the woods dissolve into their cuts over a moment, and
        // anything first drawn here compiles its program before the timing.
        for (let k = 0; k < 30; k++) renderer.draw(state, 0, FRAME, k % 3 === 2);
        await renderer.shadeSettled();
        const world: number[] = [];
        const whole: number[] = [];
        for (let k = 0; k < timed; k++) {
          renderer.draw(state, 0, FRAME, true);
          const c = renderer.cost();
          world.push(c.worldMs);
          whole.push(c.frameMs);
        }
        const c = renderer.cost();
        const tally = renderer.sceneTally();
        const tri = (name: string): number =>
          tally.filter((s) => s.name === name).reduce((sum, s) => sum + s.triangles, 0) / 1000;
        const row: AloftRow = {
          distance,
          over,
          calls: c.calls,
          triangles: c.triangles,
          terrain: tri("terrain"),
          forest: tri("forest"),
          worldMs: median(world),
          frameMs: median(whole),
        };
        filled.push(row);
        const x0 = labelW + i * cellW;
        const y0 = headH + j * cellH;
        ctx.drawImage(stage, x0, y0, cellW, cellH);
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(x0, y0, cellW, 38);
        ctx.fillStyle = "#e8eef2";
        ctx.fillText(
          `${over} m up · ${c.calls} calls · ${(c.triangles / 1000).toFixed(0)}k tris`,
          x0 + 6,
          y0 + 15,
        );
        ctx.fillText(
          `ground ${row.terrain.toFixed(0)}k · woods ${row.forest.toFixed(0)}k · world ${row.worldMs.toFixed(1)} ms`,
          x0 + 6,
          y0 + 31,
        );
      }
    }
    renderer.setOverride(null);
    return { cells: filled.length };
  },
  rows: () => filled,
};
