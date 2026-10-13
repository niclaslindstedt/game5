// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CABLE GRIND LAB's page (`scripts/grind-preview.mjs`): a free ride with
// the skier (or the rider, `?skis=lynx`) dropped onto a lift's rope half way
// up its line, then ridden on a script — the 50-50 down the rope, a tap of
// the edge into a slide, a press, the jump let go and a 360 in the air, back
// down onto the rope, and on until a carrier comes along it and throws him
// off — drawn through the game's own renderer every sixtieth of a second and
// photographed a row a lens (`?views=`: `side`, `back`, `front`, `top`, the
// game's own `chase`), a column a moment (`?at=`).
//
// It exposes `window.__grind.sheet()`, which rides the whole script and lays
// the tiles out on the page for the driver to photograph.

import {
  createGame,
  liftPlans,
  NEUTRAL_INPUT,
  ropeOver,
  step,
  standSkier,
  TUNING,
  type GameState,
  type LiftKind,
  type RegionId,
  type SkierInput,
} from "@engine";

import type { Rung } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { labPair } from "./lab-pair.ts";

declare global {
  interface Window {
    __grind?: {
      ready: Promise<void>;
      sheet(): Promise<{ note: string; tiles: number }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const region = (params.get("region") ?? undefined) as RegionId | undefined;
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const rung = (params.get("camera") ?? "chase") as Rung;
const kind = (params.get("lift") ?? "chair") as LiftKind;
const moments = (params.get("at") ?? "0.3,0.9,1.3,1.75,2.1,2.6,4")
  .split(",")
  .map(Number)
  .filter(Number.isFinite);
const views = (params.get("views") ?? "side,back,front,chase").split(",");
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);
const scale = Number(params.get("scale") ?? 0.3);
const pair = labPair(params);

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

/** The run dropped onto the down rope of the map's first lift of `kind`. */
function dropped(): GameState | null {
  const state = createGame({
    seed,
    region,
    mode: "free",
    quiet: true,
    ...(pair ? { spec: pair } : {}),
  });
  const plan = liftPlans(state.level).find((p) => p.lift.kind === kind);
  if (!plan) return null;
  const p = ropeOver(plan, 1, plan.length * 0.5);
  standSkier(state, p.x, p.z, plan.heading + Math.PI);
  const c = state.skier;
  c.y = p.y + c.spec.cogHeight + 0.2;
  c.vx = -plan.dx * 5;
  c.vz = -plan.dz * 5;
  c.vy = -1;
  c.airborne = true;
  return state;
}

/** THE SCRIPT, s from the drop: the edge tapped into a slide at 0.6, the
 * lean pressed at 1, the jump held and let go at 1.6 with the edge held
 * over for a spin, then nothing until a carrier takes him. */
function scripted(t: number): SkierInput {
  const tap = t >= 0.6 && t < 0.68;
  const press = t >= 1 && t < 1.4;
  const jump = t >= 1.45 && t < 1.6;
  const spin = t >= 1.65 && t < 1.95;
  return {
    ...NEUTRAL_INPUT,
    steer: tap || spin ? 1 : 0,
    lean: press ? 0.8 : 0,
    jump,
  };
}

/** A lens planted round the rider in the LIFT LINE's frame (`u` up the
 * line, `v` right of it). */
const LINE_VIEWS: Record<string, { u: number; v: number; y: number; fov: number }> = {
  side: { u: 0, v: -5, y: 0.4, fov: 50 },
  back: { u: 5, v: -0.6, y: 1.2, fov: 50 },
  front: { u: -5, v: -0.6, y: 0.8, fov: 50 },
  top: { u: 0.5, v: -0.4, y: 7, fov: 50 },
};

const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);

async function sheet(): Promise<{ note: string; tiles: number }> {
  const state = dropped();
  if (!state) return { note: `no ${kind} on this map`, tiles: 0 };
  const plan = liftPlans(state.level).find((p) => p.lift.kind === kind)!;
  await renderer.load(state);
  renderer.setCamera(rung, true);
  const times = moments.slice().sort((a, b) => a - b);
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${times.length}, ${tw}px)`;
  sheetEl.replaceChildren();
  const cells: HTMLElement[][] = views.map(() => []);
  const t0 = state.t;
  let next = 0;
  let thrownAt = NaN;
  while (next < times.length && state.t - t0 < 30) {
    for (let i = 0; i < STEPS; i++) {
      step(state, scripted(state.t - t0));
      if (state.skier.thrown && Number.isNaN(thrownAt)) thrownAt = state.t - t0;
    }
    renderer.setOverride(null);
    const due = state.t - t0 >= times[next];
    renderer.draw(state, 0, FRAME, false);
    if (!due) continue;
    const c = state.skier;
    views.forEach((v, row) => {
      const lv = LINE_VIEWS[v];
      if (lv) {
        const rx = c.x - plan.lift.bottom.x;
        const rz = c.z - plan.lift.bottom.z;
        const u = rx * plan.dx + rz * plan.dz + lv.u;
        const side = rx * plan.dz - rz * plan.dx + lv.v;
        const eye = {
          x: plan.lift.bottom.x + plan.dx * u + plan.dz * side,
          y: c.y + lv.y,
          z: plan.lift.bottom.z + plan.dz * u - plan.dx * side,
        };
        renderer.setOverride({
          eye,
          target: { x: c.x, y: c.y - 0.3, z: c.z },
          fov: lv.fov,
          roll: 0,
        });
      } else renderer.setOverride(null);
      renderer.draw(state, 0, 0, true);
      const cell = document.createElement("figure");
      const tile = document.createElement("canvas");
      tile.width = tw;
      tile.height = th;
      tile.getContext("2d")?.drawImage(canvas, 0, 0, tw, th);
      const caption = document.createElement("figcaption");
      const g = c.grind;
      caption.textContent =
        `${v}  ${(state.t - t0).toFixed(2)} s  ` +
        `${g ? `grind ${Math.round((g.yaw * 180) / Math.PI)}°` : c.thrown ? "thrown" : c.airborne ? "air" : "snow"}  ` +
        `${state.tricks.base > 0 ? `${Math.round(state.tricks.base)}×${state.tricks.mult}` : ""}`;
      cell.append(tile, caption);
      cells[row].push(cell);
    });
    renderer.setOverride(null);
    next++;
  }
  for (const row of cells) sheetEl.append(...row);
  canvas.style.display = "none";
  return {
    note: `seed ${seed}${region ? ` ${region}` : ""}, the ${kind}'s down rope, ${views.join("/")}${Number.isNaN(thrownAt) ? "" : `, thrown at ${thrownAt.toFixed(1)} s`}`,
    tiles: next * views.length,
  };
}

window.__grind = { ready: Promise.resolve(), sheet };
