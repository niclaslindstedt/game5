// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PAGE AROUND THE CANVAS — two chores `App.tsx`'s loop owes the browser
// and that decide nothing about which surface is up: the sound unlocked on
// the player's first real gesture, and the canvas's box handed to the
// renderer whenever it changes.

import { unlockAudio } from "./audio/index.ts";
import type { WorldRenderer } from "./renderer-api.ts";

/** Start both; the function returned stops them. */
export function watchCanvas(
  canvas: HTMLCanvasElement,
  renderer: Pick<WorldRenderer, "resize">,
): () => void {
  // A browser makes no sound before the player has touched something, so the unlock
  // hangs off real gestures only — captured, so a card cannot swallow it.
  const unlockOpts = { capture: true, passive: true } as const;
  document.addEventListener("pointerdown", unlockAudio, unlockOpts);
  document.addEventListener("keydown", unlockAudio, unlockOpts);
  // The canvas's size is the renderer's own business: it is handed the
  // box it draws into and told again whenever the box changes.
  const fit = (): void => {
    const box = canvas.getBoundingClientRect();
    renderer.resize(box.width, box.height, Math.min(2, devicePixelRatio || 1));
  };
  const observer = new ResizeObserver(fit);
  observer.observe(canvas);
  fit();
  return () => {
    observer.disconnect();
    document.removeEventListener("pointerdown", unlockAudio, unlockOpts);
    document.removeEventListener("keydown", unlockAudio, unlockOpts);
  };
}
