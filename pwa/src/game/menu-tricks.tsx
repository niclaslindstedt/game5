// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRICK MAP CARD — which of the six trick maps (`trick-maps.ts`) a
// TRICKS run is ridden on, opened by the front door's TRICKS tile before the
// skis card.
//
// It wears the level card's silhouette and classes — the boxes, the piste
// behind each — because a map should look like itself wherever it is
// offered. A box is the map's name, what the run is, its DAY (the sky, the
// hour and the date, which is what tells six maps of snow apart before they
// are ridden) and a line of billing. Every one is open: a tricks run keeps
// no record and climbs no ladder, so there is nothing to earn a map with.
//
// THE RING is on the map the settings stand on (`Settings.trickMap`) — where
// the cursor lands and what RIDE in the head takes.

import { TRICKS_RUN } from "@engine";

import { CourseMap } from "./menu-campaign.tsx";
import { Glyph } from "./menu-glyphs.tsx";
import { MenuHead } from "./menu-knobs.tsx";
import { STRINGS } from "./strings.ts";
import { TRICK_MAPS, trickDayLine, trickMapFor, type TrickMap } from "./trick-maps.ts";

function TrickBox({
  map,
  chosen,
  onPick,
}: {
  map: TrickMap;
  /** The box the card would ride — where the cursor lands. One per card. */
  chosen: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      class={`menu-level menu-level-open${chosen ? " menu-level-next" : ""}`}
      aria-current={chosen ? "step" : undefined}
      data-nav-next={chosen ? "" : undefined}
      data-nav-focus={chosen ? "" : undefined}
      onClick={onPick}
    >
      <CourseMap levelId={map.id} />
      <span class="menu-level-head">
        <Glyph name="flip" className="menu-level-mode" />
        <span class="menu-level-billing">{STRINGS.tricksBilling(TRICKS_RUN.limit)}</span>
      </span>
      <span class="menu-level-name">{map.name}</span>
      <span class="menu-level-day">{trickDayLine(map)}</span>
      <span class="menu-level-marks">
        <span class="menu-level-mark">{map.blurb}</span>
      </span>
    </button>
  );
}

export function TrickMapsPage({
  chosen,
  onBack,
  onPick,
}: {
  /** The map the settings already stand on, if any. */
  chosen: string | null;
  onBack: () => void;
  /** On to the skis card, which is where RIDE is. */
  onPick: (map: TrickMap) => void;
}) {
  const pick = trickMapFor(chosen);
  return (
    <div class="menu-card menu-card-levels">
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        title={STRINGS.tricksOn}
        action={
          <button
            type="button"
            class="menu-item menu-item-start menu-head-go"
            data-menu="skis"
            onClick={() => onPick(pick)}
          >
            <span class="menu-item-name">{STRINGS.campaignRide}</span>
          </button>
        }
      />
      <div class="menu-levels">
        {TRICK_MAPS.map((map) => (
          <TrickBox key={map.id} map={map} chosen={map === pick} onPick={() => onPick(map)} />
        ))}
      </div>
    </div>
  );
}
