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
// TENS OF THOUSANDS OF THEM, drawn in ONE BATCH (`forest-batch.ts`): every
// shape of every kind at every cut packed into one geometry, every tree's
// matrix and numbers written once into a table, and the whole wood sent as
// one multi-draw a pass — the picture's and the shadow map's — whatever
// the kinds, variants and bands. In THREE BANDS of distance, the same tree
// cut lighter in each (`TreeLod`): FULL at the lens, MID (the same variant
// at a third of the triangles, so the hand-over keeps its silhouette) and
// FAR (a sketch, one a kind). The trees are binned into 64 m cells once;
// when the lens moves, the cells in reach are tested against the view
// frustum and their trees are listed, a word a tree, by the shape they are
// drawn as. No band ends at a line: over the last stretch of each a
// tree is drawn in both cuts, dithered into one another (`tree-bands.ts`),
// so a skier never sees a tree swap its cut. Past the far band the
// terrain's own forest tint (`snow-glsl.ts`) carries the woods to the
// ridge.
//
// THE CARD WOODS, on the MEDIUM and HIGH FOREST rows (`style: "cards"`):
// every tree out to the mid band's edge drawn as its CARD TREE
// (`tree-cards.ts` — its boughs as sprays of needles on cards over an atlas
// painted in code, a dark opaque core in every crown, its snow laid in the
// world's up) in a SECOND BATCH over the same table of trees, so it stands
// where its solid cuts would, with its kind, variant, girth, lean, tint and
// load. One style from the skis to the far woods: the card band (HIGH's
// nearest `cards` m) draws the FULL card cut, the full band the LIGHT one
// (fewer, wider cards), the mid band the billboard CLOUD, dissolved into one
// another as every band is; the far band, a few pixels a tree, is the
// faceted sketch, which reads the same at that size for a fraction of a
// card's fill. The cards are cut by their coverage in one pass. (A depth
// pre-pass and a colour pass at an equal depth over it was measured too: it
// saved the hidden layers' shading and cost as much again drawing every
// card twice.) The cards cast nothing of their own: the casters below are
// the faceted cuts, from the faceted batch, whatever the picture draws.
// LOW draws the faceted trees at every distance.
//
// THE SHADOWS ARE A SECOND LIST, NOT A BAND. No band casts. Every tree whose
// shadow can land in the sun's circle (`shadow-box.ts`'s `castsInto`) is
// listed for the shadow map, the same batch's other pass — whatever band
// the picture draws it in, in front of the lens or behind it — its kind's
// MID cut or its sketch, as the FOREST row says. So a wood's
// shadows are all there or fading out at the circle's rim together, and
// none of them is switched on by riding closer to its tree.

import * as THREE from "three";
import { felledTrees, regionOf, type Level } from "@engine";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { createShadeDepth } from "./terrain-shade.ts";
import {
  DISTANCE_LOOK,
  FOREST_LOOK,
  SHADOW_LOOK,
  type ForestLook,
  type TreeCasters,
  type VideoSettings,
} from "./settings-video.ts";
import { castsInto, shadowLength, type ShadowBox } from "./shadow-box.ts";
import { regionLookOf } from "./region-look.ts";
import { createRocks } from "./rocks.ts";
import { GIRTH_VERTEX } from "./tree-mesh.ts";
import {
  CASTERS,
  COLOUR,
  TREE_DATA,
  batchUniforms,
  createTreeBatch,
  graftBatch,
  type TreeBatch,
  type TreeTable,
} from "./forest-batch.ts";
import { createNodeTreeBatch, roomOf, type ShapeRoom, type WoodsKit } from "./forest-nodes.ts";
import { createIndirectTreeBatch } from "./forest-indirect.ts";
import { summerShown } from "./season-look.ts";
import { buildTree, kindPaint, summerPaint, treePaint, type TreeLod } from "./tree-shapes.ts";
import {
  CARDS as CARD_BAND,
  HYSTERESIS,
  createHandOver,
  handOver,
  type TreeDraw,
} from "./tree-bands.ts";
import { packCards } from "./tree-card-parts.ts";
import { buildCardTree, type CardLod } from "./tree-cards.ts";
import { atlasBytes, atlasTexture, cardMaterial } from "./tree-card-material.ts";
import { createTreePlace, placeTree, treeHash } from "./tree-place.ts";
import {
  TREE_SNOW_PARS,
  TREE_SNOW_VERTEX,
  TREE_WIND_PARS,
  TREE_WIND_VERTEX,
  packTree,
} from "./tree-snow.ts";
import { crownAt, leadVariant, treeVariant, type TreeVariant } from "./tree-variants.ts";

/** Where the bands end (the FOREST row's `full` and `mid`, the DISTANCE
 * row's `far`, all m), how far the crags stand (the DISTANCE row's `view`:
 * the whole picture, since a crag far off is what a far lens looks at), the share of the far band's sketches that stand, how
 * many variants of each kind are drawn, and what the trees cast (the FOREST
 * row's cut, or none unless SHADOWS is ALL) — `settings-video.ts` says what
 * each stop buys. */
export type ForestOptions = Omit<ForestLook, "casters"> & {
  far: number;
  view: number;
  casters: TreeCasters | "none";
};

/** The woods a picture's rows ask for: the FOREST row's bands, the DISTANCE
 * row's reach and the SHADOW row's casters. */
export const forestOptionsOf = (video: VideoSettings): ForestOptions => ({
  ...FOREST_LOOK[video.forest],
  far: DISTANCE_LOOK[video.distance].trees,
  view: DISTANCE_LOOK[video.distance].view,
  casters: SHADOW_LOOK[video.shadows].trees ? FOREST_LOOK[video.forest].casters : "none",
});

const CELL = 64;

/** THE TREE IN THE BATCH, in the tree material: the trunk pushed out to its
 * girth (`tree-mesh.ts`), the tree's tone on its colours, and THE HAND-OVER
 * — every listed tree carries the window `[lo, hi)` of a screen-space
 * dither its pixels are kept in (`tree-bands.ts`); a whole tree's is
 * `[0, 1)` and discards nothing. */
function graftTree(
  shader: {
    vertexShader: string;
    fragmentShader: string;
    uniforms: Record<string, THREE.IUniform>;
  },
  wind: THREE.IUniform<THREE.Vector4>,
): void {
  shader.uniforms.uTreeWind = wind;
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>\nattribute vec3 stem;\n${TREE_SNOW_PARS}\n${TREE_WIND_PARS}\nvarying vec2 vFade;`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>\n${GIRTH_VERTEX}\n${TREE_WIND_VERTEX}\n  vFade = tbFade;\n${TREE_SNOW_VERTEX}`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying vec2 vFade;")
    .replace(
      "void main() {",
      `void main() {
  float lodDither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (lodDither < vFade.x || lodDither >= vFade.y) discard;`,
    );
}

/** THE CARD TREE IN THE BATCH: the trunk to its girth, swayed as the tree
 * is, its colours under the tree's own tint and tone (its snow is the card
 * material's to lay, off the tree's load), and the hand-over's dither — the
 * same lines as the solid cuts', so a card tree dissolves into its full
 * cut with nothing moved. */
function graftCardTree(
  shader: {
    vertexShader: string;
    fragmentShader: string;
    uniforms: Record<string, THREE.IUniform>;
  },
  wind: THREE.IUniform<THREE.Vector4>,
): void {
  shader.uniforms.uTreeWind = wind;
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>\nattribute vec3 stem;\n${TREE_WIND_PARS}\nvarying vec2 vFade;`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>\n${GIRTH_VERTEX}\n${TREE_WIND_VERTEX}\n  vFade = tbFade;\n  vColor.rgb *= tbMore.rgb * tbData.z;`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying vec2 vFade;")
    .replace(
      "void main() {",
      `void main() {
  float lodDither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (lodDither < vFade.x || lodDither >= vFade.y) discard;`,
    );
}

/** The casters' depth: the trunk to its girth, swayed as the tree is. */
function graftCaster(
  shader: { vertexShader: string; uniforms: Record<string, THREE.IUniform> },
  wind: THREE.IUniform<THREE.Vector4>,
): void {
  shader.uniforms.uTreeWind = wind;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\nattribute vec3 stem;\n${TREE_WIND_PARS}`)
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>\n${GIRTH_VERTEX}\n${TREE_WIND_VERTEX}`,
    );
}

/** A shape drawn `by` of its width — its trunks' axes with it. */
function inset(g: THREE.BufferGeometry, by: number): THREE.BufferGeometry {
  g.scale(by, 1, by);
  const stem = g.getAttribute("stem");
  for (let i = 0; i < stem.count; i++) stem.setXY(i, stem.getX(i) * by, stem.getY(i) * by);
  return g;
}

const hash = treeHash;

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

/** A sketch caster stands this much inside the full tree's crown, so the
 * full tree drawn over it is not shaded blotchy by its own stand-in. */
const SKETCH_INSET = 0.85;

/** How far the lens may move between two fills before it is taken for a
 * cut, m: far past any lens's travel in a frame, a craft's included. */
const JUMP = 25;

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
  /** The wind in the crowns: its x and z, m/s, at the run's clock `t`, s. */
  setWind(x: number, z: number, t: number): void;
  dispose(): void;
};

/** THE FOREST PLANTED: every tree binned by cell and stood on the snow —
 * its matrix, tone, girth, lean and thinning — a slice at a time, so the
 * loading card can count the trees as they go in (`renderer.ts`'s `load`).
 * `createForest` takes a finished one, or plants one whole itself. */
export type Planting = {
  /** How many trees the map grows. */
  readonly count: number;
  /** How many are planted so far. */
  readonly planted: () => number;
  /** Plant while `more()` says there is time; true while trees are left. */
  step: (more: () => boolean) => boolean;
  readonly cols: number;
  readonly binStart: Int32Array;
  readonly trees: Level["trees"];
  readonly rank: Int32Array;
  readonly xs: Float64Array;
  readonly zs: Float64Array;
  readonly matrices: Float32Array;
  /** Every tree's own numbers, read by the batch (`TREE_DATA` a tree). */
  readonly data: Float32Array;
  readonly girths: Float32Array;
  readonly thin: Float32Array;
  readonly leans: Float32Array;
  /** The trees felled for the village or a building's site, 1 a tree. */
  readonly gone: Uint8Array;
};

/** How many trees go in between asks of the clock. */
const PLANT_SLICE = 256;

export function plantForest(level: Level): Planting {
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
  /** Every tree's own numbers, read by the batch (`TREE_DATA` a tree). */
  const data = new Float32Array(count * TREE_DATA);
  /** Every tree's GIRTH: its trunk's radius over the radius the shapes are
   * built with, on each of the instance's stretched axes. */
  const girths = new Float32Array(count * 2);
  /** Each tree's place in the far band's thinning: a sketch stands while
   * this is under `farShare`, so a thinner wood is a subset of a thicker
   * one and walking the row never swaps one tree for another. */
  const thin = new Float32Array(count);
  /** The mountain's foot and the climb to its summit, for the load. */
  const mount = level.mountain
    ? { base: level.mountain.base.y, span: Math.max(1, level.mountain.vertical) }
    : undefined;
  /** Each tree's LEAN as the shift of its axis in plan a metre up. */
  const leans = new Float32Array(count * 2);
  const m = new THREE.Matrix4();
  const at = createTreePlace();
  // The trees felled, by their number in the bin order.
  const felled = felledTrees(level);
  const gone = new Uint8Array(count);
  for (let k = 0; k < count; k++) gone[rank[k]] = felled[k];
  let planted = 0;
  const step = (more: () => boolean): boolean => {
    while (planted < count) {
      const end = Math.min(count, planted + PLANT_SLICE);
      for (let i = planted; i < end; i++) {
        const t = trees[i];
        thin[i] = hash(t.x * 1.7 + 11, t.z * 0.6 - 5);
        const tilt = placeTree(level, t, at);
        const reach = Math.tan(tilt.angle);
        leans[i * 2] = tilt.dx * reach;
        leans[i * 2 + 1] = tilt.dz * reach;
        girths[i * 2] = at.girth[0];
        girths[i * 2 + 1] = at.girth[1];
        // A tree felled for the village or a building's site (`felledTrees`)
        // is drawn as nothing: its matrix squashed to its foot.
        if (gone[i]) at.s.set(0, 0, 0);
        m.compose(at.p, at.q, at.s).toArray(matrices, i * 16);
        const d = i * TREE_DATA;
        data[d] = girths[i * 2];
        data[d + 1] = girths[i * 2 + 1];
        data[d + 2] = 0.9 + hash(t.z, t.x) * 0.2;
        // THE TREE'S OWN SNOW AND HUE (`tree-snow.ts`): most carry the whole
        // load, more and more of them less of it — one shaken by the wind, one
        // shed in the sun — and every one's green and bark pulled a few per
        // cent toward yellow or toward blue, so a wood of one kind is never one
        // colour.
        // Higher up the mountain the snow stays on the boughs longer (colder,
        // fewer thaws), so the load climbs with the altitude.
        const shed = hash(t.x * 0.53 + 17, t.z * 2.71 - 3);
        const high = mount ? Math.min(1, Math.max(0, (t.y - mount.base) / mount.span)) : 0.5;
        data[d + 3] = 1.05 + 0.25 * high - 0.95 * shed * shed;
        const warm = hash(t.x * 3.1 - 8, t.z * 0.29 + 4) * 2 - 1;
        const light = hash(t.x * 0.19 + 5, t.z * 3.7) * 2 - 1;
        data[d + 4] = 1 + 0.07 * warm + 0.03 * light;
        data[d + 5] = 1 + 0.02 * warm + 0.05 * light;
        data[d + 6] = 1 - 0.07 * warm + 0.02 * light;
        data[d + 7] = hash(t.x * 0.71 - 2, t.z * 1.31 + 9);
      }
      planted = end;
      if (!more()) break;
    }
    return planted < count;
  };
  return {
    count,
    planted: () => planted,
    step,
    cols,
    binStart,
    trees,
    rank,
    xs,
    zs,
    matrices,
    data,
    girths,
    thin,
    leans,
    gone,
  };
}

export function createForest(
  level: Level,
  haze: HazeUniforms,
  initial: ForestOptions,
  sown?: Planting,
  /** The node renderer's materials (`render-seam.ts`'s `woods`): each shape
   * drawn instanced (`forest-nodes.ts`) in place of WebGL's one batch. */
  woods: WoodsKit | null = null,
): Forest {
  let options = { ...initial };
  // The view aloft over the row's own (`setAloft`); on the snow, the row's.
  const aloft = { far: options.far, lift: 0, view: options.view };
  const edges = { cards: 0, full: 0, mid: 0, far: 0 };
  const group = new THREE.Group();
  // THE CRAGS on the drops stand with the woods, out to the whole view,
  // and the far share is the share of their blocks (`rocks.ts`).
  const rocks = createRocks(level, haze, initial.rocks);
  group.add(rocks.group);
  const plot = sown ?? plantForest(level);
  plot.step(() => true); // the rest of it, whole
  const { count, cols, binStart, trees, rank, xs, zs, matrices, data, thin, leans, gone } = plot;
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

  // The batch's uniforms, held across rebuilds: the picture's and the
  // casters' (their lists start in different places).
  const colourU = batchUniforms();
  const casterU = batchUniforms();
  const wind = { value: new THREE.Vector4() };
  const material = woods
    ? woods.tree(colourU, wind)
    : hazeMaterial(
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
        haze,
        "tree",
        (shader) => {
          graftBatch(shader, colourU);
          graftTree(shader, wind);
        },
      );
  // The casters' depth, with the same girth: a veteran's trunk throws a
  // veteran's shadow. A tree the mountain already shades casts nothing
  // (`terrain-shade.ts`).
  const casterDepth = createShadeDepth(haze);
  const shadeCompile = casterDepth.onBeforeCompile.bind(casterDepth);
  casterDepth.customProgramCacheKey = (): string => "terrain-shade-depth-batch";
  casterDepth.onBeforeCompile = (shader, renderer) => {
    shadeCompile(shader, renderer);
    graftBatch(shader, casterU);
    graftCaster(shader, wind);
  };
  const casterNode = woods?.casters(casterU, wind) ?? null;
  // THE CARD TREES' atlas and material (`tree-card-material.ts`): painted
  // and made the first time a row asks for the card woods, kept after.
  const cardU = batchUniforms();
  let atlas: THREE.Texture | null = null;
  let cardMat: THREE.Material | null = null;
  const cardsKit = (): { material: THREE.Material; atlas: THREE.Texture } => {
    atlas ??= atlasTexture();
    cardMat ??= woods
      ? woods.cards(cardU, wind, atlas)
      : cardMaterial(haze, atlas, (shader) => {
          graftBatch(shader, cardU);
          graftCardTree(shader, wind);
        });
    return { material: cardMat, atlas };
  };
  const region = treePaint(regionLookOf(regionOf(level).id));
  const paint = summerShown() ? summerPaint(region) : region;

  /** Where each of the batches' runs of shapes starts. On a FACETED row a
   * tree's shape in band `b` is `first[b] + its row` (its variant's for the
   * full and mid cuts, its kind's lead for the far band and the casters);
   * on a CARD row the faceted batch holds the far band's sketch and the
   * casters, and the card batch the full, light and cloud cuts:
   * `cardFirst[c] + its row` for card cut `c` (its variant's row). */
  type Shapes = {
    variants: number;
    /** Whether the picture draws the card trees. */
    cards: boolean;
    /** Each tree's variant, for the lens to clear it by. */
    variantOf: TreeVariant[];
    near: Uint16Array;
    far: Uint16Array;
    /** The full, mid and far bands', the full casters' and the sketch
     * casters' first shape (only the far band's and the casters' on a card
     * row). */
    first: [number, number, number, number, number];
    batch: TreeBatch;
    /** The card trees' batch over the same table (none on a faceted row),
     * and its cuts' first shapes (the full cut's only where the row has a
     * card band). */
    cardBatch: TreeBatch | null;
    cardFirst: [number, number, number];
    geometries: THREE.BufferGeometry[];
  };

  /** One of the woods' batches over the table: WebGL's one multi-draw, the
   * node renderer's shapes drawn instanced (`forest-nodes.ts`), or on WebGPU
   * one indirect draw a pass (`forest-indirect.ts`), each shape with the
   * room `room` says. */
  const batchOf = (
    geometries: THREE.BufferGeometry[],
    colour: THREE.Material,
    room: ShapeRoom,
    table?: TreeTable,
  ): TreeBatch =>
    woods?.indirect
      ? createIndirectTreeBatch(
          geometries,
          count,
          matrices,
          data,
          room,
          colour,
          casterNode,
          woods.indirect,
          { table },
        )
      : woods
        ? createNodeTreeBatch(geometries, count, matrices, data, room, colour, casterNode, {
            table,
          })
        : createTreeBatch(
            geometries,
            count,
            matrices,
            data,
            { colour: count * 2, casters: room.casters ? count : 0 },
            colour,
            casterDepth,
            { table },
          );

  /** THE SHAPES for `variants` of every kind (the FOREST row's): which
   * variant every tree is, the map's own variants built at each cut (only
   * the ones it grows), each kind's lead at the far cut, and the casters'
   * cuts. The far band and the casters draw ONE shape a kind (its lead
   * variant). `cards`: the card woods, with their full cut built only when
   * `nearest` — the row's card band — is asked for. */
  function buildShapes(variants: number, cards: boolean, nearest: boolean): Shapes {
    const variantOf: TreeVariant[] = new Array<TreeVariant>(count);
    const near = new Uint16Array(count);
    const far = new Uint16Array(count);
    const nearRows: TreeVariant[] = [];
    const farRows: TreeVariant[] = [];
    const indexOf = (row: TreeVariant, rows: TreeVariant[]): number => {
      let k = rows.indexOf(row);
      if (k < 0) {
        k = rows.length;
        rows.push(row);
      }
      return k;
    };
    // In the generator's order, so every shape keeps the place it had.
    for (let k = 0; k < count; k++) {
      const i = rank[k];
      const t = trees[i];
      const kind = t.kind ?? "spruce";
      const v = treeVariant(kind, t.x, t.z, variants);
      variantOf[i] = v;
      near[i] = indexOf(v, nearRows);
      far[i] = indexOf(leadVariant(kind), farRows);
    }
    const shape = (v: TreeVariant, lod: TreeLod, by = 1): THREE.BufferGeometry => {
      const kp = kindPaint(paint, v.kind);
      const g = buildTree(v, paint, lod);
      if (by !== 1) inset(g, by);
      return packTree(g, kp.needle, kp.dark.clone().lerp(kp.needle, 0.55));
    };
    const casterShapes = [
      ...farRows.map((v) => shape(v, 1)),
      ...farRows.map((v) => shape(v, 2, SKETCH_INSET)),
    ];
    const geometries = cards
      ? [...farRows.map((v) => shape(v, 2)), ...casterShapes]
      : [
          ...nearRows.map((v) => shape(v, 0)),
          ...nearRows.map((v) => shape(v, 1)),
          ...farRows.map((v) => shape(v, 2)),
          ...casterShapes,
        ];
    const nN = nearRows.length;
    const nF = farRows.length;
    // Each shape's room on the node renderer: every tree it can be drawn for.
    const nearRoom = roomOf(near, nN, gone);
    const farRoom = roomOf(far, nF, gone);
    const none = (n: number): Int32Array => new Int32Array(n);
    const cat = (...parts: Int32Array[]): Int32Array =>
      Int32Array.from(parts.flatMap((p) => [...p]));
    const batch = batchOf(geometries, material, {
      colour: cards ? cat(farRoom, none(2 * nF)) : cat(nearRoom, nearRoom, farRoom, none(2 * nF)),
      casters: cat(none(cards ? nF : 2 * nN + nF), farRoom, farRoom),
    });
    batch.bind(colourU, casterU);
    group.add(batch.mesh);
    let cardBatch: TreeBatch | null = null;
    let cardGeometries: THREE.BufferGeometry[] = [];
    const n0 = nearest ? nN : 0;
    const cardFirst: [number, number, number] = [0, n0, n0 + nN];
    if (cards) {
      const kit = cardsKit();
      const cut = (lod: CardLod): THREE.BufferGeometry[] =>
        nearRows.map((v) => packCards(buildCardTree(v, paint, lod)));
      cardGeometries = [...(nearest ? cut(0) : []), ...cut(1), ...cut(2)];
      const cardRoom = cat(...(nearest ? [nearRoom] : []), nearRoom, nearRoom);
      cardBatch = batchOf(
        cardGeometries,
        kit.material,
        { colour: cardRoom, casters: null },
        batch.table,
      );
      cardBatch.bind(cardU, batchUniforms());
      cardBatch.mesh.userData.gpuBytes += atlasBytes(kit.atlas);
      group.add(cardBatch.mesh);
    }
    return {
      variants,
      cards,
      variantOf,
      near,
      far,
      first: cards ? [0, 0, 0, nF, 2 * nF] : [0, nN, 2 * nN, 2 * nN + nF, 2 * nN + 2 * nF],
      batch,
      cardBatch,
      cardFirst,
      geometries: [...geometries, ...cardGeometries],
    };
  }

  function dropShapes(old: Shapes): void {
    if (old.cardBatch) {
      group.remove(old.cardBatch.mesh);
      old.cardBatch.dispose();
    }
    group.remove(old.batch.mesh);
    old.batch.dispose();
    for (const g of old.geometries) g.dispose();
  }

  const cardRow = (o: ForestOptions): boolean => o.style === "cards";
  let shapes = buildShapes(options.variants, cardRow(options), options.cards > 0);
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

  /** Tree `i` listed in `band` (0 full, 1 mid, 2 far, 3 the card tree),
   * kept in the dither window `[lo, hi)`. */
  function place(band: number, i: number, lo: number, hi: number) {
    if (hi <= lo) return;
    if (shapes.cardBatch && band !== 2) {
      // The card band is the full card cut, the full band the light one,
      // the mid band the cloud; the far band is the faceted sketch.
      const cut = band === CARD_BAND ? 0 : band + 1;
      shapes.cardBatch.push(COLOUR, shapes.cardFirst[cut] + shapes.near[i], i, lo, hi);
      return;
    }
    const row = band < 2 ? shapes.near[i] : shapes.far[i];
    shapes.batch.push(COLOUR, shapes.first[band] + row, i, lo, hi);
  }
  /** Every tree's cut and its dissolve into the next (`tree-bands.ts`). */
  const hand = createHandOver(count);
  const draw: TreeDraw = { from: -1, band: -1, split: 0 };
  /** Fills so far, and whether the last left a tree dissolving. */
  let tick = 1;
  let dissolving = false;

  /** Refill the casters: every tree whose shadow can reach the circle. */
  function fillCasters(shadow: ShadowBox | null) {
    const batch = shapes.batch;
    batch.begin(CASTERS);
    if (shadow && options.casters !== "none") {
      const first = shapes.first[options.casters === "full" ? 3 : 4];
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
      for (let row = rMin; row <= rMax; row++) {
        for (let c = cMin; c <= cMax; c++) {
          const b = row * cols + c;
          for (let i = binStart[b]; i < binStart[b + 1]; i++) {
            if (gone[i]) continue;
            const t = trees[i];
            const crown = t.crown + t.height * Math.hypot(leans[i * 2], leans[i * 2 + 1]);
            if (!castsInto(shadow, t.x, t.z, t.height, crown)) continue;
            batch.push(CASTERS, first + shapes.far[i], i, 0, 1);
          }
        }
      }
    }
    batch.end(CASTERS);
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
      // A CUT — the lens put down somewhere else in one frame (a restart, a
      // camera rung, a replay's new shot) — is a new frame of reference:
      // every tree takes its cut at once rather than dissolving into it in
      // plain sight of the new shot.
      if (camera.position.distanceToSquared(lastAt) > JUMP * JUMP) tick++;
      lastAt.copy(camera.position);
      lastLook.copy(look);
      lastFov = camera.fov;
      lastFar = aloft.far;
      pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(pv);
      const cx = camera.position.x;
      const cy = camera.position.y;
      const cz = camera.position.z;
      const batch = shapes.batch;
      batch.begin(COLOUR);
      shapes.cardBatch?.begin(COLOUR);
      // Aloft, a tree's cut is chosen at its SLANT distance from the lens
      // (`lift` over the snow), so the far edge is the plan reach's slant.
      const lift = aloft.lift;
      const lift2 = lift * lift;
      edges.cards = shapes.cardBatch ? options.cards : 0;
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
      // On the snow the row's own edges, the card band only where it was
      // built.
      const bands = { ...options, cards: edges.cards };
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
            // A tree felled for the village or a building's site is never
            // listed (`felledTrees`).
            if (gone[i]) continue;
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
            if (handOver(hand, i, d, lift > 0 ? edges : bands, inFar, now, tick, draw)) {
              dissolving = true;
            }
            if (draw.from >= 0) place(draw.from, i, 0, draw.split);
            if (draw.band >= 0) place(draw.band, i, draw.split, 1);
          }
        }
      }
      batch.end(COLOUR);
      shapes.cardBatch?.end(COLOUR);
    },
    invalidate() {
      // A new frame of reference: every tree takes its cut at once.
      tick++;
      lastAt.set(Infinity, 0, 0);
      lastShadow.x = Infinity;
    },
    setWind(x, z, t) {
      // The clock wrapped every ten minutes, so a float holds it finely.
      wind.value.set(x, z, 0, t % 600);
    },
    setAloft(far, lift, view) {
      aloft.far = Math.max(far, options.far);
      aloft.lift = lift;
      aloft.view = Math.max(view, options.view);
    },
    setOptions(next) {
      if (
        next.variants !== options.variants ||
        cardRow(next) !== shapes.cards ||
        (cardRow(next) && next.cards > 0 !== options.cards > 0)
      ) {
        options = { ...next };
        dropShapes(shapes);
        shapes = buildShapes(next.variants, cardRow(next), next.cards > 0);
      }
      rocks.setLook(next.rocks);
      options = { ...next };
      Object.assign(aloft, { far: options.far, lift: 0, view: options.view });
      tick++;
      lastAt.set(Infinity, 0, 0);
      lastShadow.x = Infinity;
    },
    dispose() {
      rocks.dispose();
      dropShapes(shapes);
      material.dispose();
      casterDepth.dispose();
      casterNode?.dispose();
      atlas?.dispose();
      cardMat?.dispose();
    },
  };
}
