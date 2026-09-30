// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE UPDATE WATCH, as the hook the new-build button reads. The watch itself
// — registering the worker `pwa-plugin.ts` emits, polling for a newer build,
// the hand-over — is the framework's (`pwaUpdateWatch`, an external store);
// this is only the Preact window onto it.

import { useSyncExternalStore } from "preact/compat";

import {
  pwaUpdateWatch,
  type PwaUpdate,
  type PwaUpdateConfig,
} from "@niclaslindstedt/oss-game-framework/pwa/pwa-update";

/**
 * Subscribe to the update watch. The first call fixes the configuration for
 * the page — later callers get the same watch whatever they pass.
 */
export function usePwaUpdate(config: PwaUpdateConfig): PwaUpdate {
  const watch = pwaUpdateWatch(config);
  const state = useSyncExternalStore(watch.subscribe, watch.getSnapshot);
  return { ...state, reload: watch.reload };
}
