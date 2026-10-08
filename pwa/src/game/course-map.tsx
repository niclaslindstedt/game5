// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT EVERY MAP BOX SHARES — the piste drawn behind the words, and the day
// under the name. The level card (`menu-levels.tsx`) and the trick map card
// (`menu-tricks.tsx`) both read them, so a map looks like itself and says
// what day it is the same way wherever it is offered.

import type { PinnedLevel } from "./pinned.ts";
import { MAP_ROUTES } from "./map-routes.ts";
import { ROUTE_BOX, ROUTE_STROKE } from "./route-shape.ts";
import { STRINGS } from "./strings.ts";

/** THE MAP'S OWN LOOP, as the shape it is — the whole track in its own box,
 * so a card's boxes read as different rides before a word on any of them
 * has been read.
 *
 * It sits BEHIND the words rather than beside them: a box is already as
 * short as its contents allow, and a picture given a column of its own would
 * cost the grid the height it was cut down to get. Stroked in
 * `currentColor`, so the box's own state paints it — and aria-hidden, since
 * it says nothing the box does not already say in words. A map `make routes`
 * has not drawn yet simply has no line. */
export function CourseMap({ levelId }: { levelId: string }) {
  const d = MAP_ROUTES[levelId];
  if (d === undefined) return null;
  return (
    <svg
      class="menu-level-route"
      viewBox={`0 0 ${ROUTE_BOX} ${ROUTE_BOX}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        stroke-width={ROUTE_STROKE}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

/** THE DAY a map is ridden in, on one line under its name — the sky and the
 * hour the run starts at. */
export function dayLine(level: PinnedLevel): string {
  return STRINGS.mapDay(STRINGS.mapSky[level.day.weather] ?? level.day.weather, level.day.hour);
}
