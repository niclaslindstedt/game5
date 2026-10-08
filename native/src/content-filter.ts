// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEVICE'S CONTENT SETTING, the shell half — read once at launch and
// handed to the page before its first script (`contentFlag` in
// `./injected.ts`). What the game hides on that word is the website's
// (pwa/src/game/settings.ts's `injuriesShown`); the shell only reports it.
//
// iOS reports it through the native module. ANDROID HAS NO SUCH SIGNAL an
// app can read: there is no system "sensitive content" switch, and a child's
// supervised account is not visible to an app without enrolling in the
// store's age-signal service — so on Android, as in a browser, the game's own
// OPTIONS ▸ INJURIES switch is the whole answer.

import ContentFilter from "../modules/content-filter";
import type { ContentWord } from "./injected";

/** The device's word, or null where it says nothing (or cannot be read). */
export function deviceContent(): ContentWord | null {
  if (!ContentFilter) return null;
  try {
    const policy = ContentFilter.policy();
    return policy === "child" || policy === "filtered" ? policy : null;
  } catch {
    return null;
  }
}
