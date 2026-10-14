// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HIS CLOTHES SOAKED RED — for `gore-view.ts`: a cloth's own colours kept
// before any blood, painted near black-red round every wound and every
// run of blood down inside them (`gore-leaks.ts`'s `soakPath`), and given
// back clean on a new run.

import type * as THREE from "three";

type V3 = { x: number; y: number; z: number };
type Rgb = readonly [number, number, number];

/** Blood soaked into cloth: near black-red where it is soaked through. */
const SOAKED: Rgb = [0.11, 0.004, 0.004];

/** A CLOTH'S OWN COLOURS, before anything stains it — copied the first time
 * anything paints it, and shared by everything that does (the blood here,
 * the char of a body burnt, `burn-view.ts`), so whichever paints it first,
 * every one of them gives it back clean. */
const CLEAN = new WeakMap<THREE.BufferGeometry, Float32Array>();
export function cleanColours(g: THREE.BufferGeometry): Float32Array {
  let orig = CLEAN.get(g);
  if (!orig) {
    const col = g.getAttribute("color") as THREE.BufferAttribute;
    orig = Float32Array.from(col.array as Float32Array);
    CLEAN.set(g, orig);
  }
  return orig;
}

export type Soak = {
  /** Soak cloth `g` red round the wounds `at` (the bind pose's frame), each
   * reaching `r`, as wet as `wet` (0 … 1); `force` keeps its colours even
   * with no wound yet; `blood` the colour soaked to (linear RGB), near
   * black-red in cloth unless asked. */
  cloth(
    g: THREE.BufferGeometry,
    wounds: { at: V3; r: number; blood?: Rgb }[],
    wet: number,
    force?: boolean,
  ): void;
  /** Every cloth soaked given back its own colours. */
  clear(): void;
};

export function createSoak(): Soak {
  const soaked = new Set<THREE.BufferGeometry>();
  function cloth(
    g: THREE.BufferGeometry,
    wounds: { at: V3; r: number; blood?: Rgb }[],
    wet: number,
    force = false,
  ) {
    const col = g.getAttribute("color") as THREE.BufferAttribute;
    const orig = cleanColours(g);
    if (!force && wounds.length === 0) return;
    soaked.add(g);
    const pos = g.getAttribute("position");
    const arr = col.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      let k = 0;
      let b = SOAKED;
      for (const w of wounds) {
        const d = Math.hypot(x - w.at.x, y - w.at.y, z - w.at.z);
        // A ragged edge: the soak's reach wanders round the wound.
        const reach = w.r * (0.8 + 0.4 * Math.sin(x * 41 + z * 37 + y * 23));
        const kw = Math.min(1, ((reach - d) / (0.35 * reach)) * wet);
        if (kw > k) {
          k = kw;
          b = w.blood ?? SOAKED;
        }
      }
      k = Math.max(0, k);
      arr[3 * i] = orig[3 * i] + (b[0] - orig[3 * i]) * k;
      arr[3 * i + 1] = orig[3 * i + 1] + (b[1] - orig[3 * i + 1]) * k;
      arr[3 * i + 2] = orig[3 * i + 2] + (b[2] - orig[3 * i + 2]) * k;
    }
    col.needsUpdate = true;
  }

  const clear = () => {
    for (const g of soaked) {
      const orig = cleanColours(g);
      const col = g.getAttribute("color") as THREE.BufferAttribute;
      (col.array as Float32Array).set(orig);
      col.needsUpdate = true;
    }
    soaked.clear();
  };

  return { cloth, clear };
}
