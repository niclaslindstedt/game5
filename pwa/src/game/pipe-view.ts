// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HALFPIPE AS DRAWN (R39): the pipe's own snow surface, built in code
// off the engine's own surface (`Level.groundAt`, which inside the pipe's
// footprint is `mapgen/pipe.ts`'s exact section, not the 2 m grid).
//
// The ground's clipmap reads the heightfield, whose 2 m cells cannot hold
// a 6.7 m wall that stands up over 7 m — the grid under the pipe is cut a
// little BELOW the section (`withPipe`), and this mesh lays the true
// surface over it: rows every metre down the pipe from its mouth to its
// tail, each row's points spaced by ARC LENGTH across the section, so the
// near-vertical vert is drawn in as many points as the flat. Plain groomed
// snow in the course furniture's look; the snow shader's glitter and the
// trail map's grooves are the ground's and not laid on it yet.
// Presentation only — nothing here is read back.

import * as THREE from "three";
import { wallAt, type Level } from "@engine";

/** The rows' spacing down the pipe and the arc between points across it,
 * m; how far over the engine's surface the mesh is laid, m. */
const LOOK = { row: 1, arc: 0.3, lift: 0.02 } as const;

/** The pipe of `level`, or null on a map with none. `paint` is how the
 * caller makes a material (its haze, its disposal). */
export function createPipe(
  level: Level,
  paint: (p: THREE.MeshStandardMaterialParameters, name: string) => THREE.Material,
): { group: THREE.Group; dispose: () => void } | null {
  const p = level.pipe;
  if (!p) return null;
  const s = p.section;
  // The section's points across, by arc length, one side, mirrored.
  const side: number[] = [];
  const edge = s.half + s.deck;
  for (let a = 0; a < edge;) {
    side.push(a);
    const dh = wallAt(s, a).dh;
    a += LOOK.arc / Math.sqrt(1 + dh * dh);
  }
  side.push(edge);
  const across = [
    ...side
      .slice(1)
      .reverse()
      .map((a) => -a),
    ...side,
  ];
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  const rows = Math.max(2, Math.ceil((p.end - p.mouth) / LOOK.row) + 1);
  const cols = across.length;
  const pos = new Float32Array(rows * cols * 3);
  for (let r = 0; r < rows; r++) {
    const along = p.mouth + ((p.end - p.mouth) * r) / (rows - 1);
    for (let k = 0; k < cols; k++) {
      const x = p.x + along * fx + across[k] * fz;
      const z = p.z + along * fz - across[k] * fx;
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
  const mesh = new THREE.Mesh(geo, paint({ color: 0xeef3f8, roughness: 0.85 }, "pipe-snow"));
  mesh.receiveShadow = true;
  group.add(mesh);
  return { group, dispose: () => geo.dispose() };
}
