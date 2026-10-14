// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK AS DRAWN — two kinds of it. A WALL TOO STEEP FOR SNOW (the
// engine's `rockShare`) is not built here at all: the ground itself is
// reshaped into its beds, joints and ribs and painted as stone where it is
// bare (`rock-relief-glsl.ts`, drawn by the ground's own clipmap — no draw
// call and no triangle of its own, and the same surface the physics
// rides). What is built here is every ROCKY CLIFF'S WALL (`cliffWalls`):
// a few hundred faceted triangles a cliff, built a TILE of the map at a
// time when a tile first comes within the DISTANCE row's reach and let go
// well past it, so a phone never holds the walls of a face it never sees.
//
// The group stays the rock's one switch: the labs hide it to price the
// rock, and the ground's rock goes with it (`terrain.ts`' `uRockOn`). Its
// stats (`userData.rockStats`) bill both: the walls' triangles and bytes,
// and every ms spent building rock — the walls and the ground map's share
// of rock at every node (`rockBakeMs`).

import * as THREE from "three";
import { cliffWalls, regionOf, type CliffWall, type Level } from "@engine";

import { PAST_THE_WALL, hazeMaterial, type HazeUniforms } from "./haze.ts";
import { regionLookOf } from "./region-look.ts";
import { rockBakeMs } from "./rock-relief-glsl.ts";
import { buildWall, rockMesh } from "./rock-shapes.ts";

/** A tile's side, m. */
const TILE = 192;
/** How far past the reach a built tile is kept, m, before it is let go. */
const KEEP = 2 * TILE;

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

export type Rocks = {
  readonly group: THREE.Group;
  /** Show what is within `reach` m of the lens, building what is new. */
  update(eye: THREE.Vector3, reach: number): void;
  dispose(): void;
};

type Tile = {
  readonly cx: number;
  readonly cz: number;
  /** The cliffs' rock walls whose middle is on it. */
  readonly walls: CliffWall[];
  /** Built, and what is on screen (null when it holds none). */
  built: boolean;
  mesh: THREE.Mesh | null;
};

export function createRocks(level: Level, haze: HazeUniforms): Rocks {
  const group = new THREE.Group();
  group.name = "rocks";
  // WHAT THE ROCK HOLDS, for the rock eval lab (`make rock-eval`): every ms
  // spent building it, the tiles in reach still owed, and the triangles and
  // bytes built. An instrument: nothing draws off it.
  const stats = { buildMs: 0, owed: 0, triangles: 0, bytes: 0 };
  group.userData.rockStats = stats;
  let wallMs = 0;
  const bill = (): void => {
    stats.buildMs = wallMs + rockBakeMs(level);
  };
  bill();
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
  const cols = band ? Math.ceil(level.size / TILE) : 0;
  const tiles: Tile[] = [];
  for (let j = 0; j < cols; j++) {
    for (let i = 0; i < cols; i++) {
      tiles.push({
        cx: (i + 0.5) * TILE,
        cz: (j + 0.5) * TILE,
        walls: [],
        built: false,
        mesh: null,
      });
    }
  }
  if (band) {
    for (const w of cliffWalls(level)) {
      const i = Math.min(cols - 1, Math.max(0, Math.floor(w.x / TILE)));
      const j = Math.min(cols - 1, Math.max(0, Math.floor(w.z / TILE)));
      tiles[j * cols + i].walls.push(w);
    }
  }
  const walled = tiles.filter((t) => t.walls.length > 0);

  const build = (t: Tile): void => {
    const t0 = performance.now();
    t.built = true;
    const part = rockMesh();
    for (const w of t.walls) buildWall(part, w, band!.tone);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(part.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(part.nrm, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(part.col, 3));
    g.setAttribute("soft", new THREE.Float32BufferAttribute(part.soft, 3));
    g.setAttribute("calm", new THREE.Float32BufferAttribute(part.calm, 3));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    mesh.userData.bytes =
      (part.pos.length + part.nrm.length + part.col.length + part.soft.length + part.calm.length) *
      4;
    stats.triangles += part.pos.length / 9;
    stats.bytes += mesh.userData.bytes;
    mesh.matrixAutoUpdate = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    t.mesh = mesh;
    wallMs += performance.now() - t0;
    bill();
  };
  const drop = (t: Tile): void => {
    t.built = false;
    const m = t.mesh;
    if (!m) return;
    stats.triangles -= (m.geometry.getAttribute("position")?.count ?? 0) / 3;
    stats.bytes -= (m.userData.bytes as number | undefined) ?? 0;
    group.remove(m);
    m.geometry.dispose();
    t.mesh = null;
  };
  // Every wall is built whole the moment it is in reach, so nothing is
  // ever left owed for the lab to settle — but the ground's own rock is
  // billed as it is read.
  group.userData.rockSettle = (): void => bill();

  return {
    group,
    update(eye, reach) {
      const half = TILE / 2;
      for (const t of walled) {
        const dx = Math.max(0, Math.abs(eye.x - t.cx) - half);
        const dz = Math.max(0, Math.abs(eye.z - t.cz) - half);
        const d2 = dx * dx + dz * dz;
        const near = d2 < reach * reach;
        if (near && !t.built) build(t);
        if (t.mesh) t.mesh.visible = near;
        // Well out of reach, its triangles are let go.
        if (t.built && d2 > (reach + KEEP) ** 2) drop(t);
      }
      bill();
    },
    dispose() {
      for (const t of walled) drop(t);
      material.dispose();
    },
  };
}
