// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WOODS — every trunk the generator stood (`Level.trees`, the ones a
// skier can hit), drawn as the kind of tree it is (`TreeDef.kind`: spruce,
// fir, pine, larch, birch…) in one of that kind's VARIANTS
// (`tree-variants.ts` — the dense spire, the self-pruned stand tree, the
// snow ghost, the pine's umbrella, the mountain birch's three stems…),
// chosen by a hash of where it stands, scaled to its own height and crown,
// turned and tinted by another — and its trunk drawn to its own GIRTH, the
// engine's `TreeDef.radius`, which is its AGE (R14): the shapes carry their
// trunks tagged (`tree-mesh.ts`) and every instance its girth, so a sapling
// and a veteran of one height stand side by side. Every shape is built
// here, procedurally, by `tree-shapes.ts`, once per map and painted by the
// region (`region-look.ts`); only the kinds and variants a map grows are
// built.
//
// HOW MANY VARIANTS is the FOREST row's (`FOREST_LOOK[row].variants`): all
// ten of every kind at HIGH, five at MEDIUM, two at LOW — never fewer KINDS,
// only fewer shapes of each, so a cheaper picture holds fewer distinct
// meshes on the GPU and makes fewer draws, and the wood is still the same
// wood.
//
// TENS OF THOUSANDS OF THEM, so only the nearest are geometry: one
// instanced mesh a shape, each sized to the trees it draws, out to the
// FOREST row's `full`. Past it every tree is ONE QUAD drawn out of a picture
// of its own variant (`tree-impostors.ts`): the full cut baked at map load
// from 8 × 8 directions over the upper hemisphere and relit under the sky's
// own sun every frame, so a far tree seen from the valley, a chair or a
// helicopter is the tree from there — and every one of them is ONE DRAW.
// Past `mid` only the `farShare` of them stand. The trees are binned into
// 64 m cells once; when the lens moves, the cells in reach are tested
// against the view frustum and their trees are copied into the geometry's
// instance buffers or the quads' list. No band ends at a line: over the
// last stretch of the near band a tree is drawn both ways, dithered into
// one another (`tree-bands.ts`), so a skier never sees a tree swap its cut.
// Past the far band the terrain's own forest tint (`snow-glsl.ts`) carries
// the woods to the ridge.
//
// THE SHADOWS ARE A THIRD SET, NOT A BAND. No band casts. Every tree whose
// shadow can land in the sun's circle (`shadow-box.ts`'s `castsInto`) is
// listed for a quad drawn only into the shadow map — whatever band the
// picture draws it in, in front of the lens or behind it — turned to the
// sun and cut to its picture from there, so the shadow is the tree's own
// outline as the sun sees it, all of them in one draw. So a wood's shadows
// are all there or fading out at the circle's rim together, and none of
// them is switched on by riding closer to its tree.
//
// THE WIND bends the near trees (`SWAY_PROJECT`).

import * as THREE from "three";
import { felledTrees, regionOf, type Level, type Vec3 } from "@engine";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import type { ForestLook, TreeCasters } from "./settings-video.ts";
import { castsInto, shadowLength, type ShadowBox } from "./shadow-box.ts";
import { regionLookOf } from "./region-look.ts";
import { createRocks } from "./rocks.ts";
import { TRUNK_REF, graftGirth } from "./tree-mesh.ts";
import { summerShown } from "./season-look.ts";
import { buildTree, summerPaint, treePaint, type TreeLod } from "./tree-shapes.ts";
import { HYSTERESIS, createHandOver, handOver, type TreeDraw } from "./tree-bands.ts";
import { treeTilt, trunkYaw } from "./tree-tilt.ts";
import { crownAt, leadVariant, treeVariant, type TreeVariant } from "./tree-variants.ts";
import { nearestPictured, picturedOf } from "./impostor-plan.ts";
import { createImpostors, type ImpostorLayer } from "./tree-impostors.ts";

/** Where the bands end (the FOREST row's `full` and `mid`, the DISTANCE
 * row's `far`, all m), how far the crags stand (the DISTANCE row's `view`:
 * the whole picture, since a crag far off is what a far lens looks at), the share of the trees past `mid` that stand, how
 * many variants of each kind are drawn, and what the trees cast (the FOREST
 * row's cut, or none unless SHADOWS is ALL) — `settings-video.ts` says what
 * each stop buys. */
export type ForestOptions = Omit<ForestLook, "casters"> & {
  far: number;
  view: number;
  casters: TreeCasters | "none";
};

const CELL = 64;

/** An instanced shape's girth attribute (`withGirth`). */
const girthOf = (im: THREE.InstancedMesh): THREE.InstancedBufferAttribute =>
  im.geometry.getAttribute("girth") as THREE.InstancedBufferAttribute;

/** An instanced band shape's dither window (`withFade`). */
const fadeOf = (im: THREE.InstancedMesh): THREE.InstancedBufferAttribute =>
  im.geometry.getAttribute("fade") as THREE.InstancedBufferAttribute;

/** THE HAND-OVER, in the tree material: every band instance carries the
 * window `[lo, hi)` of a screen-space dither its pixels are kept in
 * (`tree-bands.ts`); a whole tree's is `[0, 1)` and discards nothing. */
function graftFade(shader: { vertexShader: string; fragmentShader: string }): void {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nattribute vec2 fade;\nvarying vec2 vFade;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\n  vFade = fade;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying vec2 vFade;")
    .replace(
      "void main() {",
      `void main() {
  float lodDither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (lodDither < vFade.x || lodDither >= vFade.y) discard;`,
    );
}

/** THE NEAR TREES IN THE WIND: each top bent down the wind by as much as
 * the air's pressure on it (a still day a few centimetres, a gale over half
 * a metre on a twenty-metre spruce), the bend growing with the square of the
 * height up the stem, and swaying about that on a period of its own off a
 * hash of where it stands — so a wood never swings as one. The far trees'
 * pictures stand still: at a hundred metres the sway is under a pixel. */
const SWAY_VERTEX_PARS = "uniform vec3 uSway;";
const SWAY_PROJECT = `
vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
  {
    vec3 foot = instanceMatrix[3].xyz;
    float tall = length(instanceMatrix[1].xyz);
    float ph = fract(sin(dot(foot.xz, vec2(12.9898, 78.233))) * 43758.5453);
    float v = length(uSway.xy);
    vec2 dir = v > 0.05 ? uSway.xy / v : vec2(0.6, 0.8);
    float up = clamp(transformed.y, 0.0, 1.0);
    float amp = tall * (0.00012 * v * v + 0.0015) * up * up;
    float swing = sin(uSway.z * (1.1 + 0.6 * ph) + ph * 6.2832);
    mvPosition.xz += dir * amp * (0.7 + 0.3 * swing)
      + vec2(-dir.y, dir.x) * amp * 0.25 * sin(uSway.z * (1.7 + 0.5 * ph) + ph * 17.0);
  }
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`;

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

export type Forest = {
  group: THREE.Group;
  /** Refill the bands for `camera`, and the casters for `shadow` (null:
   * nothing casts). */
  update(camera: THREE.PerspectiveCamera, shadow: ShadowBox | null): void;
  /** Force the next update to recompute (a new frame of reference). */
  invalidate(): void;
  /** New bands (a picture row moved); takes effect on the next update. */
  setOptions(next: ForestOptions): void;
  /** THE VIEW ALOFT (`view-aloft.ts`): the woods out to `far` m in plan,
   * each tree's cut chosen at its slant distance from a lens `lift` m over
   * the snow, the crags out to `view` m — none of it under the row's own. */
  setAloft(far: number, lift: number, view: number): void;
  /** THE WIND in the near woods: the air's velocity, m/s, and the clock. */
  setWind(x: number, z: number, t: number): void;
  dispose(): void;
};

export function createForest(
  level: Level,
  haze: HazeUniforms,
  initial: ForestOptions,
  renderer: THREE.WebGLRenderer | null = null,
): Forest {
  let options = { ...initial };
  // The view aloft over the row's own (`setAloft`); on the snow, the row's.
  const aloft = { far: options.far, lift: 0, view: options.view };
  const edges = { full: 0, mid: 0, far: 0 };
  const group = new THREE.Group();
  // THE CRAGS on the drops stand with the woods, out to the whole view,
  // and the far share is the share of their blocks (`rocks.ts`).
  const rocks = createRocks(level, haze, options.farShare);
  group.add(rocks.group);
  const count = level.trees.length;
  // Binned by cell — and every tree NUMBERED in bin order, so a cell's
  // trees and everything held for them stand side by side in memory: the
  // refill walks thousands of trees a frame, and reading each one's place
  // and matrix scattered across the map's whole list was most of its cost.
  // A cell keeps the generator's order inside it, so the bands are filled
  // in exactly the order they were.
  const cols = Math.ceil(level.size / CELL);
  const binOf = (t: Level["trees"][number]): number => {
    const c = Math.min(cols - 1, Math.max(0, Math.floor(t.x / CELL)));
    const r = Math.min(cols - 1, Math.max(0, Math.floor(t.z / CELL)));
    return r * cols + c;
  };
  /** Where each cell's trees start in the bin order; a cell is
   * `[binStart[b], binStart[b + 1])`. */
  const binStart = new Int32Array(cols * cols + 1);
  for (const t of level.trees) binStart[binOf(t) + 1]++;
  for (let b = 0; b < cols * cols; b++) binStart[b + 1] += binStart[b];
  const trees: Level["trees"] = new Array(count);
  /** Each of the generator's trees' number in the bin order. */
  const rank = new Int32Array(count);
  {
    const at = binStart.slice(0, cols * cols);
    level.trees.forEach((t, k) => {
      const i = at[binOf(t)]++;
      trees[i] = t;
      rank[k] = i;
    });
  }
  /** Every tree's place in plan, read once a tree a refill. */
  const xs = new Float64Array(count);
  const zs = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    xs[i] = trees[i].x;
    zs[i] = trees[i].z;
  }
  // Every tree's matrix, once.
  const matrices = new Float32Array(count * 16);
  const colours = new Float32Array(count * 3);
  /** Every tree's GIRTH: its trunk's radius over the radius the shapes are
   * built with, on each of the instance's stretched axes. */
  const girths = new Float32Array(count * 2);
  /** Each tree's place in the far band's thinning: a tree stands while
   * this is under `farShare`, so a thinner wood is a subset of a thicker
   * one and walking the row never swaps one tree for another. */
  const thin = new Float32Array(count);
  /** Each tree's LEAN as the shift of its axis in plan a metre up. */
  const leans = new Float32Array(count * 2);
  /** Each tree's foot, turn and stretch, for its impostor's row. */
  const feet = new Float32Array(count * 3);
  const turns = new Float32Array(count * 4);
  const stretch = new Float32Array(count * 3);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const lean = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const across = new THREE.Vector3();
  const ground: Vec3 = { x: 0, y: 1, z: 0 };
  // The trees felled, by their number in the bin order.
  const felled = felledTrees(level);
  const gone = new Uint8Array(count);
  for (let k = 0; k < count; k++) gone[rank[k]] = felled[k];
  for (let i = 0; i < count; i++) {
    const t = trees[i];
    thin[i] = hash(t.x * 1.7 + 11, t.z * 0.6 - 5);
    // Turned about its own axis, then LEANT off plumb about its foot
    // (`tree-tilt.ts`): mostly a few degrees, mostly down the slope.
    level.normalAt(t.x, t.z, ground);
    const tilt = treeTilt(t.x, t.z, leadVariant(t.kind ?? "spruce").shape.form, ground.x, ground.z);
    across.set(tilt.dz, 0, -tilt.dx);
    lean.setFromAxisAngle(across, tilt.angle);
    q.setFromAxisAngle(up, trunkYaw(t.x, t.z)).premultiply(lean);
    const reach = Math.tan(tilt.angle);
    leans[i * 2] = tilt.dx * reach;
    leans[i * 2 + 1] = tilt.dz * reach;
    // The crown the generator gives is the collision's idea of it; drawn a
    // touch narrower so a wood keeps gaps between its trees — and every tree
    // a little broader or slimmer and a little oval, off a hash of its
    // place, so no two of one variant stand as the same tree.
    const broad = 0.86 + 0.18 * hash(t.x * 0.37 + 3, t.z * 1.9);
    const oval = 0.9 + 0.2 * hash(t.x * 2.3, t.z * 0.41 - 7);
    s.set(t.crown * 0.95 * broad * oval, t.height, (t.crown * 0.95 * broad) / oval);
    girths[i * 2] = t.radius / (TRUNK_REF * s.x);
    girths[i * 2 + 1] = t.radius / (TRUNK_REF * s.z);
    // Sunk a little, so a tree on a slope stands in the snow — and a leaning
    // one by as much again as its flared foot rises on the side it leans
    // from.
    p.set(t.x, t.y - 0.3 - t.radius * 1.45 * Math.sin(tilt.angle), t.z);
    // A tree felled for the village or a building's site (`felledTrees`)
    // is drawn as nothing: its matrix squashed to its foot.
    if (gone[i]) s.set(0, 0, 0);
    m.compose(p, q, s).toArray(matrices, i * 16);
    p.toArray(feet, i * 3);
    q.toArray(turns, i * 4);
    s.toArray(stretch, i * 3);
    const tone = 0.9 + hash(t.z, t.x) * 0.2;
    colours[i * 3] = tone;
    colours[i * 3 + 1] = tone;
    colours[i * 3 + 2] = tone;
  }
  const binTop = new Float32Array(cols * cols).fill(-Infinity);
  const binLow = new Float32Array(cols * cols).fill(Infinity);
  /** How far a crown in each cell leans out past its trunk, m. */
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

  /** The air's velocity across (x, z), m/s, and the run's clock. */
  const sway = { value: new THREE.Vector3() };
  const material = hazeMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
    haze,
    "tree",
    (shader) => {
      graftGirth(shader);
      graftFade(shader);
      shader.uniforms.uSway = sway;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${SWAY_VERTEX_PARS}`)
        .replace("#include <project_vertex>", SWAY_PROJECT);
    },
  );
  const region = treePaint(regionLookOf(regionOf(level).id));
  const paint = summerShown() ? summerPaint(region) : region;

  /** A band's meshes, and each one's instance arrays held once: a refill
   * writes thousands of trees a frame, and an attribute looked up or a
   * subarray made per tree was half of what the refill cost. */
  type Band = {
    meshes: THREE.InstancedMesh[];
    fill: number[];
    shape: Uint8Array;
    mats: Float32Array[];
    tints: Float32Array[];
    girths: Float32Array[];
    fades: Float32Array[];
    /** The tree in each slot, as last sent to the card (-1: none yet). */
    who: Int32Array[];
    /** The first slot this refill wrote anything new into. */
    from: number[];
  };
  type Shapes = {
    variants: number;
    /** Each tree's variant, for the lens to clear it by. */
    variantOf: TreeVariant[];
    full: Band;
    /** Each tree's picture in the impostors' atlas. */
    layer: Uint8Array;
    geometries: THREE.BufferGeometry[];
  };

  /** The girth attribute an instanced shape carries, `room` trees long. */
  const withGirth = (g: THREE.BufferGeometry, room: number): THREE.BufferGeometry => {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, room) * 2), 2);
    a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("girth", a);
    return g;
  };

  /** The dither window an instanced band shape carries, `room` trees long. */
  const withFade = (g: THREE.BufferGeometry, room: number): THREE.BufferGeometry => {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, room) * 2), 2);
    a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("fade", a);
    return g;
  };

  /** THE SHAPES for `variants` of every kind (the FOREST row's): which
   * variant every tree is, the meshes the map's own variants are built into
   * at the full cut (only the ones it grows), each sized to the trees that
   * can ever be drawn with it, and the far woods' atlas baked. */
  function buildShapes(variants: number): Shapes {
    const variantOf: TreeVariant[] = new Array<TreeVariant>(count);
    const nearShape = new Uint8Array(count);
    const nearRows: TreeVariant[] = [];
    const nearCount: number[] = [];
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
    // In the generator's order, so every shape keeps the mesh it had.
    for (let k = 0; k < count; k++) {
      const i = rank[k];
      const t = trees[i];
      const kind = t.kind ?? "spruce";
      const v = treeVariant(kind, t.x, t.z, variants);
      variantOf[i] = v;
      nearShape[i] = indexOf(v, nearRows, nearCount);
    }
    const shape = (v: TreeVariant, lod: TreeLod) => buildTree(v, paint, lod);
    const full = nearRows.map((v) => shape(v, 0));
    // THE IMPOSTORS: every tree past the near band drawn out of a picture of
    // its own variant, or of the pictured one nearest it in outline.
    const pictures: TreeVariant[] = [];
    const layer = new Uint8Array(count);
    const sums: { aspect: number; girth: number; n: number }[] = [];
    for (let i = 0; i < count; i++) {
      const v = variantOf[i];
      const pic = nearestPictured(v, picturedOf(v.kind, options.impostor));
      let k = pictures.indexOf(pic);
      if (k < 0) {
        k = pictures.length;
        pictures.push(pic);
        sums.push({ aspect: 0, girth: 0, n: 0 });
      }
      layer[i] = k;
      if (stretch[i * 3 + 1] > 0) {
        const at = sums[k];
        at.aspect += (stretch[i * 3] + stretch[i * 3 + 2]) / (2 * stretch[i * 3 + 1]);
        at.girth += (girths[i * 2] + girths[i * 2 + 1]) / 2;
        at.n++;
      }
    }
    const baked = pictures.map((v) => shape(v, 0));
    const layers: ImpostorLayer[] = baked.map((geometry, k) => ({
      geometry,
      aspect: sums[k].n > 0 ? sums[k].aspect / sums[k].n : 0.25,
      girth: sums[k].n > 0 ? sums[k].girth / sums[k].n : 1,
    }));
    impostors.bake(layers, options.impostor);
    for (let i = 0; i < count; i++) {
      tq.fromArray(turns, i * 4);
      impostors.setTree(i, {
        x: feet[i * 3],
        y: feet[i * 3 + 1],
        z: feet[i * 3 + 2],
        q: tq,
        sx: stretch[i * 3],
        sy: stretch[i * 3 + 1],
        sz: stretch[i * 3 + 2],
        tint: colours[i * 3],
        layer: layer[i],
      });
    }
    impostors.commit();
    for (const g of baked) g.dispose();
    const makeBand = (geos: THREE.BufferGeometry[], shape: Uint8Array, room: number[]): Band => {
      const meshes = geos.map((g, k) => {
        const im = new THREE.InstancedMesh(
          withFade(withGirth(g, room[k]), room[k]),
          material,
          room[k],
        );
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
      return {
        meshes,
        fill: geos.map(() => 0),
        shape,
        mats: meshes.map((im) => im.instanceMatrix.array as Float32Array),
        tints: meshes.map((im) => im.instanceColor!.array as Float32Array),
        girths: meshes.map((im) => girthOf(im).array as Float32Array),
        fades: meshes.map((im) => fadeOf(im).array as Float32Array),
        who: room.map((n) => new Int32Array(Math.max(1, n)).fill(-1)),
        from: geos.map(() => 0),
      };
    };
    return {
      variants,
      variantOf,
      full: makeBand(full, nearShape, nearCount),
      layer,
      geometries: full,
    };
  }

  function dropShapes(old: Shapes): void {
    for (const im of old.full.meshes) {
      group.remove(im);
      im.dispose();
    }
    for (const g of old.geometries) g.dispose();
  }

  // THE FAR WOODS: one draw of quads for every tree past the near band.
  const impostors = createImpostors(haze, count, renderer, graftFade);
  group.add(impostors.mesh);
  group.add(impostors.casters);
  const tq = new THREE.Quaternion();
  const farIds = impostors.ids;
  const farFades = impostors.fades;
  const farWho = new Int32Array(Math.max(1, count)).fill(-1);
  let farFill = 0;
  let farFrom = 0;
  let shapes = buildShapes(options.variants);
  /** The tallest tree, for how far up-sun a caster can stand. */
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
  /** Where the casters were last filled for. */
  const lastShadow: ShadowBox = { x: Infinity, y: 0, z: 0, reach: 0, sx: 0, sy: 0, sz: 0 };
  let castersOn = false;

  /** Tree `i` into `band`, keeping the dither window `[lo, hi)`. A slot
   * still holding the tree it held when last sent keeps its matrix, tint
   * and girth; only what is new is written, and only from the first new
   * slot on is sent — while the lens runs on, most of a band is the same
   * trees in the same slots, frame after frame. */
  function place(band: Band, i: number, lo: number, hi: number) {
    if (hi <= lo) return;
    const sh = band.shape[i];
    const k = band.fill[sh]++;
    const fade = band.fades[sh];
    const who = band.who[sh];
    if (who[k] !== i) {
      who[k] = i;
      const mat = band.mats[sh];
      for (let j = 0; j < 16; j++) mat[k * 16 + j] = matrices[i * 16 + j];
      const tint = band.tints[sh];
      tint[k * 3] = colours[i * 3];
      tint[k * 3 + 1] = colours[i * 3 + 1];
      tint[k * 3 + 2] = colours[i * 3 + 2];
      const girth = band.girths[sh];
      girth[k * 2] = girths[i * 2];
      girth[k * 2 + 1] = girths[i * 2 + 1];
    } else if (fade[k * 2] === lo && fade[k * 2 + 1] === hi) {
      return;
    }
    fade[k * 2] = lo;
    fade[k * 2 + 1] = hi;
    if (k < band.from[sh]) band.from[sh] = k;
  }
  /** Tree `i` into the far woods' quads, keeping the dither window. */
  function placeFar(i: number, lo: number, hi: number) {
    if (hi <= lo) return;
    const k = farFill++;
    if (farWho[k] !== i) {
      farWho[k] = i;
      farIds[k] = i;
    } else if (farFades[k * 2] === lo && farFades[k * 2 + 1] === hi) {
      return;
    }
    farFades[k * 2] = lo;
    farFades[k * 2 + 1] = hi;
    if (k < farFrom) farFrom = k;
  }
  /** Every tree's cut and its dissolve into the next (`tree-bands.ts`). */
  const hand = createHandOver(count);
  const draw: TreeDraw = { from: -1, band: -1, split: 0 };
  /** Fills so far, and whether the last left a tree dissolving. */
  let tick = 1;
  let dissolving = false;

  /** Refill the casters: every tree whose shadow can reach the circle. */
  function fillCasters(shadow: ShadowBox | null) {
    let n = 0;
    if (shadow && options.casters !== "none") {
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
      const ids = impostors.casterIds;
      for (let row = rMin; row <= rMax; row++) {
        for (let c = cMin; c <= cMax; c++) {
          const b = row * cols + c;
          for (let i = binStart[b]; i < binStart[b + 1]; i++) {
            if (stretch[i * 3 + 1] <= 0) continue;
            const t = trees[i];
            const crown = t.crown + t.height * Math.hypot(leans[i * 2], leans[i * 2 + 1]);
            if (!castsInto(shadow, t.x, t.z, t.height, crown)) continue;
            ids[n++] = i;
          }
        }
      }
    }
    impostors.setCasters(n, options.casters === "sketch");
  }

  return {
    group,
    update(camera, shadow) {
      rocks.update(camera.position, aloft.view);
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
      // the answer — or a tree is still dissolving into its next cut.
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
      const { full } = shapes;
      full.fill.fill(0);
      full.from.fill(Infinity);
      farFill = 0;
      farFrom = Infinity;
      // Aloft, a tree's cut is chosen at its SLANT distance from the lens
      // (`lift` over the snow), so the far edge is the plan reach's slant.
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
            const e2 = (xs[i] - cx) ** 2 + (zs[i] - cz) ** 2;
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
              (xs[i] - cx) * ux + (zs[i] - cz) * uz < -LENS_BEHIND &&
              atLens(trees[i], shapes.variantOf[i], cx, cz, cy, leans[i * 2], leans[i * 2 + 1])
            )
              continue;
            const inFar = thin[i] < options.farShare;
            const d = Math.sqrt(lift > 0 ? e2 + lift2 : e2);
            if (handOver(hand, i, d, lift > 0 ? edges : options, inFar, now, tick, draw)) {
              dissolving = true;
            }
            // The near band is the tree's own geometry; past it, its impostor.
            if (draw.from === 0) place(full, i, 0, draw.split);
            else if (draw.from > 0) placeFar(i, 0, draw.split);
            if (draw.band === 0) place(full, i, draw.split, 1);
            else if (draw.band > 0) placeFar(i, draw.split, 1);
          }
        }
      }
      {
        const g = impostors.mesh.geometry as THREE.InstancedBufferGeometry;
        g.instanceCount = farFill;
        impostors.mesh.visible = farFill > 0;
        if (farFill > 0 && farFrom < farFill) {
          for (const [name, per] of [
            ["aTree", 1],
            ["fade", 2],
          ] as const) {
            const a = g.getAttribute(name) as THREE.InstancedBufferAttribute;
            a.clearUpdateRanges();
            a.addUpdateRange(farFrom * per, (farFill - farFrom) * per);
            a.needsUpdate = true;
          }
        }
      }
      for (const b of [full]) {
        b.meshes.forEach((im, k) => {
          const n = b.fill[k];
          im.count = n;
          im.visible = n > 0;
          // Nothing of an empty shape is drawn, so nothing of it is sent;
          // nor of one whose slots all hold what they held.
          const from = b.from[k];
          if (n === 0 || from >= n) return;
          // Upload only what is new and used: a whole band's buffer is
          // megabytes.
          im.instanceMatrix.clearUpdateRanges();
          im.instanceMatrix.addUpdateRange(from * 16, (n - from) * 16);
          im.instanceMatrix.needsUpdate = true;
          im.instanceColor!.clearUpdateRanges();
          im.instanceColor!.addUpdateRange(from * 3, (n - from) * 3);
          im.instanceColor!.needsUpdate = true;
          const girth = girthOf(im);
          girth.clearUpdateRanges();
          girth.addUpdateRange(from * 2, (n - from) * 2);
          girth.needsUpdate = true;
          const fade = fadeOf(im);
          fade.clearUpdateRanges();
          fade.addUpdateRange(from * 2, (n - from) * 2);
          fade.needsUpdate = true;
        });
      }
    },
    invalidate() {
      // A new frame of reference: every tree takes its cut at once.
      tick++;
      lastAt.set(Infinity, 0, 0);
      lastShadow.x = Infinity;
    },
    setWind(x, z, t) {
      sway.value.set(x, z, t);
    },
    setAloft(far, lift, view) {
      aloft.far = Math.max(far, options.far);
      aloft.lift = lift;
      aloft.view = Math.max(view, options.view);
    },
    setOptions(next) {
      const rebuild =
        next.variants !== options.variants ||
        next.impostor.frame !== options.impostor.frame ||
        next.impostor.variants !== options.impostor.variants;
      options = { ...next };
      if (rebuild) {
        dropShapes(shapes);
        farWho.fill(-1);
        shapes = buildShapes(next.variants);
      }
      Object.assign(aloft, { far: options.far, lift: 0, view: options.view });
      rocks.setShare(options.farShare);
      tick++;
      lastAt.set(Infinity, 0, 0);
      lastShadow.x = Infinity;
    },
    dispose() {
      rocks.dispose();
      dropShapes(shapes);
      impostors.dispose();
      material.dispose();
    },
  };
}
