// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK EVAL LAB's page (driven by `scripts/rock-eval.mjs`): one map
// stood up and its ROCK drawn through the game's own renderer from a FIXED
// LIST OF SCENES (`rock-eval-scenes.ts`) — the same lenses whatever builds
// the rock, so two ways of building it can be laid side by side — and every
// scene priced: the frame with the rock and without it
// (`setHidden(["rocks"])`), so what the rock costs is read off the
// difference, the shadow pass included, beside what the scene walk bills to
// the `rocks` group; the frame without the GROUND (`setHidden(["terrain"])`),
// so rock moved into the ground's shader still shows as the ground's ms; and,
// where a candidate exposes the `terrain` group's `rockGround` switch, the
// frame with the ground's own rock turned off (`rock-eval-measure.ts`).
//
// Every scene is read FROM NOTHING: the rock let go and built whole at the
// scene's own lens before any frame is read (`standAt`), so the order the
// scenes are drawn in never moves a number.
//
// Beside the price, the readings a candidate is weighed by
// (`rock-eval-measure.ts`): the PHYSICS GAP (within 250 m and within 50 m
// of the lens), the SHIMMER (the lens slid a few centimetres a frame across
// a far face), the APPROACH (the lens walked in at the rockiest face from
// 800 m to 20 m — a POP is a spike), and the ORDER CHECK (a scene read
// first and read again last, after everything else).

import {
  cliffWalls,
  createGame,
  isRegionId,
  loadRealFace,
  withRock,
  type GameState,
  type Level,
  type RegionId,
  type WeatherKind,
} from "@engine";

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
import { createMeasures, type Gap, type RockStats } from "./rock-eval-measure.ts";
import { rockScenes } from "./rock-eval-scenes.ts";

export type { Gap, RockStats } from "./rock-eval-measure.ts";

/** One timed pass: the frame's ms, its draws and triangles, the renderer's
 * own processor time for the world. */
type Pass = { ms: number; calls: number; triangles: number; worldMs: number };

/** What one scene cost. ms are a SOFTWARE rasterizer's
 * (`--use-angle=swiftshader`) — comparable between two builds on one
 * machine, never a phone's. */
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
  /** The frame without the ground (`terrain` hidden): the ground's ms is
   * `ms − msNoGround`, where rock drawn in its shader is paid. */
  msNoGround: number;
  callsNoGround: number;
  trianglesNoGround: number;
  /** The frame with the ground's own rock turned off (the `terrain`
   * group's `rockGround` switch), or null where the build has none. */
  msGroundRockOff: number | null;
};

/** A scene stood: its note, the ms the rock spent building, whether the
 * rock held nothing before it, and the physics gap at its lens. */
type Shot = { note: string; settleMs: number; clean: boolean; gap: Gap | null };

/** A scene's first reading, kept for the order check. */
type Mark = { read: Float32Array; rockTriangles: number; heldTriangles: number };

declare global {
  interface Window {
    __rocks?: {
      ready: Promise<{
        loadMs: number;
        rockCells: number;
        cliffs: number;
        stats: RockStats;
        rockGround: boolean;
        rockDrawnAt: boolean;
        rockReset: boolean;
      }>;
      scenes(): string[];
      shoot(name: string): Promise<Shot>;
      cost(frames: number): SceneCost;
      stats(): RockStats;
      shimmer(name: string, frames: number, slide: number, fresh?: boolean): Promise<number>;
      approach(from: number, to: number, step: number): Promise<number[]>;
      mark(name: string): Promise<void>;
      recheck(name: string): Promise<{
        change: number;
        rockTriangles: [number, number];
        heldTriangles: [number, number];
      } | null>;
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
/** A frame with a sixtieth passing (what settles and what is timed), and
 * one with none (what is read — `rock-eval-measure.ts`). */
const still = () => renderer.draw(state, 0, FRAME, true);
const frozen = () => renderer.draw(state, 0, 0, true);
const lab = rockScenes(level, bed, ridden);
const m = createMeasures(renderer, still, frozen, bed, ridden);

const terrainHook = <T>(name: string): T | undefined =>
  renderer.group("terrain")?.userData[name] as T | undefined;

async function shoot(name: string): Promise<Shot> {
  const scene = lab.scenes[name];
  if (!scene) throw new Error(`no scene "${name}" — known: ${Object.keys(lab.scenes).join(", ")}`);
  const pose = scene();
  if (!pose) {
    label.textContent = `${name.toUpperCase()} · none on this map`;
    renderer.setOverride(null);
    return { note: "none on this map", settleMs: 0, clean: true, gap: null };
  }
  const { settleMs, clean } = await m.standAt(pose);
  const note = lab.notes[name];
  label.textContent = `${name.toUpperCase()} · seed ${seed} · ${face ?? region ?? "alpine"}${summer ? " · summer" : ""} · ${hour}:00 ${weather} · ${note}`;
  return { note, settleMs, clean, gap: m.gap(pose.eye) };
}

/** Waits for the GPU: a pixel read back blocks until every draw before it
 * is done, which `gl.finish` does not promise. */
const pixel = new Uint8Array(4);
function sync(): void {
  const gl = renderer.gl.getContext();
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
}

function timed(frames: number): Pass {
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

/** The quicker of two passes, the world's ms the lesser of both. */
const best = (a: Pass | null, b: Pass): Pass =>
  !a
    ? b
    : b.ms < a.ms
      ? { ...b, worldMs: Math.min(a.worldMs, b.worldMs) }
      : { ...a, worldMs: Math.min(a.worldMs, b.worldMs) };

/** The scene priced: two rounds of `frames` frames whole, without the
 * rock, without the ground, and (where the build can) without the
 * ground's own rock — interleaved so a slow spell lands on every side, each
 * side's quickest round kept. */
function cost(frames: number): SceneCost {
  const rockGround = terrainHook<(on: boolean) => void>("rockGround");
  let all: Pass | null = null;
  let bare: Pass | null = null;
  let noGround: Pass | null = null;
  let groundRockOff: Pass | null = null;
  for (let round = 0; round < 2; round++) {
    renderer.setHidden([]);
    all = best(all, timed(frames));
    renderer.setHidden(["rocks"]);
    bare = best(bare, timed(frames));
    renderer.setHidden(["terrain"]);
    noGround = best(noGround, timed(frames));
    renderer.setHidden([]);
    if (rockGround) {
      rockGround(false);
      groundRockOff = best(groundRockOff, timed(frames));
      rockGround(true);
    }
  }
  renderer.setHidden([]);
  still();
  const a = all as Pass;
  const b = bare as Pass;
  const g = noGround as Pass;
  const tally = renderer.sceneTally().find((s) => s.name === "rocks");
  return {
    ms: a.ms,
    msBare: b.ms,
    calls: a.calls,
    callsBare: b.calls,
    triangles: a.triangles,
    trianglesBare: b.triangles,
    rockObjects: tally?.objects ?? 0,
    rockTriangles: tally?.triangles ?? 0,
    worldMs: a.worldMs,
    worldMsBare: b.worldMs,
    msNoGround: g.ms,
    callsNoGround: g.calls,
    trianglesNoGround: g.triangles,
    msGroundRockOff: groundRockOff ? groundRockOff.ms : null,
  };
}

/** THE SHIMMER of scene `name` (see `rock-eval-measure.ts`). */
async function shimmer(name: string, frames: number, slide: number, fresh = true) {
  const pose = lab.scenes[name]?.();
  return pose ? m.shimmer(pose, frames, slide, fresh) : 0;
}

/** The approach at the rockiest face, the lens narrowing as it comes. */
function approach(from: number, to: number, step: number): Promise<number[]> {
  return m.approach(
    (d) => lab.faceView(d, 6 + d * 0.03, Math.max(14, Math.min(60, 7000 / d))),
    from,
    to,
    step,
  );
}

/** THE ORDER CHECK: scene `name` read now (`mark`) and read again later
 * (`recheck`), after other scenes: the mean change between the two
 * pictures (0..255 steps), and the rock drawn and held each time. */
const marks = new Map<string, Mark>();
async function mark(name: string): Promise<void> {
  await shoot(name);
  marks.set(name, {
    read: m.sample(),
    rockTriangles: renderer.sceneTally().find((s) => s.name === "rocks")?.triangles ?? 0,
    heldTriangles: m.stats().triangles,
  });
}
async function recheck(name: string) {
  const before = marks.get(name);
  if (!before) return null;
  await shoot(name);
  return {
    change: m.change(before.read, m.sample()),
    rockTriangles: [
      before.rockTriangles,
      renderer.sceneTally().find((s) => s.name === "rocks")?.triangles ?? 0,
    ] as [number, number],
    heldTriangles: [before.heldTriangles, m.stats().triangles] as [number, number],
  };
}

const t0 = performance.now();
window.__rocks = {
  ready: renderer.load(state).then(async () => {
    await volumeNoise();
    return {
      loadMs: performance.now() - t0,
      rockCells: lab.rockCells,
      cliffs: cliffWalls(level).length,
      stats: m.stats(),
      rockGround: typeof terrainHook("rockGround") === "function",
      rockDrawnAt: typeof terrainHook("rockDrawnAt") === "function",
      rockReset: typeof renderer.group("rocks")?.userData.rockReset === "function",
    };
  }),
  scenes: () => Object.keys(lab.scenes),
  shoot,
  cost,
  stats: m.stats,
  shimmer,
  approach,
  mark,
  recheck,
};
