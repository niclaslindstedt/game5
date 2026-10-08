// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE APP MARK'S TRAILS, BEING LAID.
//
// The two carved tracks off the icon (`app-mark.ts`) — without the peak,
// which belongs to the full mark (`title-logo.tsx`): on its own the pair of
// tracks is the mark at work. They fill from the summit down, the direction
// a skier cuts them.
//
// Two ways of filling:
//
//   "once" — laid on arrival and left there (the loading card's mark over a
//            load that has stopped).
//   "loop" — laid, held, faded, again. A load in progress
//            (`loading-screen.tsx`). It says the game is working.
//
// IT IS A WIPE, NOT A STROKE, AND THAT IS THE WHOLE DESIGN. The obvious way
// to draw a line on is `stroke-dashoffset`, and it animates on the MAIN
// THREAD — exactly what the loading card is covering for, because building
// a map blocks it for most of a second at a stretch. A band sliding across
// the finished shape is a `transform`, which the browser runs on the
// COMPOSITOR, so it keeps moving through a block that would freeze a stroke.
//
// The double translate is how a wipe is done with transforms alone: the
// clipping box slides down over the drawing while the drawing slides up
// by the same amount inside it, so the drawing stays PUT on screen and only
// the window into it moves.

import { MARK_TRAILS, MARK_TRAIL_VIEWBOX, MARK_WIDTH } from "./app-mark.ts";

/** How the trails are laid: once and left, or over and over. */
export type MarkLay = "once" | "loop";

export function MarkTrails({
  lay,
  className,
  title,
}: {
  lay: MarkLay;
  className?: string;
  /** Set only where the mark is the whole of what an element says. Beside a
   * wordmark it is decoration and stays out of the accessibility tree. */
  title?: string;
}) {
  return (
    <div
      class={`mark-trails mark-trails-${lay}${className ? ` ${className}` : ""}`}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
    >
      {/* The finished shape, faint, under everything: it holds the space the
          fill is about to take, so nothing beside the mark shifts. */}
      {trails("mark-trails-ghost")}
      <div class="mark-trails-wipe">
        <div class="mark-trails-slide">{trails("mark-trails-fill")}</div>
      </div>
    </div>
  );
}

/** One copy of the pair, as its own svg — drawn twice, faint and bright,
 * because the wipe has to clip the bright copy without touching the faint. */
function trails(className: string) {
  return (
    <svg class={className} viewBox={MARK_TRAIL_VIEWBOX} aria-hidden="true">
      {MARK_TRAILS.map((d) => (
        <path key={d} d={d} stroke-width={MARK_WIDTH} />
      ))}
    </svg>
  );
}
