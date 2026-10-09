// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A LIFT PART AT TWO CUTS: one instanced mesh of the whole part for the
// ones near the lens and one of a few boxes for the rest, every instance
// handed to one or the other by its distance from the eye — so a
// mountain's hundreds of chairs and towers cost their detail only where
// it can be seen (`lifts.ts`). A part with no far cut is not drawn past
// its reach (a ladder); one given a DISTANT cut (`Beyond`) takes a third,
// lighter still, past a further reach — or, with no geometry for it, is
// not drawn there at all (a chair's safety bar across the valley).

import * as THREE from "three";

import type { ViewCull } from "./view-cull.ts";

/** How high over the snow a carrier can hang, for the length of its
 * shadow, m: past the tallest tower's rope. */
const CARRIER_HEIGHT = 45;

/** A third cut past `reach` m: drawn as `geo`, or not at all with none. */
export type Beyond = { geo: THREE.BufferGeometry | null; reach: number };

export class Cut {
  readonly near: THREE.InstancedMesh;
  readonly far: THREE.InstancedMesh | null;
  readonly distant: THREE.InstancedMesh | null;
  private n = 0;
  private f = 0;
  private d = 0;
  private readonly beyond2: number;
  private eye: THREE.Vector3 | null = null;
  private cull: ViewCull | null = null;
  /** The parts' bound round an instance's origin, m. */
  private readonly radius: number;
  private readonly reach2: number;
  private readonly at = new THREE.Vector3();

  /** `reach` m is as far as the near cut is drawn. */
  constructor(
    near: THREE.BufferGeometry,
    far: THREE.BufferGeometry | null,
    mat: THREE.Material,
    capacity: number,
    reach: number,
    shadow = true,
    beyond?: Beyond,
  ) {
    this.reach2 = reach * reach;
    this.beyond2 = beyond ? beyond.reach * beyond.reach : Infinity;
    const make = (g: THREE.BufferGeometry) => {
      const m = new THREE.InstancedMesh(g, mat, Math.max(1, capacity));
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = shadow;
      m.receiveShadow = true;
      // What a cut holds changes as the lens moves: never culled whole.
      m.frustumCulled = false;
      m.count = 0;
      return m;
    };
    this.near = make(near);
    this.far = far ? make(far) : null;
    this.distant = beyond?.geo ? make(beyond.geo) : null;
    const bound = (g: THREE.BufferGeometry | null): number => {
      if (!g) return 0;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const s = g.boundingSphere!;
      return s.center.length() + s.radius;
    };
    this.radius = Math.max(bound(near), bound(far));
  }

  /** Every mesh it draws with, for the group and for disposal. */
  get meshes(): THREE.InstancedMesh[] {
    return [this.near, this.far, this.distant].filter((m) => m !== null);
  }

  /** Start a fill from `eye` — or, with none, every instance far — leaving
   * out what `cull` says is out of sight and shadows nothing in it. */
  begin(eye: THREE.Vector3 | null | undefined, cull?: ViewCull): void {
    this.eye = eye ?? null;
    this.cull = cull ?? null;
    this.n = 0;
    this.f = 0;
    this.d = 0;
  }

  /** The next instance, placed by `m`. */
  add(m: THREE.Matrix4): void {
    this.at.setFromMatrixPosition(m);
    const d2 = this.eye ? this.at.distanceToSquared(this.eye) : Infinity;
    const near = this.eye ? d2 < this.reach2 : !this.far;
    if (d2 >= this.beyond2 && this.eye && !this.distant) return;
    const c = this.cull;
    if (
      c &&
      !c.inView(this.at.x, this.at.y, this.at.z, this.radius) &&
      !(this.near.castShadow && c.shadows(this.at.x, this.at.z, CARRIER_HEIGHT, this.radius))
    )
      return;
    if (near) this.near.setMatrixAt(this.n++, m);
    else if (this.eye && this.distant && d2 >= this.beyond2) this.distant.setMatrixAt(this.d++, m);
    else if (this.far) this.far.setMatrixAt(this.f++, m);
  }

  end(): void {
    this.near.count = this.n;
    this.near.instanceMatrix.needsUpdate = true;
    if (this.far) {
      this.far.count = this.f;
      this.far.instanceMatrix.needsUpdate = true;
    }
    if (this.distant) {
      this.distant.count = this.d;
      this.distant.instanceMatrix.needsUpdate = true;
    }
  }
}

/** A cut of parts that STAND STILL (the towers' heads and ladders): their
 * matrices kept, and handed out again only once the eye has moved
 * `again` m since the last time. */
export class StillCut {
  readonly cut: Cut;
  private readonly again: number;
  private readonly list: THREE.Matrix4[] = [];
  private last: THREE.Vector3 | null = null;
  private filled = false;

  constructor(cut: Cut, again = 10) {
    this.cut = cut;
    this.again = again;
  }

  add(m: THREE.Matrix4): void {
    this.list.push(m.clone());
  }

  /** Handed out from `eye` if it has moved far enough (or never was). */
  update(eye: THREE.Vector3 | null | undefined): void {
    if (eye ? this.last && this.last.distanceTo(eye) < this.again : this.filled) return;
    this.cut.begin(eye);
    for (const m of this.list) this.cut.add(m);
    this.cut.end();
    this.filled = true;
    if (eye) this.last = (this.last ?? new THREE.Vector3()).copy(eye);
  }
}
