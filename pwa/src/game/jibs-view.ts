// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JIBS AS DRAWN (R39): a slopestyle course's rails and boxes, built in
// code off the polylines the engine rides them on (`Level.jibs` — each
// point the TOP a ski slides along), in the course furniture's plain look:
//
//   * A RAIL is a round steel tube along the line, its top on the line,
//     stood on posts down to the snow every couple of metres.
//   * A BOX is a slab as wide as its deck, its top a pale sliding surface
//     on the line and its sides painted, its skirt down to the snow.
//
// One mesh a kind: the pieces of every jib merged, so a course of six jibs
// is two draws. Presentation only — nothing here is read back.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Level } from "@engine";

/** The tube's radius, the posts' radius and how far apart they stand, m;
 * a box's slab thickness under its top, m. */
const LOOK = { tube: 0.04, post: 0.03, every: 2, slab: 0.25 } as const;

/** The rails and boxes of `level`, or null on a map with none. `paint` is
 * how the caller makes a material (its haze, its disposal). */
export function createJibs(
  level: Level,
  paint: (p: THREE.MeshStandardMaterialParameters, name: string) => THREE.Material,
): { group: THREE.Group; dispose: () => void } | null {
  const jibs = level.jibs ?? [];
  if (jibs.length === 0) return null;
  const steel: THREE.BufferGeometry[] = [];
  const boxes: THREE.BufferGeometry[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const m4 = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);
  const post = (x: number, top: number, z: number) => {
    const foot = level.groundAt(x, z) - 0.2;
    const h = Math.max(0.1, top - foot);
    const g = new THREE.CylinderGeometry(LOOK.post, LOOK.post, h, 6);
    g.translate(x, foot + h / 2, z);
    steel.push(g);
  };
  for (const jib of jibs) {
    for (let i = 1; i < jib.points.length; i++) {
      a.set(jib.points[i - 1].x, jib.points[i - 1].y, jib.points[i - 1].z);
      b.set(jib.points[i].x, jib.points[i].y, jib.points[i].z);
      const len = a.distanceTo(b);
      if (len < 1e-3) continue;
      dir.subVectors(b, a).normalize();
      mid.addVectors(a, b).multiplyScalar(0.5);
      if (jib.kind === "rail") {
        // The tube along the leg, its top on the line.
        const g = new THREE.CylinderGeometry(LOOK.tube, LOOK.tube, len, 8);
        q.setFromUnitVectors(up, dir);
        g.applyMatrix4(m4.compose(mid.clone().setY(mid.y - LOOK.tube), q, one));
        steel.push(g);
        const posts = Math.max(1, Math.round(len / LOOK.every));
        for (let k = 0; k <= posts; k++) {
          if (k === 0 && i > 1) continue;
          const t = k / posts;
          post(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - 2 * LOOK.tube, a.z + (b.z - a.z) * t);
        }
      } else {
        // The slab: its top on the line, turned to the leg's heading and
        // pitched down it, its skirt reaching the snow under its low end.
        const heading = Math.atan2(dir.x, dir.z);
        const pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
        const groundLow = Math.min(level.groundAt(a.x, a.z), level.groundAt(b.x, b.z));
        const depth = Math.max(LOOK.slab, Math.max(a.y, b.y) - groundLow + 0.2);
        const g = new THREE.BoxGeometry(jib.width, depth, len);
        g.translate(0, -depth / 2, 0);
        g.applyMatrix4(
          m4.compose(mid, q.setFromEuler(new THREE.Euler(-pitch, heading, 0, "YXZ")), one),
        );
        boxes.push(g);
      }
    }
  }
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const add = (parts: THREE.BufferGeometry[], material: THREE.Material) => {
    if (parts.length === 0) return;
    const g = mergeGeometries(parts.map((p) => p.toNonIndexed()));
    for (const p of parts) p.dispose();
    if (!g) return;
    geos.push(g);
    group.add(new THREE.Mesh(g, material));
  };
  add(steel, paint({ color: 0xc7ccd1, roughness: 0.3, metalness: 0.8 }, "jib-steel"));
  add(boxes, paint({ color: 0x2f6fb0, roughness: 0.55 }, "jib-box"));
  return {
    group,
    dispose: () => {
      for (const g of geos) g.dispose();
    },
  };
}
