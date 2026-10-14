// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The woods by cell (`forest-patches.ts`): the levels and their hand-over,
// a cell's trees merged with their girths, the canopy shell, the horizon
// and the cache.

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import {
  CELL,
  SHELL_STEP,
  TILE,
  buildShell,
  createCellLod,
  createMeshCache,
  hidden,
  levelAt,
  mergeBlock,
  settleLevel,
  shellFrom,
  stepLevel,
  type CellEdges,
} from "../pwa/src/game/forest-patches.ts";
import { HAND_OVER_MS } from "../pwa/src/game/tree-bands.ts";

const EDGES: CellEdges = { near: 110, mid: 320, sketch: shellFrom(320), view: 1300 };

describe("the levels", () => {
  it("run from the trees one by one to nothing with distance", () => {
    expect(levelAt(0, EDGES)).toBe(0);
    expect(levelAt(200, EDGES)).toBe(1);
    expect(levelAt(400, EDGES)).toBe(2);
    expect(levelAt(900, EDGES)).toBe(3);
    expect(levelAt(2000, EDGES)).toBe(4);
  });
  it("hold a level a few metres past its edge", () => {
    expect(settleLevel(0, 112, EDGES)).toBe(0);
    expect(settleLevel(0, 130, EDGES)).toBe(1);
    expect(settleLevel(1, 108, EDGES)).toBe(1);
  });
  it("hand a cell over in time, never two levels at once", () => {
    const lod = createCellLod(4);
    lod.value[0] = 0;
    lod.target[0] = 2;
    expect(stepLevel(lod, 0, HAND_OVER_MS / 2)).toBe(true);
    expect(lod.value[0]).toBeCloseTo(1.5);
    expect(stepLevel(lod, 0, HAND_OVER_MS)).toBe(false);
    expect(lod.value[0]).toBe(2);
  });
  it("start the shell past the mid band", () => {
    for (const mid of [140, 220, 320]) expect(shellFrom(mid)).toBeGreaterThan(mid);
  });
});

describe("a merged block", () => {
  // One unit tree: a trunk's ring tagged with its axis, one bough point.
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3));
  shape.setAttribute("normal", new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3));
  shape.setAttribute("color", new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 0.5], 3));
  shape.setAttribute("stem", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 0, 0, 0, 1], 3));
  const cols = 2;
  const matrices = new Float32Array(16 * 2);
  new THREE.Matrix4()
    .compose(new THREE.Vector3(70, 5, 10), new THREE.Quaternion(), new THREE.Vector3(2, 3, 2))
    .toArray(matrices, 0);
  new THREE.Matrix4().toArray(matrices, 16);
  const cells = {
    cols,
    binStart: new Int32Array([0, 0, 2, 2, 2]),
    matrices,
    colours: new Float32Array([1, 1, 1, 1, 1, 1]),
    girths: new Float32Array([2, 2, 1, 1]),
    gone: new Uint8Array([0, 1]),
  };
  const g = mergeBlock(cells, 0, 0, () => shape)!;
  it("holds every standing tree, leaving the felled out", () => {
    expect(g.getAttribute("position").count).toBe(3);
  });
  it("stands each tree where its matrix puts it, relative to the block, its trunk at its girth", () => {
    const p = g.getAttribute("position");
    // The trunk point pushed out to twice its radius, then stretched by 2.
    expect(p.getX(0)).toBeCloseTo(70 + 4);
    expect(p.getY(1)).toBeCloseTo(8);
    expect(p.getZ(2)).toBeCloseTo(10 + 4);
  });
  it("tags each point with its cell in the block", () => {
    expect(g.getAttribute("sub").getX(0)).toBe(1);
  });
  it("packs its normals and colours to bytes", () => {
    const n = g.getAttribute("normal") as THREE.BufferAttribute;
    expect(n.array).toBeInstanceOf(Int8Array);
    expect(n.getX(0)).toBeCloseTo(1, 1);
    expect((g.getAttribute("color") as THREE.BufferAttribute).getZ(2)).toBeCloseTo(0.5, 1);
  });
});

describe("the canopy shell", () => {
  const flat = () => 100;
  const paint = {
    needle: new THREE.Color(0.05, 0.08, 0.05),
    snow: new THREE.Color(0.9, 0.9, 0.95),
  };
  const tree = { x: 30, y: 100, z: 30, height: 20, crown: 3, paint, spire: true };
  it("rises to a crown's top over it and drops the bare grid", () => {
    const g = buildShell(0, 0, [tree], flat)!;
    const p = g.getAttribute("position");
    let top = -Infinity;
    for (let i = 0; i < p.count; i++) top = Math.max(top, p.getY(i));
    expect(top).toBeGreaterThan(110);
    expect(top).toBeLessThanOrEqual(120);
    const grid = (TILE * CELL) / SHELL_STEP + 1;
    expect(p.count).toBeLessThan((grid * grid) / 20);
  });
  it("draws nothing over a tile with no trees", () => {
    expect(buildShell(0, 0, [], flat)).toBeNull();
  });
});

describe("the horizon", () => {
  // A ridge 50 m high across x = 100.
  const ridge = (x: number) => (Math.abs(x - 100) < 10 ? 50 : 0);
  it("hides what stands behind a ridge and not what stands over it", () => {
    expect(hidden(ridge, 0, 2, 0, 300, 10, 0)).toBe(true);
    expect(hidden(ridge, 0, 200, 0, 300, 10, 0)).toBe(false);
    expect(hidden(ridge, 0, 2, 0, 80, 10, 0)).toBe(false);
  });
});

describe("the cache", () => {
  it("drops the least recently drawn past its budget, never one drawn now", () => {
    const c = createMeshCache<string>(100);
    c.set(1, "a", 60);
    c.set(2, "b", 60);
    c.touch(1, 1);
    c.touch(2, 2);
    expect(c.trim(2)).toEqual(["a"]);
    expect(c.get(1)).toBeUndefined();
    expect(c.get(2)).toBe("b");
    c.set(3, "c", 60);
    c.touch(3, 3);
    c.touch(2, 3);
    expect(c.trim(3)).toEqual([]);
  });
});
