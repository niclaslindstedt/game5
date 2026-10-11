// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A PRESS THAT SAYS IT LANDED before the work it starts takes the page.
//
// The press that stands a run up (RIDE, SKI, the pause card's RIDE) hands
// the main thread to the load at once: a free ride's mountain is stood up
// in the frame after it, and on a phone that frame can be seconds long.
// Pressed straight through, nothing on the card changes until the loading
// card is drawn, and the page reads as frozen.
//
// So the press is answered FIRST: the button is marked busy (a spinner
// that turns on the compositor, so it keeps turning through a blocked
// main thread), two frames are handed back so that mark is on the glass,
// and only then is the work asked for. A second press meanwhile does
// nothing — it must not stand a second load up behind the first.

import { useEffect, useRef, useState } from "preact/hooks";

/** Frames handed back before the work starts: the one the busy mark is
 * rendered in, and the one it is painted in. */
const FRAMES = 2;

/** Run `action` after `frames` frames, unless cancelled first. */
export function afterFrames(action: () => void, frames = FRAMES): () => void {
  let id = 0;
  let live = true;
  const step = (left: number): void => {
    if (!live) return;
    if (left <= 0) {
      action();
      return;
    }
    id = requestAnimationFrame(() => step(left - 1));
  };
  step(frames);
  return () => {
    live = false;
    cancelAnimationFrame(id);
  };
}

/** `[busy, press]`: `press` marks the button busy and runs `action` once the
 * mark is painted. The mark is let go a couple of frames after the work
 * has started — by then the loading card is over it, and a press that
 * stood nothing up leaves a button that can be pressed again. */
export function useBusyPress(action: () => void): [boolean, () => void] {
  const [busy, setBusy] = useState(false);
  const cancel = useRef<(() => void) | null>(null);
  const latest = useRef(action);
  latest.current = action;
  useEffect(() => () => cancel.current?.(), []);
  const press = (): void => {
    if (busy || cancel.current) return;
    setBusy(true);
    cancel.current = afterFrames(() => {
      latest.current();
      cancel.current = afterFrames(() => {
        cancel.current = null;
        setBusy(false);
      });
    });
  };
  return [busy, press];
}
