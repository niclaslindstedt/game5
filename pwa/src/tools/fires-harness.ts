// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIRES LAB's page (`scripts/fires-preview.mjs`): a free ride's camp
// fires and bonfires (`engine/game/fires.ts`, laid out by `fire-plan.ts`
// and drawn by `fires-view.ts`) through the game's OWN renderer:
//
//   * CAMP — a camp fire by its hut: close, at eye level, from a bench and
//     from above;
//   * BONFIRE — a bonfire close, from 20 m and from 60 m;
//   * NIGHT — both at hour 21: the light on the snow, the benches, the hut
//     and the trees, the sparks;
//   * MAP — the base from the air, its bonfires and a hut's fire far off.
//
// Every frame is captioned with what it cost: the milliseconds, the draw
// calls and the triangles. It exposes `window.__fires.sheet(group, views)`,
// which shoots one group's views, lays them out as a contact sheet and
// hands back every frame.

import {
  cabinsOf,
  createGame,
  firesOf,
  generateLevel,
  NEUTRAL_INPUT,
  step,
  TUNING,
  windAt,
  withSky,
  type Fire,
  type GameState,
  type RegionId,
  type WeatherKind,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";

type Frame = { view: string; label: string; caption: string; png: string };

const GROUPS = {
  camp: ["camp-close", "camp-eye", "camp-bench", "camp-above"],
  bonfire: ["bonfire-close", "bonfire-20", "bonfire-60"],
  night: ["night-camp", "night-bench", "night-bonfire", "night-map"],
  map: ["map-base", "map-hut"],
} as const;

declare global {
  interface Window {
    __fires?: {
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
const hour = params.get("hour") !== null ? Number(params.get("hour")) : 13;
const nightHour = Number(params.get("night") ?? 21);
const weather = (params.get("weather") || "clear") as WeatherKind;

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
const gl = renderer.gl;

const level = withSky(generateLevel(seed, { region }), { weather, hour });
const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);
const STILL = 1e-4;
const fires = firesOf(level);
const cabins = cabinsOf(level);
const camps = fires.filter((f) => f.kind === "camp");
const bonfires = fires.filter((f) => f.kind === "bonfire");

function fresh(): GameState {
  return createGame({ level, seed, region, mode: "free", crowd: 0, quiet: true });
}

/** The camp fire the camp views are about: one by a hut with the most
 * benches, and the way from its hut to it. */
const camp: Fire | undefined = [...camps].sort((a, b) => b.seats.length - a.seats.length)[0];
const bonfire: Fire | undefined = bonfires[0];

function hutWay(f: Fire): number {
  const hut = cabins.find((c) => c.id === f.building);
  return hut ? Math.atan2(f.x - hut.x, f.z - hut.z) : 0;
}

/** A lens `back` m from fire `f` on bearing `a` (0 = +z), `up` m over the
 * snow, looking at a point `look` m over its hearth. */
function round(f: Fire, a: number, back: number, up: number, look: number, fov = 50): LensPose {
  const ex = f.x + Math.sin(a) * back;
  const ez = f.z + Math.cos(a) * back;
  return {
    eye: { x: ex, y: level.groundAt(ex, ez) + up, z: ez },
    target: { x: f.x, y: f.y + look, z: f.z },
    fov,
    roll: 0,
  };
}

function run(state: GameState, seconds: number): void {
  const n = Math.round(seconds / FRAME);
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < STEPS; i++) step(state, NEUTRAL_INPUT);
    renderer.draw(state, 1, FRAME, false);
  }
}

let frames: Frame[] = [];
let view = "";
let sky = "";

function shoot(state: GameState, label: string, lens: LensPose): void {
  renderer.setOverride(lens);
  // Once to deal the lens's own nearest fires their lamp slots, once to see.
  renderer.draw(state, 1, STILL, true);
  const info = gl.info;
  info.autoReset = false;
  info.reset();
  const t0 = performance.now();
  renderer.draw(state, 1, STILL, true);
  gl.getContext().finish();
  const ms = performance.now() - t0;
  const calls = info.render.calls;
  const tris = info.render.triangles;
  info.autoReset = true;
  renderer.setOverride(null);
  frames.push({
    view,
    label,
    caption:
      `${view} ${label} — ${sky}\n` +
      `${ms.toFixed(1)} ms · ${calls} draws · ${(tris / 1000).toFixed(0)}k tris · ` +
      `wind ${windAt(level, state.t).speed.toFixed(1)} m/s`,
    png: canvas.toDataURL("image/png"),
  });
}

async function under(h: number): Promise<void> {
  renderer.setSky({ hour: h, weather });
  await renderer.shadeSettled();
  sky = `h${h} ${weather}`;
}

const need = (f: Fire | undefined, what: string): Fire => {
  if (!f) throw new Error(`seed ${seed} has no ${what}`);
  return f;
};

const VIEWS: Record<string, () => Promise<void>> = {
  async "camp-close"() {
    const f = need(camp, "camp fire");
    const s = fresh();
    run(s, 1);
    // With the hut behind it.
    shoot(s, "close", round(f, hutWay(f), 3.2, 1.3, 0.45, 55));
  },
  async "camp-eye"() {
    const f = need(camp, "camp fire");
    const s = fresh();
    run(s, 1);
    shoot(s, "eye", round(f, hutWay(f) + 0.6, 7, 1.7, 0.8, 50));
  },
  async "camp-bench"() {
    const f = need(camp, "camp fire");
    const s = fresh();
    run(s, 1);
    const b = f.seats[0];
    const a = Math.atan2(b.x - f.x, b.z - f.z);
    shoot(s, "bench", round(f, a, Math.hypot(b.x - f.x, b.z - f.z) + 0.3, 1.15, 0.3, 60));
  },
  async "camp-above"() {
    const f = need(camp, "camp fire");
    const s = fresh();
    run(s, 1);
    shoot(s, "above", round(f, hutWay(f) + 0.3, 5, 9, 0, 50));
  },
  async "bonfire-close"() {
    const f = need(bonfire, "bonfire");
    const s = fresh();
    run(s, 1);
    shoot(s, "close", round(f, 0.4, 8, 1.7, 1.8, 60));
  },
  async "bonfire-20"() {
    const f = need(bonfire, "bonfire");
    const s = fresh();
    run(s, 1);
    shoot(s, "20m", round(f, 1.2, 20, 1.8, 2.5, 50));
  },
  async "bonfire-60"() {
    const f = need(bonfire, "bonfire");
    const s = fresh();
    run(s, 1);
    shoot(s, "60m", round(f, 2.2, 60, 3, 3, 45));
  },
  async "night-camp"() {
    await under(nightHour);
    await VIEWS["camp-close"]();
    await VIEWS["camp-eye"]();
  },
  async "night-bench"() {
    await under(nightHour);
    await VIEWS["camp-bench"]();
  },
  async "night-bonfire"() {
    await under(nightHour);
    await VIEWS["bonfire-close"]();
    await VIEWS["bonfire-20"]();
  },
  async "night-map"() {
    await under(nightHour);
    await VIEWS["map-base"]();
    await under(hour);
  },
  async "map-base"() {
    const f = need(bonfire, "bonfire");
    const s = fresh();
    run(s, 1);
    const v = level.resort?.village ?? f;
    const a = Math.atan2(f.x - v.x, f.z - v.z) + Math.PI;
    shoot(s, "base", round(f, a, 140, 70, 0, 55));
  },
  async "map-hut"() {
    const f = need(camp, "camp fire");
    const s = fresh();
    run(s, 1);
    shoot(s, "hut", round(f, hutWay(f) + 0.2, 40, 22, 0.5, 45));
  },
};

const ready = (async () => {
  const first = fresh();
  await renderer.load(first);
  await under(hour);
  renderer.draw(first, 1, FRAME);
  await renderer.shadeSettled();
  const kinds = new Map<string, number>();
  for (const f of camps) {
    const kind = cabins.find((c) => c.id === f.building)?.kind ?? "?";
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  }
  return (
    `${camps.length} camp fires (${[...kinds].map(([k, n]) => `${n} ${k}`).join(", ")}), ` +
    `${bonfires.length} bonfires; the camp views' ${camp?.id ?? "-"} by ${camp?.building ?? "-"}`
  );
})();

async function sheet(group: string, views: string[]): Promise<{ frames: Frame[] }> {
  const note = await ready;
  frames = [];
  for (const v of views) {
    const scene = VIEWS[v];
    if (!scene) throw new Error(`no view "${v}"`);
    view = v;
    if (!v.startsWith("night")) await under(hour);
    await scene();
  }
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent = `FIRES — ${group} — seed ${seed}${region ? ` ${region}` : ""} — ${tier}\n${note}`;
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

window.__fires = { ready, groups: GROUPS, sheet };
