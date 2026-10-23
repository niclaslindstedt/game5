// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WOODS IN ONE INDIRECT DRAW A PASS, on WebGPU (`docs/webgpu.md`, part
// 17). The node renderer draws the woods a shape at a time
// (`forest-nodes.ts`): a mesh, a render object and a draw call for every
// shape in use, some 140 at HIGH, where WebGL's multi-draw makes one a
// pass. Each of those render objects is the node renderer's own processor
// work every frame (its bindings, its pipeline lookup, its buffers set).
//
// Here every shape is packed into ONE geometry (their vertices and indices
// one after another), and each pass is ONE mesh drawn INDIRECT: an
// argument block a shape (`drawIndexedIndirect`: its indices, the trees
// listed for it, its first index, its first vertex, and its first instance),
// and three issues one indirect draw a shape in use off that one render
// object. The list is the same 32-bit words (`slotWord`) the instanced
// shapes carry, one instanced attribute for the whole pass with each
// shape's run at a fixed place (its room, counted once), and the draw's
// FIRST INSTANCE points the shape at its run — so the vertex reads its word
// exactly as the instanced shapes' does, and the woods' materials
// (`forest-tsl.ts`) are the same materials.
//
// A first instance off an indirect draw is WebGPU's optional
// `indirect-first-instance` feature: the kit offers this batch only where
// the device has it (`forest-tsl.ts`'s `woodsKit`). Elsewhere, and on the
// WebGL2 back end, the woods are drawn a shape at a time as before.
//
// The lists are still filled on the processor by `forest.ts`'s cull, the
// same trees in the same order as every other path; only what draws them
// changed. The argument blocks are written by the processor too: a shape's
// count is the length of its run.
//
// This file is three's core alone: the indirect buffer is made by the kit
// (`WoodsKit.indirect`), the one piece of three's node half it needs.

import * as THREE from "three";

import {
  CASTERS,
  COLOUR,
  buildTable,
  slotWord,
  type BatchExtras,
  type TreeBatch,
} from "./forest-batch.ts";
import { WOODS_CASTERS, type ShapeRoom } from "./forest-nodes.ts";

/** 32-bit words an indexed indirect draw's arguments take. */
export const ARGS = 5;

/** Makes the buffer an indirect draw reads its arguments from (three's
 * `IndirectStorageBufferAttribute` over `args`). */
export type IndirectOf = (args: Uint32Array) => THREE.BufferAttribute;

/** Where each shape lies in the packed geometry, in indices and vertices. */
export type Packed = {
  readonly geometry: THREE.BufferGeometry;
  readonly firstIndex: Int32Array;
  readonly indexCount: Int32Array;
  readonly baseVertex: Int32Array;
};

/** `shapes` packed into one geometry: every attribute the first carries,
 * each shape's vertices after the last's, each shape's indices as they are
 * (the draw's base vertex moves them), in a 32-bit index. `used` says which
 * shapes go in at all; one left out takes no room. */
export function packShapes(shapes: readonly THREE.BufferGeometry[], used: boolean[]): Packed {
  const n = shapes.length;
  const firstIndex = new Int32Array(n);
  const indexCount = new Int32Array(n);
  const baseVertex = new Int32Array(n);
  let verts = 0;
  let indices = 0;
  shapes.forEach((g, s) => {
    if (!used[s]) return;
    const v = g.getAttribute("position").count;
    const k = g.index ? g.index.count : v;
    baseVertex[s] = verts;
    firstIndex[s] = indices;
    indexCount[s] = k;
    verts += v;
    indices += k;
  });
  const geometry = new THREE.BufferGeometry();
  const first = shapes.find((_, s) => used[s]);
  if (!first) return { geometry, firstIndex, indexCount, baseVertex };
  for (const [name, a0] of Object.entries(first.attributes)) {
    const a = a0 as THREE.BufferAttribute;
    const size = a.itemSize;
    const Arr = a.array.constructor as { new (n: number): THREE.TypedArray };
    const out = new Arr(verts * size);
    shapes.forEach((g, s) => {
      if (!used[s]) return;
      const b = g.getAttribute(name) as THREE.BufferAttribute | undefined;
      const count = g.getAttribute("position").count;
      // A shape without this attribute keeps zeros where it would be.
      if (!b || b.itemSize !== size) return;
      out.set(b.array.subarray(0, count * size), baseVertex[s] * size);
    });
    geometry.setAttribute(name, new THREE.BufferAttribute(out, size, a.normalized));
  }
  const index = new Uint32Array(indices);
  shapes.forEach((g, s) => {
    if (!used[s]) return;
    if (g.index) index.set(g.index.array, firstIndex[s]);
    else for (let k = 0; k < indexCount[s]; k++) index[firstIndex[s] + k] = k;
  });
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  return { geometry, firstIndex, indexCount, baseVertex };
}

type PassDraw = {
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.InstancedBufferGeometry;
  readonly words: Uint32Array;
  readonly attr: THREE.InstancedBufferAttribute;
  readonly args: Uint32Array;
  readonly indirect: THREE.BufferAttribute;
  /** Each shape's run: where it starts in `words`, its room, its length. */
  readonly origin: Int32Array;
  readonly room: Int32Array;
  readonly n: Int32Array;
  /** The byte offsets of the shapes drawn this fill. */
  readonly offsets: number[];
};

/** The woods' batch drawn indirect (see the header), in `forest-batch.ts`'s
 * shape: `shapes` drawn with `colour` in the picture and `casters` into the
 * key's map, over a table of `count` trees, each shape with the room `room`
 * says. */
export function createIndirectTreeBatch(
  shapes: readonly THREE.BufferGeometry[],
  count: number,
  matrices: Float32Array,
  data: Float32Array,
  room: ShapeRoom,
  colour: THREE.Material,
  casters: THREE.Material | null,
  indirectOf: IndirectOf,
  extras: BatchExtras = {},
): TreeBatch {
  const own = extras.table === undefined;
  const table = extras.table ?? buildTable(count, matrices, data);
  const group = new THREE.Group();
  group.name = "woods";
  const roomIn = (pass: number, s: number): number =>
    pass === COLOUR ? room.colour[s] : casters ? (room.casters?.[s] ?? 0) : 0;
  const used = shapes.map((_, s) => roomIn(COLOUR, s) > 0 || roomIn(CASTERS, s) > 0);
  const packed = packShapes(shapes, used);
  const triangles = Int32Array.from(shapes, (g) =>
    Math.round((g.index ? g.index.count : g.getAttribute("position").count) / 3),
  );

  const passOf = (pass: number): PassDraw | null => {
    const material = pass === COLOUR ? colour : casters;
    const roomOf = Int32Array.from(shapes, (_, s) => Math.max(0, roomIn(pass, s)));
    const origin = new Int32Array(shapes.length);
    let total = 0;
    roomOf.forEach((r, s) => {
      origin[s] = total;
      total += r;
    });
    if (!material || total === 0) return null;
    const geometry = new THREE.InstancedBufferGeometry();
    for (const [name, a] of Object.entries(packed.geometry.attributes))
      geometry.setAttribute(name, a);
    geometry.setIndex(packed.geometry.index);
    const words = new Uint32Array(total);
    const attr = new THREE.InstancedBufferAttribute(words, 1);
    attr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("treeWord", attr);
    geometry.instanceCount = 0;
    const args = new Uint32Array(shapes.length * ARGS);
    for (let s = 0; s < shapes.length; s++) {
      args[s * ARGS] = packed.indexCount[s];
      args[s * ARGS + 2] = packed.firstIndex[s];
      args[s * ARGS + 3] = packed.baseVertex[s];
      args[s * ARGS + 4] = origin[s];
    }
    const indirect = indirectOf(args);
    const offsets: number[] = [];
    // The kit made it a storage buffer three draws indirect from.
    geometry.setIndirect(indirect as Parameters<typeof geometry.setIndirect>[0], offsets);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = pass === COLOUR ? "woods-indirect" : "woods-indirect-casters";
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
    group.add(mesh);
    const n = new Int32Array(shapes.length);
    return { mesh, geometry, words, attr, args, indirect, origin, room: roomOf, n, offsets };
  };
  const passes = [passOf(COLOUR), passOf(CASTERS)];

  let bytes = 0;
  for (const a of Object.values(packed.geometry.attributes))
    bytes += (a as THREE.BufferAttribute).array.byteLength;
  bytes += packed.geometry.index?.array.byteLength ?? 0;
  for (const d of passes) if (d) bytes += d.words.byteLength + d.args.byteLength;
  if (own) {
    bytes +=
      (table.matrix.image.data as Float32Array).byteLength +
      (table.data.image.data as Float32Array).byteLength;
  }
  group.userData.gpuBytes = bytes;

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
      passes[pass]?.n.fill(0);
    },
    push(pass, shape, tree, lo, hi) {
      const d = passes[pass];
      if (!d || d.n[shape] >= d.room[shape]) return;
      d.words[d.origin[shape] + d.n[shape]++] = slotWord(tree, lo, hi);
    },
    end(pass) {
      const d = passes[pass];
      if (!d) return;
      d.offsets.length = 0;
      d.attr.clearUpdateRanges();
      let trees = 0;
      let tris = 0;
      for (let s = 0; s < shapes.length; s++) {
        const k = d.n[s];
        d.args[s * ARGS + 1] = k;
        if (k === 0) continue;
        d.offsets.push(s * ARGS * 4);
        d.attr.addUpdateRange(d.origin[s], k);
        trees += k;
        tris += triangles[s] * k;
      }
      d.mesh.visible = trees > 0;
      d.geometry.instanceCount = trees;
      // The frame's counters read one draw of `drawRange` indices `trees`
      // times: the mean shape's, so they count the triangles drawn.
      d.geometry.setDrawRange(0, trees > 0 ? Math.round((tris * 3) / trees) : 0);
      if (trees === 0) return;
      d.attr.needsUpdate = true;
      d.indirect.needsUpdate = true;
    },
    drawn(pass) {
      const d = passes[pass];
      let trees = 0;
      let tris = 0;
      if (d) {
        for (let s = 0; s < shapes.length; s++) {
          trees += d.n[s];
          tris += triangles[s] * d.n[s];
        }
      }
      return { trees, triangles: tris };
    },
    dispose() {
      for (const d of passes) d?.geometry.dispose();
      packed.geometry.dispose();
      if (own) {
        table.matrix.dispose();
        table.data.dispose();
      }
    },
  };
}
