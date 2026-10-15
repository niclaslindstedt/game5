// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A MAP BUILT BY SEVERAL WORKERS AT ONCE — its search's attempts raised side
// by side, one attempt a worker (`attempt-worker.ts`), and the lowest one
// the rule book passes kept (`attempt-race.ts`): the very map the search
// builds in turn, in about the time of one attempt rather than of every
// attempt refused before it. Most seeds are refused a few times, each
// refusal seconds of work, so a seed accepted on its seventh attempt is
// stood up in a fifth of the time on a machine with the cores for it.
//
// BEHIND DEVELOPER (`parallelMaps`) while it is tried on real phones: each
// worker holds a whole ski area's grids, and a tab on a phone has little
// heap to spare.

import { attemptsOf, boundLevel, type Level, type PortableLevel } from "@engine";

import { createAttemptRace, poolWidth } from "./attempt-race.ts";
import { faceOfOrder, type MapJob, type MapOrder } from "./map-order.ts";

/** What an attempt's worker is asked. */
export type AttemptRequest = { order: MapOrder; attempt: number };

/** What it posts back. */
export type AttemptReply =
  | { kind: "progress"; attempt: number; share: number }
  | { kind: "built"; attempt: number; level: PortableLevel }
  | { kind: "refused"; attempt: number; why: string };

let pooled = false;

/** Whether maps are built on the pool — DEVELOPER's switch, set by the app
 * as the setting moves. */
export function setAttemptPool(on: boolean): void {
  pooled = on;
}

/** Whether `order`'s map is to be built on the pool. */
export function poolOn(): boolean {
  return pooled && typeof Worker !== "undefined";
}

/** The attempts the search of `order`'s map may try. */
function attemptsFor(order: MapOrder): number {
  const opts = "generate" in order ? order.generate : { face: faceOfOrder(order) };
  return attemptsOf(opts);
}

/** Build `order`'s map on a pool of attempt workers; `changed` is told
 * whenever its share moves or it is decided. A worker refused is handed the
 * next attempt rather than ended — a fresh one pays its warm-up again, a
 * second or two — and one whose attempt can no longer win is ended. */
export function buildPooled(order: MapOrder, changed: () => void = () => {}): MapJob {
  const total = attemptsFor(order);
  const race = createAttemptRace(total);
  const width = poolWidth(navigator.hardwareConcurrency);
  /** Each worker by the attempt it is on. */
  const workers = new Map<number, Worker>();
  const built = new Map<number, PortableLevel>();
  const reasons: string[] = [];
  let share = 0;
  let level: Level | undefined;
  let failed: string | null = null;
  let over = false;

  const endAll = (): void => {
    over = true;
    for (const w of workers.values()) w.terminate();
    workers.clear();
    built.clear();
  };

  /** Set `w` on the next attempt, or end it where none is worth starting. */
  const give = (w: Worker): void => {
    const a = over ? null : race.next();
    if (a === null) {
      w.terminate();
      return;
    }
    workers.set(a, w);
    const ask: AttemptRequest = { order, attempt: a };
    w.postMessage(ask);
  };

  const hire = (): void => {
    const w = new Worker(new URL("./attempt-worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<AttemptReply>) => answer(w, e.data);
    w.onerror = (e) => {
      const a = [...workers].find(([, v]) => v === w)?.[0];
      w.terminate();
      if (a !== undefined) {
        workers.delete(a);
        answer(null, { kind: "refused", attempt: a, why: e.message || "the worker failed" });
      }
    };
    give(w);
  };

  const answer = (w: Worker | null, reply: AttemptReply): void => {
    if (over) return;
    const a = reply.attempt;
    if (reply.kind === "progress") {
      // The bar follows the furthest attempt, held short of full until one
      // is kept.
      share = Math.max(share, Math.min(0.97, reply.share));
      changed();
      return;
    }
    workers.delete(a);
    if (reply.kind === "built") built.set(a, reply.level);
    else reasons.push(`#${a}: ${reply.why}`);
    const verdict = race.settle(a, reply.kind === "built");
    for (const m of race.moot()) {
      workers.get(m)?.terminate();
      workers.delete(m);
    }
    if (verdict.kind === "won") {
      const won = built.get(verdict.attempt);
      w?.terminate();
      endAll();
      if (won) level = boundLevel(won);
      share = 1;
      changed();
      return;
    }
    if (verdict.kind === "lost") {
      w?.terminate();
      failed = `no clean map in ${total} attempts — ${reasons.join("; ")}`;
      endAll();
      changed();
      return;
    }
    if (w) give(w);
    else if (workers.size < width) hire();
  };

  for (let i = 0; i < width; i++) hire();
  return {
    share: () => share,
    level: () => level,
    failed: () => failed,
    cancel: endAll,
  };
}
