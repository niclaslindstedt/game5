// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WOODS ON THE NODE RENDERER (`docs/webgpu.md`, part 8). WebGL draws a
// wood as one multi-draw a pass (`forest-batch.ts`); the node renderer draws
// every shape instanced (`forest-nodes.ts`) with its own materials
// (`forest-tsl.ts`). What the suite holds: the register draws the woods on
// every path; a forest handed the node renderer's kit holds no batch, only
// shapes drawn instanced, its picture's meshes casting nothing and its
// casters on the layer only the key's shadow camera sees; it lists the very
// trees WebGL's batch lists, at every FOREST stop, words and all; every
// shape has the room for every tree that can be drawn as it; and the kit's
// materials are made on plain Node, lit and hazed as WebGL's, the casters
// cut by the mountain's shade.

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { COLOUR, batchUniforms, slotWord } from "../pwa/src/game/forest-batch.ts";
import {
  WOODS_CASTERS,
  createNodeTreeBatch,
  roomOf,
  type WoodsKit,
} from "../pwa/src/game/forest-nodes.ts";
import { createForest, forestOptionsOf, type ForestOptions } from "../pwa/src/game/forest.ts";
import { GPU_PORTS, quarantinedOn } from "../pwa/src/game/gpu-backend.ts";
import { createHazeUniforms } from "../pwa/src/game/haze.ts";
import { TIERS, VIDEO_PRESETS, type Tier } from "../pwa/src/game/settings-video.ts";
import type { ShadowBox } from "../pwa/src/game/shadow-box.ts";
import { ALPHA_CUT } from "../pwa/src/game/tree-atlas.ts";
import { KeyLight } from "../pwa/src/game/world-lights.ts";
import { levelFor } from "./support/levels.ts";

const level = levelFor(1);

/** A stand-in kit: plain materials, so the woods are drawn without TSL. */
const plainKit = (): WoodsKit => ({
  tree: () => new THREE.MeshStandardMaterial({ name: "tree" }),
  cards: () => new THREE.MeshStandardMaterial({ name: "cards" }),
  casters: () => new THREE.MeshBasicMaterial({ name: "casters" }),
});

const optionsAt = (tier: Tier): ForestOptions => forestOptionsOf(VIDEO_PRESETS[tier]);

/** A lens on the start line looking down the piste, and a sun's circle
 * ahead of it. */
function lens(): { camera: THREE.PerspectiveCamera; shadow: ShadowBox } {
  const s = level.spawn;
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 4000);
  const p = level.track.points[Math.min(40, level.track.points.length - 1)];
  camera.position.set(s.x, level.groundAt(s.x, s.z) + 3, s.z);
  camera.lookAt(p.x, level.groundAt(p.x, p.z), p.z);
  camera.updateMatrixWorld();
  const sun = new THREE.Vector3(0.4, 0.5, 0.3).normalize();
  const shadow = {
    x: p.x,
    y: camera.position.y,
    z: p.z,
    reach: 120,
    sx: sun.x,
    sy: sun.y,
    sz: sun.z,
  };
  return { camera, shadow };
}

/** What a forest's group draws in the picture and into the key's map:
 * triangles and trees, off WebGL's batch or the node renderer's shapes. */
function drawnBy(group: THREE.Object3D): { colour: number; casters: number; words: number[] } {
  let colour = 0;
  let casters = 0;
  const words: number[] = [];
  group.traverse((o) => {
    if ((o as THREE.BatchedMesh).isBatchedMesh) {
      colour += (o.userData.drawnTriangles as () => number)();
      return;
    }
    const g = (o as THREE.Mesh).geometry as THREE.InstancedBufferGeometry | undefined;
    if (!g?.isInstancedBufferGeometry || !g.getAttribute("treeWord")) return;
    const verts = g.index ? g.index.count : g.getAttribute("position").count;
    const tris = (verts / 3) * g.instanceCount;
    if (o.layers.mask === 1 << WOODS_CASTERS) casters += g.instanceCount;
    else {
      colour += tris;
      const w = g.getAttribute("treeWord").array as Uint32Array;
      for (let i = 0; i < g.instanceCount; i++) words.push(w[i]);
    }
  });
  return { colour, casters, words };
}

describe("the woods in the register", () => {
  it("are ported in part 8 and drawn on the webgpu paths", () => {
    const row = GPU_PORTS.find((p) => p.id === "forest-batch");
    expect(row?.ported).toBe(true);
    expect(row?.part).toBe(8);
    expect(quarantinedOn("webgpu", "forest-batch")).toBe(false);
    expect(quarantinedOn("webgpu-gl", "forest-batch")).toBe(false);
  });
});

describe("the woods on the node renderer (forest-nodes.ts)", () => {
  it("hold no batch: every shape is drawn instanced, its casters on their own layer", () => {
    const forest = createForest(
      level,
      createHazeUniforms(),
      optionsAt("high"),
      undefined,
      plainKit(),
    );
    const { camera, shadow } = lens();
    forest.update(camera, shadow);
    let batches = 0;
    let picture = 0;
    let cast = 0;
    forest.group.traverse((o) => {
      if ((o as THREE.BatchedMesh).isBatchedMesh) batches++;
      const g = (o as THREE.Mesh).geometry as THREE.InstancedBufferGeometry | undefined;
      if (!g?.getAttribute("treeWord")) return;
      expect(g.isInstancedBufferGeometry).toBe(true);
      expect(g.getAttribute("treeWord").array).toBeInstanceOf(Uint32Array);
      expect(o.frustumCulled).toBe(false);
      if (o.castShadow) {
        cast++;
        expect(o.layers.mask).toBe(1 << WOODS_CASTERS);
        expect(((o as THREE.Mesh).material as THREE.Material).name).toBe("casters");
      } else {
        picture++;
        expect(o.receiveShadow).toBe(true);
        expect(o.layers.mask).toBe(1);
      }
      // An empty shape is not drawn at all.
      expect(o.visible).toBe(g.instanceCount > 0);
    });
    expect(batches).toBe(0);
    expect(picture).toBeGreaterThan(0);
    expect(cast).toBeGreaterThan(0);
    // Off the layers the lens and the skiers' atlas use.
    expect(WOODS_CASTERS).not.toBe(0);
    for (let k = 7; k <= 10; k++) expect(WOODS_CASTERS).not.toBe(k);
    forest.dispose();
  });

  it("lists the trees WebGL's batch lists, at every FOREST stop", () => {
    for (const tier of TIERS) {
      const { camera, shadow } = lens();
      const webgl = createForest(level, createHazeUniforms(), optionsAt(tier));
      const node = createForest(
        level,
        createHazeUniforms(),
        optionsAt(tier),
        undefined,
        plainKit(),
      );
      webgl.update(camera, shadow);
      node.update(camera, shadow);
      const a = drawnBy(webgl.group);
      const b = drawnBy(node.group);
      expect(b.colour, tier).toBe(a.colour);
      expect(a.colour, tier).toBeGreaterThan(0);
      if (optionsAt(tier).casters !== "none") expect(b.casters, tier).toBeGreaterThan(0);
      // Every listed tree is a real one, its window inside [0, 1].
      for (const w of b.words) {
        expect(w & ((1 << 18) - 1)).toBeLessThan(level.trees.length);
        expect((w >>> 18) & 127).toBeLessThanOrEqual((w >>> 25) & 127);
      }
      webgl.dispose();
      node.dispose();
    }
  });

  it("gives each shape the room for every tree it can be drawn as", () => {
    expect([
      ...roomOf(Uint16Array.from([0, 1, 1, 2, 1]), 3, Uint8Array.from([0, 0, 1, 0, 0])),
    ]).toEqual([1, 2, 1]);
    const shape = new THREE.BoxGeometry().toNonIndexed();
    shape.setAttribute(
      "stem",
      new THREE.BufferAttribute(new Float32Array(shape.getAttribute("position").count * 3), 3),
    );
    const m = new Float32Array(16 * 4);
    const d = new Float32Array(8 * 4);
    const batch = createNodeTreeBatch(
      [shape, shape],
      4,
      m,
      d,
      { colour: Int32Array.from([2, 0]), casters: null },
      new THREE.MeshBasicMaterial(),
      null,
    );
    expect(batch.mesh.children.length).toBe(1); // a shape with no room has no draw
    batch.begin(COLOUR);
    batch.push(COLOUR, 0, 3, 0, 1);
    batch.push(COLOUR, 0, 1, 0.25, 0.5);
    batch.push(COLOUR, 0, 2, 0, 1); // past the room: dropped, never grown
    batch.push(COLOUR, 1, 2, 0, 1); // a shape with no draw
    batch.end(COLOUR);
    const g = (batch.mesh.children[0] as THREE.Mesh).geometry as THREE.InstancedBufferGeometry;
    expect(g.instanceCount).toBe(2);
    expect([...(g.getAttribute("treeWord").array as Uint32Array)]).toEqual([
      slotWord(3, 0, 1),
      slotWord(1, 0.25, 0.5),
    ]);
    expect(batch.drawn(COLOUR)).toEqual({ trees: 2, triangles: 24 });
    // The table is WebGL's: bound into the materials' slots.
    const u = batchUniforms();
    batch.bind(u, batchUniforms());
    expect(u.uTreeMatrix.value).toBe(batch.table.matrix);
    expect(u.uTreeData.value).toBe(batch.table.data);
    batch.dispose();
  });
});

describe("the woods' node materials (forest-tsl.ts)", () => {
  it("are made on plain Node, lit and hazed, the casters cut by the mountain's shade", async () => {
    const { woodsKit } = await import("../pwa/src/game/forest-tsl.ts");
    const haze = createHazeUniforms();
    const key = new KeyLight(haze, 0xffffff, 3);
    const kit = woodsKit(haze, key);
    const wind = { value: new THREE.Vector4() };
    type Nodes = THREE.Material & {
      isNodeMaterial?: boolean;
      fog?: boolean;
      maskNode?: unknown;
      maskShadowNode?: unknown;
      positionNode?: unknown;
      colorNode?: unknown;
      emissiveNode?: unknown;
    };
    const tree = kit.tree(batchUniforms(), wind) as Nodes;
    expect(tree.isNodeMaterial).toBe(true);
    expect(tree.fog).toBe(true);
    expect(tree.userData.haze).toBe(true);
    expect(tree.maskNode).toBeTruthy(); // the hand-over's dither
    expect(tree.colorNode).toBeTruthy();
    const atlas = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const cards = kit.cards(batchUniforms(), wind, atlas) as Nodes;
    expect(cards.isNodeMaterial).toBe(true);
    expect(cards.alphaTest).toBe(ALPHA_CUT);
    expect(cards.emissiveNode).toBeTruthy(); // the backlight
    expect(cards.userData.haze).toBe(true);
    const casters = kit.casters(batchUniforms(), wind) as Nodes;
    expect(casters.positionNode).toBeTruthy(); // what the shadow pass copies
    expect(casters.maskShadowNode).toBeTruthy();
    expect(casters.fog).toBe(false);
  });
});
