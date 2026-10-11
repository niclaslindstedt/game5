// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI PICKER: the pair's name between two arrows. The pair itself is
// on the snow under the rider, on the stage behind the card
// (`menu-stage.tsx`) — the shape is what tells a skier what they are about
// to take out, and the arrows step the rack under his feet.
//
// THE SNOWBOARDS are a rack of their own (`board` — the gear card's
// SNOWBOARD side, where a run lets a free choice of pair).

import { pairById, type PairId } from "@engine";

import { rackOf } from "./ski-stats.ts";
import { STRINGS } from "./strings.ts";

export function SkisPicker({
  skis,
  board = false,
  onPick,
}: {
  skis: PairId;
  /** Whether the rack is the boards' (the gear card's SNOWBOARD side). */
  board?: boolean;
  onPick: (id: PairId) => void;
}) {
  const spec = pairById(skis);
  const rack = rackOf(board);
  const index = Math.max(
    0,
    rack.findIndex((s) => s.id === spec.id),
  );
  const step = (by: number): void =>
    onPick(rack[(index + by + rack.length) % rack.length].id as PairId);

  return (
    // The arrows and the name between them are ONE stop on a controller's
    // walk (`data-nav-steps`, menu-nav.ts): sideways changes the pair and
    // leaves the cursor where it is.
    <div class="skis-pick" data-nav-steps data-nav-focus>
      <button
        type="button"
        class="skis-pick-step"
        data-nav-step="left"
        data-menu="skis-prev"
        onClick={() => step(-1)}
        aria-label={STRINGS.skisPrev}
      >
        ‹
      </button>
      {/* The name, the class it is, and where it stands in the catalog:
          `2 / 7` is the whole rack in five characters. */}
      <div class="skis-pick-id" aria-live="polite">
        <span class="skis-pick-name">{spec.name.toUpperCase()}</span>
        <span class="skis-pick-line">
          <span class="skis-pick-kind">{spec.kind.toUpperCase()}</span>
          <span class="skis-pick-count">{STRINGS.skisOf(index + 1, rack.length)}</span>
        </span>
      </div>
      <button
        type="button"
        class="skis-pick-step"
        data-nav-step="right"
        data-menu="skis-next"
        onClick={() => step(1)}
        aria-label={STRINGS.skisNext}
      >
        ›
      </button>
    </div>
  );
}
