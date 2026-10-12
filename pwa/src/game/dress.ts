// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN OUTFIT, DRESSED: every piece of it cut onto one loom (`dress-loft.ts`)
// — the pants, the jacket over them and the feet in their liners
// (`dress-garments.ts`), the gloves, the helmet and the head
// (`dress-head.ts`) — into the two skinned meshes a skier is drawn in.
// Three-free, so the suite and the gear lab read the same triangles the
// game draws; `skier-dress.ts` makes them a figure. An outfit is cut once
// and kept: four skiers on a start line in the same kit share one cut —
// the last `KEPT` cuts asked for, so a DRESS card browsed through every
// colour (about a megabyte a cut) does not keep every one it stopped on.

import { cutClothes } from "./dress-garments.ts";
import { cutGloves, cutHead } from "./dress-head.ts";
import { createLoom, type DressMesh } from "./dress-loft.ts";
import { GEAR_SLOTS, type Outfit } from "./outfit.ts";

/** How many cuts are kept, the longest unasked let go first:
 * a start line, a night's enthusiasts and the card's stage fit in it. */
export const KEPT = 12;

const cut = new Map<string, DressMesh>();

/** A cache's entry under `key`, made by `make` if it is not kept: the
 * last `KEPT` asked for are kept, the longest unasked let go (a figure
 * drawn in one keeps its own reference — a cut is never written to). */
export function keptCut<T>(cache: Map<string, T>, key: string, make: () => T): T {
  const known = cache.get(key);
  if (known !== undefined) {
    cache.delete(key);
    cache.set(key, known);
    return known;
  }
  const made = make();
  cache.set(key, made);
  while (cache.size > KEPT) cache.delete(cache.keys().next().value!);
  return made;
}

/** The key an outfit (and a skin's tone) is kept under. */
export const outfitKey = (o: Outfit, tone?: number): string =>
  `${GEAR_SLOTS.map((s) => o[s]).join(".")}${o.suit ? ".suit" : ""}:${tone ?? ""}`;

/** THE SKIER IN AN OUTFIT, as the two meshes he is drawn in (shared: never
 * written to). */
export function dressOutfit(o: Outfit, tone?: number, bare = false): DressMesh {
  const key = `${outfitKey(o, tone)}${bare ? ":bare" : ""}`;
  return keptCut(cut, key, () => {
    const loom = createLoom();
    cutClothes(loom, o);
    cutGloves(loom, o);
    cutHead(loom, o, tone, bare);
    return loom.mesh();
  });
}
