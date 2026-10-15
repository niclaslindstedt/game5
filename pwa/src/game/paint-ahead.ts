// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MAP-FREE TEXTURES, PAINTED ONCE A PAGE AND KEPT (`paint-jobs.ts`).
// `paintAhead` has them painted on a worker (`paint-worker.ts`) the first
// time it is asked — the world's renderer asks as it is made, and waits on
// it before its first buildings — and `painted` hands one over, painting it
// here only where the worker has not (no worker, or it failed). Kept for the
// page's life, so a new map never repaints them.

import { PAINTS, type PaintName, type Painted } from "./paint-jobs.ts";

const kept: Partial<Painted> = {};
let ready: Promise<void> | null = null;
/** The longest the worker is waited on before painting here instead, ms. */
const WAIT_MOST_MS = 20000;

/** Have every texture painted off the main thread; resolves once they are
 * (or the worker cannot, and `painted` paints them here). */
export function paintAhead(): Promise<void> {
  if (ready) return ready;
  if (typeof Worker === "undefined") return (ready = Promise.resolve());
  ready = new Promise<void>((done) => {
    const names = (Object.keys(PAINTS) as PaintName[]).filter((n) => !(n in kept));
    let worker: Worker;
    try {
      worker = new Worker(new URL("./paint-worker.ts", import.meta.url), { type: "module" });
    } catch {
      done();
      return;
    }
    let left = names.length;
    const finish = (): void => {
      clearTimeout(timer);
      worker.terminate();
      done();
    };
    const timer = setTimeout(finish, WAIT_MOST_MS);
    worker.onmessage = (e: MessageEvent<{ name: PaintName; value: Painted[PaintName] }>) => {
      const { name, value } = e.data;
      if (!(name in kept)) (kept as Record<PaintName, unknown>)[name] = value;
      if (--left === 0) finish();
    };
    worker.onerror = finish;
    worker.postMessage(names);
  });
  return ready;
}

/** The texture `name`, as the worker painted it — or painted here now. */
export function painted<K extends PaintName>(name: K): Painted[K] {
  const had = kept[name];
  if (had) return had;
  const value = PAINTS[name]();
  kept[name] = value;
  return value;
}
