// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MOUNTAIN'S SHADOW, BAKED OFF THE MAIN THREAD. The horizon sweep
// (`terrain-shadow.ts`) is a million samples of the heightfield — tens of
// milliseconds on a desktop, a few times that on a phone — and a sky picked
// on a card asks for it again while the race behind the card is drawing. So
// it is baked here, the snow keeps its frame rate and the new shade lands
// when it lands. The map's horizons come back as a transferred buffer.

import type { Heightfield } from "@engine";

import { bakeHorizon, type HorizonMap } from "./terrain-shadow.ts";

export type ShadeRequest = { id: number; ground: Heightfield; bearing: number };
export type ShadeReply = { id: number; map: HorizonMap };

self.onmessage = (e: MessageEvent<ShadeRequest>) => {
  const { id, ground, bearing } = e.data;
  const map = bakeHorizon(ground, bearing);
  (self as unknown as Worker).postMessage({ id, map } satisfies ShadeReply, [map.data.buffer]);
};
