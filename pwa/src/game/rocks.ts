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
// A TILE IS BUILT AT THE CUT ITS DISTANCE ASKS (`CUTS`): the full lattice
// near the lens, the cheap one past `CUTS[0].out` and a coarse one past
// `CUTS[1].out`, a face across the valley a ninth of its triangles in the
// same outline. A tile owed a finer or coarser cut keeps the one it has on
// screen until the new one is whole, and only swaps past a margin
// (`HYSTERESIS`), so riding to and fro across a band never rebuilds it.
//
// What it costs near the lens is the FOREST row's: under three quarters of
// its far share the near lattice is the cheap one too. The whole thing
// hangs off the forest (`forest.ts`), which owns the woods' reach.

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
/** The lattice by distance from the lens to a tile's nearest corner: out
 * to `out` m the cell is `cell` m (`near` for the FOREST row's own). */
export const CUTS = [
  { out: 300, cell: "near" },
  { out: 700, cell: ROCKS.skin.cheap },
  { out: Infinity, cell: 12 },
] as const;
/** How far past a band's edge a tile must be before it changes cut, m. */
const HYSTERESIS = 30;

/** THE ROCK CALMED WITH DISTANCE: from `CALM_FROM` m to `CALM_TO` m off
 * the lens every corner eases from its facet's flat normal and own shade
 * to the ground's smooth normal and the rock's mean paint (`RockMesh`'s
 * `soft` and `calm`). A facet is a few metres; far out it is a few
 * pixels, and a field of them each lit and shaded its own way, snow on one
 * and bare stone on the next, twinkles as the lens moves — the far crags
 * flicker. Calmed, the face keeps its shape and its snow and loses only
 * the detail no pixel can hold. Close in nothing changes. */
const CALM_FROM = 80;
const CALM_TO = 350;
const CALM_HEAD = /* glsl */ `
attribute vec3 soft;
attribute vec3 calm;
`;
// Three's vertex shader colours before it reads the normal, so the share
// is reckoned with the colour.
const CALM_COLOUR = /* glsl */ `
#include <color_vertex>
float rockCalm = smoothstep(${CALM_FROM.toFixed(1)}, ${CALM_TO.toFixed(1)},
  distance((modelMatrix * vec4(position, 1.0)).xyz, cameraPosition));
vColor.xyz = mix(color.xyz, calm, rockCalm);
`;
const CALM_NORMAL = /* glsl */ `
vec3 objectNormal = normalize(mix(normal, soft, rockCalm));
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif
`;

/** AND PULLED TOWARD THE LENS, IN DEPTH ALONE: `PULL` m for every metre
 * past `PULL_FROM` it stands off, out to `PULL_MOST` m. The skin stands a
 * hand proud of the snow, but the depth buffer tells two surfaces apart
 * ever more coarsely the further they are (a step is about d² over the
 * near plane's 2²⁴: half a metre at a kilometre) and the snow under it is
 * drawn coarser too, so far out the two fight over the same pixels. Moved
 * along the ray to the eye, a corner stays on its pixel; only the depth
 * test changes, and the rock wins it against snow that close behind. */
const PULL = 0.004;
const PULL_FROM = 30;
const PULL_MOST = 12;
const PULL_GLSL = /* glsl */ `
#include <project_vertex>
{
  float rockD = length(mvPosition.xyz);
  float rockPull = clamp((rockD - ${PULL_FROM.toFixed(1)}) * ${PULL.toFixed(4)}, 0.0, ${PULL_MOST.toFixed(1)});
  gl_Position = projectionMatrix * vec4(mvPosition.xyz * (1.0 - rockPull / max(rockD, 1.0)), 1.0);
}
`;

/** The cut a tile `d` m off wants, given the one it has (`had`, or -1). */
export function cutOf(d: number, had: number): number {
  let k = CUTS.findIndex((c) => d < c.out);
  if (had >= 0 && k !== had) {
    // Only past the margin: a coarser cut once `HYSTERESIS` beyond the
    // edge, a finer one once as far inside it.
    const edge = k > had ? CUTS[had].out + HYSTERESIS : CUTS[k].out - HYSTERESIS;
    if (k > had ? d < edge : d > edge) k = had;
  }
  return k;
}

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
   * so far, at the cut `building`. */
  done: number;
  part: RockMesh | null;
  building: number;
  /** What is on screen, and its cut (-1 for none). */
  mesh: THREE.Mesh | null;
  cut: number;
  /** Built at `cut`, and nothing stands on it. */
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
    (shader) => {
      PAST_THE_WALL(shader);
      shader.vertexShader = (CALM_HEAD + shader.vertexShader)
        .replace("#include <beginnormal_vertex>", CALM_NORMAL)
        .replace("#include <color_vertex>", CALM_COLOUR)
        .replace("#include <project_vertex>", PULL_GLSL);
    },
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
        building: -1,
        mesh: null,
        cut: -1,
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
  const cellOf = (k: number): number => {
    const c = CUTS[k].cell;
    if (c !== "near") return c;
    return share < 0.75 ? ROCKS.skin.cheap : ROCKS.skin.cell;
  };

  /** Build a few more rows of `t` at cut `k`; true when it is whole. */
  const step = (t: Tile, k: number): boolean => {
    if (!t.part || t.building !== k) {
      t.part = rockMesh();
      t.building = k;
      t.done = 0;
      for (const w of t.walls) buildWall(t.part, w, band!.tone);
    }
    const part = t.part;
    const cell = cellOf(k);
    const n = Math.round(TILE / cell);
    const end = Math.min(n, t.done + BATCH);
    const i0 = t.i * n;
    buildSkin(part, level, band!.tone, seed, cell, i0, t.j * n + t.done, i0 + n, t.j * n + end);
    t.done = end;
    if (t.done < n) return false;
    t.part = null;
    t.done = 0;
    // The cut it replaces goes as the new one arrives.
    const old = t.mesh;
    if (old) {
      group.remove(old);
      old.geometry.dispose();
      t.mesh = null;
    }
    t.cut = k;
    t.empty = part.pos.length === 0;
    if (t.empty) return true;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(part.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(part.nrm, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(part.col, 3));
    g.setAttribute("soft", new THREE.Float32BufferAttribute(part.soft, 3));
    g.setAttribute("calm", new THREE.Float32BufferAttribute(part.calm, 3));
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
    t.building = -1;
    t.cut = -1;
    if (!t.mesh) return;
    group.remove(t.mesh);
    t.mesh.geometry.dispose();
    t.mesh = null;
  };

  return {
    group,
    update(eye, reach) {
      // The tile's corner nearest the lens, so a tile is shown as soon as
      // any of it is in reach.
      const half = TILE / 2;
      let next: Tile | null = null;
      let nextK = 0;
      let nextD2 = Infinity;
      for (const t of tiles) {
        const dx = Math.max(0, Math.abs(eye.x - t.cx) - half);
        const dz = Math.max(0, Math.abs(eye.z - t.cz) - half);
        const d2 = dx * dx + dz * dz;
        const near = d2 < reach * reach;
        const k = near ? cutOf(Math.sqrt(d2), t.cut) : -1;
        if (near && k !== t.cut) {
          // A tile with nothing on screen yet, or one that close, is built
          // whole now; one changing cut keeps its old one meanwhile.
          if (d2 < NOW * NOW && (t.cut < 0 || k < t.cut)) while (!step(t, k));
          else if (d2 < nextD2) {
            next = t;
            nextK = k;
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
        while (!step(next, nextK) && performance.now() < until);
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
