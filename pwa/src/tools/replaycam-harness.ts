// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REPLAY CAMERA LAB's page (`scripts/replaycam-preview.mjs`): a run
// ridden and recorded the way the app records one (`replay-run.ts` armed
// before the first step and handed every step after it), then WATCHED BACK
// through the app's own transport — the director pacing the picture, the
// renderer told which moment holds the frame — on one rung of the watching
// ladder after another, and photographed every `every` wall seconds through
// the game's own renderer.
//
// Every frame is also MEASURED, so a sheet says in numbers what the picture
// shows: how far the lens stands from the skier (his body, when he is
// thrown), how far off the middle of the frame he is, and whether the snow
// stands between them. A frame where he is far off the axis or behind the
// slope is a frame the replay lost him in.
//
// Nothing reads a wall clock: a frame is a sixtieth of a second by fiat,
// so a seed's sheet is the same sheet twice. It exposes
// `window.__replaycam.sheet(scene, rung)`.

import {
  botInput,
  createGame,
  generateLevel,
  NEUTRAL_INPUT,
  nearestTrackPoint,
  placeRun,
  step,
  TUNING,
  type GameState,
  type SkierInput,
} from "@engine";

import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { createReplayRun, WATCHING_CAMERAS, type WatchRung } from "../game/replay-run.ts";
import { DEFAULT_VIDEO, withPreset } from "../game/settings-video.ts";
import { loneTree } from "./gore-scenes.ts";

type Frame = { label: string; caption: string; png: string };
/** One frame's measure: the lens against the skier. */
type Measure = { t: number; dist: number; off: number; blocked: boolean; shot: string };

declare global {
  interface Window {
    __replaycam?: {
      ready: Promise<string>;
      scenes: readonly string[];
      rungs: readonly string[];
      sheet(scene: string, rung: string): Promise<{ frames: Frame[]; measures: Measure[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 2);
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);
const cols = Number(params.get("cols") ?? 4);
const scale = Number(params.get("scale") ?? 0.4);
/** Wall seconds between two frames shot, and the most wall seconds watched. */
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
renderer.setCamera("chase", true);

const level = generateLevel(seed);
const fresh = (): GameState => createGame({ level, seed, mode: "free", crowd: 0, quiet: true });

type Drive = (state: GameState) => SkierInput;
/** A run stood up for the recording, the hands it is ridden on, when the
 * recording is cut, and where it is watched from. */
type Scene = {
  s: GameState;
  drive: Drive;
  /** Stop riding once this holds (or `limit` s). */
  done: (s: GameState, since: number) => boolean;
  limit: number;
  from: "start" | "crash" | "recent";
};

/** The piste's point `s` metres down it. */
const pointAt = (s: number) => level.track.points.find((p) => p.s >= s) ?? level.track.points[0];

/** The steepest stretch of the piste, by its own fall over 20 m. */
function steepest(): { x: number; z: number; heading: number } {
  const pts = level.track.points;
  let best = pts[0];
  let drop = -Infinity;
  for (let i = 0; i + 10 < pts.length; i++) {
    if (pts[i].s < 60 || pts[i].s > level.track.length - 120) continue;
    const d = pts[i].y - pts[i + 10].y;
    if (d > drop) {
      drop = d;
      best = pts[i];
    }
  }
  return best;
}

/** How long he has been thrown, s; 0 on his skis. */
const thrownFor = (s: GameState): number => (s.skier.thrown ? s.skier.thrown.t : 0);

const SCENES: Record<string, () => Scene> = {
  /** Skied at a lone trunk at 50 km/h from 40 m up the fall line. */
  tree: () => {
    const s = fresh();
    const t = loneTree(level, 0, true);
    const n = { x: 0, y: 1, z: 0 };
    level.normalAt(t.x, t.z, n);
    const h = Math.hypot(n.x, n.z) > 0.02 ? Math.atan2(n.x, n.z) : 0;
    placeRun(s, { x: t.x - Math.sin(h) * 40, z: t.z - Math.cos(h) * 40, heading: h, speed: 14 });
    return {
      s,
      drive: () => NEUTRAL_INPUT,
      done: (q) => thrownFor(q) > 3,
      limit: 15,
      from: "crash",
    };
  },
  /** The edge caught at speed on the steepest pitch: a hard turn held tucked. */
  edge: () => {
    const s = fresh();
    const p = steepest();
    placeRun(s, { x: p.x, z: p.z, heading: p.heading, speed: 24 });
    const turn: Drive = (q) =>
      q.t < 1.2 ? { ...NEUTRAL_INPUT, tuck: 1 } : { ...NEUTRAL_INPUT, tuck: 1, edge: 1, lean: -1 };
    return { s, drive: turn, done: (q) => thrownFor(q) > 3.5, limit: 15, from: "crash" };
  },
  /** The bot down the top of the piste, over whatever it carries. */
  run: () => {
    const s = fresh();
    const p = pointAt(20);
    placeRun(s, { x: p.x, z: p.z, heading: p.heading, speed: 8 });
    return {
      s,
      drive: (q) => botInput(q),
      done: (q) => q.t > 26,
      limit: 30,
      from: "start",
    };
  },
  /** The bot through the finish line. */
  finish: () => {
    const s = fresh();
    const p = pointAt(level.track.length - 260);
    placeRun(s, { x: p.x, z: p.z, heading: p.heading, speed: 14 });
    let at = -1;
    return {
      s,
      drive: (q) => botInput(q),
      done: (q) => {
        const near = nearestTrackPoint(level, q.skier.x, q.skier.z);
        if (at < 0 && near.s > level.track.length - 1) at = q.t;
        return at >= 0 && q.t > at + 3;
      },
      limit: 40,
      from: "start",
    };
  },
};

const ready = (async () => {
  const first = fresh();
  await renderer.load(first);
  renderer.draw(first, 1, 1 / 60);
  await renderer.shadeSettled();
  return `${level.trees.length} trees, piste ${Math.round(level.track.length)} m`;
})();

/** Where the skier IS: his body when he is thrown, else his hips. */
function bodyOf(s: GameState): { x: number; y: number; z: number } {
  const t = s.skier.thrown;
  if (t) return { x: t.x, y: t.y, z: t.z };
  return { x: s.skier.x, y: s.skier.y + 0.9, z: s.skier.z };
}

/** The lens against the skier this frame. */
function measure(s: GameState, shot: string, t: number): Measure {
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
  // THE SNOW BETWEEN: the sightline sampled every half metre against the ground.
  let blocked = false;
  const n = Math.ceil(dist / 0.5);
  for (let k = 1; k < n - 1 && !blocked; k++) {
    const f = k / n;
    const x = lens.x + dx * f;
    const z = lens.z + dz * f;
    if (lens.y + dy * f < level.groundAt(x, z) - 0.05) blocked = true;
  }
  return { t, dist, off, blocked, shot };
}

async function sheet(
  name: string,
  rung: string,
): Promise<{ frames: Frame[]; measures: Measure[] }> {
  const note = await ready;
  const make = SCENES[name];
  if (!make) throw new Error(`no scene "${name}"`);
  if (!WATCHING_CAMERAS.includes(rung as WatchRung)) throw new Error(`no rung "${rung}"`);

  // RIDDEN AND RECORDED, undrawn, as the app records a run.
  const scene = make();
  let state = scene.s;
  const replays = createReplayRun({
    renderer,
    show: (next) => {
      state = next;
    },
    shell: () => "run",
  });
  replays.arm(state, "free");
  for (let k = 0; k < scene.limit / TUNING.dt; k++) {
    if (scene.done(state, k * TUNING.dt)) break;
    const input = scene.drive(state);
    step(state, input);
    replays.step(input, state);
  }
  const live = state;
  if (!replays.watch(scene.from, live, "run")) throw new Error(`${name}: nothing recorded`);
  while ((replays.bar()?.rung ?? rung) !== rung) replays.camera();

  // WATCHED, drawn as the app draws it.
  renderer.draw(state, 1, 1 / 60);
  await new Promise((r) => setTimeout(r, 300));
  const frames: Frame[] = [];
  const measures: Measure[] = [];
  const WALL = 1 / 60;
  let acc = 0;
  let next = 0;
  for (let wall = 0; wall < most; wall += WALL) {
    const rate = replays.frame();
    renderer.setPace(rate);
    acc += WALL * rate;
    let steps = replays.cap(Math.floor(acc / TUNING.dt));
    acc -= steps * TUNING.dt;
    while (steps-- > 0) {
      const input = replays.input() ?? NEUTRAL_INPUT;
      step(state, input);
      replays.step(input, state);
    }
    const shoot = wall >= next;
    renderer.draw(state, 1, rate === 0 ? 0 : WALL * rate, shoot);
    const bar = replays.bar();
    if (!bar) break;
    const shot = bar.slow ? "slow" : "";
    const m = measure(state, shot, state.t);
    measures.push(m);
    if (shoot) {
      next += every;
      frames.push({
        label: `${wall.toFixed(1)}s`,
        caption:
          `${name} · ${rung} · wall ${wall.toFixed(1)} s · run ${state.t.toFixed(2)} s · ×${rate.toFixed(2)}\n` +
          `lens ${m.dist.toFixed(1)} m · off ${m.off.toFixed(0)}°${m.blocked ? " · BEHIND THE SNOW" : ""}` +
          `${state.skier.thrown ? " · thrown" : ""}${shot ? ` · ${shot}` : ""}`,
        png: canvas.toDataURL("image/png"),
      });
    }
    if (!bar.playing) break;
  }
  replays.clear();
  return lay(`${name} — ${rung}`, note, frames, measures);
}

/** The frames laid out as the page's sheet. */
async function lay(
  title: string,
  note: string,
  frames: Frame[],
  measures: Measure[],
): Promise<{ frames: Frame[]; measures: Measure[] }> {
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent = `REPLAY CAMERA — ${title} — seed ${seed} — every ${every} s of wall\n${note}`;
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
  return { frames, measures };
}

window.__replaycam = {
  ready,
  scenes: Object.keys(SCENES),
  rungs: WATCHING_CAMERAS,
  sheet,
};
