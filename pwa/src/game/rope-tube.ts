// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A LIFT'S ROPE AS A BODY (`lifts.ts`): the line segments the ropes are drawn
// as, each also given its thickness — a six-sided prism round it, the rope's
// real 5 cm. A pixel-wide line is all a rope is from afar, but under a
// chair's grip, a lens a metre or two off it, a line stays a hair while the
// steel it stands for is a finger thick. The line is still drawn over it, so
// where the prism thins to under a pixel and would flicker, the line carries
// the rope unbroken.

import * as THREE from "three";

/** A haul rope's radius, m (40–54 mm across). */
export const ROPE_RADIUS = 0.025;

const SIDES = 6;

/** The prisms round `segments` (pairs of points, x y z each, as a
 * `LineSegments` takes them), as one indexed geometry with radial normals. */
export function ropeTube(segments: readonly number[], radius = ROPE_RADIUS): THREE.BufferGeometry {
  const n = segments.length / 6;
  const pos = new Float32Array(n * SIDES * 2 * 3);
  const nor = new Float32Array(n * SIDES * 2 * 3);
  const idx: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const along = new THREE.Vector3();
  const u = new THREE.Vector3();
  const v = new THREE.Vector3();
  const r = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const ACROSS = new THREE.Vector3(1, 0, 0);
  for (let s = 0; s < n; s++) {
    a.fromArray(segments, s * 6);
    b.fromArray(segments, s * 6 + 3);
    along.subVectors(b, a);
    if (along.lengthSq() < 1e-12) along.set(0, 0, 1);
    along.normalize();
    // Two axes square to the rope: one across it level, one over it.
    u.crossVectors(Math.abs(along.y) > 0.9 ? ACROSS : UP, along).normalize();
    v.crossVectors(along, u);
    const base = s * SIDES * 2;
    for (let k = 0; k < SIDES; k++) {
      const t = (2 * Math.PI * k) / SIDES;
      r.copy(u).multiplyScalar(Math.cos(t)).addScaledVector(v, Math.sin(t));
      for (const [end, p] of [
        [0, a],
        [1, b],
      ] as const) {
        const i = (base + k * 2 + end) * 3;
        pos[i] = p.x + r.x * radius;
        pos[i + 1] = p.y + r.y * radius;
        pos[i + 2] = p.z + r.z * radius;
        nor[i] = r.x;
        nor[i + 1] = r.y;
        nor[i + 2] = r.z;
      }
      const k1 = (k + 1) % SIDES;
      const p0 = base + k * 2;
      const p1 = base + k1 * 2;
      idx.push(p0, p1, p0 + 1, p1, p1 + 1, p0 + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
