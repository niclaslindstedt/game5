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
//   caught   a skier crossing the slab when it goes, from the chase;
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
  type Slide,
  type WeatherKind,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import type { CameraRung } from "../game/renderer-api.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";

type Frame = { view: string; label: string; caption: string; png: string };
type Lens = CameraRung | LensPose;
type Cost = { label: string; ms: number; calls: number; triangles: number; geometries: number };

const GROUPS: Record<string, readonly string[]> = {
  release: ["release"],
  flow: ["beside", "below"],
  debris: ["debris"],
  caught: ["caught"],
  night: ["night"],
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
const seed = Number(params.get("seed") ?? 12);
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

function fresh(): GameState {
  return createGame({
    level: map,
    seed,
    region,
    mode: "free",
    snowDepth: dial,
    crowd: 0,
    groomer: "off",
    avalanche: true,
    quiet: true,
  });
}

/** THE FACE: the open, loaded slope off the runs that breaks into the
 * biggest slab — its width across times its run down the fall line, both
 * probed as the engine sizes a slab (a point is slab while its hazard
 * stands above none) — with room below it on the map for the flow. */
function pickFace(s: GameState): { x: number; z: number } {
  if (forced.length === 2 && forced.every(Number.isFinite)) return { x: forced[0], z: forced[1] };
  const lv = s.level;
  const n = { x: 0, y: 1, z: 0 };
  const on = (x: number, z: number) =>
    x > 20 && z > 20 && x < lv.size - 20 && z < lv.size - 20 && avalancheHazard(lv, 1, x, z) > 0;
  // A face turned to the sheets' sun reads; one in its own shade does not.
  const sun = sunAtRun({ sun: { ...lv.sun, hour } });
  const sx = Math.sin(sun.azimuth);
  const sz = Math.cos(sun.azimuth);
  let best = { x: lv.size / 2, z: lv.size / 2 };
  let score = -Infinity;
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
      const lit = 0.35 + 0.65 * Math.max(0, fx * sx + fz * sz);
      const sc =
        (Math.min(down, 140) * Math.min(across, 80) ** 2 * (0.5 + h) * lit) /
        (1 + (ease - down) / 150);
      if (sc > score) {
        score = sc;
        best = { x, z };
      }
    }
  }
  return best;
}

let face = { x: 0, z: 0 };
/** A safe place to stand the skier the planted views do not follow: the
 * start line, on the groomed piste. */
let safe = { x: 0, z: 0, heading: 0 };
const ready = (async () => {
  const first = fresh();
  face = pickFace(first);
  safe = { x: first.skier.x, z: first.skier.z, heading: first.skier.heading };
  await renderer.load(first);
  renderer.setSky({ hour });
  renderer.draw(first, 1, FRAME);
  await renderer.shadeSettled();
  const h = avalancheHazard(first.level, first.avalanche?.load ?? 0, face.x, face.z);
  return (
    `face at ${face.x.toFixed(0)}, ${face.z.toFixed(0)} — hazard ${h.toFixed(2)} at the run's ` +
    `load ${(first.avalanche?.load ?? 0).toFixed(2)} (snow dial ${dial})`
  );
})();

let frames: Frame[] = [];
let costs: Cost[] = [];
let view = "";

function run(s: GameState, seconds: number): void {
  const n = Math.round(seconds / FRAME);
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < STEPS; i++) step(s, NEUTRAL_INPUT);
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
  return {
    front: { x: fx, y: s.level.groundAt(fx, fz), z: fz, v: far },
    middle: { x: mx, y: s.level.groundAt(mx, mz), z: mz },
  };
}

function lens(
  eye: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  fov = 55,
): LensPose {
  return { eye, target, fov, roll: 0 };
}

function shoot(s: GameState, label: string, l: Lens): void {
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
    // Off the slab past its left flank, a few metres below the crown,
    // looking up across it: the crown's wall and the flank side on.
    const close = lens(
      slabAt(slide, s, k.left + 7, 12, 2.4),
      slabAt(slide, s, mid - 2, 0, -k.depth),
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
      [0.5, "0.5"],
      [0.5, "1.0"],
      [1, "2.0"],
    ] as const) {
      run(s, dt);
      shoot(s, `${t} s`, far);
    }
    shoot(s, "2.0 s, at the crown", close);
  },
  async beside() {
    const { s, slide } = released();
    const k = slide.slab;
    let t = 0;
    for (const at of [3, 6, 10, 15]) {
      run(s, at - t);
      t = at;
      const { front } = frontOf(slide, s);
      // Off its left side, a little ahead of the front and over it,
      // looking back across the flow and up its track.
      const eye = slabAt(slide, s, k.left + 90, front.v + 20, 45);
      shoot(s, `${at} s from beside`, lens(eye, { ...front, y: front.y + 3 }, 55));
    }
  },
  async below() {
    const { s, slide } = released();
    const k = slide.slab;
    let t = 0;
    for (const at of [3, 6, 10, 15]) {
      run(s, at - t);
      t = at;
      const { front } = frontOf(slide, s);
      const eye = slabAt(slide, s, (k.left - k.right) / 2 + 30, front.v + 120, 35);
      shoot(s, `${at} s from below`, lens(eye, { ...front, y: front.y + 4 }, 55));
    }
  },
  async debris() {
    const { s, slide } = released();
    // To rest (`AVALANCHE.runMost` at the most).
    for (let t = 0; t < 60 && slide.running; t += 1) run(s, 1);
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
      lens(slabAt(slide, s, lu + 9, lv - 12, 2.5), { x: lump.x, y: ly + 1, z: lump.z }, 60),
    );
    shoot(
      s,
      "the toe",
      lens(slabAt(slide, s, lu + 6, front.v + 22, 12), { x: lump.x, y: ly + 1, z: lump.z }, 60),
    );
    shoot(
      s,
      "far, across",
      lens(slabAt(slide, s, k.left + 120, lv - 60, 70), slabAt(slide, s, lu, lv - 40, 0), 50),
    );
    shoot(
      s,
      "the bed and the crown from below",
      lens(slabAt(slide, s, 10, 45, 2), slabAt(slide, s, -5, 0, -k.depth), 55),
    );
  },
  async caught() {
    const s = fresh();
    // Stood on the slope's middle, crossing it at 15 km/h.
    const n = { x: 0, y: 1, z: 0 };
    s.level.normalAt(face.x, face.z, n);
    const fall = Math.atan2(n.x, n.z);
    placeRun(s, { x: face.x, z: face.z, heading: fall + Math.PI / 2, speed: 4.2 });
    run(s, 0.2);
    const events: GameEvent[] = [];
    releaseAvalanche(s, s.avalanche!, s.skier.x, s.skier.z, events);
    shoot(s, "0.0 s, the slab goes under him", "chase");
    for (const [dt, t] of [
      [1.5, "1.5"],
      [2, "3.5"],
      [3, "6.5"],
    ] as const) {
      run(s, dt);
      shoot(s, `${t} s`, "chase");
    }
    for (let t = 0; t < 60 && s.avalanche?.slide?.running; t += 1) run(s, 1);
    shoot(s, "at rest", "chase");
  },
  async night() {
    renderer.setSky({ hour: 21 });
    await renderer.shadeSettled();
    const { s, slide } = released();
    const k = slide.slab;
    run(s, 6);
    const { front } = frontOf(slide, s);
    shoot(
      s,
      "6 s from beside",
      lens(slabAt(slide, s, k.left + 90, front.v + 20, 45), { ...front, y: front.y + 3 }, 55),
    );
    for (let t = 0; t < 60 && slide.running; t += 1) run(s, 1);
    // The skier at the deposit's toe, his headlamp on it.
    const { front: toe } = frontOf(slide, s);
    const heading = Math.atan2(-k.fx, -k.fz);
    placeRun(s, { x: toe.x + k.fx * 14, z: toe.z + k.fz * 14, heading });
    run(s, 0.3);
    shoot(s, "the debris under the headlamp", "chase");
    renderer.setSky({ hour });
    await renderer.shadeSettled();
  },
};

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
    cell.append(img, caption);
    cells.push(cell);
  }
  sheetEl.replaceChildren(...cells);
  return { frames, costs };
}

window.__avalanche = { ready, groups: GROUPS, sheet };
