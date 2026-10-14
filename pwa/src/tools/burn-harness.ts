// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BURN LAB's page (`scripts/burn-preview.mjs`): a free ride's skier
// riding into a camp fire or a bonfire and burning (`engine/game/fire-burn.ts`,
// drawn by `burn-view.ts`), the real engine stepped and the game's OWN
// renderer drawing it, the INJURIES switch on (`gore`) so he dies of it:
//
//   * CATCH — frame by frame the moment he goes in: 0, 0.2, 0.5, 1 and 2 s
//     after his clothes caught;
//   * BURN — 3, 6 and 10 s on, and the moment he dies, each from the chase
//     and the side; a bonfire ridden into; the game's own lens (the death
//     cam) at his death;
//   * CHAR — the charred body after death, close, by day;
//   * NIGHT — the same at hour 21, lit by himself;
//   * SFW — the same run kept safe for work: held off the hearth, untouched.
//
// Every frame is captioned with the time since he caught, the burn's share,
// what it cost (ms, draw calls, triangles). It exposes
// `window.__burn.sheet(group, views)`, which shoots one group's views, lays
// them out as a contact sheet and hands back every frame.

import {
  createGame,
  firesOf,
  generateLevel,
  NEUTRAL_INPUT,
  placeRun,
  step,
  TUNING,
  withSky,
  type Fire,
  type GameState,
  type RegionId,
  type WeatherKind,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";

type Frame = { view: string; label: string; caption: string; png: string };

const GROUPS = {
  catch: ["catch-0", "catch-0.2", "catch-0.5", "catch-1", "catch-2"],
  burn: ["burn-3", "burn-6", "burn-10", "burn-death", "burn-bonfire", "burn-deathcam"],
  char: ["char-close", "char-side", "char-above"],
  night: ["night-1", "night-4", "night-char"],
  sfw: ["sfw-0", "sfw-1", "sfw-3"],
} as const;

declare global {
  interface Window {
    __burn?: {
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
const nightHour = Number(params.get("night") ?? 21);
const weather = (params.get("weather") || "clear") as WeatherKind;
const speed = Number(params.get("speed") ?? 8);

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
const fires = firesOf(level);
const camp: Fire | undefined = [...fires.filter((f) => f.kind === "camp")].sort(
  (a, b) => b.seats.length - a.seats.length,
)[0];
const bonfire: Fire | undefined = fires.find((f) => f.kind === "bonfire");

const need = (f: Fire | undefined, what: string): Fire => {
  if (!f) throw new Error(`seed ${seed} has no ${what}`);
  return f;
};

/** A free ride with his wounds carried, stood `back` m short of fire `f`
 * between its first bench and it, skiing straight in at `speed`. */
function rideInto(f: Fire, sfw = false): GameState {
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
  const seat = f.seats[0];
  const heading = Math.atan2(f.x - seat.x, f.z - seat.z);
  const back = f.radius + 2.2;
  placeRun(state, {
    x: f.x - Math.sin(heading) * back,
    z: f.z - Math.cos(heading) * back,
    heading,
    speed,
  });
  return state;
}

/** One frame of the run: its steps, then drawn (not shown). */
function frame(state: GameState): void {
  for (let i = 0; i < STEPS; i++) {
    step(state, NEUTRAL_INPUT);
    for (const e of state.events) {
      if (e.kind === "fire" && e.what === "caught" && caughtAt === null) caughtAt = e.t;
      if (e.kind === "death" && diedAt === null) diedAt = e.t;
    }
  }
  renderer.draw(state, 1, FRAME, false);
  // A rider who died in the last view is left lying there by the game
  // (`gore-view.ts`'s `leave`): not in this one's pictures.
  if (!cleared) {
    renderer.clearBodies();
    cleared = true;
  }
}
let cleared = false;
let caughtAt: number | null = null;
let diedAt: number | null = null;

/** Ride until `t` s after he caught (or `t` s of the run, if he never does). */
function rideTo(state: GameState, t: number, cap = 60): void {
  while (caughtAt === null && state.t < (state.rules.sfw ? t : cap)) frame(state);
  while (caughtAt !== null && state.t - caughtAt < t) frame(state);
}

/** Ride until he dies, then `after` s on. */
function rideToDeath(state: GameState, after = 0, cap = 40): void {
  while (diedAt === null && state.t < cap) frame(state);
  const until = state.t + after;
  while (state.t < until) frame(state);
}

/** Where his body is: thrown, its middle; else his own. */
function bodyAt(state: GameState): { x: number; y: number; z: number; heading: number } {
  const c = state.skier;
  const b = c.thrown;
  return b
    ? { x: b.x, y: b.y, z: b.z, heading: c.heading }
    : { x: c.x, y: c.y, z: c.z, heading: c.heading };
}

/** A lens round him: `a` rad off behind him (0 behind, π/2 his side),
 * `back` m off and `up` m over the snow, looking `look` m over him. */
function round(
  state: GameState,
  a: number,
  back: number,
  up: number,
  look = 0.6,
  fov = 50,
): LensPose {
  const b = bodyAt(state);
  const h = b.heading + Math.PI + a;
  const ex = b.x + Math.sin(h) * back;
  const ez = b.z + Math.cos(h) * back;
  return {
    eye: { x: ex, y: Math.max(level.groundAt(ex, ez) + 0.4, level.groundAt(b.x, b.z) + up), z: ez },
    target: { x: b.x, y: level.groundAt(b.x, b.z) + look, z: b.z },
    fov,
    roll: 0,
  };
}

let frames: Frame[] = [];
let view = "";
let sky = "";

function shoot(state: GameState, label: string, lens: LensPose | null): void {
  renderer.setOverride(lens);
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
  const burn = state.burn;
  const since = caughtAt === null ? "not caught" : `+${(state.t - caughtAt).toFixed(1)} s`;
  const dead = state.gore && state.gore.dead >= 0 ? " · DEAD" : "";
  frames.push({
    view,
    label,
    caption:
      `${view} ${label} — ${since}${dead} — ${sky}\n` +
      `burnt ${burn ? burn.burnt.toFixed(2) : "-"}${burn && !burn.burning ? " (out)" : ""} · ` +
      `${ms.toFixed(1)} ms · ${calls} draws · ${(tris / 1000).toFixed(0)}k tris`,
    png: canvas.toDataURL("image/png"),
  });
}

async function under(h: number): Promise<void> {
  renderer.setSky({ hour: h, weather });
  await renderer.shadeSettled();
  sky = `h${h} ${weather}`;
}

function fresh(f: Fire, sfw = false): GameState {
  caughtAt = null;
  diedAt = null;
  cleared = false;
  return rideInto(f, sfw);
}

const catchAt = (t: number) => (): void => {
  const s = fresh(need(camp, "camp fire"));
  rideTo(s, t);
  shoot(s, `${t}s`, round(s, 0.9, 5, 1.8, 0.9, 55));
};
const burnAt = (t: number) => (): void => {
  const s = fresh(need(camp, "camp fire"));
  rideTo(s, t);
  shoot(s, "chase", round(s, 0.35, 6, 2.4, 1.1, 55));
  shoot(s, "side", round(s, Math.PI / 2, 3.6, 1.1, 0.4, 50));
};

const VIEWS: Record<string, () => void | Promise<void>> = {
  "catch-0": catchAt(0),
  "catch-0.2": catchAt(0.2),
  "catch-0.5": catchAt(0.5),
  "catch-1": catchAt(1),
  "catch-2": catchAt(2),
  "burn-3": burnAt(3),
  "burn-6": burnAt(6),
  "burn-10": burnAt(10),
  "burn-death"() {
    const s = fresh(need(camp, "camp fire"));
    rideToDeath(s);
    shoot(s, "chase", round(s, 0.35, 6, 2.4, 1.1, 55));
    shoot(s, "side", round(s, Math.PI / 2, 3.6, 1.1, 0.4, 50));
  },
  "burn-bonfire"() {
    const s = fresh(need(bonfire, "bonfire"));
    rideTo(s, 2.5);
    shoot(s, "chase", round(s, 0.4, 9, 3, 1.5, 55));
  },
  "burn-deathcam"() {
    const s = fresh(need(camp, "camp fire"));
    rideToDeath(s, 1.5);
    // The game's own lens: the ladder, and the death cam once he dies.
    shoot(s, "game lens", null);
  },
  "char-close"() {
    const s = fresh(need(camp, "camp fire"));
    rideTo(s, 30);
    shoot(s, "close", round(s, 1.2, 1.9, 1.3, 0.2, 50));
  },
  "char-side"() {
    const s = fresh(need(camp, "camp fire"));
    rideTo(s, 30);
    shoot(s, "side", round(s, Math.PI / 2, 2.6, 0.9, 0.2, 50));
  },
  "char-above"() {
    const s = fresh(need(camp, "camp fire"));
    rideTo(s, 30);
    shoot(s, "above", round(s, 0.4, 1.2, 3.2, 0, 55));
  },
  async "night-1"() {
    await under(nightHour);
    VIEWS["catch-1"]();
  },
  async "night-4"() {
    await under(nightHour);
    VIEWS["burn-3"]();
  },
  async "night-char"() {
    await under(nightHour);
    VIEWS["char-close"]();
  },
  "sfw-0"() {
    const s = fresh(need(camp, "camp fire"), true);
    rideTo(s, 0.5);
    shoot(s, "0.5s", round(s, 0.9, 5, 1.8, 0.9, 55));
  },
  "sfw-1"() {
    const s = fresh(need(camp, "camp fire"), true);
    rideTo(s, 1.5);
    shoot(s, "1.5s", round(s, 0.9, 5, 1.8, 0.9, 55));
  },
  "sfw-3"() {
    const s = fresh(need(camp, "camp fire"), true);
    rideTo(s, 4);
    shoot(s, "4s", round(s, 0.9, 5, 1.8, 0.9, 55));
  },
};

const ready = (async () => {
  const first = rideInto(need(camp, "camp fire"));
  await renderer.load(first);
  await under(hour);
  renderer.draw(first, 1, FRAME);
  await renderer.shadeSettled();
  return `camp fire ${camp?.id ?? "-"} (r ${camp?.radius} m), bonfire ${bonfire?.id ?? "-"}; ridden in at ${speed} m/s`;
})();

async function sheet(group: string, views: string[]): Promise<{ frames: Frame[] }> {
  const note = await ready;
  frames = [];
  for (const v of views) {
    const scene = VIEWS[v];
    if (!scene) throw new Error(`no view "${v}"`);
    view = v;
    if (!v.startsWith("night")) await under(hour);
    await scene();
  }
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent = `BURN — ${group} — seed ${seed}${region ? ` ${region}` : ""} — ${tier}\n${note}`;
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

window.__burn = { ready, groups: GROUPS, sheet };
