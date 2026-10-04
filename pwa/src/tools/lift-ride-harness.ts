// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFT RIDE LAB's page (`scripts/lift-ride-preview.mjs`): a free ride
// stood up on a lift (the chair, or the lift serving `?run=`) as the app
// stands one up (`createGame`'s
// `mode: "free"`, `byLift`), carried to the top, stood off on the ramp and
// led away onto its run — drawn through the game's own renderer and camera
// every sixtieth of a second, so the lens's springs are the springs a player
// sees, and photographed at moments set round the unload into one contact
// sheet. A camera is judged on how it FOLLOWS, which no single jumped-to
// frame can show: the run is never cut.
//
// It exposes `window.__liftRide.sheet()`, which rides the whole sequence
// and lays the tiles out on the page for the driver to photograph.

import { createGame, NEUTRAL_INPUT, step, TUNING, type GameState, type RegionId } from "@engine";

import type { Rung } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";

declare global {
  interface Window {
    __liftRide?: {
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
/** A spot to ride up to (`x,z`), the map's start when left out. */
const spot = (params.get("spot") ?? "").split(",").map(Number);
/** The run to ride up to (`freeRunOf`), on whatever lift serves it. */
const run = params.get("run") ?? undefined;
/** Seconds round the unload to photograph at: negative on the lift. */
const moments = (params.get("at") ?? "-2.5,-1.5,-0.5,0.5,1.5,3,5,8,12,16,20,25")
  .split(",")
  .map(Number)
  .filter(Number.isFinite);
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);
const cols = Number(params.get("cols") ?? 3);
const scale = Number(params.get("scale") ?? 0.5);

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

function standUp(): GameState {
  return createGame({
    seed,
    region,
    mode: "free",
    byLift: true,
    run,
    quiet: true,
    ...(spot.length === 2 && spot.every(Number.isFinite)
      ? { spawn: { x: spot[0], z: spot[1] } }
      : {}),
  });
}

/** When the chair lets him go, s on the run's clock — found by riding the
 * same deterministic run once with nothing drawn. */
function unloadAt(): number {
  const dry = standUp();
  const limit = 240;
  while (dry.t < limit) {
    step(dry, NEUTRAL_INPUT);
    for (const e of dry.events) if (e.kind === "lift" && e.phase === "off") return e.t;
  }
  return NaN;
}

const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);

async function sheet(): Promise<{ note: string; tiles: number }> {
  const off = unloadAt();
  if (!Number.isFinite(off)) return { note: "the chair never unloaded", tiles: 0 };
  const state = standUp();
  await renderer.load(state);
  renderer.setCamera(rung, true);
  const times = moments
    .map((m) => off + m)
    .filter((t) => t >= 0)
    .sort((a, b) => a - b);
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  sheetEl.replaceChildren();
  let next = 0;
  while (next < times.length) {
    for (let i = 0; i < STEPS; i++) step(state, NEUTRAL_INPUT);
    const due = state.t >= times[next];
    renderer.draw(state, 0, FRAME, due);
    if (!due) continue;
    const cell = document.createElement("figure");
    const tile = document.createElement("canvas");
    tile.width = tw;
    tile.height = th;
    tile.getContext("2d")?.drawImage(canvas, 0, 0, tw, th);
    const ride = state.skier.lift;
    const caption = document.createElement("figcaption");
    const since = state.t - off;
    caption.textContent =
      `${since >= 0 ? "+" : ""}${since.toFixed(1)} s  ` +
      `${ride ? `${ride.kind} ${ride.phase}` : "skiing"}  ` +
      `${(state.skier.speed * 3.6).toFixed(0)} km/h`;
    cell.append(tile, caption);
    sheetEl.append(cell);
    next++;
  }
  canvas.style.display = "none";
  return {
    note: `seed ${seed}${region ? ` ${region}` : ""}${run ? ` run ${run}` : ""}, ${rung}, unloaded at ${off.toFixed(1)} s`,
    tiles: times.length,
  };
}

window.__liftRide = { ready: Promise.resolve(), sheet };
