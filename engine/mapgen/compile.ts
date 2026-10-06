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
import type { PisteGrade } from "./grades.ts";
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
  /** The grade the map was built to (R23); null on the ungraded row. */
  grade: PisteGrade | null;
  /** The region's own snow (R21), where it lays any. */
  crust: Heightfield | null;
};

/** The level's three queries: bilinear reads of its two grids. */
function queriesOf(
  ground: Heightfield,
  packed: Heightfield,
): Pick<Level, "groundAt" | "normalAt" | "packedAt"> {
  const scratch = new Float64Array(3);
  return {
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
  };
}

/** A LEVEL AS IT CROSSES A THREAD: everything a map is but its queries,
 * which are closures over its grids and cannot be posted. Plain data — the
 * grids are typed arrays — so a worker that generated a map can hand it to
 * the page rather than the page generating it again. */
export type PortableLevel = Omit<GeneratedLevel, "groundAt" | "normalAt" | "packedAt" | "iceAt">;

/** `level` without its queries, to be posted (`boundLevel` takes it back). */
export function portableLevel(level: GeneratedLevel): PortableLevel {
  const out: Partial<GeneratedLevel> = { ...level };
  delete out.groundAt;
  delete out.normalAt;
  delete out.packedAt;
  delete out.iceAt;
  return out as PortableLevel;
}

/** A posted level made a level again: its queries bound to its own grids,
 * the very ones `compileLevel` binds, so it reads exactly as the map it was
 * posted from. */
export function boundLevel(p: PortableLevel): GeneratedLevel {
  return { ...p, ...queriesOf(p.ground, p.packed) };
}

/** Bind the parts into a level. */
export function compileLevel(parts: LevelParts): GeneratedLevel {
  const { ground, packed } = parts;
  return {
    seed: parts.seed,
    size: parts.size,
    cell: ground.cell,
    ground,
    ...queriesOf(ground, packed),
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
    ...(parts.grade ? { grade: parts.grade } : {}),
    ...(parts.crust ? { crust: parts.crust } : {}),
  };
}
