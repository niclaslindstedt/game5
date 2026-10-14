// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREES EVAL LAB's page (driven by `scripts/tree-eval.mjs`): one map
// stood up and its woods drawn through the game's own renderer from a FIXED
// LIST OF SCENES — the same lenses whatever builds the trees, so two ways of
// building a forest can be laid side by side — and every scene priced: the
// frame with the woods and without them (`setHidden(["forest"])`), so what
// the forest costs is read off the difference, the shadow pass included,
// beside what the scene walk bills to the `forest` group.
//
// Every lens is a pure function of the map (where its trees stand, its
// mountain, its piste), never of a ride: nothing is stepped, so a scene is
// the same picture on every branch that draws the same map.

import {
  createGame,
  isRegionId,
  type GameState,
  type RegionId,
  type TreeDef,
  type WeatherKind,
} from "@engine";

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
import { volumeNoise } from "../game/cloud-volume.ts";

/** What one scene cost: the whole frame, the frame without the woods, and
 * the woods' own share by the scene walk. ms are a SOFTWARE rasterizer's
 * (`--use-angle=swiftshader`) — comparable between two builds on one
 * machine, never a phone's. */
export type SceneCost = {
  ms: number;
  msBare: number;
  calls: number;
  callsBare: number;
  triangles: number;
  trianglesBare: number;
  /** Objects and triangles the scene walk bills to the `forest` group in
   * the picture (no shadow pass), and the instances it draws. */
  forestObjects: number;
  forestTriangles: number;
  /** The renderer's own processor time for the world (the woods culled
   * among it), ms, with and without the woods. */
  worldMs: number;
  worldMsBare: number;
};

declare global {
  interface Window {
    __trees?: {
      ready: Promise<{ trees: number; loadMs: number; forestBytes: number; geometries: number }>;
      scenes(): string[];
      shoot(name: string): string;
      cost(frames: number): SceneCost;
      /** The lens walked in toward the densest wood from `from` m to `to` m
       * in `step` m steps, each frame's mean change off the last one (a POP
       * is a spike) — sampled at 1/4 of the canvas. */
      approach(from: number, to: number, step: number): number[];
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const region = isRegionId(params.get("region")) ? (params.get("region") as RegionId) : undefined;
const quality = params.get("quality") ?? "";
const tier = (TIERS as readonly string[]).includes(quality) ? (quality as Tier) : "high";
const picture = readPicture(params.get("picture"));
const [width, height] = [Number(params.get("w") ?? 1280), Number(params.get("h") ?? 720)];
const hour = Number(params.get("hour") ?? 11);
const weather = (params.get("weather") ?? "clear") as WeatherKind;

const canvas = document.getElementById("stage") as HTMLCanvasElement;
Object.assign(canvas.style, { width: `${width}px`, height: `${height}px` });
const label = document.getElementById("label") as HTMLDivElement;

await loadModels();
const renderer = createWorldRenderer(canvas, {
  video: { ...withPreset(DEFAULT_VIDEO, tier), ...picture },
  preserveDrawingBuffer: true,
});
renderer.resize(width, height, 1);
const state: GameState = createGame({ seed, region, rivals: 0, sky: { hour, weather } });
renderer.setSky({ hour, weather });
setSkyClock(0);

const FRAME = 1 / 60;
const level = state.level;
const trees = level.trees;
const still = () => renderer.draw(state, 0, FRAME, true);

/** Trees a 16 m cell, for finding the densest stands without a pass of
 * every tree against every tree. */
const CELL = 16;
const cells = new Map<number, TreeDef[]>();
const key = (i: number, j: number) => i * 4096 + j;
for (const t of trees) {
  const k = key(Math.floor(t.x / CELL), Math.floor(t.z / CELL));
  const list = cells.get(k);
  if (list) list.push(t);
  else cells.set(k, [t]);
}
/** Trees within `r` m of a point. */
function near(x: number, z: number, r: number): TreeDef[] {
  const out: TreeDef[] = [];
  const n = Math.ceil(r / CELL);
  const ci = Math.floor(x / CELL);
  const cj = Math.floor(z / CELL);
  for (let i = ci - n; i <= ci + n; i++)
    for (let j = cj - n; j <= cj + n; j++)
      for (const t of cells.get(key(i, j)) ?? [])
        if ((t.x - x) ** 2 + (t.z - z) ** 2 < r * r) out.push(t);
  return out;
}

/** The downhill way at a point, a unit vector in plan. */
function downhill(x: number, z: number): { x: number; z: number } {
  const n = { x: 0, y: 1, z: 0 };
  level.normalAt(x, z, n);
  const l = Math.hypot(n.x, n.z) || 1;
  return { x: n.x / l, z: n.z / l };
}

/** The tree at the heart of the densest stand (of the trees that `pick`
 * lets through). */
function densest(pick: (t: TreeDef) => boolean = () => true): TreeDef {
  let best = trees[0];
  let most = -1;
  for (const [, list] of cells) {
    const t = list[0];
    if (!pick(t)) continue;
    const n = near(t.x, t.z, 20).length;
    if (n > most) {
      most = n;
      best = t;
    }
  }
  return best;
}

/** Whether the line from `e` to `t` clears the snow by half a metre. */
function sees(
  e: { x: number; y: number; z: number },
  t: { x: number; y: number; z: number },
): boolean {
  for (let k = 1; k < 24; k++) {
    const u = k / 24;
    const x = e.x + (t.x - e.x) * u;
    const z = e.z + (t.z - e.z) * u;
    if (level.groundAt(x, z) + 0.5 > e.y + (t.y - e.y) * u) return false;
  }
  return true;
}

/** The densest wood from `distance` m out, at head height, from the
 * bearing with the fewest trees in the way that still SEES the stand over
 * the snow (a rise between them would show sky). */
function edgeView(distance: number, heart = densest()): LensPose {
  const target = { x: heart.x, y: heart.y + 5, z: heart.z };
  let best: LensPose | null = null;
  let fewest = Infinity;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
    const ex = heart.x + Math.sin(a) * distance;
    const ez = heart.z + Math.cos(a) * distance;
    const eye = { x: ex, y: level.groundAt(ex, ez) + 2.2, z: ez };
    const blocking = near(
      heart.x + Math.sin(a) * distance * 0.6,
      heart.z + Math.cos(a) * distance * 0.6,
      Math.max(6, distance * 0.35),
    ).length;
    const score = blocking + (sees(eye, target) ? 0 : 1e6);
    if (score < fewest) {
      fewest = score;
      best = { eye, target, fov: 62, roll: 0 };
    }
  }
  return best as LensPose;
}

/** Stood IN the densest stand, at the most open spot within 14 m of its
 * heart, looking the way the most trees stand within 35 m. */
function insideView(): LensPose {
  const heart = densest();
  let at = { x: heart.x, z: heart.z };
  let room = -Infinity;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12)
    for (const r of [0, 3, 6, 9, 12, 14]) {
      const x = heart.x + Math.sin(a) * r;
      const z = heart.z + Math.cos(a) * r;
      const c = Math.min(
        ...near(x, z, 8).map((t) => Math.hypot(t.x - x, t.z - z) - 0.85 * t.crown),
        2.5,
      );
      // Room for the lens, but still among the trees.
      const among = near(x, z, 15).length;
      const score = Math.min(c, 2.5) * 10 + among;
      if (c > 0.3 && score > room) {
        room = score;
        at = { x, z };
      }
    }
  const eye = { x: at.x, y: level.groundAt(at.x, at.z) + 1.8, z: at.z };
  let look = 0;
  let most = -Infinity;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    const n = near(at.x + Math.sin(a) * 18, at.z + Math.cos(a) * 18, 14).length;
    // A crown within 7 m inside the view's middle is a green wall, not a
    // wood: each costs the bearing more than the trees it shows.
    let walls = 0;
    for (const t of near(at.x, at.z, 7)) {
      const off = Math.atan2(t.x - at.x, t.z - at.z) - a;
      if (Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) < 0.6) walls++;
    }
    if (n - 8 * walls > most) {
      most = n - 8 * walls;
      look = a;
    }
  }
  const tx = at.x + Math.sin(look) * 35;
  const tz = at.z + Math.cos(look) * 35;
  return {
    eye,
    target: { x: tx, y: Math.max(level.groundAt(tx, tz) + 3, eye.y - 1), z: tz },
    fov: 70,
    roll: 0,
  };
}

/** On the piste where the most trees stand within 45 m of it, a skier's
 * eye looking down it — the woods as a race sees them. */
function pisteView(): LensPose {
  const pts = level.track.points;
  let best = pts[Math.floor(pts.length / 2)];
  let most = -1;
  for (let i = 10; i < pts.length - 30; i += 8) {
    const n = near(pts[i].x, pts[i].z, 45).length;
    if (n > most) {
      most = n;
      best = pts[i];
    }
  }
  const ahead = pts[Math.min(pts.length - 1, pts.indexOf(best) + 25)];
  return {
    eye: { x: best.x, y: level.groundAt(best.x, best.z) + 2.4, z: best.z },
    target: { x: ahead.x, y: level.groundAt(ahead.x, ahead.z) + 1, z: ahead.z },
    fov: 68,
    roll: 0,
  };
}

/** Over the highest trees — the tree line and the krummholz under it —
 * from 50 m up the slope, looking down across them. */
function treelineView(): LensPose {
  const sorted = [...trees].sort((a, b) => b.y - a.y);
  const top = sorted[Math.floor(sorted.length * 0.03)] ?? sorted[0];
  const d = downhill(top.x, top.z);
  const ex = top.x - d.x * 30;
  const ez = top.z - d.z * 30;
  const tx = top.x + d.x * 60;
  const tz = top.z + d.z * 60;
  return {
    eye: { x: ex, y: level.groundAt(ex, ez) + 4, z: ez },
    target: { x: tx, y: level.groundAt(tx, tz) + 1, z: tz },
    fov: 62,
    roll: 0,
  };
}

/** The mountain's base and summit (the map's own, or its middle). */
const mountain = level.mountain ?? {
  summit: {
    x: level.size / 2,
    z: level.size * 0.08,
    y: level.groundAt(level.size / 2, level.size * 0.08),
  },
  base: {
    x: level.size / 2,
    z: level.size * 0.92,
    y: level.groundAt(level.size / 2, level.size * 0.92),
  },
  vertical: 600,
};

/** From the valley floor up the wooded face: the woods from 300 m to a
 * couple of kilometres, every band and the ground's tint past them. */
function valleyView(): LensPose {
  const b = mountain.base;
  const s = mountain.summit;
  const tx = b.x + (s.x - b.x) * 0.45;
  const tz = b.z + (s.z - b.z) * 0.45;
  return {
    eye: { x: b.x, y: level.groundAt(b.x, b.z) + 2, z: b.z },
    target: { x: tx, y: level.groundAt(tx, tz), z: tz },
    fov: 60,
    roll: 0,
  };
}

/** The densest wood from 600 m off and 250 m up — the woods as a far
 * lens and the ranges across the valley see them. */
function farView(): LensPose {
  const heart = densest();
  const d = downhill(heart.x, heart.z);
  const ex = heart.x + d.x * 600;
  const ez = heart.z + d.z * 600;
  return {
    eye: { x: ex, y: Math.max(level.groundAt(ex, ez), heart.y) + 250, z: ez },
    target: { x: heart.x, y: heart.y, z: heart.z },
    fov: 55,
    roll: 0,
  };
}

/** 140 m over the densest wood and 180 m off it, looking down into it —
 * the woods as the helicopter, the plane and the paramotor see them. */
function aerialView(): LensPose {
  const heart = densest();
  const d = downhill(heart.x, heart.z);
  const ex = heart.x + d.x * 180;
  const ez = heart.z + d.z * 180;
  return {
    eye: { x: ex, y: heart.y + 140, z: ez },
    target: { x: heart.x, y: heart.y, z: heart.z },
    fov: 60,
    roll: 0,
  };
}

/** The densest stand of a broadleaf or a pine, if the map grows one, from
 * 22 m — the kinds that are not the spire. */
function kindView(kinds: readonly string[]): LensPose | null {
  const pick = (t: TreeDef) => kinds.includes(t.kind ?? "spruce");
  if (!trees.some(pick)) return null;
  return edgeView(22, densest(pick));
}

/** THE SCENES, in order. Each returns its note and leaves the lens set. */
const SCENES: Record<string, () => LensPose | null> = {
  inside: insideView,
  edge: () => edgeView(34),
  close: () => edgeView(12),
  piste: pisteView,
  treeline: treelineView,
  valley: valleyView,
  far: farView,
  aerial: aerialView,
  pines: () => kindView(["pine", "stonepine", "lodgepole", "whitepine", "dwarfpine"]),
  broadleaf: () =>
    kindView(["birch", "aspen", "rowan", "beech", "alder", "willow", "maple", "ash", "larch"]),
};
const NOTES: Record<string, string> = {
  inside: "stood in the densest stand, eye 1.8 m, looking where the most trees stand",
  edge: "the densest wood from 34 m of open snow",
  close: "the densest wood from 12 m",
  piste: "on the piste where the woods crowd it, a skier's eye",
  treeline: "over the tree line and the krummholz, 30 m above its highest trees",
  valley: "from the valley floor up the wooded face",
  far: "the densest wood from 600 m off and 250 m up",
  aerial: "140 m over the densest wood",
  pines: "the densest pine stand from 22 m",
  broadleaf: "the densest broadleaf or larch stand from 22 m",
};

function shoot(name: string): string {
  const scene = SCENES[name];
  if (!scene) throw new Error(`no scene "${name}" — known: ${Object.keys(SCENES).join(", ")}`);
  const pose = scene();
  if (!pose) {
    label.textContent = `${name.toUpperCase()} · none on this map`;
    renderer.setOverride(null);
    return "none on this map";
  }
  renderer.setOverride(pose);
  // A few frames, so the bands' cross-fades and the shadow settle.
  for (let i = 0; i < 4; i++) still();
  const note = NOTES[name];
  label.textContent = `${name.toUpperCase()} · seed ${seed} · ${region ?? "alpine"} · ${note}`;
  return note;
}

function timed(frames: number): { ms: number; calls: number; triangles: number; worldMs: number } {
  still();
  const gl = renderer.gl.getContext();
  gl.finish();
  let world = 0;
  const t0 = performance.now();
  for (let i = 0; i < frames; i++) {
    still();
    world += renderer.cost().worldMs;
  }
  gl.finish();
  const ms = (performance.now() - t0) / frames;
  const c = renderer.cost();
  return { ms, calls: c.calls, triangles: c.triangles, worldMs: world / frames };
}

/** The scene priced: three rounds of `frames` frames with the woods and
 * without them, interleaved so a slow spell of the machine lands on both,
 * each side's quickest round kept. */
function cost(frames: number): SceneCost {
  let all = timed(frames);
  let bare = all;
  for (let round = 0; round < 3; round++) {
    renderer.setHidden([]);
    const a = timed(frames);
    if (round === 0 || a.ms < all.ms) all = { ...a, worldMs: Math.min(a.worldMs, all.worldMs) };
    renderer.setHidden(["forest"]);
    const b = timed(frames);
    if (round === 0 || b.ms < bare.ms) bare = { ...b, worldMs: Math.min(b.worldMs, bare.worldMs) };
  }
  renderer.setHidden([]);
  still();
  const tally = renderer.sceneTally().find((s) => s.name === "forest");
  return {
    ms: all.ms,
    msBare: bare.ms,
    calls: all.calls,
    callsBare: bare.calls,
    triangles: all.triangles,
    trianglesBare: bare.triangles,
    forestObjects: tally?.objects ?? 0,
    forestTriangles: tally?.triangles ?? 0,
    worldMs: all.worldMs,
    worldMsBare: bare.worldMs,
  };
}

/** The bytes of every distinct geometry under the forest group. */
function forestBytes(): { bytes: number; geometries: number } {
  const root = renderer.group("forest");
  const seen = new Set<unknown>();
  let bytes = 0;
  root?.traverse((o) => {
    const g = (
      o as {
        geometry?: {
          attributes: Record<string, { array: ArrayLike<number> & { byteLength: number } }>;
          index: { array: { byteLength: number } } | null;
        };
      }
    ).geometry;
    if (!g || seen.has(g)) return;
    seen.add(g);
    for (const a of Object.values(g.attributes)) bytes += a.array.byteLength;
    if (g.index) bytes += g.index.array.byteLength;
  });
  return { bytes, geometries: seen.size };
}

/** The canvas read back at a quarter size, as luminance. */
function sample(): Float32Array {
  const gl = renderer.gl.getContext();
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const sw = Math.floor(w / 4);
  const sh = Math.floor(h / 4);
  const out = new Float32Array(sw * sh);
  for (let j = 0; j < sh; j++)
    for (let i = 0; i < sw; i++) {
      const k = (j * 4 * w + i * 4) * 4;
      out[j * sw + i] = 0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2];
    }
  return out;
}

function approach(from: number, to: number, stepM: number): number[] {
  const heart = densest();
  const out: number[] = [];
  let last: Float32Array | null = null;
  for (let d = from; d >= to; d -= stepM) {
    renderer.setOverride(edgeView(d, heart));
    still();
    const now = sample();
    if (last) {
      let sum = 0;
      for (let i = 0; i < now.length; i++) sum += Math.abs(now[i] - last[i]);
      out.push(sum / now.length);
    }
    last = now;
  }
  return out;
}

const t0 = performance.now();
window.__trees = {
  ready: renderer.load(state).then(async () => {
    await volumeNoise();
    const loadMs = performance.now() - t0;
    const fb = forestBytes();
    return { trees: trees.length, loadMs, forestBytes: fb.bytes, geometries: fb.geometries };
  }),
  scenes: () => Object.keys(SCENES),
  shoot,
  cost,
  approach,
};
