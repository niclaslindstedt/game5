// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOOTS ON HIS FEET IN TOWN (`town.ts`): out of the bindings, walking
// the village with the pair on his shoulder, he wears the boots the pair
// was drawn with — the same shell, toe box, forward-tipped cuff and three
// buckles `ski-gear.ts` clamps into the bindings — on the figure's feet
// instead. Each is built with its origin at the top of the cuff, where the
// figure's own cloth stops (`SkierPose.feet`), and turned by the foot's
// frame (`SkierPose.boots`).

import * as THREE from "three";

import type { Boot } from "./skier-limbs.ts";
import type { V3 } from "./skier-vec.ts";

type BootLook = { boot: { length: number; height: number } };

/** A pair of walking boots, hidden until the figure is in town. */
export function buildWalkBoots(
  look: BootLook,
  boot: THREE.Material,
  alloy: THREE.Material,
  keep: (g: THREE.BufferGeometry) => THREE.BufferGeometry,
): THREE.Group[] {
  const { length, height } = look.boot;
  const tip = 0.22;
  // The cuff's top centre, which the origin is put on.
  const top = { y: height, z: -0.01 + (Math.sin(tip) * (height - 0.07)) / 2 };
  const out: THREE.Group[] = [];
  for (let i = 0; i < 2; i++) {
    const group = new THREE.Group();
    const add = (g: THREE.BufferGeometry, m: THREE.Material, y: number, z: number) => {
      const mesh = new THREE.Mesh(keep(g), m);
      mesh.position.set(0, y - top.y, z - top.z);
      group.add(mesh);
      return mesh;
    };
    add(new THREE.BoxGeometry(0.1, 0.09, length), boot, 0.045, 0.01);
    add(new THREE.BoxGeometry(0.08, 0.06, 0.05), boot, 0.03, length / 2 + 0.02);
    const cuff = add(
      new THREE.CylinderGeometry(0.058, 0.066, height - 0.07, 10),
      boot,
      0.07 + (height - 0.07) / 2,
      -0.01,
    );
    cuff.rotation.x = tip;
    for (let k = 0; k < 3; k++) {
      add(new THREE.BoxGeometry(0.06, 0.012, 0.02), alloy, 0.05 + k * 0.06, 0.05 - k * 0.012);
    }
    group.visible = false;
    out.push(group);
  }
  return out;
}

const bx = new THREE.Vector3();
const by = new THREE.Vector3();
const bz = new THREE.Vector3();
const basis = new THREE.Matrix4();

/** A walking boot put on a foot: its cuff's top at `foot`, its sole
 * square to the foot's frame. */
export function bootOn(group: THREE.Object3D, foot: V3, frame: Boot): void {
  by.set(frame.n.x, frame.n.y, frame.n.z).normalize();
  bz.set(frame.f.x, frame.f.y, frame.f.z);
  bz.addScaledVector(by, -bz.dot(by)).normalize();
  bx.crossVectors(by, bz);
  basis.makeBasis(bx, by, bz);
  group.quaternion.setFromRotationMatrix(basis);
  group.position.set(foot.x, foot.y, foot.z);
}
