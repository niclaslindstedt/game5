// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START CARD'S CHARTS, KEPT between visits: every seed's pictures, its
// schematic and its runs (`PreviewPainted`) in IndexedDB, so a mountain the
// skier has looked at before is on the card the moment it is asked for,
// without the seconds of generating it again.
//
// A CHART IS ONLY EVER THE CHART OF THE BUILD THAT PAINTED IT. A map is a
// pure function of its seed under one generator version, and the pictures
// of the painter that drew them; so the store is named by the generator
// version, the app's version and the shape of what is kept (`STAMP`), and a
// chart from any other build is never read — a new release starts an empty
// store and deletes the old one.
//
// IT MUST NEVER BE LOAD-BEARING. A private window, a browser with storage
// switched off, a full quota: every call here resolves (to nothing where it
// could not), and the card simply builds the map as it always did.

import { CURRENT_GENERATOR_VERSION } from "@engine";

import { APP_SHORT_NAME } from "../identity.ts";

import type { PreviewPainted } from "./seed-preview-worker.ts";

/** Bumped whenever what is kept (`PreviewPainted`) changes shape. */
const FORMAT = 2;

/** What names this build's store. */
const STAMP = `${CURRENT_GENERATOR_VERSION}.${FORMAT}.${__APP_VERSION__}`;

const PREFIX = `${APP_SHORT_NAME.toLowerCase()}-charts`;
const DB = `${PREFIX}-${STAMP}`;
const STORE = "charts";

/** How many charts are kept: two small pictures and a few kilobytes each. */
const LIMIT = 80;

let opening: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (opening) return opening;
  opening = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") {
        resolve(null);
        return;
      }
      const ask = indexedDB.open(DB, 1);
      ask.onupgradeneeded = () => ask.result.createObjectStore(STORE);
      ask.onsuccess = () => {
        resolve(ask.result);
        sweep();
      };
      ask.onerror = () => resolve(null);
      ask.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

/** Every other build's store, deleted: it can never be read again. */
function sweep(): void {
  try {
    const list = (indexedDB as IDBFactory & { databases?: () => Promise<IDBDatabaseInfo[]> })
      .databases;
    if (!list) return;
    void list.call(indexedDB).then(
      (all) => {
        for (const d of all) {
          if (d.name && d.name.startsWith(PREFIX) && d.name !== DB)
            indexedDB.deleteDatabase(d.name);
        }
      },
      () => undefined,
    );
  } catch {
    // Nothing to tidy where it cannot be listed.
  }
}

type Kept = { chart: PreviewPainted; at: number };

/** The chart kept under `key`, or null. */
export async function readChart(key: string): Promise<PreviewPainted | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const ask = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      ask.onsuccess = () => {
        const kept = ask.result as Kept | undefined;
        resolve(kept && kept.chart && kept.chart.ok ? kept.chart : null);
      };
      ask.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Keep `chart` under `key` — its pictures as finished files, never raw
 * pixels — and let the oldest go past {@link LIMIT}. */
export async function writeChart(key: string, chart: PreviewPainted): Promise<void> {
  if (!(chart.picture instanceof Blob) || !(chart.panorama.picture instanceof Blob)) return;
  const db = await open();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.put({ chart, at: Date.now() } satisfies Kept, key);
    const all = store.getAll();
    const keys = store.getAllKeys();
    keys.onsuccess = () => {
      const rows = all.result as Kept[];
      if (rows.length <= LIMIT) return;
      const order = (keys.result as string[])
        .map((k, i) => ({ k, at: rows[i]?.at ?? 0 }))
        .sort((a, b) => a.at - b.at);
      for (const { k } of order.slice(0, rows.length - LIMIT)) store.delete(k);
    };
  } catch {
    // A full quota or a closed store: the chart is simply not kept.
  }
}
