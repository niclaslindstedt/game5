// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { render } from "preact";

import "./styles.css";
import "./campaign.css";
import "./dev.css";
import "./body.css";
import "./heli.css";
import { App } from "./App.tsx";
import { watchVisibleViewport } from "@niclaslindstedt/oss-game-framework/display/visible-viewport";

// In dev no worker registers (`usePwaUpdate` runs disabled), but a worker
// installed by a previous `vite preview` on this origin would keep serving
// stale bytes — unregister any so the dev server always wins. The production
// registration is owned by `lib/pwa-update.ts`, against the worker
// `pwa-plugin.ts` emits.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((reg) => void reg.unregister()));
}

// Before the first render, so the shell's very first layout is already over
// the part of the screen the browser is showing rather than corrected a frame
// into the session. It runs for the life of the page and is never stopped.
watchVisibleViewport();

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

render(<App />, root);
