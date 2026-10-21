// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WANTED LEVEL on the HUD, under the presses in the top right: five
// stars, the lit ones solid while the army has him in sight and FLASHING
// while it only searches where he was last seen, the unlit ones a faint
// outline — and, while they search, a bar draining toward the moment he
// has LOST THEM, captioned OUT OF SIGHT (or HIDDEN, stood under the
// trees); beside them the SURVIVAL TIMER, with the best ever under it. Every figure is the snapshot's (`wanted-tile.ts`); this files the
// time survived in the highscore (`survival-book.ts`) and draws.

import { useEffect } from "preact/hooks";

import { loadSurvival, noteSurvival } from "./survival-book.ts";
import { STRINGS } from "./strings.ts";
import type { WantedTile } from "./wanted-tile.ts";

/** A five-pointed star of outer radius 10 about the origin. */
const STAR = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 10 : 4.2;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    pts.push(`${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
})();

export function WantedStars({ tile }: { tile: WantedTile }) {
  const final = tile.ended !== null;
  useEffect(() => {
    if (tile.survived > 0) noteSurvival(tile.survived, tile.stars, final);
  }, [tile.survived, tile.stars, final]);
  const best = Math.max(loadSurvival().best, tile.survived);
  return (
    <div
      class="hud-wanted"
      role="status"
      aria-label={STRINGS.wantedLabel(tile.stars, tile.flashing)}
      data-flash={tile.flashing ? "1" : undefined}
      data-ended={tile.ended ?? undefined}
    >
      <svg class="hud-wanted-stars" viewBox={`0 0 ${tile.of * 24} 24`} aria-hidden="true">
        {Array.from({ length: tile.of }, (_, i) => (
          <polygon
            key={i}
            points={STAR}
            transform={`translate(${i * 24 + 12} 12)`}
            class={i < tile.stars ? "hud-wanted-lit" : "hud-wanted-dim"}
          />
        ))}
      </svg>
      {tile.search !== null || tile.hidden ? (
        <span class="hud-wanted-search" data-hidden={tile.hidden ? "1" : undefined}>
          <span class="hud-wanted-word">
            {tile.hidden ? STRINGS.wantedHidden : STRINGS.wantedSearch}
          </span>
          <span class="hud-wanted-bar">
            <span style={{ transform: `scaleX(${(tile.search ?? 1).toFixed(3)})` }} />
          </span>
        </span>
      ) : null}
      <span class="hud-wanted-time">{STRINGS.wantedSurvived(tile.survived)}</span>
      <span class="hud-wanted-best">{STRINGS.wantedBest(best)}</span>
    </div>
  );
}
