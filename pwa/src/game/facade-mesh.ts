// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A BUILDING AS DRAWN — what `facade-kit.ts` fills made one geometry, and
// the one world material every building of a kind is drawn with: the haze
// and the lamps every world material takes (`hazeMaterial`), the panes'
// glow after dark (`graftGlow`) and the painted stack (`graftFacade`).

import * as THREE from "three";

import { graftGlow } from "./cabins-view.ts";
import { graftFacade, holdFacades } from "./facade-material.ts";
import type { FacadeArrays } from "./facade-kit.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";

/** The arrays as a geometry. */
export function facadeGeometry(a: FacadeArrays): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(a.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(a.nrm, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(a.col, 3));
  g.setAttribute("facadeUv", new THREE.Float32BufferAttribute(a.uv, 2));
  g.setAttribute("facadeLayer", new THREE.Float32BufferAttribute(a.layer, 1));
  g.setAttribute("glow", new THREE.Float32BufferAttribute(a.glow, 1));
  g.computeBoundingSphere();
  return g;
}

/** The buildings' material, holding the painted stack until disposed. */
export function facadeMaterial(haze: HazeUniforms, name: string): THREE.MeshStandardMaterial {
  const held = holdFacades();
  const m = hazeMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
    haze,
    `facade-${name}`,
    (shader) => {
      graftGlow(shader);
      graftFacade(shader);
    },
  );
  m.addEventListener("dispose", () => held.release());
  return m;
}
