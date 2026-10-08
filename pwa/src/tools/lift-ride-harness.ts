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
// With `?board=drag|gondola|chair` it photographs THE OTHER END instead:
// the skier rolled into the lift's boarding ring at its foot, skating up
// the queue's lane past the crowd queued on it (shouldering them aside),
// and taken — waiting on a drag's track for his T-bar and sat back onto it
// as it comes, or faded through a gondola's door or a chair's load line
// and faded back in on him sat in his carrier — the moments set in
// seconds from the ring.
//
// It exposes `window.__liftRide.sheet()`, which rides the whole sequence
// and lays the tiles out on the page for the driver to photograph.

import {
  createGame,
  liftPlans,
  NEUTRAL_INPUT,
  step,
  TUNING,
  type GameState,
  type LiftKind,
  type RegionId,
} from "@engine";

import type { Rung } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import {
  atFoot as stageAt,
  stageOf,
  stageState,
  stageWindow,
  STAGES,
  type StageId,
} from "./lift-stage.ts";

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
const moments = (
  params.get("at") ??
  (params.get("board")
    ? "0.5,2,3.5,5,6.5,8,9.5,11,12.5,14,16,19"
    : "-2.5,-1.5,-0.5,0.5,1.5,3,5,8,12,16,20,25")
)
  .split(",")
  .map(Number)
  .filter(Number.isFinite);
/** A lens planted round the skier in his own frame instead of the game's
 * camera — `side` (off his left), `rside` (off his right), `back`,
 * `front` — close enough to judge a pose by. */
const view = params.get("view") ?? "";
const VIEWS: Record<string, { x: number; y: number; z: number }> = {
  side: { x: -2.6, y: 0.4, z: 0.2 },
  rside: { x: 2.6, y: 0.4, z: 0.2 },
  back: { x: 0.4, y: 0.6, z: -3 },
  front: { x: 0.3, y: 0.5, z: 3 },
};
/** How he rolls into the boarding ring: `lane` up the queue's lane from
 * beyond the corral, facing in; `wrong` from the corral's side of the
 * ring, facing away from it — the way he must turn round to go in; `side`
 * across the lane, facing across it. */
const approach = params.get("approach") ?? "lane";
/** The lift whose foot is photographed boarding, by kind. */
const board = (params.get("board") ?? "") as LiftKind | "";
/** THE STRIPS (`?strip=`): one stage of getting on or off a lift
 * (`lift-stage.ts`), filmed frame by frame — a row a lens (`?views=`), a
 * column a moment, `?frames=` of them evenly over the stage's window. */
const strip = (params.get("strip") ?? "") as StageId | "";
const stripViews = (params.get("views") ?? "side,back,chase").split(",");
const stripFrames = Number(params.get("frames") ?? 10);
const stripBefore = Number(params.get("before") ?? 3);
const stripAfter = Number(params.get("after") ?? 4);
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

/** A free ride stood at a lift's foot (`lift-stage.ts`'s `atFoot`). */
function atFoot(kind: LiftKind): GameState | null {
  return stageAt(seed, region, kind, approach);
}

async function boardSheet(kind: LiftKind): Promise<{ note: string; tiles: number }> {
  const state = atFoot(kind);
  if (!state) return { note: `no ${kind} on this map`, tiles: 0 };
  await renderer.load(state);
  renderer.setCamera(rung, true);
  const times = moments.filter((t) => t >= 0).sort((a, b) => a - b);
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  sheetEl.replaceChildren();
  let next = 0;
  let took = NaN;
  while (next < times.length) {
    for (let i = 0; i < STEPS; i++) {
      step(state, NEUTRAL_INPUT);
      for (const e of state.events) if (e.kind === "lift" && e.phase === "take") took = e.t;
    }
    const due = state.t >= times[next];
    const planted = VIEWS[view];
    if (planted) {
      const c = state.skier;
      const h = c.heading;
      const cos = Math.cos(h);
      const sin = Math.sin(h);
      // x right, z forward, turned to his heading (0 = +z, clockwise).
      const eye = {
        x: c.x + planted.x * cos + planted.z * sin,
        y: c.y + planted.y,
        z: c.z - planted.x * sin + planted.z * cos,
      };
      renderer.setOverride({ eye, target: { x: c.x, y: c.y - 0.2, z: c.z }, fov: 50, roll: 0 });
    }
    renderer.draw(state, 0, FRAME, due);
    if (!due) continue;
    const cell = document.createElement("figure");
    const tile = document.createElement("canvas");
    tile.width = tw;
    tile.height = th;
    tile.getContext("2d")?.drawImage(canvas, 0, 0, tw, th);
    const ride = state.skier.lift;
    const caption = document.createElement("figcaption");
    caption.textContent =
      `${state.t.toFixed(1)} s  ` +
      `${ride ? `${ride.kind} ${ride.phase}` : "skiing"}  ` +
      `${(state.skier.speed * 3.6).toFixed(0)} km/h`;
    cell.append(tile, caption);
    sheetEl.append(cell);
    next++;
  }
  canvas.style.display = "none";
  return {
    note: `seed ${seed}${region ? ` ${region}` : ""}, boarding a ${kind}, ${rung}, taken at ${took.toFixed(1)} s`,
    tiles: times.length,
  };
}

/** A lens planted round the rider in the LIFT LINE's frame (`u` up the
 * line, `v` right of it), for a strip: off the line's right side, from
 * behind down the line, from ahead up it, or high over him. */
const LINE_VIEWS: Record<string, { u: number; v: number; y: number; fov: number }> = {
  side: { u: 2.5, v: 6, y: 0.6, fov: 50 },
  lside: { u: 2.5, v: -6, y: 0.6, fov: 50 },
  back: { u: -6, v: 1.2, y: 1.4, fov: 46 },
  front: { u: 6, v: 1.2, y: 1.0, fov: 46 },
  top: { u: -0.5, v: 0.4, y: 9, fov: 50 },
};

async function stripSheet(id: StageId): Promise<{ note: string; tiles: number }> {
  if (!(STAGES as readonly string[]).includes(id)) return { note: `no stage ${id}`, tiles: 0 };
  const win = stageWindow(id, seed, region, { before: stripBefore, after: stripAfter });
  const state = stageState(id, seed, region);
  if (!win || !state) return { note: `${id}: no such lift on this map`, tiles: 0 };
  const plan = liftPlans(state.level).find((p) => p.lift.kind === stageOf(id).kind)!;
  await renderer.load(state);
  renderer.setCamera(rung, true);
  const n = Math.max(2, stripFrames);
  const times = Array.from({ length: n }, (_, i) => win.from + ((win.to - win.from) * i) / (n - 1));
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${n}, ${tw}px)`;
  sheetEl.replaceChildren();
  const cells: HTMLElement[][] = stripViews.map(() => []);
  let next = 0;
  // Warmed up a second before the window, so every spring has settled.
  const warm = Math.max(0, win.from - 1.5);
  while (next < times.length) {
    for (let i = 0; i < STEPS; i++) step(state, NEUTRAL_INPUT);
    if (state.t < warm) continue;
    renderer.setOverride(null);
    const due = state.t >= times[next];
    renderer.draw(state, 0, FRAME, false);
    if (!due) continue;
    const c = state.skier;
    const ride = c.lift;
    stripViews.forEach((v, row) => {
      const lv = LINE_VIEWS[v];
      if (lv) {
        // The rider's place in the line's frame, and the lens off it.
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
      caption.textContent =
        `${v}  ${state.t.toFixed(2)} s  ` +
        `${ride ? `${ride.phase}${ride.faded ? "*" : ""}` : "skiing"}  ` +
        `${(c.speed * 3.6).toFixed(0)} km/h`;
      cell.append(tile, caption);
      cells[row].push(cell);
    });
    renderer.setOverride(null);
    next++;
  }
  for (const row of cells) sheetEl.append(...row);
  canvas.style.display = "none";
  return {
    note: `seed ${seed}${region ? ` ${region}` : ""}, ${id}, ${stripViews.join("/")}, ${win.from.toFixed(1)}–${win.to.toFixed(1)} s (${win.events.map((e) => `${e.phase} ${e.t.toFixed(1)}`).join(", ")})`,
    tiles: times.length * stripViews.length,
  };
}

async function sheet(): Promise<{ note: string; tiles: number }> {
  if (strip) return stripSheet(strip);
  if (board) return boardSheet(board);
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
