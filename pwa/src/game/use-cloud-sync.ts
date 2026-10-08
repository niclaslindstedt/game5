// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// CLOUD SAVE, driven — when the game pulls, when it pushes, and what it does
// while neither has happened yet.
//
// The rules are the smallest set that keeps two devices honest, and every
// one of them is the same round trip — pull, merge, push the union back —
// so the cloud ends up holding both devices' work rather than whichever
// spoke last:
//
//   AT BOOT        a device that has been away comes back with the other's.
//   WHEN TOLD      the shell says another device wrote the store.
//   AFTER A WRITE  debounced. A write is the skier's settings, or
//                  a card coming up over a run — which is when the book and
//                  the tape of a finish have just been filed (`ghost-run.ts`
//                  writes them at the flag, outside render state).
//   ON THE WAY OUT the page going to the background, which on a phone is the
//                  last moment the game is sure to be running.
//
// A push that would upload what is already up is not sent.
//
// NEVER A BLOCKING WAIT. Every path degrades to "the game is device-local":
// a browser (no shell), a skier signed out of the cloud, a store that refused
// the write. The game is fully playable in all three, which is why none of
// them is an error the player has to dismiss.
//
// The merge lives in `./cloud-save.ts`, the transport in `../shell-host.ts`.
// This file owns only the WHEN.

import { useEffect, useRef } from "preact/hooks";

import { askShellCloud, onShellCloud, shellHost, type ShellCloudReply } from "../shell-host.ts";
import {
  applyCloudSave,
  carriedSettings,
  packSave,
  parseSave,
  saveSettingsStamp,
} from "./cloud-save.ts";
import type { RunBook } from "./ghost-run.ts";
import type { Settings } from "./settings.ts";
import type { Shell } from "./shell.ts";

/** How long after the last write the push goes up. Long enough to coalesce
 * a finish (book and tape together) and a skier who rides again. */
const PUSH_AFTER_MS = 4000;

/** How long an ask may go unanswered before the game stops waiting. A shell
 * that never answers is a shell without the module; nothing hangs on it. */
const ANSWER_WITHIN_MS = 8000;

let nextId = 0;

/** One round trip, resolved with the reply or null when nothing came back. */
function ask(action: "status" | "load" | "save", data = ""): Promise<ShellCloudReply | null> {
  return new Promise((resolve) => {
    const requestId = `cloud-${++nextId}`;
    let settled = false;
    const done = (reply: ShellCloudReply | null): void => {
      if (settled) return;
      settled = true;
      stop();
      clearTimeout(timer);
      resolve(reply);
    };
    const stop = onShellCloud((reply) => {
      if ("requestId" in reply && reply.requestId === requestId) done(reply);
    });
    const timer = setTimeout(() => done(null), ANSWER_WITHIN_MS);
    askShellCloud(action === "save" ? { action, requestId, data } : { action, requestId });
  });
}

/** What the app hands the hook: what it holds, and how to take a merge up. */
export type CloudSyncApp = {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  book: { current: Pick<RunBook, "reload"> | null };
  shell: Shell;
};

/** Keep this device's book, tapes and the skier's settings in step
 * with the skier's other devices. A no-op anywhere but the store app. */
export function useCloudSync(app: CloudSyncApp): void {
  const native = shellHost() === "native";
  const latest = useRef(app);
  latest.current = app;
  /** The skier's half of the settings as last seen, to tell a row the skier
   * moved from one a merge brought in. */
  const carried = useRef<string | null>(null);
  const lastPushed = useRef<string | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);

  const reconcile = useRef(async (): Promise<void> => {
    const status = await ask("status");
    if (!status || status.event !== "status" || !status.ok || !status.available) return;
    const loaded = await ask("load");
    const remote = loaded?.event === "load" && loaded.ok ? parseSave(loaded.data) : null;
    const now = latest.current;
    const applied = applyCloudSave(remote, now.settings);
    if (applied.records) now.book.current?.reload();
    if (applied.settings) {
      carried.current = JSON.stringify(carriedSettings(applied.settings));
      now.setSettings(applied.settings);
    }
    const text = packSave(applied.save);
    if (text === lastPushed.current && remote !== null) return;
    const wrote = await ask("save", text);
    if (wrote?.event === "save" && wrote.ok) lastPushed.current = text;
  });

  /** One round trip at a time; an ask during one runs once more after it. */
  const sync = useRef((): void => {
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = reconcile
      .current()
      .catch(() => {})
      .finally(() => {
        running.current = null;
        if (again.current) {
          again.current = false;
          sync.current();
        }
      });
  });

  // THE SKIER MOVED A ROW. Stamped so the change wins on the other devices;
  // the first sight of the settings is not a change, and neither is a merge
  // (which sets `carried` before it hands the settings over).
  useEffect(() => {
    if (!native) return;
    const text = JSON.stringify(carriedSettings(app.settings));
    if (carried.current !== null && carried.current !== text) saveSettingsStamp(Date.now());
    carried.current = text;
  }, [native, app.settings]);

  // BOOT, WHEN TOLD, AND ON THE WAY OUT.
  useEffect(() => {
    if (!native) return;
    sync.current();
    const stop = onShellCloud((reply) => {
      if (reply.event === "changed") sync.current();
    });
    const away = (): void => {
      if (document.visibilityState === "hidden") sync.current();
    };
    document.addEventListener("visibilitychange", away);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", away);
    };
  }, [native]);

  // AFTER A WRITE, debounced. The first render is not one: boot pulls above.
  const first = useRef(true);
  useEffect(() => {
    if (!native) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => sync.current(), PUSH_AFTER_MS);
    return () => clearTimeout(timer);
  }, [native, app.settings, app.shell]);
}
