// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LOADING CARD'S WORKER — one map generated off the thread the card is
// drawn on, and the generator's word on how far it has got posted back as
// it goes (`GenerateOptions.progress`).
//
// Generating a map is one call of seconds — up to half a minute on a seed
// that is refused a few times — and on the page's own thread nothing can be
// drawn while it runs: a bar fed from inside the call would only ever be
// seen empty and then full. Here the call runs whole and the page keeps
// drawing, so the bar under the card moves as the search does. The map
// comes back as plain data (`portableLevel`) and the page binds it
// (`map-build.ts`).

import { generateLevel, levelFor, portableLevel, type GeneratedLevel } from "@engine";

import type { MapOrder, MapWorkerReply } from "./map-order.ts";

const post = (reply: MapWorkerReply): void => (self as unknown as Worker).postMessage(reply);

/** How often a share is worth posting: the generator's landmarks come a few
 * a second at most, so this only keeps two landmarks in one step quiet. */
const STEP = 0.005;

self.onmessage = (e: MessageEvent<MapOrder>) => {
  const order = e.data;
  let told = 0;
  const progress = (share: number): void => {
    if (share < 1 && share - told < STEP) return;
    told = share;
    post({ kind: "progress", share });
  };
  try {
    const level =
      "generate" in order
        ? generateLevel(order.seed, { ...order.generate, progress })
        : levelFor({ seed: order.seed, ...order.game, progress });
    post({ kind: "built", level: portableLevel(level as GeneratedLevel) });
  } catch (err) {
    post({ kind: "failed", error: err instanceof Error ? err.message : String(err) });
  }
};
