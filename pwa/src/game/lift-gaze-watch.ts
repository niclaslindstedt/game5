// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DRAG THAT LOOKS ROUND FROM THE LIFT, heard (`lift-gaze.ts`): every
// finger on the glass, or the pointer held down and moved on a desktop, on a
// run — the renderer takes them only while a lift carries him. Captured on
// the document ahead of the thumb zones, so a drag that starts on the edge
// thumb or the tuck lever looks round as well — and a finger that has
// dragged past the slop says so (`dragging`), so the tuck it set on the
// lever is not held up the lift as a skip (`input.ts`).
//
// A MOUSE looks on any run: the left or the right button held and dragged
// (`hold` says when one goes down and comes up), and the right button's
// menu kept off the picture while a run is ridden.

import { LIFT_GAZE } from "./lift-gaze.ts";

export type GazeWatch = {
  /** Whether a pointer down now has dragged far enough to be a look. */
  dragging(): boolean;
  stop(): void;
};

export function watchGazeDrags(
  target: Window,
  hooks: {
    /** Whether the player rides now. */
    riding: () => boolean;
    /** A drag of `dx`, `dy` CSS px, and whether a mouse made it. */
    drag: (dx: number, dy: number, mouse: boolean) => void;
    /** A mouse button down to look, or let go. */
    hold?: (on: boolean) => void;
  },
): GazeWatch {
  const down = new Map<number, { x: number; y: number; far: boolean; mouse: boolean }>();
  const onDown = (e: PointerEvent): void => {
    if (!hooks.riding()) return;
    // A press of the HUD's own (the minimap, the reset) stays its own.
    if (e.target instanceof Element && e.target.closest("button")) return;
    const mouse = e.pointerType === "mouse";
    if (mouse && e.button !== 0 && e.button !== 2) return;
    down.set(e.pointerId, { x: e.clientX, y: e.clientY, far: false, mouse });
    if (mouse) hooks.hold?.(true);
  };
  const onMove = (e: PointerEvent): void => {
    const at = down.get(e.pointerId);
    if (!at) return;
    const dx = e.clientX - at.x;
    const dy = e.clientY - at.y;
    if (!at.far) {
      if (Math.hypot(dx, dy) < LIFT_GAZE.slop) return;
      at.far = true;
    }
    at.x = e.clientX;
    at.y = e.clientY;
    if (hooks.riding()) hooks.drag(dx, dy, at.mouse);
  };
  const onUp = (e: PointerEvent): void => {
    if (down.get(e.pointerId)?.mouse) hooks.hold?.(false);
    down.delete(e.pointerId);
  };
  const onMenu = (e: Event): void => {
    if (hooks.riding()) e.preventDefault();
  };
  const opts = { capture: true, passive: true } as const;
  target.document.addEventListener("pointerdown", onDown, opts);
  target.document.addEventListener("pointermove", onMove, opts);
  target.document.addEventListener("pointerup", onUp, opts);
  target.document.addEventListener("pointercancel", onUp, opts);
  target.document.addEventListener("contextmenu", onMenu);
  const onBlur = (): void => {
    if (down.size > 0) hooks.hold?.(false);
    down.clear();
  };
  target.addEventListener("blur", onBlur);
  return {
    dragging: () => {
      for (const p of down.values()) if (p.far) return true;
      return false;
    },
    stop() {
      target.document.removeEventListener("pointerdown", onDown, opts);
      target.document.removeEventListener("pointermove", onMove, opts);
      target.document.removeEventListener("pointerup", onUp, opts);
      target.document.removeEventListener("pointercancel", onUp, opts);
      target.document.removeEventListener("contextmenu", onMenu);
      target.removeEventListener("blur", onBlur);
    },
  };
}
