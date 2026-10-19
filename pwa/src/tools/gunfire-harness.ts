// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GUNFIRE LAB's page (`scripts/gunfire-preview.mjs`): a stand-in
// shooter firing at a skier on the piste (`engine/game/gunfire.ts`, drawn
// by `gunfire-view.ts`), the real engine stepped and the game's OWN
// renderer drawing it, the INJURIES switch on (`gore`):
//
//   * RIFLE — a rifleman on the snow down the piste, a burst at him: the
//     muzzle's flash over the shooter's shoulder, then the rounds' strikes;
//   * DOOR GUN — a door gunner's stand-in in the air 130 m off his side,
//     a machine gun firing burst after burst: its tracers from behind him
//     and over the gun, the rounds coming in, their strikes;
//   * ROCKET — a launcher on a rise down his way: the rocket in flight on
//     its smoke over the shooter's shoulder, the burst, the smoke after;
//   * DUSK — the same three under the evening's sky, where the flashes and
//     the tracers light;
//   * SFW — SAFE FOR WORK: the army's warning fire, put into the snow round
//     him and never at him.
//
// The shooter is a point the gun is armed at — no soldier is drawn; the
// lab judges the fire. Every frame is captioned with the time since the
// first shot, the rounds fired and the hits. It exposes
// `window.__gunfire.sheet(group, views)`, which shoots one group's views,
// lays them out as a contact sheet and hands back every frame.

import {
  armGun,
  createGame,
  fireAt,
  generateLevel,
  NEUTRAL_INPUT,
  placeRun,
  step,
  trackPointAt,
  TUNING,
  withSky,
  type GameState,
  type Gun,
  type RegionId,
  type WeaponKind,
  type WeatherKind,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";

type Frame = { view: string; label: string; caption: string; png: string };

const GROUPS = {
  day: ["rifle", "doorgun", "rocket"],
  dusk: ["dusk-rifle", "dusk-doorgun", "dusk-rocket"],
  sfw: ["sfw-rifle", "sfw-doorgun"],
} as const;

declare global {
  interface Window {
    __gunfire?: {
      ready: Promise<string>;
      groups: Record<string, readonly string[]>;
      sheet(group: string, views: string[]): Promise<{ frames: Frame[] }>;
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
const cols = Number(params.get("cols") ?? 2);
const scale = Number(params.get("scale") ?? 0.5);
const hour = params.get("hour") !== null ? Number(params.get("hour")) : 13;
const duskHour = Number(params.get("dusk") ?? 17);
const weather = (params.get("weather") || "clear") as WeatherKind;
const speed = Number(params.get("speed") ?? 12);
const at = Number(params.get("at") ?? 0.4);

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
const gl = renderer.gl;

const level = withSky(generateLevel(seed, { region }), { weather, hour });
const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);
const STILL = 1e-4;
/** Where on the piste he is stood: `at` of its length down. */
const spot = trackPointAt(level, level.track.length * at);

/** A free ride with his wounds carried, on the piste at `spot`, skiing
 * down it at `speed`. */
function ride(sfw = false): GameState {
  const state = createGame({
    level,
    seed,
    region,
    mode: "free",
    crowd: 0,
    quiet: true,
    gore: true,
    sfw,
  });
  placeRun(state, { x: spot.x, z: spot.z, heading: spot.heading, speed });
  return state;
}

/** A SHOOTER: `ahead` m down his way, `side` m to his right, `up` m over
 * the snow there. */
function shooter(
  state: GameState,
  weapon: WeaponKind,
  ahead: number,
  side: number,
  up: number,
): Gun {
  const h = state.skier.heading;
  const x = state.skier.x + Math.sin(h) * ahead + Math.cos(h) * side;
  const z = state.skier.z + Math.cos(h) * ahead - Math.sin(h) * side;
  return armGun(state, 1, weapon, x, level.groundAt(x, z) + up, z);
}

let gun: Gun | null = null;
let firstShot: number | null = null;
let blastAt: number | null = null;
let cleared = false;
/** Whether the last frame fired a round. */
let shotThisFrame = false;

/** One frame of the run: its steps, the gun pulled whenever it is ready,
 * then drawn (not shown). */
function frame(state: GameState, firing: boolean): void {
  shotThisFrame = false;
  for (let i = 0; i < STEPS; i++) {
    if (gun && firing) fireAt(state, gun, { kind: "quarry" });
    step(state, NEUTRAL_INPUT);
    for (const e of state.events) {
      if (e.kind !== "gunfire") continue;
      if (e.phase === "shot") shotThisFrame = true;
      if (e.phase === "shot" && firstShot === null) firstShot = e.t;
      if (e.phase === "blast" && blastAt === null) blastAt = e.t;
    }
  }
  renderer.draw(state, 1, FRAME, false);
  if (!cleared) {
    renderer.clearBodies();
    cleared = true;
  }
}

/** Fire until `t` s after the first shot. */
function fireTo(state: GameState, t: number, cap = 20): void {
  while (firstShot === null && state.t < cap) frame(state, true);
  while (firstShot !== null && state.t - firstShot < t) frame(state, true);
}

/** Fire until `t` s after the first shot and then on to a frame that
 * fired a round — its flash showing — and, `tracer`, with a tracer in the
 * air. */
function fireToFlash(state: GameState, t: number, tracer = false, cap = 20): void {
  fireTo(state, t, cap);
  const seen = (): boolean =>
    shotThisFrame && (!tracer || !!state.gunfire?.rounds.some((r) => r.tracer));
  while (!seen() && state.t < cap + t) frame(state, true);
}

/** Fire until the first burst, then `after` s on. */
function fireToBlast(state: GameState, after: number, cap = 20): void {
  while (blastAt === null && state.t < cap) frame(state, true);
  const until = state.t + after;
  while (state.t < until) frame(state, false);
}

/** Where his body is. */
function bodyAt(state: GameState): { x: number; y: number; z: number; heading: number } {
  const c = state.skier;
  const b = c.thrown;
  return b
    ? { x: b.x, y: b.y, z: b.z, heading: c.heading }
    : { x: c.x, y: c.y, z: c.z, heading: c.heading };
}

/** A lens over the shooter's shoulder: `back` m behind the gun and `up`
 * m over it, looking at the point `k` of the way from the gun to him. */
function overGun(state: GameState, back: number, up: number, fov = 40, k = 0.3): LensPose {
  const b = bodyAt(state);
  const g = gun ?? { x: b.x, y: b.y, z: b.z };
  const dx = b.x - g.x;
  const dz = b.z - g.z;
  const d = Math.hypot(dx, dz) || 1;
  const ex = g.x - (dx / d) * back + (dz / d) * 1.2;
  const ez = g.z - (dz / d) * back - (dx / d) * 1.2;
  return {
    eye: { x: ex, y: Math.max(level.groundAt(ex, ez) + 0.5, g.y + up), z: ez },
    target: {
      x: g.x + (b.x - g.x) * k,
      y: g.y + (level.groundAt(b.x, b.z) + 1 - g.y) * k,
      z: g.z + (b.z - g.z) * k,
    },
    fov,
    roll: 0,
  };
}

/** A lens behind him and `a` rad round (positive to his left), `back` m
 * off and `up` m over the snow, looking at the point `k` of the way from
 * him to the gun. */
function lens(
  state: GameState,
  a: number,
  back: number,
  up: number,
  k: number,
  fov = 55,
): LensPose {
  const b = bodyAt(state);
  const h = b.heading + Math.PI - a;
  const ex = b.x + Math.sin(h) * back;
  const ez = b.z + Math.cos(h) * back;
  const g = gun ?? { x: b.x, y: b.y, z: b.z };
  const tx = b.x + (g.x - b.x) * k;
  const tz = b.z + (g.z - b.z) * k;
  const ty = level.groundAt(b.x, b.z) + 1 + (g.y - level.groundAt(b.x, b.z) - 1) * k;
  return {
    eye: { x: ex, y: Math.max(level.groundAt(ex, ez) + 0.5, level.groundAt(b.x, b.z) + up), z: ez },
    target: { x: tx, y: ty, z: tz },
    fov,
    roll: 0,
  };
}

let frames: Frame[] = [];
let view = "";
let sky = "";

function shoot(state: GameState, label: string, pose: LensPose | null): void {
  renderer.setOverride(pose);
  // Once to deal the lamp slots for this lens, once to see.
  renderer.draw(state, 1, STILL, true);
  const info = gl.info;
  info.autoReset = false;
  info.reset();
  const t0 = performance.now();
  renderer.draw(state, 1, STILL, true);
  gl.getContext().finish();
  const ms = performance.now() - t0;
  const calls = info.render.calls;
  const tris = info.render.triangles;
  info.autoReset = true;
  renderer.setOverride(null);
  const g = state.gunfire;
  const since = firstShot === null ? "no shot yet" : `+${(state.t - firstShot).toFixed(2)} s`;
  const dead = state.gore && state.gore.dead >= 0 ? " · DEAD" : "";
  const off = state.skier.thrown ? " · THROWN" : "";
  frames.push({
    view,
    label,
    caption:
      `${view} ${label} — ${since}${dead}${off} — ${sky}\n` +
      `${g ? `${g.fired} rounds · ${g.hits} hits · ${g.rounds.length} flying` : "-"} · ` +
      `${ms.toFixed(1)} ms · ${calls} draws · ${(tris / 1000).toFixed(0)}k tris`,
    png: canvas.toDataURL("image/png"),
  });
}

async function under(h: number): Promise<void> {
  renderer.setSky({ hour: h, weather });
  await renderer.shadeSettled();
  sky = `h${h} ${weather}`;
}

function fresh(
  weapon: WeaponKind,
  ahead: number,
  side: number,
  up: number,
  sfw = false,
): GameState {
  firstShot = null;
  blastAt = null;
  cleared = false;
  const s = ride(sfw);
  gun = shooter(s, weapon, ahead, side, up);
  return s;
}

/** The rifleman: on the snow down the piste and off to its side. */
function rifle(sfw = false): void {
  let s = fresh("rifle", 70, 18, 1.5, sfw);
  fireToFlash(s, 0.1);
  shoot(s, "over the gun", overGun(s, 3, 0.5, 40, 0.15));
  s = fresh("rifle", 70, 18, 1.5, sfw);
  fireTo(s, 0.6);
  shoot(s, "strikes", lens(s, 0.5, 6, 1.8, 0.02, 60));
}

/** The door gunner's stand-in: in the air off his right side, a hundred
 * and thirty metres out. */
function doorGun(sfw = false): void {
  let s = fresh("doorGun", 60, 110, 45, sfw);
  fireToFlash(s, 0.2, true);
  shoot(s, "tracers", lens(s, 0, 10, 3, 0.5, 70));
  s = fresh("doorGun", 60, 110, 45, sfw);
  fireToFlash(s, 1.2, true);
  shoot(s, "over the gun", overGun(s, 5, 1.5, 50, 0.2));
  s = fresh("doorGun", 60, 110, 45, sfw);
  fireToFlash(s, 0.9, true);
  shoot(s, "incoming", lens(s, 0.5, 8, 2.5, 0.25, 70));
  s = fresh("doorGun", 60, 110, 45, sfw);
  fireTo(s, 2);
  shoot(s, "strikes", lens(s, 0.5, 7, 2.2, 0.02, 60));
}

/** The launcher: a man on a rise off the piste down his way. */
function rocket(): void {
  let s = fresh("rocket", 110, 35, 12);
  fireTo(s, 0.3);
  shoot(s, "flight", overGun(s, 6, 1.5, 45, 0.5));
  s = fresh("rocket", 110, 35, 12);
  fireToBlast(s, 0.05);
  shoot(s, "blast", lens(s, 0.3, 14, 4, 0.05, 60));
  s = fresh("rocket", 110, 35, 12);
  fireToBlast(s, 1.2);
  shoot(s, "after", lens(s, 0.6, 12, 4, 0.05, 60));
}

const VIEWS: Record<string, () => void | Promise<void>> = {
  rifle: () => rifle(),
  doorgun: () => doorGun(),
  rocket: () => rocket(),
  async "dusk-rifle"() {
    await under(duskHour);
    rifle();
  },
  async "dusk-doorgun"() {
    await under(duskHour);
    doorGun();
  },
  async "dusk-rocket"() {
    await under(duskHour);
    rocket();
  },
  "sfw-rifle": () => rifle(true),
  "sfw-doorgun": () => doorGun(true),
};

const ready = (async () => {
  const first = ride();
  await renderer.load(first);
  await under(hour);
  renderer.draw(first, 1, FRAME);
  await renderer.shadeSettled();
  return `piste at ${(at * 100).toFixed(0)}% of its length, skied at ${speed} m/s; stand-in shooters`;
})();

async function sheet(group: string, views: string[]): Promise<{ frames: Frame[] }> {
  const note = await ready;
  frames = [];
  for (const v of views) {
    const scene = VIEWS[v];
    if (!scene) throw new Error(`no view "${v}"`);
    view = v;
    if (!v.startsWith("dusk")) await under(hour);
    await scene();
  }
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent = `GUNFIRE — ${group} — seed ${seed}${region ? ` ${region}` : ""} — ${tier}\n${note}`;
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

window.__gunfire = { ready, groups: GROUPS, sheet };
