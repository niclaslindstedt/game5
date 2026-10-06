// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MOGULS COURSE AS DRAWN (R42): the course's own snow surface — its
// moguls and its two air bumps — built in code off the engine's own
// surface (`Level.groundAt`, which inside the course's width is
// `mapgen/mogul-field.ts`'s analytic field, not the 2 m grid).
//
// The ground's clipmap reads the heightfield, whose 2 m cells cannot hold a
// mogul every three and a half metres — the grid under the course is cut a
// little BELOW the field (`withMoguls`), and this mesh lays the true
// surface over it: a grid of points every `LOOK.step` m down and across the
// course's whole graded width, from its start to the end of its finish
// area, a dual course's two lines as one. Plain groomed snow in the course
// furniture's look; the snow shader's glitter and the trail map's grooves
// are the ground's and not laid on it yet. Presentation only — nothing
// here is read back.

import * as THREE from "three";
import type { Level } from "@engine";

/** The grid's spacing down and across the course, m; how far over the
 * engine's surface the mesh is laid, m. */
const LOOK = { step: 0.35, lift: 0.02 } as const;

/** The mogul course of `level`, or null on a map with none. `paint` is how
 * the caller makes a material (its haze, its disposal). */
export function createMoguls(
  level: Level,
  paint: (p: THREE.MeshStandardMaterialParameters, name: string) => THREE.Material,
): { group: THREE.Group; dispose: () => void } | null {
  const f = level.bumps;
  if (!f) return null;
  const fx = Math.sin(f.heading);
  const fz = Math.cos(f.heading);
  // A hair inside the field's own edges, so every point is the field's.
  const half = f.half - 0.01;
  const cols = Math.max(2, Math.ceil((2 * half) / LOOK.step) + 1);
  const rows = Math.max(2, Math.ceil(f.end / LOOK.step) + 1);
  const pos = new Float32Array(rows * cols * 3);
  for (let r = 0; r < rows; r++) {
    const along = Math.min(f.end - 0.01, Math.max(0.01, (f.end * r) / (rows - 1)));
    for (let k = 0; k < cols; k++) {
      const across = -half + (2 * half * k) / (cols - 1);
      const x = f.x + along * fx + across * fz;
      const z = f.z + along * fz - across * fx;
      const i = (r * cols + k) * 3;
      pos[i] = x;
      pos[i + 1] = level.groundAt(x, z) + LOOK.lift;
      pos[i + 2] = z;
    }
  }
  const index: number[] = [];
  for (let r = 0; r + 1 < rows; r++) {
    for (let k = 0; k + 1 < cols; k++) {
      const a = r * cols + k;
      const b = a + cols;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geo, paint({ color: 0xeef3f8, roughness: 0.85 }, "mogul-snow"));
  mesh.receiveShadow = true;
  group.add(mesh);
  return { group, dispose: () => geo.dispose() };
}
