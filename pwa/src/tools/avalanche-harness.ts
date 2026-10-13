// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AVALANCHE LAB's page (`scripts/avalanche-preview.mjs`): a slab
// released on a generated free ride's loaded lee face (`avalanche.ts`) and
// drawn through the game's OWN renderer (`avalanche-view.ts`,
// `avalanche-glsl.ts`), the engine stepped here every sixtieth of a second:
//
//   release  the crown cracking and the slab starting to move, 0–2 s;
//   flow     the front and its powder cloud from beside and from below,
//            at 3, 6, 10 and 15 s;
//   debris   the deposit once the flow has stopped, close and far, and
//            the crown and the bed from below it;
//   caught   a skier crossing the slab when it goes, from the chase: caught,
//            carried, buried, and the BURIED card over it;
//   night    the flow and the debris at hour 21, under the headlamp.
//
// The face is the most avalanche-prone open slope on the map off the
// groomed runs (`avalancheHazard` at a whole load), or `?at=x,z`. Nothing
// reads a wall clock, so a seed's sheet is the same sheet twice.
//
// It exposes `window.__avalanche.sheet(group, views)`, which shoots the
// views of one group, lays them out as a contact sheet for the driver to
// photograph, and hands back every frame at full size and what it cost.

import {
  avalancheHazard,
  AVALANCHE_CELL as CELL,
  createGame,
  generateLevel,
  NEUTRAL_INPUT,
  placeRun,
  releaseAvalanche,
  step,
  sunAtRun,
  TUNING,
  type GameEvent,
  type GameState,
  type RegionId,
  type SkierInput,
  type Slide,
  type WeatherKind,
} from "@engine";

import { h, render, type ComponentChild } from "preact";

import "../beacon.css";
import "../wreck.css";
import { DeathCard } from "../game/hud-glass.tsx";
import { buriedOf, wreckOf } from "../game/hud-wreck.ts";
import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import type { CameraRung } from "../game/renderer-api.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { RESCUE_GROUPS, rescueViews } from "./avalanche-rescue-lab.ts";

/** A frame, and the HUD drawn over it (the transceiver, the buried veil). */
type Frame = { view: string; label: string; caption: string; png: string; hud?: ComponentChild };
type Lens = CameraRung | LensPose;
type Cost = { label: string; ms: number; calls: number; triangles: number; geometries: number };

const GROUPS: Record<string, readonly string[]> = {
  release: ["release"],
  flow: ["beside", "below"],
  debris: ["debris"],
  caught: ["caught", "plough"],
  night: ["night"],
  ...RESCUE_GROUPS,
};

declare global {
  interface Window {
    __avalanche?: {
      ready: Promise<string>;
      groups: Record<string, readonly string[]>;
      sheet(group: string, views: string[]): Promise<{ frames: Frame[]; costs: Cost[] }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 7);
const region = (params.get("region") || undefined) as RegionId | undefined;
const dial = Number(params.get("snow") ?? 3);
const hour = Number(params.get("hour") ?? 11);
const forced = (params.get("at") ?? "").split(",").map(Number);
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "high";
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);
const cols = Number(params.get("cols") ?? 2);
const scale = Number(params.get("scale") ?? 0.5);

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

// The sky the sheets are drawn under: a clear one unless asked, so the
// slide is judged in the light that shows it best (`?weather=dealt` keeps
// the map's own).
const weather = params.get("weather") ?? "clear";
const map = generateLevel(seed, {
  region,
  ...(weather === "dealt" ? {} : { sky: { weather: weather as WeatherKind } }),
});
const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);
const STILL = 1e-4;

/** The run's own seed the slides are dealt off: picked at the start so the
 * sheets' slab is a middling one, near the half metre most dry slabs are
 * (`AVALANCHE.depthMid`), rather than whatever the map's seed deals. */
let runSeed = seed;
const depthWanted = Number(params.get("depth") ?? 0.6);

function fresh(crowd = 0): GameState {
  return createGame({
    level: map,
    seed: runSeed,
    region,
    mode: "free",
    snowDepth: dial,
    crowd,
    groomer: "off",
    avalanche: true,
    quiet: true,
  });
}

type Spot = { x: number; z: number };

/** THE WOODS: a face whose flow runs into trees is hidden by them, so the
 * sheets' face is an open one — trees counted on a 10 m grid. */
let woodsOf: ((x: number, z: number) => number) | null = null;
function treeGrid(s: GameState): (x: number, z: number) => number {
  if (woodsOf) return woodsOf;
  const lv = s.level;
  const CELLS = Math.ceil(lv.size / 10);
  const woods = new Uint16Array(CELLS * CELLS);
  for (const t of lv.trees) {
    const i = Math.floor(t.x / 10);
    const j = Math.floor(t.z / 10);
    if (i >= 0 && j >= 0 && i < CELLS && j < CELLS) woods[j * CELLS + i]++;
  }
  woodsOf = (x: number, z: number) => {
    const i = Math.floor(x / 10);
    const j = Math.floor(z / 10);
    return i >= 0 && j >= 0 && i < CELLS && j < CELLS ? woods[j * CELLS + i] : 0;
  };
  return woodsOf;
}

/** THE FACES worth a slide: the open, loaded slopes off the runs that
 * break into the biggest slabs — width across times run down the fall
 * line, both probed as the engine sizes a slab (a point is slab while its
 * hazard stands above none) — with a run-out below in sight and few trees
 * or rocks down the track; the best `most`, a couple of hundred metres
 * apart, best first. */
function faces(s: GameState, most: number): Spot[] {
  const lv = s.level;
  const n = { x: 0, y: 1, z: 0 };
  const on = (x: number, z: number) =>
    x > 20 && z > 20 && x < lv.size - 20 && z < lv.size - 20 && avalancheHazard(lv, 1, x, z) > 0;
  // A face turned to the sheets' sun reads; one in its own shade does not.
  const sun = sunAtRun({ sun: { ...lv.sun, hour } });
  const sx = Math.sin(sun.azimuth);
  const sz = Math.cos(sun.azimuth);
  const treesAt = treeGrid(s);
  const found: { x: number; z: number; score: number }[] = [];
  const margin = 120;
  for (let x = margin; x < lv.size - margin; x += 12) {
    for (let z = margin; z < lv.size - margin; z += 12) {
      const h = avalancheHazard(lv, 1, x, z);
      if (h < 0.25) continue;
      lv.normalAt(x, z, n);
      const fl = Math.hypot(n.x, n.z);
      if (fl < 1e-3) continue;
      const fx = n.x / fl;
      const fz = n.z / fl;
      let down = 0;
      for (let d = 3; d <= 220 && on(x + fx * d, z + fz * d); d += 3) down = d;
      // The engine hangs the slab off a crown up the fall line from where
      // it breaks and reaches its flanks across from there: read the width
      // where the crown will stand.
      let up = 0;
      for (let d = 2; d <= 18 && on(x - fx * d, z - fz * d); d += 2) up = d;
      const cx = x - fx * up;
      const cz = z - fz * up;
      let across = 0;
      for (const sgn of [1, -1]) {
        for (let d = 3; d <= 45 && on(cx + sgn * fz * d, cz - sgn * fx * d); d += 3) across += 3;
      }
      // A run-out: the fall line easing under about 10° on the map within
      // a few hundred metres of the slab, so the debris lies in sight of
      // it rather than a kilometre down the valley.
      let ease = 0;
      for (let d = down + 10; d <= down + 500; d += 10) {
        const px = x + fx * d;
        const pz = z + fz * d;
        if (px < 10 || pz < 10 || px > lv.size - 10 || pz > lv.size - 10) break;
        lv.normalAt(px, pz, n);
        if (n.y > 0.985) {
          ease = d;
          break;
        }
      }
      if (!ease) continue;
      // The trees down the track, from the crown to past where it eases,
      // and the rock: a pitch over 40° is a cliff's, drawn as bare rock.
      let trees = 0;
      for (let d = -up; d <= ease + 60; d += 10) {
        for (let w = -across / 2; w <= across / 2; w += 10) {
          const px = x + fx * d + fz * w;
          const pz = z + fz * d - fx * w;
          trees += treesAt(px, pz);
          lv.normalAt(px, pz, n);
          if (n.y < 0.77) trees += 3;
        }
      }
      const lit = 0.35 + 0.65 * Math.max(0, fx * sx + fz * sz);
      const sc =
        (Math.min(down, 140) * Math.min(across, 80) ** 2 * (0.5 + h) * lit) /
        (1 + (ease - down) / 150) /
        (1 + trees / 6);
      if (sc > 0) found.push({ x, z, score: sc });
    }
  }
  found.sort((a, b) => b.score - a.score);
  const out: Spot[] = [];
  for (const f of found) {
    if (out.length >= most) break;
    if (out.some((o) => Math.hypot(o.x - f.x, o.z - f.z) < 200)) continue;
    out.push({ x: f.x, z: f.z });
  }
  return out;
}

/** The run's seed whose slab at `at` is nearest the depth wanted, and wide. */
function seedFor(at: Spot): number {
  let off = Infinity;
  let pick = seed;
  for (let k = 0; k < 40; k++) {
    runSeed = seed + k * 7919;
    const trial = fresh();
    const slab = releaseAvalanche(trial, trial.avalanche!, at.x, at.z, []).slab;
    const miss =
      Math.abs(slab.depth - depthWanted) / 0.15 - Math.min(slab.left + slab.right, 60) / 20;
    if (miss < off) {
      off = miss;
      pick = runSeed;
    }
  }
  return pick;
}

/** A slide at `at` run to rest headless: whether it stopped, how far it
 * ran, and how many trees stood along its path. */
function trial(at: Spot): { stopped: boolean; runout: number; trees: number; wide: number } {
  const s = fresh();
  const treesAt = treeGrid(s);
  placeRun(s, safe);
  const slide = releaseAvalanche(s, s.avalanche!, at.x, at.z, []);
  let trees = 0;
  const seen = new Set<number>();
  const steps = Math.round(1 / TUNING.dt);
  for (let t = 0; t < 60 && slide.running; t++) {
    for (let i = 0; i < steps; i++) step(s, NEUTRAL_INPUT);
    for (let i = 0; i < slide.count; i += 3) {
      const x = slide.cells[i * CELL.stride + CELL.x];
      const z = slide.cells[i * CELL.stride + CELL.z];
      const key = Math.floor(x / 10) * 100000 + Math.floor(z / 10);
      if (seen.has(key)) continue;
      seen.add(key);
      trees += treesAt(x, z);
    }
  }
  return {
    stopped: !slide.running,
    runout: slide.runout,
    trees,
    wide: slide.slab.left + slide.slab.right,
  };
}

let face = { x: 0, z: 0 };
let bestSeed = seed;
/** A safe place to stand the skier the planted views do not follow: the
 * start line, on the groomed piste. */
let safe = { x: 0, z: 0, heading: 0 };
const tried: string[] = [];
const ready = (async () => {
  let first = fresh();
  safe = { x: first.skier.x, z: first.skier.z, heading: first.skier.heading };
  if (forced.length === 2 && forced.every(Number.isFinite)) {
    face = { x: forced[0], z: forced[1] };
    bestSeed = seedFor(face);
  } else {
    // Each candidate's slide run to rest headless: the sheets want one
    // that stops in sight, on open snow.
    let top = -Infinity;
    for (const at of faces(first, 8)) {
      const pick = seedFor(at);
      runSeed = pick;
      const r = trial(at);
      const sc =
        (r.stopped ? 1 : 0.02) *
        Math.min(r.wide, 70) *
        (1 / (1 + Math.max(0, r.runout - 450) / 200)) *
        (1 / (1 + r.trees / 6));
      tried.push(
        `${at.x.toFixed(0)},${at.z.toFixed(0)} ${r.stopped ? "stops" : "runs"} ` +
          `${r.runout.toFixed(0)} m, ${r.trees} trees, ${r.wide.toFixed(0)} m wide`,
      );
      if (sc > top) {
        top = sc;
        face = at;
        bestSeed = pick;
      }
    }
  }
  runSeed = bestSeed;
  first = fresh();
  await renderer.load(first);
  renderer.setSky({ hour });
  renderer.draw(first, 1, FRAME);
  await renderer.shadeSettled();
  const h = avalancheHazard(first.level, first.avalanche?.load ?? 0, face.x, face.z);
  return (
    `face at ${face.x.toFixed(0)}, ${face.z.toFixed(0)} — hazard ${h.toFixed(2)} at the run's ` +
    `load ${(first.avalanche?.load ?? 0).toFixed(2)} (snow dial ${dial})` +
    (tried.length ? `; tried ${tried.join(" | ")}` : "")
  );
})();

let frames: Frame[] = [];
let costs: Cost[] = [];
let view = "";

function run(s: GameState, seconds: number, input: SkierInput = NEUTRAL_INPUT): void {
  const n = Math.round(seconds / FRAME);
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < STEPS; i++) step(s, input);
    renderer.draw(s, 1, FRAME, false);
  }
}

/** A slab broken at the face, the skier stood well clear on the piste. */
function released(withSkier = false): { s: GameState; slide: Slide } {
  const s = fresh();
  const events: GameEvent[] = [];
  if (!withSkier) placeRun(s, safe);
  const slide = releaseAvalanche(s, s.avalanche!, face.x, face.z, events);
  renderer.draw(s, 1, FRAME, false);
  return { s, slide };
}

/** The slab's frame: a point `u` m across it (+ its left), `v` m down its
 * fall line from the crown, `up` m over the snow there. */
function slabAt(slide: Slide, s: GameState, u: number, v: number, up: number) {
  const k = slide.slab;
  const x = k.x + k.fz * u + k.fx * v;
  const z = k.z - k.fx * u + k.fz * v;
  return { x, y: s.level.groundAt(x, z) + up, z };
}

/** A lens on the crown from down the bed: `d` m down the ground's own
 * fall line from the crown's point at `u` (the slab's frame leans off it
 * on a twisted face), `up` m over the bed, looking back up at the wall. */
function crownLens(slide: Slide, s: GameState, u: number, d: number, up: number) {
  const k = slide.slab;
  const top = slabAt(slide, s, u, 1.5, -k.depth * 0.5);
  const n = { x: 0, y: 1, z: 0 };
  let x = top.x;
  let z = top.z;
  // Walked down in steps, each down the ground's fall line where it is.
  for (let w = 0; w < d; w += 2) {
    s.level.normalAt(x, z, n);
    const l = Math.hypot(n.x, n.z) || 1;
    x += (n.x / l) * 2;
    z += (n.z / l) * 2;
  }
  const eye = { x, y: s.level.groundAt(x, z) - k.depth + up, z };
  return lens(eye, top, 60);
}

/** The flow's FRONT (the parcel furthest down) and its middle. */
function frontOf(slide: Slide, s: GameState) {
  const c = slide.cells;
  const k = slide.slab;
  let far = -Infinity;
  let fx = k.x;
  let fz = k.z;
  let mx = 0;
  let mz = 0;
  for (let i = 0; i < slide.count; i++) {
    const x = c[i * CELL.stride + CELL.x];
    const z = c[i * CELL.stride + CELL.z];
    mx += x / slide.count;
    mz += z / slide.count;
    const d = (x - k.x) * k.fx + (z - k.z) * k.fz;
    if (d > far) {
      far = d;
      fx = x;
      fz = z;
    }
  }
  // The way the head is going: its parcels' mean velocity, near the front.
  let wx = 0;
  let wz = 0;
  for (let i = 0; i < slide.count; i++) {
    const x = c[i * CELL.stride + CELL.x];
    const z = c[i * CELL.stride + CELL.z];
    if (Math.hypot(x - fx, z - fz) > 40) continue;
    wx += c[i * CELL.stride + CELL.vx];
    wz += c[i * CELL.stride + CELL.vz];
  }
  const wl = Math.hypot(wx, wz);
  const way = wl > 0.5 ? { x: wx / wl, z: wz / wl } : { x: k.fx, z: k.fz };
  return {
    front: { x: fx, y: s.level.groundAt(fx, fz), z: fz, v: far },
    middle: { x: mx, y: s.level.groundAt(mx, mz), z: mz },
    way,
  };
}

/** A lens on the flow's head, set off it along the way it is going
 * (`along` m ahead), to its left (`side` m) and `up` m over the snow there
 * — never under the snow between — looking back at the head and its cloud. */
function flowLens(slide: Slide, s: GameState, along: number, side: number, up: number) {
  const { front, way } = frontOf(slide, s);
  const x = front.x + way.x * along + way.z * side;
  const z = front.z + way.z * along - way.x * side;
  const eye = { x, y: s.level.groundAt(x, z) + up, z };
  // Raised until the snow halfway along the line no longer stands in it.
  for (let k = 0; k < 8; k++) {
    const hx = (x + front.x) / 2;
    const hz = (z + front.z) / 2;
    const line = (eye.y + front.y + 8) / 2;
    if (s.level.groundAt(hx, hz) + 4 < line) break;
    eye.y += 8;
  }
  const at = { x: front.x - way.x * 12, y: front.y + 8, z: front.z - way.z * 12 };
  return lens(eye, at, 55);
}

function lens(
  eye: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  fov = 55,
): LensPose {
  return { eye, target, fov, roll: 0 };
}

function shoot(s: GameState, label: string, l: Lens, hud?: ComponentChild): void {
  if (typeof l === "string") {
    if (renderer.camera() !== l) renderer.setCamera(l, true);
    renderer.setOverride(null);
  } else renderer.setOverride(l);
  const info = gl.info;
  info.autoReset = false;
  info.reset();
  const t0 = performance.now();
  renderer.draw(s, 1, STILL, true);
  gl.getContext().finish();
  const ms = performance.now() - t0;
  costs.push({
    label: `${view} ${label}`,
    ms,
    calls: info.render.calls,
    triangles: info.render.triangles,
    geometries: info.memory.geometries,
  });
  info.autoReset = true;
  renderer.setOverride(null);
  const a = s.avalanche;
  const sl = a?.slide;
  const v = a?.victim;
  frames.push({
    view,
    label,
    caption:
      `${view} ${label}\n` +
      (sl
        ? `t ${sl.t.toFixed(1)} s, front ${(sl.front * 3.6).toFixed(0)} km/h, ` +
          `${sl.moving}/${sl.count} running, runout ${sl.runout.toFixed(0)} m, ` +
          `slab ${(sl.slab.left + sl.slab.right).toFixed(0)}×${sl.slab.length.toFixed(0)}×${sl.slab.depth.toFixed(2)} m`
        : "no slide") +
      (v ? `\nvictim ${v.phase} ${v.depth.toFixed(2)} m` : ""),
    png: canvas.toDataURL("image/png"),
    ...(hud ? { hud } : {}),
  });
}

const VIEWS: Record<string, () => Promise<void>> = {
  async release() {
    const { s, slide } = released();
    const k = slide.slab;
    const mid = (k.left - k.right) / 2;
    const far = lens(
      slabAt(slide, s, mid + (k.left + k.right) * 0.5, 80, 22),
      slabAt(slide, s, (k.left - k.right) / 2, 0, -k.depth),
      50,
    );
    // On the bed below the crown's left end, looking up at it: the crown's
    // wall square to the bed, the plates going past.
    const close = lens(
      slabAt(slide, s, mid + (k.left + k.right) * 0.28, 24, 2.2 - k.depth),
      slabAt(slide, s, mid + (k.left + k.right) * 0.05, 0, 0),
      60,
    );
    const bare = fresh();
    placeRun(bare, safe);
    renderer.draw(bare, 1, FRAME, false);
    shoot(bare, "no slide, the same lens (the cost's baseline)", far);
    renderer.draw(s, 1, FRAME, false);
    shoot(s, "0.0 s, the crown cracks", far);
    shoot(s, "0.0 s, at the crown", close);
    for (const [dt, t] of [
      [0.25, "0.25"],
      [0.25, "0.5"],
      [0.5, "1.0"],
      [1, "2.0"],
    ] as const) {
      run(s, dt);
      shoot(s, `${t} s`, far);
    }
    shoot(s, "2.0 s, at the crown", close);
    // The slab gone off it: the crown's wall standing over the bed, seen
    // from down the bed — high enough to see over the slope's bulge.
    run(s, 5);
    shoot(s, "7.0 s, the crown from the bed", crownLens(slide, s, mid, 16, 3.2));
  },
  async beside() {
    const { s, slide } = released();
    let t = 0;
    for (const at of [3, 6, 10, 15]) {
      run(s, at - t);
      t = at;
      // Off its left side, a little ahead of the front and over it,
      // looking back across the flow and up its track.
      shoot(s, `${at} s from beside`, flowLens(slide, s, 25, 75, 28));
    }
  },
  async below() {
    const { s, slide } = released();
    let t = 0;
    for (const at of [3, 6, 10, 15]) {
      run(s, at - t);
      t = at;
      // Down its way, a little off its line, as it comes on.
      shoot(s, `${at} s from below`, flowLens(slide, s, 110, 25, 14));
    }
  },
  async debris() {
    const { s, slide } = released();
    // To rest (`AVALANCHE.runMost` at the most).
    for (let t = 0; t < 60 && slide.running; t += 1) run(s, 1);
    // And the cloud left to settle out of the air over it.
    run(s, 30);
    const k = slide.slab;
    const { middle, front } = frontOf(slide, s);
    // The deposit's middle: the parcels at rest below the stauchwall.
    const c = slide.cells;
    let dx = 0;
    let dz = 0;
    let n = 0;
    for (let i = 0; i < slide.count; i++) {
      const x = c[i * CELL.stride + CELL.x];
      const z = c[i * CELL.stride + CELL.z];
      if ((x - k.x) * k.fx + (z - k.z) * k.fz < k.length) continue;
      dx += x;
      dz += z;
      n++;
    }
    const lump = n ? { x: dx / n, z: dz / n } : { x: middle.x, z: middle.z };
    const ly = s.level.groundAt(lump.x, lump.z);
    const lv = (lump.x - k.x) * k.fx + (lump.z - k.z) * k.fz;
    const lu = (lump.x - k.x) * k.fz - (lump.z - k.z) * k.fx;
    shoot(
      s,
      "close, on the deposit",
      lens(slabAt(slide, s, lu + 12, lv - 16, 4.5), { x: lump.x, y: ly + 0.5, z: lump.z }, 60),
    );
    shoot(
      s,
      "the toe",
      lens(slabAt(slide, s, lu + 6, front.v + 22, 12), { x: lump.x, y: ly + 1, z: lump.z }, 60),
    );
    shoot(
      s,
      "far, across",
      lens(slabAt(slide, s, lu + 150, lv - 50, 70), { x: lump.x, y: ly, z: lump.z }, 45),
    );
    shoot(
      s,
      "the bed and the crown from below",
      crownLens(slide, s, (k.left - k.right) / 2 - 10, 24, 4),
    );
  },
  async caught() {
    const s = fresh();
    // Stood on the slope's middle, crossing it at 15 km/h, when it goes
    // under him: caught as it breaks up and runs, carried a few seconds,
    // and buried — the BURIED card coming up over the debris and the
    // picture going dark (`hud-wreck.ts`'s timeline at its default).
    const n = { x: 0, y: 1, z: 0 };
    s.level.normalAt(face.x, face.z, n);
    const fall = Math.atan2(n.x, n.z);
    placeRun(s, { x: face.x, z: face.z, heading: fall + Math.PI / 2, speed: 4.2 });
    run(s, 0.2);
    const events: GameEvent[] = [];
    releaseAvalanche(s, s.avalanche!, s.skier.x, s.skier.z, events);
    shoot(s, "0.0 s, the slab goes under him", "chase");
    const phase = () => s.avalanche?.victim?.phase ?? "free";
    for (let t = 0; t < 8 && phase() === "free"; t += 1 / 60) run(s, 1 / 60);
    shoot(s, `caught at ${s.avalanche!.slide!.t.toFixed(1)} s`, "chase");
    run(s, 1.5);
    shoot(s, "carried 1.5 s", "chase");
    run(s, 2);
    shoot(s, "carried 3.5 s", "chase");
    for (let t = 0; t < 8 && phase() === "carried"; t += 1 / 60) run(s, 1 / 60);
    const card = (label: string) => {
      const since = buriedOf(s) ?? 0;
      shoot(
        s,
        label,
        "chase",
        h(DeathCard, { wreck: wreckOf(null, since), cause: "smothered", again: "top" }),
      );
    };
    card("buried");
    run(s, 1.5);
    card("buried 1.5 s, the card");
    run(s, 1.5);
    card("buried 3 s, going dark");
  },
  async plough() {
    const s = fresh();
    // Skiing down the fall line at 70 km/h into a slab let go below him:
    // taken as he meets it, carried down IN the snow, and buried.
    const n = { x: 0, y: 1, z: 0 };
    s.level.normalAt(face.x, face.z, n);
    const fall = Math.atan2(n.x, n.z);
    const up = 70;
    placeRun(s, {
      x: face.x - Math.sin(fall) * up,
      z: face.z - Math.cos(fall) * up,
      heading: fall,
      speed: 19,
    });
    const events: GameEvent[] = [];
    releaseAvalanche(s, s.avalanche!, face.x, face.z, events);
    const ride = { ...NEUTRAL_INPUT, tuck: 1 };
    run(s, 1, ride);
    shoot(s, "1 s, skiing down into it", "chase");
    const phase = () => s.avalanche?.victim?.phase ?? "free";
    for (let t = 0; t < 10 && phase() === "free"; t += 1 / 60) run(s, 1 / 60, ride);
    shoot(s, `taken at ${s.avalanche!.slide!.t.toFixed(1)} s`, "chase");
    run(s, 0.5);
    shoot(s, "carried 0.5 s", "chase");
    run(s, 1.5);
    shoot(s, "carried 2 s", "chase");
    run(s, 2);
    shoot(s, "carried 4 s", "chase");
    for (let t = 0; t < 8 && phase() === "carried"; t += 1 / 60) run(s, 1 / 60);
    shoot(s, "buried", "chase");
  },
  async night() {
    renderer.setSky({ hour: 21 });
    await renderer.shadeSettled();
    const { s, slide } = released();
    const k = slide.slab;
    run(s, 6);
    shoot(s, "6 s from beside", flowLens(slide, s, 25, 75, 28));
    for (let t = 0; t < 60 && slide.running; t += 1) run(s, 1);
    // The skier just below the deposit's toe, down the ground's own fall
    // line from it, facing its middle (its parcels past the slab), his
    // headlamp on it.
    const c = slide.cells;
    let dx = 0;
    let dz = 0;
    let dn = 0;
    for (let i = 0; i < slide.count; i++) {
      const x = c[i * CELL.stride + CELL.x];
      const z = c[i * CELL.stride + CELL.z];
      if ((x - k.x) * k.fx + (z - k.z) * k.fz < k.length) continue;
      dx += x;
      dz += z;
      dn++;
    }
    const lump = dn ? { x: dx / dn, z: dz / dn } : frontOf(slide, s).front;
    const n = { x: 0, y: 1, z: 0 };
    const toe = frontOf(slide, s).front;
    s.level.normalAt(toe.x, toe.z, n);
    const l = Math.hypot(n.x, n.z) || 1;
    const sx = toe.x + (n.x / l) * 10;
    const sz = toe.z + (n.z / l) * 10;
    const heading = Math.atan2(lump.x - sx, lump.z - sz);
    placeRun(s, { x: sx, z: sz, heading });
    run(s, 0.05);
    // A lens planted behind his shoulder, so it need not catch up.
    const bx = s.skier.x - Math.sin(heading) * 6;
    const bz = s.skier.z - Math.cos(heading) * 6;
    shoot(
      s,
      "the debris under the headlamp",
      lens(
        { x: bx, y: s.level.groundAt(bx, bz) + 3, z: bz },
        { x: lump.x, y: s.level.groundAt(lump.x, lump.z), z: lump.z },
        60,
      ),
    );
    renderer.setSky({ hour });
    await renderer.shadeSettled();
  },
};

Object.assign(
  VIEWS,
  rescueViews({
    fresh,
    face: () => face,
    safe: () => safe,
    play: run,
    shoot,
  }),
);

/** The HUD over a tile: drawn at the frame's own size and scaled to it,
 * with the HUD's colours (`styles.css`'s, which the harness does not load). */
function overlay(hud: ComponentChild, tw: number): HTMLElement {
  const box = document.createElement("div");
  box.style.cssText =
    `position:absolute;left:0;top:0;width:${width}px;height:${height}px;` +
    `transform:scale(${tw / width});transform-origin:0 0;overflow:hidden;` +
    "--hud-ink:#fff;--hud-plate:13 34 51;--hud-bad:#ff5a4e;" +
    "font:16px/1.2 system-ui,sans-serif;";
  render(hud, box);
  return box;
}

async function sheet(group: string, views: string[]): Promise<{ frames: Frame[]; costs: Cost[] }> {
  const note = await ready;
  frames = [];
  costs = [];
  for (const v of views) {
    const scene = VIEWS[v];
    if (!scene) throw new Error(`no view "${v}"`);
    view = v;
    await scene();
  }
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);
  sheetEl.style.gridTemplateColumns = `repeat(${cols}, ${tw}px)`;
  const header = document.createElement("header");
  header.textContent =
    `AVALANCHE — ${group} (${views.join(", ")}) — seed ${seed}${region ? ` ${region}` : ""}` +
    ` — hour ${hour} — ${tier}\n${note}`;
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
    cell.append(img);
    if (f.hud) cell.append(overlay(f.hud, tw));
    cell.append(caption);
    cells.push(cell);
  }
  sheetEl.replaceChildren(...cells);
  return { frames, costs };
}

window.__avalanche = { ready, groups: GROUPS, sheet };
