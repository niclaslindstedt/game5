// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ONE MESH CUT INTO TILES, so three can cull it. three culls a whole mesh
// against the lens's frustum (and the sun's box) by its bounding sphere, so
// a mesh spanning the village — every house, shop and kerb of it — is drawn
// whole, and drawn whole into the sun's map, from anywhere inside it. Cut
// into square tiles on the ground, each with its own bound, the tiles
// behind the lens and outside the sun's box are left out of both passes,
// for a draw call a tile in sight.
//
// A triangle goes to the tile its middle stands in; its corners are copied
// (unindexed) or its indices are (indexed, the attributes shared, so the
// vertices are uploaded once). Every triangle lands in exactly one tile, in
// the order it was in, so the same faces are drawn with the same data.

import * as THREE from "three";

/** The tile the village's buildings and street furniture are cut into,
 * m: a few houses a side, so a street seen along its length is a handful
 * of draws and a lens in the square leaves most of the village out. */
export const BUILDING_TILE = 96;

/** `geo` cut into tiles `tile` m square in plan, each with its bounds;
 * `geo` itself when it fits in one. `geo` is left as it is. */
export function splitByTile(geo: THREE.BufferGeometry, tile: number): THREE.BufferGeometry[] {
  const pos = geo.getAttribute("position");
  const index = geo.getIndex();
  const tris = (index ? index.count : pos.count) / 3;
  const corner = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
  const cells = new Map<string, number[]>();
  for (let t = 0; t < tris; t++) {
    let x = 0;
    let z = 0;
    for (let k = 0; k < 3; k++) {
      const v = corner(t, k);
      x += pos.getX(v);
      z += pos.getZ(v);
    }
    const key = `${Math.floor(x / 3 / tile)},${Math.floor(z / 3 / tile)}`;
    let list = cells.get(key);
    if (!list) cells.set(key, (list = []));
    list.push(t);
  }
  if (cells.size <= 1) return [geo];
  const out: THREE.BufferGeometry[] = [];
  for (const list of cells.values()) {
    const g = new THREE.BufferGeometry();
    if (index) {
      for (const [name, a] of Object.entries(geo.attributes)) g.setAttribute(name, a);
      const idx = new Uint32Array(list.length * 3);
      list.forEach((t, i) => {
        for (let k = 0; k < 3; k++) idx[i * 3 + k] = corner(t, k);
      });
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.boundingSphere = sphereOf(pos, idx);
    } else {
      for (const [name, a] of Object.entries(geo.attributes)) {
        const n = a.itemSize;
        const src = a.array;
        const dst = new (src.constructor as Float32ArrayConstructor)(list.length * 3 * n);
        list.forEach((t, i) => dst.set(src.subarray(t * 3 * n, (t + 1) * 3 * n), i * 3 * n));
        g.setAttribute(name, new THREE.BufferAttribute(dst, n, a.normalized));
      }
      g.computeBoundingSphere();
    }
    out.push(g);
  }
  return out;
}

/** The bound of the vertices `idx` names, as three would compute it for a
 * geometry holding only them: the box's middle, the farthest vertex. */
function sphereOf(
  pos: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  idx: Uint32Array,
): THREE.Sphere {
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const i of idx) box.expandByPoint(v.fromBufferAttribute(pos, i));
  const s = new THREE.Sphere();
  box.getCenter(s.center);
  let r2 = 0;
  for (const i of idx) r2 = Math.max(r2, s.center.distanceToSquared(v.fromBufferAttribute(pos, i)));
  s.radius = Math.sqrt(r2);
  return s;
}
