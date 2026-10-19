// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WOODS IN ONE BATCH. Every shape the forest draws — every kind's
// variants at the full and the mid cut, every kind's sketch, the casters'
// cuts — is packed into ONE geometry (three's `BatchedMesh`), and the whole
// wood is drawn in ONE multi-draw a pass: a sub-draw a shape, each drawn
// once a tree of it (`multi-draw.ts`), the picture's list and the shadow
// map's list from the same object.
//
// THE TREES ARE A TABLE, NOT A BUFFER. Every tree's matrix and its own
// numbers (its girth, its tone, its load of snow, its needles' shade) are
// written ONCE a map into two float textures; a frame sends only a LIST —
// one 32-bit word a tree drawn: which tree, and the window of the dither it
// is kept in while it dissolves between cuts (`tree-bands.ts`) — grouped by
// shape, and a tiny table of where each shape's run of the list starts. The
// vertex shader finds its tree from `gl_DrawID` (the shape's run) and
// `gl_InstanceID` (the tree in it).
//
// A slot's word: the tree's number in the low 18 bits (a map holds fewer
// than 262 144 trees), then the window's low edge and its high edge in 7
// bits each, in 127ths.

import * as THREE from "three";

import { glslOnly } from "./gpu-backend.ts";
import { arm, disarm, hookMultiDraw } from "./multi-draw.ts";

/** The two lists the batch draws: the picture's and the shadow map's. */
export const COLOUR = 0;
export const CASTERS = 1;
export type Pass = typeof COLOUR | typeof CASTERS;

/** Floats a tree's own numbers take in the data table: two texels. */
export const TREE_DATA = 8;

const TREE_BITS = 18;
const MAX_TREES = 1 << TREE_BITS;
/** Texels a row of the list texture (four slots a texel). */
const LIST_ROW = 512;

/** A tree's slot word: the tree and its dither window `[lo, hi)`. */
export function slotWord(tree: number, lo: number, hi: number): number {
  const l = Math.round(lo * 127);
  const h = Math.round(hi * 127);
  return (tree | (l << TREE_BITS) | (h << (TREE_BITS + 7))) >>> 0;
}

/** THE TREE TABLE AND THE LIST, in the vertex shader — in place of three's
 * own `batching_vertex`, so `batchingMatrix` is the tree's and the rest of
 * three's chunks transform by it as they would. Leaves `tbData` (girth x,
 * girth z, tone, load), `tbMore` (the needles' rgb and a hash of the tree)
 * and `tbFade` (the dither window) for the grafts after it. */
const BATCH_VERTEX = /* glsl */ `
#ifdef USE_BATCHING
  int tbK = int(gl_DrawID);
  int tbBw = textureSize(uDrawBase, 0).x;
  int tbSlot = int(texelFetch(uDrawBase, ivec2(tbK % tbBw, tbK / tbBw), 0).r) + gl_InstanceID;
  int tbLw = textureSize(uSlots, 0).x;
  int tbTexel = tbSlot >> 2;
  uvec4 tbQuad = texelFetch(uSlots, ivec2(tbTexel % tbLw, tbTexel / tbLw), 0);
  int tbLane = tbSlot & 3;
  uint tbWord = tbLane == 0 ? tbQuad.x : tbLane == 1 ? tbQuad.y : tbLane == 2 ? tbQuad.z : tbQuad.w;
  int tbTree = int(tbWord & ${MAX_TREES - 1}u);
  vec2 tbFade = vec2(float((tbWord >> ${TREE_BITS}u) & 127u), float((tbWord >> ${TREE_BITS + 7}u) & 127u)) / 127.0;
  int tbMw = textureSize(uTreeMatrix, 0).x;
  int tbM = tbTree * 4;
  mat4 batchingMatrix = mat4(
    texelFetch(uTreeMatrix, ivec2(tbM % tbMw, tbM / tbMw), 0),
    texelFetch(uTreeMatrix, ivec2((tbM + 1) % tbMw, tbM / tbMw), 0),
    texelFetch(uTreeMatrix, ivec2((tbM + 2) % tbMw, tbM / tbMw), 0),
    texelFetch(uTreeMatrix, ivec2((tbM + 3) % tbMw, tbM / tbMw), 0));
  int tbDw = textureSize(uTreeData, 0).x;
  int tbD = tbTree * 2;
  vec4 tbData = texelFetch(uTreeData, ivec2(tbD % tbDw, tbD / tbDw), 0);
  vec4 tbMore = texelFetch(uTreeData, ivec2((tbD + 1) % tbDw, tbD / tbDw), 0);
  vec2 girth = tbData.xy;
#endif
`;

const BATCH_PARS = /* glsl */ `
uniform highp sampler2D uTreeMatrix;
uniform highp sampler2D uTreeData;
uniform highp usampler2D uSlots;
uniform highp usampler2D uDrawBase;
`;

/** The uniforms a batch's materials read: one set the picture's, one the
 * casters' (their lists start in different places). Held across rebuilds,
 * so a program compiled once keeps reading the batch of the day. */
export type BatchUniforms = {
  uTreeMatrix: THREE.IUniform<THREE.Texture | null>;
  uTreeData: THREE.IUniform<THREE.Texture | null>;
  uSlots: THREE.IUniform<THREE.Texture | null>;
  uDrawBase: THREE.IUniform<THREE.Texture | null>;
};

export function batchUniforms(): BatchUniforms {
  return {
    uTreeMatrix: { value: null },
    uTreeData: { value: null },
    uSlots: { value: null },
    uDrawBase: { value: null },
  };
}

/** Graft the table and the list into a material's vertex shader (the
 * picture's and the casters' depth alike). */
export function graftBatch(
  shader: { vertexShader: string; uniforms: Record<string, THREE.IUniform> },
  u: BatchUniforms,
): void {
  Object.assign(shader.uniforms, u);
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${BATCH_PARS}`)
    .replace("#include <batching_vertex>", BATCH_VERTEX);
}

/** One pass's draw: the shapes it draws, in order, each one's run in the
 * vertex buffer and how many trees, and where each run of the list starts. */
type PassList = {
  /** The list's first slot for this pass. */
  readonly origin: number;
  readonly room: number;
  /** Pending this fill: each tree's shape and word. */
  readonly shapeOf: Uint16Array;
  readonly wordOf: Uint32Array;
  n: number;
  /** The draw, as three hands it to the context. */
  readonly starts: Int32Array;
  readonly counts: Int32Array;
  readonly instances: Int32Array;
  draws: number;
  /** Triangles drawn past the one copy three counts a sub-draw. */
  extra: number;
  readonly base: THREE.DataTexture;
  readonly per: Int32Array;
};

/** The tree table's two textures: every tree's matrix and its own numbers.
 * One batch builds them; another may draw over the same table (the card
 * woods over their faceted shadow casters', `forest.ts`). */
export type TreeTable = { readonly matrix: THREE.DataTexture; readonly data: THREE.DataTexture };

/** What a batch may be built with beside its shapes: another batch's
 * `table` to read instead of building its own. */
export type BatchExtras = { table?: TreeTable };

export type TreeBatch = {
  readonly mesh: THREE.BatchedMesh;
  /** The tree table this batch reads. */
  readonly table: TreeTable;
  /** Triangles a shape has. */
  readonly triangles: Int32Array;
  /** Point the materials' uniforms at this batch. */
  bind(colour: BatchUniforms, casters: BatchUniforms): void;
  /** Start a pass's list afresh. */
  begin(pass: Pass): void;
  /** Tree `tree` drawn as shape `shape` in `pass`, in the window `[lo, hi)`. */
  push(pass: Pass, shape: number, tree: number, lo: number, hi: number): void;
  /** The pass's list grouped by shape and sent. */
  end(pass: Pass): void;
  /** Trees and triangles the pass draws. */
  drawn(pass: Pass): { trees: number; triangles: number };
  dispose(): void;
};

/** THE TREE TABLE as two float textures: `matrices` 16 floats a tree, four
 * texels, rows a multiple of four wide so a tree's four never wrap; `data`
 * `TREE_DATA` floats a tree, two texels. */
function buildTable(count: number, matrices: Float32Array, data: Float32Array): TreeTable {
  const mw = Math.max(4, Math.ceil(Math.sqrt(count * 4) / 4) * 4);
  const mh = Math.max(1, Math.ceil((count * 4) / mw));
  const mArr = new Float32Array(mw * mh * 4);
  mArr.set(matrices.subarray(0, count * 16));
  const matrix = new THREE.DataTexture(mArr, mw, mh, THREE.RGBAFormat, THREE.FloatType);
  matrix.needsUpdate = true;
  const dw = Math.max(2, Math.ceil(Math.sqrt(count * 2) / 2) * 2);
  const dh = Math.max(1, Math.ceil((count * 2) / dw));
  const dArr = new Float32Array(dw * dh * 4);
  dArr.set(data.subarray(0, count * TREE_DATA));
  const table = new THREE.DataTexture(dArr, dw, dh, THREE.RGBAFormat, THREE.FloatType);
  table.needsUpdate = true;
  return { matrix, data: table };
}

/** Pack `shapes` into one batch drawn with `material` (and `depth` into the
 * shadow map), over a table of `count` trees: `matrices` 16 floats a tree,
 * `data` `TREE_DATA` floats a tree. `room` is how many trees each pass may
 * draw at most. */
export function createTreeBatch(
  shapes: readonly THREE.BufferGeometry[],
  count: number,
  matrices: Float32Array,
  data: Float32Array,
  room: { colour: number; casters: number },
  material: THREE.Material,
  depth: THREE.Material,
  extras: BatchExtras = {},
): TreeBatch {
  if (count >= MAX_TREES) throw new Error(`forest batch: ${count} trees past ${MAX_TREES}`);
  const vertices = shapes.reduce((n, g) => n + g.getAttribute("position").count, 0);
  const mesh = new THREE.BatchedMesh(1, Math.max(3, vertices), 0, material);
  const ids = shapes.map((g) => mesh.addGeometry(g));
  type Info = { start: number; count: number };
  const info = (mesh as unknown as { _geometryInfo: Info[] })._geometryInfo;
  const starts = ids.map((id) => info[id].start);
  const lengths = ids.map((id) => info[id].count);
  const triangles = Int32Array.from(lengths, (l) => l / 3);

  // THE TABLE: the matrices, four texels a tree, rows a multiple of four
  // wide so a tree's four never wrap; the data two texels a tree — or
  // another batch's, read as it is.
  const own = extras.table === undefined;
  const tree = extras.table ?? buildTable(count, matrices, data);
  const matrix = tree.matrix;
  const table = tree.data;
  const tableBytes = own
    ? (matrix.image.data as Float32Array).byteLength + (table.image.data as Float32Array).byteLength
    : 0;

  // THE LIST: the picture's run first, the casters' after it.
  const total = room.colour + room.casters;
  const lh = Math.max(1, Math.ceil(total / 4 / LIST_ROW));
  const slotArr = new Uint32Array(LIST_ROW * lh * 4);
  const slots = new THREE.DataTexture(
    slotArr,
    LIST_ROW,
    lh,
    THREE.RGBAIntegerFormat,
    THREE.UnsignedIntType,
  );
  slots.internalFormat = "RGBA32UI";
  slots.needsUpdate = true;
  const baseTexture = (): THREE.DataTexture => {
    const t = new THREE.DataTexture(
      new Uint32Array(Math.max(1, shapes.length)),
      Math.max(1, shapes.length),
      1,
      THREE.RedIntegerFormat,
      THREE.UnsignedIntType,
    );
    t.internalFormat = "R32UI";
    t.needsUpdate = true;
    return t;
  };
  const passList = (origin: number, n: number, base: THREE.DataTexture): PassList => ({
    origin,
    room: n,
    shapeOf: new Uint16Array(Math.max(1, n)),
    wordOf: new Uint32Array(Math.max(1, n)),
    n: 0,
    starts: new Int32Array(Math.max(1, shapes.length)),
    counts: new Int32Array(Math.max(1, shapes.length)),
    instances: new Int32Array(Math.max(1, shapes.length)),
    draws: 0,
    extra: 0,
    base,
    per: new Int32Array(shapes.length + 1),
  });
  const lists: [PassList, PassList] = [
    passList(0, room.colour, baseTexture()),
    passList(room.colour, room.casters, baseTexture()),
  ];
  // THE DRAW: three's own multi-draw path, handed the pass's list and armed
  // to draw each sub-draw once a tree.
  type Drawn = {
    _multiDrawStarts: Int32Array;
    _multiDrawCounts: Int32Array;
    _multiDrawCount: number;
  };
  const drawn = mesh as unknown as Drawn;
  const hand = (renderer: THREE.WebGLRenderer, pass: Pass): void => {
    hookMultiDraw(renderer.getContext() as WebGL2RenderingContext);
    const l = lists[pass];
    drawn._multiDrawStarts = l.starts;
    drawn._multiDrawCounts = l.counts;
    drawn._multiDrawCount = l.draws;
    arm(l.instances);
  };
  const done = (renderer: THREE.WebGLRenderer, pass: Pass): void => {
    disarm();
    renderer.info.render.triangles += lists[pass].extra;
  };
  mesh.onBeforeRender = (renderer) => hand(renderer, COLOUR);
  mesh.onAfterRender = (renderer) => done(renderer, COLOUR);
  mesh.onBeforeShadow = (renderer) => hand(renderer, CASTERS);
  mesh.onAfterShadow = (renderer) => done(renderer, CASTERS);
  // A batch with no casters' room (the card woods) casts nothing.
  mesh.castShadow = room.casters > 0;
  mesh.receiveShadow = true;
  mesh.customDepthMaterial = depth;
  mesh.frustumCulled = false;
  mesh.perObjectFrustumCulled = false;
  // Drawn through WebGL's own multi-draw (`multi-draw.ts`): hidden on the
  // webgpu paths until the woods are ported (`gpu-quarantine.ts`).
  glslOnly(mesh, "forest-batch");
  mesh.sortObjects = false;
  drawn._multiDrawCount = 0;
  // For the instruments: what a frame submits (`scene-tally.ts`), and the
  // lists as bytes (`make cpu-cost`'s hash).
  mesh.userData.drawnTriangles = (): number => {
    const l = lists[COLOUR];
    let tris = 0;
    for (let k = 0; k < l.draws; k++) tris += (l.counts[k] / 3) * l.instances[k];
    return tris;
  };
  mesh.userData.gpuBytes = tableBytes + slotArr.byteLength + 2 * 4 * Math.max(1, shapes.length);
  mesh.userData.drawnBytes = (): Uint8Array[] =>
    lists.map((l) => {
      const n = l.n;
      return new Uint8Array(slotArr.buffer, l.origin * 4, n * 4);
    });

  return {
    mesh,
    table: tree,
    triangles,
    bind(colour, casters) {
      for (const [u, base] of [
        [colour, lists[COLOUR].base],
        [casters, lists[CASTERS].base],
      ] as const) {
        u.uTreeMatrix.value = matrix;
        u.uTreeData.value = table;
        u.uSlots.value = slots;
        u.uDrawBase.value = base;
      }
    },
    begin(pass) {
      lists[pass].n = 0;
    },
    push(pass, shape, tree, lo, hi) {
      const l = lists[pass];
      if (l.n >= l.room) return;
      l.shapeOf[l.n] = shape;
      l.wordOf[l.n] = slotWord(tree, lo, hi);
      l.n++;
    },
    end(pass) {
      const l = lists[pass];
      // Grouped by shape: a count, a running start, a scatter.
      const per = l.per;
      per.fill(0);
      for (let i = 0; i < l.n; i++) per[l.shapeOf[i] + 1]++;
      const base = l.base.image.data as Uint32Array;
      let draws = 0;
      let extra = 0;
      for (let s = 0; s < shapes.length; s++) {
        const n = per[s + 1];
        per[s + 1] += per[s];
        if (n === 0) continue;
        l.starts[draws] = starts[s];
        l.counts[draws] = lengths[s];
        l.instances[draws] = n;
        base[draws] = l.origin + per[s];
        extra += triangles[s] * (n - 1);
        draws++;
      }
      for (let i = 0; i < l.n; i++) slotArr[l.origin + per[l.shapeOf[i]]++] = l.wordOf[i];
      l.draws = draws;
      l.extra = extra;
      l.base.needsUpdate = true;
      // Send the rows written.
      const perRow = LIST_ROW * 4;
      const r0 = Math.floor(l.origin / perRow);
      const r1 = Math.floor((l.origin + Math.max(0, l.n - 1)) / perRow);
      if (l.n === 0) return;
      for (let r = r0; r <= r1; r++) slots.addUpdateRange(r * perRow, perRow);
      slots.needsUpdate = true;
    },
    drawn(pass) {
      const l = lists[pass];
      let tris = 0;
      for (let k = 0; k < l.draws; k++) tris += (l.counts[k] / 3) * l.instances[k];
      return { trees: l.n, triangles: tris };
    },
    dispose() {
      mesh.dispose();
      if (own) {
        matrix.dispose();
        table.dispose();
      }
      slots.dispose();
      lists[COLOUR].base.dispose();
      lists[CASTERS].base.dispose();
    },
  };
}
