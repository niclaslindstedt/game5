// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW GUN LAB's page (`scripts/snowguns-preview.mjs`): a thin season's
// snow guns (`engine/game/snow-guns.ts`, drawn by `snow-guns-view.ts` and
// `snow-gun-plume.ts`) on a free ride, through the game's OWN renderer:
//
//   * FIGURE — a fan gun on its carriage and up on its column, a lance,
//     each from a few metres, the skier stood on the run beside it;
//   * PLUME — a running fan gun's cone side on, down its run from the
//     piste, the whale it lays, and the skier skiing past on the chase;
//   * NIGHT — the same plumes under the floodlights.
//
// It exposes `window.__snowguns.sheet(group, views)`, which shoots the views
// of one group, lays them out as a contact sheet and hands back every frame.

import {
  createGame,
  generateLevel,
  NEUTRAL_INPUT,
  placeRun,
  snowGunsOf,
  SNOW_GUN,
  step,
  TUNING,
  withDay,
  withSky,
  type GameState,
  type RegionId,
  type SkierInput,
  type SnowGun,
  type SnowGunMount,
  type WeatherKind,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";

type Frame = { view: string; label: string; caption: string; png: string };

const GROUPS = {
  figure: ["carriage", "carriage-mouth", "tower", "lance"],
  plume: ["side", "down-run", "whale", "chase"],
  whale: ["whale-near"],
  night: ["night-side", "night-run"],
} as const;

declare global {
  interface Window {
    __snowguns?: {
      ready: Promise<string>;
      groups: Record<string, readonly string[]>;
      sheet(group: string, views: string[]): Promise<{ frames: Frame[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const region = (params.get("region") || undefined) as RegionId | undefined;
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);
const cols = Number(params.get("cols") ?? 2);
const scale = Number(params.get("scale") ?? 0.5);
const hour = params.get("hour") !== null ? Number(params.get("hour")) : 10.5;
const weather = (params.get("weather") || "clear") as WeatherKind;
/** The day: early season by default (15 December), as a day of the year. */
const day = Number(params.get("day") ?? 349);

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

const level = withSky(withDay(generateLevel(seed, { region }), { dayOfYear: day, hour }), {
  weather,
});
const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);
const STILL = 1e-4;
const guns = snowGunsOf(level);

function fresh(): GameState {
  return createGame({ level, seed, region, mode: "free", crowd: 0, quiet: true });
}

/** The gun a view is about: the first of its mount whose run is open to the lens. */
const gunOf = (mount: SnowGunMount): SnowGun => guns.find((g) => g.mount === mount) ?? guns[0];

/** The run's own heading at a gun, and the way in across it. */
function frameOf(g: SnowGun): { down: number; inward: number } {
  const out = g.mount === "lance" ? SNOW_GUN.lance.out : SNOW_GUN.fan.out;
  const land = g.reach * SNOW_GUN.whale.land;
  const across = g.width / 2 + out;
  const swing = land > across ? Math.acos(across / land) : 0;
  const inward = g.aim - g.side * swing;
  return { inward, down: inward + (g.side * Math.PI) / 2 };
}

/** A lens planted round gun `g`: `fwd` m along its aim, `right` m to the
 * right of it, `up` m over the snow, looking at a point `look` m up and
 * `ahead` m along the aim. */
function around(
  g: SnowGun,
  fwd: number,
  right: number,
  up: number,
  look = 1.5,
  ahead = 0,
  fov = 50,
): LensPose {
  const fx = Math.sin(g.aim);
  const fz = Math.cos(g.aim);
  const ex = g.x + fx * fwd + fz * right;
  const ez = g.z + fz * fwd - fx * right;
  const tx = g.x + fx * ahead;
  const tz = g.z + fz * ahead;
  return {
    eye: { x: ex, y: Math.max(level.groundAt(ex, ez) + 0.4, level.groundAt(ex, ez) + up), z: ez },
    target: { x: tx, y: level.groundAt(tx, tz) + look, z: tz },
    fov,
    roll: 0,
  };
}

/** Stand the skier on the run `metres` down from the gun's whale. */
function standBeside(state: GameState, g: SnowGun, metres: number, speed = 0): void {
  const { down } = frameOf(g);
  placeRun(state, {
    x: g.land.x + Math.sin(down) * metres,
    z: g.land.z + Math.cos(down) * metres,
    heading: down,
    speed,
  });
}

function run(
  state: GameState,
  seconds: number,
  drive: (s: GameState) => SkierInput = () => NEUTRAL_INPUT,
): void {
  const n = Math.round(seconds / FRAME);
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < STEPS; i++) step(state, drive(state));
    renderer.draw(state, 1, FRAME, false);
  }
}

let frames: Frame[] = [];
let view = "";

function shoot(state: GameState, label: string, lens: LensPose | "chase"): void {
  if (lens === "chase") {
    if (renderer.camera() !== "chase") renderer.setCamera("chase", true);
    renderer.setOverride(null);
  } else renderer.setOverride(lens);
  renderer.draw(state, 1, STILL, true);
  renderer.setOverride(null);
  frames.push({
    view,
    label,
    caption: `${view} ${label}\nday ${day} h${hour} ${weather} — ${guns.length} guns`,
    png: canvas.toDataURL("image/png"),
  });
}

const VIEWS: Record<string, () => Promise<void>> = {
  async carriage() {
    const g = gunOf("carriage");
    const s = fresh();
    standBeside(s, g, -g.reach * 0.3);
    run(s, 0.5);
    shoot(s, "quarter", around(g, -6, 5, 2.2, 1.8));
    shoot(s, "side", around(g, 0.5, 8, 1.6, 1.6, 0, 45));
  },
  async "carriage-mouth"() {
    const g = gunOf("carriage");
    const s = fresh();
    run(s, 0.5);
    shoot(s, "mouth", around(g, 9, 3, 1.8, 2.0, 0, 45));
  },
  async tower() {
    const g = gunOf("tower");
    const s = fresh();
    standBeside(s, g, -g.reach * 0.3);
    run(s, 0.5);
    shoot(s, "quarter", around(g, -7, 7, 2.5, 3.2));
    shoot(s, "from-run", around(g, 16, -6, 1.7, 3.5, 0, 50));
  },
  async lance() {
    const g = gunOf("lance");
    const s = fresh();
    standBeside(s, g, -6);
    run(s, 0.5);
    shoot(s, "side", around(g, 3, 12, 2, 4.5, 3, 55));
    shoot(s, "from-run", around(g, 14, -5, 1.7, 5, 0, 55));
  },
  async side() {
    const g = gunOf("carriage");
    const s = fresh();
    run(s, 0.5);
    shoot(s, "cone", around(g, 25, 55, 6, 6, 28, 55));
    const t = gunOf("tower");
    shoot(s, "tower-cone", around(t, 25, 55, 6, 7, 28, 55));
  },
  async "down-run"() {
    const g = gunOf("carriage");
    const s = fresh();
    run(s, 0.5);
    const { down } = frameOf(g);
    const ex = g.land.x - Math.sin(down) * 70;
    const ez = g.land.z - Math.cos(down) * 70;
    const lens: LensPose = {
      eye: { x: ex, y: level.groundAt(ex, ez) + 2, z: ez },
      target: { x: g.land.x, y: level.groundAt(g.land.x, g.land.z) + 2, z: g.land.z },
      fov: 55,
      roll: 0,
    };
    shoot(s, "down", lens);
  },
  async whale() {
    const g = gunOf("carriage");
    const s = fresh();
    standBeside(s, g, 8);
    run(s, 0.5);
    shoot(s, "low", around(g, g.reach * 0.55 + 14, 9, 0.9, 0.4, g.reach * 0.5, 50));
  },
  async "whale-near"() {
    const g = gunOf("carriage");
    const s = fresh();
    run(s, 0.5);
    const { down } = frameOf(g);
    const w = g.land;
    for (const [label, ang, r] of [
      ["across", Math.PI / 2, 14],
      ["below", 0, 18],
    ] as const) {
      const a = down + Math.PI + ang;
      const ex = w.x + Math.sin(a) * r;
      const ez = w.z + Math.cos(a) * r;
      shoot(s, label, {
        eye: { x: ex, y: level.groundAt(ex, ez) + 1.6, z: ez },
        target: { x: w.x, y: level.groundAt(w.x, w.z) + 0.2, z: w.z },
        fov: 50,
        roll: 0,
      });
    }
  },
  async chase() {
    const g = gunOf("carriage");
    const s = fresh();
    standBeside(s, g, -45, 12);
    run(s, 2);
    shoot(s, "2s", "chase");
    run(s, 2);
    shoot(s, "4s", "chase");
  },
  async "night-side"() {
    renderer.setSky({ hour: 20, weather });
    await renderer.shadeSettled();
    await VIEWS.side();
  },
  async "night-run"() {
    renderer.setSky({ hour: 20, weather });
    await renderer.shadeSettled();
    await VIEWS["down-run"]();
    renderer.setSky({ hour, weather });
    await renderer.shadeSettled();
  },
};

const ready = (async () => {
  const first = fresh();
  await renderer.load(first);
  renderer.setSky({ hour, weather });
  renderer.draw(first, 1, FRAME);
  await renderer.shadeSettled();
  const m: Record<string, number> = {};
  for (const g of guns) m[g.mount] = (m[g.mount] ?? 0) + 1;
  return `${guns.length} guns (${Object.entries(m)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ")}); running: ${first.machineSnow ? "yes" : "no"}`;
})();

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
  header.textContent = `SNOW GUNS — ${group} — seed ${seed}${region ? ` ${region}` : ""} — ${tier}\n${note}`;
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

window.__snowguns = { ready, groups: GROUPS, sheet };
