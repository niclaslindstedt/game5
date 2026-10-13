// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PLAYER'S MODELLED FREERIDER (`rider-model.ts`, `pwa/models/freerider.glb`):
// bound in the rig's own bind pose, so it is skinned onto the game's bones
// by name and posed by every pose the game has; and its cloth's `flap`.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { bindPose } from "../pwa/src/game/dress-loft.ts";
import { flapOf } from "../pwa/src/game/rider-model.ts";
import { SKIER_BONES, type SkierBone } from "../pwa/src/game/skier-rig.ts";

type Node = {
  name?: string;
  children?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
};
type Gltf = {
  nodes: Node[];
  skins: { joints: number[] }[];
  materials: { name: string }[];
};

const glb = readFileSync(join(import.meta.dirname, "..", "pwa", "models", "freerider.glb"));
const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString()) as Gltf;

/** Every node's world matrix, its parents' TRS composed down. */
function worlds(g: Gltf): THREE.Matrix4[] {
  const local = g.nodes.map((n) =>
    new THREE.Matrix4().compose(
      new THREE.Vector3(...((n.translation ?? [0, 0, 0]) as [number, number, number])),
      new THREE.Quaternion(...((n.rotation ?? [0, 0, 0, 1]) as [number, number, number, number])),
      new THREE.Vector3(...((n.scale ?? [1, 1, 1]) as [number, number, number])),
    ),
  );
  const out = local.map((m) => m.clone());
  const parent = new Map<number, number>();
  g.nodes.forEach((n, i) => n.children?.forEach((c) => parent.set(c, i)));
  const done = new Set<number>();
  const world = (i: number): THREE.Matrix4 => {
    if (done.has(i)) return out[i];
    const p = parent.get(i);
    if (p !== undefined) out[i] = world(p).clone().multiply(local[i]);
    done.add(i);
    return out[i];
  };
  g.nodes.forEach((_, i) => world(i));
  return out;
}

describe("the modelled freerider", () => {
  it("is skinned on the game's own bones, every one of them", () => {
    // Every bone of the rig, and the armature's root (`body`) over them.
    const names = json.skins[0].joints.map((j) => json.nodes[j].name);
    expect([...names].sort()).toEqual(["body", ...SKIER_BONES].sort());
  });

  it("was bound in the rig's bind pose: every joint where the game's bone stands", () => {
    const bind = bindPose().frames;
    const w = worlds(json);
    const p = new THREE.Vector3();
    for (const j of json.skins[0].joints) {
      if (json.nodes[j].name === "body") continue;
      const name = json.nodes[j].name as SkierBone;
      p.setFromMatrixPosition(w[j]);
      // glTF's world is the body frame turned: (−x, y, −z).
      const head = bind[name].head;
      expect(Math.hypot(-p.x - head.x, p.y - head.y, -p.z - head.z), name).toBeLessThan(0.002);
    }
  });

  it("names the materials the loader sorts into cloth and hard goods", () => {
    const names = json.materials.map((m) => m.name);
    for (const n of ["jacket", "pants", "pack", "glove", "helmet", "lens"]) {
      expect(names, n).toContain(n);
    }
  });

  it("flaps its shell's hem the most, its bibs' cuffs some and its pack and helmet not at all", () => {
    const levels = { chest: 1.3, hem: 0.8, knee: 0.5, ankle: 0.1 };
    const hem = flapOf("jacket", 0, 0.8, levels);
    const chest = flapOf("jacket", 0, 1.3, levels);
    const cuff = flapOf("pants", 0, 0.12, levels);
    expect(hem).toBeGreaterThan(0.9);
    expect(chest).toBeLessThan(0.2);
    expect(cuff).toBeGreaterThan(0.5);
    expect(cuff).toBeLessThan(hem);
    expect(flapOf("pack", 0, 1, levels)).toBe(0);
    expect(flapOf("helmet", 0, 1.7, levels)).toBe(0);
  });
});
