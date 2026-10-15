// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CONTRAILS LAB's page (driven by `scripts/contrails-preview.mjs`): one
// seed stood up and its sky drawn through the game's own renderer from a
// skier's eye on the snow, with the trails forced into the states the
// research names, as a labelled contact sheet. Sheets:
//
//   life    ONE trail through its life overhead: being laid (the plane, its
//           glint and the dark gap), a short one in dry air, and a
//           persistent one at 1, 5, 15 and 40 minutes old — looking up and
//           toward the horizon.
//   sky     THE PLAN's own sky at a moment (`contrail-plan.ts`): a clear, a
//           fair and a humid HIGH day an hour into the run, and a cold and a
//           warm air mass at the same moment — up and toward the horizon
//           both ways.
//   dusk    a persistent and a fresh trail through the evening: the
//           afternoon, the low sun, sunset, the trails still lit after it,
//           the blue hour and the night.
//
// Each cell is captioned with what the plan says of it: the trails drawn,
// the air at 10 km and the share of the hour's flights that trail.

import {
  createGame,
  step,
  botInput,
  withSky,
  type GameState,
  type SkyOverride,
  type Level,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import {
  CONTRAIL,
  airAloft,
  contrailsAt,
  flightsBetween,
  forceAirMass,
  trailAt,
  trailFrameOf,
  type Flight,
  type Trail,
  type TrailFrame,
} from "../game/contrail-plan.ts";
import { forceContrailTime, forceTrails } from "../game/contrails.ts";
import { createWorldRenderer } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { volumeNoise } from "../game/cloud-volume.ts";
import { sunAtRun, nearestTrackPoint, trackPointAt } from "@engine";

declare global {
  interface Window {
    __contrails?: {
      ready: Promise<void>;
      sheet(): Promise<{ rows: number; cols: number; note: string; lines: string[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const cellW = Number(params.get("w") ?? 480);
const cellH = Number(params.get("h") ?? 300);
const kind = params.get("sheet") ?? "life";
const hourAsked = Number(params.get("hour") ?? 11);

const stage = document.getElementById("stage") as HTMLCanvasElement;
const sheet = document.getElementById("sheet") as HTMLCanvasElement;
const renderer = createWorldRenderer(stage, {
  video: withPreset(DEFAULT_VIDEO, tier),
  preserveDrawingBuffer: true,
});
renderer.resize(cellW, cellH, 1);
const state: GameState = createGame({ seed, quiet: true });
const level: Level = state.level;
const FRAME = 1 / 60;

/** The plan's frame on this map, with the wind aloft stilled (a forced
 * trail is placed where the lens can see it whatever its age). */
function stillFrame(): TrailFrame {
  return { ...trailFrameOf(level), wind: () => [0, 0] };
}

/** Where the lens stands: on the piste nearest the map's middle (open sky
 * over it, no trunk in the frame), 2 m up. */
let stood: { x: number; y: number; z: number; down: number } | null = null;
function eye(): { x: number; y: number; z: number; down: number } {
  if (stood) return stood;
  const f = trailFrameOf(level);
  const p = trackPointAt(level, nearestTrackPoint(level, f.cx, f.cz).s);
  stood = { x: p.x, y: level.groundAt(p.x, p.z) + 2, z: p.z, down: p.heading };
  return stood;
}

/** Looking along world heading `heading` at `elev` rad over the level. */
function lens(heading: number, elev: number, fov = 68): LensPose {
  const e = eye();
  const r = 1000;
  return {
    eye: e,
    target: {
      x: e.x + Math.sin(heading) * Math.cos(elev) * r,
      y: e.y + Math.sin(elev) * r,
      z: e.z + Math.cos(heading) * Math.cos(elev) * r,
    },
    fov,
    roll: 0,
  };
}

/** A flight made to order: crossing the lens's sky along +x (heading
 * east), passing `miss` m to its right (north is −miss: a negative miss
 * puts it toward +z, where the lens looks), `since` s after its nearest
 * pass, persistent or short. */
function flight(over: Partial<Flight> & { since: number; t: number }): Flight {
  const { since, t, ...rest } = over;
  return {
    id: 1,
    tc: t - since,
    heading: Math.PI / 2,
    speed: 240,
    altitude: 10600,
    miss: -14000,
    temp: -56,
    rhi: 1.15,
    forms: true,
    persists: true,
    life: CONTRAIL.persist,
    spread: 1.8,
    width: 30,
    tau: 0.45,
    phase: 0.37,
    ...rest,
  };
}

const RUN_T = 3600;

/** One cell's set-up: its sky, the moment, and the trails (null: the
 * plan's own). */
type Cell = {
  label: string;
  sky: SkyOverride;
  pose: LensPose;
  t?: number;
  trails: ((t: number) => Trail[]) | null;
  mass?: number;
};

const forced =
  (...fs: ((t: number) => Flight)[]) =>
  (t: number): Trail[] =>
    fs.map((f) => trailAt(f(t), stillFrame(), t)).filter((r): r is Trail => r !== null);

const UP = Math.PI * 0.2;
const LOW = 0.17;

function lifeCells(): Cell[][] {
  const sky: SkyOverride = { weather: "clear", hour: hourAsked };
  const at = (since: number, rest: Partial<Flight> = {}) =>
    forced((t) => flight({ t, since, ...rest }));
  const states: [string, (t: number) => Trail[]][] = [
    ["NONE", () => []],
    ["LAID NOW", at(-6)],
    ["SHORT · DRY", at(-2, { persists: false, life: 22, rhi: 0.7, spread: CONTRAIL.dryspread })],
    ["1 MIN", at(60)],
    ["5 MIN", at(300)],
    ["15 MIN", at(900)],
    ["40 MIN", at(2400)],
  ];
  return [
    states.map(([label, trails]) => ({ label: `${label} · up`, sky, pose: lens(0, UP), trails })),
    states.map(([label, trails]) => ({
      label: `${label} · low`,
      sky,
      pose: lens(0, 0.36),
      trails,
    })),
  ];
}

function skyCells(): Cell[][] {
  const rows: [string, SkyOverride, number | undefined][] = [
    ["CLEAR", { weather: "clear", hour: hourAsked }, undefined],
    ["FAIR", { weather: "fair", hour: hourAsked }, undefined],
    ["HIGH · humid", { weather: "high", hour: hourAsked }, undefined],
    ["COLD AIR −10°C", { weather: "fair", hour: hourAsked }, -10],
    ["WARM AIR +24°C", { weather: "fair", hour: hourAsked }, 24],
  ];
  const down = eye().down;
  const poses: [string, LensPose][] = [
    ["up", lens(down, 0.9)],
    ["up across", lens(down + Math.PI / 2, 1.1)],
    ["low down", lens(down, LOW)],
    ["low left", lens(down - 0.7, LOW)],
  ];
  return rows.map(([label, sky, mass]) =>
    poses.map(([pl, pose]) => ({
      label: `${label} · ${pl}`,
      sky,
      pose,
      t: RUN_T,
      trails: null,
      mass,
    })),
  );
}

/** Plain frames as the game looks at a typical moment: a fair and a humid
 * high sky an hour in, the lens a skier's looking down the piste and up a
 * little, no caption. */
function frameCells(): Cell[][] {
  const pose = lens(eye().down, 0.32);
  const day = (["fair", "high"] as const).map((weather) => ({
    label: weather,
    sky: { weather, hour: hourAsked } as SkyOverride,
    pose,
    t: RUN_T,
    trails: null,
  }));
  // The same humid sky three hours after dark: nothing, or by a bright
  // moon a faint line.
  const night = {
    label: "night",
    sky: { weather: "high", hour: 21 } as SkyOverride,
    pose,
    t: RUN_T,
    trails: null,
  };
  return [[...day, night]];
}

/** The hour of sunset on the map's day, scanned a minute at a time. */
function sunsetHour(): number {
  let was = sunAtRun(withSky(level, { hour: 12 })).elevation;
  for (let h = 12; h < 24; h += 1 / 60) {
    const e = sunAtRun(withSky(level, { hour: h })).elevation;
    if (was > 0 && e <= 0) return h;
    was = e;
  }
  return 17;
}

function duskCells(): Cell[][] {
  const set = sunsetHour();
  const toward = sunAtRun(withSky(level, { hour: set })).azimuth;
  const none = params.get("none") === "1";
  const trails = none
    ? () => []
    : forced(
        (t) => flight({ t, since: 900, miss: -14000 }),
        (t) => flight({ t, since: -4, id: 2, miss: -6000, heading: Math.PI / 2 + 0.5, phase: 0.8 }),
        (t) => flight({ t, since: 2400, id: 3, miss: 4000, heading: 0.2, phase: 0.1 }),
      );
  const hours: [string, number][] = [
    ["afternoon", set - 2.5],
    ["low sun", set - 0.6],
    ["sunset", set],
    ["+10 min", set + 0.17],
    ["+45 min", set + 0.75],
    ["night", set + 3],
  ];
  const row = (name: string, pose: LensPose): Cell[] =>
    hours.map(([label, h]) => ({
      label: `${label} · ${name}`,
      sky: { weather: "clear", hour: h },
      pose,
      trails,
    }));
  return [row("toward sun", lens(toward, 0.2)), row("up", lens(toward, 0.85))];
}

/** The share of the hour's flights over the map that trail, at the air
 * mass forced. */
function trailing(l: Level, t: number): string {
  const fs = flightsBetween(l, t - 1800, t + 1800);
  const forms = fs.filter((f) => f.forms).length;
  const lasts = fs.filter((f) => f.persists).length;
  return `${forms}/${fs.length} trail, ${lasts} last`;
}

async function drawCell(
  ctx: CanvasRenderingContext2D,
  c: Cell,
  x: number,
  y: number,
): Promise<string> {
  forceAirMass(c.mass ?? null);
  const t = c.t ?? RUN_T;
  forceContrailTime(t);
  forceTrails(c.trails ? c.trails(t) : null);
  renderer.setSky(c.sky);
  renderer.setOverride(c.pose);
  renderer.draw(state, 0, FRAME, false);
  await renderer.shadeSettled();
  for (let i = 0; i < 6; i++) renderer.draw(state, 0, FRAME, false);
  renderer.draw(state, 0, FRAME, true);
  ctx.drawImage(stage, x, y, cellW, cellH);
  if (kind === "frames") return c.label;
  const l = withSky(level, c.sky);
  const T10 = airAloft(l, t, 10500);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x, y + cellH - 18, cellW, 18);
  ctx.fillStyle = "#e8eef4";
  const what = c.trails
    ? "forced"
    : `${trailing(l, t)}, ${contrailsAt(l, trailFrameOf(l), t).length} drawn`;
  const caption = `${c.label} · ${T10.toFixed(0)}°C at 10.5 km · ${what}`;
  ctx.fillText(caption, x + 6, y + cellH - 9);
  await new Promise((done) => setTimeout(done, 0));
  return caption;
}

async function drawSheet(): Promise<{ rows: number; cols: number; note: string; lines: string[] }> {
  const grid =
    kind === "sky"
      ? skyCells()
      : kind === "dusk"
        ? duskCells()
        : kind === "frames"
          ? frameCells()
          : lifeCells();
  const cols = Math.max(...grid.map((r) => r.length));
  const head = 22;
  sheet.width = cols * cellW;
  sheet.height = head + grid.length * cellH;
  const ctx = sheet.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#0b1116";
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.font = "12px monospace";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e8eef4";
  const sun = level.sun;
  ctx.fillText(
    `CONTRAILS · ${kind} · seed ${seed} · day ${sun.dayOfYear} at ${sun.latitude.toFixed(1)}° · ${tier}`,
    8,
    11,
  );
  const lines: string[] = [];
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[r].length; c++)
      lines.push(await drawCell(ctx, grid[r][c], c * cellW, head + r * cellH));
  forceTrails(null);
  forceContrailTime(null);
  forceAirMass(null);
  return { rows: grid.length, cols, note: kind, lines };
}

async function boot(): Promise<void> {
  await renderer.load(state);
  await volumeNoise();
  for (let i = 0; i < 60; i++) step(state, botInput(state));
  renderer.setCamera("chase", true);
}

window.__contrails = { ready: boot(), sheet: drawSheet };
