// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// FLAGS IN THE WIND — a set of flags on poles as one geometry, every flag a
// sheet of quads rewritten each frame as it streams with the air: hanging
// in a calm, lifted out by a breeze and flapping faster the harder it
// blows. A flag is one colour or striped from its hoist (a tricolour, its
// stripes the sheet's columns). The ski jumping hill's wind flags and its
// stadium's flags (`ski-jump-view.ts`, `ski-jump-arena.ts`) are drawn with
// it. Presentation only.

import * as THREE from "three";

/** One flag: the top of its pole (where the hoist's top is), a phase so
 * no two flap together, and its stripes from the hoist (sRGB), one or
 * more. */
export type FlagTop = {
  x: number;
  y: number;
  z: number;
  phase: number;
  stripes: readonly number[];
};

/** A flag's size: its length out from the pole and its depth, m, and the
 * quads along it (a multiple of the stripes for a clean stripe). */
export type FlagSize = { long: number; deep: number; segs: number };

export type FlagSheet = {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  /** Stream every flag at time `t` downwind along (wx, wz), unit, at
   * `speed` m/s. */
  stream(t: number, wx: number, wz: number, speed: number): void;
};

/** THE FLAGS `tops`, all of `size`, drawn in `material` (vertex colours). */
export function createFlagSheet(
  tops: readonly FlagTop[],
  size: FlagSize,
  material: THREE.Material,
): FlagSheet {
  const ROWS = 2;
  const perFlag = size.segs * ROWS * 6;
  const pos = new Float32Array(tops.length * perFlag * 3);
  const col = new Float32Array(tops.length * perFlag * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const c = new THREE.Color();
  tops.forEach((top, i) => {
    for (let k = 0; k < size.segs; k++) {
      const n = top.stripes.length;
      c.set(top.stripes[Math.min(n - 1, Math.floor((k * n) / size.segs))]);
      for (let v = 0; v < ROWS * 6; v++)
        col.set([c.r, c.g, c.b], (i * perFlag + k * ROWS * 6 + v) * 3);
    }
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const stream = (t: number, wx: number, wz: number, speed: number) => {
    // A calm flag hangs; a breeze lifts it out.
    const lift = Math.min(1, 0.25 + speed / 4);
    let o = 0;
    for (const top of tops) {
      const at = (s: number, v: number): [number, number, number] => {
        const flap = Math.sin(t * (4 + speed) - s * 5 + top.phase) * 0.1 * s * lift * size.long;
        const droop = (1 - lift) * s * size.long * 0.9;
        return [
          top.x + wx * s * size.long * lift - wz * flap,
          top.y - v * size.deep - droop,
          top.z + wz * s * size.long * lift + wx * flap,
        ];
      };
      for (let k = 0; k < size.segs; k++) {
        const s0 = k / size.segs;
        const s1 = (k + 1) / size.segs;
        for (let r = 0; r < ROWS; r++) {
          const v0 = r / ROWS;
          const v1 = (r + 1) / ROWS;
          const q = [at(s0, v0), at(s1, v0), at(s1, v1), at(s0, v1)];
          for (const n of [0, 1, 2, 0, 2, 3]) {
            pos.set(q[n], o);
            o += 3;
          }
        }
      }
    }
    geometry.getAttribute("position").needsUpdate = true;
    geometry.computeVertexNormals();
  };
  stream(0, 1, 0, 0);
  return { mesh, geometry, stream };
}
