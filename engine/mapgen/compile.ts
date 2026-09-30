// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COMPILE: the parts an attempt built, bound into the `Level` every
// reader codes against.
//
// The grids are baked ONCE — the ground with the piste pressed into it and
// the kickers stamped on it, and the packed field beside it — and the
// level's three queries (`groundAt`, `normalAt`, `packedAt`) are bilinear
// samples of them: two lerps at 120 Hz rather than a stack of noise
// octaves, and one answer the physics, the renderer and the analysis all
// read. Nothing downstream regenerates any of it.

import {
  sampleField,
  sampleFieldGradient,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import type {
  Checkpoint,
  Cliff,
  GeneratedLevel,
  Kicker,
  Level,
  Spawn,
  TrackPoint,
  TreeDef,
  Vec3,
} from "./types.ts";

export type LevelParts = {
  seed: number;
  size: number;
  ground: Heightfield;
  packed: Heightfield;
  points: TrackPoint[];
  length: number;
  checkpoints: Checkpoint[];
  spawn: Spawn;
  grid: Spawn[];
  trees: TreeDef[];
  kickers: Kicker[];
  cliffs: Cliff[];
  sun: Level["sun"];
  laps: number;
  mountain: GeneratedLevel["mountain"];
  attempt: number;
  drifts: GeneratedLevel["drifts"];
  weather: GeneratedLevel["weather"];
  version: GeneratedLevel["version"];
  region: GeneratedLevel["region"];
  /** The region's own snow (R21), where it lays any. */
  crust: Heightfield | null;
};

/** Bind the parts into a level. */
export function compileLevel(parts: LevelParts): GeneratedLevel {
  const { ground, packed } = parts;
  const scratch = new Float64Array(3);
  return {
    seed: parts.seed,
    size: parts.size,
    cell: ground.cell,
    ground,
    groundAt: (x, z) => sampleField(ground, x, z),
    normalAt: (x: number, z: number, out: Vec3) => {
      sampleFieldGradient(ground, x, z, scratch);
      const nx = -scratch[1];
      const nz = -scratch[2];
      const inv = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
      out.x = nx * inv;
      out.y = inv;
      out.z = nz * inv;
    },
    packedAt: (x, z) => sampleField(packed, x, z),
    track: { points: parts.points, length: parts.length, closed: false },
    checkpoints: parts.checkpoints,
    spawn: parts.spawn,
    grid: parts.grid,
    trees: parts.trees,
    sun: parts.sun,
    laps: parts.laps,
    packed,
    kickers: parts.kickers,
    cliffs: parts.cliffs,
    mountain: parts.mountain,
    attempt: parts.attempt,
    drifts: parts.drifts,
    version: parts.version,
    weather: parts.weather,
    region: parts.region,
    ...(parts.crust ? { crust: parts.crust } : {}),
  };
}
