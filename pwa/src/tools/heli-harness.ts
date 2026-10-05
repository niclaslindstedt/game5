// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER LAB's page (`scripts/heli-preview.mjs`): the free ride's
// helicopter (`docs/helicopter.md`) staged at every event it has — parked
// and calling a skier to it, boarded, lifting off into its wash, flown,
// banked, set down on a summit flat, pushed off from over a steep face,
// flown home, flown into the snow and burning, at night, and the model
// alone on a turntable — through the game's OWN renderer (`renderer.ts`)
// over a run this page steps itself (`heli-scenes.ts` stages each), every
// sixtieth of a second, so the snow cloud the wash raises, the fire and the
// lens's springs are the ones a player sees.
//
// It exposes `window.__heli.sheet(group, views)`, which shoots the views of
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
import { heliModelUrl } from "../game/skier-models.ts";
import { GROUPS, VIEWS, type Drive, type Lens, type Stage } from "./heli-scenes.ts";
import { spotsOf } from "./heli-spots.ts";

type Frame = { view: string; label: string; caption: string; png: string };

declare global {
  interface Window {
    __heli?: {
      ready: Promise<string>;
      /** The sheets and the views each is shot from (`heli-scenes.ts`). */
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
const spots = spotsOf(level);
const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);
/** The wall time a still is drawn over: nothing moves in it. */
const STILL = 1e-4;

function fresh(heli: boolean): GameState {
  return createGame({ level, seed, region, mode: "free", heli, crowd: 0, quiet: true });
}

const ready = (async () => {
  const first = fresh(true);
  await renderer.load(first);
  if (baseSky) renderer.setSky(baseSky);
  renderer.draw(first, 1, FRAME);
  // The helicopter's model is fetched by its drawer when the map is built;
  // give it time to arrive and be parsed before anything is shot.
  const url = heliModelUrl();
  for (let k = 0; url && k < 100; k++) {
    if (performance.getEntriesByType("resource").some((e) => e.name.endsWith("heli.glb"))) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  await new Promise((r) => setTimeout(r, 1500));
  await renderer.shadeSettled();
  const f = (p: { x: number; y: number; z: number }) =>
    `${p.x.toFixed(0)},${p.z.toFixed(0)} (${p.y.toFixed(0)} m)`;
  return (
    `pad ${f(spots.pad)}, flat ${f(spots.flat)}, steep ${f(spots.steep)} ` +
    `${((spots.steep.slope * 180) / Math.PI).toFixed(0)}°, meadow ${f(spots.meadow)}`
  );
})();

let frames: Frame[] = [];
let view = "";

const deg = (r: number): string => `${((r * 180) / Math.PI).toFixed(0)}°`;

/** What the frame shows, as a caption under its label. */
function stateLine(s: GameState): string {
  const h = s.heli;
  const c = s.skier;
  const skier = c.thrown
    ? "thrown"
    : c.airborne
      ? "in the air"
      : h?.rider
        ? "on the skid"
        : "on snow";
  if (!h) return skier;
  const skid = h.y - s.level.groundAt(h.x, h.z);
  const speed = Math.hypot(h.vx, h.vy, h.vz) * 3.6;
  return (
    `${h.mode}${h.grounded ? " grounded" : ""} · skids ${skid.toFixed(1)} m · ${speed.toFixed(0)} km/h · ` +
    `spool ${h.spool.toFixed(2)} · pitch ${deg(h.pitch)} roll ${deg(h.roll)}\n` +
    `skier ${skier} ${(c.speed * 3.6).toFixed(0)} km/h · t ${s.t.toFixed(2)} s`
  );
}

function advance(state: GameState, drive: Drive): void {
  for (let i = 0; i < STEPS; i++) step(state, drive(state));
  renderer.draw(state, 1, FRAME, false);
}

const stage: Stage = {
  level,
  spots,
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
  once(state, input) {
    step(state, input);
    renderer.draw(state, 1, TUNING.dt, false);
  },
  camera(rung) {
    if (renderer.camera() !== rung) renderer.setCamera(rung, true);
  },
  fly(rung) {
    renderer.setCamera(rung, false);
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
  hide(names) {
    renderer.setHidden(names);
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
    `HELICOPTER — ${group} (${views.join(", ")}) — seed ${seed}${region ? ` ${region}` : ""}` +
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

window.__heli = { ready, groups: GROUPS, sheet };
