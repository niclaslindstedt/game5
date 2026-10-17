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
//
// A MAP CAN BE ORDERED AHEAD (`buildAhead`): the level card and the trick
// map card know which map RIDE will stand up, so its worker starts on it
// while the player picks the map, the body, the kit and the pair, and the
// loading card's own order for the same map takes that job over rather
// than starting it again. One is held at a time; another order, or none,
// lets it go.

import {
  boundLevel,
  generateLevel,
  levelFor,
  levelIsCached,
  realFaceLoaded,
  type Level,
  type MapWork,
} from "@engine";

import { buildPooled, poolOn } from "./attempt-pool.ts";
import { faceOfOrder, type MapJob, type MapOrder, type MapWorkerReply } from "./map-order.ts";

export { gameOrder } from "./map-order.ts";

/** Whether this thread would stand the map up off the ski area it built
 * last — a park's map is never a ski area's. */
function cachedHere(order: MapOrder): boolean {
  const face = faceOfOrder(order);
  if (face && !realFaceLoaded(face)) return false;
  if ("generate" in order) return levelIsCached(order.seed, order.generate);
  if (order.game.mode === "tricks") return false;
  return levelIsCached(order.seed, { region: order.game.region, face: order.game.face });
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

/** The map ordered ahead of its load, if any. */
let ahead: { key: string; job: MapJob } | null = null;
/** The maps LET GO, each kept a moment before it is stopped: the press
 * that starts a load is also what takes the cards that ordered it down, and
 * those cards let the order go — or order the next one — in the same breath
 * the load asks for it. */
const parked = new Map<string, { job: MapJob; until: ReturnType<typeof setTimeout> }>();
/** How long a map let go is kept for a load to take, ms. */
const PARKED_MS = 3000;
const keyOf = (order: MapOrder): string => JSON.stringify(order);

/** Take `key`'s parked map back, if any, without stopping it. */
function unpark(key: string | null): MapJob | undefined {
  const held = key === null ? undefined : parked.get(key);
  if (!held) return undefined;
  clearTimeout(held.until);
  parked.delete(key!);
  return held.job;
}

/** Keep `key`'s map a moment, then stop it unless it was taken back. */
function park(key: string, job: MapJob): void {
  unpark(key)?.cancel();
  const until = setTimeout(() => {
    parked.delete(key);
    job.cancel();
  }, PARKED_MS);
  parked.set(key, { job, until });
}

/** Start building `order`'s map ahead of the load that will ask for it — or,
 * with null, let the one held go. Asked again for the same map, it keeps
 * the job it has. A map this thread already holds is never ordered. */
export function buildAhead(order: MapOrder | null): void {
  const key = order === null || cachedHere(order) ? null : keyOf(order);
  if (ahead?.key === key) return;
  if (ahead) park(ahead.key, ahead.job);
  // Asked for again while parked: taken back rather than begun again.
  const back = unpark(key);
  ahead = back
    ? { key: key!, job: back }
    : order && key !== null && typeof Worker !== "undefined"
      ? { key, job: onWorker(order) }
      : null;
}

/** The map ordered ahead, once it is built, where it is `seed`'s. */
export function aheadLevel(seed: number): Level | null {
  const level = ahead?.job.level();
  return level && level.seed === seed ? level : null;
}

/** Build the map `order` names: here where it costs nothing, on a worker
 * where it costs seconds — or the job ordered ahead for it. */
export function buildMap(order: MapOrder): MapJob {
  const held = ahead;
  if (held && held.key === keyOf(order) && !held.job.failed()) {
    ahead = null;
    return held.job;
  }
  const back = unpark(keyOf(order));
  if (back && !back.failed()) return back;
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
  return onWorker(order);
}

/** A worker of its own building `order`'s map — or, under DEVELOPER, a
 * pool of them, one attempt each (`attempt-pool.ts`). */
function onWorker(order: MapOrder): MapJob {
  if (poolOn()) return buildPooled(order);
  let share = 0;
  let work: MapWork | null = null;
  let level: Level | undefined;
  let failed: string | null = null;
  const worker = new Worker(new URL("./map-worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e: MessageEvent<MapWorkerReply>) => {
    const reply = e.data;
    if (reply.kind === "progress") {
      share = Math.max(share, reply.share);
      work = reply.work ?? work;
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
    work: () => work,
    level: () => level,
    failed: () => failed,
    cancel: () => worker.terminate(),
  };
}
