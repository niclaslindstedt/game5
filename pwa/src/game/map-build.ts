// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A MAP BUILT FOR THE LOADING CARD on its own worker (`map-worker.ts`), and
// what the card reads of it while it builds: how far it has got, and the
// map once it is there.
//
// One worker a map, ended the moment its answer is in: the ski area it
// raised to get there is tens of megabytes the page has its own copy of
// now, and the next load is a different map more often than not. A map
// this thread can already stand up in milliseconds — off the ski area it
// built last (`levelIsCached`) — is never sent: it is built here, at once.

import { boundLevel, generateLevel, levelFor, levelIsCached, type Level } from "@engine";

import type { MapJob, MapOrder, MapWorkerReply } from "./map-order.ts";

export { gameOrder } from "./map-order.ts";

/** Whether this thread would stand the map up off the ski area it built
 * last — a park's map is never a ski area's. */
function cachedHere(order: MapOrder): boolean {
  if ("generate" in order) return levelIsCached(order.seed, order.generate);
  if (order.game.mode === "tricks") return false;
  return levelIsCached(order.seed, { region: order.game.region });
}

/** A job already answered. */
function settled(level: Level | undefined, failed: string | null): MapJob {
  return {
    share: () => 1,
    level: () => level,
    failed: () => failed,
    cancel: () => {},
  };
}

/** Build the map `order` names: here where it costs nothing, on a worker
 * where it costs seconds. */
export function buildMap(order: MapOrder): MapJob {
  if (cachedHere(order) || typeof Worker === "undefined") {
    try {
      const level =
        "generate" in order
          ? generateLevel(order.seed, order.generate)
          : levelFor({ seed: order.seed, ...order.game });
      return settled(level, null);
    } catch (e) {
      return settled(undefined, e instanceof Error ? e.message : String(e));
    }
  }
  let share = 0;
  let level: Level | undefined;
  let failed: string | null = null;
  const worker = new Worker(new URL("./map-worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e: MessageEvent<MapWorkerReply>) => {
    const reply = e.data;
    if (reply.kind === "progress") {
      share = Math.max(share, reply.share);
      return;
    }
    if (reply.kind === "built") {
      share = 1;
      level = boundLevel(reply.level);
    } else failed = reply.error;
    worker.terminate();
  };
  worker.onerror = (e) => {
    failed = e.message || "the map could not be built";
    worker.terminate();
  };
  worker.postMessage(order);
  return {
    share: () => share,
    level: () => level,
    failed: () => failed,
    cancel: () => worker.terminate(),
  };
}
