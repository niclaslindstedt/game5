// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREE WELL LAB's page (`scripts/tree-wells-preview.mjs`): the hollows
// round the trunks in deep powder (`engine/game/tree-well.ts`, drawn by
// `pwa/src/game/tree-wells.ts`) through the game's OWN renderer over a free
// ride this page steps itself, every sixtieth of a second:
//
//   look   one well from below it, from above it, from the side at a
//          skier's knee and straight down, a skier stood at its lip for
//          its size — at the run's dial, and at the ordinary snow beside it
//          (no wells: the before);
//   fall   a skier stood still above the trunk, slid in, frame by frame
//          from a planted lens, and stuck in it from the chase;
//   night  the well under the skier's headlamp.
//
// The well is the deepest full-skirted conifer's on the map standing apart
// from the rest, on a slope, clear of the piste. Nothing reads a wall
// clock, so a seed's sheet is the same sheet twice.
//
// It exposes `window.__wells.sheet(group, views)`, which shoots the views of
// one group, lays them out as a contact sheet for the driver to photograph,
// and hands back every frame at full size.

import {
  createGame,
  generateLevel,
  NEUTRAL_INPUT,
  nearestTrackPoint,
  placeRun,
  step,
  TUNING,
  wellAt,
  type GameState,
  type RegionId,
  type TreeWell,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import type { CameraRung } from "../game/renderer-api.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";

type Frame = { view: string; label: string; caption: string; png: string };
type Lens = CameraRung | LensPose;

const GROUPS: Record<string, readonly string[]> = {
  look: ["below", "above", "side", "down", "lip", "before"],
  fall: ["fall"],
  night: ["night"],
};

declare global {
  interface Window {
    __wells?: {
      ready: Promise<string>;
      groups: Record<string, readonly string[]>;
      sheet(group: string, views: string[]): Promise<{ frames: Frame[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const region = (params.get("region") || undefined) as RegionId | undefined;
const dial = Number(params.get("snow") ?? 2.5);
const hour = Number(params.get("hour") ?? 11);
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
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

const map = generateLevel(seed, { region });
const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);
const STILL = 1e-4;

function fresh(snowDepth = dial): GameState {
  return createGame({
    level: map,
    seed,
    region,
    mode: "free",
    snowDepth,
    crowd: 0,
    groomer: "off",
    quiet: true,
  });
}

/** THE WELL the lab looks at: the deepest, apart from the other trunks,
 * on a slope and clear of the piste. */
function pickWell(state: GameState): TreeWell {
  const wells = state.level.wells;
  if (!wells) throw new Error(`no wells at a snow dial of ${dial}`);
  let best = wells.list[0];
  const n = { x: 0, y: 1, z: 0 };
  let score = -Infinity;
  for (const w of wells.list) {
    let apart = 99;
    for (const t of state.level.trees) {
      const d = Math.hypot(t.x - w.x, t.z - w.z);
      if (d > 0.01) apart = Math.min(apart, d);
    }
    const near = nearestTrackPoint(state.level, w.x, w.z);
    const off = Math.hypot(near.x - w.x, near.z - w.z);
    state.level.normalAt(w.x, w.z, n);
    const slope = Math.hypot(n.x, n.z) / n.y;
    if (apart < 9 || off < 30 || slope < 0.18 || slope > 0.42) continue;
    const s = w.depth * 4 + Math.min(apart, 12) * 0.1;
    if (s > score) {
      score = s;
      best = w;
    }
  }
  return best;
}

let well: TreeWell;
const ready = (async () => {
  const first = fresh();
  well = pickWell(first);
  await renderer.load(first);
  renderer.setSky({ hour });
  renderer.draw(first, 1, FRAME);
  await renderer.shadeSettled();
  return (
    `${first.level.wells?.list.length ?? 0} wells at dial ${dial}; this one ` +
    `${well.depth.toFixed(2)} m deep at the trunk, reaching ${well.reach.toFixed(1)} m ` +
    `(${(well.lean * 100).toFixed(0)} % further downhill)`
  );
})();

let frames: Frame[] = [];
let view = "";

/** A point `along` m down the fall line from the trunk and `across` m to
 * its right, `up` m over the snow there. */
function at(s: GameState, along: number, across: number, up: number) {
  const x = well.x + well.fx * along - well.fz * across;
  const z = well.z + well.fz * along + well.fx * across;
  return { x, y: s.level.groundAt(x, z) + up, z };
}

/** A lens planted at `eye` looking at the trunk's foot `look` m over the
 * snowpack's surface there. */
function lensAt(s: GameState, eye: { x: number; y: number; z: number }, look = -0.6, fov = 50) {
  const base =
    s.level.groundAt(well.x + well.trunk + 0.05, well.z) + wellAt(s.level, well.x, well.z);
  return { eye, target: { x: well.x, y: base + look, z: well.z }, fov, roll: 0 } as LensPose;
}

/** The skier stood at rest `along` m down the fall line, `across` to the
 * right, facing `heading` (down the fall line when left out). */
function stand(s: GameState, along: number, across: number, heading?: number): void {
  const p = at(s, along, across, 0);
  placeRun(s, { x: p.x, z: p.z, heading: heading ?? Math.atan2(well.fx, well.fz) });
  run(s, 0.3);
}

function run(s: GameState, seconds: number): void {
  const n = Math.round(seconds / FRAME);
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < STEPS; i++) step(s, NEUTRAL_INPUT);
    renderer.draw(s, 1, FRAME, false);
  }
}

function shoot(s: GameState, label: string, lens: Lens): void {
  if (typeof lens === "string") {
    if (renderer.camera() !== lens) renderer.setCamera(lens, true);
    renderer.setOverride(null);
  } else renderer.setOverride(lens);
  renderer.draw(s, 1, STILL, true);
  renderer.setOverride(null);
  const c = s.skier;
  frames.push({
    view,
    label,
    caption:
      `${view} ${label}\nskier in well ${c.well.toFixed(2)} m, trench ${c.trench.toFixed(2)} m, ` +
      `${c.speed.toFixed(1)} m/s`,
    png: canvas.toDataURL("image/png"),
  });
}

const VIEWS: Record<string, () => Promise<void>> = {
  async below() {
    const s = fresh();
    stand(s, -1.2, 3.4);
    shoot(s, "from 7 m down the fall line", lensAt(s, at(s, 7, 0.8, 1.6)));
  },
  async above() {
    const s = fresh();
    stand(s, -1.2, 3.4);
    shoot(s, "from 7 m up the hill", lensAt(s, at(s, -7, -0.8, 1.7)));
  },
  async side() {
    const s = fresh();
    stand(s, -1.2, 3.4);
    shoot(s, "across, at a skier's knee", lensAt(s, at(s, 0.6, -6, 0.5), -0.5, 45));
  },
  async down() {
    const s = fresh();
    stand(s, -1.2, 3.4);
    shoot(s, "steeply down over it", lensAt(s, at(s, 0.5, -4.5, 7.5), -0.4, 55));
  },
  async lip() {
    const s = fresh();
    stand(s, -well.reach * 0.95, 0.4);
    shoot(s, "stood at the lip, the chase", "chase");
    shoot(s, "his own eyes", "helmet");
  },
  async before() {
    // The ordinary snow is another map to the renderer: built, shot, and
    // the deep one built back.
    const s = fresh(1);
    await renderer.load(s);
    stand(s, -1.2, 3.4);
    shoot(s, "the ordinary snow: no well", lensAt(s, at(s, 7, 0.8, 1.6)));
    await renderer.load(fresh());
  },
  async fall() {
    const s = fresh();
    stand(s, -2.4, 0.3);
    const lens = lensAt(s, at(s, 0.8, -6.5, 1.0), -0.3, 50);
    shoot(s, "0.0 s, stood above it", lens);
    for (const [dt, t] of [
      [0.5, "0.5"],
      [0.5, "1.0"],
      [1, "2.0"],
      [2, "4.0"],
    ] as const) {
      run(s, dt);
      shoot(s, `${t} s`, lens);
    }
    run(s, 2);
    shoot(s, "6.0 s, stuck: the chase", "chase");
  },
  async night() {
    renderer.setSky({ hour: 21 });
    await renderer.shadeSettled();
    const s = fresh();
    stand(s, -well.reach - 1.2, 0.3);
    shoot(s, "the headlamp on it", "chase");
    shoot(s, "from below", lensAt(s, at(s, 7, 0.8, 1.6)));
    renderer.setSky({ hour });
    await renderer.shadeSettled();
  },
};

async function sheet(group: string, views: string[]): Promise<{ frames: Frame[] }> {
  const note = await ready;
  frames = [];
  for (const v of views) {
    const scene = VIEWS[v];
    if (!scene) throw new Error(`no view "${v}"`);
    view = v;
    await scene();
  }
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent =
    `TREE WELLS — ${group} (${views.join(", ")}) — seed ${seed}${region ? ` ${region}` : ""}` +
    ` — hour ${hour} — ${tier}\n${note}`;
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

window.__wells = { ready, groups: GROUPS, sheet };
