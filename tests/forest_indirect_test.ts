// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WOODS DRAWN INDIRECT (`forest-indirect.ts`, `docs/webgpu.md` part
// 17). On a WebGPU device that takes an indirect draw's first instance the
// woods are one mesh a pass, every shape packed into one geometry and drawn
// by an argument block of its own. What the suite holds: the packing keeps
// every shape's vertices and indices where its block says; each block's
// count is its run's length and its first instance the run's place; a
// forest handed a kit that draws indirect lists the very trees, words and
// all, that the instanced shapes list at every FOREST stop, in one mesh a
// pass, its casters on their own layer; and a kit without it draws as
// before.

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { CASTERS, COLOUR, slotWord } from "../pwa/src/game/forest-batch.ts";
import { ARGS, createIndirectTreeBatch, packShapes } from "../pwa/src/game/forest-indirect.ts";
import { WOODS_CASTERS, type WoodsKit } from "../pwa/src/game/forest-nodes.ts";
import { createForest, forestOptionsOf, type ForestOptions } from "../pwa/src/game/forest.ts";
import { createHazeUniforms } from "../pwa/src/game/haze.ts";
import { TIERS, VIDEO_PRESETS, type Tier } from "../pwa/src/game/settings-video.ts";
import { levelFor } from "./support/levels.ts";

const level = levelFor(1);

/** A stand-in kit (plain materials); `indirect` hands a plain buffer for
 * the arguments, as three's indirect storage buffer holds the same array. */
const kit = (indirect: boolean): WoodsKit => ({
  tree: () => new THREE.MeshStandardMaterial({ name: "tree" }),
  cards: () => new THREE.MeshStandardMaterial({ name: "cards" }),
  casters: () => new THREE.MeshBasicMaterial({ name: "casters" }),
  ...(indirect ? { indirect: (args: Uint32Array) => new THREE.BufferAttribute(args, 1) } : {}),
});

const optionsAt = (tier: Tier): ForestOptions => forestOptionsOf(VIDEO_PRESETS[tier]);

function lens(): THREE.PerspectiveCamera {
  const s = level.spawn;
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 4000);
  const p = level.track.points[Math.min(40, level.track.points.length - 1)];
  camera.position.set(s.x, level.groundAt(s.x, s.z) + 3, s.z);
  camera.lookAt(p.x, level.groundAt(p.x, p.z), p.z);
  camera.updateMatrixWorld();
  return camera;
}

const sun = (camera: THREE.PerspectiveCamera) => {
  const p = level.track.points[Math.min(40, level.track.points.length - 1)];
  const k = new THREE.Vector3(0.4, 0.5, 0.3).normalize();
  return { x: p.x, y: camera.position.y, z: p.z, reach: 120, sx: k.x, sy: k.y, sz: k.z };
};

type Drawn = { colour: Map<string, number[]>; casters: number; meshes: number };

/** Every word each shape (keyed by its indices' place) draws, off the
 * instanced shapes or the indirect blocks. */
function drawnBy(group: THREE.Object3D): Drawn {
  const colour = new Map<string, number[]>();
  let casters = 0;
  let meshes = 0;
  group.traverse((o) => {
    const g = (o as THREE.Mesh).geometry as THREE.InstancedBufferGeometry | undefined;
    if (!g?.getAttribute("treeWord")) return;
    if (!o.visible) return;
    meshes++;
    const words = g.getAttribute("treeWord").array as Uint32Array;
    const runs: { key: string; at: number; n: number }[] = [];
    if (g.indirect) {
      const args = g.indirect.array as Uint32Array;
      for (const off of g.indirectOffset as number[]) {
        const s = off / 4;
        runs.push({ key: `${args[s]}`, at: args[s + 4], n: args[s + 1] });
      }
    } else {
      runs.push({
        key: `${g.index ? g.index.count : g.getAttribute("position").count}`,
        at: 0,
        n: g.instanceCount,
      });
    }
    for (const r of runs) {
      if (o.layers.mask === 1 << WOODS_CASTERS) {
        casters += r.n;
        continue;
      }
      const list = colour.get(r.key) ?? [];
      for (let i = 0; i < r.n; i++) list.push(words[r.at + i]);
      colour.set(r.key, list);
    }
  });
  return { colour, casters, meshes };
}

describe("the woods' shapes packed into one geometry", () => {
  it("keep every shape's vertices and indices where its block says", () => {
    const a = new THREE.BoxGeometry();
    const b = new THREE.ConeGeometry(1, 2, 5);
    const c = new THREE.SphereGeometry(1, 4, 3).toNonIndexed();
    const p = packShapes([a, b, c, a], [true, false, true, true]);
    const pos = p.geometry.getAttribute("position").array as Float32Array;
    const index = p.geometry.index!.array as Uint32Array;
    expect(index).toBeInstanceOf(Uint32Array);
    // The unused shape takes no room.
    expect(p.indexCount[1]).toBe(0);
    expect(p.geometry.getAttribute("position").count).toBe(
      2 * a.getAttribute("position").count + c.getAttribute("position").count,
    );
    for (const s of [0, 2, 3]) {
      const g = [a, b, c, a][s];
      const own = g.getAttribute("position").array as Float32Array;
      const n = g.getAttribute("position").count;
      expect([...pos.subarray(p.baseVertex[s] * 3, (p.baseVertex[s] + n) * 3)]).toEqual([...own]);
      const k = g.index ? g.index.count : n;
      expect(p.indexCount[s]).toBe(k);
      for (let i = 0; i < k; i++) {
        expect(index[p.firstIndex[s] + i]).toBe(g.index ? g.index.array[i] : i);
      }
    }
  });
});

describe("the woods drawn indirect (forest-indirect.ts)", () => {
  it("count each shape's run and start its first instance there", () => {
    const shape = new THREE.BoxGeometry();
    shape.setAttribute(
      "stem",
      new THREE.BufferAttribute(new Float32Array(shape.getAttribute("position").count * 3), 3),
    );
    const batch = createIndirectTreeBatch(
      [shape, shape, shape],
      8,
      new Float32Array(16 * 8),
      new Float32Array(8 * 8),
      { colour: Int32Array.from([2, 0, 3]), casters: Int32Array.from([0, 1, 0]) },
      new THREE.MeshBasicMaterial(),
      new THREE.MeshBasicMaterial(),
      (args) => new THREE.BufferAttribute(args, 1),
    );
    // One mesh a pass.
    expect(batch.mesh.children.length).toBe(2);
    batch.begin(COLOUR);
    batch.push(COLOUR, 2, 5, 0, 1);
    batch.push(COLOUR, 0, 3, 0, 1);
    batch.push(COLOUR, 0, 1, 0.25, 0.5);
    batch.push(COLOUR, 0, 7, 0, 1); // past the room: dropped, never grown
    batch.push(COLOUR, 1, 2, 0, 1); // a shape with no room in this pass
    batch.end(COLOUR);
    batch.begin(CASTERS);
    batch.end(CASTERS);
    const [pic, cast] = batch.mesh.children as THREE.Mesh[];
    const g = pic.geometry as THREE.InstancedBufferGeometry;
    const args = g.indirect!.array as Uint32Array;
    expect(g.indirectOffset).toEqual([0, 2 * ARGS * 4]);
    expect(args[1]).toBe(2);
    expect(args[4]).toBe(0);
    expect(args[2 * ARGS + 1]).toBe(1);
    expect(args[2 * ARGS + 4]).toBe(2); // after shape 0's room of two
    expect(args[ARGS + 1]).toBe(0);
    const words = g.getAttribute("treeWord").array as Uint32Array;
    expect([...words.subarray(0, 3)]).toEqual([
      slotWord(3, 0, 1),
      slotWord(1, 0.25, 0.5),
      slotWord(5, 0, 1),
    ]);
    expect(pic.visible).toBe(true);
    expect(g.instanceCount).toBe(3);
    expect(batch.drawn(COLOUR)).toEqual({ trees: 3, triangles: 3 * 12 });
    // The counters read the triangles drawn: 12 a box, three times.
    expect((g.drawRange.count / 3) * g.instanceCount).toBe(36);
    // An empty pass is not drawn.
    expect(cast.visible).toBe(false);
    expect(cast.layers.mask).toBe(1 << WOODS_CASTERS);
    expect(cast.castShadow).toBe(true);
    expect(pic.castShadow).toBe(false);
    batch.dispose();
  });

  it("are offered by the kit only for a device that takes an indirect first instance", async () => {
    const { woodsKit } = await import("../pwa/src/game/forest-tsl.ts");
    const { IndirectStorageBufferAttribute } = await import("three/webgpu");
    expect(woodsKit(createHazeUniforms(), null).indirect).toBeUndefined();
    const made = woodsKit(createHazeUniforms(), null, true).indirect?.(new Uint32Array(ARGS * 2));
    expect(made).toBeInstanceOf(IndirectStorageBufferAttribute);
    expect(made?.count).toBe(ARGS * 2);
  });

  it("list the trees the instanced shapes list, at every FOREST stop, a mesh a pass", () => {
    for (const tier of TIERS) {
      const camera = lens();
      const shapes = createForest(
        level,
        createHazeUniforms(),
        optionsAt(tier),
        undefined,
        kit(false),
      );
      const one = createForest(level, createHazeUniforms(), optionsAt(tier), undefined, kit(true));
      shapes.update(camera, sun(camera));
      one.update(camera, sun(camera));
      const a = drawnBy(shapes.group);
      const b = drawnBy(one.group);
      expect([...b.colour.entries()].sort(), tier).toEqual([...a.colour.entries()].sort());
      expect(b.casters, tier).toBe(a.casters);
      expect(a.colour.size, tier).toBeGreaterThan(1);
      // The card woods are a batch of their own over the faceted casters'.
      expect(b.meshes, tier).toBeLessThanOrEqual(3);
      expect(b.meshes, tier).toBeLessThan(a.meshes);
      shapes.dispose();
      one.dispose();
    }
  });
});
