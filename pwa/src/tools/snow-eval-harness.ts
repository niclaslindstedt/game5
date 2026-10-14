// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW EVAL LAB's page (driven by `scripts/snow-eval.mjs`): the snow a
// skier and a snowboarder throw and leave, through the game's own renderer,
// on FIXED SCENES every candidate of a snow-effects contest is judged on —
// the same map, spots, rides, lenses and moments, by day and under a low
// sun — and what each costs at the LOW, MEDIUM and HIGH picture presets.
//
//   carve        linked carves on the groomer from 50 km/h, chase and close
//   hockey       a hockey stop on skis on the groomer from 45 km/h
//   board-heel   a snowboard's heelside stop from 40 km/h
//   board-toe    ...and its toeside stop
//   powder       a skidded turn in deep powder from 40 km/h
//   crater       a fall in deep powder: the hole, from over it and the chase
//   track        five seconds of carves, the line they cut looked back on
//
// Under LIGHTS (`?lights=`): `day` (a clear sky, the sun 32° up), `low` (the
// sun 7° up), `overcast` (the day's hour under a lid) and `night` (hour
// 21, the headlamp's). The FILM SCORE (`snow-eval-film.ts`, `?film=`) rides
// the scenes a real one was measured for and scores the drawn snow against
// it, moment by moment (`spray-film.ts`).
//
// Every ride is deterministic (the engine's own stream, the held inputs),
// so a candidate's picture differs from another's only by how it draws the
// snow. The cells carry their names, so the script cuts each one out too.

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
import { holdInput } from "../game/hold-input.ts";
import { createWorldRenderer } from "../game/renderer.ts";
import { flySprayAs } from "../game/spray.ts";
import { SPRAY_MODELS, type SprayModel } from "../game/spray-sim.ts";
import { DEFAULT_VIDEO, withPreset, type Tier } from "../game/settings-video.ts";
import { hourAt, meadow, pisteSpot } from "./stage.ts";
import { FILM_SCENES, filmMeans, filmSheet, type FilmCell } from "./snow-eval-film.ts";

declare global {
  interface Window {
    __snowEval?: {
      ready: Promise<void>;
      sheet(): Promise<SheetOut>;
      perf(): Promise<PerfRow[]>;
      film(): Promise<FilmOut>;
    };
  }
}

type Cell = { name: string; x: number; y: number; w: number; h: number; note: string };
type SheetOut = { w: number; h: number; cells: Cell[] };
type FilmOut = {
  w: number;
  h: number;
  cells: FilmCell[];
  means: ReturnType<typeof filmMeans>;
};
type PerfRow = {
  tier: Tier;
  /** The whole frame, ms (swiftshader: a CPU's raster, far slower than a
   * GPU's — read the rows against each other, not as a frame rate). */
  frameMs: number;
  /** The same frames with the spray and the cloud hidden, ms: the
   * difference is what they cost. */
  withoutMs: number;
  sprayInstances: number;
  cloudInstances: number;
  drawCalls: number;
};

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const cellW = Number(params.get("w") ?? 480);
const cellH = Number(params.get("h") ?? 320);
const only = (params.get("scenes") ?? "").split(",").filter(Boolean);
const DEG = Math.PI / 180;
const FRAME = 1 / 60;
const SUN = { day: 32 * DEG, low: 7 * DEG };
const list = (name: string, fallback: string) =>
  (params.get(name) || fallback).split(",").filter(Boolean);
/** The lights the sheet is shot under, the day first. */
const LIGHTS: Record<string, { caption: string; sky: () => SkyOverride }> = {
  day: {
    caption: "DAY (sun 32°)",
    sky: () => ({ weather: "clear", hour: hourAt(level, SUN.day) }),
  },
  low: { caption: "LOW SUN (7°)", sky: () => ({ weather: "clear", hour: hourAt(level, SUN.low) }) },
  overcast: {
    caption: "OVERCAST",
    sky: () => ({ weather: "overcast", hour: hourAt(level, SUN.day) }),
  },
  night: { caption: "NIGHT (21 h)", sky: () => ({ weather: "clear", hour: 21 }) },
};
const lights = ["day", ...list("lights", "day,low").filter((l) => l !== "day" && l in LIGHTS)];
const filmLights = list("film", "day,low").filter((l) => l in LIGHTS);

const stage = document.getElementById("stage") as HTMLCanvasElement;
const sheet = document.getElementById("sheet") as HTMLCanvasElement;
// `?model=` flies the spray as another model (the game's before): every
// spray made from now on.
const model = params.get("model");
if (model && (SPRAY_MODELS as readonly string[]).includes(model)) flySprayAs(model as SprayModel);
const renderer = createWorldRenderer(stage, {
  video: withPreset(DEFAULT_VIDEO, "high"),
  preserveDrawingBuffer: true,
});
renderer.resize(cellW, cellH, 1);
const base = createGame({ seed, mode: "free", rivals: 0, quiet: true, crowd: 0, enthusiasts: 0 });
const level = base.level;

/** A hockey stop to one side: the brake, then the edge laid over to `side`
 * (+1 right, -1 left) — `hold-input.ts`'s stop, either way. */
function stopTo(side: number) {
  return (state: GameState, kmh: number, heading: number, t: number): SkierInput => {
    const i = holdInput(state, kmh, heading, "stop", t);
    return { ...i, steer: t >= 0.35 ? side : i.steer };
  };
}

/** A skidded turn in powder: laid over and the brake half on. */
function powderTurn(state: GameState, kmh: number, heading: number, t: number): SkierInput {
  const i = holdInput(state, kmh, heading, "straight", t);
  return { ...i, tuck: 0, steer: t >= 0.25 ? 1 : i.steer, brake: t >= 0.45 ? 0.45 : 0 };
}

/** Laid down in the snow: edged hard over, skidding, the weight back —
 * the fall a player leaning on deep powder rides into (`powder-lab.ts`). */
const LAID_DOWN: SkierInput = { ...NEUTRAL_INPUT, steer: 1, brake: 1, lean: 1 };

type Ride = (state: GameState, kmh: number, heading: number, t: number) => SkierInput;

type Shot = { lens: string; t: number };
type Scene = {
  id: string;
  title: string;
  skis: string;
  where: "piste" | "meadow";
  /** Where on its stage: how far down the piste, or metres across the
   * meadow — every scene on snow of its own, since the trail maps keep
   * every track a ride cut. */
  at: number;
  depth: number;
  kmh: number;
  ride: Ride;
  /** Two shots by day; the first again under the low sun. */
  shots: [Shot, Shot];
  /** Counted from the moment he was thrown, not from the start. */
  afterFall?: boolean;
};

const ALL_SCENES: Scene[] = [
  {
    id: "carve",
    at: 0.3,
    title: "CARVE · GROOMER",
    skis: "chamois",
    where: "piste",
    depth: 1,
    kmh: 50,
    ride: (s, k, h, t) => holdInput(s, k, h, "carve", t),
    shots: [
      { lens: "chase", t: 1.7 },
      { lens: "close", t: 1.7 },
    ],
  },
  {
    id: "hockey",
    at: 0.36,
    title: "HOCKEY STOP · SKIS",
    skis: "chamois",
    where: "piste",
    depth: 1,
    kmh: 45,
    ride: stopTo(1),
    shots: [
      { lens: "front", t: 0.6 },
      { lens: "chase", t: 0.9 },
    ],
  },
  {
    id: "board-heel",
    at: 0.42,
    title: "HEELSIDE STOP · BOARD",
    skis: "lynx",
    where: "piste",
    depth: 1,
    kmh: 40,
    ride: stopTo(-1),
    shots: [
      { lens: "front", t: 0.65 },
      { lens: "side", t: 0.65 },
    ],
  },
  {
    id: "board-toe",
    at: 0.48,
    title: "TOESIDE STOP · BOARD",
    skis: "lynx",
    where: "piste",
    depth: 1,
    kmh: 40,
    ride: stopTo(1),
    shots: [
      { lens: "front", t: 0.65 },
      { lens: "side", t: 0.65 },
    ],
  },
  {
    id: "powder",
    at: 0,
    title: "POWDER TURN",
    skis: "chamois",
    where: "meadow",
    depth: 2,
    kmh: 40,
    ride: powderTurn,
    shots: [
      { lens: "chase", t: 1.1 },
      { lens: "side", t: 1.1 },
    ],
  },
  {
    id: "crater",
    at: 30,
    title: "FALL CRATER · POWDER",
    skis: "chamois",
    where: "meadow",
    depth: 2.5,
    kmh: 30,
    ride: () => LAID_DOWN,
    afterFall: true,
    shots: [
      { lens: "over", t: 3 },
      { lens: "chase", t: 0.4 },
    ],
  },
  {
    id: "track",
    at: 0.56,
    title: "TRACK LINE",
    skis: "chamois",
    where: "piste",
    depth: 1,
    kmh: 50,
    ride: (s, k, h, t) => holdInput(s, k, h, "carve", t),
    shots: [
      { lens: "chase", t: 5 },
      { lens: "back", t: 5 },
    ],
  },
];
const SCENES = ALL_SCENES.filter((s) => only.length === 0 || only.includes(s.id));

/** Where the lens stands for `name`, in the skier's heading frame (x to
 * his right, ahead, up off the snow); null is the game's own chase. */
function lensOf(
  name: string,
  state: GameState,
  hole: { x: number; z: number } | null,
): LensPose | null {
  const s = state.skier;
  const off = s.thrown;
  const px = off ? off.x : s.x;
  const pz = off ? off.z : s.z;
  const heading = off ? off.heading : s.heading;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const at = (f: number, r: number, up: number) => {
    const x = px + fx * f + fz * r;
    const z = pz + fz * f - fx * r;
    return { x, y: level.groundAt(x, z) + up, z };
  };
  switch (name) {
    case "side":
      return { eye: at(0, 6.5, 1.0), target: at(0, 0, 0.7), fov: 40, roll: 0 };
    case "front":
      return { eye: at(7, 2.2, 1.3), target: at(0, 0, 0.7), fov: 40, roll: 0 };
    case "close":
      return { eye: at(3.4, 3.0, 0.8), target: at(-0.3, 0, 0.5), fov: 46, roll: 0 };
    case "back":
      // Ahead of him and up, looking back up the line he cut.
      return { eye: at(3, 1.4, 2.6), target: at(-14, 0, 0), fov: 48, roll: 0 };
    case "over": {
      const c = hole ?? { x: px, z: pz };
      const g = level.groundAt(c.x, c.z);
      return {
        eye: { x: c.x + fz * 2.2 - fx * 2.2, y: g + 4.2, z: c.z - fx * 2.2 - fz * 2.2 },
        target: { x: c.x, y: g - 0.2, z: c.z },
        fov: 50,
        roll: 0,
      };
    }
    default:
      return null;
  }
}

/** Ride a scene to `t` s (from the throw when it is a fall), drawing every
 * frame unseen so the tracks and the spray are the ride's own. */
async function rideTo(
  scene: Scene,
  until: number[],
  onAt: (k: number, state: GameState) => void,
): Promise<GameState> {
  const state = createGame({
    level,
    mode: "free",
    rivals: 0,
    quiet: true,
    crowd: 0,
    enthusiasts: 0,
    spec: pairById(scene.skis),
    snowDepth: scene.depth,
  });
  await loaded(state);
  const spot = spotOf(scene);
  placeRun(state, { x: spot.x, z: spot.z, heading: spot.heading, speed: scene.kmh / 3.6 });
  renderer.setOverride(null);
  renderer.setCamera("chase", true);
  renderer.draw(state, 0, FRAME, false);
  const t0 = state.t;
  let thrownAt = -1;
  let k = 0;
  const limit = t0 + 20;
  while (k < until.length && state.t < limit) {
    for (let i = 0; i < 2; i++) {
      if (scene.afterFall && state.skier.thrown && thrownAt < 0) thrownAt = state.t;
      const input =
        scene.afterFall && state.skier.thrown
          ? NEUTRAL_INPUT
          : scene.ride(state, scene.kmh, spot.heading, state.t - t0);
      step(state, input);
    }
    renderer.draw(state, 0, FRAME, false);
    const clock = scene.afterFall ? (thrownAt < 0 ? -1 : state.t - thrownAt) : state.t - t0;
    while (k < until.length && clock >= until[k]) onAt(k++, state);
  }
  while (k < until.length) onAt(k++, state);
  return state;
}

/** The map the renderer is drawing: a deep snow dial is a map of its own
 * (its tree wells dug — `withWells`), which the renderer draws only once
 * it has been handed it. */
let shown: GameState["level"] | null = null;
async function loaded(state: GameState): Promise<void> {
  if (state.level === shown) return;
  await renderer.load(state);
  shown = state.level;
}

const spots = new Map<string, { x: number; z: number; heading: number }>();
function spotOf(scene: Scene) {
  let s = spots.get(scene.id);
  if (!s) {
    if (scene.where === "meadow") {
      const m = meadow(level);
      const n = { x: 0, y: 1, z: 0 };
      level.normalAt(m.x, m.z, n);
      const fall = Math.hypot(n.x, n.z) > 0.05 ? Math.atan2(n.x, n.z) : 0;
      // Across the fall line by `at` metres.
      s = { x: m.x + Math.cos(fall) * scene.at, z: m.z - Math.sin(fall) * scene.at, heading: fall };
    } else {
      s = pisteSpot(level, scene.at);
    }
    spots.set(scene.id, s);
  }
  return s;
}

function photo(lens: LensPose | null): void {
  renderer.setOverride(lens);
  renderer.draw(lastState!, 0, 0, true);
  renderer.setOverride(null);
}
let lastState: GameState | null = null;

window.__snowEval = {
  ready: (async () => {
    await renderer.load(base);
    shown = base.level;
  })(),
  async sheet() {
    const labelW = 170;
    const headH = 34;
    const cols = 1 + lights.length;
    sheet.width = labelW + cellW * cols;
    sheet.height = headH + cellH * SCENES.length;
    const ctx = sheet.getContext("2d")!;
    ctx.fillStyle = "#0b1116";
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.fillStyle = "#e8eef4";
    ctx.font = "12px monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(`SNOW EVAL · seed ${seed} · HIGH preset`, 8, 10);
    [
      `${LIGHTS.day.caption} · lens A`,
      "DAY · lens B",
      ...lights.slice(1).map((l) => `${LIGHTS[l].caption} · lens A`),
    ].forEach((t, c) => ctx.fillText(t, labelW + c * cellW + 6, 26));
    const cells: Cell[] = [];
    for (let r = 0; r < SCENES.length; r++) {
      const scene = SCENES[r];
      const y0 = headH + r * cellH;
      for (const light of lights) {
        renderer.setSky(LIGHTS[light].sky());
        const shots = light === "day" ? scene.shots : [scene.shots[0]];
        const order = shots.map((s, i) => ({ ...s, i })).sort((a, b) => a.t - b.t);
        let hole: { x: number; z: number } | null = null;
        await rideTo(
          scene,
          order.map((s) => s.t),
          (k, state) => {
            lastState = state;
            if (state.skier.thrown && !hole)
              hole = { x: state.skier.thrown.x, z: state.skier.thrown.z };
            if (state.skier.thrown) hole = { x: state.skier.thrown.x, z: state.skier.thrown.z };
            const shot = order[k];
            const col = light === "day" ? shot.i : 1 + lights.indexOf(light);
            photo(lensOf(shot.lens, state, hole));
            const x0 = labelW + col * cellW;
            ctx.drawImage(stage, x0, y0, cellW, cellH);
            const s = state.skier;
            const note = `${shot.lens} · ${shot.t}s${scene.afterFall ? " after the fall" : ""} · ${(s.speed * 3.6).toFixed(0)} km/h`;
            ctx.fillStyle = "rgba(11,17,22,0.7)";
            ctx.fillRect(x0, y0 + cellH - 20, cellW, 20);
            ctx.fillStyle = "#e8eef4";
            ctx.fillText(note, x0 + 6, y0 + cellH - 10);
            cells.push({
              name: `${scene.id}-${light}-${shot.lens}`,
              x: x0,
              y: y0,
              w: cellW,
              h: cellH,
              note,
            });
          },
        );
        await new Promise((done) => setTimeout(done, 0));
      }
      ctx.fillStyle = "#e8eef4";
      ctx.fillText(scene.title, 8, y0 + cellH / 2 - 8);
      ctx.fillText(`${scene.skis} · ${scene.kmh} km/h`, 8, y0 + cellH / 2 + 8);
    }
    renderer.setSky(null);
    return { w: sheet.width, h: sheet.height, cells };
  },
  async perf() {
    // THE COST: the hockey stop ridden at each preset, drawn unseen to the
    // thick of the spray, then a few frames timed twice over — with the
    // spray and the cloud and without them — so the difference is theirs.
    // The quads off the scene's own tally at the same moment.
    const rows: PerfRow[] = [];
    const scene = ALL_SCENES.find((s) => s.id === "hockey")!;
    renderer.setSky({ weather: "clear", hour: hourAt(level, SUN.day) });
    for (const tier of ["low", "medium", "high"] as Tier[]) {
      renderer.setVideo(withPreset(DEFAULT_VIDEO, tier));
      const state = createGame({
        level,
        mode: "free",
        rivals: 0,
        quiet: true,
        crowd: 0,
        enthusiasts: 0,
        spec: pairById(scene.skis),
      });
      await loaded(state);
      const spot = spotOf(scene);
      placeRun(state, { x: spot.x, z: spot.z, heading: spot.heading, speed: scene.kmh / 3.6 });
      renderer.setOverride(null);
      renderer.setCamera("chase", true);
      const t0 = state.t;
      const frame = (present: boolean) => {
        for (let i = 0; i < 2; i++)
          step(state, scene.ride(state, scene.kmh, spot.heading, state.t - t0));
        renderer.draw(state, 0, FRAME, present);
      };
      while (state.t - t0 < 0.55) frame(false);
      let spray = 0;
      let cloud = 0;
      for (const row of renderer.sceneTally()) {
        if (row.name === "spray") spray = row.triangles / 2;
        if (row.name === "snow-cloud") cloud = row.triangles / 2;
      }
      // Warm both ways first: a draw's first frame compiles its shaders.
      for (const hide of [["spray", "cloud"], []] as const) {
        renderer.setHidden([...hide]);
        for (let w = 0; w < 2; w++) renderer.draw(state, 0, 0, true);
      }
      const timed = { on: 0, off: 0, n: 0 };
      let calls = 0;
      for (let f = 0; f < 6; f++) {
        frame(false);
        // The same frame drawn both ways, the order swapped each time.
        for (const on of f % 2 ? [false, true] : [true, false]) {
          renderer.setHidden(on ? [] : ["spray", "cloud"]);
          const a = performance.now();
          renderer.draw(state, 0, 0, true);
          (stage.getContext("webgl2") as WebGL2RenderingContext | null)?.finish();
          const ms = performance.now() - a;
          if (on) timed.on += ms;
          else timed.off += ms;
          if (on) calls = Math.max(calls, renderer.cost().calls);
        }
        timed.n++;
      }
      renderer.setHidden([]);
      rows.push({
        tier,
        frameMs: timed.on / timed.n,
        withoutMs: timed.off / timed.n,
        sprayInstances: spray,
        cloudInstances: cloud,
        drawCalls: calls,
      });
    }
    renderer.setVideo(withPreset(DEFAULT_VIDEO, "high"));
    renderer.setSky(null);
    return rows;
  },
  async film() {
    const scenes = FILM_SCENES.filter((f) => only.length === 0 || only.includes(f.id));
    const labelW = 190;
    const headH = 34;
    const cols = 6;
    sheet.width = labelW + cellW * cols;
    sheet.height = headH + cellH * scenes.length * filmLights.length;
    const ctx = sheet.getContext("2d")!;
    ctx.fillStyle = "#0b1116";
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.fillStyle = "#e8eef4";
    ctx.font = "12px monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `SNOW EVAL · FILM SCORE · seed ${seed} · HIGH · film dashed amber, game cyan, side-on to the throw`,
      8,
      10,
    );
    const cells = await filmSheet(
      ctx,
      {
        renderer,
        stage,
        groundAt: level.groundAt,
        fallAt(x, z) {
          const n = { x: 0, y: 1, z: 0 };
          level.normalAt(x, z, n);
          const l = Math.hypot(n.x, n.z) || 1;
          return { x: n.x / l, z: n.z / l };
        },
        cellW,
        cellH,
        light(name) {
          renderer.setSky(LIGHTS[name].sky());
          return LIGHTS[name].caption;
        },
        async begin(film, kmh) {
          const scene = ALL_SCENES.find((s) => s.id === film.id)!;
          const state = createGame({
            level,
            mode: "free",
            rivals: 0,
            quiet: true,
            crowd: 0,
            enthusiasts: 0,
            spec: pairById(scene.skis),
            snowDepth: scene.depth,
          });
          await loaded(state);
          const spot = spotOf(scene);
          placeRun(state, { x: spot.x, z: spot.z, heading: spot.heading, speed: kmh / 3.6 });
          renderer.setOverride(null);
          renderer.setCamera("chase", true);
          renderer.draw(state, 0, FRAME, false);
          return { state, input: (st, t) => scene.ride(st, kmh, spot.heading, t) };
        },
      },
      scenes,
      filmLights,
      labelW,
      headH,
    );
    renderer.setSky(null);
    return { w: sheet.width, h: sheet.height, cells, means: filmMeans(cells) };
  },
};
