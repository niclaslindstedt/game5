// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LEVEL CARD — which of the pinned maps a RACE or a TIME TRIAL is ridden
// on.
//
// THE GAME'S MEASURED MAPS ARE THE CAMPAIGN'S, all of them. A time is only
// worth measuring against somebody else's if the two were skied down the
// same piste on the same day, and a seed dealt at random is a mountain
// nobody else has ever seen — so the two modes that keep a record book pick a MAP here,
// and a seed of one's own stays where nothing is measured (the FREE RIDE's
// start card, and a link's `?seed=`).
//
// WHAT IS OPEN IS WHAT THE CAMPAIGN HAS OPENED, a whole shelf at a time
// (`shelfUnlocked`). Not map by map: this is not a second ladder to climb,
// it is the shelves you have been given, and a skier who has skied the
// glacier should be able to time any of it. The first shelf is open on a
// fresh app, so the card is never empty.
//
// The card wears the campaign's own silhouette and classes — the shelf tabs,
// the boxes, the piste behind each — because a map should look like itself
// wherever it is offered. What is INSIDE a box is each card's own: the ladder
// shows what a rung paid, and this shows what the run would BE and the best
// it has ever been ridden in.

import { type GameMode } from "@engine";
import { useState } from "preact/hooks";

import {
  findLevel,
  fitsMode,
  reachedShelf,
  shelfUnlocked,
  type CampaignLevel,
  type CampaignProgress,
  type CampaignShelf,
} from "./campaign.ts";
import { CourseMap, ShelfTabs, dayLine } from "./menu-campaign.tsx";
import { GradeMark } from "./grade-mark.tsx";
import { MenuBody, MenuHead } from "./menu-knobs.tsx";
import { Glyph } from "./menu-glyphs.tsx";
import { STRINGS } from "./strings.ts";

function LevelBox({
  level,
  mode,
  best,
  chosen,
  onPick,
}: {
  level: CampaignLevel;
  mode: GameMode;
  /** The best this map has seen in THIS mode, as the record book reads it. */
  best: string | null;
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
      <CourseMap levelId={level.id} />
      <span class="menu-level-head">
        <GradeMark grade={level.grade} className="menu-level-grade" />
        <Glyph name={mode === "timeTrial" ? "clock" : "flag"} className="menu-level-mode" />
        <span class="menu-level-billing">
          {STRINGS.campaignBilling(mode === "timeTrial" || mode === "downhill" ? mode : "slalom")}
        </span>
      </span>
      <span class="menu-level-name">{level.name}</span>
      <span class="menu-level-day">{dayLine(level)}</span>
      <span class="menu-level-marks">
        <span class={`menu-level-mark${best === null ? "" : " menu-level-mark-lit"}`}>
          {best ?? STRINGS.levelsNoBest}
        </span>
      </span>
    </button>
  );
}

export function LevelsPage({
  mode,
  progress,
  chosen,
  best,
  onBack,
  onPick,
}: {
  mode: GameMode;
  /** The campaign's board — what is open here is what it has opened. */
  progress: CampaignProgress;
  /** The map the settings already stand on, if any. */
  chosen: string | null;
  /** The record standing on a map in this mode, as a line, or null. */
  best: (level: CampaignLevel) => string | null;
  onBack: () => void;
  /** On to the skis card, which is where RIDE is. */
  onPick: (level: CampaignLevel) => void;
}) {
  const stood = chosen === null ? null : findLevel(chosen);
  const [shown, setShown] = useState<CampaignShelf>(() =>
    stood && shelfUnlocked(stood.shelf, progress) ? stood.shelf : reachedShelf(progress),
  );
  const open = shelfUnlocked(shown, progress);
  // Only the maps the mode can ride: a slalom only where the campaign sets
  // one, a downhill on a downhill's course (`fitsMode`).
  const maps = shown.levels.filter((level) => fitsMode(level, mode));
  const pick = open ? (maps.find((level) => level.id === chosen) ?? maps[0] ?? null) : null;
  return (
    <div class="menu-card menu-card-levels">
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        title={
          mode === "timeTrial"
            ? STRINGS.levelsTrial
            : mode === "downhill"
              ? STRINGS.levelsDownhill
              : STRINGS.levelsRace
        }
        action={
          pick ? (
            <button
              type="button"
              class="menu-item menu-item-start menu-head-go"
              data-menu="skis"
              onClick={() => onPick(pick)}
            >
              <span class="menu-item-name">{STRINGS.campaignRide}</span>
            </button>
          ) : undefined
        }
      />
      <MenuBody>
        <ShelfTabs
          shown={shown}
          open={(shelf) => shelfUnlocked(shelf, progress)}
          line={(shelf) => shelf.blurb}
          hint={STRINGS.levelsShelfLocked}
          onPick={setShown}
        />
        {open ? (
          <div class="menu-levels">
            {maps.map((level) => (
              <LevelBox
                key={level.id}
                level={level}
                mode={mode}
                best={best(level)}
                chosen={level === pick}
                onPick={() => onPick(level)}
              />
            ))}
          </div>
        ) : (
          <p class="menu-empty">{STRINGS.campaignShelfLocked}</p>
        )}
      </MenuBody>
    </div>
  );
}
