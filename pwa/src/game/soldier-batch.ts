// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SOLDIERS BY THE HUNDRED: every soldier of one figure at one cut drawn in
// ONE draw call — an instanced mesh of the part-3 figure
// (`buildSoldierFigure`), each instance placed by its own matrix and posed
// by its own morph weights, as the crowd's amateurs are (`crowd-view.ts`).
// What a ground wave's column costs the picture: a draw a figure and a cut,
// whatever the men's number. A man near the lens is still drawn on a mesh of
// his own (`SoldierView`), where a pose no target holds can be set outright.
//
// `SoldierPoser` is the one interface both answer to, so the ground view
// poses a man the same words whichever way he is drawn.

import * as THREE from "three";

import { buildSoldierFigure } from "./soldier-shapes.ts";
import type { CrowdLod } from "./crowd-shapes.ts";
import type { Smock } from "./soldier-kit.ts";
import { SOLDIER_POSES, type SoldierKind, type SoldierPoseName } from "./soldier-pose.ts";

/** What a man is posed and placed through: a mesh (or a stand-in) to stand
 * and turn, and his pose by name, `share` of the way from his rest
 * (blended with `from` at 1 − share when given). */
export type SoldierPoser = {
  readonly mesh: THREE.Object3D;
  pose<K extends SoldierKind>(
    name: SoldierPoseName<K>,
    share?: number,
    from?: SoldierPoseName<K>,
  ): void;
};

/** ONE FIGURE AT ONE CUT, as many as `capacity` of it in a draw. */
export class SoldierBatch {
  readonly mesh: THREE.InstancedMesh;
  private readonly weights: Float32Array;
  private readonly targets: number;
  private readonly names: readonly string[];
  private n = 0;
  readonly capacity: number;
  constructor(
    kind: SoldierKind,
    lod: CrowdLod,
    material: THREE.Material,
    capacity: number,
    smock: Smock = "camo",
  ) {
    this.capacity = capacity;
    this.names = SOLDIER_POSES[kind];
    this.targets = this.names.length - 1;
    const mesh = new THREE.InstancedMesh(buildSoldierFigure(kind, lod, smock), material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.morphTargetInfluences = new Array<number>(this.targets).fill(0);
    // The morph texture, allocated once at the batch's size.
    mesh.setMorphAt(0, mesh);
    mesh.castShadow = lod !== "far";
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.visible = false;
    mesh.name = `soldiers-${kind}-${lod}`;
    this.mesh = mesh;
    this.weights = mesh.morphTexture!.image.data as unknown as Float32Array;
  }
  /** Room for another this frame. */
  get full(): boolean {
    return this.n >= this.capacity;
  }
  begin(): void {
    this.n = 0;
  }
  /** One more man, placed by `matrix` and posed by the poser `pose`
   * recorded (`PoseNote`). */
  add(matrix: THREE.Matrix4, pose: PoseNote): void {
    const i = this.n++;
    this.mesh.setMatrixAt(i, matrix);
    const w = this.weights;
    const at = i * (this.targets + 1);
    // The morph texture: the base's influence, then each target's.
    w[at] = 1;
    w.fill(0, at + 1, at + 1 + this.targets);
    const set = (name: string | undefined, k: number) => {
      const j = name ? this.names.indexOf(name) : -1;
      if (j > 0) w[at + j] += k;
    };
    set(pose.name, pose.share);
    set(pose.from, 1 - pose.share);
  }
  end(): void {
    const m = this.mesh;
    m.count = this.n;
    m.visible = this.n > 0;
    if (this.n === 0) return;
    m.instanceMatrix.needsUpdate = true;
    m.morphTexture!.needsUpdate = true;
  }
  dispose(): void {
    this.mesh.dispose();
  }
}

/** A POSE WRITTEN DOWN rather than set: a stand-in the ground view poses
 * and places as it would a man's own mesh, read back into a batch. */
export class PoseNote implements SoldierPoser {
  readonly mesh = new THREE.Object3D();
  name = "";
  share = 1;
  from: string | undefined = undefined;
  pose<K extends SoldierKind>(
    name: SoldierPoseName<K>,
    share = 1,
    from?: SoldierPoseName<K>,
  ): void {
    this.name = name;
    this.share = share;
    this.from = from;
  }
}
