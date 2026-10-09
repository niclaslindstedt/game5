// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SMALL THINGS ARE NOT DRAWN FAR OFF: a set of instanced meshes that share
// one index space (instance i of each is a part of the same thing — a snow
// gun's drum, its yoke and its nozzle ring; a sign's board and its post),
// every instance of which is placed ONCE into a copy kept here, and handed
// to the GPU only while its thing stands within `reach` m of the lens: the
// near ones packed to the front of each mesh and the count cut to them.
// A part a few centimetres across is under a pixel long before the
// mountain runs out, and a whole ski area's worth of them is otherwise
// drawn — and shadowed — from anywhere.
//
// The packing is redone only when the lens has moved `again` m, or a part
// has been placed anew (a snow gun's drum sweeping), and then only the
// near ones are copied. Each mesh's bound is the near ones', so three
// still culls a set wholly out of view. Three-free in what it decides
// (`nearOf`); the copying is three's arrays.

import type * as THREE from "three";

/** The indices of `points` (x, y, z a thing) within `reach` m of `eye`,
 * in order, into `out`; how many. */
export function nearOf(
  points: Float32Array,
  eye: { x: number; y: number; z: number },
  reach: number,
  out: Uint32Array,
): number {
  const r2 = reach * reach;
  let n = 0;
  for (let i = 0, k = 0; k < points.length; i++, k += 3) {
    const dx = points[k] - eye.x;
    const dy = points[k + 1] - eye.y;
    const dz = points[k + 2] - eye.z;
    if (dx * dx + dy * dy + dz * dz < r2) out[n++] = i;
  }
  return n;
}

type Kept = {
  mesh: THREE.InstancedMesh;
  matrices: Float32Array;
  colours: Float32Array | null;
};

export class InstanceReach {
  readonly reach: number;
  private readonly again: number;
  private readonly points: Float32Array;
  private readonly kept: Kept[] = [];
  private readonly near: Uint32Array;
  private last: { x: number; y: number; z: number } | null = null;
  private dirty = true;

  /** `points` the things' places (x, y, z each); `meshes` the parts, each
   * already filled with one instance a thing (its colours too). */
  constructor(
    meshes: readonly THREE.InstancedMesh[],
    points: Float32Array,
    reach: number,
    again = 8,
  ) {
    this.reach = reach;
    this.again = again;
    this.points = points;
    const n = points.length / 3;
    this.near = new Uint32Array(n);
    for (const mesh of meshes) {
      this.kept.push({
        mesh,
        matrices: (mesh.instanceMatrix.array as Float32Array).slice(0, n * 16),
        colours: mesh.instanceColor
          ? (mesh.instanceColor.array as Float32Array).slice(0, n * 3)
          : null,
      });
    }
  }

  /** Place thing `i`'s part `mesh` anew (it moves): kept, and handed out
   * at the next `update`. */
  place(mesh: THREE.InstancedMesh, i: number, m: THREE.Matrix4): void {
    const k = this.kept.find((x) => x.mesh === mesh);
    if (!k) return;
    m.toArray(k.matrices, i * 16);
    this.dirty = true;
  }

  /** Hand out what is within reach of `eye` (or, with none, everything). */
  update(eye: { x: number; y: number; z: number } | null | undefined): void {
    const all = this.points.length / 3;
    if (!eye) {
      if (!this.dirty && this.last === null) return;
      for (let i = 0; i < all; i++) this.near[i] = i;
      this.fill(all);
      this.last = null;
      return;
    }
    const l = this.last;
    if (!this.dirty && l && Math.hypot(eye.x - l.x, eye.y - l.y, eye.z - l.z) < this.again) return;
    this.fill(nearOf(this.points, eye, this.reach, this.near));
    this.last = { x: eye.x, y: eye.y, z: eye.z };
  }

  private fill(n: number): void {
    this.dirty = false;
    for (const { mesh, matrices, colours } of this.kept) {
      const to = mesh.instanceMatrix.array as Float32Array;
      const cto = mesh.instanceColor?.array as Float32Array | undefined;
      for (let j = 0; j < n; j++) {
        const i = this.near[j];
        to.set(matrices.subarray(i * 16, i * 16 + 16), j * 16);
        if (colours && cto) cto.set(colours.subarray(i * 3, i * 3 + 3), j * 3);
      }
      mesh.count = n;
      mesh.visible = n > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (n > 0) mesh.computeBoundingSphere();
    }
  }
}
