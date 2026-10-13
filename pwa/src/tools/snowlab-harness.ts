// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW LAB's page (driven by `scripts/snowlab-preview.mjs`): the snow as
// a skier and a snowboarder work it, through the game's own renderer — the
// carve on the groomer, the hockey stop on skis, a snowboard's heel and toe
// stops, a powder turn, the crater a fall leaves, and the track line from
// the chase lens — each a ROW, each COLUMN a sun (the day's and a low one).
// The page draws one sheet with the deformable snow on or off (`deform=`),
// so the script lays the game before it beside the game after it.
//
// With `perf=1` it draws nothing to keep: the carve ridden from the chase
// lens for a few seconds, every frame drawn and drained, and what a frame
// cost — its milliseconds, its draw calls and triangles — handed back.

import {
  createGame,
  NEUTRAL_INPUT,
  pairById,
  placeRun,
  step,
  type GameState,
  type SkierInput,
  type SkyOverride,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { deformAs } from "../game/deform-snow.ts";
import { holdInput } from "../game/hold-input.ts";
import { createWorldRenderer } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { hourAt, meadow, pisteSpot } from "./stage.ts";

declare global {
  interface Window {
    __snowlab?: {
      ready: Promise<void>;
      sheet(): Promise<{ rows: number; cols: number; w: number; h: number }>;
      perf(): Promise<{ ms: number; calls: number; triangles: number; frames: number }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const on = params.get("deform") !== "off";
deformAs(on);
const cellW = Number(params.get("w") ?? 480);
const cellH = Number(params.get("h") ?? 300);
const DEG = Math.PI / 180;
const FRAME = 1 / 60;
/** The two suns, degrees over the horizon: the day's and a low one. */
const SUNS = (params.get("suns") || "26,7").split(",").map(Number);

type Scene = {
  id: string;
  title: string;
  /** Where: the piste's groomer or the meadow's powder. */
  where: "piste" | "meadow";
  skis: string;
  kmh: number;
  /** The snow dial (`GameState.snowDepth`). */
  depth: number;
  /** The input at `t` s into the ride. */
  input(state: GameState, heading: number, t: number): SkierInput;
  /** When the picture is taken, s, and from where (null the chase lens). */
  at: number;
  lens(state: GameState, heading: number): LensPose | null;
  /** Ride until this says so (a fall), up to `at`. */
  until?: (state: GameState) => boolean;
};

/** The lens in the skier's own heading frame (x right, ahead, up). */
function frameOf(state: GameState, heading: number) {
  const s = state.skier.thrown ?? state.skier;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  return (f: number, r: number, up: number) => {
    const x = s.x + fx * f + fz * r;
    const z = s.z + fz * f - fx * r;
    return { x, y: state.level.groundAt(x, z) + up, z };
  };
}
const lensAt = (
  state: GameState,
  heading: number,
  eye: [number, number, number],
  target: [number, number, number],
  fov = 44,
): LensPose => {
  const at = frameOf(state, heading);
  return { eye: at(...eye), target: at(...target), fov, roll: 0 };
};

/** A board's stop turned the other way: the steer mirrored. */
const mirrored = (i: SkierInput): SkierInput => ({ ...i, steer: -i.steer });
/** The fall: edged hard over, skidding, the weight back (`powder-lab.ts`). */
const LAID_DOWN: SkierInput = { ...NEUTRAL_INPUT, steer: 1, brake: 1, lean: 1 };

const SCENES: Scene[] = [
  {
    id: "carve",
    title: "CARVE ON THE GROOMER",
    where: "piste",
    skis: "chough",
    kmh: 55,
    depth: 1,
    input: (s, h, t) => holdInput(s, 55, h, "carve", t),
    at: 2.0,
    lens: (s, h) => lensAt(s, h, [-5.5, 1.6, 0.55], [1.5, -0.4, 0.2], 42),
  },
  {
    id: "stop",
    title: "HOCKEY STOP, SKIS",
    where: "piste",
    skis: "chamois",
    kmh: 45,
    depth: 1,
    input: (s, h, t) => holdInput(s, 45, h, "stop", t),
    at: 0.75,
    lens: (s, h) => lensAt(s, h, [4.2, 3.4, 0.9], [-0.6, -0.4, 0.4], 48),
  },
  {
    id: "heel",
    title: "BOARD STOP, HEELSIDE",
    where: "piste",
    skis: "lynx",
    kmh: 40,
    depth: 1,
    input: (s, h, t) => holdInput(s, 40, h, "stop", t),
    at: 0.75,
    lens: (s, h) => lensAt(s, h, [4.2, 3.4, 0.9], [-0.6, -0.4, 0.4], 48),
  },
  {
    id: "toe",
    title: "BOARD STOP, TOESIDE",
    where: "piste",
    skis: "lynx",
    kmh: 40,
    depth: 1,
    input: (s, h, t) => mirrored(holdInput(s, 40, h, "stop", t)),
    at: 0.75,
    lens: (s, h) => lensAt(s, h, [4.2, -3.4, 0.9], [-0.6, 0.4, 0.4], 48),
  },
  {
    id: "powder",
    title: "POWDER TURN",
    where: "meadow",
    skis: "marmot",
    kmh: 35,
    depth: 2.2,
    input: (s, h, t) => holdInput(s, 35, h, "turn", t),
    at: 1.3,
    lens: (s, h) => lensAt(s, h, [5, 4.5, 1.2], [-0.8, -0.6, 0.4], 50),
  },
  {
    id: "crater",
    title: "FALL CRATER",
    where: "meadow",
    skis: "chamois",
    kmh: 25,
    depth: 2.2,
    input: () => LAID_DOWN,
    at: 3.2,
    lens: (s, h) => lensAt(s, h, [-1.5, 3.2, 2.6], [0.3, 0, -0.2], 50),
  },
  {
    id: "track",
    title: "TRACK LINE, CHASE",
    where: "meadow",
    skis: "chamois",
    kmh: 40,
    depth: 2.2,
    input: (s, h, t) => holdInput(s, 40, h, "carve", t),
    at: 5,
    lens: () => null,
  },
];
const wanted = (params.get("scenes") || "").split(",").filter(Boolean);
const scenes = wanted.length ? SCENES.filter((s) => wanted.includes(s.id)) : SCENES;

const stage = document.getElementById("stage") as HTMLCanvasElement;
const sheet = document.getElementById("sheet") as HTMLCanvasElement;
const renderer = createWorldRenderer(stage, {
  video: withPreset(DEFAULT_VIDEO, tier),
  preserveDrawingBuffer: true,
});
renderer.resize(cellW, cellH, 1);
const first = createGame({ seed, mode: "free", rivals: 0, quiet: true });
const level = first.level;
let loaded = level;

/** The meadow and its fall line, the piste's spot and its heading. */
function spotOf(where: Scene["where"]): { x: number; z: number; heading: number } {
  if (where === "piste") return pisteSpot(level, 1 / 3);
  const m = meadow(level);
  const n = { x: 0, y: 1, z: 0 };
  level.normalAt(m.x, m.z, n);
  return { x: m.x, z: m.z, heading: Math.hypot(n.x, n.z) > 0.05 ? Math.atan2(n.x, n.z) : 0 };
}

/** Ride `scene` to its moment through the renderer, every frame drawn. */
async function ride(scene: Scene): Promise<GameState> {
  const spot = spotOf(scene.where);
  const state = createGame({
    level,
    mode: "free",
    rivals: 0,
    quiet: true,
    spec: pairById(scene.skis),
    snowDepth: scene.depth,
  });
  // A deeper dial is a map of its own (its tree wells): the renderer stands it up.
  if (state.level !== loaded) {
    loaded = state.level;
    await renderer.load(state);
  }
  placeRun(state, { x: spot.x, z: spot.z, heading: spot.heading, speed: scene.kmh / 3.6 });
  const t0 = state.t;
  renderer.setOverride(null);
  renderer.setCamera("chase", true);
  renderer.draw(state, 0, FRAME, false);
  await renderer.shadeSettled();
  while (state.t - t0 < scene.at) {
    for (let i = 0; i < 2; i++) step(state, scene.input(state, spot.heading, state.t - t0));
    renderer.draw(state, 0, FRAME, false);
  }
  (state as GameState & { heading0?: number }).heading0 = spot.heading;
  return state;
}

window.__snowlab = {
  ready: renderer.load(first),
  async sheet() {
    const labelW = 170;
    const headH = 34;
    sheet.width = labelW + cellW * SUNS.length;
    sheet.height = headH + cellH * scenes.length;
    const ctx = sheet.getContext("2d")!;
    ctx.fillStyle = "#0b1116";
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.fillStyle = "#e8eef4";
    ctx.font = "12px monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `SNOW LAB · deformable snow ${on ? "ON" : "OFF (the game before)"} · seed ${seed} · ${tier}`,
      8,
      10,
    );
    SUNS.forEach((e, c) => ctx.fillText(`sun ${e}° up`, labelW + c * cellW + 6, 26));
    for (let c = 0; c < SUNS.length; c++) {
      const sky: SkyOverride = { weather: "clear", hour: hourAt(level, SUNS[c] * DEG) };
      renderer.setSky(sky);
      for (let r = 0; r < scenes.length; r++) {
        const scene = scenes[r];
        const state = await ride(scene);
        const heading = (state as GameState & { heading0?: number }).heading0 ?? 0;
        renderer.setOverride(scene.lens(state, heading));
        for (let i = 0; i < 3; i++) renderer.draw(state, 0, 0, true);
        const x0 = labelW + c * cellW;
        const y0 = headH + r * cellH;
        ctx.drawImage(stage, x0, y0, cellW, cellH);
        if (c === 0) {
          ctx.fillStyle = "#e8eef4";
          const words = scene.title.split(", ");
          words.forEach((l, i) => ctx.fillText(l, 8, y0 + cellH / 2 - 8 + i * 16));
          ctx.fillText(
            `${scene.skis} ${scene.kmh} km/h`,
            8,
            y0 + cellH / 2 + 8 + words.length * 16,
          );
        }
        await new Promise((done) => setTimeout(done, 0));
      }
    }
    renderer.setSky(null);
    renderer.setOverride(null);
    return { rows: scenes.length, cols: SUNS.length, w: sheet.width, h: sheet.height };
  },
  async perf() {
    const scene = SCENES[0];
    renderer.setSky({ weather: "clear", hour: hourAt(level, SUNS[0] * DEG) });
    const spot = spotOf(scene.where);
    const state = createGame({
      level,
      mode: "free",
      rivals: 0,
      quiet: true,
      spec: pairById(scene.skis),
    });
    placeRun(state, { x: spot.x, z: spot.z, heading: spot.heading, speed: scene.kmh / 3.6 });
    renderer.setOverride(null);
    renderer.setCamera("chase", true);
    renderer.draw(state, 0, FRAME, true);
    await renderer.shadeSettled();
    const t0 = state.t;
    let ms = 0;
    let frames = 0;
    let calls = 0;
    let triangles = 0;
    while (state.t - t0 < 4) {
      for (let i = 0; i < 2; i++) step(state, scene.input(state, spot.heading, state.t - t0));
      const a = performance.now();
      renderer.draw(state, 0, FRAME, true);
      renderer.drain();
      const cost = performance.now() - a;
      // The first second settles the maps and the field; it is not counted.
      if (state.t - t0 < 1) continue;
      ms += cost;
      frames++;
      const info = renderer.info();
      calls += info.calls;
      triangles += info.triangles;
    }
    return { ms: ms / frames, calls: calls / frames, triangles: triangles / frames, frames };
  },
};
