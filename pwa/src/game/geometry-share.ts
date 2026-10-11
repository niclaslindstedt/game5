// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A FIGURE DRAWN BY AN INSTANCED MESH, KEPT ONCE. The crowd is a figure a
// body and cut, built once and cached (`crowd-shapes.ts`), then drawn by an
// instanced mesh that hangs per-instance attributes of its own on the
// geometry. A `clone()` for that copied every vertex and every morph
// target of the figure, which the page then held twice. `sharing` is a
// geometry of its own over the SAME attribute objects: the instanced mesh
// adds its attributes to it and nothing is copied.
//
// Only for a mesh that never writes the figure's own vertices — a body
// posed on the CPU (a fallen amateur) still owns a clone.
//
// A shared geometry is let go with `releaseShared`, never `dispose()`: a
// dispose frees the GL buffers of every attribute the geometry holds,
// the figure's included, while another mesh (the next map's) still draws
// them. `releaseShared` frees what is the mesh's own (its per-instance
// attributes, its morph texture, its vertex arrays) and leaves the rest.

import * as THREE from "three";

/** A geometry drawing `base`'s attributes, index and morph targets, never
 * a copy of them. */
export function sharing(base: THREE.BufferGeometry): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  shared.set(geometry, base);
  geometry.name = base.name;
  geometry.setIndex(base.index);
  for (const [name, attribute] of Object.entries(base.attributes)) {
    geometry.setAttribute(name, attribute);
  }
  const morphs = base.morphAttributes;
  geometry.morphAttributes = {
    ...(morphs.position && { position: [...morphs.position] }),
    ...(morphs.normal && { normal: [...morphs.normal] }),
    ...(morphs.color && { color: [...morphs.color] }),
  };
  geometry.morphTargetsRelative = base.morphTargetsRelative;
  for (const g of base.groups) geometry.addGroup(g.start, g.count, g.materialIndex);
  geometry.setDrawRange(base.drawRange.start, base.drawRange.count);
  if (base.boundingBox) geometry.boundingBox = base.boundingBox.clone();
  if (base.boundingSphere) geometry.boundingSphere = base.boundingSphere.clone();
  geometry.userData = { ...base.userData };
  return geometry;
}

/** The figure each shared geometry draws. */
const shared = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

/** Free a geometry made by `sharing`: what it added of its own, never
 * its figure's buffers. Anything else is simply disposed. */
export function releaseShared(geometry: THREE.BufferGeometry): void {
  const base = shared.get(geometry);
  if (base) {
    if (geometry.index === base.index) geometry.setIndex(null);
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      if (base.attributes[name] === attribute) geometry.deleteAttribute(name);
    }
    shared.delete(geometry);
  }
  geometry.dispose();
}
