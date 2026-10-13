// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW EVAL LAB's page (driven by `scripts/snow-eval.mjs`): the snow
// effects a skier makes, as the game draws them, on FIXED SHARED SCENES —
// the same moves, the same lenses, the same moments, so any way of drawing
// them is judged against the same frames. Each ROW is a scene:
//
//   carve      linked carves on the groomer, low behind him at the snow
//   stop       a hockey stop on skis on the groomer, close in front
//   heel       a snowboard's heelside stop, close in front
//   toe        a snowboard's toeside stop, close in front
//   powder     linked turns in deep powder, from the side ahead
//   crater     a fall out of the air into deep powder, from beside
//   chase      linked turns in powder, the game's own chase camera
//   track      the same ride, looked back at along the line it cut
//
// and each COLUMN a moment of it under two suns: a day's (35° up) and a low
// one (10° up, behind the lens's left), so the spray is seen lit and seen
// against the light. Every cell prints the speed and what the spray has in
// the air. `perf()` rides the stop and the powder at the LOW, MEDIUM and
// HIGH pictures and times the spray's own CPU work and the whole frame.
//
// Everything is driven off the engine's steps and the lab's own frame clock,
// so a still shows the motion at a chosen moment.

import {
  createGame,
  isRegionId,
  pairById,
  placeRun,
  step,
  type GameState,
  type RegionId,
  type SkierInput,
  type SkyOverride,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { holdInput } from "../game/hold-input.ts";
import { createWorldRenderer } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { SPRAY_STATS, setGpuSpray } from "../game/spray.ts";
import { hourAt, meadow, pisteSpot } from "./stage.ts";

declare global {
  interface Window {
    __snowEval?: {
      ready: Promise<void>;
      sheet(): Promise<{ rows: number; cols: number; w: number; h: number }>;
      perf(): Promise<PerfRow[]>;
    };
  }
}

export type PerfRow = {
  tier: Tier;
  scene: string;
  /** The whole frame drawn and read back, ms (median). */
  frameMs: number;
  /** The spray's own CPU work a frame, ms (mean). */
  sprayMs: number;
  /** The most grains in the air at once, and the bytes sent a frame (mean). */
  live: number;
  bytes: number;
};

const params = new URLSearchParams(location.search);
const list = (name: string, fallback: string) =>
  (params.get(name) || fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const seed = Number(params.get("seed") ?? 38);
const region = isRegionId(params.get("region")) ? (params.get("region") as RegionId) : undefined;
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const cellW = Number(params.get("w") ?? 400);
const cellH = Number(params.get("h") ?? 260);
const only = list("scenes", "carve,stop,heel,toe,powder,crater,chase,track");
const gpu = params.get("gpu") !== "0";
setGpuSpray(gpu);
SPRAY_STATS.count = true;

const stage = document.getElementById("stage") as HTMLCanvasElement;
const sheet = document.getElementById("sheet") as HTMLCanvasElement;
const renderer = createWorldRenderer(stage, {
  video: withPreset(DEFAULT_VIDEO, tier),
  preserveDrawingBuffer: true,
});
renderer.resize(cellW, cellH, 1);
const first: GameState = createGame({ seed, region, mode: "free", rivals: 0, quiet: true });
const level = first.level;
const DEG = Math.PI / 180;
const FRAME = 1 / 60;

type Where = "piste" | "meadow";
type Scene = {
  id: string;
  title: string;
  skis: string;
  where: Where;
  depth: number;
  kmh: number;
  /** The two moments, s after the start (or, for the crater, after he hits). */
  times: [number, number];
  input(state: GameState, t: number, heading: number): SkierInput;
  /** The lens, or null for the game's chase camera. */
  lens(state: GameState, from: { x: number; z: number; heading: number }): LensPose | null;
  /** Put him in the air instead of on the snow (the crater). */
  air?: boolean;
};

/** A point in the skier's frame: `f` ahead, `r` to his right, `up` off the snow. */
function frameAt(state: GameState, heading = state.skier.heading) {
  const s = state.skier;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  return (f: number, r: number, up: number, x = s.x, z = s.z) => {
    const px = x + fx * f + fz * r;
    const pz = z + fz * f - fx * r;
    return { x: px, y: level.groundAt(px, pz) + up, z: pz };
  };
}

/** A stop turned to `sign` (+1 right): the brake, then the edge hard over. */
function stopTo(sign: number) {
  return (state: GameState, t: number, heading: number): SkierInput => {
    const i = holdInput(state, 40, heading, "stop", t);
    return t >= 0.35 ? { ...i, steer: sign } : i;
  };
}

/** Close in front of him on the side the skis slide toward, low. */
function closeLens(side: number) {
  return (state: GameState, from: { heading: number }): LensPose => {
    const at = frameAt(state, from.heading);
    return { eye: at(4.2, 2.4 * side, 0.9), target: at(0, 0, 0.45), fov: 50, roll: 0 };
  };
}

const SCENES: Scene[] = [
  {
    id: "carve",
    title: "CARVE · GROOMER",
    skis: "chamois",
    where: "piste",
    depth: 1,
    kmh: 55,
    times: [1.3, 2.5],
    input: (s, t, h) => holdInput(s, 55, h, "carve", t),
    lens: (s) => {
      const at = frameAt(s);
      return { eye: at(-5, 1.8, 0.7), target: at(2, 0, 0.4), fov: 46, roll: 0 };
    },
  },
  {
    id: "stop",
    title: "HOCKEY STOP · SKIS",
    skis: "chamois",
    where: "piste",
    depth: 1,
    kmh: 45,
    times: [0.65, 1.0],
    input: stopTo(1),
    lens: closeLens(1),
  },
  {
    id: "heel",
    title: "BOARD STOP · A",
    skis: "lynx",
    where: "piste",
    depth: 1,
    kmh: 40,
    times: [0.65, 1.0],
    input: stopTo(1),
    lens: closeLens(1),
  },
  {
    id: "toe",
    title: "BOARD STOP · B",
    skis: "lynx",
    where: "piste",
    depth: 1,
    kmh: 40,
    times: [0.65, 1.0],
    input: stopTo(-1),
    lens: closeLens(-1),
  },
  {
    id: "powder",
    title: "POWDER TURNS",
    skis: "chamois",
    where: "meadow",
    depth: 2,
    kmh: 40,
    times: [1.1, 2.3],
    input: (s, t, h) => holdInput(s, 40, h, "carve", t),
    lens: (s, from) => {
      const at = frameAt(s, from.heading);
      return { eye: at(5, 4.5, 1.4), target: at(0, 0, 0.7), fov: 50, roll: 0 };
    },
  },
  {
    id: "crater",
    title: "FALL CRATER",
    skis: "chamois",
    where: "meadow",
    depth: 2,
    kmh: 36,
    times: [0.3, 3.5],
    air: true,
    input: () => ({ steer: 0, tuck: 0, brake: 0, lean: 0, reset: false }),
    lens: (s, from) => {
      const off = s.skier.thrown;
      const x = off ? off.x : s.skier.x;
      const z = off ? off.z : s.skier.z;
      const at = frameAt(s, from.heading);
      const e = at(-1.2, 4.2, 2.6, x, z);
      return { eye: e, target: { x, y: level.groundAt(x, z) - 0.2, z }, fov: 52, roll: 0 };
    },
  },
  {
    id: "chase",
    title: "TRACKS · CHASE",
    skis: "chamois",
    where: "meadow",
    depth: 1.5,
    kmh: 45,
    times: [3, 5],
    input: (s, t, h) => holdInput(s, 45, h, "carve", t),
    lens: () => null,
  },
  {
    id: "track",
    title: "TRACKS · LOOK BACK",
    skis: "chamois",
    where: "meadow",
    depth: 1.5,
    kmh: 45,
    times: [3, 5],
    input: (s, t, h) => holdInput(s, 45, h, "carve", t),
    lens: (s) => {
      const at = frameAt(s);
      return { eye: at(3, 1.5, 2.2), target: at(-14, 0, 0), fov: 50, roll: 0 };
    },
  },
];

const scenes = SCENES.filter((s) => only.includes(s.id));
let piste = { x: 0, z: 0, heading: 0 };
let open = { x: 0, z: 0, heading: 0 };

function spotOf(where: Where) {
  return where === "piste" ? piste : open;
}

/** Ride `scene` from its start until `until` s (after impact, for the crater),
 * drawing every frame; `state` carries on from wherever it was. */
function rideTo(
  state: GameState,
  scene: Scene,
  from: { heading: number },
  until: number,
  clock: { t0: number; hit: number },
) {
  let guard = 0;
  for (;;) {
    const off = state.skier.thrown;
    if (scene.air && off && clock.hit < 0) clock.hit = state.t;
    const t = scene.air ? (clock.hit < 0 ? -1 : state.t - clock.hit) : state.t - clock.t0;
    if (t >= until) return;
    if (++guard > 60 * 30) return;
    for (let i = 0; i < 2; i++) step(state, scene.input(state, state.t - clock.t0, from.heading));
    renderer.draw(state, 0, FRAME, false);
  }
}

function startScene(scene: Scene): {
  state: GameState;
  from: { x: number; z: number; heading: number };
} {
  const from = spotOf(scene.where);
  const state = createGame({
    level,
    mode: "free",
    rivals: 0,
    quiet: true,
    spec: pairById(scene.skis),
    snowDepth: scene.depth,
  });
  if (scene.air) {
    placeRun(state, {
      x: from.x,
      z: from.z,
      heading: from.heading,
      speed: scene.kmh / 3.6,
      height: 3.5,
      vy: -2,
      pitch: -0.75,
    });
  } else {
    placeRun(state, { x: from.x, z: from.z, heading: from.heading, speed: scene.kmh / 3.6 });
  }
  return { state, from };
}

/** A deep dial lays tree wells and so builds a map of its own
 * (`tree-well.ts`): the renderer is loaded on whichever map the run is on. */
let loaded: GameState["level"] = level;
async function loadFor(state: GameState): Promise<void> {
  if (state.level === loaded) return;
  await renderer.load(state);
  loaded = state.level;
}

function hourFor(elevation: number): number {
  return hourAt(level, elevation);
}

window.__snowEval = {
  ready: (async () => {
    await renderer.load(first);
    const m = meadow(level);
    const n = { x: 0, y: 1, z: 0 };
    level.normalAt(m.x, m.z, n);
    const fall = Math.hypot(n.x, n.z) > 0.05 ? Math.atan2(n.x, n.z) : 0;
    open = { x: m.x, z: m.z, heading: fall };
    piste = pisteSpot(level, 1 / 3);
  })(),
  async sheet() {
    const lights: { name: string; sky: SkyOverride }[] = [
      { name: "DAY", sky: { weather: "clear", hour: hourFor(35 * DEG) } },
      { name: "LOW SUN", sky: { weather: "clear", hour: hourFor(10 * DEG) } },
    ];
    const labelW = 150;
    const headH = 34;
    const cols = lights.length * 2;
    sheet.width = labelW + cellW * cols;
    sheet.height = headH + cellH * scenes.length;
    const ctx = sheet.getContext("2d")!;
    ctx.fillStyle = "#0b1116";
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.fillStyle = "#e8eef4";
    ctx.font = "12px monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `SNOW EVAL · seed ${seed}${region ? ` ${region}` : ""} · ${gpu ? "GPU spray" : "CPU spray"} · ${tier}`,
      8,
      10,
    );
    for (let r = 0; r < scenes.length; r++) {
      const scene = scenes[r];
      const y0 = headH + r * cellH;
      for (let l = 0; l < lights.length; l++) {
        renderer.setSky(lights[l].sky);
        const { state, from } = startScene(scene);
        await loadFor(state);
        const clock = { t0: state.t, hit: -1 };
        renderer.setOverride(null);
        renderer.setCamera("chase", true);
        renderer.draw(state, 0, FRAME, false);
        await renderer.shadeSettled();
        for (let c = 0; c < 2; c++) {
          const t = scene.times[c];
          rideTo(state, scene, from, t, clock);
          renderer.setOverride(scene.lens(state, from));
          renderer.draw(state, 0, 0, true);
          const col = l * 2 + c;
          const x0 = labelW + col * cellW;
          ctx.drawImage(stage, x0, y0, cellW, cellH);
          renderer.setOverride(null);
          if (r === 0) {
            ctx.fillStyle = "#e8eef4";
            ctx.fillText(`${lights[l].name} · ${scene.air ? "+" : ""}${t} s`, x0 + 6, 26);
          }
          ctx.fillStyle = "rgba(11,17,22,0.72)";
          ctx.fillRect(x0, y0 + cellH - 20, cellW, 20);
          ctx.fillStyle = "#e8eef4";
          ctx.fillText(
            `${(state.skier.speed * 3.6).toFixed(0)} km/h · ${SPRAY_STATS.live} in the air${state.skier.thrown ? " · thrown" : ""}`,
            x0 + 6,
            y0 + cellH - 10,
          );
        }
        await new Promise((done) => setTimeout(done, 0));
      }
      ctx.fillStyle = "#e8eef4";
      ctx.fillText(scene.title, 8, y0 + cellH / 2);
    }
    renderer.setSky(null);
    return { rows: scenes.length, cols, w: sheet.width, h: sheet.height };
  },
  async perf() {
    const rows: PerfRow[] = [];
    const probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    const pctx = probe.getContext("2d")!;
    renderer.setSky({ weather: "clear", hour: hourFor(35 * DEG) });
    for (const t of ["low", "medium", "high"] as Tier[]) {
      renderer.setVideo(withPreset(DEFAULT_VIDEO, t));
      for (const id of ["stop", "powder"]) {
        const scene = SCENES.find((s) => s.id === id)!;
        const { state, from } = startScene(scene);
        await loadFor(state);
        const t0 = state.t;
        renderer.setOverride(null);
        renderer.setCamera("chase", true);
        renderer.draw(state, 0, FRAME, true);
        await renderer.shadeSettled();
        const frames: number[] = [];
        let spray = 0;
        let bytes = 0;
        let live = 0;
        let n = 0;
        while (state.t - t0 < 1.4) {
          for (let i = 0; i < 2; i++) step(state, scene.input(state, state.t - t0, from.heading));
          renderer.setOverride(scene.lens(state, from));
          const a = performance.now();
          renderer.draw(state, 0, FRAME, true);
          // Read a pixel back so the frame's GPU work is in the time.
          pctx.drawImage(stage, 0, 0, 1, 1);
          pctx.getImageData(0, 0, 1, 1);
          frames.push(performance.now() - a);
          spray += SPRAY_STATS.updateMs;
          bytes += SPRAY_STATS.bytes;
          live = Math.max(live, SPRAY_STATS.live);
          n++;
        }
        frames.sort((p, q) => p - q);
        rows.push({
          tier: t,
          scene: id,
          frameMs: frames[Math.floor(frames.length / 2)],
          sprayMs: spray / n,
          live,
          bytes: Math.round(bytes / n),
        });
      }
    }
    renderer.setVideo(withPreset(DEFAULT_VIDEO, tier));
    renderer.setSky(null);
    renderer.setOverride(null);
    return rows;
  },
};
