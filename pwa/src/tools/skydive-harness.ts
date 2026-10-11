// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVE LAB's page (`scripts/skydive-preview.mjs`): the free ride's
// skydive staged at every moment it has — the rig on him, poised in the
// plane's door and out of it, belly to earth, tracking and head down, the
// opening frame by frame, the canopy flown, turned and flared, the cut-away
// and the canopy on the snow, caught in a crown or on a lift, every lens,
// and after dark — through the game's OWN renderer (`renderer.ts`) over a
// run this page steps itself (`skydive-scenes.ts` stages each), so the rig
// and the body are drawn as a player sees them.
//
// It exposes `window.__skydive.sheet(group, views)`, which shoots the views of
// one group, lays them out on the page as a contact sheet for the driver to
// photograph, and hands back every frame at full size.

import {
  createGame,
  generateLevel,
  NEUTRAL_INPUT,
  step,
  TUNING,
  type GameState,
  type RegionId,
  type SkyOverride,
  type WeatherKind,
} from "@engine";

import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { GROUPS, VIEWS, type Drive, type Lens, type Stage } from "./skydive-scenes.ts";

type Frame = { view: string; label: string; caption: string; png: string };

declare global {
  interface Window {
    __skydive?: {
      ready: Promise<string>;
      /** The sheets and the views each is shot from (`skydive-scenes.ts`). */
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
const cols = Number(params.get("cols") ?? 3);
const scale = Number(params.get("scale") ?? 0.5);
/** The lab's own sky over the map's (`withSky`): an hour and a weather. */
const hour = Number(params.get("hour"));
const weather = (params.get("weather") || undefined) as WeatherKind | undefined;
const baseSky: SkyOverride | null =
  Number.isFinite(hour) && params.get("hour") !== null
    ? { hour, ...(weather ? { weather } : {}) }
    : weather
      ? { weather }
      : null;

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
renderer.setDeathCam(true);

const level = generateLevel(seed, { region });
const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);
/** The wall time a still is drawn over: nothing moves in it. */
const STILL = 1e-4;

function fresh(): GameState {
  return createGame({ level, seed, region, mode: "free", plane: true, crowd: 0, quiet: true });
}

const ready = (async () => {
  const first = fresh();
  await renderer.load(first);
  if (baseSky) renderer.setSky(baseSky);
  renderer.draw(first, 1, FRAME);
  await new Promise((r) => setTimeout(r, 1500));
  await renderer.shadeSettled();
  const p = first.plane;
  return p ? `strip ${p.x.toFixed(0)},${p.z.toFixed(0)} (${p.y.toFixed(0)} m)` : "no strip";
})();

let frames: Frame[] = [];
let view = "";

const deg = (r: number): string => `${((r * 180) / Math.PI).toFixed(0)}°`;

/** What the frame shows, as a caption under its label. */
function stateLine(s: GameState): string {
  const ch = s.chute;
  const c = s.skier;
  const skier = c.thrown
    ? "thrown"
    : s.plane?.rider
      ? "in the door"
      : c.airborne
        ? "in the air"
        : "on snow";
  if (!ch) return `${skier} · t ${s.t.toFixed(1)} s`;
  const d = ch.deploy;
  const k = ch.controls;
  return (
    `${ch.mode}${d && ch.mode === "deploying" ? ` ${d.stage} t ${d.t.toFixed(2)} s spread ${d.spread.toFixed(2)} slider ${d.slider.toFixed(2)}` : ""}` +
    `${ch.stalled ? " STALLED" : ""} · agl ${ch.agl.toFixed(0)} m · fall ${ch.fall.toFixed(1)} m/s · ` +
    `att ${deg(ch.attitude)} track ${ch.track.toFixed(2)} · ${ch.g.toFixed(1)} g\n` +
    `toggles ${k.brake.toFixed(2)}/${k.steer.toFixed(2)} riser ${k.riser.toFixed(2)} · ` +
    `skier ${skier} · since ${ch.since.toFixed(1)} s`
  );
}

function advance(state: GameState, drive: Drive): void {
  for (let i = 0; i < STEPS; i++) step(state, drive(state));
  renderer.draw(state, 1, FRAME, false);
}

const stage: Stage = {
  level,
  fresh,
  run(state, seconds, drive = () => NEUTRAL_INPUT) {
    const n = Math.round(seconds / FRAME);
    for (let k = 0; k < n; k++) advance(state, drive);
  },
  skip(state, seconds, drive = () => NEUTRAL_INPUT) {
    const n = Math.round(seconds / TUNING.dt);
    for (let k = 0; k < n; k++) step(state, drive(state));
  },
  until(state, test, limit, drive = () => NEUTRAL_INPUT) {
    const n = Math.round(limit / FRAME);
    for (let k = 0; k < n; k++) {
      if (test(state)) return true;
      advance(state, drive);
    }
    return test(state);
  },
  camera(rung) {
    if (renderer.camera() !== rung) renderer.setCamera(rung, true);
  },
  shoot(state, label, lens: Lens = "chase") {
    if (typeof lens === "string") {
      stage.camera(lens);
      renderer.setOverride(null);
    } else renderer.setOverride(typeof lens === "function" ? lens(state) : lens);
    renderer.draw(state, 1, STILL, true);
    renderer.setOverride(null);
    const lensName = typeof lens === "string" ? lens : "planted";
    frames.push({
      view,
      label,
      caption: `${view} ${label} [${lensName}]\n${stateLine(state)}`,
      png: canvas.toDataURL("image/png"),
    });
  },
  async sky(over) {
    const sky = over ? { ...(baseSky ?? {}), ...over } : baseSky;
    renderer.setSky(sky);
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
    await scene(stage);
  }
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent =
    `SKYDIVE — ${group} (${views.join(", ")}) — seed ${seed}${region ? ` ${region}` : ""}` +
    `${baseSky ? ` sky ${JSON.stringify(baseSky)}` : ""} — ${tier}\n${note}`;
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

window.__skydive = { ready, groups: GROUPS, sheet };
