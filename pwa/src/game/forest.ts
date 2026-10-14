// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WOODS — every trunk the generator stood (`Level.trees`, the ones a
// skier can hit), drawn as the kind of tree it is (`TreeDef.kind`: spruce,
// fir, pine, larch, birch…) in one of that kind's VARIANTS
// (`tree-variants.ts`), scaled to its own height and crown, turned, leant
// and tinted by a hash of where it stands — and its trunk drawn to its own
// GIRTH, the engine's `TreeDef.radius`, which is its AGE (R14).
//
// SHAPED ON THE CARD. No tree here is a mesh. Every tree is four texels of
// a table sent once a map (`tree-table.ts`: its matrix, girth, variant and
// how exposed it stands), every variant a row of another (its silhouette,
// its form's knobs, its kind's paint), and the only meshes are a handful of
// TEMPLATES (`tree-templates.ts`) — one a family (the skirted conifers, the
// pines, the bare larches and snags, the broadleaves) a cut — whose
// corners carry no position at all, only what they are. The vertex shader
// (`tree-glsl.ts`) reads the tree and its variant and puts each corner
// where THAT tree has it: its own tier count, every bough's reach, droop
// and snow, its own snow load, its boughs flagged to the lee near the tree
// line, and the wind in all of it. So a band is one draw a family, the
// casters one a family, and no two trees on the mountain are the same tree.
//
// HOW MANY VARIANTS is the FOREST row's (`FOREST_LOOK[row].variants`): all
// ten of every kind at HIGH, five at MEDIUM, two at LOW — and the row cuts
// the lens's template finer or coarser with them (`qualityOf`), so a
// cheaper picture shapes fewer tiers a tree and the wood is still the same
// wood.
//
// THREE BANDS of distance, the same tree in each a coarser template (FULL
// at the lens, MID, FAR a sketch). The trees are binned into 64 m cells
// once; when the lens moves, the cells in reach are tested against the
// view frustum and their trees' numbers copied into the bands' lists. No
// band ends at a line: over the last stretch of each a tree is drawn in
// both cuts, dithered into one another (`tree-bands.ts`). Past the far
// band the terrain's own forest tint (`snow-glsl.ts`) carries the woods to
// the ridge.
//
// THE SHADOWS ARE A THIRD SET, NOT A BAND. No band casts. Every tree whose
// shadow can land in the sun's circle (`shadow-box.ts`'s `castsInto`) is
// copied into a CASTER set drawn only into the shadow map, its family's
// MID template or its sketch as the FOREST row says, shaped by the same
// shader — so a shadow sways with its tree.

import * as THREE from "three";
import { felledTrees, regionOf, treeLineY, windFromOf, type Level, type Vec3 } from "@engine";

import type { HazeUniforms } from "./haze.ts";
import type { ForestLook, TreeCasters } from "./settings-video.ts";
import { castsInto, shadowLength, type ShadowBox } from "./shadow-box.ts";
import { regionLookOf } from "./region-look.ts";
import { createRocks } from "./rocks.ts";
import { TRUNK_REF } from "./tree-mesh.ts";
import { summerShown } from "./season-look.ts";
import { kindPaint, summerPaint, treePaint } from "./tree-shapes.ts";
import { HYSTERESIS, createHandOver, handOver, type TreeDraw } from "./tree-bands.ts";
import { treeTilt, trunkYaw } from "./tree-tilt.ts";
import { crownAt, leadVariant, treeVariant, type TreeVariant } from "./tree-variants.ts";
import {
  FAMILIES,
  KIND_ORDER,
  TREE_TEXELS,
  TREE_TEX_W,
  VARIANT_TEXELS,
  familyOf,
  packTree,
  treeRows,
  variantRow,
  variantTable,
} from "./tree-table.ts";
import { buildTemplate, farQuad, type Cut, type Template } from "./tree-templates.ts";
import { farMaterial } from "./tree-far.ts";
import { casterMaterial, createTreeUniforms, treeDepth, treeMaterial } from "./tree-shader.ts";
import { VARIANTS } from "./tree-variants.ts";

/** Where the bands end (the FOREST row's `full` and `mid`, the DISTANCE
 * row's `far`, all m), how far the crags stand (the DISTANCE row's `view`),
 * the share of the far band's sketches that stand, how many variants of
 * each kind are drawn, and what the trees cast (the FOREST row's cut, or
 * none unless SHADOWS is ALL) — `settings-video.ts` says what each stop
 * buys. */
export type ForestOptions = Omit<ForestLook, "casters"> & {
  far: number;
  view: number;
  casters: TreeCasters | "none";
};

const CELL = 64;

function hash(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** How finely the lens's template is cut for a FOREST row's variants. */
function qualityOf(variants: number): number {
  return variants >= 10 ? 2 : variants >= 5 ? 1 : 0;
}

/** How close the lens may come to a drawn crown before the tree is taken
 * out of the picture once it is behind (`LENS_BEHIND`), m. */
export const LENS_CLEAR = 2.4;

/** How far behind the lens, m along its look in plan, a trunk must be
 * before its tree is taken out of the picture: one coming at the lens, or
 * one the lens is passing through, stays drawn. */
export const LENS_BEHIND = 1;

/** Whether the lens at `x`, `z`, `y` is within `LENS_CLEAR` of the tree as
 * drawn — its variant's crown at that height, or its bare trunk under the
 * lowest bough — round its axis as it LEANS (`lx`, `lz`: the axis's shift
 * in plan a metre up). */
function atLens(
  t: Level["trees"][number],
  v: TreeVariant,
  x: number,
  z: number,
  y: number,
  lx: number,
  lz: number,
): boolean {
  const f = (y - t.y) / t.height;
  if (f > 1.05) return false;
  const up = Math.max(0, y - t.y);
  const d = Math.hypot(x - t.x - lx * up, z - t.z - lz * up);
  const crown = t.crown * 0.95 * crownAt(v, Math.max(0, f));
  return d - Math.max(t.radius, crown) < LENS_CLEAR;
}

/** How far the lens has to stand from a tree before it cannot be inside
 * it, m — past this, `atLens` is not asked. */
const LENS_REACH = 24;

/** How far under the tree line, m, a tree starts to stand EXPOSED. */
const EXPOSED_BELOW = 160;

export type Forest = {
  group: THREE.Group;
  /** Refill the bands for `camera`, and the casters for `shadow` (null:
   * nothing casts). */
  update(camera: THREE.PerspectiveCamera, shadow: ShadowBox | null): void;
  /** THE WIND in the boughs: where the air goes (m/s in plan) at run time
   * `t`. */
  setWind(x: number, z: number, t: number): void;
  /** Force the next update to recompute (a new frame of reference). */
  invalidate(): void;
  /** New bands (a picture row moved); takes effect on the next update. */
  setOptions(next: ForestOptions): void;
  /** THE VIEW ALOFT (`view-aloft.ts`): the woods out to `far` m in plan,
   * each tree's cut chosen at its slant distance from a lens `lift` m over
   * the snow, the crags out to `view` m — none of it under the row's own. */
  setAloft(far: number, lift: number, view: number): void;
  dispose(): void;
};

/** One family's draw in one set: the template instanced over the trees
 * listed in its `tree` attribute (the tree's number and its dither
 * window). */
type Draw = {
  mesh: THREE.Mesh;
  geometry: THREE.InstancedBufferGeometry;
  list: Float32Array;
  attr: THREE.InstancedBufferAttribute;
  fill: number;
  /** The first slot this refill wrote anything new into. */
  from: number;
};

export function createForest(level: Level, haze: HazeUniforms, initial: ForestOptions): Forest {
  let options = { ...initial };
  const aloft = { far: options.far, lift: 0, view: options.view };
  const edges = { full: 0, mid: 0, far: 0 };
  const group = new THREE.Group();
  // THE CRAGS on the drops stand with the woods, out to the whole view.
  const rocks = createRocks(level, haze, options.farShare);
  group.add(rocks.group);
  const count = level.trees.length;
  // Binned by cell — and every tree NUMBERED in bin order, so a cell's
  // trees stand side by side in memory and in the table the shader reads.
  const cols = Math.ceil(level.size / CELL);
  const binOf = (t: Level["trees"][number]): number => {
    const c = Math.min(cols - 1, Math.max(0, Math.floor(t.x / CELL)));
    const r = Math.min(cols - 1, Math.max(0, Math.floor(t.z / CELL)));
    return r * cols + c;
  };
  const binStart = new Int32Array(cols * cols + 1);
  for (const t of level.trees) binStart[binOf(t) + 1]++;
  for (let b = 0; b < cols * cols; b++) binStart[b + 1] += binStart[b];
  const trees: Level["trees"] = new Array(count);
  const rank = new Int32Array(count);
  {
    const at = binStart.slice(0, cols * cols);
    level.trees.forEach((t, k) => {
      const i = at[binOf(t)]++;
      trees[i] = t;
      rank[k] = i;
    });
  }
  const xs = new Float64Array(count);
  const zs = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    xs[i] = trees[i].x;
    zs[i] = trees[i].z;
  }
  const thin = new Float32Array(count);
  const leans = new Float32Array(count * 2);
  const felled = felledTrees(level);
  const gone = new Uint8Array(count);
  for (let k = 0; k < count; k++) gone[rank[k]] = felled[k];

  // THE TREE TABLE: every tree's four texels, sent once a map — the row a
  // variant is rewritten when the FOREST row changes how many it draws.
  const rows = treeRows(count);
  const treeData = new Float32Array(TREE_TEX_W * rows * 4);
  const treeTex = new THREE.DataTexture(
    treeData,
    TREE_TEX_W,
    rows,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  treeTex.magFilter = THREE.NearestFilter;
  treeTex.minFilter = THREE.NearestFilter;
  treeTex.generateMipmaps = false;
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const lean = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const across = new THREE.Vector3();
    const ground: Vec3 = { x: 0, y: 1, z: 0 };
    const line = treeLineY(level);
    for (let i = 0; i < count; i++) {
      const t = trees[i];
      thin[i] = hash(t.x * 1.7 + 11, t.z * 0.6 - 5);
      // Turned about its own axis, then LEANT off plumb about its foot
      // (`tree-tilt.ts`): mostly a few degrees, mostly down the slope.
      level.normalAt(t.x, t.z, ground);
      const tilt = treeTilt(
        t.x,
        t.z,
        leadVariant(t.kind ?? "spruce").shape.form,
        ground.x,
        ground.z,
      );
      across.set(tilt.dz, 0, -tilt.dx);
      lean.setFromAxisAngle(across, tilt.angle);
      q.setFromAxisAngle(up, trunkYaw(t.x, t.z)).premultiply(lean);
      const reach = Math.tan(tilt.angle);
      leans[i * 2] = tilt.dx * reach;
      leans[i * 2 + 1] = tilt.dz * reach;
      // A touch narrower than the collision's crown, so a wood keeps its
      // gaps — and every tree a little broader or slimmer and a little oval.
      const broad = 0.86 + 0.18 * hash(t.x * 0.37 + 3, t.z * 1.9);
      const oval = 0.9 + 0.2 * hash(t.x * 2.3, t.z * 0.41 - 7);
      s.set(t.crown * 0.95 * broad * oval, t.height, (t.crown * 0.95 * broad) / oval);
      // Sunk a little, so a tree on a slope stands in the snow — and a
      // leaning one by as much again as its flared foot rises.
      p.set(t.x, t.y - 0.3 - t.radius * 1.45 * Math.sin(tilt.angle), t.z);
      m.compose(p, q, s);
      // EXPOSED: the last stretch under the tree line, flagged and stripped.
      const exposure = Math.min(1, Math.max(0, 1 - (line - t.y) / EXPOSED_BELOW));
      packTree(
        treeData,
        i,
        m.elements,
        t.radius / (TRUNK_REF * s.x),
        t.radius / (TRUNK_REF * s.z),
        0,
        exposure,
      );
    }
  }
  const binTop = new Float32Array(cols * cols).fill(-Infinity);
  const binLow = new Float32Array(cols * cols).fill(Infinity);
  const binLean = new Float32Array(cols * cols);
  for (let b = 0; b < cols * cols; b++) {
    for (let i = binStart[b]; i < binStart[b + 1]; i++) {
      binTop[b] = Math.max(binTop[b], trees[i].y + trees[i].height);
      binLow[b] = Math.min(binLow[b], trees[i].y);
      binLean[b] = Math.max(
        binLean[b],
        trees[i].height * Math.hypot(leans[i * 2], leans[i * 2 + 1]),
      );
    }
  }

  // THE VARIANT TABLE, painted by the region and the season.
  const leaf = summerShown();
  const region = treePaint(regionLookOf(regionOf(level).id));
  const paint = leaf ? summerPaint(region) : region;
  const variantTex = new THREE.DataTexture(
    variantTable((kind) => kindPaint(paint, kind)),
    VARIANT_TEXELS,
    KIND_ORDER.length * VARIANTS,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  variantTex.magFilter = THREE.NearestFilter;
  variantTex.minFilter = THREE.NearestFilter;
  variantTex.generateMipmaps = false;
  variantTex.needsUpdate = true;

  const uniforms = createTreeUniforms();
  uniforms.uTrees.value = treeTex;
  uniforms.uVariants.value = variantTex;
  {
    const from = windFromOf(level);
    // The air goes toward the bearing opposite the one it blows from.
    uniforms.uTreeLee.value.set(-Math.sin(from), -Math.cos(from));
  }
  const casterMat = casterMaterial();

  type Shapes = {
    variants: number;
    variantOf: TreeVariant[];
    /** Each tree's family, as an index into `FAMILIES`. */
    family: Uint8Array;
    full: Draw[];
    mid: Draw[];
    far: Draw[];
    casters: { full: Draw[]; sketch: Draw[] };
    templates: Template[];
    materials: THREE.Material[];
    quads: THREE.BufferGeometry[];
  };

  /** A family's draw of template `t`, room for `room` trees. */
  function makeDraw(
    src: THREE.BufferGeometry,
    room: number,
    material: THREE.Material,
    caster: boolean,
  ): Draw {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute("position", src.getAttribute("position"));
    geometry.setAttribute("tv", src.getAttribute("tv"));
    geometry.setIndex(src.getIndex());
    geometry.boundingSphere = src.boundingSphere;
    const list = new Float32Array(Math.max(1, room) * 3);
    const attr = new THREE.InstancedBufferAttribute(list, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("tree", attr);
    geometry.instanceCount = 0;
    const mesh = new THREE.Mesh(geometry, caster ? casterMat : material);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.castShadow = caster;
    mesh.receiveShadow = !caster;
    if (caster) mesh.customDepthMaterial = material as THREE.MeshDepthMaterial;
    group.add(mesh);
    return { mesh, geometry, list, attr, fill: 0, from: 0 };
  }

  /** THE SHAPES for `variants` of every kind: which variant every tree is
   * (its row of the table rewritten), and the family's draws at each cut. */
  function buildShapes(variants: number): Shapes {
    const variantOf: TreeVariant[] = new Array<TreeVariant>(count);
    const family = new Uint8Array(count);
    const room = FAMILIES.map(() => 0);
    for (let i = 0; i < count; i++) {
      const t = trees[i];
      const v = treeVariant(t.kind ?? "spruce", t.x, t.z, variants);
      variantOf[i] = v;
      const f = FAMILIES.indexOf(familyOf(v));
      family[i] = f;
      treeData[i * TREE_TEXELS * 4 + 14] = variantRow(v);
      if (!gone[i]) room[f]++;
    }
    treeTex.needsUpdate = true;
    const quality = qualityOf(variants);
    const templates: Template[] = [];
    const quads: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const set = (cut: Cut, caster: boolean): Draw[] =>
      FAMILIES.map((fam, f) => {
        const t = buildTemplate(fam, cut, quality, leaf);
        templates.push(t);
        const mat = caster ? treeDepth(t, haze, uniforms) : treeMaterial(t, haze, uniforms);
        materials.push(mat);
        return makeDraw(t.geometry, room[f], mat, caster);
      });
    // THE FAR BAND is one draw for every family: a quad a tree, ray-cast.
    const quad = farQuad();
    const farMat = farMaterial(haze, uniforms);
    materials.push(farMat);
    const farDraw = makeDraw(
      quad,
      room.reduce((a, b) => a + b, 0),
      farMat,
      false,
    );
    quads.push(quad);
    return {
      variants,
      variantOf,
      family,
      full: set(0, false),
      mid: set(1, false),
      far: FAMILIES.map(() => farDraw),
      casters: { full: set(1, true), sketch: set(2, true) },
      templates,
      materials,
      quads,
    };
  }

  function dropShapes(old: Shapes): void {
    for (const draws of [old.full, old.mid, old.far, old.casters.full, old.casters.sketch]) {
      for (const d of draws) {
        group.remove(d.mesh);
        d.geometry.dispose();
      }
    }
    for (const t of old.templates) t.geometry.dispose();
    for (const q of old.quads) q.dispose();
    for (const m of old.materials) m.dispose();
  }

  let shapes = buildShapes(options.variants);
  let tallest = 0;
  for (const t of trees) tallest = Math.max(tallest, t.height);
  let widest = 0;
  trees.forEach((t, i) => {
    widest = Math.max(widest, t.crown + t.height * Math.hypot(leans[i * 2], leans[i * 2 + 1]));
  });

  const frustum = new THREE.Frustum();
  const box = new THREE.Box3();
  const pv = new THREE.Matrix4();
  const look = new THREE.Vector3();
  const lastAt = new THREE.Vector3(Infinity, 0, 0);
  const lastLook = new THREE.Vector3();
  let lastFov = 0;
  let lastFar = 0;
  const lastShadow: ShadowBox = { x: Infinity, y: 0, z: 0, reach: 0, sx: 0, sy: 0, sz: 0 };
  let castersOn = false;

  /** Tree `i` into `draws` (its family's), keeping the dither window
   * `[lo, hi)` — only a slot that changed is marked to be sent. */
  function place(draws: Draw[], i: number, lo: number, hi: number) {
    if (hi <= lo) return;
    const d = draws[shapes.family[i]];
    const k = d.fill++;
    const o = k * 3;
    const l = d.list;
    if (l[o] === i && l[o + 1] === lo && l[o + 2] === hi) return;
    l[o] = i;
    l[o + 1] = lo;
    l[o + 2] = hi;
    if (k < d.from) d.from = k;
  }

  /** Send what changed of each draw, and show the ones with trees. */
  function flush(draws: Draw[]): void {
    for (const d of draws) {
      const n = d.fill;
      d.geometry.instanceCount = n;
      d.mesh.visible = n > 0;
      if (n === 0 || d.from >= n) continue;
      d.attr.clearUpdateRanges();
      d.attr.addUpdateRange(d.from * 3, (n - d.from) * 3);
      d.attr.needsUpdate = true;
    }
  }

  const hand = createHandOver(count);
  const draw: TreeDraw = { from: -1, band: -1, split: 0 };
  let tick = 1;
  let dissolving = false;

  /** Refill the casters: every tree whose shadow can reach the circle. */
  function fillCasters(shadow: ShadowBox | null) {
    const into =
      !shadow || options.casters === "none"
        ? null
        : options.casters === "full"
          ? shapes.casters.full
          : shapes.casters.sketch;
    for (const draws of [shapes.casters.full, shapes.casters.sketch]) {
      for (const d of draws) {
        d.fill = 0;
        d.from = Infinity;
      }
    }
    if (shadow && into) {
      const plan = Math.hypot(shadow.sx, shadow.sz);
      const tail = plan > 1e-6 ? shadowLength(shadow, tallest) : 0;
      const ux = plan > 1e-6 ? shadow.sx / plan : 0;
      const uz = plan > 1e-6 ? shadow.sz / plan : 0;
      const r = shadow.reach + widest;
      const x0 = Math.min(shadow.x, shadow.x + ux * tail) - r;
      const x1 = Math.max(shadow.x, shadow.x + ux * tail) + r;
      const z0 = Math.min(shadow.z, shadow.z + uz * tail) - r;
      const z1 = Math.max(shadow.z, shadow.z + uz * tail) + r;
      const cMin = Math.max(0, Math.floor(x0 / CELL));
      const cMax = Math.min(cols - 1, Math.floor(x1 / CELL));
      const rMin = Math.max(0, Math.floor(z0 / CELL));
      const rMax = Math.min(cols - 1, Math.floor(z1 / CELL));
      for (let row = rMin; row <= rMax; row++) {
        for (let c = cMin; c <= cMax; c++) {
          const b = row * cols + c;
          for (let i = binStart[b]; i < binStart[b + 1]; i++) {
            if (gone[i]) continue;
            const t = trees[i];
            const crown = t.crown + t.height * Math.hypot(leans[i * 2], leans[i * 2 + 1]);
            if (!castsInto(shadow, t.x, t.z, t.height, crown)) continue;
            place(into, i, 0, 1);
          }
        }
      }
    }
    flush(shapes.casters.full);
    flush(shapes.casters.sketch);
  }

  return {
    group,
    update(camera, shadow) {
      rocks.update(camera.position, aloft.view);
      if (
        (shadow !== null) !== castersOn ||
        (shadow &&
          ((shadow.x - lastShadow.x) ** 2 + (shadow.z - lastShadow.z) ** 2 > 1 ||
            shadow.sx * lastShadow.sx + shadow.sy * lastShadow.sy + shadow.sz * lastShadow.sz <
              0.99999 ||
            shadow.reach !== lastShadow.reach))
      ) {
        castersOn = shadow !== null;
        if (shadow) Object.assign(lastShadow, shadow);
        fillCasters(shadow);
      }
      camera.getWorldDirection(look);
      if (
        !dissolving &&
        camera.position.distanceToSquared(lastAt) < 0.5 &&
        look.dot(lastLook) > 0.9998 &&
        camera.fov === lastFov &&
        aloft.far === lastFar
      ) {
        return;
      }
      lastAt.copy(camera.position);
      lastLook.copy(look);
      lastFov = camera.fov;
      lastFar = aloft.far;
      pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(pv);
      const cx = camera.position.x;
      const cy = camera.position.y;
      const cz = camera.position.z;
      const { full, mid, far } = shapes;
      for (const draws of [full, mid, far]) {
        for (const d of draws) {
          d.fill = 0;
          d.from = Infinity;
        }
      }
      const lift = aloft.lift;
      const lift2 = lift * lift;
      edges.full = options.full;
      edges.mid = options.mid;
      edges.far = lift > 0 ? Math.hypot(aloft.far, lift) + 2 * HYSTERESIS : aloft.far;
      const reach = Math.ceil(aloft.far / CELL) + 1;
      const c0 = Math.floor(cx / CELL);
      const r0 = Math.floor(cz / CELL);
      const lens2 = LENS_REACH * LENS_REACH;
      const plan = Math.hypot(look.x, look.z);
      const ux = plan > 1e-6 ? look.x / plan : 0;
      const uz = plan > 1e-6 ? look.z / plan : 0;
      const far2 = aloft.far * aloft.far;
      const bands = [full, mid, far];
      const now = performance.now();
      tick++;
      dissolving = false;
      for (let r = Math.max(0, r0 - reach); r <= Math.min(cols - 1, r0 + reach); r++) {
        for (let c = Math.max(0, c0 - reach); c <= Math.min(cols - 1, c0 + reach); c++) {
          const b = r * cols + c;
          const lo = binStart[b];
          const hi = binStart[b + 1];
          if (lo === hi) continue;
          const pad = 8 + binLean[b];
          box.min.set(c * CELL - pad, binLow[b] - 2, r * CELL - pad);
          box.max.set((c + 1) * CELL + pad, binTop[b] + 2, (r + 1) * CELL + pad);
          const dx = Math.max(box.min.x - cx, 0, cx - box.max.x);
          const dz = Math.max(box.min.z - cz, 0, cz - box.max.z);
          if (dx * dx + dz * dz > far2) continue;
          if (!frustum.intersectsBox(box)) continue;
          for (let i = lo; i < hi; i++) {
            // A tree felled for the village or a building's site is drawn
            // as nothing (`felledTrees`).
            if (gone[i]) continue;
            const e2 = (xs[i] - cx) ** 2 + (zs[i] - cz) ** 2;
            // THE TREES AT THE LENS are drawn while they come at it and
            // while it passes through them; only once the trunk is
            // `LENS_BEHIND` behind the lens is a tree whose crown is still
            // at it taken out of the picture. Its caster stays.
            if (
              e2 < lens2 &&
              (xs[i] - cx) * ux + (zs[i] - cz) * uz < -LENS_BEHIND &&
              atLens(trees[i], shapes.variantOf[i], cx, cz, cy, leans[i * 2], leans[i * 2 + 1])
            )
              continue;
            const inFar = thin[i] < options.farShare;
            const d = Math.sqrt(lift > 0 ? e2 + lift2 : e2);
            if (handOver(hand, i, d, lift > 0 ? edges : options, inFar, now, tick, draw)) {
              dissolving = true;
            }
            if (draw.from >= 0) place(bands[draw.from], i, 0, draw.split);
            if (draw.band >= 0) place(bands[draw.band], i, draw.split, 1);
          }
        }
      }
      for (const draws of bands) flush(draws);
    },
    setWind(x, z, t) {
      const speed = Math.hypot(x, z);
      const w = uniforms.uTreeWind.value;
      if (speed > 1e-3) w.set(x / speed, z / speed, speed, t);
      else w.set(w.x, w.y, 0, t);
    },
    invalidate() {
      tick++;
      lastAt.set(Infinity, 0, 0);
      lastShadow.x = Infinity;
    },
    setAloft(far, lift, view) {
      aloft.far = Math.max(far, options.far);
      aloft.lift = lift;
      aloft.view = Math.max(view, options.view);
    },
    setOptions(next) {
      if (next.variants !== options.variants) {
        dropShapes(shapes);
        shapes = buildShapes(next.variants);
      }
      options = { ...next };
      Object.assign(aloft, { far: options.far, lift: 0, view: options.view });
      rocks.setShare(options.farShare);
      tick++;
      lastAt.set(Infinity, 0, 0);
      lastShadow.x = Infinity;
    },
    dispose() {
      rocks.dispose();
      dropShapes(shapes);
      casterMat.dispose();
      treeTex.dispose();
      variantTex.dispose();
    },
  };
}
