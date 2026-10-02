// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WOODS — every trunk the generator stood (`Level.trees`, the ones a
// skier can hit), drawn as the kind of tree it is (`TreeDef.kind`: spruce,
// fir, pine, larch, birch) in one of that kind's TEN VARIANTS
// (`tree-variants.ts` — the dense spire, the self-pruned stand tree, the
// snow ghost, the pine's umbrella, the mountain birch's three stems…),
// chosen by a hash of where it stands, scaled to its own height and crown,
// and turned and tinted by another. The shapes are the MODELLED trees
// (`tree-models.ts`: every variant made in Blender off the same rows) and,
// for a kind with no model loaded or a build switched back to them
// (`VITE_MODEL_TREES=0`), the code's own (`tree-shapes.ts`) — built once per
// map either way, painted by the region (`region-look.ts`); only the kinds
// and variants a map grows are built.
//
// TENS OF THOUSANDS OF THEM, so they are instanced — one instanced mesh a
// variant, each sized to the trees it draws — and in two bands of distance:
// FULL (the whole tree) and FAR (a sketch of it at a fraction of the
// triangles, two a kind). The trees are binned into 64 m cells once; when
// the lens moves, the cells in reach are tested against the view frustum
// and their trees are copied into the bands' instance buffers. Past the far
// band the terrain's own forest tint (`snow-glsl.ts`) carries the woods to
// the ridge.
//
// THE SHADOWS ARE A THIRD SET, NOT A BAND. No band casts. Every tree whose
// shadow can land in the sun's circle (`shadow-box.ts`'s `castsInto`) is
// copied into a CASTER set drawn only into the shadow map — whatever band
// the picture draws it in, in front of the lens or behind it. So a wood's
// shadows are all there or fading out at the circle's rim together, and
// none of them is switched on by riding closer to its tree.

import * as THREE from "three";
import { regionOf, type Level } from "@engine";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { shadeDepth } from "./terrain-shade.ts";
import type { ForestLook, TreeCasters } from "./settings-video.ts";
import { castsInto, shadowLength, type ShadowBox } from "./shadow-box.ts";
import { regionLookOf } from "./region-look.ts";
import { treeModel } from "./tree-models.ts";
import { buildTree, treePaint } from "./tree-shapes.ts";
import { VARIANTS, crownAt, leadVariant, treeVariant, type TreeVariant } from "./tree-variants.ts";

/** Where the two bands end (the FOREST row's `full`, the DISTANCE row's
 * `far`, both m), the share of the far band's sketches that stand, how many
 * tree shapes the full band may draw, and what the trees cast (the FOREST row's
 * shape, or none unless SHADOWS is ALL) — `settings-video.ts` says what each
 * stop buys. */
export type ForestOptions = Omit<ForestLook, "casters"> & {
  far: number;
  casters: TreeCasters | "none";
};

const CELL = 64;

function hash(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** How close the lens may come to a drawn crown before the tree is taken
 * out of the picture once it is behind (`LENS_BEHIND`), m. */
export const LENS_CLEAR = 2.4;

/** How far behind the lens, m along its look in plan, a trunk must be
 * before its tree is taken out of the picture: one coming at the lens, or
 * one the lens is passing through, stays drawn. */
export const LENS_BEHIND = 1;

/** Whether the lens, `d` m from the trunk in plan at height `y`, is within
 * `LENS_CLEAR` of the tree as drawn — its variant's crown at that height,
 * or its bare trunk under the lowest bough. */
function atLens(t: Level["trees"][number], v: TreeVariant, d: number, y: number): boolean {
  const f = (y - t.y) / t.height;
  if (f > 1.05) return false;
  const crown = t.crown * 0.95 * crownAt(v, Math.max(0, f));
  return d - Math.max(t.radius, crown) < LENS_CLEAR;
}

/** A sketch caster stands this much inside the full tree's crown, so the
 * full tree drawn over it is not shaded blotchy by its own stand-in. */
const SKETCH_INSET = 0.85;

/** How far the lens has to stand from a tree before it cannot be inside
 * it, m — past this, `atLens` is not asked. */
const LENS_REACH = 24;

export type Forest = {
  group: THREE.Group;
  /** Refill the bands for `camera`, and the casters for `shadow` (null:
   * nothing casts). */
  update(camera: THREE.PerspectiveCamera, shadow: ShadowBox | null): void;
  /** Force the next update to recompute (a new frame of reference). */
  invalidate(): void;
  /** New bands (a picture row moved); takes effect on the next update. */
  setOptions(next: ForestOptions): void;
  dispose(): void;
};

export function createForest(level: Level, haze: HazeUniforms, initial: ForestOptions): Forest {
  let options = { ...initial };
  const group = new THREE.Group();
  const trees = level.trees;
  const count = trees.length;
  // Every tree's matrix, once.
  const matrices = new Float32Array(count * 16);
  const colours = new Float32Array(count * 3);
  /** Each tree's place in the far band's thinning: a sketch stands while
   * this is under `farShare`, so a thinner wood is a subset of a thicker
   * one and walking the row never swaps one tree for another. */
  const thin = new Float32Array(count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    const t = trees[i];
    const h = hash(t.x, t.z);
    thin[i] = hash(t.x * 1.7 + 11, t.z * 0.6 - 5);
    q.setFromAxisAngle(up, h * Math.PI * 2);
    // The crown the generator gives is the collision's idea of it; drawn a
    // touch narrower so a wood keeps gaps between its trees — and every tree
    // a little broader or slimmer and a little oval, off a hash of its
    // place, so no two of one variant stand as the same tree.
    const broad = 0.86 + 0.18 * hash(t.x * 0.37 + 3, t.z * 1.9);
    const oval = 0.9 + 0.2 * hash(t.x * 2.3, t.z * 0.41 - 7);
    s.set(t.crown * 0.95 * broad * oval, t.height, (t.crown * 0.95 * broad) / oval);
    // Sunk a little, so a tree on a slope stands in the snow.
    p.set(t.x, t.y - 0.3, t.z);
    m.compose(p, q, s).toArray(matrices, i * 16);
    const tone = 0.9 + hash(t.z, t.x) * 0.2;
    colours[i * 3] = tone;
    colours[i * 3 + 1] = tone;
    colours[i * 3 + 2] = tone;
  }
  // Binned by cell.
  const cols = Math.ceil(level.size / CELL);
  const bins: number[][] = Array.from({ length: cols * cols }, () => []);
  for (let i = 0; i < count; i++) {
    const c = Math.min(cols - 1, Math.max(0, Math.floor(trees[i].x / CELL)));
    const r = Math.min(cols - 1, Math.max(0, Math.floor(trees[i].z / CELL)));
    bins[r * cols + c].push(i);
  }
  const binTop = new Float32Array(cols * cols).fill(-Infinity);
  const binLow = new Float32Array(cols * cols).fill(Infinity);
  for (let b = 0; b < bins.length; b++) {
    for (const i of bins[b]) {
      binTop[b] = Math.max(binTop[b], trees[i].y + trees[i].height);
      binLow[b] = Math.min(binLow[b], trees[i].y);
    }
  }

  const material = hazeMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
    haze,
    "tree",
  );
  // THE CASTERS are drawn into the shadow map and nowhere else. Three picks
  // its shadow pass off the MAIN camera's layers, so a layer cannot keep
  // them out of the picture; instead their own material puts every vertex
  // outside the clip volume — the picture's pass culls them before a pixel
  // is shaded — while the shadow pass draws them with three's own depth
  // material, which never runs this one.
  const casterMaterial = new THREE.ShaderMaterial({
    vertexShader: "void main() { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }",
    fragmentShader: "void main() { gl_FragColor = vec4(0.0); }",
    side: material.side,
  });
  const paint = treePaint(regionLookOf(regionOf(level).id));

  type Band = { meshes: THREE.InstancedMesh[]; fill: number[]; shape: Uint8Array };
  type Casters = { meshes: THREE.InstancedMesh[]; shape: Uint8Array };
  type Shapes = {
    budget: number;
    /** Each tree's variant, for the lens to clear it by. */
    variantOf: TreeVariant[];
    full: Band;
    far: Band;
    casters: { full: Casters; sketch: Casters };
    geometries: THREE.BufferGeometry[];
  };

  /** How many trees of each kind the map grows. */
  const perKind = new Map<string, number>();
  for (const t of trees)
    perKind.set(t.kind ?? "spruce", (perKind.get(t.kind ?? "spruce") ?? 0) + 1);

  /** THE SHAPES for a `budget` of full-band meshes (the FOREST row's): each
   * kind gets its share of the budget by how many of its trees stand here —
   * one variant at the least, all ten at the most — then which variant
   * every tree is, the meshes the map's own variants are built into (only
   * the ones it grows), and the two bands and the casters over them, each
   * mesh sized to the trees that can ever be drawn with it. The far band
   * and the casters draw ONE shape a kind (its lead variant: the sketch, or
   * the full tree when the casters are full), so their cost is the number
   * of kinds, not of variants. */
  function buildShapes(budget: number): Shapes {
    const variantsOf = new Map<string, number>();
    for (const [kind, n] of perKind) {
      variantsOf.set(kind, Math.max(1, Math.min(VARIANTS, Math.round((budget * n) / count))));
    }
    const variantOf: TreeVariant[] = new Array<TreeVariant>(count);
    const fullShape = new Uint8Array(count);
    const farShape = new Uint8Array(count);
    const fullRows: TreeVariant[] = [];
    const farRows: TreeVariant[] = [];
    const fullCount: number[] = [];
    const farCount: number[] = [];
    const indexOf = (row: TreeVariant, rows: TreeVariant[], n: number[]): number => {
      let k = rows.indexOf(row);
      if (k < 0) {
        k = rows.length;
        rows.push(row);
        n.push(0);
      }
      n[k]++;
      return k;
    };
    for (let i = 0; i < count; i++) {
      const t = trees[i];
      const kind = t.kind ?? "spruce";
      const v = treeVariant(kind, t.x, t.z, variantsOf.get(kind));
      variantOf[i] = v;
      fullShape[i] = indexOf(v, fullRows, fullCount);
      farShape[i] = indexOf(leadVariant(kind), farRows, farCount);
    }
    const shape = (v: TreeVariant, far = false) =>
      treeModel(v, paint, far) ?? buildTree(v, paint, far);
    const detailed = fullRows.map((v) => shape(v));
    const leads = farRows.map((v) => shape(v));
    const sketch = farRows.map((v) => shape(v, true));
    const insetSketch = sketch.map((g) => g.clone().scale(SKETCH_INSET, 1, SKETCH_INSET));
    const makeBand = (geos: THREE.BufferGeometry[], shape: Uint8Array, room: number[]): Band => {
      const meshes = geos.map((g, k) => {
        const im = new THREE.InstancedMesh(g, material, room[k]);
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(room[k] * 3), 3);
        im.instanceColor.setUsage(THREE.DynamicDrawUsage);
        im.castShadow = false;
        im.receiveShadow = true;
        im.frustumCulled = false;
        im.count = 0;
        im.visible = false;
        group.add(im);
        return im;
      });
      return { meshes, fill: geos.map(() => 0), shape };
    };
    const makeCasters = (
      geos: THREE.BufferGeometry[],
      shape: Uint8Array,
      room: number[],
    ): Casters => ({
      shape,
      meshes: geos.map((g, k) => {
        const im = new THREE.InstancedMesh(g, casterMaterial, room[k]);
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.castShadow = true;
        // A tree the mountain already shades casts nothing (`terrain-shade.ts`).
        im.customDepthMaterial = shadeDepth(haze);
        im.receiveShadow = false;
        im.frustumCulled = false;
        im.count = 0;
        im.visible = false;
        group.add(im);
        return im;
      }),
    });
    return {
      budget,
      variantOf,
      full: makeBand(detailed, fullShape, fullCount),
      far: makeBand(sketch, farShape, farCount),
      casters: {
        full: makeCasters(leads, farShape, farCount),
        sketch: makeCasters(insetSketch, farShape, farCount),
      },
      geometries: [...detailed, ...leads, ...sketch, ...insetSketch],
    };
  }

  function dropShapes(old: Shapes): void {
    for (const set of [old.full, old.far, old.casters.full, old.casters.sketch]) {
      for (const im of set.meshes) {
        group.remove(im);
        im.dispose();
      }
    }
    for (const g of old.geometries) g.dispose();
  }

  let shapes = buildShapes(options.shapes);
  /** The tallest tree, for how far up-sun a caster can stand. */
  let tallest = 0;
  for (const t of trees) tallest = Math.max(tallest, t.height);
  let widest = 0;
  for (const t of trees) widest = Math.max(widest, t.crown);

  const frustum = new THREE.Frustum();
  const box = new THREE.Box3();
  const pv = new THREE.Matrix4();
  const look = new THREE.Vector3();
  const lastAt = new THREE.Vector3(Infinity, 0, 0);
  const lastLook = new THREE.Vector3();
  let lastFov = 0;
  /** Where the casters were last filled for. */
  const lastShadow: ShadowBox = { x: Infinity, y: 0, z: 0, reach: 0, sx: 0, sy: 0, sz: 0 };
  let castersOn = false;

  function place(band: Band, i: number) {
    const sh = band.shape[i];
    const im = band.meshes[sh];
    const k = band.fill[sh]++;
    (im.instanceMatrix.array as Float32Array).set(matrices.subarray(i * 16, i * 16 + 16), k * 16);
    (im.instanceColor!.array as Float32Array).set(colours.subarray(i * 3, i * 3 + 3), k * 3);
  }

  /** Refill the casters: every tree whose shadow can reach the circle. */
  function fillCasters(shadow: ShadowBox | null) {
    const sets = [shapes.casters.full, shapes.casters.sketch];
    let n: number[] = [];
    const into =
      !shadow || options.casters === "none"
        ? null
        : options.casters === "full"
          ? shapes.casters.full
          : shapes.casters.sketch;
    if (shadow && into) {
      // The cells the circle, and the shadows reaching into it, can touch.
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
      n = into.meshes.map(() => 0);
      for (let row = rMin; row <= rMax; row++) {
        for (let c = cMin; c <= cMax; c++) {
          for (const i of bins[row * cols + c]) {
            const t = trees[i];
            if (!castsInto(shadow, t.x, t.z, t.height, t.crown)) continue;
            const sh = into.shape[i];
            const k = n[sh]++;
            (into.meshes[sh].instanceMatrix.array as Float32Array).set(
              matrices.subarray(i * 16, i * 16 + 16),
              k * 16,
            );
          }
        }
      }
    }
    for (const set of sets) {
      set.meshes.forEach((im, k) => {
        const used = set === into ? n[k] : 0;
        im.count = used;
        im.visible = used > 0;
        if (used === 0) return;
        im.instanceMatrix.clearUpdateRanges();
        im.instanceMatrix.addUpdateRange(0, used * 16);
        im.instanceMatrix.needsUpdate = true;
      });
    }
  }

  return {
    group,
    update(camera, shadow) {
      // The casters, when the circle has moved, turned with the sun or
      // changed size — a metre, or a few hundredths of a degree.
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
      // The bands, only when the lens has moved or turned enough to change
      // the answer.
      camera.getWorldDirection(look);
      if (
        camera.position.distanceToSquared(lastAt) < 0.5 &&
        look.dot(lastLook) > 0.9998 &&
        camera.fov === lastFov
      ) {
        return;
      }
      lastAt.copy(camera.position);
      lastLook.copy(look);
      lastFov = camera.fov;
      pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(pv);
      const cx = camera.position.x;
      const cy = camera.position.y;
      const cz = camera.position.z;
      const { full, far } = shapes;
      for (const b of [full, far]) b.fill.fill(0);
      const reach = Math.ceil(options.far / CELL) + 1;
      const c0 = Math.floor(cx / CELL);
      const r0 = Math.floor(cz / CELL);
      const lens2 = LENS_REACH * LENS_REACH;
      const plan = Math.hypot(look.x, look.z);
      const ux = plan > 1e-6 ? look.x / plan : 0;
      const uz = plan > 1e-6 ? look.z / plan : 0;
      const full2 = options.full * options.full;
      const far2 = options.far * options.far;
      for (let r = Math.max(0, r0 - reach); r <= Math.min(cols - 1, r0 + reach); r++) {
        for (let c = Math.max(0, c0 - reach); c <= Math.min(cols - 1, c0 + reach); c++) {
          const b = r * cols + c;
          if (bins[b].length === 0) continue;
          box.min.set(c * CELL - 8, binLow[b] - 2, r * CELL - 8);
          box.max.set((c + 1) * CELL + 8, binTop[b] + 2, (r + 1) * CELL + 8);
          const dx = Math.max(box.min.x - cx, 0, cx - box.max.x);
          const dz = Math.max(box.min.z - cz, 0, cz - box.max.z);
          if (dx * dx + dz * dz > far2) continue;
          if (!frustum.intersectsBox(box)) continue;
          for (const i of bins[b]) {
            const t = trees[i];
            const e2 = (t.x - cx) ** 2 + (t.z - cz) ** 2;
            // THE TREES AT THE LENS are drawn while they come at it and while
            // it passes through them — the boughs across the frame are the
            // woods closing round a skier off the piste (the booms keep only
            // off the trunks, `camera-rigs.ts`). Only once the trunk is
            // `LENS_BEHIND` behind the lens is a tree whose crown is still at
            // it taken out of the picture, so its boughs do not hang round
            // the frame's edges. Its caster stays, so the snow under it does
            // not light up as the lens goes by.
            if (
              e2 < lens2 &&
              (t.x - cx) * ux + (t.z - cz) * uz < -LENS_BEHIND &&
              atLens(t, shapes.variantOf[i], Math.sqrt(e2), cy)
            )
              continue;
            if (e2 < full2) place(full, i);
            else if (e2 < far2 && thin[i] < options.farShare) place(far, i);
          }
        }
      }
      for (const b of [full, far]) {
        b.meshes.forEach((im, k) => {
          const n = b.fill[k];
          im.count = n;
          im.visible = n > 0;
          // Upload only what is used: a whole band's buffer is megabytes.
          im.instanceMatrix.clearUpdateRanges();
          im.instanceMatrix.addUpdateRange(0, Math.max(1, n) * 16);
          im.instanceMatrix.needsUpdate = true;
          im.instanceColor!.clearUpdateRanges();
          im.instanceColor!.addUpdateRange(0, Math.max(1, n) * 3);
          im.instanceColor!.needsUpdate = true;
        });
      }
    },
    invalidate() {
      lastAt.set(Infinity, 0, 0);
      lastShadow.x = Infinity;
    },
    setOptions(next) {
      if (next.shapes !== options.shapes) {
        dropShapes(shapes);
        shapes = buildShapes(next.shapes);
      }
      options = { ...next };
      lastAt.set(Infinity, 0, 0);
      lastShadow.x = Infinity;
    },
    dispose() {
      dropShapes(shapes);
      material.dispose();
      casterMaterial.dispose();
    },
  };
}
