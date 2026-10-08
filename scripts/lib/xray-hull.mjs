// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A CLOUD'S CONVEX HULL as a mesh `{ v, f }` (`make xray-body`): the lungs,
// which the body has only as the airways and vessels branching through
// them, drawn as the hull round that tree. three's own hull, read in Node.

import { Vector3 } from "three";
import { ConvexHull } from "three/examples/jsm/math/ConvexHull.js";

export function THREE_HULL(v) {
  const points = [];
  for (let i = 0; i < v.length; i += 3) points.push(new Vector3(v[i], v[i + 1], v[i + 2]));
  const hull = new ConvexHull().setFromPoints(points);
  const out = [];
  const f = [];
  const index = new Map();
  const at = (p) => {
    const key = `${p.x},${p.y},${p.z}`;
    let k = index.get(key);
    if (k === undefined) {
      k = out.length / 3;
      index.set(key, k);
      out.push(p.x, p.y, p.z);
    }
    return k;
  };
  for (const face of hull.faces) {
    const ring = [];
    let e = face.edge;
    do {
      ring.push(at(e.head().point));
      e = e.next;
    } while (e !== face.edge);
    for (let k = 1; k + 1 < ring.length; k++) f.push(ring[0], ring[k], ring[k + 1]);
  }
  return { v: Float64Array.from(out), f: Uint32Array.from(f) };
}
