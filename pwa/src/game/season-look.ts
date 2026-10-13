// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEASON THE WORLD IS DRAWN IN: winter, or a summer's run (`summer.ts`
// in the engine). Set once as a map loads, before anything of it is built,
// and read by what sheds its snow in summer — the trees' paint (`forest.ts`)
// and the buildings' snow layer, held by reference as a uniform
// (`facade-material.ts`) — so no builder is handed the season by hand.

import type * as THREE from "three";

/** 0 in winter, 1 in summer — one object every material holds. */
export const SUMMER_UNIFORM: THREE.IUniform<number> = { value: 0 };

let shown = false;

/** Set the season the next map is drawn in; returns `on`. */
export function setSummerLook(on: boolean): boolean {
  shown = on;
  SUMMER_UNIFORM.value = on ? 1 : 0;
  return on;
}

/** Whether the map being built is drawn in summer. */
export function summerShown(): boolean {
  return shown;
}
