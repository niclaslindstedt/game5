// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GORE LAB's page (`scripts/gore-preview.mjs`): a body torn apart on a
// run with the INJURIES switch on (`engine/game/gore.ts`, drawn by
// `gore-view.ts`) — into a trunk, onto the snow, onto a spike, by the
// grimbear, the blood on the beat and the snow red — through the game's OWN
// renderer (`renderer.ts`) over a run this page steps itself
// (`gore-scenes.ts` stages each), every sixtieth of a second.
//
// It exposes `window.__gore.sheet(group, views)`, which shoots the views
// of one group, lays them out on the page as a contact sheet for the driver
// to photograph, and hands back every frame at full size.

import {
  createGame,
  generateLevel,
  GORE_OPEN,
  GORE_PIECES,
  lostPiece,
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
import { GROUPS, VIEWS, type Drive, type Lens, type Stage } from "./gore-scenes.ts";

type Frame = { view: string; label: string; caption: string; png: string };

declare global {
  interface Window {
    __gore?: {
      ready: Promise<string>;
      /** The sheets and the views each is shot from (`grimbear-scenes.ts`). */
      groups: Record<string, readonly string[]>;
      sheet(group: string, views: string[]): Promise<{ frames: Frame[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 2);
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

function fresh(grimbear = false): GameState {
  return createGame({
    level,
    seed,
    region,
    mode: "free",
    gore: true,
    crowd: 0,
    quiet: true,
    ...(grimbear ? { grimbear: "hunt" as const } : {}),
  });
}

const ready = (async () => {
  const first = fresh();
  await renderer.load(first);
  if (baseSky) renderer.setSky(baseSky);
  renderer.draw(first, 1, FRAME);
  await renderer.shadeSettled();
  return `${level.trees.length} trees, piste ${level.track.length.toFixed(0)} m`;
})();

let frames: Frame[] = [];
let view = "";

/** What the frame shows, as a caption under its label. */
function stateLine(s: GameState): string {
  const g = s.gore;
  const c = s.skier;
  const skier = c.thrown ? `thrown (${c.thrown.cause}, ${c.thrown.t.toFixed(1)} s)` : "on snow";
  if (!g) return skier;
  const lost = GORE_PIECES.filter((p) => lostPiece(g, p));
  const open = GORE_OPEN.filter((_, i) => g.open & (1 << i));
  return (
    `${skier} · t ${s.t.toFixed(2)} s\n` +
    `lost ${lost.join(" ") || "-"} · open ${open.join(" ") || "-"}${g.crushed >= 0 ? " · skull crushed" : ""}` +
    `${g.impaled ? ` · on a ${g.impaled.stuff}` : ""}\n` +
    `${g.dead >= 0 ? `DEAD (${g.cause})` : g.mortal >= 0 ? "dying" : "alive"} · heart ${g.rate.toFixed(0)}/min · ` +
    `lost ${g.blood.toFixed(2)} l · ${g.flow.toFixed(2)} l/s`
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
  until(state, test, limit, drive = () => NEUTRAL_INPUT) {
    const n = Math.round(limit / FRAME);
    for (let k = 0; k < n; k++) {
      if (test(state)) return true;
      advance(state, drive);
    }
    return test(state);
  },
  shoot(state, label, lens: Lens = "chase") {
    if (typeof lens === "string") {
      if (renderer.camera() !== lens) renderer.setCamera(lens, true);
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
    `GORE — ${group} (${views.join(", ")}) — seed ${seed}${region ? ` ${region}` : ""}` +
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

window.__gore = { ready, groups: GROUPS, sheet };
