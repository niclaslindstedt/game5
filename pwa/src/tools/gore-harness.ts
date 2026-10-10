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
  BONES,
  createGame,
  bleedsOf,
  fracturesOf,
  generateLevel,
  GORE_OPEN,
  GORE_PIECES,
  lostPiece,
  NEUTRAL_INPUT,
  step,
  TUNING,
  type DeathCause,
  type GameState,
  type RegionId,
  type SkyOverride,
  type WeatherKind,
} from "@engine";

import { bodyTile, type BodyTile } from "../game/body-tile.ts";
import { diedOf } from "../game/hud-wreck.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { BONE_GROUPS, BONE_VIEWS } from "./gore-bone-scenes.ts";
import {
  GROUPS as SCENE_GROUPS,
  HUD_GROUPS,
  VIEWS as SCENE_VIEWS,
  type Drive,
  type Fresh,
  type Lens,
  type Stage,
} from "./gore-scenes.ts";

const VIEWS = { ...SCENE_VIEWS, ...BONE_VIEWS };
const GROUPS = { ...SCENE_GROUPS, ...BONE_GROUPS };

type Frame = { view: string; label: string; caption: string; png: string };

/** What a HUD frame lays over its picture (`gore-hud.tsx`). */
export type HudFrame = {
  png: string;
  tile: BodyTile;
  died: { since: number; cause: DeathCause } | null;
  kmh: number;
  seed: number;
};

declare global {
  interface Window {
    __gore?: {
      ready: Promise<string>;
      /** The sheets and the views each is shot from (`grimbear-scenes.ts`). */
      groups: Record<string, readonly string[]>;
      sheet(group: string, views: string[]): Promise<{ frames: Frame[] }>;
      /** The frames a HUD sheet's iframes read. */
      hud: HudFrame[];
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

function fresh(ask: Fresh = false): GameState {
  const o = typeof ask === "boolean" ? { grimbear: ask } : ask;
  const grimbear = !!o.grimbear;
  return createGame({
    level,
    seed,
    region,
    mode: "free",
    gore: true,
    crowd: 0,
    quiet: true,
    ...(grimbear ? { grimbear: "hunt" as const } : {}),
    ...(o.groomer ? { groomer: "on" as const } : {}),
    ...(o.heli ? { heli: true } : {}),
  });
}

const ready = (async () => {
  // Loaded with the machines out, so their scene is built for the sheets
  // that ask for them.
  const first = fresh({ groomer: true });
  await renderer.load(first);
  if (baseSky) renderer.setSky(baseSky);
  renderer.draw(first, 1, FRAME);
  await renderer.shadeSettled();
  return `${level.trees.length} trees, piste ${level.track.length.toFixed(0)} m`;
})();

let frames: Frame[] = [];
let huds: HudFrame[] = [];
let view = "";

/** What the frame shows, as a caption under its label. */
function stateLine(s: GameState): string {
  const g = s.gore;
  const c = s.skier;
  const skier = c.thrown ? `thrown (${c.thrown.cause}, ${c.thrown.t.toFixed(1)} s)` : "on snow";
  if (!g) return skier;
  const lost = GORE_PIECES.filter((p) => lostPiece(g, p));
  const open = GORE_OPEN.filter((_, i) => g.open & (1 << i));
  const grades = fracturesOf(c.body);
  // Each broken bone with its grade: s simple, w wedge, x shattered.
  const broken = BONES.flatMap((b, k) => (grades[k] >= 2 ? [`${b}:${"--swx"[grades[k]]}`] : []));
  return (
    `${skier} · t ${s.t.toFixed(2)} s\n` +
    `lost ${lost.join(" ") || "-"} · open ${open.join(" ") || "-"}${g.crushed >= 0 ? " · skull crushed" : ""}` +
    `${g.impaled ? ` · on a ${g.impaled.stuff}` : ""}` +
    `${broken.length ? ` · broken ${broken.join(" ")}` : ""}\n` +
    `${g.dead >= 0 ? `DEAD (${g.cause})` : g.mortal >= 0 ? "dying" : "alive"} · heart ${g.rate.toFixed(0)}/min · ` +
    `lost ${g.blood.toFixed(2)} l (out ${g.shed.toFixed(2)} l) · ${g.flow.toFixed(2)} l/s\n` +
    `bleeding ${
      bleedsOf(s)
        .map((h) => `${h.part}${h.out > 0 ? ":out" : ""}${h.inside > 0 ? ":in" : ""}`)
        .join(" ") || "-"
    }`
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
    const since = diedOf(state);
    huds.push({
      png: frames[frames.length - 1].png,
      tile: bodyTile(state.skier.body, state.t),
      died: since !== null && state.gore?.cause ? { since, cause: state.gore.cause } : null,
      kmh: state.skier.speed * 3.6,
      seed,
    });
  },
  clearBodies: () => renderer.clearBodies(),
  async sky(over) {
    const sky = over ? { ...(baseSky ?? {}), ...over } : baseSky;
    renderer.setSky(sky);
    await renderer.shadeSettled();
  },
};

async function sheet(group: string, views: string[]): Promise<{ frames: Frame[] }> {
  const note = await ready;
  frames = [];
  huds = [];
  window.__gore!.hud = huds;
  for (const v of views) {
    const scene = VIEWS[v];
    if (!scene) throw new Error(`no view "${v}"`);
    view = v;
    // Each view on snow of its own: no dead left lying from the last one.
    renderer.clearBodies();
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
  const withHud = HUD_GROUPS.has(group);
  for (const [i, f] of frames.entries()) {
    const cell = document.createElement("figure");
    const caption = document.createElement("figcaption");
    caption.textContent = f.caption;
    if (withHud) {
      // The HUD over the frame, at the frame's own size, scaled to the tile.
      const box = document.createElement("div");
      box.style.cssText = `width:${tw}px;height:${th}px;overflow:hidden`;
      const iframe = document.createElement("iframe");
      iframe.src = `gore-hud.html?hud=${i}`;
      iframe.width = String(width);
      iframe.height = String(height);
      iframe.style.cssText = `border:0;display:block;transform:scale(${scale});transform-origin:0 0`;
      box.append(iframe);
      cell.append(box, caption);
    } else {
      const img = document.createElement("img");
      img.src = f.png;
      img.width = tw;
      img.height = th;
      await img.decode();
      cell.append(img, caption);
    }
    cells.push(cell);
  }
  sheetEl.replaceChildren(...cells);
  if (withHud) {
    // Every frame's page drawn, its fonts in and its picture decoded.
    const shown = [...sheetEl.querySelectorAll("iframe")];
    for (let k = 0; k < 100; k++) {
      if (shown.every((f) => (f.contentWindow as unknown as { __drawn?: boolean })?.__drawn)) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  return { frames };
}

window.__gore = { ready, groups: GROUPS, sheet, hud: huds };
