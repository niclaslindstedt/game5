// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// CLOUD SAVE's MESSAGES — what the page may ask the shell over the message
// channel, and the script that carries an answer back. Import-free on
// purpose: it is one of the SEAM modules the root suite holds against the
// page (`tests/imports_test.ts`'s `SHELL_SEAM`, `tests/shell_test.ts`), and a
// module that imported the native side could not be read there.
//
// The protocol is `SHELL_CLOUD` / `SHELL_CLOUD_EVENT` in
// `pwa/src/shell-host.ts`, and the listener that posts an ask is
// `CLOUD_BRIDGE` in `./injected.ts` — change one, change all three.
//
//   page → shell   { sh: "cloud", action: "status" | "load" | "save", … }
//   shell → page   a `sh-shell-cloud-event` CustomEvent, dispatched by the
//                  script `cloudReply` builds, through `injectJavaScript`

/** What the page asked for. Anything else on the channel is not ours. */
export type CloudAsk =
  | { action: "status"; requestId: string }
  | { action: "load"; requestId: string }
  | { action: "save"; requestId: string; data: string };

/** Read one message off the channel, or null when it is not a cloud ask.
 * Deliberately strict: the page can post whatever it likes, and none of it
 * may reach the cloud by accident. */
export function parseCloudAsk(raw: string): CloudAsk | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const m = parsed as Record<string, unknown>;
  if (m.sh !== "cloud" || typeof m.requestId !== "string") return null;
  if (m.action === "status" || m.action === "load") {
    return { action: m.action, requestId: m.requestId };
  }
  if (m.action === "save" && typeof m.data === "string") {
    return { action: "save", requestId: m.requestId, data: m.data };
  }
  return null;
}

/** The JavaScript that hands one answer back to the page. Must evaluate to a
 * primitive — iOS aborts an injected script that does not. */
export function cloudReply(reply: Record<string, unknown>): string {
  return `(function () {
  try {
    window.dispatchEvent(
      new CustomEvent("sh-shell-cloud-event", { detail: ${JSON.stringify(reply)} }),
    );
  } catch (e) {}
  true;
})();`;
}

/** Tell the page another device wrote the store, so it pulls and merges. */
export function cloudChanged(): string {
  return cloudReply({ event: "changed" });
}
