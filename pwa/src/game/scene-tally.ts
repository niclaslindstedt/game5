// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SCENE, WALKED, and bucketed by what it belongs to — the half of the
// benchmark's report that says WHERE to look. A frame's draw calls say a
// machine is struggling; this says the woods are four fifths of its
// triangles.
//
// Beside the renderer rather than inside it because it is an INSTRUMENT, not
// part of drawing: nothing in a frame calls it, and the benchmark asks for it
// once, on the last frame of a run. A walk of the whole graph, so it is never
// called from a frame being timed for anything but this.
//
// The bucket is the nearest NAMED ancestor, which is why the groups the
// renderer adds carry names (`renderer.ts`'s `load`); without one an object
// is billed to the scene itself. Only what would be DRAWN counts: an
// invisible object, and everything under it, is skipped as three's own
// traversal skips it — a breakdown that counted a hidden ghost would send
// somebody optimising a thing that was never submitted.

import * as THREE from "three";

import type { SceneShare } from "./benchmark-report.ts";

export function tallyScene(root: THREE.Object3D): SceneShare[] {
  const buckets = new Map<string, SceneShare>();
  const walk = (object: THREE.Object3D, under: string): void => {
    if (!object.visible) return;
    const name = object.name !== "" ? object.name : under;
    const geometry = (object as Partial<THREE.Mesh>).geometry;
    if (geometry !== undefined) {
      const share = buckets.get(name) ?? { name, objects: 0, triangles: 0 };
      share.objects += 1;
      const index = geometry.getIndex();
      const position = geometry.getAttribute("position");
      const verts = index ? index.count : (position?.count ?? 0);
      const instances = (object as Partial<THREE.InstancedMesh>).count ?? 1;
      // Points and lines draw no triangles; they are still objects.
      const isMesh = (object as Partial<THREE.Mesh>).isMesh === true;
      if (isMesh) share.triangles += Math.floor(verts / 3) * instances;
      buckets.set(name, share);
    }
    for (const child of object.children) walk(child, name);
  };
  walk(root, "scene");
  return [...buckets.values()];
}
