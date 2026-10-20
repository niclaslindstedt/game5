// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WOODS ON THE NODE RENDERER (`docs/webgpu.md`, part 8). WebGL draws a
// whole wood in one multi-draw a pass (`forest-batch.ts`): a sub-draw a
// shape, each drawn once a tree of it. The node renderer draws a
// `BatchedMesh` one instance a sub-draw, so that trick cannot run there.
// Here every shape is a mesh of its own in each pass that draws it, drawn
// INSTANCED once a tree listed for it: one draw a shape in use.
//
// THE TREES ARE THE SAME TABLE. Every tree's matrix and its own numbers are
// the two float textures WebGL's batch reads (`buildTable`), written once a
// map. What a frame sends is the same LIST, cut by shape: each shape's mesh
// carries an instanced attribute of 32-bit words (`treeWord`), one a tree
// drawn, the word WebGL's list holds (`slotWord`: the tree and the window of
// the dither it is kept in). The vertex finds its tree from its own word,
// so no draw needs to know where its run starts.
//
// A shape's room is every tree that can be drawn as it (the forest counts
// them, `forest.ts`), so nothing is ever grown mid-run.
//
// THE CASTERS are meshes of their own, drawn ONLY into the key's shadow
// map: they stand on a layer the lens never sees (`WOODS_CASTERS`), which
// the dressing opens on the key's shadow camera (`gpu-dress.ts`). The picture's
// meshes cast nothing, as WebGL's picture list casts nothing.
//
// The materials are the node renderer's own (`forest-tsl.ts`), handed in
// through the seam (`render-seam.ts`'s `woods`), so this file is three's
// core alone and the WebGL build never reaches three's node half.

import * as THREE from "three";

import {
  CASTERS,
  COLOUR,
  buildTable,
  slotWord,
  type BatchExtras,
  type BatchUniforms,
  type TreeBatch,
} from "./forest-batch.ts";

/** The layer the casters stand on: the key's shadow camera sees it, the
 * lens never does. (The skiers' atlas uses 7 to 10, `hero-shadow.ts`.) */
export const WOODS_CASTERS = 6;

/** The node materials the woods are drawn with (`forest-tsl.ts`), each over
 * a batch's uniforms (`batchUniforms`, re-pointed as batches are rebuilt)
 * and the wind in the crowns. */
export type WoodsKit = {
  /** The faceted cuts: the girth, the wind, the snow and the tint, the
   * hand-over's dither, lit and hazed as every world material. */
  tree(u: BatchUniforms, wind: THREE.IUniform<THREE.Vector4>): THREE.Material;
  /** The card trees over the needle atlas (`tree-card-material.ts`). */
  cards(
    u: BatchUniforms,
    wind: THREE.IUniform<THREE.Vector4>,
    atlas: THREE.Texture,
  ): THREE.Material;
  /** The casters' depth: the girth and the wind, cut where the mountain
   * already shades it (`castMask`). */
  casters(u: BatchUniforms, wind: THREE.IUniform<THREE.Vector4>): THREE.Material;
};

/** How many trees each shape may be drawn for in each pass (0: none). */
export type ShapeRoom = { colour: Int32Array; casters: Int32Array | null };

type Draw = {
  readonly mesh: THREE.Mesh;
  readonly words: Uint32Array;
  readonly attr: THREE.InstancedBufferAttribute;
  readonly geometry: THREE.InstancedBufferGeometry;
  readonly triangles: number;
  n: number;
};

/** A shape drawn instanced: its own attributes shared, its own words. */
function drawOf(
  shape: THREE.BufferGeometry,
  room: number,
  material: THREE.Material,
  pass: number,
): Draw {
  const geometry = new THREE.InstancedBufferGeometry();
  for (const [name, a] of Object.entries(shape.attributes)) geometry.setAttribute(name, a);
  if (shape.index) geometry.setIndex(shape.index);
  const words = new Uint32Array(room);
  const attr = new THREE.InstancedBufferAttribute(words, 1);
  attr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("treeWord", attr);
  geometry.instanceCount = 0;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  if (pass === CASTERS) {
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.layers.set(WOODS_CASTERS);
  } else {
    mesh.castShadow = false;
    mesh.receiveShadow = true;
  }
  const verts = shape.index ? shape.index.count : shape.getAttribute("position").count;
  return { mesh, words, attr, geometry, triangles: verts / 3, n: 0 };
}

/** The woods' batch on the node renderer, in `forest-batch.ts`'s shape:
 * `shapes` drawn with `colour` in the picture and `casters` into the key's
 * map, over a table of `count` trees, each shape with the room `room` says. */
export function createNodeTreeBatch(
  shapes: readonly THREE.BufferGeometry[],
  count: number,
  matrices: Float32Array,
  data: Float32Array,
  room: ShapeRoom,
  colour: THREE.Material,
  casters: THREE.Material | null,
  extras: BatchExtras = {},
): TreeBatch {
  const own = extras.table === undefined;
  const table = extras.table ?? buildTable(count, matrices, data);
  const group = new THREE.Group();
  group.name = "woods";
  const passes: (Draw | null)[][] = [COLOUR, CASTERS].map((pass) =>
    shapes.map((shape, s) => {
      const r = pass === COLOUR ? room.colour[s] : (room.casters?.[s] ?? 0);
      const material = pass === COLOUR ? colour : casters;
      if (r <= 0 || !material) return null;
      const d = drawOf(shape, r, material, pass);
      group.add(d.mesh);
      return d;
    }),
  );
  const triangles = Int32Array.from(shapes, (g) =>
    Math.round((g.index ? g.index.count : g.getAttribute("position").count) / 3),
  );
  let words = 0;
  for (const list of passes) for (const d of list) if (d) words += d.words.byteLength;
  const tableBytes = own
    ? (table.matrix.image.data as Float32Array).byteLength +
      (table.data.image.data as Float32Array).byteLength
    : 0;
  group.userData.gpuBytes = tableBytes + words;
  return {
    mesh: group,
    table,
    triangles,
    bind(c, k) {
      for (const u of [c, k]) {
        u.uTreeMatrix.value = table.matrix;
        u.uTreeData.value = table.data;
      }
    },
    begin(pass) {
      for (const d of passes[pass]) if (d) d.n = 0;
    },
    push(pass, shape, tree, lo, hi) {
      const d = passes[pass][shape];
      if (!d || d.n >= d.words.length) return;
      d.words[d.n++] = slotWord(tree, lo, hi);
    },
    end(pass) {
      for (const d of passes[pass]) {
        if (!d) continue;
        d.geometry.instanceCount = d.n;
        d.mesh.visible = d.n > 0;
        if (d.n === 0) continue;
        d.attr.clearUpdateRanges();
        d.attr.addUpdateRange(0, d.n);
        d.attr.needsUpdate = true;
      }
    },
    drawn(pass) {
      let trees = 0;
      let tris = 0;
      for (const d of passes[pass]) {
        if (!d) continue;
        trees += d.n;
        tris += d.triangles * d.n;
      }
      return { trees, triangles: tris };
    },
    dispose() {
      for (const list of passes) for (const d of list) d?.geometry.dispose();
      if (own) {
        table.matrix.dispose();
        table.data.dispose();
      }
    },
  };
}

/** How many of `count` trees stand as each of `rows` rows of `of` (a felled
 * one never does): a shape's room off the rows it is built for. */
export function roomOf(of: Uint16Array, rows: number, gone: Uint8Array): Int32Array {
  const room = new Int32Array(rows);
  for (let i = 0; i < of.length; i++) if (!gone[i]) room[of[i]]++;
  return room;
}
