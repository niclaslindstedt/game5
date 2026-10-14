// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FILM CAMERA LAB's page (`scripts/cinema-preview.mjs`): the menu's
// backdrop — a showcase ridden by the daring bot — seen through the film
// director's camera as the app sees it, two ways:
//
//   live    as under the front door (`cinema-run.ts`): the run read ahead,
//           the lenses planted for what is coming, the backdrop's clock
//           slowed over a long flight's hang.
//   replay  the same showcase ridden and recorded the way a run is
//           (`replay-run.ts`), then watched back from its start on the
//           replay's FILM angle, the replay's own director pacing it.
//
// Every frame is MEASURED against the skier — the lens's distance, how far
// off the axis he is, whether he is inside the frame at all, whether the
// snow stands between them and whether the lens is in the snow — and
// captioned with the take it is on (`filmTake`), so a sheet says in words
// and numbers what the picture shows. Frames are photographed every
// `every` wall seconds; the frames between are stepped and framed but not
// drawn. A frame is a sixtieth of a second by fiat, so a seed's sheet is
// the same sheet twice. It exposes `window.__cinema.sheet(mode)`.

import {
  createGame,
  generateLevel,
  NEUTRAL_INPUT,
  showcaseSkis,
  step,
  TUNING,
  type GameState,
} from "@engine";

import { backdropInput, backdropNext } from "../game/backdrop-run.ts";
import { filmTake, lensInSolid } from "../game/camera-cinema.ts";
import { createLineClear } from "../game/camera-clear.ts";
import { createCinemaRun } from "../game/cinema-run.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { createReplayRun } from "../game/replay-run.ts";
import { DEFAULT_VIDEO, withPreset } from "../game/settings-video.ts";

type Frame = { label: string; caption: string; png: string; kind: string; off: number };
/** One frame's measure: the lens against the skier. */
type Measure = {
  t: number;
  kind: string;
  n: number;
  dist: number;
  off: number;
  inFrame: boolean;
  blocked: boolean;
  buried: boolean;
  /** His height's share of the frame's: 1.8 m against the vertical field. */
  size: number;
  /** The lens inside a solid (a crown, a trunk, a house, a tower). */
  solid: boolean;
};

declare global {
  interface Window {
    __cinema?: {
      ready: Promise<string>;
      sheet(mode: string): Promise<{ frames: Frame[]; measures: Measure[]; picks: Frame[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 7);
const take = Number(params.get("take") ?? 0);
const width = Number(params.get("w") ?? 960);
const height = Number(params.get("h") ?? 540);
const cols = Number(params.get("cols") ?? 6);
const scale = Number(params.get("scale") ?? 0.3);
const every = Number(params.get("every") ?? 0.5);
const most = Number(params.get("most") ?? 50);

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
renderer.setCamera("orbit", true);

const level = generateLevel(seed);
const solids = createLineClear(level);
const fresh = (): GameState =>
  createGame({ level, seed, showcase: take, spec: showcaseSkis(), quiet: true });

const ready = (async () => {
  const first = fresh();
  await renderer.load(first);
  renderer.draw(first, 1, 1 / 60);
  await renderer.shadeSettled();
  return `${level.kickers?.length ?? 0} kickers, ${level.trees.length} trees`;
})();

const flat = document.createElement("canvas");
flat.width = width;
flat.height = height;
/** The canvas as a frame, the film's letterbox laid over it as the page
 * draws it (`film-bars.ts`'s `--film-bar`). */
function framed(): string {
  const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--film-bar"));
  if (!(bar > 0)) return canvas.toDataURL("image/jpeg", 0.85);
  const g = flat.getContext("2d")!;
  g.drawImage(canvas, 0, 0, width, height);
  const h = Math.round((height * bar) / 100);
  g.fillStyle = "#000";
  g.fillRect(0, 0, width, h);
  g.fillRect(0, height - h, width, h);
  return flat.toDataURL("image/jpeg", 0.85);
}

/** Where the skier IS: his body when he is thrown, else his hips. */
function bodyOf(s: GameState): { x: number; y: number; z: number } {
  const t = s.skier.thrown;
  if (t) return { x: t.x, y: t.y, z: t.z };
  return { x: s.skier.x, y: s.skier.y + 0.9, z: s.skier.z };
}

/** The lens against the skier this frame. */
function measure(s: GameState, t: number): Measure {
  const lens = renderer.lensPose();
  const b = bodyOf(s);
  const dx = b.x - lens.x;
  const dy = b.y - lens.y;
  const dz = b.z - lens.z;
  const dist = Math.hypot(dx, dy, dz);
  const fx = Math.sin(lens.yaw) * Math.cos(lens.pitch);
  const fy = Math.sin(lens.pitch);
  const fz = Math.cos(lens.yaw) * Math.cos(lens.pitch);
  const cos = (fx * dx + fy * dy + fz * dz) / Math.max(1e-6, dist);
  const off = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  let blocked = false;
  const n = Math.ceil(dist / 0.5);
  for (let k = 1; k < n - 1 && !blocked; k++) {
    const f = k / n;
    const x = lens.x + dx * f;
    const z = lens.z + dz * f;
    if (lens.y + dy * f < level.groundAt(x, z) - 0.05) blocked = true;
  }
  const take = filmTake();
  return {
    t,
    kind: take?.framing ?? "-",
    n: take?.n ?? -1,
    dist,
    off,
    // Inside the frame: within the vertical half-field (the narrower one).
    inFrame: off < lens.fov / 2,
    blocked,
    buried: lens.y < level.groundAt(lens.x, lens.z),
    size: (2 * Math.atan(0.9 / Math.max(0.3, dist))) / ((lens.fov * Math.PI) / 180),
    solid: lensInSolid(level, solids, lens, 0.1),
  };
}

async function sheet(
  mode: string,
): Promise<{ frames: Frame[]; measures: Measure[]; picks: Frame[] }> {
  const note = await ready;
  let state = fresh();
  const WALL = 1 / 60;
  const frames: Frame[] = [];
  const measures: Measure[] = [];
  let acc = 0;
  let next = 0.5;
  let tick: (() => number) | null = null;
  let input = () => backdropInput(state);
  let done = () => false;
  let cleanup = (): void => {};

  if (mode === "live") {
    const cinema = createCinemaRun(renderer, backdropInput);
    tick = () => cinema.frame(state, true);
    cleanup = () => void cinema.frame(state, false);
  } else if (mode === "replay") {
    const replays = createReplayRun({
      renderer,
      show: (s) => {
        state = s;
      },
      shell: () => "run",
    });
    replays.arm(state, "free");
    for (let k = 0; k < most / TUNING.dt; k++) {
      const i = backdropInput(state);
      step(state, i);
      replays.step(i, state);
      if (backdropNext(state)) break;
    }
    if (!replays.watch("start", state, "run")) throw new Error("nothing recorded");
    while ((replays.bar()?.rung ?? "film") !== "film") replays.camera();
    tick = () => replays.frame();
    input = () => replays.input() ?? NEUTRAL_INPUT;
    done = () => !(replays.bar()?.playing ?? false);
    cleanup = () => replays.clear();
  } else throw new Error(`no mode "${mode}"`);

  renderer.draw(state, 1, 1 / 60);
  await new Promise((r) => setTimeout(r, 300));
  for (let wall = 0; wall < most; wall += WALL) {
    const rate = tick!();
    renderer.setPace(rate);
    acc += WALL * rate;
    let steps = Math.floor(acc / TUNING.dt);
    acc -= steps * TUNING.dt;
    while (steps-- > 0) {
      step(state, input());
      if (mode === "live") {
        const again = backdropNext(state);
        if (again) state = again;
      }
    }
    const shoot = wall >= next;
    renderer.draw(state, 1, WALL * rate, shoot);
    const m = measure(state, state.t);
    measures.push(m);
    if (shoot) {
      next += every;
      frames.push({
        label: `${wall.toFixed(1)}s`,
        kind: m.kind,
        off: m.off,
        caption:
          `${m.kind.toUpperCase()} #${m.n} · wall ${wall.toFixed(1)} s · run ${state.t.toFixed(1)} s` +
          `${rate < 0.99 ? ` · ×${rate.toFixed(2)}` : ""}\n` +
          `${m.dist.toFixed(1)} m · off ${m.off.toFixed(0)}°${m.inFrame ? "" : " · OUT OF FRAME"}` +
          `${m.blocked ? " · BEHIND SNOW" : ""}${m.buried ? " · LENS IN SNOW" : ""}` +
          `${m.solid ? " · LENS IN SOLID" : ""} · ${Math.round(m.size * 100)}% tall` +
          `${state.skier.airborne ? " · air" : ""}`,
        png: framed(),
      });
    }
    if (done()) break;
  }
  cleanup();
  // ONE FRAME A KIND: the one with him nearest the middle.
  const best = new Map<string, Frame>();
  for (const f of frames) {
    const held = best.get(f.kind);
    if (!held || f.off < held.off) best.set(f.kind, f);
  }
  const picks = [...best.values()];
  await lay(`${mode} — every ${every} s of wall`, note, frames, cols, scale);
  return { frames, measures, picks };
}

/** The frames laid out as the page's sheet. */
async function lay(
  title: string,
  note: string,
  frames: Frame[],
  across: number,
  share: number,
): Promise<void> {
  const tw = Math.round(width * share);
  const th = Math.round(height * share);
  sheetEl.style.gridTemplateColumns = `repeat(${across}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent = `FILM CAMERA — ${title} — seed ${seed} take ${take}\n${note}`;
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
}

window.__cinema = {
  ready,
  sheet,
  // The one-a-kind sheet, laid from the last sheet's picks.
  picks: (picks: Frame[]) => lay("one frame a shot", "", picks, 4, 0.5),
} as Window["__cinema"] & { picks: (p: Frame[]) => Promise<void> };
