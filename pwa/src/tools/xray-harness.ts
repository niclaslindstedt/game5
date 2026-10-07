// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE X-RAY LAB's page (`scripts/xray-preview.mjs`): a hard blow on a run
// with the INJURIES switch on, run the way the app runs it — the app's own
// X-ray rig (`xray-run.ts`: the read ahead, the director) deciding every
// frame how many steps the run takes and what the lens looks at — and drawn
// through the game's OWN renderer, photographed every `every` wall seconds
// so the whole sequence reads as a strip: the lead in, the bone cracking,
// the pans, the tear, the body, the death.
//
// Nothing reads a wall clock: a frame is a sixtieth of a second by fiat,
// so a seed's sheet is the same sheet twice. It exposes
// `window.__xray.sheet(scene)`.

import { createGame, generateLevel, NEUTRAL_INPUT, step, TUNING, type GameState } from "@engine";

import { diedOf } from "../game/hud-wreck.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, withPreset } from "../game/settings-video.ts";
import { createXrayRun } from "../game/xray-run.ts";
import type { XrayLook } from "../game/xray-shots.ts";
import { intoTree, ontoSnow, skiAtTree, type Stage } from "./gore-scenes.ts";

type Frame = { label: string; caption: string; png: string };

declare global {
  interface Window {
    __xray?: {
      ready: Promise<string>;
      scenes: readonly string[];
      sheet(scene: string): Promise<{ frames: Frame[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 2);
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);
const cols = Number(params.get("cols") ?? 4);
const scale = Number(params.get("scale") ?? 0.4);
/** Wall seconds between two frames shot, and the most wall seconds run. */
const every = Number(params.get("every") ?? 0.5);
const most = Number(params.get("most") ?? 14);

const canvas = document.getElementById("stage") as HTMLCanvasElement;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
const sheetEl = document.getElementById("sheet") as HTMLDivElement;

await loadModels();
const renderer = createWorldRenderer(canvas, {
  video: withPreset(DEFAULT_VIDEO, "high"),
  preserveDrawingBuffer: true,
});
renderer.resize(width, height, 1);
renderer.setDeathCam(true);
renderer.setCamera("chase", true);

const level = generateLevel(seed);
const fresh = (): GameState =>
  createGame({ level, seed, mode: "free", gore: true, crowd: 0, quiet: true });

/** The gore lab's stagings, borrowed: only `level` and `fresh` are read. */
const stage = { level, fresh } as unknown as Stage;

/** THE SCENES: a run stood at the moment before a blow. */
const SCENES: Record<string, () => GameState> = {
  /** Skied at a lone trunk at 80 km/h from 25 m up the line. */
  trunk: () => skiAtTree(stage, 22, 25).s,
  /** Skied at one at 108 km/h: the limbs go. */
  "trunk-fast": () => skiAtTree(stage, 30, 30).s,
  /** Flown head first into a trunk at 90 km/h: the head torn off. */
  head: () => intoTree(stage, "head", 25).s,
  /** Thrown flat on his side at 100 km/h, sliding on: the limbs torn off
   * and the trunk burst — he dies. */
  slam: () => ontoSnow(stage, "left", 28, 8).s,
};

const ready = (async () => {
  const first = fresh();
  await renderer.load(first);
  renderer.draw(first, 1, 1 / 60);
  await renderer.shadeSettled();
  return `${level.trees.length} trees`;
})();

const lookLine = (l: XrayLook | null): string =>
  !l || !l.active
    ? "x-ray off"
    : `${l.shot?.kind === "bone" ? `bone ${l.shot.bone}` : (l.shot?.kind ?? "-")} #${l.index} · rate ${l.rate.toFixed(2)} · glass ${l.xray.toFixed(2)}`;

async function sheet(name: string): Promise<{ frames: Frame[] }> {
  const note = await ready;
  const make = SCENES[name];
  if (!make) throw new Error(`no scene "${name}"`);
  const state = make();
  // One frame drawn and a moment let by, so the skeleton's chunk is in.
  renderer.draw(state, 1, 1 / 60);
  await new Promise((r) => setTimeout(r, 300));
  let look: XrayLook | null = null;
  const xray = createXrayRun((l) => {
    look = l;
    renderer.setXray(l);
  });
  const frames: Frame[] = [];
  const WALL = 1 / 60;
  let acc = 0;
  let wall = 0;
  let next = 0;
  let started = -1;
  for (let f = 0; wall < most; f++) {
    const rate = xray.frame(state, WALL, true);
    acc += WALL * rate;
    while (acc >= TUNING.dt) {
      acc -= TUNING.dt;
      step(state, NEUTRAL_INPUT);
      xray.step(state);
    }
    wall += WALL;
    const l = look as XrayLook | null;
    if (started < 0 && l?.active) started = wall;
    const shoot = wall >= next;
    renderer.draw(state, 1, WALL, shoot);
    if (shoot) {
      next += every;
      // Before the cam takes the run, a frame a second is plenty.
      if (started < 0) next += every;
      const died = diedOf(state);
      frames.push({
        label: `${wall.toFixed(1)}s`,
        caption:
          `${name} wall ${wall.toFixed(2)} s · run ${state.t.toFixed(2)} s\n${lookLine(l)}` +
          `${state.skier.thrown ? " · thrown" : ""}${died !== null ? ` · DIED ${died.toFixed(1)}` : ""}`,
        png: canvas.toDataURL("image/png"),
      });
    }
    // Long after the cam let go, nothing more to see.
    if (started >= 0 && !l?.active && wall > started + 2 && diedOf(state) === null) break;
  }
  renderer.setXray(null);
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent = `X-RAY — ${name} — seed ${seed} — every ${every} s of wall\n${note}`;
  header.style.whiteSpace = "pre-wrap";
  const cells: HTMLElement[] = [header];
  for (const fr of frames) {
    const cell = document.createElement("figure");
    const caption = document.createElement("figcaption");
    caption.textContent = fr.caption;
    const img = document.createElement("img");
    img.src = fr.png;
    img.width = tw;
    img.height = th;
    await img.decode();
    cell.append(img, caption);
    cells.push(cell);
  }
  sheetEl.replaceChildren(...cells);
  return { frames };
}

window.__xray = { ready, scenes: Object.keys(SCENES), sheet };
