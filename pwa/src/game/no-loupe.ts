// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// NO LOUPE, EVER: the page's guard against iOS's text gestures. The style
// sheet already says no selection and no callout on every element
// (`styles.css`), and the viewport says no zoom — but iOS still answers a
// double tap held down with its MAGNIFYING LOUPE, and a quick second tap with
// a zoom, because those gestures are recognised off the touch stream itself,
// not off what is selectable. The one thing that stops them for certain is
// cancelling the second tap's `touchend`. That costs nothing the game reads:
// every game press (the thumbs, the lever, the double tap onto a machine,
// the taps on the glass) is a POINTER event, and pointer events are dispatched
// whatever a touch listener cancels. What a cancelled `touchend` does lose is
// the browser's synthesized `click`, so the guard clicks the pressed element
// itself — a quick second press of a menu row still lands.
//
// A field that MEANS to take typed text (an input, a text area, anything
// editable) is left to the browser entirely: it needs its caret.

import { isSecondTap, isTap } from "./no-loupe-tap.ts";

function editable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])") !==
    null
  );
}

/** Install the guard on the document for the life of the page. Returns the
 * way to take it off. */
export function guardAgainstLoupe(doc: Document = document): () => void {
  let lastEnd = -Infinity;
  let start: { target: EventTarget | null; x: number; y: number } | null = null;

  const onTouchStart = (e: TouchEvent): void => {
    const t = e.touches.length === 1 ? e.touches[0] : undefined;
    start = t ? { target: e.target, x: t.clientX, y: t.clientY } : null;
  };

  const onTouchEnd = (e: TouchEvent): void => {
    const now = e.timeStamp;
    const second = isSecondTap(lastEnd, now);
    lastEnd = now;
    if (!second || e.touches.length > 0 || editable(e.target)) return;
    e.preventDefault();
    // The cancelled end takes the browser's click with it: give it back.
    const t = e.changedTouches[0];
    const from = start;
    start = null;
    if (!t || !from || from.target !== e.target) return;
    if (!isTap(from.x, from.y, t.clientX, t.clientY)) return;
    if (e.target instanceof HTMLElement) e.target.click();
    else if (e.target instanceof Element) {
      e.target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }
  };

  // Selection and the long-press menu, refused outright wherever no field
  // asked for them; `gesturestart` is iOS's pinch, which the viewport
  // already refuses and a standalone app has been known to forget.
  const refuse = (e: Event): void => {
    if (!editable(e.target)) e.preventDefault();
  };

  const opts = { passive: false, capture: true } as const;
  doc.addEventListener("touchstart", onTouchStart, opts);
  doc.addEventListener("touchend", onTouchEnd, opts);
  doc.addEventListener("selectstart", refuse, opts);
  doc.addEventListener("contextmenu", refuse, opts);
  doc.addEventListener("gesturestart", refuse, opts);
  doc.addEventListener("dblclick", refuse, opts);
  return () => {
    doc.removeEventListener("touchstart", onTouchStart, opts);
    doc.removeEventListener("touchend", onTouchEnd, opts);
    doc.removeEventListener("selectstart", refuse, opts);
    doc.removeEventListener("contextmenu", refuse, opts);
    doc.removeEventListener("gesturestart", refuse, opts);
    doc.removeEventListener("dblclick", refuse, opts);
  };
}
