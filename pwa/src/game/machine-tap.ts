// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TAP ON A MACHINE, HEARD: the page's listener that turns a tap or a
// click into the ray the renderer casts and asks `machine-pick.ts` whether
// it lands on a machine the skier can get on — and if it does, the machine
// press (`InputManager.requestMachine`).

import type { GameState } from "@engine";

import { machineHit, type PickRay } from "./machine-pick.ts";

/** Listen for taps on the machines over the whole page — captured, ahead of
 * the thumb zones, so a tap that boards is not also a turn or a jump. The
 * tap is turned into normalized device coordinates off the canvas's box.
 * Returns the way to stop listening. */
export function watchMachineTaps(
  canvas: HTMLCanvasElement,
  hooks: {
    ray: (x: number, y: number) => PickRay;
    state: () => GameState;
    rides: () => boolean;
    board: () => void;
  },
): () => void {
  const onDown = (e: PointerEvent): void => {
    if (!hooks.rides()) return;
    // A press of the HUD's own (the minimap, the reset) stays its own.
    if (e.target instanceof Element && e.target.closest("button")) return;
    const box = canvas.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return;
    const x = ((e.clientX - box.left) / box.width) * 2 - 1;
    const y = 1 - ((e.clientY - box.top) / box.height) * 2;
    if (!machineHit(hooks.state(), hooks.ray(x, y))) return;
    e.stopPropagation();
    hooks.board();
  };
  document.addEventListener("pointerdown", onDown, true);
  return () => document.removeEventListener("pointerdown", onDown, true);
}
