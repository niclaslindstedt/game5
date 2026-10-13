// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE EXIT CUT LAB's page (`scripts/exit-preview.mjs`): the jump plane
// climbed to its jump run on its pilot's hands, the helicopter flown up off
// its pad and the balloon let go high over the valley — the skier aboard
// each — then the jump, filmed through the game's OWN renderer frame by
// frame at the pace the app runs it (`renderer.exitPace`: the leap slowed),
// so the shots (`camera-exit.ts`), their cuts, the slow motion and the
// hand-back to the game's lens are seen as a player sees them, the
// letterbox composited in as the page draws it (`--exit-bar`).
//
// It exposes `window.__exit.film(craft, opts)`, which films one jump and
// hands back its frames: a filmstrip at the moments asked for, or every
// frame for a clip.

import {
  chutePilot,
  createGame,
  generateLevel,
  NEUTRAL_INPUT,
  paraPilot,
  pilotInput,
  skydiveInput,
  step,
  TUNING,
  type GameState,
  type RegionId,
  type SkierInput,
} from "@engine";

import { exitShotAt, exitSkipOf } from "../game/camera-exit.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import type { CameraRung } from "../game/renderer-api.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";

/** The crafts it films out of. */
export type Craft = "plane" | "heli" | "balloon" | "para";

type Frame = { label: string; caption: string; png: string };

type FilmOpts = {
  /** The camera rung the player rides on (the cut hands back to it). */
  rung: CameraRung;
  /** Seconds since the exit to shoot a still at — or none: every frame. */
  at: number[];
  /** Seconds since the exit the film runs to. */
  until: number;
  /** Every how many frames a clip keeps one (2: thirty a second). */
  every: number;
  /** Seconds aboard before the jump the film starts at. */
  before: number;
  /** Draw every how many frames between stills (a clip draws every one). */
  drawEvery: number;
  /** Pull the pilot chute on the bot's hands once the cut is over. */
  pull: boolean;
};

declare global {
  interface Window {
    __exit?: {
      ready: Promise<string>;
      film(craft: Craft, opts: Partial<FilmOpts>): Promise<{ frames: Frame[] }>;
      sheet(title: string, frames: Frame[]): Promise<void>;
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
const cols = Number(params.get("cols") ?? 4);
const scale = Number(params.get("scale") ?? 0.5);
const jpeg = params.get("jpeg") === "1";

const canvas = document.getElementById("stage") as HTMLCanvasElement;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
const sheetEl = document.getElementById("sheet") as HTMLDivElement;
const flat = document.createElement("canvas");
flat.width = width;
flat.height = height;
const ink = flat.getContext("2d")!;

await loadModels();
const renderer = createWorldRenderer(canvas, {
  video: withPreset(DEFAULT_VIDEO, tier),
  preserveDrawingBuffer: true,
});
renderer.resize(width, height, 1);
const level = generateLevel(seed, { region });
const FRAME = 1 / 60;

function fresh(craft: Craft): GameState {
  return createGame({ level, seed, region, mode: "free", [craft]: true, crowd: 0, quiet: true });
}

const ready = (async () => {
  const first = fresh("plane");
  await renderer.load(first);
  renderer.draw(first, 1, FRAME);
  await new Promise((r) => setTimeout(r, 1500));
  await renderer.shadeSettled();
  return `seed ${seed}${region ? ` ${region}` : ""} — ${tier} ${width}×${height}`;
})();

/** Stepped `seconds` on `drive` and not drawn. */
function skip(state: GameState, seconds: number, drive: (s: GameState) => SkierInput): void {
  const n = Math.round(seconds / TUNING.dt);
  for (let i = 0; i < n; i++) step(state, drive(state));
}

/** Each craft flown to where he jumps from, on its pilot's hands, and the
 * hands that fly it there and jump. */
function aboard(craft: Craft): { state: GameState; drive: (s: GameState) => SkierInput } {
  const state = fresh(craft);
  if (craft === "plane") {
    const held = (x: GameState): SkierInput => ({ ...skydiveInput(x), machine: false });
    for (let i = 0; i < 400 && !skydiveInput(state).machine; i++) skip(state, 2.5, held);
    return { state, drive: held };
  }
  if (craft === "heli") {
    const h = state.heli!;
    const aim = { x: h.x, z: h.z - 160, height: 650 };
    skip(state, 70, (x) => pilotInput(x, aim));
    return { state, drive: (x) => pilotInput(x, aim) };
  }
  if (craft === "para") {
    skip(state, 70, (x) => paraPilot(x));
    return { state, drive: (x) => paraPilot(x) };
  }
  const b = state.balloon!;
  b.mode = "flown";
  b.grounded = false;
  b.y = level.groundAt(b.x, b.z) + 650;
  b.vx = b.vy = b.vz = 0;
  return { state, drive: () => NEUTRAL_INPUT };
}

/** The canvas as a frame, the letterbox the page drew laid over it. */
function grab(): string {
  ink.drawImage(canvas, 0, 0, width, height);
  const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--exit-bar"));
  const on = document.documentElement.classList.contains("exit-cut");
  if (on && bar > 0) {
    const h = Math.round((bar / 100) * height);
    ink.fillStyle = "#000";
    ink.fillRect(0, 0, width, h);
    ink.fillRect(0, height - h, width, h);
  }
  return jpeg ? flat.toDataURL("image/jpeg", 0.88) : flat.toDataURL("image/png");
}

async function film(craft: Craft, o: Partial<FilmOpts>): Promise<{ frames: Frame[] }> {
  await ready;
  const opts: FilmOpts = {
    rung: "chase",
    at: [],
    until: 8,
    every: 1,
    before: 1,
    pull: false,
    drawEvery: o.at && o.at.length ? 3 : 1,
    ...o,
  };
  const { state, drive } = aboard(craft);
  renderer.setCamera(opts.rung, true);
  const frames: Frame[] = [];
  const wanted = [...opts.at].sort((a, b) => a - b);
  let acc = 0;
  let wall = -opts.before;
  let k = 0;
  let pressed = false;
  // One frame: stepped at the pace the app would run it at, and drawn on
  // every `drawEvery`th (the lens's hand-overs fly on the time between) or
  // when a still is due.
  let unseen = 0;
  let count = 0;
  const frame = (): void => {
    const pace = renderer.exitPace();
    acc += (FRAME * pace) / TUNING.dt;
    const n = Math.floor(acc);
    acc -= n;
    for (let i = 0; i < n; i++) {
      const jumped = !!state.chute;
      let input = jumped
        ? opts.pull && (state.chute?.since ?? 0) > 6
          ? chutePilot(state)
          : NEUTRAL_INPUT
        : drive(state);
      // The jump: one press, held over no second step.
      if (!jumped && wall >= 0 && !pressed) {
        input = { ...input, machine: true };
        pressed = true;
      }
      step(state, input);
    }
    unseen += FRAME * pace;
    wall += FRAME;
    if (count++ % opts.drawEvery === 0) draw();
  };
  const draw = (): void => {
    if (unseen <= 0) return;
    renderer.draw(state, acc, unseen);
    unseen = 0;
  };
  const caption = (): string => {
    const ch = state.chute;
    const since = ch?.since ?? 0;
    const shot = ch ? (exitShotAt(since, exitSkipOf(ch.from))?.shot ?? "after") : "aboard";
    const cut = document.documentElement.classList.contains("exit-cut") ? "cut" : "game";
    return (
      `${craft} · ${shot} [${cut}] · since ${since.toFixed(2)} s · wall ${wall.toFixed(2)} s · ` +
      `pace ${renderer.exitPace().toFixed(2)}${ch ? ` · agl ${ch.agl.toFixed(0)} m · ${ch.mode}` : ""}`
    );
  };
  for (let guard = 0; guard < 60 * 40; guard++) {
    frame();
    const since = state.chute?.since ?? -1;
    if (state.chute && since >= opts.until) break;
    if (wanted.length === 0) {
      if (k++ % opts.every === 0)
        frames.push({ label: `f${frames.length}`, caption: caption(), png: grab() });
      continue;
    }
    const due = (t: number): boolean => (t < 0 ? wall >= t : !!state.chute && since >= t);
    while (wanted.length && due(wanted[0])) {
      const t = wanted.shift()!;
      draw();
      frames.push({
        label: `${t >= 0 ? "+" : ""}${t.toFixed(2)}s`,
        caption: caption(),
        png: grab(),
      });
    }
    if (wanted.length === 0 && opts.at.length) break;
  }
  return { frames };
}

async function sheet(title: string, frames: Frame[]): Promise<void> {
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent = `EXIT CUT — ${title} — ${await ready}`;
  const cells: HTMLElement[] = [header];
  for (const f of frames) {
    const cell = document.createElement("figure");
    const img = document.createElement("img");
    img.src = f.png;
    img.width = tw;
    img.height = th;
    await img.decode();
    const cap = document.createElement("figcaption");
    cap.textContent = `${f.label}  ${f.caption}`;
    cell.append(img, cap);
    cells.push(cell);
  }
  sheetEl.replaceChildren(...cells);
}

window.__exit = { ready, film, sheet };
