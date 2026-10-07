// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GROUND — the whole 1.6 km basin and the mountains past it, as one
// camera-centred CLIPMAP of nested grids.
//
// WHY A CLIPMAP. The snow deforms: a furrow is a ski's width and a hand
// deep, and the mesh has to have vertices at a quarter of a metre where the
// lens is to show it. At that pitch the whole map is forty million
// vertices. So the grid follows the lens instead: level 0 is a square of
// `n` × `n` cells at `spacing` metres, and every level after it doubles the
// spacing and cuts a hole where the finer one already is. Eight levels
// reach three kilometres out, past the ridge, on a couple of hundred thousand
// vertices — and a shorter DISTANCE (`settings-video.ts`) builds only the
// levels it takes to reach its mist's wall.
//
// NOTHING IS BAKED INTO THE MESH. Its vertices are integer grid positions;
// the vertex shader (`snow-glsl.ts`) places them round the lens, reads the
// ground's height out of a float texture of the generator's own
// heightfield, lowers them by the trail map, and — in the band nearest a
// level's rim — slides every odd vertex onto its even neighbour so the
// level's edge is exactly the next level's (the CDLOD morph; no seams, no
// skirts). Each level snaps its centre to twice its own spacing, so a
// vertex never swims across the snow as the lens moves.
//
// WHERE TWO LEVELS OVERLAP. A level's hole is cut one cell short of where
// the finer level can be (the finer level's snap can shift it by one of
// the coarser cells either way), and the rest is thrown away per pixel
// (`uHole`) up to half a finer cell inside the finer level's edge — a thin
// strip where both draw the same surface, so the seam has no pinholes.
//
// Four textures carry the map to the GPU, built once per level: the
// heights (R32F, read with texelFetch in the vertex shader), a GROUND map
// (the slope's gradient, the GROOMED share, how wooded it is — half floats,
// linearly filtered, which is what gives the shading smooth normals with
// no two-metre facets), the TRACK DIRECTION the corduroy runs along, and
// the region's own SURFACE (R21: the wind crust and the river's ice, which
// the engine folds into `packed` and which this map keeps apart, so a
// crust is painted as a crust and not as the groomer).

import * as THREE from "three";
import { LEVEL_RULES, bermProfile, regionOf, windFromOf, type Level } from "@engine";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { regionLookOf } from "./region-look.ts";
import {
  SNOW_FRAGMENT_COLOUR,
  SNOW_FRAGMENT_LIGHT,
  SNOW_FRAGMENT_NORMAL,
  SNOW_FRAGMENT_PARS,
  SNOW_FRAGMENT_ROUGHNESS,
  SNOW_FRAGMENT_SAMPLE,
  SNOW_VERTEX_BEGIN,
  SNOW_VERTEX_PARS,
  SNOW_VERTEX_PLACE,
} from "./snow-glsl.ts";
import type { TerrainLook } from "./settings-video.ts";
import type { TrailUniforms } from "./trail-map.ts";
import { createTreeWells } from "./tree-wells.ts";

/** The grid's size, pitch and depth — a TERRAIN stop, `terrainLook` in
 * `settings-video.ts`. */
export type TerrainOptions = TerrainLook;

export type Terrain = {
  group: THREE.Group;
  /** Re-centre every level on the lens at (`x`, `z`) — and, given the lens
   * itself, draw only the parts of each level its view can reach. */
  follow(x: number, z: number, lens?: THREE.Camera): void;
  dispose(): void;
};

/** EACH RING IS CUT INTO WEDGES round its centre, and the wedges out of
 * the lens's view are not drawn. A level is a ring all round the lens, and
 * with the frustum culling three cannot do (the vertices are placed in the
 * shader, so no bound is the mesh's own) every vertex of it ran the ground's
 * vertex shader — a dozen texture reads apiece — though the most of a ring
 * is behind or beside the lens. A ring never reaches its centre (the finer
 * levels fill the hole), so a wedge behind the lens stands clear of the
 * view, where a quarter of the grid would always touch it. The ring's
 * triangles are laid wedge by wedge, twice round, so the wedges the view
 * reaches are ONE range of the index whichever way the lens looks: a level
 * is still one draw. Level 0, which the lens stands in, is drawn whole. */
export const TERRAIN_WEDGES = 16;

/** The wedge cell (`i`, `j`) of an `n` grid falls in, by the bearing of its
 * centre from the grid's. */
export function wedgeOf(n: number, i: number, j: number): number {
  const a = Math.atan2(j + 0.5 - n / 2, i + 0.5 - n / 2);
  return Math.min(TERRAIN_WEDGES - 1, Math.floor(((a + Math.PI) / (2 * Math.PI)) * TERRAIN_WEDGES));
}

/** A ring's triangles laid out by wedge. */
export type RingWedges = {
  /** Every wedge's triangles in turn, and all of them again: a run of
   * wedges round the ring, across where it closes, is one range. */
  index: Uint32Array;
  /** Where wedge `k` starts in `index`, for `k` up to twice round
   * (`2 · TERRAIN_WEDGES + 1` entries; the last is the index's end). */
  starts: number[];
  /** Each wedge's cells' extent in grid units: `i0, i1, j0, j1` a wedge. */
  bounds: Float64Array;
};

/** The ring of an `n` grid with the cells from `holeFrom` to `holeTo`
 * left out, laid out by wedge (`TERRAIN_WEDGES`). */
export function ringWedges(n: number, holeFrom: number, holeTo: number): RingWedges {
  const W = TERRAIN_WEDGES;
  const lists: number[][] = Array.from({ length: W }, () => []);
  const bounds = new Float64Array(W * 4);
  for (let w = 0; w < W; w++) bounds.set([Infinity, -Infinity, Infinity, -Infinity], w * 4);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (i >= holeFrom && i < holeTo && j >= holeFrom && j < holeTo) continue;
      const w = wedgeOf(n, i, j);
      const a = j * (n + 1) + i;
      const c = a + n + 1;
      lists[w].push(a, c, a + 1, a + 1, c, c + 1);
      bounds[w * 4] = Math.min(bounds[w * 4], i);
      bounds[w * 4 + 1] = Math.max(bounds[w * 4 + 1], i + 1);
      bounds[w * 4 + 2] = Math.min(bounds[w * 4 + 2], j);
      bounds[w * 4 + 3] = Math.max(bounds[w * 4 + 3], j + 1);
    }
  }
  const lap = lists.reduce((sum, l) => sum + l.length, 0);
  const index = new Uint32Array(2 * lap);
  const starts: number[] = [];
  let at = 0;
  for (const list of [...lists, ...lists]) {
    starts.push(at);
    index.set(list, at);
    at += list.length;
  }
  starts.push(at);
  return { index, starts, bounds };
}

/** A level's grid: `(n + 1)²` vertices at integer (x, z), with the cells
 * from `holeFrom` to `holeTo` (exclusive) on both axes left out. */
export function clipmapIndices(n: number, holeFrom: number, holeTo: number): Uint32Array {
  const out: number[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (i >= holeFrom && i < holeTo && j >= holeFrom && j < holeTo) continue;
      const a = j * (n + 1) + i;
      const b = a + 1;
      const c = a + n + 1;
      const d = c + 1;
      out.push(a, c, b, b, c, d);
    }
  }
  return new Uint32Array(out);
}

/** The `(n + 1)²` vertices every level of an `n` grid shares. */
function gridVertices(n: number): THREE.BufferAttribute {
  const pos = new Float32Array((n + 1) * (n + 1) * 3);
  let k = 0;
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      pos[k++] = i;
      pos[k++] = 0;
      pos[k++] = j;
    }
  }
  return new THREE.BufferAttribute(pos, 3);
}

/** The forest's density on the ground's grid, 0..1: every crown splatted
 * and blurred, so a wood past the trees' draw distance still darkens the
 * hillside it stands on. */
function forestDensity(level: Level): Float32Array {
  const f = level.ground;
  const out = new Float32Array(f.cols * f.rows);
  for (const t of level.trees) {
    const c = Math.round((t.x - f.originX) / f.cell);
    const r = Math.round((t.z - f.originZ) / f.cell);
    const reach = Math.max(1, Math.round(t.crown / f.cell));
    for (let dr = -reach; dr <= reach; dr++) {
      for (let dc = -reach; dc <= reach; dc++) {
        const cc = c + dc;
        const rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= f.cols || rr >= f.rows) continue;
        out[rr * f.cols + cc] += 0.35;
      }
    }
  }
  // Three box passes ≈ a gaussian a dozen metres wide.
  const tmp = new Float32Array(out.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let r = 0; r < f.rows; r++) {
      for (let c = 0; c < f.cols; c++) {
        let s = 0;
        let w = 0;
        for (let d = -3; d <= 3; d++) {
          const cc = c + d;
          if (cc < 0 || cc >= f.cols) continue;
          s += out[r * f.cols + cc];
          w++;
        }
        tmp[r * f.cols + c] = s / w;
      }
    }
    for (let r = 0; r < f.rows; r++) {
      for (let c = 0; c < f.cols; c++) {
        let s = 0;
        let w = 0;
        for (let d = -3; d <= 3; d++) {
          const rr = r + d;
          if (rr < 0 || rr >= f.rows) continue;
          s += tmp[rr * f.cols + c];
          w++;
        }
        out[r * f.cols + c] = s / w;
      }
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.min(1, out[i]);
  return out;
}

/** The corduroy's direction on the ground's grid, as the DOUBLED angle
 * (a comb line has no front and back), encoded 0..1 in RG, zero length off
 * the track; and in B how far up the plough's berm (R18) this cell stands,
 * 0 off it … 1 on its crest — the shape `bermProfile` gives the ground,
 * read here only to say what kind of snow it is. */
function trackDirection(level: Level): Uint8Array {
  const f = level.ground;
  const out = new Uint8Array(f.cols * f.rows * 4);
  const best = new Float32Array(f.cols * f.rows).fill(Infinity);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = 128;
    out[i + 1] = 128;
  }
  const toe = LEVEL_RULES.track.shoulder.flat;
  const bench = toe + LEVEL_RULES.berm.width;
  for (const p of level.track.points) {
    const reach = p.width / 2 + bench;
    const c0 = Math.floor((p.x - reach - f.originX) / f.cell);
    const c1 = Math.ceil((p.x + reach - f.originX) / f.cell);
    const r0 = Math.floor((p.z - reach - f.originZ) / f.cell);
    const r1 = Math.ceil((p.z + reach - f.originZ) / f.cell);
    const dx = Math.cos(2 * p.heading);
    const dz = Math.sin(2 * p.heading);
    for (let r = Math.max(0, r0); r <= Math.min(f.rows - 1, r1); r++) {
      for (let c = Math.max(0, c0); c <= Math.min(f.cols - 1, c1); c++) {
        const x = f.originX + c * f.cell;
        const z = f.originZ + r * f.cell;
        const d = Math.hypot(x - p.x, z - p.z);
        const k = r * f.cols + c;
        if (d > reach || d >= best[k]) continue;
        best[k] = d;
        out[k * 4] = Math.round((dx * 0.5 + 0.5) * 255);
        out[k * 4 + 1] = Math.round((dz * 0.5 + 0.5) * 255);
        out[k * 4 + 2] = Math.round(bermProfile(1, d - p.width / 2 - toe) * 255);
      }
    }
  }
  return out;
}

function groundTextures(level: Level) {
  const f = level.ground;
  const height = new THREE.DataTexture(f.data, f.cols, f.rows, THREE.RedFormat, THREE.FloatType);
  height.minFilter = THREE.NearestFilter;
  height.magFilter = THREE.NearestFilter;
  height.needsUpdate = true;

  const forest = forestDensity(level);
  const support = regionOf(level).crust?.packed ?? 0;
  const ground = new Uint16Array(f.cols * f.rows * 4);
  const h = THREE.DataUtils.toHalfFloat;
  for (let r = 0; r < f.rows; r++) {
    for (let c = 0; c < f.cols; c++) {
      const k = r * f.cols + c;
      const at = (cc: number, rr: number): number =>
        f.data[
          Math.min(f.rows - 1, Math.max(0, rr)) * f.cols + Math.min(f.cols - 1, Math.max(0, cc))
        ];
      const gx = (at(c + 1, r) - at(c - 1, r)) / (2 * f.cell);
      const gz = (at(c, r + 1) - at(c, r - 1)) / (2 * f.cell);
      const x = f.originX + c * f.cell;
      const z = f.originZ + r * f.cell;
      ground[k * 4] = h(gx);
      ground[k * 4 + 1] = h(gz);
      // The GROOMED share: the packed field less what the region laid
      // itself (R21), which the surface map carries instead.
      const packed = level.packed ? level.packed.data[k] : level.packedAt(x, z);
      const wild = Math.max(
        level.crust ? level.crust.data[k] * support : 0,
        level.ice ? level.ice.data[k] : 0,
      );
      ground[k * 4 + 2] = h(wild > 0 ? Math.max(0, packed - wild) : packed);
      ground[k * 4 + 3] = h(forest[k]);
    }
  }
  const groundTex = new THREE.DataTexture(
    ground,
    f.cols,
    f.rows,
    THREE.RGBAFormat,
    THREE.HalfFloatType,
  );
  groundTex.minFilter = THREE.LinearFilter;
  groundTex.magFilter = THREE.LinearFilter;
  groundTex.needsUpdate = true;

  const dir = new THREE.DataTexture(trackDirection(level), f.cols, f.rows, THREE.RGBAFormat);
  dir.minFilter = THREE.LinearFilter;
  dir.magFilter = THREE.LinearFilter;
  dir.needsUpdate = true;
  return { height, ground: groundTex, dir, surface: surfaceTexture(level) };
}

/** R21 — the wind crust (R) and the river's ice (G) on the ground's grid; a
 * single black texel where the region lays neither. */
function surfaceTexture(level: Level): THREE.DataTexture {
  const f = level.ground;
  const { crust, ice } = level;
  if (!crust && !ice) {
    const none = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
    none.needsUpdate = true;
    return none;
  }
  const data = new Uint8Array(f.cols * f.rows * 4);
  for (let k = 0; k < f.cols * f.rows; k++) {
    data[k * 4] = Math.round((crust ? crust.data[k] : 0) * 255);
    data[k * 4 + 1] = Math.round((ice ? ice.data[k] : 0) * 255);
  }
  const tex = new THREE.DataTexture(data, f.cols, f.rows, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function createTerrain(
  level: Level,
  haze: HazeUniforms,
  trail: TrailUniforms,
  options: TerrainOptions,
): Terrain {
  const group = new THREE.Group();
  const tex = groundTextures(level);
  const f = level.ground;
  const look = regionLookOf(regionOf(level).id);
  const wind = windFromOf(level);
  // THE TREE WELLS in deep powder (`tree-wells.ts`): their map, and the
  // wood drawn down into them.
  const wells = createTreeWells(level, haze);
  group.add(wells.group);
  const shared = {
    ...wells.uniforms,
    uHeight: { value: tex.height },
    uGround: { value: tex.ground },
    uTrackDir: { value: tex.dir },
    uSurface: { value: tex.surface },
    uForestTint: { value: new THREE.Vector3(...look.forestTint) },
    uCrustTone: { value: new THREE.Vector3(...look.crust) },
    uIceTone: { value: new THREE.Vector3(...look.ice) },
    uRock: { value: new THREE.Vector4(...(look.rock?.tone ?? [0, 0, 0]), look.rock ? 1 : 0) },
    uRockSlope: { value: new THREE.Vector2(look.rock?.from ?? 1, look.rock?.to ?? 2) },
    uSastrugi: { value: look.sastrugi },
    uWindDir: { value: new THREE.Vector2(Math.sin(wind), Math.cos(wind)) },
    uHeightOrigin: { value: new THREE.Vector2(f.originX, f.originZ) },
    uHeightCount: { value: new THREE.Vector2(f.cols, f.rows) },
    uCell: { value: f.cell },
    uGridHalf: { value: options.n / 2 },
    uBaseSpacing: { value: options.spacing },
  };
  const n = options.n;
  const vertices = gridVertices(n);
  const fullIndex = new THREE.BufferAttribute(clipmapIndices(n, 0, 0), 1);
  const wedges = ringWedges(n, n / 4 + 1, (3 * n) / 4 - 1);
  const ringIndex = new THREE.BufferAttribute(wedges.index, 1);
  const W = TERRAIN_WEDGES;
  // HOW HIGH THE GROUND UNDER A WEDGE STANDS: the lowest and highest of the
  // heightfield over blocks of `BLOCK` samples, so a wedge's box spans the
  // ground under it and not the whole mountain's kilometre — a box that
  // tall passes the frustum's test whichever way the lens looks.
  const BLOCK = 32;
  const bc = Math.ceil(f.cols / BLOCK);
  const br = Math.ceil(f.rows / BLOCK);
  const blockLow = new Float32Array(bc * br).fill(Infinity);
  const blockHigh = new Float32Array(bc * br).fill(-Infinity);
  for (let r = 0; r < f.rows; r++) {
    for (let c = 0; c < f.cols; c++) {
      const b = Math.floor(r / BLOCK) * bc + Math.floor(c / BLOCK);
      const y = f.data[r * f.cols + c];
      blockLow[b] = Math.min(blockLow[b], y);
      blockHigh[b] = Math.max(blockHigh[b], y);
    }
  }
  const span = { low: 0, high: 0 };
  /** The ground's heights over the plan [x0, x1] × [z0, z1], m, with a
   * furrow's depth under them and the loose cover over them — and, where
   * the plan runs off the map, the rim's rise over the edge (`rimRise`,
   * under 370 m). */
  const heightsOver = (x0: number, z0: number, x1: number, z1: number): typeof span => {
    // The samples either side of each edge: the ground between two is
    // their blend, never outside them.
    const cell = (v: number, origin: number, count: number, up: number): number =>
      Math.min(count - 1, Math.max(0, Math.floor((v - origin) / f.cell) + up));
    const c0 = cell(x0, f.originX, f.cols, 0);
    const c1 = cell(x1, f.originX, f.cols, 1);
    const r0 = cell(z0, f.originZ, f.rows, 0);
    const r1 = cell(z1, f.originZ, f.rows, 1);
    span.low = Infinity;
    span.high = -Infinity;
    for (let r = Math.floor(r0 / BLOCK); r <= Math.floor(r1 / BLOCK); r++) {
      for (let c = Math.floor(c0 / BLOCK); c <= Math.floor(c1 / BLOCK); c++) {
        span.low = Math.min(span.low, blockLow[r * bc + c]);
        span.high = Math.max(span.high, blockHigh[r * bc + c]);
      }
    }
    const off =
      x0 < f.originX ||
      z0 < f.originZ ||
      x1 > f.originX + (f.cols - 1) * f.cell ||
      z1 > f.originZ + (f.rows - 1) * f.cell;
    span.low -= 5;
    span.high += off ? 380 : 5;
    return span;
  };

  type LevelMesh = {
    mesh: THREE.Mesh;
    spacing: number;
    centre: THREE.Vector2;
    hole: THREE.Vector4;
  };
  const levels: LevelMesh[] = [];
  for (let l = 0; l < options.levels; l++) {
    const spacing = options.spacing * 2 ** l;
    const centre = new THREE.Vector2();
    const hole = new THREE.Vector4(0, 0, 0, 0);
    const own = {
      uLevelCentre: { value: centre },
      uSpacing: { value: spacing },
      uHole: { value: hole },
    };
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0,
    });
    hazeMaterial(material, haze, "terrain", (shader) => {
      Object.assign(shader.uniforms, shared, own, trail);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${SNOW_VERTEX_PARS}`)
        .replace("#include <beginnormal_vertex>", SNOW_VERTEX_PLACE)
        .replace("#include <begin_vertex>", SNOW_VERTEX_BEGIN);
      // The snow lights itself by the lamps, glitter and all.
      shader.fragmentShader = `#define OWN_LAMPS\n${shader.fragmentShader}`
        .replace("#include <common>", `#include <common>\n${SNOW_FRAGMENT_PARS}`)
        .replace(
          "#include <clipping_planes_fragment>",
          `#include <clipping_planes_fragment>\n${SNOW_FRAGMENT_SAMPLE}`,
        )
        .replace("#include <color_fragment>", `#include <color_fragment>\n${SNOW_FRAGMENT_COLOUR}`)
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>\n${SNOW_FRAGMENT_ROUGHNESS}`,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>\n${SNOW_FRAGMENT_NORMAL}`,
        )
        .replace(
          "#include <lights_fragment_end>",
          `#include <lights_fragment_end>\n${SNOW_FRAGMENT_LIGHT}`,
        );
    });
    // Every level its own geometry over the shared buffers, so each can
    // draw its own range of the wedges.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", vertices);
    geometry.setIndex(l === 0 ? fullIndex : ringIndex);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    levels.push({ mesh, spacing, centre, hole });
  }

  const frustum = new THREE.Frustum();
  const view = new THREE.Matrix4();
  const box = new THREE.Box3();
  const half = n / 2;
  const seen: boolean[] = new Array<boolean>(W).fill(true);
  /** Draw only the wedges of a ring the view reaches — each one's cells'
   * plan, a cell wider each way for the rim's morph, over the heights of
   * the ground under it — as the one run of wedges round the ring that holds
   * them all: the ring less its longest unseen stretch. Without a lens,
   * the ring whole (the compile's). */
  const aim = (lv: LevelMesh, lens: THREE.Camera | undefined): void => {
    const geometry = lv.mesh.geometry;
    lv.mesh.visible = true;
    if (!lens) {
      geometry.setDrawRange(0, wedges.starts[W]);
      return;
    }
    let any = false;
    for (let w = 0; w < W; w++) {
      const b = wedges.bounds;
      if (!(b[w * 4] < b[w * 4 + 1])) {
        seen[w] = false;
        continue;
      }
      const x0 = lv.centre.x + (b[w * 4] - half - 1) * lv.spacing;
      const x1 = lv.centre.x + (b[w * 4 + 1] - half + 1) * lv.spacing;
      const z0 = lv.centre.y + (b[w * 4 + 2] - half - 1) * lv.spacing;
      const z1 = lv.centre.y + (b[w * 4 + 3] - half + 1) * lv.spacing;
      const { low, high } = heightsOver(x0, z0, x1, z1);
      box.min.set(x0, low, z0);
      box.max.set(x1, high, z1);
      seen[w] = frustum.intersectsBox(box);
      any ||= seen[w];
    }
    if (!any) {
      lv.mesh.visible = false;
      return;
    }
    // The longest run of unseen wedges, round the ring's close.
    let gap = 0;
    let gapEnd = -1;
    for (let w = 0, run = 0; w < 2 * W; w++) {
      run = seen[w % W] ? 0 : run + 1;
      if (run > gap && run <= W) {
        gap = run;
        gapEnd = w % W;
      }
    }
    const from = gap === 0 ? 0 : (gapEnd + 1) % W;
    const to = from + W - gap;
    geometry.setDrawRange(wedges.starts[from], wedges.starts[to] - wedges.starts[from]);
  };
  return {
    group,
    follow(x, z, lens) {
      wells.follow(x, z);
      if (lens) {
        view.multiplyMatrices(lens.projectionMatrix, lens.matrixWorldInverse);
        frustum.setFromProjectionMatrix(view);
      }
      for (let l = 0; l < levels.length; l++) {
        const lv = levels[l];
        const snap = lv.spacing * 2;
        lv.centre.set(Math.round(x / snap) * snap, Math.round(z / snap) * snap);
        if (l > 0) {
          const finer = levels[l - 1];
          // Half a finer cell short of the finer level's edge: the two
          // overlap on a strip where the finer one is fully morphed, so
          // they are the same surface there and — shaded per pixel off the
          // world position — draw the same colour; without it, float
          // rounding between two grids opens pinholes along the seam.
          lv.hole.set(finer.centre.x, finer.centre.y, (options.n / 2 - 0.5) * finer.spacing, 1);
        }
        if (l > 0) aim(lv, lens);
      }
    },
    dispose() {
      for (const lv of levels) {
        lv.mesh.geometry.dispose();
        (lv.mesh.material as THREE.Material).dispose();
      }
      wells.dispose();
      tex.height.dispose();
      tex.ground.dispose();
      tex.dir.dispose();
      tex.surface.dispose();
    },
  };
}
