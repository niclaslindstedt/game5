// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HIS CLOTHES SOAKED RED — for `gore-view.ts`: a cloth's own colours kept
// before any blood, painted near black-red round every wound and every
// run of blood down inside them (`gore-leaks.ts`'s `soakPath`), and given
// back clean on a new run.

import type * as THREE from "three";

type V3 = { x: number; y: number; z: number };

export type Soak = {
  /** Soak cloth `g` red round the wounds `at` (the bind pose's frame), each
   * reaching `r`, as wet as `wet` (0 … 1); `force` keeps its colours even
   * with no wound yet. */
  cloth(
    g: THREE.BufferGeometry,
    wounds: { at: V3; r: number }[],
    wet: number,
    force?: boolean,
  ): void;
  /** Every cloth soaked given back its own colours. */
  clear(): void;
};

export function createSoak(): Soak {
  /** His clothes' own colours, before any blood: a copy a cloth. */
  const clean = new WeakMap<THREE.BufferGeometry, Float32Array>();
  const soaked = new Set<THREE.BufferGeometry>();
  function cloth(
    g: THREE.BufferGeometry,
    wounds: { at: V3; r: number }[],
    wet: number,
    force = false,
  ) {
    const col = g.getAttribute("color") as THREE.BufferAttribute;
    let orig = clean.get(g);
    if (!orig) {
      orig = Float32Array.from(col.array as Float32Array);
      clean.set(g, orig);
    }
    if (!force && wounds.length === 0) return;
    soaked.add(g);
    const pos = g.getAttribute("position");
    const arr = col.array as Float32Array;
    // Blood soaked into cloth: near black-red where it is soaked through.
    const br = 0.11;
    const bg = 0.004;
    const bb = 0.004;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      let k = 0;
      for (const w of wounds) {
        const d = Math.hypot(x - w.at.x, y - w.at.y, z - w.at.z);
        // A ragged edge: the soak's reach wanders round the wound.
        const reach = w.r * (0.8 + 0.4 * Math.sin(x * 41 + z * 37 + y * 23));
        k = Math.max(k, Math.min(1, ((reach - d) / (0.35 * reach)) * wet));
      }
      k = Math.max(0, k);
      arr[3 * i] = orig[3 * i] + (br - orig[3 * i]) * k;
      arr[3 * i + 1] = orig[3 * i + 1] + (bg - orig[3 * i + 1]) * k;
      arr[3 * i + 2] = orig[3 * i + 2] + (bb - orig[3 * i + 2]) * k;
    }
    col.needsUpdate = true;
  }

  const clear = () => {
    for (const g of soaked) {
      const orig = clean.get(g);
      const col = g.getAttribute("color") as THREE.BufferAttribute;
      if (orig) {
        (col.array as Float32Array).set(orig);
        col.needsUpdate = true;
      }
    }
    soaked.clear();
  };

  return { cloth, clear };
}
