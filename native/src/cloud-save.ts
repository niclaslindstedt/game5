// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// CLOUD SAVE, the shell half — the transport between the page and the
// platform's cloud, and nothing else.
//
// WHAT IS SAVED AND HOW TWO DEVICES RECONCILE IS THE WEBSITE'S
// (pwa/src/game/cloud-save.ts: best per row, furthest progress, the later
// settings). The shell moves an opaque string in and out of iCloud key-value
// storage and reports what happened. That split is the point: a second
// platform is a new module behind the same messages (`./cloud-ask.ts`), with
// no change to the game.
//
// An unavailable cloud is not an error: a skier signed out of iCloud, an
// Android phone, or a build without the module all play a device-local game,
// and the page is told so once rather than being left to time out.

import CloudSave from "../modules/cloud-save";
import { cloudReply, type CloudAsk } from "./cloud-ask";

/** The one key the save lives under inside the store. Changing it after
 * release orphans every skier's save, so it is spelled out once. */
const SAVE_KEY = "fall-line-save";

/** Serve one ask, and hand back the reply to inject. Never throws: a cloud
 * that refused is an answer, not a crash. */
export async function serveCloudAsk(ask: CloudAsk): Promise<string> {
  const { requestId } = ask;
  if (!CloudSave) {
    // A build without the native module — Android, Expo Go, or a shell built
    // with EXPO_PUBLIC_CLOUD_SAVE=off. The game stays device-local.
    return cloudReply({ event: ask.action, requestId, ok: false, available: false, data: null });
  }
  try {
    if (ask.action === "status") {
      return cloudReply({
        event: "status",
        requestId,
        ok: true,
        available: CloudSave.isAvailable(),
      });
    }
    if (ask.action === "load") {
      const data = await CloudSave.getItem(SAVE_KEY);
      return cloudReply({ event: "load", requestId, ok: true, data });
    }
    const wrote = await CloudSave.setItem(SAVE_KEY, ask.data);
    // `false` is the store refusing the write — over quota, most likely.
    return cloudReply({
      event: "save",
      requestId,
      ok: wrote,
      ...(wrote ? {} : { reason: "the iCloud store refused the write" }),
    });
  } catch (error) {
    return cloudReply({
      event: ask.action,
      requestId,
      ok: false,
      data: null,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Hear the store change underneath us. Returns a hand-back; a build with no
 * native module subscribes to nothing and hands back a no-op. */
export function onCloudChange(told: () => void): () => void {
  if (!CloudSave) return () => {};
  const subscription = CloudSave.addListener("onCloudChange", told);
  return () => subscription.remove();
}
