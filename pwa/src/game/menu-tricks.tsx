// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRICK MAP CARD — which of the six trick maps (`trick-maps.ts`) a
// TRICKS run or a BIG AIR contest is ridden on, opened off the tricks card
// (`menu-freestyle.tsx`) before the skis card. A big air contest builds its
// jump over the map (R37); the map gives it its mountain, its day and its
// sky.
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

import {
  BIG_AIR,
  HALFPIPE,
  KNUCKLE_HUCK,
  RAIL_JAM,
  SLOPESTYLE,
  TRICKS_RUN,
  type GameMode,
} from "@engine";

import { CourseMap } from "./menu-campaign.tsx";
import { Glyph } from "./menu-glyphs.tsx";
import { MenuBody, MenuHead } from "./menu-knobs.tsx";
import { STRINGS } from "./strings.ts";
import { TRICK_MAPS, trickDayLine, trickMapFor, type TrickMap } from "./trick-maps.ts";

function TrickBox({
  map,
  billing,
  chosen,
  onPick,
}: {
  map: TrickMap;
  /** What is ridden on it: the park run, or a contest's jumps. */
  billing: string;
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
        <span class="menu-level-billing">{billing}</span>
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
  mode,
  chosen,
  onBack,
  onPick,
}: {
  /** The format the card picks a map for: the park run, or a freestyle
   * contest (BIG AIR — its jump built over the map, R37; a KNUCKLE HUCK —
   * its knuckle built over it, R38; a SLOPESTYLE run — its course built
   * over it, R39; a RAIL JAM — its set built over it, R40). */
  mode: GameMode;
  /** The map the settings already stand on, if any. */
  chosen: string | null;
  onBack: () => void;
  /** On to the skis card, which is where RIDE is. */
  onPick: (map: TrickMap) => void;
}) {
  const pick = trickMapFor(chosen);
  const bigAir = mode === "bigAir";
  const knuckle = mode === "knuckleHuck";
  const slope = mode === "slopestyle";
  const rail = mode === "railJam";
  const pipe = mode === "halfpipe";
  const bumps = mode === "moguls";
  const billing = bigAir
    ? STRINGS.bigAirBilling(BIG_AIR.qualification, BIG_AIR.final)
    : knuckle
      ? STRINGS.knuckleBilling(KNUCKLE_HUCK.jam)
      : slope
        ? STRINGS.slopestyleBilling(SLOPESTYLE.qualification, SLOPESTYLE.final)
        : rail
          ? STRINGS.railJamBilling(RAIL_JAM.jam)
          : pipe
            ? STRINGS.halfpipeBilling(HALFPIPE.qualification, HALFPIPE.final)
            : bumps
              ? STRINGS.mogulsBilling
              : STRINGS.tricksBilling(TRICKS_RUN.limit);
  const title = bigAir
    ? STRINGS.bigAirOn
    : knuckle
      ? STRINGS.knuckleOn
      : slope
        ? STRINGS.slopestyleOn
        : rail
          ? STRINGS.railJamOn
          : pipe
            ? STRINGS.halfpipeOn
            : bumps
              ? STRINGS.mogulsOn
              : STRINGS.tricksOn;
  return (
    <div class="menu-card menu-card-levels">
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        title={title}
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
      <MenuBody>
        <div class="menu-levels">
          {TRICK_MAPS.map((map) => (
            <TrickBox
              key={map.id}
              map={map}
              billing={billing}
              chosen={map === pick}
              onPick={() => onPick(map)}
            />
          ))}
        </div>
      </MenuBody>
    </div>
  );
}
