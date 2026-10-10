// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { render } from "preact";

// The cards first: a page's own block in styles.css overrides the base card.
import "./menu.css";
import "./menu-pages.css";
import "./styles.css";
import "./maps.css";
import "./dev.css";
import "./body.css";
import "./wreck.css";
import "./heli.css";
import "./sled.css";
import "./afterski.css";
import "./para.css";
import "./balloon.css";
import "./stats.css";
import "./replay.css";
import "./title.css";
import { loadRealFace } from "@engine";
import { App } from "./App.tsx";
import { guardAgainstLoupe } from "./game/no-loupe.ts";
import { loadSettings } from "./game/settings.ts";
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

// No loupe, no double-tap zoom, no selection on any screen (`no-loupe.ts`);
// for the life of the page, before anything can be touched.
guardAgainstLoupe();

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

// THE REAL FACE A BOOT MAY STAND ON, fetched before the first render: a
// link's (`?face=`) and the free ride's stored one, so a ride the app
// stands up at once (`?start=free`) can raise its map on it. Its heights
// and hints are a chunk of their own (`loadRealFace`); a fetch that fails
// leaves the boot to fall back as any refused map does.
const faces = [new URLSearchParams(location.search).get("face"), loadSettings().ride.face];
void Promise.allSettled(faces.map((id) => (id ? loadRealFace(id) : null))).then(() =>
  render(<App />, root),
);
