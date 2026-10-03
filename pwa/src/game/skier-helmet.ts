// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER'S HEAD AND HIS HELMET as the code's figure draws it — the
// geometry is `helmet-shape.ts`'s (three-free, so the Blender model is
// built from the very same triangles, `scripts/blender/kinds/skier.mjs`),
// laid in the head's frame (z forward, y up, the origin at the middle of
// the head) and hung by `skier-figure.ts` where the pose puts the head.
// What it is and why it is laid as it is: that file's header. `make
// helmet` is the lab: the code's and the model's side by side, wired, on a
// centimetre grid and at the game's own pixels.

import * as THREE from "three";

import { helmetParts, type HelmetMaterial } from "./helmet-shape.ts";

export { helmetReach } from "./helmet-shape.ts";

export type HelmetMaterials = {
  /** The shell, in the kit's helmet colour. */
  shell: THREE.Material;
  /** The liner inside the shell, the vents, his balaclava. */
  liner: THREE.Material;
  /** The kit's second colour: the stripe, the goggles' frame, the strap's
   * middle lane. */
  trim: THREE.Material;
  lens: THREE.Material;
  /** The black of the rubber edge, the strap's edges and clip, the foam,
   * the chin strap. */
  strap: THREE.Material;
  skin: THREE.Material;
};

/** Which of the figure's materials each surface takes. */
const PAINT: Record<HelmetMaterial, keyof HelmetMaterials> = {
  shell: "shell",
  stripe: "trim",
  frame: "trim",
  band: "trim",
  trim: "strap",
  strap: "strap",
  foam: "strap",
  liner: "liner",
  knit: "liner",
  lens: "lens",
  skin: "skin",
};

/** THE HEAD IN HIS HELMET, built into `into` (the head's frame). `keep`
 * takes every geometry made, for the caller to dispose. */
export function buildHelmet(
  into: THREE.Object3D,
  m: HelmetMaterials,
  keep: <G extends THREE.BufferGeometry>(g: G) => G,
): void {
  for (const part of helmetParts()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(part.position, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(part.normal, 3));
    g.setIndex(part.index);
    const mesh = new THREE.Mesh(keep(g), m[PAINT[part.material]]);
    mesh.castShadow = true;
    into.add(mesh);
  }
}
