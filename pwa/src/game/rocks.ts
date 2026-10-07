// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK AS DRAWN — the drops' rock (`rock-shapes.ts`): the skin over
// every wall too steep for snow (the engine's `rockShare`) and every rocky
// cliff's wall (`cliffWalls`), built into static meshes a TILE of the map
// at a time: one draw a tile, culled by three against the lens like any
// mesh, and BUILT ONLY WHEN IT FIRST COMES WITHIN REACH, so a phone never
// holds the rock of a face it never sees. The building is SLICED: a strip
// of the tile's lattice at a time, for at most `SLICE` ms a frame, so
// riding toward a rocky face never hitches; only the tiles round the lens
// itself, on the run's first frame or after a jump (a reset, a lift's
// top), are built whole at once. The reach is the DISTANCE row's whole
// view, not the trees': a far or high lens looks at the walls from across
// the valley. Past it the snow shader's dark rock carries them to the rim.
//
// What it costs is the FOREST row's: under three quarters of its far
// share the skin's lattice is the coarser `ROCKS.skin.cheap`, about half
// the triangles in the same outline. The whole thing hangs off the forest
// (`forest.ts`), which owns the woods' reach.

import * as THREE from "three";
import { ROCKS, cliffWalls, regionOf, rockHash, type CliffWall, type Level } from "@engine";

import { PAST_THE_WALL, hazeMaterial, type HazeUniforms } from "./haze.ts";
import { regionLookOf } from "./region-look.ts";
import { buildSkin, buildWall, rockMesh, type RockMesh } from "./rock-shapes.ts";

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
  /** The FOREST row's far share, 0..1: under 0.75 the coarser skin. */
  setShare(share: number): void;
  dispose(): void;
};

type Tile = {
  readonly cx: number;
  readonly cz: number;
  /** Its first lattice column and row (`TILE` m a side). */
  readonly i: number;
  readonly j: number;
  /** The cliffs' rock walls whose middle is on it, built first. */
  readonly walls: CliffWall[];
  /** The rows of its lattice its building has reached, and the triangles
   * so far. */
  done: number;
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
  const cols = band ? Math.ceil(level.size / TILE) : 0;
  const tiles: Tile[] = [];
  for (let j = 0; j < cols; j++) {
    for (let i = 0; i < cols; i++) {
      tiles.push({
        cx: (i + 0.5) * TILE,
        cz: (j + 0.5) * TILE,
        i,
        j,
        walls: [],
        done: 0,
        part: null,
        mesh: null,
        empty: false,
      });
    }
  }
  const seed = rockHash(level.seed, 0x534b494e);
  if (band) {
    for (const w of cliffWalls(level)) {
      const i = Math.min(cols - 1, Math.max(0, Math.floor(w.x / TILE)));
      const j = Math.min(cols - 1, Math.max(0, Math.floor(w.z / TILE)));
      tiles[j * cols + i].walls.push(w);
    }
  }
  /** The lattice rows a step builds before it looks at the clock. */
  const BATCH = 4;
  const cellOf = (): number => (share < 0.75 ? ROCKS.skin.cheap : ROCKS.skin.cell);

  /** Build a few more rows of `t`; true when it is whole. */
  const step = (t: Tile): boolean => {
    if (!t.part) {
      t.part = rockMesh();
      for (const w of t.walls) buildWall(t.part, w, band!.tone);
    }
    const part = t.part;
    const cell = cellOf();
    const n = Math.round(TILE / cell);
    const end = Math.min(n, t.done + BATCH);
    const i0 = t.i * n;
    buildSkin(part, level, band!.tone, seed, cell, i0, t.j * n + t.done, i0 + n, t.j * n + end);
    t.done = end;
    if (t.done < n) return false;
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
    t.done = 0;
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
        // holds the whole mountain's rock.
        if ((t.mesh || t.part) && d2 > (reach + KEEP) ** 2) drop(t);
      }
      // The nearest tile still owed, a slice of a frame's worth of it.
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
