// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ONE MACHINE, TWO CUTS: a model and its plain stand-in hung under one
// node, the stand-in drawn in its place once the lens is past `far` m and
// the model again inside `far − margin` — the band between them kept, so
// one standing at the edge never flickers between the two. Decided for
// every picture the scene is drawn for (three calls an LOD's `update`
// with the lens before it walks the children); the sun's map draws
// whichever the picture last chose. `allow(false)` holds the model up
// close whatever the distance — a machine running, ridden or wrecked is
// only ever the model.

import * as THREE from "three";

/** Whether a thing `d` m off, drawn far or not (`was`), is far now. */
export function beyond(d: number, was: boolean, far: number, margin: number): boolean {
  return was ? d > far - margin : d > far;
}

export type FarSwap = {
  /** Hang this where the model would hang; the model and the stand-in go
   * under it. */
  readonly node: THREE.LOD;
  /** The model and its stand-in, once both are built. */
  hold(model: THREE.Object3D, standIn: THREE.Object3D): void;
  /** Whether the stand-in may be drawn at all. */
  allow(on: boolean): void;
  /** Whether the stand-in is drawn now. */
  readonly far: boolean;
};

export function createFarSwap(far: number, margin: number): FarSwap {
  const node = new THREE.LOD();
  node.name = "far-swap";
  let model: THREE.Object3D | null = null;
  let stand: THREE.Object3D | null = null;
  let isFar = false;
  let allowed = true;
  const eye = new THREE.Vector3();
  const here = new THREE.Vector3();
  const show = (f: boolean) => {
    isFar = f;
    if (model) model.visible = !f;
    if (stand) stand.visible = f;
  };
  node.update = (camera) => {
    if (!(camera as THREE.PerspectiveCamera).isPerspectiveCamera || !model || !stand) return;
    camera.getWorldPosition(eye);
    node.getWorldPosition(here);
    show(allowed && beyond(here.distanceTo(eye), isFar, far, margin));
  };
  return {
    node,
    hold(m, s) {
      model = m;
      stand = s;
      node.add(m, s);
      show(false);
    },
    allow(on) {
      allowed = on;
      if (!on && isFar) show(false);
    },
    get far() {
      return isFar;
    },
  };
}
