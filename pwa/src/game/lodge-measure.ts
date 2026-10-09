// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AFTERSKI LODGE'S TERRACE AS MEASURED — the numbers the lodge's
// builder (`lodge-shapes.ts`), its yard (`lodge-yard.ts`) and the people on
// it (`civilian-spots.ts`) all read, stated once and three-free so the plan
// of who stands where is tested without a renderer.
//
// THE FRAME is the building's (`cabin-shapes.ts`): x across its front, y up
// from its floor, z toward its front; the deck runs from the front wall
// (`CABINS.afterski.depth / 2`) out `TERRACE` m.

import { TERRACES } from "@engine";

/** The terrace as the engine measures it — and rings with its rail
 * (`TERRACES`, `building-walls.ts`). */
const T = TERRACES.afterski!;
/** The deck: its top under the floor, m, and how thick it is. */
export const DECK = { top: T.deck, thick: 0.2 };
/** How far the deck stands out past the walls, m — the terrace's front,
 * a little short of the roof's reach the placer kept clear. */
export const TERRACE = T.out;
/** Half the gap in the front railing the steps come up through, m. */
export const GAP = T.gap;
/** How far the deck runs past the walls at either end, m. */
export const DECK_END = T.end;
/** THE TRESTLE TABLES on the deck: their middles across the front (`x`)
 * and out from the wall (`z`, past the wall's face), m; each is `half`
 * m either way along x and `top` m wide, at `height` over the deck, with a
 * bench `bench` m either side of its middle, `seat` m high. */
export const TERRACE_TABLES = {
  x: [-5.2, -2.7, 2.7, 5.2] as readonly number[],
  z: [2.2, 4.7] as readonly number[],
  half: 1.0,
  top: 0.4,
  height: 0.76,
  bench: 0.75,
  seat: 0.47,
} as const;
