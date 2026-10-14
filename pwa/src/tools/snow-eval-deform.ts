// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE DEFORMABLE SNOW COSTS a frame at each TRAILS stop — the snow eval
// lab's `--deform-perf` table: a scene ridden at the HIGH preset with the
// TRAILS row moved, a few frames timed once ridden into its thick, and the
// frame's draw calls and triangles read off the renderer's own counters,
// with the deformable snow's own mesh counted alone (`terrain-deform`).
// Software GL's milliseconds read against each other only; the price list
// scales them (`picture-fit.ts`).

import {
  createGame,
  NEUTRAL_INPUT,
  pairById,
  placeRun,
  step,
  type GameState,
  type Level,
  type SkierInput,
} from "@engine";

import { holdInput } from "../game/hold-input.ts";
import type { WorldRendererExt } from "../game/renderer.ts";
import {
  DEFAULT_VIDEO,
  TRAIL_LEVELS,
  withPreset,
  type TrailLevel,
} from "../game/settings-video.ts";

export type DeformPerfRow = {
  scene: string;
  trails: TrailLevel;
  frameMs: number;
  calls: number;
  triangles: number;
  /** The deformable snow's mesh, triangles (0 none drawn). */
  patch: number;
  /** Kilograms of thrown snow the field dug, and the frame's own trail and
   * world CPU times, ms. */
  dug: number;
  trailMs: number;
};

type Spot = { x: number; z: number; heading: number };

export async function deformPerf(lab: {
  renderer: WorldRendererExt;
  level: Level;
  stage: HTMLCanvasElement;
  loaded(state: GameState): Promise<void>;
  scenes: {
    id: string;
    skis: string;
    depth: number;
    kmh: number;
    spot: Spot;
    ride: (state: GameState, t: number) => SkierInput;
    fall?: boolean;
  }[];
}): Promise<DeformPerfRow[]> {
  const { renderer, level, stage } = lab;
  const rows: DeformPerfRow[] = [];
  const top = withPreset(DEFAULT_VIDEO, "high");
  for (const scene of lab.scenes) {
    for (const trails of TRAIL_LEVELS) {
      renderer.setVideo({ ...top, trails });
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
      await lab.loaded(state);
      const s = scene.spot;
      placeRun(state, { x: s.x, z: s.z, heading: s.heading, speed: scene.kmh / 3.6 });
      renderer.setOverride(null);
      renderer.setCamera("chase", true);
      const t0 = state.t;
      const frame = (present: boolean) => {
        for (let i = 0; i < 2; i++)
          step(
            state,
            scene.fall && state.skier.thrown ? NEUTRAL_INPUT : scene.ride(state, state.t - t0),
          );
        renderer.draw(state, 0, 1 / 60, present);
      };
      while (state.t - t0 < 1.6) frame(false);
      // Warm the shaders (a first frame of a new variant compiles), then
      // time: the median frame, so a stall left over is not the price.
      for (let w = 0; w < 3; w++) frame(true);
      const times: number[] = [];
      let trailMs = 0;
      const n = 5;
      let calls = 0;
      let triangles = 0;
      for (let f = 0; f < n; f++) {
        const a = performance.now();
        frame(true);
        (stage.getContext("webgl2") as WebGL2RenderingContext | null)?.finish();
        times.push(performance.now() - a);
        trailMs += renderer.cost().trailMs;
        calls = Math.max(calls, renderer.info().calls);
        triangles = Math.max(triangles, renderer.info().triangles);
      }
      let patch = 0;
      for (const row of renderer.sceneTally())
        if (row.name === "terrain-deform") patch = row.triangles;
      rows.push({
        scene: scene.id,
        trails,
        frameMs: times.sort((x, y) => x - y)[n >> 1],
        calls,
        triangles,
        patch,
        dug: renderer.snowDug(),
        trailMs: trailMs / n,
      });
      await new Promise((done) => setTimeout(done, 0));
    }
  }
  renderer.setVideo(top);
  return rows;
}

/** The scenes the cost is read on: a powder turn and a fall's crater. */
export function deformPerfScenes(spotOf: (id: string) => Spot) {
  return [
    {
      id: "powder",
      skis: "chamois",
      depth: 2,
      kmh: 40,
      spot: spotOf("powder"),
      ride: (state: GameState, t: number): SkierInput => {
        const i = holdInput(state, 40, spotOf("powder").heading, "straight", t);
        return { ...i, tuck: 0, steer: t >= 0.25 ? 1 : i.steer, brake: t >= 0.45 ? 0.45 : 0 };
      },
    },
    {
      id: "crater",
      skis: "chamois",
      depth: 2.5,
      kmh: 30,
      spot: spotOf("crater"),
      ride: (): SkierInput => ({ ...NEUTRAL_INPUT, steer: 1, brake: 1, lean: 1 }),
      fall: true,
    },
  ];
}
