// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ONE ATTEMPT OF A MAP'S SEARCH, built on a worker of its own
// (`attempt-pool.ts`): the seed's sub-seed for that attempt raised, laid out
// and checked (`GenerateOptions.only`), its progress posted as it goes, and
// the map handed back if the rule book passes it — or the refusal.

import { generateLevel, levelFor, loadRealFace, portableLevel, type GeneratedLevel } from "@engine";

import { faceOfOrder, type MapOrder } from "./map-order.ts";
import type { AttemptReply, AttemptRequest } from "./attempt-pool.ts";

const post = (reply: AttemptReply): void => (self as unknown as Worker).postMessage(reply);

/** A share is worth posting a hundredth at a time. */
const STEP = 0.01;

/** The map `order` names, its search held to the one attempt. */
function build(order: MapOrder, only: number, progress: (share: number) => void): GeneratedLevel {
  if ("generate" in order) return generateLevel(order.seed, { ...order.generate, only, progress });
  return levelFor({ seed: order.seed, ...order.game, only, progress }) as GeneratedLevel;
}

self.onmessage = async (e: MessageEvent<AttemptRequest>) => {
  const { order, attempt } = e.data;
  let told = 0;
  const progress = (share: number): void => {
    if (share < 1 && share - told < STEP) return;
    told = share;
    post({ kind: "progress", attempt, share });
  };
  try {
    const face = faceOfOrder(order);
    if (face) await loadRealFace(face);
    post({ kind: "built", attempt, level: portableLevel(build(order, attempt, progress)) });
  } catch (err) {
    post({ kind: "refused", attempt, why: err instanceof Error ? err.message : String(err) });
  }
};
