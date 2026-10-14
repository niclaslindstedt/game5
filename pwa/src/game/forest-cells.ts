// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WOODS BY CELL, AS DRAWN (`forest-patches.ts` says what a level is):
// every cell that holds a tree settled to its level each pass, the merged
// blocks and shell tiles it needs built nearest first and kept in a cache,
// shown or hidden, and the cells whose trees are drawn one by one handed
// back to `forest.ts`, which fills them.

import * as THREE from "three";
import type { Level } from "@engine";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { buildTree } from "./tree-shapes.ts";
import { leadVariant } from "./tree-variants.ts";
import {
  CELL,
  TILE,
  BLOCK,
  blockCell,
  buildShell,
  createMeshCache,
  geometryBytes,
  graftCellLod,
  graftShellTier,
  hidden,
  levelAt,
  mergeBlock,
  settleLevel,
  shellFrom,
  shellPaintOf,
  stepLevel,
  type CellEdges,
  type CellLevel,
  type CellLod,
  type CellTrees,
  type ShellPaint,
  type ShellTree,
} from "./forest-patches.ts";
import type { ForestOptions } from "./forest.ts";

/** What the cells are read off: the map's trees binned by cell, each bin's
 * height and lean, the shapes and options of the moment, the lens's view. */
export type CellsContext = {
  level: Level;
  haze: HazeUniforms;
  lod: CellLod;
  group: THREE.Group;
  trees: Level["trees"];
  cells: CellTrees;
  binTop: Float32Array;
  binLow: Float32Array;
  binLean: Float32Array;
  thin: Float32Array;
  paint: Parameters<typeof buildTree>[1];
  frustum: THREE.Frustum;
  aloft: { far: number; view: number };
  options: () => ForestOptions;
  shapes: () => {
    midGeos: THREE.BufferGeometry[];
    sketchGeos: THREE.BufferGeometry[];
    midShape: Uint8Array;
  };
};

export type ForestCells = {
  /** One pass over the cells; `moved` the lens, `jump` far enough to settle at once. */
  pass(camera: THREE.PerspectiveCamera, moved: boolean, jump: boolean): void;
  /** The cells whose trees are drawn one by one, as of the last pass. */
  near(): number[];
  /** Every cell taken to its level at once on the next pass. */
  invalidate(): void;
  /** Every merged mesh dropped (the shapes or the thinning changed). */
  reset(): void;
  dispose(): void;
};

export function createForestCells(ctx: CellsContext): ForestCells {
  const { level, haze, lod, trees, cells, binTop, binLow, binLean, thin, paint, frustum, aloft } =
    ctx;
  const { cols, binStart, gone } = cells;
  const box = new THREE.Box3();
  // THE PATCHES (`forest-patches.ts`): a cell's trees merged at the mid cut
  // and at the sketch, and the canopy shell, each read against its cell's
  // level in its own material.
  const patchMaterial = (level: 1 | 2) =>
    hazeMaterial(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
      haze,
      `tree-patch${level}`,
      (shader) => graftCellLod(shader, lod, level, blockCell(BLOCK), BLOCK),
    );
  const patchMaterials = { 1: patchMaterial(1), 2: patchMaterial(2) };
  const shellMaterial = hazeMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
    haze,
    "tree-shell",
    (shader) => {
      graftCellLod(shader, lod, 3, blockCell(TILE), TILE);
      graftShellTier(shader);
    },
  );
  // ---- THE CELLS (`forest-patches.ts`) --------------------------------
  /** The cells that hold a tree, and each one's box. */
  const filled: number[] = [];
  for (let b = 0; b < cols * cols; b++) if (binStart[b + 1] > binStart[b]) filled.push(b);
  const snowAt = (x: number, z: number): number => level.groundAt(x, z);
  /** The pass each cell was last seen in (in the frustum, not behind the
   * mountain), and whether it was hidden at the last horizon test. */
  const seenAt = new Uint32Array(cols * cols);
  /** Each cell's distance, level wanted and whether it is in sight, on the
   * last pass. */
  const cellD = new Float32Array(cols * cols);
  const want = new Uint8Array(cols * cols);
  const sight = new Uint8Array(cols * cols);
  const behind = new Uint8Array(cols * cols);
  const horizonAt = new THREE.Vector3(Infinity, 0, 0);
  let pass = 1;
  let lastNow = 0;
  let animating = false;
  /** The cells whose trees are drawn one by one (level 0's share). */
  let nearCells: number[] = [];
  const patches = new THREE.Group();
  patches.name = "patches";
  ctx.group.add(patches);
  const budgetOf = (variants: number) =>
    (variants <= 2 ? 24 : variants <= 5 ? 48 : 96) * 1024 * 1024;
  let cache = createMeshCache<THREE.Mesh>(budgetOf(ctx.options().variants));
  /** A block's merged mesh at `L` (1 or 2), or a shell tile's, by key. */
  const keyOf = (L: 1 | 2 | 3, b: number): number => (L - 1) * cols * cols + b;
  const blocks = Math.ceil(cols / BLOCK);
  const blockOf = (b: number): number =>
    Math.floor(Math.floor(b / cols) / BLOCK) * blocks + Math.floor((b % cols) / BLOCK);
  const tiles = Math.ceil(cols / TILE);
  const tileOf = (b: number): number =>
    Math.floor(Math.floor(b / cols) / TILE) * tiles + Math.floor((b % cols) / TILE);
  /** Each kind's shell paint and crown, once. */
  const shellKinds = new Map<string, { paint: ShellPaint; spire: boolean }>();
  const shellKind = (kind: string) => {
    let k = shellKinds.get(kind);
    if (!k) {
      const lead = leadVariant(kind as Parameters<typeof leadVariant>[0]);
      const g = buildTree(lead, paint, 1);
      k = {
        paint: shellPaintOf(g),
        spire: lead.shape.form === "conifer" || lead.shape.form === "larch",
      };
      g.dispose();
      shellKinds.set(kind, k);
    }
    return k;
  };
  function buildMesh(L: 1 | 2 | 3, b: number): THREE.Mesh | null {
    let g: THREE.BufferGeometry | null;
    let ox: number;
    let oz: number;
    if (L === 3) {
      const tx = b % tiles;
      const tz = Math.floor(b / tiles);
      const list: ShellTree[] = [];
      for (let r = tz * TILE - 1; r <= (tz + 1) * TILE; r++)
        for (let c = tx * TILE - 1; c <= (tx + 1) * TILE; c++) {
          if (r < 0 || c < 0 || r >= cols || c >= cols) continue;
          const cb = r * cols + c;
          for (let i = binStart[cb]; i < binStart[cb + 1]; i++) {
            if (gone[i]) continue;
            const t = trees[i];
            const k = shellKind(t.kind ?? "spruce");
            list.push({ ...k, x: t.x, y: t.y, z: t.z, height: t.height, crown: t.crown });
          }
        }
      g = buildShell(tx, tz, list, snowAt);
      ox = tx * TILE * CELL;
      oz = tz * TILE * CELL;
    } else {
      const shapes = ctx.shapes();
      const geos = L === 1 ? shapes.midGeos : shapes.sketchGeos;
      const near = shapes.midShape;
      const share = ctx.options().farShare;
      const bx = b % blocks;
      const bz = Math.floor(b / blocks);
      g = mergeBlock(cells, bx, bz, (i) => (L === 2 && thin[i] >= share ? null : geos[near[i]]));
      ox = bx * BLOCK * CELL;
      oz = bz * BLOCK * CELL;
    }
    if (!g) return null;
    const mesh = new THREE.Mesh(g, L === 3 ? shellMaterial : patchMaterials[L]);
    mesh.position.set(ox, 0, oz);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.visible = false;
    patches.add(mesh);
    return mesh;
  }
  /** The mesh for `key`, built now if `build` allows — undefined when it
   * is not built yet, null when there is nothing to draw. */
  function meshFor(L: 1 | 2 | 3, b: number, build: () => boolean): THREE.Mesh | null | undefined {
    const key = keyOf(L, b);
    const have = cache.get(key);
    if (have !== undefined) return have;
    if (!build()) return undefined;
    const mesh = buildMesh(L, b);
    cache.set(key, mesh, geometryBytes(mesh?.geometry ?? null));
    return mesh;
  }
  function dropMesh(mesh: THREE.Mesh) {
    patches.remove(mesh);
    mesh.geometry.dispose();
  }
  /** The meshes made visible last pass, to hide on the next. */
  let shown: THREE.Mesh[] = [];
  const cellBox = (b: number, into: THREE.Box3) => {
    const c = b % cols;
    const r = Math.floor(b / cols);
    const pad = 4 + binLean[b];
    into.min.set(c * CELL - pad, binLow[b] - 2, r * CELL - pad);
    into.max.set((c + 1) * CELL + pad, binTop[b] + 2, (r + 1) * CELL + pad);
  };

  /** THE CELL PASS: every filled cell's level settled and stepped, its
   * drawables shown or hidden, the cell texture sent. */
  function cellPass(camera: THREE.PerspectiveCamera, moved: boolean, jump: boolean) {
    const now = performance.now();
    const ms = jump ? 1e9 : Math.min(1000, Math.max(0, now - lastNow));
    lastNow = now;
    if (!moved && !animating) return;
    pass++;
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    const far = aloft.far;
    const edgesC: CellEdges = {
      near: Math.min(ctx.options().full, far),
      mid: Math.min(ctx.options().mid, far),
      sketch: Math.min(shellFrom(ctx.options().mid), far),
      view: aloft.view,
    };
    // The horizon is tested again once the lens has moved 8 m.
    const retest = camera.position.distanceToSquared(horizonAt) > 64;
    if (retest) horizonAt.copy(camera.position);
    const t0 = performance.now();
    const room = () => jump || performance.now() - t0 < 3;
    for (const m of shown) m.visible = false;
    shown = [];
    const near: number[] = [];
    const tilesOn = new Set<number>();
    const blocksOn = [new Set<number>(), new Set<number>()];
    animating = false;
    // First every cell's level and whether it is in sight; then the merged
    // meshes missing, nearest first, as many as the frame has room for.
    const wanting: number[] = [];
    for (const b of filled) {
      cellBox(b, box);
      const dx = Math.max(box.min.x - cx, 0, cx - box.max.x);
      const dy = Math.max(box.min.y - cy, 0, cy - box.max.y);
      const dz = Math.max(box.min.z - cz, 0, cz - box.max.z);
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      cellD[b] = d;
      const was = seenAt[b] === pass - 1;
      const target: CellLevel = was
        ? settleLevel(lod.target[b] as CellLevel, d, edgesC)
        : levelAt(d, edgesC);
      want[b] = target;
      let inView = target < 4 && frustum.intersectsBox(box);
      if (inView && d > 160) {
        if (retest || !was) {
          const mx = (box.min.x + box.max.x) / 2;
          const mz = (box.min.z + box.max.z) / 2;
          const top = binTop[b];
          behind[b] =
            hidden(snowAt, cx, cy, cz, mx, top, mz) &&
            hidden(snowAt, cx, cy, cz, box.min.x, top, box.min.z) &&
            hidden(snowAt, cx, cy, cz, box.max.x, top, box.min.z) &&
            hidden(snowAt, cx, cy, cz, box.min.x, top, box.max.z) &&
            hidden(snowAt, cx, cy, cz, box.max.x, top, box.max.z)
              ? 1
              : 0;
        }
        if (behind[b]) inView = false;
      }
      sight[b] = inView ? 1 : 0;
      if (
        inView &&
        (target === 1 || target === 2) &&
        cache.get(keyOf(target, blockOf(b))) === undefined
      )
        wanting.push(b);
    }
    wanting.sort((p, q) => cellD[p] - cellD[q]);
    for (const b of wanting) {
      if (!room()) break;
      meshFor(want[b] as 1 | 2, blockOf(b), () => true);
      cache.touch(keyOf(want[b] as 1 | 2, blockOf(b)), pass);
    }
    for (const b of filled) {
      const was = seenAt[b] === pass - 1;
      const inView = sight[b] === 1;
      let target = want[b] as CellLevel;
      // A merged level whose mesh is not built yet is its shell meanwhile.
      if ((target === 1 || target === 2) && cache.get(keyOf(target, blockOf(b))) === undefined)
        target = 3;
      lod.target[b] = target;
      if (!inView || !was) {
        // Out of sight: whatever level it belongs at, at once.
        lod.value[b] = target;
        if (!inView) continue;
      }
      seenAt[b] = pass;
      if (stepLevel(lod, b, ms)) animating = true;
      const v = lod.value[b];
      // Every level whose share of this cell is not nothing.
      for (
        let L = Math.max(0, Math.ceil(v - 1 + 1e-6));
        L <= Math.min(3, Math.floor(v + 1 - 1e-6));
        L++
      ) {
        if (L === 0) near.push(b);
        else if (L === 3) tilesOn.add(tileOf(b));
        else blocksOn[L - 1].add(blockOf(b));
      }
    }
    // Built when their level was settled; built now if the cache dropped one.
    for (const L of [1, 2] as const)
      for (const k of blocksOn[L - 1]) {
        const mesh = meshFor(L, k, () => true);
        cache.touch(keyOf(L, k), pass);
        if (mesh) {
          mesh.visible = true;
          shown.push(mesh);
        }
      }
    for (const t of tilesOn) {
      const mesh = meshFor(3, t, () => true);
      cache.touch(keyOf(3, t), pass);
      if (mesh) {
        mesh.visible = true;
        shown.push(mesh);
      }
    }
    for (const m of cache.trim(pass)) dropMesh(m);
    lod.texture.needsUpdate = true;
    nearCells = near;
  }
  return {
    pass: cellPass,
    near: () => nearCells,
    invalidate() {
      pass++;
    },
    reset() {
      for (const m of cache.clear()) dropMesh(m);
      cache = createMeshCache<THREE.Mesh>(budgetOf(ctx.options().variants));
      shown = [];
    },
    dispose() {
      for (const m of cache.clear()) dropMesh(m);
      patchMaterials[1].dispose();
      patchMaterials[2].dispose();
      shellMaterial.dispose();
    },
  };
}
