// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK EVAL LAB's page (driven by `scripts/rock-eval.mjs`): one map
// stood up and its ROCK drawn through the game's own renderer from a FIXED
// LIST OF SCENES — the same lenses whatever builds the rock, so two ways of
// building it can be laid side by side — and every scene priced: the frame
// with the rock and without it (`setHidden(["rocks"])`), so what the rock
// costs is read off the difference, the shadow pass included, beside what
// the scene walk bills to the `rocks` group.
//
// Every lens is a pure function of the map (where its rock lies, its
// cliffs, its mountain, its piste), never of a ride: nothing is stepped, so
// a scene is the same picture on every branch that draws the same map. The
// rock is laid off `rockShare` (the walls too steep for snow) and
// `cliffWalls` (the rocky cliffs) — the engine's, which a candidate may
// redraw but never moves, so the lenses stand where they stood.
//
// Beside the price, three readings a candidate is weighed by:
//   - the PHYSICS GAP: every drawn rock triangle within `GAP_REACH` m of the
//     lens, its corners and middle measured against the surface a body
//     meets there (`withRock`) — what is drawn is what is ridden;
//   - the SHIMMER: the lens slid a few centimetres a frame across a far
//     face, every pixel's mean second difference of brightness (the shimmer
//     lab's measure) — far rock that crawls and sparkles;
//   - the APPROACH: the lens walked in at the rockiest face from 800 m to
//     20 m, each step's change off the last — a tile swapping its cut is a
//     spike (a POP).

import {
  cliffWalls,
  createGame,
  isRegionId,
  loadRealFace,
  rockShare,
  withRock,
  type GameState,
  type Level,
  type RegionId,
  type WeatherKind,
} from "@engine";
import * as THREE from "three";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import {
  DEFAULT_VIDEO,
  TIERS,
  readPicture,
  withPreset,
  type Tier,
} from "../game/settings-video.ts";
import { setSkyClock } from "../game/sky-clock.ts";
import { setSummerLook } from "../game/season-look.ts";
import { volumeNoise } from "../game/cloud-volume.ts";

/** What one scene cost: the whole frame and the frame without the rock. ms
 * are a SOFTWARE rasterizer's (`--use-angle=swiftshader`) — comparable
 * between two builds on one machine, never a phone's. */
export type SceneCost = {
  ms: number;
  msBare: number;
  calls: number;
  callsBare: number;
  triangles: number;
  trianglesBare: number;
  /** Objects and triangles the scene walk bills to the `rocks` group in
   * the picture (no shadow pass). */
  rockObjects: number;
  rockTriangles: number;
  /** The renderer's own processor time for the world, ms, with and
   * without the rock. */
  worldMs: number;
  worldMsBare: number;
};

/** The drawn rock against the rock a body meets, m. */
export type Gap = { triangles: number; mean: number; p95: number; worst: number; over25: number };

/** What the rock is holding, off `rocks.ts`'s `userData.rockStats`. */
export type RockStats = {
  /** Every ms spent building rock since the map was stood up. */
  buildMs: number;
  /** Tiles in reach not yet at the cut they are owed. */
  owed: number;
  /** Triangles built and held, on screen or not. */
  triangles: number;
  /** Bytes of geometry (and anything else) the rock holds on the card. */
  bytes: number;
};

declare global {
  interface Window {
    __rocks?: {
      ready: Promise<{ loadMs: number; rockCells: number; cliffs: number; stats: RockStats }>;
      scenes(): string[];
      shoot(name: string): { note: string; settleMs: number; gap: Gap | null };
      cost(frames: number): SceneCost;
      stats(): RockStats;
      shimmer(name: string, frames: number, slide: number): number;
      approach(from: number, to: number, step: number): number[];
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const region = isRegionId(params.get("region")) ? (params.get("region") as RegionId) : undefined;
const face = params.get("face") || undefined;
const grade = (params.get("grade") || undefined) as "black" | undefined;
const summer = params.get("summer") === "1";
const quality = params.get("quality") ?? "";
const tier = (TIERS as readonly string[]).includes(quality) ? (quality as Tier) : "high";
const picture = readPicture(params.get("picture"));
const [width, height] = [Number(params.get("w") ?? 1280), Number(params.get("h") ?? 720)];
const hour = Number(params.get("hour") ?? 11);
const weather = (params.get("weather") ?? "clear") as WeatherKind;

const canvas = document.getElementById("stage") as HTMLCanvasElement;
Object.assign(canvas.style, { width: `${width}px`, height: `${height}px` });
const label = document.getElementById("label") as HTMLDivElement;

if (face) await loadRealFace(face);
setSummerLook(summer);
await loadModels();
const renderer = createWorldRenderer(canvas, {
  video: { ...withPreset(DEFAULT_VIDEO, tier), ...picture },
  preserveDrawingBuffer: true,
});
renderer.resize(width, height, 1);
const state: GameState = createGame({
  seed,
  region,
  face,
  grade,
  summer,
  mode: "free",
  rivals: 0,
  crowd: 0,
  quiet: true,
  sky: { hour, weather },
});
renderer.setSky({ hour, weather });
setSkyClock(0);

const FRAME = 1 / 60;
const level = state.level;
/** The map under the rock (what it is laid off) and the map with it (what
 * a body meets). */
const bed: Level = level.bedrock ?? level;
const ridden: Level = withRock(level);
const still = () => renderer.draw(state, 0, FRAME, true);

/** Rock on a 12 m lattice: each cell's share (`rockShare`), and its point. */
const STEP = 12;
const N = Math.floor(bed.size / STEP);
const share = new Float32Array(N * N);
let rockCells = 0;
for (let j = 0; j < N; j++)
  for (let i = 0; i < N; i++) {
    const s = rockShare(bed, (i + 0.5) * STEP, (j + 0.5) * STEP);
    share[j * N + i] = s;
    if (s > 0.15) rockCells++;
  }
const at = (i: number, j: number) => ({ x: (i + 0.5) * STEP, z: (j + 0.5) * STEP });

/** The way the ground falls at a point, a unit vector in plan. */
function downhill(x: number, z: number): { x: number; z: number } {
  const n = { x: 0, y: 1, z: 0 };
  bed.normalAt(x, z, n);
  const l = Math.hypot(n.x, n.z) || 1;
  return { x: n.x / l, z: n.z / l };
}

/** THE ROCKIEST FACE: the 60 m patch with the most of its ground in the
 * rock skin (the shimmer lab's), and the way it falls. */
const rockiest = (() => {
  let best = { i: N >> 1, j: N >> 1, sum: -1 };
  const r = 2;
  for (let j = r; j < N - r; j++)
    for (let i = r; i < N - r; i++) {
      let sum = 0;
      for (let dj = -r; dj <= r; dj++)
        for (let di = -r; di <= r; di++) sum += share[(j + dj) * N + i + di];
      if (sum > best.sum) best = { i, j, sum };
    }
  return at(best.i, best.j);
})();
const fall = { x: rockiest.x, z: rockiest.z };
const { x: fx, z: fz } = downhill(fall.x, fall.z);

/** Whether the line from `e` to `t` clears the snow by half a metre. */
function sees(
  e: { x: number; y: number; z: number },
  t: { x: number; y: number; z: number },
): boolean {
  for (let k = 1; k < 32; k++) {
    const u = k / 32;
    const x = e.x + (t.x - e.x) * u;
    const z = e.z + (t.z - e.z) * u;
    if (ridden.groundAt(x, z) + 0.5 > e.y + (t.y - e.y) * u) return false;
  }
  return true;
}

/** The rockiest face from `off` m out along the way it falls, `high` m
 * over the snow there — lifted until it sees the face over any rise. */
function faceView(off: number, high: number, fov: number): LensPose {
  const ex = fall.x + fx * off;
  const ez = fall.z + fz * off;
  const target = { x: fall.x, y: bed.groundAt(fall.x, fall.z) + 4, z: fall.z };
  let eye = { x: ex, y: ridden.groundAt(ex, ez) + high, z: ez };
  for (let k = 0; k < 20 && !sees(eye, target); k++) eye = { ...eye, y: eye.y + 5 };
  return { eye, target, fov, roll: 0 };
}

/** The highest rock on the map from 120 m under it, a skier's eye — the
 * crag's edge against the sky. */
function skylineView(): LensPose {
  let best = at(N >> 1, N >> 1);
  let top = -Infinity;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      if (share[j * N + i] < 0.5) continue;
      const p = at(i, j);
      const y = bed.groundAt(p.x, p.z);
      if (y > top) {
        top = y;
        best = p;
      }
    }
  const d = downhill(best.x, best.z);
  const ex = best.x + d.x * 120;
  const ez = best.z + d.z * 120;
  return {
    eye: { x: ex, y: ridden.groundAt(ex, ez) + 1.8, z: ez },
    target: { x: best.x, y: top + 6, z: best.z },
    fov: 55,
    roll: 0,
  };
}

/** The tallest rocky cliff's wall from 28 m in front of it, a skier's eye
 * on the snow below — or null on a map that lays none. */
function cliffView(): LensPose | null {
  const walls = cliffWalls(level);
  if (!walls.length) return null;
  let best = walls[0];
  let tallest = -1;
  for (const w of walls) {
    const lip = w.pos[(1 * w.cols + (w.cols >> 1)) * 3 + 1];
    const foot = w.pos[((w.rows - 1) * w.cols + (w.cols >> 1)) * 3 + 1];
    if (lip - foot > tallest) {
      tallest = lip - foot;
      best = w;
    }
  }
  const mid = ((best.rows >> 1) * best.cols + (best.cols >> 1)) * 3;
  const tx = best.pos[mid];
  const ty = best.pos[mid + 1];
  const tz = best.pos[mid + 2];
  const ex = tx + Math.sin(best.heading) * 28;
  const ez = tz + Math.cos(best.heading) * 28;
  return {
    eye: { x: ex, y: ridden.groundAt(ex, ez) + 1.8, z: ez },
    target: { x: tx, y: ty, z: tz },
    fov: 60,
    roll: 0,
  };
}

/** On the piste where it passes nearest the rockiest face, a skier's eye
 * looking at the face — the rock as a run past it sees it. */
function pisteView(): LensPose {
  const pts = level.track.points;
  let best = pts[0];
  let near = Infinity;
  for (const p of pts) {
    const d = Math.hypot(p.x - fall.x, p.z - fall.z);
    if (d < near) {
      near = d;
      best = p;
    }
  }
  return {
    eye: { x: best.x, y: ridden.groundAt(best.x, best.z) + 1.8, z: best.z },
    target: { x: fall.x, y: bed.groundAt(fall.x, fall.z) + 4, z: fall.z },
    fov: 62,
    roll: 0,
  };
}

/** 150 m over the rockiest face and 200 m out from it, looking down — the
 * crags as the helicopter, the plane and the paramotor see them. */
function aerialView(): LensPose {
  const ex = fall.x + fx * 200;
  const ez = fall.z + fz * 200;
  const y = bed.groundAt(fall.x, fall.z);
  return {
    eye: { x: ex, y: Math.max(y + 150, ridden.groundAt(ex, ez) + 60), z: ez },
    target: { x: fall.x, y, z: fall.z },
    fov: 60,
    roll: 0,
  };
}

/** From the valley floor up the face toward the rockiest crag. */
function valleyView(): LensPose {
  const b = level.mountain?.base ?? { x: bed.size / 2, z: bed.size * 0.92 };
  return {
    eye: { x: b.x, y: ridden.groundAt(b.x, b.z) + 2, z: b.z },
    target: { x: fall.x, y: bed.groundAt(fall.x, fall.z), z: fall.z },
    fov: 55,
    roll: 0,
  };
}

/** THE SCENES, in order. Each returns its lens. The face's field of view
 * narrows with range so the crag fills about as much of the frame. */
const SCENES: Record<string, () => LensPose | null> = {
  foot: () => faceView(14, 1.8, 70),
  "face-40": () => faceView(40, 2, 62),
  "face-150": () => faceView(150, 6, 45),
  "face-400": () => faceView(400, 20, 28),
  "face-1200": () => faceView(1200, 40, 12),
  skyline: skylineView,
  cliff: cliffView,
  piste: pisteView,
  aerial: aerialView,
  valley: valleyView,
};
const NOTES: Record<string, string> = {
  foot: "at the foot of the rockiest face, 14 m out, a skier's eye",
  "face-40": "the rockiest face from 40 m",
  "face-150": "the rockiest face from 150 m",
  "face-400": "the rockiest face from 400 m",
  "face-1200": "the rockiest face from 1200 m (the far cut)",
  skyline: "the highest rock against the sky, from 120 m under it",
  cliff: "the tallest rocky cliff's wall from 28 m",
  piste: "from the piste where it passes nearest the rockiest face",
  aerial: "150 m over the rockiest face, 200 m out",
  valley: "from the valley floor up toward the crags",
};

/** What the rock holds, off `rocks.ts`'s stats (zero where none). */
function stats(): RockStats {
  const s = renderer.group("rocks")?.userData.rockStats as RockStats | undefined;
  return s ? { ...s } : { buildMs: 0, owed: 0, triangles: 0, bytes: 0 };
}

/** Draw until every tile in reach is built at its cut (at most `most`
 * frames), and the ms it took. */
function settle(most = 600): number {
  const t0 = performance.now();
  for (let i = 0; i < 3; i++) still();
  for (let i = 0; i < most && stats().owed > 0; i++) still();
  for (let i = 0; i < 2; i++) still();
  return performance.now() - t0;
}

/** Within this of the lens the drawn rock is held to the ridden. */
const GAP_REACH = 250;

/** THE PHYSICS GAP: every drawn rock triangle within `GAP_REACH` m of the
 * lens, read at its corners and middle against the surface a body meets
 * there. A rock drawn in the shader alone (no triangles under `rocks`)
 * reads none, and says so. */
function gap(eye: { x: number; y: number; z: number }): Gap | null {
  const root = renderer.group("rocks");
  if (!root) return null;
  const errs: number[] = [];
  const p = new THREE.Vector3();
  const pts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || (mesh as THREE.InstancedMesh).isInstancedMesh) return;
    const pos = mesh.geometry.getAttribute("position");
    if (!pos) return;
    const index = mesh.geometry.index;
    const count = index ? index.count : pos.count;
    for (let t = 0; t + 2 < count; t += 3) {
      for (let k = 0; k < 3; k++) {
        const v = index ? index.getX(t + k) : t + k;
        pts[k].fromBufferAttribute(pos, v).applyMatrix4(mesh.matrixWorld);
      }
      p.copy(pts[0])
        .add(pts[1])
        .add(pts[2])
        .multiplyScalar(1 / 3);
      if (Math.hypot(p.x - eye.x, p.z - eye.z) > GAP_REACH) continue;
      for (const q of [p, ...pts]) errs.push(Math.abs(q.y - ridden.groundAt(q.x, q.z)));
    }
  });
  if (!errs.length) return null;
  errs.sort((a, b) => a - b);
  const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
  return {
    triangles: errs.length / 4,
    mean,
    p95: errs[Math.floor(errs.length * 0.95)],
    worst: errs[errs.length - 1],
    over25: errs.filter((e) => e > 0.25).length / errs.length,
  };
}

function shoot(name: string): { note: string; settleMs: number; gap: Gap | null } {
  const scene = SCENES[name];
  if (!scene) throw new Error(`no scene "${name}" — known: ${Object.keys(SCENES).join(", ")}`);
  const pose = scene();
  if (!pose) {
    label.textContent = `${name.toUpperCase()} · none on this map`;
    renderer.setOverride(null);
    return { note: "none on this map", settleMs: 0, gap: null };
  }
  renderer.setOverride(pose);
  const settleMs = settle();
  const note = NOTES[name];
  label.textContent = `${name.toUpperCase()} · seed ${seed} · ${face ?? region ?? "alpine"}${summer ? " · summer" : ""} · ${hour}:00 ${weather} · ${note}`;
  return { note, settleMs, gap: gap(pose.eye) };
}

/** Waits for the GPU: a pixel read back blocks until every draw before it
 * is done, which `gl.finish` does not promise. */
const pixel = new Uint8Array(4);
function sync(): void {
  const gl = renderer.gl.getContext();
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
}

function timed(frames: number): { ms: number; calls: number; triangles: number; worldMs: number } {
  still();
  sync();
  let world = 0;
  const t0 = performance.now();
  for (let i = 0; i < frames; i++) {
    still();
    world += renderer.cost().worldMs;
    sync();
  }
  const ms = (performance.now() - t0) / frames;
  const c = renderer.cost();
  return { ms, calls: c.calls, triangles: c.triangles, worldMs: world / frames };
}

/** The scene priced: two rounds of `frames` frames with the rock and
 * without it, interleaved so a slow spell lands on both, each side's
 * quickest round kept. */
function cost(frames: number): SceneCost {
  let all = timed(frames);
  let bare = all;
  for (let round = 0; round < 2; round++) {
    renderer.setHidden([]);
    const a = timed(frames);
    if (round === 0 || a.ms < all.ms) all = { ...a, worldMs: Math.min(a.worldMs, all.worldMs) };
    renderer.setHidden(["rocks"]);
    const b = timed(frames);
    if (round === 0 || b.ms < bare.ms) bare = { ...b, worldMs: Math.min(b.worldMs, bare.worldMs) };
  }
  renderer.setHidden([]);
  still();
  const tally = renderer.sceneTally().find((s) => s.name === "rocks");
  return {
    ms: all.ms,
    msBare: bare.ms,
    calls: all.calls,
    callsBare: bare.calls,
    triangles: all.triangles,
    trianglesBare: bare.triangles,
    rockObjects: tally?.objects ?? 0,
    rockTriangles: tally?.triangles ?? 0,
    worldMs: all.worldMs,
    worldMsBare: bare.worldMs,
  };
}

/** The canvas read back at a quarter size, as luminance 0..1. */
function sample(): Float32Array {
  const gl = renderer.gl.getContext();
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const sw = Math.floor(w / 4);
  const sh = Math.floor(h / 4);
  const o = new Float32Array(sw * sh);
  for (let j = 0; j < sh; j++)
    for (let i = 0; i < sw; i++) {
      const k = (j * 4 * w + i * 4) * 4;
      o[j * sw + i] = (0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2]) / 255;
    }
  return o;
}

/** THE SHIMMER of scene `name`: the lens slid `slide` m a frame across
 * the look for `frames` frames, every pixel's mean second difference of
 * brightness, ×1000 (the shimmer lab's FLICKER). */
function shimmer(name: string, frames: number, slide: number): number {
  const pose = SCENES[name]?.();
  if (!pose) return 0;
  const dx = pose.target.x - pose.eye.x;
  const dz = pose.target.z - pose.eye.z;
  const l = Math.hypot(dx, dz) || 1;
  const sx = dz / l;
  const sz = -dx / l;
  const reads: Float32Array[] = [];
  for (let k = 0; k < frames; k++) {
    const eye = { ...pose.eye, x: pose.eye.x + sx * slide * k, z: pose.eye.z + sz * slide * k };
    renderer.setOverride({ ...pose, eye });
    still();
    reads.push(sample());
  }
  let sum = 0;
  let n = 0;
  for (let k = 1; k + 1 < reads.length; k++)
    for (let i = 0; i < reads[k].length; i++) {
      sum += Math.abs(reads[k + 1][i] - 2 * reads[k][i] + reads[k - 1][i]);
      n++;
    }
  return n ? (1000 * sum) / n : 0;
}

/** The lens walked in at the rockiest face from `from` m to `to` m in
 * `step` m steps, each frame's mean change off the last (a POP is a
 * spike) — the rock built whole at every step, so only a cut swapping
 * shows. */
function approach(from: number, to: number, stepM: number): number[] {
  const o: number[] = [];
  let last: Float32Array | null = null;
  for (let d = from; d >= to; d -= stepM) {
    renderer.setOverride(faceView(d, 6 + d * 0.03, Math.max(14, Math.min(60, 7000 / d))));
    settle(200);
    const now = sample();
    if (last) {
      let sum = 0;
      for (let i = 0; i < now.length; i++) sum += Math.abs(now[i] - last[i]);
      o.push((255 * sum) / now.length);
    }
    last = now;
  }
  return o;
}

const t0 = performance.now();
window.__rocks = {
  ready: renderer.load(state).then(async () => {
    await volumeNoise();
    return {
      loadMs: performance.now() - t0,
      rockCells,
      cliffs: cliffWalls(level).length,
      stats: stats(),
    };
  }),
  scenes: () => Object.keys(SCENES),
  shoot,
  cost,
  stats,
  shimmer,
  approach,
};
