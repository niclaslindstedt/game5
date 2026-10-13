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
// somebody optimising a thing that was never submitted. Handed the lens,
// it drops what three's frustum test would drop too (the ground's warm-up
// mesh, a bank of fans behind him).

import * as THREE from "three";

import type { SceneShare } from "./benchmark-report.ts";

export function tallyScene(root: THREE.Object3D, camera?: THREE.Camera): SceneShare[] {
  const buckets = new Map<string, SceneShare>();
  const frustum = camera ? frustumOf(camera) : null;
  const sphere = new THREE.Sphere();
  const walk = (object: THREE.Object3D, under: string): void => {
    if (!object.visible) return;
    const name = object.name !== "" ? object.name : under;
    const geometry = (object as Partial<THREE.Mesh>).geometry;
    // An instanced mesh is culled on its own sphere round every instance.
    const instanced = (object as Partial<THREE.InstancedMesh>).isInstancedMesh === true;
    const bound = instanced
      ? ((object as THREE.InstancedMesh).boundingSphere ?? null)
      : (geometry?.boundingSphere ?? null);
    const culled =
      frustum !== null &&
      object.frustumCulled &&
      bound !== null &&
      !frustum.intersectsSphere(sphere.copy(bound).applyMatrix4(object.matrixWorld));
    if (geometry !== undefined && !culled) {
      const share = buckets.get(name) ?? { name, objects: 0, triangles: 0 };
      share.objects += 1;
      const index = geometry.getIndex();
      const position = geometry.getAttribute("position");
      // A draw range is what three submits: the ground's rings hold every
      // wedge twice round and draw the run of them the lens can see.
      const whole = index ? index.count : (position?.count ?? 0);
      const range = geometry.drawRange;
      const verts = Math.max(0, Math.min(whole, range.start + range.count) - range.start);
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

function frustumOf(camera: THREE.Camera): THREE.Frustum {
  const m = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );
  return new THREE.Frustum().setFromProjectionMatrix(m);
}
