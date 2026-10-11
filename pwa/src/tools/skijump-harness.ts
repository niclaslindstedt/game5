// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMP LAB's page (`scripts/skijump-preview.mjs`): the ski jumping
// hill (R43) and a jump off it, staged at every moment the hill is judged
// at — the empty hill from the broadcast's side, the out-run, the tower,
// the judges' tower, the air and after dark; the jumper on the bar, in the
// tracks and at the edge; in the air; at the landing among the boards —
// through the game's OWN renderer (`renderer.ts`) over a jump this page
// steps itself (`skijump-scenes.ts` stages each), so the hill is drawn as
// a player sees it.
//
// It exposes `window.__skijump.sheet(group, views)`, which shoots the views
// of one group, lays them out on the page as a contact sheet for the driver
// to photograph, and hands back every frame at full size with the frame's
// draw calls and triangles.

import { createGame, generateLevel, NEUTRAL_INPUT, step, TUNING, type GameState } from "@engine";

import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { withJumpContest } from "../game/ski-jump-run.ts";
import { GROUPS, VIEWS, type Drive, type Lens, type Stage } from "./skijump-scenes.ts";

type Frame = { view: string; label: string; caption: string; png: string };

declare global {
  interface Window {
    __skijump?: {
      ready: Promise<string>;
      groups: Record<string, readonly string[]>;
      sheet(group: string, views: string[]): Promise<{ frames: Frame[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const hill = params.get("hill") === "normal" ? "normal" : "large";
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);
const cols = Number(params.get("cols") ?? 3);
const scale = Number(params.get("scale") ?? 0.5);
const hourAsked = params.get("hour") === null ? NaN : Number(params.get("hour"));

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

const level = generateLevel(seed);
const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);
const STILL = 1e-4;
const baseHour = Number.isFinite(hourAsked) ? hourAsked : null;

function fresh(): GameState {
  return createGame(withJumpContest({ level, seed, mode: "skiJump", hill, quiet: true }));
}

const ready = (async () => {
  const first = fresh();
  await renderer.load(first);
  if (baseHour !== null) renderer.setSky({ hour: baseHour });
  renderer.draw(first, 1, FRAME);
  await new Promise((r) => setTimeout(r, 1500));
  await renderer.shadeSettled();
  const h = first.level.skiJump!;
  return `${hill} hill HS ${h.hs} K ${h.w} — edge ${h.edge.toFixed(1)} m, K ${h.k.toFixed(1)} m, U ${h.u.toFixed(1)} m of plan`;
})();

let frames: Frame[] = [];
let view = "";

function stateLine(s: GameState): string {
  const j = s.jump;
  const c = renderer.cost();
  const r = j?.record;
  return (
    `${j?.stage ?? "-"} · ${(Math.hypot(s.skier.vx, s.skier.vy, s.skier.vz) * 3.6).toFixed(1)} km/h` +
    `${r?.landing ? ` · ${r.distance.toFixed(1)} m ${r.landing}` : ""} · t ${s.t.toFixed(1)} s\n` +
    `${c.calls} calls · ${(c.triangles / 1000).toFixed(0)}k tris`
  );
}

/** A frame's worth of steps — drawn only over the last `DRAWN` frames
 * before a shot, so the lens and the trails catch up without the whole
 * run being drawn in a software renderer. */
const DRAWN = 12;
let behind = 0;
function advance(state: GameState, drive: Drive): void {
  for (let i = 0; i < STEPS; i++) step(state, drive(state));
  behind += 1;
}
function catchUp(state: GameState): void {
  const n = Math.min(DRAWN, behind);
  for (let k = 0; k < n; k++) renderer.draw(state, 1, FRAME);
  behind = 0;
}

const stage: Stage = {
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
    catchUp(state);
    if (typeof lens === "string") {
      if (renderer.camera() !== lens) renderer.setCamera(lens, true);
      renderer.setOverride(null);
      renderer.draw(state, 1, FRAME);
    } else renderer.setOverride(typeof lens === "function" ? lens(state) : lens);
    renderer.draw(state, 1, STILL);
    const caption = `${view} ${label} [${typeof lens === "string" ? lens : "planted"}]\n${stateLine(state)}`;
    renderer.setOverride(null);
    frames.push({ view, label, caption, png: canvas.toDataURL("image/png") });
  },
  async hour(h) {
    const at = h ?? baseHour;
    renderer.setSky(at === null ? null : { hour: at });
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
  header.textContent = `SKI JUMP — ${group} (${views.join(", ")}) — seed ${seed} — ${tier}\n${note}`;
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

window.__skijump = { ready, groups: GROUPS, sheet };
