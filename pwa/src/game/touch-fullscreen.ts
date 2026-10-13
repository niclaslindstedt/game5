// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WHOLE SCREEN ON A PHONE: a browser tab on a touchscreen is asked for
// fullscreen on the first touch, so the cards and the snow get the strip the
// address bar and the system bars keep for themselves. A touch is the
// gesture the Fullscreen API wants, and the first one is the one every
// visit makes.
//
// Asked ONCE a page: a player who leaves fullscreen has chosen the bars,
// and is not taken back at the next touch. Never in a shell (`shell-host.ts`
// — both windows are their own fullscreen) nor in an installed app, which
// is already as wide as it gets; and where the browser has no fullscreen
// for a page (a phone's own browser on some platforms), nothing at all.

import { shellHost } from "../shell-host.ts";

type Full = { requestFullscreen?: (o?: FullscreenOptions) => Promise<void> };

export function fullscreenOnTouch(): void {
  if (typeof document === "undefined" || shellHost() !== null) return;
  if (!document.fullscreenEnabled) return;
  if (matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches) return;
  const root = document.documentElement as Full;
  if (typeof root.requestFullscreen !== "function") return;
  const ask = (e: PointerEvent): void => {
    if (e.pointerType !== "touch") return;
    window.removeEventListener("pointerup", ask, true);
    if (document.fullscreenElement) return;
    root.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {});
  };
  window.addEventListener("pointerup", ask, true);
}
