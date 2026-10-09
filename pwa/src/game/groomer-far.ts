// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE MACHINE FROM AFAR — the far cut of every machine on the map:
// the code's stand-in (`groomer-build.ts`, about a fifth of the model's
// triangles) built ONCE, its parts frozen where they ride while it works
// and merged into one geometry a paint, each drawn as ONE INSTANCED MESH
// for the whole fleet. A machine past `GROOMER_FAR` m of the lens is put
// there instead of its own copy of the model (`groomer-scene.ts`), its
// glow still its own; nearer it is drawn whole again, past a margin either
// way so one standing at the edge never flickers between the two. Too far
// for the sun's shadow box, so none of it casts.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { buildGroomer, type GroomerPaint } from "./groomer-build.ts";

/** Past this from the lens a machine is drawn at its far cut, m; nearer
 * than `GROOMER_FAR - GROOMER_MARGIN` it is drawn whole again. */
export const GROOMER_FAR = 140;
export const GROOMER_MARGIN = 20;

/** Whether a machine `d` m off, drawn far or not (`far`), is far now. */
export function farNow(d: number, far: boolean): boolean {
  return far ? d > GROOMER_FAR - GROOMER_MARGIN : d > GROOMER_FAR;
}

export type GroomerFar = {
  readonly group: THREE.Group;
  /** Start a frame's fill. */
  begin(): void;
  /** One machine more, placed by its drawn group's world matrix; false
   * when the cut is full (that one is drawn whole). */
  add(world: THREE.Matrix4): boolean;
  end(): void;
  /** Its triangles a machine, for the suite. */
  readonly triangles: number;
  dispose(): void;
};

/** The stand-in's every part in the machine's frame, one geometry a
 * material: position and normal only, the heap ahead of the blade left
 * out (it shows only while the machine works up close). */
export function farParts(paint: GroomerPaint): Map<THREE.Material, THREE.BufferGeometry> {
  const body = buildGroomer(paint);
  body.root.updateMatrixWorld(true);
  const by = new Map<THREE.Material, THREE.BufferGeometry[]>();
  body.root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    let p: THREE.Object3D | null = o;
    while (p && p !== body.heap) p = p.parent;
    if (p) return;
    const src = o.geometry as THREE.BufferGeometry;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", src.getAttribute("position").clone());
    g.setAttribute("normal", src.getAttribute("normal").clone());
    if (src.index) g.setIndex(src.index.clone());
    const flat = g.index ? g.toNonIndexed() : g;
    flat.applyMatrix4(o.matrixWorld);
    const m = o.material as THREE.Material;
    by.set(m, [...(by.get(m) ?? []), flat]);
  });
  body.dispose();
  const out = new Map<THREE.Material, THREE.BufferGeometry>();
  for (const [m, parts] of by) {
    out.set(m, mergeGeometries(parts, false)!);
    for (const p of parts) p.dispose();
  }
  return out;
}

export function createGroomerFar(paint: GroomerPaint, capacity: number): GroomerFar {
  const group = new THREE.Group();
  group.name = "piste-machines-far";
  const meshes: THREE.InstancedMesh[] = [];
  let triangles = 0;
  for (const [m, g] of farParts(paint)) {
    triangles += g.getAttribute("position").count / 3;
    const mesh = new THREE.InstancedMesh(g, m, Math.max(1, capacity));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    // What it holds moves with the fleet: never culled whole.
    mesh.frustumCulled = false;
    mesh.count = 0;
    meshes.push(mesh);
    group.add(mesh);
  }
  let n = 0;
  return {
    group,
    triangles,
    begin() {
      n = 0;
    },
    add(world) {
      if (n >= capacity) return false;
      for (const mesh of meshes) mesh.setMatrixAt(n, world);
      n++;
      return true;
    },
    end() {
      for (const mesh of meshes) {
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
      }
      group.visible = n > 0;
    },
    dispose() {
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        mesh.dispose();
      }
    },
  };
}
