// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN OUTFIT, DRESSED: every piece of it cut onto one loom (`dress-loft.ts`)
// — the pants, the jacket over them and the feet in their liners
// (`dress-garments.ts`), the gloves, the helmet and the head
// (`dress-head.ts`) — into the two skinned meshes a skier is drawn in.
// Three-free, so the suite and the gear lab read the same triangles the
// game draws; `skier-dress.ts` makes them a figure. An outfit is cut once
// and kept: four skiers on a start line in the same kit share one cut.

import { cutClothes } from "./dress-garments.ts";
import { cutGloves, cutHead } from "./dress-head.ts";
import { createLoom, type DressMesh } from "./dress-loft.ts";
import { GEAR_SLOTS, type Outfit } from "./outfit.ts";

const cut = new Map<string, DressMesh>();

/** The key an outfit (and a skin's tone) is kept under. */
export const outfitKey = (o: Outfit, tone?: number): string =>
  `${GEAR_SLOTS.map((s) => o[s]).join(".")}:${tone ?? ""}`;

/** THE SKIER IN AN OUTFIT, as the two meshes he is drawn in (shared: never
 * written to). */
export function dressOutfit(o: Outfit, tone?: number): DressMesh {
  const key = outfitKey(o, tone);
  const known = cut.get(key);
  if (known) return known;
  const loom = createLoom();
  cutClothes(loom, o);
  cutGloves(loom, o);
  cutHead(loom, o, tone);
  const mesh = loom.mesh();
  cut.set(key, mesh);
  return mesh;
}
