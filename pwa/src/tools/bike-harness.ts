// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE'S PICTURE LAB page (`scripts/bike-preview.mjs`): the
// summer free ride's bike and its rider ridden on the real engine through
// the game's OWN renderer, at named moments:
//
//   chase    the bot down a trail, on the close chase (the rung a ride starts on)
//   tips     the same moment on the bar-cam
//   helmet   the same moment through his own eyes
//   far      the same moment from the far boom
//   side     the same moment from beside him, close: the bike and the stance
//   drive    the same from his other side (the chain's)
//   close    the same from ahead and to his left, closer: the cockpit and the kit
//   front    the same moment from ahead of him
//   air      off the first jump the bot leaves the ground on, from the side
//   crash    the bars turned hard at speed until he is thrown — the bike loose
//   tree     ridden into a trunk beside the trail at 25 km/h, a moment after
//   afoot    stepped off and walking, pushing the bike at his left hand
//   push     the same walk from beside him, close
//   queue    rolled into a chair's load zone at a walking pace, the chair
//            coming round (the first chair of the map, which a bike once
//            rolled past)
//   lift     hooked on the chair, the two going up together
//
// It exposes `window.__bike.sheet(views)`, which shoots the views, lays them
// out as a contact sheet for the driver to photograph, and hands back every
// frame.

import {
  bikeAim,
  bikePilot,
  bikeWorldOf,
  createGame,
  fromEuler,
  generateLevel,
  liftPlans,
  NEUTRAL_INPUT,
  placeBike,
  solidsNear,
  solidsOf,
  step,
  TUNING,
  type GameState,
  type Level,
  type LiftPlan,
  type SkierInput,
} from "@engine";

import { isBikeLook, setBikeLook } from "../game/bike-looks.ts";
import type { LensPose } from "../game/camera-rigs.ts";
import type { CameraRung } from "../game/renderer-api.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";

type Frame = { view: string; label: string; caption: string; png: string };

declare global {
  interface Window {
    __bike?: {
      ready: Promise<string>;
      views: readonly string[];
      sheet(views: string[]): Promise<{ frames: Frame[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const trail = params.get("trail") || "B1";
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);
const cols = Number(params.get("cols") ?? 4);
const scale = Number(params.get("scale") ?? 0.5);
const hour = Number(params.get("hour") ?? 11);
const rideFor = Number(params.get("at") ?? 9);
const look = params.get("bikelook");
if (isBikeLook(look)) setBikeLook(look);

const VIEWS = [
  "chase",
  "tips",
  "helmet",
  "far",
  "side",
  "drive",
  "close",
  "front",
  "air",
  "crash",
  "tree",
  "afoot",
  "push",
  "queue",
  "lift",
] as const;
type ViewId = (typeof VIEWS)[number];

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

/** The map as the ride has it: a summer free ride raises its own summer
 * level (the bike park on it) off the generated one, and every ride after
 * the first is begun on that one so the renderer draws them all. */
let level: Level = generateLevel(seed);
let loaded: Level | null = null;
const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);
/** Frames ridden for each one drawn while a scene is ridden to its moment. */
const DRAW_EVERY = 240;

function bikeRide(spawn?: { x: number; z: number }): GameState {
  const s = createGame({
    level,
    mode: "free",
    summer: true,
    bike: true,
    bikeTrail: spawn ? undefined : trail,
    spawn,
    sky: { weather: "fair", hour },
    crowd: 0,
    quiet: true,
  });
  level = s.level;
  return s;
}

/** The renderer stood up on `s`'s map, if it is not already. */
async function onMap(s: GameState): Promise<void> {
  if (loaded === s.level) return;
  await renderer.load(s);
  renderer.setSky({ weather: "fair", hour });
  loaded = s.level;
}

/** Rides `s` a frame at a time under `input` until `until` says so or
 * `limit` s pass, drawing every frame so the lens and the interpolation
 * follow. */
function ride(
  s: GameState,
  input: (s: GameState, t: number) => SkierInput,
  until: (s: GameState, t: number) => boolean,
  limit: number,
): number {
  const t0 = s.t;
  let frame = 0;
  while (s.t - t0 < limit) {
    for (let i = 0; i < STEPS; i++) step(s, input(s, s.t - t0));
    // A frame drawn only every DRAW_EVERY (a software renderer takes
    // seconds over one): the trails stamped as it goes.
    if (++frame % DRAW_EVERY === 0) renderer.draw(s, 1, FRAME);
    if (until(s, s.t - t0)) break;
  }
  return s.t - t0;
}

/** A lens planted round the bike in its own frame: `side` m to its right
 * (negative its left), `ahead` m along it, `up` m over it. */
function planted(s: GameState, side: number, ahead: number, up: number, fov = 45): LensPose {
  const b = s.bike!;
  const h = b.heading;
  const fx = Math.sin(h);
  const fz = Math.cos(h);
  return {
    eye: { x: b.x + fx * ahead + fz * side, y: b.y + up, z: b.z + fz * ahead - fx * side },
    target: { x: b.x, y: b.y + 0.35, z: b.z },
    fov,
    roll: 0,
  };
}

function caption(s: GameState, t: number): string {
  const b = s.bike!;
  const what = s.skier.thrown
    ? "thrown"
    : b.mode === "lift"
      ? "on the lift"
      : b.afoot
        ? "afoot"
        : b.airborne
          ? `air ${b.airTime.toFixed(1)} s`
          : `${(b.speed * 3.6).toFixed(0)} km/h`;
  return `${t.toFixed(1)} s  ${b.mode}  ${what}`;
}

type Shot = { state: GameState; rung?: CameraRung; lens?: LensPose | null; caption: string };

/** The bot down `trail` for `rideFor` s, shared by the moving shots. */
let riding: { s: GameState; t: number } | null = null;
async function ridden(): Promise<{ s: GameState; t: number }> {
  if (riding) return riding;
  const s = bikeRide();
  await onMap(s);
  const aim = bikeAim(s, trail);
  renderer.setCamera("chase", true);
  const t = ride(
    s,
    (r) => bikePilot(r, aim),
    () => false,
    rideFor,
  );
  riding = { s, t };
  return riding;
}

async function scene(id: ViewId): Promise<Shot | null> {
  switch (id) {
    case "chase":
    case "tips":
    case "helmet":
    case "far": {
      const { s, t } = await ridden();
      return { state: s, rung: id, caption: `${id} — ${caption(s, t)}` };
    }
    case "side":
    case "drive":
    case "close":
    case "front": {
      const { s, t } = await ridden();
      const lens =
        id === "side"
          ? planted(s, -3.2, 0.3, 0.6)
          : id === "drive"
            ? planted(s, 3.2, 0.3, 0.6)
            : id === "close"
              ? planted(s, -1.5, 1.5, 0.45, 50)
              : planted(s, 0.5, 4.5, 0.9, 50);
      return { state: s, lens, caption: `${id} — ${caption(s, t)}` };
    }
    case "air": {
      const s = bikeRide();
      await onMap(s);
      const aim = bikeAim(s, trail);
      renderer.setCamera("chase", true);
      const t = ride(
        s,
        (r) => bikePilot(r, aim),
        (r) => r.bike!.airborne && r.bike!.airTime > 0.25,
        90,
      );
      if (!s.bike!.airborne) return null;
      return { state: s, lens: planted(s, -5, 0, 0.3, 50), caption: `air — ${caption(s, t)}` };
    }
    case "crash": {
      const s = bikeRide();
      await onMap(s);
      const aim = bikeAim(s, trail);
      renderer.setCamera("chase", true);
      let thrownAt = -1;
      let laid = false;
      const t = ride(
        s,
        (r, tt) => {
          // The bot to speed, then the bike laid over far past what the bars
          // can hold (as the engine's own fall test lays it): down he goes.
          if (tt < 5) return bikePilot(r, aim);
          if (!laid) {
            laid = true;
            r.bike!.q = fromEuler(r.bike!.heading, r.bike!.pitch, 1.3);
          }
          return NEUTRAL_INPUT;
        },
        (r, tt) => {
          if (r.skier.thrown && thrownAt < 0) thrownAt = tt;
          return thrownAt >= 0 && tt > thrownAt + 1.2;
        },
        20,
      );
      if (thrownAt < 0) return null;
      return {
        state: s,
        rung: "chase",
        caption: `crash — ${caption(s, t)} (thrown at ${thrownAt.toFixed(1)} s)`,
      };
    }
    case "tree":
      return intoTree();
    case "afoot":
    case "push": {
      const s = bikeRide();
      await onMap(s);
      renderer.setCamera("chase", true);
      ride(
        s,
        () => NEUTRAL_INPUT,
        () => false,
        0.5,
      );
      ride(
        s,
        (_r, tt) => ({ ...NEUTRAL_INPUT, machine: tt < 0.05 }),
        (r) => !!r.bike!.afoot,
        2,
      );
      const t = ride(
        s,
        () => ({ ...NEUTRAL_INPUT, tuck: 1, steer: 0.3 }),
        () => false,
        2.5,
      );
      if (id === "push")
        return {
          state: s,
          lens: planted(s, -2.6, 0.6, 0.5, 50),
          caption: `push — ${caption(s, t)}`,
        };
      return { state: s, rung: "chase", caption: `afoot — ${caption(s, t)}` };
    }
    case "queue":
    case "lift": {
      // The map's first chair (on seed 38 the one a bike once rolled 133 m
      // past), or the next that takes him.
      for (const plan of liftPlans(level).filter((p) => p.lift.kind === "chair")) {
        const shot = await onLift(plan, id);
        if (shot) return shot;
      }
      return null;
    }
  }
}

/** Rolled into `plan`'s load zone from 8 m short of it at a walking pace
 * and ridden until he is on the chair (`queue`) or well up the rope
 * (`lift`); null if the chair never takes him. The bike is stood there by
 * `placeBike` — moved by hand it keeps the height it had and falls. */
async function onLift(plan: LiftPlan, id: "queue" | "lift"): Promise<Shot | null> {
  const e = plan.look.entry;
  const u = e.at - e.along - 8;
  const x = plan.lift.bottom.x + u * plan.dx + e.side * plan.dz;
  const z = plan.lift.bottom.z + u * plan.dz - e.side * plan.dx;
  const s = bikeRide({ x, z });
  await onMap(s);
  stand(s, x, z, plan.heading, 1.5);
  renderer.setCamera("chase", true);
  const y0 = level.groundAt(x, z);
  const t = ride(
    s,
    (r) => ({ ...NEUTRAL_INPUT, tuck: r.bike!.mode !== "lift" && r.bike!.speed < 1.6 ? 1 : 0 }),
    (r) =>
      id === "queue"
        ? !!r.skier.lift && r.bike!.mode === "lift"
        : r.bike!.mode === "lift" && r.skier.y > y0 + 12,
    40,
  );
  if (s.bike!.mode !== "lift") return null;
  const lens = id === "lift" ? planted(s, -6, -2, -1, 50) : planted(s, -4, 2, 1.2, 55);
  return { state: s, lens, caption: `${id} — ${caption(s, t)} ${s.skier.lift?.phase ?? ""}` };
}

/** The bike stood at (x, z) facing `heading` rolling at `speed` m/s, the
 * rider on it. */
function stand(s: GameState, x: number, z: number, heading: number, speed: number): void {
  const b = s.bike!;
  placeBike(b, bikeWorldOf(s.level, s.t), x, z, heading, speed);
  s.skier.x = b.rider.x;
  s.skier.y = b.rider.y;
  s.skier.z = b.rider.z;
}

/** Into a trunk beside the ridden trail at 25 km/h, from 8 m short of it
 * with a clear run-up, shot from beside 0.6 s after it threw him. */
async function intoTree(): Promise<Shot | null> {
  const s0 = bikeRide();
  await onMap(s0);
  const t0 = level.bikePark?.trails.find((t) => t.id === trail);
  if (!t0) return null;
  const solids = solidsOf(level);
  const near: number[] = [];
  for (let k = 40; k < t0.points.length; k += 6) {
    const p = t0.points[k];
    for (const i of solidsNear(level, p.x, p.z, 6, near)) {
      if (i >= level.trees.length || level.trees[i].radius < 0.12) continue;
      const tr = level.trees[i];
      const d = Math.hypot(tr.x - p.x, tr.z - p.z);
      if (d < 2) continue;
      const heading = Math.atan2(tr.x - p.x, tr.z - p.z);
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const x = tr.x - fx * 8;
      const z = tr.z - fz * 8;
      if (Math.abs(level.groundAt(x, z) - level.groundAt(tr.x, tr.z)) > 3) continue;
      let clear = true;
      for (let a = 1; a <= 7.5 && clear; a += 0.5) {
        for (const j of solidsNear(level, x + fx * a, z + fz * a, 1.6, [])) {
          const o = solids[j];
          if (j !== i && Math.hypot(o.x - x - fx * a, o.z - z - fz * a) < o.radius + 1.2)
            clear = false;
        }
      }
      if (!clear) continue;
      const s = bikeRide({ x, z });
      await onMap(s);
      stand(s, x, z, heading, 25 / 3.6);
      renderer.setCamera("chase", true);
      let thrownAt = -1;
      const t = ride(
        s,
        () => NEUTRAL_INPUT,
        (r, tt) => {
          if (r.skier.thrown && thrownAt < 0) thrownAt = tt;
          return thrownAt >= 0 && tt > thrownAt + 0.6;
        },
        4,
      );
      if (thrownAt < 0) continue;
      return {
        state: s,
        // From over the slope beside it: a lens a metre up is in the hill.
        lens: planted(s, -3.5, 2.5, 3.2, 55),
        caption: `tree — ${caption(s, t)} (thrown at ${thrownAt.toFixed(2)} s)`,
      };
    }
  }
  return null;
}

const ready = (async () => {
  const s = bikeRide();
  await onMap(s);
  renderer.draw(s, 1, FRAME);
  await renderer.shadeSettled();
  const park = level.bikePark;
  return park
    ? `seed ${seed}, trail ${trail}: ${park.trails.map((t) => `${t.id} ${t.kind === "race" ? "race" : t.grade}`).join(", ")}`
    : "NO BIKE PARK";
})();

async function sheet(views: string[]): Promise<{ frames: Frame[] }> {
  const note = await ready;
  const frames: Frame[] = [];
  for (const view of views) {
    const shot = await scene(view as ViewId);
    if (!shot) {
      frames.push({ view, label: view, caption: `${view} — not reached`, png: "" });
      continue;
    }
    if (shot.rung) renderer.setCamera(shot.rung, true);
    renderer.setOverride(shot.lens ?? null);
    for (let i = 0; i < 6; i++) renderer.draw(shot.state, 1, FRAME);
    frames.push({ view, label: view, caption: shot.caption, png: canvas.toDataURL("image/png") });
    renderer.setOverride(null);
    renderer.setCamera("chase", true);
  }
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent = `DOWNHILL BIKE — ${tier}\n${note}`;
  header.style.whiteSpace = "pre-wrap";
  const cells: HTMLElement[] = [header];
  for (const f of frames) {
    const cell = document.createElement("figure");
    if (f.png) {
      const img = document.createElement("img");
      img.src = f.png;
      img.width = tw;
      img.height = th;
      await img.decode();
      cell.append(img);
    }
    const cap = document.createElement("figcaption");
    cap.textContent = f.caption;
    cell.append(cap);
    cells.push(cell);
  }
  sheetEl.replaceChildren(...cells);
  return { frames: frames.filter((f) => f.png) };
}

window.__bike = { ready, views: VIEWS, sheet };
