// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The benchmark's scene tally counts only what would be drawn: nothing
// hidden, and — handed the lens — nothing three's frustum test drops.
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { hideSlices } from "../pwa/src/game/renderer-rider.ts";
import { tallyScene } from "../pwa/src/game/scene-tally.ts";

function sceneWithWarmer(): THREE.Scene {
  const scene = new THREE.Scene();
  const seen = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
  seen.name = "terrain";
  seen.position.set(0, 0, -5);
  const warm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
  warm.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -1e7, 0), 1);
  warm.name = "terrain-warm";
  scene.add(seen, warm);
  scene.updateMatrixWorld(true);
  return scene;
}

describe("the A/B's hidden slices", () => {
  it("hides the audience inside the crowd's group, and the crowd with the field", () => {
    const scene = new THREE.Scene();
    const crowd = new THREE.Group();
    crowd.name = "crowd";
    const amateurs = new THREE.Group();
    const fans = new THREE.Group();
    fans.name = "spectators";
    crowd.add(amateurs, fans);
    scene.add(crowd);
    const hid: THREE.Object3D[] = [];
    hideSlices(scene, new Set(["audience"]), hid);
    expect([crowd.visible, amateurs.visible, fans.visible]).toEqual([true, true, false]);
    expect(hid).toEqual([fans]);
    hideSlices(scene, new Set(["field"]), hid);
    expect(crowd.visible).toBe(false);
  });
});

describe("the scene tally", () => {
  it("drops what the lens's frustum would drop", () => {
    const scene = sceneWithWarmer();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.updateMatrixWorld(true);
    const names = (camera?: THREE.Camera) =>
      tallyScene(scene, camera)
        .map((s) => s.name)
        .sort();
    expect(names()).toEqual(["terrain", "terrain-warm"]);
    expect(names(camera)).toEqual(["terrain"]);
  });
});
