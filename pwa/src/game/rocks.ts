// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK AS DRAWN — every outcrop of the map (`rock-plan.ts`), built into
// static meshes a TILE of the map at a time (`rock-shapes.ts`): one draw a
// tile, culled by three against the lens like any mesh, and PLANNED AND
// BUILT ONLY WHEN IT FIRST COMES WITHIN REACH, so the loading card pays for
// none of it and a phone never holds the crags of a face it never sees.
// The building is SLICED: a lattice row of a tile at a time, for at most
// `SLICE` ms a frame, so riding toward a rocky face never hitches; only the
// tiles round the lens itself, on the run's first frame or after a jump
// (a reset, a lift's top), are built whole at once. A tile past the reach
// (the DISTANCE row's trees) is hidden; past it the snow shader's dark rock
// carries the crags to the rim, as the ground's tint carries the woods.
//
// What it costs is the FOREST row's: its far share is the share of each
// knot's shards a tile is built with, the small ones dropped first, so a
// cheap picture keeps the crags' outline and loses their rubble. The whole
// thing hangs off the forest (`forest.ts`), which owns the woods' reach.

import * as THREE from "three";
import { regionOf, type Level } from "@engine";

import { PAST_THE_WALL, hazeMaterial, type HazeUniforms } from "./haze.ts";
import { regionLookOf } from "./region-look.ts";
import { ROCKS, rockPlanner } from "./rock-plan.ts";
import { buildOutcrop, rockMesh, type RockMesh } from "./rock-shapes.ts";

/** A tile's side, m. */
const TILE = 192;
/** The building's share of a frame, ms. */
const SLICE = 1.5;
/** Within this of the lens a tile is built whole at once, whatever it
 * costs, m: a crag appearing that close would be seen. */
const NOW = 110;
/** How far past the reach a built tile is kept, m, before it is let go. */
const KEEP = 2 * TILE;

export type Rocks = {
  readonly group: THREE.Group;
  /** Show what is within `reach` m of the lens, building what is new. */
  update(eye: THREE.Vector3, reach: number): void;
  /** The share of a knot's shards a tile is built with, 0..1. */
  setShare(share: number): void;
  dispose(): void;
};

type Tile = {
  readonly cx: number;
  readonly cz: number;
  /** Its lattice rows (`ROCKS.cell`), the first and one past the last. */
  readonly row0: number;
  readonly row1: number;
  /** The row its building has reached, and the triangles so far. */
  row: number;
  part: RockMesh | null;
  mesh: THREE.Mesh | null;
  /** Built, and nothing stands on it. */
  empty: boolean;
};

export function createRocks(level: Level, haze: HazeUniforms, initial: number): Rocks {
  const group = new THREE.Group();
  group.name = "rocks";
  const band = regionLookOf(regionOf(level).id).rock;
  const material = hazeMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
    haze,
    "rock",
    PAST_THE_WALL,
  );
  let share = initial;
  const plan = rockPlanner(level, band);
  const cols = band ? Math.ceil(level.size / TILE) : 0;
  const tiles: Tile[] = [];
  for (let j = 0; j < cols; j++) {
    for (let i = 0; i < cols; i++) {
      const row0 = Math.ceil((j * TILE) / ROCKS.cell);
      tiles.push({
        cx: (i + 0.5) * TILE,
        cz: (j + 0.5) * TILE,
        row0,
        row1: Math.ceil(((j + 1) * TILE) / ROCKS.cell),
        row: row0,
        part: null,
        mesh: null,
        empty: false,
      });
    }
  }

  /** Build one more lattice row of `t`; true when it is whole. */
  const step = (t: Tile): boolean => {
    const part = (t.part ??= rockMesh());
    const x0 = t.cx - TILE / 2;
    const area = { x0, x1: x0 + TILE, z0: t.row * ROCKS.cell, z1: (t.row + 1) * ROCKS.cell };
    for (const o of plan(area)) buildOutcrop(part, level, o, band!.tone, share);
    t.row++;
    if (t.row < t.row1) return false;
    t.part = null;
    if (part.pos.length === 0) {
      t.empty = true;
      return true;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(part.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(part.nrm, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(part.col, 3));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    mesh.matrixAutoUpdate = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    t.mesh = mesh;
    return true;
  };
  const drop = (t: Tile): void => {
    t.empty = false;
    t.row = t.row0;
    t.part = null;
    if (!t.mesh) return;
    group.remove(t.mesh);
    t.mesh.geometry.dispose();
    t.mesh = null;
  };
  const due = (t: Tile): boolean => !t.mesh && !t.empty;

  return {
    group,
    update(eye, reach) {
      // The tile's corner nearest the lens, so a tile is shown as soon as
      // any of it is in reach.
      const half = TILE / 2;
      let next: Tile | null = null;
      let nextD2 = Infinity;
      for (const t of tiles) {
        const dx = Math.max(0, Math.abs(eye.x - t.cx) - half);
        const dz = Math.max(0, Math.abs(eye.z - t.cz) - half);
        const d2 = dx * dx + dz * dz;
        const near = d2 < reach * reach;
        if (near && due(t)) {
          if (d2 < NOW * NOW) while (!step(t));
          else if (d2 < nextD2) {
            next = t;
            nextD2 = d2;
          }
        }
        if (t.mesh) t.mesh.visible = near;
        // Well out of reach, its triangles are let go, so a long ride never
        // holds the whole mountain's crags.
        if ((t.mesh || t.part) && d2 > (reach + KEEP) ** 2) drop(t);
      }
      // The nearest tile still owed, a slice of a frame's worth of rows.
      if (next) {
        const until = performance.now() + SLICE;
        while (!step(next) && performance.now() < until);
        if (next.mesh) next.mesh.visible = true;
      }
    },
    setShare(next) {
      if (next === share) return;
      share = next;
      for (const t of tiles) drop(t);
    },
    dispose() {
      for (const t of tiles) drop(t);
      material.dispose();
    },
  };
}
